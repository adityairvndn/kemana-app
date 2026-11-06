<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · original Kemana system inspired by Dime UI principles -->
# Kemana — Design & UX Specification

Versi: 1.2  
Tanggal: 6 November 2026  
Status: spesifikasi untuk implementasi; belum merupakan hasil implementasi atau sertifikasi kompatibilitas.

> Kemana membantu orang mencatat uang dengan cepat, melihat transaksi dengan jelas, dan memahami saldo tanpa banyak langkah. Desain mengurangi hambatan penggunaan. Ketepatan data, keberhasilan tugas, aksesibilitas, kompatibilitas, dan performa mendahului estetika.

### Navigasi dokumen

- [Prioritas dan cara menggunakan dokumen](#1-cara-menggunakan-dokumen-ini)
- [Konteks produk dan batas observasi](#2-konteks-produk-dan-dasar-observasi)
- [Arah desain dan referensi Dime](#3-system)
- [Prinsip UX](#4-prinsip-ux-yang-wajib-dipertahankan)
- [Navigasi aplikasi](#5-arsitektur-informasi-dan-navigasi)
- [Layout, responsivitas, dan keyboard](#6-layout-dan-responsivitas)
- [Token desain dan tema](#7-tokens)
- [Layar Catat](#8-spesifikasi-layar-catat)
- [Layar Riwayat](#9-spesifikasi-layar-riwayat)
- [Layar Ringkasan](#10-spesifikasi-layar-ringkasan)
- [Layar Pengaturan](#11-spesifikasi-layar-pengaturan)
- [Komponen dan interaksi](#12-komponen-dan-state-interaksi)
- [Bahasa UI](#13-bahasa-ui-dan-microcopy)
- [Aksesibilitas](#14-aksesibilitas)
- [Kompatibilitas OS dan browser](#15-kompatibilitas-lintas-os-dan-browser)
- [PWA, offline, dan update](#16-pwa-instalasi-offline-dan-pembaruan)
- [Performa dan ukuran aset](#17-performa-dan-batas-ukuran)
- [Integritas data](#18-integritas-data-yang-tidak-boleh-berubah-karena-redesign)
- [Skenario penerimaan](#19-skenario-penerimaan-utama)
- [Definition of Done](#20-definition-of-done)
- [Tahapan implementasi](#21-urutan-implementasi-yang-disarankan)
- [Aturan coding agent](#22-aturan-untuk-pengembang-dan-coding-agent)
- [Ekspor dan pemeliharaan](#23-exports-dan-pemeliharaan-sistem)
- [Pola yang dihindari](#24-notes--pola-yang-tidak-dibawa-ke-kemana)
- [Rujukan](#25-rujukan)

## 1. Cara menggunakan dokumen ini

Dokumen ini menjadi acuan bersama untuk UI, UX, dan penerimaan perubahan tampilan Kemana. Baca sebelum mengubah layar atau komponen. Implementasikan bertahap di struktur aplikasi yang sudah ada.

Arti tingkat persyaratan:

- **WAJIB**: diperlukan untuk menerima implementasi pada lingkup terkait.
- **SEBAIKNYA**: pilihan awal; boleh disesuaikan jika hasil uji penggunaan menunjukkan alasan yang lebih baik.
- **OPSIONAL**: enhancement yang hanya ditambahkan bila kebutuhan dan biayanya jelas.

Urutan penyelesaian konflik keputusan:

1. Ketepatan, keutuhan, dan pemulihan data pengguna.
2. Keberhasilan tugas dan kemudahan penggunaan.
3. Aksesibilitas serta kompatibilitas browser/perangkat.
4. Kecepatan, ukuran aplikasi, dan penggunaan sumber daya.
5. Konsistensi dan kerapian visual.
6. Dekorasi dan animasi.

Jika perubahan visual menambah langkah, memperlambat pencatatan, atau menyembunyikan informasi penting, sederhanakan perubahan tersebut. Jangan menjadikan dokumen ini alasan untuk membangun ulang aplikasi.

## 2. Konteks produk dan dasar observasi

### 2.1 Produk yang menjadi acuan

[Demo Kemana](https://adityairvndn.github.io/kemana-app/?demo) diperiksa melalui tampilan browser pada 2 November 2026. Layar yang dilihat: Catat, Riwayat, Ringkasan, dan Pengaturan. Versi yang tercantum di Pengaturan saat observasi: 1.3.1.

Fungsi yang terlihat pada demo:

- Pengeluaran, pemasukan, dan transfer antar dompet.
- Input nominal dengan keypad dan pilihan `000`.
- Kategori, dompet, tanggal, catatan, serta tombol simpan.
- Catat cepat sekali ketuk dan tombol pengisian dari foto nota/screenshot.
- Riwayat dengan pencarian, pilihan bulan, filter jenis, dan kelompok per hari.
- Saldo total, rincian dompet, arus uang, kategori pengeluaran, serta ringkasan enam bulan.
- Pengelolaan dompet/kategori, pilihan tema, dan ukuran teks.
- Mode demo lokal dan penjelasan tentang masuk dengan Google untuk menyimpan ke spreadsheet milik pengguna.

Pembaruan 3 November 2026: pemeriksaan read-only dilakukan pada HTML publik, ikon SVG, manifest, CSS, dan boot script tema untuk menyelaraskan aset/ID tema. Yang belum diaudit menyeluruh: kode bisnis, format data internal, ukuran bundle keseluruhan, ketepatan perhitungan, service worker, persistensi draft, antrean sinkronisasi, alur autentikasi sebenarnya, dan perilaku pada perangkat fisik. Kemampuan yang tertulis sebagai persyaratan di bawah **tidak berarti sudah tersedia pada aplikasi saat ini**.

### 2.2 Masalah yang hendak diselesaikan

- Pada layar Catat, banyak kotak, border, dan kontrol memiliki bobot visual serupa.
- Pilihan kategori yang panjang memperbesar tinggi form.
- Keypad mendominasi ruang sebelum pengguna melihat seluruh detail transaksi.
- Riwayat dapat memperjelas hubungan antara catatan, kategori, dompet, dan nominal.
- Penyederhanaan visual perlu dilakukan tanpa menghapus fitur atau membuat input lebih sulit.

Ini merupakan penilaian visual dari demo, bukan hasil penelitian pengguna atau pengukuran performa.

## 3. System

| Aspek | Keputusan |
| --- | --- |
| Genre | Minimalis fungsional untuk aplikasi pencatatan uang |
| Struktur | Form pencatatan yang menonjolkan nominal, daftar transaksi per tanggal, ringkasan saldo dan kategori |
| Referensi utama | Prinsip tampilan Dime: hierarki nominal, ruang yang cukup, kontrol yang tenang, daftar yang mudah dipindai |
| Identitas Kemana | Bahasa Indonesia, ikon k petrol, istilah Catat/Riwayat/Ringkasan/Pengaturan, serta alur dompet yang sudah ada |
| Tipografi | Satu keluarga font bawaan sistem; perbedaan melalui ukuran dan ketebalan |
| Permukaan | Latar netral; surface digunakan ketika pengelompokan membantu pemahaman |
| Interaksi | Respons segera, penjelasan status yang jujur, pemulihan kesalahan yang sederhana |
| Motion | Minimal; tidak menjadi syarat memahami atau menyelesaikan tugas |

### 3.1 Provenance

Referensi visual: [Dime: Budget & Expense Tracker, Rafael Soh — galeri App Store](https://apps.apple.com/us/app/dime-budget-expense-tracker/id1635280255). Pengguna memilih Dime sebagai referensi publik untuk pengembangan Kemana dalam percakapan ini.

Sumber yang ditelaah adalah screenshot UI aplikasi pada galeri, bukan desain halaman pemasaran App Store. Dokumen ini menerjemahkan prinsip umum tersebut menjadi sistem asli Kemana. Warna, ukuran, token, dan perilaku di sini merupakan keputusan untuk Kemana; bukan hasil ekstraksi CSS atau pengukuran persis Dime. Font asli dan motion Dime tidak diverifikasi dari screenshot.

### 3.2 Prinsip visual yang diadopsi

- Satu fokus utama per bagian, terutama nominal saat mencatat.
- Hierarki tipografi yang jelas sebelum menambah border atau warna.
- Daftar yang rata dan teratur untuk informasi berulang.
- Detail sekunder tetap terbaca, tetapi tidak bersaing dengan nominal dan aksi utama.
- Pilihan utama terlihat; pilihan yang jarang dipakai tetap mudah ditemukan.

### 3.3 Batas lingkup

- WAJIB mempertahankan fungsi, navigasi utama, autentikasi, integrasi spreadsheet, dan makna data yang sudah ada.
- WAJIB mempertahankan pilihan tema serta ukuran teks pengguna.
- Tidak perlu menambah onboarding, budgeting, AI, gamifikasi, investasi, sinkronisasi realtime, atau analitik baru untuk mencapai desain ini.
- Tidak perlu mengganti framework, router, storage, library grafik, atau sistem build demi perubahan tampilan.
- Migrasi data atau perubahan aturan bisnis, bila ditemukan perlu, ditangani sebagai perubahan terpisah dengan alasan dan verifikasi sendiri.

## 4. Prinsip UX yang wajib dipertahankan

### 4.1 Pencatatan cepat

- Pengguna dapat memasukkan transaksi tanpa membuka tutorial.
- Catatan bersifat opsional; jangan mewajibkannya demi tampilan daftar.
- Detail yang diwajibkan mengikuti aturan produk yang sudah ada.
- Default dompet/tanggal yang sudah membantu penggunaan dipertahankan dan tetap terlihat sebelum simpan.
- Jangan mengisi kategori secara diam-diam hanya karena kategori tersebut sering digunakan.
- Memilih kategori atau dompet tidak mereset nominal maupun catatan.
- Berpindah jenis transaksi tidak boleh menghapus draft tanpa alasan yang dijelaskan.

### 4.2 Data yang terlihat dapat dipercaya

- UI membedakan tersimpan di perangkat, menunggu sinkronisasi, tersinkron, dan gagal menyimpan.
- Jangan menampilkan sukses sebelum penulisan ke penyimpanan yang dijanjikan benar-benar berhasil.
- Jika aplikasi baru berhasil menyimpan lokal, gunakan pesan yang menyatakan penyimpanan lokal.
- Nominal penuh dapat dibaca; jangan memakai ellipsis pada uang.
- Transfer tidak ditampilkan sebagai pengeluaran konsumsi atau pemasukan baru.
- Saldo saat ini berbeda makna dari sisa arus uang pada suatu bulan; label dan perhitungannya tidak dicampur.

### 4.3 Pemulihan kesalahan

- Pesan error menyebutkan apa yang perlu diperbaiki dan mempertahankan input pengguna.
- Kesalahan koneksi tidak mengosongkan form atau menghapus transaksi lokal.
- Hindari dialog konfirmasi untuk tindakan rutin yang mudah dipulihkan.
- Penghapusan permanen dan perubahan yang sulit dipulihkan memakai konfirmasi yang menyebutkan objek serta akibatnya.
- Aksi Undo hanya ditampilkan bila pemulihannya benar-benar didukung. Jika belum, sediakan akses edit/detail yang sudah ada.

### 4.4 Interaksi dapat ditemukan

- Fungsi penting tersedia melalui tombol/label yang terlihat.
- Swipe, long press, hover, atau gesture menjadi jalan tambahan.
- Ikon tanpa label visual memiliki nama aksesibel yang jelas.
- Aktivitas asinkron tidak memblokir seluruh aplikasi bila hanya satu bagian yang bekerja.

## 5. Arsitektur informasi dan navigasi

Pertahankan empat tujuan utama:

| Menu | Pertanyaan yang dijawab | Aksi utama |
| --- | --- | --- |
| Catat | Apa transaksi yang baru terjadi? | Menyimpan transaksi |
| Riwayat | Apa saja yang sudah dicatat? | Mencari, memeriksa, dan membuka transaksi |
| Ringkasan | Berapa saldo dan uang digunakan untuk apa? | Memahami saldo serta komposisi arus uang |
| Pengaturan | Bagaimana mengelola akun, dompet, kategori, dan tampilan? | Mengelola preferensi dan data pendukung |

Aturan navigasi:

- Label teks tetap tampil bersama ikon navigasi.
- Tab aktif dibedakan oleh bentuk/ketebalan/indikator selain warna.
- Urutan menu konsisten di seluruh layar dan tema.
- Tab Catat tetap menjadi akses cepat; jangan menggantinya dengan dashboard baru.
- Tab yang tidak aktif tidak perlu melakukan fetch/render berat.
- Pilihan bulan, filter, dan posisi scroll sebaiknya bertahan saat kembali dari detail transaksi.
- Tombol Back menutup panel/detail yang sedang terbuka sebelum keluar dari konteks utama, sesuai perilaku history aplikasi yang ada.
- Jangan menambah entri history setiap kali pengguna mengetik nominal atau memilih chip.
- Perpindahan tab menjaga draft di memori. Pemulihan setelah reload memerlukan penyimpanan draft yang terverifikasi; jangan mengklaimnya jika belum tersedia.

## 6. Layout dan responsivitas

### 6.1 Aturan dasar

- Rancang dari lebar 320 CSS px dan tinggi viewport yang berubah-ubah.
- Gunakan lebar cair, `min-width: 0` pada item flex/grid, dan grid `minmax(0, 1fr)` bila relevan.
- Hindari lebar tetap untuk form, nominal, serta baris daftar.
- Teks panjang boleh membungkus; jangan mengandalkan truncation untuk nama dompet/kategori yang harus dipilih.
- Scroll vertikal diperbolehkan. Jangan memaksa semua isi masuk satu layar dengan mengecilkan teks atau target sentuh.
- Horizontal scroll seluruh halaman harus diperbaiki pada penyebabnya. Jangan menyembunyikannya untuk menutupi konten yang terpotong.
- Hindari tinggi komponen tetap jika isinya teks yang dapat diperbesar.

### 6.2 Rentang layout

Breakpoint adalah panduan berdasarkan ruang isi, bukan deteksi OS.

| Lebar viewport | Layout awal | Perilaku |
| --- | --- | --- |
| 320–479 px | Satu kolom; gutter 12–16 px | Semua tugas dapat dilakukan; panel panjang dapat scroll |
| 480–767 px | Satu kolom; gutter 16–24 px | Form tetap ringkas dan tidak direntangkan berlebihan |
| 768–1023 px | Konten di tengah; gutter 24 px | Ringkasan boleh dua kolom bila urutan baca tetap jelas |
| 1024 px ke atas | Konten berlebar maksimum | Riwayat dan ringkasan boleh lebih lebar; form Catat tetap nyaman |

Lebar maksimum awal: Catat/Pengaturan 36 rem, Riwayat 48 rem, Ringkasan 64 rem. Ini batas maksimum konten, bukan alasan mengubah struktur navigasi menjadi sidebar. Menjaga shell sempit yang sudah ada tetap sah jika lebih sederhana dan semua informasi terbaca.

### 6.3 Navigasi bawah dan tombol simpan

- WAJIB tidak menutupi baris terakhir, error, atau field yang sedang fokus.
- Gunakan layout flow/grid dengan area konten dan dock yang terpisah bila memungkinkan.
- Bila dock fixed dipertahankan, ruang bawah harus mengikuti ukuran dock sebenarnya, safe area, serta ukuran teks; jangan hanya menebak angka padding.
- Navigasi dan tombol simpan tidak perlu menempel pada layar ketika tinggi ruang tidak mencukupi. Kembalikan ke flow normal.
- Pada landscape pendek, prioritaskan field yang sedang diedit dan akses simpan melalui scroll.
- Ukuran teks besar boleh membuat label tombol membungkus atau navigasi berubah tinggi; keterbacaan lebih utama daripada kesamaan tinggi.

### 6.4 Safe area dan viewport

- Gunakan viewport meta `width=device-width, initial-scale=1, viewport-fit=cover`.
- Jangan memakai `user-scalable=no` atau membatasi zoom maksimum.
- Beri inset pada bagian UI yang berdekatan dengan notch/home indicator menggunakan `env(safe-area-inset-*, 0px)`.
- Sediakan `100vh` sebagai fallback sebelum menggunakan unit viewport baru.
- Jangan menjadikan `100dvh` sebagai satu-satunya solusi keyboard. Uji resize, scroll, dan posisi fokus pada perangkat sebenarnya.
- Hindari scroll container bertingkat kecuali panel/dialog membutuhkannya.

Rujukan: [MDN — env() dan safe area](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env), [MDN — viewport length units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length).

### 6.5 Keyboard virtual

- Jangan otomatis membuka keyboard ketika aplikasi baru dibuka.
- Saat input nominal/catatan fokus, pastikan field dapat terlihat dan digulir ke posisi yang nyaman.
- Keypad kustom dan keyboard OS tidak boleh bersaing memenuhi layar pada saat bersamaan.
- Saat pengguna beralih ke input langsung/native, sembunyikan keypad kustom selama sesi pengeditan tersebut; tampilkan kembali ketika selesai.
- Tombol keypad tidak berulang kali memaksa fokus ke input dan membuka keyboard OS.
- Utamakan penanganan focus serta layout sederhana; gunakan Visual Viewport API hanya jika pengujian menunjukkan masalah yang tidak terselesaikan.
- VirtualKeyboard API, deteksi user-agent, dan perhitungan tinggi keyboard khusus OS bukan dependensi utama.

## 7. Tokens

### 7.1 Sumber kebenaran

Sumber token runtime kanonis sekarang adalah [tokens.css](kemana-assets/assets/tokens.css) pada paket aset versi 1.1. Blok di bawah mencerminkan file tersebut. Saat integrasi, petakan ke peran variabel proyek yang sudah ada; jangan mempertahankan dua palette mandiri. Aset dan CSS sudah dibuat, tetapi belum dipasang pada app live.

Baseline menggunakan sRGB/hex agar sederhana. OKLCH atau `color-mix()` boleh dipakai sebagai enhancement dengan fallback yang setara. Tidak perlu menambah polyfill atau pipeline warna.

### 7.2 Warna, ukuran, dan motion

```css
/* Hallmark · macrostructure: functional app · tone: restrained · anchor hue: coral · pre-emit critique: P5 H5 E4 S5 R5 V4 */
:root {
  --font-body: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-display: var(--font-body);
  --text-caption: .8125rem;
  --text-secondary: .875rem;
  --text-body: 1rem;
  --text-section: 1.125rem;
  --text-title: 1.5rem;
  --text-balance: clamp(1.75rem,5vw,2.5rem);
  --text-amount: clamp(2rem,8vw,3.5rem);
  --line-body: 1.5;
  --line-heading: 1.2;
  --space-xs: .25rem;
  --space-sm: .5rem;
  --space-md: .75rem;
  --space-lg: 1rem;
  --space-xl: 1.5rem;
  --space-2xl: 2rem;
  --space-3xl: 3rem;
  --radius-control: .75rem;
  --radius-card: 1rem;
  --radius-chip: 999px;
  --radius-dialog: 1.25rem;
  --control-min-size: 2.75rem;
  --rule-thin: 1px;
  --focus-width: 2px;
  --focus-offset: 3px;
  --ease-out: cubic-bezier(.16,1,.3,1);
  --dur-fast: 100ms;
  --dur-base: 160ms;
}
:root, [data-theme="terang"] {
  color-scheme: light;
  --color-background: #FAFAF9;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F3F5;
  --color-text: #171A1F;
  --color-text-secondary: #59616D;
  --color-border: #D9DEE5;
  --color-control-border: #77818E;
  --color-accent: #FF8878;
  --color-on-accent: #25140F;
  --color-selected-surface: #FFF0EC;
  --color-expense: #B93F38;
  --color-income: #177247;
  --color-transfer: #245FD1;
  --color-focus: #245FD1;
  --color-link: #A93D31;
  --color-warning: #805000;
  --color-warning-surface: #FDF1DC;
  --color-expense-surface: #FBEAE8;
  --color-income-surface: #E5F3EA;
  --color-transfer-surface: #E7EEFC;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
[data-theme="gelap"] {
  color-scheme: dark;
  --color-background: #151719;
  --color-surface: #202326;
  --color-surface-muted: #292D31;
  --color-text: #F3F5F7;
  --color-text-secondary: #B2B8C0;
  --color-border: #444A52;
  --color-control-border: #8C96A3;
  --color-accent: #FF9585;
  --color-on-accent: #281510;
  --color-selected-surface: #382D2B;
  --color-expense: #FF9C91;
  --color-income: #7BD8A3;
  --color-transfer: #9DBFFF;
  --color-focus: #9DBFFF;
  --color-link: #FFB4A7;
  --color-warning: #FFE199;
  --color-warning-surface: #3D3321;
  --color-expense-surface: #3B2828;
  --color-income-surface: #1D3529;
  --color-transfer-surface: #20314A;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
[data-theme="krem"] {
  color-scheme: light;
  --color-background: #F6F0E6;
  --color-surface: #FFFCF6;
  --color-surface-muted: #EEE6D9;
  --color-text: #2B231D;
  --color-text-secondary: #65594C;
  --color-border: #D8CCB9;
  --color-control-border: #81715F;
  --color-accent: #FF8878;
  --color-on-accent: #25140F;
  --color-selected-surface: #F9E5DB;
  --color-expense: #A3352B;
  --color-income: #24613E;
  --color-transfer: #2D5597;
  --color-focus: #2D5597;
  --color-link: #973C30;
  --color-warning: #775008;
  --color-warning-surface: #F5E9C9;
  --color-expense-surface: #F6E3DA;
  --color-income-surface: #E5ECD9;
  --color-transfer-surface: #E3E8F1;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
[data-theme="biru"] {
  color-scheme: dark;
  --color-background: #0D1B2A;
  --color-surface: #16283B;
  --color-surface-muted: #20364D;
  --color-text: #F1F5FB;
  --color-text-secondary: #B6C5D8;
  --color-border: #3A5069;
  --color-control-border: #819AB6;
  --color-accent: #FF9585;
  --color-on-accent: #281510;
  --color-selected-surface: #3E2D31;
  --color-expense: #FFAAA0;
  --color-income: #8BE0AC;
  --color-transfer: #AACBFF;
  --color-focus: #AACBFF;
  --color-link: #FFB4A7;
  --color-warning: #FFE09A;
  --color-warning-surface: #403829;
  --color-expense-surface: #442D39;
  --color-income-surface: #203C36;
  --color-transfer-surface: #223B59;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
[data-theme="kontras"] {
  color-scheme: light;
  --color-background: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-surface-muted: #FFFFFF;
  --color-text: #000000;
  --color-text-secondary: #1A1A1A;
  --color-border: #000000;
  --color-control-border: #000000;
  --color-accent: #000000;
  --color-on-accent: #FFFFFF;
  --color-selected-surface: #FFFFFF;
  --color-expense: #A30000;
  --color-income: #005A1E;
  --color-transfer: #0030B8;
  --color-focus: #0030B8;
  --color-link: #0030B8;
  --color-warning: #6B3D00;
  --color-warning-surface: #FFFFFF;
  --color-expense-surface: #FFFFFF;
  --color-income-surface: #FFFFFF;
  --color-transfer-surface: #FFFFFF;
  --color-error: var(--color-expense);
  --rule-thin: 2px;
}
[data-theme="sage"] {
  color-scheme: light;
  --color-background: #F0F4EE;
  --color-surface: #FBFCF8;
  --color-surface-muted: #E3EBDD;
  --color-text: #202B24;
  --color-text-secondary: #4C5E51;
  --color-border: #C5D0C0;
  --color-control-border: #6C7D6F;
  --color-accent: #FF8878;
  --color-on-accent: #25140F;
  --color-selected-surface: #F5E6DB;
  --color-expense: #A5342C;
  --color-income: #255E3B;
  --color-transfer: #2A5593;
  --color-focus: #2A5593;
  --color-link: #963E31;
  --color-warning: #745009;
  --color-warning-surface: #F0E8D0;
  --color-expense-surface: #F4E2DA;
  --color-income-surface: #E0EBD8;
  --color-transfer-surface: #E1E9EF;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
@media (prefers-color-scheme: dark) {
:root:not([data-theme]), :root[data-theme="otomatis"] {
  color-scheme: dark;
  --color-background: #151719;
  --color-surface: #202326;
  --color-surface-muted: #292D31;
  --color-text: #F3F5F7;
  --color-text-secondary: #B2B8C0;
  --color-border: #444A52;
  --color-control-border: #8C96A3;
  --color-accent: #FF9585;
  --color-on-accent: #281510;
  --color-selected-surface: #382D2B;
  --color-expense: #FF9C91;
  --color-income: #7BD8A3;
  --color-transfer: #9DBFFF;
  --color-focus: #9DBFFF;
  --color-link: #FFB4A7;
  --color-warning: #FFE199;
  --color-warning-surface: #3D3321;
  --color-expense-surface: #3B2828;
  --color-income-surface: #1D3529;
  --color-transfer-surface: #20314A;
  --color-error: var(--color-expense);
  --rule-thin: 1px;
}
}
@media (forced-colors: active) {
:root { --color-focus: Highlight; --color-control-border: ButtonText; }
}
```

### 7.3 Penggunaan warna

- Coral menandai CTA utama dan pilihan aktif secara hemat.
- Gunakan `--color-on-accent` untuk teks tombol coral. Jangan menggantinya dengan putih tanpa memeriksa kontras.
- Pemasukan/pengeluaran/transfer dibedakan lewat label, tanda, dan konteks; warna merupakan penguat.
- `--color-border` hanya untuk pemisah dekoratif/pengelompokan. Jika garis diperlukan untuk mengenali kontrol, gunakan `--color-control-border` atau indikator lain yang cukup kontras.
- Jangan menurunkan opacity seluruh card untuk membuat teks sekunder; gunakan token warna teks yang sesuai.
- Ikuti tema OS jika preferensi pengguna adalah Ikuti HP. Pilihan eksplisit pengguna mengalahkan tema OS.
- Tema Biru Laut, Krem, dan Kontras Tinggi yang sudah tersedia tetap dipetakan ke peran token yang sama dan diuji sendiri.
- Perubahan tema tidak mengubah data, posisi pengguna, atau draft.

Pemeriksaan numerik sRGB mencakup enam tema. Teks diperiksa terhadap background, surface, surface muted, dan selected surface. Semantic text juga diperiksa pada surface semantiknya sendiri. Angka berikut adalah rasio terendah per kelompok.

| Tema | Teks utama | Sekunder | Teks semantik terendah | Link | Teks CTA | Batas kontrol |
| --- | --- | --- | --- | --- | --- | --- |
| Terang | 15.68:1 | 5.63:1 | 4.93:1 | 5.55:1 | 7.63:1 | 3.55:1 |
| Gelap | 12.17:1 | 6.66:1 | 6.60:1 | 7.82:1 | 8.21:1 | 4.44:1 |
| Krem | 12.46:1 | 5.49:1 | 5.47:1 | 5.64:1 | 7.63:1 | 3.80:1 |
| Biru Laut | 11.32:1 | 7.05:1 | 6.79:1 | 7.27:1 | 8.21:1 | 4.26:1 |
| Kontras Tinggi | 21.00:1 | 17.40:1 | 8.21:1 | 9.93:1 | 21.00:1 | 21.00:1 |
| Sage | 12.00:1 | 5.68:1 | 5.50:1 | 5.67:1 | 7.63:1 | 3.58:1 |

Coral fill tidak dipakai sebagai warna teks kecil pada surface terang. Link, ikon aktif, dan petunjuk terpilih memakai `--color-link`; focus ring memakai `--color-focus`. Pemeriksaan token tidak menggantikan pemeriksaan UI terintegrasi, opacity, state, dan background sebenarnya. Detail rasio terdapat di [laporan aset](kemana-assets/asset-report.json).

### 7.4 Tipografi dan angka

- Font eksternal tidak dibutuhkan. Variasi bentuk huruf antar OS dapat diterima.
- Ukuran body dan field input awal 1 rem; hormati pengaturan ukuran teks yang sudah ada.
- Gunakan weight 400 untuk isi, 500–600 untuk label/judul, dan 600–700 untuk nominal utama.
- Gunakan `font-variant-numeric: tabular-nums` pada nominal agar kolom stabil bila font mendukung.
- Jangan memakai animasi hitung angka pada saldo atau input nominal.
- Jangan memakai huruf kapital semua untuk paragraf atau instruksi.
- Nominal input panjang tidak boleh dipotong. Kurangi ukuran hanya sampai batas terbaca; jika masih panjang, izinkan area input horizontal yang terkontrol dengan nilai penuh tersedia untuk teknologi bantu.
- Di riwayat dan ringkasan, pindahkan nominal panjang ke baris berikutnya sebelum mengorbankan keterbacaan.

### 7.5 Spacing, surface, dan ikon

- Gunakan kelipatan 4 px; utamakan jarak 8, 12, 16, dan 24 px.
- Gunakan whitespace atau separator tipis sebelum membungkus setiap elemen dalam card.
- Card mengelompokkan informasi yang memiliki satu tujuan, bukan setiap baris data.
- Bayangan hanya bila membantu membedakan overlay; hindari shadow berlapis pada kontrol rutin.
- Gunakan ikon SVG yang sudah dimiliki proyek atau SVG kecil lokal. Jangan memuat seluruh paket ikon lewat CDN.
- Ukuran ikon umumnya 20–24 px dengan target sentuh yang lebih besar.
- Ikon dekoratif tidak ikut dibacakan screen reader.

### 7.6 Tema yang disetujui

| Label | ID existing/stabil | Mode | Peran |
| --- | --- | --- | --- |
| Terang | `terang` | Light | Putih hangat; default visual |
| Gelap | `gelap` | Dark | Arang netral dengan coral lembut |
| Krem | `krem` | Light | Gading hangat, teks cokelat gelap |
| Biru Laut | `biru` | Dark | Navy; variasi gelap yang lebih berkarakter |
| Kontras Tinggi | `kontras` | Light | Hitam-putih, batas tegas, CTA hitam-putih |
| Sage | `sage` | Light | Hijau pucat netral; opsional |

- Lima tema pertama merupakan set utama. Sage disiapkan tetapi opsi di pengaturan boleh belum ditampilkan.
- `otomatis`/Ikuti perangkat adalah preferensi yang memilih Terang atau Gelap, bukan tema tambahan.
- Pertahankan ID existing dan data ukuran teks. Jangan mengganti key preferensi hanya untuk memakai palette baru.
- Boot script yang diperiksa menggunakan whitelist tema; jika Sage ditawarkan, tambahkan `sage` pada whitelist yang relevan tanpa mengganti storage `ck.prefs`.
- Tema tidak mengganti layout, font, ukuran target sentuh, ikon, atau makna jenis transaksi. Kontras Tinggi boleh mempertegas garis dengan `--rule-thin: 2px`.
- Saat mode otomatis dipilih, perubahan tema OS ketika app aktif diikuti tanpa menghapus draft. Saat tema eksplisit dipilih, OS tidak menimpanya.
- Biru Laut pada CSS live yang diperiksa masih biru terang. Rancangan baru yang disepakati adalah navy gelap dengan ID `biru` tetap; perubahan ini perlu ditunjukkan dengan label/deskripsi yang jelas.
- Ikon instalasi memakai k putih gading pada gradient petrol yang konsisten pada semua tema. Token kontrol UI dan warna semantik mengikuti tabel tema, bukan warna gradient launcher.

### 7.7 Paket aset dan aturan pemuatan

- [Panduan integrasi](kemana-assets/README.md), [pratinjau tema/ikon](kemana-assets/preview/index.html), dan [laporan ukuran/kontras](kemana-assets/asset-report.json) menyertai spesifikasi.
- 20 ikon inti menggunakan satu sprite SVG. Dua ikon dompet tambahan dan 15 ikon kategori tersedia sebagai sprite opsional; E-Wallet memakai ulang ikon dompet inti.
- Semua ikon UI menggunakan `currentColor` lewat inline SVG atau same-origin `<use>`, bukan mewarisi warna dari `<img>`.
- Satu master k diturunkan menjadi PNG 192/512, maskable 512, Apple touch 180, dan favicon 32/SVG. Tidak ada enam set bitmap untuk enam tema.
- Load hanya CSS dan ikon yang dipakai. Preview, sumber pengembangan, laporan, dan ZIP tidak termasuk precache atau initial load.
- Paket tidak menambah JavaScript runtime, dependency runtime, atau request font.
- Ukuran terukur dan batas verifikasi dicatat dalam laporan; belum merupakan hasil pengukuran app terintegrasi.

### 7.8 Identitas ikon yang dipilih

- Keputusan 6 November 2026: simbol k pada draft v7 menjadi ikon Kemana. Batang kiri dan lengan kanan dipisahkan oleh sambungan terbuka; bentuk SVG mengikuti proporsi draft yang dipilih.
- Simbol: #F7F8F5. Latar: gradient tipis #416F74 ke #2E5359, dari kiri atas ke kanan bawah. Warna brand datar: #355F65. Gradient hanya pada latar, tanpa tekstur, bayangan, atau efek timbul.
- Master full-bleed: [icon-square.svg](kemana-assets/sources/icon-square.svg). Untuk presentasi web: [icon.svg](kemana-assets/assets/brand/icon.svg). Simbol monokrom tanpa latar: [mark.svg](kemana-assets/assets/brand/mark.svg).
- Ikon launcher memuat simbol k saja. Wordmark kemana pada draft merupakan elemen terpisah, sehingga tidak mengecilkan simbol di layar utama perangkat.
- Semua PNG instalasi berlatar opak hingga tepi dan menggunakan geometri yang sama. Area penting tetap dalam lingkaran pusat beradius 40% kanvas; sudut serta pemotongan ikon mengikuti OS. Favicon SVG memakai sudut membulat untuk tampilan browser.
- [Pratinjau ikon](kemana-assets/preview/icon-sheet.png) memperlihatkan potongan kotak membulat, lingkaran, area aman, dan ukuran kecil. Ini pratinjau aset; uji instalasi pada perangkat dilakukan setelah integrasi.
- Artefak PNG draft tidak dimuat ke aplikasi; gunakan aset produksi SVG/PNG kecil pada paket ini. Tidak ada dependency atau font baru untuk ikon.
- Workspace saat pembaruan hanya berisi spesifikasi/aset, sehingga keputusan ini belum mengubah situs live. Panduan manifest dan HTML ada di README paket.

## 8. Spesifikasi layar Catat

### 8.1 Hierarki dan susunan

Urutan visual awal:

1. Judul Catat dan status singkat bila diperlukan.
2. Pilihan Pengeluaran / Pemasukan / Transfer.
3. Nominal sebagai fokus utama; tombol Nota tetap sekunder.
4. Kategori terpilih serta pilihan cepat yang relevan.
5. Dompet dan tanggal dalam baris ringkas yang tetap terbaca.
6. Catat cepat bila tersedia; catatan opsional mudah dijangkau.
7. Keypad yang ringan.
8. Tombol simpan yang menyebutkan jenis transaksi.
9. Navigasi utama.

Penempatan Catat cepat/catatan dapat disesuaikan setelah uji layar pendek. Nominal, metadata terpilih, dan akses simpan tidak boleh dikorbankan untuk memenuhi susunan ideal.

### 8.2 Pilihan jenis transaksi

- Gunakan segmented control dengan tiga pilihan yang jelas.
- Gunakan radio group untuk satu nilai jenis transaksi; jangan memodelkannya sebagai tiga checkbox independen.
- State aktif menggunakan surface/weight/check selain warna.
- Mengganti jenis menampilkan field yang relevan dan menjaga input yang masih masuk akal.
- Label CTA: `Simpan pengeluaran`, `Simpan pemasukan`, atau `Simpan transfer`.

### 8.3 Nominal

- Prefix `Rp` lebih kecil daripada angka, tetapi tidak terlalu redup.
- Gunakan format Indonesia, misalnya `Rp 25.000`, mengikuti kemampuan mata uang produk saat ini.
- Nilai mentah disimpan terpisah dari teks yang diformat.
- Untuk rupiah bulat, gunakan satuan integer; tolak NaN, nilai di luar rentang aman/schema, dan input yang tidak valid sebelum simpan.
- Nol/kosong mengikuti aturan transaksi produk; jangan menyimpan transaksi nominal nol tanpa dukungan aturan yang jelas.
- Mendukung keyboard fisik, paste, backspace, dan pengeditan nilai.
- Jika parsing paste ambigu, tampilkan pesan yang dapat diperbaiki; jangan diam-diam mengubah nominal.
- Hindari `type="number"` jika spinner atau parser browser membuat format rupiah bermasalah. `type="text"` dengan `inputmode="numeric"` adalah baseline yang dapat dipakai; validasi tetap diperlukan.
- Nilai maksimum dan jumlah digit mengikuti model data yang diaudit saat implementasi, bukan batas visual yang dibuat sembarang.

`inputmode` memberikan petunjuk keyboard, bukan validasi input. Rujukan: [MDN — inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode).

### 8.4 Keypad

- Pertahankan susunan 1–9, `000`, `0`, dan hapus yang sudah dikenali pengguna.
- Kurangi border/latar kotak; gunakan state tekan yang jelas.
- Setiap tombol minimal 44 × 44 CSS px pada ukuran teks normal.
- Ukuran angka sekitar 1.5–1.75 rem; sesuaikan tanpa mengurangi target sentuh.
- Hapus satu digit selalu tersedia. Long press untuk hapus semua hanya enhancement; ada alternatif yang dapat ditemukan jika fungsi tersebut dibutuhkan.
- Tombol `000` tidak membuat nilai melewati batas model data.
- Keypad kustom tidak menjadi satu-satunya jalan input. Input native dan keyboard desktop tetap berfungsi.
- Perubahan digit tidak menunggu jaringan, animasi, atau render ringkasan.

### 8.5 Kategori

- Tampilkan awal 4–6 kategori yang relevan bila ruang cukup, beserta `Lainnya`/`Semua kategori`.
- Pada layar sempit atau teks besar, kurangi jumlah yang tampil dan izinkan wrap; jangan menambah horizontal scroll tersembunyi.
- Pilihan lanjutan membuka panel pemilih sederhana. Nama kategori tetap tampil; ikon bukan satu-satunya identitas.
- Urutan favorit mengikuti preferensi pengguna bila sudah tersedia. Jika belum, gunakan urutan stabil; tidak perlu mesin rekomendasi baru.
- Kategori terpilih dari daftar lanjutan tetap terlihat setelah panel ditutup.
- Saat daftar kosong, sediakan aksi tambah kategori yang sudah ada.
- Pencarian kategori hanya perlu bila jumlah kategori memang menyulitkan pemilihan.

### 8.6 Dompet, tanggal, dan catatan

- Nama dompet terpilih terlihat sebelum simpan.
- Pilih dompet dengan kontrol yang paling sederhana dan aksesibel; native select dapat digunakan jika cukup.
- Tanggal ditampilkan sebagai `Hari ini`/`Kemarin` bila sesuai, dengan tanggal pasti tersedia ketika diedit.
- Prioritaskan date picker native; gunakan label dan fallback input yang dapat dimengerti bila perilakunya berbeda.
- Simpan tanggal transaksi sebagai tanggal kalender lokal sesuai skema produk. Hindari mengubah date-only menjadi tanggal berbeda karena konversi UTC.
- Catatan mempunyai label `Catatan (opsional)`, bukan placeholder sebagai satu-satunya label.
- Field tidak wajib boleh dibuat ringkas, tetapi catatan yang telah diisi tetap terlihat/dapat diperiksa.

Tampilan date picker dapat mengikuti browser/OS; tampilan yang identik bukan persyaratan. Rujukan: [MDN — input date](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date).

### 8.7 Catat cepat

- Pertahankan makna fitur saat ini: sekali ketuk dapat langsung mencatat transaksi.
- Label menjelaskan aksi dan nominal, misalnya `Catat Kopi · Rp 15.000`, dengan dompet tetap diketahui.
- Jangan mengubah perilaku menjadi hanya mengisi form sambil mempertahankan janji `sekali ketuk`.
- Setelah berhasil, sediakan feedback singkat dan jalan ke transaksi/edit yang sudah ada.
- Lindungi dari ketuk ganda pada satu proses penyimpanan tanpa memblokir penggunaan berikutnya.
- Jika Undo benar-benar didukung, tawarkan. Jika tidak, jangan menampilkan Undo yang tidak dapat memulihkan data.

### 8.8 Nota atau screenshot

- Tetap merupakan bantuan opsional; input manual selalu tersedia.
- Pengguna memilih file/kamera setelah mengetuk aksi yang jelas.
- Jika akses kamera tidak tersedia atau ditolak, pemilihan file menjadi fallback bila didukung.
- Jangan mengunduh mesin OCR, model AI, atau library gambar besar ketika layar Catat pertama dibuka.
- Hasil ekstraksi harus diperiksa pengguna sebelum disimpan sebagai transaksi.
- Kegagalan ekstraksi mempertahankan draft manual dan memberi aksi coba lagi atau lanjut manual.
- Jika fitur memakai layanan eksternal, jelaskan pengiriman file pada konteks aksi; jangan mengunggah foto otomatis.
- Alur bantuan yang sudah ada dipertahankan; perubahan visual tidak menjadi proyek OCR baru.

### 8.9 Simpan dan validasi

- Jangan menambah dialog konfirmasi pada simpan rutin.
- Validasi di dekat field dan fokuskan field bermasalah setelah submit, tanpa menghapus nilai lain.
- Selama satu transaksi sedang diproses, cegah submit ganda; label dapat menjadi `Menyimpan…`.
- Disable tombol hanya dengan alasan yang dapat dipahami. Jika pengguna perlu tahu field yang kurang, submit boleh memicu validasi yang jelas.
- Setelah sukses sesuai janji storage, kosongkan nominal dan detail spesifik transaksi; pertahankan default yang memang membantu sesuai perilaku produk.
- Setelah gagal, draft tetap utuh dan aksi coba lagi jelas.
- Jangan mengulang POST/write non-idempoten secara membabi buta setelah timeout.

### 8.10 Transfer

- Tampilkan `Dari dompet` dan `Ke dompet` secara eksplisit.
- Cegah asal dan tujuan yang sama jika tidak didukung aturan produk.
- Nominal perpindahan terlihat konsisten di riwayat dan detail.
- Kedua sisi transfer harus tetap konsisten setelah retry, refresh, dan sinkronisasi.
- Biaya transfer hanya ditangani bila model produk sudah mendukungnya; jangan menyisipkan aturan biaya baru lewat redesign.

## 9. Spesifikasi layar Riwayat

### 9.1 Hierarki

1. Judul dan pemilih periode.
2. Pencarian.
3. Filter jenis transaksi.
4. Total periode/filter dengan lingkup yang jelas.
5. Kelompok transaksi per tanggal.

- Gunakan satu daftar berkelompok; tidak perlu card terpisah untuk setiap transaksi.
- Label kelompok seperti `Hari ini` disertai jumlah harian jika sesuai aturan produk.
- Pemilih periode menjaga konteks saat membuka/menutup detail.
- Filter multi/ single mengikuti kebutuhan; untuk satu pilihan jenis, gunakan kontrol single-select yang benar.

### 9.2 Anatomi baris transaksi

| Elemen | Prioritas | Aturan |
| --- | --- | --- |
| Catatan yang tersedia | Utama | Contoh `Makan siang`; bungkus bila perlu |
| Kategori bila catatan kosong | Utama | Hindari judul kosong atau teks buatan |
| Kategori + dompet | Sekunder | Tetap dapat dibaca; jangan menduplikasi informasi tanpa alasan |
| Nominal | Utama | Rata kanan bila ruang cukup, penuh dan tidak terpotong |
| Jenis/indikator | Pendukung | Label/tanda ditambah warna |
| Status belum sinkron bila relevan | Penting | Singkat; jangan menyaru sebagai sukses server |

- Seluruh baris dapat membuka detail dengan target yang jelas, tanpa tombol bersarang yang membingungkan.
- Nominal pengeluaran/pemasukan memakai tanda secara konsisten dengan model data.
- Transfer menyebut asal → tujuan; arah tidak hanya bergantung pada ikon.
- Pada layar sempit/teks besar, nominal boleh turun ke baris baru.
- Bila catatan/kategori panjang, akses isi penuh tersedia di baris yang membungkus atau detail.

### 9.3 Pencarian dan daftar panjang

- Pencarian memakai data yang tersedia tanpa request jaringan per ketikan bila bisa dilakukan lokal.
- Jangan memindahkan fokus atau mereset scroll untuk setiap karakter.
- Debounce pendek hanya bila diperlukan oleh biaya pemrosesan/jaringan.
- Kondisi `Belum ada transaksi` dibedakan dari `Tidak ada hasil pencarian`.
- Error memuat tidak ditampilkan sebagai periode kosong.
- Mulai dari pagination atau tombol muat lebih banyak yang sederhana jika daftar panjang bermasalah.
- Virtualisasi hanya setelah profiling membuktikan kebutuhan; pertimbangkan screen reader, pencarian, dan pemulihan scroll.

### 9.4 Makna total

Total yang ditampilkan harus menyebut lingkupnya: periode saja atau hasil pencarian/filter. Jangan mengubah lingkup perhitungan yang sudah ada hanya untuk menyamakan tampilan dengan contoh. Jika total periode tetap tampil saat pencarian, beri label yang membuat perbedaannya jelas.

## 10. Spesifikasi layar Ringkasan

Urutan awal yang dipertahankan:

1. Saldo saat ini dan rincian dompet.
2. Pemilih periode.
3. Arus uang: pemasukan, pengeluaran, dan sisa periode.
4. `Uang ke mana saja`: daftar kategori berdasarkan nominal.
5. Sumber pemasukan dan riwayat enam bulan bila sudah tersedia.

Aturan:

- Saldo saat ini tidak dilabel ulang sebagai sisa bulan ini.
- Jangan memakai saldo total seluruh waktu sebagai hasil filter bulanan.
- Jelaskan istilah sisa melalui label yang cukup, tanpa paragraf tutorial panjang.
- Untuk komposisi kategori, daftar dengan bar horizontal sederhana menjadi pilihan awal; tidak perlu donut/chart baru.
- Nama kategori, nominal, dan persentase tetap tersedia sebagai teks.
- Urutkan kategori secara stabil berdasarkan nilai; kategori nol dapat disembunyikan dari ringkasan bila tidak membantu, tetapi tidak dihapus dari pengaturan.
- Tangani pengeluaran nol tanpa pembagian nol, NaN, atau grafik menyesatkan.
- Pembulatan persentase boleh membuat total tampak sedikit berbeda dari 100%; jangan memalsukan nominal untuk memperbaikinya.
- Grafik enam bulan memakai label yang terbaca dan padanan teks; warna bukan satu-satunya pembeda seri.
- Render ringkasan ketika dibuka; jangan hitung ulang seluruh grafik pada setiap tekan keypad.
- Kartu saldo boleh lebih kuat dari area lain. Grafik tidak perlu lebih mencolok daripada angka yang dijelaskan.
- Tindakan mencocokkan saldo dompet menyebutkan akibatnya sesuai aturan produk. Jangan mengubah saldo awal/riwayat tanpa penjelasan.

## 11. Spesifikasi layar Pengaturan

Kelompok awal:

- Akun dan lokasi penyimpanan data.
- Dompet.
- Kategori pengeluaran dan pemasukan.
- Tampilan dan ukuran teks.
- Data contoh serta informasi aplikasi.

Aturan:

- Gunakan section heading dan baris pengaturan; hindari banyak card bersarang.
- Status demo berbeda jelas dari akun Google yang terhubung.
- Jelaskan penyimpanan perangkat dan spreadsheet dengan bahasa singkat sesuai keadaan sebenarnya.
- Penghapusan data contoh tetap terpisah dari penghapusan data pengguna.
- Sebelum logout/pergantian akun, periksa transaksi yang belum sinkron; jangan menghapus antreannya diam-diam.
- Menghapus kategori/dompet yang sudah dipakai menjelaskan dampak pada transaksi lama dan mengikuti perilaku produk yang sudah ada.
- Preferensi tema dan ukuran teks dipersistenkan; kegagalan menyimpan preferensi tidak memengaruhi transaksi.
- Bantuan instal PWA kontekstual dengan browser, dan tidak menjanjikan tombol instal pada setiap platform.
- Pesan versi/update tidak mendesak pengguna menghapus cache/storage sebagai langkah normal.

## 12. Komponen dan state interaksi

Gunakan komponen yang sudah tersedia bila memadai. Daftar ini merupakan kontrak perilaku, bukan keharusan membuat library komponen baru.

| Komponen | Perilaku minimum |
| --- | --- |
| Tombol utama | Satu aksi paling penting per konteks; label spesifik; loading mencegah submit ganda |
| Tombol sekunder | Surface netral/ghost; tetap dapat dikenali sebagai aksi |
| Pilihan jenis/filter | Selected terbaca tanpa warna; semantik single/multi sesuai fungsi |
| Field | Label tetap, nilai terbaca, helper/error terhubung secara aksesibel |
| Daftar transaksi | Urutan informasi konsisten; isi dan nominal penuh dapat diakses |
| Pemilih dompet/kategori | Pilihan aktif jelas; membuka/menutup tidak mereset form |
| Pesan status | Singkat dan sesuai keadaan data; tidak mencuri fokus |
| Error | Aksi pemulihan terlihat; tidak hilang sebelum dapat dibaca |
| Dialog/panel | Judul, tutup/batal, urutan fokus, scroll, dan pengembalian fokus benar |

State yang harus dipikirkan: default, hover, focus-visible, pressed/active, disabled, loading, error, dan success. Terapkan hanya state yang relevan; tidak perlu membuat delapan variasi palsu pada setiap elemen.

### 12.1 Panel pemilih dan dialog

- Pada ponsel, panel bawah dapat dipakai; pada desktop boleh dialog yang sederhana.
- Dialog modal mengelola fokus dan mencegah fokus masuk ke konten belakang.
- Escape/tombol tutup/batal tersedia; drag turun bukan satu-satunya jalan menutup.
- Fokus dikembalikan ke kontrol pembuka ketika ditutup.
- Klik backdrop hanya menutup jika tidak membuang input penting tanpa penanganan.
- Gunakan `<dialog>` bila sudah sesuai dukungan target/implementasi; fallback dapat berupa pemilih inline atau native select, bukan polyfill besar.
- Panel panjang punya area scroll yang dapat digunakan dengan sentuh dan keyboard.
- Untuk kategori/dompet, native control yang memenuhi kebutuhan lebih baik daripada modal baru yang sulit dirawat.

### 12.2 Motion dan feedback

- Durasi awal 100–160 ms, hanya bila membantu memahami perubahan state.
- Tidak ada splash screen wajib, animasi masuk seluruh halaman, parallax, shimmer terus-menerus, atau count-up saldo.
- Animasikan opacity/transform bila diperlukan; jangan memakai `transition: all`.
- `prefers-reduced-motion: reduce` meniadakan gerak spasial; perubahan boleh langsung atau memakai opacity singkat.
- Focus ring muncul segera dan tidak dianimasikan.
- Feedback sukses tidak memakai konfeti atau memblokir transaksi berikutnya.
- Getaran/suara opsional dan tidak menjadi petunjuk tunggal.

## 13. Bahasa UI dan microcopy

Gunakan bahasa Indonesia yang langsung, pendek, dan menyebut aksi/keadaan sebenarnya.

| Konteks | Contoh |
| --- | --- |
| Field wajib kosong | `Pilih kategori pengeluaran.` |
| Nominal tidak valid | `Masukkan nominal lebih dari Rp 0.` — jika sesuai aturan produk |
| Berhasil lokal | `Tersimpan di perangkat.` |
| Menunggu sinkron | `Tersimpan di perangkat. Menunggu koneksi.` |
| Sesi autentikasi berakhir | `Masuk lagi untuk menyinkronkan. Catatan di perangkat tetap tersedia.` — hanya bila benar |
| Gagal menulis lokal | `Belum tersimpan. Coba lagi.` |
| Tidak ada transaksi periode | `Belum ada transaksi bulan ini.` |
| Hasil pencarian kosong | `Tidak ada transaksi yang cocok.` |
| Pembaruan siap | `Versi baru tersedia.` dengan aksi `Perbarui` dan `Nanti` |
| Storage tidak tersedia | `Penyimpanan perangkat tidak tersedia. Data belum tersimpan.` |

- Jangan menulis `Aman tersimpan` bila durabilitas belum dapat dipastikan.
- Jangan menampilkan istilah teknis seperti IndexedDB, service worker, atau kode HTTP pada alur pengguna biasa.
- Detail teknis dapat ditempatkan pada diagnostik yang sengaja dibuka.
- Jangan menampilkan toast untuk setiap perubahan chip, digit, atau tab.

## 14. Aksesibilitas

Target implementasi adalah WCAG 2.2 AA pada lingkup UI terkait. Dokumen ini menetapkan target, bukan menyatakan aplikasi telah lolos audit.

- Teks biasa memiliki rasio kontras minimal 4.5:1; teks besar sesuai definisi WCAG minimal 3:1.
- Kontrol/indikator penting memiliki kontras nonteks yang memadai; verifikasi state aktif dan focus ring pada surface sebenarnya.
- Target sentuh Kemana minimal 44 × 44 CSS px untuk aksi utama dan keypad. Ini pilihan produk; bukan klaim bahwa seluruh WCAG AA menetapkan 44 px.
- Target yang berdekatan mempunyai jarak agar tidak mudah salah ketuk.
- Semua fungsi utama dapat dioperasikan dengan keyboard.
- Urutan tab mengikuti urutan baca; tidak ada keyboard trap.
- Nominal, date picker, dan kontrol berikon memiliki label aksesibel.
- Gunakan `<button>`, `<input>`, `<label>`, heading, dan landmark native sebelum menambah ARIA.
- Gunakan radio group untuk satu pilihan dan checkbox untuk pilihan independen.
- Navigasi memakai link atau tab pattern sesuai mekanisme aplikasi; semantik dan keyboard harus konsisten.
- Error field terhubung dengan `aria-describedby` dan `aria-invalid` ketika relevan.
- Pesan selesai/gagal memakai live region secara hemat; jangan membacakan ulang seluruh halaman pada setiap ketikan.
- Jangan mengumumkan setiap digit melalui live region selain mekanisme input normal.
- Zoom 200% tetap dapat digunakan; reflow setara lebar 320 CSS px tidak kehilangan tugas/isi penting.
- Dukung text scaling/pilihan teks besar tanpa tombol atau label tertutup.
- Periksa VoiceOver, TalkBack, dan minimal satu screen reader desktop pada alur utama.
- Pada mode forced colors, jangan menghapus warna/outline sistem yang diperlukan untuk membaca kontrol.

Rujukan: [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/), khususnya kontras, reflow, keyboard, label/error, target size, dan focus not obscured.

## 15. Kompatibilitas lintas OS dan browser

### 15.1 Definisi dukungan

`Berfungsi di semua OS` diterjemahkan menjadi: fungsi inti bekerja pada browser modern di OS sasaran, dengan layout sesuai ruang layar dan fallback untuk kemampuan tambahan. Fitur instalasi, background task, file/camera, dan kontrol native tidak harus identik.

Tidak ada klaim kompatibilitas universal untuk browser/OS usang tanpa batas. Saat rilis, catat versi minimum yang benar-benar diuji dan keterbatasan yang ditemukan.

Fungsi inti: membuka aplikasi online, memasukkan transaksi secara manual, melihat riwayat, membaca ringkasan, serta mengelola pengaturan yang didukung akun/storage. Offline mempunyai prasyarat tersendiri di bagian PWA.

### 15.2 Matriks sasaran pengujian

Semua baris berikut adalah sasaran; status awal **belum diverifikasi pada perangkat fisik**.

| Platform | Browser/konteks utama | Hal yang diprioritaskan |
| --- | --- | --- |
| Android | Chrome; Samsung Internet bila digunakan audiens; browser + PWA terpasang | Keyboard, layar kecil, offline, Back, kamera/file |
| iPhone | Safari; browser iOS lain yang digunakan audiens; browser + Add to Home Screen bila tersedia | Safe area, keyboard, pemulihan app, autentikasi, storage |
| iPadOS | Safari; portrait, landscape, split view | Lebar dinamis, panel pemilih, keyboard fisik |
| Windows | Edge, Chrome, Firefox | Keyboard, focus, zoom, autentikasi, mode instal bila tersedia |
| macOS | Safari, Chrome, Firefox | Kontrol native, keyboard, tema, mode aplikasi web bila tersedia |
| Linux | Chrome/Chromium dan Firefox | Fungsi web inti, keyboard, fallback instal |
| ChromeOS | Chrome, termasuk mode jendela | Resize, touch + keyboard, install bila tersedia |

Target awal: versi stabil saat pengujian dan satu rilis mayor sebelumnya bila perangkat tersedia. Tambahkan versi lebih lama berdasarkan kebutuhan pengguna nyata; jangan menambah polyfill luas tanpa kasus yang dibuktikan.

### 15.3 Progressive enhancement

| Kemampuan | Jika tersedia | Jika tidak tersedia |
| --- | --- | --- |
| Instal PWA | Aksi/instruksi sesuai browser | Aplikasi web tetap berfungsi; bantuan instal tidak memaksa |
| Service worker | Shell/cache offline sesuai strategi | Aplikasi online tetap berfungsi; tidak menjanjikan offline |
| Background Sync | Dapat membantu antrean | Retry saat aplikasi dibuka/aktif dan aksi coba lagi |
| Kamera langsung | Menangkap nota setelah aksi pengguna | Pilih file atau input manual |
| Native date picker | Gunakan kontrol browser | Field tanggal yang tetap dapat diisi dan divalidasi |
| Dialog native | Panel aksesibel | Select/pemilih inline atau fallback sederhana |
| CSS/unit baru | Enhancement di atas baseline | Layout flow dan unit yang telah didukung |
| Persistensi storage | Gunakan jika didukung dan layak | Jelaskan keadaan storage; jangan menganggap persistensi terjamin |

- Gunakan feature detection; jangan menebak kemampuan hanya dari nama OS atau user-agent.
- Perbedaan font, date picker, scrollbar, dan bentuk select antar OS diterima.
- Error pada fitur tambahan tidak boleh mematikan navigasi, input manual, atau render riwayat.
- Jangan memerlukan wrapper native, Electron, atau instalasi aplikasi tambahan untuk redesign ini.

## 16. PWA: instalasi, offline, dan pembaruan

### 16.1 Instalasi

- Sajikan lewat HTTPS pada produksi.
- Periksa manifest, nama/short name, ikon 192/512, ikon maskable yang sesuai, start URL, scope, dan display mode.
- Path harus sesuai deployment subdirektori `/kemana-app/`; jangan mengasumsikan root `/` milik aplikasi ini.
- Mode demo hanya dibuka lewat jalur yang memang disengaja; jangan memasukkan `?demo` ke start URL akun pengguna secara tidak sengaja.
- Warna shell/status bar konsisten dengan tema sejauh didukung browser, dengan fallback netral.
- Instalasi bersifat opsional dan tidak menutup layar Catat dengan promosi.
- Jangan mengandalkan `beforeinstallprompt` untuk semua platform.

Dukungan instalasi dan kriterianya berbeda antarbrowser. Manifest/instalasi tidak membuktikan offline sudah bekerja. Rujukan: [MDN — Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

### 16.2 Kontrak offline

Target untuk pengalaman PWA yang andal, setelah aset dan data relevan pernah tersedia:

- Shell aplikasi tetap dapat dibuka tanpa jaringan.
- Transaksi manual dapat disimpan lokal jika penyimpanan lokal tersedia.
- Riwayat yang sudah tersimpan lokal dapat dibaca.
- Ringkasan dihitung dari data yang tersedia; jangan menampilkan seolah lengkap jika hanya sebagian data termuat.
- Fungsi jaringan seperti masuk pertama kali, refresh data spreadsheet, dan ekstraksi nota berbasis server menyatakan keterbatasannya.
- Aplikasi yang belum pernah dimuat tidak dijanjikan dapat dibuka offline.

Jika implementasi sekarang belum memenuhi kontrak ini, tandai sebagai pekerjaan ketahanan PWA terpisah. Jangan menutupi keterbatasan dengan label sukses atau memaksa redesign besar sekaligus.

### 16.3 Penyimpanan dan sinkronisasi

- Simpan lokal secara andal sebelum menyatakan `Tersimpan di perangkat`.
- Jika server/spreadsheet digunakan, status lokal dan remote harus dapat dibedakan.
- Transaksi yang menunggu sync memiliki identitas stabil agar retry tidak membuat duplikat.
- Pertahankan mekanisme storage yang sudah benar. Pertimbangkan IndexedDB jika kapasitas, transaksi atomik, atau antrean async memang membutuhkannya; jangan migrasi hanya untuk mengikuti tren.
- Jangan menulis ulang seluruh riwayat melalui operasi sinkron pada setiap ketukan keypad.
- Antrean minimum, bila dibutuhkan, memuat identitas, operasi, payload, dan status yang cukup untuk retry. Tidak perlu event bus, CRDT, atau mesin sinkronisasi baru tanpa kebutuhan nyata.
- Sinkronisasi ulang saat app aktif/dibuka harus dapat bekerja tanpa Background Sync.
- Event `online` hanya petunjuk; keberhasilan request menentukan apakah layanan benar-benar dapat dijangkau.
- Auth kedaluwarsa meminta masuk lagi tanpa menghapus transaksi yang belum terkirim.
- Untuk konflik, pertahankan data yang belum terkirim dan jelaskan masalah; jangan menimpa perubahan secara diam-diam. Strategi konflik harus mengikuti mekanisme backend yang benar-benar tersedia.

Background Sync memiliki dukungan terbatas, sehingga bukan syarat penyimpanan inti. Rujukan: [MDN — Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

### 16.4 Storage penuh atau dihapus browser

- Tangani kegagalan penulisan, termasuk quota dan storage yang tidak tersedia.
- Jangan reset form atau menampilkan sukses jika penulisan gagal.
- Jangan memperlakukan storage browser sebagai backup permanen.
- Fitur backup/ekspor yang sudah ada tetap dapat ditemukan; jika belum ada, catat kebutuhan pemulihan sebagai pekerjaan terpisah.
- Permintaan persistensi storage bersifat enhancement dan tidak menjamin data tidak dapat hilang.

Kuota dan penghapusan storage berbeda antarbrowser. Rujukan: [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### 16.5 Cache dan pembaruan

- Pisahkan cache aset aplikasi dari penyimpanan transaksi pengguna.
- Cache hanya aset/API yang memang dimiliki dan sesuai strategi; jangan cache token autentikasi, respons akun sensitif, atau semua request pihak ketiga secara membabi buta.
- Gunakan nama/scope cache yang spesifik Kemana, terutama pada origin GitHub Pages yang dapat dipakai proyek lain.
- Pembaruan aset harus menjaga versi HTML/CSS/JS tetap kompatibel; jangan mencampur shell lama dengan modul baru secara acak.
- Pembersihan cache hanya menyentuh cache aset Kemana yang sudah tidak dipakai, bukan data transaksi, draft, atau antrean.
- Jangan memanggil aktivasi paksa dan reload otomatis ketika ada draft atau penulisan/sync yang belum aman.
- Beri pilihan `Perbarui` dan `Nanti`; aktivasi dilakukan pada waktu aman dengan state yang dijaga.
- Update gagal tidak menghapus versi yang masih dapat dipakai.
- Migrasi storage, bila ada, mempertahankan data lama hingga migrasi sukses dan terverifikasi.

Rujukan: [web.dev — Updating PWAs](https://web.dev/learn/pwa/update). Pola aktivasi harus disesuaikan dengan implementasi service worker yang ada, tanpa mewajibkan library baru.

## 17. Performa dan batas ukuran

### 17.1 Prinsip implementasi ringan

- Gunakan stack yang sudah ada dan CSS/HTML native sejauh cukup.
- Tidak ada dependency runtime baru hanya untuk animasi, date picker, styling, bottom sheet, atau ikon.
- Font bawaan sistem; tidak ada request Google Fonts/remote font untuk desain ini.
- Hindari blur/backdrop filter luas, video, gambar dekoratif besar, skeleton bergerak terus, dan polling tanpa alasan.
- Aktifkan grafik/pemrosesan nota saat dibutuhkan, bukan pada pembukaan layar Catat.
- Perbarui bagian DOM/state yang berubah, bukan seluruh halaman untuk satu digit.
- Pisahkan pekerjaan berat menjadi tahap yang tidak membekukan input bila profiling membuktikan masalah.
- Jangan menambahkan web worker, code splitting rumit, atau virtualisasi bila beban sekarang tidak memerlukannya.

### 17.2 Anggaran awal

Angka berikut adalah **target usulan**, bukan hasil pengukuran Kemana sekarang. Ukur baseline sebelum implementasi. Bila baseline lebih besar, dokumentasikan penyebab dan lakukan perbaikan yang sebanding; jangan memaksa rewrite agar memenuhi angka.

| Ukuran/indikator | Target awal | Lingkup |
| --- | --- | --- |
| Dependency runtime baru untuk redesign | 0 | Kecuali ada kebutuhan yang terbukti dan disetujui sebagai perubahan lingkup |
| Remote font | 0 request | Seluruh UI inti |
| Tambahan JS redesign | Maksimal 15 KiB compressed | Dibanding baseline first-party |
| Tambahan CSS redesign | Maksimal 8 KiB compressed | Dibanding baseline; utamakan penggantian aturan yang tidak dipakai |
| First-party JS awal | Sasaran ≤100 KiB compressed | Kode yang diperlukan sebelum Catat siap |
| First-party CSS awal | Sasaran ≤25 KiB compressed | CSS yang diperlukan saat awal |
| Shell awal | Sasaran ≤250 KiB transfer compressed | HTML, CSS, JS, dan aset kecil yang diperlukan untuk layar awal |
| LCP | ≤2.5 detik | Target field p75; lab digunakan sebagai diagnostik |
| INP | ≤200 ms | Target field p75 bila data tersedia |
| CLS | ≤0.1 | Target field p75 bila data tersedia |
| Feedback keypad/navigasi | Perubahan visual terasa segera; sasaran <100 ms | Uji pada Android kelas bawah yang mewakili pengguna |

Shell awal tidak memasukkan file nota yang dipilih pengguna atau aset fitur opsional yang baru dimuat kemudian. Transfer SDK autentikasi/pihak ketiga tetap dilaporkan terpisah dan dihitung pada total biaya pengalaman; jangan menyembunyikannya dari hasil pengukuran.

Target Core Web Vitals mengacu pada [web.dev — Web Vitals](https://web.dev/articles/vitals). Anggaran KiB dan feedback keypad merupakan keputusan produk Kemana, bukan standar browser.

### 17.3 Cara mengukur secukupnya

- Catat transfer dan waktu pembukaan Catat pada cold load serta warm load.
- Gunakan perangkat Android sederhana sebagai acuan selain desktop pengembang.
- Catat model perangkat, browser, throttling, dan kondisi jaringan agar hasil dapat dibandingkan.
- Profilkan interaksi simpan, keypad, cari transaksi, dan buka Ringkasan jika terasa lambat.
- Uji data kecil dan data representatif yang besar, misalnya 100 serta 10.000 transaksi sintetis; sesuaikan dengan pola pemakaian nyata.
- Lighthouse dipakai untuk menemukan masalah, bukan satu-satunya bukti UX/kompatibilitas.
- Tidak perlu memasang SDK analitik baru hanya untuk memenuhi dokumen ini.

## 18. Integritas data yang tidak boleh berubah karena redesign

- Jenis transaksi, schema spreadsheet, ID, tanda nominal, dan aturan saldo mengikuti implementasi yang diaudit.
- Pengeluaran mengurangi dompet terkait, pemasukan menambahnya, dan transfer memindahkan saldo sesuai aturan yang sudah ada.
- Transfer antardompet tidak mengubah total uang seluruh dompet bila tidak ada biaya atau penyesuaian lain.
- Saldo awal/penyesuaian tidak digabung sebagai pemasukan biasa tanpa aturan eksplisit.
- Pembulatan format tampilan tidak mengubah nilai tersimpan.
- Refresh, ganti tema, ubah ukuran teks, dan pindah tab tidak membuat transaksi ganda.
- Retry setelah timeout memeriksa status/identitas transaksi; jangan membuat ID baru untuk operasi logis yang sama.
- Nominal serta tanggal tidak berubah setelah reload, sinkronisasi, atau buka pada browser lain yang didukung.
- Mode demo tidak mencampurkan data ke akun nyata tanpa alur produk yang disengaja.
- Jangan menaruh nominal/catatan transaksi atau token di URL, log publik, maupun telemetry baru untuk kepentingan redesign.

## 19. Skenario penerimaan utama

Gunakan data uji sintetis, bukan data finansial pribadi. Contoh nominal di bawah adalah fixture pengujian.

| ID | Skenario | Hasil yang harus terjadi |
| --- | --- | --- |
| UX-01 | Catat pengeluaran Rp 25.000 dengan kategori dan dompet | Satu transaksi benar tersimpan; nilai/jenis/dompet sesuai pilihan |
| UX-02 | Catat pemasukan, lalu transfer dua dompet | Ketiganya memakai field/label yang tepat; transfer tidak menambah pemasukan konsumsi |
| UX-03 | Ketuk Simpan dua kali saat proses lambat | Satu operasi logis; tidak menggandakan transaksi |
| UX-04 | Ganti kategori/dompet setelah nominal terisi | Nominal, tanggal, dan catatan yang relevan tetap ada |
| UX-05 | Cari transaksi lalu buka dan kembali dari detail | Query/filter/periode tetap; posisi scroll pulih secara layak |
| UX-06 | Isi nominal sangat panjang atau paste format ambigu | Tidak terpotong tanpa akses; input invalid ditangani tanpa nilai diam-diam salah |
| UX-07 | Gunakan tanggal akhir bulan dan dekat pergantian hari | Tanggal transaksi tetap sesuai pilihan lokal |
| UX-08 | Pakai Catat cepat | Perilaku sesuai label; transaksi dan feedback konsisten |
| UX-09 | Batalkan pemilih kategori/nota | Draft manual tetap ada |
| UX-10 | Periode kosong atau pencarian tidak cocok | Empty state sesuai konteks; error jaringan tidak menyaru sebagai kosong |
| A11Y-01 | Selesaikan transaksi hanya dengan keyboard | Fokus terlihat, urutan masuk akal, semua kontrol dapat dipakai |
| A11Y-02 | VoiceOver/TalkBack membaca nominal, kategori, error | Label dan state dapat dipahami; tidak ada pengumuman berulang yang mengganggu |
| A11Y-03 | Zoom 200%, teks Sangat besar, reflow 320 CSS px | Tugas tetap dapat selesai; isi penting tidak tertutup/hilang |
| RESP-01 | Buka pada 320/375/414/768/1024/1440 px | Tidak ada overflow halaman; nominal dan CTA dapat dijangkau |
| RESP-02 | Landscape pendek serta keyboard virtual terbuka | Input, error, dan simpan dapat dijangkau melalui layout/scroll |
| RESP-03 | iPad split view atau resize jendela desktop | Layout menyesuaikan tanpa reset form |
| PWA-01 | Setelah kunjungan sukses, buka offline | Sesuai kontrak offline yang benar-benar diimplementasikan; status data jelas |
| PWA-02 | Simpan offline, tutup, buka lagi, lalu sambungkan | Jika antrean didukung, data bertahan dan sync tepat satu kali; jika belum, keterbatasan tercatat |
| PWA-03 | Auth kedaluwarsa saat ada transaksi tertunda | Input/data lokal tidak dihapus; aksi masuk lagi jelas |
| PWA-04 | Storage ditolak/penuh atau penulisan gagal | Tidak mengklaim sukses; draft tetap dapat dipulihkan selama sesi |
| PWA-05 | Versi baru tersedia ketika draft terisi | Tidak reload paksa; pilihan update tidak menghilangkan draft |
| PWA-06 | API enhancement/instal tidak tersedia | Fungsi web inti dan input manual tetap bekerja |
| DATA-01 | Saldo Tunai Rp 100.000, Bank Rp 200.000; transfer Rp 30.000 dari Tunai ke Bank | Tunai Rp 70.000, Bank Rp 230.000; total tetap Rp 300.000 tanpa biaya |
| DATA-02 | Hapus/perbarui cache aset Kemana dalam uji update | Transaksi/draft/antrean tetap utuh; proyek lain pada origin tidak terkena |
| PERF-01 | Catat, cari, dan buka Ringkasan dengan data representatif | Input responsif; tidak ada pekerjaan berat tanpa kebutuhan |

Baris yang bergantung pada kemampuan belum tersedia diberi status `belum diimplementasikan`, bukan dicentang lulus. Pisahkan perbaikan styling dari pekerjaan ketahanan data/PWA yang ditemukan.

## 20. Definition of Done

Perubahan tampilan dapat diterima ketika:

- [ ] Empat menu utama dan fungsi yang sudah ada tetap dapat diakses.
- [ ] Layar Catat mempunyai hierarki nominal yang jelas dan tidak menambah hambatan pada alur rutin.
- [ ] Warna, ukuran, spacing, dan state memakai token yang konsisten.
- [ ] Tema lama serta pilihan ukuran teks tetap berfungsi.
- [ ] Nominal, nama panjang, label, dan error tetap dapat dibaca.
- [ ] Tidak ada CTA/field/baris penting yang tertutup dock, safe area, atau keyboard.
- [ ] Kontrol keyboard, fokus, screen reader, dan kontras pada lingkup perubahan telah diperiksa.
- [ ] Lebar uji 320, 375, 414, 768, 1024, dan 1440 px diperiksa; perangkat fisik prioritas dicatat.
- [ ] Penyimpanan sukses/gagal dan sinkronisasi memakai pesan yang sesuai keadaan sebenarnya.
- [ ] Tidak ada regresi hitungan saldo, tanggal, jenis transaksi, atau duplikasi simpan.
- [ ] Alur update/offline yang disentuh perubahan diuji; keterbatasan yang belum diperbaiki dicatat.
- [ ] Ukuran aset dan respons interaksi dibandingkan baseline.
- [ ] Tidak ada dependency baru atau pekerjaan arsitektur yang tidak dibutuhkan.
- [ ] Hasil uji membedakan perangkat/browser yang diuji dari yang baru menjadi sasaran.

## 21. Urutan implementasi yang disarankan

### Tahap 1 — Dasar visual dan Catat

- Ukur baseline dan baca aturan data/layout proyek.
- Petakan token ke tema yang ada; gunakan system font.
- Rapikan hierarki nominal, kontrol jenis, keypad, dan akses simpan.
- Ringkas pilihan kategori dengan jalan lanjutan yang jelas.
- Periksa input, fokus, keyboard virtual, serta draft selama navigasi.

### Tahap 2 — Riwayat dan Ringkasan

- Rapikan baris transaksi, nominal, label tanggal, pencarian, serta empty/error state.
- Rapikan saldo/dompet dan kategori tanpa menambah grafik baru.
- Pastikan semua total tetap mengikuti aturan perhitungan yang benar.

### Tahap 3 — Lintas perangkat dan ketahanan PWA

- Jalankan skenario browser/OS prioritas, tema, text scaling, dan aksesibilitas.
- Perbaiki fallback, keyboard, safe area, dan update yang berkaitan dengan perubahan.
- Pisahkan pekerjaan storage/sinkronisasi yang memerlukan perubahan data dari perapian visual.
- Bandingkan performa akhir dengan baseline; hilangkan perubahan yang menambah beban tanpa manfaat.

Tidak perlu menunggu seluruh arsitektur ideal untuk merilis perbaikan kecil. Setiap tahap harus tetap menjaga data dan fungsi yang sudah bekerja.

## 22. Aturan untuk pengembang dan coding agent

1. Baca dokumen ini serta instruksi proyek sebelum mengedit.
2. Periksa implementasi dan token yang sudah ada; jangan mengasumsikan aplikasi menggunakan framework tertentu.
3. Ubah komponen/stylesheet yang diperlukan secara bertahap. Jaga entry CSS, route, integrasi, dan schema data.
4. Jangan menghapus komponen, tema, fungsi, atau data hanya agar implementasi lebih mirip screenshot.
5. Gunakan native HTML/CSS dan dependency yang ada; ajukan alasan konkret sebelum menambah runtime baru.
6. Jangan hardcode ukuran untuk satu model iPhone, satu ukuran desktop, atau satu OS.
7. Jika visual dan UX bertentangan, pilih UX dan catat keputusan singkat.
8. Uji perilaku yang berubah dan risiko nyata. Hindari test yang sekadar memeriksa class CSS atau menyalin implementasi.
9. Laporkan perubahan, verifikasi yang dilakukan, serta batas pengujian dengan jujur.
10. Jangan mengklaim seluruh OS, offline, atau data aman hanya karena screenshot rapi atau audit otomatis mendapat skor tinggi.

## 23. Exports dan pemeliharaan sistem

- Deliverable versi 1.2: `design.md`, paket `kemana-assets/`, dan arsip `kemana-assets.zip`. Token, SVG, PNG, pratinjau, panduan integrasi, serta laporan ukuran disertakan.
- File `kemana-assets/assets/tokens.css` menjadi acuan palette/aset. Saat integrasi ke proyek, pindahkan/petakan ke satu sumber token existing; blok dokumentasi diperbarui bersama sumber runtime.
- Tidak perlu mengekspor Tailwind theme, DTCG JSON, shadcn variables, atau design system package jika proyek tidak memakainya.
- Seluruh layar menggunakan peran warna dan interaksi yang sama. Variasi tema mengubah token, bukan makna aksi atau navigasi.
- Tambahkan pengecualian hanya untuk kebutuhan yang sudah diuji, beserta alasan singkat. Jangan membentuk sistem desain paralel per halaman.

## 24. Notes — pola yang tidak dibawa ke Kemana

- Tampilan bank/investasi yang padat metrik, promosi, dan fitur yang tidak membantu pencatatan.
- Penyalinan ikon, aset, branding, copy, atau ukuran persis Dime.
- Whitespace yang sangat besar sampai memperpanjang tugas atau membuat CTA sulit dijangkau.
- Card untuk setiap elemen, border terlalu banyak, serta semua nominal memakai warna kuat.
- Ikon kategori tanpa nama; aksi penting yang hanya tersedia lewat gesture.
- Pemaksaan satu layar tanpa scroll dengan mengecilkan teks/target sentuh.
- Fixed footer yang menutupi isi, pemblokiran zoom, atau overflow yang hanya disembunyikan.
- Animasi, blur, font, dan dependency yang tidak memberi manfaat tugas.
- Perubahan diam-diam pada aturan saldo, tanggal, transfer, autentikasi, serta penyimpanan.
- Janji sukses/offline/sinkronisasi yang belum didukung implementasi.

## 25. Rujukan

Referensi awal diperiksa pada 2 November 2026; sumber aset/tema dan rujukan SVG diperiksa kembali pada 3 November 2026. Dokumen browser dapat berubah; verifikasi kembali fitur yang dipakai saat implementasi.

- [Kemana — demo produk](https://adityairvndn.github.io/kemana-app/?demo).
- [Dime — galeri screenshot UI aplikasi](https://apps.apple.com/us/app/dime-budget-expense-tracker/id1635280255).
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [MDN — Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
- [MDN — Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
- [MDN — env() dan safe area](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env).
- [MDN — length dan viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length).
- [MDN — inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode).
- [MDN — input date](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date).
- [web.dev — Updating PWAs](https://web.dev/learn/pwa/update).
- [web.dev — Web Vitals](https://web.dev/articles/vitals).

### Riwayat versi

- 1.0 — 2 November 2026: spesifikasi UX/UI awal.
- 1.1 — 3 November 2026: lima tema utama + Sage opsional, token runtime, aset pin-koin existing dan SVG UI, laporan kontras/ukuran, serta panduan integrasi tanpa dependency baru.
- 1.2 — 6 November 2026: ikon k pilihan pengguna menjadi identitas launcher; master SVG, gradient petrol, ekspor PWA/favicon/Apple, pratinjau potongan dan ukuran kecil. Paket aset siap integrasi; kode aplikasi live belum tersedia di workspace.
