// Offline support: the app shell is cached so Christina opens without a connection.
// Bump RELEASE whenever app files change so phones pick up the update.
// Cache names carry this copy's address: Christina can be served from more than one path on the same site
// (e.g. /christina/ and /bodyoracle/), and those share one cache storage.
const RELEASE = 'christina-v23';
const VERSION = `${RELEASE} ${self.registration.scope}`;
/** Ours to remove: older versions at this address, and caches from before addresses were added
 *  (names without a space, e.g. 'christina-v5' or the old app's 'body-oracle-v5'). */
const isStale = (key) => key !== VERSION && (key.endsWith(` ${self.registration.scope}`) || !key.includes(' '));
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'app/core/appearance.js',
  'app/core/catalog.js',
  'app/core/db.js',
  'app/core/events.js',
  'app/core/legacy.js',
  'app/core/prefs.js',
  'app/core/queries.js',
  'app/core/registry.js',
  'app/core/render.js',
  'app/core/repo.js',
  'app/core/schema.js',
  'app/core/state.js',
  'app/core/util.js',
  'app/core/validation.js',
  'app/main.js',
  'app/modules/add/index.js',
  'app/modules/archive/index.js',
  'app/modules/calendar/grid.js',
  'app/modules/calendar/index.js',
  'app/modules/calendar/plans.js',
  'app/modules/habits/index.js',
  'app/modules/insights/index.js',
  'app/modules/journal/index.js',
  'app/modules/overview/index.js',
  'app/modules/overview/widgets.js',
  'app/modules/projects/index.js',
  'app/modules/records/index.js',
  'app/modules/rituals/index.js',
  'app/modules/settings/index.js',
  'app/modules/settings/organize.js',
  'app/modules/settings/personalize.js',
  'app/modules/states/index.js',
  'app/modules/tasks/index.js',
  'app/modules/themes/index.js',
  'app/modules/threads/index.js',
  'app/services/backup.js',
  'app/services/media.js',
  'app/services/oracle-import.js',
  'app/services/search.js',
  'app/shell/more.js',
  'app/shell/nav.js',
  'app/ui/base.css',
  'app/ui/components.css',
  'app/ui/components.js',
  'app/ui/icons.js',
  'app/ui/media.js',
  'app/ui/moon.js',
  'app/ui/tokens.css',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages lets it keep files 10 minutes), so a new version
  // never caches old files.
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(async (keys) => {
        const stale = keys.filter(isStale);
        await Promise.all(stale.map((k) => caches.delete(k)));
        await self.clients.claim();
        // An update (an older version was here): reload open windows so they show the new version now.
        if (stale.some((k) => k.endsWith(` ${self.registration.scope}`) || k.startsWith('christina-v'))) {
          const windows = await self.clients.matchAll({ type: 'window' });
          windows.forEach((w) => w.navigate(w.url).catch(() => {}));
        }
      })
  );
});

// Network first (so updates arrive), falling back to the cache when offline. 'no-cache' asks the server each time
// instead of reusing the browser's copy.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html')))
  );
});
