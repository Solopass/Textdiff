// Bump CACHE_VERSION on any change that must invalidate previously cached
// responses. The activate handler deletes every cache that isn't the current
// one, so an old deploy can never keep serving a stale index.html.
const CACHE_VERSION = 'textdiff-v2';

self.addEventListener('install', (event) => {
  // Take over immediately instead of waiting for every old tab to close.
  // Without this, a broken worker from a previous deploy can stay in control
  // indefinitely.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(['./', './index.html', './manifest.json'])),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only same-origin GETs are cacheable here. Anything else (Firestore,
  // cross-origin CDNs, POSTs) goes straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Network-first. The previous version was cache-first with no revalidation,
  // so a cached index.html from a bad deploy was served forever and pointed at
  // hashed asset bundles that no longer existed -> permanently blank page.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline SPA navigation: fall back to the cached shell.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        }),
      ),
  );
});
