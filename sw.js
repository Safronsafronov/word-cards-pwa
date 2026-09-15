const CACHE_NAME = 'wordcardsmvp-v1';

const PRECACHE_URLS = [
  './',
  'index.html',
  'styles.css',
  'manifest.json',
  'js/app.js',
  'js/store.js',
  'js/models.js',
  'js/dateutils.js',
  'js/icons.js',
  'js/ui.js',
  'js/views/collectionFilter.js',
  'js/views/training.js',
  'js/views/wordbase.js',
  'js/views/statistics.js',
  'js/views/settings.js',
  'data/B1-B2_adjectives.csv',
  'data/B1-B2_emotions.csv',
  'data/B1-B2_nouns.csv',
  'data/B1-B2_verbs.csv',
  'data/words.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first, falling back to network, then updating the cache in the background.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
