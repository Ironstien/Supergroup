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

async function parseRosterResponse(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Roster API unavailable — restart with npm run dev:full.');
    }
    throw new Error(payload.error ?? 'Roster update failed');
  }
  return payload;
}

export async function addRosterMember({ bandKey, name, slots }) {
  const res = await fetchWithTimeout('/api/roster/add-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bandKey, name, slots }),
  });
  return parseRosterResponse(res);
}

export async function removeRosterMember({ bandKey, musicianId }) {
  const res = await fetchWithTimeout('/api/roster/remove-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bandKey, musicianId }),
  });
  return parseRosterResponse(res);
}

export async function setBandHidden({ bandKey, hidden }) {
  const res = await fetchWithTimeout('/api/roster/band-visibility', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bandKey, hidden }),
  });
  return parseRosterResponse(res);
}

export async function deleteBand({ bandKey }) {
  const res = await fetchWithTimeout('/api/roster/delete-band', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bandKey }),
  });
  return parseRosterResponse(res);
}
