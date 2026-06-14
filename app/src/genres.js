/** @see docs/GENRES.md */
export const GENRES = [
  { key: 'rock', label: 'ROCK' },
  { key: 'metal', label: 'METAL' },
  { key: 'punk', label: 'PUNK' },
  { key: 'alternative', label: 'ALT' },
];

export const ERAS = ['80s', '90s', '00s', '10s', '20s'];

export const SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Producer'];

export const INSTRUMENT_SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums'];

export const SLOT_LABELS = {
  Vocals: 'Vocals',
  Guitar: 'Guitar',
  Bass: 'Bass',
  Drums: 'Drums',
  Producer: 'Producer',
};

export function genreLabel(key) {
  return GENRES.find((g) => g.key === key)?.label ?? key.toUpperCase();
}

export function poolKey(genre, era) {
  return `${genre}|${era}`;
}
