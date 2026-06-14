export async function fetchDailyPuzzle() {
  const response = await fetch('/api/daily');
  if (!response.ok) {
    throw new Error('Daily puzzle unavailable');
  }
  return response.json();
}
