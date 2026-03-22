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
  const pad = 20, gap = 28, noteH = 18;
  const pw = (w - 2 * pad - gap) / 2, ph = (h - 2 * pad - gap - noteH) / 2;
  const items = [
    { k: 'cl',    l: 'c_l (lying cost)',    c: CL.cl },
    { k: 'cd',    l: 'c_d (deception cost)', c: CL.cd },
    { k: 'alpha', l: '\u03b1 (risk aversion)',   c: CL.alpha },
    { k: 'beta',  l: '\u03b2 (altruism)',        c: CL.beta },
  ];
  items.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const px = pad + col * (pw + gap), py = pad + row * (ph + gap);
    const data = agents.map(a => a[p.k]);
    const hh = ph - 30;
    x.save(); x.translate(px, py + 16);
    histogram(x, data, 0, pw, hh, 22, p.c, t, true);
    x.restore();
    x.fillStyle = p.c; x.font = '600 10px Inter,sans-serif'; x.textAlign = 'left';
    x.fillText(p.l, px + 2, py + 10);
    const m = data.reduce((a, b) => a + b, 0) / data.length;
    x.fillStyle = t.txt; x.font = '10px JetBrains Mono,monospace'; x.textAlign = 'right';
    x.fillText('\u03bc=' + m.toFixed(2), px + pw - 2, py + 10);
  });
  drawNote(x, 'LogNormal draws \u00b7 KDE overlay \u00b7 Histogram+density', pad, h - 4, t);
}

/** 2. Joint (c_l, c_d) scatter — colored by classification */
function plotJoint(agents) {
  const { x, w, h } = gCtx('c-joint'), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = 42, pw = w - 2 * pad, ph = h - 2 * pad - 18;
  const cls = agents.map(a => a.cl), cds = agents.map(a => a.cd);
  const mxCl = Math.min(Math.max(...cls) * 1.1, 15), mxCd = Math.min(Math.max(...cds) * 1.1, 15);
  drawGrid(x, pad, pw, ph, 5, 5, t);
  drawAxes(x, pad, pw, ph, 'Lying cost c_l', 'Deception cost c_d', t);
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
  drawNote(x, 'High c_d \u2192 deception-averse \u00b7 High c_l \u2192 lying-averse', pad + 2, h - 4, t);
}

/** 3. Strategy distribution — BT or GL histogram with notes at bottom */
function plotStrat(R, gt) {
  const cid = gt === 'BT' ? 'c-strat-bt' : 'c-strat-gl';
  const { x, w, h } = gCtx(cid), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = 42, ph = h - pad - 78, pw = w - 2 * pad;
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
  // Stats at top-left (clear area, no bars here)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  x.fillStyle = t.txtB; x.font = '600 11px Inter,sans-serif'; x.textAlign = 'left';
  x.fillText('\u03bc = ' + avg.toFixed(3), pad + 6, pad + 14);
  // All notes BELOW axis label
  const noteY = pad + ph + 44;
  x.fillStyle = t.txt; x.font = '500 9px Inter,sans-serif'; x.textAlign = 'left';
  if (gt === 'BT') {
    x.fillText('v = P(m=1|\u03b8=0) \u00b7 Eq: p=1.0 (truth) \u00b7 Dashed = eq. prediction', pad, noteY);
    drawNote(x, 'Prop. 3: deviation driven by c_d (deception aversion)', pad, noteY + 14, t);
  } else {
    x.fillText('w = P(m=0|\u03b8=1) \u00b7 Eq: p=0.0 (lie) \u00b7 Dashed = eq. prediction', pad, noteY);
    drawNote(x, 'Prop. 4: deviation driven by c_l (lying aversion)', pad, noteY + 14, t);
  }
}

