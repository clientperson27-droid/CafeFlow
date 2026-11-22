/* =====================================================================
   CafeFlow — Aplikasi Staf: login, Kasir, Kitchen/Barista (papan dapur)
   Halaman Admin/Owner ada di admin.js (mendaftar ke CF.pages).
   ===================================================================== */
(function () {
  'use strict';
  const root = document.getElementById('app'), esc = CF.esc, rp = CF.rp, ic = CF.ic;
  const ST = CF.st = { me: CF.store.get('me', null), boot: CF.store.get('boot', null), live: null, seen: null, filter: { st: 'aktif', sb: '', q: '' }, selMeja: null, drawer: null, manual: { lines: [], meja: '', nama: '' }, navOpen: false };
  const ROLE_LABEL = { admin: 'Admin / Owner', kasir: 'Kasir', dapur: 'Kitchen / Barista' };
  CF.ROLE_LABEL = ROLE_LABEL;
  const ST_LABEL = CF.ST_LABEL = { baru: ['b-blue', 'Baru', 'clock'], diproses: ['b-orange', 'Diproses', 'chef'], siap: ['b-green', 'Siap', 'concierge'], selesai: ['b-neutral', 'Selesai', 'checkC'], batal: ['b-red', 'Dibatalkan', 'ban'] };
  const SB_LABEL = CF.SB_LABEL = { lunas: ['b-green', 'Lunas', 'checkC'], belum: ['b-amber', 'Belum Dibayar', 'wallet'], menunggu: ['b-amber', 'Menunggu Bayar', 'clock'], verifikasi: ['b-amber', 'Perlu Verifikasi', 'eye'], refund: ['b-red', 'Perlu Refund', 'alert'], batal: ['b-neutral', 'Batal', 'ban'] };
  CF.badgeSt = st => { const b = ST_LABEL[st] || ST_LABEL.baru; return '<span class="badge ' + b[0] + '">' + ic(b[2], 'sm') + b[1] + '</span>'; };
  CF.badgeSb = sb => { const b = SB_LABEL[sb] || SB_LABEL.belum; return '<span class="badge ' + b[0] + '">' + ic(b[2], 'sm') + b[1] + '</span>'; };
  CF.pages = {};
  const page = (key, def) => { CF.pages[key] = def; };
  const isRole = (...r) => ST.me && r.indexOf(ST.me.role) > -1;
  CF.isRole = isRole;
  if (!CF.configOk) { document.addEventListener('DOMContentLoaded', () => CF.configScreen(root)); return; }

  // ------------------------------------------------------------------
  // Login, ganti sandi, keluar
  // ------------------------------------------------------------------
  function viewLogin(msg) {
    const set = (ST.boot && ST.boot.set) || {};
    root.innerHTML = '<div class="auth"><form class="auth-card" id="login-form" autocomplete="on"><div class="logo">' + CF.logoHtml(set, 'xl') + '</div>' +
      '<div class="center"><h2>Masuk Staf</h2><p class="muted small mt-4">' + esc(set.nama_aplikasi || 'CafeFlow') + ' — Kasir, Kitchen & Admin</p></div>' +
      (msg ? '<div class="banner warn">' + ic('info') + '<div>' + esc(msg) + '</div></div>' : '') +
      '<div class="field"><label class="label" for="lg-u">Nama pengguna</label><input class="input" id="lg-u" autocomplete="username" autocapitalize="none" required></div>' +
      '<div class="field"><label class="label" for="lg-p">Kata sandi</label><div class="pw-wrap"><input class="input" id="lg-p" type="password" autocomplete="current-password" required><button type="button" data-act="pwShow" aria-label="Tampilkan kata sandi">' + ic('eye') + '</button></div></div>' +
      '<div class="err-msg hide" id="lg-err"></div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit" data-loading="Memeriksa…">Masuk ' + ic('arrowR') + '</button>' +
      '<p class="help center">Lupa kata sandi? Hubungi Owner untuk reset.</p></form></div>';
    CF.warm('staff');
    const f = document.getElementById('login-form');
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]'), err = document.getElementById('lg-err');
      await CF.busy(btn, async () => {
        const r = await CF.api('auth.login', { username: document.getElementById('lg-u').value.trim(), password: document.getElementById('lg-p').value }, { token: '' });
        if (!r.ok) { err.innerHTML = ic('alert', 'sm') + esc(r.error.pesan); err.classList.remove('hide'); return; }
        CF.store.set('token', r.data.token); CF.store.set('me', r.data.me); ST.me = r.data.me;
        if (ST.me.wajibGanti) viewGanti(true); else boot();
      });
    };
    setTimeout(() => document.getElementById('lg-u').focus(), 50);
  }
  CF.acts.pwShow = el => { const i = el.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = ic(i.type === 'password' ? 'eye' : 'eyeOff'); };
  function formGanti(id) {
    return '<form class="col gap-12" id="' + id + '"><div class="field"><label class="label" for="g-l">Kata sandi saat ini</label><div class="pw-wrap"><input class="input" id="g-l" type="password" autocomplete="current-password" required><button type="button" data-act="pwShow" aria-label="Tampilkan">' + ic('eye') + '</button></div></div>' +
      '<div class="field"><label class="label" for="g-b">Kata sandi baru</label><div class="pw-wrap"><input class="input" id="g-b" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-act="pwShow" aria-label="Tampilkan">' + ic('eye') + '</button></div><span class="help">Minimal 8 karakter, berisi huruf dan angka' + (ST.me && ST.me.darurat ? ' (akses darurat: minimal 12)' : '') + '.</span></div>' +
      '<div class="field"><label class="label" for="g-u">Ulangi kata sandi baru</label><input class="input" id="g-u" type="password" autocomplete="new-password" required></div><div class="err-msg hide" id="g-err"></div>' +
      '<button class="btn btn-primary btn-block" type="submit" data-loading="Menyimpan…">Simpan Kata Sandi</button></form>';
  }
  function bindGanti(id, after) {
    const f = document.getElementById(id);
    f.onsubmit = async e => {
      e.preventDefault();
      const l = f.querySelector('#g-l').value, b = f.querySelector('#g-b').value, u = f.querySelector('#g-u').value, err = f.querySelector('#g-err');
      const show = m => { err.innerHTML = ic('alert', 'sm') + esc(m); err.classList.remove('hide'); };
      if (b !== u) return show('Kata sandi baru tidak sama.');
      if (b.length < 8 || !/[A-Za-z]/.test(b) || !/\d/.test(b)) return show('Minimal 8 karakter, berisi huruf dan angka.');
      await CF.busy(f.querySelector('[type=submit]'), async () => {
        const r = await CF.api('auth.gantiSandi', { lama: l, baru: b });
        if (!r.ok) return show(r.error.pesan);
        CF.store.set('token', r.data.token); CF.store.set('me', r.data.me); ST.me = r.data.me;
        CF.toast(r.msg, 'ok'); after();
      });
    };
  }
  function viewGanti(wajib) {
    root.innerHTML = '<div class="auth"><div class="auth-card"><div class="logo">' + ic('key', 'xl') + '</div><div class="center"><h2>Buat Kata Sandi Baru</h2><p class="muted small mt-4">' +
      (wajib ? 'Anda masuk dengan kata sandi sementara. Demi keamanan, ganti dulu sebelum melanjutkan.' : '') + '</p></div>' + formGanti('ganti-form') +
      '<button class="btn btn-ghost" data-act="logout">Keluar</button></div></div>';
    bindGanti('ganti-form', boot);
  }
  CF.acts.logout = async () => { CF.api('auth.logout', {}); logoutLocal(); };
  function logoutLocal(msg) { CF.store.del('token'); CF.store.del('me'); ST.me = null; ST.live = null; if (ST.poll) ST.poll.stop(); viewLogin(msg); }
  CF.onAuthFail = err => { if (err.kode === 'GANTI_SANDI') viewGanti(true); else if (ST.me) logoutLocal('Sesi Anda berakhir. Silakan masuk lagi.'); };

  // ------------------------------------------------------------------
  // Kerangka (sidebar + topbar) & navigasi
  // ------------------------------------------------------------------
  function navItems() {
    return Object.keys(CF.pages).map(k => Object.assign({ key: k }, CF.pages[k])).filter(p => p.roles.indexOf(ST.me.role) > -1 || (p.stok && ST.me.izinStok)).filter(p => !p.hidden);
  }
  function defaultPage() { return ST.me.role === 'admin' ? 'dashboard' : ST.me.role === 'dapur' ? 'dapur' : 'pesanan'; }
  const cur = () => { const k = location.hash.replace(/^#\/?/, '').split('/')[0]; const p = CF.pages[k]; return p && (p.roles.indexOf(ST.me.role) > -1 || (p.stok && ST.me.izinStok)) ? k : defaultPage(); };
  CF.go = k => { if (location.hash === '#' + k) render(); else location.hash = k; };
  function badgeFor(k) {
    const L = ST.live; if (!L) return '';
    let n = 0, amber = false;
    if (k === 'pesanan') n = (L.orders || []).filter(o => o.st === 'baru').length;
    if (k === 'verifikasi') { n = (L.trx || []).filter(t => t.st === 'verifikasi' || t.st === 'tinjau').length; amber = true; }
    if (k === 'persetujuan') { n = (L.aprv || []).length; amber = true; }
    if (k === 'dapur') n = (L.orders || []).filter(o => o.st === 'baru').length;
    return n ? '<span class="cnt' + (amber ? ' amber' : '') + '">' + n + '</span>' : '';
  }
  function shell() {
    const set = (ST.boot && ST.boot.set) || {}, k = cur(), items = navItems();
    const secs = {}; items.forEach(p => { (secs[p.sec || 'Operasional'] = secs[p.sec || 'Operasional'] || []).push(p); });
    root.innerHTML = '<div class="app' + (ST.navOpen ? ' nav-open' : '') + '" id="shell"><nav class="side" aria-label="Menu utama"><div class="brand"><div class="logo">' + CF.logoHtml(set) + '</div><div class="grow" style="min-width:0"><div class="name ellipsis">' + esc(set.nama_aplikasi || 'CafeFlow') + '</div><div class="tag">' + esc(ROLE_LABEL[ST.me.role]) + '</div></div></div>' +
      Object.keys(secs).map(s => '<div class="nav-sec">' + esc(s) + '</div>' + secs[s].map(p => '<button class="nav-item' + (p.key === k ? ' on' : '') + '" data-act="nav" data-k="' + p.key + '" id="nav-' + p.key + '">' + ic(p.icon) + '<span>' + esc(p.title) + '</span>' + badgeFor(p.key) + '</button>').join('')).join('') +
      '<div class="me"><span class="avatar">' + esc(CF.inisial(ST.me.nama)) + '</span><div class="grow" style="min-width:0"><div class="semi ellipsis small">' + esc(ST.me.nama) + '</div><div class="xs faint">' + esc(ROLE_LABEL[ST.me.role]) + '</div></div><button class="btn btn-ghost btn-icon btn-sm" data-act="nav" data-k="akun" aria-label="Akun saya">' + ic('settings', 'sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-act="logout" aria-label="Keluar">' + ic('logout', 'sm') + '</button></div></nav>' +
      '<div class="main"><header class="topbar"><button class="btn btn-ghost btn-icon burger" data-act="burger" aria-label="Buka menu">' + ic('menu') + '</button><h1 id="pg-title"></h1>' +
      '<span class="conn badge b-red">' + ic('wifiOff', 'sm') + 'Offline</span>' +
      '<button class="btn btn-ghost btn-icon" data-act="sound" aria-label="Suara notifikasi" title="Suara notifikasi">' + ic(CF.sound.on ? 'vol' : 'volX') + '</button>' +
      '<span class="avatar desk-only" title="' + esc(ST.me.nama) + '">' + esc(CF.inisial(ST.me.nama)) + '</span></header><div class="page" id="page"></div></div></div>';
  }
  function updateBadges() { navItems().forEach(p => { const b = document.getElementById('nav-' + p.key); if (!b) return; const old = b.querySelector('.cnt'); if (old) old.remove(); b.insertAdjacentHTML('beforeend', badgeFor(p.key)); }); }
  CF.acts.nav = el => { ST.navOpen = false; const s = document.getElementById('shell'); if (s) s.classList.remove('nav-open'); CF.go(el.dataset.k); };
  CF.acts.burger = () => { ST.navOpen = !ST.navOpen; document.getElementById('shell').classList.toggle('nav-open', ST.navOpen); };
  document.addEventListener('click', e => { const s = document.getElementById('shell'); if (s && ST.navOpen && !e.target.closest('.side') && !e.target.closest('.burger')) { ST.navOpen = false; s.classList.remove('nav-open'); } });
  CF.acts.sound = el => { CF.sound.set(!CF.sound.on); el.innerHTML = ic(CF.sound.on ? 'vol' : 'volX'); CF.toast(CF.sound.on ? 'Suara notifikasi aktif.' : 'Suara notifikasi dimatikan.', 'info', 2000); if (CF.sound.on) CF.sound.beep(); };
  function render() {
    if (!ST.me) return viewLogin();
    const k = cur(), p = CF.pages[k];
    if (p.full) { root.innerHTML = '<div id="page"></div>'; }
    else if (!document.getElementById('shell') || ST._fullBefore) shell();
    else { document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.k === k)); }
    ST._fullBefore = !!p.full;
    const t = document.getElementById('pg-title'); if (t) t.textContent = p.title;
    document.title = p.title + ' — ' + (((ST.boot || {}).set || {}).nama_aplikasi || 'CafeFlow');
    ST.curPage = k;
    const el = document.getElementById('page');
    el.innerHTML = '';
    p.render(el);
  }
  CF.renderPage = render;
  CF.rerenderIfLive = () => { const p = CF.pages[ST.curPage]; if (p && p.live) { const el = document.getElementById('page'); if (p.update) p.update(el); else p.render(el); } updateBadges(); if (ST.drawer) ST.drawer.refresh(); };
  window.addEventListener('hashchange', () => { if (ST.me) render(); });

  // ------------------------------------------------------------------
  // Data live (polling berversi) + notifikasi pesanan baru
  // ------------------------------------------------------------------
  async function pollLive(force) {
    const r = await CF.api('staf.live', { since: force ? '' : (ST.live && ST.live.v) || '' });
    if (!r.ok) return;
    if (r.data.same) return;
    const prev = ST.live, L = r.data;
    ST.live = L;
    if (ST.seen) {
      const baru = (L.orders || []).filter(o => !ST.seen[o.id] && o.st === 'baru');
      if (baru.length) { CF.sound.beep('new'); CF.toast(baru.length === 1 ? 'Pesanan baru ' + baru[0].np + ' — Meja ' + (baru[0].mn || '-') : baru.length + ' pesanan baru masuk', 'info'); ST.fresh = {}; baru.forEach(o => { ST.fresh[o.id] = Date.now(); }); }
      (L.orders || []).forEach(o => { const p = prev && (prev.orders || []).filter(x => x.id === o.id)[0]; if (p && p.sb !== 'lunas' && o.sb === 'lunas' && ST.me.role !== 'dapur') CF.toast('Pembayaran ' + o.np + ' lunas (' + (CF.LABEL_METODE[o.met] || o.met) + ').', 'ok'); });
      const bt = (L.bantuan || []).filter(b => !(prev && (prev.bantuan || []).some(x => x.id === b.id)));
      if (bt.length) { CF.sound.beep('call'); CF.toast('Meja ' + bt[0].mn + ' memanggil pelayan.', 'warn', 8000); }
    }
    ST.seen = {}; (L.orders || []).forEach(o => { ST.seen[o.id] = 1; });
    CF.rerenderIfLive();
  }
  CF.refreshLive = () => pollLive(true);
  function startPoll() {
    if (ST.poll) ST.poll.stop();
    ST.poll = CF.poll('live', pollLive, ST.me.role === 'dapur' ? 4000 : 5000, 15000);
    pollLive(true);
  }
  async function boot() {
    render();
    CF.api('pub.boot').then(r => { if (r.ok) { ST.boot = r.data; CF.store.set('boot', r.data); CF.applyTheme(r.data.set); const s = document.querySelector('.side .brand'); if (s) shell(), render(); } });
    startPoll();
  }

  // ------------------------------------------------------------------
  // Komponen bersama: kartu pesanan, drawer detail, bayar, diskon, batal, cetak
  // ------------------------------------------------------------------
  const orders = () => (ST.live && ST.live.orders) || [];
  const byId = id => orders().filter(o => o.id === id)[0];
  CF.orderById = byId;
  const NEXT = { baru: ['diproses', 'Proses', 'chef'], diproses: ['siap', 'Siap', 'concierge'], siap: ['selesai', 'Selesai', 'check'] };
  function itemsShort(o, n) { const it = o.items.slice(0, n || 3).map(i => '<div class="row" style="gap:6px"><b class="tnum">' + i.q + '×</b><span class="ellipsis">' + esc(i.n) + '</span>' + (i.c ? ic('note', 'sm orange') : '') + '</div>').join(''); return it + (o.items.length > (n || 3) ? '<div class="faint small">+' + (o.items.length - (n || 3)) + ' menu lainnya</div>' : ''); }
  CF.orderCard = function (o) {
    const nx = NEXT[o.st], fresh = ST.fresh && ST.fresh[o.id] && Date.now() - ST.fresh[o.id] < 60000;
    return '<article class="ord' + (fresh ? ' new' : '') + '" data-act="detail" data-id="' + esc(o.id) + '" tabindex="0" aria-label="Pesanan ' + esc(o.np) + '">' +
      '<div class="row between"><div class="row">' + (o.st === 'baru' ? '<span class="badge b-solid-orange">BARU</span>' : '') + '<span class="no">' + esc(o.np) + '</span></div><span class="mtag">' + ic(o.mj ? 'grid' : 'bag', 'sm') + esc(o.mj ? 'Meja ' + o.mn : o.mn || 'Bawa Pulang') + '</span></div>' +
      '<div class="row between small faint"><span class="tnum">' + esc(o.id) + '</span><span>' + CF.lalu(o.dib) + '</span></div>' +
      '<div class="its">' + itemsShort(o) + '</div>' +
      '<div class="row wrap" style="gap:6px">' + CF.badgeSt(o.st) + CF.badgeSb(o.sb) + '<span class="badge b-neutral">' + (o.src === 'qr' ? ic('qr', 'sm') + 'QR' : ic('user', 'sm') + 'Kasir') + '</span></div>' +
      '<div class="row between"><span class="faint small">' + (o.nama ? esc(o.nama) : '&nbsp;') + '</span><span class="price" style="font-size:18px">' + rp(o.tot) + '</span></div>' +
      (o.st !== 'batal' ? '<div class="acts">' + (o.sb !== 'lunas' && o.sb !== 'refund' && isRole('admin', 'kasir') ? '<button class="btn btn-sm btn-primary" data-act="bayarKasir" data-id="' + esc(o.id) + '">' + ic('cash', 'sm') + 'Terima Bayar</button>' : '') +
        (nx ? '<button class="btn btn-sm btn-secondary" data-act="setSt" data-id="' + esc(o.id) + '" data-st="' + nx[0] + '">' + ic(nx[2], 'sm') + nx[1] + '</button>' : '') +
        '<button class="btn btn-sm btn-ghost btn-icon" data-act="cetak" data-id="' + esc(o.id) + '" aria-label="Cetak struk">' + ic('printer', 'sm') + '</button></div>' : '') + '</article>';
  };
  CF.acts.detail = (el, e) => { if (e.target.closest('[data-act]') !== el) return; openDrawer(el.dataset.id); };
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('.ord')) openDrawer(e.target.dataset.id); });
  CF.acts.setSt = async el => {
    const r = await CF.busy(el, () => CF.api('pesanan.status', { id: el.dataset.id, st: el.dataset.st }));
    if (r && !r.ok) return CF.err(r);
    if (el.dataset.st === 'siap') CF.toast('Nomor ' + (byId(el.dataset.id) || {}).np + ' ditandai siap & dipanggil.', 'ok');
    await CF.refreshLive();
  };
  // Drawer detail pesanan
  function openDrawer(id) {
    closeDrawer();
    const bd = document.createElement('div'); bd.className = 'drawer-bd';
    const dr = document.createElement('aside'); dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'Detail pesanan');
    document.body.append(bd, dr);
    const refresh = () => {
      const o = byId(id); if (!o) { closeDrawer(); return; }
      const lain = o.sesi ? orders().filter(x => x.sesi === o.sesi && x.id !== o.id) : [];
      const trx = ((ST.live && ST.live.trx) || []).filter(t => t.psn === o.id && (t.st === 'verifikasi' || t.st === 'tinjau' || t.st === 'pending'))[0];
      const aprv = ((ST.live && ST.live.aprv) || []).filter(a => a.psn === o.id)[0];
      const nx = NEXT[o.st], kasir = isRole('admin', 'kasir');
      dr.innerHTML = '<div class="dh"><div class="grow"><div class="row"><span class="head" style="font-size:24px;font-weight:800">' + esc(o.np) + '</span><span class="mtag">' + esc(o.mj ? 'Meja ' + o.mn : o.mn) + '</span></div>' +
        '<div class="small faint mt-4">' + esc(o.id) + ' • ' + CF.tglJam(o.dib) + ' • ' + (o.src === 'qr' ? 'Pesan via QR' : 'Input kasir') + '</div><div class="row wrap mt-8" style="gap:6px">' + CF.badgeSt(o.st) + CF.badgeSb(o.sb) + (o.met ? '<span class="badge b-neutral">' + esc(CF.LABEL_METODE[o.met] || o.met) + '</span>' : '') + '</div></div>' +
        '<button class="btn btn-ghost btn-icon" data-act="closeDrawer" aria-label="Tutup">' + ic('x') + '</button></div><div class="db">' +
        (o.nama || o.kontak || o.email ? '<div class="soft-box row wrap" style="gap:14px">' + ic('user', 'sm') + '<b>' + esc(o.nama || 'Tamu') + '</b>' + (o.kontak ? '<span class="small">' + ic('phone', 'sm') + ' ' + esc(o.kontak) + '</span>' : '') + (o.email ? '<span class="small">' + ic('mail', 'sm') + ' ' + esc(o.email) + '</span>' : '') + '</div>' : '') +
        (o.st === 'batal' ? '<div class="banner danger">' + ic('ban') + '<div><b>Dibatalkan.</b> ' + esc(o.alasan) + (o.sb === 'refund' ? '<br><b>Sudah dibayar — lakukan pengembalian dana.</b>' : '') + '</div></div>' : '') +
        (aprv ? '<div class="banner warn">' + ic('clock') + '<div>Diskon ' + rp(aprv.jml) + ' menunggu persetujuan Owner.</div></div>' : '') +
        '<div><div class="label-up mb-8">Item pesanan</div>' + o.items.map(i => '<div class="row top between" style="padding:8px 0;border-bottom:1px solid var(--soft-2)"><div class="row top"><span class="mtag" style="min-width:34px;justify-content:center">' + i.q + '×</span><div><b>' + esc(i.n) + '</b>' + (i.o ? '<div class="small faint">' + esc(i.o) + '</div>' : '') + (i.c ? '<div class="small" style="color:var(--amber);font-weight:600">' + ic('note', 'sm') + ' ' + esc(i.c) + '</div>' : '') + '</div></div><b class="nowrap tnum">' + rp(i.s) + '</b></div>').join('') +
        (o.cat ? '<div class="banner warn mt-8">' + ic('note') + '<div><b>Catatan:</b> ' + esc(o.cat) + '</div></div>' : '') + '</div>' +
        '<div class="soft-box"><div class="sum-row"><span>Subtotal</span><b>' + rp(o.sub) + '</b></div>' + (o.dp ? '<div class="sum-row dsc"><span>Promo ' + esc(o.pk) + '</span><b>-' + rp(o.dp) + '</b></div>' : '') +
        '<div class="sum-row dsc"><span>Diskon manual' + (kasir && o.sb !== 'lunas' && o.st !== 'batal' ? ' <button class="btn btn-ghost btn-sm orange" style="min-height:24px;padding:0 6px" data-act="diskon" data-id="' + esc(o.id) + '">' + (o.dm ? 'ubah' : '+ tambah') + '</button>' : '') + '</span><b>' + (o.dm ? '-' + rp(o.dm) : '-') + '</b></div>' +
        (o.lyn ? '<div class="sum-row"><span>Layanan</span><b>' + rp(o.lyn) + '</b></div>' : '') + (o.pjk ? '<div class="sum-row"><span>Pajak</span><b>' + rp(o.pjk) + '</b></div>' : '') +
        '<div class="sum-row" style="color:var(--text)"><span class="semi">Total</span><span class="price" style="font-size:22px">' + rp(o.tot) + '</span></div></div>' +
        (trx && kasir ? '<div class="banner ' + (trx.st === 'pending' ? 'info' : 'warn') + '">' + ic(trx.bukti ? 'image' : 'clock') + '<div class="grow">' + (trx.st === 'verifikasi' ? 'Pelanggan mengunggah bukti ' + esc(CF.LABEL_METODE[trx.met] || trx.met) + '.' : trx.st === 'tinjau' ? 'Perlu ditinjau: ' + esc(trx.cat) : 'Menunggu pembayaran ' + esc(CF.LABEL_METODE[trx.met] || trx.met) + '.') + '</div>' +
          (trx.st !== 'pending' || /transfer|statis/.test(trx.met) ? '<button class="btn btn-sm btn-secondary" data-act="verif" data-trx="' + esc(trx.id) + '">' + ic('eye', 'sm') + 'Periksa</button>' : '') + '</div>' : '') +
        (lain.length ? '<div><div class="label-up mb-8">Pesanan lain di meja ini</div>' + lain.map(x => '<button class="row between soft-box" style="width:100%;padding:10px 12px;margin-bottom:6px" data-act="openDr" data-id="' + esc(x.id) + '"><span class="row"><b>' + esc(x.np) + '</b>' + CF.badgeSt(x.st) + '</span><span class="row">' + CF.badgeSb(x.sb) + '<b class="tnum">' + rp(x.tot) + '</b></span></button>').join('') + '</div>' : '') +
        (o.riw && o.riw.length ? '<details><summary class="small semi" style="cursor:pointer">Riwayat status</summary><div class="col mt-8">' + o.riw.map(r => '<div class="row small"><span class="tnum faint">' + CF.jam(r.at) + '</span>' + CF.badgeSt(r.s === 'lunas' ? 'selesai' : r.s).replace(/Selesai/, r.s === 'lunas' ? 'Lunas' : 'Selesai') + '<span>' + esc(r.by || '') + '</span></div>').join('') + '</div></details>' : '') +
        '</div><div class="df">' + (o.st !== 'batal' && kasir && o.sb !== 'lunas' && o.sb !== 'refund' ? '<button class="btn btn-primary" data-act="bayarKasir" data-id="' + esc(o.id) + '">' + ic('cash', 'sm') + 'Terima Bayar</button>' : '') +
        (nx && o.st !== 'batal' ? '<button class="btn btn-secondary" data-act="setSt" data-id="' + esc(o.id) + '" data-st="' + nx[0] + '">' + ic(nx[2], 'sm') + 'Tandai ' + nx[1] + '</button>' : '') +
        (o.st === 'siap' ? '<button class="btn btn-tint" data-act="panggil" data-id="' + esc(o.id) + '">' + ic('megaphone', 'sm') + 'Panggil</button>' : '') +
        '<button class="btn btn-secondary btn-icon" data-act="cetak" data-id="' + esc(o.id) + '" aria-label="Cetak struk">' + ic('printer', 'sm') + '</button>' +
        (o.st !== 'batal' && kasir ? '<button class="btn btn-danger-o" data-act="batal" data-id="' + esc(o.id) + '">' + ic('ban', 'sm') + 'Batalkan</button>' : '') + '</div>';
    };
    ST.drawer = { refresh: refresh, close: () => { bd.remove(); dr.remove(); ST.drawer = null; } };
    bd.onclick = closeDrawer;
    refresh();
  }
  function closeDrawer() { if (ST.drawer) ST.drawer.close(); }
  CF.openDrawer = openDrawer;
  CF.acts.closeDrawer = closeDrawer;
  CF.acts.openDr = el => openDrawer(el.dataset.id);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.drawer && !document.querySelector('.backdrop')) closeDrawer(); });
  CF.acts.panggil = async el => { const r = await CF.busy(el, () => CF.api('pesanan.panggil', { id: el.dataset.id })); r && r.ok ? CF.toast(r.msg, 'ok') : CF.err(r); };
  // Terima pembayaran di kasir
  CF.acts.bayarKasir = el => {
    const o = byId(el.dataset.id); if (!o) return;
    let met = 'tunai';
    const quick = [o.tot, Math.ceil(o.tot / 50000) * 50000, Math.ceil(o.tot / 100000) * 100000].filter((v, i, a) => a.indexOf(v) === i).concat([Math.ceil(o.tot / 100000) * 100000 + 100000]).slice(0, 4);
    const m = CF.modal({ title: 'Terima Pembayaran — ' + o.np, size: 'sm',
      body: '<div class="center"><div class="small faint">Total tagihan</div><div class="price" style="font-size:32px">' + rp(o.tot) + '</div></div>' +
        '<div class="seg mt-16" style="width:100%">' + [['tunai', 'Tunai', 'cash'], ['debit', 'Debit', 'card'], ['kredit', 'Kredit', 'card'], ['qris_kasir', 'QRIS', 'qr']].map(x => '<button type="button" class="grow' + (x[0] === 'tunai' ? ' on' : '') + '" data-m="' + x[0] + '" style="justify-content:center">' + ic(x[2], 'sm') + x[1] + '</button>').join('') + '</div>' +
        '<div id="tunai-box" class="mt-16"><div class="field"><label class="label" for="ui-trm">Uang diterima</label><input class="input tnum" id="ui-trm" inputmode="numeric" value="' + o.tot + '" style="font-size:20px;font-weight:700"></div>' +
        '<div class="row wrap mt-8" style="gap:6px">' + quick.map(v => '<button type="button" class="chip" data-v="' + v + '">' + (v === o.tot ? 'Uang pas' : rp(v)) + '</button>').join('') + '</div>' +
        '<div class="row between soft-box mt-12"><span class="semi">Kembalian</span><span class="price" id="kmb" style="font-size:22px">Rp 0</span></div></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="by-ok" data-loading="Menyimpan…">' + ic('check', 'sm') + 'Konfirmasi Lunas</button>' });
    const trm = m.$('#ui-trm'), upd = () => { const v = Number(String(trm.value).replace(/\D/g, '')) || 0; m.$('#kmb').textContent = v >= o.tot ? rp(v - o.tot) : 'Kurang ' + rp(o.tot - v); m.$('#kmb').style.color = v >= o.tot ? '' : 'var(--red-text)'; };
    trm.oninput = upd; upd();
    m.$$('[data-v]').forEach(b => b.onclick = () => { trm.value = b.dataset.v; upd(); });
    m.$$('[data-m]').forEach(b => b.onclick = () => { met = b.dataset.m; m.$$('[data-m]').forEach(x => x.classList.toggle('on', x === b)); m.$('#tunai-box').classList.toggle('hide', met !== 'tunai'); });
    m.$('#by-ok').onclick = async () => {
      const r = await CF.busy(m.$('#by-ok'), () => CF.api('bayar.kasir', { id: o.id, metode: met, diterima: Number(String(trm.value).replace(/\D/g, '')) || 0 }));
      if (!r.ok) return CF.err(r);
      m.close(); CF.toast(r.msg, 'ok'); await CF.refreshLive();
      if (CF.store.get('autoPrint', false)) printReceipt(o.id);
    };
  };
  // Diskon manual (dengan batas kasir)
  CF.acts.diskon = el => {
    const o = byId(el.dataset.id); if (!o) return;
    const cfg = (ST.live && ST.live.cfg) || {}, base = o.sub - o.dp;
    const m = CF.modal({ title: 'Diskon Manual — ' + o.np, size: 'sm',
      body: '<div class="seg" style="width:100%"><button type="button" class="grow on" data-t="persen" style="justify-content:center">Persen (%)</button><button type="button" class="grow" data-t="nominal" style="justify-content:center">Nominal (Rp)</button></div>' +
        '<div class="field mt-12"><label class="label" for="dk-v">Nilai diskon</label><input class="input" id="dk-v" inputmode="decimal" value="' + (o.dm ? Math.round(o.dm / base * 100) : '') + '" placeholder="mis. 10"></div>' +
        '<div class="row between soft-box mt-8 small"><span>Potongan</span><b id="dk-j" class="green">Rp 0</b></div>' +
        (ST.me.role === 'kasir' ? '<p class="help mt-8">Batas diskon kasir: ' + cfg.limP + '% / ' + rp(cfg.limN) + '. Di atas itu perlu persetujuan Owner.</p>' : '') +
        '<div class="field mt-12"><label class="label" for="dk-a">Alasan <span class="req">*</span></label><input class="input" id="dk-a" placeholder="mis. pelanggan tetap, kompensasi"></div><p class="help mt-8">Isi 0 untuk menghapus diskon.</p>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="dk-ok" data-loading="Menyimpan…">Terapkan</button>' });
    let tipe = 'persen';
    const j = () => { const v = Number(String(m.$('#dk-v').value).replace(',', '.')) || 0; return Math.min(base, tipe === 'persen' ? Math.round(base * Math.min(100, v) / 100) : Math.round(v)); };
    const upd = () => { const x = j(); m.$('#dk-j').textContent = rp(x); const over = ST.me.role === 'kasir' && x > 0 && (x / base * 100 > cfg.limP + 1e-9 || x > cfg.limN); m.$('#dk-ok').textContent = over ? 'Minta Persetujuan Owner' : 'Terapkan'; };
    m.$('#dk-v').oninput = upd; upd();
    m.$$('[data-t]').forEach(b => b.onclick = () => { tipe = b.dataset.t; m.$$('[data-t]').forEach(x => x.classList.toggle('on', x === b)); upd(); });
    m.$('#dk-ok').onclick = async () => {
      const r = await CF.busy(m.$('#dk-ok'), () => CF.api('pesanan.diskon', { id: o.id, tipe: tipe, nilai: Number(String(m.$('#dk-v').value).replace(',', '.')) || 0, alasan: m.$('#dk-a').value }));
      if (!r.ok) return CF.err(r);
      m.close(); CF.toast(r.msg, r.data && r.data.perluPersetujuan ? 'info' : 'ok'); CF.refreshLive();
    };
  };
  CF.acts.batal = async el => {
    const o = byId(el.dataset.id); if (!o) return;
    const alasan = await CF.confirm({ title: 'Batalkan ' + o.np + '?', danger: true, ok: 'Batalkan Pesanan', msg: 'Pembatalan tercatat di activity log.' + (o.sb === 'lunas' ? ' Pesanan ini SUDAH DIBAYAR — dana perlu dikembalikan.' : ''),
      input: { label: 'Alasan pembatalan', required: true, options: ['Pelanggan berubah pikiran', 'Salah input pesanan', 'Menu habis', 'Pelanggan pergi', 'Pesanan ganda'], placeholder: 'Keterangan tambahan (opsional bila sudah memilih alasan)' } });
    if (!alasan) return;
    let r = await CF.api('pesanan.batal', { id: o.id, alasan: alasan });
    if (!r.ok && r.error.kode === 'KONFIRMASI') { if (!(await CF.confirm({ title: 'Yakin?', msg: r.error.pesan, danger: true, ok: 'Tetap batalkan' }))) return; r = await CF.api('pesanan.batal', { id: o.id, alasan: alasan, konfirmasi: true }); }
    if (!r.ok) return CF.err(r);
    CF.toast(r.msg, r.msg.indexOf('pengembalian') > -1 ? 'warn' : 'ok', 7000); CF.refreshLive();
  };
  // Cetak struk thermal 58/80 mm dari browser kasir
  function thermalHtml(o) {
    const set = (ST.boot && ST.boot.set) || {}, w = set.struk_kertas === '58' ? 'w58' : '';
    const r = (a, b) => '<div class="r"><span>' + a + '</span><span>' + b + '</span></div>';
    return '<div class="thermal ' + w + '">' + (set.struk_tampil_logo === 'Y' && set.logo_thumb_url ? '<img src="' + esc(set.logo_thumb_url) + '" alt="">' : '') +
      '<div class="c"><b>' + esc(set.nama_aplikasi || '') + '</b><br>' + esc(set.alamat || '') + (set.telepon ? '<br>' + esc(set.telepon) : '') + '</div><hr>' +
      r('No', esc(o.id)) + r('Antrean', '<b>' + esc(o.np) + '</b>') + r('Meja', esc(o.mn || '-')) + r('Waktu', CF.tglJam(o.dib)) + r('Kasir', esc(o.kasir || ST.me.nama)) + (o.nama ? r('Tamu', esc(o.nama)) : '') + '<hr>' +
      o.items.map(i => '<div>' + esc(i.n) + '</div>' + (i.o ? '<div style="padding-left:8px">' + esc(i.o) + '</div>' : '') + (i.c ? '<div style="padding-left:8px">* ' + esc(i.c) + '</div>' : '') + r('&nbsp;' + i.q + ' x ' + CF.num(i.h), CF.num(i.s))).join('') + '<hr>' +
      r('Subtotal', CF.num(o.sub)) + (o.dp ? r('Promo', '-' + CF.num(o.dp)) : '') + (o.dm ? r('Diskon', '-' + CF.num(o.dm)) : '') + (o.lyn ? r('Layanan', CF.num(o.lyn)) : '') + (o.pjk ? r(esc(set.label_pajak || 'Pajak'), CF.num(o.pjk)) : '') +
      '<div class="r" style="font-size:1.15em"><b>TOTAL</b><b>' + CF.num(o.tot) + '</b></div>' + r('Bayar', esc(o.sb === 'lunas' ? (CF.LABEL_METODE[o.met] || o.met) : 'BELUM LUNAS')) + '<hr><div class="c">' + esc(set.struk_footer || 'Terima kasih!') + '</div></div>';
  }
  function printReceipt(id) {
    const o = byId(id); if (!o) return;
    const pa = document.getElementById('print-area'); pa.innerHTML = thermalHtml(o);
    let st = document.getElementById('thermal-page'); if (!st) { st = document.createElement('style'); st.id = 'thermal-page'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:' + (((ST.boot || {}).set || {}).struk_kertas === '58' ? '58mm' : '80mm') + ' auto;margin:3mm}}';
    document.body.classList.add('print-receipt'); setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('print-receipt'); st.textContent = ''; }, 500); }, 60);
  }
  CF.printReceipt = printReceipt;
  CF.acts.cetak = el => printReceipt(el.dataset.id);

  // ------------------------------------------------------------------
  // Halaman: Pesanan Masuk (kasir & admin)
  // ------------------------------------------------------------------
  const FIL = [['aktif', 'Aktif'], ['baru', 'Baru'], ['diproses', 'Diproses'], ['siap', 'Siap'], ['selesai', 'Selesai'], ['batal', 'Dibatalkan'], ['semua', 'Semua']];
  page('pesanan', { title: 'Pesanan Masuk', icon: 'receipt', roles: ['admin', 'kasir'], sec: 'Operasional', live: true,
    render(el) {
      const L = ST.live;
      if (!L) { el.innerHTML = '<div class="ord-grid">' + '<div class="skel" style="height:240px;border-radius:16px"></div>'.repeat(6) + '</div>'; return; }
      const f = ST.filter, q = f.q.toLowerCase(), t0 = Date.parse(CF.isoHari() + 'T00:00:00+07:00');
      const list = orders().filter(o => {
        if (f.st === 'aktif' && (o.st === 'batal' || (o.st === 'selesai' && o.sb === 'lunas'))) return false;
        if (f.st !== 'aktif' && f.st !== 'semua' && o.st !== f.st) return false;
        if (f.sb === 'belum' && (o.sb === 'lunas' || o.st === 'batal')) return false;
        if (f.sb === 'lunas' && o.sb !== 'lunas') return false;
        if (q && (o.id + ' ' + o.np + ' ' + o.mn + ' ' + o.nama).toLowerCase().indexOf(q) === -1) return false;
        return true;
      }).sort((a, b) => { const w = { baru: 0, diproses: 1, siap: 2, selesai: 3, batal: 4 }; return (w[a.st] - w[b.st]) || (b.dib - a.dib); });
      const cnt = k => orders().filter(o => k === 'semua' || (k === 'aktif' ? !(o.st === 'batal' || (o.st === 'selesai' && o.sb === 'lunas')) : o.st === k)).length;
      const bt = (L.bantuan || []);
      el.innerHTML = bt.map(b => '<div class="banner orange">' + ic('concierge') + '<div class="grow"><b>Meja ' + esc(b.mn) + '</b> memanggil pelayan • ' + CF.lalu(b.at) + '</div><button class="btn btn-sm btn-secondary" data-act="bantuanOk" data-id="' + esc(b.id) + '">' + ic('check', 'sm') + 'Sudah ditangani</button></div>').join('') +
        ((L.aprv || []).length && ST.me.role === 'kasir' ? '<div class="banner warn">' + ic('clock') + '<div>' + L.aprv.length + ' permintaan diskon menunggu persetujuan Owner.</div></div>' : '') +
        '<div class="page-head"><div class="filters"><div class="chips">' + FIL.map(x => '<button class="chip' + (f.st === x[0] ? ' on' : '') + '" data-act="fil" data-st="' + x[0] + '">' + x[1] + ' <span class="n">' + cnt(x[0]) + '</span></button>').join('') + '</div></div>' +
        '<div class="filters"><select class="select" id="f-sb" aria-label="Status bayar"><option value="">Semua pembayaran</option><option value="belum"' + (f.sb === 'belum' ? ' selected' : '') + '>Belum lunas</option><option value="lunas"' + (f.sb === 'lunas' ? ' selected' : '') + '>Lunas</option></select>' +
        '<div class="search"><input class="input" id="f-q" type="search" placeholder="No. pesanan / meja / nama" value="' + esc(f.q) + '" aria-label="Cari pesanan">' + ic('search') + '</div>' +
        '<button class="btn btn-primary" data-act="nav" data-k="manual">' + ic('plus', 'sm') + 'Pesanan Manual</button></div></div>' +
        (list.length ? '<div class="ord-grid">' + list.map(CF.orderCard).join('') + '</div>' : '<div class="card"><div class="empty"><div class="art">' + ic('receipt') + '</div><h4>Tidak ada pesanan</h4><p>Pesanan baru dari QR meja akan muncul otomatis di sini (disertai bunyi).</p></div></div>');
      el.querySelector('#f-sb').onchange = e => { f.sb = e.target.value; this.render(el); };
      const qi = el.querySelector('#f-q'); qi.oninput = CF.debounce(() => { f.q = qi.value; this.render(el); const n = document.getElementById('f-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
    } });
  CF.acts.fil = el => { ST.filter.st = el.dataset.st; render(); };
  CF.acts.bantuanOk = async el => { await CF.api('bantuan.selesai', { id: el.dataset.id }); CF.refreshLive(); };

  // ------------------------------------------------------------------
  // Halaman: Meja & Sesi
  // ------------------------------------------------------------------
  function mejaState(m) {
    if (!m.aktif) return 'nonaktif';
    if (!m.sesi) return 'tersedia';
    const os = orders().filter(o => o.sesi === m.sesi.id && o.st !== 'batal');
    return os.some(o => o.st !== 'selesai' || o.sb !== 'lunas') ? 'memesan' : 'terisi';
  }
  const MS = { tersedia: ['Tersedia', 'checkC', 'b-green'], terisi: ['Terisi', 'users', 'b-orange'], memesan: ['Sedang Memesan', 'edit', 'b-amber'], nonaktif: ['Nonaktif', 'ban', 'b-neutral'] };
  page('meja', { title: 'Meja & Sesi', icon: 'grid', roles: ['admin', 'kasir'], sec: 'Operasional', live: true,
    render(el) {
      const L = ST.live; if (!L) { el.innerHTML = '<div class="tables">' + '<div class="skel" style="height:118px;border-radius:16px"></div>'.repeat(12) + '</div>'; return; }
      const ms = L.meja || [], sel = ms.filter(m => m.id === ST.selMeja)[0];
      const cnt = k => ms.filter(m => mejaState(m) === k).length;
      el.innerHTML = '<div class="page-head"><div class="row wrap" style="gap:8px">' + ['tersedia', 'terisi', 'memesan'].map(k => '<span class="badge ' + MS[k][2] + '" style="padding:6px 12px">' + ic(MS[k][1], 'sm') + MS[k][0] + ' • ' + cnt(k) + '</span>').join('') + '</div><span class="small faint">Klik meja untuk membuka/menutup sesi</span></div>' +
        '<div style="display:grid;grid-template-columns:minmax(0,1fr) ' + (sel ? 'minmax(300px,380px)' : '0') + ';gap:18px;align-items:start" class="meja-layout"><div class="tables">' + ms.map(m => {
          const s = mejaState(m), os = m.sesi ? orders().filter(o => o.sesi === m.sesi.id && o.st !== 'batal') : [], unpaid = os.filter(o => o.sb !== 'lunas').reduce((a, o) => a + o.tot, 0);
          return '<button class="tbl-tile ' + s + (m.id === ST.selMeja ? ' sel' : '') + '" data-act="selMeja" data-id="' + esc(m.id) + '"><div class="row between"><span class="tn">' + esc(m.no) + '</span><span class="badge ' + MS[s][2] + '">' + ic(MS[s][1], 'sm') + MS[s][0] + '</span></div>' +
            '<div class="small faint">' + ic('users', 'sm') + ' ' + (m.sesi ? (m.sesi.tamu || '-') + ' tamu' : m.kap + ' kursi') + '</div>' +
            (m.sesi ? '<div class="small">' + os.length + ' pesanan • ' + CF.lalu(m.sesi.dibuka) + '</div>' + (unpaid ? '<div class="small semi amber">Belum bayar ' + rp(unpaid) + '</div>' : '') : '') + '</button>';
        }).join('') + '</div>' + (sel ? '<div class="card pad" style="position:sticky;top:84px">' + mejaPanel(sel) + '</div>' : '<div></div>') + '</div>';
    } });
  function mejaPanel(m) {
    const s = mejaState(m), os = m.sesi ? orders().filter(o => o.sesi === m.sesi.id) : [];
    if (!m.sesi) return '<div class="row between"><h3>Meja ' + esc(m.no) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-act="selMeja" data-id="" aria-label="Tutup panel">' + ic('x') + '</button></div><p class="muted mt-8">Meja kosong. Buka sesi saat tamu duduk agar QR meja bisa dipakai memesan.</p>' +
      '<label class="check mt-16"><input type="checkbox" id="ms-multi" checked> Izinkan beberapa HP memesan di meja ini</label>' +
      '<div class="field mt-12"><label class="label" for="ms-tamu">Jumlah tamu (opsional)</label><input class="input" id="ms-tamu" type="number" min="0" max="30" placeholder="mis. 2"></div>' +
      '<button class="btn btn-primary btn-block mt-16" data-act="bukaSesi" data-id="' + esc(m.id) + '" data-loading="Membuka…">' + ic('qr', 'sm') + 'Buka Sesi Meja</button>' +
      '<button class="btn btn-secondary btn-block mt-8" data-act="manualMeja" data-id="' + esc(m.id) + '">' + ic('plus', 'sm') + 'Pesanan Manual</button>';
    return '<div class="row between"><h3>Meja ' + esc(m.no) + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-act="selMeja" data-id="" aria-label="Tutup panel">' + ic('x') + '</button></div>' +
      '<div class="row wrap mt-8" style="gap:6px"><span class="badge ' + MS[s][2] + '">' + MS[s][0] + '</span><span class="badge b-neutral">' + (m.sesi.multi ? 'Multi-HP' : '1 HP') + ' • ' + m.sesi.nDev + ' perangkat</span></div>' +
      (m.sesi.pin ? '<div class="soft-box center mt-12"><div class="label-up">PIN meja</div><div class="head tnum" style="font-size:34px;font-weight:800;letter-spacing:.3em">' + esc(m.sesi.pin) + '</div><div class="help">Beritahukan ke tamu</div></div>' : '') +
      '<div class="small faint mt-12">Dibuka ' + CF.jam(m.sesi.dibuka) + ' oleh ' + esc(m.sesi.by || '-') + '</div><div class="col mt-12">' +
      (os.length ? os.map(o => '<button class="row between soft-box" style="width:100%;padding:10px 12px" data-act="openDr" data-id="' + esc(o.id) + '"><span class="row"><b>' + esc(o.np) + '</b>' + CF.badgeSt(o.st) + '</span><span class="row">' + CF.badgeSb(o.sb) + '<b class="tnum">' + rp(o.tot) + '</b></span></button>').join('') : '<p class="small faint">Belum ada pesanan.</p>') + '</div>' +
      '<button class="btn btn-secondary btn-block mt-16" data-act="manualMeja" data-id="' + esc(m.id) + '">' + ic('plus', 'sm') + 'Tambah Pesanan Manual</button>' +
      '<button class="btn btn-danger-o btn-block mt-8" data-act="tutupSesi" data-id="' + esc(m.id) + '" data-loading="Menutup…">' + ic('lock', 'sm') + 'Tutup Sesi</button>';
  }
  CF.acts.selMeja = el => { ST.selMeja = el.dataset.id || null; render(); };
  CF.acts.bukaSesi = async el => {
    const r = await CF.busy(el, () => CF.api('meja.buka', { mejaId: el.dataset.id, multi: document.getElementById('ms-multi').checked, tamu: Number(document.getElementById('ms-tamu').value) || 0 }));
    if (!r.ok) return CF.err(r);
    CF.toast(r.msg, 'ok', r.data.sesi.pin ? 10000 : 4000); await CF.refreshLive();
  };
  CF.acts.tutupSesi = async el => {
    const m = (ST.live.meja || []).filter(x => x.id === el.dataset.id)[0];
    let r = await CF.busy(el, () => CF.api('meja.tutup', { mejaId: el.dataset.id }));
    if (!r.ok && r.error.kode === 'UNPAID') {
      const a = await CF.confirm({ title: 'Ada pesanan belum lunas', danger: true, ok: 'Tutup Paksa', html: esc(r.error.pesan) + '<br>' + (r.error.data || []).map(x => '• ' + esc(x.np) + ' — ' + rp(x.tot)).join('<br>') + '<br><br>Selesaikan pembayaran dulu, atau tutup paksa dengan alasan (tercatat di log).', input: { label: 'Alasan menutup paksa', required: true } });
      if (!a) return; r = await CF.api('meja.tutup', { mejaId: el.dataset.id, paksa: true, alasan: a });
    }
    if (!r.ok) return CF.err(r);
    CF.toast(r.msg, 'ok'); ST.selMeja = null; await CF.refreshLive(); if (m) render();
  };
  CF.acts.manualMeja = el => { ST.manual.meja = el.dataset.id; CF.go('manual'); };

  // ------------------------------------------------------------------
  // Halaman: Pesanan Manual (POS kasir)
  // ------------------------------------------------------------------
  const menuOf = id => ((ST.boot && ST.boot.menu) || []).filter(m => m.id === id)[0];
  function manualCalc() {
    const set = (ST.boot && ST.boot.set) || {};
    let sub = 0; ST.manual.lines.forEach(l => { const m = menuOf(l.m); if (!m) return; let u = m.harga; m.opsi.forEach(g => g.pilihan.forEach(p => { if (l.o.indexOf(p.id) > -1) u += p.harga; })); sub += u * l.q; });
    const p = Number(set.pajak_persen || 0) / 100, ly = Math.round(sub * Number(set.layanan_persen || 0) / 100);
    let pjk, tot; if (set.harga_termasuk_pajak === 'Y') { tot = sub + ly; pjk = Math.round(tot - tot / (1 + p)); } else { pjk = Math.round((sub + ly) * p); tot = sub + ly + pjk; }
    return { sub: sub, pjk: pjk, lyn: ly, tot: tot };
  }
  page('manual', { title: 'Pesanan Manual', icon: 'plus', roles: ['admin', 'kasir'], sec: 'Operasional',
    render(el) {
      const B = ST.boot; if (!B) { el.innerHTML = '<div class="skel" style="height:400px"></div>'; return; }
      const M = ST.manual, q = (M.q || '').toLowerCase(), kat = M.kat || 'all';
      const list = B.menu.filter(m => (kat === 'all' || m.kat === kat) && (!q || m.nama.toLowerCase().indexOf(q) > -1));
      const ms = (ST.live && ST.live.meja) || [], c = manualCalc();
      el.innerHTML = '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:18px;align-items:start" class="pos-layout"><section class="col gap-12">' +
        '<div class="search"><input class="input" id="pm-q" type="search" placeholder="Cari menu…" value="' + esc(M.q || '') + '" aria-label="Cari menu">' + ic('search') + '</div>' +
        '<div class="chips"><button class="chip' + (kat === 'all' ? ' on' : '') + '" data-act="pmKat" data-k="all">Semua</button>' + B.kat.map(k => '<button class="chip' + (kat === k.id ? ' on' : '') + '" data-act="pmKat" data-k="' + k.id + '">' + esc(k.nama) + '</button>').join('') + '</div>' +
        '<div class="prod-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">' + list.map(m => '<button class="prod' + (m.ada ? '' : ' habis') + '" style="text-align:left" data-act="pmAdd" data-id="' + m.id + '"' + (m.ada ? '' : ' disabled') + '><div class="media" style="aspect-ratio:4/3">' + CF.img(m.foto, m.nama) + (m.stok !== null ? '<span class="tl badge b-dark">' + (m.ada ? 'Stok ' + m.stok : 'Habis') + '</span>' : !m.ada ? '<span class="tl badge b-dark">Habis</span>' : '') + '</div><div class="nm small">' + esc(m.nama) + '</div><div class="price small mt-4">' + rp(m.harga) + '</div></button>').join('') + '</div></section>' +
        '<aside class="card pad" style="position:sticky;top:84px"><h3>Pesanan Baru</h3><div class="field mt-12"><label class="label" for="pm-meja">Meja</label><select class="select" id="pm-meja"><option value="">Bawa Pulang (takeaway)</option>' + ms.filter(m => m.aktif).map(m => '<option value="' + esc(m.id) + '"' + (M.meja === m.id ? ' selected' : '') + '>Meja ' + esc(m.no) + (m.sesi ? ' — sesi aktif' : '') + '</option>').join('') + '</select><span class="help">Meja tanpa sesi akan dibuka otomatis.</span></div>' +
        '<div class="field mt-12"><label class="label" for="pm-nama">Nama pelanggan (opsional)</label><input class="input" id="pm-nama" value="' + esc(M.nama || '') + '"></div>' +
        '<div class="col mt-12">' + (M.lines.length ? M.lines.map((l, i) => { const m = menuOf(l.m) || { nama: '?' }; return '<div class="row between soft-box" style="padding:8px 10px"><div class="grow" style="min-width:0"><div class="semi small ellipsis">' + esc(m.nama) + '</div>' + (l.ot ? '<div class="xs faint ellipsis">' + esc(l.ot) + '</div>' : '') + '</div><div class="stepper"><button data-act="pmDec" data-i="' + i + '" aria-label="Kurangi">' + ic('minus', 'sm') + '</button><span class="v">' + l.q + '</span><button class="plus" data-act="pmInc" data-i="' + i + '" aria-label="Tambah">' + ic('plus', 'sm') + '</button></div></div>'; }).join('') : '<p class="small faint">Klik menu di kiri untuk menambahkan.</p>') + '</div>' +
        '<div class="divider"></div><div class="sum-row"><span>Subtotal</span><b>' + rp(c.sub) + '</b></div>' + (c.lyn ? '<div class="sum-row"><span>Layanan</span><b>' + rp(c.lyn) + '</b></div>' : '') + (c.pjk ? '<div class="sum-row"><span>Pajak</span><b>' + rp(c.pjk) + '</b></div>' : '') +
        '<div class="total-row mt-8"><span class="semi">Total</span><span class="big" style="font-size:26px">' + rp(c.tot) + '</span></div>' +
        '<div class="col mt-16"><button class="btn btn-primary btn-block" data-act="pmSimpan" data-bayar="1" data-loading="Menyimpan…"' + (M.lines.length ? '' : ' disabled') + '>' + ic('cash', 'sm') + 'Simpan & Terima Bayar</button><button class="btn btn-secondary btn-block" data-act="pmSimpan" data-loading="Menyimpan…"' + (M.lines.length ? '' : ' disabled') + '>Simpan (bayar nanti)</button>' +
        (M.lines.length ? '<button class="btn btn-ghost btn-sm" data-act="pmReset">Kosongkan</button>' : '') + '</div></aside></div>';
      const qi = el.querySelector('#pm-q'); qi.oninput = CF.debounce(() => { M.q = qi.value; this.render(el); const n = document.getElementById('pm-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200);
      el.querySelector('#pm-meja').onchange = e => { M.meja = e.target.value; };
      el.querySelector('#pm-nama').oninput = e => { M.nama = e.target.value; };
    } });
  CF.acts.pmKat = el => { ST.manual.kat = el.dataset.k; render(); };
  CF.acts.pmAdd = el => {
    const m = menuOf(el.dataset.id); if (!m) return;
    const add = (o, ot) => { const key = m.id + '|' + o.join(','); const ex = ST.manual.lines.filter(l => l.key === key)[0]; if (ex) ex.q++; else ST.manual.lines.push({ key: key, m: m.id, o: o, ot: ot, q: 1 }); render(); };
    if (!m.opsi.length) return add([], '');
    const sel = []; m.opsi.forEach(g => { if (g.wajib && g.maks === 1) sel.push(g.pilihan[0].id); });
    const md = CF.modal({ title: m.nama, size: 'sm', body: m.opsi.map(g => '<div class="label mt-12 mb-8">' + esc(g.nama) + (g.wajib ? ' <span class="req">*</span>' : '') + '</div>' + g.pilihan.map(p => '<label class="check" style="min-height:36px"><input type="' + (g.wajib && g.maks === 1 ? 'radio' : 'checkbox') + '" name="' + g.id + '" value="' + p.id + '"' + (sel.indexOf(p.id) > -1 ? ' checked' : '') + '> ' + esc(p.nama) + (p.harga ? ' <span class="faint small">+' + rp(p.harga) + '</span>' : '') + '</label>').join('')).join(''),
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="pm-ok">Tambah</button>' });
    md.$('#pm-ok').onclick = () => {
      const o = [].map.call(md.$$('input:checked'), i => i.value), names = [];
      for (const g of m.opsi) { const n = g.pilihan.filter(p => o.indexOf(p.id) > -1); if (g.wajib && !n.length) return CF.toast('Pilih ' + g.nama + '.', 'warn'); if (n.length > g.maks) return CF.toast(g.nama + ' maksimal ' + g.maks + '.', 'warn'); n.forEach(p => names.push(p.nama)); }
      md.close(); add(o, names.join(', '));
    };
  };
  CF.acts.pmInc = el => { ST.manual.lines[+el.dataset.i].q++; render(); };
  CF.acts.pmDec = el => { const l = ST.manual.lines[+el.dataset.i]; l.q--; if (l.q <= 0) ST.manual.lines.splice(+el.dataset.i, 1); render(); };
  CF.acts.pmReset = () => { ST.manual = { lines: [], meja: '', nama: '' }; render(); };
  CF.acts.pmSimpan = async el => {
    const M = ST.manual;
    const r = await CF.busy(el, () => CF.api('pesanan.manual', { mejaId: M.meja, nama: M.nama, items: M.lines.map(l => ({ m: l.m, q: l.q, o: l.o })) }));
    if (!r.ok) return CF.err(r);
    CF.toast(r.msg, 'ok'); ST.manual = { lines: [], meja: '', nama: '' };
    await CF.refreshLive();
    if (el.dataset.bayar) { CF.go('pesanan'); setTimeout(() => CF.acts.bayarKasir({ dataset: { id: r.data.id } }), 50); } else render();
  };

  // ------------------------------------------------------------------
  // Halaman: Verifikasi Pembayaran (bukti transfer / QRIS statis)
  // ------------------------------------------------------------------
  page('verifikasi', { title: 'Verifikasi Pembayaran', icon: 'approve', roles: ['admin', 'kasir'], sec: 'Operasional', live: true,
    render(el) {
      const L = ST.live; if (!L) { el.innerHTML = '<div class="skel" style="height:300px"></div>'; return; }
      const list = (L.trx || []).filter(t => t.st === 'verifikasi' || t.st === 'tinjau' || (t.st === 'pending' && /transfer|statis/.test(t.met)));
      el.innerHTML = list.length ? '<div class="col gap-12">' + list.map(t => { const o = byId(t.psn) || {}; return '<div class="card pad-s row wrap" style="gap:14px"><span class="avatar">' + ic(t.bukti ? 'image' : 'clock') + '</span><div class="grow"><div class="row"><b>' + esc(o.np || t.psn) + '</b><span class="mtag">' + esc(o.mn ? 'Meja ' + o.mn : '-') + '</span>' + (t.st === 'verifikasi' ? '<span class="badge b-amber">Bukti diunggah</span>' : t.st === 'tinjau' ? '<span class="badge b-red">Perlu ditinjau</span>' : '<span class="badge b-neutral">Menunggu bukti</span>') + '</div><div class="small faint mt-4">' + esc(CF.LABEL_METODE[t.met] || t.met) + ' • ' + CF.lalu(t.waktu) + (t.cat ? ' • ' + esc(t.cat) : '') + '</div></div><span class="price" style="font-size:18px">' + rp(t.jml) + '</span><button class="btn btn-primary" data-act="verif" data-trx="' + esc(t.id) + '">' + ic('eye', 'sm') + 'Periksa</button></div>'; }).join('') + '</div>'
        : '<div class="card"><div class="empty"><div class="art">' + ic('approve') + '</div><h4>Tidak ada yang perlu diverifikasi</h4><p>Bukti transfer & QRIS dari pelanggan akan muncul di sini.</p></div></div>';
    } });
  CF.acts.verif = async el => {
    const t = (ST.live.trx || []).filter(x => x.id === el.dataset.trx)[0]; if (!t) return;
    const o = byId(t.psn) || {};
    const m = CF.modal({ title: 'Verifikasi — ' + (o.np || t.psn), size: 'lg',
      body: '<div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px" class="verif-grid"><div class="soft-box center" id="vf-img" style="min-height:260px;display:grid;place-items:center">' + (t.bukti ? '<span class="spin" style="width:22px;height:22px;border:2px solid var(--primary);border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></span>' : '<div class="faint">Belum ada bukti diunggah.<br>Cek mutasi rekening / QRIS secara manual.</div>') + '</div>' +
        '<div class="col"><div class="sum-row"><span>No. pesanan</span><b>' + esc(t.psn) + '</b></div><div class="sum-row"><span>Meja</span><b>' + esc(o.mn || '-') + '</b></div><div class="sum-row"><span>Metode</span><b>' + esc(CF.LABEL_METODE[t.met] || t.met) + '</b></div><div class="sum-row"><span>Waktu</span><b>' + CF.tglJam(t.waktu) + '</b></div>' +
        '<div class="soft-box mt-8 center"><div class="small faint">Nominal yang harus diterima</div><div class="price" style="font-size:28px">' + rp(t.jml) + '</div></div>' + (t.cat ? '<div class="banner warn">' + ic('alert') + '<div>' + esc(t.cat) + '</div></div>' : '') +
        '<p class="help">Cocokkan nominal & nama pengirim dengan mutasi rekening/QRIS sebelum menyetujui.</p></div></div>',
      foot: '<button class="btn btn-danger-o" id="vf-no">' + ic('x', 'sm') + 'Tolak</button><button class="btn btn-success" id="vf-ok" data-loading="Menyimpan…">' + ic('check', 'sm') + 'Setujui — Lunas</button>' });
    if (t.bukti) CF.api('bukti.lihat', { trxId: t.id }).then(r => { const b = m.$('#vf-img'); if (b) b.innerHTML = r.ok ? '<img src="data:' + r.data.type + ';base64,' + r.data.b64 + '" alt="Bukti pembayaran" style="max-height:60vh;border-radius:12px;cursor:zoom-in" onclick="window.open(this.src)">' : '<div class="faint">Gagal memuat bukti.</div>'; });
    m.$('#vf-ok').onclick = async () => { const r = await CF.busy(m.$('#vf-ok'), () => CF.api('bayar.verifikasi', { trxId: t.id, setuju: true })); if (!r.ok) return CF.err(r); m.close(); CF.toast(r.msg, 'ok'); CF.refreshLive(); };
    m.$('#vf-no').onclick = async () => { const a = await CF.confirm({ title: 'Tolak pembayaran?', danger: true, ok: 'Tolak', input: { label: 'Alasan penolakan', required: true, options: ['Nominal tidak sesuai', 'Dana belum masuk', 'Bukti tidak jelas', 'Bukti bukan untuk pesanan ini'] } }); if (!a) return; const r = await CF.api('bayar.verifikasi', { trxId: t.id, setuju: false, alasan: a }); if (!r.ok) return CF.err(r); m.close(); CF.toast(r.msg, 'ok'); CF.refreshLive(); };
  };

  // ------------------------------------------------------------------
  // Halaman: Transaksi Hari Ini (ringkasan operasional kasir)
  // ------------------------------------------------------------------
  page('transaksi', { title: 'Transaksi Hari Ini', icon: 'wallet', roles: ['admin', 'kasir'], sec: 'Operasional', live: true,
    render(el) {
      const t0 = Date.parse(CF.isoHari() + 'T00:00:00+07:00'), list = orders().filter(o => o.dib >= t0).sort((a, b) => b.dib - a.dib);
      const ok = list.filter(o => o.sb === 'lunas'), tunai = ok.filter(o => o.met === 'tunai').reduce((a, o) => a + o.tot, 0), total = ok.reduce((a, o) => a + o.tot, 0);
      const per = {}; ok.forEach(o => { per[o.met] = (per[o.met] || 0) + o.tot; });
      const kpi = (k, v, i, c, d) => '<div class="kpi"><div class="k"><span class="ib ' + (c || '') + '">' + ic(i, 'sm') + '</span>' + k + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>';
      el.innerHTML = '<div class="kpis">' + kpi('Pesanan hari ini', list.filter(o => o.st !== 'batal').length, 'receipt') + kpi('Transaksi berhasil', ok.length, 'checkC', 'g') + kpi('Total tunai', rp(tunai), 'cash', 'a', 'Uang fisik di laci') + kpi('Total non-tunai', rp(total - tunai), 'card', 'b') + '</div>' +
        '<div class="dash-grid"><div class="card pad"><div class="card-title"><h3>Pembayaran per metode</h3><span class="small faint">' + rp(total) + '</span></div><div id="ch-met"></div></div>' +
        '<div class="card pad"><div class="card-title"><h3>Belum lunas</h3></div>' + (list.filter(o => o.sb !== 'lunas' && o.st !== 'batal' && o.sb !== 'refund').map(o => '<button class="row between soft-box" style="width:100%;margin-bottom:6px;padding:10px 12px" data-act="openDr" data-id="' + esc(o.id) + '"><span class="row"><b>' + esc(o.np) + '</b><span class="small faint">Meja ' + esc(o.mn) + '</span></span><b class="tnum">' + rp(o.tot) + '</b></button>').join('') || '<p class="small faint">Semua pesanan hari ini sudah lunas.</p>') + '</div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>No. Pesanan</th><th>Meja</th><th>Metode</th><th>Status</th><th class="num">Jumlah</th><th></th></tr></thead><tbody>' +
        (list.map(o => '<tr><td class="tnum">' + CF.jam(o.dib) + '</td><td><b>' + esc(o.np) + '</b> <span class="faint small">' + esc(o.id) + '</span></td><td>' + esc(o.mn || '-') + '</td><td>' + esc(CF.LABEL_METODE[o.met] || '-') + '</td><td>' + (o.st === 'batal' ? CF.badgeSt('batal') : CF.badgeSb(o.sb)) + '</td><td class="num">' + rp(o.tot) + '</td><td class="acts"><button class="btn btn-ghost btn-sm" data-act="cetak" data-id="' + esc(o.id) + '">' + ic('printer', 'sm') + 'Cetak</button></td></tr>').join('') || '<tr><td colspan="7" class="center faint">Belum ada transaksi hari ini.</td></tr>') + '</tbody></table></div>' +
        (ST.me.role === 'kasir' ? '<p class="help">Laporan periode, grafik & ekspor hanya untuk Owner/Admin.</p>' : '');
      CFChart.hbar(el.querySelector('#ch-met'), Object.keys(per).map(k => ({ label: CF.LABEL_METODE[k] || k, v: per[k] })).sort((a, b) => b.v - a.v), { fmt: rp, title: 'Pembayaran per metode hari ini' });
    } });

  // ------------------------------------------------------------------
  // Halaman: Ketersediaan Menu (kasir, dapur, admin)
  // ------------------------------------------------------------------
  function ketersediaanHtml(big) {
    const B = ST.boot; if (!B) return '<div class="skel" style="height:300px"></div>';
    const q = (ST.kq || '').toLowerCase(), kat = ST.kkat || 'all';
    const list = B.menu.filter(m => (kat === 'all' || m.kat === kat) && (!q || m.nama.toLowerCase().indexOf(q) > -1));
    return '<div class="filters"><div class="search"><input class="input" id="kt-q" type="search" placeholder="Cari menu…" value="' + esc(ST.kq || '') + '" aria-label="Cari menu">' + ic('search') + '</div><div class="chips"><button class="chip' + (kat === 'all' ? ' on' : '') + '" data-act="ktKat" data-k="all">Semua</button>' + B.kat.map(k => '<button class="chip' + (kat === k.id ? ' on' : '') + '" data-act="ktKat" data-k="' + k.id + '">' + esc(k.nama) + '</button>').join('') + '</div></div>' +
      '<div class="table-wrap mt-12"><table class="tbl"><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Sisa stok</th><th>Ketersediaan</th></tr></thead><tbody>' + list.map(m => '<tr><td><div class="row"><div class="thumb" style="overflow:hidden' + (big ? ';width:52px;height:52px' : '') + '">' + CF.img(m.foto, m.nama) + '</div><b' + (big ? ' style="font-size:17px"' : '') + '>' + esc(m.nama) + '</b></div></td><td>' + esc((B.kat.filter(k => k.id === m.kat)[0] || {}).nama || '') + '</td><td class="num">' + (m.stok === null ? '∞' : m.stok) + '</td>' +
        '<td><label class="switch"><input type="checkbox" data-kt="' + m.id + '"' + (m.ada ? ' checked' : '') + '><span class="tr"></span><span class="semi ' + (m.ada ? 'green' : 'red') + '">' + (m.ada ? 'Tersedia' : 'Habis') + '</span></label></td></tr>').join('') + '</tbody></table></div><p class="help mt-8">Perubahan tampil ke pelanggan dalam beberapa detik.</p>';
  }
  function bindKetersediaan(el, rer) {
    const q = el.querySelector('#kt-q'); if (q) q.oninput = CF.debounce(() => { ST.kq = q.value; rer(); const n = document.getElementById('kt-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200);
    el.querySelectorAll('[data-kt]').forEach(c => c.onchange = async () => {
      c.disabled = true; const r = await CF.api('menu.ketersediaan', { id: c.dataset.kt, tersedia: c.checked });
      if (!r.ok) { c.checked = !c.checked; c.disabled = false; return CF.err(r); }
      CF.toast(r.msg, 'ok', 2500);
      const b = await CF.api('pub.boot'); if (b.ok) { ST.boot = b.data; CF.store.set('boot', b.data); } rer();
    });
  }
  CF.acts.ktKat = el => { ST.kkat = el.dataset.k; CF.rerenderKetersediaan(); };
  CF.rerenderKetersediaan = () => { const el = document.getElementById(ST.curPage === 'dapur' ? 'kds-body' : 'page'); if (!el) return; if (ST.curPage === 'dapur') { el.innerHTML = '<div style="padding:16px 20px">' + ketersediaanHtml(true) + '</div>'; bindKetersediaan(el, CF.rerenderKetersediaan); } else render(); };
  page('ketersediaan', { title: 'Ketersediaan Menu', icon: 'list', roles: ['admin', 'kasir'], sec: 'Operasional',
    render(el) { el.innerHTML = ketersediaanHtml(false); bindKetersediaan(el, () => render()); if (!ST._ktLoaded) { ST._ktLoaded = 1; CF.api('pub.boot').then(b => { if (b.ok) { ST.boot = b.data; if (ST.curPage === 'ketersediaan') render(); } }); } } });

  // ------------------------------------------------------------------
  // Halaman: Papan Dapur (Kitchen/Barista) — layar penuh, teks besar
  // ------------------------------------------------------------------
  let clockT = null;
  page('dapur', { title: 'Papan Dapur', icon: 'chef', roles: ['dapur', 'admin'], sec: 'Operasional', live: true, full: true,
    render(el) {
      const set = (ST.boot && ST.boot.set) || {};
      el.innerHTML = '<div class="kds"><div class="kds-top"><div class="brand"><div class="logo">' + CF.logoHtml(set) + '</div><div><div class="name" style="font-size:18px">' + esc(set.nama_aplikasi || 'CafeFlow') + '</div><div class="tag">' + esc(ST.me.nama === 'Kitchen & Bar' ? 'Papan Dapur' : 'Kitchen & Bar • ' + ST.me.nama) + '</div></div></div>' +
        '<div class="seg" style="margin-left:12px"><button class="' + (ST.kdsTab !== 'menu' ? 'on' : '') + '" data-act="kdsTab" data-t="board">' + ic('layers', 'sm') + 'Pesanan</button><button class="' + (ST.kdsTab === 'menu' ? 'on' : '') + '" data-act="kdsTab" data-t="menu">' + ic('list', 'sm') + 'Ketersediaan Menu</button></div>' +
        '<span class="grow"></span><span class="conn badge b-red">' + ic('wifiOff', 'sm') + 'Offline</span>' + (!CF.sound.unlocked && CF.sound.on ? '<button class="btn btn-tint btn-sm" data-act="unlockSound">' + ic('vol', 'sm') + 'Aktifkan suara</button>' : '') +
        '<button class="btn btn-ghost btn-icon" data-act="sound" aria-label="Suara">' + ic(CF.sound.on ? 'vol' : 'volX') + '</button><button class="btn btn-ghost btn-icon" data-act="fullscreen" aria-label="Layar penuh">' + ic('max') + '</button>' +
        '<span class="clock" id="kds-clock">' + CF.jam(Date.now()) + '</span>' + (ST.me.role === 'admin' ? '<button class="btn btn-secondary btn-sm" data-act="nav" data-k="dashboard">' + ic('arrowL', 'sm') + 'Dashboard</button>' : '<button class="btn btn-ghost btn-icon" data-act="logout" aria-label="Keluar">' + ic('logout') + '</button>') + '</div><div id="kds-body"></div></div>';
      this.update(el);
      clearInterval(clockT); clockT = setInterval(() => { const c = document.getElementById('kds-clock'); if (!c) return clearInterval(clockT); c.textContent = CF.jam(Date.now()); document.querySelectorAll('[data-since]').forEach(t => { const ms = Date.now() - Number(t.dataset.since); t.textContent = CF.durasi(ms); const card = t.closest('.kcard'), late = ms > ((ST.live && ST.live.cfg && ST.live.cfg.ambang) || 15) * 60000; if (card && card.dataset.late !== String(late)) { card.dataset.late = late; card.classList.toggle('late', late); } }); }, 1000);
    },
    update(el) {
      const body = document.getElementById('kds-body'); if (!body) return this.render(el);
      if (ST.kdsTab === 'menu') { if (!body.dataset.menu) { body.dataset.menu = 1; CF.rerenderKetersediaan(); } return; }
      delete body.dataset.menu;
      const L = ST.live; if (!L) { body.innerHTML = '<div class="kanban">' + '<div class="kcol"><div class="skel" style="height:200px"></div></div>'.repeat(3) + '</div>'; return; }
      const amb = ((L.cfg && L.cfg.ambang) || 15) * 60000, list = (L.orders || []).filter(o => ['baru', 'diproses', 'siap'].indexOf(o.st) > -1).sort((a, b) => a.dib - b.dib);
      const since = o => { const r = (o.riw || []).filter(x => x.s === o.st).slice(-1)[0]; return o.st === 'baru' ? o.dib : (r ? r.at : o.upd); };
      const col = (st, label, icn, color, btn) => { const os = list.filter(o => o.st === st); return '<section class="kcol" aria-label="' + label + '"><div class="kcol-h" style="color:' + color + '">' + ic(icn) + label + '<span class="n">' + os.length + '</span></div>' +
        (os.map(o => { const late = st !== 'siap' && Date.now() - o.dib > amb, fresh = ST.fresh && ST.fresh[o.id] && Date.now() - ST.fresh[o.id] < 60000;
          return '<article class="kcard' + (late ? ' late' : fresh ? ' fresh' : '') + '" data-late="' + late + '"><div class="row between"><span class="kno">' + esc(o.np) + '</span><span class="mtag" style="font-size:16px;padding:6px 12px">' + esc(o.mj ? 'Meja ' + o.mn : o.mn) + '</span></div>' +
            '<div class="row between"><span class="timer ' + (late ? 'red' : 'muted') + '">' + ic('timer', 'sm') + '<span data-since="' + (st === 'siap' ? since(o) : o.dib) + '">' + CF.durasi(Date.now() - (st === 'siap' ? since(o) : o.dib)) + '</span></span>' + (late ? '<span class="badge b-red">' + ic('alert', 'sm') + 'Terlambat</span>' : '') + (o.sb !== 'lunas' ? '<span class="badge b-amber">Belum dibayar</span>' : '') + '</div>' +
            '<div class="kitems">' + o.items.map(i => '<div class="ki"><span class="q">' + i.q + '</span><div>' + esc(i.n) + (i.o ? '<span class="o">' + esc(i.o) + '</span>' : '') + '</div></div>' + (i.c ? '<div class="note">' + ic('note', 'sm') + esc(i.c) + '</div>' : '')).join('') + '</div>' +
            (o.cat ? '<div class="note">' + ic('note', 'sm') + esc(o.cat) + '</div>' : '') + btn(o) + '</article>'; }).join('') || '<div class="empty small" style="padding:30px 10px">Kosong</div>') + '</section>'; };
      body.innerHTML = '<div class="kanban">' +
        col('baru', 'Menunggu', 'clock', '#1E40AF', o => '<button class="btn btn-primary btn-block" data-act="setSt" data-id="' + esc(o.id) + '" data-st="diproses">' + ic('chef') + 'Mulai Proses</button>') +
        col('diproses', 'Diproses', 'chef', '#9A3412', o => '<button class="btn btn-success btn-block" data-act="setSt" data-id="' + esc(o.id) + '" data-st="siap">' + ic('check') + 'Tandai Siap</button>') +
        col('siap', 'Siap Disajikan', 'concierge', '#15803D', o => '<div class="row" style="gap:8px"><button class="btn btn-tint grow" data-act="panggil" data-id="' + esc(o.id) + '">' + ic('megaphone') + 'Panggil</button><button class="btn btn-secondary grow" data-act="setSt" data-id="' + esc(o.id) + '" data-st="selesai">' + ic('check') + 'Disajikan</button></div>') + '</div>';
      if (ST.fresh && Object.keys(ST.fresh).some(id => Date.now() - ST.fresh[id] < 4000)) {
        const o = (L.orders || []).filter(x => ST.fresh[x.id] && Date.now() - ST.fresh[x.id] < 4000)[0];
        if (o && !document.querySelector('.kds-new')) { const b = document.createElement('div'); b.className = 'kds-new'; b.innerHTML = ic('bell') + 'PESANAN BARU — ' + esc(o.mj ? 'Meja ' + o.mn : o.mn); document.body.appendChild(b); setTimeout(() => b.remove(), 5000); }
      }
    } });
  CF.acts.kdsTab = el => { ST.kdsTab = el.dataset.t; render(); };
  CF.acts.unlockSound = el => { CF.sound.unlock(); CF.sound.beep(); el.remove(); };
  CF.acts.fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };

  // ------------------------------------------------------------------
  // Halaman: Akun saya (ganti sandi)
  // ------------------------------------------------------------------
  page('akun', { title: 'Akun Saya', icon: 'user', roles: ['admin', 'kasir', 'dapur'], hidden: true,
    render(el) {
      el.innerHTML = '<div class="dash-grid"><div class="card pad"><div class="row"><span class="avatar" style="width:52px;height:52px;font-size:18px">' + esc(CF.inisial(ST.me.nama)) + '</span><div><h3>' + esc(ST.me.nama) + '</h3><div class="small faint">@' + esc(ST.me.username) + ' • ' + esc(ROLE_LABEL[ST.me.role]) + '</div></div></div>' +
        '<div class="divider"></div><label class="switch"><input type="checkbox" id="ak-print"' + (CF.store.get('autoPrint', false) ? ' checked' : '') + '><span class="tr"></span>Cetak struk otomatis setelah pembayaran</label>' +
        '<button class="btn btn-danger-o mt-16" data-act="logout">' + ic('logout', 'sm') + 'Keluar</button></div><div class="card pad"><h3>Ganti Kata Sandi</h3><div class="mt-12">' + formGanti('ak-form') + '</div></div></div>';
      el.querySelector('#ak-print').onchange = e => CF.store.set('autoPrint', e.target.checked);
      bindGanti('ak-form', () => { el.querySelector('#ak-form').reset(); });
    } });

  // ------------------------------------------------------------------
  // Mulai
  // ------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    if (ST.boot) CF.applyTheme(ST.boot.set);
    if (!ST.me || !CF.token()) return viewLogin();
    if (ST.me.wajibGanti) return viewGanti(true);
    boot();
    const r = await CF.api('auth.me', {});
    if (r.ok) { ST.me = r.data.me; CF.store.set('me', ST.me); }
  });
})();
