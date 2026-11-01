// Service worker: aplikasi tetap bisa dibuka tanpa sinyal.
// File aplikasi diambil dari jaringan dulu (supaya update langsung terpakai), cadangannya dari cache.
// Data keuangan TIDAK lewat sini: dikirim langsung ke Google Sheets API.

const CACHE = 'kemana-v2';
// Mesin pembaca nota (±4 MB) disimpan terpisah supaya tidak diunduh ulang setiap aplikasi diperbarui.
const OCR_CACHE = 'kemana-ocr-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/boot.js', 'js/app.js', 'js/config.js', 'js/format.js', 'js/schema.js', 'js/compute.js', 'js/google.js', 'js/sheets.js',
  'js/nota.js', 'js/ocr.js', 'js/ocr-worker.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== OCR_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function timeout(ms) { return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.indexOf('/vendor/') >= 0) {
    // File besar yang tidak berubah: cache dulu, jaringan kalau belum ada.
    event.respondWith(caches.open(OCR_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && res.ok) cache.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  if (url.origin === self.location.origin) {
    // Jaringan dulu (maks. 4 detik), lalu cache.
    event.respondWith(caches.open(CACHE).then(function (cache) {
      const net = fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      });
      return Promise.race([net, timeout(4000)]).catch(function () {
        return cache.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') return cache.match('index.html');
          return net;
        });
      });
    }));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; });
      });
    }));
  }
  // Selain itu (Google API, login) dibiarkan langsung ke jaringan.
});
