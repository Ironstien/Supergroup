/** Mulberry32 seeded PRNG */
export function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed() {
  const d = new Date();
  return (
    d.getFullYear() * 10000 +
    (d.getMonth() + 1) * 100 +
    d.getDate()
  );
}

export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickRandomDifferent(arr, current, rng) {
  const options = arr.filter((x) => x !== current);
  return options.length ? pickRandom(options, rng) : current;
}
