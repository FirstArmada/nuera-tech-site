/* Nuera Tech service worker — offline-capable PWA shell.
 * pricing-data.json uses stale-while-revalidate: still fetched at runtime,
 * just served fast from cache then refreshed in the background (Rule 1 intact).
 */
const VERSION = 'nuera-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  '/',
  '/index.html',
  '/assets/js/app.js',
  '/assets/fonts/inter-var-latin.woff2',
  '/assets/icons/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
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
  if (url.origin !== self.location.origin) return; // let cross-origin (logo, analytics) pass through

  // Live pricing: stale-while-revalidate
  if (url.pathname === '/pricing-data.json') {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigations: network-first, fall back to cached shell when offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { cachePut(SHELL, '/index.html', res.clone()); return res; })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first with background refresh
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }
});

function staleWhileRevalidate(request) {
  return caches.open(RUNTIME).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
}

function cachePut(cacheName, key, res) {
  if (res && res.ok) caches.open(cacheName).then((c) => c.put(key, res));
}
