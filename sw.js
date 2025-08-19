// sw.js — network-first for HTML, cache-first for static files

const VERSION = 'v3';                          // bump this whenever you deploy
const STATIC_CACHE  = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// Use relative paths so it works on GitHub Pages project sites
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

// Install: pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: HTML -> network-first; assets -> cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';

  // HTML/documents: always try network first so new deploys show immediately
  if (accept.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Static assets: cache-first, then network
  const isStatic = /\.(?:js|css|png|jpe?g|webp|svg|ico|woff2?)$/i.test(
    new URL(req.url).pathname
  );

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached || !isStatic) return cached || fetch(req);
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
