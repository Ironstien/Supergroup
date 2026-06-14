/**
 * Fetch band logos and musician photos (URL-linked metadata).
 * Run: node scripts/fetch-media.js [--bands-only] [--force-missing] [--limit N]
 * Only processes bands NOT in band-removals.json (active roster).
 */
const fs = require('fs');
const path = require('path');
const { bandKey } = require('./lib/band-key');
const { musicianId, slugify } = require('./lib/musician-id');
const { fetchBandLogo, fetchMusicianPhoto, delay } = require('./lib/media-sources');

const BANDS = require('./data/bands');
const MEDIA_OUT = path.join(__dirname, '../data/raw/media.json');
const OVERRIDES = path.join(__dirname, '../data/raw/media-overrides.json');
const REMOVALS = path.join(__dirname, '../data/raw/band-removals.json');
const DELETIONS = path.join(__dirname, '../data/raw/band-deletions.json');

const bandsOnly = process.argv.includes('--bands-only');
const forceMissing = process.argv.includes('--force-missing');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function memberId(name, era, bandName) {
  return musicianId(name, `${era}-${slugify(bandName)}`);
}

function activeBands() {
  const removals = new Set(loadJson(REMOVALS, { keys: [] }).keys ?? []);
  const deletions = new Set(loadJson(DELETIONS, { keys: [] }).keys ?? []);
  return BANDS.filter((b) => {
    const key = bandKey(b.band, b.era);
    return !removals.has(key) && !deletions.has(key);
  });
}

function shouldFetchBand(key, existing, overrides) {
  if (overrides.bands[key]?.logoUrl) return true;
  if (forceMissing) return !existing.bands[key]?.logoUrl;
  if (!existing.bands[key]?.logoUrl) return true;
  return existing.bands[key]?.logoStatus === 'missing';
}

function shouldFetchMusician(id, existing, overrides) {
  if (overrides.musicians[id]?.imageUrl) return true;
  if (forceMissing) return !existing.musicians[id]?.imageUrl;
  if (!existing.musicians[id]?.imageUrl) return true;
  return existing.musicians[id]?.imageStatus === 'missing';
}

async function main() {
  const roster = activeBands();
  const overrides = loadJson(OVERRIDES, { bands: {}, musicians: {} });
  const existing = loadJson(MEDIA_OUT, { bands: {}, musicians: {}, fetchedAt: null });
  const out = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    bands: { ...existing.bands },
    musicians: { ...existing.musicians },
  };

  console.log(`Active roster: ${roster.length} bands`);

  let bandCount = 0;
  for (const band of roster) {
    if (bandCount >= limit) break;
    const key = bandKey(band.band, band.era);
    if (overrides.bands[key]?.logoUrl) {
      out.bands[key] = {
        logoUrl: overrides.bands[key].logoUrl,
        logoStatus: 'ok',
        logoSource: 'manual',
      };
      continue;
    }
    if (!shouldFetchBand(key, existing, overrides)) continue;

    process.stdout.write(`Logo: ${band.band} (${band.era})… `);
    try {
      const result = await fetchBandLogo(band.band);
      out.bands[key] = {
        logoUrl: result.url,
        logoStatus: result.status,
        logoSource: result.source,
      };
      console.log(result.url ? result.source : 'missing');
    } catch (err) {
      out.bands[key] = { logoUrl: null, logoStatus: 'missing', logoSource: null };
      console.log(`error (${err.message})`);
    }
    bandCount += 1;
    fs.writeFileSync(MEDIA_OUT, JSON.stringify(out, null, 2));
    await delay(900);
  }

  if (bandsOnly) {
    const logoOk = roster.filter((b) => out.bands[bandKey(b.band, b.era)]?.logoUrl).length;
    console.log(`Logos for active roster: ${logoOk}/${roster.length} → ${MEDIA_OUT}`);
    const { execSync } = require('child_process');
    execSync('node scripts/build-musicians.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    return;
  }

  let musicianCount = 0;
  for (const band of roster) {
    for (const member of band.members) {
      if (musicianCount >= limit) break;
      const id = memberId(member.name, band.era, band.band);
      if (overrides.musicians[id]?.imageUrl) {
        out.musicians[id] = {
          imageUrl: overrides.musicians[id].imageUrl,
          imageStatus: 'ok',
          imageSource: 'manual',
        };
        continue;
      }
      if (!shouldFetchMusician(id, existing, overrides)) continue;

      process.stdout.write(`Photo: ${member.name} (${band.band})… `);
      try {
        const result = await fetchMusicianPhoto(member.name, band.band);
        out.musicians[id] = {
          imageUrl: result.url,
          imageStatus: result.status,
          imageSource: result.source,
        };
        console.log(result.url ? `${result.source} (${result.status})` : 'missing');
      } catch (err) {
        out.musicians[id] = { imageUrl: null, imageStatus: 'missing', imageSource: null };
        console.log(`error (${err.message})`);
      }
      musicianCount += 1;
      if (musicianCount % 10 === 0) {
        fs.writeFileSync(MEDIA_OUT, JSON.stringify(out, null, 2));
      }
      await delay(650);
    }
  }

  fs.writeFileSync(MEDIA_OUT, JSON.stringify(out, null, 2));
  const logoOk = roster.filter((b) => out.bands[bandKey(b.band, b.era)]?.logoUrl).length;
  const activeIds = roster.flatMap((b) =>
    b.members.map((m) => memberId(m.name, b.era, b.band))
  );
  const photoOk = activeIds.filter((id) => out.musicians[id]?.imageUrl).length;
  console.log(`Done → ${MEDIA_OUT}`);
  console.log(`Active roster logos: ${logoOk}/${roster.length}`);
  console.log(`Active roster photos: ${photoOk}/${activeIds.length}`);

  const { execSync } = require('child_process');
  execSync('node scripts/build-musicians.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
