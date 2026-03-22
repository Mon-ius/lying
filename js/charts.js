/**
 * Canvas-based publication-quality chart rendering.
 * Depends on: engine.js (for data structures), app.js (for getEffectiveTheme).
 */

/* ---- Theme & color palette ---- */
function _isDark() { return typeof getEffectiveTheme === 'function' && getEffectiveTheme() === 'dark'; }

function TH() {
  return _isDark()
    ? { bg: '#0d1117', grid: '#1e242e', axis: '#3d4450', txt: '#8b949e', txtB: '#c9d1d9' }
    : { bg: '#fafbfc', grid: '#eef0f3', axis: '#c0c4cc', txt: '#6b7080', txtB: '#3d4250' };
}

const CL = {
  risk_loving: '#dc2626', risk_neutral: '#d97706', risk_averse: '#2563eb',
  equilibrium: '#2563eb', lying_averse: '#16a34a', deception_averse: '#dc2626', inference_error: '#d97706',
  cl: '#be185d', cd: '#4338ca', alpha: '#0d9488', beta: '#c2410c',
};

/* ---- Canvas helpers ---- */
function gCtx(id) {
  const c = document.getElementById(id);
  const r = window.devicePixelRatio || 2;
  c.width = c.offsetWidth * r;
  c.height = c.offsetHeight * r;
  const x = c.getContext('2d');
  x.scale(r, r);
  return { x, w: c.offsetWidth, h: c.offsetHeight };
}

function drawGrid(x, pad, w, h, nx, ny, t) {
  x.strokeStyle = t.grid; x.lineWidth = .5;
  for (let i = 0; i <= nx; i++) { const px = pad + (i / nx) * w; x.beginPath(); x.moveTo(px, pad); x.lineTo(px, pad + h); x.stroke(); }
  for (let i = 0; i <= ny; i++) { const py = pad + (i / ny) * h; x.beginPath(); x.moveTo(pad, py); x.lineTo(pad + w, py); x.stroke(); }
}

function drawAxes(x, pad, w, h, xLbl, yLbl, t) {
  x.strokeStyle = t.axis; x.lineWidth = 1;
  x.beginPath(); x.moveTo(pad, pad); x.lineTo(pad, pad + h); x.lineTo(pad + w, pad + h); x.stroke();
  x.fillStyle = t.txt; x.font = '500 10px Inter,sans-serif'; x.textAlign = 'center';
  x.fillText(xLbl, pad + w / 2, pad + h + 28);
  x.save(); x.translate(10, pad + h / 2); x.rotate(-Math.PI / 2); x.fillText(yLbl, 0, 0); x.restore();
}

