// Membaca hasil OCR nota / screenshot: total, tanggal, nama toko/penerima, tebakan kategori.
// Fungsi murni (bisa dites di Node). Hasilnya hanya saran: pengguna selalu mengecek sebelum menyimpan.

const BULAN = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, peb: 2, mar: 3, maret: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, ags: 8, agus: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12, dec: 12, december: 12
};

// Baris yang angkanya pasti BUKAN total belanja.
const BUKAN_TOTAL = /\b(tunai|cash|kembali|kembalian|change|saldo|diskon|disc|discount|hemat|potongan|voucher|ppn|pajak|tax|dpp|sub\s*-?\s*total|subtotal|biaya\s+admin|admin\s+bank|biaya\s+layanan|ongkos|ongkir|pengiriman|harga\s*\/\s*liter|harga\s+satuan|poin|point|qty|item)\b/i;
// Baris berisi nomor yang bukan uang.
const BUKAN_UANG = /\b(spbu|npwp|telp|telepon|tlp|hp|wa|no\.?\s*ref|referensi|ref|id\s*transaksi|idpel|id\s*pel|token|meja|shift|kasir|no\.?\s*trans|pompa|pulau|volume|liter|rekening|no\.?\s*rek|va|virtual|kode|invoice|resi|npsn|nik)\b/i;

const PRIORITAS = [
  [3, /\b(grand\s*total|total\s*bayar|total\s*pembayaran|total\s*tagihan|total\s*belanja|total\s*harga|total\s*transaksi|jumlah\s*bayar|jumlah\s*tagihan|jumlah\s*pembayaran|harus\s*dibayar|total\s*payment|amount\s*due|total\s*transfer|jumlah\s*transfer|nominal\s*transfer)\b/i],
  [2, /\b(total|jumlah|nominal|amount)\b/i],
  [1, /\b(bayar|dibayar|pembayaran|paid|debit|qris)\b/i]
];

const KATEGORI_KATA = [
  ['Belanja Harian', /\b(indomaret|alfamart|alfamidi|superindo|hypermart|transmart|lotte\s*mart|carrefour|giant|hero|minimarket|mini\s*market|swalayan|toserba|supermarket|grosir|toko|mart)\b/],
  ['Transportasi', /\b(spbu|pertamina|shell|vivo|pertalite|pertamax|solar|dexlite|bensin|bbm|parkir|parking|e-?toll|jalan\s+tol|gojek|goride|gocar|grabbike|grabcar|maxim|krl|mrt|lrt|kai|transjakarta|ojek|travel)\b/],
  ['Tagihan & Listrik', /\b(pln|listrik|pdam|token\s+listrik|tagihan\s+air|iuran|ipl)\b/],
  ['Pulsa & Internet', /\b(pulsa|paket\s+data|kuota|telkomsel|indosat|im3|xl|axis|smartfren|tri|indihome|biznet|first\s*media|myrepublic|wifi|internet)\b/],
  ['Kesehatan', /\b(apotek|apotik|farma|kimia\s+farma|k-?24|klinik|rumah\s+sakit|rsud|rsia|dokter|obat|bpjs|laboratorium|lab)\b/],
  ['Makan & Minum', /\b(resto|restoran|restaurant|rumah\s+makan|rm|warung|warteg|kedai|cafe|kafe|coffee|kopi|bakso|mie\s+ayam|soto|sate|ayam|geprek|nasi|pizza|burger|bakery|roti|martabak|seblak|boba|teh|juice|jus|food|makan|minum|catering|katering)\b/],
  ['Hiburan', /\b(bioskop|cinema|xxi|cgv|cinepolis|netflix|spotify|youtube\s+premium|game|steam|karaoke|tiket\s+masuk|wisata)\b/],
  ['Pendidikan', /\b(sekolah|spp|kursus|les|bimbel|kampus|universitas|ukt|seminar|pelatihan)\b/]
];

