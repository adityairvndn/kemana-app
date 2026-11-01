// Hitungan untuk tampilan: saldo, ringkasan bulanan, tren, riwayat. Fungsi murni (bisa dites di Node).

import { JENIS } from './schema.js';
import { addMonths, addDays } from './format.js';

export function saldoPerDompet(dompetList, transaksi) {
  const map = new Map();
  (dompetList || []).forEach(function (d) {
    map.set(d.nama, { nama: d.nama, saldo: Number(d.saldo_awal) || 0, aktif: d.aktif !== false, terdaftar: true, transaksi: 0 });
  });
  function get(n) {
    if (!map.has(n)) map.set(n, { nama: n, saldo: 0, aktif: true, terdaftar: false, transaksi: 0 });
    return map.get(n);
  }
  (transaksi || []).forEach(function (t) {
    const n = Number(t.nominal) || 0;
    if (t.jenis === JENIS.MASUK) { get(t.dompet).saldo += n; get(t.dompet).transaksi++; }
    else if (t.jenis === JENIS.KELUAR) { get(t.dompet).saldo -= n; get(t.dompet).transaksi++; }
    else if (t.jenis === JENIS.TRANSFER) {
      get(t.dompet).saldo -= n; get(t.dompet).transaksi++;
      if (t.ke_dompet) { get(t.ke_dompet).saldo += n; get(t.ke_dompet).transaksi++; }
    }
  });
  return Array.from(map.values());
}

export function totalSaldo(list) {
  return list.reduce(function (a, d) { return a + d.saldo; }, 0);
}

export function ringkasanBulan(transaksi, ym) {
  let masuk = 0, keluar = 0, jumlah = 0;
  const per = {}, perMasuk = {};
  (transaksi || []).forEach(function (t) {
    if (!t.tanggal || t.tanggal.slice(0, 7) !== ym) return;
    jumlah++;
    const k = t.kategori || 'Tanpa kategori';
    if (t.jenis === JENIS.MASUK) { masuk += t.nominal; perMasuk[k] = (perMasuk[k] || 0) + t.nominal; }
    else if (t.jenis === JENIS.KELUAR) { keluar += t.nominal; per[k] = (per[k] || 0) + t.nominal; }
  });
  function list(obj, total) {
    return Object.keys(obj).map(function (k) {
      return { nama: k, jumlah: obj[k], pct: total ? obj[k] / total : 0 };
    }).sort(function (a, b) { return b.jumlah - a.jumlah; });
  }
  return {
    ym: ym, masuk: masuk, keluar: keluar, selisih: masuk - keluar, jumlahTransaksi: jumlah,
    perKategori: list(per, keluar), perKategoriMasuk: list(perMasuk, masuk)
  };
}

export function tren(transaksi, ymAkhir, n) {
  n = n || 6;
  const out = [], idx = {};
  for (let i = n - 1; i >= 0; i--) {
    const ym = addMonths(ymAkhir, -i);
    idx[ym] = out.length;
    out.push({ ym: ym, masuk: 0, keluar: 0 });
  }
  (transaksi || []).forEach(function (t) {
    const i = t.tanggal ? idx[t.tanggal.slice(0, 7)] : undefined;
    if (i === undefined) return;
    if (t.jenis === JENIS.MASUK) out[i].masuk += t.nominal;
    else if (t.jenis === JENIS.KELUAR) out[i].keluar += t.nominal;
  });
  return out;
}

function cocok(t, q) {
  if (!q) return true;
  const s = [t.kategori, t.catatan, t.dompet, t.ke_dompet, t.jenis, String(t.nominal)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) {
    return s.indexOf(w) >= 0 || s.indexOf(w.replace(/\./g, '')) >= 0;
  });
}

export function urutkan(a, b) {
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
  const da = a.dicatat || '', db = b.dicatat || '';
  if (da !== db) return da < db ? 1 : -1;
  return (b._row || 0) - (a._row || 0);
}

export function riwayat(transaksi, opt) {
  opt = opt || {};
  return (transaksi || []).filter(function (t) {
    if (opt.ym && (!t.tanggal || t.tanggal.slice(0, 7) !== opt.ym)) return false;
    if (opt.jenis && t.jenis !== opt.jenis) return false;
    if (opt.dompet && t.dompet !== opt.dompet && t.ke_dompet !== opt.dompet) return false;
    if (opt.kategori && (t.kategori || 'Tanpa kategori') !== opt.kategori) return false;
    return cocok(t, opt.q);
  }).sort(urutkan);
}

