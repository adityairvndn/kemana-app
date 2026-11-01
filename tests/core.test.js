// Jalankan: npm test  (atau: node --test tests/*.test.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/format.js';
import * as S from '../js/schema.js';
import * as C from '../js/compute.js';

test('format rupiah & angka Indonesia', () => {
  assert.equal(F.rupiah(2710919.11), 'Rp 2.710.919');
  assert.equal(F.rupiah(-25000), '−Rp 25.000');
  assert.equal(F.parseNumberText('Rp 25.000'), 25000);
  assert.equal(F.parseNumberText('25.000,50'), 25000.5);
  assert.equal(F.parseNumberText('1,234,567'), 1234567);
  assert.equal(F.parseNumberText('1,5'), 1.5);
  assert.ok(isNaN(F.parseNumberText('dua puluh')));
});

test('tanggal: seri Sheets, teks, label', () => {
  assert.equal(F.serialToISO(46326), '2026-10-31');
  assert.equal(F.isoToSerial('2026-10-31'), 46326);
  assert.equal(F.isoToSerial('2026-10-31 12:00:00'), 46326.5);
  assert.equal(F.parseDateText('31/10/2026'), '2026-10-31');
  assert.equal(F.parseDateText('1-2-26'), '2026-02-01');
  assert.equal(F.parseDateText('31/02/2026'), '');
  assert.equal(F.labelTanggal('2026-10-31', '2026-10-31'), 'Hari ini');
  assert.equal(F.labelTanggal('2026-10-30', '2026-10-31'), 'Kemarin');
  assert.equal(F.labelTanggal('2026-10-28', '2026-10-31'), 'Rabu, 28 Okt');
  assert.equal(F.addMonths('2026-01', -1), '2025-12');
  assert.equal(F.addMonths('2026-11', 2), '2027-01');
});

test('kolom dicocokkan dari judul, urutan bebas, kolom tambahan dibiarkan', () => {
  const header = ['Tanggal', 'NOMINAL', 'jenis', 'Dompet', 'Kategori', 'Catatan Saya', 'id', 'Keterangan', 'dompet_tujuan'];
  const m = S.mapColumns(S.SHEET.transaksi, header);
  assert.equal(m.idx.tanggal, 0);
  assert.equal(m.idx.nominal, 1);
  assert.equal(m.idx.id, 6);
  assert.equal(m.idx.catatan, 7, 'alias "Keterangan"');
  assert.equal(m.idx.ke_dompet, 8, 'alias "dompet_tujuan"');
  assert.deepEqual(m.missing.map(c => c.key), ['dicatat']);
  assert.deepEqual(m.extra.map(e => e.header), ['Catatan Saya']);
});

test('parseSheet: baris kosong dilewati, baris tidak sesuai pakem dilaporkan', () => {
  const values = [
    ['ID', 'Tanggal', 'Jenis', 'Dompet', 'Ke Dompet', 'Kategori', 'Nominal', 'Catatan', 'Dicatat', 'Milik Saya'],
    ['a1', 46326, 'Pengeluaran', 'Tunai', '', 'Makan', 25000, 'nasi', 46326.5, 'x'],
    [],
    ['', '31/10/2026', 'keluar', 'Tunai', '', 'Makan', 'Rp 15.000'],
    ['a3', 46326, 'Transfer', 'Bank', '', '', 100000],
    ['a4', 'kemarin', 'Pengeluaran', 'Tunai', '', '', 1000],
    ['a5', 46326, 'Pemasukan', 'Bank', '', 'Gaji', -5000000],
    ['a1', 46326, 'Pengeluaran', 'Tunai', '', '', 1]
  ];
  const r = S.parseSheet(S.SHEET.transaksi, values);
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].tanggal, '2026-10-31');
  assert.equal(r.items[0].dicatat, '2026-10-31 12:00:00');
  assert.equal(r.items[1].id, '', 'baris ketikan manual tanpa ID tetap terbaca');
  assert.equal(r.items[1].jenis, 'Pengeluaran', 'sinonim "keluar"');
  assert.equal(r.items[1].nominal, 15000);
  assert.equal(r.items[1]._row, 4);
  assert.equal(r.items[2].nominal, 5000000, 'nominal negatif dibaca sebagai nilai mutlak');
  assert.deepEqual(r.invalid.map(x => x.row), [5, 6, 8]);
  assert.match(r.invalid[0].reason, /Ke Dompet/);
  assert.match(r.invalid[2].reason, /ID ganda/);
});