function rapikan(line) {
  // Koreksi salah baca umum di dalam angka: O→0, l/I/|→1, spasi setelah pemisah ribuan.
  return line
    .replace(/(\d)\s*([.,])\s+(\d{3})\b/g, '$1$2$3')
    .replace(/[0-9OoIl|]+(?:[.,][0-9OoIl|]{3})+/g, function (m) {
      return /\d/.test(m) ? m.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Angka uang dari teks: "47.900", "Rp150.000", "75,900", "1.250.000,00", "20000". */
export function angka(token) {
  let s = String(token).replace(/^(rp\.?|idr)/i, '').replace(/[\s-]/g, '');
  if (!/^\d/.test(s)) return null;
  // Desimal 1–2 digit di akhir (",00" / ".50") dibuang.
  const dec = s.match(/^(.*\d)[.,](\d{1,2})$/);
  if (dec && /[.,]\d{3}/.test(dec[1])) s = dec[1];
  else if (dec && !/[.,]/.test(dec[1])) s = dec[1];
  if (!/^\d{1,3}([.,]\d{3})*$/.test(s) && !/^\d+$/.test(s)) return null;
  const n = Number(s.replace(/[.,]/g, ''));
  return isFinite(n) ? n : null;
}

/** Semua angka yang tampak seperti uang di satu baris. */
export function uangDiBaris(line) {
  const out = [];
  const re = /(?:rp\.?|idr)?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{3,9}(?:[.,]\d{2})?)(?![\d.,]*\d)/gi;
  let m;
  while ((m = re.exec(line))) {
    const raw = m[0];
    const start = m.index + raw.indexOf(m[1]);
    const before = line.charAt(start - 1);
    const after = line.charAt(re.lastIndex);
    if (/[\d/:]/.test(before) || /[\d/:]/.test(after)) continue;      // bagian tanggal/jam/kode
    const v = angka(m[1]);
    if (v == null) continue;
    const pakaiPemisah = /[.,]\d{3}/.test(m[1]);
    const pakaiRp = /^(rp|idr)/i.test(raw.trim());
    out.push({ v: v, pemisah: pakaiPemisah, rp: pakaiRp });
  }
  return out;
}

function tanggalValid(y, m, d, hariIni, batasLalu) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
  const iso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dt = new Date(iso + 'T00:00:00Z');
  if (isNaN(dt) || dt.getUTCDate() !== d) return '';
  if (iso > hariIni) return '';
  if (iso < batasLalu) return '';
  return iso;
}

/** Tanggal pertama yang masuk akal (tidak di masa depan, maksimal ±1 tahun lalu). */
export function cariTanggal(lines, hariIni) {
  const y0 = Number(hariIni.slice(0, 4));
  const batas = (y0 - 1) + hariIni.slice(4);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m, r;
    const iso = /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/g;
    while ((m = iso.exec(l))) { r = tanggalValid(+m[1], +m[2], +m[3], hariIni, batas); if (r) return r; }
    const dmy = /(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/g;
    while ((m = dmy.exec(l))) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      r = tanggalValid(y, +m[2], +m[1], hariIni, batas); if (r) return r;
    }
    const nama = /(\d{1,2})\s*[-\s]?\s*([a-z]{3,9})\.?\s*[-\s,]?\s*(20\d{2}|\d{2})\b/gi;
    while ((m = nama.exec(l))) {
      const b = BULAN[m[2].toLowerCase()];
      if (!b) continue;
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      r = tanggalValid(y, b, +m[1], hariIni, batas); if (r) return r;
    }
    const en = /\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
    while ((m = en.exec(l))) {
      const b = BULAN[m[1].toLowerCase()];
      if (!b) continue;
      r = tanggalValid(+m[3], b, +m[2], hariIni, batas); if (r) return r;
    }
  }
  return '';
}

function judul(s) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, function (_, a, b) { return a + b.toUpperCase(); });
  }
  return s;
}

const BUKAN_NAMA = /\b(jl|jln|jalan|telp|npwp|tgl|tanggal|waktu|struk|kasir|shift|www|http|rincian|pesanan|berhasil|sukses|gagal|pembelian|receipt|invoice|nota|bukti|detail|total|rp|kode|alamat|cabang|no)\b/i;

function cariNama(lines) {
  // Screenshot transfer/e-wallet: nama setelah label penerima/kepada.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(nama\s+penerima|penerima|kepada|dibayar\s+ke|merchant|nama\s+toko)\b\s*:?\s*(.*)$/i) ||
      lines[i].match(/^(ke|tujuan)\s*:\s*(.*)$/i);
    if (!m) continue;
    let nama = m[2].trim();
    if (!nama && lines[i + 1]) nama = lines[i + 1];
    nama = nama.replace(/\s*[-–]\s*\d[\d\s]*$/, '').trim();
    if (/[a-z]{2,}/i.test(nama) && nama.length <= 40 && !uangDiBaris(nama).length) return { nama: judul(nama), label: m[1].toLowerCase() };
  }
  // Nota: biasanya nama toko di baris-baris pertama.
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const l = lines[i];
    const huruf = (l.match(/[a-z]/gi) || []).length;
    const isi = l.replace(/\s/g, '').length;
    if (/\bspbu\b/i.test(l)) return { nama: l.replace(/\bspbu\b/i, 'SPBU').trim(), label: '' };
    if (huruf >= 3 && huruf / isi >= 0.6 && l.length <= 40 && !BUKAN_NAMA.test(l) && !uangDiBaris(l).length) return { nama: judul(l), label: '' };
  }
  return { nama: '', label: '' };
}

function cariKeterangan(lines) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(berita|catatan|keterangan|pesan|deskripsi)\s*:?\s*(.*)$/i);
    if (m) { const s = (m[2] || lines[i + 1] || '').trim(); if (/[a-z]{2,}/i.test(s) && s.length <= 60) return s; }
  }
  return '';
}

