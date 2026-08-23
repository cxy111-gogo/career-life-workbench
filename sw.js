const CACHE_NAME = 'career-life-workbench-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return res;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
