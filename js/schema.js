// Pakem spreadsheet Kemana.
//
// Aturan yang dipegang aplikasi:
// - Setiap sheet dikenali dari NAMA sheet, setiap kolom dari JUDUL kolom (baris pertama).
// - Urutan kolom bebas, judul tidak peka huruf besar/kecil, kolom tambahan milik pengguna dibiarkan.
// - Versi format disimpan di sheet Info (kunci "versi_skema").
//
// Menambah kolom/sheet di versi berikutnya:
//   1. Naikkan SCHEMA_VERSION.
//   2. Tambahkan kolom di SHEETS dengan `since: <versi baru>` (dan `def` kalau perlu nilai bawaan).
//   Aplikasi akan menambahkan kolom itu ke spreadsheet pengguna dan memberi tahu mereka.

import { parseDateText, serialToISO, serialToStamp, parseNumberText, addDays, isoToSerial } from './format.js';

export const SCHEMA_VERSION = 1;
export const APP_PROPERTY = 'kemana';   // penanda file di Google Drive (appProperties)
export const INFO_VERSION_KEY = 'versi_skema';

export const JENIS = { KELUAR: 'Pengeluaran', MASUK: 'Pemasukan', TRANSFER: 'Transfer' };

const SINONIM_JENIS = {
  pengeluaran: JENIS.KELUAR, keluar: JENIS.KELUAR, expense: JENIS.KELUAR, out: JENIS.KELUAR,
  pemasukan: JENIS.MASUK, masuk: JENIS.MASUK, income: JENIS.MASUK, in: JENIS.MASUK,
  transfer: JENIS.TRANSFER, pindah: JENIS.TRANSFER, 'pindah dana': JENIS.TRANSFER, mutasi: JENIS.TRANSFER
};

export const SHEETS = [
  {
    key: 'transaksi', name: 'Transaksi',
    columns: [
      { key: 'id', header: 'ID', type: 'id', since: 1, width: 110, hint: 'Diisi otomatis oleh aplikasi. Boleh kosong untuk baris yang kamu ketik sendiri.' },
      { key: 'tanggal', header: 'Tanggal', type: 'date', required: true, since: 1, width: 100, format: 'dd/mm/yyyy', hint: 'Tanggal transaksi.' },
      { key: 'jenis', header: 'Jenis', type: 'enum', values: [JENIS.KELUAR, JENIS.MASUK, JENIS.TRANSFER], required: true, since: 1, width: 110, hint: 'Pengeluaran, Pemasukan, atau Transfer.' },
      { key: 'dompet', header: 'Dompet', type: 'text', required: true, since: 1, width: 130, hint: 'Nama dompet (sesuai sheet Dompet). Untuk Transfer: dompet asal.' },
      { key: 'ke_dompet', header: 'Ke Dompet', type: 'text', aliases: ['tujuan', 'dompet tujuan'], since: 1, width: 130, hint: 'Hanya untuk Transfer: dompet tujuan.' },
      { key: 'kategori', header: 'Kategori', type: 'text', since: 1, width: 150, hint: 'Nama kategori (sesuai sheet Kategori). Kosong untuk Transfer.' },
      { key: 'nominal', header: 'Nominal', type: 'money', required: true, aliases: ['jumlah'], since: 1, width: 120, format: '#,##0', hint: 'Angka tanpa tanda minus.' },
      { key: 'catatan', header: 'Catatan', type: 'text', aliases: ['keterangan'], since: 1, width: 220, hint: 'Bebas.' },
      { key: 'dicatat', header: 'Dicatat', type: 'datetime', since: 1, width: 150, format: 'dd/mm/yyyy hh:mm', hint: 'Waktu dicatat, diisi otomatis.' }
    ]
  },
  {
    key: 'dompet', name: 'Dompet',
    columns: [
      { key: 'nama', header: 'Nama', type: 'text', required: true, since: 1, width: 160, hint: 'Nama unik, misalnya Tunai atau Rekening Bank.' },
      { key: 'saldo_awal', header: 'Saldo Awal', type: 'money', def: 0, since: 1, width: 120, format: '#,##0', hint: 'Saldo sebelum transaksi pertama dicatat.' },
      { key: 'aktif', header: 'Aktif', type: 'bool', def: true, since: 1, width: 70, hint: 'FALSE = disembunyikan dari pilihan, riwayat tetap ada.' }
    ]
  },
  {
    key: 'kategori', name: 'Kategori',
    columns: [
      { key: 'nama', header: 'Nama', type: 'text', required: true, since: 1, width: 170, hint: 'Nama unik.' },
      { key: 'jenis', header: 'Jenis', type: 'enum', values: [JENIS.KELUAR, JENIS.MASUK], def: JENIS.KELUAR, since: 1, width: 120, hint: 'Pengeluaran atau Pemasukan.' },
      { key: 'aktif', header: 'Aktif', type: 'bool', def: true, since: 1, width: 70, hint: 'FALSE = disembunyikan dari pilihan.' }
    ]
  },
  {
    key: 'info', name: 'Info',
    columns: [
      { key: 'kunci', header: 'Kunci', type: 'text', since: 1, width: 130, hint: 'Dipakai aplikasi. Jangan diubah.' },
      { key: 'nilai', header: 'Nilai', type: 'text', since: 1, width: 420, hint: '' }
    ]
  }
];