/** 4. Agent type proportions — dual horizontal bar chart */
function plotTypes(agents) {
  const { x, w, h } = gCtx('c-types'), t = TH();
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const n = agents.length, pad = 28, noteH = 20;
  const risk = {}, cls = {};
  for (const a of agents) {
    risk[a.riskType] = (risk[a.riskType] || 0) + 1;
    cls[a.classification] = (cls[a.classification] || 0) + 1;
  }
  const maxW = w - 2 * pad - 80;
  const drawSection = (data, y0, title) => {
    // Section title
    x.fillStyle = t.txtB; x.font = '600 11px Inter,sans-serif'; x.textAlign = 'left';
    x.fillText(title, pad, y0);
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const barH = 18, gap = 6;
    entries.forEach(([k, v], i) => {
      const pct = v / n, bw = pct * maxW, by = y0 + 12 + i * (barH + gap);
      // Background track
      x.fillStyle = t.grid;
      x.beginPath(); x.roundRect ? x.roundRect(pad, by, maxW, barH, 4) : x.rect(pad, by, maxW, barH); x.fill();
      // Filled bar
      x.fillStyle = CL[k] || '#888'; x.globalAlpha = .7;
      x.beginPath(); x.roundRect ? x.roundRect(pad, by, Math.max(bw, 4), barH, 4) : x.rect(pad, by, Math.max(bw, 4), barH); x.fill();
      x.globalAlpha = 1;
      // Label + percentage on same line, right-aligned
      const label = k.replace(/_/g, ' ');
      const pctStr = (pct * 100).toFixed(0) + '%';
      x.fillStyle = t.txt; x.font = '600 10px JetBrains Mono,monospace'; x.textAlign = 'right';
      x.fillText(pctStr, w - pad, by + barH - 4);
      x.fillStyle = t.txtB; x.font = '500 10px Inter,sans-serif'; x.textAlign = 'right';
      x.fillText(label, w - pad - 40, by + barH - 4);
    });
    return y0 + 12 + entries.length * (barH + gap);
  };
  // Draw sections
  const endTop = drawSection(risk, pad, 'Risk attitudes (configured)');
  // Separator line
  const sepY = endTop + 8;
  x.strokeStyle = t.grid; x.lineWidth = 1;
  x.beginPath(); x.moveTo(pad, sepY); x.lineTo(w - pad, sepY); x.stroke();
  drawSection(cls, sepY + 12, 'Behavioral classification (inferred, Fig. 5)');
  // Note at bottom
  drawNote(x, 'Top = input composition \u00b7 Bottom = observed strategy classification', pad, h - 6, t);
}

/** 5. Equilibrium regions — heatmap in (c_d, c_l) space */
function plotRegions(agents) {
  const { x: c, w, h } = gCtx('c-regions'), t = TH();
  c.fillStyle = t.bg; c.fillRect(0, 0, w, h);
  const pad = 42, pw = w - 2 * pad, ph = h - 2 * pad - 18, mx = 5;
  const dark = _isDark();
  // Region fill via ImageData — stronger alpha for visible regions
  const id = c.createImageData(pw, ph);
  const bc = dark ? [13, 17, 23] : [250, 251, 252];
  const regionColors = [
    [37, 99, 235],   // blue  — full reputation
    [217, 119, 6],   // amber — partial
    [220, 38, 38],   // red   — no reputation
  ];
  const alpha = dark ? 0.28 : 0.15;
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
  drawAxes(c, pad, pw, ph, 'Deception cost c_d', 'Lying cost c_l', t);
  // Boundary lines — distinct styling
  c.lineWidth = 2;
  c.strokeStyle = dark ? 'rgba(200,210,225,.5)' : 'rgba(50,60,80,.35)';
  c.beginPath();
  for (let i = 0; i <= 100; i++) { const cd = (i / 100) * mx, cl = .8 * cd + .2, px = pad + (cd / mx) * pw, py = pad + (1 - cl / mx) * ph; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke();
  c.setLineDash([6, 5]);
  c.strokeStyle = dark ? 'rgba(200,210,225,.4)' : 'rgba(50,60,80,.25)';
  c.beginPath();
  for (let i = 0; i <= 100; i++) { const cd = (i / 100) * mx, cl = .3 * cd, px = pad + (cd / mx) * pw, py = pad + (1 - cl / mx) * ph; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke(); c.setLineDash([]);
  // Agent dots
  for (const a of agents) {
    if (a.cl > mx || a.cd > mx) continue;
    c.fillStyle = CL[a.classification] || '#999'; c.globalAlpha = .6;
    c.beginPath(); c.arc(pad + (a.cd / mx) * pw, pad + (1 - a.cl / mx) * ph, 3.5, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Legend box (top-right, outside data area)
  const lx = pad + pw - 120, ly = pad + 6;
  c.fillStyle = dark ? 'rgba(22,27,34,.85)' : 'rgba(255,255,255,.9)';
  c.strokeStyle = t.grid; c.lineWidth = 1;
  c.beginPath(); c.roundRect ? c.roundRect(lx - 8, ly - 6, 128, 62, 5) : c.rect(lx - 8, ly - 6, 128, 62); c.fill(); c.stroke();
  const legItems = [
    ['Full reputation', [37, 99, 235], false],
    ['Partial',         [217, 119, 6], false],
    ['No reputation',   [220, 38, 38], true],
  ];
  legItems.forEach(([label, rgb, dashed], i) => {
    const iy = ly + 6 + i * 18;
    // Line sample
    c.strokeStyle = `rgb(${rgb})`; c.lineWidth = 2.5; c.globalAlpha = .7;
    if (dashed) c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(lx, iy - 2); c.lineTo(lx + 18, iy - 2); c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
    // Filled square
    c.fillStyle = `rgba(${rgb},.3)`; c.fillRect(lx + 2, iy - 8, 14, 10);
    // Label
    c.fillStyle = t.txtB; c.font = '500 10px Inter,sans-serif'; c.textAlign = 'left';
    c.fillText(label, lx + 24, iy + 1);
  });
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
