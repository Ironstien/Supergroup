/** Must match server API_ALBUM_VERSION */
export const EXPECTED_ALBUM_API_VERSION = 3;

export async function fetchAlbumApiHealth() {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('Album API unavailable');
  return response.json();
}

export async function ensureAlbumApiReady() {
  const health = await fetchAlbumApiHealth();
  if (!health.ok || (health.albumApiVersion ?? 0) < EXPECTED_ALBUM_API_VERSION) {
    const err = new Error(staleAlbumApiMessage(health.albumApiVersion));
    err.staleApi = true;
    err.status = 503;
    throw err;
  }
  return health;
}

export function buildAlbumContext(game) {
  const picks = game.picks.map((pick) => ({
    slot: pick.slot,
    name: pick.musician.name,
    band: pick.musician.band ?? 'Solo',
    sourceBand: pick.spin.bandName,
  }));

  return {
    picks,
    supergroup: game.results.supergroup,
    grade: game.results.grade,
  };
}

export function isStaleAlbumApiError(err) {
  return err?.status === 404 || err?.staleApi === true;
}

export function staleAlbumApiMessage(foundVersion) {
  const found = foundVersion ? ` (running v${foundVersion}, need v${EXPECTED_ALBUM_API_VERSION})` : '';
  return `Album API server is out of date${found}. Stop any running API process, then run npm run dev:full and retry.`;
}

export function formatAlbumError(payload, status) {
  if (status === 404) return staleAlbumApiMessage();
  if (payload?.rateLimited || status === 429) {
    return 'Gemini rate limit reached — wait about a minute, then retry.';
  }
  return payload?.error ?? `Album generation failed (${status})`;
}

async function postJson(url, body, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(formatAlbumError(payload, response.status));
      err.status = response.status;
      err.configured = payload.configured ?? true;
      err.rateLimited = payload.rateLimited ?? response.status === 429;
      err.staleApi = response.status === 404;
      err.errors = payload.errors;
      throw err;
    }

    return payload;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Album generation timed out — try again.');
      timeoutErr.configured = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAlbumMetadata(context) {
  return postJson('/api/album/metadata', context);
}

export async function fetchAlbumMedia(context, metadata) {
  return postJson('/api/album/media', {
    ...context,
    bandName: metadata.bandName,
    album: {
      title: metadata.albumTitle,
      tracks: metadata.tracks,
    },
  });
}

export async function fetchAlbumAudio(context, metadata) {
  return postJson('/api/album/audio', {
    ...context,
    bandName: metadata.bandName,
    album: {
      title: metadata.albumTitle,
      tracks: metadata.tracks,
    },
  });
}

export function describeBand(picks) {
  const bands = [...new Set(picks.map((p) => p.sourceBand ?? p.band))];
  return bands.join(' • ');
}

export function localAlbumFallback(game) {
  return {
    bandName: 'Supergroup',
    albumTitle: game.results.album.title,
    tracks: game.results.album.tracks,
  };
}
