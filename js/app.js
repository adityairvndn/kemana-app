// Kemana — logika tampilan.
// Data dibaca dari & ditulis ke Google Sheets milik pengguna. Catatan baru disimpan di perangkat dulu
// (antrean), lalu dikirim saat ada koneksi dan sesi Google aktif.

import { CONFIG } from './config.js';
import * as G from './google.js';
import * as SH from './sheets.js';
import * as S from './schema.js';
import * as C from './compute.js';
import * as F from './format.js';
import * as N from './nota.js';
import * as K from './kabar.js';

const JK = S.JENIS;
const $ = function (id) { return document.getElementById(id); };
const esc = F.escapeHtml;

const LS = {
  get: function (k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  /** @returns {boolean} false kalau penyimpanan penuh atau diblokir (mode pribadi, dsb.) */
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
};

const THEMES = [
  ['otomatis', 'Ikuti HP', ['#F3F5F9', '#0E1320', '#0F6E56']],
  ['terang', 'Terang', ['#F3F5F9', '#FFFFFF', '#0F6E56']],
  ['gelap', 'Gelap', ['#0E1320', '#172033', '#4FC9A0']],
  ['biru', 'Biru Laut', ['#EAF0F9', '#FFFFFF', '#1D5BD8']],
  ['krem', 'Krem', ['#F5EFE4', '#FFFCF6', '#8F5310']],
  ['kontras', 'Kontras Tinggi', ['#FFFFFF', '#000000', '#0030B8']]
];
const THEME_BG = { terang: '#F3F5F9', gelap: '#0E1320', biru: '#EAF0F9', krem: '#F5EFE4', kontras: '#FFFFFF' };
const TEKS = [['normal', 'Normal'], ['besar', 'Besar'], ['sangat', 'Sangat besar']];
const TITLES = { catat: 'Catat', riwayat: 'Riwayat', ringkasan: 'Ringkasan', pengaturan: 'Pengaturan' };
const KATA = {}; KATA[JK.KELUAR] = 'pengeluaran'; KATA[JK.MASUK] = 'pemasukan'; KATA[JK.TRANSFER] = 'transfer';
const LIMIT = 150;

const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_SYNC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>';
const ICON_CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

// ---------------------------------------------------------------------------
// State

const prefs = Object.assign({ tema: 'otomatis', teks: 'normal', dompet: '', versi: '', kabarDilihat: '' }, LS.get('ck.prefs', {}));
if (!THEMES.some(function (t) { return t[0] === prefs.tema; })) prefs.tema = 'otomatis';
const st = {
  mode: LS.get('ck.mode', null),          // 'google' | 'demo' | null
  sheet: LS.get('ck.sheet', null),        // { id, url, title }
  user: LS.get('ck.user', null),          // { email, name, photo }
  snap: null,
  queue: LS.get('ck.queue', []) || [],
  inflight: 0,
  ctx: null,
  tab: 'catat',
  form: null,
  edit: null,
  bulan: F.todayISO().slice(0, 7),
  cari: '',
  filterJenis: '',
  filterKategori: '',
  filterDompet: '',
  nota: null,             // { kandidat: [] } setelah membaca nota
  cepat: [],
  limit: LIMIT,
  syncing: false, needAuth: false, authDeclined: false, offline: !navigator.onLine,
  lastSync: 0, syncError: '', sheetLost: false,
  screen: null,
  installEvt: null
};
st.form = blankForm();

function savePrefs() { LS.set('ck.prefs', prefs); }
let queueWarned = false;
function saveQueue() {
  // Antrean adalah satu-satunya salinan catatan yang belum terkirim, jadi gagal menyimpannya harus diberi tahu.
  if (LS.set('ck.queue', st.queue)) { queueWarned = false; return; }
  if (!queueWarned && st.queue.length) {
    queueWarned = true;
    // Ditunda sebentar supaya tidak tertimpa toast "tersimpan" yang dipanggil tepat sesudah commit.
    setTimeout(function () {
      toast('Penyimpanan di HP penuh atau dibatasi. Catatan yang belum terkirim bisa hilang kalau halaman ditutup. Sambungkan internet untuk mengirimnya.', '', null, 9000);
    }, 0);
  }
}
function snapKey() { return st.mode === 'demo' ? 'ck.snap.demo' : 'ck.snap.google'; }
function saveSnap() { LS.set(snapKey(), st.snap); }

function blankForm() {
  // Selalu mulai dari Pengeluaran (paling sering); setelah menyimpan, jenis terakhir dipertahankan.
  return { jenis: JK.KELUAR, nominal: '', kategori: '', dompet: '', ke: '', tanggal: F.todayISO(), catatan: '' };
}

// ---------------------------------------------------------------------------
// Data yang ditampilkan = snapshot spreadsheet + antrean yang belum terkirim

let viewCache = null;
function invalidate() { viewCache = null; }

function applyQueue(list, queue) {
  const out = list.slice();
  const pos = {};
  out.forEach(function (t, i) { pos[t.id] = i; });
  queue.forEach(function (op) {
    if (op.t === 'add') { pos[op.item.id] = out.length; out.push(Object.assign({}, op.item, { _pending: true })); }
    else if (op.t === 'upd') { const i = pos[op.id]; if (i !== undefined && out[i]) out[i] = Object.assign({}, out[i], op.item, { _pending: true }); }
    else if (op.t === 'del') { const i = pos[op.id]; if (i !== undefined) { out[i] = null; delete pos[op.id]; } }
  });
  return out.filter(Boolean);
}

function view() {
  if (viewCache) return viewCache;
  const s = st.snap || { transaksi: [], dompet: [], kategori: [], info: {}, invalid: [] };
  const tx = st.mode === 'google' && st.queue.length ? applyQueue(s.transaksi, st.queue) : s.transaksi;
  viewCache = { transaksi: tx, dompet: s.dompet || [], kategori: s.kategori || [], info: s.info || {}, invalid: s.invalid || [] };
  return viewCache;
}

function activeDompet() {
  return view().dompet.filter(function (d) { return d.aktif !== false; }).map(function (d) { return d.nama; });
}

// ---------------------------------------------------------------------------
// Antrean & penerapan perubahan

function enqueue(op) {
  const q = st.queue;
  const free = st.inflight;  // operasi yang sedang dikirim tidak boleh diubah
  function find(fn) { for (let i = free; i < q.length; i++) if (fn(q[i])) return i; return -1; }
  if (op.t === 'upd') {
    let i = find(function (x) { return x.t === 'add' && x.item.id === op.id; });
    if (i >= 0) { Object.assign(q[i].item, op.item); saveQueue(); return; }
    i = find(function (x) { return x.t === 'upd' && x.id === op.id; });
    if (i >= 0) { Object.assign(q[i].item, op.item); saveQueue(); return; }
  } else if (op.t === 'del') {
    const a = find(function (x) { return x.t === 'add' && x.item.id === op.id; });
    for (let i = q.length - 1; i >= free; i--) if (q[i].t === 'upd' && q[i].id === op.id) q.splice(i, 1);
    if (a >= 0) { q.splice(a, 1); saveQueue(); return; }
  } else if (op.t === 'add') {
    // Membatalkan penghapusan yang belum terkirim: hapus op 'del', pulihkan nilai lewat 'upd'.
    const d = find(function (x) { return x.t === 'del' && x.id === op.item.id; });
    if (d >= 0) { q.splice(d, 1); q.push({ t: 'upd', id: op.item.id, item: op.item }); saveQueue(); return; }
  }
  q.push(op);
  saveQueue();
}

function applyLocal(op) {
  const tx = st.snap.transaksi;
  if (op.t === 'add') {
    const last = tx.reduce(function (m, t) { return Math.max(m, t._row || 0); }, 1);
    tx.push(Object.assign({ _row: last + 1 }, op.item));
  } else if (op.t === 'upd') {
    const t = tx.filter(function (x) { return x.id === op.id; })[0];
    if (t) Object.assign(t, op.item);
  } else if (op.t === 'del') {
    for (let i = tx.length - 1; i >= 0; i--) if (tx[i].id === op.id) tx.splice(i, 1);
  }
  saveSnap();
}

/** Simpan perubahan transaksi. Dipanggil langsung dari ketukan supaya popup login boleh dibuka. */
function commit(op) {
  if (st.mode === 'demo') applyLocal(op);
  else enqueue(op);
  invalidate();
  renderAll();
  if (st.mode === 'google') kickSync(true);
}

function kickSync(gesture) {
  if (G.validToken()) { sync(); return; }
  st.needAuth = true;
  renderStatus();
  if (gesture && G.ready() && !st.authDeclined && navigator.onLine) {
    G.requestToken().then(function () { st.needAuth = false; sync(); }).catch(function (e) {
      st.authDeclined = true;
      renderStatus();
      if (e.code === 'POPUP' || e.code === 'SCOPE') toast(e.message);
    });
  }
}

// ---------------------------------------------------------------------------
// Sinkron

let syncAgain = false;

async function doSync() {
  const r1 = await SH.connect(st.sheet.id);
  let r = r1;
  if (st.queue.length) {
    st.inflight = st.queue.length;
    const ops = st.queue.slice(0, st.inflight);
    const res = await SH.flush(r1.ctx, ops);
    st.queue.splice(0, ops.length);
    st.inflight = 0;
    saveQueue();
    if (res.dropped.length) toast(res.dropped.length + ' perubahan dilewati karena transaksinya sudah dihapus di spreadsheet.');
    r = await SH.connect(st.sheet.id);
  }
  st.ctx = r.ctx;
  st.snap = r.snapshot;
  if (r.snapshot.sheetUrl) {
    st.sheet.url = r.snapshot.sheetUrl;
    st.sheet.title = r.snapshot.sheetTitle || st.sheet.title;
    LS.set('ck.sheet', st.sheet);
  }
  saveSnap();
  st.lastSync = Date.now();
  st.sheetLost = false;
  if (r1.notes.length) showNotes(r1.notes);
  if (r1.newer) toast('Spreadsheet memakai format yang lebih baru. Tutup lalu buka lagi aplikasi untuk memperbarui.');
}

function handleSyncError(e) {
  st.inflight = 0;
  if (e.code === 'AUTH') st.needAuth = true;
  else if (e.code === 'OFFLINE') st.offline = true;
  else if (e.code === 'NOT_FOUND' || e.code === 'FORBIDDEN') {
    st.sheetLost = true;
    st.syncError = 'Spreadsheet tidak bisa dibuka. Mungkin sudah dihapus, dipindah ke sampah, atau aksesnya dicabut.';
  } else {
    st.syncError = e.message || 'Gagal sinkron.';
    toast('Gagal sinkron: ' + st.syncError);
  }
}

async function sync() {
  if (st.mode !== 'google' || !st.sheet) return;
  if (st.syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { st.offline = true; renderStatus(); return; }
  if (!G.validToken()) { st.needAuth = true; renderStatus(); return; }
  st.syncing = true;
  st.syncError = '';
  renderStatus();
  try {
    await doSync();
    st.needAuth = false; st.offline = false; st.authDeclined = false;
  } catch (e) {
    handleSyncError(e);
  } finally {
    st.syncing = false;
    invalidate();
    renderAll();
    if (syncAgain) { syncAgain = false; if (st.queue.length) sync(); }
  }
}

/** Untuk dompet/kategori: kirim antrean dulu, baca ulang, jalankan fn, baca ulang lagi. */
function withSheet(fn, localFn) {
  if (st.mode === 'demo') {
    try { localFn(); } catch (e) { toast(e.message); return Promise.resolve(false); }
    saveSnap(); invalidate(); renderAll();
    return Promise.resolve(true);
  }
  if (!navigator.onLine) { toast('Butuh koneksi internet untuk mengubah dompet atau kategori.'); return Promise.resolve(false); }
  if (st.syncing) { toast('Tunggu sinkron selesai, lalu coba lagi.'); return Promise.resolve(false); }
  const tok = G.validToken() ? Promise.resolve() : G.requestToken();
  st.syncing = true;
  renderStatus();
  return tok.then(async function () {
    await doSync();
    await fn(st.ctx);
    const r = await SH.connect(st.sheet.id);
    st.ctx = r.ctx;
    st.snap = r.snapshot;
    saveSnap();
    st.lastSync = Date.now();
    st.needAuth = false;
    return true;
  }).catch(function (e) {
    if (['AUTH', 'OFFLINE', 'NOT_FOUND', 'FORBIDDEN'].indexOf(e.code) >= 0) handleSyncError(e);
    toast(e.message);
    return false;
  }).then(function (ok) {
    st.syncing = false;
    invalidate();
    renderAll();
    return ok;
  });
}

// ---------------------------------------------------------------------------
// Tampilan umum

function applyTheme() {
  let t = prefs.tema;
  if (t === 'otomatis') t = darkMq && darkMq.matches ? 'gelap' : 'terang';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-teks', prefs.teks);
  $('metaTheme').setAttribute('content', THEME_BG[t] || '#F3F5F9');
}

let toastTimer = null, toastFn = null;

function hideToast() {
  clearTimeout(toastTimer);
  toastFn = null;
  $('toast').className = 'toast';
}

/**
 * Tampilkan pesan singkat. Menghilang sendiri; ketuk pesannya untuk menutup lebih cepat.
 * @param {string} msg
 * @param {string=} actionLabel  teks tombol aksi (mis. "Batalkan")
 * @param {Function=} fn         dipanggil saat tombol aksi diketuk
 * @param {number=} ms           lama tampil; 0 = tetap sampai ditutup
 */
function toast(msg, actionLabel, fn, ms) {
  const el = $('toast');
  clearTimeout(toastTimer);
  $('toastText').textContent = msg;
  toastFn = fn || null;
  $('toastAction').hidden = !fn;
  $('toastAction').textContent = fn ? (actionLabel || 'OK') : '';
  el.className = 'toast show';
  // Waktu baca menyesuaikan panjang pesan (min. 3,5 dtk); dengan tombol aksi dibuat lebih lama.
  const dur = ms !== undefined ? ms : Math.max(fn ? 6000 : 3500, Math.min(10000, msg.length * 55));
  if (dur > 0) toastTimer = setTimeout(hideToast, dur);
}

function renderBell() {
  const ada = !!swMenunggu || K.kabarBaru(prefs.kabarDilihat || CONFIG.APP_VERSION).length > 0;
  $('bellDot').hidden = !ada;
  $('bell').setAttribute('aria-label', ada ? 'Kabar dan pembaruan, ada yang baru' : 'Kabar dan pembaruan');
}

function renderStatus() {
  renderBell();
  const el = $('status');
  let cls = '', txt = '', icon = '';
  if (st.mode === 'demo') { txt = 'Mode demo'; }
  else if (st.syncing) { cls = 'spin'; icon = ICON_SYNC; txt = 'Menyinkron'; }
  else if (st.sheetLost) { cls = 'warn'; txt = 'Spreadsheet tidak ditemukan'; }
  else if (st.needAuth) { cls = 'action'; icon = ICON_SYNC; txt = st.queue.length ? st.queue.length + ' belum terkirim' : 'Sambungkan'; }
  else if (st.offline) { cls = 'warn'; txt = st.queue.length ? st.queue.length + ' belum terkirim' : 'Offline'; }
  else if (st.queue.length) { cls = 'warn'; txt = st.queue.length + ' belum terkirim'; }
  else if (st.syncError) { cls = 'warn'; txt = 'Gagal sinkron'; }
  else if (st.snap) { cls = 'ok'; icon = ICON_CHECK; txt = 'Tersimpan'; }
  el.hidden = !txt;
  el.className = 'status ' + cls;
  el.innerHTML = icon + '<span>' + esc(txt) + '</span>';
  el.setAttribute('aria-label', st.needAuth ? 'Sambungkan lagi ke Google Sheets' : txt);
}

function renderAll() {
  if ($('shell').hidden) return;
  document.body.setAttribute('data-view', 'app');
  document.body.setAttribute('data-tab', st.tab);
  $('title').textContent = st.edit && st.tab === 'catat' ? 'Ubah transaksi' : TITLES[st.tab];
  ['catat', 'riwayat', 'ringkasan', 'pengaturan'].forEach(function (t) {
    $('tab-' + t).hidden = t !== st.tab;
    const b = document.querySelector('.nav [data-tab="' + t + '"]');
    if (t === st.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  renderStatus();
  if (st.tab === 'catat') renderCatat();
  else if (st.tab === 'riwayat') renderRiwayat();
  else if (st.tab === 'ringkasan') renderRingkasan();
  else renderPengaturan();
}

function switchTab(t) {
  st.tab = t;
  window.scrollTo(0, 0);
  renderAll();
}

function showApp() {
  st.screen = null;
  $('screen').hidden = true;
  $('shell').hidden = false;
  invalidate();
  renderAll();
}

// ---------------------------------------------------------------------------
// Catat

function chip(act, value, selected, label) {
  return '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(value) + '" aria-pressed="' + (value === selected) + '">' + esc(label || value) + '</button>';
}

function ensureFormDefaults() {
  const f = st.form;
  const doms = activeDompet();
  if (!f.dompet || (doms.indexOf(f.dompet) < 0 && !st.edit)) {
    f.dompet = doms.indexOf(prefs.dompet) >= 0 ? prefs.dompet : (doms[0] || '');
  }
  if (f.jenis === JK.TRANSFER && (!f.ke || f.ke === f.dompet || (doms.indexOf(f.ke) < 0 && !st.edit))) {
    f.ke = doms.filter(function (n) { return n !== f.dompet; })[0] || '';
  }
}

function renderAmount() {
  $('amountVal').textContent = st.form.nominal ? F.ribuan(Number(st.form.nominal)) : '0';
  $('amount').className = 'amount' + (st.form.nominal ? '' : ' empty');
  const b = document.querySelector('#formActions [data-act="simpan"]');
  if (b && !st.edit) b.textContent = 'Simpan ' + KATA[st.form.jenis] + (st.form.nominal ? ' ' + F.rupiah(Number(st.form.nominal)) : '');
  renderQuick();
}

function frekKategori() {
  const v = view();
  if (!v.frekKat) v.frekKat = C.frekuensi(v.transaksi, 'kategori', F.todayISO(), 90);
  return v.frekKat;
}

function tanpaContoh(s) { return String(s || '').replace(/^Contoh:\s*/i, ''); }

function daftarCepat(jenis) {
  const v = view();
  v.cepat = v.cepat || {};
  if (!v.cepat[jenis]) {
    const doms = activeDompet();
    const kats = v.kategori.filter(function (k) { return k.aktif !== false; }).map(function (k) { return k.nama; });
    v.cepat[jenis] = C.seringDicatat(v.transaksi, {
      jenis: jenis, hariIni: F.todayISO(), maks: 6,
      abaikan: function (t) { return t.kategori === S.KATEGORI_SELISIH; }
    }).filter(function (c) {
      return doms.indexOf(c.dompet) >= 0 && (jenis === JK.TRANSFER ? doms.indexOf(c.ke_dompet) >= 0 : kats.indexOf(c.kategori) >= 0);
    }).slice(0, 4).map(function (c) { return Object.assign(c, { catatan: tanpaContoh(c.catatan) }); });
  }
  return v.cepat[jenis];
}

function labelCepat(c) {
  if (c.jenis === JK.TRANSFER) return c.dompet + ' → ' + c.ke_dompet;
  return c.catatan ? capital(c.catatan) : c.kategori;
}

/** Baris di bawah nominal: angka lain dari nota, atau tombol "Catat cepat". */
function renderQuick() {
  const el = $('quick');
  const f = st.form;
  let h = '';
  if (st.nota && !st.edit) {
    const lain = st.nota.kandidat.filter(function (n) { return String(n) !== f.nominal; });
    if (lain.length) {
      h = '<div class="label">Angka lain di nota</div><div class="quick-row">' + lain.map(function (n) {
        return '<button type="button" class="qchip" data-act="nota-pilih" data-v="' + n + '"><b class="num">' + F.rupiah(n) + '</b></button>';
      }).join('') + '</div>';
    }
  } else if (!st.edit && !f.nominal) {
    st.cepat = daftarCepat(f.jenis);
    if (st.cepat.length) {
      h = '<div class="label">Catat cepat <small>(sekali ketuk)</small></div><div class="quick-row">' + st.cepat.map(function (c, i) {
        return '<button type="button" class="qchip" data-act="cepat" data-i="' + i + '" aria-label="Catat ' + esc(labelCepat(c)) + ' ' + F.rupiah(c.nominal) + ' dari ' + esc(c.dompet) + '">' +
          '<b>' + esc(labelCepat(c)) + ' <span class="num">' + F.ribuan(c.nominal) + '</span></b><small>' + esc(c.jenis === JK.TRANSFER ? 'Transfer' : c.dompet) + '</small></button>';
      }).join('') + '</div>';
    }
  }
  if (el._h !== h) { el._h = h; el.innerHTML = h; }
  el.hidden = !h;
}

/** Getaran singkat sebagai tanda berhasil (Android; iOS mengabaikannya). */
function getar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* abaikan */ } }

function simpanCepat(i) {
  const c = st.cepat[i];
  if (!c) return;
  const item = {
    id: F.uid(), dicatat: F.nowStamp(), tanggal: st.form.tanggal || F.todayISO(), jenis: c.jenis, dompet: c.dompet,
    ke_dompet: c.jenis === JK.TRANSFER ? c.ke_dompet : '', kategori: c.jenis === JK.TRANSFER ? '' : c.kategori, nominal: c.nominal, catatan: c.catatan
  };
  commit({ t: 'add', item: item });
  getar(12);
  toast(labelCepat(c) + ' ' + F.rupiah(c.nominal) + ' tersimpan.', 'Batalkan', function () { commit({ t: 'del', id: item.id }); });
}

function renderCatat() {
  ensureFormDefaults();
  const f = st.form, v = view();
  $('tab-catat').setAttribute('data-jenis', f.jenis);
  $('editBar').hidden = !st.edit;
  $('notaBtn').hidden = !!st.edit;
  document.querySelectorAll('#segJenis button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === f.jenis); });
  renderAmount();

  const transfer = f.jenis === JK.TRANSFER;
  $('fKategori').hidden = transfer;
  $('fKe').hidden = !transfer;
  $('lblDompet').textContent = transfer ? 'Dari dompet' : 'Dompet';

  if (!transfer) {
    let kats = v.kategori.filter(function (k) { return k.jenis === f.jenis && k.aktif !== false; }).map(function (k) { return k.nama; });
    kats = C.urutSering(kats, frekKategori());
    if (f.kategori && kats.indexOf(f.kategori) < 0) kats.push(f.kategori);
    $('chipsKategori').innerHTML = kats.map(function (n) { return chip('kategori', n, f.kategori); }).join('') +
      '<button type="button" class="chip ghost" data-act="kategori-baru" data-v="' + esc(f.jenis) + '">+ Kategori</button>';
  }
  const doms = activeDompet();
  if (f.dompet && doms.indexOf(f.dompet) < 0) doms.push(f.dompet);
  $('chipsDompet').innerHTML = doms.map(function (n) { return chip('dompet', n, f.dompet); }).join('') +
    (doms.length ? '' : '<button type="button" class="chip ghost" data-act="dompet-baru">+ Tambah dompet</button>');
  if (transfer) {
    const kes = doms.filter(function (n) { return n !== f.dompet; });
    if (f.ke && kes.indexOf(f.ke) < 0 && f.ke !== f.dompet) kes.push(f.ke);
    $('chipsKe').innerHTML = kes.length ? kes.map(function (n) { return chip('ke', n, f.ke); }).join('')
      : '<button type="button" class="chip ghost" data-act="dompet-baru">+ Tambah dompet lain</button>';
  }

  $('dateLabel').textContent = F.labelTanggal(f.tanggal);
  $('dateInput').value = f.tanggal;
  $('dateChip').className = 'date-chip' + (f.tanggal !== F.todayISO() ? ' past' : '');
  if (document.activeElement !== $('catatan')) $('catatan').value = f.catatan;

  $('formActions').innerHTML = st.edit
    ? '<button type="button" class="btn danger big hapus" data-act="hapus-trx">Hapus</button><button type="button" class="btn primary big" data-act="simpan">Simpan perubahan</button>'
    : '<button type="button" class="btn primary big" data-act="simpan">Simpan ' + KATA[f.jenis] + (f.nominal ? ' ' + F.rupiah(Number(f.nominal)) : '') + '</button>';
}

function press(k) {
  const f = st.form;
  if (k === 'del') f.nominal = f.nominal.slice(0, -1);
  else {
    const next = (f.nominal + k).replace(/^0+/, '');
    if (next.length > 13) return;
    f.nominal = next;
  }
  renderAmount();
}

function itemFromForm() {
  const f = st.form;
  f.catatan = $('catatan').value.trim();
  const transfer = f.jenis === JK.TRANSFER;
  return {
    tanggal: f.tanggal, jenis: f.jenis, dompet: f.dompet, ke_dompet: transfer ? f.ke : '',
    kategori: transfer ? '' : f.kategori, nominal: Number(f.nominal || 0), catatan: f.catatan
  };
}

function simpan() {
  const f = st.form;
  if (!Number(f.nominal || 0)) { toast('Isi nominal dulu.'); return; }
  if (!f.dompet) { toast('Tambahkan dompet dulu di Pengaturan.'); return; }
  if (f.jenis === JK.TRANSFER) {
    if (!f.ke) { toast('Pilih dompet tujuan.'); return; }
    if (f.ke === f.dompet) { toast('Dompet asal dan tujuan tidak boleh sama.'); return; }
  } else if (!f.kategori) {
    toast('Pilih kategori dulu.');
    const fk = $('fKategori');
    fk.classList.remove('flash'); void fk.offsetWidth; fk.classList.add('flash');
    try { fk.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { fk.scrollIntoView(); }
    return;
  }
  const item = itemFromForm();

  if (st.edit) {
    const id = st.edit.id;
    const before = {};
    Object.keys(item).forEach(function (k) { before[k] = st.edit[k]; });
    st.edit = null;
    st.form = blankForm();
    st.tab = 'riwayat';
    window.scrollTo(0, 0);
    commit({ t: 'upd', id: id, item: item });
    getar(12);
    toast('Perubahan disimpan.', 'Batalkan', function () { commit({ t: 'upd', id: id, item: before }); });
    return;
  }
  item.id = F.uid();
  item.dicatat = F.nowStamp();
  st.nota = null;
  prefs.dompet = f.dompet;
  savePrefs();
  st.form = Object.assign(blankForm(), { jenis: f.jenis, dompet: f.dompet, ke: f.ke, tanggal: f.tanggal });
  window.scrollTo(0, 0);
  commit({ t: 'add', item: item });
  getar(12);
  toast(capital(KATA[item.jenis]) + ' ' + F.rupiah(item.nominal) + ' tersimpan.', 'Batalkan', function () {
    commit({ t: 'del', id: item.id });
  });
}

function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function openEdit(id) {
  const t = view().transaksi.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  st.edit = Object.assign({}, t);
  st.form = {
    jenis: t.jenis, nominal: String(Math.round(t.nominal)), kategori: t.kategori, dompet: t.dompet,
    ke: t.ke_dompet, tanggal: t.tanggal, catatan: t.catatan || ''
  };
  switchTab('catat');
}

function hapusTrx() {
  const t = st.edit;
  if (!t) return;
  confirmBox({
    title: 'Hapus transaksi ini?',
    text: (t.kategori || 'Transfer') + ', ' + F.rupiah(t.nominal) + ', ' + F.labelTanggalPendek(t.tanggal) + '.',
    ok: 'Hapus', danger: true
  }).then(function (ok) {
    if (!ok) return;
    const copy = {};
    S.SHEET.transaksi.columns.forEach(function (c) { copy[c.key] = t[c.key]; });
    st.edit = null;
    st.form = blankForm();
    st.tab = 'riwayat';
    window.scrollTo(0, 0);
    commit({ t: 'del', id: t.id });
    toast('Transaksi dihapus.', 'Batalkan', function () { commit({ t: 'add', item: copy }); });
  });
}

// ---------------------------------------------------------------------------
// Riwayat

function trxHtml(t) {
  const sign = t.jenis === JK.MASUK ? '+' : t.jenis === JK.KELUAR ? '−' : '';
  const ic = t.jenis === JK.MASUK ? '+' : t.jenis === JK.KELUAR ? '−' : '⇄';
  const title = t.jenis === JK.TRANSFER ? 'Transfer' : (t.kategori || 'Tanpa kategori');
  const sub = t.jenis === JK.TRANSFER ? t.dompet + ' → ' + t.ke_dompet : t.dompet;
  return '<button type="button" class="trx" data-act="trx" data-id="' + esc(t.id) + '">' +
    '<span class="dot ' + t.jenis + '" aria-hidden="true">' + ic + '</span>' +
    '<span class="info"><span class="t">' + esc(title) + '</span>' +
    '<span class="s">' + (t._pending ? '<span class="tag">belum terkirim</span>' : '') + esc(sub) + '</span>' +
    (t.catatan ? '<span class="s">' + esc(t.catatan) + '</span>' : '') + '</span>' +
    '<span class="amt num ' + t.jenis + '">' + sign + F.rupiah(t.nominal) + '</span></button>';
}

function renderBulanLabels() {
  document.querySelectorAll('.rBulan').forEach(function (el) { el.textContent = F.labelBulan(st.bulan); });
}

function renderRiwayat() {
  renderBulanLabels();
  const v = view();
  const aktif = st.filterKategori || (st.filterDompet ? 'Dompet ' + st.filterDompet : '');
  $('filterJenis').innerHTML = (aktif ? '<button type="button" class="chip filter-on" data-act="hapus-filter" aria-label="Hapus filter ' + esc(aktif) + '">' + esc(aktif) + ' <span aria-hidden="true">✕</span></button>' : '') +
    [['', 'Semua'], [JK.KELUAR, 'Pengeluaran'], [JK.MASUK, 'Pemasukan'], [JK.TRANSFER, 'Transfer']]
    .map(function (x) { return chip('filter', x[0], st.filterJenis, x[1]); }).join('');
  if (document.activeElement !== $('cari')) $('cari').value = st.cari;
  renderRiwayatList(v);
}

function renderRiwayatList(v) {
  v = v || view();
  const list = C.riwayat(v.transaksi, { ym: st.bulan, q: st.cari, jenis: st.filterJenis, kategori: st.filterKategori, dompet: st.filterDompet });
  const disaring = st.cari || st.filterJenis || st.filterKategori || st.filterDompet;
  let masuk = 0, keluar = 0;
  list.forEach(function (t) { if (t.jenis === JK.MASUK) masuk += t.nominal; else if (t.jenis === JK.KELUAR) keluar += t.nominal; });
  $('rSum').innerHTML = '<div><small>Pemasukan</small><b class="num c-masuk">' + F.rupiah(masuk) + '</b></div>' +
    '<div><small>Pengeluaran</small><b class="num c-keluar">' + F.rupiah(keluar) + '</b></div>';
  if (!list.length) {
    $('rList').innerHTML = '<div class="empty-state"><b>' + (disaring ? 'Tidak ada yang cocok' : 'Belum ada transaksi') + '</b>' +
      (disaring ? 'di ' + F.labelBulan(st.bulan) + '. Coba bulan lain, kata lain, atau hapus filter.' : 'di ' + F.labelBulan(st.bulan) + '.') + '</div>';
    return;
  }
  const groups = C.kelompokTanggal(list.slice(0, st.limit));
  $('rList').innerHTML = groups.map(function (g) {
    return '<div class="day"><div class="day-h"><span>' + esc(F.labelTanggal(g.tanggal)) + '</span>' +
      (g.keluar ? '<span class="num">−' + F.rupiah(g.keluar) + '</span>' : '') + '</div>' +
      '<div class="trx-list">' + g.items.map(trxHtml).join('') + '</div></div>';
  }).join('') + (list.length > st.limit
    ? '<button type="button" class="btn more" data-act="more">Tampilkan lebih banyak (' + (list.length - st.limit) + ' lagi)</button>' : '');
}

// ---------------------------------------------------------------------------
// Ringkasan

function monthNav() {
  return '<div class="monthnav">' +
    '<button type="button" class="icon-btn" data-act="bulan" data-d="-1" aria-label="Bulan sebelumnya"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
    '<b class="rBulan">' + esc(F.labelBulan(st.bulan)) + '</b>' +
    '<button type="button" class="icon-btn" data-act="bulan" data-d="1" aria-label="Bulan berikutnya"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div>';
}

function renderRingkasan() {
  const v = view();
  const saldo = C.saldoPerDompet(v.dompet, v.transaksi);
  const tampil = saldo.filter(function (d) { return d.aktif || d.saldo !== 0 || !d.terdaftar; });
  const total = C.totalSaldo(saldo);
  const r = C.ringkasanBulan(v.transaksi, st.bulan);
  const tr = C.tren(v.transaksi, st.bulan, 6);
  const maxT = tr.reduce(function (m, x) { return Math.max(m, x.masuk, x.keluar); }, 0) || 1;
  const maxK = r.perKategori.length ? r.perKategori[0].jumlah : 1;

  let h = '<div class="card"><h2>Saldo saat ini</h2><div class="big-total num' + (total < 0 ? ' c-keluar' : '') + '">' + F.rupiah(total) + '</div><div class="rows">' +
    (tampil.length ? tampil.map(function (d) {
      const note = !d.terdaftar ? 'Tidak ada di sheet Dompet' : !d.aktif ? 'Nonaktif' : '';
      return '<button type="button" class="rowx tap" data-act="dompet-saldo" data-v="' + esc(d.nama) + '"><span>' + esc(d.nama) + (note ? '<span class="note">' + note + '</span>' : '') + '</span><b class="num' + (d.saldo < 0 ? ' c-keluar' : '') + '">' + F.rupiah(d.saldo) + '</b>' + ICON_CHEV + '</button>';
    }).join('') : '<p class="muted">Belum ada dompet.</p>') + '</div>' +
    (tampil.length ? '<p class="card-hint">Saldo beda dengan aslinya? Ketuk dompetnya untuk mencocokkan.</p>' : '') + '</div>';

  h += '<div style="margin-top:1.4rem">' + monthNav() + '</div>';
  h += '<div class="card" style="margin-top:0"><h2>Arus uang</h2><div class="rows">' +
    '<div class="rowx"><span>Pemasukan</span><b class="num c-masuk">' + F.rupiah(r.masuk) + '</b></div>' +
    '<div class="rowx"><span>Pengeluaran</span><b class="num c-keluar">' + F.rupiah(r.keluar) + '</b></div>' +
    '<div class="rowx"><span><b>Sisa</b></span><b class="num' + (r.selisih < 0 ? ' c-keluar' : '') + '">' + F.rupiah(r.selisih) + '</b></div></div></div>';

  h += '<div class="card"><h2>Uang ke mana saja</h2>' + (r.perKategori.length ? r.perKategori.map(function (k) {
    return '<button type="button" class="bar-row" data-act="lihat-kategori" data-j="' + JK.KELUAR + '" data-v="' + esc(k.nama) + '">' +
      '<span class="lab"><span>' + esc(k.nama) + ' <small>' + Math.round(k.pct * 100) + '%</small></span><b class="num">' + F.rupiah(k.jumlah) + '</b></span>' +
      '<span class="track"><i class="k" style="width:' + Math.max(2, k.jumlah / maxK * 100) + '%"></i></span></button>';
  }).join('') : '<p class="muted">Belum ada pengeluaran di bulan ini.</p>') + '</div>';

  if (r.perKategoriMasuk.length) {
    h += '<div class="card"><h2>Sumber pemasukan</h2>' + r.perKategoriMasuk.map(function (k) {
      return '<button type="button" class="rowx tap" data-act="lihat-kategori" data-j="' + JK.MASUK + '" data-v="' + esc(k.nama) + '"><span>' + esc(k.nama) + '</span><b class="num c-masuk">' + F.rupiah(k.jumlah) + '</b>' + ICON_CHEV + '</button>';
    }).join('') + '</div>';
  }

  h += '<div class="card"><h2>6 bulan terakhir</h2><div class="legend"><span><i style="background:var(--masuk)"></i>Pemasukan</span><span><i style="background:var(--keluar)"></i>Pengeluaran</span></div>' +
    tr.map(function (x) {
      return '<div class="trend-row"><span class="m">' + F.labelBulanPendek(x.ym) + '</span><span class="bars">' +
        '<span class="track"><i class="m" style="width:' + (x.masuk / maxT * 100) + '%"></i></span>' +
        '<span class="track"><i class="k" style="width:' + (x.keluar / maxT * 100) + '%"></i></span></span>' +
        '<span class="v num"><span class="c-masuk">' + F.rupiah(x.masuk) + '</span><br><span class="c-keluar">' + F.rupiah(x.keluar) + '</span></span></div>';
    }).join('') + '</div>';
  $('sumBody').innerHTML = h;
}

// ---------------------------------------------------------------------------
// Pengaturan

function waktuLalu(ms) {
  if (!ms) return 'belum pernah';
  const d = Math.round((Date.now() - ms) / 60000);
  if (d < 1) return 'baru saja';
  if (d < 60) return d + ' menit lalu';
  const j = Math.round(d / 60);
  if (j < 24) return j + ' jam lalu';
  return Math.round(j / 24) + ' hari lalu';
}

function listNamed(kind, items) {
  const v = view();
  return items.map(function (it) {
    const sub = kind === 'dompet'
      ? 'Saldo awal ' + F.rupiah(it.saldo_awal || 0)
      : C.jumlahPemakaian(v.transaksi, 'kategori', it.nama) + ' transaksi';
    return '<button type="button" class="list-item' + (it.aktif === false ? ' off' : '') + '" data-act="' + kind + '-edit" data-v="' + esc(it.nama) + '">' +
      '<span class="grow"><span>' + esc(it.nama) + '</span>' + (it.aktif === false ? '<span class="badge">nonaktif</span>' : '') + '<small>' + sub + '</small></span>' + ICON_CHEV + '</button>';
  }).join('');
}

function renderPengaturan() {
  const v = view();
  let h = '';
  if (st.mode === 'google') {
    const u = st.user || {};
    const initial = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
    h += '<h2 class="section-title">Akun &amp; spreadsheet</h2><div class="list">' +
      '<div class="list-item"><span class="avatar">' + esc(initial) + '</span><span class="grow"><span>' + esc(u.name || 'Akun Google') + '</span><small>' + esc(u.email || '') + '</small></span></div>' +
      '<div class="list-item"><span class="grow"><span>' + esc(st.sheet && st.sheet.title || CONFIG.SPREADSHEET_TITLE) + '</span><small>Sinkron terakhir: ' + waktuLalu(st.lastSync || (st.snap && st.snap.fetchedAt)) + (st.queue.length ? ', ' + st.queue.length + ' belum terkirim' : '') + '</small></span></div>' +
      (st.sheet && st.sheet.url ? '<a class="list-item" href="' + esc(st.sheet.url) + '" target="_blank" rel="noopener"><span class="grow"><span>Buka di Google Sheets</span><small>Lihat, olah, atau tambah data langsung di spreadsheet</small></span>' + ICON_CHEV + '</a>' : '') +
      '<button type="button" class="list-item" data-act="' + (st.needAuth ? 'sambung' : 'sinkron') + '"><span class="grow"><span>' + (st.needAuth ? 'Sambungkan lagi' : 'Sinkron sekarang') + '</span><small>' + (st.needAuth ? 'Sesi Google habis setelah 1 jam. Ketuk untuk menyambung.' : 'Ambil perubahan terbaru dari spreadsheet') + '</small></span>' + ICON_CHEV + '</button>' +
      '<button type="button" class="list-item" data-act="ganti-sheet"><span class="grow"><span>Ganti spreadsheet</span><small>Pilih spreadsheet lain atau buat baru</small></span>' + ICON_CHEV + '</button></div>';
    if (st.sheetLost) {
      h += '<div class="note-box">' + esc(st.syncError) + '<div><button type="button" class="link" data-act="ganti-sheet">Cari atau buat spreadsheet</button></div></div>';
    }
    if (v.invalid.length) {
      h += '<div class="note-box"><b>' + v.invalid.length + ' baris di spreadsheet tidak terbaca</b> dan tidak dihitung. Perbaiki langsung di Google Sheets:<ul>' +
        v.invalid.slice(0, 8).map(function (x) { return '<li>' + esc(x.sheet) + ' baris ' + x.row + ': ' + esc(x.reason) + '</li>'; }).join('') +
        (v.invalid.length > 8 ? '<li>dan ' + (v.invalid.length - 8) + ' lainnya</li>' : '') + '</ul></div>';
    }
  } else {
    h += '<h2 class="section-title">Mode demo</h2><div class="list">' +
      '<div class="list-item"><span class="grow"><span>Data hanya tersimpan di perangkat ini</span><small>Masuk dengan Google untuk menyimpan ke spreadsheet milikmu sendiri.</small></span></div>' +
      (G.configured() ? '<button type="button" class="list-item" data-act="hubungkan"><span class="grow"><span>Masuk dengan Google</span><small>Data demo tidak ikut dipindahkan</small></span>' + ICON_CHEV + '</button>' : '') +
      '<button type="button" class="list-item" data-act="keluar-demo"><span class="grow"><span>Keluar dari mode demo</span><small>Data demo dihapus dari perangkat ini</small></span>' + ICON_CHEV + '</button></div>';
  }

  h += '<h2 class="section-title">Dompet</h2><div class="list">' + listNamed('dompet', v.dompet) +
    '<button type="button" class="list-item add" data-act="dompet-baru"><span class="grow">+ Tambah dompet</span></button>' +
    (v.dompet.length ? '<button type="button" class="list-item" data-act="setup-saldo"><span class="grow"><span>Isi saldo semua dompet</span><small>Samakan saldo di aplikasi dengan saldo aslimu</small></span>' + ICON_CHEV + '</button>' : '') + '</div>';

  h += '<h2 class="section-title">Kategori pengeluaran</h2><div class="list">' +
    listNamed('kategori', v.kategori.filter(function (k) { return k.jenis === JK.KELUAR; })) +
    '<button type="button" class="list-item add" data-act="kategori-baru" data-v="' + JK.KELUAR + '"><span class="grow">+ Tambah kategori pengeluaran</span></button></div>';
  h += '<h2 class="section-title">Kategori pemasukan</h2><div class="list">' +
    listNamed('kategori', v.kategori.filter(function (k) { return k.jenis === JK.MASUK; })) +
    '<button type="button" class="list-item add" data-act="kategori-baru" data-v="' + JK.MASUK + '"><span class="grow">+ Tambah kategori pemasukan</span></button></div>';

  h += '<h2 class="section-title">Tampilan</h2><div class="themes">' + THEMES.map(function (t) {
    return '<button type="button" class="theme-opt" data-act="tema" data-v="' + t[0] + '" aria-pressed="' + (prefs.tema === t[0]) + '">' +
      '<span class="swatch">' + t[2].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' + t[1] + '</button>';
  }).join('') + '</div>';
  h += '<div class="label" style="margin-top:1rem">Ukuran teks</div><div class="seg">' + TEKS.map(function (t) {
    return '<button type="button" data-act="teks" data-v="' + t[0] + '" aria-pressed="' + (prefs.teks === t[0]) + '">' + t[1] + '</button>';
  }).join('') + '</div>';

  const contoh = v.transaksi.filter(function (t) { return String(t.id).indexOf(S.CONTOH_PREFIX) === 0; }).length;
  if (contoh) {
    h += '<h2 class="section-title">Data contoh</h2><div class="list"><button type="button" class="list-item" data-act="hapus-contoh"><span class="grow"><span>Hapus data contoh</span><small>' + contoh + ' transaksi contoh. Dompet dan kategori tetap ada.</small></span>' + ICON_CHEV + '</button></div>';
  }

  h += '<h2 class="section-title">Aplikasi</h2><div class="list">';
  if (swMenunggu) h += '<button type="button" class="list-item" data-act="pakai-update"><span class="grow"><span><b>Versi baru siap</b></span><small>Ketuk untuk memakainya sekarang. Halaman dimuat ulang sebentar.</small></span>' + ICON_CHEV + '</button>';
  if (st.installEvt) h += '<button type="button" class="list-item" data-act="pasang"><span class="grow"><span>Pasang di layar utama</span><small>Buka seperti aplikasi biasa</small></span>' + ICON_CHEV + '</button>';
  else if (!standalone()) h += '<div class="list-item"><span class="grow"><span>Pasang di layar utama</span><small>' + (isIOS() ? 'Safari: ketuk Bagikan, lalu Tambah ke Layar Utama.' : 'Chrome: menu ⋮, lalu Instal aplikasi atau Tambahkan ke layar utama.') + '</small></span></div>';
  h += '<div class="list-item"><span class="grow"><span>Versi ' + esc(CONFIG.APP_VERSION) + '</span><small>Format spreadsheet versi ' + S.SCHEMA_VERSION + '</small></span></div>';
  if (CONFIG.REPO_URL) h += '<a class="list-item" href="' + esc(CONFIG.REPO_URL) + '" target="_blank" rel="noopener"><span class="grow"><span>Kode sumber</span><small>Gratis dan terbuka (open source)</small></span>' + ICON_CHEV + '</a>';
  if (st.mode === 'google') h += '<button type="button" class="list-item" data-act="keluar"><span class="grow"><span class="c-keluar">Keluar dari akun Google</span><small>Data tetap aman di spreadsheet</small></span></button>';
  h += '</div>';
  $('setBody').innerHTML = h;
}

function standalone() {
  try { if (window.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* abaikan */ }
  return navigator.standalone === true;
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// ---------------------------------------------------------------------------
// Lembar: form dompet/kategori, konfirmasi, catatan migrasi

let sheetCtx = null;
let sheetOpener = null;     // elemen yang punya fokus sebelum lembar dibuka, untuk dikembalikan saat ditutup
let sheetEntry = false;     // ada entri riwayat browser untuk lembar yang terbuka (supaya tombol Back menutup lembar)
let sheetBackTimer = null, skipPop = false;

function focusEl(el) {
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { /* abaikan */ } }
}

function openSheet(html, ctx) {
  const wasOpen = !$('overlay').hidden;
  sheetCtx = ctx || {};
  if (!wasOpen) sheetOpener = document.activeElement;
  const box = $('sheetBox');
  box.innerHTML = html;
  const judul = box.querySelector('h2');
  if (judul) { judul.id = 'sheetJudul'; box.setAttribute('aria-labelledby', 'sheetJudul'); } else box.removeAttribute('aria-labelledby');
  box.setAttribute('tabindex', '-1');
  box.scrollTop = 0;
  $('overlay').hidden = false;
  document.documentElement.classList.add('sheet-open');
  hideToast();

  // Tombol Back di HP menutup lembar, bukan keluar dari aplikasi.
  clearTimeout(sheetBackTimer);
  if (!sheetEntry) { try { history.pushState({ kemanaLembar: 1 }, ''); sheetEntry = true; } catch (e) { /* abaikan */ } }

  // Fokus langsung (bukan lewat timer) supaya keyboard layar ikut muncul di iOS. Lembar tanpa isian
  // (konfirmasi) memfokuskan lembarnya sendiri supaya pembaca layar membaca judulnya.
  const first = box.querySelector('input:not([type="hidden"]), button');
  if (first && ctx && ctx.focus !== false) focusEl(first); else focusEl(box);
}

function closeSheet(result, dariBack) {
  const wasOpen = !$('overlay').hidden;
  $('overlay').hidden = true;
  $('sheetBox').innerHTML = '';
  document.documentElement.classList.remove('sheet-open');
  const c = sheetCtx;
  sheetCtx = null;
  if (dariBack) sheetEntry = false;
  else if (sheetEntry) {
    // Entri riwayat dilepas setelah jeda singkat; kalau lembar lain langsung dibuka, entrinya dipakai ulang.
    clearTimeout(sheetBackTimer);
    sheetBackTimer = setTimeout(function () {
      if (sheetEntry && $('overlay').hidden) { sheetEntry = false; skipPop = true; try { history.back(); } catch (e) { skipPop = false; } }
    }, 0);
  }
  if (wasOpen && sheetOpener && document.body.contains(sheetOpener) && !sheetOpener.disabled) focusEl(sheetOpener);
  if (wasOpen) sheetOpener = null;
  if (c && c.resolve) c.resolve(result);
}

// Tombol Kembali di layar utama: sekali = pesan, dua kali dalam 2 detik = keluar. Di bawah entri riwayat
// "penjaga" ditaruh satu lapis; setiap Kembali menghabiskan lapisnya, lalu lapis baru dipasang lagi.
let keluarSiap = false, keluarTimer = null, penjagaAda = false;

function pasangPenjaga() {
  try { history.pushState({ kemanaJaga: 1 }, ''); penjagaAda = true; } catch (e) { penjagaAda = false; }
}

function mulaiPenjagaKembali() {
  try { history.replaceState({ kemanaAwal: 1 }, ''); } catch (e) { return; }
  pasangPenjaga();
}

function kembaliDiLayarUtama() {
  if (keluarSiap) {
    // Kembali kedua: lepaskan, biarkan browser keluar dari aplikasi (atau ke halaman sebelumnya).
    clearTimeout(keluarTimer); keluarSiap = false; penjagaAda = false;
    try { history.back(); } catch (e) { /* abaikan */ }
    return;
  }
  pasangPenjaga();
  if (!penjagaAda) return;
  if (!$('shell').hidden && st.tab !== 'catat') { switchTab('catat'); return; }   // dari tab lain: pulang ke Catat dulu
  keluarSiap = true;
  clearTimeout(keluarTimer);
  keluarTimer = setTimeout(function () { keluarSiap = false; }, 2000);
  toast('Tekan Kembali sekali lagi untuk keluar', null, null, 2000);
}

window.addEventListener('popstate', function () {
  if (skipPop) { skipPop = false; return; }
  if (sheetEntry) { sheetEntry = false; if (!$('overlay').hidden) closeSheet(false, true); return; }
  kembaliDiLayarUtama();
});

/** Tab / Shift+Tab berputar di dalam lembar (papan ketik, pembaca layar), tidak lari ke halaman di belakangnya. */
function trapTab(ev) {
  const box = $('sheetBox');
  const list = Array.prototype.filter.call(
    box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'),
    function (e) { return e.offsetParent !== null; });
  if (!list.length) { ev.preventDefault(); focusEl(box); return; }
  const first = list[0], last = list[list.length - 1], cur = document.activeElement;
  if (!box.contains(cur) || (cur === box && !ev.shiftKey)) { ev.preventDefault(); focusEl(ev.shiftKey ? last : first); }
  else if (ev.shiftKey && (cur === first || cur === box)) { ev.preventDefault(); focusEl(last); }
  else if (!ev.shiftKey && cur === last) { ev.preventDefault(); focusEl(first); }
}

function confirmBox(o) {
  return new Promise(function (resolve) {
    openSheet('<h2>' + esc(o.title) + '</h2>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<div class="actions"><button type="button" class="btn" data-act="tutup">Batal</button>' +
      '<button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-act="ok">' + esc(o.ok || 'Ya') + '</button></div>',
      { resolve: resolve, focus: false });
  });
}

function showNotes(notes) {
  openSheet('<h2>Spreadsheet diperbarui</h2><p>Aplikasi menyesuaikan spreadsheet dengan format versi ' + S.SCHEMA_VERSION + ':</p>' +
    '<div class="note-box"><ul>' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' +
    '<div class="actions"><button type="button" class="btn primary" data-act="tutup">Mengerti</button></div>', { focus: false });
}

function openDompet(nama) {
  const v = view();
  const d = nama ? v.dompet.filter(function (x) { return x.nama === nama; })[0] : null;
  const used = d ? C.jumlahPemakaian(v.transaksi, 'dompet', d.nama) : 0;
  openSheet('<h2>' + (d ? 'Ubah dompet' : 'Tambah dompet') + '</h2>' +
    '<label class="field"><div class="label">Nama</div><input class="input" id="fNama" maxlength="40" autocomplete="off" value="' + esc(d ? d.nama : '') + '" placeholder="Misalnya: Tunai, BCA, GoPay"></label>' +
    '<label class="field"><div class="label">Saldo awal</div><input class="input num" id="fSaldo" data-rp inputmode="numeric" autocomplete="off" value="' + (d && d.saldo_awal ? F.ribuan(d.saldo_awal) : '') + '" placeholder="0">' +
    '<div class="hint">Isi saldo sebelum transaksi pertama di dompet ini kamu catat.</div></label>' +
    (d ? '<label class="switch"><span>Tampilkan di pilihan dompet</span><input type="checkbox" id="fAktif"' + (d.aktif !== false ? ' checked' : '') + '></label>' : '') +
    (used ? '<p class="warn-line">Dipakai di ' + used + ' transaksi, jadi tidak bisa dihapus. Matikan pilihan di atas untuk menyembunyikannya. Mengganti nama ikut mengganti nama di transaksi tersebut.</p>' : '') +
    '<div class="actions">' + (d && !used ? '<button type="button" class="btn danger" data-act="dompet-hapus">Hapus</button>' : '') +
    '<button type="button" class="btn" data-act="tutup">Batal</button><button type="button" class="btn primary" data-act="dompet-simpan">Simpan</button></div>',
    { kind: 'dompet', nama: d ? d.nama : null });
}

function openKategori(nama, jenis) {
  const v = view();
  const k = nama ? v.kategori.filter(function (x) { return x.nama === nama; })[0] : null;
  const used = k ? C.jumlahPemakaian(v.transaksi, 'kategori', k.nama) : 0;
  const j = k ? k.jenis : (jenis === JK.MASUK ? JK.MASUK : JK.KELUAR);
  openSheet('<h2>' + (k ? 'Ubah kategori' : 'Tambah kategori') + '</h2>' +
    '<label class="field"><div class="label">Nama</div><input class="input" id="fNama" maxlength="40" autocomplete="off" value="' + esc(k ? k.nama : '') + '" placeholder="Misalnya: Jajan anak"></label>' +
    '<div class="field"><div class="label">Jenis</div><div class="seg" id="fJenis">' +
    '<button type="button" data-act="kat-jenis" data-v="' + JK.KELUAR + '" aria-pressed="' + (j === JK.KELUAR) + '">Pengeluaran</button>' +
    '<button type="button" data-act="kat-jenis" data-v="' + JK.MASUK + '" aria-pressed="' + (j === JK.MASUK) + '">Pemasukan</button></div></div>' +
    (k ? '<label class="switch"><span>Tampilkan di pilihan kategori</span><input type="checkbox" id="fAktif"' + (k.aktif !== false ? ' checked' : '') + '></label>' : '') +
    (used ? '<p class="warn-line">Dipakai di ' + used + ' transaksi, jadi tidak bisa dihapus. Matikan pilihan di atas untuk menyembunyikannya. Mengganti nama ikut mengganti nama di transaksi tersebut.</p>' : '') +
    '<div class="actions">' + (k && !used ? '<button type="button" class="btn danger" data-act="kategori-hapus">Hapus</button>' : '') +
    '<button type="button" class="btn" data-act="tutup">Batal</button><button type="button" class="btn primary" data-act="kategori-simpan">Simpan</button></div>',
    { kind: 'kategori', nama: k ? k.nama : null, jenis: j });
}

function namaDipakai(list, nama, kecuali) {
  const n = nama.toLowerCase();
  return list.some(function (x) { return x.nama.toLowerCase() === n && x.nama !== kecuali; });
}

function simpanNamed(kind) {
  const ctx = sheetCtx;
  const nama = $('fNama').value.trim().replace(/\s+/g, ' ');
  const list = view()[kind];
  if (!nama) { toast('Nama belum diisi.'); return; }
  if (namaDipakai(list, nama, ctx.nama)) { toast('Nama «' + nama + '» sudah ada.'); return; }
  const item = { nama: nama };
  if (kind === 'dompet') item.saldo_awal = F.parseNumberText($('fSaldo').value || '0') || 0;
  else item.jenis = ctx.jenis;
  if ($('fAktif')) item.aktif = $('fAktif').checked;
  else if (!ctx.nama) item.aktif = true;
  const old = ctx.nama;

  const local = function () {
    if (!old) { st.snap[kind].push(Object.assign({ _row: st.snap[kind].length + 2 }, item)); return; }
    const cur = st.snap[kind].filter(function (x) { return x.nama === old; })[0];
    Object.assign(cur, item);
    if (nama !== old) {
      st.snap.transaksi.forEach(function (t) {
        if (kind === 'dompet') { if (t.dompet === old) t.dompet = nama; if (t.ke_dompet === old) t.ke_dompet = nama; }
        else if (t.kategori === old) t.kategori = nama;
      });
    }
  };
  const remote = function (c) { return old ? SH.updateNamed(c, kind, old, item) : SH.addNamed(c, kind, item); };
  const btn = document.querySelector('[data-act="' + kind + '-simpan"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
  withSheet(remote, local).then(function (ok) {
    if (!ok) { if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; } return; }
    if (old && nama !== old) {
      if (kind === 'dompet') { if (st.form.dompet === old) st.form.dompet = nama; if (st.form.ke === old) st.form.ke = nama; if (prefs.dompet === old) { prefs.dompet = nama; savePrefs(); } }
      else if (st.form.kategori === old) st.form.kategori = nama;
    }
    if (kind === 'kategori' && !old && st.tab === 'catat' && st.form.jenis === item.jenis) st.form.kategori = nama;
    if (kind === 'dompet' && !old && st.tab === 'catat' && !st.form.dompet) st.form.dompet = nama;
    closeSheet();
    renderAll();
    toast(old ? 'Perubahan disimpan.' : (kind === 'dompet' ? 'Dompet' : 'Kategori') + ' «' + nama + '» ditambahkan.');
  });
}

function hapusNamed(kind) {
  const nama = sheetCtx && sheetCtx.nama;
  if (!nama) return;
  const local = function () { st.snap[kind] = st.snap[kind].filter(function (x) { return x.nama !== nama; }); };
  withSheet(function (c) { return SH.deleteNamed(c, kind, nama); }, local).then(function (ok) {
    if (!ok) return;
    closeSheet();
    toast('«' + nama + '» dihapus.');
  });
}

// ---------------------------------------------------------------------------
// Cocokkan saldo & isi saldo awal

function openSaldo(nama) {
  const v = view();
  const d = C.saldoPerDompet(v.dompet, v.transaksi).filter(function (x) { return x.nama === nama; })[0];
  if (!d) return;
  openSheet('<h2>' + esc(nama) + '</h2><p>Menurut catatan: <b class="num">' + F.rupiah(d.saldo) + '</b></p>' +
    '<label class="field"><div class="label">Saldo sebenarnya sekarang</div><input class="input num" id="fAsli" data-rp inputmode="numeric" autocomplete="off" placeholder="Cek dompet / aplikasi bank"></label>' +
    '<div class="hint" id="selisihInfo">Kalau berbeda, selisihnya dicatat sebagai «' + esc(S.KATEGORI_SELISIH) + '» supaya saldo kembali sama.</div>' +
    '<div class="actions"><button type="button" class="btn" data-act="lihat-dompet" data-v="' + esc(nama) + '">Lihat transaksi</button>' +
    '<button type="button" class="btn primary" data-act="cocokkan">Cocokkan</button></div>',
    { kind: 'saldo', nama: nama, saldo: d.saldo });
}

function infoSelisih() {
  const c = sheetCtx, el = $('selisihInfo'), inp = $('fAsli');
  if (!c || !el || !inp) return;
  if (!inp.value.trim()) { el.textContent = 'Kalau berbeda, selisihnya dicatat sebagai «' + S.KATEGORI_SELISIH + '» supaya saldo kembali sama.'; return; }
  const adj = C.penyesuaianSaldo(c.saldo, F.parseNumberText(inp.value) || 0);
  el.textContent = !adj ? 'Sudah sama dengan catatan.'
    : adj.jenis === JK.KELUAR ? 'Kurang ' + F.rupiah(adj.nominal) + ': dicatat sebagai pengeluaran «' + S.KATEGORI_SELISIH + '» hari ini.'
      : 'Lebih ' + F.rupiah(adj.nominal) + ': dicatat sebagai pemasukan «' + S.KATEGORI_SELISIH + '» hari ini.';
}

function cocokkan() {
  const c = sheetCtx;
  const inp = $('fAsli');
  if (!c || !inp) return;
  if (!inp.value.trim()) { toast('Isi saldo sebenarnya dulu.'); inp.focus(); return; }
  const asli = F.parseNumberText(inp.value) || 0;
  const adj = C.penyesuaianSaldo(c.saldo, asli);
  closeSheet(true);
  if (!adj) { toast('Saldo ' + c.nama + ' sudah cocok.'); return; }
  const item = {
    id: F.uid(), dicatat: F.nowStamp(), tanggal: F.todayISO(), jenis: adj.jenis, dompet: c.nama, ke_dompet: '',
    kategori: S.KATEGORI_SELISIH, nominal: adj.nominal,
    catatan: 'Cocokkan saldo: tercatat ' + F.rupiah(c.saldo) + ', sebenarnya ' + F.rupiah(asli)
  };
  commit({ t: 'add', item: item });
  toast('Saldo ' + c.nama + ' sekarang ' + F.rupiah(asli) + '.', 'Batalkan', function () { commit({ t: 'del', id: item.id }); });
}

function setupRow(r) {
  return '<div class="setup-row" data-old="' + esc(r.nama) + '">' +
    '<input class="input" maxlength="40" autocomplete="off" aria-label="Nama dompet" placeholder="Nama, misalnya BCA" value="' + esc(r.nama) + '">' +
    '<input class="input num" data-rp inputmode="numeric" autocomplete="off" aria-label="Saldo sekarang" placeholder="0" value="' + (r.sekarang > 0 ? F.ribuan(r.sekarang) : '') + '"></div>';
}

function openSetup(judul) {
  const v = view();
  const saldo = C.saldoPerDompet(v.dompet, v.transaksi);
  const rows = v.dompet.filter(function (d) { return d.aktif !== false; }).map(function (d) {
    const s = saldo.filter(function (x) { return x.nama === d.nama; })[0];
    return { nama: d.nama, sekarang: s ? s.saldo : 0 };
  });
  if (!rows.length) rows.push({ nama: '', sekarang: 0 });
  openSheet('<h2>' + esc(judul || 'Uangmu ada di mana saja?') + '</h2>' +
    '<p>Isi saldo tiap dompet <b>saat ini</b>, supaya angka di aplikasi sama dengan aslinya. Namanya boleh diganti, misalnya «Rekening Bank» jadi «BCA».</p>' +
    '<div class="setup-head"><span>Dompet</span><span>Saldo sekarang</span></div><div id="setupRows">' + rows.map(setupRow).join('') + '</div>' +
    '<button type="button" class="link" data-act="setup-tambah">+ Tambah dompet</button>' +
    '<div class="actions"><button type="button" class="btn" data-act="tutup">Nanti saja</button><button type="button" class="btn primary" data-act="setup-simpan">Simpan</button></div>',
    { kind: 'setup', focus: false });
}

function setupSimpan() {
  const v = view();
  const saldo = C.saldoPerDompet(v.dompet, v.transaksi);
  const rows = Array.prototype.map.call(document.querySelectorAll('#setupRows .setup-row'), function (el) {
    const ins = el.querySelectorAll('input');
    return { old: el.getAttribute('data-old') || '', nama: ins[0].value.trim().replace(/\s+/g, ' '), sekarang: F.parseNumberText(ins[1].value || '0') || 0 };
  });
  const ops = [], dipakai = {};
  v.dompet.forEach(function (d) { if (!rows.some(function (r) { return r.old === d.nama; })) dipakai[d.nama.toLowerCase()] = true; });
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.nama) { if (r.old) { toast('Nama dompet tidak boleh kosong.'); return; } continue; }
    const key = r.nama.toLowerCase();
    if (dipakai[key]) { toast('Nama «' + r.nama + '» dipakai lebih dari sekali.'); return; }
    dipakai[key] = true;
    if (r.old) {
      const d = v.dompet.filter(function (x) { return x.nama === r.old; })[0];
      const s = saldo.filter(function (x) { return x.nama === r.old; })[0];
      const arus = (s ? s.saldo : 0) - (Number(d.saldo_awal) || 0);
      const awal = r.sekarang - arus;
      if (r.nama !== r.old || awal !== (Number(d.saldo_awal) || 0)) ops.push({ old: r.old, item: { nama: r.nama, saldo_awal: awal } });
    } else {
      ops.push({ old: '', item: { nama: r.nama, saldo_awal: r.sekarang, aktif: true } });
    }
  }
  if (!ops.length) { closeSheet(true); toast('Tidak ada yang berubah.'); return; }
  const local = function () {
    ops.forEach(function (op) {
      if (!op.old) { st.snap.dompet.push(Object.assign({ _row: st.snap.dompet.length + 2 }, op.item)); return; }
      const cur = st.snap.dompet.filter(function (x) { return x.nama === op.old; })[0];
      Object.assign(cur, op.item);
      if (op.item.nama !== op.old) st.snap.transaksi.forEach(function (t) { if (t.dompet === op.old) t.dompet = op.item.nama; if (t.ke_dompet === op.old) t.ke_dompet = op.item.nama; });
    });
  };
  const remote = async function (c) {
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].old) await SH.updateNamed(c, 'dompet', ops[i].old, ops[i].item);
      else await SH.addNamed(c, 'dompet', ops[i].item);
    }
  };
  const btn = document.querySelector('[data-act="setup-simpan"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
  withSheet(remote, local).then(function (ok) {
    if (!ok) { if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; } return; }
    ops.forEach(function (op) {
      if (!op.old || op.item.nama === op.old) return;
      if (st.form.dompet === op.old) st.form.dompet = op.item.nama;
      if (st.form.ke === op.old) st.form.ke = op.item.nama;
      if (prefs.dompet === op.old) { prefs.dompet = op.item.nama; savePrefs(); }
    });
    closeSheet(true);
    renderAll();
    toast('Saldo dompet disimpan.');
  });
}

// ---------------------------------------------------------------------------
// Kabar & pembaruan (tombol lonceng)

function openKabar() {
  const dilihat = prefs.kabarDilihat || CONFIG.APP_VERSION;
  const baru = {};
  K.kabarBaru(dilihat).forEach(function (k) { baru[k.versi] = true; });
  let h = '<h2>Kabar Kemana</h2>';
  if (swMenunggu) {
    h += '<div class="kabar-baru"><p><b>Versi baru sudah siap.</b> Ketuk tombol di bawah untuk memakainya. Halaman dimuat ulang sebentar.</p>' +
      '<button type="button" class="btn primary block" data-act="pakai-update">Pakai sekarang</button></div>';
  } else {
    h += '<p>Kamu sudah memakai versi terbaru (' + esc(CONFIG.APP_VERSION) + ').</p>';
  }
  h += K.KABAR.map(function (k) {
    return '<div class="kabar-item"><h3>' + esc(k.judul) + (baru[k.versi] ? '<span class="tag-baru">Baru</span>' : '') + '</h3>' +
      '<small>Versi ' + esc(k.versi) + ' · ' + esc(k.tanggal) + '</small>' +
      '<ul>' + k.butir.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
  }).join('');
  h += '<div class="actions"><button type="button" class="btn" data-act="tutup">Tutup</button></div>';
  openSheet(h, { focus: false });
  prefs.kabarDilihat = K.KABAR[0].versi;
  savePrefs();
  renderBell();
}

// ---------------------------------------------------------------------------
// Baca nota (OCR di perangkat)

async function prosesNota(file) {
  if (file.type && !/^image\//.test(file.type)) { toast('Pilih gambar: foto nota atau screenshot.'); return; }
  let ocr;
  try { ocr = await import('./ocr.js'); } catch (e) { toast('Pembaca nota belum tersedia. Periksa koneksi lalu coba lagi.'); return; }
  let dibatalkan = false;
  openSheet('<div class="ocr-box"><div class="spinner" role="progressbar" aria-label="Memproses"></div>' +
    '<h2 id="ocrJudul">Menyiapkan…</h2><p id="ocrTeks">Foto diproses di HP-mu, tidak dikirim ke mana pun.</p></div>' +
    '<div class="actions"><button type="button" class="btn" data-act="nota-batal">Batal</button></div>',
    { focus: false, resolve: function (r) { if (r !== 'selesai') { dibatalkan = true; ocr.batal(); } } });
  const tahap = function (t) {
    if (!$('ocrJudul')) return;
    if (t === 'unduh') { $('ocrJudul').textContent = 'Menyiapkan pembaca nota'; $('ocrTeks').textContent = 'Sekali ini saja: mengunduh ±4 MB. Berikutnya langsung siap, juga tanpa internet.'; }
    else if (t === 'muat') { $('ocrJudul').textContent = 'Menyiapkan pembaca nota'; }
    else { $('ocrJudul').textContent = 'Membaca nota…'; $('ocrTeks').textContent = 'Biasanya beberapa detik. Foto diproses di HP-mu, tidak dikirim ke mana pun.'; }
  };
  try {
    const res = await ocr.baca(file, tahap);
    if (dibatalkan) return;
    closeSheet('selesai');
    terapkanNota(N.bacaNota(res.text, { hariIni: F.todayISO() }), res);
  } catch (e) {
    if (dibatalkan || e.batal) return;
    closeSheet('selesai');
    toast('Gagal membaca nota: ' + (e.message || e));
  }
}

function bukaPemilihNota(id) {
  const inp = $(id);
  inp.value = '';
  closeSheet(false);
  inp.click();   // masih di dalam ketukan pengguna, jadi diizinkan browser
}

function terapkanNota(r, res) {
  const f = st.form;
  if (!String(res.text || '').trim()) { toast('Tidak ada tulisan yang terbaca. Coba foto lebih dekat dan terang.'); return; }
  if (r.masuk && f.jenis === JK.KELUAR) { f.jenis = JK.MASUK; f.kategori = ''; }
  if (r.nominal) f.nominal = String(Math.round(r.nominal));
  if (r.tanggal) f.tanggal = r.tanggal;
  if (r.catatan && !$('catatan').value.trim()) { f.catatan = r.catatan; $('catatan').value = r.catatan; }
  if (f.jenis !== JK.TRANSFER && r.kategori && !f.kategori) {
    const k = view().kategori.filter(function (x) { return x.jenis === f.jenis && x.aktif !== false && x.nama.toLowerCase() === r.kategori.toLowerCase(); })[0];
    if (k) f.kategori = k.nama;
  }
  st.nota = { kandidat: r.kandidat || [] };
  renderCatat();
  const a = $('amount');
  a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash');
  if (r.nominal) {
    toast('Terbaca ' + F.rupiah(r.nominal) + (r.tanggal ? ', ' + F.labelTanggalPendek(r.tanggal) : '') + '. Cek dulu, lalu simpan.');
  } else {
    toast('Total belum terbaca' + (res.conf && res.conf < 50 ? ' (foto kurang jelas)' : '') + '. Ketik nominalnya, ya.');
  }
}

// ---------------------------------------------------------------------------
// Layar awal: masuk, pilih/buat spreadsheet

function renderScreen() {
  const s = st.screen;
  let h = '<div class="screen-in">';
  if (s.kind === 'welcome') {
    h += '<img class="logo" src="icons/icon-192.png" alt="">' +
      '<h1>' + esc(CONFIG.APP_NAME) + '</h1>' +
      '<p>Uangmu ke mana aja? Catat uang masuk dan keluar dalam hitungan detik. Datanya tersimpan di Google Sheets milikmu sendiri.</p>' +
      (s.error ? '<div class="err">' + esc(s.error) + '</div>' : '');
    if (G.configured()) {
      h += '<button type="button" class="btn primary big block" data-act="login"' + (G.ready() ? '' : ' disabled') + '>' + (G.ready() ? 'Masuk dengan Google' : 'Memuat…') + '</button>';
    } else {
      h += '<div class="note-box" style="margin-top:1.5rem">Login Google belum diatur oleh pemilik aplikasi (Client ID di <b>js/config.js</b> masih kosong). Kamu tetap bisa mencoba mode demo.</div>';
    }
    h += '<button type="button" class="btn big block" data-act="demo">Coba dulu tanpa akun</button>' +
      '<p class="fine">Aplikasi ini hanya bisa membuka file yang ia buat sendiri di Google Drive-mu. File lain tidak bisa dilihat.</p>';
  } else if (s.kind === 'loading') {
    h += '<div class="spinner" role="progressbar" aria-label="Memuat"></div><h2>' + esc(s.text) + '</h2>';
  } else if (s.kind === 'buat') {
    h += '<h2>Siapkan spreadsheet</h2><p>Aplikasi akan membuat spreadsheet «' + esc(CONFIG.SPREADSHEET_TITLE) + '» di Google Drive' +
      (st.user && st.user.email ? ' <b>' + esc(st.user.email) + '</b>' : '') + ', berisi daftar dompet dan kategori yang bisa kamu ubah kapan saja.</p>' +
      '<label class="check"><input type="checkbox" id="cbContoh" checked><span>Tambahkan contoh transaksi supaya bisa langsung dicoba. Bisa dihapus nanti dengan satu ketukan.</span></label>' +
      (s.error ? '<div class="err">' + esc(s.error) + '</div>' : '') +
      '<button type="button" class="btn primary big block" data-act="buat-sheet">Buat spreadsheet</button>' +
      (s.files && s.files.length ? '<button type="button" class="btn big block" data-act="kembali-pilih">Pilih spreadsheet yang sudah ada</button>' : '') +
      '<button type="button" class="btn big block" data-act="' + (st.sheet ? 'batal-setup' : 'ganti-akun') + '">' + (st.sheet ? 'Batal' : 'Pakai akun lain') + '</button>';
  } else if (s.kind === 'pilih') {
    h += '<h2>Pilih spreadsheet</h2><p>Ada ' + s.files.length + ' spreadsheet Kemana di Google Drive-mu.</p><div class="list file-list">' +
      s.files.map(function (f) {
        return '<button type="button" class="list-item" data-act="pilih-sheet" data-id="' + esc(f.id) + '"><span class="grow"><span>' + esc(f.name) + '</span><small>Diubah ' +
          esc(F.labelTanggalPendek(String(f.modifiedTime || '').slice(0, 10))) + (st.sheet && st.sheet.id === f.id ? ' (sedang dipakai)' : '') + '</small></span>' + ICON_CHEV + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn big block" data-act="ke-buat">Buat spreadsheet baru</button>' +
      (st.sheet ? '<button type="button" class="btn big block" data-act="batal-setup">Batal</button>' : '');
  } else if (s.kind === 'error') {
    h += '<h2>Ada kendala</h2><div class="err">' + esc(s.error) + '</div>' +
      '<button type="button" class="btn primary big block" data-act="' + (s.retry || 'ke-awal') + '">Coba lagi</button>' +
      '<button type="button" class="btn big block" data-act="ke-awal">Kembali ke awal</button>';
  }
  h += '</div>';
  $('screen').innerHTML = h;
}

function showScreen(s) {
  st.screen = s;
  document.body.setAttribute('data-view', 'screen');
  $('shell').hidden = true;
  $('screen').hidden = false;
  renderScreen();
  window.scrollTo(0, 0);
}

function login(select) {
  if (!G.ready()) { toast('Layanan Google masih dimuat. Coba lagi sebentar.'); return; }
  G.requestToken({ select: !!select }).then(function () {
    afterLogin({});
  }).catch(function (e) {
    if (st.screen) { st.screen.error = e.code === 'CANCEL' ? '' : e.message; renderScreen(); }
    else toast(e.message);
  });
}

async function afterLogin(opt) {
  showScreen({ kind: 'loading', text: 'Menghubungkan akun Google…' });
  try {
    const u = await SH.getUser();
    st.user = { email: u.emailAddress || '', name: u.displayName || '', photo: u.photoLink || '' };
    LS.set('ck.user', st.user);
    G.setEmail(st.user.email);
    showScreen({ kind: 'loading', text: 'Mencari spreadsheet…' });
    const files = await SH.findSpreadsheets();
    if (files.length === 1 && !opt.pilih) await connectTo(files[0]);
    else if (files.length) showScreen({ kind: 'pilih', files: files });
    else showScreen({ kind: 'buat', files: [] });
  } catch (e) {
    showScreen({ kind: 'error', error: e.message, retry: 'ulang-login' });
  }
}

async function connectTo(file) {
  const switching = st.sheet && st.sheet.id !== file.id;
  if (switching) { st.queue = []; saveQueue(); }
  st.mode = 'google';
  st.sheet = { id: file.id, url: file.webViewLink || file.url || '', title: file.name || file.title || CONFIG.SPREADSHEET_TITLE };
  LS.set('ck.mode', st.mode);
  LS.set('ck.sheet', st.sheet);
  if (switching || !st.snap) st.snap = null;
  showScreen({ kind: 'loading', text: 'Membaca spreadsheet…' });
  try {
    st.syncing = true;
    await doSync();
    st.syncing = false;
    st.needAuth = false; st.sheetLost = false; st.syncError = '';
    st.form = blankForm();
    st.tab = 'catat';
    showApp();
  } catch (e) {
    st.syncing = false;
    showScreen({ kind: 'error', error: e.message, retry: 'ulang-login' });
  }
}

async function buatSheet() {
  const contoh = $('cbContoh') ? $('cbContoh').checked : true;
  const files = st.screen && st.screen.files;
  showScreen({ kind: 'loading', text: 'Membuat spreadsheet…' });
  try {
    let tz = 'Asia/Jakarta';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* abaikan */ }
    const r = await SH.createSpreadsheet({ title: CONFIG.SPREADSHEET_TITLE, contoh: contoh, today: F.todayISO(), stamp: F.nowStamp(), timeZone: tz });
    await connectTo({ id: r.id, url: r.url, name: r.title });
    if (!st.screen) {
      if (contoh) toast('Spreadsheet siap. Selamat mencatat!');
      else openSetup('Spreadsheet siap. Uangmu ada di mana saja?');
    }
  } catch (e) {
    showScreen({ kind: 'buat', files: files, error: e.message });
  }
}

function startDemo() {
  st.mode = 'demo';
  LS.set('ck.mode', 'demo');
  st.snap = LS.get('ck.snap.demo', null);
  if (!st.snap) {
    const d = S.dataAwal({ contoh: true, today: F.todayISO(), stamp: F.nowStamp() });
    st.snap = {
      transaksi: d.transaksi.map(function (t, i) { return Object.assign({ _row: i + 2 }, t); }),
      dompet: d.dompet, kategori: d.kategori, info: S.readInfo(d.info), invalid: [], fetchedAt: Date.now()
    };
    saveSnap();
  }
  st.form = blankForm();
  st.tab = 'catat';
  showApp();
}

function resetToWelcome() {
  ['ck.mode', 'ck.sheet', 'ck.user', 'ck.snap.google', 'ck.queue'].forEach(LS.del);
  st.mode = null; st.sheet = null; st.user = null; st.snap = null; st.queue = []; st.ctx = null;
  st.needAuth = false; st.sheetLost = false; st.syncError = ''; st.edit = null;
  invalidate();
  showScreen({ kind: 'welcome' });
  if (G.configured()) G.loadGis().then(function () { if (st.screen && st.screen.kind === 'welcome') renderScreen(); }).catch(function () {});
}

// ---------------------------------------------------------------------------
// Aksi (event delegation)

const ACT = {
  tab: function (el) {
    const t = el.getAttribute('data-tab');
    if (st.edit && t !== 'catat') { st.edit = null; st.form = blankForm(); }
    if (t === 'riwayat') { st.filterKategori = ''; st.filterDompet = ''; }
    switchTab(t);
  },
  jenis: function (el) {
    const j = el.getAttribute('data-v');
    if (j === st.form.jenis) return;
    st.form.jenis = j;
    st.form.kategori = '';
    renderCatat();
  },
  kategori: function (el) { st.form.kategori = el.getAttribute('data-v'); renderCatat(); },
  dompet: function (el) { st.form.dompet = el.getAttribute('data-v'); if (st.form.ke === st.form.dompet) st.form.ke = ''; renderCatat(); },
  ke: function (el) { st.form.ke = el.getAttribute('data-v'); renderCatat(); },
  key: function (el) {
    if (el.getAttribute('data-k') === 'del' && heldClear) { heldClear = false; return; }
    press(el.getAttribute('data-k'));
  },
  simpan: simpan,
  'batal-edit': function () { st.edit = null; st.form = blankForm(); switchTab('riwayat'); },
  'hapus-trx': hapusTrx,
  trx: function (el) { openEdit(el.getAttribute('data-id')); },
  bulan: function (el) {
    st.bulan = F.addMonths(st.bulan, Number(el.getAttribute('data-d')));
    st.limit = LIMIT;
    renderAll();
  },
  filter: function (el) { st.filterJenis = el.getAttribute('data-v'); st.limit = LIMIT; renderRiwayat(); },
  more: function () { st.limit += LIMIT; renderRiwayatList(); },
  'lihat-kategori': function (el) {
    st.filterKategori = el.getAttribute('data-v'); st.filterDompet = ''; st.cari = '';
    st.filterJenis = el.getAttribute('data-j') || JK.KELUAR; st.limit = LIMIT; switchTab('riwayat');
  },
  'lihat-dompet': function (el) {
    const n = el.getAttribute('data-v');
    closeSheet(false);
    st.filterDompet = n; st.filterKategori = ''; st.cari = ''; st.filterJenis = ''; st.limit = LIMIT; switchTab('riwayat');
  },
  'hapus-filter': function () { st.filterKategori = ''; st.filterDompet = ''; st.limit = LIMIT; renderRiwayat(); },
  'dompet-saldo': function (el) { openSaldo(el.getAttribute('data-v')); },
  cocokkan: cocokkan,
  'setup-saldo': function () { openSetup(); },
  'setup-tambah': function () {
    const box = $('setupRows');
    box.insertAdjacentHTML('beforeend', setupRow({ nama: '', sekarang: 0 }));
    const inp = box.lastElementChild.querySelector('input');
    if (inp) inp.focus();
  },
  'setup-simpan': setupSimpan,
  cepat: function (el) { simpanCepat(Number(el.getAttribute('data-i'))); },
  nota: function () {
    if (!window.Worker || typeof WebAssembly !== 'object') { toast('Browser ini belum bisa membaca nota. Coba Chrome, Edge, atau Safari terbaru.'); return; }
    // iPhone sudah menawarkan "Ambil Foto" dan "Pustaka Foto" sendiri. Android langsung membuka galeri,
    // jadi di sana pilihannya ditampilkan dulu.
    if (isIOS()) { $('notaFile').value = ''; $('notaFile').click(); return; }
    openSheet('<div class="pilih-nota"><h2>Isi dari nota</h2><p>Foto dibaca di HP-mu, tidak dikirim ke mana pun.</p>' +
      '<button type="button" class="btn primary block big" data-act="nota-foto">Ambil foto nota</button>' +
      '<button type="button" class="btn block big" data-act="nota-galeri">Pilih dari galeri</button></div>' +
      '<div class="actions"><button type="button" class="btn" data-act="tutup">Batal</button></div>', { focus: false });
  },
  'nota-foto': function () { bukaPemilihNota('notaFoto'); },
  'nota-galeri': function () { bukaPemilihNota('notaFile'); },
  kabar: openKabar,
  'nota-pilih': function (el) { st.form.nominal = el.getAttribute('data-v'); renderAmount(); },
  'nota-batal': function () { closeSheet(false); },
  status: function () {
    if (st.mode === 'demo' || st.sheetLost) { switchTab('pengaturan'); return; }
    if (st.needAuth) { ACT.sambung(); return; }
    sync();
  },
  sambung: function () {
    st.authDeclined = false;
    if (!G.ready()) { toast('Layanan Google masih dimuat. Coba lagi sebentar.'); G.loadGis().catch(function (e) { toast(e.message); }); return; }
    G.requestToken().then(function () { st.needAuth = false; sync(); }).catch(function (e) { if (e.code !== 'CANCEL') toast(e.message); });
  },
  sinkron: function () { sync(); },
  'dompet-baru': function () { openDompet(null); },
  'dompet-edit': function (el) { openDompet(el.getAttribute('data-v')); },
  'dompet-simpan': function () { simpanNamed('dompet'); },
  'dompet-hapus': function () { hapusNamed('dompet'); },
  'kategori-baru': function (el) { openKategori(null, el.getAttribute('data-v')); },
  'kategori-edit': function (el) { openKategori(el.getAttribute('data-v')); },
  'kategori-simpan': function () { simpanNamed('kategori'); },
  'kategori-hapus': function () { hapusNamed('kategori'); },
  'kat-jenis': function (el) {
    sheetCtx.jenis = el.getAttribute('data-v');
    document.querySelectorAll('#fJenis button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === sheetCtx.jenis); });
  },
  tutup: function () { closeSheet(false); },
  ok: function () { closeSheet(true); },
  tema: function (el) { prefs.tema = el.getAttribute('data-v'); savePrefs(); applyTheme(); renderPengaturan(); },
  teks: function (el) { prefs.teks = el.getAttribute('data-v'); savePrefs(); applyTheme(); renderPengaturan(); },
  'hapus-contoh': function () {
    const ids = view().transaksi.filter(function (t) { return String(t.id).indexOf(S.CONTOH_PREFIX) === 0; }).map(function (t) { return t.id; });
    confirmBox({ title: 'Hapus ' + ids.length + ' transaksi contoh?', text: 'Transaksi buatanmu sendiri tidak ikut terhapus.', ok: 'Hapus', danger: true }).then(function (ok) {
      if (!ok) return;
      st.queue = st.queue.filter(function (op) { const id = op.t === 'add' ? op.item.id : op.id; return ids.indexOf(id) < 0; });
      saveQueue();
      withSheet(function (c) { return SH.deleteTransaksi(c, ids); }, function () {
        st.snap.transaksi = st.snap.transaksi.filter(function (t) { return ids.indexOf(t.id) < 0; });
      }).then(function (ok2) {
        if (!ok2) return;
        openSetup('Sekarang isi saldo aslimu');
        toast('Data contoh dihapus.');
      });
    });
  },
  login: function () { login(false); },
  'ganti-akun': function () { login(true); },
  'ulang-login': function () {
    if (G.validToken()) afterLogin({});
    else resetToWelcome();
  },
  demo: startDemo,
  hubungkan: function () {
    if (!G.ready()) { toast('Layanan Google masih dimuat. Coba lagi sebentar.'); G.loadGis().catch(function () {}); return; }
    G.requestToken({ select: true }).then(function () { afterLogin({}); }).catch(function (e) { if (e.code !== 'CANCEL') toast(e.message); });
  },
  'pilih-sheet': function (el) {
    const id = el.getAttribute('data-id');
    const f = (st.screen.files || []).filter(function (x) { return x.id === id; })[0];
    if (f) connectTo(f);
  },
  'ke-buat': function () { showScreen({ kind: 'buat', files: st.screen.files }); },
  'kembali-pilih': function () { showScreen({ kind: 'pilih', files: st.screen.files }); },
  'buat-sheet': buatSheet,
  'batal-setup': function () { showApp(); },
  'ke-awal': function () { if (st.mode === 'google' && st.sheet) showApp(); else resetToWelcome(); },
  'ganti-sheet': function () {
    const go = function () {
      const t = G.validToken() ? Promise.resolve() : G.requestToken();
      t.then(function () { afterLogin({ pilih: true }); }).catch(function (e) { if (e.code !== 'CANCEL') toast(e.message); });
    };
    if (!G.ready() && !G.validToken()) { toast('Layanan Google masih dimuat. Coba lagi sebentar.'); return; }
    if (st.queue.length) {
      confirmBox({ title: 'Ganti spreadsheet?', text: st.queue.length + ' catatan belum terkirim ke spreadsheet ini dan akan hilang.', ok: 'Tetap ganti', danger: true })
        .then(function (ok) { if (ok) go(); });
    } else go();
  },
  keluar: function () {
    const n = st.queue.length;
    confirmBox({
      title: 'Keluar dari akun Google?',
      text: n ? n + ' catatan belum terkirim ke spreadsheet dan akan hilang.' : 'Data tetap aman di Google Sheets. Kamu bisa masuk lagi kapan saja.',
      ok: 'Keluar', danger: true
    }).then(function (ok) { if (ok) { G.logout(); resetToWelcome(); } });
  },
  'keluar-demo': function () {
    confirmBox({ title: 'Keluar dari mode demo?', text: 'Data demo di perangkat ini akan dihapus.', ok: 'Keluar', danger: true }).then(function (ok) {
      if (!ok) return;
      LS.del('ck.snap.demo');
      resetToWelcome();
    });
  },
  'pakai-update': pakaiVersiBaru,
  pasang: function () {
    if (!st.installEvt) return;
    st.installEvt.prompt();
    st.installEvt = null;
    renderPengaturan();
  }
};

document.addEventListener('click', function (ev) {
  const el = ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!el || el.disabled) return;
  if (el.closest('#overlay') === null && !$('overlay').hidden) return;
  const fn = ACT[el.getAttribute('data-act')];
  if (fn) fn(el, ev);
});
$('overlay').addEventListener('click', function (ev) {
  if (ev.target !== $('overlay')) return;
  if (sheetCtx && sheetCtx.dirty) {
    // Ada isian yang belum disimpan: ketukan nyasar di luar lembar tidak boleh membuangnya.
    const b = $('sheetBox');
    b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge');
    return;
  }
  closeSheet(false);
});
document.addEventListener('input', function (ev) {
  if (sheetCtx && ev.target && ev.target.closest && ev.target.closest('#sheetBox')) sheetCtx.dirty = true;
});
$('toastAction').addEventListener('click', function (ev) {
  ev.stopPropagation();
  const fn = toastFn;
  hideToast();
  if (fn) fn();
});
// Ketuk bagian pesan untuk menutup (berguna kalau pesannya menutupi sesuatu).
$('toast').addEventListener('click', hideToast);

// tahan tombol hapus = kosongkan nominal
let holdTimer = null, heldClear = false;
const ADA_POINTER = !!window.PointerEvent;
$('keypad').addEventListener(ADA_POINTER ? 'pointerdown' : 'touchstart', function (ev) {
  const b = ev.target.closest('[data-k="del"]');
  if (!b) return;
  heldClear = false;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(function () { heldClear = true; st.form.nominal = ''; renderAmount(); getar(15); }, 450);
}, ADA_POINTER ? undefined : { passive: true });
(ADA_POINTER ? ['pointerup', 'pointerleave', 'pointercancel'] : ['touchend', 'touchcancel', 'touchmove']).forEach(function (t) {
  $('keypad').addEventListener(t, function () { clearTimeout(holdTimer); }, { passive: true });
});

['notaFile', 'notaFoto'].forEach(function (id) {
  $(id).addEventListener('change', function () { const f = this.files && this.files[0]; if (f) prosesNota(f); });
});

document.addEventListener('input', function (ev) {
  if (ev.target && ev.target.id === 'fAsli') infoSelisih();
});

$('dateInput').addEventListener('change', function () { st.form.tanggal = this.value || F.todayISO(); renderCatat(); });
$('dateInput').addEventListener('click', function () { try { if (this.showPicker) this.showPicker(); } catch (e) { /* abaikan */ } });
$('catatan').addEventListener('input', function () { st.form.catatan = this.value; });
$('catatan').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); this.blur(); } });

