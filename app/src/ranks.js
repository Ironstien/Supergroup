/** Six-tier rank ladder — shared by goal scores and overall grade. */

export const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'F'];

export const RANK_THRESHOLDS = [
  { min: 90, rank: 'S' },
  { min: 80, rank: 'A' },
  { min: 70, rank: 'B' },
  { min: 60, rank: 'C' },
  { min: 50, rank: 'D' },
  { min: 0, rank: 'F' },
];

export const RANK_META = {
  S: {
    label: 'SUPERGROUP',
    color: '#e8b923',
    bg: 'rgba(232, 185, 35, 0.14)',
    border: 'rgba(232, 185, 35, 0.55)',
  },
  A: {
    label: 'Platinum Dreams',
    color: '#8fd14a',
    bg: 'rgba(143, 209, 74, 0.12)',
    border: 'rgba(143, 209, 74, 0.45)',
  },
  B: {
    label: 'Critical Darling',
    color: '#2f9a5c',
    bg: 'rgba(47, 154, 92, 0.12)',
    border: 'rgba(47, 154, 92, 0.45)',
  },
  C: {
    label: 'Opening Act',
    color: '#4ec5d4',
    bg: 'rgba(78, 197, 212, 0.12)',
    border: 'rgba(78, 197, 212, 0.45)',
  },
  D: {
    label: 'Bar Band',
    color: '#e8923a',
    bg: 'rgba(232, 146, 58, 0.12)',
    border: 'rgba(232, 146, 58, 0.45)',
  },
  F: {
    label: 'Basement Demo',
    color: '#e05252',
    bg: 'rgba(224, 82, 82, 0.12)',
    border: 'rgba(224, 82, 82, 0.45)',
  },
};

const GOAL_STATUS = {
  charts: {
    S: '#1 debut',
    A: 'Top 10 album',
    B: 'Charting single',
    C: 'Streaming buzz',
    D: 'Regional radio',
    F: 'No chart entry',
  },
  tour: {
    S: 'World tour sold out',
    A: 'Sold out all year',
    B: 'Most dates sold out',
    C: 'Mixed houses',
    D: 'Half-empty rooms',
    F: 'Cancelled dates',
  },
  reviews: {
    S: '3/3 five-star reviews',
    A: '2/3 five-star reviews',
    B: '1/3 five-star reviews',
    C: 'Mixed press',
    D: 'Harsh notices',
    F: 'Panned everywhere',
  },
};

const OVERALL_RULES = {
  S: 'All three goals rank S (90+ each) — the triple crown.',
  A: 'Every goal ranks A or better (80+ each).',
  B: 'Every goal ranks B or better (70+ each).',
  C: 'Average score lands at C tier, capped one rank above your worst goal.',
  D: 'Average score lands at D tier, capped one rank above your worst goal.',
  F: 'Average below 50, or a failing goal pulls the band to the bottom.',
};

export function rankIndex(rank) {
  const idx = RANK_ORDER.indexOf(rank);
  return idx === -1 ? RANK_ORDER.length - 1 : idx;
}

export function rankFromScore(score) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return RANK_THRESHOLDS.find((tier) => value >= tier.min)?.rank ?? 'F';
}

export function rankLabel(rank) {
  return RANK_META[rank]?.label ?? rank;
}

export function rankColor(rank) {
  return RANK_META[rank]?.color ?? RANK_META.F.color;
}

export function goalStatus(goal, rank) {
  return GOAL_STATUS[goal]?.[rank] ?? '';
}

export function overallRankRule(rank) {
  return OVERALL_RULES[rank] ?? '';
}

/**
 * Overall grade from three goal scores and their tiers.
 * S requires every goal at S. Otherwise average tier, capped one step above the worst goal.
 */
export function overallRankFromGoals(scores, goalRanks) {
  if (goalRanks.every((rank) => rank === 'S')) return 'S';

  const avg = Math.round((scores.charts + scores.tour + scores.reviews) / 3);
  const baseIdx = rankIndex(rankFromScore(avg));
  const worstIdx = Math.max(...goalRanks.map(rankIndex));
  const capIdx = Math.max(0, worstIdx - 1);
  const finalIdx = Math.max(baseIdx, capIdx);

  if (goalRanks.every((rank) => rankIndex(rank) <= rankIndex('A'))) {
    return RANK_ORDER[Math.max(finalIdx, rankIndex('A'))];
  }
  if (goalRanks.every((rank) => rankIndex(rank) <= rankIndex('B'))) {
    return RANK_ORDER[Math.max(finalIdx, rankIndex('B'))];
  }

  return RANK_ORDER[Math.min(finalIdx, RANK_ORDER.length - 1)];
}

export function formatScoreOutOf100(score) {
  return `${Math.max(0, Math.min(100, Math.round(score)))}/100`;
}
