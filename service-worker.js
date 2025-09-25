const VERSION = 'v1';
const CACHE_NAME = `postkorb-panic-${VERSION}`;
const BASE_URL = self.location;
const OFFLINE_URL = new URL('./index.html', BASE_URL).href;
const ASSET_URLS = [
  './index.html',
  './app.js',
  './css/base.css',
  './css/start.css',
  './css/setup.css',
  './css/game.css',
  './css/result.css',
  './data/data.json',
  './icon.png',
  './icon.svg',
  './manifest.webmanifest'
].map((path) => new URL(path, BASE_URL).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSET_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('postkorb-panic-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (!isHttp) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          if (response && (response.status === 200 || response.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          if (event.request.destination === 'image') {
            return caches.match(new URL('./icon.png', BASE_URL).href);
          }
          return Response.error();
        });
    })
  );
});
