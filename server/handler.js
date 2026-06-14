import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { geminiApiKey } from './lib/env.js';
import { buildCoverPrompt, buildMusicPrompt, buildFallbackMusicPrompt } from './lib/prompts.js';
import { generateAlbumMedia, generateClip, isRateLimitedMessage, toDataUrl } from './lib/gemini.js';
import { generateAlbumMetadata } from './lib/metadata.js';
import { withAlbumGenerationLock } from './lib/rate-limit.js';
import { applyMediaPatch, readOverrides, savePastedImage, resolveMediaFilePath } from './lib/media-overrides.js';
import { addRosterMember, removeRosterMember, setBandHidden, deleteBand } from './lib/roster-overrides.js';
import { readSystemClipboardImage, clipboardImageToDataUrl } from './lib/clipboard-image.js';
import { getDailyPuzzle } from './lib/daily.js';
import { submitScore } from './lib/scores.js';

/** Bump when album/roster API routes or contract change — dev-full uses this to detect stale servers. */
export const API_ALBUM_VERSION = 5;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const IS_VERCEL = Boolean(process.env.VERCEL);

const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function sendMediaFile(res, filePath) {
  const ext = extname(filePath).slice(1).toLowerCase();
  const mime = IMAGE_MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'public, max-age=86400',
  });
  createReadStream(filePath).pipe(res);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function apiKeyMissing() {
  return {
    status: 503,
    payload: {
      configured: false,
      error: 'GEMINI_API_KEY is not configured. Add it to .env to enable album generation.',
    },
  };
}

function validatePicks(body) {
  if (!Array.isArray(body.picks) || body.picks.length === 0) {
    return 'picks array is required';
  }
  return null;
}

function validateMediaPayload(body) {
  const picksError = validatePicks(body);
  if (picksError) return picksError;
  if (!body.bandName?.trim()) return 'bandName is required';
  if (!body.album?.title?.trim()) return 'album.title is required';
  if (!Array.isArray(body.album.tracks) || body.album.tracks.length === 0) {
    return 'album.tracks array is required';
  }
  return null;
}

async function handleAlbumMetadata(body) {
  const apiKey = geminiApiKey();
  if (!apiKey) return apiKeyMissing();

  const validationError = validatePicks(body);
  if (validationError) {
    return { status: 400, payload: { error: validationError } };
  }

  try {
    const metadata = await generateAlbumMetadata(apiKey, body);
    return {
      status: 200,
      payload: { configured: true, ...metadata },
    };
  } catch (err) {
    const rateLimited = err.rateLimited || isRateLimitedMessage(err.message);
    return {
      status: rateLimited ? 429 : 502,
      payload: {
        configured: true,
        rateLimited,
        error: rateLimited
          ? 'Gemini rate limit reached. Wait a minute and try again.'
          : err.message ?? 'Album metadata generation failed',
      },
    };
  }
}

async function handleAlbumMedia(body) {
  const apiKey = geminiApiKey();
  if (!apiKey) return apiKeyMissing();

  const validationError = validateMediaPayload(body);
  if (validationError) {
    return { status: 400, payload: { error: validationError } };
  }

  const album = { title: body.album.title.trim(), tracks: body.album.tracks };
  const bandName = body.bandName.trim();
  const coverPrompt = buildCoverPrompt({ ...body, album, bandName });
  const musicPrompt = buildMusicPrompt({ ...body, album });
  const fallbackMusicPrompt = buildFallbackMusicPrompt({ ...body, album });

  const { cover, audio, errors, rateLimited } = await withAlbumGenerationLock(() =>
    generateAlbumMedia(apiKey, coverPrompt, musicPrompt, fallbackMusicPrompt)
  );

  if (!cover && !audio) {
    const allRateLimited =
      rateLimited || Object.values(errors).some((msg) => isRateLimitedMessage(msg));

    return {
      status: allRateLimited ? 429 : 502,
      payload: {
        configured: true,
        rateLimited: allRateLimited,
        error: allRateLimited
          ? 'Gemini rate limit reached. Wait a minute and try again.'
          : 'Album media generation failed',
        errors,
      },
    };
  }

  return {
    status: 200,
    payload: {
      configured: true,
      cover,
      audio,
      musicPrompt,
      rateLimited: rateLimited || undefined,
      errors: Object.keys(errors).length ? errors : undefined,
    },
  };
}

async function handleAlbumAudio(body) {
  const apiKey = geminiApiKey();
  if (!apiKey) return apiKeyMissing();

  const validationError = validateMediaPayload(body);
  if (validationError) {
    return { status: 400, payload: { error: validationError } };
  }

  const album = { title: body.album.title.trim(), tracks: body.album.tracks };
  const musicPrompt = buildMusicPrompt({ ...body, album });
  const fallbackMusicPrompt = buildFallbackMusicPrompt({ ...body, album });

  try {
    const clip = await withAlbumGenerationLock(() =>
      generateClip(apiKey, musicPrompt, { fallbackPrompt: fallbackMusicPrompt })
    );
    return {
      status: 200,
      payload: {
        configured: true,
        audio: { dataUrl: toDataUrl(clip) },
        musicPrompt,
      },
    };
  } catch (err) {
    const rateLimited = err.rateLimited || isRateLimitedMessage(err.message);
    return {
      status: rateLimited ? 429 : 502,
      payload: {
        configured: true,
        rateLimited,
        error: rateLimited
          ? 'Gemini rate limit reached. Wait a minute and try again.'
          : err.message ?? 'Audio generation failed',
      },
    };
  }
}

