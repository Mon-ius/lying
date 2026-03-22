/**
 * Canvas-based publication-quality chart rendering.
 * Responsive: all sizing adapts to canvas width.
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

/* ---- Responsive scale ---- */
function _sc(w) {
  if (w >= 500) return { pad: 42, fs: 10, fsB: 11, fsSm: 9, mono: 10, ntk: 10, yOff: 10, dot: 3.5 };
  if (w >= 380) return { pad: 32, fs: 9, fsB: 10, fsSm: 8, mono: 9, ntk: 5, yOff: 8, dot: 3 };
  return { pad: 24, fs: 8, fsB: 9, fsSm: 7, mono: 8, ntk: 5, yOff: 6, dot: 2.5 };
}

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

function drawAxes(x, pad, w, h, xLbl, yLbl, t, sc) {
  x.strokeStyle = t.axis; x.lineWidth = 1;
  x.beginPath(); x.moveTo(pad, pad); x.lineTo(pad, pad + h); x.lineTo(pad + w, pad + h); x.stroke();
  // x-label: tick offset + font height + gap
  const xLblY = pad + h + sc.fs + 6 + sc.fs + 4;
  x.fillStyle = t.txt; x.font = `500 ${sc.fs}px Inter,sans-serif`; x.textAlign = 'center';
  x.fillText(xLbl, pad + w / 2, xLblY);
  x.save(); x.translate(sc.yOff, pad + h / 2); x.rotate(-Math.PI / 2); x.fillText(yLbl, 0, 0); x.restore();
}

/* ---- Histogram with optional KDE ---- */
function histogram(x, data, pad, w, h, bins, color, t, showKDE, sc) {
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
  const mfs = sc ? sc.mono : 10;
  x.fillStyle = t.txt; x.font = `${mfs}px JetBrains Mono,monospace`; x.textAlign = 'center';
  x.fillText(mn.toFixed(1), pad, pad + h + mfs + 2);
  x.fillText(mx.toFixed(1), pad + w, pad + h + mfs + 2);
}

/* ---- Annotation helper ---- */
function drawNote(x, text, nx, ny, t, sc) {
  const fs = sc ? sc.fsSm : 9;
  x.fillStyle = t.txt; x.globalAlpha = .7;
  x.font = `500 ${fs}px Inter,sans-serif`; x.textAlign = 'left';
  x.fillText(text, nx, ny);
  x.globalAlpha = 1;
}

/* ==================================================================
   PLOT FUNCTIONS
   ================================================================== */

/** 1. Utility Parameter Distributions — 2x2 grid with KDE */
function plotParams(agents) {
  const { x, w, h } = gCtx('c-params'), t = TH(), sc = _sc(w);
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = Math.min(sc.pad / 2, 20), gap = sc.pad >= 42 ? 28 : sc.pad >= 32 ? 18 : 12;
  const noteH = sc.fsSm + 8;
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
    const titleH = sc.fs + 6;
    const hh = ph - titleH - sc.mono - 4;
    x.save(); x.translate(px, py + titleH);
    histogram(x, data, 0, pw, hh, 22, p.c, t, true, sc);
    x.restore();
    x.fillStyle = p.c; x.font = `600 ${sc.fs}px Inter,sans-serif`; x.textAlign = 'left';
    x.fillText(p.l, px + 2, py + sc.fs);
    const m = data.reduce((a, b) => a + b, 0) / data.length;
    x.fillStyle = t.txt; x.font = `${sc.mono}px JetBrains Mono,monospace`; x.textAlign = 'right';
    x.fillText('\u03bc=' + m.toFixed(2), px + pw - 2, py + sc.fs);
  });
  drawNote(x, 'LogNormal draws \u00b7 KDE overlay \u00b7 Histogram+density', pad, h - 4, t, sc);
}