export function kelompokTanggal(list) {
  const out = [];
  let cur = null;
  list.forEach(function (t) {
    if (!cur || cur.tanggal !== t.tanggal) { cur = { tanggal: t.tanggal, items: [], masuk: 0, keluar: 0 }; out.push(cur); }
    cur.items.push(t);
    if (t.jenis === JENIS.MASUK) cur.masuk += t.nominal;
    else if (t.jenis === JENIS.KELUAR) cur.keluar += t.nominal;
  });
  return out;
}

/** Berapa transaksi yang memakai nama dompet/kategori ini. */
export function jumlahPemakaian(transaksi, jenisData, nama) {
  let n = 0;
  (transaksi || []).forEach(function (t) {
    if (jenisData === 'dompet' ? (t.dompet === nama || t.ke_dompet === nama) : t.kategori === nama) n++;
  });
  return n;
}

export function bulanTersedia(transaksi, ymSekarang) {
  const set = {};
  set[ymSekarang] = true;
  (transaksi || []).forEach(function (t) { if (t.tanggal) set[t.tanggal.slice(0, 7)] = true; });
  return Object.keys(set).sort();
}

/** Berapa kali tiap nama (kategori/dompet) dipakai dalam `hari` terakhir. */
export function frekuensi(transaksi, field, hariIni, hari) {
  const batas = addDays(hariIni, -(hari || 90));
  const out = {};
  (transaksi || []).forEach(function (t) {
    if (!t.tanggal || t.tanggal < batas || t.tanggal > hariIni) return;
    const n = t[field];
    if (n) out[n] = (out[n] || 0) + 1;
  });
  return out;
}

/** Urutkan nama dari yang paling sering dipakai; yang sama seringnya tetap di urutan semula. */
export function urutSering(names, frek) {
  return names.map(function (n, i) { return { n: n, i: i, f: frek[n] || 0 }; })
    .sort(function (a, b) { return b.f - a.f || a.i - b.i; })
    .map(function (x) { return x.n; });
}

/**
 * Transaksi yang berulang (kategori + dompet + nominal sama) untuk tombol "Catat cepat".
 * opt: { jenis, hariIni, hari = 60, min = 2, maks = 4, abaikan(t) }
 */
export function seringDicatat(transaksi, opt) {
  const batas = addDays(opt.hariIni, -(opt.hari || 60));
  const grup = new Map();
  (transaksi || []).forEach(function (t) {
    if (t.jenis !== opt.jenis || !t.tanggal || t.tanggal < batas || t.tanggal > opt.hariIni || !(t.nominal > 0)) return;
    if (opt.abaikan && opt.abaikan(t)) return;
    const key = [t.kategori || '', t.dompet, t.ke_dompet || '', t.nominal].join('|');
    let g = grup.get(key);
    if (!g) {
      g = { jenis: t.jenis, kategori: t.kategori || '', dompet: t.dompet, ke_dompet: t.ke_dompet || '', nominal: t.nominal, n: 0, terakhir: '', cat: {} };
      grup.set(key, g);
    }
    g.n++;
    if (t.tanggal > g.terakhir) g.terakhir = t.tanggal;
    const c = String(t.catatan || '').trim();
    if (c) g.cat[c] = (g.cat[c] || 0) + 1;
  });
  return Array.from(grup.values())
    .filter(function (g) { return g.n >= (opt.min || 2); })
    .sort(function (a, b) { return b.n - a.n || (a.terakhir < b.terakhir ? 1 : a.terakhir > b.terakhir ? -1 : 0); })
    .slice(0, opt.maks || 4)
    .map(function (g) {
      const top = Object.keys(g.cat).sort(function (a, b) { return g.cat[b] - g.cat[a]; })[0];
      return {
        jenis: g.jenis, kategori: g.kategori, dompet: g.dompet, ke_dompet: g.ke_dompet, nominal: g.nominal,
        catatan: top && g.cat[top] * 2 > g.n ? top : '', kali: g.n
      };
    });
}

/** Transaksi penyesuaian supaya saldo catatan sama dengan saldo sebenarnya (null kalau sudah sama). */
export function penyesuaianSaldo(saldoCatatan, saldoAsli) {
  const d = Math.round(saldoAsli) - Math.round(saldoCatatan);
  if (!d) return null;
  return { jenis: d < 0 ? JENIS.KELUAR : JENIS.MASUK, nominal: Math.abs(d) };
}
