// Stable static version: intentionally no caching.
// Old service workers will be unregistered by index.html.
self.addEventListener('install', function (event) { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function () {
  // Let the browser/network handle all requests.
});
