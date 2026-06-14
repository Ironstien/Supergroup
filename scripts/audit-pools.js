/**
 * Report pool coverage for data/raw/musicians.json
 * Run: node scripts/audit-pools.js
 */
const fs = require('fs');
const path = require('path');
const { auditPools } = require('./lib/pool-audit');

const DATA = path.join(__dirname, '../data/raw/musicians.json');
const min = Number(process.argv[2] || 5);

const { musicians, count } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const audit = auditPools(musicians, { min });

console.log(`Musicians: ${count ?? musicians.length}`);
console.log(`Pools under ${min}: ${audit.underMin}/${audit.totalPools}`);
console.log(`Per pool: min=${audit.min} avg=${audit.avg.toFixed(2)} max=${audit.max}`);
if (audit.underMin) {
  console.log('\nUnder target:');
  for (const [k, c] of audit.under) console.log(`  ${c}\t${k}`);
}
