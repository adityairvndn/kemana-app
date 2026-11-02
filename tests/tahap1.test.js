import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../js/schema.js';
import * as C from '../js/compute.js';
import { bacaNota, angka, cariTanggal, tebakKategori } from '../js/nota.js';

const tx = (tanggal, jenis, dompet, kategori, nominal, catatan, ke) => ({ tanggal, jenis, dompet, kategori, nominal, catatan: catatan || '', ke_dompet: ke || '' });

test('catat cepat: hanya yang berulang, urut dari yang paling sering', () => {
  const list = [
    tx('2026-10-30', 'Pengeluaran', 'Tunai', 'Transportasi', 2000, 'parkir'),
    tx('2026-10-28', 'Pengeluaran', 'Tunai', 'Transportasi', 2000, 'parkir'),
    tx('2026-10-20', 'Pengeluaran', 'Tunai', 'Transportasi', 2000, ''),
    tx('2026-10-29', 'Pengeluaran', 'Tunai', 'Makan & Minum', 15000, 'kopi'),
    tx('2026-10-27', 'Pengeluaran', 'Tunai', 'Makan & Minum', 15000, 'es teh'),
    tx('2026-10-26', 'Pengeluaran', 'BCA', 'Belanja Harian', 50000, ''),
    tx('2026-07-01', 'Pengeluaran', 'BCA', 'Hiburan', 50000, ''),
    tx('2026-07-02', 'Pengeluaran', 'BCA', 'Hiburan', 50000, ''),
    tx('2026-10-25', 'Pemasukan', 'BCA', 'Gaji', 5000000, ''),
    tx('2026-09-25', 'Pemasukan', 'BCA', 'Gaji', 5000000, '')
  ];
  const s = C.seringDicatat(list, { jenis: 'Pengeluaran', hariIni: '2026-10-31' });
  assert.equal(s.length, 2, 'Belanja sekali & Hiburan lama tidak ikut');
  assert.deepEqual([s[0].kategori, s[0].nominal, s[0].kali, s[0].catatan], ['Transportasi', 2000, 3, 'parkir']);
  assert.equal(s[1].catatan, '', 'catatan berbeda-beda → tidak dipakai');
  assert.equal(C.seringDicatat(list, { jenis: 'Pemasukan', hariIni: '2026-10-31' })[0].kategori, 'Gaji');
  const contoh = S.dataAwal({ contoh: true, today: '2026-10-31', stamp: '' }).transaksi;
  assert.ok(C.seringDicatat(contoh, { jenis: 'Pengeluaran', hariIni: '2026-10-31' }).length >= 2, 'data contoh menampilkan catat cepat');
});

test('kategori diurutkan dari yang paling sering dipakai', () => {
  const list = [tx('2026-10-30', 'Pengeluaran', 'Tunai', 'C', 1), tx('2026-10-29', 'Pengeluaran', 'Tunai', 'C', 1), tx('2026-10-28', 'Pengeluaran', 'Tunai', 'B', 1), tx('2026-01-01', 'Pengeluaran', 'Tunai', 'A', 1)];
  const f = C.frekuensi(list, 'kategori', '2026-10-31');
  assert.deepEqual(C.urutSering(['A', 'B', 'C', 'D'], f), ['C', 'B', 'A', 'D']);
});

test('cocokkan saldo & filter kategori', () => {
  assert.deepEqual(C.penyesuaianSaldo(260000, 245000), { jenis: 'Pengeluaran', nominal: 15000 });
  assert.deepEqual(C.penyesuaianSaldo(260000, 300000), { jenis: 'Pemasukan', nominal: 40000 });
  assert.equal(C.penyesuaianSaldo(260000, 260000), null);
  const list = [tx('2026-10-30', 'Pengeluaran', 'Tunai', 'Makan & Minum', 1), tx('2026-10-30', 'Pengeluaran', 'Tunai', '', 1)];
  assert.equal(C.riwayat(list, { kategori: 'Makan & Minum' }).length, 1);
  assert.equal(C.riwayat(list, { kategori: 'Tanpa kategori' }).length, 1);
});

test('nota: angka, tanggal, kategori', () => {
  assert.equal(angka('47.900'), 47900);
  assert.equal(angka('Rp150.000'), 150000);
  assert.equal(angka('1.250.000,00'), 1250000);
  assert.equal(angka('75,900'), 75900);
  assert.equal(angka('30,919.11'), 30919);
  assert.equal(cariTanggal(['Tgl: 30/10/2026 20:15'], '2026-10-31'), '2026-10-30');
  assert.equal(cariTanggal(['28.10.26-19:42 2.1.05'], '2026-10-31'), '2026-10-28');
  assert.equal(cariTanggal(['31 Okt 2026, 14:22 WIB'], '2026-10-31'), '2026-10-31');
  assert.equal(cariTanggal(['Waktu 30 Oktober 2026 12:41'], '2026-10-31'), '2026-10-30');
  assert.equal(cariTanggal(['01/12/2026'], '2026-10-31'), '', 'tanggal di masa depan diabaikan');
  assert.equal(tebakKategori('SPBU 54.662.07\nPERTALITE'), 'Transportasi');
  assert.equal(tebakKategori('TOKO MAKMUR JAYA\nMIE GORENG'), 'Belanja Harian', 'nama toko lebih dulu daripada isi belanjaan');
});

