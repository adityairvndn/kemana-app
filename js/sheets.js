// Operasi spreadsheet: cari, buat dari template, baca + migrasi, tulis.
// Semua lewat Google Sheets API v4 & Drive API v3 langsung dari browser (tanpa server).

import { api } from './google.js';
import * as S from './schema.js';
import { uid } from './format.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SS_MIME = 'application/vnd.google-apps.spreadsheet';

function qs(o) {
  return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
}

export async function getUser() {
  const r = await api(DRIVE_API + '/about?' + qs({ fields: 'user(displayName,emailAddress,photoLink)' }));
  return r.user || {};
}

/** Spreadsheet milik aplikasi ini di Drive pengguna (dari perangkat mana pun). */
export async function findSpreadsheets() {
  const q = "appProperties has { key='" + S.APP_PROPERTY + "' and value='1' } and trashed = false and mimeType = '" + SS_MIME + "'";
  const r = await api(DRIVE_API + '/files?' + qs({
    q: q, fields: 'files(id,name,modifiedTime,webViewLink)', orderBy: 'modifiedTime desc', pageSize: '20', spaces: 'drive'
  }));
  return r.files || [];
}

// ---------------------------------------------------------------------------
// Membuat spreadsheet baru dari template

function sheetSpec(def, items) {
  const rows = [{ values: def.columns.map(function (c) { return S.headerCellData(c.header); }) }];
  items.forEach(function (it) {
    rows.push({ values: def.columns.map(function (c) { return S.toCellData(c, it[c.key]); }) });
  });
  return {
    properties: {
      title: def.name,
      gridProperties: { frozenRowCount: 1, rowCount: Math.max(1000, items.length + 200), columnCount: Math.max(26, def.columns.length) }
    },
    data: [{
      startRow: 0, startColumn: 0, rowData: rows,
      columnMetadata: def.columns.map(function (c) { return { pixelSize: c.width || 120 }; })
    }]
  };
}

function colRange(sheetId, index) {
  return { sheetId: sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 };
}

/** Format angka, pilihan (dropdown), dan peringatan saat judul kolom diubah. */
export function formatRequests(sheetIds) {
  const req = [];
  S.SHEETS.forEach(function (def) {
    const id = sheetIds[def.key];
    if (id === undefined) return;
    def.columns.forEach(function (c, i) {
      if (c.format) {
        req.push({ repeatCell: {
          range: colRange(id, i),
          cell: { userEnteredFormat: { numberFormat: { type: c.type === 'money' ? 'NUMBER' : c.type === 'datetime' ? 'DATE_TIME' : 'DATE', pattern: c.format } } },
          fields: 'userEnteredFormat.numberFormat'
        } });
      }
      let rule = null;
      if (c.type === 'enum') rule = { condition: { type: 'ONE_OF_LIST', values: c.values.map(function (v) { return { userEnteredValue: v }; }) }, strict: true, showCustomUi: true };
      if (c.type === 'bool') rule = { condition: { type: 'BOOLEAN' }, strict: false };
      if (def.key === 'transaksi' && (c.key === 'dompet' || c.key === 'ke_dompet')) {
        rule = { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: "='Dompet'!$A$2:$A" }] }, strict: false, showCustomUi: true };
      }
      if (def.key === 'transaksi' && c.key === 'kategori') {
        rule = { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: "='Kategori'!$A$2:$A" }] }, strict: false, showCustomUi: true };
      }
      if (rule) req.push({ setDataValidation: { range: colRange(id, i), rule: rule } });
    });
    req.push({ addProtectedRange: { protectedRange: {
      range: def.key === 'info' ? { sheetId: id } : { sheetId: id, startRowIndex: 0, endRowIndex: 1 },
      description: def.key === 'info' ? 'Dipakai aplikasi Kemana' : 'Judul kolom dipakai aplikasi Kemana',
      warningOnly: true
    } } });
  });
  return req;
}

