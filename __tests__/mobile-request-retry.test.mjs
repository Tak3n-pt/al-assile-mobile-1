import assert from 'node:assert/strict';
import { fetchWithRetry } from '../mobile/src/utils/fetchWithRetry.js';

let attempts = 0;
const response = await fetchWithRetry('/api/products', {}, {
  timeoutMs: 100,
  maxAttempts: 2,
  retryDelayMs: 1,
  fetchImpl: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary network failure');
    return new Response(JSON.stringify({ success: true, data: [{ id: 1 }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

assert.equal(response.status, 200);
assert.equal(attempts, 2, 'browser API should retry one transient failure before surfacing an error');

console.log('mobile-request-retry: PASS');
