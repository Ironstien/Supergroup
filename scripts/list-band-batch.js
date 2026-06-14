/**
 * Print the next batch of bands for roster review.
 * Usage: node scripts/list-band-batch.js [batchNumber]
 * Mark removals in data/raw/band-removals.json then rebuild.
 */
const fs = require('fs');
const path = require('path');

const BANDS = require('./data/bands');
const REMOVALS = path.join(__dirname, '../data/raw/band-removals.json');
const BATCH = 5;

function loadRemovals() {
  if (!fs.existsSync(REMOVALS)) return [];
  return JSON.parse(fs.readFileSync(REMOVALS, 'utf8')).keys ?? [];
}

const removals = new Set(loadRemovals());
const remaining = BANDS.filter((b) => !removals.has(`${b.band}|${b.era}`));
const batchNum = Number(process.argv[2] ?? 0);
const start = batchNum * BATCH;
const slice = remaining.slice(start, start + BATCH);

console.log(`Batch ${batchNum + 1} · ${remaining.length} bands remaining · showing ${slice.length}`);
slice.forEach((b, i) => {
  console.log(`${start + i + 1}. ${b.band} (${b.era}) — ${b.members.length} members — tier ${b.tier ?? 'B'}`);
});
if (slice.length === BATCH) {
  console.log(`\nNext batch: node scripts/list-band-batch.js ${batchNum + 1}`);
}
