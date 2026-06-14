import { getSlotRating } from './slot-ratings.js';
import { formatMusicianName } from './musician-display.js';
import {
  goalStatus,
  overallRankFromGoals,
  rankFromScore,
  rankLabel,
} from './ranks.js';

const INSTRUMENT_SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums'];

function musicianGoalScore(musician, slot, goal) {
  const s = musician.stats;
  if (goal === 'charts') {
    if (slot === 'Producer') return s.star * 0.35 + s.desk * 0.5 + s.vox * 0.15;
    return s.star * 0.4 + s.desk * 0.35 + s.vox * 0.25;
  }
  if (goal === 'tour') {
    if (slot === 'Producer') return s.star * 0.3 + s.desk * 0.35 + s.groove * 0.2 + s.vox * 0.15;
    return s.star * 0.4 + s.groove * 0.35 + s.vox * 0.25;
  }
  // reviews
  if (slot === 'Producer') return s.desk * 0.55 + s.play * 0.25 + s.star * 0.2;
  return s.desk * 0.45 + s.play * 0.4 + s.star * 0.15;
}

function bandGoalScore(lineup, goal) {
  const entries = Object.entries(lineup).filter(([, m]) => m);
  if (!entries.length) return 0;
  const sum = entries.reduce((acc, [slot, m]) => acc + musicianGoalScore(m, slot, goal), 0);
  return sum / entries.length;
}

function slotBreakdown(lineup) {
  return INSTRUMENT_SLOTS.concat(['Producer']).map((slot) => {
    const m = lineup[slot];
    return {
      slot,
      name: m ? formatMusicianName(m) : '—',
      band: m?.band ?? null,
      rating: m ? getSlotRating(m, slot) : null,
    };
  });
}

const ALBUM_ADJECTIVES = [
  'Neon', 'Midnight', 'Electric', 'Golden', 'Broken', 'Velvet', 'Static', 'Cosmic',
];
const ALBUM_NOUNS = [
  'Highway', 'Paradise', 'Reverie', 'Voltage', 'Horizon', 'Echoes', 'Mirage', 'Pulse',
];

function goalResult(goal, score, rank) {
  return {
    score,
    rank,
    status: goalStatus(goal, rank),
  };
}

export function evaluateLineup(lineup, rng) {
  const chartsBase = bandGoalScore(lineup, 'charts');
  const tourBase = bandGoalScore(lineup, 'tour');
  const reviewsBase = bandGoalScore(lineup, 'reviews');

  const variance = () => (rng() - 0.5) * 8;
  const charts = Math.round(chartsBase + variance());
  const tour = Math.round(tourBase + variance());
  const reviews = Math.round(reviewsBase + variance());

  const chartsRank = rankFromScore(charts);
  const tourRank = rankFromScore(tour);
  const reviewsRank = rankFromScore(reviews);

  const goals = {
    charts: goalResult('charts', charts, chartsRank),
    tour: goalResult('tour', tour, tourRank),
    reviews: goalResult('reviews', reviews, reviewsRank),
  };

  const goalRanks = [chartsRank, tourRank, reviewsRank];
  const grade = overallRankFromGoals(
    { charts, tour, reviews },
    goalRanks
  );
  const supergroup = grade === 'S';

  const adj = ALBUM_ADJECTIVES[Math.floor(rng() * ALBUM_ADJECTIVES.length)];
  const noun = ALBUM_NOUNS[Math.floor(rng() * ALBUM_NOUNS.length)];
  const albumTitle = `${adj} ${noun}`;

  const tracks = [
    'Opening Statement',
    'Supergroup Theory',
    'Chart Position',
    'Sold Out',
    'Five Stars',
    'Encore (Live)',
    'B-Side Blues',
    'Hidden Track',
  ].slice(0, 6 + Math.floor(rng() * 3));

  return {
    scores: { charts, tour, reviews },
    goals,
    ranks: { charts: chartsRank, tour: tourRank, reviews: reviewsRank },
    supergroup,
    breakdown: slotBreakdown(lineup),
    album: { title: albumTitle, tracks },
    grade,
  };
}

/** @deprecated Use rankLabel from ranks.js */
export function gradeLabel(grade) {
  return rankLabel(grade);
}
