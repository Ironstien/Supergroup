/** @see docs/STATS.md — FAB FIVE slot ratings */

export const SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Producer'];

const WEIGHTS = {
  Vocals: { vox: 0.45, star: 0.25, groove: 0.15, play: 0.1, desk: 0.05 },
  Guitar: { vox: 0.15, star: 0.2, groove: 0.1, play: 0.4, desk: 0.15 },
  Bass: { vox: 0.05, star: 0.15, groove: 0.35, play: 0.35, desk: 0.1 },
  Drums: { vox: 0.05, star: 0.2, groove: 0.4, play: 0.3, desk: 0.05 },
  Producer: { vox: 0.05, star: 0.15, groove: 0.05, play: 0.25, desk: 0.5 },
};

export function slotRating(stats, slot) {
  const w = WEIGHTS[slot];
  return Math.round(
    stats.vox * w.vox +
      stats.star * w.star +
      stats.groove * w.groove +
      stats.play * w.play +
      stats.desk * w.desk
  );
}

export function allSlotRatings(stats) {
  const ratings = {};
  for (const slot of SLOTS) {
    ratings[slot] = slotRating(stats, slot);
  }
  return ratings;
}

export function getSlotRating(musician, slot) {
  return musician.derived?.slotRatings?.[slot] ?? slotRating(musician.stats, slot);
}
