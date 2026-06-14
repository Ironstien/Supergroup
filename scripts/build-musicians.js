/**
 * Build data/raw/musicians.json + data/raw/bands.json from curated band roster.
 * Run: node scripts/build-musicians.js
 */
const fs = require('fs');
const path = require('path');
const { enrichMusician } = require('./lib/slot-ratings');
const { generateStats } = require('./lib/generate-stats');
const { musicianId, slugify } = require('./lib/musician-id');
const { bandKey } = require('./lib/band-key');
const { remapGenres } = require('./lib/genres');

const OUT = path.join(__dirname, '../data/raw/musicians.json');
const BANDS_OUT = path.join(__dirname, '../data/raw/bands.json');
const MEDIA = path.join(__dirname, '../data/raw/media.json');
const OVERRIDES = path.join(__dirname, '../data/raw/media-overrides.json');
const ROSTER_OVERRIDES = path.join(__dirname, '../data/raw/roster-overrides.json');
const REMOVALS_FILE = path.join(__dirname, '../data/raw/band-removals.json');
const DELETIONS_FILE = path.join(__dirname, '../data/raw/band-deletions.json');
const BANDS = require('./data/bands');

const INSTRUMENT_SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums'];
const ERAS = ['80s', '90s', '00s', '10s', '20s'];

function memberId(name, era, bandName) {
  return musicianId(name, `${era}-${slugify(bandName)}`);
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function applyMedia(musician, media, overrides) {
  const manual = overrides.musicians?.[musician.id];
  const fetched = media.musicians?.[musician.id];
  const entry = manual?.imageUrl ? { ...manual, imageStatus: 'ok', imageSource: 'manual' } : fetched;
  if (!entry) return musician;
  return {
    ...musician,
    imageUrl: entry.imageUrl ?? null,
    imageStatus: entry.imageStatus ?? (entry.imageUrl ? 'ok' : 'missing'),
    imageSource: entry.imageSource ?? null,
  };
}

function resolveBandMembers(band, rosterBandOverride) {
  const removed = new Set(rosterBandOverride?.removeMembers ?? []);
  const baseMembers = band.members.filter((member) => {
    const id = memberId(member.name, band.era, band.band);
    return !removed.has(id);
  });
  const addedMembers = (rosterBandOverride?.addMembers ?? []).map((member) => ({
    ...member,
    slots: member.slots.filter((s) => INSTRUMENT_SLOTS.includes(s)),
  }));
  return [...baseMembers, ...addedMembers];
}

function expandBand(band, media, overrides, rosterBandOverride) {
  const genres = remapGenres(band.genres);
  const tier = band.tier ?? 'B';
  const key = bandKey(band.band, band.era);
  const logoManual = overrides.bands?.[key];
  const logoFetched = media.bands?.[key];
  const logoEntry = logoManual?.logoUrl
    ? { ...logoManual, logoStatus: 'ok', logoSource: 'manual' }
    : logoFetched;

  const members = resolveBandMembers(band, rosterBandOverride).map((member) => {
    const slots = member.slots.filter((s) => INSTRUMENT_SLOTS.includes(s));
    const id = memberId(member.name, band.era, band.band);
    const stats = member.stats ?? generateStats(id, genres, member.tier ?? tier);

    return applyMedia(
      enrichMusician({
        id,
        name: member.name,
        band: band.band,
        bandKey: key,
        era: band.era,
        genres,
        stats,
        eligibleSlots: slots,
      }),
      media,
      overrides
    );
  });

  return {
    bandRecord: {
      key,
      name: band.band,
      era: band.era,
      tier,
      genres,
      logoUrl: logoEntry?.logoUrl ?? null,
      logoStatus: logoEntry?.logoStatus ?? (logoEntry?.logoUrl ? 'ok' : 'missing'),
      logoSource: logoEntry?.logoSource ?? null,
      memberIds: members.map((m) => m.id),
    },
    members,
  };
}

function buildAll() {
  const media = loadJson(MEDIA, { bands: {}, musicians: {} });
  const overrides = loadJson(OVERRIDES, { bands: {}, musicians: {} });
  const rosterOverrides = loadJson(ROSTER_OVERRIDES, { bands: {} });
  const removals = new Set(loadJson(REMOVALS_FILE, { keys: [] }).keys ?? []);
  const deletions = new Set(loadJson(DELETIONS_FILE, { keys: [] }).keys ?? []);
  const seen = new Set();
  const musicians = [];
  const bands = [];

  for (const band of BANDS) {
    const key = bandKey(band.band, band.era);
    if (deletions.has(key)) continue;
    const hidden = removals.has(key);
    const rosterBandOverride = rosterOverrides.bands?.[key];
    const { bandRecord, members } = expandBand(band, media, overrides, rosterBandOverride);
    bands.push({ ...bandRecord, hidden });
    for (const m of members) {
      const dedupe = `${m.id}|${m.era}`;
      if (seen.has(dedupe)) {
        console.warn(`Duplicate skipped: ${m.name} (${m.era})`);
        continue;
      }
      seen.add(dedupe);
      musicians.push(m);
    }
  }

  bands.sort((a, b) => a.name.localeCompare(b.name) || a.era.localeCompare(b.era));
  return { musicians, bands };
}

function auditBands(bands) {
  const byEra = {};
  for (const era of ERAS) byEra[era] = 0;
  for (const b of bands) byEra[b.era] = (byEra[b.era] || 0) + 1;
  const thin = bands.filter((b) => b.memberIds.length < 3);
  const noLogo = bands.filter((b) => !b.logoUrl).length;
  return { byEra, thin, noLogo };
}

function main() {
  const { musicians, bands } = buildAll();
  const audit = auditBands(bands);
  const now = new Date().toISOString();

  const musiciansPayload = {
    version: 3,
    generatedAt: now,
    count: musicians.length,
    note: 'Band Spin roster — pick from a spun band each round. Producer is a spare slot (any pick).',
    musicians,
  };

  const bandsPayload = {
    version: 1,
    generatedAt: now,
    count: bands.length,
    bands,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(musiciansPayload, null, 2));
  fs.writeFileSync(BANDS_OUT, JSON.stringify(bandsPayload, null, 2));

  const photos = musicians.filter((m) => m.imageUrl).length;
  const logos = bands.filter((b) => b.logoUrl).length;

  console.log(`Wrote ${musicians.length} musicians → ${OUT}`);
  console.log(`Wrote ${bands.length} bands → ${BANDS_OUT}`);
  console.log('Bands by era:', audit.byEra);
  console.log(`Media: ${logos}/${bands.length} logos, ${photos}/${musicians.length} photos`);
  if (audit.thin.length) {
    console.log(`Thin bands (<3 members): ${audit.thin.map((b) => b.name).slice(0, 10).join(', ')}${audit.thin.length > 10 ? '…' : ''}`);
  }
}

main();