export function tebakKategori(teks) {
  const t = String(teks || '').toLowerCase();
  for (let i = 0; i < KATEGORI_KATA.length; i++) if (KATEGORI_KATA[i][1].test(t)) return KATEGORI_KATA[i][0];
  return '';
}

/**
 * @param {string} text  hasil OCR
 * @param {{hariIni: string}} opt
 * @returns {{nominal:number, kandidat:number[], tanggal:string, toko:string, catatan:string, kategori:string, transfer:boolean, masuk:boolean}}
 */
export function bacaNota(text, opt) {
  opt = opt || {};
  const hariIni = opt.hariIni || new Date().toISOString().slice(0, 10);
  const lines = String(text || '').split(/\r?\n/).map(rapikan).filter(function (l) { return l.length > 0; });

  const cands = [];   // { v, skor, i }
  let tunai = null, kembali = null;
  lines.forEach(function (l, i) {
    const low = l.toLowerCase();
    const uang = uangDiBaris(l);
    if (/\b(tunai|cash)\b/.test(low) && uang.length) tunai = uang[uang.length - 1].v;
    if (/\b(kembali|kembalian|change)\b/.test(low) && uang.length) kembali = uang[uang.length - 1].v;
    if (BUKAN_UANG.test(low)) return;
    let p = 0;
    for (let k = 0; k < PRIORITAS.length; k++) if (PRIORITAS[k][1].test(low)) { p = PRIORITAS[k][0]; break; }
    const bukan = BUKAN_TOTAL.test(low) && p < 3;
    if (p && !bukan) {
      let u = uang;
      if (!u.length && lines[i + 1] && !BUKAN_TOTAL.test(lines[i + 1])) u = uangDiBaris(lines[i + 1]);   // label di atas, nilai di bawah
      u = u.filter(function (x) { return x.v >= 100 && (x.pemisah || x.rp || p >= 2); });
      if (u.length) cands.push({ v: u[u.length - 1].v, skor: p * 10, i: i });
      return;
    }
    if (bukan) return;
    // Angka besar yang berdiri sendiri (gaya screenshot: "Rp150.000").
    if (uang.length === 1 && (uang[0].rp || uang[0].pemisah) && uang[0].v >= 500 && l.replace(/^(rp\.?|idr)\s?/i, '').replace(/[\d.,\s]/g, '').length === 0) {
      cands.push({ v: uang[0].v, skor: 15, i: i });
      return;
    }
    uang.forEach(function (x) { if (x.pemisah && x.v >= 1000) cands.push({ v: x.v, skor: 1, i: i }); });
  });
  if (tunai != null && kembali != null && tunai > kembali) cands.push({ v: tunai - kembali, skor: 12, i: -1 });

  cands.sort(function (a, b) { return b.skor - a.skor || (b.skor <= 1 ? b.v - a.v : b.i - a.i); });
  const kandidat = [];
  cands.forEach(function (c) { if (kandidat.indexOf(c.v) < 0 && kandidat.length < 4) kandidat.push(c.v); });
  // Angka yang muncul di beberapa baris kuat (nominal + total) lebih bisa dipercaya.
  let nominal = kandidat[0] || 0;
  const kuat = cands.filter(function (c) { return c.skor >= 15; });
  if (kuat.length >= 2 && cands[0].skor < 30) {
    const hit = {};
    kuat.forEach(function (c) { hit[c.v] = (hit[c.v] || 0) + 1; });
    const best = Object.keys(hit).sort(function (a, b) { return hit[b] - hit[a]; })[0];
    if (hit[best] >= 2) nominal = Number(best);
  }
  if (nominal) { kandidat.splice(kandidat.indexOf(nominal), 1); kandidat.unshift(nominal); }

  const full = lines.join('\n');
  const low = full.toLowerCase();
  const nama = cariNama(lines);
  const transfer = /\btransfer\b/.test(low) && /\b(berhasil|sukses|penerima)\b/.test(low);
  const masuk = /\b(dana\s+masuk|uang\s+masuk|transfer\s+masuk|diterima\s+dari|telah\s+menerima)\b/.test(low);
  let catatan = nama.nama;
  if (nama.nama && transfer && /penerima|ke/.test(nama.label)) catatan = 'Transfer ke ' + nama.nama;
  const ket = cariKeterangan(lines);
  if (ket) catatan = catatan ? catatan + ', ' + ket : ket;

  return {
    nominal: nominal,
    kandidat: kandidat,
    tanggal: cariTanggal(lines, hariIni),
    toko: nama.nama,
    catatan: catatan.slice(0, 140),
    kategori: tebakKategori((nama.nama ? nama.nama + '\n' : '') + full),
    transfer: transfer,
    masuk: masuk
  };
}
