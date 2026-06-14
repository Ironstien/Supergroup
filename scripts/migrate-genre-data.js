/**
 * One-time migration: fold removed genre pools/tags into the 9 locked spins.
 * Run: node scripts/migrate-genre-data.js
 */
const fs = require('fs');
const path = require('path');
const { GENRES, mergePoolGenre, remapGenres } = require('./lib/genres');

const STARTER_PATH = path.join(__dirname, 'data/starter.js');
const POOLS_PATH = path.join(__dirname, 'data/individual-pools.js');

function dedupeNames(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function migratePools(pools) {
  const migrated = {};
  for (const era of Object.keys(pools)) {
    migrated[era] = {};
    for (const genre of GENRES) {
      migrated[era][genre] = [];
    }

    for (const [genre, names] of Object.entries(pools[era])) {
      const target = mergePoolGenre(genre);
      if (!migrated[era][target]) {
        migrated[era][target] = [];
      }
      migrated[era][target].push(...names);
    }

    for (const genre of GENRES) {
      migrated[era][genre] = dedupeNames(migrated[era][genre] || []);
    }
  }
  return migrated;
}

function formatStarter(entries) {
  const lines = ['/** Hand-curated starter musicians with FAB FIVE stats. */', 'module.exports = ['];
  let currentEra = null;

  for (const entry of entries) {
    if (entry.era !== currentEra) {
      currentEra = entry.era;
      lines.push(`  // ── ${currentEra} ──`);
    }
    const genres = JSON.stringify(remapGenres(entry.genres));
    const stats = JSON.stringify(entry.stats);
    const parts = [
      `id: '${entry.id}'`,
      `name: '${entry.name.replace(/'/g, "\\'")}'`,
      `era: '${entry.era}'`,
      `genres: ${genres}`,
      `stats: ${stats}`,
    ];
    if (entry.producerOnly) parts.push('producerOnly: true');
    if (entry.beef) parts.push(`beef: ${JSON.stringify(entry.beef)}`);
    lines.push(`  { ${parts.join(', ')} },`);
  }

  lines.push('];', '');
  return lines.join('\n');
}

function main() {
  const starter = require('./data/starter');
  const pools = require('./data/individual-pools');

  const migratedStarter = starter.map((entry) => ({
    ...entry,
    genres: remapGenres(entry.genres),
  }));

  const migratedPools = migratePools(pools);

  fs.writeFileSync(STARTER_PATH, formatStarter(migratedStarter), 'utf8');
  fs.writeFileSync(
    POOLS_PATH,
    `module.exports = ${JSON.stringify(migratedPools, null, 2)};\n`,
    'utf8',
  );

  console.log(`Migrated starter (${migratedStarter.length} entries) → ${STARTER_PATH}`);
  for (const era of Object.keys(migratedPools)) {
    const counts = Object.fromEntries(
      GENRES.map((genre) => [genre, migratedPools[era][genre].length]),
    );
    console.log(`${era} pool sizes:`, counts);
  }
  console.log(`Wrote merged pools → ${POOLS_PATH}`);
}

main();
