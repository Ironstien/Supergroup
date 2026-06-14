/**
 * Display musician name in the UI (band context is shown separately on band spins).
 */
export function formatMusicianName(musician) {
  if (!musician?.name) return '—';
  return musician.name;
}
