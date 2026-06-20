export const REQUEST_TIMEOUT_MS = 30000;
export const MAX_REQUEST_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 500;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isTransientStatus = (status) => status === 429 || status >= 500;

export async function fetchWithRetry(url, options = {}, config = {}) {
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxAttempts = config.maxAttempts ?? MAX_REQUEST_ATTEMPTS;
  const retryDelayMs = config.retryDelayMs ?? RETRY_DELAY_MS;
  const fetchImpl = config.fetchImpl ?? fetch;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });

      if (!isTransientStatus(response.status) || attempt === maxAttempts) {
        return response;
      }

      lastError = new Error(`Request failed (${response.status})`);
    } catch (error) {
      lastError = error.name === 'AbortError'
        ? new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds`)
        : error;

      if (attempt === maxAttempts) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }

    await delay(retryDelayMs * attempt);
  }

  throw lastError || new Error('Request failed');
}
