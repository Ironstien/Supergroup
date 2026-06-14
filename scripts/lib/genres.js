/** Locked spin genres — see docs/GENRES.md */
const GENRES = ['rock', 'metal', 'punk', 'alternative'];

/** Legacy / dropped tags → merge target for remapping */
const REMOVED_GENRE_MAP = {
  pop: 'rock',
  'hip-hop': 'rock',
  electronic: 'rock',
  indie: 'alternative',
  funk: 'rock',
  'r&b': 'rock',
  country: 'rock',
  latin: 'rock',
  jazz: 'rock',
  folk: 'alternative',
  blues: 'rock',
  reggae: 'rock',
};

const RELATED_GENRES = {
  rock: ['alternative', 'punk', 'metal'],
  metal: ['rock', 'alternative', 'punk'],
  punk: ['rock', 'alternative', 'metal'],
  alternative: ['rock', 'punk', 'metal'],
};

const THIN_POOL_GENRES = new Set(['punk', 'alternative']);

function remapGenres(genres) {
  const out = [];
  for (const genre of genres) {
    const mapped = REMOVED_GENRE_MAP[genre] ?? genre;
    if (GENRES.includes(mapped) && !out.includes(mapped)) {
      out.push(mapped);
    }
  }
  return out.slice(0, 3);
}

function mergePoolGenre(genre) {
  return REMOVED_GENRE_MAP[genre] ?? genre;
}

module.exports = {
  GENRES,
  REMOVED_GENRE_MAP,
  RELATED_GENRES,
  THIN_POOL_GENRES,
  remapGenres,
  mergePoolGenre,
};
