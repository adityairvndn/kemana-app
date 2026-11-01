// Pembaca tulisan (OCR) di perangkat, memakai Tesseract (tesseract.js-core, WebAssembly).
// Foto tidak pernah dikirim ke mana pun: semuanya diproses di sini.
/* global TesseractCore */

let api = null;
let Mod = null;

async function siapkan(base, simd) {
  const core = simd ? 'tesseract-core-simd-lstm' : 'tesseract-core-lstm';
  importScripts(base + core + '.js');
  Mod = await TesseractCore({ locateFile: function (p) { return base + p; } });
  const res = await fetch(base + 'ind.traineddata');
  if (!res.ok) throw new Error('Model bahasa gagal diunduh (' + res.status + ').');
  Mod.FS.writeFile('./ind.traineddata', new Uint8Array(await res.arrayBuffer()));
  api = new Mod.TessBaseAPI();
  if (api.Init(null, 'ind', 1) !== 0) throw new Error('Pembaca nota gagal disiapkan.');
  api.SetVariable('tessedit_pageseg_mode', '6');
  api.SetVariable('user_defined_dpi', '300');
}

self.onmessage = async function (e) {
  const m = e.data || {};
  try {
    if (m.type === 'init') {
      if (!api) await siapkan(m.base, m.simd);
      self.postMessage({ id: m.id, ok: true });
    } else if (m.type === 'baca') {
      Mod.FS.writeFile('/input', new Uint8Array(m.gambar));
      if (api.SetImageFile(1, 0) === 1) throw new Error('Gambar tidak bisa dibaca.');
      api.Recognize(null);
      const text = api.GetUTF8Text();
      const conf = api.MeanTextConf();
      api.Clear();
      self.postMessage({ id: m.id, ok: true, text: text, conf: conf });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) });
  }
};