/* ---- Histogram with optional KDE ---- */
function histogram(x, data, pad, w, h, bins, color, t, showKDE) {
  if (!data.length) return;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const cnts = Array(bins).fill(0);
  for (const v of data) { const b = Math.min(Math.floor((v - mn) / rng * bins), bins - 1); cnts[b]++; }
  const mxC = Math.max(...cnts), bw = w / bins;
  for (let i = 0; i < bins; i++) {
    const bh = mxC > 0 ? (cnts[i] / mxC) * h * .82 : 0;
    x.fillStyle = color; x.globalAlpha = .35;
    const rx = pad + i * bw + 1, ry = pad + h - bh, rw = bw - 2, rh = bh;
    x.beginPath(); x.roundRect ? x.roundRect(rx, ry, rw, rh, 2) : x.rect(rx, ry, rw, rh); x.fill();
  }
  x.globalAlpha = 1;
  if (showKDE && data.length > 3) {
    const bwk = rng / Math.sqrt(data.length) * 1.5, steps = 80;
    let mxY = 0; const ys = [];
    for (let i = 0; i <= steps; i++) {
      const xv = mn + (i / steps) * rng; let d = 0;
      for (const v of data) { const z = (xv - v) / bwk; d += Math.exp(-.5 * z * z) / (bwk * 2.507); }
      d /= data.length; ys.push(d); if (d > mxY) mxY = d;
    }
    x.beginPath(); x.strokeStyle = color; x.lineWidth = 2;
    for (let i = 0; i <= steps; i++) {
      const px = pad + (i / steps) * w, py = pad + h - (mxY > 0 ? ys[i] / mxY * h * .82 : 0);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  x.fillStyle = t.txt; x.font = '10px JetBrains Mono,monospace'; x.textAlign = 'center';
  x.fillText(mn.toFixed(1), pad, pad + h + 12);
  x.fillText(mx.toFixed(1), pad + w, pad + h + 12);
}

/* ---- Annotation helper ---- */
function drawNote(x, text, nx, ny, t) {
  x.fillStyle = t.txt; x.globalAlpha = .7;
  x.font = '500 9px Inter,sans-serif'; x.textAlign = 'left';
  x.fillText(text, nx, ny);
  x.globalAlpha = 1;
}

/* ==================================================================
   PLOT FUNCTIONS
   ================================================================== */

/** 1. Utility Parameter Distributions — 2x2 grid with KDE */
function plotParams(agents) {
  const { x, w, h } = gCtx('c-params'), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = 20, gap = 28, pw = (w - 2 * pad - gap) / 2, ph = (h - 2 * pad - gap) / 2;
  const items = [
    { k: 'cl',    l: 'c\u2097 (lying cost)',    c: CL.cl },
    { k: 'cd',    l: 'c_d (deception cost)', c: CL.cd },
    { k: 'alpha', l: '\u03b1 (risk aversion)',   c: CL.alpha },
    { k: 'beta',  l: '\u03b2 (altruism)',        c: CL.beta },
  ];
  items.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const px = pad + col * (pw + gap), py = pad + row * (ph + gap);
    const data = agents.map(a => a[p.k]);
    const hh = ph - 30; // leave room for title + tick labels
    // Draw histogram in translated sub-plot
    x.save(); x.translate(px, py + 16);
    histogram(x, data, 0, pw, hh, 22, p.c, t, true);
    x.restore();
    // Title
    x.fillStyle = p.c; x.font = '600 10px Inter,sans-serif'; x.textAlign = 'left';
    x.fillText(p.l, px + 2, py + 10);
    // Mean
    const m = data.reduce((a, b) => a + b, 0) / data.length;
    x.fillStyle = t.txt; x.font = '10px JetBrains Mono,monospace'; x.textAlign = 'right';
    x.fillText('\u03bc=' + m.toFixed(2), px + pw - 2, py + 10);
  });
  // Note
  drawNote(x, 'LogNormal draws \u00b7 KDE overlay \u00b7 Histogram+density', pad, h - 4, t);
}

