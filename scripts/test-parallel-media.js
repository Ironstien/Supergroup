import { loadEnv, geminiApiKey } from '../server/lib/env.js';
import { buildCoverPrompt, buildMusicPrompt } from '../server/lib/prompts.js';
import { generateAlbumMedia } from '../server/lib/gemini.js';

loadEnv();
const apiKey = geminiApiKey();

const body = {
  album: { title: 'Rusted Halo', tracks: ['Era Echoes', 'Distortion Bloom'] },
  bandName: 'Chrome Rebel Symphony',
  picks: [
    { slot: 'Vocals', name: 'Dave Grohl', band: 'Foo Fighters', genre: 'rock', era: '90s' },
    { slot: 'Guitar', name: 'Malcolm Young', band: 'AC/DC', genre: 'rock', era: '80s' },
    { slot: 'Bass', name: 'Damon McKinnon', band: 'Twelve Foot Ninja', genre: 'metal', era: '10s' },
    { slot: 'Drums', name: 'Vinnie Paul', band: 'Pantera', genre: 'metal', era: '90s' },
    { slot: 'Producer', name: 'Daniel Fang', band: 'Turnstile', genre: 'punk', era: '20s' },
  ],
  supergroup: true,
  grade: 'S',
};

const coverPrompt = buildCoverPrompt(body);
const musicPrompt = buildMusicPrompt(body);

console.log('Music prompt preview:\n', musicPrompt.slice(0, 400), '...\n');

const result = await generateAlbumMedia(apiKey, coverPrompt, musicPrompt);
console.log('cover:', result.cover ? 'OK' : 'FAIL', result.errors.cover ?? '');
console.log('audio:', result.audio ? 'OK' : 'FAIL', result.errors.audio ?? '');
