import {
  GeminiApiError,
  geminiFetch,
  isRateLimitedMessage,
  sleep,
} from './api-client.js';

const IMAGE_MODEL = 'gemini-2.5-flash-image';
const MUSIC_MODEL = 'lyria-3-clip-preview';
const API_BASE = 'https://generativelanguage.googleapis.com';

function extractImagePart(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      const mimeType = inline.mimeType ?? inline.mime_type ?? 'image/png';
      return { mimeType, data: inline.data };
    }
  }
  return null;
}

function describeLyriaResponse(response) {
  if (response?.promptFeedback?.blockReason) {
    return `blocked=${response.promptFeedback.blockReason}`;
  }
  const candidate = response?.candidates?.[0];
  if (!candidate) return 'no candidates in response';
  const parts = candidate.content?.parts ?? [];
  const textSnippets = parts
    .filter((p) => p.text)
    .map((p) => p.text.slice(0, 80))
    .join(' | ');
  const inlineTypes = parts
    .map((p) => {
      const inline = p.inlineData ?? p.inline_data;
      return inline ? inline.mimeType ?? inline.mime_type ?? 'unknown' : null;
    })
    .filter(Boolean);
  return [
    `finishReason=${candidate.finishReason ?? '?'}`,
    `parts=${parts.length}`,
    inlineTypes.length ? `inlineTypes=${inlineTypes.join(',')}` : 'no inline data',
    textSnippets ? `text=${textSnippets}` : null,
  ]
    .filter(Boolean)
    .join('; ');
}

function extractAudioFromGenerateContent(response) {
  const candidates = response?.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      if (part.text) continue;
      const inline = part.inlineData ?? part.inline_data;
      if (!inline?.data) continue;
      const mimeType = (inline.mimeType ?? inline.mime_type ?? 'audio/mp3').toLowerCase();
      if (mimeType.startsWith('image/')) continue;
      return {
        mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/mp3',
        data: inline.data,
      };
    }
  }
  return null;
}

export async function generateCover(apiKey, prompt) {
  const response = await geminiFetch(
    `${API_BASE}/v1beta/models/${IMAGE_MODEL}:generateContent`,
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '1:1' },
        },
      }),
    }
  );

  const image = extractImagePart(response);
  if (!image) throw new Error('No image returned from Gemini');
  return image;
}

export async function generateClip(apiKey, textPrompt, { attempt = 0, fallbackPrompt = null } = {}) {
  const prompt = attempt >= 2 && fallbackPrompt ? fallbackPrompt : textPrompt;
  const maxAttempts = fallbackPrompt ? 3 : 2;

  const response = await geminiFetch(
    `${API_BASE}/v1beta/models/${MUSIC_MODEL}:generateContent`,
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO', 'TEXT'],
        },
      }),
    }
  );

  const audio = extractAudioFromGenerateContent(response);
  if (audio) return audio;

  if (attempt < maxAttempts - 1) {
    const label = attempt >= 1 && fallbackPrompt ? 'fallback prompt' : 'retry';
    console.warn(`Lyria returned no audio — ${label} (${describeLyriaResponse(response)})`);
    await sleep(4000);
    return generateClip(apiKey, textPrompt, { attempt: attempt + 1, fallbackPrompt });
  }

  throw new Error(`No audio returned from Lyria (${describeLyriaResponse(response)})`);
}

/** Audio first (priority), then cover — avoids parallel API contention. */
export async function generateAlbumMedia(apiKey, coverPrompt, musicPrompt, fallbackMusicPrompt = null) {
  const errors = {};
  let rateLimited = false;
  let cover = null;
  let audio = null;

  try {
    const clip = await generateClip(apiKey, musicPrompt, { fallbackPrompt: fallbackMusicPrompt });
    audio = { dataUrl: toDataUrl(clip) };
  } catch (err) {
    errors.audio = err.message;
    rateLimited ||= err.rateLimited || isRateLimitedMessage(err.message);
  }

  await sleep(2000);

  try {
    const coverImage = await generateCover(apiKey, coverPrompt);
    cover = { dataUrl: toDataUrl(coverImage) };
  } catch (err) {
    errors.cover = err.message;
    rateLimited ||= err.rateLimited || isRateLimitedMessage(err.message);
  }

  return { cover, audio, errors, rateLimited };
}

/** @deprecated Use generateAlbumMedia — kept for scripts */
export async function generateAlbumAssets(apiKey, coverPrompt, musicPrompt) {
  return generateAlbumMedia(apiKey, coverPrompt, musicPrompt);
}

export function toDataUrl({ mimeType, data }) {
  return `data:${mimeType};base64,${data}`;
}

export { GeminiApiError, isRateLimitedMessage };