/** 2. Joint (c_l, c_d) scatter — colored by classification */
function plotJoint(agents) {
  const { x, w, h } = gCtx('c-joint'), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = 42, pw = w - 2 * pad, ph = h - 2 * pad;
  const cls = agents.map(a => a.cl), cds = agents.map(a => a.cd);
  const mxCl = Math.min(Math.max(...cls) * 1.1, 15), mxCd = Math.min(Math.max(...cds) * 1.1, 15);
  drawGrid(x, pad, pw, ph, 5, 5, t);
  drawAxes(x, pad, pw, ph, 'Lying cost c\u2097', 'Deception cost c_d', t);
  x.fillStyle = t.txt; x.font = '10px JetBrains Mono,monospace'; x.textAlign = 'center';
  x.fillText('0', pad, pad + ph + 14); x.fillText(mxCl.toFixed(1), pad + pw, pad + ph + 14);
  x.textAlign = 'right'; x.fillText(mxCd.toFixed(1), pad - 4, pad + 6);
  for (const a of agents) {
    const px = pad + (a.cl / mxCl) * pw, py = pad + ph - (a.cd / mxCd) * ph;
    x.fillStyle = CL[a.classification] || '#999'; x.globalAlpha = .55;
    x.beginPath(); x.arc(px, py, 3.5, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  // Legend
  const legs = [['equilibrium', 'Eq'], ['lying_averse', 'LA'], ['deception_averse', 'DA'], ['inference_error', 'IE']];
  legs.forEach(([k, l], i) => {
    x.fillStyle = CL[k]; x.beginPath(); x.arc(pad + pw - 8, pad + 10 + i * 15, 4, 0, Math.PI * 2); x.fill();
    x.fillStyle = t.txt; x.font = '10px Inter,sans-serif'; x.textAlign = 'right';
    x.fillText(l, pad + pw - 16, pad + 14 + i * 15);
  });
  drawNote(x, 'High c_d \u2192 deception-averse \u00b7 High c\u2097 \u2192 lying-averse', pad + 2, pad + ph + 28, t);
}

/** 3. Strategy distribution — BT or GL histogram with notes */
function plotStrat(R, gt) {
  const cid = gt === 'BT' ? 'c-strat-bt' : 'c-strat-gl';
  const { x, w, h } = gCtx(cid), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = 42, pw = w - 2 * pad, ph = h - 2 * pad - 20; // reserve bottom for notes
  const strats = gt === 'BT' ? R.btS : R.glS, vals = Object.values(strats);
  if (!vals.length) { x.fillStyle = t.txt; x.textAlign = 'center'; x.fillText('No data', w / 2, h / 2); return; }
  drawGrid(x, pad, pw, ph, 10, 4, t);
  drawAxes(x, pad, pw, ph, 'Truth-telling probability', 'Observations (%)', t);
  const bins = 20, cnts = Array(bins).fill(0);
  for (const v of vals) { const b = Math.min(Math.floor(v * bins), bins - 1); cnts[b]++; }
  const pcts = cnts.map(c => c / vals.length * 100), mxP = Math.max(...pcts, 1), bw = pw / bins;
  const col = gt === 'BT' ? '#2563eb' : '#dc2626';
  for (let i = 0; i < bins; i++) {
    const bh = (pcts[i] / mxP) * ph;
    x.fillStyle = col; x.globalAlpha = .45;
    x.beginPath();
    x.roundRect ? x.roundRect(pad + i * bw + 1, pad + ph - bh, bw - 2, bh, 2) : x.rect(pad + i * bw + 1, pad + ph - bh, bw - 2, bh);
    x.fill();
  }
  x.globalAlpha = 1;
  // Equilibrium prediction line
  const eq = gt === 'BT' ? 1 : 0, eqX = pad + eq * pw;
  x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([6, 4]);
  x.beginPath(); x.moveTo(eqX, pad); x.lineTo(eqX, pad + ph); x.stroke(); x.setLineDash([]);
  // Tick labels
  x.fillStyle = t.txt; x.font = '10px JetBrains Mono,monospace'; x.textAlign = 'center';
  for (let i = 0; i <= 10; i++) x.fillText((i / 10).toFixed(1), pad + (i / 10) * pw, pad + ph + 14);
  // Stats
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  x.fillStyle = t.txtB; x.font = '600 11px Inter,sans-serif'; x.textAlign = 'left';
  x.fillText('\u03bc = ' + avg.toFixed(3), pad + 6, pad + 14);
  // Variable definition notes
  x.fillStyle = t.txt; x.font = '500 9px Inter,sans-serif';
  if (gt === 'BT') {
    x.fillText('v = P(m=1|\u03b8=0): prob. bad type lies when \u03b8=0', pad + 6, pad + 28);
    x.fillText('Eq. predicts p=1.0 (truth) \u00b7 Dashed = eq. prediction', pad + 6, pad + 40);
    drawNote(x, 'Prop. 3: deviation driven by c_d (deception aversion)', pad, h - 4, t);
  } else {
    x.fillText('w = P(m=0|\u03b8=1): prob. good type lies when \u03b8=1', pad + 6, pad + 28);
    x.fillText('Eq. predicts p=0.0 (lie) \u00b7 Dashed = eq. prediction', pad + 6, pad + 40);
    drawNote(x, 'Prop. 4: deviation driven by c\u2097 (lying aversion)', pad, h - 4, t);
  }
}

/** 4. Agent type proportions — dual horizontal bar chart */
function plotTypes(agents) {
  const { x, w, h } = gCtx('c-types'), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const n = agents.length, pad = 24;
  const risk = {}, cls = {};
  for (const a of agents) {
    risk[a.riskType] = (risk[a.riskType] || 0) + 1;
    cls[a.classification] = (cls[a.classification] || 0) + 1;
  }
  const drawH = (data, y0, title, ht) => {
    x.fillStyle = t.txtB; x.font = '600 11px Inter,sans-serif'; x.textAlign = 'left';
    x.fillText(title, pad, y0);
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const barH = Math.min(22, ht / entries.length - 4), maxW = w - 2 * pad - 130;
    entries.forEach(([k, v], i) => {
      const pct = v / n, bw = pct * maxW, by = y0 + 10 + i * (barH + 5);
      x.fillStyle = t.grid;
      x.beginPath(); x.roundRect ? x.roundRect(pad, by, maxW, barH, 3) : x.rect(pad, by, maxW, barH); x.fill();
      x.fillStyle = CL[k] || '#888'; x.globalAlpha = .7;
      x.beginPath(); x.roundRect ? x.roundRect(pad, by, bw, barH, 3) : x.rect(pad, by, bw, barH); x.fill();
      x.globalAlpha = 1;
      x.fillStyle = t.txtB; x.font = '500 10px Inter,sans-serif'; x.textAlign = 'left';
      x.fillText(k.replace(/_/g, ' '), pad + bw + 8, by + barH - 5);
      x.fillStyle = t.txt; x.font = '600 10px JetBrains Mono,monospace'; x.textAlign = 'right';
      x.fillText((pct * 100).toFixed(0) + '%', w - pad, by + barH - 5);
    });
  };
  const half = (h - 2 * pad) / 2 - 8;
  drawH(risk, pad + 8, 'Risk attitudes (configured)', half);
  drawH(cls, pad + half + 28, 'Behavioral classification (inferred, Fig. 5)', half);
  drawNote(x, 'Top = input composition \u00b7 Bottom = observed strategy classification', pad, h - 4, t);
}

/** 5. Equilibrium regions — heatmap in (c_d, c_l) space */
function plotRegions(agents) {
  const { x: c, w, h } = gCtx('c-regions'), t = TH();
  c.fillStyle = t.bg; c.fillRect(0, 0, w, h);
  const pad = 42, pw = w - 2 * pad, ph = h - 2 * pad - 16, mx = 5; // reserve bottom for note
  const dark = _isDark();
  // Region fill via ImageData — theme-aware blending
  const id = c.createImageData(pw, ph);
  const bc = dark ? [13, 17, 23] : [250, 251, 252];
  const regionColors = [
    [37, 99, 235],   // blue  — full reputation
    [217, 119, 6],   // amber — partial
    [220, 38, 38],   // red   — no reputation
  ];
  const alpha = dark ? 0.18 : 0.08;
  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const cd = (px / pw) * mx, cl = (1 - py / ph) * mx;
      const u = .8 * cd + .2, lo = .3 * cd;
      const ri = cl > u ? 0 : cl > lo ? 1 : 2;
      const rc = regionColors[ri];
      const idx = (py * pw + px) * 4;
      id.data[idx]     = bc[0] + (rc[0] - bc[0]) * alpha | 0;
      id.data[idx + 1] = bc[1] + (rc[1] - bc[1]) * alpha | 0;
      id.data[idx + 2] = bc[2] + (rc[2] - bc[2]) * alpha | 0;
      id.data[idx + 3] = 255;
    }
  }
  c.putImageData(id, pad, pad);
  drawGrid(c, pad, pw, ph, 5, 5, t);
  drawAxes(c, pad, pw, ph, 'Deception cost c_d', 'Lying cost c\u2097', t);
  // Boundary lines
  c.strokeStyle = t.axis; c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i <= 100; i++) { const cd = (i / 100) * mx, cl = .8 * cd + .2, px = pad + (cd / mx) * pw, py = pad + (1 - cl / mx) * ph; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke();
  c.setLineDash([5, 4]); c.beginPath();
  for (let i = 0; i <= 100; i++) { const cd = (i / 100) * mx, cl = .3 * cd, px = pad + (cd / mx) * pw, py = pad + (1 - cl / mx) * ph; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke(); c.setLineDash([]);
  // Agent dots
  for (const a of agents) {
    if (a.cl > mx || a.cd > mx) continue;
    c.fillStyle = CL[a.classification] || '#999'; c.globalAlpha = .55;
    c.beginPath(); c.arc(pad + (a.cd / mx) * pw, pad + (1 - a.cl / mx) * ph, 3.2, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Region labels
  const la = dark ? .7 : .55;
  c.font = '600 11px Inter,sans-serif'; c.textAlign = 'left';
  c.fillStyle = `rgba(37,99,235,${la})`; c.fillText('Full reputation', pad + 6, pad + 16);
  c.fillStyle = `rgba(217,119,6,${la})`; c.fillText('Partial', pad + pw * .35, pad + ph * .48);
  c.fillStyle = `rgba(220,38,38,${la})`; c.fillText('No reputation', pad + pw * .6, pad + ph - .8);
  // Ticks
  c.fillStyle = t.txt; c.font = '10px JetBrains Mono,monospace'; c.textAlign = 'center';
  for (let i = 0; i <= 5; i++) { c.fillText(i.toFixed(0), pad + (i / 5) * pw, pad + ph + 14); c.textAlign = 'right'; c.fillText(i.toFixed(0), pad - 4, pad + ph - (i / 5) * ph + 4); c.textAlign = 'center'; }
  // Note
  drawNote(c, 'Props. 3 & 4 \u00b7 Solid = full/partial boundary \u00b7 Dashed = partial/none boundary', pad, h - 4, t);
}

/** Redraw all charts from cached data */
function redrawAll(agents, R) {
  if (!agents) return;
  plotParams(agents);
  plotJoint(agents);
  if (R) { plotStrat(R, 'BT'); plotStrat(R, 'GL'); }
  plotTypes(agents);
  plotRegions(agents);
}
