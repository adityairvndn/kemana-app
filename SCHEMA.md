# Pakem spreadsheet (format versi 1)

Bagian ini menjelaskan bentuk spreadsheet yang dibaca dan ditulis oleh Kemana. Sumber kebenarannya ada di [`js/schema.js`](js/schema.js). Kalau kode dan dokumen ini berbeda, kode yang berlaku.

## Aturan umum

| Boleh | Jangan |
| --- | --- |
| Menambah, mengubah dan menghapus **baris** | Mengganti **nama sheet** (`Transaksi`, `Dompet`, `Kategori`, `Info`) |
| Mengubah **urutan kolom** | Mengganti **judul kolom** di baris pertama |
| Menambah **kolom sendiri** (aplikasi membiarkannya) | Mengubah isi sheet `Info` |
| Memberi warna, filter, sheet tambahan, rumus di kolom milikmu | Mengetik tanda minus di `Nominal` (jenis sudah menentukan arahnya) |

Cara aplikasi membaca spreadsheet:

- **Sheet dikenali dari namanya.** Kolom dikenali dari judul di baris 1, tanpa membedakan huruf besar dan kecil. Spasi berlebih diabaikan, dan `_` atau `-` dianggap spasi. Beberapa kolom punya nama lain yang juga dikenali; lihat tabel di bawah.
- **Baris kosong dilewati.**
- **Baris yang isinya tidak valid dilewati, bukan dihapus.** Contohnya tanggal tidak terbaca, jenis tidak dikenal, atau nominal bukan angka. Aplikasi menampilkan daftarnya di Pengaturan beserta nomor baris dan alasannya.
- **Tanggal boleh berupa tanggal Sheets atau teks.** Teks yang dikenali: `2026-10-28`, `28/10/2026` dan `28-10-26`.
- **Nominal boleh berupa angka atau teks** seperti `Rp 25.000` atau `25.000,50`.
- **Nama dompet dan kategori di Transaksi harus sama dengan namanya di sheet Dompet dan Kategori.** Kalau ada nama yang tidak terdaftar, transaksi itu tetap dihitung. Saldonya muncul di Ringkasan dengan keterangan "Tidak ada di sheet Dompet".

## Sheet dan kolom

### Sheet `Transaksi`

Satu baris berarti satu transaksi.

| Judul kolom | Wajib | Jenis isi | Keterangan |
| --- | --- | --- | --- |
| `ID` |  | teks | Diisi otomatis oleh aplikasi. Boleh kosong untuk baris yang kamu ketik sendiri. |
| `Tanggal` | ya | tanggal | Tanggal transaksi. |
| `Jenis` | ya | pilihan (Pengeluaran / Pemasukan / Transfer) | Pengeluaran, Pemasukan, atau Transfer. |
| `Dompet` | ya | teks | Nama dompet (sesuai sheet Dompet). Untuk Transfer: dompet asal. |
| `Ke Dompet` |  | teks | Hanya untuk Transfer: dompet tujuan. Juga dikenali: `tujuan`, `dompet tujuan`. |
| `Kategori` |  | teks | Nama kategori (sesuai sheet Kategori). Kosong untuk Transfer. |
| `Nominal` | ya | angka | Angka tanpa tanda minus. Juga dikenali: `jumlah`. |
| `Catatan` |  | teks | Bebas. Juga dikenali: `keterangan`. |
| `Dicatat` |  | tanggal & jam | Waktu dicatat, diisi otomatis. |

Baris yang kamu ketik langsung di Sheets tanpa `ID` akan diberi ID oleh aplikasi saat tersambung berikutnya.

### Sheet `Dompet`

Satu baris berarti satu tempat menyimpan uang, misalnya tunai, rekening atau e-wallet.

| Judul kolom | Wajib | Jenis isi | Keterangan |
| --- | --- | --- | --- |
| `Nama` | ya | teks | Nama unik, misalnya Tunai atau Rekening Bank. |
| `Saldo Awal` |  | angka | Saldo sebelum transaksi pertama dicatat. |
| `Aktif` |  | TRUE/FALSE | FALSE = disembunyikan dari pilihan, riwayat tetap ada. |

Saldo sebuah dompet dihitung seperti ini: `Saldo Awal` + pemasukan − pengeluaran + transfer masuk − transfer keluar.

Fitur **Cocokkan saldo** tidak mengubah `Saldo Awal`. Selisihnya dicatat sebagai transaksi biasa di sheet Transaksi, dengan kategori `Tidak tercatat`, supaya jejaknya tetap terlihat. Kategori ini tidak perlu ada di sheet Kategori.

### Sheet `Kategori`

| Judul kolom | Wajib | Jenis isi | Keterangan |
| --- | --- | --- | --- |
| `Nama` | ya | teks | Nama unik. |
| `Jenis` |  | pilihan (Pengeluaran / Pemasukan) | Pengeluaran atau Pemasukan. |
| `Aktif` |  | TRUE/FALSE | FALSE = disembunyikan dari pilihan. |

### Sheet `Info`

Sheet ini dipakai aplikasi dan diberi proteksi berupa peringatan saat diubah.

| Judul kolom | Wajib | Jenis isi | Keterangan |
| --- | --- | --- | --- |
| `Kunci` |  | teks | Dipakai aplikasi. Jangan diubah. |
| `Nilai` |  | teks |  |

Kunci yang dipakai saat ini adalah `versi_skema`, yaitu versi format spreadsheet. Spreadsheet buatan aplikasi juga diberi penanda tersembunyi di Google Drive, supaya aplikasi bisa menemukannya lagi dari perangkat lain.

## Perubahan format di versi berikutnya

Setiap kali tersambung, aplikasi membandingkan `versi_skema` dengan versi format yang ia kenal. Ada tiga kemungkinan.

**Spreadsheet lebih lama dari aplikasi.** Aplikasi menyesuaikan spreadsheet dengan cara berikut:

1. Sheet yang belum ada dibuat.
2. Kolom yang belum ada ditambahkan di ujung kanan sheet, dan baris lama diisi nilai bawaan kalau ada.
3. `versi_skema` diperbarui.
4. Pengguna melihat daftar perubahannya.

Data yang sudah ada tidak diubah.

**Spreadsheet lebih baru dari aplikasi.** Aplikasi tetap membaca kolom yang ia kenal dan meminta pengguna memperbarui aplikasinya.

**Sheet atau kolom pakem terhapus atau judulnya berubah.** Sheet atau kolom itu dibuat ulang dengan judul yang benar dan isi kosong, lalu pengguna diberi tahu. Kalau isinya masih ada di kolom berjudul lain, kembalikan judul aslinya dan hapus kolom kosong yang baru dibuat.

Riwayat format:

| Versi | Perubahan |
| --- | --- |
| 1 | Format awal: `Transaksi`, `Dompet`, `Kategori`, `Info`. |
