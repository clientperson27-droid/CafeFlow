/* =====================================================================
   CafeFlow — Panel Admin/Owner (mendaftar halaman ke CF.pages)
   ===================================================================== */
(function () {
  'use strict';
  if (!CF.configOk || !CF.pages) return;
  const esc = CF.esc, rp = CF.rp, ic = CF.ic, ST = CF.st;
  const page = (k, d) => { CF.pages[k] = Object.assign({ roles: ['admin'] }, d); };
  const A = CF.acts;
  const val = (m, s) => { const e = m.$ ? m.$(s) : document.querySelector(s); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };
  const empty = (icn, t, d, btn) => '<div class="card"><div class="empty"><div class="art">' + ic(icn) + '</div><h4>' + esc(t) + '</h4><p>' + esc(d || '') + '</p>' + (btn || '') + '</div></div>';
  const skel = n => '<div class="col">' + '<div class="skel" style="height:56px"></div>'.repeat(n || 6) + '</div>';
  const kpi = (k, v, i, c, d, sm) => '<div class="kpi"><div class="k"><span class="ib ' + (c || '') + '">' + ic(i, 'sm') + '</span>' + k + '</div><div class="v' + (sm ? ' sm' : '') + '">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>';
  const baseUrl = () => { const u = (CF._set && CF._set.url_frontend) || ''; return (u || (location.origin + location.pathname.replace(/[^/]*$/, ''))).replace(/\/+$/, '') + '/'; };
  CF.baseUrl = baseUrl;
  const sw = (k, on, label) => '<label class="switch"><input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + '><span class="tr"></span>' + label + '</label>';
  async function load(action, data, el, fn) {
    const r = await CF.apiQ(action, data || {});
    if (!r.ok) { if (el) el.innerHTML = '<div class="banner danger">' + ic('alert') + '<div>' + esc(r.error.pesan) + '</div></div>'; return null; }
    if (fn) fn(r.data); return r.data;
  }
  // Unggah gambar: kompres di browser → Drive (publik) → URL thumbnail
  async function uploadImg(file, jenis, opt) {
    const img = await CF.fileToB64(file, Object.assign({ max: 1000, maxBytes: 300000 }, opt || {}));
    const r = await CF.api('upload.gambar', { jenis: jenis, file: { type: img.type, b64: img.b64 } }, { timeout: 60000 });
    if (!r.ok) throw new Error(r.error.pesan);
    if (r.msg && !r.data.publik) CF.toast(r.msg, 'warn', 8000);
    return { url: r.data.url, preview: img.preview };
  }
  function dropzone(id, label, url) {
    return '<label class="dropzone" for="' + id + '" id="' + id + '-dz">' + (url ? '<img src="' + esc(url) + '" alt="" style="max-height:120px;border-radius:12px">' : ic('upload', 'lg')) + '<b>' + esc(label) + '</b><span class="small">JPG, PNG, WebP • dikompres otomatis</span><input type="file" id="' + id + '" accept="image/jpeg,image/png,image/webp" class="sr-only"></label>';
  }
  function bindDrop(m, id, jenis, onUrl, opt) {
    const inp = m.$('#' + id), dz = m.$('#' + id + '-dz');
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('drag')));
    dz.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) go(e.dataTransfer.files[0]); });
    inp.onchange = () => inp.files[0] && go(inp.files[0]);
    async function go(f) {
      dz.innerHTML = '<span class="spin" style="width:22px;height:22px;border:2px solid var(--primary);border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></span><b>Mengunggah…</b>';
      try { const r = await uploadImg(f, jenis, opt); dz.innerHTML = '<img src="' + r.preview + '" alt="" style="max-height:120px;border-radius:12px"><b>Terunggah</b><span class="small">Klik untuk ganti</span>'; dz.appendChild(inp); onUrl(r.url, r.preview); }
      catch (e) { CF.toast(e.message, 'err'); dz.innerHTML = ic('upload', 'lg') + '<b>Coba lagi</b>'; dz.appendChild(inp); }
    }
  }
  function pager(total, pg, per, act) {
    const n = Math.max(1, Math.ceil(total / per)); if (n <= 1) return '<div class="pager"><span>' + total + ' data</span></div>';
    const pages = []; for (let i = Math.max(1, pg - 2); i <= Math.min(n, pg + 2); i++) pages.push(i);
    return '<div class="pager"><span>Menampilkan ' + ((pg - 1) * per + 1) + '–' + Math.min(total, pg * per) + ' dari ' + total + '</span><div class="pages"><button data-act="' + act + '" data-p="' + (pg - 1) + '"' + (pg <= 1 ? ' disabled' : '') + ' aria-label="Sebelumnya">' + ic('left', 'sm') + '</button>' +
      pages.map(i => '<button class="' + (i === pg ? 'on' : '') + '" data-act="' + act + '" data-p="' + i + '">' + i + '</button>').join('') + '<button data-act="' + act + '" data-p="' + (pg + 1) + '"' + (pg >= n ? ' disabled' : '') + ' aria-label="Berikutnya">' + ic('right', 'sm') + '</button></div></div>';
  }
  const parseOpsi = txt => { const out = []; let g = null; String(txt || '').split(/\r?\n/).forEach(l => { l = l.trim(); if (!l) return; if (l[0] === '#') { const p = l.slice(1).split('|').map(s => s.trim()); g = { nama: p[0], wajib: /wajib/i.test(p[1] || ''), maks: Number(p[2]) || (/wajib/i.test(p[1] || '') ? 1 : 3), p: [] }; out.push(g); } else if (g) { const p = l.split('|').map(s => s.trim()); g.p.push({ n: p[0], h: Number(String(p[1] || '0').replace(/\D/g, '')) || 0 }); } }); return out.filter(x => x.p.length); };

  // ==================================================================
  // DASHBOARD
  // ==================================================================
  let dashT = 0;
  page('dashboard', { title: 'Dashboard', icon: 'dashboard', sec: 'Ringkasan', live: true,
    render(el) {
      el.innerHTML = '<div class="kpis">' + '<div class="skel" style="height:104px;border-radius:16px"></div>'.repeat(7) + '</div><div class="dash-grid">' + '<div class="skel" style="height:280px;border-radius:16px"></div>'.repeat(4) + '</div>';
      this.load(el);
    },
    update(el) { if (Date.now() - dashT > 20000) this.load(el); },
    async load(el) {
      dashT = Date.now();
      const d = await load('admin.dashboard', {}, el); if (!d || ST.curPage !== 'dashboard') return;
      const K = d.kpi, jam = d.jam, h0 = Math.max(0, Math.min.apply(null, jam.map((v, i) => v ? i : 99).concat([10]))), h1 = Math.min(23, Math.max.apply(null, jam.map((v, i) => v ? i : 0).concat([22])));
      el.innerHTML = (d.aprv ? '<div class="banner warn">' + ic('approve') + '<div class="grow"><b>' + d.aprv + ' permintaan diskon</b> menunggu persetujuan Anda.</div><button class="btn btn-sm btn-secondary" data-act="nav" data-k="persetujuan">Tinjau</button></div>' : '') +
        '<div class="page-head"><div><div class="sub">' + CF.tgl(Date.now()) + ' • diperbarui ' + CF.jam(Date.now()) + '</div></div><button class="btn btn-secondary btn-sm" data-act="dashRefresh">' + ic('refresh', 'sm') + 'Segarkan</button></div>' +
        '<div class="kpis">' + kpi('Pendapatan hari ini', rp(K.pendapatan), 'trend', 'g', 'Dari pesanan lunas') + kpi('Pesanan hari ini', K.pesanan, 'receipt', '', K.belum ? K.belum + ' belum lunas' : 'Semua lunas') +
        kpi('Transaksi berhasil', K.lunas, 'checkC', 'g') + kpi('Rata-rata transaksi', rp(K.rata), 'wallet', 'b') +
        kpi('Menu terlaris', K.laris ? esc(K.laris[0]) : '-', 'star', '', K.laris ? K.laris[1] + ' porsi hari ini' : 'Belum ada', true) +
        kpi('Stok menipis', K.tipis, 'package', K.tipis ? 'r' : 'g', K.tipis ? 'Perlu belanja' : 'Aman') + kpi('Sedang diproses', K.diproses, 'chef', 'a', 'Pesanan aktif di dapur') + '</div>' +
        '<div class="dash-grid"><div class="card pad"><div class="card-title"><h3>Pendapatan 7 hari terakhir</h3><span class="small faint">' + rp(d.hari.reduce((a, x) => a + x.p, 0)) + '</span></div><div id="ch-rev"></div></div>' +
        '<div class="card pad"><div class="card-title"><h3>Metode pembayaran</h3><span class="small faint">' + (Object.keys(d.metode).length ? 'Hari ini' : '7 hari') + '</span></div><div id="ch-met"></div></div>' +
        '<div class="card pad"><div class="card-title"><h3>5 menu paling laris</h3><span class="small faint">7 hari</span></div><div id="ch-menu"></div></div>' +
        '<div class="card pad"><div class="card-title"><h3>Jam paling ramai</h3><span class="small faint">Jumlah pesanan, 7 hari</span></div><div id="ch-jam"></div></div>' +
        '<div class="card pad"><div class="card-title"><h3>Transaksi terbaru</h3><button class="btn btn-ghost btn-sm orange" data-act="nav" data-k="laporan">Lihat laporan</button></div>' + (d.terbaru.length ? '<div class="col">' + d.terbaru.map(t => '<div class="row between soft-box" style="padding:10px 12px"><span class="row"><b>' + esc(t.np) + '</b><span class="small faint">Meja ' + esc(t.mn || '-') + ' • ' + CF.jam(t.upd) + '</span></span><span class="row"><span class="badge b-neutral">' + esc(CF.LABEL_METODE[t.met] || t.met) + '</span><b class="tnum">' + rp(t.tot) + '</b></span></div>').join('') + '</div>' : '<p class="small faint">Belum ada transaksi lunas hari ini.</p>') + '</div>' +
        '<div class="card pad"><div class="card-title"><h3>Stok menipis</h3><button class="btn btn-ghost btn-sm orange" data-act="nav" data-k="stok">Kelola stok</button></div>' + (d.tipis.length ? '<div class="col">' + d.tipis.map(b => '<div class="row between soft-box" style="padding:10px 12px"><span class="row">' + ic(b.menu ? 'utensils' : 'package', 'sm') + '<b>' + esc(b.nama) + '</b></span><span class="badge b-red">' + CF.num(b.stok) + ' ' + esc(b.satuan) + (b.menu ? '' : ' / min ' + CF.num(b.min)) + '</span></div>').join('') + '</div>' : '<p class="small faint">Semua stok aman.</p>') + '</div></div>';
      const dLbl = t => { const p = t.split('-'); return p[2] + '/' + p[1]; };
      CFChart.area(el.querySelector('#ch-rev'), d.hari.map(x => ({ label: dLbl(x.t), full: CF.tgl(Date.parse(x.t + 'T12:00:00+07:00')), v: x.p, extra: x.n + ' pesanan' })), { fmt: rp, title: 'Pendapatan 7 hari' });
      const met = Object.keys(d.metode).length ? d.metode : d.metode7;
      CFChart.hbar(el.querySelector('#ch-met'), Object.keys(met).map(k => ({ label: CF.LABEL_METODE[k] || k, v: met[k] })).sort((a, b) => b.v - a.v), { fmt: rp, title: 'Metode pembayaran' });
      CFChart.hbar(el.querySelector('#ch-menu'), d.menu7.map(m => ({ label: m[0], v: m[1] })), { fmt: v => v + ' porsi', title: 'Menu terlaris' });
      CFChart.col(el.querySelector('#ch-jam'), jam.slice(h0, h1 + 1).map((v, i) => ({ label: String(h0 + i).padStart(2, '0'), full: 'Pukul ' + String(h0 + i).padStart(2, '0') + '.00–' + String(h0 + i).padStart(2, '0') + '.59', v: v })), { fmt: v => v + ' pesanan', title: 'Jam ramai' });
    } });
  A.dashRefresh = () => { dashT = 0; CF.renderPage(); };

  // ==================================================================
  // MENU & KATEGORI
  // ==================================================================
  const MN = { tab: 'menu', q: '', kat: '', st: 'aktif', data: null };
  page('menu', { title: 'Menu & Kategori', icon: 'utensils', sec: 'Manajemen',
    async render(el) {
      if (!MN.data) el.innerHTML = skel(8);
      const d = await load('menu.adminList', MN._fresh ? { _fresh: true } : {}, el); MN._fresh = false; if (!d) return; MN.data = d; this.draw(el);
    },
    draw(el) {
      const d = MN.data, katName = id => (d.kat.filter(k => k.id === id)[0] || {}).nama || '—';
      const head = '<div class="tabs"><button class="' + (MN.tab === 'menu' ? 'on' : '') + '" data-act="mnTab" data-t="menu">' + ic('utensils', 'sm') + 'Menu (' + d.menu.length + ')</button><button class="' + (MN.tab === 'kat' ? 'on' : '') + '" data-act="mnTab" data-t="kat">' + ic('layers', 'sm') + 'Kategori (' + d.kat.length + ')</button></div>';
      if (MN.tab === 'kat') {
        el.innerHTML = head + '<div class="page-head"><span class="sub">Urutan kategori = urutan tombol di halaman pelanggan.</span><button class="btn btn-primary" data-act="katForm">' + ic('plus', 'sm') + 'Tambah Kategori</button></div>' +
          '<div class="table-wrap"><table class="tbl"><thead><tr><th style="width:90px">Urutan</th><th>Nama</th><th class="num">Jumlah menu</th><th>Status</th><th></th></tr></thead><tbody>' + d.kat.map((k, i) => '<tr><td><div class="row" style="gap:2px"><button class="btn btn-ghost btn-icon btn-sm" data-act="katUrut" data-i="' + i + '" data-d="-1"' + (i ? '' : ' disabled') + ' aria-label="Naik">' + ic('up', 'sm') + '</button><button class="btn btn-ghost btn-icon btn-sm" data-act="katUrut" data-i="' + i + '" data-d="1"' + (i < d.kat.length - 1 ? '' : ' disabled') + ' aria-label="Turun">' + ic('down', 'sm') + '</button></div></td><td><b>' + esc(k.nama) + '</b></td><td class="num">' + d.menu.filter(m => m.kat === k.id && m.status === 'aktif').length + '</td><td>' + (k.status === 'aktif' ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-neutral">Nonaktif</span>') + '</td><td class="acts"><button class="btn btn-ghost btn-sm" data-act="katForm" data-id="' + k.id + '">' + ic('edit', 'sm') + 'Ubah</button></td></tr>').join('') + '</tbody></table></div>';
        return;
      }
      const q = MN.q.toLowerCase(), list = d.menu.filter(m => (!MN.kat || m.kat === MN.kat) && (MN.st === 'semua' || m.status === MN.st) && (!q || m.nama.toLowerCase().indexOf(q) > -1));
      el.innerHTML = head + '<div class="page-head"><div class="filters"><div class="search"><input class="input" id="mn-q" type="search" placeholder="Cari menu…" value="' + esc(MN.q) + '" aria-label="Cari menu">' + ic('search') + '</div>' +
        '<select class="select" id="mn-kat" aria-label="Kategori"><option value="">Semua kategori</option>' + d.kat.map(k => '<option value="' + k.id + '"' + (MN.kat === k.id ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join('') + '</select>' +
        '<select class="select" id="mn-st" aria-label="Status"><option value="aktif"' + (MN.st === 'aktif' ? ' selected' : '') + '>Aktif</option><option value="arsip"' + (MN.st === 'arsip' ? ' selected' : '') + '>Diarsipkan</option><option value="semua"' + (MN.st === 'semua' ? ' selected' : '') + '>Semua</option></select></div>' +
        '<div class="row"><button class="btn btn-secondary" data-act="mnRefresh" title="Baca ulang dari Google Sheets">' + ic('refresh', 'sm') + '</button><button class="btn btn-primary" data-act="menuForm">' + ic('plus', 'sm') + 'Tambah Menu</button></div></div>' +
        (list.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Harga</th><th class="num">Stok</th><th>Tersedia</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(m => '<tr><td><div class="row"><div class="thumb" style="overflow:hidden">' + CF.img(m.foto, m.nama) + '</div><div><b>' + esc(m.nama) + '</b>' + (m.unggul ? ' <span class="badge b-orange">' + ic('star', 'sm') + 'Favorit</span>' : '') + (m.opsi ? ' <span class="badge b-neutral">opsi</span>' : '') + '<div class="small faint clamp2" style="max-width:340px">' + esc(m.desk) + '</div></div></div></td>' +
          '<td>' + esc(katName(m.kat)) + '</td><td class="num"><b>' + rp(m.harga) + '</b>' + (m.coret > m.harga ? '<div class="strike">' + rp(m.coret) + '</div>' : '') + '</td><td class="num">' + (m.stok === '' ? '<span class="faint">∞</span>' : m.stok) + '</td>' +
          '<td><label class="switch"><input type="checkbox" data-act2="mnAda" data-id="' + m.id + '"' + (m.tersedia ? ' checked' : '') + '><span class="tr"></span></label></td><td>' + (m.status === 'aktif' ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-neutral">Arsip</span>') + '</td>' +
          '<td class="acts"><button class="btn btn-ghost btn-sm" data-act="menuForm" data-id="' + m.id + '">' + ic('edit', 'sm') + 'Ubah</button><button class="btn btn-ghost btn-sm" data-act="menuArsip" data-id="' + m.id + '">' + ic('archive', 'sm') + (m.status === 'aktif' ? 'Arsip' : 'Aktifkan') + '</button></td></tr>').join('') + '</tbody></table></div>'
          : empty('utensils', 'Belum ada menu', 'Tambah menu pertama Anda atau ubah filter.'));
      const qi = el.querySelector('#mn-q'); qi.oninput = CF.debounce(() => { MN.q = qi.value; this.draw(el); const n = document.getElementById('mn-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200);
      el.querySelector('#mn-kat').onchange = e => { MN.kat = e.target.value; this.draw(el); };
      el.querySelector('#mn-st').onchange = e => { MN.st = e.target.value; this.draw(el); };
      el.querySelectorAll('[data-act2=mnAda]').forEach(c => c.onchange = async () => { const r = await CF.api('menu.ketersediaan', { id: c.dataset.id, tersedia: c.checked }); if (!r.ok) { c.checked = !c.checked; return CF.err(r); } CF.toast(r.msg, 'ok', 2000); const m = MN.data.menu.filter(x => x.id === c.dataset.id)[0]; if (m) m.tersedia = c.checked; });
    } });
  A.mnTab = el => { MN.tab = el.dataset.t; CF.pages.menu.draw(document.getElementById('page')); };
  A.mnRefresh = () => { MN._fresh = true; CF.renderPage(); };
  A.menuArsip = async el => { const m = MN.data.menu.filter(x => x.id === el.dataset.id)[0]; const r = await CF.api('menu.arsip', { id: m.id, arsip: m.status === 'aktif' }); if (!r.ok) return CF.err(r); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  A.menuForm = el => {
    const d = MN.data, m = d.menu.filter(x => x.id === el.dataset.id)[0] || { kat: (d.kat[0] || {}).id, tersedia: true, stok: '', opsi: '' };
    let foto = m.foto || '';
    const md = CF.modal({ title: m.id ? 'Ubah Menu' : 'Tambah Menu', size: 'lg',
      body: '<div class="grid-form"><div class="field full"><label class="label" for="f-nama">Nama menu <span class="req">*</span></label><input class="input" id="f-nama" value="' + esc(m.nama || '') + '" maxlength="80"></div>' +
        '<div class="field"><label class="label" for="f-kat">Kategori</label><select class="select" id="f-kat">' + d.kat.map(k => '<option value="' + k.id + '"' + (k.id === m.kat ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="label" for="f-stok">Stok porsi</label><input class="input" id="f-stok" type="number" min="0" value="' + esc(m.stok) + '" placeholder="Kosong = tidak dibatasi"><span class="help">Berkurang otomatis setiap dipesan.</span></div>' +
        '<div class="field"><label class="label" for="f-harga">Harga jual (Rp) <span class="req">*</span></label><input class="input" id="f-harga" inputmode="numeric" value="' + (m.harga || '') + '"></div>' +
        '<div class="field"><label class="label" for="f-coret">Harga coret / normal (opsional)</label><input class="input" id="f-coret" inputmode="numeric" value="' + (m.coret || '') + '"><span class="help">Isi lebih besar dari harga jual → tampil di "Promo Hari Ini".</span></div>' +
        '<div class="field full"><label class="label" for="f-desk">Deskripsi</label><textarea class="textarea" id="f-desk" maxlength="400" style="min-height:70px">' + esc(m.desk || '') + '</textarea></div>' +
        '<div class="field"><span class="label">Foto</span>' + dropzone('f-foto', 'Pilih atau tarik foto', foto) + '<input class="input mt-8" id="f-fotourl" placeholder="…atau tempel URL gambar / link Google Drive" value="' + esc(foto) + '"></div>' +
        '<div class="col" style="gap:14px"><label class="switch"><input type="checkbox" id="f-ada"' + (m.tersedia ? ' checked' : '') + '><span class="tr"></span>Tersedia untuk dipesan</label><label class="switch"><input type="checkbox" id="f-unggul"' + (m.unggul ? ' checked' : '') + '><span class="tr"></span>Tandai sebagai Favorit</label>' +
        (m.id ? '<div class="field"><label class="label" for="f-alasan">Alasan perubahan harga (opsional)</label><input class="input" id="f-alasan" placeholder="Tercatat di activity log"></div>' : '') + '</div>' +
        '<div class="field full"><label class="label" for="f-opsi">Opsi & tambahan (opsional)</label><textarea class="textarea code" id="f-opsi" style="min-height:120px" placeholder="# Tingkat Kepedasan | wajib | 1\nLevel 0 – Original | 0\nLevel 2 – Ekstra Pedas | 3000\n# Topping | opsional | 3\nKeju | 5000">' + esc(m.opsi || '') + '</textarea>' +
        '<span class="help">Baris diawali <b>#</b> = grup: <span class="code"># Nama | wajib/opsional | maks pilihan</span>. Baris di bawahnya = pilihan: <span class="code">Nama | tambahan harga | keterangan</span>.</span><div id="f-opsi-prev" class="row wrap mt-8" style="gap:6px"></div></div></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="f-ok" data-loading="Menyimpan…">Simpan Menu</button>' });
    const prev = () => { md.$('#f-opsi-prev').innerHTML = parseOpsi(md.$('#f-opsi').value).map(g => '<span class="badge ' + (g.wajib ? 'b-red' : 'b-neutral') + '">' + esc(g.nama) + ': ' + g.p.map(p => esc(p.n) + (p.h ? ' +' + CF.num(p.h) : '')).join(' / ') + '</span>').join(''); };
    md.$('#f-opsi').oninput = prev; prev();
    bindDrop(md, 'f-foto', 'menu', u => { foto = u; md.$('#f-fotourl').value = u; });
    md.$('#f-ok').onclick = async () => {
      const r = await CF.busy(md.$('#f-ok'), () => CF.api('menu.simpan', { id: m.id || '', nama: val(md, '#f-nama'), kat: val(md, '#f-kat'), harga: Number(String(val(md, '#f-harga')).replace(/\D/g, '')), coret: Number(String(val(md, '#f-coret')).replace(/\D/g, '')) || 0,
        stok: val(md, '#f-stok'), desk: val(md, '#f-desk'), foto: val(md, '#f-fotourl'), tersedia: md.$('#f-ada').checked, unggul: md.$('#f-unggul').checked, opsi: val(md, '#f-opsi'), alasan: val(md, '#f-alasan') }));
      if (!r.ok) return CF.err(r);
      md.close(); CF.toast(r.msg, 'ok'); CF.renderPage();
    };
  };
  A.katForm = el => {
    const k = (MN.data.kat.filter(x => x.id === el.dataset.id)[0]) || { status: 'aktif' };
    const md = CF.modal({ title: k.id ? 'Ubah Kategori' : 'Tambah Kategori', size: 'sm', body: '<div class="field"><label class="label" for="k-nama">Nama kategori</label><input class="input" id="k-nama" value="' + esc(k.nama || '') + '" maxlength="40"></div>' + (k.id ? '<label class="switch mt-12"><input type="checkbox" id="k-on"' + (k.status === 'aktif' ? ' checked' : '') + '><span class="tr"></span>Aktif (tampil ke pelanggan)</label>' : ''),
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="k-ok">Simpan</button>' });
    md.$('#k-ok').onclick = async () => { const r = await CF.busy(md.$('#k-ok'), () => CF.api('kategori.simpan', { id: k.id || '', nama: val(md, '#k-nama'), status: !k.id || md.$('#k-on').checked ? 'aktif' : 'nonaktif' })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  };
  A.katUrut = async el => { const k = MN.data.kat.slice(), i = +el.dataset.i, j = i + Number(el.dataset.d); const t = k[i]; k[i] = k[j]; k[j] = t; MN.data.kat = k; CF.pages.menu.draw(document.getElementById('page')); const r = await CF.api('kategori.urut', { ids: k.map(x => x.id) }); if (!r.ok) CF.err(r); };

  // ==================================================================
  // PRICE LIST (layanan steam dll — hanya untuk dilihat pelanggan)
  // ==================================================================
  const PL = { data: null, q: '' };
  page('pricelist', { title: 'Price List', icon: 'tag', sec: 'Manajemen',
    async render(el) {
      if (!PL.data) el.innerHTML = skel(6);
      const d = await load('pricelist.adminList', {}, el); if (!d) return; PL.data = d;
      const url = baseUrl(), groups = []; d.forEach(p => { if (groups.indexOf(p.grup) === -1) groups.push(p.grup); });
      el.innerHTML = '<div class="dash-grid" style="grid-template-columns:minmax(0,2fr) minmax(260px,1fr)"><div class="banner info">' + ic('info') + '<div>Price list hanya untuk <b>dilihat</b> pelanggan (promosi cafe & steam) — tidak ada tombol pesan/bayar. Tampil di tab "Price List" setelah scan QR meja, dan lewat QR khusus di samping.</div></div>' +
        '<div class="card pad-s row" style="gap:12px"><div style="width:84px;flex:none">' + CFQR.svg(url, { border: 1 }) + '</div><div class="grow"><div class="semi">QR Price List</div><div class="xs faint ellipsis">' + esc(url) + '</div><div class="row mt-8" style="gap:6px"><button class="btn btn-sm btn-secondary" data-act="qrPl">' + ic('printer', 'sm') + 'Cetak</button><a class="btn btn-sm btn-ghost" href="' + esc(url) + '" target="_blank" rel="noopener">' + ic('ext', 'sm') + 'Buka</a></div></div></div></div>' +
        '<div class="page-head"><div class="filters"><div class="search"><input class="input" id="pl-q" type="search" placeholder="Cari layanan…" value="' + esc(PL.q) + '" aria-label="Cari">' + ic('search') + '</div></div><button class="btn btn-primary" data-act="plForm">' + ic('plus', 'sm') + 'Tambah Item</button></div>' +
        (d.length ? groups.map(g => { const list = d.filter(p => p.grup === g && (!PL.q || p.nama.toLowerCase().indexOf(PL.q.toLowerCase()) > -1)); if (!list.length) return ''; return '<h3 class="mt-8">' + esc(g) + '</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Layanan</th><th>Satuan</th><th class="num">Harga</th><th>Status</th><th></th></tr></thead><tbody>' +
          list.map(p => '<tr><td><div class="row"><div class="thumb" style="overflow:hidden">' + CF.img(p.foto, p.nama, true) + '</div><div><b>' + esc(p.nama) + '</b>' + (p.unggul ? ' <span class="badge b-orange">Favorit</span>' : '') + '<div class="small faint">' + esc(p.desk) + '</div></div></div></td><td>' + esc(p.satuan || '-') + '</td><td class="num"><b>' + rp(p.harga) + '</b>' + (p.coret > p.harga ? '<div class="strike">' + rp(p.coret) + '</div>' : '') + '</td><td>' + (p.status === 'aktif' ? '<span class="badge b-green">Tampil</span>' : '<span class="badge b-neutral">Arsip</span>') + '</td><td class="acts"><button class="btn btn-ghost btn-sm" data-act="plForm" data-id="' + p.id + '">' + ic('edit', 'sm') + 'Ubah</button></td></tr>').join('') + '</tbody></table></div>'; }).join('')
          : empty('tag', 'Price list masih kosong', 'Tambahkan layanan steam atau produk lain yang ingin dipromosikan.'));
      const qi = el.querySelector('#pl-q'); qi.oninput = CF.debounce(() => { PL.q = qi.value; this.render(el); }, 250);
    } });
  A.plForm = el => {
    const p = (PL.data || []).filter(x => x.id === el.dataset.id)[0] || { status: 'aktif', grup: '', satuan: 'per unit' };
    const groups = []; (PL.data || []).forEach(x => { if (groups.indexOf(x.grup) === -1) groups.push(x.grup); });
    const md = CF.modal({ title: p.id ? 'Ubah Item Price List' : 'Tambah Item Price List', size: 'lg',
      body: '<div class="grid-form"><div class="field"><label class="label" for="p-grup">Grup <span class="req">*</span></label><input class="input" id="p-grup" list="p-grups" value="' + esc(p.grup) + '" placeholder="mis. Steam Motor"><datalist id="p-grups">' + groups.map(g => '<option value="' + esc(g) + '">').join('') + '</datalist></div>' +
        '<div class="field"><label class="label" for="p-nama">Nama layanan <span class="req">*</span></label><input class="input" id="p-nama" value="' + esc(p.nama || '') + '"></div>' +
        '<div class="field"><label class="label" for="p-harga">Harga (Rp)</label><input class="input" id="p-harga" inputmode="numeric" value="' + (p.harga || '') + '"></div><div class="field"><label class="label" for="p-coret">Harga coret (opsional)</label><input class="input" id="p-coret" inputmode="numeric" value="' + (p.coret || '') + '"></div>' +
        '<div class="field"><label class="label" for="p-sat">Satuan</label><input class="input" id="p-sat" value="' + esc(p.satuan || '') + '" placeholder="per unit / per pasang / per jam"></div><div class="col" style="justify-content:flex-end;gap:12px"><label class="switch"><input type="checkbox" id="p-ung"' + (p.unggul ? ' checked' : '') + '><span class="tr"></span>Favorit</label><label class="switch"><input type="checkbox" id="p-on"' + (p.status === 'aktif' ? ' checked' : '') + '><span class="tr"></span>Tampilkan</label></div>' +
        '<div class="field full"><label class="label" for="p-desk">Keterangan</label><input class="input" id="p-desk" value="' + esc(p.desk || '') + '"></div><div class="field full"><span class="label">Foto (opsional)</span>' + dropzone('p-foto', 'Pilih foto', p.foto) + '<input class="input mt-8" id="p-fotourl" value="' + esc(p.foto || '') + '" placeholder="…atau URL gambar"></div></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="p-ok">Simpan</button>' });
    bindDrop(md, 'p-foto', 'pricelist', u => { md.$('#p-fotourl').value = u; });
    md.$('#p-ok').onclick = async () => {
      const r = await CF.busy(md.$('#p-ok'), () => CF.api('pricelist.simpan', { id: p.id || '', grup: val(md, '#p-grup'), nama: val(md, '#p-nama'), harga: Number(String(val(md, '#p-harga')).replace(/\D/g, '')), coret: Number(String(val(md, '#p-coret')).replace(/\D/g, '')) || 0, satuan: val(md, '#p-sat'), desk: val(md, '#p-desk'), foto: val(md, '#p-fotourl'), unggul: md.$('#p-ung').checked, status: md.$('#p-on').checked ? 'aktif' : 'arsip' }));
      if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage();
    };
  };

  // ==================================================================
  // MEJA & QR CODE
  // ==================================================================
  const MJ = { data: null };
  function qrCanvas(url, judul, sub) {
    const set = (ST.boot && ST.boot.set) || {}, W = 600, H = 780, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    g.fillStyle = set.warna_primer || '#C2410C'; g.fillRect(0, 0, W, 14);
    g.textAlign = 'center'; g.fillStyle = '#1F2937'; g.font = '700 34px "Plus Jakarta Sans", Arial, sans-serif'; g.fillText(set.nama_aplikasi || 'CafeFlow', W / 2, 74);
    g.drawImage(CFQR.canvas(url, 460, { border: 2 }), 70, 104, 460, 460);
    g.font = '800 60px "Plus Jakarta Sans", Arial, sans-serif'; g.fillStyle = set.warna_primer || '#C2410C'; g.fillText(judul, W / 2, 650);
    g.font = '500 26px Inter, Arial, sans-serif'; g.fillStyle = '#4B5563'; g.fillText(sub, W / 2, 700);
    return c;
  }
  function printQr(items) {
    const pa = document.getElementById('print-area');
    pa.innerHTML = '<div class="qr-sheet">' + items.map(x => '<div class="qr-card"><img src="' + qrCanvas(x.url, x.judul, x.sub).toDataURL('image/png') + '" alt="" style="max-width:100%"></div>').join('') + '</div>';
    document.body.classList.add('print-qr'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-qr'), 500); }, 120);
  }
  A.qrPl = () => printQr([{ url: baseUrl(), judul: 'Price List', sub: 'Scan untuk melihat harga' }]);
  page('mejaqr', { title: 'Meja & QR Code', icon: 'qr', sec: 'Manajemen',
    async render(el) {
      if (!MJ.data) el.innerHTML = skel(8);
      const d = await load('meja.list', {}, el); if (!d) return; MJ.data = d; CF._set = Object.assign(CF._set || {}, { url_frontend: d.url });
      const url = baseUrl();
      el.innerHTML = (!d.url ? '<div class="banner warn">' + ic('info') + '<div>Alamat situs pelanggan belum diisi di <b>Pengaturan → Pembayaran & Situs</b>. QR memakai alamat saat ini: <span class="code">' + esc(url) + '</span></div></div>' : '') +
        '<div class="page-head"><span class="sub">Setiap QR unik & terhubung ke nomor meja. Ganti QR bila dicurigai tersebar.</span><div class="row"><button class="btn btn-secondary" data-act="qrAll">' + ic('printer', 'sm') + 'Cetak Semua QR</button><button class="btn btn-primary" data-act="mejaForm">' + ic('plus', 'sm') + 'Tambah Meja</button></div></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>QR</th><th>Meja</th><th class="num">Kapasitas</th><th>Status</th><th>Catatan</th><th></th></tr></thead><tbody>' + d.meja.map(m => '<tr><td><div style="width:64px">' + CFQR.svg(url + '?m=' + m.kode, { border: 1 }) + '</div></td><td><span class="head" style="font-size:20px;font-weight:800">' + esc(m.no) + '</span></td><td class="num">' + m.kap + '</td><td>' + (m.aktif ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-neutral">Nonaktif</span>') + '</td><td class="small faint">' + esc(m.cat) + '</td>' +
          '<td class="acts"><button class="btn btn-ghost btn-sm" data-act="qrPng" data-id="' + m.id + '">' + ic('download', 'sm') + 'PNG</button><button class="btn btn-ghost btn-sm" data-act="qrOne" data-id="' + m.id + '">' + ic('printer', 'sm') + 'Cetak</button><button class="btn btn-ghost btn-sm" data-act="qrRotasi" data-id="' + m.id + '">' + ic('refresh', 'sm') + 'Ganti QR</button><button class="btn btn-ghost btn-sm" data-act="mejaForm" data-id="' + m.id + '">' + ic('edit', 'sm') + 'Ubah</button></td></tr>').join('') + '</tbody></table></div>';
    } });
  const mejaItem = m => ({ url: baseUrl() + '?m=' + m.kode, judul: 'Meja ' + m.no, sub: 'Scan untuk memesan & bayar' });
  A.qrAll = () => printQr(MJ.data.meja.filter(m => m.aktif).map(mejaItem));
  A.qrOne = el => printQr([mejaItem(MJ.data.meja.filter(m => m.id === el.dataset.id)[0])]);
  A.qrPng = el => { const m = MJ.data.meja.filter(x => x.id === el.dataset.id)[0], it = mejaItem(m), a = document.createElement('a'); a.href = qrCanvas(it.url, it.judul, it.sub).toDataURL('image/png'); a.download = 'QR-Meja-' + m.no + '.png'; a.click(); };
  A.qrRotasi = async el => { const m = MJ.data.meja.filter(x => x.id === el.dataset.id)[0]; const a = await CF.confirm({ title: 'Ganti QR Meja ' + m.no + '?', danger: true, ok: 'Ganti QR', msg: 'QR lama langsung tidak berlaku. Cetak & tempel QR baru setelah ini.', input: { label: 'Alasan (opsional)' } }); if (a === false) return; const r = await CF.api('meja.rotasiQr', { id: m.id, alasan: a === true ? '' : a }); if (!r.ok) return CF.err(r); CF.toast(r.msg, 'ok', 7000); CF.renderPage(); };
  A.mejaForm = el => {
    const m = (MJ.data.meja.filter(x => x.id === el.dataset.id)[0]) || { kap: 4, aktif: true };
    const md = CF.modal({ title: m.id ? 'Ubah Meja ' + m.no : 'Tambah Meja', size: 'sm', body: '<div class="grid-form"><div class="field"><label class="label" for="mj-no">Nomor meja</label><input class="input" id="mj-no" value="' + esc(m.no || '') + '" placeholder="mis. 16 atau VIP-1"></div><div class="field"><label class="label" for="mj-kap">Kapasitas</label><input class="input" id="mj-kap" type="number" min="1" value="' + m.kap + '"></div><div class="field full"><label class="label" for="mj-cat">Catatan</label><input class="input" id="mj-cat" value="' + esc(m.cat || '') + '" placeholder="mis. area outdoor"></div><label class="switch full"><input type="checkbox" id="mj-on"' + (m.aktif ? ' checked' : '') + '><span class="tr"></span>Meja aktif</label></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="mj-ok">Simpan</button>' });
    md.$('#mj-ok').onclick = async () => { const r = await CF.busy(md.$('#mj-ok'), () => CF.api('meja.simpan', { id: m.id || '', no: val(md, '#mj-no'), kap: Number(val(md, '#mj-kap')), cat: val(md, '#mj-cat'), aktif: md.$('#mj-on').checked })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  };

  // ==================================================================
  // STOK BAHAN (admin + staf yang diberi izin pencatat stok)
  // ==================================================================
  const SK = { tab: 'daftar', data: null, hist: null, q: '', dari: '', sampai: '' };
  page('stok', { title: 'Stok Bahan', icon: 'package', sec: 'Manajemen', stok: true,
    async render(el) {
      const admin = CF.isRole('admin');
      const head = '<div class="tabs"><button class="' + (SK.tab === 'daftar' ? 'on' : '') + '" data-act="skTab" data-t="daftar">' + ic('package', 'sm') + 'Daftar Stok</button><button class="' + (SK.tab === 'riwayat' ? 'on' : '') + '" data-act="skTab" data-t="riwayat">' + ic('history', 'sm') + 'Riwayat Mutasi</button></div>';
      if (SK.tab === 'riwayat') {
        if (!SK.dari) { SK.sampai = CF.isoHari(); SK.dari = CF.isoHari(Date.now() - 30 * 86400e3); }
        el.innerHTML = head + '<div class="filters"><input class="input" type="date" id="sk-d" value="' + SK.dari + '" style="width:auto" aria-label="Dari"><input class="input" type="date" id="sk-s" value="' + SK.sampai + '" style="width:auto" aria-label="Sampai"><div class="search"><input class="input" id="sk-q" type="search" placeholder="Cari bahan…" value="' + esc(SK.q) + '">' + ic('search') + '</div></div><div id="sk-h">' + skel(5) + '</div>';
        const draw = () => { const q = SK.q.toLowerCase(), l = (SK.hist || []).filter(h => !q || h.bahan.toLowerCase().indexOf(q) > -1); el.querySelector('#sk-h').innerHTML = l.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th class="num">Qty</th><th class="num">Stok akhir</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>' + l.map(h => '<tr><td class="tnum nowrap">' + CF.tglJam(h.waktu) + '</td><td><b>' + esc(h.bahan) + '</b></td><td><span class="badge ' + (h.tipe === 'masuk' ? 'b-green' : h.tipe === 'keluar' ? 'b-amber' : 'b-blue') + '">' + esc(h.tipe) + '</span></td><td class="num">' + (h.qty > 0 && h.tipe !== 'keluar' ? '+' : h.tipe === 'keluar' ? '−' : '') + CF.num(Math.abs(h.qty)) + '</td><td class="num">' + CF.num(h.akhir) + '</td><td class="small">' + esc(h.ket) + '</td><td class="small">' + esc(h.oleh) + '</td></tr>').join('') + '</tbody></table></div>' : empty('history', 'Belum ada mutasi', 'Pada periode ini.'); };
        const get = async () => { SK.hist = await load('stok.riwayat', { dari: SK.dari, sampai: SK.sampai }, el.querySelector('#sk-h')); if (SK.hist) draw(); };
        el.querySelector('#sk-d').onchange = e => { SK.dari = e.target.value; get(); }; el.querySelector('#sk-s').onchange = e => { SK.sampai = e.target.value; get(); };
        el.querySelector('#sk-q').oninput = CF.debounce(e => { SK.q = el.querySelector('#sk-q').value; draw(); }, 200);
        return get();
      }
      if (!SK.data) el.innerHTML = head + skel(6);
      const d = await load('stok.list', {}, el); if (!d) return; SK.data = d;
      const low = d.filter(b => b.status === 'aktif' && b.stok <= b.min);
      el.innerHTML = head + (low.length ? '<div class="banner warn">' + ic('alert') + '<div><b>' + low.length + ' bahan menipis:</b> ' + low.map(b => esc(b.nama)).join(', ') + '</div></div>' : '') +
        '<div class="page-head"><div class="search"><input class="input" id="sk-q2" type="search" placeholder="Cari bahan…" value="' + esc(SK.q) + '">' + ic('search') + '</div>' + (admin ? '<button class="btn btn-primary" data-act="bahanForm">' + ic('plus', 'sm') + 'Tambah Bahan</button>' : '') + '</div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Stok</th><th class="num">Minimum</th><th>Status</th><th></th></tr></thead><tbody>' + d.filter(b => !SK.q || b.nama.toLowerCase().indexOf(SK.q.toLowerCase()) > -1).map(b => '<tr><td><b>' + esc(b.nama) + '</b><div class="xs faint">diperbarui ' + (b.upd ? CF.lalu(b.upd) : '-') + '</div></td><td class="num"><b>' + CF.num(b.stok) + '</b> ' + esc(b.satuan) + '</td><td class="num">' + CF.num(b.min) + '</td><td>' + (b.status !== 'aktif' ? '<span class="badge b-neutral">Nonaktif</span>' : b.stok <= b.min ? '<span class="badge b-red">' + ic('alert', 'sm') + 'Menipis</span>' : '<span class="badge b-green">Aman</span>') + '</td>' +
          '<td class="acts"><button class="btn btn-ghost btn-sm" data-act="mutasi" data-id="' + b.id + '" data-t="masuk">' + ic('plus', 'sm') + 'Masuk</button><button class="btn btn-ghost btn-sm" data-act="mutasi" data-id="' + b.id + '" data-t="keluar">' + ic('minus', 'sm') + 'Keluar</button>' + (admin ? '<button class="btn btn-ghost btn-sm" data-act="mutasi" data-id="' + b.id + '" data-t="koreksi">' + ic('sliders', 'sm') + 'Koreksi</button><button class="btn btn-ghost btn-sm" data-act="bahanForm" data-id="' + b.id + '">' + ic('edit', 'sm') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
      el.querySelector('#sk-q2').oninput = CF.debounce(() => { SK.q = el.querySelector('#sk-q2').value; this.render(el); }, 300);
    } });
  A.skTab = el => { SK.tab = el.dataset.t; CF.renderPage(); };
  A.mutasi = el => {
    const b = SK.data.filter(x => x.id === el.dataset.id)[0], t = el.dataset.t;
    const md = CF.modal({ title: (t === 'masuk' ? 'Stok Masuk' : t === 'keluar' ? 'Stok Keluar' : 'Koreksi Stok') + ' — ' + b.nama, size: 'sm',
      body: '<div class="soft-box row between"><span>Stok saat ini</span><b>' + CF.num(b.stok) + ' ' + esc(b.satuan) + '</b></div><div class="field mt-12"><label class="label" for="mt-q">' + (t === 'koreksi' ? 'Stok akhir yang benar' : 'Jumlah (' + esc(b.satuan) + ')') + '</label><input class="input" id="mt-q" type="number" min="0" step="any"></div><div class="field mt-12"><label class="label" for="mt-k">Keterangan' + (t === 'koreksi' ? ' <span class="req">*</span>' : '') + '</label><input class="input" id="mt-k" placeholder="' + (t === 'masuk' ? 'mis. belanja pasar / supplier' : t === 'keluar' ? 'mis. pemakaian dapur' : 'mis. hasil stock opname') + '"></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="mt-ok">Simpan</button>' });
    md.$('#mt-ok').onclick = async () => { const r = await CF.busy(md.$('#mt-ok'), () => CF.api('stok.mutasi', { bahanId: b.id, tipe: t, qty: Number(val(md, '#mt-q')), ket: val(md, '#mt-k') })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  };
  A.bahanForm = el => {
    const b = (SK.data.filter(x => x.id === el.dataset.id)[0]) || { satuan: 'pcs', status: 'aktif' };
    const md = CF.modal({ title: b.id ? 'Ubah Bahan' : 'Tambah Bahan', size: 'sm', body: '<div class="grid-form"><div class="field full"><label class="label" for="bh-n">Nama bahan</label><input class="input" id="bh-n" value="' + esc(b.nama || '') + '"></div><div class="field"><label class="label" for="bh-s">Satuan</label><input class="input" id="bh-s" value="' + esc(b.satuan) + '" list="bh-sat"><datalist id="bh-sat"><option>gram</option><option>kg</option><option>liter</option><option>ml</option><option>pcs</option><option>butir</option><option>botol</option><option>pack</option></datalist></div>' +
      '<div class="field"><label class="label" for="bh-m">Stok minimum</label><input class="input" id="bh-m" type="number" min="0" step="any" value="' + (b.min || 0) + '"></div>' + (b.id ? '<label class="switch full"><input type="checkbox" id="bh-on"' + (b.status === 'aktif' ? ' checked' : '') + '><span class="tr"></span>Aktif</label>' : '<div class="field full"><label class="label" for="bh-st">Stok awal</label><input class="input" id="bh-st" type="number" min="0" step="any" value="0"></div>') + '</div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="bh-ok">Simpan</button>' });
    md.$('#bh-ok').onclick = async () => { const r = await CF.busy(md.$('#bh-ok'), () => CF.api('stok.simpan', { id: b.id || '', nama: val(md, '#bh-n'), satuan: val(md, '#bh-s'), min: Number(val(md, '#bh-m')), stok: Number(val(md, '#bh-st')) || 0, status: !b.id || md.$('#bh-on').checked ? 'aktif' : 'nonaktif' })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  };

  // ==================================================================
  // PROMO & VOUCHER
  // ==================================================================
  const PR = { data: null };
  page('promo', { title: 'Promo & Voucher', icon: 'percent', sec: 'Manajemen',
    async render(el) {
      if (!PR.data) el.innerHTML = skel(4);
      const d = await load('promo.list', {}, el); if (!d) return; PR.data = d;
      el.innerHTML = '<div class="page-head"><span class="sub">Promo dengan "Tampil" aktif muncul di halaman Price List. Kode bisa dipakai pelanggan saat memesan.</span><button class="btn btn-primary" data-act="promoForm">' + ic('plus', 'sm') + 'Tambah Promo</button></div>' +
        (d.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama</th><th>Diskon</th><th class="num">Min. belanja</th><th>Periode</th><th>Kuota</th><th>Status</th><th></th></tr></thead><tbody>' + d.map(p => {
          const pct = p.kuota ? Math.min(100, p.terpakai / p.kuota * 100) : 0;
          return '<tr><td><span class="code semi orange">' + esc(p.kode) + '</span></td><td>' + esc(p.nama) + (p.tampil ? ' <span class="badge b-blue">Tampil</span>' : '') + '</td><td><b>' + (p.tipe === 'persen' ? p.nilai + '%' : rp(p.nilai)) + '</b>' + (p.maks ? '<div class="xs faint">maks ' + rp(p.maks) + '</div>' : '') + '</td><td class="num">' + (p.min ? rp(p.min) : '-') + '</td><td class="small">' + (p.mulai || p.selesai ? esc((p.mulai || '…') + ' s.d. ' + (p.selesai || '…')) : 'Tanpa batas') + '</td>' +
            '<td style="min-width:120px"><div class="small">' + p.terpakai + (p.kuota ? ' / ' + p.kuota : ' dipakai') + '</div>' + (p.kuota ? '<div class="progress mt-4"><span style="width:' + pct + '%"></span></div>' : '') + '</td><td>' + (p.status === 'aktif' ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-neutral">Nonaktif</span>') + '</td><td class="acts"><button class="btn btn-ghost btn-sm" data-act="promoForm" data-id="' + p.id + '">' + ic('edit', 'sm') + 'Ubah</button></td></tr>';
        }).join('') + '</tbody></table></div>' : empty('percent', 'Belum ada promo', 'Buat kode promo untuk menarik pelanggan.'));
    } });
  A.promoForm = el => {
    const p = (PR.data.filter(x => x.id === el.dataset.id)[0]) || { tipe: 'persen', status: 'aktif', tampil: true };
    let tipe = p.tipe;
    const md = CF.modal({ title: p.id ? 'Ubah Promo' : 'Tambah Promo', size: 'lg', body: '<div class="grid-form"><div class="field"><label class="label" for="pr-k">Kode promo <span class="req">*</span></label><input class="input code" id="pr-k" value="' + esc(p.kode || '') + '" style="text-transform:uppercase" placeholder="HEMAT15"></div><div class="field"><label class="label" for="pr-n">Nama promo</label><input class="input" id="pr-n" value="' + esc(p.nama || '') + '"></div>' +
      '<div class="field"><span class="label">Jenis diskon</span><div class="seg"><button type="button" data-t="persen" class="' + (tipe === 'persen' ? 'on' : '') + '">Persen</button><button type="button" data-t="nominal" class="' + (tipe === 'nominal' ? 'on' : '') + '">Nominal</button></div></div><div class="field"><label class="label" for="pr-v">Nilai</label><input class="input" id="pr-v" inputmode="decimal" value="' + (p.nilai || '') + '"></div>' +
      '<div class="field"><label class="label" for="pr-min">Minimum belanja (Rp)</label><input class="input" id="pr-min" inputmode="numeric" value="' + (p.min || '') + '"></div><div class="field"><label class="label" for="pr-mx">Maks. potongan (Rp, opsional)</label><input class="input" id="pr-mx" inputmode="numeric" value="' + (p.maks || '') + '"></div>' +
      '<div class="field"><label class="label" for="pr-a">Mulai</label><input class="input" type="date" id="pr-a" value="' + esc(p.mulai || '') + '"></div><div class="field"><label class="label" for="pr-b">Selesai</label><input class="input" type="date" id="pr-b" value="' + esc(p.selesai || '') + '"></div>' +
      '<div class="field"><label class="label" for="pr-q">Kuota pemakaian (0 = tanpa batas)</label><input class="input" type="number" min="0" id="pr-q" value="' + (p.kuota || 0) + '"></div><div class="col" style="justify-content:flex-end;gap:12px"><label class="switch"><input type="checkbox" id="pr-t"' + (p.tampil ? ' checked' : '') + '><span class="tr"></span>Tampilkan di Price List</label><label class="switch"><input type="checkbox" id="pr-on"' + (p.status === 'aktif' ? ' checked' : '') + '><span class="tr"></span>Aktif</label></div>' +
      '<div class="field full"><span class="label">Banner (opsional)</span>' + dropzone('pr-ban', 'Pilih gambar banner', p.banner) + '<input class="input mt-8" id="pr-banurl" value="' + esc(p.banner || '') + '" placeholder="…atau URL gambar"></div></div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="pr-ok">Simpan Promo</button>' });
    md.$$('[data-t]').forEach(b => b.onclick = () => { tipe = b.dataset.t; md.$$('[data-t]').forEach(x => x.classList.toggle('on', x === b)); });
    bindDrop(md, 'pr-ban', 'banner', u => { md.$('#pr-banurl').value = u; });
    md.$('#pr-ok').onclick = async () => { const r = await CF.busy(md.$('#pr-ok'), () => CF.api('promo.simpan', { id: p.id || '', kode: val(md, '#pr-k'), nama: val(md, '#pr-n'), tipe: tipe, nilai: Number(String(val(md, '#pr-v')).replace(',', '.')), min: Number(String(val(md, '#pr-min')).replace(/\D/g, '')) || 0, maks: Number(String(val(md, '#pr-mx')).replace(/\D/g, '')) || 0, mulai: val(md, '#pr-a'), selesai: val(md, '#pr-b'), kuota: Number(val(md, '#pr-q')) || 0, banner: val(md, '#pr-banurl'), tampil: md.$('#pr-t').checked, status: md.$('#pr-on').checked ? 'aktif' : 'nonaktif' })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); CF.renderPage(); };
  };

  // ==================================================================
  // PENGGUNA (akun staf)
  // ==================================================================
  const PG = { data: null };
  function sandiModal(user, sandi, judul) {
    CF.modal({ title: judul, size: 'sm', body: '<p class="muted">Berikan kata sandi sementara ini kepada <b>' + esc(user) + '</b>. Hanya tampil sekali — wajib diganti saat masuk pertama.</p><div class="soft-box row between mt-12"><span class="code" style="font-size:20px;font-weight:700">' + esc(sandi) + '</span><button class="btn btn-sm btn-secondary" data-act="salinT" data-v="' + esc(sandi) + '">' + ic('copy', 'sm') + 'Salin</button></div>', foot: '<button class="btn btn-primary" data-x>Sudah saya catat</button>', dismiss: false });
  }
  A.salinT = el => CF.copy(el.dataset.v);
  page('pengguna', { title: 'Pengguna & Hak Akses', icon: 'users', sec: 'Manajemen',
    async render(el) {
      if (!PG.data) el.innerHTML = skel(4);
      const d = await load('pengguna.list', {}, el); if (!d) return; PG.data = d;
      el.innerHTML = '<div class="page-head"><span class="sub">Admin/Owner: akses penuh • Kasir: pesanan, meja, pembayaran, diskon terbatas • Kitchen/Barista: papan dapur & ketersediaan menu.</span><button class="btn btn-primary" data-act="userForm">' + ic('plus', 'sm') + 'Tambah Pengguna</button></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Izin stok</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead><tbody>' + d.map(u => '<tr><td><div class="row"><span class="avatar">' + esc(CF.inisial(u.nama)) + '</span><b>' + esc(u.nama) + '</b></div></td><td class="code">' + esc(u.username) + '</td><td><span class="badge ' + (u.peran === 'admin' ? 'b-orange' : u.peran === 'kasir' ? 'b-blue' : 'b-green') + '">' + esc(CF.ROLE_LABEL[u.peran] || u.peran) + '</span></td><td>' + (u.stok || u.peran === 'admin' ? ic('check', 'sm green') : '<span class="faint">—</span>') + '</td>' +
          '<td>' + (u.status !== 'aktif' ? '<span class="badge b-neutral">Nonaktif</span>' : u.kunci ? '<span class="badge b-red">' + ic('lock', 'sm') + 'Terkunci s.d. ' + CF.jam(u.kunci) + '</span>' : u.wajibGanti ? '<span class="badge b-amber">Belum ganti sandi</span>' : '<span class="badge b-green">Aktif</span>') + '</td><td class="small">' + (u.login ? CF.tglJam(u.login) : '-') + '</td>' +
          '<td class="acts"><button class="btn btn-ghost btn-sm" data-act="userForm" data-id="' + u.id + '">' + ic('edit', 'sm') + 'Ubah</button><button class="btn btn-ghost btn-sm" data-act="userReset" data-id="' + u.id + '">' + ic('key', 'sm') + 'Reset sandi</button></td></tr>').join('') + '</tbody></table></div>';
    } });
  A.userForm = el => {
    const u = (PG.data.filter(x => x.id === el.dataset.id)[0]) || { peran: 'kasir', status: 'aktif' };
    const md = CF.modal({ title: u.id ? 'Ubah Pengguna' : 'Tambah Pengguna', size: 'sm', body: '<div class="col gap-12"><div class="field"><label class="label" for="u-n">Nama</label><input class="input" id="u-n" value="' + esc(u.nama || '') + '"></div><div class="field"><label class="label" for="u-u">Username</label><input class="input code" id="u-u" value="' + esc(u.username || '') + '" autocapitalize="none" placeholder="huruf kecil, mis. sari"></div>' +
      '<div class="field"><label class="label" for="u-p">Peran</label><select class="select" id="u-p">' + ['admin', 'kasir', 'dapur'].map(r => '<option value="' + r + '"' + (u.peran === r ? ' selected' : '') + '>' + CF.ROLE_LABEL[r] + '</option>').join('') + '</select></div>' +
      '<label class="switch"><input type="checkbox" id="u-s"' + (u.stok ? ' checked' : '') + '><span class="tr"></span>Boleh mencatat stok masuk/keluar</label>' + (u.id ? '<label class="switch"><input type="checkbox" id="u-on"' + (u.status === 'aktif' ? ' checked' : '') + '><span class="tr"></span>Akun aktif</label>' : '<p class="help">Kata sandi sementara dibuat otomatis & ditampilkan sekali.</p>') + '</div>',
      foot: '<button class="btn btn-secondary" data-x>Batal</button><button class="btn btn-primary" id="u-ok">Simpan</button>' });
    md.$('#u-ok').onclick = async () => { const r = await CF.busy(md.$('#u-ok'), () => CF.api('pengguna.simpan', { id: u.id || '', nama: val(md, '#u-n'), username: val(md, '#u-u'), peran: val(md, '#u-p'), stok: md.$('#u-s').checked, status: !u.id || md.$('#u-on').checked ? 'aktif' : 'nonaktif' })); if (!r.ok) return CF.err(r); md.close(); CF.toast(r.msg, 'ok'); if (r.data && r.data.sandiSementara) sandiModal(val(md, '#u-u'), r.data.sandiSementara, 'Akun dibuat'); CF.renderPage(); };
  };
  A.userReset = async el => { const u = PG.data.filter(x => x.id === el.dataset.id)[0]; if (!(await CF.confirm({ title: 'Reset kata sandi ' + u.username + '?', msg: 'Sesi lama pengguna ini akan dikeluarkan dan ia wajib membuat sandi baru.', ok: 'Reset' }))) return; const r = await CF.api('pengguna.reset', { id: u.id }); if (!r.ok) return CF.err(r); sandiModal(u.username, r.data.sandiSementara, 'Kata sandi direset'); CF.renderPage(); };

  // ==================================================================
  // LAPORAN (grafik + tabel + ekspor PDF/Excel)
  // ==================================================================
  const LP = { preset: '7', dari: '', sampai: '', tab: 'grafik', sub: 'transaksi', f: { produk: '', kasir: '', metode: '', status: '', q: '' }, pg: 1, sort: { k: 1, d: -1 }, data: null };
  const statusLap = r => r[7] === 'batal' ? 'dibatalkan' : r[8] === 'lunas' ? 'berhasil' : r[8] === 'refund' ? 'dibatalkan' : ['menunggu', 'verifikasi', 'belum'].indexOf(r[8]) > -1 ? 'pending' : 'gagal';
  const STLAP = { berhasil: 'b-green', pending: 'b-amber', gagal: 'b-red', dibatalkan: 'b-neutral' };
  function setPreset(p) {
    LP.preset = p; const now = Date.now(), d = CF.isoHari(now);
    if (p === '0') { LP.dari = d; LP.sampai = d; } else if (p === '7') { LP.dari = CF.isoHari(now - 6 * 86400e3); LP.sampai = d; } else if (p === '30') { LP.dari = CF.isoHari(now - 29 * 86400e3); LP.sampai = d; } else if (p === 'bulan') { LP.dari = d.slice(0, 8) + '01'; LP.sampai = d; }
  }
  function lapRows() {
    const f = LP.f, q = f.q.toLowerCase();
    let rows = (LP.data ? LP.data.rows : []).filter(r => (!f.metode || r[5] === f.metode) && (!f.kasir || r[4] === f.kasir) && (!f.status || statusLap(r) === f.status) && (!f.produk || String(r[9]).toLowerCase().indexOf(f.produk.toLowerCase()) > -1) && (!q || (r[0] + ' ' + r[2] + ' ' + r[3] + ' ' + r[13]).toLowerCase().indexOf(q) > -1));
    const k = LP.sort.k, d = LP.sort.d; rows = rows.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d);
    return rows;
  }
  page('laporan', { title: 'Laporan', icon: 'chart', sec: 'Laporan',
    async render(el, keep) {
      if (!LP.dari) setPreset('7');
      const ctrl = '<div class="page-head"><div class="filters"><div class="chips">' + [['0', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['bulan', 'Bulan ini'], ['kustom', 'Kustom']].map(x => '<button class="chip' + (LP.preset === x[0] ? ' on' : '') + '" data-act="lpPreset" data-p="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
        (LP.preset === 'kustom' ? '<input class="input" type="date" id="lp-d" value="' + LP.dari + '" style="width:auto" aria-label="Dari"><input class="input" type="date" id="lp-s" value="' + LP.sampai + '" style="width:auto" aria-label="Sampai">' : '<span class="small faint">' + LP.dari + ' s.d. ' + LP.sampai + '</span>') + '</div>' +
        '<div class="row"><button class="btn btn-secondary" data-act="lpPdf" data-loading="Membuat PDF…">' + ic('file', 'sm') + 'Ekspor PDF</button><button class="btn btn-secondary" data-act="lpXls">' + ic('download', 'sm') + 'Ekspor Excel</button></div></div>' +
        '<div class="tabs"><button class="' + (LP.tab === 'grafik' ? 'on' : '') + '" data-act="lpTab" data-t="grafik">' + ic('chart', 'sm') + 'Grafik</button><button class="' + (LP.tab === 'tabel' ? 'on' : '') + '" data-act="lpTab" data-t="tabel">' + ic('list', 'sm') + 'Tabel</button></div><div id="lp-body"></div>';
      el.innerHTML = ctrl;
      if (LP.preset === 'kustom') { el.querySelector('#lp-d').onchange = e => { LP.dari = e.target.value; LP.data = null; this.render(el); }; el.querySelector('#lp-s').onchange = e => { LP.sampai = e.target.value; LP.data = null; this.render(el); }; }
      const body = el.querySelector('#lp-body');
      if (!LP.data || LP.data.dari !== LP.dari || LP.data.sampai !== LP.sampai) {
        body.innerHTML = '<div class="kpis mt-16">' + '<div class="skel" style="height:96px;border-radius:16px"></div>'.repeat(5) + '</div>';
        const d = await load('laporan.data', { dari: LP.dari, sampai: LP.sampai }, body); if (!d) return; LP.data = d; LP.pg = 1;
      }
      this.draw(body);
    },
    draw(body) {
      const d = LP.data, R = d.ag.ringkas;
      const sum = '<div class="kpis mt-16">' + kpi('Pendapatan', rp(R.pendapatan), 'trend', 'g') + kpi('Pesanan', R.pesanan, 'receipt') + kpi('Transaksi berhasil', R.lunas, 'checkC', 'g') + kpi('Rata-rata transaksi', rp(R.rata), 'wallet', 'b') + kpi('Dibatalkan', R.batal, 'ban', 'r') + kpi('Diskon diberikan', rp(R.diskon), 'percent', 'a') + '</div>' +
        (d.arsip ? '<div class="banner info mt-12">' + ic('archive') + '<div>' + d.arsip + ' hari pada periode ini sudah diarsipkan — angka ringkasan & grafik tetap lengkap, tetapi rincian transaksinya ada di spreadsheet arsip.</div></div>' : '');
      if (LP.tab === 'grafik') {
        body.innerHTML = sum + '<div class="dash-grid mt-16"><div class="card pad" style="grid-column:1/-1"><div class="card-title"><h3>Pendapatan per hari</h3></div><div id="lc-rev"></div></div>' +
          '<div class="card pad"><div class="card-title"><h3>Menu paling banyak dipesan</h3></div><div id="lc-menu"></div></div><div class="card pad"><div class="card-title"><h3>Perbandingan metode pembayaran</h3></div><div id="lc-met"></div></div>' +
          '<div class="card pad"><div class="card-title"><h3>Jam paling ramai</h3></div><div id="lc-jam"></div></div><div class="card pad"><div class="card-title"><h3>Jumlah pesanan per hari</h3></div><div id="lc-n"></div></div></div>';
        const lbl = t => t.slice(8, 10) + '/' + t.slice(5, 7);
        CFChart.area(body.querySelector('#lc-rev'), d.ag.hari.map(h => ({ label: lbl(h.t), full: CF.tgl(Date.parse(h.t + 'T12:00:00+07:00')), v: h.p, extra: h.n + ' pesanan' })), { fmt: rp, h: 260, title: 'Pendapatan per hari' });
        CFChart.hbar(body.querySelector('#lc-menu'), d.ag.menu.map(m => ({ label: m[0], v: m[1] })), { fmt: v => v + ' porsi', title: 'Menu terlaris' });
        CFChart.hbar(body.querySelector('#lc-met'), Object.keys(d.ag.metode).map(k => ({ label: CF.LABEL_METODE[k] || k, v: d.ag.metode[k] })).sort((a, b) => b.v - a.v), { fmt: rp, title: 'Metode pembayaran' });
        CFChart.col(body.querySelector('#lc-jam'), d.ag.jam.slice(8, 24).map((v, i) => ({ label: String(i + 8).padStart(2, '0'), full: 'Pukul ' + (i + 8) + '.00', v: v })), { fmt: v => v + ' pesanan', title: 'Jam ramai' });
        CFChart.col(body.querySelector('#lc-n'), d.ag.hari.map(h => ({ label: lbl(h.t), v: h.n })), { fmt: v => v + ' pesanan', title: 'Pesanan per hari' });
        return;
      }
      const subs = '<div class="seg mt-16"><button class="' + (LP.sub === 'transaksi' ? 'on' : '') + '" data-act="lpSub" data-s="transaksi">Riwayat Transaksi</button><button class="' + (LP.sub === 'meja' ? 'on' : '') + '" data-act="lpSub" data-s="meja">Per Nomor Meja</button><button class="' + (LP.sub === 'stok' ? 'on' : '') + '" data-act="lpSub" data-s="stok">Mutasi Stok</button></div>';
      if (LP.sub === 'stok') { body.innerHTML = sum + subs + '<div class="table-wrap mt-12"><table class="tbl"><thead><tr><th>Waktu</th><th>Bahan</th><th>Jenis</th><th class="num">Qty</th><th class="num">Stok akhir</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>' + (d.mutasi.map(m => '<tr><td class="nowrap tnum">' + CF.tglJam(m[1]) + '</td><td><b>' + esc(m[2]) + '</b></td><td>' + esc(m[3]) + '</td><td class="num">' + CF.num(m[4]) + '</td><td class="num">' + CF.num(m[5]) + '</td><td class="small">' + esc(m[6]) + '</td><td class="small">' + esc(m[7]) + '</td></tr>').join('') || '<tr><td colspan="7" class="center faint">Tidak ada mutasi.</td></tr>') + '</tbody></table></div>'; return; }
      if (LP.sub === 'meja') {
        const g = {}; d.rows.forEach(r => { const k = r[2] || '-'; g[k] = g[k] || { n: 0, tot: 0, batal: 0, last: 0 }; if (r[7] === 'batal') g[k].batal++; else { g[k].n++; if (r[8] === 'lunas') g[k].tot += r[6]; } g[k].last = Math.max(g[k].last, r[1]); });
        body.innerHTML = sum + subs + '<div class="table-wrap mt-12"><table class="tbl"><thead><tr><th>Meja</th><th class="num">Pesanan</th><th class="num">Batal</th><th class="num">Pendapatan</th><th>Terakhir</th></tr></thead><tbody>' + Object.keys(g).sort((a, b) => g[b].tot - g[a].tot).map(k => '<tr><td><span class="mtag">' + esc(k) + '</span></td><td class="num">' + g[k].n + '</td><td class="num">' + g[k].batal + '</td><td class="num"><b>' + rp(g[k].tot) + '</b></td><td class="small">' + CF.tglJam(g[k].last) + '</td></tr>').join('') + '</tbody></table></div>';
        return;
      }
      const rows = lapRows(), per = 25, pg = Math.min(LP.pg, Math.max(1, Math.ceil(rows.length / per))), kasir = [], met = [];
      d.rows.forEach(r => { if (r[4] && kasir.indexOf(r[4]) === -1) kasir.push(r[4]); if (r[5] && met.indexOf(r[5]) === -1) met.push(r[5]); });
      const th = (k, l, cls) => '<th class="sortable ' + (cls || '') + '" data-act="lpSort" data-k="' + k + '">' + l + (LP.sort.k === k ? (LP.sort.d > 0 ? ' ▲' : ' ▼') : '') + '</th>';
      body.innerHTML = sum + subs + '<div class="filters mt-12"><div class="search"><input class="input" id="lp-q" type="search" placeholder="No. pesanan / meja / nama" value="' + esc(LP.f.q) + '">' + ic('search') + '</div>' +
        '<input class="input" id="lp-pr" placeholder="Produk, mis. kopi" value="' + esc(LP.f.produk) + '" style="width:180px">' +
        '<select class="select" id="lp-ks"><option value="">Semua kasir</option>' + kasir.map(k => '<option' + (LP.f.kasir === k ? ' selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>' +
        '<select class="select" id="lp-mt"><option value="">Semua metode</option>' + met.map(k => '<option value="' + k + '"' + (LP.f.metode === k ? ' selected' : '') + '>' + esc(CF.LABEL_METODE[k] || k) + '</option>').join('') + '</select>' +
        '<select class="select" id="lp-st"><option value="">Semua status</option>' + ['berhasil', 'pending', 'gagal', 'dibatalkan'].map(k => '<option value="' + k + '"' + (LP.f.status === k ? ' selected' : '') + '>' + k[0].toUpperCase() + k.slice(1) + '</option>').join('') + '</select></div>' +
        '<div class="table-wrap mt-12"><table class="tbl"><thead><tr>' + th(1, 'Waktu') + th(0, 'No. Pesanan') + th(2, 'Meja') + '<th>Item</th>' + th(4, 'Kasir') + th(5, 'Metode') + '<th>Status</th>' + th(6, 'Total', 'num') + '</tr></thead><tbody>' +
        (rows.slice((pg - 1) * per, pg * per).map(r => '<tr><td class="nowrap tnum">' + CF.tglJam(r[1]) + '</td><td><b>' + esc(r[13]) + '</b><div class="xs faint">' + esc(r[0]) + '</div></td><td>' + esc(r[2] || '-') + '</td><td class="small" style="max-width:280px">' + esc(r[9]) + '</td><td class="small">' + esc(r[4] || '-') + '</td><td class="small">' + esc(CF.LABEL_METODE[r[5]] || r[5] || '-') + '</td><td><span class="badge ' + STLAP[statusLap(r)] + '">' + statusLap(r) + '</span></td><td class="num"><b>' + rp(r[6]) + '</b></td></tr>').join('') || '<tr><td colspan="8" class="center faint" style="padding:30px">Tidak ada transaksi sesuai filter.</td></tr>') +
        (rows.length ? '<tr><td colspan="7" class="right semi">Total (berhasil)</td><td class="num"><b class="green">' + rp(rows.filter(r => statusLap(r) === 'berhasil').reduce((a, r) => a + r[6], 0)) + '</b></td></tr>' : '') + '</tbody></table></div>' + pager(rows.length, pg, per, 'lpPg');
      const bind = (id, k, ev) => { const e = body.querySelector(id); e[ev || 'onchange'] = CF.debounce(() => { LP.f[k] = e.value; LP.pg = 1; this.draw(body); const n = body.querySelector(id); if (ev) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, ev ? 250 : 0); };
      bind('#lp-q', 'q', 'oninput'); bind('#lp-pr', 'produk', 'oninput'); bind('#lp-ks', 'kasir'); bind('#lp-mt', 'metode'); bind('#lp-st', 'status');
    } });
  const lpBody = () => document.getElementById('lp-body');
  A.lpPreset = el => { if (el.dataset.p !== 'kustom') setPreset(el.dataset.p); else LP.preset = 'kustom'; CF.renderPage(); };
  A.lpTab = el => { LP.tab = el.dataset.t; CF.renderPage(); };
  A.lpSub = el => { LP.sub = el.dataset.s; CF.pages.laporan.draw(lpBody()); };
  A.lpSort = el => { const k = +el.dataset.k; LP.sort = { k: k, d: LP.sort.k === k ? -LP.sort.d : -1 }; CF.pages.laporan.draw(lpBody()); };
  A.lpPg = el => { LP.pg = +el.dataset.p; CF.pages.laporan.draw(lpBody()); };
  A.lpPdf = async el => { const r = await CF.busy(el, () => CF.api('laporan.pdf', { dari: LP.dari, sampai: LP.sampai, jenis: LP.sub === 'stok' ? 'stok' : 'transaksi', filter: LP.f }, { timeout: 90000 })); if (!r.ok) return CF.err(r); CF.download(r.data.nama, r.data.b64, 'application/pdf'); };
  A.lpXls = () => {
    if (!LP.data) return;
    const R = LP.data.ag.ringkas, rows = lapRows();
    const sheets = [{ name: 'Ringkasan', rows: [['Periode', LP.dari + ' s.d. ' + LP.sampai], ['Pendapatan', R.pendapatan], ['Pesanan', R.pesanan], ['Transaksi berhasil', R.lunas], ['Rata-rata transaksi', R.rata], ['Dibatalkan', R.batal], ['Diskon', R.diskon], ['Pajak', R.pajak]].map((r, i) => i === 0 ? r : r) },
      { name: 'Transaksi', rows: [['Waktu', 'No. Pesanan', 'No. Antrean', 'Meja', 'Pelanggan', 'Item', 'Kasir', 'Metode', 'Status', 'Diskon', 'Pajak', 'Total']].concat(rows.map(r => [CF.tglJam(r[1]), r[0], r[13], r[2], r[3], r[9], r[4], CF.LABEL_METODE[r[5]] || r[5], statusLap(r), r[10], r[11], r[6]])) },
      { name: 'Per Hari', rows: [['Tanggal', 'Pesanan', 'Pendapatan']].concat(LP.data.ag.hari.map(h => [h.t, h.n, h.p])) },
      { name: 'Menu Terlaris', rows: [['Menu', 'Porsi']].concat(LP.data.ag.menu) },
      { name: 'Mutasi Stok', rows: [['Waktu', 'Bahan', 'Jenis', 'Qty', 'Stok akhir', 'Keterangan', 'Oleh']].concat(LP.data.mutasi.map(m => [CF.tglJam(m[1]), m[2], m[3], m[4], m[5], m[6], m[7]])) }];
    sheets[0].rows.unshift(['Laporan ' + (((ST.boot || {}).set || {}).nama_aplikasi || 'CafeFlow'), '']);
    CFXlsx.download('Laporan-' + LP.dari + '_' + LP.sampai + '.xlsx', sheets);
    CF.api('laporan.catatEkspor', { jenis: 'Excel', ket: LP.dari + '..' + LP.sampai });
  };

  // ==================================================================
  // PERSETUJUAN DISKON
  // ==================================================================
  page('persetujuan', { title: 'Persetujuan Diskon', icon: 'approve', sec: 'Laporan', live: true,
    update(el) { this.render(el); },
    async render(el) {
      const d = await load('persetujuan.list', { _fresh: true }, el); if (!d) return;
      const pend = d.filter(a => a.st === 'menunggu'), hist = d.filter(a => a.st !== 'menunggu');
      el.innerHTML = '<h3>Menunggu keputusan (' + pend.length + ')</h3>' + (pend.length ? '<div class="ord-grid">' + pend.map(a => { const o = CF.orderById(a.psn); return '<div class="card pad col gap-12"><div class="row between"><b>' + esc(o ? o.np + ' • Meja ' + o.mn : a.psn) + '</b><span class="badge b-amber">' + ic('clock', 'sm') + CF.lalu(a.waktu) + '</span></div><div class="row between"><span class="muted">Diminta oleh <b>' + esc(a.by) + '</b></span><span class="price" style="font-size:20px">-' + rp(a.jml) + '</span></div><div class="small faint">' + (a.tipe === 'persen' ? a.nilai + '% dari ' : 'Nominal • total ') + (o ? rp(o.sub - o.dp) : '') + '</div><div class="soft-box small"><b>Alasan:</b> ' + esc(a.alasan) + '</div><div class="row" style="gap:8px"><button class="btn btn-danger-o grow" data-act="putus" data-id="' + a.id + '">' + ic('x', 'sm') + 'Tolak</button><button class="btn btn-success grow" data-act="putus" data-id="' + a.id + '" data-ok="1">' + ic('check', 'sm') + 'Setujui</button></div></div>'; }).join('') + '</div>' : '<p class="muted">Tidak ada permintaan yang menunggu.</p>') +
        '<h3 class="mt-16">Riwayat</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pesanan</th><th>Diminta</th><th class="num">Diskon</th><th>Alasan</th><th>Keputusan</th></tr></thead><tbody>' + (hist.map(a => '<tr><td class="small nowrap">' + CF.tglJam(a.waktu) + '</td><td class="code">' + esc(a.psn) + '</td><td>' + esc(a.by) + '</td><td class="num">' + rp(a.jml) + '</td><td class="small">' + esc(a.alasan) + '</td><td>' + (a.st === 'disetujui' ? '<span class="badge b-green">Disetujui</span>' : '<span class="badge b-red">Ditolak</span>') + '<div class="xs faint">' + esc(a.oleh) + (a.cat ? ' — ' + esc(a.cat) : '') + '</div></td></tr>').join('') || '<tr><td colspan="6" class="center faint">Belum ada riwayat.</td></tr>') + '</tbody></table></div>';
    } });
  A.putus = async el => {
    const ok = !!el.dataset.ok; let cat = '';
    if (!ok) { cat = await CF.confirm({ title: 'Tolak diskon?', danger: true, ok: 'Tolak', input: { label: 'Alasan penolakan', required: true } }); if (!cat) return; }
    const r = await CF.busy(el, () => CF.api('persetujuan.putus', { id: el.dataset.id, setuju: ok, catatan: cat || '' }));
    if (!r.ok) return CF.err(r); CF.toast(r.msg, 'ok'); CF.refreshLive(); CF.renderPage();
  };

  // ==================================================================
  // ACTIVITY LOG (hanya baca)
  // ==================================================================
  const LG = { data: null, pg: 1, dari: '', sampai: '', aksi: '', q: '' };
  const AKSI = ['BATAL_PESANAN', 'UBAH_HARGA', 'DISKON_MANUAL', 'MINTA_DISKON', 'SETUJUI_DISKON', 'TOLAK_DISKON', 'STOK_MASUK', 'STOK_KELUAR', 'STOK_KOREKSI', 'KETERSEDIAAN_MENU', 'BUKA_SESI', 'TUTUP_SESI', 'TUTUP_PAKSA_SESI', 'VERIFIKASI_BAYAR', 'TOLAK_BAYAR', 'TAMBAH_MENU', 'UBAH_MENU', 'TAMBAH_PENGGUNA', 'UBAH_PENGGUNA', 'RESET_SANDI', 'UBAH_PENGATURAN', 'UBAH_RAHASIA', 'EKSPOR_LAPORAN', 'LOGIN_DIKUNCI', 'LOGIN_DARURAT', 'IMPORT_RUN', 'GANTI_QR_MEJA', 'ARSIP_DATA'];
  page('log', { title: 'Activity Log', icon: 'history', sec: 'Laporan',
    async render(el) {
      if (!LG.dari) { LG.sampai = CF.isoHari(); LG.dari = CF.isoHari(Date.now() - 7 * 86400e3); }
      el.innerHTML = '<div class="banner info">' + ic('lock') + '<div>Log dicatat otomatis dan <b>tidak dapat diubah atau dihapus</b> — siapa, kapan, apa yang diubah (nilai lama → baru).</div></div>' +
        '<div class="filters"><input class="input" type="date" id="lg-d" value="' + LG.dari + '" style="width:auto" aria-label="Dari"><input class="input" type="date" id="lg-s" value="' + LG.sampai + '" style="width:auto" aria-label="Sampai"><select class="select" id="lg-a"><option value="">Semua aksi</option>' + AKSI.map(a => '<option' + (LG.aksi === a ? ' selected' : '') + '>' + a + '</option>').join('') + '</select><div class="search"><input class="input" id="lg-q" type="search" placeholder="Cari objek / nilai / alasan" value="' + esc(LG.q) + '">' + ic('search') + '</div></div><div id="lg-body">' + skel(8) + '</div>';
      const get = async () => { LG.data = await load('log.list', { dari: LG.dari, sampai: LG.sampai, aksi: LG.aksi, q: LG.q }, el.querySelector('#lg-body')); LG.pg = 1; draw(); };
      const draw = () => {
        if (!LG.data) return; const per = 30, rows = LG.data.slice((LG.pg - 1) * per, LG.pg * per);
        el.querySelector('#lg-body').innerHTML = LG.data.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Objek</th><th>Lama → Baru</th><th>Alasan</th></tr></thead><tbody>' + rows.map(l => '<tr><td class="nowrap small tnum">' + CF.tglJam(l.waktu) + '</td><td><b class="small">' + esc(l.user) + '</b><div class="xs faint">' + esc(CF.ROLE_LABEL[l.peran] || l.peran) + '</div></td><td><span class="badge ' + (/BATAL|TOLAK|PAKSA|DIKUNCI|DARURAT/.test(l.aksi) ? 'b-red' : /HARGA|DISKON|STOK|RAHASIA/.test(l.aksi) ? 'b-amber' : 'b-neutral') + '">' + esc(l.aksi) + '</span></td><td class="small">' + esc(l.ent) + (l.eid ? ' <b>' + esc(l.eid) + '</b>' : '') + '</td><td class="small" style="max-width:320px">' + (l.lama ? '<span class="faint" style="text-decoration:line-through">' + esc(l.lama) + '</span> → ' : '') + esc(l.baru) + '</td><td class="small" style="max-width:220px">' + esc(l.alasan) + '</td></tr>').join('') + '</tbody></table></div>' + pager(LG.data.length, LG.pg, per, 'lgPg') : empty('history', 'Tidak ada aktivitas', 'Pada periode & filter ini.');
      };
      LG.draw = draw;
      el.querySelector('#lg-d').onchange = e => { LG.dari = e.target.value; get(); }; el.querySelector('#lg-s').onchange = e => { LG.sampai = e.target.value; get(); };
      el.querySelector('#lg-a').onchange = e => { LG.aksi = e.target.value; get(); }; el.querySelector('#lg-q').oninput = CF.debounce(() => { LG.q = el.querySelector('#lg-q').value; get(); }, 400);
      get();
    } });
  A.lgPg = el => { LG.pg = +el.dataset.p; LG.draw(); };

  // ==================================================================
  // PENGATURAN (identitas, pembayaran, pajak & struk, sesi & diskon,
  //             price list, import data, sistem)
  // ==================================================================
  const PS = { tab: 'identitas', d: null };
  const TABS = [['identitas', 'Identitas Aplikasi', 'palette'], ['bayar', 'Pembayaran & Situs', 'wallet'], ['pajak', 'Pajak & Struk', 'receipt'], ['sesi', 'Sesi Meja & Diskon', 'grid'], ['pl', 'Price List & Promo', 'tag'], ['import', 'Import Data', 'db'], ['sistem', 'Sistem', 'settings']];
  const inp = (k, label, help, type, attrs) => '<div class="field"><label class="label" for="s-' + k + '">' + label + '</label><input class="input" id="s-' + k + '" data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(PS.d.set[k]) + '" ' + (attrs || '') + '>' + (help ? '<span class="help">' + help + '</span>' : '') + '</div>';
  page('pengaturan', { title: 'Pengaturan', icon: 'settings', sec: 'Sistem',
    async render(el) {
      el.innerHTML = skel(6);
      const d = await load('pengaturan.get', { _fresh: true }, el); if (!d) return; PS.d = d; CF._set = d.set;
      el.innerHTML = '<div class="set-layout"><nav class="set-nav">' + TABS.map(t => '<button class="nav-item' + (PS.tab === t[0] ? ' on' : '') + '" data-act="psTab" data-t="' + t[0] + '">' + ic(t[2], 'sm') + t[1] + '</button>').join('') + '</nav><div id="ps-body" class="col gap-16"></div></div>';
      this.draw(el.querySelector('#ps-body'));
    },
    draw(b) {
      const s = PS.d.set, t = PS.tab, save = '<div class="save-bar"><button class="btn btn-secondary" data-act="psReset">Batalkan perubahan</button><button class="btn btn-primary btn-lg" data-act="psSave" data-loading="Menyimpan…">' + ic('check', 'sm') + 'Simpan Perubahan</button></div>';
      if (t === 'identitas') {
        b.innerHTML = '<div class="dash-grid" style="grid-template-columns:minmax(0,1.2fr) minmax(280px,1fr);align-items:start"><div class="card pad col gap-16"><h3>Identitas Aplikasi</h3>' + inp('nama_aplikasi', 'Nama aplikasi / cafe') + inp('tagline', 'Tagline') +
          '<div class="field"><span class="label">Logo (dipangkas persegi; dibuat 2 ukuran: kecil untuk header/favicon, sedang untuk struk & login)</span>' + dropzone('s-logo', 'Pilih logo', s.logo_url) + '<input type="hidden" data-k="logo_url" id="s-logo_url" value="' + esc(s.logo_url) + '"><input type="hidden" data-k="logo_thumb_url" id="s-logo_thumb_url" value="' + esc(s.logo_thumb_url) + '">' + (s.logo_url ? '<button class="btn btn-ghost btn-sm mt-8" data-act="hapusLogo">Hapus logo</button>' : '') + '</div>' +
          '<div class="grid-form"><div class="field"><label class="label" for="s-warna_primer">Warna utama (tombol)</label><div class="color-in"><input type="color" id="c-primer" value="' + esc(s.warna_primer) + '" aria-label="Pilih warna utama"><input class="input code" id="s-warna_primer" data-k="warna_primer" value="' + esc(s.warna_primer) + '"></div></div>' +
          '<div class="field"><label class="label" for="s-warna_aksen">Warna aksen</label><div class="color-in"><input type="color" id="c-aksen" value="' + esc(s.warna_aksen) + '" aria-label="Pilih warna aksen"><input class="input code" id="s-warna_aksen" data-k="warna_aksen" value="' + esc(s.warna_aksen) + '"></div></div></div><div id="ct-warn"></div>' +
          '<button class="btn btn-ghost btn-sm" data-act="warnaDefault" style="align-self:flex-start">' + ic('refresh', 'sm') + 'Kembalikan warna default</button>' +
          inp('alamat', 'Alamat') + '<div class="grid-form">' + inp('telepon', 'Telepon') + inp('jam_buka', 'Jam buka') + '</div></div>' +
          '<div class="card pad" style="position:sticky;top:84px"><h3>Pratinjau langsung</h3><div class="preview-box mt-12" id="pv"></div></div></div>' + save;
        const pv = () => {
          const p = b.querySelector('#s-warna_primer').value, a = b.querySelector('#s-warna_aksen').value, nm = b.querySelector('#s-nama_aplikasi').value, lg = b.querySelector('#s-logo_thumb_url').value;
          const ok = /^#[0-9a-f]{6}$/i.test(p) && /^#[0-9a-f]{6}$/i.test(a);
          const st = ok ? '--primary:' + p + ';--primary-hover:' + CF.mix(p, '#000000', .2) + ';--accent:' + a + ';--accent-tint:' + CF.mix(a, '#FFFFFF', .9) + ';--on-primary:' + (CF.contrast(p, '#FFFFFF') >= 3 ? '#fff' : '#1F2937') : '';
          b.querySelector('#pv').setAttribute('style', st);
          b.querySelector('#pv').innerHTML = '<div style="padding:14px;display:flex;flex-direction:column;gap:12px"><div class="row" style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:10px 12px"><div class="brand"><div class="logo" style="width:36px;height:36px">' + (lg ? '<img src="' + esc(lg) + '" alt="">' : ic('coffee')) + '</div><div class="name" style="font-size:16px">' + esc(nm) + '</div></div><span class="grow"></span><span class="pill-meja" style="font-size:12px;padding:5px 10px">Meja 7</span></div>' +
            '<div class="row" style="gap:8px"><span class="chip on">Semua</span><span class="chip">Beverages</span></div><div class="prod" style="max-width:200px"><div class="media" style="aspect-ratio:4/3">' + CF.ph('Kopi') + '</div><div class="nm small">Es Kopi Susu</div><div class="foot"><span class="price">Rp 22.000</span><button class="btn btn-sm btn-primary">Pesan</button></div></div>' +
            '<button class="btn btn-primary btn-block">Pesan Sekarang ' + ic('arrowR') + '</button></div>';
          const w = []; if (ok && CF.contrast(p, '#FFFFFF') < 4.5) w.push('Kontras teks putih di atas warna utama hanya ' + CF.contrast(p, '#FFFFFF').toFixed(1) + ':1 (disarankan ≥ 4.5:1). Pilih warna lebih gelap agar tombol mudah dibaca.');
          if (ok && CF.contrast(a, '#FFFFFF') < 2.5) w.push('Warna aksen terlalu terang — ikon & penanda aktif sulit terlihat.');
          b.querySelector('#ct-warn').innerHTML = w.map(x => '<div class="banner warn">' + ic('alert') + '<div>' + esc(x) + '</div></div>').join('') || (ok ? '<div class="banner ok">' + ic('checkC') + '<div>Kontras warna baik (' + CF.contrast(p, '#FFFFFF').toFixed(1) + ':1).</div></div>' : '<div class="banner danger">' + ic('alert') + '<div>Format warna harus #RRGGBB.</div></div>');
        };
        [['c-primer', 's-warna_primer'], ['c-aksen', 's-warna_aksen']].forEach(x => { const c = b.querySelector('#' + x[0]), t2 = b.querySelector('#' + x[1]); c.oninput = () => { t2.value = c.value.toUpperCase(); pv(); }; t2.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(t2.value)) c.value = t2.value; pv(); }; });
        b.querySelector('#s-nama_aplikasi').oninput = pv; pv();
        const m = { $: s2 => b.querySelector(s2) };
        bindDrop(m, 's-logo', 'logo', async u => {
          b.querySelector('#s-logo_url').value = u;
          try { const f = b.querySelector('#s-logo').files[0]; if (f) { const r = await uploadImg(f, 'logo_thumb', { square: true, max: 128, maxBytes: 60000 }); b.querySelector('#s-logo_thumb_url').value = r.url; } else b.querySelector('#s-logo_thumb_url').value = u.replace(/sz=w\d+/, 'sz=w128'); } catch (e) { b.querySelector('#s-logo_thumb_url').value = u.replace(/sz=w\d+/, 'sz=w128'); }
          pv();
        }, { square: true, max: 512, maxBytes: 200000 });
      } else if (t === 'bayar') {
        const met = String(s.metode_aktif).split(','), M = [['kasir', 'Bayar di kasir (tunai/EDC)'], ['transfer', 'Transfer manual + bukti'], ['qris_statis', 'QRIS cafe (statis) + bukti'], ['qris', 'QRIS dinamis (Midtrans)'], ['gopay', 'GoPay (Midtrans)'], ['shopeepay', 'ShopeePay (Midtrans)'], ['va_bca', 'VA BCA (Midtrans)'], ['va_bni', 'VA BNI (Midtrans)'], ['va_bri', 'VA BRI (Midtrans)']];
        const rh = PS.d.rahasia.midtrans, sugg = location.origin + location.pathname.replace(/[^/]*$/, '');
        b.innerHTML = '<div class="card pad col gap-12"><h3>Metode pembayaran aktif</h3><div class="grid-form">' + M.map(x => '<label class="switch"><input type="checkbox" data-met="' + x[0] + '"' + (met.indexOf(x[0]) > -1 ? ' checked' : '') + '><span class="tr"></span>' + x[1] + (PS.d.metodeTersedia.indexOf(x[0]) > -1 ? '' : met.indexOf(x[0]) > -1 ? ' <span class="badge b-amber">belum lengkap</span>' : '') + '</label>').join('') + '</div><input type="hidden" data-k="metode_aktif" id="s-metode_aktif" value="' + esc(s.metode_aktif) + '"><p class="help">Metode "belum lengkap" tidak ditampilkan ke pelanggan sampai datanya diisi (rekening, gambar QRIS, atau Server Key Midtrans).</p></div>' +
          '<div class="card pad col gap-12"><div class="row between"><h3>Midtrans (QRIS, e-wallet, VA otomatis)</h3>' + (rh.ada ? '<span class="badge b-green">' + ic('checkC', 'sm') + 'Server Key tersimpan</span>' : '<span class="badge b-neutral">Belum diisi</span>') + '</div>' +
          '<div class="grid-form"><div class="field"><label class="label" for="s-midtrans_mode">Mode</label><select class="select" id="s-midtrans_mode" data-k="midtrans_mode"><option value="sandbox"' + (s.midtrans_mode === 'sandbox' ? ' selected' : '') + '>Sandbox (uji coba)</option><option value="production"' + (s.midtrans_mode === 'production' ? ' selected' : '') + '>Production (uang sungguhan)</option></select></div>' +
          '<div class="field"><label class="label" for="mt-key">Server Key</label><input class="input code" id="mt-key" type="password" autocomplete="off" placeholder="' + (rh.ada ? esc(rh.samar) : 'SB-Mid-server-…') + '"><span class="help">Disimpan di Script Properties (tidak di Sheets/kode). Hanya ditampilkan tersamar.</span></div></div>' +
          '<div class="row wrap"><button class="btn btn-secondary" data-act="mtSave" data-loading="Menyimpan…">' + ic('key', 'sm') + 'Simpan Server Key</button><button class="btn btn-secondary" data-act="mtTes" data-loading="Menguji…">' + ic('refresh', 'sm') + 'Tes koneksi</button>' + (rh.ada ? '<button class="btn btn-danger-o" data-act="mtHapus">Hapus key</button>' : '') + '</div>' +
          '<div class="banner info">' + ic('info') + '<div>Di dashboard Midtrans → Settings → Payment → <b>Notification URL</b>, isi dengan URL Web App Anda:<br><span class="code" style="word-break:break-all">' + esc(CF.GAS_URL) + '</span></div></div></div>' +
          '<div class="card pad col gap-12"><h3>Alamat situs pelanggan</h3>' + inp('url_frontend', 'URL GitHub Pages', 'Dipakai untuk QR meja & kembali dari aplikasi e-wallet. Contoh: <span class="code">' + esc(sugg) + '</span>', 'url') + '<button class="btn btn-ghost btn-sm" data-act="isiUrl" data-v="' + esc(sugg) + '" style="align-self:flex-start">Pakai alamat saat ini</button></div>' +
          '<div class="card pad col gap-12"><h3>Rekening transfer manual</h3><div class="grid-form">' + inp('bank_nama', 'Nama bank', '', 'text', 'placeholder="mis. BCA"') + inp('bank_rekening', 'Nomor rekening', '', 'text', 'inputmode="numeric"') + inp('bank_atas_nama', 'Atas nama') + '</div></div>' +
          '<div class="card pad col gap-12"><h3>QRIS cafe (statis)</h3><p class="small faint">Unggah gambar QRIS dari bank/penyedia Anda. Pelanggan scan, lalu unggah bukti untuk diverifikasi kasir.</p>' + dropzone('s-qris', 'Pilih gambar QRIS', s.qris_statis_url) + '<input type="hidden" data-k="qris_statis_url" id="s-qris_statis_url" value="' + esc(s.qris_statis_url) + '"></div>' + save;
        b.querySelectorAll('[data-met]').forEach(c => c.onchange = () => { b.querySelector('#s-metode_aktif').value = [].filter.call(b.querySelectorAll('[data-met]'), x => x.checked).map(x => x.dataset.met).join(','); });
        bindDrop({ $: s2 => b.querySelector(s2) }, 's-qris', 'qris', u => { b.querySelector('#s-qris_statis_url').value = u; }, { max: 1200, maxBytes: 400000 });
      } else if (t === 'pajak') {
        b.innerHTML = '<div class="card pad col gap-12"><h3>Pajak & biaya layanan</h3><div class="grid-form">' + inp('pajak_persen', 'Pajak (%)', '', 'number', 'min="0" max="100" step="0.1"') + inp('label_pajak', 'Label pajak', 'mis. PB1, PPN') + inp('layanan_persen', 'Biaya layanan (%)', '0 = tidak ada', 'number', 'min="0" max="100" step="0.1"') +
          '<div class="field" style="justify-content:flex-end">' + sw('harga_termasuk_pajak', s.harga_termasuk_pajak === 'Y', 'Harga menu sudah termasuk pajak') + '</div></div></div>' +
          '<div class="card pad col gap-12"><h3>Struk</h3><div class="field"><span class="label">Ukuran kertas printer thermal</span><div class="seg"><button type="button" data-kertas="58" class="' + (s.struk_kertas === '58' ? 'on' : '') + '">58 mm</button><button type="button" data-kertas="80" class="' + (s.struk_kertas !== '58' ? 'on' : '') + '">80 mm</button></div><input type="hidden" data-k="struk_kertas" id="s-struk_kertas" value="' + esc(s.struk_kertas) + '"></div>' +
          inp('struk_footer', 'Pesan di bawah struk') + sw('struk_tampil_logo', s.struk_tampil_logo === 'Y', 'Tampilkan logo di struk') + inp('batas_bayar_menit', 'Batas waktu pembayaran online (menit)', 'QRIS/VA kedaluwarsa setelah waktu ini.', 'number', 'min="5" max="120"') + '</div>' +
          '<div class="card pad col gap-12"><h3>Ringkasan harian untuk Owner</h3>' + inp('email_owner', 'Email Owner', '', 'email') + sw('email_ringkasan_harian', s.email_ringkasan_harian === 'Y', 'Kirim ringkasan penjualan setiap malam (±23.45)') + '</div>' + save;
        b.querySelectorAll('[data-kertas]').forEach(x => x.onclick = () => { b.querySelector('#s-struk_kertas').value = x.dataset.kertas; b.querySelectorAll('[data-kertas]').forEach(y => y.classList.toggle('on', y === x)); });
      } else if (t === 'sesi') {
        b.innerHTML = '<div class="card pad col gap-12"><h3>Sesi meja (QR)</h3><div class="grid-form">' + inp('ttl_sesi_menit', 'Sesi berakhir otomatis setelah tidak aktif (menit)', '0 = tidak pernah. Default 180.', 'number', 'min="0" max="1440"') + inp('maks_perangkat_per_sesi', 'Maks. perangkat per meja', '0 = tanpa batas', 'number', 'min="0" max="50"') + '</div>' +
          sw('pin_meja_aktif', s.pin_meja_aktif === 'Y', 'Wajib PIN 4 angka dari kasir (mencegah QR difoto & dipakai dari luar cafe)') + sw('multi_pelanggan_per_meja', s.multi_pelanggan_per_meja === 'Y', 'Izinkan beberapa HP memesan di satu meja (default saat buka sesi)') + '</div>' +
          '<div class="card pad col gap-12"><h3>Dapur</h3>' + sw('tahan_dapur_sampai_lunas', s.tahan_dapur_sampai_lunas === 'Y', 'Pesanan baru tampil di dapur hanya setelah lunas') + inp('ambang_waktu_tunggu_menit', 'Tandai "Terlambat" bila menunggu lebih dari (menit)', '', 'number', 'min="1" max="240"') + '</div>' +
          '<div class="card pad col gap-12"><h3>Batas diskon kasir</h3><div class="grid-form">' + inp('batas_diskon_kasir_persen', 'Maks. persen', '', 'number', 'min="0" max="100"') + inp('batas_diskon_kasir_nominal', 'Maks. nominal (Rp)', '', 'number', 'min="0"') + '</div><p class="help">Di atas batas ini, diskon kasir menunggu persetujuan Owner di menu Persetujuan.</p></div>' + save;
      } else if (t === 'pl') {
        b.innerHTML = '<div class="card pad col gap-12"><h3>Halaman Price List (hanya lihat)</h3>' + inp('pricelist_judul', 'Judul') + inp('pricelist_subjudul', 'Sub-judul') + '<div class="field"><label class="label" for="s-pricelist_info">Catatan di bawah</label><textarea class="textarea" id="s-pricelist_info" data-k="pricelist_info">' + esc(s.pricelist_info) + '</textarea></div>' +
          sw('pricelist_tampil_menu', s.pricelist_tampil_menu !== 'N', 'Tampilkan juga menu cafe di Price List') + '</div>' +
          '<div class="card pad col gap-12"><h3>Promo Hari Ini</h3>' + inp('promo_harian_selesai', 'Hitung mundur berakhir pukul (WIB)', 'Menu dengan "harga coret" tampil di Promo Hari Ini. Kosongkan untuk tanpa hitung mundur.', 'time') + '</div>' + save;
      } else if (t === 'import') {
        drawImport(b);
      } else if (t === 'sistem') {
        drawSistem(b);
      }
      b.querySelectorAll('input[type=checkbox][data-k]').forEach(c => { c.dataset.yn = 1; });
    } });
  A.psTab = el => { PS.tab = el.dataset.t; document.querySelectorAll('.set-nav .nav-item').forEach(x => x.classList.toggle('on', x === el)); CF.pages.pengaturan.draw(document.getElementById('ps-body')); };
  A.psReset = () => CF.pages.pengaturan.draw(document.getElementById('ps-body'));
  A.warnaDefault = () => { const b = document.getElementById('ps-body'); b.querySelector('#s-warna_primer').value = '#C2410C'; b.querySelector('#s-warna_aksen').value = '#F97316'; b.querySelector('#c-primer').value = '#C2410C'; b.querySelector('#c-aksen').value = '#F97316'; b.querySelector('#s-warna_primer').dispatchEvent(new Event('input')); };
  A.hapusLogo = () => { const b = document.getElementById('ps-body'); b.querySelector('#s-logo_url').value = ''; b.querySelector('#s-logo_thumb_url').value = ''; CF.toast('Logo akan dihapus setelah Anda menyimpan.', 'info'); };
  A.isiUrl = el => { const i = document.getElementById('s-url_frontend'); i.value = el.dataset.v.replace(/\/+$/, ''); };
  A.psSave = async el => {
    const b = document.getElementById('ps-body'), nilai = {};
    b.querySelectorAll('[data-k]').forEach(i => { nilai[i.dataset.k] = i.type === 'checkbox' ? (i.checked ? 'Y' : 'N') : i.value; });
    const r = await CF.busy(el, () => CF.api('pengaturan.simpan', { nilai: nilai }));
    if (!r.ok) return CF.err(r);
    CF.toast(r.msg, 'ok');
    if (r.data && r.data.set) { PS.d.set = r.data.set; CF._set = r.data.set; }
    const bt = await CF.api('pub.boot'); if (bt.ok) { ST.boot = bt.data; CF.store.set('boot', bt.data); CF.applyTheme(bt.data.set); }
    const g = await CF.api('pengaturan.get', { _fresh: true }); if (g.ok) PS.d = g.data;
    CF.pages.pengaturan.draw(b);
  };
  A.mtSave = async el => { const v = document.getElementById('mt-key').value.trim(); if (!v) return CF.toast('Tempel Server Key dulu.', 'warn'); const r = await CF.busy(el, () => CF.api('rahasia.simpan', { kunci: 'MIDTRANS_SERVER_KEY', nilai: v })); document.getElementById('mt-key').value = ''; if (!r.ok) return CF.err(r); CF.toast(r.msg, 'ok'); PS.d.rahasia = r.data; const g = await CF.api('pengaturan.get', { _fresh: true }); if (g.ok) PS.d = g.data; CF.pages.pengaturan.draw(document.getElementById('ps-body')); };
  A.mtHapus = async () => { if (!(await CF.confirm({ title: 'Hapus Server Key?', danger: true, msg: 'Pembayaran QRIS/e-wallet/VA otomatis akan dimatikan.', ok: 'Hapus' }))) return; const r = await CF.api('rahasia.simpan', { kunci: 'MIDTRANS_SERVER_KEY', nilai: '__HAPUS__' }); if (!r.ok) return CF.err(r); CF.toast(r.msg, 'ok'); const g = await CF.api('pengaturan.get', { _fresh: true }); if (g.ok) PS.d = g.data; CF.pages.pengaturan.draw(document.getElementById('ps-body')); };
  A.mtTes = async el => { const r = await CF.busy(el, () => CF.api('gateway.tes', {})); r.ok ? CF.toast(r.msg, 'ok') : CF.err(r); };

  // ---------- Import data (migrasi dari app/spreadsheet lama) ----------
  const IM = { res: null, csv: null, jenis: 'Menu' };
  const IM_SHEETS = [['Kategori', 1], ['Menu', 1], ['PriceList', 1], ['Meja', 1], ['StokBahan', 1], ['Promo', 1], ['Pelanggan', 1], ['Pengaturan', 0], ['Pesanan', 0], ['PesananItem', 0], ['Transaksi', 0], ['StokMutasi', 0], ['RekapHarian', 0], ['ActivityLog', 0]];
  const TEMPLATE = { Menu: 'nama,kategori,harga,harga_coret,deskripsi,stok_porsi,foto_url\nEs Kopi Susu,Beverages,22000,,Espresso & gula aren,,\n', PriceList: 'grup,nama,harga,harga_coret,satuan,deskripsi\nSteam Motor,Motor Kecil,15000,,per unit,Cuci bodi & mesin\n', Meja: 'nomor,kapasitas\n16,4\n', StokBahan: 'nama,satuan,stok,stok_minimum\nBiji Kopi,gram,5000,1000\n', Pelanggan: 'nama,kontak,email\nBudi,081234567890,budi@contoh.com\n' };
  function parseCsv(text) {
    const first = text.split(/\r?\n/)[0] || '', d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === d) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim())) rows.push(row); row = []; } else f += c; }
    row.push(f); if (row.some(x => x.trim())) rows.push(row);
    return rows;
  }
  function imResult(res) {
    if (!res) return '';
    const R = res.report;
    return '<div class="card pad col gap-12"><div class="row between"><h3>' + (res.dryRun ? 'Hasil pindai (belum ada yang ditulis)' : 'Hasil import') + '</h3>' + (res.sumber ? '<span class="small faint">' + esc(res.sumber.nama) + '</span>' : '') + '</div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th class="num">Di sumber</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead><tbody>' + Object.keys(R).map(k => '<tr><td><b>' + esc(k) + '</b>' + (R[k].catatan ? '<div class="xs faint">' + esc(R[k].catatan) + '</div>' : '') + '</td><td class="num">' + R[k].sumber + '</td><td class="num green semi">' + R[k].ditambah + '</td><td class="num">' + R[k].diperbarui + '</td><td class="num faint">' + R[k].dilewati + '</td></tr>').join('') + '</tbody></table></div>' +
      (res.warnings && res.warnings.length ? '<div class="banner warn">' + ic('alert') + '<div>' + res.warnings.map(esc).join('<br>') + '</div></div>' : '') + '</div>';
  }
  function drawImport(b) {
    b.innerHTML = '<div class="card pad col gap-12"><h3>Pindahkan data dari app/spreadsheet lama</h3><p class="small muted">Spreadsheet lama hanya <b>dibaca</b>, tidak diubah. Aman dijalankan berulang (tidak ada data dobel). Jalankan <b>Pindai</b> dulu, lalu <b>Jalankan Import</b>. Tepat sebelum pindah total, jalankan sekali lagi untuk menangkap data terbaru.</p>' +
      '<div class="field"><label class="label" for="im-src">URL atau ID spreadsheet lama</label><input class="input code" id="im-src" placeholder="https://docs.google.com/spreadsheets/d/…"><span class="help">Harus milik/dibagikan ke akun Google pemilik app ini. Kolom dibaca berdasarkan nama judul (mis. "Nama Menu", "Harga", "Kategori").</span></div>' +
      '<div class="grid-form">' + IM_SHEETS.map(s => '<label class="check"><input type="checkbox" data-im="' + s[0] + '"' + (s[1] ? ' checked' : '') + '> ' + s[0] + (s[0] === 'ActivityLog' ? ' <span class="xs faint">(besar)</span>' : '') + '</label>').join('') + '</div>' +
      '<label class="switch"><input type="checkbox" id="im-ow"><span class="tr"></span>Timpa data yang sudah ada (harga, deskripsi, dll.)</label>' +
      '<div class="row wrap"><button class="btn btn-secondary" data-act="imRun" data-dry="1" data-loading="Memindai…">' + ic('search', 'sm') + 'Pindai (dry-run)</button><button class="btn btn-primary" data-act="imRun" data-loading="Mengimpor…">' + ic('download', 'sm') + 'Jalankan Import</button></div></div>' +
      '<div id="im-res">' + imResult(IM.res) + '</div>' +
      '<div class="card pad col gap-12"><h3>Import dari file CSV / Excel (simpan sebagai CSV)</h3><div class="grid-form"><div class="field"><label class="label" for="im-j">Jenis data</label><select class="select" id="im-j">' + Object.keys(TEMPLATE).map(k => '<option' + (IM.jenis === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></div><div class="field"><label class="label" for="im-f">File CSV</label><input class="input" type="file" id="im-f" accept=".csv,text/csv"></div></div>' +
      '<div class="row wrap"><button class="btn btn-ghost btn-sm" data-act="imTpl">' + ic('download', 'sm') + 'Unduh template CSV</button><span class="grow"></span><button class="btn btn-secondary" data-act="imCsv" data-dry="1" data-loading="Memindai…">Pindai CSV</button><button class="btn btn-primary" data-act="imCsv" data-loading="Mengimpor…">Import CSV</button></div><div id="im-csv-res"></div></div>';
    b.querySelector('#im-j').onchange = e => { IM.jenis = e.target.value; };
    b.querySelector('#im-f').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { IM.csv = parseCsv(String(rd.result).replace(/^﻿/, '')); CF.toast(IM.csv.length - 1 + ' baris terbaca.', 'info'); }; rd.readAsText(f); };
  }
  A.imRun = async el => {
    const dry = !!el.dataset.dry, sheets = [].filter.call(document.querySelectorAll('[data-im]'), c => c.checked).map(c => c.dataset.im);
    if (!dry && !(await CF.confirm({ title: 'Jalankan import?', msg: 'Data akan ditambahkan ke database app ini. Aman diulang. Sudah menjalankan Pindai?', ok: 'Jalankan' }))) return;
    const r = await CF.busy(el, () => CF.api('import.jalankan', { sumber: document.getElementById('im-src').value, sheets: sheets, dryRun: dry, overwrite: document.getElementById('im-ow').checked }, { timeout: 330000 }));
    if (!r.ok) return CF.err(r);
    IM.res = r.data; document.getElementById('im-res').innerHTML = imResult(r.data); CF.toast(r.msg, 'ok');
  };
  A.imTpl = () => { const j = document.getElementById('im-j').value, a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + TEMPLATE[j]], { type: 'text/csv' })); a.download = 'template-' + j + '.csv'; a.click(); };
  A.imCsv = async el => {
    if (!IM.csv) return CF.toast('Pilih file CSV dulu.', 'warn');
    const r = await CF.busy(el, () => CF.api('import.csv', { jenis: document.getElementById('im-j').value, rows: IM.csv, dryRun: !!el.dataset.dry, overwrite: document.getElementById('im-ow').checked }, { timeout: 330000 }));
    if (!r.ok) return CF.err(r);
    document.getElementById('im-csv-res').innerHTML = imResult(r.data); CF.toast(r.msg, 'ok');
  };
  // ---------- Sistem ----------
  async function drawSistem(b) {
    b.innerHTML = skel(4);
    const s = await load('sistem.status', {}, b); if (!s) return;
    const row = (k, v) => '<div class="sum-row"><span>' + k + '</span><b>' + v + '</b></div>';
    b.innerHTML = '<div class="dash-grid"><div class="card pad"><h3>Status server</h3><div class="mt-12">' + row('Versi backend', esc(s.versi)) + row('Cache katalog', s.bootHangat ? '<span class="badge b-green">HANGAT</span>' : '<span class="badge b-neutral">dingin</span>') + row('Cache pesanan', s.liveHangat ? '<span class="badge b-green">HANGAT</span>' : '<span class="badge b-neutral">dingin</span>') +
      row('Pemanas otomatis (keepWarm)', s.keepWarm === 'off' ? '<span class="badge b-neutral">dimatikan</span>' : '<span class="badge b-green">aktif</span>') + row('Trigger', esc(s.trigger.join(', ') || '-')) + row('Pemanasan terakhir', s.warm ? CF.tglJam(Date.parse(s.warm.at)) : '-') +
      row('Gateway Midtrans', s.gateway ? 'Terhubung' : 'Belum') + row('Antrean email', s.antreanEmail) + row('Sisa kuota email hari ini', s.kuotaEmail) + '</div></div>' +
      '<div class="card pad"><h3>Ukuran data</h3><div class="mt-12">' + Object.keys(s.baris).map(k => row(k, CF.num(s.baris[k]) + ' baris')).join('') + row('Total sel spreadsheet', CF.num(s.sel) + ' / 10.000.000') + '<div class="progress mt-8"><span style="width:' + Math.min(100, s.sel / 1e5) + '%"></span></div>' + row('Script Properties', s.propsKB + ' KB (' + s.propsJumlah + ' kunci)') + row('Spreadsheet arsip', s.arsip ? 'ada' : 'belum') + '</div></div></div>' +
      '<div class="card pad col gap-12"><h3>Pemeliharaan</h3><div class="row wrap"><button class="btn btn-secondary" data-act="segarkan" data-loading="Memuat ulang…">' + ic('refresh', 'sm') + 'Muat ulang data dari Google Sheets</button><span class="small faint">Pakai setelah Anda mengedit langsung di spreadsheet.</span></div>' +
      '<div class="divider"></div><div class="row wrap"><select class="select" id="ar-b" style="width:auto"><option value="3">Lebih lama dari 3 bulan</option><option value="6">Lebih lama dari 6 bulan</option><option value="12">Lebih lama dari 12 bulan</option></select><button class="btn btn-secondary" data-act="arsip" data-loading="Mengarsipkan…">' + ic('archive', 'sm') + 'Arsipkan data lama</button></div>' +
      '<p class="help">Pesanan, item, transaksi, mutasi stok & log lama dipindah ke spreadsheet arsip terpisah agar app tetap cepat. Ringkasan harian tetap tersimpan sehingga grafik & total laporan lama tetap utuh.</p></div>';
  }
  A.segarkan = async el => { const r = await CF.busy(el, () => CF.api('sistem.segarkan', {})); r.ok ? CF.toast(r.msg, 'ok') : CF.err(r); MN.data = null; CF.refreshLive(); };
  A.arsip = async el => { const n = document.getElementById('ar-b').value; if (!(await CF.confirm({ title: 'Arsipkan data lama?', msg: 'Data lebih lama dari ' + n + ' bulan dipindah ke spreadsheet arsip. Proses bisa memakan beberapa menit.', ok: 'Arsipkan' }))) return; const r = await CF.busy(el, () => CF.api('sistem.arsip', { bulan: Number(n) }, { timeout: 330000 })); r.ok ? CF.toast(r.msg, 'ok', 8000) : CF.err(r); };
})();
