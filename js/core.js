/* =====================================================================
   CafeFlow — core.js (dipakai semua halaman)
   API fetch ke GAS (text/plain, tanpa preflight), dedupe baca, batch,
   pengukur performa, antrean email, warmup, polling adaptif, UI helper.
   ===================================================================== */
(function () {
  'use strict';
  const CF = window.CF = {};
  const CFG = window.APP_CONFIG || {};
  CF.GAS_URL = String(CFG.GAS_URL || '');
  CF.configOk = !!CF.GAS_URL && !/GANTI|XXXX/.test(CF.GAS_URL);
  CF.VERSION = '1.0.0';

  // ---------- Penyimpanan lokal aman ----------
  CF.store = {
    get(k, def) { try { const v = localStorage.getItem('cf_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem('cf_' + k); } catch (e) { } }
  };
  CF.ss = {
    get(k, def) { try { const v = sessionStorage.getItem('cf_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { sessionStorage.setItem('cf_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  CF.devId = (function () { let d = CF.store.get('dev'); if (!d) { d = 'D' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); CF.store.set('dev', d); } return d; })();

  // ---------- Pengukur performa: Perf.table() / Perf.summary() di console ----------
  const Perf = CF.Perf = window.Perf = { log: [],
    add(e) { this.log.push(e); if (this.log.length > 300) this.log.shift(); },
    table() { console.table(this.log.map(e => ({ aksi: e.a, total_ms: e.t, server_ms: e.s, jaringan_ms: e.t - (e.s || 0), cache: e.c ? '✓' : '', ok: e.ok }))); },
    summary() { const m = {}; this.log.forEach(e => { (m[e.a] = m[e.a] || []).push(e.t); }); console.table(Object.keys(m).map(a => ({ aksi: a, n: m[a].length, rata_ms: Math.round(m[a].reduce((x, y) => x + y, 0) / m[a].length) }))); } };

  // ---------- Panggilan API ----------
  const READ = /^(pub\.boot|antrean\.data|meja\.status|pesanan\.lihat|staf\.live|admin\.dashboard|laporan\.data|menu\.adminList|meja\.list|promo\.list|pricelist\.adminList|pengguna\.list|stok\.list|stok\.riwayat|persetujuan\.list|log\.list|pengaturan\.get|sistem\.status|auth\.me|promo\.cek|batch|ping)$/;
  const inflight = {}; let writeEpoch = 0;
  CF.token = () => CF.store.get('token', '');
  async function rawCall(action, data, opts) {
    if (!CF.configOk) throw Object.assign(new Error('Konfigurasi belum lengkap: isi GAS_URL di js/config.js'), { kode: 'CONFIG' });
    const t0 = performance.now(), isRead = READ.test(action);
    const body = JSON.stringify({ action: action, data: data || {}, token: (opts && opts.token !== undefined) ? opts.token : CF.token() });
    let lastErr;
    for (let i = 0; i < (isRead ? 2 : 1); i++) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), (opts && opts.timeout) || 30000);
        const res = await fetch(CF.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, signal: ctl.signal, redirect: 'follow' });
        clearTimeout(to);
        const j = await res.json();
        Perf.add({ a: action, t: Math.round(performance.now() - t0), s: j.ms, c: !!(j.cached || (j.data && j.data.same)), ok: j.ok });
        CF.online(true);
        if (j.nq > 0) CF.scheduleDrain();
        return j;
      } catch (e) { lastErr = e; if (i === 0 && isRead) await CF.sleep(700); }
    }
    CF.online(false);
    Perf.add({ a: action, t: Math.round(performance.now() - t0), ok: false });
    return { ok: false, error: { kode: 'NET', pesan: lastErr && lastErr.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Koneksi terputus. Periksa internet Anda lalu coba lagi.' } };
  }
  // Baca identik yang sedang berjalan ditumpangi; epoch tulis mencegah data basi setelah simpan
  CF.api = function (action, data, opts) {
    if (!READ.test(action)) { writeEpoch++; return rawCall(action, data, opts).then(handleAuth); }
    const k = writeEpoch + '|' + action + '|' + CF.token() + '|' + JSON.stringify(data || {});
    if (inflight[k]) return inflight[k];
    const p = rawCall(action, data, opts).then(handleAuth);
    inflight[k] = p; p.then(() => delete inflight[k], () => delete inflight[k]);
    return p;
  };
  function handleAuth(j) { if (j && !j.ok && j.error && (j.error.kode === 'AUTH' || j.error.kode === 'GANTI_SANDI') && CF.onAuthFail) CF.onAuthFail(j.error); return j; }
  // Penggabung batch otomatis: beberapa baca dalam 1 tik → 1 eksekusi server
  const Batcher = { q: null,
    add(action, data) { return new Promise(res => { if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); } this.q.push({ action, data: data || {}, res }); }); },
    async flush() {
      const q = this.q; this.q = null; if (!q || !q.length) return;
      const uniq = []; const map = {};
      q.forEach(it => { const k = it.action + '|' + JSON.stringify(it.data); if (!map[k]) { map[k] = []; uniq.push(it); } map[k].push(it); });
      const send = (it, r) => map[it.action + '|' + JSON.stringify(it.data)].forEach(x => x.res(r));
      if (uniq.length === 1) { send(uniq[0], await CF.api(uniq[0].action, uniq[0].data)); return; }
      for (let i = 0; i < uniq.length; i += 10) {
        const part = uniq.slice(i, i + 10);
        const r = await CF.api('batch', { calls: part.map(it => ({ action: it.action, data: it.data })) });
        part.forEach((it, j) => send(it, r.ok ? r.data[j] : r));
      }
    } };
  CF.apiQ = (action, data) => Batcher.add(action, data);

  // Antrean email (struk) dikirim setelah respons → panggil drain
  let drainT = null, drainN = 0;
  CF.scheduleDrain = function () {
    clearTimeout(drainT);
    drainT = setTimeout(async () => { const r = await CF.api('drain', {}); if (r.ok && r.data && r.data.left > 0 && drainN++ < 3) CF.scheduleDrain(); else drainN = 0; }, 400);
  };
  // Warmup server (maks 1×/4 menit per lingkup)
  CF.warm = function (scope) {
    if (!CF.configOk) return;
    const k = 'warm_' + scope, last = CF.ss.get(k, 0);
    if (Date.now() - last < 240000) return;
    CF.ss.set(k, Date.now());
    try { fetch(CF.GAS_URL + (CF.GAS_URL.indexOf('?') > -1 ? '&' : '?') + 'w=' + scope, { mode: 'no-cors' }).catch(() => { }); } catch (e) { }
  };

  // ---------- Aktivitas & polling adaptif ----------
  CF.Activity = { at: Date.now(), last: {},
    init() { ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach(ev => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
    idle() { return Date.now() - this.at > 120000; },
    due(key, activeMs, idleMs) {
      if (document.visibilityState !== 'visible') return false;
      if (Date.now() - (this.last[key] || 0) < (this.idle() ? idleMs : activeMs) - 300) return false;
      this.last[key] = Date.now(); return true;
    } };
  CF.Activity.init();
  CF.poll = function (key, fn, activeMs, idleMs) {
    let busy = false;
    const tick = async (force) => { if (busy) return; if (!force && !CF.Activity.due(key, activeMs, idleMs)) return; busy = true; try { await fn(); } catch (e) { } busy = false; };
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { CF.Activity.last[key] = 0; tick(); } });
    return { stop: () => clearInterval(id), now: () => { CF.Activity.last[key] = Date.now(); return tick(true); } };
  };

  // ---------- Status koneksi ----------
  let onlineState = true;
  CF.online = function (v) { if (v === onlineState) return; onlineState = v; document.querySelectorAll('.conn').forEach(el => el.classList.toggle('off', !v)); };

  // ---------- Format ----------
  CF.sleep = ms => new Promise(r => setTimeout(r, ms));
  CF.esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  CF.rp = n => { n = Math.round(Number(n) || 0); return (n < 0 ? '-Rp ' : 'Rp ') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  CF.num = n => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const wib = ms => new Date(Number(ms) + 7 * 3600e3);
  const p2 = n => (n < 10 ? '0' : '') + n;
  CF.jam = ms => { if (!ms) return '-'; const d = wib(ms); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
  CF.tgl = ms => { if (!ms) return '-'; const d = wib(ms); return d.getUTCDate() + ' ' + BLN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  CF.tglJam = ms => ms ? CF.tgl(ms) + ', ' + CF.jam(ms) : '-';
  CF.isoHari = (ms) => { const d = wib(ms || Date.now()); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
  CF.lalu = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); if (s < 45) return 'baru saja'; const m = Math.round(s / 60); if (m < 60) return m + ' mnt lalu'; const h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu'; return CF.tgl(ms); };
  CF.durasi = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return p2(Math.floor(s / 60)) + ':' + p2(s % 60); };
  CF.inisial = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  CF.debounce = (fn, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; };
  CF.LABEL_METODE = { tunai: 'Tunai', debit: 'Kartu Debit', kredit: 'Kartu Kredit', qris_kasir: 'QRIS di Kasir', kasir: 'Bayar di Kasir', transfer: 'Transfer Bank', qris_statis: 'QRIS', qris: 'QRIS Dinamis', gopay: 'GoPay', shopeepay: 'ShopeePay', va_bca: 'VA BCA', va_bni: 'VA BNI', va_bri: 'VA BRI' };

  // ---------- Ikon garis (gaya Lucide) ----------
  const I = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
    arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', arrowL: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    checkC: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>', lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    bank: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4Z"/>', cash: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>', image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2"/><path d="M10 2v2"/><path d="M14 2v2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    tag: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>', percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    filter: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
    menu: '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    chart: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>', trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>', edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    vol: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>', volX: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    max: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    drops: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>',
    chef: '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.19 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
    concierge: '<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M20 16a8 8 0 1 0-16 0"/><path d="M12 4v4"/><path d="M10 4h4"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2.7 2.7 0 0 1-4 0 2 2 0 0 1-2-2V7"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>', history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    approve: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', tv: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
    note: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', grip: '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>', phoneM: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><path d="m2 2 20 20"/>',
    star: '<path d="M11.5 2.3a.5.5 0 0 1 .9 0l2.6 5.3a.5.5 0 0 0 .4.3l5.8.8a.5.5 0 0 1 .3.9l-4.2 4.1a.5.5 0 0 0-.2.5l1 5.8a.5.5 0 0 1-.7.5l-5.2-2.7a.5.5 0 0 0-.5 0l-5.2 2.7a.5.5 0 0 1-.7-.5l1-5.8a.5.5 0 0 0-.2-.5L2.5 8.8a.5.5 0 0 1 .3-.9l5.8-.8a.5.5 0 0 0 .4-.3Z"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>'
  };
  CF.ic = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || I.info) + '</svg>';

  // ---------- Tema (warna dari Pengaturan) ----------
  function hexRgb(h) { h = String(h || '').replace('#', ''); if (h.length !== 6) return null; return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
  function rgbHex(c) { return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  CF.mix = (hex, to, t) => { const a = hexRgb(hex), b = hexRgb(to); if (!a || !b) return hex; return rgbHex(a.map((v, i) => v + (b[i] - v) * t)); };
  CF.luminance = hex => { const c = hexRgb(hex); if (!c) return 1; const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  CF.contrast = (a, b) => { const x = CF.luminance(a), y = CF.luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  CF.applyTheme = function (set) {
    if (!set) return;
    const r = document.documentElement.style, p = /^#[0-9a-f]{6}$/i.test(set.warna_primer) ? set.warna_primer : '#C2410C', a = /^#[0-9a-f]{6}$/i.test(set.warna_aksen) ? set.warna_aksen : '#F97316';
    r.setProperty('--primary', p); r.setProperty('--primary-hover', CF.mix(p, '#000000', .2)); r.setProperty('--primary-press', CF.mix(p, '#000000', .35));
    r.setProperty('--on-primary', CF.contrast(p, '#FFFFFF') >= 3 ? '#FFFFFF' : '#1F2937');
    r.setProperty('--accent', a); r.setProperty('--accent-tint', CF.mix(a, '#FFFFFF', .9)); r.setProperty('--accent-line', CF.mix(a, '#FFFFFF', .5));
    const fav = document.querySelector('link[rel=icon]');
    if (set.logo_thumb_url && fav) fav.href = set.logo_thumb_url;
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = p;
  };
  CF.logoHtml = (set, cls) => set && (set.logo_thumb_url || set.logo_url) ? '<img src="' + CF.esc(set.logo_thumb_url || set.logo_url) + '" alt="" loading="lazy">' : CF.ic('coffee', cls || 'lg');
  // Placeholder foto menu yang rapi (tanpa gambar)
  CF.ph = (nama, alt) => '<div class="ph' + (alt ? ' alt' : '') + '" style="width:100%;height:100%">' + CF.ic(alt ? 'car' : 'utensils') + '<span class="ini">' + CF.esc(CF.inisial(nama)) + '</span></div>';
  CF.img = (url, nama, alt) => url ? '<img src="' + CF.esc(url) + '" alt="' + CF.esc(nama) + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{style:\'width:100%;height:100%\',innerHTML:CF.ph(\'' + CF.esc(String(nama).replace(/'/g, '')) + '\',' + (alt ? 1 : 0) + ')}))">' : CF.ph(nama, alt);

  // ---------- Toast ----------
  CF.toast = function (msg, type, ms) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast ' + (type || 'ok'); el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.innerHTML = CF.ic(type === 'err' ? 'alert' : type === 'warn' ? 'alert' : type === 'info' ? 'info' : 'checkC') + '<div class="grow">' + CF.esc(msg) + '</div><button aria-label="Tutup">' + CF.ic('x', 'sm') + '</button>';
    el.querySelector('button').onclick = () => el.remove();
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), ms || (type === 'err' ? 6000 : 4000));
  };
  CF.err = (r, def) => CF.toast((r && r.error && r.error.pesan) || def || 'Terjadi kesalahan.', 'err');

  // ---------- Modal / bottom sheet ----------
  CF.modal = function (o) {
    const bd = document.createElement('div'); bd.className = 'backdrop';
    bd.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + CF.esc(o.title || '') + '">' +
      (o.title !== null ? '<div class="modal-head">' + (o.icon || '') + '<h3>' + CF.esc(o.title || '') + '</h3><button class="btn btn-ghost btn-icon btn-sm" data-x aria-label="Tutup">' + CF.ic('x') + '</button></div>' : '') +
      '<div class="modal-body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
    const prev = document.activeElement;
    const close = (v) => { if (!bd.isConnected) return; bd.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); if (o.onClose) o.onClose(v); };
    const onKey = e => { if (e.key === 'Escape' && o.dismiss !== false) close(); if (e.key === 'Tab') trap(e); };
    const trap = e => { const f = bd.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
    bd.addEventListener('click', e => { if (e.target === bd && o.dismiss !== false) close(); if (e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bd);
    const first = bd.querySelector(o.focus || 'input,select,textarea,.modal-foot .btn-primary,.modal-foot .btn'); if (first) setTimeout(() => first.focus(), 30);
    const m = { el: bd, close: close, $: s => bd.querySelector(s), $$: s => bd.querySelectorAll(s) };
    if (o.onOpen) o.onOpen(m);
    return m;
  };
  // Konfirmasi (opsional dengan input alasan) → Promise<false | true | string>
  // Kartu pop-up sambutan — dipakai halaman pelanggan & pratinjau di Pengaturan
  // o: { meja, promo:{nama,kode,min}, mode:'meja'|'pl', showMenu }
  CF.welcomeCard = (st, o) => {
    o = o || {}; const e = CF.esc, ic = CF.ic, img = st.sambutan_gambar_url, pl = o.mode === 'pl';
    const ch = pl
      ? [{ h: 'pricelist', g: 'all', i: 'car', t: 'Lihat Harga Car Wash', s: 'Layanan cuci & perawatan kendaraan' }]
        .concat(o.showMenu === false ? [] : [{ h: 'pricelist', g: '__menu', i: 'coffee', t: 'Lihat Menu Cafe', s: 'Kopi, makanan & camilan kami' }])
      : [{ h: 'menu', i: 'utensils', t: 'Pesan Makanan & Minuman', s: 'Pilih menu, pesan & bayar langsung dari HP' },
        { h: 'pricelist', g: 'all', i: 'car', t: 'Price List Car Wash', s: 'Lihat harga cuci kendaraan sambil bersantai' }];
    const info = [st.jam_buka ? ic('clock', 'sm') + e(st.jam_buka) : '', st.alamat ? ic('pin', 'sm') + e(st.alamat) : ''].filter(Boolean);
    return '<div class="wl-card"><div class="wl-hero' + (img ? ' img" style="background-image:url(\'' + e(img) + '\')">' : '">' +
        '<span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span><div class="wl-art"><span class="a1">' + ic('coffee') + '</span><span class="a2">' + ic('sparkles') + '</span><span class="a3">' + ic('car') + '</span></div>') +
      (o.meja ? '<span class="wl-pill">' + ic('qr', 'sm') + 'Meja ' + e(o.meja) + '</span>' : '') +
      '<button class="wl-x" data-act="sambut" aria-label="Tutup">' + ic('x') + '</button></div>' +
      '<div class="wl-logo">' + CF.logoHtml(st) + '</div><div class="wl-body"><div class="wl-eyebrow">' + e(st.sambutan_judul || 'Selamat Datang di') + '</div>' +
      '<h2 id="wl-t">' + e(st.nama_aplikasi || 'CafeFlow') + '</h2>' +
      (st.sambutan_label ? '<div class="wl-tag">' + ic('coffee', 'sm') + '<span>' + e(st.sambutan_label) + '</span>' + ic('car', 'sm') + '</div>' : '') +
      (st.sambutan_subjudul ? '<p class="wl-sub">' + e(st.sambutan_subjudul) + '</p>' : '') +
      (o.promo ? '<div class="wl-promo"><span class="pi">' + ic('percent') + '</span><div><b>' + e(o.promo.nama || o.promo.kode) + '</b><span>Pakai kode <b>' + e(o.promo.kode) + '</b>' + (o.promo.min ? ' • <span style="white-space:nowrap">min. ' + CF.rp(o.promo.min) + '</span>' : '') + '</span></div></div>' : '') +
      '<div class="wl-choices">' + ch.map((c, i) => '<button class="wl-choice' + (i === 0 ? ' primary' : '') + '" data-act="sambut" data-h="' + c.h + '"' + (c.g ? ' data-g="' + c.g + '"' : '') + '>' +
        '<span class="ci">' + ic(c.i) + '</span><span class="ct"><b>' + c.t + '</b><small>' + c.s + '</small></span><span class="arr">' + ic('arrowR') + '</span></button>').join('') + '</div>' +
      (info.length ? '<div class="wl-info">' + info.map(x => '<span>' + x + '</span>').join('') + '</div>' : '') + '</div></div>';
  };
  CF.confirm = function (o) {
    return new Promise(res => {
      const inp = o.input ? '<div class="field mt-12"><label class="label" for="cf-cin">' + CF.esc(o.input.label) + (o.input.required ? ' <span class="req">*</span>' : '') + '</label>' +
        (o.input.options ? '<select class="select" id="cf-csel"><option value="">— Pilih alasan —</option>' + o.input.options.map(x => '<option>' + CF.esc(x) + '</option>').join('') + '</select>' : '') +
        '<textarea class="textarea" id="cf-cin" placeholder="' + CF.esc(o.input.placeholder || '') + '" style="min-height:72px' + (o.input.options ? ';margin-top:8px' : '') + '"></textarea><div class="err-msg hide" id="cf-cerr">' + CF.ic('alert', 'sm') + ' Wajib diisi (min. 3 huruf).</div></div>' : '';
      let done = false;
      const m = CF.modal({ title: o.title || 'Konfirmasi', size: 'sm', body: '<p class="muted">' + (o.html || CF.esc(o.msg || '')) + '</p>' + inp,
        foot: '<button class="btn btn-secondary" data-x>' + CF.esc(o.cancel || 'Batal') + '</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + CF.esc(o.ok || 'Ya, lanjutkan') + '</button>',
        onClose: () => { if (!done) res(false); } });
      m.$('[data-ok]').onclick = () => {
        let v = true;
        if (o.input) {
          const sel = m.$('#cf-csel'), t = m.$('#cf-cin').value.trim();
          v = [sel && sel.value, t].filter(Boolean).join(' — ');
          if (o.input.required && v.length < 3) { m.$('#cf-cerr').classList.remove('hide'); m.$('#cf-cin').classList.add('bad'); return; }
        }
        done = true; m.close(); res(v);
      };
    });
  };
  // Tombol dengan status memuat
  CF.busy = async function (btn, fn) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1'; const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.loading || 'Memproses…');
    try { return await fn(); } finally { delete btn.dataset.busy; if (btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
  };

  // ---------- Suara notifikasi (WebAudio, tanpa file) ----------
  let actx = null;
  CF.sound = {
    on: CF.store.get('sound', true),
    unlocked: false,
    unlock() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); this.unlocked = true; } catch (e) { } },
    set(v) { this.on = v; CF.store.set('sound', v); if (v) this.unlock(); },
    beep(kind) {
      if (!this.on || !actx) return;
      try {
        const seq = kind === 'ready' ? [[880, 0], [1175, .18], [1568, .36]] : kind === 'call' ? [[660, 0], [880, .2], [660, .4], [880, .6]] : [[784, 0], [1047, .16]];
        seq.forEach(([f, t]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, actx.currentTime + t); g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + t + .16); o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .18); });
      } catch (e) { }
    }
  };
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (!CF.sound.unlocked && CF.sound.on) CF.sound.unlock(); }, { once: true }));
  CF.vibrate = p => { try { if (navigator.vibrate) navigator.vibrate(p || [120, 60, 120]); } catch (e) { } };

  // ---------- Gambar: kompres di browser sebelum unggah ----------
  CF.fileToB64 = function (file, o) {
    o = o || {};
    return new Promise((res, rej) => {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Pilih gambar JPG, PNG, atau WebP.'));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
        if (o.square) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s; }
        const max = o.max || 1200, k = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; if (!o.keepAlpha) g.fillRect(0, 0, c.width, c.height); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        const type = o.keepAlpha ? 'image/png' : 'image/jpeg';
        let q = o.quality || .82, data = c.toDataURL(type, q);
        while (!o.keepAlpha && data.length > (o.maxBytes || 400000) * 1.37 && q > .4) { q -= .1; data = c.toDataURL(type, q); }
        res({ type: type, b64: data.split(',')[1], preview: data, w: c.width, h: c.height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca.')); };
      img.src = url;
    });
  };
  CF.download = function (name, b64, mime) {
    const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime || 'application/octet-stream' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  CF.copy = async function (text, msg) {
    try { await navigator.clipboard.writeText(text); CF.toast(msg || 'Disalin.', 'ok', 2000); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); CF.toast(msg || 'Disalin.', 'ok', 2000); }
  };
  // Pemberitahuan bila config.js belum diisi
  CF.configScreen = function (root) {
    root.innerHTML = '<div class="auth"><div class="auth-card center"><div class="logo">' + CF.ic('settings', 'xl') + '</div><h2>Konfigurasi belum lengkap</h2>' +
      '<p class="muted">Isi alamat Web App Google Apps Script (berakhiran <span class="code">/exec</span>) di berkas <span class="code">js/config.js</span>, lalu unggah ulang ke GitHub.</p></div></div>';
  };
  // Delegasi klik: elemen dengan data-act="nama" memanggil CF.acts[nama](el, event)
  CF.acts = {};
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = CF.acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
})();
