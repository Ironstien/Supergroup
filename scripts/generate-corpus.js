const fs = require('fs');
const path = require('path');
const { isBandOrGroup } = require('./lib/is-band');
const POOLS = require('./data/individual-pools');

const ERAS = ['80s', '90s', '00s', '10s', '20s'];
const { GENRES, RELATED_GENRES, THIN_POOL_GENRES } = require('./lib/genres');

const TARGET_COUNTS = {
  '80s': 166,
  '90s': 165,
  '00s': 172,
  '10s': 177,
  '20s': 180,
};

const PRODUCER_ONLY = new Set([
  'Nile Rodgers',
  'Rick Rubin',
  'Brian Eno',
  'Max Martin',
  'DJ Premier',
  'Pete Rock',
  'RZA',
  'J Dilla',
  'Timbaland',
  'Pharrell Williams',
  'Chad Hugo',
  'David Guetta',
  'Skrillex',
  'Calvin Harris',
  'Diplo',
  'Jack Antonoff',
  'Metro Boomin',
  'Fred again..',
  'Kaytranada',
  'Arca',
  'Zedd',
  'Benny Blanco',
  'Mustard',
  'Hit-Boy',
]);

function stableHash(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tierByIndex(index, total) {
  const aCutoff = Math.round(total * 0.2);
  const bCutoff = aCutoff + Math.round(total * 0.5);
  if (index < aCutoff) {
    return 'A';
  }
  if (index < bCutoff) {
    return 'B';
  }
  return 'C';
}

function pickGenres(primary, seenGenres, name, era) {
  const genres = [primary];
  const extras = [];
  for (const genre of seenGenres) {
    if (genre !== primary) {
      extras.push(genre);
    }
  }

  const related = RELATED_GENRES[primary] || [];
  for (const rel of related) {
    if (!genres.includes(rel)) {
      extras.push(rel);
    }
  }

  const uniqueExtras = [];
  for (const genre of extras) {
    if (GENRES.includes(genre) && !genres.includes(genre) && !uniqueExtras.includes(genre)) {
      uniqueExtras.push(genre);
    }
  }

  if (THIN_POOL_GENRES.has(primary)) {
    if (uniqueExtras.length > 0) {
      genres.push(uniqueExtras.shift());
    }
    if (uniqueExtras.length > 0 && stableHash(`${era}:${name}:thin`) % 3 === 0) {
      genres.push(uniqueExtras.shift());
    }
  } else if (uniqueExtras.length > 0 && stableHash(`${era}:${name}:extra`) % 2 === 0) {
    genres.push(uniqueExtras.shift());
  }

  return genres.slice(0, 3);
}

function individualNamesForGenre(era, genre) {
  const raw = POOLS[era][genre] || [];
  const seen = new Set();
  const out = [];
  for (const name of raw) {
    const key = name.toLowerCase();
    if (seen.has(key) || isBandOrGroup(name)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function selectForEra(era, starterKeys) {
  const grouped = {};
  for (const genre of GENRES) {
    grouped[genre] = individualNamesForGenre(era, genre);
  }

  const perName = new Map();
  for (const genre of GENRES) {
    for (const name of grouped[genre]) {
      const dedupeKey = `${era}::${name.toLowerCase()}`;
      if (starterKeys.has(dedupeKey)) {
        continue;
      }
      if (!perName.has(name)) {
        perName.set(name, { name, primary: genre, seen: new Set([genre]) });
      } else {
        perName.get(name).seen.add(genre);
      }
    }
  }

  const target = TARGET_COUNTS[era];
  const byPrimary = {};
  for (const genre of GENRES) {
    byPrimary[genre] = [];
  }

  for (const value of perName.values()) {
    byPrimary[value.primary].push(value);
  }

  for (const genre of GENRES) {
    byPrimary[genre].sort((a, b) => stableHash(`${era}:${a.name}:${genre}`) - stableHash(`${era}:${b.name}:${genre}`));
  }

  const basePerGenre = Math.floor(target / GENRES.length);
  const selectedMap = new Map();

  for (const genre of GENRES) {
    const candidates = byPrimary[genre];
    for (let i = 0; i < Math.min(basePerGenre, candidates.length); i += 1) {
      selectedMap.set(candidates[i].name, candidates[i]);
    }
  }

  if (selectedMap.size < target) {
    const leftovers = Array.from(perName.values()).filter((item) => !selectedMap.has(item.name));
    leftovers.sort((a, b) => stableHash(`${era}:left:${a.name}`) - stableHash(`${era}:left:${b.name}`));
    for (const item of leftovers) {
      selectedMap.set(item.name, item);
      if (selectedMap.size >= target) {
        break;
      }
    }
  }

  if (selectedMap.size < target) {
    throw new Error(`Not enough unique artists for ${era}: got ${selectedMap.size}, need ${target}.`);
  }

  const selected = Array.from(selectedMap.values()).slice(0, target);
  selected.sort((a, b) => stableHash(`${era}:tier:${a.name}`) - stableHash(`${era}:tier:${b.name}`));

  return selected.map((item, index) => {
    const entry = {
      name: item.name,
      genres: pickGenres(item.primary, item.seen, item.name, era),
      tier: tierByIndex(index, selected.length),
    };
    if (PRODUCER_ONLY.has(item.name)) {
      entry.producerOnly = true;
    }
    return entry;
  });
}

function writeEraFile(era, entries) {
  const outputDir = path.join(__dirname, 'data', 'corpus');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${era}.js`);
  const fileBody = `module.exports = ${JSON.stringify(entries, null, 2)};\n`;
  fs.writeFileSync(outputPath, fileBody, 'utf8');
}

function main() {
  const starter = require(path.join(__dirname, 'data', 'starter'));
  const starterKeys = new Set(
    starter.map((item) => `${String(item.era)}::${String(item.name).toLowerCase()}`),
  );

  const counts = {};
  for (const era of ERAS) {
    const entries = selectForEra(era, starterKeys);
    writeEraFile(era, entries);
    counts[era] = entries.length;
  }

  for (const era of ERAS) {
    console.log(`${era}: ${counts[era]}`);
  }
}

main();
