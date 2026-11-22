/* =====================================================================
   CafeFlow — grafik SVG ringan (tanpa pustaka luar)
   Spesifikasi: garis 2px, area 10%, bar ≤ 22px dengan ujung bulat 4px,
   grid hairline, label selektif, tooltip saat hover, tabel tersembunyi
   untuk pembaca layar. Warna seri: #EA580C (lolos validasi palet).
   ===================================================================== */
(function () {
  'use strict';
  const SERIES = '#EA580C', GRID = '#EEF0F3', AXIS = '#9CA3AF';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const compact = n => { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M'; if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' jt'; if (a >= 1e4) return Math.round(n / 1e3) + ' rb'; return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  let tip = null;
  function showTip(e, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    const x = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14), y = Math.max(8, e.clientY - tip.offsetHeight - 10);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function srTable(data, fmt, cap) { return '<table class="sr-only"><caption>' + esc(cap || '') + '</caption>' + data.map(d => '<tr><th>' + esc(d.label) + '</th><td>' + esc(fmt(d.v)) + '</td></tr>').join('') + '</table>'; }
  // Bentuk bar dengan ujung data membulat 4px & pangkal persegi
  function barPath(x, y, w, h, horiz) {
    const r = Math.min(4, horiz ? h / 2 : w / 2, horiz ? w : h);
    if (w <= 0 || h <= 0) return '';
    if (horiz) return 'M' + x + ',' + y + 'h' + (w - r) + 'q' + r + ',0 ' + r + ',' + r + 'v' + (h - 2 * r) + 'q0,' + r + ' -' + r + ',' + r + 'h-' + (w - r) + 'z';
    return 'M' + x + ',' + (y + h) + 'v-' + (h - r) + 'q0,-' + r + ' ' + r + ',-' + r + 'h' + (w - 2 * r) + 'q' + r + ',0 ' + r + ',' + r + 'v' + (h - r) + 'z';
  }
  function observe(el, draw) {
    draw();
    if (el._ro) el._ro.disconnect();
    let w = el.clientWidth;
    el._ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
    el._ro.observe(el);
  }
  const CFChart = {
    // Tren (garis + area) — data: [{label, v}]
    area(el, data, o) {
      o = o || {}; const fmt = o.fmt || compact;
      observe(el, () => {
        const W = Math.max(260, el.clientWidth), H = o.h || 220, L = 52, R = 16, T = 18, B = 28, iw = W - L - R, ih = H - T - B;
        if (!data.length) { el.innerHTML = '<div class="empty small">Belum ada data.</div>'; return; }
        const max = niceMax(Math.max.apply(null, data.map(d => d.v)) * 1.08), n = data.length;
        const X = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1)), Y = v => T + ih - v / max * ih;
        let s = '';
        for (let k = 0; k <= 4; k++) { const v = max * k / 4, y = Y(v); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + compact(v) + '</text>'; }
        const step = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
        data.forEach((d, i) => { if (i % step === 0 || i === n - 1) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>'; });
        const pts = data.map((d, i) => X(i) + ',' + Y(d.v)).join(' ');
        s += '<polygon points="' + L + ',' + Y(0) + ' ' + pts + ' ' + X(n - 1) + ',' + Y(0) + '" fill="' + SERIES + '" fill-opacity=".1"/>';
        s += '<polyline points="' + pts + '" fill="none" stroke="' + SERIES + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
        const last = data[n - 1];
        s += '<circle cx="' + X(n - 1) + '" cy="' + Y(last.v) + '" r="5" fill="' + SERIES + '" stroke="#fff" stroke-width="2"/>';
        s += '<text class="lbl-v" x="' + Math.min(W - R, X(n - 1)) + '" y="' + (Y(last.v) - 10) + '" text-anchor="end">' + esc(fmt(last.v)) + '</text>';
        s += '<line class="xh" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" stroke="' + AXIS + '" stroke-width="1" visibility="hidden"/><circle class="xd" r="5" fill="' + SERIES + '" stroke="#fff" stroke-width="2" visibility="hidden"/>';
        s += '<rect x="' + L + '" y="' + T + '" width="' + iw + '" height="' + ih + '" fill="transparent" class="hit"/>';
        el.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Grafik tren') + '">' + s + '</svg>' + srTable(data, fmt, o.title);
        const svg = el.querySelector('svg'), hit = svg.querySelector('.hit'), xh = svg.querySelector('.xh'), xd = svg.querySelector('.xd');
        const move = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width; let i = n === 1 ? 0 : Math.round((x - L) / iw * (n - 1)); i = Math.max(0, Math.min(n - 1, i)); xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible'); xd.setAttribute('cx', X(i)); xd.setAttribute('cy', Y(data[i].v)); xd.setAttribute('visibility', 'visible'); showTip(e, '<b>' + esc(data[i].full || data[i].label) + '</b><br>' + esc(fmt(data[i].v)) + (data[i].extra ? '<br>' + esc(data[i].extra) : '')); };
        hit.addEventListener('pointermove', move); hit.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); hideTip(); });
      });
    },
    // Bar horizontal (peringkat) — data: [{label, v}]
    hbar(el, data, o) {
      o = o || {}; const fmt = o.fmt || compact;
      observe(el, () => {
        if (!data.length) { el.innerHTML = '<div class="empty small">Belum ada data.</div>'; return; }
        const W = Math.max(260, el.clientWidth), rowH = 40, bh = 18, T = 4, H = T + data.length * rowH, labW = Math.min(170, W * 0.38), valW = 92, iw = W - labW - valW - 8;
        const max = Math.max.apply(null, data.map(d => d.v)) || 1;
        let s = '';
        data.forEach((d, i) => {
          const y = T + i * rowH + (rowH - bh) / 2, w = Math.max(2, d.v / max * iw);
          const lab = d.label.length > 24 ? d.label.slice(0, 22) + '…' : d.label;
          s += '<g class="hb" data-i="' + i + '"><rect x="0" y="' + (T + i * rowH) + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>' +
            '<text x="0" y="' + (y + bh / 2 + 4) + '" style="fill:var(--text);font-size:12.5px">' + esc(lab) + '</text>' +
            '<rect x="' + labW + '" y="' + y + '" width="' + iw + '" height="' + bh + '" rx="4" fill="#F4F5F7"/>' +
            '<path d="' + barPath(labW, y, w, bh, true) + '" fill="' + SERIES + '"/>' +
            '<text class="lbl-v" x="' + (labW + w + 8) + '" y="' + (y + bh / 2 + 4) + '">' + esc(fmt(d.v)) + '</text></g>';
        });
        el.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Grafik batang') + '">' + s + '</svg>' + srTable(data, fmt, o.title);
        el.querySelectorAll('.hb').forEach(g => { const d = data[+g.dataset.i]; g.addEventListener('pointermove', e => showTip(e, '<b>' + esc(d.label) + '</b><br>' + esc(fmt(d.v)) + (d.extra ? '<br>' + esc(d.extra) : ''))); g.addEventListener('pointerleave', hideTip); });
      });
    },
    // Kolom (mis. jam ramai) — data: [{label, v}]
    col(el, data, o) {
      o = o || {}; const fmt = o.fmt || compact;
      observe(el, () => {
        if (!data.length) { el.innerHTML = '<div class="empty small">Belum ada data.</div>'; return; }
        const W = Math.max(260, el.clientWidth), H = o.h || 200, L = 34, R = 8, T = 22, B = 26, iw = W - L - R, ih = H - T - B, n = data.length;
        const max = niceMax(Math.max.apply(null, data.map(d => d.v)) || 1), band = iw / n, bw = Math.min(22, band - 2);
        const Y = v => T + ih - v / max * ih;
        let s = '';
        for (let k = 0; k <= 2; k++) { const v = max * k / 2, y = Y(v); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + compact(v) + '</text>'; }
        let peak = 0; data.forEach((d, i) => { if (d.v > data[peak].v) peak = i; });
        const step = Math.ceil(n / Math.max(2, Math.floor(iw / 36)));
        data.forEach((d, i) => {
          const x = L + i * band + (band - bw) / 2, h = d.v / max * ih;
          s += '<g class="cb" data-i="' + i + '"><rect x="' + (L + i * band) + '" y="' + T + '" width="' + band + '" height="' + ih + '" fill="transparent"/>' + (d.v > 0 ? '<path d="' + barPath(x, Y(d.v), bw, h, false) + '" fill="' + SERIES + '" fill-opacity="' + (i === peak ? 1 : .55) + '"/>' : '') + '</g>';
          if (i % step === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
        });
        if (data[peak].v > 0) s += '<text class="lbl-v" x="' + (L + peak * band + band / 2) + '" y="' + (Y(data[peak].v) - 6) + '" text-anchor="middle">' + esc(fmt(data[peak].v)) + '</text>';
        el.innerHTML = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || 'Grafik kolom') + '">' + s + '</svg>' + srTable(data, fmt, o.title);
        el.querySelectorAll('.cb').forEach(g => { const d = data[+g.dataset.i]; g.addEventListener('pointermove', e => showTip(e, '<b>' + esc(d.full || d.label) + '</b><br>' + esc(fmt(d.v)))); g.addEventListener('pointerleave', hideTip); });
      });
    }
  };
  window.CFChart = CFChart;
})();
