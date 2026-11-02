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

test('tidak ada permintaan ke pihak ketiga untuk font (cepat, offline, privat)', function () {
  const html = read('index.html');
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'index.html masih merujuk Google Fonts');
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(sw), 'sw.js masih merujuk Google Fonts');
  assert.ok(fs.existsSync(path.join(root, 'fonts/OFL.txt')), 'lisensi font (fonts/OFL.txt) harus ikut');
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
