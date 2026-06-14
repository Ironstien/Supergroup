const { SLOTS } = require('./slot-ratings');

const { GENRES } = require('./genres');
const ERAS = ['80s', '90s', '00s', '10s', '20s'];

function buildPoolCounts(musicians) {
  const pools = new Map();
  for (const g of GENRES) {
    for (const e of ERAS) {
      pools.set(`${g}|${e}`, 0);
    }
  }
  for (const m of musicians) {
    for (const g of m.genres) {
      const k = `${g}|${m.era}`;
      pools.set(k, (pools.get(k) ?? 0) + 1);
    }
  }
  return pools;
}

function auditPools(musicians, { min = 5 } = {}) {
  const pools = buildPoolCounts(musicians);
  const under = [...pools.entries()]
    .filter(([, c]) => c < min)
    .sort((a, b) => a[1] - b[1]);
  const vals = [...pools.values()];
  return {
    totalPools: pools.size,
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    underMin: under.length,
    under,
    pools,
  };
}

module.exports = { GENRES, ERAS, SLOTS, buildPoolCounts, auditPools };
