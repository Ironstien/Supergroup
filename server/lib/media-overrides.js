import fs from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OVERRIDES_PATH = join(ROOT, 'data/raw/media-overrides.json');
const BANDS_PATH = join(ROOT, 'data/raw/bands.json');
const MUSICIANS_PATH = join(ROOT, 'data/raw/musicians.json');
const PUBLIC_MEDIA_ROOT = join(ROOT, 'app/public');
const DIST_MEDIA_ROOT = join(ROOT, 'app/dist/media');

function mediaUrlToRelativePath(url) {
  const pathOnly = String(url ?? '').split('?')[0];
  if (pathOnly.startsWith('/api/media/files/')) {
    return pathOnly.slice('/api/media/files/'.length);
  }
  if (pathOnly.startsWith('/media/')) {
    return pathOnly.slice('/media/'.length);
  }
  return null;
}

function writeLocalMediaFile(relPath, buffer) {
  if (relPath.includes('..')) throw new Error('Invalid media path');

  const publicPath = join(PUBLIC_MEDIA_ROOT, 'media', relPath);
  fs.mkdirSync(dirname(publicPath), { recursive: true });
  fs.writeFileSync(publicPath, buffer);

  if (fs.existsSync(join(ROOT, 'app/dist'))) {
    const distPath = join(DIST_MEDIA_ROOT, relPath);
    fs.mkdirSync(dirname(distPath), { recursive: true });
    fs.writeFileSync(distPath, buffer);
  }
}

export function syncAllMediaToDist() {
  const publicMedia = join(PUBLIC_MEDIA_ROOT, 'media');
  if (!fs.existsSync(publicMedia) || !fs.existsSync(join(ROOT, 'app/dist'))) return;

  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) copyDir(srcPath, destPath);
      else if (entry.isFile() && entry.name !== '.gitkeep') {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDir(publicMedia, DIST_MEDIA_ROOT);
}

export function resolveMediaFilePath(urlPath) {
  const rel = mediaUrlToRelativePath(urlPath);
  if (!rel || rel.includes('..')) return null;
  const filePath = join(PUBLIC_MEDIA_ROOT, 'media', rel);
  return fs.existsSync(filePath) ? filePath : null;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function readOverrides() {
  return loadJson(OVERRIDES_PATH, { bands: {}, musicians: {} });
}

function writeOverrides(overrides) {
  fs.mkdirSync(dirname(OVERRIDES_PATH), { recursive: true });
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
}

export function deleteLocalMediaFile(url) {
  const rel = mediaUrlToRelativePath(url);
  if (!rel) return;

  for (const root of [join(PUBLIC_MEDIA_ROOT, 'media'), DIST_MEDIA_ROOT]) {
    const filePath = join(root, rel);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore unlink errors */
    }
  }
}

export function normalizeMediaUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/media/') || trimmed.startsWith('/api/media/files/')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('URL must use http, https, or a /media/ path');
    }
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

function collectUpdatedRecords(updatedBandKeys, updatedMusicianIds, overrides) {
  const bandsPayload = loadJson(BANDS_PATH, { bands: [] });
  const musiciansPayload = loadJson(MUSICIANS_PATH, { musicians: [] });

  const bands = updatedBandKeys
    .map((key) => {
      const band = bandsPayload.bands.find((b) => b.key === key);
      if (!band) return null;
      const manual = overrides.bands[key];
      return manual?.logoUrl
        ? { ...band, logoUrl: manual.logoUrl, logoStatus: 'ok', logoSource: 'manual' }
        : band;
    })
    .filter(Boolean);

  const musicians = updatedMusicianIds
    .map((id) => {
      const musician = musiciansPayload.musicians.find((m) => m.id === id);
      if (!musician) return null;
      const manual = overrides.musicians[id];
      return manual?.imageUrl
        ? { ...musician, imageUrl: manual.imageUrl, imageStatus: 'ok', imageSource: 'manual' }
        : musician;
    })
    .filter(Boolean);

  return { overrides, bands, musicians };
}

let rebuildPending = false;

function scheduleMediaRebuild() {
  if (rebuildPending) return;
  rebuildPending = true;
  setImmediate(() => {
    rebuildPending = false;
    try {
      execSync('node scripts/build-musicians.js', { cwd: ROOT, stdio: 'pipe' });
      syncAllMediaToDist();
    } catch (err) {
      console.error('Media rebuild failed:', err.message ?? err);
    }
  });
}

function mediaUrlBasePath(url) {
  return String(url ?? '').split('?')[0];
}

