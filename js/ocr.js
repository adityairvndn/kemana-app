// Jembatan ke pembaca nota (js/ocr-worker.js). Mesin OCR (±4 MB) baru diunduh saat pertama dipakai,
// lalu disimpan service worker supaya bisa dipakai tanpa internet.

const BASE = new URL('../vendor/tesseract/', import.meta.url).href;
let worker = null, siap = null, seq = 0;
const tunggu = {};

export function didukung() {
  return typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

function simd() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) { return false; }
}

function kirim(msg, transfer) {
  return new Promise(function (resolve, reject) {
    const id = ++seq;
    tunggu[id] = { resolve: resolve, reject: reject };
    worker.postMessage(Object.assign({ id: id }, msg), transfer || []);
  });
}

function buatWorker() {
  worker = new Worker(new URL('./ocr-worker.js', import.meta.url));
  worker.onmessage = function (e) {
    const m = e.data || {};
    const t = tunggu[m.id];
    if (!t) return;
    delete tunggu[m.id];
    if (m.ok) t.resolve(m); else t.reject(new Error(m.error || 'Gagal membaca nota.'));
  };
  worker.onerror = function (e) {
    const err = new Error('Pembaca nota berhenti: ' + (e.message || 'galat tidak dikenal'));
    Object.keys(tunggu).forEach(function (k) { tunggu[k].reject(err); delete tunggu[k]; });
    batal();
  };
}

/** Sudah pernah diunduh? (untuk teks "sekali saja") */
export async function sudahTersimpan() {
  try {
    if (!('caches' in self)) return false;
    const c = await caches.open('kemana-ocr-v1');
    return !!(await c.match(BASE + 'ind.traineddata'));
  } catch (e) { return false; }
}

export function persiapkan() {
  if (!worker) { buatWorker(); siap = null; }
  if (!siap) siap = kirim({ type: 'init', base: BASE, simd: simd() }).catch(function (e) { siap = null; batal(); throw e; });
  return siap;
}

export function batal() {
  if (worker) { try { worker.terminate(); } catch (e) { /* abaikan */ } }
  worker = null;
  siap = null;
  Object.keys(tunggu).forEach(function (k) { tunggu[k].reject(Object.assign(new Error('Dibatalkan.'), { batal: true })); delete tunggu[k]; });
}

async function bukaGambar(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* coba cara lain */ }
    try { return await createImageBitmap(file); } catch (e) { /* coba cara lain */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }
}

/** Abu-abu, perkecil (maks. 2000 px), rentangkan kontras; hasilnya PNG. */
export async function siapkanGambar(file) {
  const src = await bukaGambar(file);
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  if (!w0 || !h0) throw new Error('Gambar tidak bisa dibuka.');
  const skala = Math.min(1, 2000 / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * skala)), h = Math.max(1, Math.round(h0 * skala));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  if (src.close) src.close();
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    px[i] = y; hist[y]++;
  }
  const n = w * h, cut = n * 0.01;
  let lo = 0, hi = 255, acc = 0;
  while (lo < 255 && (acc += hist[lo]) < cut) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi]) < cut) hi--;
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    let y = Math.round((px[i] - lo) * 255 / span);
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    px[i] = px[i + 1] = px[i + 2] = y; px[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  const blob = await new Promise(function (resolve) { cv.toBlob(resolve, 'image/png'); });
  if (!blob) throw new Error('Gambar tidak bisa diproses.');
  return blob.arrayBuffer();
}

/** Baca tulisan dari file gambar. onTahap('unduh' | 'baca') untuk teks status. */
export async function baca(file, onTahap) {
  const gambarP = siapkanGambar(file);
  if (!siap && onTahap) onTahap((await sudahTersimpan()) ? 'muat' : 'unduh');
  await persiapkan();
  const gambar = await gambarP;
  if (onTahap) onTahap('baca');
  const r = await kirim({ type: 'baca', gambar: gambar }, [gambar]);
  return { text: r.text || '', conf: r.conf || 0 };
}
