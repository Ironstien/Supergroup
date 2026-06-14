import { SLOTS } from './genres.js';
import { createRng, shuffle, pickRandomDifferent, dailySeed } from './rng.js';

export { SLOTS };

export const ROUND_COUNT = 5;
export const POST_WINNER_DISPLAY_COUNT = 2;

export function getWinnerStripIndex(strip) {
  return strip.length - 1 - POST_WINNER_DISPLAY_COUNT;
}

export function bandKeyFromRecord(band) {
  return band.key ?? `${slugifyBand(band.name)}|${band.era}`;
}

export function slugifyBand(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildBandMaps(bands, musicians) {
  const bandByKey = new Map(bands.map((b) => [b.key, b]));
  const musiciansByBand = new Map();

  for (const m of musicians) {
    const key = m.bandKey;
    if (!key) continue;
    if (!musiciansByBand.has(key)) musiciansByBand.set(key, []);
    musiciansByBand.get(key).push(m);
  }

  return { bandByKey, musiciansByBand };
}

export function spinFromBand(band) {
  return {
    bandKey: band.key,
    bandName: band.name,
    logoUrl: band.logoUrl ?? null,
  };
}

export function generateSpins(bands, rng) {
  return shuffle(bands, rng).slice(0, ROUND_COUNT).map(spinFromBand);
}

export function activeBands(bands) {
  return bands.filter((band) => !band.hidden);
}

function baseGameState(mode, seed, musicians, playableBands, spins) {
  const maps = buildBandMaps(playableBands, musicians);
  const rng = createRng(seed);

  return {
    mode,
    seed,
    musicians,
    bands: playableBands,
    ...maps,
    spins,
    round: 0,
    lineup: {},
    picks: [],
    bandRerollUsed: false,
    rng,
    phase: 'playing',
    pendingMusician: null,
    results: null,
    wheelReady: false,
    reelWindows: [],
  };
}

export function createGame(musicians, bands, mode = 'practice') {
  const seed = mode === 'daily' ? dailySeed() : Date.now();
  const playableBands = activeBands(bands);
  const spins = generateSpins(playableBands, createRng(seed));
  return baseGameState(mode, seed, musicians, playableBands, spins);
}

export function createDailyGame(musicians, bands, daily) {
  const playableBands = activeBands(bands);
  const bandByKey = new Map(playableBands.map((band) => [band.key, band]));
  const spins = daily.bandKeys.map((bandKey) => {
    const band = bandByKey.get(bandKey);
    if (!band) {
      throw new Error(`Daily puzzle references unknown band: ${bandKey}`);
    }
    return spinFromBand(band);
  });

  return {
    ...baseGameState('daily', daily.seed, musicians, playableBands, spins),
    puzzleDate: daily.puzzleDate,
    puzzleTimezone: daily.timezone ?? 'UTC',
  };
}

export function currentSpin(game) {
  return game.spins[game.round];
}

export function getPool(game) {
  const spin = currentSpin(game);
  if (!spin) return [];
  const pool = game.musiciansByBand.get(spin.bandKey) ?? [];
  const pickedIds = new Set(Object.values(game.lineup).map((m) => m.id));
  const available = pool.filter(
    (m) => !pickedIds.has(m.id) && openSlots(game, m).length > 0
  );
  return shuffle(available, game.rng);
}

export function openSlots(game, musician) {
  const taken = new Set(Object.keys(game.lineup));
  const slots = musician.eligibleSlots.filter((s) => s !== 'Producer' && !taken.has(s));
  if (!taken.has('Producer')) {
    slots.push('Producer');
  }
  return slots;
}

export function canRerollBand(game) {
  return !game.bandRerollUsed && game.phase === 'playing' && !game.pendingMusician && game.wheelReady;
}

export function rerollBand(game) {
  if (!canRerollBand(game)) return game;
  const spin = game.spins[game.round];
  const options = game.bands.filter((b) => b.key !== spin.bandKey).map((b) => b.key);
  const nextKey = pickRandomDifferent(options, spin.bandKey, game.rng);
  const band = game.bandByKey.get(nextKey);
  if (!band) return game;

  game.spins[game.round] = spinFromBand(band);
  game.bandRerollUsed = true;
  game.wheelReady = false;
  if (game.reelWindows) game.reelWindows[game.round] = null;
  return game;
}

export function setReelLandingWindow(game, round, window) {
  if (!game.reelWindows) game.reelWindows = [];
  game.reelWindows[round] = window;
  return game;
}

export function getReelLandingWindow(game, round) {
  return game.reelWindows?.[round] ?? null;
}

export function setWheelReady(game, ready = true) {
  game.wheelReady = ready;
  return game;
}

export function selectMusician(game, musician) {
  game.pendingMusician = musician;
  return game;
}

export function assignSlot(game, slot) {
  if (!game.pendingMusician) return game;
  const open = openSlots(game, game.pendingMusician);
  if (!open.includes(slot)) return game;

  game.lineup[slot] = game.pendingMusician;
  game.picks.push({
    round: game.round,
    spin: { ...game.spins[game.round] },
    musician: game.pendingMusician,
    slot,
  });
  game.pendingMusician = null;
  game.round += 1;
  game.wheelReady = false;

  if (game.round >= ROUND_COUNT) {
    game.phase = 'review';
  }
  return game;
}

export function assignPick(game, musician, slot) {
  selectMusician(game, musician);
  return assignSlot(game, slot);
}

export function cancelSelection(game) {
  game.pendingMusician = null;
  return game;
}

export function isLineupComplete(game) {
  return Object.keys(game.lineup).length === ROUND_COUNT;
}

export function goToReview(game) {
  if (isLineupComplete(game)) game.phase = 'review';
  return game;
}

export function submitGame(game, evaluateFn) {
  game.results = evaluateFn(game.lineup, game.rng);
  game.phase = 'results';
  return game;
}

export function resetGame(game) {
  return createGame(game.musicians, game.bands, game.mode);
}

export function getPickForRound(game, round) {
  return game.picks.find((p) => p.round === round) ?? null;
}

export function getOpenSlots(game) {
  return SLOTS.filter((slot) => !game.lineup[slot]);
}

export function getUnpickedReels(game) {
  const pickedRounds = new Set(game.picks.map((p) => p.round));
  return Array.from({ length: ROUND_COUNT }, (_, i) => i).filter((i) => !pickedRounds.has(i));
}

export function getSlotForReel(game, reelIndex) {
  const pick = getPickForRound(game, reelIndex);
  if (pick) {
    return { kind: 'filled', slot: pick.slot, musician: pick.musician, spin: pick.spin };
  }

  const openSlots = getOpenSlots(game);
  const unpickedReels = getUnpickedReels(game);
  const openIndex = unpickedReels.indexOf(reelIndex);
  if (openIndex < 0 || openIndex >= openSlots.length) return null;

  return { kind: 'open', slot: openSlots[openIndex] };
}

export function poolSize(game) {
  return getPool(game).length;
}

export function spinReelStrip(game, targetRound = game.round) {
  const target = game.spins[targetRound];
  const pool = game.bands.filter((b) => b.key !== target.bandKey);
  const decoys = shuffle(pool, game.rng);
  const spin = (bands) => bands.map(spinFromBand);
  const lead = spin(decoys.slice(0, 28));
  const mid = spin(shuffle(decoys.slice(0, Math.min(28, decoys.length)), game.rng).slice(0, 24));
  const tail = spin(shuffle(decoys.slice(0, Math.min(20, decoys.length)), game.rng).slice(0, 12));
  const postDisplay = spin(shuffle(decoys, game.rng).slice(0, POST_WINNER_DISPLAY_COUNT));
  return [...lead, ...mid, ...tail, { ...target }, ...postDisplay];
}