/** 2. Joint (c_l, c_d) scatter — colored by classification */
function plotJoint(agents) {
  const { x, w, h } = gCtx('c-joint'), t = TH(), sc = _sc(w);
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = sc.pad, pw = w - 2 * pad, ph = h - 2 * pad - sc.fsSm - 10;
  const cls = agents.map(a => a.cl), cds = agents.map(a => a.cd);
  const mxCl = Math.min(Math.max(...cls) * 1.1, 15), mxCd = Math.min(Math.max(...cds) * 1.1, 15);
  drawGrid(x, pad, pw, ph, 5, 5, t);
  drawAxes(x, pad, pw, ph, 'Lying cost c_l', 'Deception cost c_d', t, sc);
  x.fillStyle = t.txt; x.font = `${sc.mono}px JetBrains Mono,monospace`; x.textAlign = 'center';
  x.fillText('0', pad, pad + ph + sc.mono + 4); x.fillText(mxCl.toFixed(1), pad + pw, pad + ph + sc.mono + 4);
  x.textAlign = 'right'; x.fillText(mxCd.toFixed(1), pad - 4, pad + 6);
  for (const a of agents) {
    const px = pad + (a.cl / mxCl) * pw, py = pad + ph - (a.cd / mxCd) * ph;
    x.fillStyle = CL[a.classification] || '#999'; x.globalAlpha = .55;
    x.beginPath(); x.arc(px, py, sc.dot, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  // Legend
  const legs = [['equilibrium', 'Eq'], ['lying_averse', 'LA'], ['deception_averse', 'DA'], ['inference_error', 'IE']];
  const legSp = sc.fs + 4;
  legs.forEach(([k, l], i) => {
    x.fillStyle = CL[k]; x.beginPath(); x.arc(pad + pw - 6, pad + 8 + i * legSp, sc.dot, 0, Math.PI * 2); x.fill();
    x.fillStyle = t.txt; x.font = `${sc.fs}px Inter,sans-serif`; x.textAlign = 'right';
    x.fillText(l, pad + pw - 14, pad + 12 + i * legSp);
  });
  drawNote(x, 'High c_d \u2192 deception-averse \u00b7 High c_l \u2192 lying-averse', pad + 2, h - 4, t, sc);
}

/** 3. Strategy distribution — BT or GL histogram with notes at bottom */
function plotStrat(R, gt) {
  const cid = gt === 'BT' ? 'c-strat-bt' : 'c-strat-gl';
  const { x, w, h } = gCtx(cid), t = TH(), sc = _sc(w);
  x.fillStyle = t.bg; x.fillRect(0, 0, w, h);
  const pad = sc.pad;
  // Layout offsets below axis line: ticks → axis label → note1 → note2
  const tkOff = sc.fs + 6;              // tick labels
  const axOff = tkOff + sc.fs + 4;      // axis label below ticks
  const n1Off = axOff + sc.fsSm + 6;    // note line 1
  const n2Off = n1Off + sc.fsSm + 4;    // note line 2
  const padBot = n2Off + 6;
  const ph = h - pad - padBot, pw = w - 2 * pad;
  const strats = gt === 'BT' ? R.btS : R.glS, vals = Object.values(strats);
  if (!vals.length) { x.fillStyle = t.txt; x.textAlign = 'center'; x.fillText('No data', w / 2, h / 2); return; }
  drawGrid(x, pad, pw, ph, sc.ntk, 4, t);
  const yLbl = sc.pad >= 42 ? 'Observations (%)' : 'Obs. (%)';
  drawAxes(x, pad, pw, ph, 'Truth-telling probability', yLbl, t, sc);
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
  x.fillStyle = t.txt; x.font = `${sc.mono}px JetBrains Mono,monospace`; x.textAlign = 'center';
  for (let i = 0; i <= sc.ntk; i++) x.fillText((i / sc.ntk).toFixed(1), pad + (i / sc.ntk) * pw, pad + ph + tkOff);
  // Stats at top-left
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  x.fillStyle = t.txtB; x.font = `600 ${sc.fsB}px Inter,sans-serif`; x.textAlign = 'left';
  x.fillText('\u03bc = ' + avg.toFixed(3), pad + 4, pad + sc.fsB + 2);
  // Notes BELOW axis label — using pre-calculated offsets
  x.fillStyle = t.txt; x.font = `500 ${sc.fsSm}px Inter,sans-serif`; x.textAlign = 'left';
  if (gt === 'BT') {
    x.fillText('v = P(m=1|\u03b8=0) \u00b7 Eq: p=1.0 \u00b7 Dashed = eq.', pad, pad + ph + n1Off);
    drawNote(x, 'Prop. 3: deviation driven by c_d', pad, pad + ph + n2Off, t, sc);
  } else {
    x.fillText('w = P(m=0|\u03b8=1) \u00b7 Eq: p=0.0 \u00b7 Dashed = eq.', pad, pad + ph + n1Off);
    drawNote(x, 'Prop. 4: deviation driven by c_l', pad, pad + ph + n2Off, t, sc);
  }
}

/** 4. Agent type proportions — pure HTML bar chart (no canvas clipping) */
function plotTypes(agents) {
  const el = document.getElementById('types-chart');
  const n = agents.length;
  const risk = {}, cls = {};
  for (const a of agents) {
    risk[a.riskType] = (risk[a.riskType] || 0) + 1;
    cls[a.classification] = (cls[a.classification] || 0) + 1;
  }
  const mkSection = (data, title) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    return `<div class="types-title">${title}</div>` + entries.map(([k, v]) => {
      const pct = (v / n * 100).toFixed(0);
      const color = CL[k] || '#888';
      const label = k.replace(/_/g, ' ');
      return `<div class="types-bar-row"><span class="types-bar-label">${label}</span><div class="types-bar-track"><div class="types-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="types-bar-pct">${pct}%</span></div>`;
    }).join('');
  };
  el.innerHTML = mkSection(risk, 'Risk attitudes (configured)')
    + '<hr class="types-sep">'
    + mkSection(cls, 'Behavioral classification (inferred, Fig. 5)')
    + '<p class="types-note">Top = input \u00b7 Bottom = observed classification</p>';
}

/** 5. Equilibrium regions — heatmap in (c_d, c_l) space; legend/note in HTML */
function plotRegions(agents) {
  const { x: c, w, h } = gCtx('c-regions'), t = TH(), sc = _sc(w);
  c.fillStyle = t.bg; c.fillRect(0, 0, w, h);
  const pad = sc.pad;
  const pw = w - 2 * pad, ph = h - 2 * pad, mx = 5;
  const dark = _isDark();
  // Region fill via ImageData
  const id = c.createImageData(pw, ph);
  const bc = dark ? [13, 17, 23] : [250, 251, 252];
  const regionColors = [[37, 99, 235], [217, 119, 6], [220, 38, 38]];
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
  // Axes: labels drawn inside canvas edges
  c.fillStyle = t.txt; c.font = `500 ${sc.fs}px Inter,sans-serif`;
  c.textAlign = 'center'; c.fillText(sc.pad >= 42 ? 'Deception cost c_d' : 'c_d', pad + pw / 2, h - 2);
  c.save(); c.translate(sc.yOff, pad + ph / 2); c.rotate(-Math.PI / 2);
  c.fillText(sc.pad >= 42 ? 'Lying cost c_l' : 'c_l', 0, 0); c.restore();
  c.strokeStyle = t.axis; c.lineWidth = 1;
  c.beginPath(); c.moveTo(pad, pad); c.lineTo(pad, pad + ph); c.lineTo(pad + pw, pad + ph); c.stroke();
  // Boundary lines
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
    c.beginPath(); c.arc(pad + (a.cd / mx) * pw, pad + (1 - a.cl / mx) * ph, sc.dot, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Ticks
  c.fillStyle = t.txt; c.font = `${sc.mono}px JetBrains Mono,monospace`; c.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    c.fillText(i.toFixed(0), pad + (i / 5) * pw, pad + ph + sc.mono + 4);
    c.textAlign = 'right'; c.fillText(i.toFixed(0), pad - 3, pad + ph - (i / 5) * ph + 4); c.textAlign = 'center';
  }
  // HTML legend
  const leg = document.getElementById('regions-legend');
  leg.innerHTML = [
    ['Full reputation', '37,99,235', ''],
    ['Partial', '217,119,6', ''],
    ['No reputation', '220,38,38', ' dashed'],
  ].map(([label, rgb, cls]) =>
    `<span class="regions-legend-item"><span class="swatch" style="background:rgb(${rgb})"></span><span class="line${cls}" style="border-color:rgb(${rgb})"></span>${label}</span>`
  ).join('');
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
