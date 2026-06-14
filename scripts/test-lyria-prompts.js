import { loadEnv, geminiApiKey } from '../server/lib/env.js';
import { geminiFetch } from '../server/lib/api-client.js';

loadEnv();
const apiKey = geminiApiKey();
const API_BASE = 'https://generativelanguage.googleapis.com';
const MODEL = 'lyria-3-clip-preview';

function extract(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) return inline.mimeType ?? inline.mime_type ?? 'audio';
  }
  return null;
}

async function test(label, prompt) {
  console.log(`\n=== ${label} ===`);
  const response = await geminiFetch(
    `${API_BASE}/v1beta/models/${MODEL}:generateContent`,
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['AUDIO', 'TEXT'] },
      }),
    }
  );
  const mime = extract(response);
  console.log(mime ? `OK ${mime}` : `FAIL candidates=${response?.candidates?.length ?? 0} promptFeedback=${JSON.stringify(response?.promptFeedback ?? null)}`);
}

const title = 'Rusted Halo';
const lyrics = `[Chorus]\n${title}\n${title}\n${title}\n${title}`;

await test('With artist names', `Create a 30-second vocal song titled "${title}" at 118 BPM. NOT instrumental.
Vocals in the style of Dave Grohl (Foo Fighters)
Guitar in the style of Malcolm Young (AC/DC)
Lyrics:\n${lyrics}`);

await test('Abstract styles only', `Create a 30-second punk/metal/rock fusion vocal song titled "${title}" at 118 BPM. NOT instrumental.
Vocals: raw powerful rock shouting with melodic hooks
Guitar: tight AC/DC-style rhythm riffs and punk downstrokes
Bass: heavy modern metalcore low end
Drums: aggressive double-kick punk-metal groove
Vocal delivery: loud English lead singer, chorus only, full 30 seconds.
Lyrics:\n${lyrics}`);

await test('Genre only minimal', `Create a 30-second punk metal rock vocal song titled "${title}" at 118 BPM with loud sung chorus vocals.
Lyrics:\n${lyrics}`);
