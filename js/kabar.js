// Daftar "Kabar Kemana" (tombol lonceng): apa yang baru di tiap versi, dengan bahasa sehari-hari.
// Yang terbaru di paling atas. Setiap rilis: tambahkan satu entri di awal daftar (versinya sama dengan APP_VERSION).
// Tulis dari sudut pandang pengguna, bukan teknis: "Pop-up tidak nyangkut lagi", bukan "perbaikan CSS toast".

export const KABAR = [
  {
    versi: '1.3.1', tanggal: '2 Nov 2026', judul: 'Tombol Kembali lebih rapi',
    butir: [
      'Dari halaman Riwayat, Ringkasan, atau Pengaturan, tombol Kembali membawamu ke Catat dulu.',
      'Di Catat, tombol Kembali selalu memberi pesan dulu sebelum aplikasi ditutup.'
    ]
  },
  {
    versi: '1.3.0', tanggal: '2 Nov 2026', judul: 'Lebih enak dipakai',
    butir: [
      'Tombol Nota sekarang menawarkan dua pilihan: Ambil foto atau Pilih dari galeri.',
      'Tombol Kembali di HP tidak lagi langsung menutup aplikasi.',
      'Ada tombol lonceng ini untuk melihat kabar dan pembaruan.'
    ]
  },
  {
    versi: '1.2.1', tanggal: '2 Nov 2026', judul: 'Pembaruan lebih aman',
    butir: ['Pembaruan aplikasi sekarang selalu terpasang utuh, tidak setengah-setengah.']
  },
  {
    versi: '1.2.0', tanggal: '2 Nov 2026', judul: 'Perbaikan dan lebih cepat',
    butir: [
      'Pesan "tersimpan" yang tadinya nyangkut di layar sekarang hilang sendiri.',
      'Aplikasi terbuka jauh lebih cepat, dan bisa dipakai tanpa sinyal.',
      'Tombol Kembali menutup jendela isian, bukan keluar dari aplikasi.',
      'Tampilan miring (landscape) dan HP berlayar kecil dirapikan.',
      'Kalau memori HP penuh, kamu diberi tahu. Sebelumnya catatan gagal tersimpan tanpa kabar.'
    ]
  },
  {
    versi: '1.1.0', tanggal: '1 Nov 2026', judul: 'Fitur tambahan',
    butir: [
      'Isi nominal otomatis dari foto nota. Fotonya dibaca di HP-mu, tidak dikirim ke mana pun.',
      'Catat cepat: ketuk sekali untuk mengulang catatan yang sering kamu buat.',
      'Cocokkan saldo dompet dengan saldo sebenarnya.',
      'Pilihan warna tema.'
    ]
  }
];

/** Bandingkan nomor versi "1.10.0" dengan benar (angka, bukan huruf). Hasil: <0, 0, atau >0. */
export function bandingVersi(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Entri yang lebih baru dari versi yang terakhir dilihat pengguna. */
export function kabarBaru(dilihat) {
  return KABAR.filter(function (k) { return bandingVersi(k.versi, dilihat) > 0; });
}