let cariTimer = null;
$('cari').addEventListener('input', function () {
  const v = this.value;
  clearTimeout(cariTimer);
  cariTimer = setTimeout(function () { st.cari = v.trim(); st.limit = LIMIT; renderRiwayatList(); }, 150);
});

document.addEventListener('input', function (ev) {
  const t = ev.target;
  if (!t || !t.hasAttribute || !t.hasAttribute('data-rp')) return;
  const n = Number(String(t.value).replace(/\D/g, '')) || 0;
  t.value = n ? F.ribuan(n) : '';
});

document.addEventListener('keydown', function (ev) {
  if (!$('overlay').hidden) {
    if (ev.key === 'Escape') closeSheet(false);
    if (ev.key === 'Tab') trapTab(ev);
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && sheetCtx && sheetCtx.kind) {
      ev.preventDefault();
      if (sheetCtx.kind === 'saldo') cocokkan();
      else if (sheetCtx.kind === 'setup') setupSimpan();
      else simpanNamed(sheetCtx.kind);
    }
    return;
  }
  if ($('shell').hidden || st.tab !== 'catat') return;
  const tag = (ev.target && ev.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (tag === 'BUTTON' && (ev.key === 'Enter' || ev.key === ' ')) return;
  if (/^[0-9]$/.test(ev.key)) { press(ev.key); ev.preventDefault(); }
  else if (ev.key === 'Backspace') { press('del'); ev.preventDefault(); }
  else if (ev.key === 'Enter') { simpan(); ev.preventDefault(); }
});