export async function createSpreadsheet(opt) {
  const data = S.dataAwal({ contoh: !!opt.contoh, today: opt.today, stamp: opt.stamp });
  const body = {
    properties: { title: opt.title, locale: 'id_ID', timeZone: opt.timeZone || 'Asia/Jakarta' },
    sheets: S.templateSheets(data).map(function (t) { return sheetSpec(t.def, t.items); })
  };
  const ss = await api(SHEETS_API, { method: 'POST', body: body });
  const id = ss.spreadsheetId;
  const props = {};
  props[S.APP_PROPERTY] = '1';
  await api(DRIVE_API + '/files/' + encodeURIComponent(id) + '?' + qs({ fields: 'id' }), {
    method: 'PATCH',
    body: { appProperties: props, description: 'Database aplikasi Kemana. Judul kolom (baris pertama) jangan diganti namanya.' }
  });
  const ids = {};
  (ss.sheets || []).forEach(function (sh) {
    const def = S.SHEETS.filter(function (d) { return d.name === sh.properties.title; })[0];
    if (def) ids[def.key] = sh.properties.sheetId;
  });
  try {
    await api(SHEETS_API + '/' + encodeURIComponent(id) + ':batchUpdate', { method: 'POST', body: { requests: formatRequests(ids) } });
  } catch (e) {
    // Format hanya pemanis; spreadsheet tetap bisa dipakai tanpa ini.
  }
  return { id: id, url: ss.spreadsheetUrl, title: opt.title };
}

// ---------------------------------------------------------------------------
// Membaca

async function loadMeta(id) {
  const fields = 'spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))';
  return api(SHEETS_API + '/' + encodeURIComponent(id) + '?' + qs({ fields: fields }));
}

