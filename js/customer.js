/* =====================================================================
   CafeFlow — Halaman Pelanggan
   ?m=<kode QR meja>  → pesan & bayar (jika sesi meja aktif), tab Price List
   tanpa parameter    → Price List (hanya lihat, untuk promosi cafe & steam)
   ?o=<id>&k=<kunci>  → buka status/struk pesanan (kembali dari e-wallet)
   ===================================================================== */
(function () {
  'use strict';
  const root = document.getElementById('app'), esc = CF.esc, rp = CF.rp, ic = CF.ic;
  const P = new URLSearchParams(location.search);
  if (!CF.configOk) { CF.configScreen(root); return; }
  const mq = matchMedia('(max-width: 900px)');
  const S = {
    boot: CF.store.get('boot', null), kode: (P.get('m') || '').trim(), meja: null, kat: 'all', q: '', plGrup: 'all',
    cart: [], promo: null, orders: [], ver: '', trx: {}, pinErr: '', pinBusy: false,
    my: CF.store.get('myorders', []).filter(o => Date.now() - o.at < 3 * 86400e3),
    info: Object.assign({ nama: '', kontak: '', email: '', tamu: 2 }, CF.store.get('cinfo', {})),
    loading: true, lastSt: {}, paidFlash: null, searchOpen: false
  };
  if (S.kode) S.cart = CF.store.get('cart_' + S.kode, []);
  const tok = () => S.meja && S.meja.t;
  const canOrder = () => !!(S.meja && S.meja.aktif && S.meja.t);
  const menuById = id => (S.boot && S.boot.menu || []).filter(m => m.id === id)[0];
  const saveCart = () => { CF.store.set('cart_' + S.kode, S.cart); };
  const saveMy = () => CF.store.set('myorders', S.my.slice(-20));
  const set = () => (S.boot && S.boot.set) || {};
  const mejaNo = () => S.meja ? S.meja.no : '';

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  async function loadBoot() {
    const r = await CF.api('pub.boot');
    if (r.ok) {
      S.boot = r.data; CF.store.set('boot', r.data); CF.applyTheme(r.data.set); document.title = (r.data.set.nama_aplikasi || 'CafeFlow') + (S.kode ? ' — Menu' : ' — Price List');
      // Menu yang sudah dihapus admin dibuang dari keranjang
      if (S.cart.length) { const n = S.cart.length; S.cart = S.cart.filter(l => menuById(l.m)); if (S.cart.length !== n) { saveCart(); CF.toast('Beberapa menu di keranjang sudah tidak tersedia dan dihapus.', 'info'); } }
    }
    else if (!S.boot) CF.err(r, 'Menu gagal dimuat.');
    S.loading = false;
  }
  async function masuk(pin) {
    const r = await CF.api('meja.masuk', { kode: S.kode, dev: CF.devId, pin: pin || '' });
    if (!r.ok) {
      if (pin) { S.pinErr = r.error.pesan; return false; }
      S.meja = { aktif: false, err: r.error.pesan, no: '' };
      return false;
    }
    const d = r.data;
    S.meja = { id: d.meja.id, no: d.meja.no, aktif: !!d.aktif, t: d.t || '', perluPin: !!d.perluPin };
    if (d.tamu) S.info.tamu = d.tamu;
    if (d.t) CF.ss.set('mt_' + S.kode, { t: d.t, no: d.meja.no, id: d.meja.id, at: Date.now() });
    return true;
  }
  async function refreshStatus(force) {
    if (tok()) {
      const r = await CF.api('meja.status', { t: tok(), since: force ? '' : S.ver });
      if (!r.ok) { if (r.error.kode === 'MEJA') { S.meja.t = ''; S.meja.aktif = false; } return; }
      if (r.data.same) return;
      S.ver = r.data.v;
      const wasActive = S.meja.aktif;
      S.meja.aktif = r.data.aktif;
      mergeOrders(r.data.orders);
      if (wasActive && !r.data.aktif) CF.toast('Sesi meja ' + mejaNo() + ' telah ditutup kasir. Terima kasih!', 'info');
    } else if (S.my.length) {
      const res = await Promise.all(S.my.slice(-5).map(o => CF.api('pesanan.lihat', { id: o.id, k: o.k })));
      mergeOrders(res.filter(r => r.ok).map(r => r.data));
    }
    rerender();
  }
  function mergeOrders(list) {
    list.forEach(o => {
      const prev = S.lastSt[o.id];
      if (prev && prev.st !== 'siap' && o.st === 'siap') { CF.toast('Pesanan ' + o.np + ' sudah siap disajikan!', 'ok', 8000); CF.vibrate(); CF.sound.beep('ready'); }
      if (prev && prev.sb !== 'lunas' && o.sb === 'lunas') { S.paidFlash = o.id; CF.sound.beep(); }
      if (o.dipanggil && prev && !prev.dipanggil) { CF.toast('Nomor ' + o.np + ' dipanggil — pesanan Anda siap!', 'ok', 8000); CF.vibrate([200, 100, 200, 100, 200]); }
      S.lastSt[o.id] = { st: o.st, sb: o.sb, dipanggil: o.dipanggil };
      if (!S.my.some(x => x.id === o.id)) { S.my.push({ id: o.id, k: o.k, at: o.dib || Date.now() }); saveMy(); }
    });
    const map = {}; S.orders.forEach(o => { map[o.id] = o; }); list.forEach(o => { map[o.id] = o; });
    S.orders = Object.keys(map).map(k => map[k]).sort((a, b) => b.dib - a.dib);
  }
  const orderById = id => S.orders.filter(o => o.id === id)[0];
  async function ensureOrder(id) {
    let o = orderById(id); if (o) return o;
    const m = S.my.filter(x => x.id === id)[0]; if (!m) return null;
    const r = await CF.api('pesanan.lihat', { id: id, k: m.k });
    if (r.ok) { mergeOrders([r.data]); return r.data; }
    return null;
  }

  // ------------------------------------------------------------------
  // Keranjang & hitung (pratinjau; server selalu menghitung ulang)
  // ------------------------------------------------------------------
  function unitOf(line) {
    const m = menuById(line.m); if (!m) return 0;
    let u = m.harga; (m.opsi || []).forEach(g => g.pilihan.forEach(p => { if (line.o.indexOf(p.id) > -1) u += p.harga; }));
    return u;
  }
  function opsiText(line) {
    const m = menuById(line.m), t = []; if (!m) return '';
    (m.opsi || []).forEach(g => g.pilihan.forEach(p => { if (line.o.indexOf(p.id) > -1) t.push(p.nama); }));
    return t.join(', ');
  }
  const qtyOf = id => S.cart.filter(l => l.m === id).reduce((a, l) => a + l.q, 0);
  const itemCount = () => S.cart.reduce((a, l) => a + l.q, 0);
  function calc() {
    const st = set(), sub = S.cart.reduce((a, l) => a + unitOf(l) * l.q, 0);
    const dp = S.promo ? Math.min(S.promo.dp || 0, sub) : 0, base = Math.max(0, sub - dp);
    const p = Number(st.pajak_persen || 0) / 100, l = Number(st.layanan_persen || 0) / 100, lyn = Math.round(base * l);
    let pjk, tot;
    if (st.harga_termasuk_pajak === 'Y') { tot = base + lyn; pjk = Math.round(tot - tot / (1 + p)); } else { pjk = Math.round((base + lyn) * p); tot = base + lyn + pjk; }
    return { sub, dp, pjk, lyn, tot };
  }
  function addLine(mid, opsi, note, q) {
    const key = mid + '|' + opsi.slice().sort().join(',') + '|' + (note || '');
    const ex = S.cart.filter(l => l.key === key)[0], m = menuById(mid);
    const cur = qtyOf(mid);
    if (m && m.stok !== null && cur + (q || 1) > m.stok) { CF.toast('Stok "' + m.nama + '" tinggal ' + m.stok + ' porsi.', 'warn'); return false; }
    if (ex) ex.q += q || 1; else S.cart.push({ key: key, m: mid, o: opsi.slice(), c: note || '', q: q || 1 });
    saveCart(); promoRecheck(); return true;
  }
  const promoRecheck = CF.debounce(async () => {
    if (!S.promo) return updateOrderUI();
    if (!S.cart.length) { S.promo = null; return updateOrderUI(); }
    const r = await CF.api('promo.cek', { items: itemsPayload(), kode: S.promo.kode });
    if (r.ok && r.data.promo) S.promo = { kode: r.data.promo.kode, nama: r.data.promo.nama, dp: r.data.dp };
    else { CF.toast((r.error && r.error.pesan) || 'Promo tidak berlaku lagi.', 'warn'); S.promo = null; }
    updateOrderUI();
  }, 600);
  const itemsPayload = () => S.cart.map(l => ({ m: l.m, q: l.q, o: l.o, c: l.c }));

  // ------------------------------------------------------------------
  // Render: kerangka
  // ------------------------------------------------------------------
  const route = () => { const h = location.hash.replace(/^#\/?/, '').split('/'); return { v: h[0] || (S.kode ? 'menu' : 'pricelist'), id: decodeURIComponent(h[1] || '') }; };
  const go = h => { if (location.hash === '#' + h) rerender(); else location.hash = h; };
  function rerender() {
    const r = route();
    const y = scrollY, focusId = document.activeElement && document.activeElement.id, selS = document.activeElement && document.activeElement.selectionStart;
    if (r.v === 'menu' && !S.kode) return go('pricelist');
    if (S.meja && S.meja.perluPin && !S.meja.t && r.v === 'menu') root.innerHTML = viewPin();
    else if (r.v === 'bayar') root.innerHTML = viewBayar(r.id);
    else if (r.v === 'instruksi') root.innerHTML = viewInstruksi(r.id);
    else if (r.v === 'status') root.innerHTML = viewStatus();
    else if (r.v === 'struk') root.innerHTML = viewStruk(r.id);
    else if (r.v === 'pricelist') root.innerHTML = shell(viewPriceList(), 'pricelist');
    else root.innerHTML = shell(viewMenu(), 'menu');
    if (r.v === S._lastV) scrollTo(0, y); else scrollTo(0, 0);
    S._lastV = r.v;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { if (selS !== null && el.setSelectionRange) el.setSelectionRange(selS, selS); } catch (e) { } } }
    afterRender(r);
  }
  function brand(mob) {
    const st = set();
    return '<div class="brand"><div class="logo">' + CF.logoHtml(st) + '</div><div class="grow" style="min-width:0"><div class="name ellipsis">' + esc((st.nama_aplikasi || 'CafeFlow') + (mob && S.kode ? ' Menu' : '')) + '</div>' + (mob ? '' : '<div class="tag ellipsis">' + esc(st.tagline || '') + '</div>') + '</div></div>';
  }
  function mejaPill(mob) {
    if (!S.kode || !S.meja) return '';
    if (!S.meja.no) return '<span class="pill-meja off">' + ic('alert', 'sm') + ' QR tidak dikenal</span>';
    if (mob) return '<span class="pill-meja' + (canOrder() ? '' : ' off') + '">' + ic('qr', 'sm') + ' Meja ' + esc(mejaNo()) + '</span>';
    return '<span class="pill-meja' + (canOrder() ? '' : ' off') + '"><span class="dot"></span>Meja ' + esc(mejaNo()) + '<span class="sep"></span>' + (canOrder() ? 'Terkunci via QR' : 'Belum aktif') + '</span>';
  }
  const aktifCount = () => S.orders.filter(o => o.st !== 'batal' && (o.st !== 'selesai' || o.sb !== 'lunas')).length;
  function shell(inner, tab) {
    const searchOn = tab === 'menu';
    const tabs = S.kode ? '<div class="cx-tabs"><div class="seg" role="tablist">' +
      '<button role="tab" class="' + (tab === 'menu' ? 'on' : '') + '" data-act="go" data-h="menu">' + ic('utensils', 'sm') + 'Pesan Menu</button>' +
      '<button role="tab" class="' + (tab === 'pricelist' ? 'on' : '') + '" data-act="go" data-h="pricelist">' + ic('tag', 'sm') + 'Price List</button>' +
      (S.orders.length ? '<button role="tab" class="tab-status" data-act="go" data-h="status">' + ic('receipt', 'sm') + 'Pesanan Saya' + (aktifCount() ? ' <span class="badge b-orange">' + aktifCount() + '</span>' : '') + '</button>' : '') +
      '</div></div>' : (S.my.length ? '<div class="cx-tabs"><div class="seg"><button class="on">' + ic('tag', 'sm') + 'Price List</button><button data-act="go" data-h="status">' + ic('receipt', 'sm') + 'Pesanan Saya</button></div></div>' : '');
    return '<header class="mob-head">' + brand(true) + '<span class="grow"></span>' + mejaPill(true) +
      (searchOn ? '<button class="btn btn-ghost btn-icon" data-act="toggleSearch" aria-label="Cari menu">' + ic('search') + '</button>' : '') +
      (S.orders.length ? '<button class="av" data-act="go" data-h="status" aria-label="Pesanan saya">' + ic('user') + (aktifCount() ? '<span class="cnt">' + aktifCount() + '</span>' : '') + '</button>' : '') + '</header>' +
      (searchOn && (S.searchOpen || S.q) ? '<div class="mob-search mob-only"><div class="search">' + ic('search') + '<input class="input" id="q-m" type="search" placeholder="Cari makanan atau minuman…" value="' + esc(S.q) + '" aria-label="Cari menu"></div></div>' : '') +
      '<div class="cx"><header class="cx-head">' + brand(false) + (searchOn ? '<div class="search">' + ic('search') + '<input class="input" id="q-d" type="search" placeholder="Cari makanan atau minuman…" value="' + esc(S.q) + '" aria-label="Cari menu"></div>' : '<span class="grow"></span>') + mejaPill(false) + '</header>' +
      tabs + '<main class="cx-main">' + inner + '</main></div>';
  }

  // ------------------------------------------------------------------
  // View: Menu (katalog + panel pesanan)
  // ------------------------------------------------------------------
  function viewMenu() {
    if (!S.boot) return skeletonMenu();
    const mob = mq.matches;
    return statusBanner() + '<div class="cx-grid"><section>' + promoSection() + '<div id="grid-wrap">' + gridSection() + '</div></section>' + (mob ? '' : '<aside class="panel" id="panel">' + panelHtml() + '</aside>') + '</div>' +
      (mob ? '<div class="bottom-bar" id="bbar">' + barHtml() + '</div>' : '');
  }
  function statusBanner() {
    if (!S.kode || !S.meja) return '';
    if (S.meja.err) return '<div class="banner danger mt-16">' + ic('alert') + '<div><b>QR meja tidak dikenali.</b> ' + esc(S.meja.err) + ' Anda tetap bisa melihat menu.</div></div>';
    if (!S.meja.aktif) return '<div class="banner warn mt-16">' + ic('lock') + '<div class="grow"><b>Meja ' + esc(mejaNo()) + ' belum aktif.</b> Silakan minta kasir mengaktifkan meja Anda untuk mulai memesan. Menu tetap bisa dilihat.</div><button class="btn btn-sm btn-secondary" data-act="cekMeja">' + ic('refresh', 'sm') + 'Cek lagi</button></div>';
    return '';
  }
  function promoEnd() {
    const t = String(set().promo_harian_selesai || ''); if (!/^\d{1,2}:\d{2}$/.test(t)) return 0;
    const end = Date.parse(CF.isoHari() + 'T' + t.padStart(5, '0') + ':00+07:00');
    return end > Date.now() ? end : 0;
  }
  function promoSection() {
    const list = S.boot.menu.filter(m => m.coret > m.harga);
    if (!list.length) return '';
    const end = promoEnd(), maxDisc = Math.max.apply(null, list.map(m => Math.round((1 - m.harga / m.coret) * 100)));
    return '<div class="sec-head"><h2>Promo Hari Ini <span class="badge b-red">HEMAT ' + maxDisc + '%</span></h2>' +
      (end ? '<span class="cnt-down">' + ic('clock') + 'Berakhir dalam <b id="cnt">' + cd(end) + '</b></span>' : '') + '</div>' +
      '<div class="promo-row">' + list.map(m => card(m, true)).join('') + '</div>';
  }
  const cd = end => { const s = Math.max(0, Math.floor((end - Date.now()) / 1000)); const p = n => String(n).padStart(2, '0'); return p(Math.floor(s / 3600)) + ' : ' + p(Math.floor(s % 3600 / 60)) + ' : ' + p(s % 60); };
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return S.boot.menu.filter(m => (S.kat === 'all' || m.kat === S.kat) && (!q || (m.nama + ' ' + m.desk).toLowerCase().indexOf(q) > -1));
  }
  function gridSection() {
    const list = filtered(), kat = S.boot.kat.filter(k => S.boot.menu.some(m => m.kat === k.id));
    return '<div class="sec-head"><h2>Jelajahi Menu Terbaik</h2>' + (S.kat !== 'all' || S.q ? '<button class="btn btn-ghost btn-sm orange" data-act="lihatSemua">Lihat Semua</button>' : '<span class="faint small">' + list.length + ' menu</span>') + '</div>' +
      '<div class="chips-sticky"><div class="row" style="gap:8px"><div class="chips grow" role="tablist" aria-label="Kategori">' +
      '<button class="chip' + (S.kat === 'all' ? ' on' : '') + '" data-act="kat" data-k="all">Semua</button>' +
      kat.map(k => '<button class="chip' + (S.kat === k.id ? ' on' : '') + '" data-act="kat" data-k="' + esc(k.id) + '">' + esc(k.nama) + '</button>').join('') + '</div>' +
      '<button class="chip desk-only" data-act="filterSheet">' + ic('filter', 'sm') + 'Filter</button></div></div>' +
      (list.length ? '<div class="prod-grid" id="grid">' + list.map(m => card(m, false)).join('') + '</div>' :
        '<div class="empty"><div class="art">' + ic('search') + '</div><h4>Menu tidak ditemukan</h4><p>Coba kata kunci lain atau pilih kategori Semua.</p><button class="btn btn-secondary" data-act="lihatSemua">Lihat semua menu</button></div>');
  }
  function card(m, promo) {
    const habis = !m.ada, disc = m.coret > m.harga ? Math.round((1 - m.harga / m.coret) * 100) : 0, q = qtyOf(m.id);
    let ctrl;
    if (habis) ctrl = '<button class="btn btn-sm btn-soft habis" disabled>Habis</button>';
    else if (!canOrder()) ctrl = '';
    else if (q > 0) ctrl = '<div class="stepper" role="group" aria-label="Jumlah ' + esc(m.nama) + '"><button data-act="dec" data-id="' + m.id + '" aria-label="Kurangi">' + ic('minus', 'sm') + '</button><span class="v">' + q + '</span><button class="plus" data-act="inc" data-id="' + m.id + '" aria-label="Tambah">' + ic('plus', 'sm') + '</button></div>';
    else ctrl = '<button class="btn btn-sm ' + (promo ? 'btn-dark' : 'btn-secondary') + '" data-act="add" data-id="' + m.id + '">Pesan</button>';
    const media = '<div class="media" data-act="detail" data-id="' + m.id + '" role="button" tabindex="0" aria-label="Detail ' + esc(m.nama) + '">' + CF.img(m.foto, m.nama) +
      (habis ? '<span class="cc"><span class="badge b-dark" style="font-size:13px;padding:6px 14px">HABIS</span></span>' : m.stok !== null ? '<span class="tl badge b-dark">Tersedia: ' + m.stok + '</span>' : '') +
      (disc ? '<span class="tr badge b-solid-red">-' + disc + '%</span>' : m.unggul && !habis ? '<span class="tr badge b-white">' + ic('star', 'sm') + 'Favorit</span>' : '') + '</div>';
    const info = '<div class="nm clamp2" data-act="detail" data-id="' + m.id + '">' + esc(m.nama) + '</div>' +
      '<div class="sub">' + (disc ? '<span class="disc">' + disc + '%</span><span class="strike">' + rp(m.coret) + '</span>' : habis ? 'Stok dapur habis' : (m.opsi.length ? 'Ada pilihan opsi' : 'Harga per porsi')) + '</div>' +
      '<div class="foot"><span class="price' + (habis ? ' muted' : '') + '"' + (habis ? ' style="color:var(--faint);text-decoration:line-through"' : '') + '>' + rp(m.harga) + '</span>' + ctrl + '</div>';
    return '<article class="prod' + (habis ? ' habis' : '') + '" data-id="' + m.id + '">' + media + (promo ? '<div class="body">' + info + '</div>' : info) + '</article>';
  }
  function skeletonMenu() {
    let s = '<div class="sec-head"><div class="skel" style="width:220px;height:28px"></div></div><div class="prod-grid">';
    for (let i = 0; i < 8; i++) s += '<div class="prod"><div class="skel" style="aspect-ratio:1"></div><div class="skel mt-12" style="height:16px;width:70%"></div><div class="skel mt-8" style="height:14px;width:40%"></div><div class="skel mt-12" style="height:36px"></div></div>';
    return s + '</div>';
  }
  // Panel pesanan (desktop) & isi sheet keranjang (mobile)
  function panelHtml() {
    const c = calc(), n = itemCount(), ok = canOrder(), nm = S.cart.length;
    const custBox = '<div class="card-title" style="margin-bottom:10px"><h3>Informasi Pelanggan</h3><span class="faint" title="Data opsional, hanya untuk memanggil & mengirim struk">' + ic('info') + '</span></div>' +
      '<div class="info-box"><div class="field"><label class="label-up" for="c-nama">Nama pelanggan</label><input class="input" id="c-nama" maxlength="60" placeholder="Nama Anda (opsional)" value="' + esc(S.info.nama) + '" autocomplete="name"></div>' +
      '<div class="lock-row">' + ic('lock', 'sm') + 'Meja ' + esc(mejaNo() || '-') + ' <span class="faint">' + (ok ? '(QR Aktif)' : '(belum aktif)') + '</span><span class="grow"></span>' +
      '<div class="stepper" aria-label="Jumlah tamu"><button data-act="tamu" data-d="-1" aria-label="Kurangi tamu">' + ic('minus', 'sm') + '</button><span class="v" style="min-width:58px">' + S.info.tamu + ' Tamu</span><button class="plus" data-act="tamu" data-d="1" aria-label="Tambah tamu">' + ic('plus', 'sm') + '</button></div></div>' +
      '<details' + (S.info.email || S.info.kontak ? ' open' : '') + '><summary class="small orange" style="cursor:pointer;font-weight:600">Kirim struk ke email / WhatsApp (opsional)</summary>' +
      '<div class="col mt-8"><input class="input" id="c-email" type="email" placeholder="email@contoh.com" value="' + esc(S.info.email) + '" autocomplete="email"><input class="input" id="c-kontak" type="tel" placeholder="No. WhatsApp (opsional)" value="' + esc(S.info.kontak) + '" autocomplete="tel">' +
      '<p class="help">Data hanya dipakai untuk mengirim struk & dihapus dari tampilan staf. Tidak wajib.</p></div></details></div>' +
      '<p class="help mt-8">Informasi ini otomatis terhubung ke pencatatan kasir & kitchen display.</p>';
    const lines = nm ? '<div class="lines">' + S.cart.map((l, i) => {
      const m = menuById(l.m) || { nama: '(menu dihapus)', foto: '' }, u = unitOf(l), op = opsiText(l);
      return '<div class="line"><div class="thumb" style="overflow:hidden">' + CF.img(m.foto, m.nama) + '</div><div class="grow"><div class="nm ellipsis">' + esc(m.nama) + '</div>' +
        (op ? '<div class="op ellipsis">' + esc(op) + '</div>' : '') + (l.c ? '<div class="note ellipsis">' + ic('note', 'sm') + ' ' + esc(l.c) + '</div>' : '') +
        '<div><span class="price small">' + rp(u) + '</span> <span class="faint xs">x' + l.q + '</span></div></div>' +
        '<div class="col" style="align-items:flex-end;gap:6px"><div class="stepper"><button data-act="lineDec" data-i="' + i + '" aria-label="Kurangi">' + ic('minus', 'sm') + '</button><span class="v">' + l.q + '</span><button class="plus" data-act="lineInc" data-i="' + i + '" aria-label="Tambah">' + ic('plus', 'sm') + '</button></div>' +
        '<button class="btn btn-ghost btn-sm" data-act="lineDel" data-i="' + i + '" aria-label="Hapus ' + esc(m.nama) + '" style="min-height:30px;padding:0 6px">' + ic('trash', 'sm') + '</button></div></div>';
    }).join('') + '</div>' : '<div class="empty" style="padding:22px 10px"><div class="art">' + ic('bag') + '</div><h4>Keranjang masih kosong</h4><p class="small">Pilih menu favorit Anda di sebelah kiri.</p></div>';
    const st = set();
    const promo = '<div class="input-group mt-12"><input class="input" id="c-promo" placeholder="Kode promo" value="' + esc(S.promo ? S.promo.kode : '') + '" style="text-transform:uppercase"' + (S.promo ? ' readonly' : '') + ' aria-label="Kode promo">' +
      (S.promo ? '<button class="btn btn-secondary" data-act="promoHapus">Hapus</button>' : '<button class="btn btn-dark" data-act="promo"' + (nm ? '' : ' disabled') + '>Pakai</button>') + '</div>';
    const sum = '<div class="mt-12"><div class="sum-row"><span>Subtotal</span><b>' + rp(c.sub) + '</b></div>' +
      (c.dp ? '<div class="sum-row dsc"><span>Diskon Promo (' + esc(S.promo.kode) + ')</span><b>-' + rp(c.dp) + '</b></div>' : '') +
      (c.lyn ? '<div class="sum-row"><span>Biaya Layanan (' + st.layanan_persen + '%)</span><b>' + rp(c.lyn) + '</b></div>' : '') +
      (Number(st.pajak_persen) ? '<div class="sum-row"><span>Pajak ' + esc(st.label_pajak || '') + ' (' + st.pajak_persen + '%)' + (st.harga_termasuk_pajak === 'Y' ? ' termasuk' : '') + '</span><b>' + rp(c.pjk) + '</b></div>' : '') + '</div>' +
      '<div class="divider dash"></div><div class="total-row"><div><div class="semi">Total Tagihan</div>' + (c.pjk || c.lyn ? '<div class="help">Termasuk ' + [c.pjk ? 'pajak' : '', c.lyn ? 'biaya layanan' : ''].filter(Boolean).join(' & ') + '</div>' : '') + '</div><div class="big">' + rp(c.tot) + '</div></div>';
    const btn = ok ? '<button class="btn btn-primary btn-lg btn-block mt-16" data-act="pesan" data-loading="Mengirim pesanan…"' + (nm ? '' : ' disabled') + '>Pesan Sekarang' + (n ? ' (' + n + ' item)' : '') + ' ' + ic('arrowR') + '</button>' +
      '<p class="help center mt-8">Pesanan langsung diteruskan ke kasir & dapur meja ' + esc(mejaNo()) + '.</p>'
      : '<div class="banner warn mt-16">' + ic('lock') + '<div>Meja belum aktif — minta kasir membuka meja untuk memesan.</div></div>';
    return custBox + '<div class="divider"></div><div class="card-title" style="margin-bottom:10px"><h3>Pesanan Saat Ini</h3>' + (nm ? '<span class="badge b-orange">' + nm + ' Menu Dipilih</span>' : '') + '</div>' + lines +
      (nm ? '<div class="field mt-12"><label class="label" for="c-cat">Catatan untuk pesanan (opsional)</label><input class="input" id="c-cat" maxlength="200" placeholder="mis. antar bersamaan" value="' + esc(S.info.catatan || '') + '"></div>' : '') +
      '<div class="divider"></div>' + promo + sum + btn;
  }
  function barHtml() {
    const n = itemCount(), c = calc();
    if (!canOrder()) return '<div class="banner warn grow" style="padding:10px 12px">' + ic('lock') + '<div class="small">' + (S.kode ? 'Meja belum aktif — menu hanya bisa dilihat.' : '') + '</div></div>' + (S.orders.length ? '<button class="btn btn-secondary" data-act="go" data-h="status">Pesanan Saya</button>' : '');
    return '<button class="bag" data-act="cartSheet" aria-label="Lihat keranjang">' + ic('bag', 'lg') + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>' +
      '<button class="grow" style="text-align:left" data-act="cartSheet"><div class="small muted">Lihat Pesanan (' + n + ' item)</div><div class="tot">' + rp(c.tot) + '</div></button>' +
      '<button class="btn btn-primary btn-lg" data-act="cartSheet"' + (n ? '' : ' disabled') + '>Pesan</button>';
  }
  // Pembaruan parsial agar input & scroll tidak hilang
  function updateOrderUI() {
    const grid = document.getElementById('grid'), panel = document.getElementById('panel'), bar = document.getElementById('bbar'), sheet = document.getElementById('cart-sheet');
    if (grid) grid.innerHTML = filtered().map(m => card(m, false)).join('');
    document.querySelectorAll('.promo-row').forEach(pr => { pr.innerHTML = S.boot.menu.filter(m => m.coret > m.harga).map(m => card(m, true)).join(''); });
    if (panel) panel.innerHTML = panelHtml();
    if (bar) bar.innerHTML = barHtml();
    if (sheet) sheet.innerHTML = panelHtml();
    bindInputs();
  }

  // ------------------------------------------------------------------
  // View: Price List (hanya lihat — tanpa tombol pesan/bayar)
  // ------------------------------------------------------------------
  function viewPriceList() {
    if (!S.boot) return '<div class="skel mt-16" style="height:150px;border-radius:24px"></div><div class="pl-list mt-24">' + '<div class="skel" style="height:92px"></div>'.repeat(6) + '</div>';
    const st = set(), q = S.q.trim().toLowerCase(), groups = [], gmap = {};
    S.boot.pl.forEach(p => { if (!gmap[p.grup]) { gmap[p.grup] = []; groups.push(p.grup); } gmap[p.grup].push(p); });
    const showMenu = st.pricelist_tampil_menu !== 'N';
    const chips = ['all'].concat(groups).concat(showMenu ? ['__menu'] : []);
    const gIcon = g => /mobil|car/i.test(g) ? 'car' : /motor|bike/i.test(g) ? 'bike' : /cuci|steam|wash|poles|wax|semir|perawatan/i.test(g) ? 'drops' : 'sparkles';
    const match = (a) => !q || (a.nama + ' ' + (a.desk || '')).toLowerCase().indexOf(q) > -1;
    const item = (p, isMenu) => '<div class="pl-item"><div class="thumb" style="overflow:hidden">' + CF.img(p.foto, p.nama, !isMenu) + '</div><div class="grow"><div class="nm">' + esc(p.nama) +
      (p.unggul ? ' <span class="badge b-orange">' + ic('star', 'sm') + 'Favorit</span>' : '') + (isMenu && !p.ada ? ' <span class="badge b-neutral">Habis</span>' : '') + '</div>' +
      (p.desk ? '<div class="ds clamp2">' + esc(p.desk) + '</div>' : '') + '</div><div class="pr">' + (p.coret > p.harga ? '<div class="strike">' + rp(p.coret) + '</div>' : '') +
      '<div class="price">' + rp(p.harga) + '</div>' + (p.satuan ? '<div class="sat">' + esc(p.satuan) + '</div>' : isMenu ? '<div class="sat">per porsi</div>' : '') + '</div></div>';
    let body = '';
    groups.forEach(g => {
      if (S.plGrup !== 'all' && S.plGrup !== g) return;
      const list = gmap[g].filter(p => match(p)); if (!list.length) return;
      body += '<section class="pl-group"><h2><span class="gi">' + ic(gIcon(g)) + '</span>' + esc(g) + '</h2><div class="pl-list">' + list.map(p => item(p, false)).join('') + '</div></section>';
    });
    if (showMenu && (S.plGrup === 'all' || S.plGrup === '__menu')) {
      S.boot.kat.forEach(k => {
        const list = S.boot.menu.filter(m => m.kat === k.id && match(m)); if (!list.length) return;
        body += '<section class="pl-group"><h2><span class="gi">' + ic(/bev|minum|drink|kopi/i.test(k.nama) ? 'coffee' : 'utensils') + '</span>' + esc(k.nama) + ' <span class="faint small" style="font-weight:500">Menu Cafe</span></h2><div class="pl-list">' + list.map(m => item(m, true)).join('') + '</div></section>';
      });
    }
    if (!body) body = '<div class="empty"><div class="art">' + ic('search') + '</div><h4>Tidak ada yang cocok</h4><p>Coba kata kunci lain.</p></div>';
    const promos = (S.boot.promo || []).filter(p => p.banner || p.nama);
    return '<div class="pl-hero mt-16"><div class="row" style="gap:14px;position:relative;z-index:1"><div><h1>' + esc(st.pricelist_judul || 'Price List') + '</h1><p>' + esc(st.pricelist_subjudul || '') + '</p></div></div>' +
      '<div class="tagrow">' + (st.jam_buka ? '<span class="badge">' + ic('clock', 'sm') + esc(st.jam_buka) + '</span>' : '') + (st.alamat ? '<span class="badge">' + ic('pin', 'sm') + esc(st.alamat) + '</span>' : '') + (st.telepon ? '<span class="badge">' + ic('phone', 'sm') + esc(st.telepon) + '</span>' : '') + '</div></div>' +
      (promos.length ? '<div class="promo-row mt-16">' + promos.map(p => '<div class="card pad-s row" style="gap:12px">' + (p.banner ? '<img src="' + esc(p.banner) + '" alt="" style="width:64px;height:64px;border-radius:12px;object-fit:cover">' : '<div class="avatar" style="width:52px;height:52px">' + ic('percent') + '</div>') +
        '<div><div class="semi">' + esc(p.nama || p.kode) + '</div><div class="small faint">Kode <b class="orange">' + esc(p.kode) + '</b>' + (p.min ? ' • min. ' + rp(p.min) : '') + '</div></div></div>').join('') + '</div>' : '') +
      '<div class="row mt-16 wrap" style="gap:10px"><div class="search grow" style="min-width:220px"><input class="input" id="q-pl" type="search" placeholder="Cari layanan atau menu…" value="' + esc(S.q) + '" aria-label="Cari price list" style="padding-left:42px">' + ic('search') + '</div></div>' +
      '<div class="chips mt-12">' + chips.map(g => '<button class="chip' + (S.plGrup === g ? ' on' : '') + '" data-act="plGrup" data-g="' + esc(g) + '">' + (g === 'all' ? 'Semua' : g === '__menu' ? 'Menu Cafe' : esc(g)) + '</button>').join('') + '</div>' +
      body + '<div class="pl-note">' + ic('info') + '<div><b>Halaman ini hanya untuk melihat harga.</b> ' + esc(st.pricelist_info || '') + (S.kode ? '' : ' Untuk memesan menu, scan QR yang ada di meja Anda.') + '</div></div>';
  }

  // ------------------------------------------------------------------
  // View: PIN meja
  // ------------------------------------------------------------------
  function viewPin() {
    return '<div class="auth"><div class="auth-card center"><div class="logo">' + ic('lock', 'xl') + '</div><h2>Masukkan PIN Meja ' + esc(mejaNo()) + '</h2>' +
      '<p class="muted">Minta PIN 4 angka ke kasir. PIN menjaga agar hanya tamu di meja ini yang bisa memesan.</p>' +
      '<form class="col gap-16" id="pin-form"><div class="pin-boxes">' + [0, 1, 2, 3].map(i => '<input inputmode="numeric" maxlength="1" pattern="[0-9]" aria-label="Angka PIN ' + (i + 1) + '" data-pin="' + i + '">').join('') + '</div>' +
      (S.pinErr ? '<div class="err-msg" style="justify-content:center">' + ic('alert', 'sm') + esc(S.pinErr) + '</div>' : '') +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">Lanjutkan</button></form>' +
      '<button class="btn btn-ghost" data-act="go" data-h="pricelist">Lihat Price List saja</button></div></div>';
  }

  // ------------------------------------------------------------------
  // View: Pilih metode bayar
  // ------------------------------------------------------------------
  const METODE = [
    { id: 'qris', g: 'qris', ic: 'qr', t: 'QRIS (Semua Pembayaran)', d: 'GoPay, OVO, DANA, ShopeePay, m-Banking, dll.', tags: ['<span class="badge b-solid-orange">' + ic('flame', 'sm') + 'Paling Populer & Otomatis</span>', '<span class="badge b-green">' + ic('check', 'sm') + 'Verifikasi real-time</span>'] },
    { id: 'ewallet', g: 'ewallet', ic: 'wallet', t: 'E-Wallet Langsung', d: 'Bayar lewat aplikasi e-wallet Anda.', subs: [['gopay', 'GoPay'], ['shopeepay', 'ShopeePay']], tags: ['<span class="badge b-neutral">Verifikasi instan</span>'] },
    { id: 'va', g: 'va', ic: 'bank', t: 'Virtual Account (VA)', d: 'Transfer ke nomor VA, otomatis tanpa unggah bukti.', subs: [['va_bca', 'BCA'], ['va_bni', 'BNI'], ['va_bri', 'BRI']], tags: ['<span class="badge b-neutral">Otomatis</span>'] },
    { id: 'qris_statis', g: 'qris_statis', ic: 'qr', t: 'QRIS Cafe', d: 'Scan QRIS cafe, lalu unggah bukti pembayaran.', tags: ['<span class="badge b-amber">Perlu verifikasi kasir</span>'] },
    { id: 'transfer', g: 'transfer', ic: 'file', t: 'Transfer Manual + Bukti Bayar', d: 'Transfer ke rekening cafe lalu unggah bukti.', tags: ['<span class="badge b-amber">Perlu verifikasi kasir (±3–5 mnt)</span>'] },
    { id: 'kasir', g: 'kasir', ic: 'cash', t: 'Bayar Langsung di Kasir', d: 'Tunjukkan nomor pesanan ke kasir.', tags: ['<span class="badge b-neutral">Tunai • EDC Debit • Kartu Kredit</span>'] }
  ];
  function metodeTersedia() { const m = set().metode || []; return METODE.map(x => Object.assign({}, x, { subs: x.subs ? x.subs.filter(s => m.indexOf(s[0]) > -1) : null })).filter(x => x.subs ? x.subs.length : m.indexOf(x.id) > -1); }
  function flowHead(title, sub, back) {
    return '<div class="flow-head"><button class="back-btn" data-act="go" data-h="' + (back || 'status') + '" aria-label="Kembali">' + ic('arrowL') + '</button><div class="grow"><h2>' + esc(title) + '</h2>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      (mejaNo() ? '<span class="badge b-orange" style="padding:6px 12px">' + ic('grid', 'sm') + 'Meja ' + esc(mejaNo()) + '</span>' : '') + '</div>';
  }
  function itemsList(o, compact) {
    return o.items.map(i => '<div class="sum-row" style="color:var(--text)"><span><b>' + esc(i.n) + '</b><br><span class="faint small">' + i.q + ' porsi' + (i.o ? ' • ' + esc(i.o) : '') + (i.c ? ' • ' + esc(i.c) : '') + '</span></span><b>' + rp(i.s) + '</b></div>').join('');
  }
  function totalsBox(o) {
    const st = set();
    return '<div class="soft-box mt-12"><div class="sum-row"><span>Subtotal (' + o.items.reduce((a, i) => a + i.q, 0) + ' item)</span><b>' + rp(o.sub) + '</b></div>' +
      (o.dp ? '<div class="sum-row dsc"><span>Diskon Promo' + (o.pk ? ' (' + esc(o.pk) + ')' : '') + '</span><b>-' + rp(o.dp) + '</b></div>' : '') + (o.dm ? '<div class="sum-row dsc"><span>Diskon</span><b>-' + rp(o.dm) + '</b></div>' : '') +
      (o.lyn ? '<div class="sum-row"><span>Biaya Layanan</span><b>' + rp(o.lyn) + '</b></div>' : '') + (o.pjk ? '<div class="sum-row"><span>Pajak ' + esc(st.label_pajak || '') + ' (' + st.pajak_persen + '%)</span><b>' + rp(o.pjk) + '</b></div>' : '') +
      '<div class="sum-row" style="margin-top:6px;color:var(--text)"><span class="semi" style="font-size:16px">Total Pembayaran</span><span class="price" style="font-size:22px">' + rp(o.tot) + '</span></div></div>';
  }
  function viewBayar(id) {
    const o = orderById(id);
    if (!o) { ensureOrder(id).then(x => { if (x) rerender(); else go('status'); }); return '<div class="flow"><div class="skel" style="height:220px;border-radius:16px"></div></div>'; }
    if (o.sb === 'lunas') return viewStatus();
    const opts = metodeTersedia(), sel = S.selMetode && opts.some(x => x.id === S.selMetode.g) ? S.selMetode : (opts[0] ? { g: opts[0].id, m: opts[0].subs ? opts[0].subs[0][0] : opts[0].id } : null);
    S.selMetode = sel;
    const porsi = o.items.reduce((a, i) => a + i.q, 0);
    return '<div class="flow">' + flowHead('Pilih Metode Bayar', 'Ref: ' + esc(o.id) + (o.mn ? ' <span class="orange">• Meja ' + esc(o.mn) + '</span>' : ''), 'status') +
      '<div class="card pad-s"><div class="row between"><span class="small muted">Nomor Pesanan</span><span class="badge b-orange">' + ic('grid', 'sm') + 'Meja ' + esc(o.mn || '-') + '</span></div>' +
      '<div class="row between mt-4"><div class="row">' + ic('receipt', 'lg orange') + '<span class="head" style="font-size:22px;font-weight:800">' + esc(o.id) + '</span></div>' + (o.nama ? '<span class="small muted row gap-4">' + ic('user', 'sm') + esc(o.nama) + '</span>' : '') + '</div></div>' +
      (o.pk ? '<div class="banner ok">' + ic('percent') + '<div class="grow"><b>' + esc(o.pk) + '</b> dipakai — hemat ' + rp(o.dp) + ' untuk pesanan ini.</div></div>' : '') +
      '<details class="card pad-s" open><summary class="row between" style="cursor:pointer;list-style:none"><div class="row">' + ic('utensils', 'orange') + '<div><div class="semi" style="font-size:17px">Ringkasan Pesanan</div><div class="small faint">' + porsi + ' item terpilih</div></div></div><span class="price" style="font-size:18px">' + rp(o.tot) + '</span></summary>' +
      '<div class="mt-12">' + itemsList(o) + '</div>' + totalsBox(o) + '</details>' +
      '<div class="row between mt-8"><div><h3>Pilih Metode Pembayaran</h3><div class="small faint">Pilih yang paling nyaman untuk Anda</div></div><span class="badge b-green">' + ic('shield', 'sm') + 'Aman</span></div>' +
      (opts.length ? opts.map(x => {
        const on = sel && sel.g === x.id;
        return '<div class="pay-opt' + (on ? ' on' : '') + '" data-act="pilihMetode" data-g="' + x.id + '" role="radio" aria-checked="' + on + '" tabindex="0"><div class="pi">' + ic(x.ic, 'lg') + '</div><div class="grow"><div class="semi">' + esc(x.t) + '</div>' +
          '<div class="small faint">' + esc(x.d) + '</div><div class="row wrap mt-8" style="gap:6px">' + x.tags.join('') + '</div>' +
          (x.subs && on ? '<div class="subs">' + x.subs.map(s => '<button class="' + (sel.m === s[0] ? 'on' : '') + '" data-act="pilihSub" data-m="' + s[0] + '">' + esc(s[1]) + '</button>').join('') + '</div>' : '') +
          '</div><span class="chk">' + (on ? ic('check', 'sm') : '') + '</span></div>';
      }).join('') : '<div class="banner warn">' + ic('info') + '<div>Pembayaran dilakukan di kasir. Tunjukkan nomor pesanan Anda.</div></div>') +
      '<div class="banner info">' + ic('lock') + '<div><b>Transaksi aman & terenkripsi.</b> Pesanan Anda sudah masuk dapur; pembayaran diverifikasi otomatis atau oleh kasir.</div></div>' +
      '<button class="btn btn-ghost" data-act="go" data-h="status">Bayar nanti — lihat status pesanan</button></div>' +
      '<div class="sticky-foot"><div class="in"><div class="row between"><div><div class="small faint">Total Tagihan Final</div><div class="price" style="font-size:28px;line-height:1.1">' + rp(o.tot) + '</div></div><span class="badge b-orange">' + ic('flame', 'sm') + porsi + ' porsi masuk dapur</span></div>' +
      '<button class="btn btn-primary btn-lg btn-block" data-act="bayar" data-id="' + esc(o.id) + '" data-loading="Menyiapkan pembayaran…"' + (sel ? '' : ' disabled') + '>' + (sel && sel.g === 'kasir' ? 'Bayar di Kasir' : 'Bayar Sekarang – ' + rp(o.tot)) + ' ' + ic('arrowR') + '</button></div></div>';
  }

  // ------------------------------------------------------------------
  // View: Instruksi pembayaran (QRIS, e-wallet, VA, transfer, QRIS statis)
  // ------------------------------------------------------------------
  function viewInstruksi(id) {
    const o = orderById(id);
    if (!o) { ensureOrder(id).then(x => { if (x) rerender(); else go('status'); }); return '<div class="flow"><div class="skel" style="height:300px;border-radius:16px"></div></div>'; }
    if (o.sb === 'lunas') { setTimeout(() => go('status'), 0); return ''; }
    const t = S.trx[id] || o.trx;
    if (!t || (t.st !== 'pending' && t.st !== 'verifikasi')) { setTimeout(() => go('bayar/' + id), 0); return ''; }
    const info = t.info || {}, gw = /^(qris|gopay|shopeepay|va_)/.test(t.met) && t.met !== 'qris_statis', manual = t.met === 'transfer' || t.met === 'qris_statis';
    const exp = info.exp || 0, menit = Number(set().batas_bayar_menit || 15) * 60000 * (manual ? 2 : 1);
    const pct = exp ? Math.max(0, Math.min(100, (exp - Date.now()) / menit * 100)) : 100;
    let main = '';
    if (t.st === 'verifikasi') main = '<div class="card pad center"><div class="empty" style="padding:8px"><div class="art">' + ic('clock') + '</div><h4>Bukti sedang diperiksa kasir</h4><p>Biasanya 3–5 menit. Halaman ini otomatis berubah saat pembayaran dikonfirmasi.</p></div></div>';
    else if (t.met === 'qris' || t.met === 'qris_statis' || (t.met === 'gopay' && !mq.matches)) {
      const qrHtml = info.qrs ? CFQR.svg(info.qrs, { border: 2 }) : info.qr ? '<img src="' + esc(info.qr) + '" alt="Kode QRIS pembayaran">' : '<div class="ph" style="width:100%;height:100%">' + ic('qr') + '</div>';
      main = '<div class="card pad"><div class="row between soft-box" style="padding:10px 12px"><div class="row"><span class="mtag">QRIS</span><span class="small muted">Standar Pembayaran Nasional</span></div><span class="badge b-white">' + ic('shield', 'sm') + 'GPN</span></div>' +
        '<div class="center mt-16"><div class="semi" style="font-size:17px">' + esc(set().nama_aplikasi || '') + (o.mn ? ' — Meja ' + esc(o.mn) : '') + '</div></div>' +
        '<div class="qr-frame" id="qr-box"><i></i>' + qrHtml + '</div>' +
        '<div class="row wrap" style="justify-content:center;gap:6px">' + ['BCA', 'Mandiri', 'GoPay', 'OVO', 'ShopeePay', 'DANA', 'LinkAja'].map(b => '<span class="badge b-neutral">' + b + '</span>').join('') + '</div>' +
        (info.qrs ? '<div class="row mt-16" style="gap:10px"><button class="btn btn-soft grow" data-act="unduhQr">' + ic('download', 'sm') + 'Unduh QR</button></div>' : info.qr ? '<a class="btn btn-soft btn-block mt-16" href="' + esc(info.qr) + '" target="_blank" rel="noopener">' + ic('ext', 'sm') + 'Buka gambar QR</a>' : '') + '</div>';
    } else if (t.met === 'gopay' || t.met === 'shopeepay') {
      main = '<div class="card pad center"><div class="empty" style="padding:8px"><div class="art">' + ic('wallet') + '</div><h4>Lanjutkan di aplikasi ' + (t.met === 'gopay' ? 'GoPay' : 'ShopeePay') + '</h4><p>Ketuk tombol di bawah, konfirmasi pembayaran, lalu kembali ke halaman ini.</p>' +
        (info.deeplink ? '<a class="btn btn-primary btn-lg" href="' + esc(info.deeplink) + '">' + ic('ext') + 'Buka Aplikasi ' + (t.met === 'gopay' ? 'GoPay' : 'ShopeePay') + '</a>' : '') + '</div></div>';
    } else if (/^va_/.test(t.met)) {
      main = '<div class="card pad"><div class="label-up">Bank ' + esc(String(info.bank || t.met.slice(3)).toUpperCase()) + ' — Nomor Virtual Account</div><div class="row between mt-8"><span class="head tnum" style="font-size:26px;font-weight:800;letter-spacing:.04em">' + esc(info.va || '-') + '</span>' +
        '<button class="btn btn-soft btn-sm" data-act="salin" data-v="' + esc(info.va || '') + '">' + ic('copy', 'sm') + 'Salin</button></div><p class="help mt-8">Nomor VA khusus untuk pesanan ini. Nominal harus sama persis.</p></div>';
    } else if (t.met === 'transfer') {
      main = '<div class="card pad"><div class="label-up">Transfer ke rekening</div><div class="semi mt-8" style="font-size:17px">' + esc(info.bank || '') + '</div><div class="row between"><span class="head tnum" style="font-size:24px;font-weight:800">' + esc(info.rek || '') + '</span>' +
        '<button class="btn btn-soft btn-sm" data-act="salin" data-v="' + esc(info.rek || '') + '">' + ic('copy', 'sm') + 'Salin</button></div><div class="small muted">a.n. ' + esc(info.an || '') + '</div></div>';
    }
    const upload = manual && t.st === 'pending' ? '<div class="card pad" id="upload-box"><h3>Unggah Bukti Pembayaran</h3><p class="small faint mt-4">Foto/tangkapan layar bukti transfer (JPG, PNG, WebP).</p>' +
      '<label class="dropzone mt-12" for="bukti-in">' + ic('upload', 'lg') + '<b>Pilih atau ambil foto bukti</b><span class="small">Gambar otomatis dikompres</span><input type="file" id="bukti-in" accept="image/jpeg,image/png,image/webp" class="sr-only"></label><div id="bukti-prev"></div></div>' : '';
    const steps = { qris: ['Buka aplikasi m-Banking atau e-wallet (BCA Mobile, Livin\', GoPay, OVO, DANA, dll).', 'Pilih menu <b class="orange">Scan</b> atau <b class="orange">Bayar dengan QRIS</b>.', 'Arahkan kamera ke QR di atas, atau unggah dari galeri bila QR sudah diunduh.', 'Pastikan nama merchant & nominal <b class="green">' + rp(t.jml) + '</b> sudah benar, lalu masukkan PIN.'],
      va: ['Buka m-Banking / ATM bank yang dipilih.', 'Pilih Transfer → Virtual Account.', 'Masukkan nomor VA di atas, periksa nominal <b class="green">' + rp(t.jml) + '</b>.', 'Konfirmasi. Pembayaran terdeteksi otomatis.'],
      transfer: ['Transfer tepat <b class="green">' + rp(t.jml) + '</b> ke rekening di atas.', 'Simpan bukti transfer (tangkapan layar).', 'Unggah bukti di kotak di atas.', 'Kasir memverifikasi dalam beberapa menit.'],
      qris_statis: ['Scan QRIS cafe dengan aplikasi pembayaran Anda.', 'Masukkan nominal tepat <b class="green">' + rp(t.jml) + '</b>.', 'Simpan bukti pembayaran, lalu unggah di atas.', 'Kasir memverifikasi dalam beberapa menit.'] };
    const sk = /^va_/.test(t.met) ? 'va' : (t.met === 'gopay' || t.met === 'shopeepay') ? 'qris' : t.met;
    return '<div class="flow">' + flowHead('Instruksi Pembayaran', '<span class="orange">●</span> ' + (o.mn ? 'MEJA ' + esc(o.mn) : esc(o.id)), 'bayar/' + o.id) +
      '<div class="card pad-s"><div class="row between"><span class="row small muted">' + ic('receipt', 'sm') + 'No. Pesanan</span><b class="tnum">' + esc(o.id) + '</b></div>' +
      '<div class="row between mt-8 soft-box" style="padding:8px 12px"><span class="row small">' + ic('user', 'sm') + esc(o.nama || 'Tamu') + '</span><span class="small orange semi">Meja ' + esc(o.mn || '-') + '</span></div></div>' +
      (t.st === 'pending' ? '<div class="banner orange" style="flex-direction:column;align-items:stretch;gap:10px"><div class="row between"><span class="row semi" style="font-size:16px">' + ic('clock') + 'Menunggu Pembayaran</span>' +
        (exp ? '<span class="badge b-white"><span class="dot" style="color:var(--accent)"></span><span id="exp-cd" class="tnum">' + CF.durasi(exp - Date.now()) + '</span></span>' : '') + '</div>' +
        (exp ? '<div class="progress"><span id="exp-bar" style="width:' + pct + '%"></span></div><div class="row between xs"><span>Batas waktu transaksi</span><span>Bayar sebelum ' + CF.jam(exp) + ' WIB</span></div>' : '') + '</div>' : '') +
      '<div class="card pad-s row between"><div><div class="label-up">Total tagihan <span class="badge b-green" style="margin-left:6px">' + ic('checkC', 'sm') + 'Sesuai nominal</span></div><div class="price" style="font-size:28px">' + rp(t.jml) + '</div></div>' +
      '<button class="btn btn-soft btn-sm" data-act="salin" data-v="' + t.jml + '">' + ic('copy', 'sm') + 'Salin</button></div>' +
      main + upload +
      (gw && t.st === 'pending' ? '<div class="card pad-s"><div class="banner warn" style="background:var(--surface-2);color:var(--muted);border:0"><span class="spin" style="width:14px;height:14px;border:2px solid var(--primary);border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin-top:3px"></span><div>Menunggu konfirmasi pembayaran otomatis (biasanya 5–10 detik setelah Anda membayar)…</div></div>' +
        '<button class="btn btn-soft btn-block mt-12" data-act="cekBayar" data-id="' + esc(o.id) + '" data-loading="Memeriksa…">' + ic('refresh', 'sm') + 'Cek Status Pembayaran</button></div>' : '') +
      (t.st === 'pending' ? '<button class="btn btn-ghost" data-act="go" data-h="bayar/' + esc(o.id) + '">' + ic('refresh', 'sm') + 'Ganti Metode Pembayaran</button>' : '') +
      (steps[sk] ? '<details class="card pad-s" open><summary class="row between" style="cursor:pointer;list-style:none"><div class="row"><span class="avatar">' + ic('info') + '</span><div><div class="semi">Panduan Bayar</div><div class="small faint">' + steps[sk].length + ' langkah mudah</div></div></div>' + ic('down') + '</summary>' +
        '<ol class="col mt-12" style="padding-left:0;list-style:none;gap:12px">' + steps[sk].map((s, i) => '<li class="row top" style="gap:12px"><span class="avatar" style="width:28px;height:28px;font-size:13px">' + (i + 1) + '</span><span class="small">' + s + '</span></li>').join('') + '</ol></details>' : '') + '</div>' +
      '<div class="sticky-foot"><div class="in"><div class="row between"><div><div class="small faint">Total Pembayaran</div><div class="price" style="font-size:24px">' + rp(t.jml) + '</div></div>' +
      (gw ? '<button class="btn btn-primary btn-lg" data-act="cekBayar" data-id="' + esc(o.id) + '" data-loading="Memeriksa…">Sudah Bayar ' + ic('arrowR') + '</button>' : manual && t.st === 'pending' ? '<button class="btn btn-primary btn-lg" data-act="fokusUpload">Unggah Bukti ' + ic('upload') + '</button>' : '<button class="btn btn-secondary btn-lg" data-act="go" data-h="status">Lihat Status</button>') + '</div></div></div>';
  }

  // ------------------------------------------------------------------
  // View: Status pesanan (pelacakan real-time)
  // ------------------------------------------------------------------
  const LANGKAH = [['bayar', 'Menunggu Pembayaran', 'Selesaikan pembayaran agar pesanan tercatat lunas.', 'wallet'], ['baru', 'Diterima Kasir & Dapur', 'Pesanan masuk antrean dapur.', 'receipt'], ['diproses', 'Sedang Diproses Dapur & Bar', 'Pesanan Anda sedang disiapkan dengan bahan segar.', 'chef'], ['siap', 'Siap Disajikan', 'Pelayan mengantar ke meja Anda.', 'concierge'], ['selesai', 'Pesanan Selesai', 'Selamat menikmati!', 'sparkles']];
  const ST_BADGE = { baru: ['b-blue', 'Diterima'], diproses: ['b-orange', 'Sedang Dimasak'], siap: ['b-green', 'Siap Disajikan'], selesai: ['b-neutral', 'Selesai'], batal: ['b-red', 'Dibatalkan'] };
  const SB_BADGE = { lunas: ['b-green', 'Lunas'], belum: ['b-amber', 'Belum Dibayar'], menunggu: ['b-amber', 'Menunggu Pembayaran'], verifikasi: ['b-amber', 'Diverifikasi Kasir'], refund: ['b-red', 'Dikembalikan'], batal: ['b-neutral', 'Batal'] };
  function timeline(o) {
    const at = {}; (o.riw || []).forEach(r => { at[r.s] = r.at; });
    const order = ['baru', 'diproses', 'siap', 'selesai'], idx = order.indexOf(o.st);
    const paid = o.sb === 'lunas';
    return '<div class="tl-v">' + LANGKAH.map((L, i) => {
      let cls;
      if (L[0] === 'bayar') cls = paid ? 'done' : 'now';
      else { const k = order.indexOf(L[0]); cls = k < idx ? 'done' : k === idx ? (L[0] === 'selesai' ? 'done' : 'now') : 'todo'; if (L[0] === 'baru' && idx > 0) cls = 'done'; }
      if (L[0] === 'bayar' && paid) L = ['bayar', 'Pembayaran Lunas', CF.LABEL_METODE[o.met] ? 'Dibayar via ' + CF.LABEL_METODE[o.met] + '.' : 'Pembayaran terkonfirmasi.', 'wallet'];
      const tm = L[0] === 'bayar' ? (paid ? at.lunas : 0) : at[L[0]] || (L[0] === 'baru' ? o.dib : L[0] === 'siap' ? o.siap : 0);
      return '<div class="st ' + cls + '"><span class="bul">' + ic(cls === 'done' ? 'check' : L[3], 'sm') + '</span><div class="grow"><div class="row between"><span class="t">' + esc(L[1]) + '</span>' + (cls === 'now' && L[0] !== 'bayar' ? '<span class="badge b-orange">Aktif</span>' : tm ? '<span class="xs faint tnum">' + CF.jam(tm) + '</span>' : '') + '</div><div class="d">' + esc(L[2]) + '</div></div></div>';
    }).join('') + '</div>';
  }
  function orderCard(o) {
    const b = ST_BADGE[o.st] || ST_BADGE.baru, sb = SB_BADGE[o.sb] || SB_BADGE.belum;
    const prog = { baru: 30, diproses: 60, siap: 85, selesai: 100, batal: 100 }[o.st] || 20;
    let pay = '';
    if (o.st !== 'batal') {
      if (o.sb === 'belum') pay = '<div class="banner warn">' + ic('wallet') + '<div class="grow"><b>Belum dibayar.</b> Pesanan tetap diproses dapur.</div><button class="btn btn-primary btn-sm" data-act="go" data-h="bayar/' + esc(o.id) + '">Bayar</button></div>';
      else if (o.sb === 'menunggu' && o.trx && o.trx.met === 'kasir') pay = '<div class="banner info">' + ic('cash') + '<div class="grow">Silakan bayar di kasir dengan menyebut nomor <b>' + esc(o.np) + '</b>.</div><button class="btn btn-secondary btn-sm" data-act="go" data-h="bayar/' + esc(o.id) + '">Ganti metode</button></div>';
      else if (o.sb === 'menunggu') pay = '<div class="banner warn">' + ic('clock') + '<div class="grow">Menunggu pembayaran ' + esc(CF.LABEL_METODE[o.met] || '') + '.</div><button class="btn btn-primary btn-sm" data-act="go" data-h="instruksi/' + esc(o.id) + '">Lanjutkan</button></div>';
      else if (o.sb === 'verifikasi') pay = '<div class="banner info">' + ic('clock') + '<div>Bukti pembayaran sedang diperiksa kasir.</div></div>';
    } else pay = '<div class="banner danger">' + ic('ban') + '<div><b>Pesanan dibatalkan.</b> ' + esc(o.alasan || '') + (o.sb === 'refund' ? ' Dana Anda akan dikembalikan oleh kasir.' : '') + '</div></div>';
    return '<div class="card pad col gap-12" id="o-' + esc(o.id) + '">' +
      '<div class="row between top"><div><div class="label-up">Nomor panggil antrean</div><div class="row mt-4"><span class="call-no">' + esc(o.np) + '</span>' + (o.mn ? '<span class="badge b-orange">Meja ' + esc(o.mn) + '</span>' : '') + '</div></div>' +
      '<div class="col" style="align-items:flex-end;gap:6px"><span class="badge ' + b[0] + '"><span class="dot"></span>' + b[1] + '</span><span class="badge ' + sb[0] + '">' + sb[1] + '</span></div></div>' +
      (o.st === 'siap' ? '<div class="banner ok">' + ic('concierge') + '<div><b>Pesanan ' + esc(o.np) + ' sudah siap!</b> Pelayan segera mengantar ke meja Anda.</div></div>' : '') +
      '<div class="info-grid"><div><div class="k">ID Pesanan</div><div class="v ellipsis">' + esc(o.id) + '</div></div><div><div class="k">Pelanggan</div><div class="v ellipsis">' + esc(o.nama || 'Tamu') + '</div></div><div><div class="k">Waktu Pesan</div><div class="v">' + CF.jam(o.dib) + ' WIB</div></div></div>' +
      pay + (o.st !== 'batal' ? '<div><div class="row between mb-8"><span class="row semi">' + ic('utensils', 'orange') + 'Pelacakan Pesanan</span></div><div class="progress mb-16"><span style="width:' + prog + '%"></span></div>' + timeline(o) + '</div>' : '') +
      '<details><summary class="row between" style="cursor:pointer;list-style:none"><span class="row semi">' + ic('receipt', 'orange') + 'Daftar Menu (' + o.items.reduce((a, i) => a + i.q, 0) + ' porsi)</span><span class="small orange row">Detail ' + ic('down', 'sm') + '</span></summary>' +
      '<div class="col mt-12">' + o.items.map(i => { const m = menuById(i.m) || {}; return '<div class="order-line"><div class="thumb" style="overflow:hidden">' + CF.img(m.foto, i.n) + '</div><div class="grow"><div class="row between"><b>' + esc(i.n) + '</b><span class="faint">' + i.q + '×</span></div>' + (i.o || i.c ? '<div class="small red">' + esc([i.o, i.c].filter(Boolean).join(', ')) + '</div>' : '') + '<div class="price">' + rp(i.s) + '</div></div></div>'; }).join('') + '</div>' + totalsBox(o) + '</details>' +
      (o.sb === 'lunas' || o.sb === 'refund' ? '<button class="btn btn-secondary" data-act="go" data-h="struk/' + esc(o.id) + '">' + ic('receipt', 'sm') + 'Lihat Struk</button>' : '') + '</div>';
  }
  function viewStatus() {
    const list = S.orders;
    const paid = S.paidFlash && orderById(S.paidFlash);
    const aktif = canOrder();
    const body = list.length ? list.map(orderCard).join('') : '<div class="card pad"><div class="empty"><div class="art">' + ic('receipt') + '</div><h4>Belum ada pesanan</h4><p>Pesanan Anda akan tampil di sini setelah dikirim.</p>' + (S.kode ? '<button class="btn btn-primary" data-act="go" data-h="menu">Lihat Menu</button>' : '') + '</div></div>';
    return '<div class="flow">' + flowHead('Pesanan Saya', S.kode && mejaNo() ? '<span class="orange">●</span> MEJA ' + esc(mejaNo()) : 'Riwayat pesanan di perangkat ini', S.kode ? 'menu' : 'pricelist') +
      (paid ? '<div class="banner ok row between">' + ic('checkC') + '<div class="grow"><b>Pembayaran ' + esc(CF.LABEL_METODE[paid.met] || '') + ' berhasil & terverifikasi</b></div><b class="tnum">' + rp(paid.tot) + '</b></div>' : '') +
      body +
      (list.length ? '<div class="banner info">' + ic('bell') + '<div><b>Pengingat Layar Antrean</b><br>Nomor panggil Anda akan muncul di layar antrean, dan ponsel bergetar saat pesanan siap — biarkan halaman ini tetap terbuka.</div></div>' +
        '<div class="row between small faint card pad-s"><span class="row"><span class="dot" style="color:var(--green)"></span>Memperbarui otomatis tiap 5–10 detik</span><button class="btn btn-ghost btn-sm orange" data-act="segarkan">' + ic('refresh', 'sm') + 'Segarkan</button></div>' : '') +
      (tok() && aktif ? '<div class="card pad-s row between"><div class="row"><span class="avatar">' + ic('concierge') + '</span><div><div class="semi">Butuh bantuan?</div><div class="small faint">Pelayan siap mendatangi Meja ' + esc(mejaNo()) + '</div></div></div><button class="btn btn-soft" data-act="panggilPelayan" data-loading="Memanggil…">' + ic('bell', 'sm') + 'Panggil</button></div>' : '') +
      '</div>' + (S.kode ? '<div class="sticky-foot"><div class="in"><div class="row" style="gap:10px">' + (list.some(o => o.sb === 'lunas') ? '<button class="btn btn-soft btn-icon btn-lg" data-act="go" data-h="struk/' + esc(list.filter(o => o.sb === 'lunas')[0].id) + '" aria-label="Struk terakhir">' + ic('receipt') + '</button>' : '') +
        (aktif ? '<button class="btn btn-primary btn-lg grow" data-act="go" data-h="menu">' + ic('plus') + 'Tambah Menu ke Meja ' + esc(mejaNo()) + '</button>' : '<button class="btn btn-secondary btn-lg grow" disabled>Sesi meja telah berakhir</button>') + '</div></div></div>' : '');
  }

  // ------------------------------------------------------------------
  // View: Struk
  // ------------------------------------------------------------------
  function strukUrl(o) { return location.origin + location.pathname + '?o=' + encodeURIComponent(o.id) + '&k=' + encodeURIComponent(o.k); }
  function receiptHtml(o) {
    const st = set(), lunas = o.sb === 'lunas';
    return '<div class="receipt"><div class="logo">' + CF.logoHtml(st, 'xl') + '</div><div class="center"><h2>' + esc(st.nama_aplikasi || '') + '</h2><div class="small muted">' + esc(st.alamat || '') + (st.telepon ? '<br>' + esc(st.telepon) : '') + '</div>' +
      '<span class="badge ' + (lunas ? 'b-green' : 'b-amber') + ' mt-12" style="padding:6px 16px;font-size:13px">' + ic(lunas ? 'checkC' : 'clock', 'sm') + (lunas ? 'LUNAS • ' + esc((CF.LABEL_METODE[o.met] || o.met).toUpperCase()) : o.sb === 'refund' ? 'DIBATALKAN • DANA DIKEMBALIKAN' : 'BELUM LUNAS') + '</span></div>' +
      '<div class="meta"><div><div class="k">No. Pesanan</div><div class="v">' + esc(o.id) + '</div></div><div class="right"><div class="k">No. Antrean</div><div class="v orange">' + esc(o.np) + '</div></div>' +
      '<div><div class="k">Tanggal & Waktu</div><div class="v">' + CF.tglJam(o.dib) + ' WIB</div></div><div class="right"><div class="k">Kasir / Sistem</div><div class="v">Self-Order QR</div></div>' +
      '<div style="grid-column:1/-1" class="row between"><span class="k">Pelanggan</span><span class="v">' + esc((o.nama || 'Tamu') + (o.mn ? ' (Meja ' + o.mn + ')' : '')) + '</span></div></div>' +
      '<div class="row between mt-16"><span class="label-up">Rincian pesanan</span><span class="xs faint">' + o.items.reduce((a, i) => a + i.q, 0) + ' porsi</span></div>' +
      o.items.map(i => '<div class="it"><div><b>' + i.q + 'x ' + esc(i.n) + '</b>' + (i.o || i.c ? '<div class="small faint">' + esc([i.o, i.c].filter(Boolean).join(', ')) + '</div>' : '') + '</div><b class="nowrap">' + rp(i.s) + '</b></div>').join('') +
      '<div class="tot-box"><div class="sum-row"><span>Subtotal</span><b>' + rp(o.sub) + '</b></div>' + (o.dp ? '<div class="sum-row dsc"><span>Diskon Promo</span><b>-' + rp(o.dp) + '</b></div>' : '') + (o.dm ? '<div class="sum-row dsc"><span>Diskon</span><b>-' + rp(o.dm) + '</b></div>' : '') +
      (o.lyn ? '<div class="sum-row"><span>Biaya Layanan</span><b>' + rp(o.lyn) + '</b></div>' : '') + (o.pjk ? '<div class="sum-row"><span>' + esc(st.label_pajak || 'Pajak') + ' (' + st.pajak_persen + '%)</span><b>' + rp(o.pjk) + '</b></div>' : '') +
      '<div class="sum-row" style="color:var(--text);margin-top:6px"><span class="semi" style="font-size:16px">Total Pembayaran</span><span class="price" style="font-size:22px">' + rp(o.tot) + '</span></div>' +
      (o.met ? '<div class="sum-row"><span>Metode Bayar</span><b>' + esc(CF.LABEL_METODE[o.met] || o.met) + '</b></div>' : '') + '</div>' +
      '<div class="mini-qr">' + CFQR.svg(strukUrl(o), { border: 1, light: '#F3F4F6' }) + '</div><p class="center small faint">' + esc(st.struk_footer || 'Terima kasih!') + '<br>Simpan struk ini sebagai bukti pembayaran yang sah.</p></div>';
  }
  function viewStruk(id) {
    const o = orderById(id);
    if (!o) { ensureOrder(id).then(x => { if (x) rerender(); else go('status'); }); return '<div class="flow"><div class="skel" style="height:420px;border-radius:24px"></div></div>'; }
    return '<div class="flow">' + flowHead('Struk Pembayaran', '<span class="orange">●</span> ' + (o.mn ? 'MEJA ' + esc(o.mn) : esc(o.id)), 'status') + receiptHtml(o) +
      '<div class="card pad-s mt-16"><div class="row"><span class="avatar">' + ic('mail') + '</span><div><div class="semi">Kirim Struk ke Email</div><div class="small faint">Simpan salinan digital di kotak masuk Anda</div></div></div>' +
      '<form class="input-group mt-12" id="email-form"><input class="input" id="struk-email" type="email" required placeholder="email@contoh.com" value="' + esc(S.info.email) + '" aria-label="Email"><button class="btn btn-dark" type="submit">Kirim</button></form></div></div>' +
      '<div class="sticky-foot"><div class="in"><div class="row" style="gap:10px"><button class="btn btn-soft btn-lg grow" data-act="cetak" data-id="' + esc(o.id) + '">' + ic('printer') + 'Cetak Struk</button>' +
      '<button class="btn btn-primary btn-lg grow" data-act="pdf" data-id="' + esc(o.id) + '" data-loading="Membuat PDF…">' + ic('download') + 'Unduh PDF</button></div></div></div>';
  }

  // ------------------------------------------------------------------
  // Setelah render: input, countdown, polling bayar
  // ------------------------------------------------------------------
  let cdTimer = null, payPoll = null;
  function bindInputs() {
    const sv = (id, k) => { const el = document.getElementById(id); if (el) el.oninput = () => { S.info[k] = el.value; CF.store.set('cinfo', S.info); }; };
    sv('c-nama', 'nama'); sv('c-email', 'email'); sv('c-kontak', 'kontak'); sv('c-cat', 'catatan');
    const pi = document.getElementById('c-promo'); if (pi) pi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); CF.acts.promo(); } };
  }
  function afterRender(r) {
    bindInputs();
    ['q-d', 'q-m'].forEach(id => { const el = document.getElementById(id); if (el) el.oninput = () => { S.q = el.value; const w = document.getElementById('grid-wrap'); if (w) w.innerHTML = gridSection(); }; });
    const qpl = document.getElementById('q-pl'); if (qpl) qpl.oninput = CF.debounce(() => { S.q = qpl.value; rerender(); }, 200);
    clearInterval(cdTimer);
    cdTimer = setInterval(() => {
      const c = document.getElementById('cnt'); if (c) { const e = promoEnd(); c.textContent = e ? cd(e) : '00 : 00 : 00'; }
      const x = document.getElementById('exp-cd'); if (x) { const o = orderById(route().id), t = o && (S.trx[o.id] || o.trx), exp = t && t.info && t.info.exp; if (exp) { x.textContent = CF.durasi(exp - Date.now()); const b = document.getElementById('exp-bar'); if (b) b.style.width = Math.max(0, Math.min(100, (exp - Date.now()) / (Number(set().batas_bayar_menit || 15) * 60000 * (/transfer|statis/.test(t.met) ? 2 : 1)) * 100)) + '%'; } }
    }, 1000);
    const pf = document.getElementById('pin-form');
    if (pf) {
      const boxes = pf.querySelectorAll('[data-pin]'); boxes[0].focus();
      boxes.forEach((b, i) => { b.oninput = () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); if ([].every.call(boxes, x => x.value)) pf.requestSubmit(); }; b.onkeydown = e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); }; });
      pf.onsubmit = async e => { e.preventDefault(); const pin = [].map.call(boxes, x => x.value).join(''); if (pin.length < 4 || S.pinBusy) return; S.pinBusy = true; S.pinErr = ''; await masuk(pin); S.pinBusy = false; if (S.meja.t) { await refreshStatus(true); go('menu'); } else rerender(); };
    }
    const bi = document.getElementById('bukti-in'); if (bi) bi.onchange = () => uploadBukti(bi.files[0]);
    const ef = document.getElementById('email-form');
    if (ef) ef.onsubmit = async e => {
      e.preventDefault(); const o = orderById(route().id), em = document.getElementById('struk-email').value.trim();
      S.info.email = em; CF.store.set('cinfo', S.info);
      const btn = ef.querySelector('button'); await CF.busy(btn, async () => { const x = await CF.api('struk.email', { id: o.id, k: o.k, email: em }); x.ok ? CF.toast(x.msg, 'ok') : CF.err(x); });
    };
    // Polling status bayar gateway saat di halaman instruksi
    clearInterval(payPoll);
    if (r.v === 'instruksi') {
      payPoll = setInterval(async () => {
        if (document.visibilityState !== 'visible' || route().v !== 'instruksi') return;
        const o = orderById(r.id); if (!o) return;
        const t = S.trx[o.id] || o.trx; if (!t) return;
        if (t.st === 'verifikasi' || /transfer|statis/.test(t.met)) { await refreshStatus(); return; }
        await cekBayar(o, true);
      }, 6000);
    }
  }
  async function cekBayar(o, diam) {
    const r = await CF.api('bayar.cek', { id: o.id, k: o.k });
    if (!r.ok) { if (!diam) CF.err(r); return; }
    mergeOrders([r.data]);
    if (r.data.sb === 'lunas') { S.paidFlash = o.id; delete S.trx[o.id]; CF.sound.beep(); CF.toast('Pembayaran berhasil! Terima kasih.', 'ok'); go('status'); }
    else if (r.data.trx && r.data.trx.st !== 'pending' && r.data.trx.st !== 'verifikasi') { delete S.trx[o.id]; CF.toast('Pembayaran ' + (r.data.trx.st === 'kedaluwarsa' ? 'kedaluwarsa' : 'gagal') + '. Silakan pilih metode lagi.', 'warn'); go('bayar/' + o.id); }
    else if (!diam) CF.toast('Pembayaran belum terdeteksi. Jika sudah membayar, tunggu beberapa detik.', 'info');
  }
  async function uploadBukti(file) {
    const o = orderById(route().id); if (!o || !file) return;
    const box = document.getElementById('bukti-prev');
    try {
      const img = await CF.fileToB64(file, { max: 1400, maxBytes: 600000 });
      box.innerHTML = '<div class="row mt-12"><img src="' + img.preview + '" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:12px"><div class="grow small">Mengunggah…</div><span class="spin" style="width:18px;height:18px;border:2px solid var(--primary);border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></span></div>';
      const r = await CF.api('bayar.bukti', { id: o.id, k: o.k, file: { type: img.type, b64: img.b64 } });
      if (!r.ok) { CF.err(r); box.innerHTML = ''; return; }
      CF.toast(r.msg, 'ok'); if (S.trx[o.id]) S.trx[o.id].st = 'verifikasi';
      await refreshStatus(true); go('status');
    } catch (e) { CF.toast(e.message, 'err'); box.innerHTML = ''; }
  }

  // ------------------------------------------------------------------
  // Aksi
  // ------------------------------------------------------------------
  const A = CF.acts;
  A.go = el => go(el.dataset.h);
  A.toggleSearch = () => { S.searchOpen = !S.searchOpen; rerender(); setTimeout(() => { const q = document.getElementById('q-m'); if (q) q.focus(); }, 30); };
  A.kat = el => { S.kat = el.dataset.k; const w = document.getElementById('grid-wrap'); if (w) w.innerHTML = gridSection(); };
  A.lihatSemua = () => { S.kat = 'all'; S.q = ''; ['q-d', 'q-m'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; }); const w = document.getElementById('grid-wrap'); if (w) w.innerHTML = gridSection(); };
  A.plGrup = el => { S.plGrup = el.dataset.g; rerender(); };
  A.filterSheet = () => {
    const m = CF.modal({ title: 'Filter Menu', size: 'sm', body: '<div class="col">' + [['all', 'Semua menu'], ['ada', 'Hanya yang tersedia'], ['promo', 'Sedang promo'], ['unggul', 'Menu favorit']].map(x => '<label class="opt' + ((S.filter || 'all') === x[0] ? ' on' : '') + '"><input type="radio" name="f" value="' + x[0] + '"><span class="mark"></span>' + x[1] + '</label>').join('') + '</div>',
      foot: '<button class="btn btn-primary btn-block" data-x>Terapkan</button>', onClose: () => { const w = document.getElementById('grid-wrap'); if (w) w.innerHTML = gridSection(); } });
    m.$$('input[name=f]').forEach(i => i.onchange = () => { S.filter = i.value; m.$$('.opt').forEach(o => o.classList.toggle('on', o.querySelector('input').checked)); });
  };
  const _filtered = filtered;
  filtered = function () { const f = S.filter || 'all'; return _filtered().filter(m => f === 'all' || (f === 'ada' && m.ada) || (f === 'promo' && m.coret > m.harga) || (f === 'unggul' && m.unggul)); };
  A.add = el => { const m = menuById(el.dataset.id); if (!m) return; if (m.opsi.length) return openDetail(m); if (addLine(m.id, [], '', 1)) { updateOrderUI(); CF.vibrate(20); } };
  A.inc = A.add;
  A.dec = el => { const id = el.dataset.id; for (let i = S.cart.length - 1; i >= 0; i--) if (S.cart[i].m === id) { S.cart[i].q--; if (S.cart[i].q <= 0) S.cart.splice(i, 1); break; } saveCart(); promoRecheck(); updateOrderUI(); };
  A.lineInc = el => { const l = S.cart[+el.dataset.i]; if (!l) return; const m = menuById(l.m); if (m && m.stok !== null && qtyOf(l.m) + 1 > m.stok) return CF.toast('Stok "' + m.nama + '" tinggal ' + m.stok + ' porsi.', 'warn'); l.q++; saveCart(); promoRecheck(); updateOrderUI(); };
  A.lineDec = el => { const l = S.cart[+el.dataset.i]; if (!l) return; l.q--; if (l.q <= 0) S.cart.splice(+el.dataset.i, 1); saveCart(); promoRecheck(); updateOrderUI(); };
  A.lineDel = el => { S.cart.splice(+el.dataset.i, 1); saveCart(); promoRecheck(); updateOrderUI(); };
  A.tamu = el => { S.info.tamu = Math.max(1, Math.min(30, (S.info.tamu || 1) + Number(el.dataset.d))); CF.store.set('cinfo', S.info); updateOrderUI(); };
  A.detail = el => { const m = menuById(el.dataset.id); if (m) openDetail(m); };
  A.cartSheet = () => {
    const m = CF.modal({ title: 'Pesanan Saat Ini', body: '<div id="cart-sheet">' + panelHtml() + '</div>', onClose: () => updateOrderUI() });
    S._sheet = m; bindInputs();
  };
  A.promo = async () => {
    const el = document.getElementById('c-promo'), kode = (el && el.value || '').trim().toUpperCase();
    if (!kode) return CF.toast('Masukkan kode promo.', 'warn');
    const r = await CF.api('promo.cek', { items: itemsPayload(), kode: kode });
    if (!r.ok) return CF.err(r);
    S.promo = { kode: r.data.promo.kode, nama: r.data.promo.nama, dp: r.data.dp }; CF.toast(r.msg || 'Promo dipakai.', 'ok'); updateOrderUI();
  };
  A.promoHapus = () => { S.promo = null; updateOrderUI(); };
  A.cekMeja = async el => { await CF.busy(el, async () => { await masuk(); if (canOrder()) { CF.toast('Meja aktif! Silakan pesan.', 'ok'); await refreshStatus(true); } else CF.toast('Meja belum diaktifkan kasir.', 'info'); }); rerender(); };
  A.pesan = async el => {
    if (!S.cart.length) return;
    const n = (document.getElementById('c-nama') || {}).value;
    if (n !== undefined) S.info.nama = n;
    S._idem = S._idem || ('I' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    await CF.busy(el, async () => {
      const r = await CF.api('pesanan.buat', { t: tok(), items: itemsPayload(), promo: S.promo ? S.promo.kode : '', nama: S.info.nama, kontak: S.info.kontak, email: S.info.email, catatan: S.info.catatan || '', tamu: S.info.tamu, idem: S._idem });
      if (!r.ok) {
        if (r.error.kode === 'SESI_TUTUP') { S.meja.aktif = false; }
        if (/STOK|HABIS|MENU|OPSI/.test(r.error.kode)) loadBoot().then(rerender);
        if (r.error.kode !== 'NET') S._idem = null;
        return CF.err(r);
      }
      S._idem = null;
      mergeOrders([r.data]); S.cart = []; S.promo = null; S.info.catatan = ''; saveCart(); CF.store.set('cinfo', S.info);
      if (S._sheet) { S._sheet.close(); S._sheet = null; }
      CF.toast(r.msg, 'ok'); CF.sound.beep();
      go('bayar/' + r.data.id);
    });
  };
  A.pilihMetode = el => { const x = metodeTersedia().filter(m => m.id === el.dataset.g)[0]; if (!x) return; S.selMetode = { g: x.id, m: x.subs ? x.subs[0][0] : x.id }; rerender(); };
  A.pilihSub = (el, e) => { e.stopPropagation(); S.selMetode.m = el.dataset.m; rerender(); };
  A.bayar = async el => {
    const o = orderById(el.dataset.id); if (!o || !S.selMetode) return;
    await CF.busy(el, async () => {
      const r = await CF.api('bayar.buat', { id: o.id, k: o.k, metode: S.selMetode.m });
      if (!r.ok) return CF.err(r);
      if (r.data.lunas) { await refreshStatus(true); return go('status'); }
      S.trx[o.id] = r.data.trx; o.trx = r.data.trx; o.sb = 'menunggu'; o.met = r.data.trx.met;
      if (r.data.trx.met === 'kasir') { CF.toast('Silakan bayar di kasir dengan menyebut nomor ' + o.np + '.', 'ok', 7000); await refreshStatus(true); return go('status'); }
      go('instruksi/' + o.id);
    });
  };
  A.cekBayar = async el => { const o = orderById(el.dataset.id); if (o) await CF.busy(el, () => cekBayar(o, false)); };
  A.fokusUpload = () => { const b = document.getElementById('upload-box'); if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => { const i = document.getElementById('bukti-in'); if (i) i.click(); }, 400); } };
  A.salin = el => CF.copy(el.dataset.v, 'Disalin: ' + el.dataset.v);
  A.unduhQr = () => { const o = orderById(route().id), t = o && (S.trx[o.id] || o.trx); if (!t || !t.info.qrs) return; const c = CFQR.canvas(t.info.qrs, 720); const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'QRIS-' + o.id + '.png'; a.click(); };
  A.segarkan = el => CF.busy(el, () => refreshStatus(true));
  A.panggilPelayan = async el => { await CF.busy(el, async () => { const r = await CF.api('meja.panggilPelayan', { t: tok() }); r.ok ? CF.toast(r.msg, 'ok') : CF.err(r); }); };
  A.cetak = el => {
    const o = orderById(el.dataset.id); if (!o) return;
    const pa = document.getElementById('print-area'); pa.innerHTML = '<div style="max-width:420px;margin:0 auto">' + receiptHtml(o) + '</div>';
    document.body.classList.add('print-receipt'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-receipt'), 500); }, 50);
  };
  A.pdf = async el => { const o = orderById(el.dataset.id); if (!o) return; await CF.busy(el, async () => { const r = await CF.api('struk.pdf', { id: o.id, k: o.k }, { timeout: 60000 }); r.ok ? CF.download(r.data.nama, r.data.b64, 'application/pdf') : CF.err(r); }); };

  // Detail menu & opsi (bottom sheet di HP)
  function openDetail(m) {
    const disc = m.coret > m.harga ? Math.round((1 - m.harga / m.coret) * 100) : 0, ok = canOrder() && m.ada;
    const st = { o: [], q: 1, c: '' };
    m.opsi.forEach(g => { if (g.wajib && g.maks === 1 && g.pilihan[0]) st.o.push(g.pilihan[0].id); });
    const harga = () => (m.harga + m.opsi.reduce((a, g) => a + g.pilihan.filter(p => st.o.indexOf(p.id) > -1).reduce((x, p) => x + p.harga, 0), 0)) * st.q;
    const groups = () => m.opsi.map(g => '<div class="grp-head">' + ic(g.wajib ? 'flame' : 'plus', 'sm') + '<span class="grow">' + esc(g.nama) + '</span><span class="badge ' + (g.wajib ? 'b-red' : 'b-neutral') + '">' + (g.wajib ? 'Wajib ' + g.maks : 'Opsional' + (g.maks > 1 ? ' • maks ' + g.maks : '')) + '</span></div><div class="col">' +
      g.pilihan.map(p => { const on = st.o.indexOf(p.id) > -1; return '<label class="opt' + (g.maks > 1 || !g.wajib ? ' multi' : '') + (on ? ' on' : '') + '" data-g="' + g.id + '" data-p="' + p.id + '"><input type="' + (g.maks === 1 && g.wajib ? 'radio' : 'checkbox') + '" name="' + g.id + '"' + (on ? ' checked' : '') + '><span class="mark"></span><span class="grow"><span class="semi">' + esc(p.nama) + '</span>' + (p.ket ? '<span class="small faint" style="display:block">' + esc(p.ket) + '</span>' : '') + '</span><span class="small ' + (p.harga ? 'red semi' : 'faint') + '">' + (p.harga ? '+' + rp(p.harga) : 'Gratis') + '</span></label>'; }).join('') + '</div>').join('');
    const md = CF.modal({ title: 'Detail Menu & Opsi', size: 'lg',
      body: '<div class="det-media">' + CF.img(m.foto, m.nama) + (m.stok !== null && m.ada ? '<span class="tl badge b-white"><span class="dot" style="color:var(--green)"></span>Tersedia: ' + m.stok + '</span>' : !m.ada ? '<span class="tl badge b-dark">Habis</span>' : '') + (disc ? '<span class="tr badge b-solid-orange">' + ic('flame', 'sm') + '-' + disc + '% Hemat</span>' : '') + '</div>' +
        '<h2 class="mt-16" style="font-size:24px">' + esc(m.nama) + '</h2><div class="row mt-4"><span class="price" style="font-size:22px">' + rp(m.harga) + '</span>' + (disc ? '<span class="strike">' + rp(m.coret) + '</span>' : '') + '</div>' +
        (m.desk ? '<p class="muted mt-8">' + esc(m.desk) + '</p>' : '') + '<div id="d-opsi">' + groups() + '</div>' +
        (ok ? '<div class="grp-head">' + ic('note', 'sm') + '<span class="grow">Catatan Khusus untuk Dapur</span><span class="xs faint" id="d-cnt">0/150</span></div><textarea class="textarea" id="d-note" maxlength="150" placeholder="mis. tanpa daun bawang, saus dipisah…" style="min-height:76px"></textarea>' +
          '<div class="quick-notes">' + ['Saus dipisah', 'Tanpa daun bawang', 'Kurang pedas', 'Kurang manis', 'Es sedikit', 'Tanpa es'].map(t => '<button type="button" data-q="' + t + '">+ ' + t + '</button>').join('') + '</div>' +
          '<div class="qty-box"><div><div class="semi">Atur Jumlah Porsi</div><div class="small faint">Porsi pesanan meja ' + esc(mejaNo()) + '</div></div><div class="stepper lg" style="background:transparent;border:0"><button type="button" id="d-min" style="background:#fff;border:1px solid var(--border)" aria-label="Kurangi">' + ic('minus') + '</button><span class="v" id="d-q">1</span><button type="button" class="plus" id="d-plus" aria-label="Tambah">' + ic('plus') + '</button></div></div>' : ''),
      foot: ok ? '<button class="btn btn-soft btn-lg" data-x>Batal</button><button class="btn btn-primary btn-lg grow" id="d-add" style="justify-content:space-between"><span>Tambah ke Pesanan</span><span id="d-h" class="tnum">' + rp(harga()) + '</span></button>'
        : '<button class="btn btn-secondary btn-lg btn-block" data-x>' + (m.ada ? (S.kode ? 'Meja belum aktif — tutup' : 'Tutup') : 'Menu sedang habis') + '</button>' });
    const upd = () => { const h = md.$('#d-h'); if (h) h.textContent = rp(harga()); const q = md.$('#d-q'); if (q) q.textContent = st.q; };
    md.el.addEventListener('click', e => {
      const lab = e.target.closest('.opt'); if (lab && ok) {
        e.preventDefault();
        const g = m.opsi.filter(x => x.id === lab.dataset.g)[0], pid = lab.dataset.p, on = st.o.indexOf(pid) > -1;
        if (g.maks === 1 && g.wajib) { st.o = st.o.filter(id => !g.pilihan.some(p => p.id === id)); st.o.push(pid); }
        else if (on) st.o = st.o.filter(id => id !== pid);
        else { const n = st.o.filter(id => g.pilihan.some(p => p.id === id)).length; if (n >= g.maks) return CF.toast('Maksimal ' + g.maks + ' pilihan untuk ' + g.nama + '.', 'warn'); st.o.push(pid); }
        md.$('#d-opsi').innerHTML = groups(); upd();
      }
      const qn = e.target.closest('[data-q]'); if (qn) { const t = md.$('#d-note'); t.value = (t.value ? t.value.replace(/[,\s]+$/, '') + ', ' : '') + qn.dataset.q.toLowerCase(); t.dispatchEvent(new Event('input')); }
    });
    if (!ok) return;
    md.$('#d-note').oninput = () => { md.$('#d-cnt').textContent = md.$('#d-note').value.length + '/150'; };
    md.$('#d-min').onclick = () => { st.q = Math.max(1, st.q - 1); upd(); };
    md.$('#d-plus').onclick = () => { if (m.stok !== null && qtyOf(m.id) + st.q + 1 > m.stok) return CF.toast('Stok tinggal ' + m.stok + ' porsi.', 'warn'); st.q = Math.min(50, st.q + 1); upd(); };
    md.$('#d-add').onclick = () => {
      const miss = m.opsi.filter(g => g.wajib && !g.pilihan.some(p => st.o.indexOf(p.id) > -1));
      if (miss.length) return CF.toast('Pilih "' + miss[0].nama + '" dulu.', 'warn');
      if (addLine(m.id, st.o, md.$('#d-note').value.trim(), st.q)) { md.close(); updateOrderUI(); CF.toast(st.q + '× ' + m.nama + ' ditambahkan.', 'ok', 2000); }
    };
  }

  // ------------------------------------------------------------------
  // Pop-up sambutan — sekali per hari per meja (atau per HP untuk Price List)
  // ------------------------------------------------------------------
  const sambutKey = () => 'sambut_' + (S.kode || 'pl') + '_' + CF.isoHari();
  function bukaSambut() {
    const st = set();
    if (!S.boot || !('sambutan_aktif' in st) || st.sambutan_aktif === 'N' || document.getElementById('welcome') || CF.store.get(sambutKey(), 0)) return;
    if (P.get('o') || /^#\/?(bayar|instruksi|status|struk)/.test(location.hash)) return;   // kembali dari e-wallet / tautan langsung
    const el = document.createElement('div');
    el.id = 'welcome'; el.className = 'welcome'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'wl-t');
    el.innerHTML = CF.welcomeCard(st, { meja: mejaNo(), promo: (S.boot.promo || [])[0] || null, mode: S.kode ? 'meja' : 'pl', showMenu: st.pricelist_tampil_menu !== 'N' });
    el.addEventListener('click', e => { if (e.target === el) tutupSambut(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') tutupSambut();
      if (e.key === 'Tab') { const f = el.querySelectorAll('button'), a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    document.body.appendChild(el); document.body.classList.add('no-scroll');
    setTimeout(() => { const b = el.querySelector('.wl-choice'); if (b) b.focus({ preventScroll: true }); }, 500);
  }
  function sambutMeja() {   // nomor meja baru diketahui setelah server menjawab
    const h = document.querySelector('#welcome .wl-hero');
    if (h && mejaNo() && !h.querySelector('.wl-pill')) h.insertAdjacentHTML('afterbegin', '<span class="wl-pill">' + ic('qr', 'sm') + 'Meja ' + esc(mejaNo()) + '</span>');
  }
  function tutupSambut(h, g) {
    CF.store.set(sambutKey(), 1);
    const el = document.getElementById('welcome'); if (!el) return;
    el.classList.add('out'); document.body.classList.remove('no-scroll');
    setTimeout(() => el.remove(), 260);
    if (g) { S.plGrup = g; S.q = ''; }
    if (h) go(h);
  }
  A.sambut = el => tutupSambut(el.dataset.h, el.dataset.g);

  // ------------------------------------------------------------------
  // Mulai
  // ------------------------------------------------------------------
  async function start() {
    if (S.boot) CF.applyTheme(S.boot.set);
    rerender();
    bukaSambut();
    const jobs = [loadBoot().then(() => { if (set().sambutan_aktif === 'N') { const w = document.getElementById('welcome'); if (w) { w.remove(); document.body.classList.remove('no-scroll'); } } else bukaSambut(); })];
    const oParam = P.get('o'), kParam = P.get('k');
    if (oParam && kParam && !S.my.some(x => x.id === oParam)) { S.my.push({ id: oParam, k: kParam, at: Date.now() }); saveMy(); }
    if (S.kode) {
      const cached = CF.ss.get('mt_' + S.kode);
      if (cached && cached.t && Date.now() - cached.at < 20 * 3600e3) S.meja = { id: cached.id, no: cached.no, aktif: true, t: cached.t };
      jobs.push(cached && cached.t ? refreshStatus(true).then(() => { if (!S.meja.aktif) return masuk(); }) : masuk().then(() => (S.meja && S.meja.t ? refreshStatus(true) : null)));
    } else if (S.my.length) jobs.push(refreshStatus(true));
    await Promise.all(jobs);
    sambutMeja();
    if (oParam) { const o = await ensureOrder(oParam); if (o) { const r = await CF.api('bayar.cek', { id: o.id, k: o.k }); if (r.ok) mergeOrders([r.data]); history.replaceState(null, '', location.pathname + (S.kode ? '?m=' + S.kode : '') + '#' + (r.ok && r.data.sb === 'lunas' ? 'struk/' : 'status') + '/' + o.id); } }
    rerender();
    // Polling: status pesanan (adaptif) & cek aktivasi meja
    CF.poll('status', async () => { if (tok() || (S.my.length && route().v === 'status')) await refreshStatus(); }, 8000, 30000);
    CF.poll('meja', async () => { if (S.kode && S.meja && !S.meja.aktif && !S.meja.perluPin && !S.meja.err) { await masuk(); if (canOrder()) { CF.toast('Meja Anda sudah aktif. Selamat memesan!', 'ok'); await refreshStatus(true); rerender(); } } }, 15000, 45000);
    CF.poll('boot', async () => { const v = JSON.stringify(S.boot && S.boot.menu.map(m => m.ada + ':' + m.stok)); await loadBoot(); if (route().v === 'menu' && JSON.stringify(S.boot.menu.map(m => m.ada + ':' + m.stok)) !== v) updateOrderUI(); }, 60000, 180000);
  }
  window.addEventListener('hashchange', rerender);
  mq.addEventListener('change', rerender);
  start();
})();
