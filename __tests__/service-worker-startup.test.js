'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  async match(request) {
    const key = requestKey(request);
    const response = this.store.get(key);
    return response ? response.clone() : undefined;
  }

  async put(request, response) {
    const key = requestKey(request);
    this.store.set(key, response.clone());
  }

  async addAll(entries) {
    for (const entry of entries) {
      const request = entry instanceof Request ? entry : new Request(entry);
      this.store.set(requestKey(request), new Response(`precache:${request.url}`, { status: 200 }));
    }
  }
}

class MemoryCaches {
  constructor() {
    this.named = new Map();
  }

  async open(name) {
    if (!this.named.has(name)) {
      this.named.set(name, new MemoryCache());
    }
    return this.named.get(name);
  }

  async keys() {
    return [...this.named.keys()];
  }

  async delete(name) {
    return this.named.delete(name);
  }

  async match(request) {
    for (const cache of this.named.values()) {
      const matched = await cache.match(request);
      if (matched) return matched;
    }
    return undefined;
  }
}

function requestKey(request) {
  return typeof request === 'string' ? request : request.url;
}

function createHarness({ fetchImpl }) {
  const handlers = {};
  const caches = new MemoryCaches();
  const context = {
    URL,
    Request,
    Response,
    caches,
    fetch: fetchImpl,
    self: {
      location: {
        origin: 'https://example.com',
      },
      addEventListener(type, handler) {
        handlers[type] = handler;
      },
      skipWaiting() {},
      clients: {
        claim() {},
      },
    },
    console,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(context);
  const swPath = path.resolve(__dirname, '../mobile/public/sw.js');
  vm.runInContext(fs.readFileSync(swPath, 'utf8'), context, { filename: swPath });

  return { handlers, caches };
}

function dispatchFetch(handler, request) {
  return new Promise((resolve, reject) => {
    handler({
      request,
      respondWith(promise) {
        Promise.resolve(promise).then(resolve, reject);
      },
    });
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

test('navigation requests prefer fresh app shell over stale cached shell', async () => {
  let networkHits = 0;
  const { handlers, caches } = createHarness({
    fetchImpl: async (request) => {
      networkHits += 1;
      return new Response(`fresh:${request.url}`, { status: 200 });
    },
  });

  const appCache = await caches.open('alassile-v2');
  await appCache.put('https://example.com/', new Response('stale-shell', { status: 200 }));

  const response = await dispatchFetch(
    handlers.fetch,
    { url: 'https://example.com/', method: 'GET', mode: 'navigate' }
  );

  assert.equal(await response.text(), 'fresh:https://example.com/');
  assert.equal(networkHits, 1);

  const cached = await appCache.match('https://example.com/');
  assert.equal(await cached.text(), 'fresh:https://example.com/');
});

test('API requests bypass service worker caching', async () => {
  let networkHits = 0;
  const { handlers } = createHarness({
    fetchImpl: async (request) => {
      networkHits += 1;
      return new Response(`api:${request.url}`, { status: 200 });
    },
  });

  let respondCalled = false;
  handlers.fetch({
    request: new Request('https://example.com/api/auth/login', { method: 'POST' }),
    respondWith() {
      respondCalled = true;
    },
  });

  assert.equal(respondCalled, false);
  assert.equal(networkHits, 0);
});
