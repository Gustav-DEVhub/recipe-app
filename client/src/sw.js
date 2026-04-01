/* eslint-disable no-restricted-globals */

// Manual (no Workbox) service worker.
// Handles:
// - Precaching app shell + basic assets
// - Runtime caching for:
//   - /api/* JSON (network-first w/ cache fallback for meals/search)
//   - /api/categories (stale-while-revalidate)
//   - Images (stale-while-revalidate)
// - Offline fallback for navigation requests

const CACHE_VERSION = 'recipes-pwa-cache-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
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
    throw new Error('Network and cache both failed');
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
  // If we have no cached response, let it fail and be handled by callers.
  throw new Error('No cached response for resource');
}

async function navigationFallback(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      // Cache the navigation target (best-effort).
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    // Prefer the app shell (so SPA routes still render).
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) return cachedIndex;

    const offline = await caches.match('/offline.html');
    if (offline) return offline;

    throw new Error('Offline navigation failed');
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

  // Navigation requests: serve offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  // API JSON caching.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/categories') {
      event.respondWith(staleWhileRevalidate(request, API_CACHE));
      return;
    }

    // Meals/search/filter: network-first w/ cache fallback.
    if (
      url.pathname.startsWith('/api/search') ||
      url.pathname.startsWith('/api/meal/') ||
      url.pathname.startsWith('/api/filter')
    ) {
      event.respondWith(networkFirst(request, API_CACHE));
      return;
    }

    // Default for other API calls.
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Images (including external MealDB CDN): stale-while-revalidate.
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE));
    return;
  }

  // Static same-origin assets: stale-while-revalidate.
  if (sameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
});

