async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — restart with npm run dev:full and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMediaOverrides() {
  const res = await fetchWithTimeout('/api/media/overrides', {}, 8000);
  if (!res.ok) throw new Error('Could not load media overrides');
  return res.json();
}

/**
 * @param {{ bands?: Record<string, { logoUrl?: string | null }>, musicians?: Record<string, { imageUrl?: string | null }> }} patch
 */
export async function patchMediaOverrides(patch) {
  const res = await fetchWithTimeout('/api/media/overrides', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error ?? 'Save failed');
  }
  return payload;
}

export async function uploadMediaImage({ kind, key, dataUrl }) {
  const res = await fetchWithTimeout(
    '/api/media/upload',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, key, dataUrl }),
    },
    20000
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error ?? 'Image upload failed');
  }
  return payload;
}

/** Read image from OS clipboard via local API (works with Windows Snipping Tool). */
export async function pasteFromSystemClipboard({ kind, key }) {
  const res = await fetchWithTimeout(
    '/api/media/paste-clipboard',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, key }),
    },
    12000
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error ?? 'Clipboard paste failed');
  }
  return payload;
}

export async function isMediaApiAvailable() {
  try {
    const res = await fetchWithTimeout('/api/health', {}, 3000);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok && data.mediaPaste);
  } catch {
    return false;
  }
}

export async function isRosterApiAvailable() {
  try {
    const res = await fetchWithTimeout('/api/health', {}, 3000);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok && data.rosterEdits);
  } catch {
    return false;
  }
}
