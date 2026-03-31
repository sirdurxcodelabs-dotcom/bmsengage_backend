const axios = require('axios');

/**
 * Axios instance with exponential-backoff retry for 429 / 5xx.
 * Automatically retries up to `maxRetries` times.
 */
const withRetry = async (fn, maxRetries = 3) => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.response?.status;
      attempt++;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (!isRetryable || attempt >= maxRetries) throw err;
      const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s …
      console.warn(`[apiRetry] attempt ${attempt} failed (${status}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

module.exports = { withRetry };