test('serializeRow & cellUpdates mengikuti posisi kolom pengguna', () => {
  const header = ['Tanggal', 'Catatan Saya', 'Nominal', 'Jenis', 'Dompet', 'ID', 'Kategori', 'Catatan', 'Ke Dompet', 'Dicatat'];
  const m = S.mapColumns(S.SHEET.transaksi, header);
  const item = { id: 'x1', tanggal: '2026-10-31', jenis: 'Pengeluaran', dompet: 'Tunai', ke_dompet: '', kategori: 'Makan', nominal: 25000, catatan: '+62812 bayar', dicatat: '2026-10-31 10:00:00' };
  const row = S.serializeRow(S.SHEET.transaksi, m, item);
  assert.deepEqual(row, ['2026-10-31', '', 25000, 'Pengeluaran', 'Tunai', 'x1', 'Makan', "'+62812 bayar", '', '2026-10-31 10:00:00']);
  const up = S.cellUpdates('Transaksi', S.SHEET.transaksi, m, 7, { nominal: 30000, catatan: 'baru' });
  assert.deepEqual(up, [
    { range: "'Transaksi'!C7", values: [[30000]] },
    { range: "'Transaksi'!H7", values: [['baru']] }
  ]);
  assert.equal(S.colLetter(0), 'A');
  assert.equal(S.colLetter(25), 'Z');
  assert.equal(S.colLetter(27), 'AB');
});

test('rencana migrasi: spreadsheet baru tidak perlu apa-apa', () => {
  const headers = {};
  S.SHEETS.forEach(d => { headers[d.name] = d.columns.map(c => c.header); });
  const p = S.planMigration({ titles: S.SHEETS.map(d => d.name), headers, infoVersion: S.SCHEMA_VERSION });
  assert.equal(p.needed, false);
  assert.deepEqual(p.notes, []);
});

test('rencana migrasi: kolom & sheet yang hilang dibuat ulang, versi dicatat', () => {
  const headers = { Transaksi: ['ID', 'Tanggal', 'Jenis', 'Dompet', 'Kategori', 'Nominal', 'Catatan', 'Milik Saya'], Dompet: ['Nama', 'Saldo Awal', 'Aktif'] };
  const p = S.planMigration({ titles: ['Transaksi', 'dompet', 'Catatan Pribadi'], headers: { Transaksi: headers.Transaksi, dompet: headers.Dompet }, infoVersion: null });
  assert.equal(p.needed, true);
  assert.deepEqual(p.addSheets.map(d => d.name), ['Kategori', 'Info']);
  assert.equal(p.addColumns.length, 1);
  assert.equal(p.addColumns[0].sheet, 'Transaksi');
  assert.equal(p.addColumns[0].startIndex, 8, 'ditambahkan setelah kolom terakhir, termasuk kolom milik pengguna');
  assert.deepEqual(p.addColumns[0].columns.map(c => c.header), ['Ke Dompet', 'Dicatat']);
  assert.ok(p.notes.some(n => n.includes('Ke Dompet') && n.includes('dibuat ulang')));
  assert.equal(p.setVersion, true);
});

test('rencana migrasi: kolom dari versi lebih baru disebut "baru"', () => {
  const def = S.SHEET.transaksi;
  def.columns.push({ key: 'lampiran', header: 'Lampiran', type: 'text', since: S.SCHEMA_VERSION + 1 });
  try {
    const headers = {};
    S.SHEETS.forEach(d => { headers[d.name] = d.columns.filter(c => c.key !== 'lampiran').map(c => c.header); });
    const p = S.planMigration({ titles: S.SHEETS.map(d => d.name), headers, infoVersion: S.SCHEMA_VERSION });
    assert.deepEqual(p.notes, ['Kolom baru «Lampiran» di sheet «Transaksi».']);
  } finally {
    def.columns.pop();
  }
});

