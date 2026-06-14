import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildMusicPrompt } from '../server/lib/prompts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { musicians } = JSON.parse(
  readFileSync(join(root, 'data/raw/musicians.json'), 'utf8')
);

const SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Producer'];
const ERAS = ['80s', '90s', '00s', '10s', '20s'];
const GENRES = ['rock', 'metal', 'punk', 'alternative'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function eligibleForSlot(m, slot) {
  if (slot === 'Producer') return true;
  return m.eligibleSlots?.includes(slot);
}

function buildRandomLineup() {
  const used = new Set();
  const picks = [];

  for (const slot of SLOTS) {
    const candidates = musicians.filter(
      (m) => !used.has(m.id) && eligibleForSlot(m, slot)
    );
    if (!candidates.length) return null;

    const musician = pickRandom(candidates);
    used.add(musician.id);
    const genre = pickRandom(musician.genres);
    picks.push({
      slot,
      name: musician.name,
      band: musician.band ?? 'Solo',
      genre,
      era: musician.era,
    });
  }

  return picks;
}

function main() {
  let picks = null;
  for (let i = 0; i < 50; i++) {
    picks = buildRandomLineup();
    if (picks) break;
  }
  if (!picks) {
    console.error('Could not build a random lineup');
    process.exit(1);
  }

  const album = {
    title: `${pickRandom(['Neon', 'Midnight', 'Electric', 'Golden', 'Bloodline'])} ${pickRandom(['Anthem', 'Highway', 'Voltage', 'Paradise', 'Echoes'])}`,
    tracks: ['Opening Statement', 'Chart Position', 'Sold Out'],
  };

  const prompt = buildMusicPrompt({
    album,
    picks,
    supergroup: true,
    grade: 'S',
  });

  console.log('=== Random supergroup lineup (v2.1.1) ===\n');
  for (const pick of picks) {
    console.log(
      `${pick.slot.padEnd(8)} ${pick.name} (${pick.band}) — ${pick.genre} · ${pick.era}`
    );
  }
  console.log(`\nAlbum title / song title / lyrics: "${album.title}"\n`);
  console.log('=== Generated music prompt ===\n');
  console.log(prompt);
}

main();
