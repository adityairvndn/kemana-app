// Pasang tema & ukuran teks sebelum halaman tampil (mencegah kedip warna).
(function () {
  var p = {};
  try { p = JSON.parse(localStorage.getItem('ck.prefs')) || {}; } catch (e) {}
  var tema = p.tema || 'otomatis';
  if (['otomatis', 'terang', 'gelap', 'biru', 'krem', 'kontras'].indexOf(tema) < 0) tema = 'otomatis';
  if (tema === 'otomatis') {
    var gelap = false;
    try { gelap = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    tema = gelap ? 'gelap' : 'terang';
  }
  document.documentElement.setAttribute('data-theme', tema);
  document.documentElement.setAttribute('data-teks', p.teks || 'normal');
})();