const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (darkMq && darkMq.addEventListener) darkMq.addEventListener('change', function () { if (prefs.tema === 'otomatis') applyTheme(); });

document.addEventListener('visibilitychange', function () {
  if (document.hidden) return;
  if (!st.edit && !st.form.nominal && st.form.tanggal !== F.todayISO()) { st.form.tanggal = F.todayISO(); }
  if (st.mode === 'google' && G.validToken() && Date.now() - st.lastSync > 30000) sync();
  else renderAll();
});
window.addEventListener('online', function () { st.offline = false; if (st.mode === 'google') sync(); });
window.addEventListener('offline', function () { st.offline = true; renderStatus(); });
window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); st.installEvt = ev; if (st.tab === 'pengaturan') renderPengaturan(); });

// ---------------------------------------------------------------------------
// Mulai

function boot() {
  applyTheme();
  if (prefs.versi && prefs.versi !== CONFIG.APP_VERSION) setTimeout(function () { toast('Aplikasi diperbarui ke versi ' + CONFIG.APP_VERSION + '.'); }, 800);
  // Pengguna baru tidak perlu diberi titik "ada kabar" untuk riwayat sebelum dia memakai aplikasi.
  if (!prefs.kabarDilihat) { prefs.kabarDilihat = prefs.versi || CONFIG.APP_VERSION; savePrefs(); }
  if (prefs.versi !== CONFIG.APP_VERSION) { prefs.versi = CONFIG.APP_VERSION; savePrefs(); }

  let wantDemo = false;
  try { wantDemo = new URLSearchParams(location.search).has('demo'); } catch (e) { /* abaikan */ }

  if (st.mode === 'demo' || (!st.mode && wantDemo)) {
    startDemo();
  } else if (st.mode === 'google' && st.sheet) {
    st.snap = LS.get('ck.snap.google', null);
    showApp();
    G.loadGis().catch(function () { /* offline: tetap bisa mencatat */ });
    if (G.validToken()) sync();
    else { st.needAuth = true; renderStatus(); }
  } else if (st.mode === 'google' && G.validToken()) {
    G.loadGis().catch(function () {});
    afterLogin({});
  } else {
    resetToWelcome();
  }

  daftarkanSW();
}

/**
 * Service worker: aplikasi tetap terbuka tanpa sinyal. Versi baru disiapkan di latar belakang dan
 * ditawarkan lewat pesan ("Pakai sekarang"); tidak dimuat ulang diam-diam supaya isian tidak hilang.
 */
let swMenunggu = null, swDiminta = false;   // versi baru yang sudah diunduh dan menunggu dipakai

function pakaiVersiBaru() {
  if (!swMenunggu) return;
  swDiminta = true;
  swMenunggu.postMessage('skip');
}

function daftarkanSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (swDiminta) location.reload(); });
  function tawarkan(w) {
    swMenunggu = w;
    // Tawarannya menetap di lonceng dan di Pengaturan; pesan ini hanya mengabarkan sebentar.
    toast('Versi baru Kemana sudah siap.', 'Lihat', openKabar, 7000);
    renderBell();
    if (st.tab === 'pengaturan' && !$('shell').hidden) renderPengaturan();
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) tawarkan(reg.waiting);
      reg.addEventListener('updatefound', function () {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) tawarkan(w); });
      });
    }).catch(function () { /* abaikan */ });
  });
}

mulaiPenjagaKembali();
boot();
