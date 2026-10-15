var CACHE = 'dela-v10';
var ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'api.open-meteo.com') return;
  if (url.origin === location.origin) {
    // свои файлы: сначала сеть (свежая версия), без сети — кэш
    e.respondWith(fetch(e.request).then(function (r) {
      var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
    }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  // шрифты Google: кэш, потом сеть
  if (url.hostname.indexOf('fonts.') === 0) {
    e.respondWith(caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (resp) { var copy = resp.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return resp; });
    }));
  }
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (list) {
    if (list.length) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});