function mergePatch(patch, overrides) {
  const updatedBandKeys = [];
  const updatedMusicianIds = [];

  if (patch.bands) {
    for (const [key, entry] of Object.entries(patch.bands)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.logoUrl === null || entry.logoUrl === '') {
        deleteLocalMediaFile(overrides.bands[key]?.logoUrl);
        delete overrides.bands[key];
        updatedBandKeys.push(key);
      } else if (entry.logoUrl !== undefined) {
        const logoUrl = normalizeMediaUrl(entry.logoUrl);
        const previous = overrides.bands[key]?.logoUrl;
        if (previous && mediaUrlBasePath(previous) !== mediaUrlBasePath(logoUrl)) {
          deleteLocalMediaFile(previous);
        }
        overrides.bands[key] = { logoUrl };
        updatedBandKeys.push(key);
      }
    }
  }

  if (patch.musicians) {
    for (const [id, entry] of Object.entries(patch.musicians)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.imageUrl === null || entry.imageUrl === '') {
        deleteLocalMediaFile(overrides.musicians[id]?.imageUrl);
        delete overrides.musicians[id];
        updatedMusicianIds.push(id);
      } else if (entry.imageUrl !== undefined) {
        const imageUrl = normalizeMediaUrl(entry.imageUrl);
        const previous = overrides.musicians[id]?.imageUrl;
        if (previous && mediaUrlBasePath(previous) !== mediaUrlBasePath(imageUrl)) {
          deleteLocalMediaFile(previous);
        }
        overrides.musicians[id] = { imageUrl };
        updatedMusicianIds.push(id);
      }
    }
  }

  return { overrides, updatedBandKeys, updatedMusicianIds };
}

function rebuildAndCollect(updatedBandKeys, updatedMusicianIds, overrides) {
  writeOverrides(overrides);
  execSync('node scripts/build-musicians.js', { cwd: ROOT, stdio: 'pipe' });

  const bandsPayload = loadJson(BANDS_PATH, { bands: [] });
  const musiciansPayload = loadJson(MUSICIANS_PATH, { musicians: [] });
  const bandByKey = new Map(bandsPayload.bands.map((b) => [b.key, b]));
  const musicianById = new Map(musiciansPayload.musicians.map((m) => [m.id, m]));

  return {
    overrides,
    bands: updatedBandKeys.map((key) => bandByKey.get(key)).filter(Boolean),
    musicians: updatedMusicianIds.map((id) => musicianById.get(id)).filter(Boolean),
  };
}

function applyMediaPatchFast(patch) {
  const overrides = readOverrides();
  const merged = mergePatch(patch, overrides);
  writeOverrides(merged.overrides);
  scheduleMediaRebuild();
  return collectUpdatedRecords(merged.updatedBandKeys, merged.updatedMusicianIds, merged.overrides);
}

/**
 * Merge patch into media-overrides.json, rebuild game data, return updated records.
 * @param {{ bands?: Record<string, { logoUrl?: string | null }>, musicians?: Record<string, { imageUrl?: string | null }> }} patch
 */
export function applyMediaPatch(patch) {
  const overrides = readOverrides();
  const merged = mergePatch(patch, overrides);
  return rebuildAndCollect(merged.updatedBandKeys, merged.updatedMusicianIds, merged.overrides);
}

function sanitizeFilename(key) {
  return String(key)
    .replace(/[|/\\:?*"<>|]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data');
  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const extByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extByMime[mime];
  if (!ext) throw new Error(`Unsupported image type: ${mime}`);
  if (buffer.length > 10 * 1024 * 1024) throw new Error('Image is too large (max 10 MB)');
  return { buffer, ext };
}

/**
 * Save a clipboard-pasted image to app/public/media and apply as override.
 * @param {{ kind: 'band' | 'musician', key: string, dataUrl: string }} params
 */
export function savePastedImage({ kind, key, dataUrl }) {
  if (!key?.trim()) throw new Error('key is required');
  if (kind !== 'band' && kind !== 'musician') throw new Error('kind must be band or musician');

  const { buffer, ext } = parseDataUrl(dataUrl);
  const subdir = kind === 'band' ? 'bands' : 'musicians';
  const filename = `${sanitizeFilename(key)}.${ext}`;

  const overrides = readOverrides();
  const previousUrl =
    kind === 'band' ? overrides.bands[key]?.logoUrl : overrides.musicians[key]?.imageUrl;
  const publicUrl = `/media/${subdir}/${filename}?v=${Date.now()}`;

  if (previousUrl && mediaUrlBasePath(previousUrl) !== mediaUrlBasePath(publicUrl)) {
    deleteLocalMediaFile(previousUrl);
  }

  writeLocalMediaFile(`${subdir}/${filename}`, buffer);

  if (!fs.existsSync(join(PUBLIC_MEDIA_ROOT, 'media', subdir, filename))) {
    throw new Error('Image file was not saved — check folder permissions');
  }

  const patch =
    kind === 'band'
      ? { bands: { [key]: { logoUrl: publicUrl } } }
      : { musicians: { [key]: { imageUrl: publicUrl } } };

  return applyMediaPatchFast(patch);
}
