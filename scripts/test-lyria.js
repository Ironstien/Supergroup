import { loadEnv, geminiApiKey } from '../server/lib/env.js';
import { generateClip } from '../server/lib/gemini.js';
import { buildMusicPrompt } from '../server/lib/prompts.js';

loadEnv();

const apiKey = geminiApiKey();
if (!apiKey) {
  console.error('No GEMINI_API_KEY in .env');
  process.exit(1);
}

const body = {
  album: { title: 'Rusted Halo', tracks: ['Era Echoes'] },
  picks: [
    { slot: 'Vocals', name: 'Dave Grohl', band: 'Foo Fighters', genre: 'rock', era: '90s' },
    { slot: 'Guitar', name: 'Malcolm Young', band: 'AC/DC', genre: 'rock', era: '80s' },
    { slot: 'Bass', name: 'Damon McKinnon', band: 'Twelve Foot Ninja', genre: 'metal', era: '10s' },
    { slot: 'Drums', name: 'Vinnie Paul', band: 'Pantera', genre: 'metal', era: '90s' },
    { slot: 'Producer', name: 'Daniel Fang', band: 'Turnstile', genre: 'punk', era: '20s' },
  ],
  supergroup: false,
  grade: 'B',
};

const simplePrompt =
  'Create a 30-second punk rock vocal song at 118 BPM with loud lead vocals. Song structure: [Chorus] only. Lyrics:\n[Chorus]\nRusted Halo\nRusted Halo\nRusted Halo\nRusted Halo';

const fullPrompt = buildMusicPrompt(body);

async function tryPrompt(label, prompt) {
  console.log(`\n=== ${label} (${prompt.length} chars) ===`);
  try {
    const clip = await generateClip(apiKey, prompt);
    console.log('SUCCESS', clip.mimeType, `${clip.data.length} base64 chars`);
  } catch (err) {
    console.error('FAILED', err.message);
  }
}

await tryPrompt('Simple prompt', simplePrompt);
await tryPrompt('Full supergroup prompt', fullPrompt);
