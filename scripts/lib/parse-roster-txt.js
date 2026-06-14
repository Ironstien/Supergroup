const fs = require('fs');
const { bandKey } = require('./band-key');

const ROSTER_LINE = /^(.+?) \((\d{2}s)\) — \d+ members — logo: (ok|missing)$/;

function parseRosterTxt(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const entries = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(ROSTER_LINE);
    if (!match) continue;
    const name = match[1].trim();
    const era = match[2];
    entries.push({ name, era, key: bandKey(name, era) });
  }

  return entries;
}

function rosterKeySet(filePath) {
  return new Set(parseRosterTxt(filePath).map((e) => e.key));
}

module.exports = { parseRosterTxt, rosterKeySet, ROSTER_LINE };
