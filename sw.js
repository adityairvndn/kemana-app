// Service worker Kemana: aplikasi terbuka cepat dan tetap jalan tanpa sinyal.
//
// File aplikasi disimpan sebagai SATU paket berversi dan dilayani dari cache lebih dulu. Hasilnya:
//  - pembukaan aplikasi instan, tanpa menunggu jaringan;
//  - semua file selalu berasal dari versi yang sama (tidak pernah campuran lama dan baru).
// Versi baru diunduh utuh di latar belakang. Baru dipakai setelah aplikasi ditutup, atau saat pengguna
// mengetuk "Pakai sekarang", supaya isian yang sedang diketik tidak hilang.
// Data keuangan TIDAK lewat sini: dikirim langsung ke Google Sheets API.
//
// PENTING: setiap merilis versi baru, naikkan VERSION di bawah DAN APP_VERSION di js/config.js.
// Kalau tidak, ponsel yang sudah memasang aplikasi tidak akan menerima pembaruan.
// Kesamaan keduanya dan kelengkapan daftar SHELL diperiksa oleh `npm test` (tests/rilis.test.js).

const VERSION = '1.3.0';
const CACHE = 'kemana-' + VERSION;
// Mesin pembaca nota (±4 MB) disimpan terpisah supaya tidak diunduh ulang setiap aplikasi diperbarui.
const OCR_CACHE = 'kemana-ocr-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'fonts/PlusJakartaSans-latin.woff2',
  'js/boot.js', 'js/app.js', 'js/config.js', 'js/format.js', 'js/schema.js', 'js/compute.js', 'js/google.js', 'js/sheets.js',
  'js/kabar.js', 'js/nota.js', 'js/ocr.js', 'js/ocr-worker.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-maskable-512.png'
];

// Setelah rilis, CDN GitHub Pages bisa beberapa menit masih menyajikan sebagian file lama. Kalau paket
// diisi dari situ, HP menyimpan campuran file lama dan baru, dan campuran itu dipakai terus sampai rilis
// berikutnya. Karena itu tiap file diminta lewat alamat khusus versi ini (?v=VERSION) yang belum pernah
// disimpan CDN, dan cache: 'reload' melewati cache HTTP browser.
function alamatVersi(u) { return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(VERSION); }

// Pengaman kedua: config.js dari server harus bertanda versi yang sama dengan service worker ini.
// Kalau belum (server/CDN masih basi), pemasangan dibatalkan dan browser mencoba lagi saat aplikasi dibuka.
function cocokVersi(teksConfig) { return teksConfig.indexOf("APP_VERSION: '" + VERSION + "'") >= 0; }

self.addEventListener('install', function (event) {
  event.waitUntil(
    Promise.all(SHELL.map(function (u) {
      return fetch(new Request(alamatVersi(u), { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(u + ': HTTP ' + res.status);
        return { url: u, res: res };
      });
    })).then(function (hasil) {
      let cfg = null;
      for (let i = 0; i < hasil.length; i++) if (hasil[i].url === 'js/config.js') cfg = hasil[i].res;
      return cfg.clone().text().then(function (teks) {
        if (!cocokVersi(teks)) throw new Error('config.js di server belum versi ' + VERSION);
        // Semua file sudah lengkap dan benar: baru sekarang disimpan, sekaligus.
        return caches.open(CACHE).then(function (c) {
          return Promise.all(hasil.map(function (h) { return c.put(h.url, h.res); }));
        }).catch(function (e) {
          // Misalnya memori HP penuh: jangan tinggalkan paket setengah jadi.
          return caches.delete(CACHE).then(function () { throw e; });
        });
      });
    }).then(function () {
      // Peralihan dari versi lama (kemana-v2) yang belum punya tombol "Pakai sekarang": langsung diganti, sekali ini saja.
      return caches.has('kemana-v2');
    }).then(function (lama) {
      if (lama) return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== OCR_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  if (event.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google API, login, dan sebagainya: langsung ke jaringan.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf('/vendor/') >= 0) {
    // File besar yang tidak berubah: cache dulu, jaringan kalau belum ada.
    event.respondWith(caches.open(OCR_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res && res.ok) cache.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  // File aplikasi: dari paket berversi. ignoreSearch supaya "?demo" tetap dapat index.html dari cache.
  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return cache.match('index.html').then(function (h) { return h || fetch(req); });
      return fetch(req);
    });
  }));
});
