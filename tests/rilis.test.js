// Pemeriksaan rilis: hal-hal yang kalau terlewat membuat aplikasi tidak ikut diperbarui di HP pengguna,
// atau tampil rusak saat offline. Jalankan dengan: npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };

const sw = read('sw.js');
const shell = (function () {
  const m = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(m, 'daftar SHELL tidak ditemukan di sw.js');
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map(function (x) { return x[1]; });
})();

test('versi service worker sama dengan APP_VERSION dan package.json', function () {
  const v = sw.match(/const VERSION = '([^']+)'/);
  assert.ok(v, 'VERSION tidak ditemukan di sw.js');
  assert.equal(v[1], CONFIG.APP_VERSION, 'Naikkan VERSION di sw.js bersama APP_VERSION di js/config.js, kalau tidak HP yang sudah memasang tidak menerima pembaruan.');
  assert.equal(JSON.parse(read('package.json')).version, CONFIG.APP_VERSION, 'versi di package.json harus sama');
});

test('pengaman versi service worker bisa mengenali config.js (kalau tidak, pembaruan selamanya ditolak)', function () {
  // sw.js menolak memasang versi baru kalau teks config.js dari server tidak memuat baris ini persis.
  assert.ok(read('js/config.js').indexOf("APP_VERSION: '" + CONFIG.APP_VERSION + "'") >= 0,
    "js/config.js harus menulis versi persis sebagai APP_VERSION: '" + CONFIG.APP_VERSION + "' (kutip tunggal, satu spasi)");
  assert.ok(sw.indexOf("\"APP_VERSION: '\" + VERSION + \"'\"") >= 0, 'pola pemeriksaan versi di sw.js berubah; samakan dengan tes ini');
  assert.ok(shell.indexOf('js/config.js') >= 0, 'js/config.js harus ada di SHELL karena dipakai untuk memeriksa versi');
});

test('paket offline diunduh lewat alamat berversi, bukan alamat biasa yang bisa basi di CDN', function () {
  assert.match(sw, /fetch\(new Request\(alamatVersi\(u\), \{ cache: 'reload' \}\)\)/);
  assert.ok(!/addAll\(/.test(sw), 'jangan kembali ke cache.addAll(alamat biasa): CDN bisa menyajikan file versi lama');
});

test('semua file di SHELL ada', function () {
  shell.forEach(function (f) {
    if (f === './') return;
    assert.ok(fs.existsSync(path.join(root, f)), f + ' ada di SHELL tapi tidak ada di disk');
  });
});

test('semua file JS aplikasi masuk SHELL (kecuali yang memang dikecualikan)', function () {
  const tanpaCache = ['nomodule.js'];   // hanya dimuat browser yang tidak mengenal modul
  fs.readdirSync(path.join(root, 'js')).filter(function (f) { return f.endsWith('.js'); }).forEach(function (f) {
    if (tanpaCache.indexOf(f) >= 0) return;
    assert.ok(shell.indexOf('js/' + f) >= 0, 'js/' + f + ' belum ada di SHELL sw.js, jadi tidak tersedia saat offline');
  });
});

test('file yang dirujuk index.html, CSS, dan manifest masuk SHELL', function () {
  const rujukan = new Set();
  const html = read('index.html');
  Array.from(html.matchAll(/(?:href|src)="([^"#?]+)"/g)).forEach(function (m) {
    if (!/^(https?:|data:|mailto:)/.test(m[1]) && !m[1].endsWith('nomodule.js')) rujukan.add(m[1]);
  });
  Array.from(read('css/app.css').matchAll(/url\('\.\.\/([^')]+)'\)/g)).forEach(function (m) { rujukan.add(m[1]); });
  JSON.parse(read('manifest.webmanifest')).icons.forEach(function (i) { rujukan.add(i.src); });
  rujukan.forEach(function (f) {
    assert.ok(shell.indexOf(f) >= 0, f + ' dirujuk halaman tapi belum ada di SHELL sw.js');
  });
});

test('tidak ada font yang diunduh: memakai font bawaan sistem (design.md §7.4)', function () {
  const html = read('index.html'), css = read('css/app.css');
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html + sw), 'masih merujuk Google Fonts');
  assert.ok(!/@font-face/.test(css), 'css/app.css tidak boleh memuat @font-face');
  assert.ok(!/rel="preload"[^>]*as="font"/.test(html), 'index.html tidak boleh preload font');
  assert.match(css, /font-family: var\(--font-body\)/);
});

