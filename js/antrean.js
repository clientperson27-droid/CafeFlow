/* CafeFlow — Layar Antrean (TV/monitor). Tanpa login, tanpa data pribadi:
   hanya nomor panggil & nomor meja. Ketuk layar sekali untuk mengaktifkan suara. */
(function () {
  'use strict';
  const root = document.getElementById('app'), esc = CF.esc, ic = CF.ic;
  if (!CF.configOk) return CF.configScreen(root);
  let D = null, lastCall = null;
  function render() {
    if (!D) { root.innerHTML = '<div class="tv"><div class="tv-top"><div class="name">Memuat antrean…</div></div></div>'; return; }
    const p = D.panggil && Date.now() - D.panggil.at < 15 * 60000 ? D.panggil : null;
    root.innerHTML = '<div class="tv"><div class="tv-top"><div class="logo">' + (D.logo ? '<img src="' + esc(D.logo) + '" alt="">' : ic('coffee', 'lg')) + '</div><div class="name">' + esc(D.nama) + '</div>' +
      '<span class="conn badge b-red" style="margin-left:16px">' + ic('wifiOff', 'sm') + 'Offline</span><span class="clock" id="tv-clock">' + CF.jam(Date.now()) + '</span></div>' +
      '<div class="tv-body"><section class="tv-col"><h2>' + ic('chef', 'lg') + 'Sedang Diproses</h2><div class="tv-tiles">' +
      (D.proses.length ? D.proses.map(o => '<div class="tv-tile"><div class="n">' + esc(o.np) + '</div><div class="m">' + esc(o.mn ? 'Meja ' + o.mn : '') + '</div></div>').join('') : '<p style="color:rgba(255,255,255,.5);font-size:20px">Tidak ada antrean</p>') + '</div></section>' +
      '<section class="tv-col"><h2>' + ic('concierge', 'lg') + 'Siap Disajikan</h2>' +
      (p ? '<div class="tv-call' + (lastCall !== p.at ? ' flash' : '') + '"><div class="lbl">Memanggil</div><div class="n">' + esc(p.np) + '</div><div class="m">' + esc(p.mn ? 'Meja ' + p.mn : 'Silakan ambil di kasir') + '</div></div>' : '') +
      '<div class="tv-tiles">' + D.siap.filter(o => !p || o.np !== p.np).map(o => '<div class="tv-tile ready"><div class="n">' + esc(o.np) + '</div><div class="m">' + esc(o.mn ? 'Meja ' + o.mn : '') + '</div></div>').join('') + '</div></section></div></div>';
  }
  async function tick() {
    const r = await CF.api('antrean.data');
    if (!r.ok) return;
    const prev = D && D.panggil ? D.panggil.at : null;
    D = r.data; if (D.warna) CF.applyTheme({ warna_primer: D.warna, warna_aksen: D.warna });
    if (D.panggil && prev !== D.panggil.at && prev !== null) CF.sound.beep('call');
    render(); lastCall = D.panggil ? D.panggil.at : null;
  }
  setInterval(() => { const c = document.getElementById('tv-clock'); if (c) c.textContent = CF.jam(Date.now()); }, 1000);
  CF.poll('tv', tick, 5000, 5000);
  document.addEventListener('click', () => CF.sound.unlock(), { once: true });
  render(); tick();
})();
