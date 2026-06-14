const STYLE_SLOTS = ['Vocals', 'Guitar', 'Bass', 'Drums', 'Producer'];

function unique(values) {
  return [...new Set(values)];
}

function formatLineup(picks) {
  return picks
    .map((pick) => {
      const band = pick.band?.trim() || 'Solo';
      return `${pick.name} (${band}, ${pick.slot})`;
    })
    .join(', ');
}

/** Lyria blocks real artist names — use source band + slot sonic descriptors. */
function formatLyriaStyleLine(pick) {
  const source = pick.sourceBand ?? pick.band ?? 'rock';
  if (pick.slot === 'Producer') {
    return `Production: ${source}-inspired rock mix — punchy drums, wide guitars, loud vocal upfront`;
  }
  const lines = {
    Vocals: `Vocals: ${source}-inspired lead singer — raw, powerful, clear chorus delivery throughout`,
    Guitar: `Guitar: ${source}-inspired tone — distorted rhythm riffs, energetic power chords`,
    Bass: `Bass: ${source}-inspired low end — heavy, tight, driving groove`,
    Drums: `Drums: ${source}-inspired kit — aggressive beats, punchy kicks, driving tempo`,
  };
  return lines[pick.slot] ?? `${pick.slot}: ${source}-inspired rock performance`;
}

function musicMood({ supergroup, grade }) {
  if (supergroup) return 'high energy, aggressive but melodic, arena-ready.';
  if (grade === 'A') return 'confident, polished, high energy.';
  return 'stylish, energetic, album teaser feel.';
}

/** Lyria needs [Chorus] tags and repeated lines to actually sing — title-only on one line is treated as instrumental. */
function buildChorusLyrics(title) {
  const lines = Array.from({ length: 8 }, () => title).join('\n');
  return `[Chorus]\n${lines}`;
}

export function buildCoverPrompt({ album, bandName, picks, supergroup, grade }) {
  const sources = unique(picks.map((p) => p.sourceBand ?? p.band ?? 'rock'));
  const lineup = formatLineup(picks);
  const mood = supergroup
    ? 'triumphant, legendary, gold accents, electric energy, chart-topping debut'
    : grade === 'A'
      ? 'polished, ambitious, platinum dreams'
      : 'stylized, artistic, indie album aesthetic';

  return `Design a square album cover for the supergroup band "${bandName}".
Album title: "${album.title}"
Band members: ${lineup}.
Musical style: a creative blend inspired by ${sources.join(', ')}.
Mood: ${mood}.
Requirements:
- Professional square album cover composition
- Include the band name "${bandName}" and album title "${album.title}" as bold, legible stylized typography
- Feature the band members listed above prominently on the cover
- Include each member's name as legible credit text
- Rich color, high contrast, music-industry quality artwork`;
}

export function buildFallbackMusicPrompt({ album, picks, supergroup }) {
  const sources = unique(picks.map((p) => p.sourceBand ?? p.band ?? 'rock'));
  const bpm = supergroup ? '125 BPM' : '118 BPM';
  const title = album.title;
  const lyrics = buildChorusLyrics(title);

  return `Create a 30-second ${sources.join('/')} vocal song titled "${title}" at ${bpm}. Loud sung chorus vocals throughout — NOT instrumental.
Song structure: [Chorus] only.
Lyrics:
${lyrics}`;
}

export function buildMusicPrompt({ album, picks, supergroup, grade }) {
  const sources = unique(picks.map((p) => p.sourceBand ?? p.band ?? 'rock'));
  const bpm = supergroup ? '125 BPM' : '118 BPM';
  const title = album.title;
  const picksBySlot = Object.fromEntries(picks.map((p) => [p.slot, p]));
  const styleLines = STYLE_SLOTS.map((slot) => picksBySlot[slot])
    .filter(Boolean)
    .map(formatLyriaStyleLine)
    .join('\n');
  const lyrics = buildChorusLyrics(title);

  return `Create a 30-second vocal song titled "${title}" at ${bpm}. This must be a sung vocal track with loud, upfront lead vocals from start to finish — NOT instrumental.
Style blend: ${sources.join(' / ')} fusion.
Mood: ${musicMood({ supergroup, grade })}
${styleLines}
Vocal delivery: English lead singer, powerful and clear, singing the chorus lyrics continuously for the full 30 seconds. No instrumental-only sections.
Blend these influences into one cohesive supergroup track.
Song structure: [Chorus] only.

Lyrics:
${lyrics}`;
}
