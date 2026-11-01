// Fungsi bantu format angka & tanggal. Tanpa ketergantungan browser supaya bisa dites di Node.

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function ribuan(n) {
  const neg = n < 0;
  const s = String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + s;
}

export function rupiah(n) {
  return (n < 0 ? '−' : '') + 'Rp ' + ribuan(Math.abs(n));
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/** Tanggal lokal hari ini sebagai 'YYYY-MM-DD'. */
export function todayISO(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function nowStamp(d) {
  d = d || new Date();
  return todayISO(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

export function addDays(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

export function addMonths(ym, n) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return yy + '-' + pad2(mm + 1);
}

/** Nomor seri tanggal Google Sheets (hari sejak 1899-12-30) → 'YYYY-MM-DD'. */
export function serialToISO(serial) {
  const ms = Math.round((Number(serial) - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' atau 'YYYY-MM-DD HH:MM:SS' → nomor seri tanggal Google Sheets. */
export function isoToSerial(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return NaN;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return ms / 86400000 + 25569;
}

export function serialToStamp(serial) {
  const ms = Math.round((Number(serial) - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

export function isISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

/** Terima 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'D/M/YY' → 'YYYY-MM-DD' atau ''. */
export function parseDateText(s) {
  s = String(s == null ? '' : s).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const iso = m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
    return isISODate(iso) ? iso : '';
  }
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const iso = y + '-' + pad2(+m[2]) + '-' + pad2(+m[1]);
    return isISODate(iso) ? iso : '';
  }
  return '';
}

export function labelTanggal(iso, today) {
  if (!iso) return '';
  today = today || todayISO();
  if (iso === today) return 'Hari ini';
  if (iso === addDays(today, -1)) return 'Kemarin';
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const tahun = iso.slice(0, 4) === today.slice(0, 4) ? '' : ' ' + p[0];
  return HARI[d.getUTCDay()] + ', ' + p[2] + ' ' + BLN[p[1] - 1] + tahun;
}

export function labelTanggalPendek(iso) {
  if (!iso) return '';
  const p = iso.split('-').map(Number);
  return p[2] + ' ' + BLN[p[1] - 1] + ' ' + p[0];
}

export function labelBulan(ym) {
  return BULAN[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
}

export function labelBulanPendek(ym) {
  return BLN[Number(ym.slice(5, 7)) - 1];
}

/** Angka dari teks gaya Indonesia: 'Rp 25.000', '25.000,50', '25000', '1,5' → number atau NaN. */
export function parseNumberText(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).trim();
  if (!s) return NaN;
  s = s.replace(/rp\.?/i, '').replace(/\s/g, '');
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}

export function uid() {
  const rnd = Math.random().toString(36).slice(2, 7);
  return Date.now().toString(36) + '-' + rnd;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
