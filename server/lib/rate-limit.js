const MIN_REQUEST_GAP_MS = 12_000;
let lastAlbumRequestAt = 0;
let activeGeneration = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAlbumGenerationLock(task) {
  if (activeGeneration) {
    await activeGeneration.catch(() => {});
  }

  const now = Date.now();
  const waitMs = MIN_REQUEST_GAP_MS - (now - lastAlbumRequestAt);
  if (waitMs > 0) {
    console.log(`Rate limit guard — waiting ${Math.ceil(waitMs / 1000)}s before next album generation`);
    await sleep(waitMs);
  }

  lastAlbumRequestAt = Date.now();
  const run = task();
  activeGeneration = run;
  try {
    return await run;
  } finally {
    if (activeGeneration === run) activeGeneration = null;
  }
}
