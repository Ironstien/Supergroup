const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 5;
const INTER_CALL_DELAY_MS = 3_000;

export class GeminiApiError extends Error {
  constructor(message, { status = 0, rateLimited = false } = {}) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(response) {
  const header = response.headers.get('retry-after');
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return 0;
}

function isRetryableStatus(status) {
  return status === 429 || status === 503 || status === 500;
}

function isRateLimitedMessage(message) {
  return /429|too many requests|rate limit|quota exceeded|resource exhausted/i.test(message);
}

export async function geminiFetch(url, apiKey, options = {}, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        ...options.headers,
      },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        body?.error?.message ||
        body?.message ||
        `Gemini API error (${response.status})`;
      const rateLimited = response.status === 429 || isRateLimitedMessage(message);

      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        const retryAfterMs = parseRetryAfterMs(response);
        const backoffMs = Math.min(2_000 * 2 ** attempt, 30_000);
        const delayMs = Math.max(retryAfterMs, backoffMs);
        console.warn(
          `Gemini ${response.status} — retrying in ${Math.round(delayMs / 1000)}s (${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delayMs);
        return geminiFetch(url, apiKey, options, attempt + 1);
      }

      throw new GeminiApiError(message, {
        status: response.status,
        rateLimited,
      });
    }

    return body;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeminiApiError('Gemini request timed out', { status: 408 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { sleep, INTER_CALL_DELAY_MS, isRateLimitedMessage };
