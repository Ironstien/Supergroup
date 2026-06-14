import { geminiFetch } from './api-client.js';

const TEXT_MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com';

export function buildMetadataPrompt({ picks, supergroup, grade }) {
  const lineup = picks
    .map(
      (pick) =>
        `- ${pick.slot}: ${pick.name} (${pick.band?.trim() || 'Solo'}) — drafted from ${pick.sourceBand ?? pick.band ?? 'rock'}`
    )
    .join('\n');

  const outcome = supergroup
    ? 'They achieved supergroup status (#1 charts, sold-out tour, rave reviews).'
    : `Their debut landed at grade ${grade ?? 'B'}.`;

  return `You are naming a fictional supergroup's debut album.

Lineup:
${lineup}

Outcome: ${outcome}

Return JSON with:
- bandName: a creative 2-4 word supergroup name blending these musicians' styles (not a list of real band names)
- albumTitle: a punchy 2-4 word album title that works as a repeated sung chorus (short, singable, English)
- tracks: 6-8 unique song titles themed to this lineup and album (must not include albumTitle)

All names must feel specific to THIS lineup, not generic rock clichés.`;
}

function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.text) return part.text;
  }
  return null;
}

function normalizeMetadata(raw) {
  const bandName = String(raw.bandName ?? '').trim();
  const albumTitle = String(raw.albumTitle ?? '').trim();
  let tracks = Array.isArray(raw.tracks)
    ? raw.tracks.map((t) => String(t).trim()).filter(Boolean)
    : [];

  if (!bandName || !albumTitle) {
    throw new Error('Metadata response missing bandName or albumTitle');
  }

  tracks = tracks.filter((t) => t.toLowerCase() !== albumTitle.toLowerCase());
  if (tracks.length < 6) {
    throw new Error('Metadata response had too few track titles');
  }
  if (tracks.length > 8) {
    tracks = tracks.slice(0, 8);
  }

  return { bandName, albumTitle, tracks };
}

export async function generateAlbumMetadata(apiKey, body) {
  const prompt = buildMetadataPrompt(body);
  const response = await geminiFetch(
    `${API_BASE}/v1beta/models/${TEXT_MODEL}:generateContent`,
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              bandName: { type: 'string' },
              albumTitle: { type: 'string' },
              tracks: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['bandName', 'albumTitle', 'tracks'],
          },
        },
      }),
    }
  );

  const text = extractText(response);
  if (!text) throw new Error('No metadata returned from Gemini');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid metadata JSON from Gemini');
  }

  return normalizeMetadata(parsed);
}