test('rencana migrasi: spreadsheet dari versi aplikasi lebih baru', () => {
  const headers = {};
  S.SHEETS.forEach(d => { headers[d.name] = d.columns.map(c => c.header); });
  const p = S.planMigration({ titles: S.SHEETS.map(d => d.name), headers, infoVersion: S.SCHEMA_VERSION + 1 });
  assert.equal(p.newerSpreadsheet, true);
  assert.equal(p.setVersion, false, 'jangan turunkan versi');
});

test('template & data contoh', () => {
  const d = S.dataAwal({ contoh: true, today: '2026-10-31', stamp: '2026-10-31 10:00:00' });
  assert.equal(d.dompet.length, 3);
  assert.ok(d.kategori.length >= 10);
  assert.ok(d.transaksi.length >= 10 && d.transaksi.every(t => t.id.startsWith(S.CONTOH_PREFIX)));
  const names = d.kategori.map(k => k.nama.toLowerCase());
  assert.equal(new Set(names).size, names.length, 'nama kategori unik');
  d.transaksi.forEach(t => {
    if (t.kategori) assert.ok(names.includes(t.kategori.toLowerCase()), t.kategori);
    assert.ok(S.DOMPET_AWAL.includes(t.dompet));
  });
  const t = S.templateSheets(d);
  assert.deepEqual(t.map(x => x.def.name), ['Transaksi', 'Dompet', 'Kategori', 'Info']);
  assert.deepEqual(S.toCellData(S.SHEET.transaksi.columns[1], '2026-10-31').userEnteredValue, { numberValue: 46326 });
  assert.equal(S.dataAwal({ contoh: false, today: '2026-10-31' }).transaksi.length, 0);
});

test('hitungan: saldo, ringkasan bulan, tren, riwayat', () => {
  const d = S.dataAwal({ contoh: true, today: '2026-10-31', stamp: '2026-10-31 10:00:00' });
  const saldo = C.saldoPerDompet(d.dompet, d.transaksi);
  const by = Object.fromEntries(saldo.map(x => [x.nama, x.saldo]));
  // Bank: +5jt +5jt -185rb -300rb(transfer) -250rb -200rb(transfer) -750rb -1,2jt
  assert.equal(by['Rekening Bank'], 10000000 - 185000 - 300000 - 250000 - 200000 - 750000 - 1200000 - 420000);
  assert.equal(by['Tunai'], 300000 - 25000 - 15000 - 2000 - 2000 - 15000);
  assert.ok(saldo.every(x => x.saldo > 0), 'saldo contoh tidak minus');
  assert.equal(by['E-Wallet'], 200000 - 18000 - 100000 - 50000);
  const total = C.totalSaldo(saldo);
  const masukAll = d.transaksi.filter(t => t.jenis === 'Pemasukan').reduce((a, t) => a + t.nominal, 0);
  const keluarAll = d.transaksi.filter(t => t.jenis === 'Pengeluaran').reduce((a, t) => a + t.nominal, 0);
  assert.equal(total, masukAll - keluarAll, 'transfer tidak mengubah total');

  const r = C.ringkasanBulan(d.transaksi, '2026-10');
  assert.equal(r.masuk, 5000000);
  assert.equal(r.keluar, 25000 + 18000 + 15000 + 185000 + 100000 + 250000 + 50000 + 2000 + 2000 + 15000);
  assert.equal(r.perKategori[0].nama, 'Tagihan & Listrik');
  assert.ok(Math.abs(r.perKategori.reduce((a, x) => a + x.pct, 0) - 1) < 1e-9);

  const tr = C.tren(d.transaksi, '2026-10', 3);
  assert.deepEqual(tr.map(x => x.ym), ['2026-08', '2026-09', '2026-10']);
  assert.equal(tr[1].masuk, 5000000);

  const list = C.riwayat(d.transaksi, { ym: '2026-10', q: 'kopi' });
  assert.equal(list.length, 2);
  assert.equal(C.riwayat(d.transaksi, { ym: '2026-10', jenis: 'Transfer' }).length, 2);
  const groups = C.kelompokTanggal(C.riwayat(d.transaksi, { ym: '2026-10' }));
  assert.equal(groups[0].tanggal, '2026-10-31');
  assert.equal(C.jumlahPemakaian(d.transaksi, 'dompet', 'Tunai'), 6, 'termasuk sebagai dompet tujuan transfer');
  assert.equal(C.jumlahPemakaian(d.transaksi, 'kategori', 'Gaji'), 2);
});