async function readSheets(id, titles) {
  if (!titles.length) return {};
  const q = titles.map(function (t) { return 'ranges=' + encodeURIComponent(S.quoteSheet(t)); }).join('&') +
    '&' + qs({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
  const r = await api(SHEETS_API + '/' + encodeURIComponent(id) + '/values:batchGet?' + q);
  const out = {};
  (r.valueRanges || []).forEach(function (vr, i) { out[titles[i]] = vr.values || []; });
  return out;
}

function knownTitles(meta) {
  const titles = (meta.sheets || []).map(function (s) { return s.properties.title; });
  const known = [];
  S.SHEETS.forEach(function (def) { const t = S.findTitle(titles, def.name); if (t) known.push(t); });
  return { all: titles, known: known };
}

function buildCtx(id, meta, raw) {
  const t = knownTitles(meta);
  const ctx = { id: id, url: meta.spreadsheetUrl, title: meta.properties && meta.properties.title, sheets: {}, invalid: [] };
  S.SHEETS.forEach(function (def) {
    const title = S.findTitle(t.all, def.name);
    const props = (meta.sheets || []).filter(function (s) { return s.properties.title === title; })[0];
    const parsed = S.parseSheet(def, title ? raw[title] : []);
    ctx.sheets[def.key] = {
      title: title, sheetId: props ? props.properties.sheetId : null, raw: title ? raw[title] || [] : [],
      columnCount: props && props.properties.gridProperties ? props.properties.gridProperties.columnCount : 26,
      map: parsed.map, items: parsed.items, rowCount: (raw[title] || []).length
    };
    ctx.invalid = ctx.invalid.concat(parsed.invalid);
  });
  return ctx;
}

export function snapshotOf(ctx) {
  const info = S.readInfo(ctx.sheets.info.items);
  return {
    transaksi: ctx.sheets.transaksi.items,
    dompet: ctx.sheets.dompet.items,
    kategori: ctx.sheets.kategori.items,
    info: info,
    invalid: ctx.invalid,
    sheetUrl: ctx.url,
    sheetTitle: ctx.title,
    fetchedAt: Date.now()
  };
}

async function valuesBatchUpdate(id, data) {
  if (!data.length) return;
  await api(SHEETS_API + '/' + encodeURIComponent(id) + '/values:batchUpdate', {
    method: 'POST', body: { valueInputOption: 'USER_ENTERED', data: data }
  });
}

async function batchUpdate(id, requests) {
  if (!requests.length) return {};
  return api(SHEETS_API + '/' + encodeURIComponent(id) + ':batchUpdate', { method: 'POST', body: { requests: requests } });
}

async function appendRows(id, title, rows) {
  if (!rows.length) return;
  await api(SHEETS_API + '/' + encodeURIComponent(id) + '/values/' + encodeURIComponent(S.quoteSheet(title) + '!A1') + ':append?' +
    qs({ valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' }), {
    method: 'POST', body: { majorDimension: 'ROWS', values: rows }
  });
}

async function deleteRows(id, sheetId, rowNumbers) {
  const rows = rowNumbers.slice().sort(function (a, b) { return b - a; });
  await batchUpdate(id, rows.map(function (r) {
    return { deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r } } };
  }));
}

async function applyMigration(id, meta, plan, raw) {
  const t = knownTitles(meta);
  const requests = [];
  plan.addSheets.forEach(function (def) {
    requests.push({ addSheet: { properties: { title: def.name, gridProperties: { frozenRowCount: 1 } } } });
  });
  plan.addColumns.forEach(function (a) {
    const props = meta.sheets.filter(function (s) { return s.properties.title === a.sheet; })[0].properties;
    const need = a.startIndex + a.columns.length;
    const have = props.gridProperties ? props.gridProperties.columnCount : 26;
    if (need > have) requests.push({ appendDimension: { sheetId: props.sheetId, dimension: 'COLUMNS', length: need - have } });
  });
  await batchUpdate(id, requests);

  const data = [];
  const hariIni = new Date().toISOString().slice(0, 10);
  plan.addSheets.forEach(function (def) {
    const rows = [def.columns.map(function (c) { return c.header; })];
    if (def.key === 'info') {
      S.dataAwal({ today: hariIni }).info.forEach(function (it) { rows.push([it.kunci, it.nilai]); });
    }
    data.push({ range: S.quoteSheet(def.name) + '!A1', values: rows });
  });
  plan.addColumns.forEach(function (a) {
    const dataRows = Math.max(0, (raw[a.sheet] || []).length - 1);
    a.columns.forEach(function (col, k) {
      const letter = S.colLetter(a.startIndex + k);
      data.push({ range: S.quoteSheet(a.sheet) + '!' + letter + '1', values: [[col.header]] });
      if (col.def !== undefined && dataRows > 0) {
        const vals = [];
        for (let r = 0; r < dataRows; r++) vals.push([S.toCell(col, col.def)]);
        data.push({ range: S.quoteSheet(a.sheet) + '!' + letter + '2:' + letter + (dataRows + 1), values: vals });
      }
    });
  });
  // Catat versi format di sheet Info (kalau sheet Info sudah ada sebelumnya).
  const infoTitle = S.findTitle(t.all, 'Info');
  if (plan.setVersion && infoTitle) {
    const parsed = S.parseSheet(S.SHEET.info, raw[infoTitle]);
    const row = parsed.items.filter(function (it) { return it.kunci === S.INFO_VERSION_KEY; })[0];
    const m = parsed.map;
    if (row && m.idx.nilai !== undefined) {
      data.push({ range: S.quoteSheet(infoTitle) + '!' + S.colLetter(m.idx.nilai) + row._row, values: [[String(S.SCHEMA_VERSION)]] });
    } else {
      const n = (raw[infoTitle] || []).length + 1;
      const kc = m.idx.kunci !== undefined ? m.idx.kunci : 0, vc = m.idx.nilai !== undefined ? m.idx.nilai : 1;
      data.push({ range: S.quoteSheet(infoTitle) + '!' + S.colLetter(kc) + n, values: [[S.INFO_VERSION_KEY]] });
      data.push({ range: S.quoteSheet(infoTitle) + '!' + S.colLetter(vc) + n, values: [[String(S.SCHEMA_VERSION)]] });
    }
  }
  await valuesBatchUpdate(id, data);
}

/**
 * Baca seluruh spreadsheet, perbarui formatnya bila perlu, dan isi ID untuk baris yang diketik manual.
 * @returns {{ctx, snapshot, notes: string[], newer: boolean}}
 */
export async function connect(id) {
  let meta = await loadMeta(id);
  let t = knownTitles(meta);
  let raw = await readSheets(id, t.known);
  const infoTitle = S.findTitle(t.all, 'Info');
  const info = infoTitle ? S.readInfo(S.parseSheet(S.SHEET.info, raw[infoTitle]).items) : {};
  const headers = {};
  t.known.forEach(function (title) { headers[title] = (raw[title] || [])[0] || []; });
  const ver = info[S.INFO_VERSION_KEY];
  const plan = S.planMigration({ titles: t.all, headers: headers, infoVersion: ver === undefined || ver === '' ? null : Number(ver) });
  let notes = [];
  if (plan.needed) {
    await applyMigration(id, meta, plan, raw);
    notes = plan.notes;
    meta = await loadMeta(id);
    t = knownTitles(meta);
    raw = await readSheets(id, t.known);
  }
  const ctx = buildCtx(id, meta, raw);
  const tx = ctx.sheets.transaksi;
  const tanpaId = tx.items.filter(function (it) { return !it.id; });
  if (tanpaId.length && tx.map.idx.id !== undefined) {
    const data = [];
    tanpaId.forEach(function (it) {
      it.id = uid();
      data.push.apply(data, S.cellUpdates(tx.title, S.SHEET.transaksi, tx.map, it._row, { id: it.id }));
    });
    await valuesBatchUpdate(id, data);
  }
  return { ctx: ctx, snapshot: snapshotOf(ctx), notes: notes, newer: plan.newerSpreadsheet };
}

// ---------------------------------------------------------------------------
// Menulis transaksi (antrean dari perangkat)

/**
 * @param ops  [{t:'add', item} | {t:'upd', id, item} | {t:'del', id}]
 * Aman diulang: tambah dilewati bila ID sudah ada, ubah/hapus dilewati bila ID sudah tidak ada.
 */
export async function flush(ctx, ops) {
  const tx = ctx.sheets.transaksi;
  const byId = {};
  tx.items.forEach(function (it) { byId[it.id] = it; });
  const updates = [], delRows = [], adds = [], dropped = [];
  ops.forEach(function (op) {
    if (op.t === 'add') {
      if (!byId[op.item.id]) adds.push(S.serializeRow(S.SHEET.transaksi, tx.map, op.item));
    } else if (op.t === 'upd') {
      const cur = byId[op.id];
      if (!cur) dropped.push(op);
      else updates.push.apply(updates, S.cellUpdates(tx.title, S.SHEET.transaksi, tx.map, cur._row, op.item));
    } else if (op.t === 'del') {
      const cur = byId[op.id];
      if (cur && delRows.indexOf(cur._row) < 0) delRows.push(cur._row);
    }
  });
  await valuesBatchUpdate(ctx.id, updates);
  if (delRows.length) await deleteRows(ctx.id, tx.sheetId, delRows);
  await appendRows(ctx.id, tx.title, adds);
  return { dropped: dropped, written: updates.length + delRows.length + adds.length };
}

export async function deleteTransaksi(ctx, ids) {
  const tx = ctx.sheets.transaksi;
  const rows = tx.items.filter(function (it) { return ids.indexOf(it.id) >= 0; }).map(function (it) { return it._row; });
  if (rows.length) await deleteRows(ctx.id, tx.sheetId, rows);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Dompet & kategori (butuh koneksi, langsung ditulis)

function findNamed(ctx, key, nama) {
  const n = String(nama).toLowerCase();
  return ctx.sheets[key].items.filter(function (it) { return it.nama.toLowerCase() === n; })[0] || null;
}

export async function addNamed(ctx, key, item) {
  if (findNamed(ctx, key, item.nama)) throw new Error('Nama «' + item.nama + '» sudah ada.');
  const sh = ctx.sheets[key];
  await appendRows(ctx.id, sh.title, [S.serializeRow(S.SHEET[key], sh.map, item)]);
}

/** Ubah dompet/kategori. Kalau namanya diganti, transaksi yang memakai nama lama ikut diganti. */
export async function updateNamed(ctx, key, oldName, item) {
  const cur = findNamed(ctx, key, oldName);
  if (!cur) throw new Error('«' + oldName + '» tidak ditemukan di spreadsheet. Muat ulang lalu coba lagi.');
  if (item.nama && item.nama.toLowerCase() !== oldName.toLowerCase() && findNamed(ctx, key, item.nama)) {
    throw new Error('Nama «' + item.nama + '» sudah dipakai.');
  }
  const sh = ctx.sheets[key];
  const data = S.cellUpdates(sh.title, S.SHEET[key], sh.map, cur._row, item);
  let ikut = 0;
  if (item.nama && item.nama !== cur.nama) {
    // Semua baris transaksi (termasuk yang belum lolos pakem) ikut diganti namanya.
    const tx = ctx.sheets.transaksi;
    const fields = key === 'dompet' ? ['dompet', 'ke_dompet'] : ['kategori'];
    tx.raw.forEach(function (row, i) {
      if (i === 0) return;
      const ch = {};
      fields.forEach(function (f) {
        const c = tx.map.idx[f];
        if (c !== undefined && String(row[c] == null ? '' : row[c]).trim() === cur.nama) ch[f] = item.nama;
      });
      if (Object.keys(ch).length) { ikut++; data.push.apply(data, S.cellUpdates(tx.title, S.SHEET.transaksi, tx.map, i + 1, ch)); }
    });
  }
  await valuesBatchUpdate(ctx.id, data);
  return ikut;
}

export async function deleteNamed(ctx, key, nama) {
  const cur = findNamed(ctx, key, nama);
  if (!cur) return;
  await deleteRows(ctx.id, ctx.sheets[key].sheetId, [cur._row]);
}