async function handleAlbumGenerate(body) {
  const metaResult = await handleAlbumMetadata(body);
  if (metaResult.status !== 200) return metaResult;

  const { bandName, albumTitle, tracks } = metaResult.payload;
  return handleAlbumMedia({
    ...body,
    bandName,
    album: { title: albumTitle, tracks },
  });
}

function localOnlyError(feature) {
  return {
    status: 503,
    payload: {
      error: `${feature} is only available in local development. Run npm run dev:full on your machine.`,
    },
  };
}

export async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const configured = Boolean(geminiApiKey());
      sendJson(res, 200, {
        ok: true,
        gemini: configured,
        albumApiVersion: API_ALBUM_VERSION,
        mediaPaste: !IS_VERCEL,
        rosterEdits: !IS_VERCEL,
        daily: true,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/daily') {
      const puzzle = await getDailyPuzzle();
      sendJson(res, 200, puzzle);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/scores') {
      const body = await readJson(req);
      const result = await submitScore(body);
      sendJson(res, result.status, result.payload);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/media/files/')) {
      const filePath = resolveMediaFilePath(url.pathname);
      if (!filePath) {
        sendJson(res, 404, { error: 'Media file not found' });
        return;
      }
      sendMediaFile(res, filePath);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/media/overrides') {
      sendJson(res, 200, readOverrides());
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/media/overrides') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Media editor').status, localOnlyError('Media editor').payload);
        return;
      }
      const body = await readJson(req);
      if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
        sendJson(res, 400, { error: 'Invalid patch body' });
        return;
      }
      try {
        const result = applyMediaPatch(body);
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Media update failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/media/paste-clipboard') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Clipboard paste').status, localOnlyError('Clipboard paste').payload);
        return;
      }
      const body = await readJson(req);
      if (!body?.kind || !body?.key) {
        sendJson(res, 400, { error: 'kind and key are required' });
        return;
      }
      if (body.kind !== 'band' && body.kind !== 'musician') {
        sendJson(res, 400, { error: 'kind must be band or musician' });
        return;
      }
      try {
        const buffer = readSystemClipboardImage();
        if (!buffer) {
          sendJson(res, 400, {
            error: 'No image on clipboard. Copy a screenshot first (e.g. Win+Shift+S), then click again.',
          });
          return;
        }
        const result = savePastedImage({
          kind: body.kind,
          key: body.key,
          dataUrl: clipboardImageToDataUrl(buffer),
        });
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Clipboard paste failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Media upload').status, localOnlyError('Media upload').payload);
        return;
      }
      const body = await readJson(req, MAX_UPLOAD_BYTES);
      if (!body?.kind || !body?.key || !body?.dataUrl) {
        sendJson(res, 400, { error: 'kind, key, and dataUrl are required' });
        return;
      }
      try {
        const result = savePastedImage(body);
        sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Image upload failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/roster/add-member') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Roster editor').status, localOnlyError('Roster editor').payload);
        return;
      }
      const body = await readJson(req);
      if (!body?.bandKey || !body?.name) {
        sendJson(res, 400, { error: 'bandKey and name are required' });
        return;
      }
      try {
        const result = addRosterMember(body.bandKey, { name: body.name, slots: body.slots ?? [] });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Add member failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/roster/remove-member') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Roster editor').status, localOnlyError('Roster editor').payload);
        return;
      }
      const body = await readJson(req);
      if (!body?.bandKey || !body?.musicianId) {
        sendJson(res, 400, { error: 'bandKey and musicianId are required' });
        return;
      }
      try {
        const result = removeRosterMember(body.bandKey, body.musicianId);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Remove member failed' });
      }
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/roster/band-visibility') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Roster editor').status, localOnlyError('Roster editor').payload);
        return;
      }
      const body = await readJson(req);
      if (!body?.bandKey || typeof body.hidden !== 'boolean') {
        sendJson(res, 400, { error: 'bandKey and hidden (boolean) are required' });
        return;
      }
      try {
        const result = setBandHidden(body.bandKey, body.hidden);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Band visibility update failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/roster/delete-band') {
      if (IS_VERCEL) {
        sendJson(res, localOnlyError('Roster editor').status, localOnlyError('Roster editor').payload);
        return;
      }
      const body = await readJson(req);
      if (!body?.bandKey) {
        sendJson(res, 400, { error: 'bandKey is required' });
        return;
      }
      try {
        const result = deleteBand(body.bandKey);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { error: err.message ?? 'Delete band failed' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/album/audio') {
      const body = await readJson(req);
      const result = await handleAlbumAudio(body);
      sendJson(res, result.status, result.payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/album/generate') {
      const body = await readJson(req);
      const result = await handleAlbumGenerate(body);
      sendJson(res, result.status, result.payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/album/metadata') {
      const body = await readJson(req);
      const result = await handleAlbumMetadata(body);
      sendJson(res, result.status, result.payload);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/album/media') {
      const body = await readJson(req);
      const result = await handleAlbumMedia(body);
      sendJson(res, result.status, result.payload);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message ?? 'Internal server error' });
  }
}