export const SHEET = {};
SHEETS.forEach(function (s) { SHEET[s.key] = s; });

// ---------------------------------------------------------------------------
// Judul kolom & alamat sel

export function normHeader(h) {
  return String(h == null ? '' : h).toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function colLetter(i) {
  let s = '';
  i = i + 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

export function quoteSheet(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

/** Cocokkan judul kolom di spreadsheet dengan pakem. */
export function mapColumns(def, headerRow) {
  headerRow = headerRow || [];
  const pos = {};
  headerRow.forEach(function (h, i) {
    const n = normHeader(h);
    if (n && pos[n] === undefined) pos[n] = i;
  });
  const idx = {}, missing = [];
  def.columns.forEach(function (col) {
    const names = [col.header].concat(col.aliases || []).map(normHeader);
    let found;
    for (let k = 0; k < names.length && found === undefined; k++) found = pos[names[k]];
    if (found === undefined) missing.push(col); else idx[col.key] = found;
  });
  const used = {};
  Object.keys(idx).forEach(function (k) { used[idx[k]] = true; });
  const extra = [];
  headerRow.forEach(function (h, i) { if (!used[i] && normHeader(h)) extra.push({ index: i, header: String(h) }); });
  return { idx: idx, missing: missing, extra: extra, width: headerRow.length };
}

/** Cari sheet berdasarkan nama (tidak peka huruf besar/kecil). */
export function findTitle(titles, name) {
  const n = name.toLowerCase();
  for (let i = 0; i < titles.length; i++) if (String(titles[i]).toLowerCase() === n) return titles[i];
  return null;
}

// ---------------------------------------------------------------------------
// Migrasi

/**
 * @param {object} p  { titles: string[], headers: { [sheetTitle]: any[] }, infoVersion: number|null }
 */
export function planMigration(p) {
  const titles = p.titles || [];
  const headers = p.headers || {};
  const from = p.infoVersion == null || isNaN(p.infoVersion) ? null : Number(p.infoVersion);
  const base = from == null ? SCHEMA_VERSION : from;
  const plan = {
    fromVersion: from, toVersion: SCHEMA_VERSION, newerSpreadsheet: from != null && from > SCHEMA_VERSION,
    addSheets: [], addColumns: [], setVersion: false, notes: [], needed: false
  };
  SHEETS.forEach(function (def) {
    const title = findTitle(titles, def.name);
    if (!title) {
      plan.addSheets.push(def);
      plan.notes.push('Sheet «' + def.name + '» ' + (def.columns[0].since > base ? 'baru' : 'tidak ditemukan, jadi dibuat ulang') + '.');
      return;
    }
    const row = headers[title] || [];
    const m = mapColumns(def, row);
    if (m.missing.length) {
      plan.addColumns.push({ sheet: title, def: def, startIndex: m.width, columns: m.missing });
      m.missing.forEach(function (col) {
        plan.notes.push(col.since > base
          ? 'Kolom baru «' + col.header + '» di sheet «' + title + '».'
          : 'Kolom «' + col.header + '» di sheet «' + title + '» tidak ditemukan, jadi dibuat ulang (kosong).');
      });
    }
  });
  if (!plan.newerSpreadsheet && (from == null || from < SCHEMA_VERSION)) plan.setVersion = true;
  plan.needed = plan.addSheets.length > 0 || plan.addColumns.length > 0 || plan.setVersion;
  return plan;
}

// ---------------------------------------------------------------------------
// Membaca & menulis sel

function isBlank(v) { return v === '' || v === null || v === undefined; }

export function parseCell(col, v) {
  switch (col.type) {
    case 'date':
      if (typeof v === 'number') return serialToISO(v);
      return parseDateText(v);
    case 'datetime':
      if (typeof v === 'number') return serialToStamp(v);
      return isBlank(v) ? '' : String(v).trim();
    case 'money': {
      if (isBlank(v)) return col.def !== undefined ? col.def : null;
      const n = typeof v === 'number' ? v : parseNumberText(v);
      return isNaN(n) ? null : n;
    }
    case 'bool': {
      if (isBlank(v)) return col.def !== undefined ? col.def : false;
      if (typeof v === 'boolean') return v;
      const s = String(v).trim().toLowerCase();
      if (['false', 'tidak', 'no', 'n', '0', 'nonaktif', 'salah'].indexOf(s) >= 0) return false;
      return true;
    }
    case 'enum': {
      if (isBlank(v)) return col.def !== undefined ? col.def : '';
      const s = normHeader(v);
      for (let i = 0; i < col.values.length; i++) if (normHeader(col.values[i]) === s) return col.values[i];
      const syn = SINONIM_JENIS[s];
      if (syn && col.values.indexOf(syn) >= 0) return syn;
      return String(v).trim();
    }
    default:
      return isBlank(v) ? '' : String(v).trim();
  }
}

export function toCell(col, v) {
  switch (col.type) {
    case 'money': return v == null || v === '' || isNaN(v) ? '' : Number(v);
    case 'bool': return v === false ? false : true;
    case 'date':
    case 'datetime': return v || '';
    default: {
      let s = v == null ? '' : String(v);
      // Cegah teks dibaca Sheets sebagai rumus/angka/tanggal (mis. "+62812…", "=…", "1/2").
      if (/^[=+\-@]/.test(s) || /^\d[\d.,\/\- :]*$/.test(s)) s = "'" + s;
      return s;
    }
  }
}

function validate(def, o) {
  if (def.key === 'transaksi') {
    if (!o.tanggal) return 'Tanggal kosong atau tidak terbaca';
    if ([JENIS.KELUAR, JENIS.MASUK, JENIS.TRANSFER].indexOf(o.jenis) < 0) return 'Jenis harus Pengeluaran, Pemasukan, atau Transfer';
    if (!o.dompet) return 'Dompet kosong';
    if (o.nominal == null || !(Math.abs(o.nominal) > 0)) return 'Nominal kosong atau bukan angka';
    if (o.jenis === JENIS.TRANSFER && !o.ke_dompet) return 'Transfer butuh kolom Ke Dompet';
    if (o.jenis === JENIS.TRANSFER && o.ke_dompet === o.dompet) return 'Dompet asal dan tujuan sama';
    return '';
  }
  if (def.key === 'dompet' || def.key === 'kategori') {
    if (!o.nama) return 'Nama kosong';
    if (def.key === 'kategori' && [JENIS.KELUAR, JENIS.MASUK].indexOf(o.jenis) < 0) return 'Jenis kategori harus Pengeluaran atau Pemasukan';
    return '';
  }
  return '';
}

/**
 * Ubah nilai mentah sheet (baris pertama = judul) menjadi daftar objek.
 * Baris kosong dilewati; baris yang tidak memenuhi pakem dicatat di `invalid` (tidak dihapus).
 */
export function parseSheet(def, values) {
  values = values || [];
  const header = values[0] || [];
  const map = mapColumns(def, header);
  const items = [], invalid = [];
  const seen = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    if (row.every(isBlank)) continue;
    const o = { _row: r + 1 };
    def.columns.forEach(function (col) {
      const i = map.idx[col.key];
      o[col.key] = parseCell(col, i === undefined ? undefined : row[i]);
    });
    if (def.key === 'info' && !o.kunci) continue;
    if (def.key === 'transaksi' && o.nominal != null) o.nominal = Math.abs(o.nominal);
    let err = validate(def, o);
    if (!err && (def.key === 'dompet' || def.key === 'kategori')) {
      const k = o.nama.toLowerCase();
      if (seen[k]) err = 'Nama ganda (sudah ada di baris ' + seen[k] + ')';
      else seen[k] = o._row;
    }
    if (!err && def.key === 'transaksi' && o.id) {
      if (seen[o.id]) err = 'ID ganda (sudah ada di baris ' + seen[o.id] + ')';
      else seen[o.id] = o._row;
    }
    if (err) invalid.push({ sheet: def.name, row: o._row, reason: err });
    else items.push(o);
  }
  return { header: header, map: map, items: items, invalid: invalid };
}

/** Satu baris sesuai posisi kolom di spreadsheet pengguna. Kolom milik pengguna diisi kosong. */
export function serializeRow(def, map, item) {
  const width = Math.max(map.width, 1 + Math.max.apply(null, Object.keys(map.idx).map(function (k) { return map.idx[k]; }).concat([-1])));
  const row = [];
  for (let i = 0; i < width; i++) row.push('');
  def.columns.forEach(function (col) {
    const i = map.idx[col.key];
    if (i !== undefined) row[i] = toCell(col, item[col.key]);
  });
  return row;
}

/** Update sel per kolom (bukan seluruh baris) supaya kolom milik pengguna tidak tersentuh. */
export function cellUpdates(sheetTitle, def, map, rowNumber, item, keys) {
  const data = [];
  def.columns.forEach(function (col) {
    if (keys && keys.indexOf(col.key) < 0) return;
    const i = map.idx[col.key];
    if (i === undefined || !(col.key in item)) return;
    data.push({ range: quoteSheet(sheetTitle) + '!' + colLetter(i) + rowNumber, values: [[toCell(col, item[col.key])]] });
  });
  return data;
}

export function readInfo(items) {
  const o = {};
  (items || []).forEach(function (it) { o[it.kunci] = it.nilai; });
  return o;
}

// ---------------------------------------------------------------------------
// Template spreadsheet baru

export const KATEGORI_AWAL = [
  ['Makan & Minum', JENIS.KELUAR], ['Belanja Harian', JENIS.KELUAR], ['Transportasi', JENIS.KELUAR],
  ['Tagihan & Listrik', JENIS.KELUAR], ['Pulsa & Internet', JENIS.KELUAR], ['Kesehatan', JENIS.KELUAR],
  ['Pendidikan', JENIS.KELUAR], ['Hiburan', JENIS.KELUAR], ['Sosial & Donasi', JENIS.KELUAR],
  ['Cicilan & Utang', JENIS.KELUAR], ['Lain-lain', JENIS.KELUAR],
  ['Gaji', JENIS.MASUK], ['Usaha & Freelance', JENIS.MASUK], ['Bonus & Hadiah', JENIS.MASUK], ['Pemasukan Lain', JENIS.MASUK]
];

export const DOMPET_AWAL = ['Tunai', 'Rekening Bank', 'E-Wallet'];

export const CONTOH_PREFIX = 'contoh-';

// Kategori khusus untuk hasil "Cocokkan saldo": uang yang berubah tanpa tercatat.
export const KATEGORI_SELISIH = 'Tidak tercatat';

/** Transaksi contoh, tanggalnya relatif terhadap hari ini supaya ringkasan langsung terisi. */
export function contohTransaksi(today, stamp) {
  const t = function (n, hariLalu, jenis, dompet, kategori, nominal, catatan, ke) {
    return {
      id: CONTOH_PREFIX + (n < 10 ? '0' : '') + n, tanggal: addDays(today, -hariLalu), jenis: jenis, dompet: dompet,
      ke_dompet: ke || '', kategori: kategori || '', nominal: nominal, catatan: 'Contoh: ' + catatan, dicatat: stamp
    };
  };
  const K = JENIS.KELUAR, M = JENIS.MASUK, T = JENIS.TRANSFER;
  return [
    t(1, 0, K, 'Tunai', 'Makan & Minum', 25000, 'makan siang'),
    t(2, 0, K, 'E-Wallet', 'Transportasi', 18000, 'ojek online'),
    t(3, 1, K, 'Tunai', 'Makan & Minum', 15000, 'kopi'),
    t(4, 2, K, 'Rekening Bank', 'Belanja Harian', 185000, 'belanja mingguan'),
    t(5, 3, K, 'E-Wallet', 'Pulsa & Internet', 100000, 'paket data'),
    t(6, 4, T, 'Rekening Bank', '', 300000, 'tarik tunai', 'Tunai'),
    t(7, 5, K, 'Rekening Bank', 'Tagihan & Listrik', 250000, 'token listrik'),
    t(8, 6, T, 'Rekening Bank', '', 200000, 'isi saldo', 'E-Wallet'),
    t(9, 7, M, 'Rekening Bank', 'Gaji', 5000000, 'gaji'),
    t(10, 9, K, 'E-Wallet', 'Hiburan', 50000, 'nonton'),
    t(11, 33, M, 'Rekening Bank', 'Gaji', 5000000, 'gaji bulan lalu'),
    t(12, 35, K, 'Rekening Bank', 'Belanja Harian', 750000, 'belanja bulanan'),
    t(13, 38, K, 'Rekening Bank', 'Makan & Minum', 420000, 'makan seminggu'),
    t(14, 40, K, 'Rekening Bank', 'Cicilan & Utang', 1200000, 'cicilan motor'),
    t(15, 2, K, 'Tunai', 'Transportasi', 2000, 'parkir'),
    t(16, 5, K, 'Tunai', 'Transportasi', 2000, 'parkir'),
    t(17, 3, K, 'Tunai', 'Makan & Minum', 15000, 'kopi')
  ];
}

export function dataAwal(opt) {
  const today = opt.today, stamp = opt.stamp;
  return {
    dompet: DOMPET_AWAL.map(function (n) { return { nama: n, saldo_awal: 0, aktif: true }; }),
    kategori: KATEGORI_AWAL.map(function (k) { return { nama: k[0], jenis: k[1], aktif: true }; }),
    transaksi: opt.contoh ? contohTransaksi(today, stamp) : [],
    info: [
      { kunci: 'aplikasi', nilai: 'Kemana' },
      { kunci: INFO_VERSION_KEY, nilai: String(SCHEMA_VERSION) },
      { kunci: 'dibuat', nilai: today },
      { kunci: 'petunjuk', nilai: 'Judul kolom (baris pertama) jangan diganti namanya. Urutan kolom bebas, boleh menambah kolom sendiri, menambah atau menghapus baris.' }
    ]
  };
}

/**
 * Sel untuk spreadsheets.create / updateCells. Berbeda dengan values.append, nilai di sini tidak
 * diurai Sheets, jadi tanggal dikirim sebagai nomor seri + format tanggal.
 */
export function toCellData(col, v) {
  switch (col.type) {
    case 'date':
      return v ? { userEnteredValue: { numberValue: isoToSerial(v) }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } } : {};
    case 'datetime':
      return v ? { userEnteredValue: { numberValue: isoToSerial(v) }, userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm' } } } : {};
    case 'money':
      return v == null || v === '' ? {} : { userEnteredValue: { numberValue: Number(v) }, userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } };
    case 'bool':
      return { userEnteredValue: { boolValue: v !== false } };
    default:
      return v == null || v === '' ? {} : { userEnteredValue: { stringValue: String(v) } };
  }
}

export function headerCellData(text) {
  return {
    userEnteredValue: { stringValue: text },
    userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.91, green: 0.94, blue: 0.98 } }
  };
}

/** Isi awal setiap sheet untuk spreadsheet baru: definisi + daftar baris (objek). */
export function templateSheets(data) {
  return SHEETS.map(function (def) { return { def: def, items: data[def.key] || [] }; });
}