test('ikon sprite: setiap <use href="#..."> punya simbolnya di index.html', function () {
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, ''), js = read('js/app.js');
  const ada = new Set(Array.from(html.matchAll(/<symbol id="([^"]+)"/g)).map(function (m) { return m[1]; }));
  Array.from((html + js).matchAll(/<use href=\\?"#([^"\\]+)\\?"/g)).forEach(function (m) {
    assert.ok(ada.has(m[1]), 'ikon #' + m[1] + ' dipakai tapi tidak ada di sprite');
  });
  // ID simbol tidak boleh sama dengan ID elemen aplikasi ($('cari') harus menemukan kotak cari, bukan ikonnya).
  const tanpaSprite = html.replace(/<svg class="sprite"[\s\S]*?<\/svg>/, '');
  const idElemen = new Set(Array.from(tanpaSprite.matchAll(/\sid="([^"]+)"/g)).map(function (m) { return m[1]; })
    .concat(Array.from(js.matchAll(/\$\('([^']+)'\)/g)).map(function (m) { return m[1]; })));
  ada.forEach(function (id) { assert.ok(!idElemen.has(id), 'ID simbol ikon "' + id + '" bentrok dengan elemen aplikasi'); });
});

test('tema: daftar di boot.js, pilihan Pengaturan, dan token CSS sama', function () {
  const boot = read('js/boot.js'), css = read('css/app.css'), app = read('js/app.js');
  const whitelist = JSON.parse(boot.match(/\[('otomatis'[^\]]*)\]/)[0].replace(/'/g, '"'));
  const pilihan = Array.from(app.matchAll(/\['([a-z]+)', '[^']+', \[/g)).map(function (m) { return m[1]; });
  assert.deepEqual(pilihan.slice().sort(), whitelist.slice().sort(), 'THEMES di app.js dan whitelist boot.js berbeda');
  whitelist.filter(function (x) { return x !== 'otomatis'; }).forEach(function (x) {
    assert.ok(css.indexOf('[data-theme="' + x + '"] {') >= 0 || css.indexOf('[data-theme="' + x + '"]') >= 0, 'token tema ' + x + ' tidak ada di CSS');
  });
});

test('toast yang tidak tampil benar-benar tersembunyi (bukan hanya digeser)', function () {
  const css = read('css/app.css');
  const dasar = css.match(/\n\.toast \{([^}]*)\}/);
  const tampil = css.match(/\n\.toast\.show \{([^}]*)\}/);
  assert.ok(dasar && tampil, 'aturan .toast / .toast.show tidak ditemukan');
  assert.match(dasar[1], /visibility:\s*hidden/, 'toast tersembunyi harus visibility:hidden');
  assert.match(dasar[1], /opacity:\s*0/, 'toast tersembunyi harus opacity:0');
  assert.match(dasar[1], /pointer-events:\s*none/, 'toast tersembunyi tidak boleh bisa diketuk');
  assert.match(tampil[1], /visibility:\s*visible/);
});

test('deklarasi dengan env()/min()/max() punya cadangan sebelumnya untuk browser lama', function () {
  // Browser yang tidak mengenal fungsi itu membuang deklarasinya; tanpa cadangan, propertinya hilang sama sekali.
  let css = read('css/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  css = css.replace(/@supports[^{]*\{\s*[^{}]*\{[^}]*\}\s*\}/g, '');   // blok @supports sudah punya cadangan sendiri
  const modern = /\b(env|min|max)\(/;
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).forEach(function (m) {
    const decls = m[2].split(';').map(function (d) { return d.trim(); }).filter(Boolean).map(function (d) {
      const k = d.indexOf(':');
      return [d.slice(0, k).trim(), d.slice(k + 1).trim()];
    });
    decls.forEach(function (d, i) {
      if (!modern.test(d[1])) return;
      const sama = d[0].indexOf('padding-') === 0 ? [d[0], 'padding'] : [d[0]];
      const ada = decls.slice(0, i).some(function (x) { return sama.indexOf(x[0]) >= 0 && !modern.test(x[1]); });
      assert.ok(ada, 'css/app.css: "' + m[1].trim() + ' { ' + d[0] + ': ' + d[1] + ' }" tidak punya cadangan untuk browser lama');
    });
  });
});

test('daftar kabar (lonceng): entri terbaru sama dengan APP_VERSION, urut menurun, tiap butir terisi', async function () {
  const { KABAR, bandingVersi, kabarBaru } = await import('../js/kabar.js');
  assert.equal(KABAR[0].versi, CONFIG.APP_VERSION, 'Tambahkan entri kabar untuk versi ' + CONFIG.APP_VERSION + ' di js/kabar.js (paling atas).');
  for (let i = 1; i < KABAR.length; i++) assert.ok(bandingVersi(KABAR[i - 1].versi, KABAR[i].versi) > 0, 'urutan kabar harus dari yang terbaru');
  KABAR.forEach(function (k) {
    assert.ok(k.judul && k.tanggal && k.butir.length > 0, 'kabar ' + k.versi + ' belum lengkap');
    k.butir.forEach(function (b) { assert.ok(String(b).trim().length > 5); });
  });
  assert.ok(bandingVersi('1.10.0', '1.9.0') > 0, 'versi dibandingkan sebagai angka');
  assert.equal(kabarBaru(CONFIG.APP_VERSION).length, 0);
  assert.equal(kabarBaru('1.0.0').length, KABAR.filter(function (k) { return k.versi !== '1.0.0'; }).length);
});
