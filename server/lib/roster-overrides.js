import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { syncAllMediaToDist } from './media-overrides.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ROSTER_OVERRIDES_PATH = join(ROOT, 'data/raw/roster-overrides.json');
const REMOVALS_PATH = join(ROOT, 'data/raw/band-removals.json');
const DELETIONS_PATH = join(ROOT, 'data/raw/band-deletions.json');
const BANDS_PATH = join(ROOT, 'data/raw/bands.json');
const MUSICIANS_PATH = join(ROOT, 'data/raw/musicians.json');

const require = createRequire(import.meta.url);
const { bandKey } = require('../../scripts/lib/band-key.js');
const { slugify, musicianId } = require('../../scripts/lib/musician-id.js');
const BANDS = require('../../scripts/data/bands.js');

const INSTRUMENT_SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums'];

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function readRosterOverrides() {
  return loadJson(ROSTER_OVERRIDES_PATH, { bands: {} });
}

function writeRosterOverrides(overrides) {
  writeJson(ROSTER_OVERRIDES_PATH, overrides);
}

function readRemovals() {
  return loadJson(REMOVALS_PATH, { keys: [] });
}

function writeRemovals(removals) {
  writeJson(REMOVALS_PATH, removals);
}

function readDeletions() {
  return loadJson(DELETIONS_PATH, { keys: [] });
}

function writeDeletions(deletions) {
  writeJson(DELETIONS_PATH, deletions);
}

function findSourceBand(bandKeyStr) {
  return BANDS.find((band) => bandKey(band.band, band.era) === bandKeyStr);
}

function computeMemberId(name, era, bandName) {
  return musicianId(name, `${era}-${slugify(bandName)}`);
}

function normalizeBandOverride(entry) {
  return {
    removeMembers: [...(entry?.removeMembers ?? [])],
    addMembers: [...(entry?.addMembers ?? [])],
  };
}

function rebuildRoster() {
  execSync('node scripts/build-musicians.js', { cwd: ROOT, stdio: 'pipe' });
  syncAllMediaToDist();
}

function loadFullRoster() {
  const bandsPayload = loadJson(BANDS_PATH, { bands: [] });
  const musiciansPayload = loadJson(MUSICIANS_PATH, { musicians: [] });
  return {
    bands: bandsPayload.bands,
    musicians: musiciansPayload.musicians,
  };
}

function activeMemberIds(bandKeyStr, roster, source) {
  const bandOverride = roster.bands?.[bandKeyStr];
  const removed = new Set(bandOverride?.removeMembers ?? []);
  const ids = new Set();

  for (const member of source.members) {
    const id = computeMemberId(member.name, source.era, source.band);
    if (!removed.has(id)) ids.add(id);
  }

  for (const member of bandOverride?.addMembers ?? []) {
    ids.add(computeMemberId(member.name, source.era, source.band));
  }

  return ids;
}

function memberExists(bandKeyStr, id, roster, source) {
  return activeMemberIds(bandKeyStr, roster, source).has(id);
}

/**
 * @param {string} bandKeyStr
 * @param {{ name: string, slots: string[] }} member
 */
export function addRosterMember(bandKeyStr, member) {
  const source = findSourceBand(bandKeyStr);
  if (!source) throw new Error('Unknown band');

  const name = String(member?.name ?? '').trim();
  if (!name) throw new Error('Name is required');

  const slots = (member?.slots ?? []).filter((slot) => INSTRUMENT_SLOTS.includes(slot));
  if (!slots.length) throw new Error('Pick at least one instrument slot');

  const id = computeMemberId(name, source.era, source.band);
  const roster = readRosterOverrides();
  if (!roster.bands) roster.bands = {};

  if (memberExists(bandKeyStr, id, roster, source)) {
    throw new Error('That member already exists on this band');
  }

  const bandOverride = normalizeBandOverride(roster.bands[bandKeyStr]);
  const inSource = source.members.some(
    (member) => computeMemberId(member.name, source.era, source.band) === id
  );

  bandOverride.removeMembers = bandOverride.removeMembers.filter((memberId) => memberId !== id);

  if (!inSource) {
    bandOverride.addMembers.push({ name, slots });
  }

  if (!bandOverride.removeMembers.length && !bandOverride.addMembers.length) {
    delete roster.bands[bandKeyStr];
  } else {
    roster.bands[bandKeyStr] = bandOverride;
  }

  writeRosterOverrides(roster);
  rebuildRoster();
  return { ok: true, ...loadFullRoster() };
}

/**
 * @param {string} bandKeyStr
 * @param {string} musicianIdStr
 */
export function removeRosterMember(bandKeyStr, musicianIdStr) {
  const source = findSourceBand(bandKeyStr);
  if (!source) throw new Error('Unknown band');
  if (!musicianIdStr?.trim()) throw new Error('musicianId is required');

  const roster = readRosterOverrides();
  if (!roster.bands) roster.bands = {};
  const bandOverride = normalizeBandOverride(roster.bands[bandKeyStr]);

  const addedIndex = bandOverride.addMembers.findIndex(
    (member) => computeMemberId(member.name, source.era, source.band) === musicianIdStr
  );

  if (addedIndex >= 0) {
    bandOverride.addMembers.splice(addedIndex, 1);
  } else {
    const inSource = source.members.some(
      (member) => computeMemberId(member.name, source.era, source.band) === musicianIdStr
    );
    if (!inSource) throw new Error('Member not found on this band');
    if (!bandOverride.removeMembers.includes(musicianIdStr)) {
      bandOverride.removeMembers.push(musicianIdStr);
    }
  }

  if (!bandOverride.removeMembers.length && !bandOverride.addMembers.length) {
    delete roster.bands[bandKeyStr];
  } else {
    roster.bands[bandKeyStr] = bandOverride;
  }

  writeRosterOverrides(roster);
  rebuildRoster();
  return { ok: true, ...loadFullRoster() };
}

/**
 * @param {string} bandKeyStr
 * @param {boolean} hidden
 */
export function setBandHidden(bandKeyStr, hidden) {
  const source = findSourceBand(bandKeyStr);
  if (!source) throw new Error('Unknown band');

  const removals = readRemovals();
  const keys = new Set(removals.keys ?? []);

  if (hidden) keys.add(bandKeyStr);
  else keys.delete(bandKeyStr);

  writeRemovals({ keys: [...keys].sort() });
  rebuildRoster();
  return { ok: true, ...loadFullRoster() };
}

/**
 * Permanently remove a band from the built roster (Media Editor + game).
 * @param {string} bandKeyStr
 */
export function deleteBand(bandKeyStr) {
  const source = findSourceBand(bandKeyStr);
  if (!source) throw new Error('Unknown band');

  const deletions = readDeletions();
  const deletionKeys = new Set(deletions.keys ?? []);
  deletionKeys.add(bandKeyStr);
  writeDeletions({ keys: [...deletionKeys].sort() });

  const removals = readRemovals();
  const removalKeys = new Set(removals.keys ?? []);
  removalKeys.add(bandKeyStr);
  writeRemovals({ keys: [...removalKeys].sort() });

  const roster = readRosterOverrides();
  if (roster.bands?.[bandKeyStr]) {
    delete roster.bands[bandKeyStr];
    writeRosterOverrides(roster);
  }

  rebuildRoster();
  return { ok: true, ...loadFullRoster() };
}
