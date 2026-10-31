// Offline support: the app shell is cached so Christina opens without a connection.
// Bump VERSION whenever app files change so phones pick up the update.
const VERSION = 'christina-v3';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'app/core/catalog.js',
  'app/core/db.js',
  'app/core/events.js',
  'app/core/prefs.js',
  'app/core/queries.js',
  'app/core/registry.js',
  'app/core/render.js',
  'app/core/state.js',
  'app/core/util.js',
  'app/core/validation.js',
  'app/main.js',
  'app/modules/add/index.js',
  'app/modules/archive/index.js',
  'app/modules/calendar/grid.js',
  'app/modules/calendar/index.js',
  'app/modules/overview/index.js',
  'app/modules/records/index.js',
  'app/modules/settings/index.js',
  'app/modules/settings/personalize.js',
  'app/modules/threads/index.js',
  'app/services/backup.js',
  'app/services/media.js',
  'app/ui/base.css',
  'app/ui/components.css',
  'app/ui/components.js',
  'app/ui/icons.js',
  'app/ui/tokens.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive), falling back to the cache when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html')))
  );
});
