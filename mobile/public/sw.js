const CACHE = 'alassile-v2';
const APP_SHELL = ['/','/index.html'];

function isAppShellRequest(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  return request.mode === 'navigate' || request.destination === 'document';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    return (await cache.match(request)) || cache.match('/index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then(response => {
      if (response && response.ok && request.method === 'GET') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never intercept API calls — they must go to the network
  if (new URL(e.request.url).pathname.startsWith('/api/')) return;

  if (isAppShellRequest(e.request)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  e.respondWith(staleWhileRevalidate(e.request));
});
