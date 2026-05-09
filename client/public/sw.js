/* eslint-disable no-restricted-globals */

// Manual (no Workbox) service worker.
// Handles:
// - Precaching app shell + basic assets
// - Runtime caching for:
//   - /api/* JSON (network-first w/ cache fallback for meals/search)
//   - /api/categories (stale-while-revalidate)
//   - Images (stale-while-revalidate)
// - Offline fallback for navigation requests

const CACHE_VERSION = 'recipes-pwa-cache-v5';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

function isGet(req) {
  return req && req.method === 'GET';
}

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

async function cachePut(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  try {
    await cache.put(request, response.clone());
  } catch {
    // Some requests may be non-cacheable; ignore.
  }
}

function emptyResponse(status = 204, statusText = 'No Content') {
  return new Response('', {
    status,
    statusText,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function matchFromCaches(request, fallbackUrl) {
  const direct = await caches.match(request);
  if (direct) return direct;
  if (fallbackUrl) {
    const fallback = await caches.match(fallbackUrl);
    if (fallback) return fallback;
  }
  return null;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const globalCached = await caches.match(request);
    if (globalCached) return globalCached;
    return emptyResponse(503, 'Offline cache miss');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cachePut(cacheName, request, fresh);
      return fresh;
    })
    .catch(() => null);

  if (cached) return cached;
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  const globalCached = await caches.match(request);
  if (globalCached) return globalCached;
  return emptyResponse(503, 'Offline cache miss');
}

async function navigationFallback(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cachedIndex = await matchFromCaches('/index.html', '/offline.html');
    if (cachedIndex) return cachedIndex;
    return new Response('<h1>Offline</h1><p>App shell unavailable.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Ignore missing assets in dev.
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const allowed = new Set([CACHE_VERSION, API_CACHE, IMAGES_CACHE, STATIC_CACHE]);
      await Promise.all(
        keys.map((k) => {
          if (!allowed.has(k)) return caches.delete(k);
          return Promise.resolve(false);
        })
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isGet(request)) return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      navigationFallback(request).catch(() => emptyResponse(503, 'Offline navigation failed'))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/categories') {
      event.respondWith(staleWhileRevalidate(request, API_CACHE).catch(() => emptyResponse(503, 'Offline cache miss')));
      return;
    }

    if (
      url.pathname.startsWith('/api/search') ||
      url.pathname.startsWith('/api/meal/') ||
      url.pathname.startsWith('/api/filter')
    ) {
      event.respondWith(networkFirst(request, API_CACHE).catch(() => emptyResponse(503, 'Offline cache miss')));
      return;
    }

    event.respondWith(networkFirst(request, API_CACHE).catch(() => emptyResponse(503, 'Offline cache miss')));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(
      (async () => {
        const result = await staleWhileRevalidate(request, IMAGES_CACHE);
        if (result) return result;
        // UI-level fallback image handlers will render a placeholder.
        return emptyResponse(204, 'No cached image');
      })()
    );
    return;
  }

  if (sameOrigin(url)) {
    event.respondWith(
      (async () => {
        const cached = await staleWhileRevalidate(request, STATIC_CACHE);
        if (cached) return cached;
        return emptyResponse(204, 'No cached static resource');
      })().catch(() => emptyResponse(503, 'Offline cache miss'))
    );
    return;
  }
});
