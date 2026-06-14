/**
 * Deterministic FAB FIVE stats from id + genres + tier.
 * tier: A (stars), B (solid), C (obscure/session — still often slot-eligible)
 */

const GENRE_BIAS = {
  rock: { vox: 0, play: 8, groove: 2, star: 3, desk: 0 },
  metal: { vox: 2, play: 10, groove: 4, star: 4, desk: 0 },
  punk: { vox: 4, play: 6, groove: 4, star: 3, desk: 2 },
  alternative: { vox: 4, play: 6, groove: 3, star: 5, desk: 4 },
};

const TIER_BASE = {
  A: { min: 78, max: 97, spread: 12 },
  B: { min: 62, max: 88, spread: 16 },
  C: { min: 52, max: 82, spread: 18 },
};

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function generateStats(id, genres, tier = 'B') {
  const rand = rng(hash32(id));
  const t = TIER_BASE[tier] ?? TIER_BASE.B;
  const bias = { vox: 0, play: 0, groove: 0, star: 0, desk: 0 };
  for (const g of genres) {
    const b = GENRE_BIAS[g];
    if (b) {
      for (const k of Object.keys(bias)) bias[k] += b[k] / genres.length;
    }
  }

  const stats = {};
  for (const key of ['vox', 'play', 'groove', 'star', 'desk']) {
    const base = t.min + rand() * (t.max - t.min);
    const jitter = (rand() - 0.5) * t.spread;
    stats[key] = clamp(base + bias[key] + jitter, 35, 99);
  }

  return stats;
}

module.exports = { generateStats, hash32 };
