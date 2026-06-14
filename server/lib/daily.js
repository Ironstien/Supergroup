import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseAdmin } from './supabase.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROUND_COUNT = 5;

/** Mulberry32 — must match app/src/rng.js */
function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dailySeedUtc() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function puzzleDateUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadActiveBands() {
  const data = JSON.parse(readFileSync(join(ROOT, 'data/raw/bands.json'), 'utf8'));
  return data.bands.filter((band) => !band.hidden);
}

export function buildDailyPuzzle(seed = dailySeedUtc()) {
  const bands = loadActiveBands();
  const rng = createRng(seed);
  const bandKeys = shuffle(bands, rng).slice(0, ROUND_COUNT).map((band) => band.key);

  return {
    puzzleDate: puzzleDateUtc(),
    seed,
    bandKeys,
    timezone: 'UTC',
  };
}

async function fetchStoredPuzzle(puzzleDate) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('daily_puzzles')
    .select('puzzle_date, seed, band_keys')
    .eq('puzzle_date', puzzleDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    puzzleDate: data.puzzle_date,
    seed: Number(data.seed),
    bandKeys: data.band_keys,
    timezone: 'UTC',
    source: 'supabase',
  };
}

async function storePuzzle(puzzle) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return puzzle;

  const { error } = await supabase.from('daily_puzzles').upsert(
    {
      puzzle_date: puzzle.puzzleDate,
      seed: puzzle.seed,
      band_keys: puzzle.bandKeys,
    },
    { onConflict: 'puzzle_date' }
  );

  if (error) throw new Error(error.message);
  return { ...puzzle, source: 'supabase' };
}

export async function getDailyPuzzle() {
  const puzzleDate = puzzleDateUtc();
  const stored = await fetchStoredPuzzle(puzzleDate);
  if (stored) return stored;

  const puzzle = buildDailyPuzzle();
  return storePuzzle(puzzle);
}