// Teks hasil OCR (Tesseract, model ind) dari nota & screenshot contoh di tests/nota/.
const NOTA = {
  n1_minimarket_bersih: [47900, '2026-10-28', 'Toko Makmur Jaya', 'Belanja Harian'],
  n2_minimarket_foto: [47900, '2026-10-28', 'Toko Makmur Jaya', 'Belanja Harian'],
  n3_resto: [75900, '2026-10-30', 'Kedai Kopi Senja', 'Makan & Minum'],
  n4_resto_foto: [null, '2026-10-30', 'Kedai Kopi Senja', 'Makan & Minum'],   // foto buram: angka total salah baca
  n5_spbu: [20000, '2026-10-29', 'SPBU 54.662.07', 'Transportasi'],
  n6_listrik: [105000, '2026-10-25', '', 'Tagihan & Listrik'],
  s1_transfer: [150000, '2026-10-31', 'Budi Santoso', ''],
  s2_checkout: [88500, '2026-10-27', '', ''],
  s3_ewallet: [25000, '2026-10-30', 'Warung Bakso Pak Kumis', 'Makan & Minum']
};

test('nota: total, tanggal, toko, kategori dari contoh', () => {
  for (const [nama, [nominal, tanggal, toko, kategori]] of Object.entries(NOTA)) {
    const text = fs.readFileSync(new URL('./nota/' + nama + '.txt', import.meta.url), 'utf8');
    const r = bacaNota(text, { hariIni: '2026-10-31' });
    if (nominal !== null) assert.equal(r.nominal, nominal, nama + ' nominal');
    else assert.ok(r.kandidat.length >= 2, nama + ' memberi pilihan angka lain');
    assert.equal(r.tanggal, tanggal, nama + ' tanggal');
    assert.equal(r.toko, toko, nama + ' toko');
    assert.equal(r.kategori, kategori, nama + ' kategori');
  }
  const tf = bacaNota(fs.readFileSync(new URL('./nota/s1_transfer.txt', import.meta.url), 'utf8'), { hariIni: '2026-10-31' });
  assert.equal(tf.catatan, 'Transfer ke Budi Santoso, bayar project web');
  assert.ok(tf.transfer);
});

test('data contoh selalu mengisi bulan ini dan bulan lalu, di tanggal berapa pun (bug: awal bulan kosong)', () => {
  const F = { add: (iso, n) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10) };
  const ymMin = (iso) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 2, 1)); return d.toISOString().slice(0, 7); };
  let hari = '2026-01-01';
  for (let i = 0; i < 800; i++, hari = F.add(hari, 1)) {   // lebih dari dua tahun, termasuk tahun kabisat dan pergantian tahun
    const ym = hari.slice(0, 7), ymLalu = ymMin(hari);
    const list = S.contohTransaksi(hari, hari + ' 10:00:00');
    assert.equal(list.length, 17, hari);
    const ini = C.ringkasanBulan(list, ym), lalu = C.ringkasanBulan(list, ymLalu);
    assert.ok(ini.masuk > 0, hari + ': pemasukan bulan ini kosong');
    assert.ok(ini.keluar > 0 && ini.perKategori.length >= 4, hari + ': pengeluaran bulan ini terlalu sedikit');
    assert.ok(lalu.masuk > 0 && lalu.keluar > 0, hari + ': bulan lalu kosong');
    assert.ok(list.every((t) => t.tanggal <= hari), hari + ': ada transaksi contoh di masa depan');
    assert.equal(new Set(list.map((t) => t.id)).size, list.length, hari + ': id ganda');
  }
});

test('data contoh pada hari biasa tidak berubah dari sebelumnya', () => {
  const list = S.contohTransaksi('2026-10-31', '2026-10-31 10:00:00');
  assert.equal(list.find((t) => t.id === 'contoh-09').tanggal, '2026-10-24');   // gaji, 7 hari lalu
  assert.equal(list.find((t) => t.id === 'contoh-11').tanggal, '2026-09-28');   // gaji bulan lalu, 33 hari lalu
  assert.equal(list.find((t) => t.id === 'contoh-01').tanggal, '2026-10-31');
});
