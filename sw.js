/* Nuera Tech service worker — offline-capable PWA shell.
 * App JS (/assets/js) is network-first so a deploy's HTML + JS always update together (no
 * stale app.js running against a freshly-fetched index.html); fonts/icons stay cache-first
 * (immutable). pricing-data.json uses stale-while-revalidate: still fetched at runtime,
 * just served fast from cache then refreshed in the background (Rule 1 intact).
 */
const VERSION = 'nuera-v7';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// Install-time shell = only what the first render / offline reload actually needs.
// The PWA-install icons (192 / 512 / maskable / apple-touch, ~154KB) are deliberately
// NOT precached: they're fetched on demand by the /assets/ stale-while-revalidate handler
// the first time the OS requests one, so a first visit no longer pays for them up front.
const PRECACHE = [
  '/',
  '/index.html',
  '/assets/js/app.js',
  '/assets/js/chat.js',
  '/assets/fonts/inter-var-latin.woff2',
  '/assets/icons/favicon.svg',
  '/assets/icons/favicon-32.png',
  '/manifest.webmanifest',
  '/pricing-data.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (analytics, etc.) pass through

  // Live pricing: stale-while-revalidate
  if (url.pathname === '/pricing-data.json') {
    e.respondWith(staleWhileRevalidate(e));
    return;
  }

  // Navigations: network-first, fall back to cached shell when offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { e.waitUntil(cachePut(SHELL, '/index.html', res.clone())); return res; })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // App logic (JS): network-first so a freshly-deployed app.js / chat.js is never served stale
  // against the network-first index.html — that hybrid runs a previous deploy's JS against this
  // deploy's HTML + CSS. /assets/js is served max-age=0,must-revalidate so this stays cheap.
  if (url.pathname.startsWith('/assets/js/')) {
    e.respondWith(networkFirst(e));
    return;
  }

  // Other static assets (fonts, icons — immutable): cache-first with background refresh
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(staleWhileRevalidate(e));
    return;
  }
});

function staleWhileRevalidate(event) {
  const request = event.request;
  return caches.open(RUNTIME).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => null);
      // Keep the SW alive until the background refresh + cache write completes.
      event.waitUntil(network);
      // Serve the RUNTIME copy first, then the install-time precache (SHELL, found
      // via the cache-name-less global match), then whatever the network returns.
      return cached || network.then((res) => res || caches.match(request));
    })
  );
}

// Network-first: try the live copy (so a new deploy's JS matches the freshly-fetched HTML shell),
// fall back to the cached/precached copy when offline.
function networkFirst(event) {
  const request = event.request;
  return fetch(request)
    .then((res) => {
      if (res && res.ok) event.waitUntil(caches.open(SHELL).then((c) => c.put(request, res.clone())));
      return res;
    })
    .catch(() => caches.match(request));
}

function cachePut(cacheName, key, res) {
  if (res && res.ok) return caches.open(cacheName).then((c) => c.put(key, res));
  return Promise.resolve();
}
