// Login Google (Google Identity Services, token model) dan pemanggil API Google.
//
// Aplikasi hanya meminta izin `drive.file`: bisa membuat file baru dan membuka file yang ia buat
// sendiri, tidak bisa melihat file lain di Google Drive pengguna.
// Token berlaku ±1 jam. Memperbaruinya butuh ketukan pengguna (popup singkat dari Google).

import { CONFIG } from './config.js';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'ck.token';

let gisPromise = null;
let tokenClient = null;
let pending = null;
let token = load();

function load() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || null; } catch (e) { return null; }
}
function save() {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* penyimpanan tidak tersedia */ }
}

export function err(code, message, extra) {
  const e = new Error(message || code);
  e.code = code;
  if (extra) Object.assign(e, extra);
  return e;
}

export function configured() {
  return /\.apps\.googleusercontent\.com$/.test(String(CONFIG.GOOGLE_CLIENT_ID || '').trim());
}

/** Muat skrip Google lebih awal supaya popup login bisa dibuka langsung saat tombol diketuk. */
export function loadGis() {
  if (!configured()) return Promise.reject(err('CONFIG', 'Client ID Google belum diatur.'));
  if (gisPromise) return gisPromise;
  gisPromise = new Promise(function (resolve, reject) {
    if (window.google && google.accounts && google.accounts.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = GIS_URL;
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () {
      gisPromise = null;
      reject(err('OFFLINE', 'Tidak bisa memuat layanan Google. Periksa koneksi internet.'));
    };
    document.head.appendChild(s);
  }).then(function () {
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID.trim(),
        scope: SCOPE,
        callback: onToken,
        error_callback: onTokenError
      });
    }
  });
  return gisPromise;
}

export function ready() { return !!tokenClient; }

function settle(fn, value) {
  const p = pending;
  pending = null;
  if (p) p[fn](value);
}

function onToken(resp) {
  if (!resp || resp.error) {
    settle('reject', err('AUTH', resp && resp.error === 'access_denied' ? 'Izin ditolak.' : 'Login Google gagal. Coba lagi.'));
    return;
  }
  if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
    settle('reject', err('SCOPE', 'Izin Google Drive belum dicentang. Ulangi dan centang izin agar aplikasi bisa menyimpan data.'));
    return;
  }
  token = {
    access_token: resp.access_token,
    expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
    email: token && token.email || ''
  };
  save();
  settle('resolve', token.access_token);
}

function onTokenError(e) {
  const type = e && e.type;
  if (type === 'popup_failed_to_open') settle('reject', err('POPUP', 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'));
  else settle('reject', err('CANCEL', 'Login dibatalkan.'));
}

/**
 * Minta token. HARUS dipanggil langsung dari handler ketukan/klik (popup).
 * @param {{select?: boolean}} opt  select=true untuk memilih akun lain.
 */
export function requestToken(opt) {
  opt = opt || {};
  return new Promise(function (resolve, reject) {
    if (!tokenClient) {
      reject(err('NOT_READY', 'Layanan Google masih dimuat. Coba ketuk lagi sebentar.'));
      loadGis().catch(function () {});
      return;
    }
    if (pending) pending.reject(err('CANCEL', 'Dibatalkan.'));
    pending = { resolve: resolve, reject: reject };
    const o = { prompt: opt.select ? 'select_account' : '' };
    if (!opt.select && token && token.email) o.login_hint = token.email;
    tokenClient.requestAccessToken(o);
  });
}

export function validToken() {
  return token && token.access_token && token.expires_at - 60000 > Date.now() ? token.access_token : null;
}

export function setEmail(email) {
  if (!token) token = { access_token: '', expires_at: 0, email: '' };
  token.email = email || '';
  save();
}

export function expire() {
  if (token) { token.access_token = ''; token.expires_at = 0; save(); }
}

export function logout() {
  const t = token && token.access_token;
  token = null;
  save();
  try { if (t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {}); } catch (e) { /* abaikan */ }
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/** fetch ke API Google dengan token, coba ulang untuk galat sementara, galat diberi kode. */
export async function api(url, opt) {
  opt = opt || {};
  const t = validToken();
  if (!t) throw err('AUTH', 'Sesi Google berakhir. Sambungkan lagi.');
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      const headers = { Authorization: 'Bearer ' + t };
      if (opt.body !== undefined) headers['Content-Type'] = 'application/json';
      res = await fetch(url, { method: opt.method || 'GET', headers: headers, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined });
    } catch (e) {
      throw err('OFFLINE', 'Tidak ada koneksi internet.');
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) { await sleep(700 * (attempt + 1)); continue; }
    break;
  }
  if (res.ok) {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  let msg = 'HTTP ' + res.status;
  try { const b = await res.json(); if (b && b.error && b.error.message) msg = b.error.message; } catch (e) { /* bukan JSON */ }
  if (res.status === 401) { expire(); throw err('AUTH', 'Sesi Google berakhir. Sambungkan lagi.'); }
  if (/has not been used in project|is disabled|accessNotConfigured/i.test(msg)) {
    throw err('API_DISABLED', 'Google Sheets API / Google Drive API belum diaktifkan di Google Cloud pemilik aplikasi (lihat README).');
  }
  if (res.status === 404) throw err('NOT_FOUND', 'Spreadsheet tidak ditemukan.');
  if (res.status === 403) throw err('FORBIDDEN', msg);
  throw err('API', msg);
}
