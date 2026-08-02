// ═══════════════════════════════════════════════════════════
// The Path — Service Worker
// Enables install-as-app (PWA) and offline access.
//
// MAINTENANCE: When you deploy updated pages, bump CACHE_VERSION
// below (e.g. 'v1' → 'v2'). This tells installed apps to fetch
// fresh copies instead of serving stale cached ones. If you forget,
// users on the installed app may keep seeing old pages until their
// cache happens to clear.
// ═══════════════════════════════════════════════════════════

const CACHE_VERSION = 'the-path-v2';

// Core files to cache for offline use. Keep in sync with the site's pages.
const CORE_ASSETS = [
  'index.html',
  'sit.html',
  'timer.html',
  'practice.html',
  'journal.html',
  'path.html',
  'do.html',
  'glossary.html',
  'logs.html',
  'suttas.html',
  'setup.html',
  'settings.html',
  'contact.html',
  'updates.html',
  'theravada_buddhism_interactive_tutorial.html',
  'data.js',
  'style.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// Install: pre-cache the core assets.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {}) // if one asset fails, don't block install
  );
});

// Activate: delete old caches from previous versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For same-origin page/asset requests: network-first, falling back to cache
//   (so users get fresh content when online, but the app still works offline).
// - For cross-origin requests (SuttaCentral, GitHub API, Web3Forms): always
//   go to network, never cache — these must be live and current.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests from our own origin; let everything else pass through.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return; // default browser behavior — straight to network
  }

  event.respondWith(
    fetch(req)
      .then(res => {
        // Update the cache with the fresh copy for next time (offline use).
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
