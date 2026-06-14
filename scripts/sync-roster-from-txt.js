/**
 * Sync band-removals.json from data/bands-roster.txt (bands listed = KEEP).
 * Run: node scripts/sync-roster-from-txt.js
 */
const fs = require('fs');
const path = require('path');
const { bandKey } = require('./lib/band-key');
const { parseRosterTxt } = require('./lib/parse-roster-txt');

const ROSTER = path.join(__dirname, '../data/bands-roster.txt');
const REMOVALS = path.join(__dirname, '../data/raw/band-removals.json');
const BANDS = require('./data/bands');

function main() {
  const keep = parseRosterTxt(ROSTER);
  const keepKeys = new Set(keep.map((e) => e.key));
  const allKeys = BANDS.map((b) => ({ key: bandKey(b.band, b.era), name: b.band, era: b.era }));
  const removalKeys = allKeys.filter((b) => !keepKeys.has(b.key)).map((b) => b.key);
  const missingFromData = keep.filter((e) => !allKeys.some((b) => b.key === e.key));

  fs.writeFileSync(REMOVALS, JSON.stringify({ keys: removalKeys }, null, 2));

  console.log(`Roster keep list: ${keep.length} bands`);
  console.log(`Removed from game: ${removalKeys.length} bands`);
  console.log(`Active in game: ${allKeys.length - removalKeys.length} bands`);

  if (missingFromData.length) {
    console.log('\nIn roster txt but NOT in bands.js (add these first):');
    missingFromData.forEach((e) => console.log(`  - ${e.name} (${e.era}) [${e.key}]`));
    process.exitCode = 1;
  }
}

main();
