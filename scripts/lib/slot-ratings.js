/**
 * FAB FIVE → slot ratings and eligible roles (threshold 75).
 * @see docs/STATS.md
 */

const SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Producer'];

const WEIGHTS = {
  Vocals: { vox: 0.45, star: 0.25, groove: 0.15, play: 0.1, desk: 0.05 },
  Guitar: { vox: 0.15, star: 0.2, groove: 0.1, play: 0.4, desk: 0.15 },
  Bass: { vox: 0.05, star: 0.15, groove: 0.35, play: 0.35, desk: 0.1 },
  Drums: { vox: 0.05, star: 0.2, groove: 0.4, play: 0.3, desk: 0.05 },
  Producer: { vox: 0.05, star: 0.15, groove: 0.05, play: 0.25, desk: 0.5 },
};

const DEFAULT_THRESHOLD = 75;

function slotRating(stats, slot) {
  const w = WEIGHTS[slot];
  return Math.round(
    stats.vox * w.vox +
      stats.star * w.star +
      stats.groove * w.groove +
      stats.play * w.play +
      stats.desk * w.desk
  );
}

function allSlotRatings(stats) {
  const slotRatings = {};
  for (const slot of SLOTS) {
    slotRatings[slot] = slotRating(stats, slot);
  }
  return slotRatings;
}

function eligibleSlots(stats, { threshold = DEFAULT_THRESHOLD, forceProducer = false } = {}) {
  const slots = SLOTS.filter((s) => slotRating(stats, s) >= threshold);
  if (forceProducer && !slots.includes('Producer')) {
    slots.push('Producer');
  }
  return slots.sort((a, b) => SLOTS.indexOf(a) - SLOTS.indexOf(b));
}

function enrichMusician(m) {
  const slotRatings = allSlotRatings(m.stats);
  const slots = m.eligibleSlots ?? eligibleSlots(m.stats, { forceProducer: m.producerOnly });
  const { producerOnly, ...rest } = m;
  return {
    ...rest,
    eligibleSlots: slots,
    derived: { slotRatings },
  };
}

module.exports = {
  SLOTS,
  DEFAULT_THRESHOLD,
  slotRating,
  allSlotRatings,
  eligibleSlots,
  enrichMusician,
};
