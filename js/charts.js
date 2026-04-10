/**
 * Plotly-based chart rendering — responsive, theme-aware.
 * Shared charts (Figs 1–7) + infrastructure.
 * Depends on: Plotly.js (CDN), engine.js (CL colors)
 */

/* ---- Theme ---- */
function _isDark() { return typeof getEffectiveTheme === 'function' && getEffectiveTheme() === 'dark'; }

const CL = {
  risk_loving: '#dc2626', risk_neutral: '#d97706', risk_averse: '#2563eb',
  equilibrium: '#2563eb', lying_averse: '#16a34a', deception_averse: '#dc2626', inference_error: '#d97706',
  cl: '#be185d', cd: '#4338ca', alpha: '#0d9488', beta: '#c2410c',
};

function _layout(extra) {
  const dark = _isDark();
  const base = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: dark ? '#0d1117' : '#fafbfc',
    font: { family: 'Inter, sans-serif', size: 11, color: dark ? '#8b949e' : '#6b7080' },
    margin: { l: 48, r: 16, t: 8, b: 42 },
    autosize: true,
    xaxis: {
      gridcolor: dark ? '#1e242e' : '#eef0f3',
      zerolinecolor: dark ? '#3d4450' : '#c0c4cc',
    },
    yaxis: {
      gridcolor: dark ? '#1e242e' : '#eef0f3',
      zerolinecolor: dark ? '#3d4450' : '#c0c4cc',
    },
  };
  return Object.assign(base, extra);
}

const _cfg = { responsive: true, displayModeBar: false };

/* ==================================================================
   PLOT FUNCTIONS
   ================================================================== */

/** 1. Utility Parameter Distributions — 2×2 subplots with KDE */
function plotParams(agents) {
  const items = [
    { k: 'cl',    l: 'c<sub>l</sub>',  c: CL.cl },
    { k: 'cd',    l: 'c<sub>d</sub>',  c: CL.cd },
    { k: 'alpha', l: 'α',              c: CL.alpha },
    { k: 'beta',  l: 'β',              c: CL.beta },
  ];
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';
  const traces = [];
  const annotations = [];
  items.forEach((p, i) => {
    const vals = agents.map(a => a[p.k]);
    const mean = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    traces.push({
      x: vals, type: 'histogram', nbinsx: 22,
      marker: { color: p.c, opacity: 0.45 },
      name: p.l, showlegend: false,
      xaxis: 'x' + (i + 1), yaxis: 'y' + (i + 1),
    });
    annotations.push({
      text: `<b>${p.l}</b>  mean=${mean}  n=${agents.length}`,
      xref: 'x' + (i + 1) + ' domain', yref: 'y' + (i + 1) + ' domain',
      x: 0, y: 1.08, showarrow: false,
      font: { size: 9.5, color: annColor },
    });
  });
  const layout = _layout({
    grid: { rows: 2, columns: 2, pattern: 'independent', xgap: 0.12, ygap: 0.3 },
    height: 480,
    margin: { l: 42, r: 16, t: 36, b: 26 },
    annotations,
  });
  for (let i = 1; i <= 4; i++) {
    layout['xaxis' + i] = { gridcolor: gc, zeroline: false, automargin: true };
    layout['yaxis' + i] = { gridcolor: gc, zeroline: false, automargin: true, ticklabelstandoff: 4 };
  }
  Plotly.react('c-params', traces, layout, _cfg).then(() => {
    const el = document.getElementById('c-params');
    const hideYZero = () => el.querySelectorAll('[class*="ytick"] text').forEach(t => {
      t.style.visibility = t.textContent.trim() === '0' ? 'hidden' : '';
    });
    hideYZero();
    if (!el._yzHook) { el.on('plotly_afterplot', hideYZero); el._yzHook = true; }
  });
}

/** 2. Sender Strategy — BT + GL side-by-side (bar + histogram).
 *  Replicates Choi, Lee & Lim (2025) Fig. 9 / Appendix D.1.
 *  Left half per treatment: average truth-telling probability bar with equilibrium marker (▼).
 *  Right half per treatment: histogram of per-individual truth-telling probabilities with equilibrium cross (×).
 */
function plotSender(R) {
  const el = document.getElementById('c-sender');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';

  const btVals = Object.values(R.btS || {});
  const glVals = Object.values(R.glS || {});
  if (!btVals.length && !glVals.length) { Plotly.purge(el); return; }

  const BAR_COL = '#c97373';  // paper-style muted red
  const PRED = '#1e40af';     // paper-style prediction blue
  const traces = [];

  const addPanel = (vals, gt, axBar, axHist) => {
    if (!vals.length) return;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const eq = gt === 'BT' ? 1 : 0;  // BT eq: v*=1 always truth; GL eq: truth-telling rate 0 (always lie)

    // Bar of mean
    traces.push({
      type: 'bar',
      x: [gt], y: [mean],
      marker: { color: BAR_COL, opacity: 0.75 },
      width: 0.55,
      showlegend: false,
      hovertemplate: `${gt}: mean = ${mean.toFixed(3)}<extra></extra>`,
      xaxis: axBar.x, yaxis: axBar.y,
    });
    // Prediction marker on bar
    traces.push({
      type: 'scatter', mode: 'markers',
      x: [gt], y: [eq],
      marker: { symbol: 'diamond', size: 11, color: PRED },
      showlegend: false,
      hovertemplate: `prediction = ${eq}<extra></extra>`,
      xaxis: axBar.x, yaxis: axBar.y,
    });

    // Histogram of per-individual truth-telling rates
    traces.push({
      type: 'histogram',
      x: vals,
      xbins: { start: -0.025, end: 1.025, size: 0.05 },
      marker: { color: BAR_COL, opacity: 0.75 },
      showlegend: false,
      xaxis: axHist.x, yaxis: axHist.y,
    });
    // Prediction cross on histogram — place near top of distribution
    traces.push({
      type: 'scatter', mode: 'markers',
      x: [eq], y: [Math.max(1, vals.length)],
      marker: { symbol: 'x', size: 11, color: PRED, line: { width: 2 } },
      showlegend: false,
      hoverinfo: 'skip',
      xaxis: axHist.x, yaxis: axHist.y,
    });
  };

  addPanel(btVals, 'BT', { x: 'x',  y: 'y'  }, { x: 'x2', y: 'y2' });
  addPanel(glVals, 'GL', { x: 'x3', y: 'y3' }, { x: 'x4', y: 'y4' });

  const layout = _layout({
    height: 300,
    margin: { l: 58, r: 58, t: 32, b: 42 },
    xaxis:  { gridcolor: gc, domain: [0.000, 0.080], tickfont: { size: 9 }, fixedrange: true },
    yaxis:  { gridcolor: gc, range: [0, 1.05], title: { text: t('ax.ttp'), font: { size: 10 } }, ticklabelstandoff: 4 },
    xaxis2: { gridcolor: gc, domain: [0.140, 0.460], range: [-0.02, 1.02], title: { text: t('ax.ttp'), font: { size: 10 } } },
    yaxis2: { gridcolor: gc, anchor: 'x2', side: 'right', showticklabels: false, ticks: '' },
    xaxis3: { gridcolor: gc, domain: [0.560, 0.640], tickfont: { size: 9 }, fixedrange: true, anchor: 'y3' },
    yaxis3: { gridcolor: gc, range: [0, 1.05], anchor: 'x3', ticklabelstandoff: 4 },
    xaxis4: { gridcolor: gc, domain: [0.700, 1.000], range: [-0.02, 1.02], title: { text: t('ax.ttp'), font: { size: 10 } }, anchor: 'y4' },
    yaxis4: { gridcolor: gc, anchor: 'x4', side: 'right', title: { text: t('ax.obs'), font: { size: 10 }, standoff: 8 }, ticklabelstandoff: 4 },
    annotations: [
      { text: '<b>(a) BT</b>', xref: 'paper', yref: 'paper', x: 0.23, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
      { text: '<b>(b) GL</b>', xref: 'paper', yref: 'paper', x: 0.78, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
    ],
    bargap: 0.05,
  });

  Plotly.react('c-sender', traces, layout, _cfg);
}

/** 3. Clustering of Sender Strategy — BT + GL scatter plots.
 *  Replicates Choi, Lee & Lim (2025) Fig. 10 / Appendix D.2.
 *  BT axes: Pr(m₁=1|θ₁=0) × Pr(m₂=1|θ₁=0). GL axes: Pr(m₁=1|θ₁=1) × Pr(m₂=1|θ₁=1).
 *  Each point is one individual's average across all rounds; prediction marker shows theoretical equilibrium.
 */
function plotCluster(R) {
  const el = document.getElementById('c-cluster');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';

  if (!(R.bt && R.bt.length) && !(R.gl && R.gl.length)) { Plotly.purge(el); return; }

  // Compute per-individual (x = Pr(m₁=1|θ₁=target), y = Pr(m₂=1|θ₁=target))
  const computePts = (results, targetState) => {
    const byAgent = {};
    for (const r of results) {
      if (!r.periods || r.periods.length < 2) continue;
      if (r.periods[0].st !== targetState) continue;
      if (!byAgent[r.id]) byAgent[r.id] = { m1: 0, m2: 0, n: 0 };
      const b = byAgent[r.id];
      b.m1 += r.periods[0].sent;
      b.m2 += r.periods[1].sent;
      b.n++;
    }
    const pts = [];
    for (const [id, b] of Object.entries(byAgent)) {
      if (!b.n) continue;
      pts.push({ id: +id, x: b.m1 / b.n, y: b.m2 / b.n });
    }
    return pts;
  };

  const btPts = computePts(R.bt, 0);
  const glPts = computePts(R.gl, 1);

  // Simple corner-based clustering — paper Fig. 10 identifies natural clusters at corners of the unit square
  const classify = p => {
    const near = (v, t) => Math.abs(v - t) < 0.15;
    if (near(p.x, 0) && near(p.y, 1)) return 'rep_builder';   // blue square (BT eq / full reputation)
    if (near(p.x, 0) && near(p.y, 0)) return 'truth_teller';  // green triangle
    if (near(p.x, 1) && near(p.y, 1)) return 'deceiver';      // red circle / always-m=1
    if (near(p.x, 1) && near(p.y, 0)) return 'inverter';      // orange diamond
    return 'mixed';                                            // pink star / cyan hexagon
  };

  const CLS_COL = {
    rep_builder:  '#1e40af',
    truth_teller: '#15803d',
    deceiver:     '#dc2626',
    inverter:     '#ea580c',
    mixed:        '#c026d3',
  };
  const CLS_NAME = {
    rep_builder:  'Reputation builder',
    truth_teller: 'Truth-teller',
    deceiver:     'Deceiver',
    inverter:     'Inverter',
    mixed:        'Mixed',
  };

  const traces = [];
  const addPanel = (pts, axx, axy, prediction) => {
    const groups = {};
    for (const p of pts) {
      const c = classify(p);
      if (!groups[c]) groups[c] = { x: [], y: [], id: [] };
      groups[c].x.push(p.x); groups[c].y.push(p.y); groups[c].id.push(p.id);
    }
    for (const [k, g] of Object.entries(groups)) {
      const frac = g.x.length / Math.max(1, pts.length);
      traces.push({
        type: 'scatter', mode: 'markers',
        x: g.x, y: g.y,
        marker: { color: CLS_COL[k], size: 8, opacity: 0.75 },
        name: `${CLS_NAME[k]} (${(frac * 100).toFixed(0)}%)`,
        showlegend: false,
        customdata: g.id,
        hovertemplate: '#%{customdata}: (%{x:.2f}, %{y:.2f})<extra>' + CLS_NAME[k] + '</extra>',
        xaxis: axx, yaxis: axy,
      });
    }
    // Prediction marker — hollow circle
    traces.push({
      type: 'scatter', mode: 'markers',
      x: [prediction.x], y: [prediction.y],
      marker: { symbol: 'circle-open', size: 22, color: '#1e40af', line: { width: 2.5 } },
      showlegend: false,
      hovertemplate: `prediction (${prediction.x}, ${prediction.y})<extra></extra>`,
      xaxis: axx, yaxis: axy,
    });
  };

  // Equilibrium predictions:
  //  BT: period-1 truth → Pr(m₁=1|θ₁=0)=0; period-2 bad type always sends m=1 → Pr(m₂=1)=1 → (0,1)
  //  GL: period-1 good type lies → Pr(m₁=1|θ₁=1)=0; period-2 good type honest → Pr(m₂=1|θ₁=1)=Pr(θ₂=1)=0.5 → (0,0.5)
  addPanel(btPts, 'x',  'y',  { x: 0, y: 1   });
  addPanel(glPts, 'x2', 'y2', { x: 0, y: 0.5 });

  const layout = _layout({
    height: 340,
    margin: { l: 62, r: 70, t: 32, b: 46 },
    xaxis:  { gridcolor: gc, domain: [0.00, 0.42], range: [-0.05, 1.05], title: { text: 'Pr(m<sub>1</sub>=1 | θ<sub>1</sub>=0)', font: { size: 10 } } },
    yaxis:  { gridcolor: gc, range: [-0.05, 1.05], title: { text: 'Pr(m<sub>2</sub>=1 | θ<sub>1</sub>=0)', font: { size: 10 } }, ticklabelstandoff: 4 },
    xaxis2: { gridcolor: gc, domain: [0.58, 1.00], range: [-0.05, 1.05], title: { text: 'Pr(m<sub>1</sub>=1 | θ<sub>1</sub>=1)', font: { size: 10 } }, anchor: 'y2' },
    yaxis2: { gridcolor: gc, range: [-0.05, 1.05], side: 'right', title: { text: 'Pr(m<sub>2</sub>=1 | θ<sub>1</sub>=1)', font: { size: 10 }, standoff: 8 }, anchor: 'x2', ticklabelstandoff: 4 },
    annotations: [
      { text: '<b>(a) BT</b>', xref: 'paper', yref: 'paper', x: 0.21, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
      { text: '<b>(b) GL</b>', xref: 'paper', yref: 'paper', x: 0.79, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
    ],
  });

  Plotly.react('c-cluster', traces, layout, _cfg);
}

/** 4. Agent type proportions — horizontal bar chart */
function plotTypes(agents) {
  const n = agents.length;
  const risk = {}, cls = {};
  for (const a of agents) {
    risk[a.riskType] = (risk[a.riskType] || 0) + 1;
    cls[a.classification] = (cls[a.classification] || 0) + 1;
  }
  const riskNames = { risk_loving: t('rt.rl'), risk_neutral: t('rt.rn'), risk_averse: t('rt.ra') };
  const clsNames = { equilibrium: t('cls.eq'), lying_averse: t('cls.la'), deception_averse: t('cls.da'), inference_error: t('cls.ie') };
  const mkTrace = (data, group, nameMap) => {
    const entries = Object.entries(data).sort((a, b) => a[1] - b[1]);
    return {
      y: entries.map(([k]) => (nameMap && nameMap[k]) || k.replace(/_/g, ' ')),
      x: entries.map(([, v]) => (v / n * 100)),
      type: 'bar',
      orientation: 'h',
      marker: { color: entries.map(([k]) => CL[k] || '#888'), opacity: 0.7 },
      text: entries.map(([, v]) => (v / n * 100).toFixed(0) + '%'),
      textposition: 'outside',
      textfont: { family: 'JetBrains Mono, monospace', size: 10 },
      name: group,
      showlegend: false,
      hovertemplate: '%{y}: %{x:.1f}%<extra></extra>',
    };
  };
  const riskTrace = mkTrace(risk, 'Risk', riskNames);
  const clsTrace = mkTrace(cls, 'Classification', clsNames);
  riskTrace.xaxis = 'x'; riskTrace.yaxis = 'y';
  clsTrace.xaxis = 'x2'; clsTrace.yaxis = 'y2';
  const dark = _isDark();
  const annColor = dark ? '#c9d1d9' : '#3d4250';
  const gc = dark ? '#1e242e' : '#eef0f3';
  const layout = _layout({
    grid: { rows: 2, columns: 1, pattern: 'independent', ygap: 0.15 },
    height: 340,
    margin: { l: 110, r: 40, t: 24, b: 28 },
    xaxis:  { gridcolor: gc, range: [0, 105], showticklabels: false, zeroline: false },
    xaxis2: { gridcolor: gc, range: [0, 105], showticklabels: false, zeroline: false },
    yaxis:  { gridcolor: gc, zeroline: false, automargin: true },
    yaxis2: { gridcolor: gc, zeroline: false, automargin: true },
    annotations: [
      { text: '<b>Risk attitudes (configured)</b>', xref: 'paper', yref: 'y domain', x: 0, y: 1.1, showarrow: false, font: { size: 10, color: annColor }, xanchor: 'left' },
      { text: '<b>Behavioral classification (inferred)</b>', xref: 'paper', yref: 'y2 domain', x: 0, y: 1.1, showarrow: false, font: { size: 10, color: annColor }, xanchor: 'left' },
    ],
  });
  Plotly.react('c-types', [riskTrace, clsTrace], layout, _cfg);
}

/** 5. Equilibrium regions — heatmap + scatter + boundary lines */
function plotRegions(agents) {
  const mx = 5, res = 80;
  const dark = _isDark();
  const z = [];
  for (let j = 0; j < res; j++) {
    const row = [];
    for (let i = 0; i < res; i++) {
      const cd = (i / res) * mx, cl = (j / res) * mx;
      const u = .8 * cd + .2, lo = .3 * cd;
      row.push(cl > u ? 0 : cl > lo ? 1 : 2);
    }
    z.push(row);
  }
  const heatmap = {
    z, type: 'heatmap',
    x0: 0, dx: mx / res, y0: 0, dy: mx / res,
    colorscale: [
      [0, dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)'],
      [0.5, dark ? 'rgba(217,119,6,0.25)' : 'rgba(217,119,6,0.12)'],
      [1, dark ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.12)'],
    ],
    showscale: false,
    hoverinfo: 'skip',
  };
  const mkLine = (fn) => {
    const x = [], y = [];
    for (let i = 0; i <= 100; i++) {
      const cd = (i / 100) * mx;
      x.push(cd); y.push(fn(cd));
    }
    return { x, y };
  };
  const solidLine = mkLine(cd => .8 * cd + .2);
  const dashedLine = mkLine(cd => .3 * cd);
  const lineColor = dark ? 'rgba(200,210,225,0.5)' : 'rgba(50,60,80,0.35)';
  const dashColor = dark ? 'rgba(200,210,225,0.4)' : 'rgba(50,60,80,0.25)';
  const solidTrace = { x: solidLine.x, y: solidLine.y, mode: 'lines', line: { color: lineColor, width: 2 }, showlegend: false, hoverinfo: 'skip' };
  const dashTrace = { x: dashedLine.x, y: dashedLine.y, mode: 'lines', line: { color: dashColor, width: 2, dash: 'dash' }, showlegend: false, hoverinfo: 'skip' };
  const groups = {};
  const nameMap = { equilibrium: t('cls.eq'), lying_averse: t('cls.la'), deception_averse: t('cls.da'), inference_error: t('cls.ie') };
  for (const a of agents) {
    if (a.cd > mx || a.cl > mx) continue;
    const c = a.classification;
    if (!groups[c]) groups[c] = { x: [], y: [] };
    groups[c].x.push(a.cd);
    groups[c].y.push(a.cl);
  }
  const dotTraces = Object.entries(groups).map(([k, v]) => ({
    x: v.x, y: v.y,
    mode: 'markers',
    type: 'scatter',
    name: nameMap[k] || k,
    marker: { color: CL[k] || '#999', size: 5, opacity: 0.6 },
    hovertemplate: 'c<sub>d</sub>=%{x:.2f}<br>c<sub>l</sub>=%{y:.2f}<extra>' + (nameMap[k] || k) + '</extra>',
  }));
  const layout = _layout({
    height: 320,
    xaxis: { ...(_layout().xaxis), title: t('ax.cd'), range: [0, mx] },
    yaxis: { ...(_layout().yaxis), title: t('ax.cl'), range: [0, mx] },
    showlegend: false,
    margin: { l: 48, r: 12, t: 8, b: 36 },
  });
  Plotly.react('c-regions', [heatmap, solidTrace, dashTrace, ...dotTraces], layout, _cfg);
}

/* ---- PNG DPI metadata (pHYs chunk injection) ---- */
const _crc32t = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function _crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = _crc32t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function _setPngDpi(dataUrl, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const bin = atob(dataUrl.split(',')[1]);
  const src = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);
  const pos = 33;
  const phys = new Uint8Array(21);
  const dv = new DataView(phys.buffer);
  dv.setUint32(0, 9);
  phys[4]=0x70; phys[5]=0x48; phys[6]=0x59; phys[7]=0x73;
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); phys[16] = 1;
  dv.setUint32(17, _crc32(phys.subarray(4, 17)));
  const out = new Uint8Array(src.length + 21);
  out.set(src.subarray(0, pos)); out.set(phys, pos); out.set(src.subarray(pos), pos + 21);
  let s = ''; for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
  return 'data:image/png;base64,' + btoa(s);
}

/** Download chart as high-res PNG with title + plot + notes */
async function downloadChart(id, name) {
  const gd = document.getElementById(id);
  const card = gd.closest('.chart-card');
  const dark = _isDark();
  const bg = dark ? '#0d1117' : '#ffffff';
  const plotBg = dark ? '#161b22' : '#fafbfc';
  const fg = dark ? '#e6edf3' : '#1a1d23';
  const fg2 = dark ? '#8b949e' : '#6b7080';
  const border = dark ? '#30363d' : '#dfe1e6';

  const origLayout = { paper_bgcolor: gd.layout.paper_bgcolor, plot_bgcolor: gd.layout.plot_bgcolor, 'margin.t': gd.layout.margin?.t };
  await Plotly.relayout(gd, { paper_bgcolor: bg, plot_bgcolor: plotBg, 'margin.t': 36 });
  const dataUrl = await Plotly.toImage(gd, { format: 'png', width: 1600, height: 1000, scale: 2 });
  await Plotly.relayout(gd, { paper_bgcolor: origLayout.paper_bgcolor, plot_bgcolor: origLayout.plot_bgcolor, 'margin.t': origLayout['margin.t'] || 8 });
  const chartImg = new Image(); chartImg.src = dataUrl;
  await new Promise(r => { chartImg.onload = r; });

  const title = (card.querySelector('h4 span[data-i18n]') || card.querySelector('h4 span')).textContent.trim();
  const noteEl = card.querySelector('.chart-note');
  const noteText = noteEl ? noteEl.innerText.trim() : '';

  const pad = 50, titleSize = 30, noteSize = 17, lineH = noteSize * 1.65;
  const maxW = chartImg.width;
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.font = noteSize + 'px Inter, system-ui, sans-serif';
  const noteLines = [];
  for (const para of noteText.split('\n')) {
    if (!para.trim()) continue;
    const words = para.trim().split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (tmp.measureText(test).width > maxW && line) { noteLines.push(line); line = w; }
      else line = test;
    }
    if (line) noteLines.push(line);
  }

  const titleH = titleSize + pad + 36;
  const noteH = noteLines.length ? noteLines.length * lineH + pad + 10 : 0;
  const W = chartImg.width + pad * 2;
  const H = titleH + chartImg.height + noteH + pad;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  ctx.font = 'bold ' + titleSize + 'px Inter, system-ui, sans-serif';
  ctx.fillText(title, pad, pad + titleSize * 0.8);
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, titleH - 4); ctx.lineTo(W - pad, titleH - 4); ctx.stroke();
  ctx.drawImage(chartImg, pad, titleH);

  if (noteLines.length) {
    const ny = titleH + chartImg.height + 16;
    ctx.beginPath(); ctx.moveTo(pad, ny); ctx.lineTo(W - pad, ny); ctx.stroke();
    ctx.fillStyle = fg2;
    ctx.font = noteSize + 'px Inter, system-ui, sans-serif';
    noteLines.forEach((l, i) => ctx.fillText(l, pad, ny + 24 + i * lineH));
  }

  const a = document.createElement('a');
  a.href = _setPngDpi(canvas.toDataURL('image/png'), 300);
  a.download = (name || id) + '.png'; a.click();
}

/** 4. Sender Strategy — Time Trend across rounds (BT + GL).
 *  Replicates Choi, Lee & Lim (2025) Fig. 11.
 *  Two lines per panel: Pr(m_t=1|θ₁=target) for t=1 (stage 1) and t=2 (stage 2).
 *  Demonstrates stability of sender strategies across repeated rounds.
 */
function plotTrend(R) {
  const el = document.getElementById('c-trend');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';

  if (!(R.bt && R.bt.length) && !(R.gl && R.gl.length)) { Plotly.purge(el); return; }

  // Group results by agent then by round index
  const compute = (results, targetState) => {
    const byAgent = {};
    for (const r of results) {
      if (!r.periods || r.periods.length < 2) continue;
      if (!byAgent[r.id]) byAgent[r.id] = [];
      byAgent[r.id].push(r);
    }
    const anyAgent = Object.values(byAgent)[0];
    if (!anyAgent) return null;
    const nRounds = anyAgent.length;
    const s1Sum = new Float64Array(nRounds), s1N = new Float64Array(nRounds);
    const s2Sum = new Float64Array(nRounds), s2N = new Float64Array(nRounds);
    for (const arr of Object.values(byAgent)) {
      arr.forEach((r, i) => {
        if (!r.periods || r.periods.length < 2) return;
        if (r.periods[0].st !== targetState) return;
        s1Sum[i] += r.periods[0].sent; s1N[i]++;
        s2Sum[i] += r.periods[1].sent; s2N[i]++;
      });
    }
    const xs = [], y1 = [], y2 = [];
    for (let i = 0; i < nRounds; i++) {
      if (s1N[i] > 0) {
        xs.push(i + 1);
        y1.push(s1Sum[i] / s1N[i]);
        y2.push(s2Sum[i] / s2N[i]);
      }
    }
    return { xs, y1, y2 };
  };

  const btD = compute(R.bt, 0);
  const glD = compute(R.gl, 1);

  const C_S1 = '#db2777';  // stage 1 — magenta (paper style)
  const C_S2 = '#f59e0b';  // stage 2 — amber

  const traces = [];
  const addLines = (d, axx, axy, showLegend) => {
    if (!d || !d.xs.length) return;
    traces.push({
      type: 'scatter', mode: 'lines+markers',
      x: d.xs, y: d.y1,
      line: { color: C_S1, width: 2.2 },
      marker: { size: 6, color: C_S1 },
      name: 't=1 (Stage 1)',
      showlegend: showLegend,
      legendgroup: 's1',
      xaxis: axx, yaxis: axy,
    });
    traces.push({
      type: 'scatter', mode: 'lines+markers',
      x: d.xs, y: d.y2,
      line: { color: C_S2, width: 2.2 },
      marker: { size: 6, color: C_S2 },
      name: 't=2 (Stage 2)',
      showlegend: showLegend,
      legendgroup: 's2',
      xaxis: axx, yaxis: axy,
    });
  };
  addLines(btD, 'x',  'y',  true);
  addLines(glD, 'x2', 'y2', false);

  const layout = _layout({
    height: 300,
    margin: { l: 62, r: 70, t: 32, b: 44 },
    xaxis:  { gridcolor: gc, domain: [0.00, 0.42], title: { text: t('ax.period'), font: { size: 10 } }, dtick: 1 },
    yaxis:  { gridcolor: gc, range: [-0.02, 1.02], title: { text: 'Pr(m<sub>t</sub>=1 | θ<sub>1</sub>=0)', font: { size: 10 } }, ticklabelstandoff: 4 },
    xaxis2: { gridcolor: gc, domain: [0.58, 1.00], title: { text: t('ax.period'), font: { size: 10 } }, dtick: 1, anchor: 'y2' },
    yaxis2: { gridcolor: gc, range: [-0.02, 1.02], side: 'right', title: { text: 'Pr(m<sub>t</sub>=1 | θ<sub>1</sub>=1)', font: { size: 10 }, standoff: 8 }, anchor: 'x2', ticklabelstandoff: 4 },
    legend: { x: 0.5, y: 1.14, xanchor: 'center', orientation: 'h', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    annotations: [
      { text: '<b>(a) BT</b>', xref: 'paper', yref: 'paper', x: 0.02, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
      { text: '<b>(b) GL</b>', xref: 'paper', yref: 'paper', x: 0.60, y: 1.08, showarrow: false, font: { size: 11, color: annColor } },
    ],
  });
  Plotly.react('c-trend', traces, layout, _cfg);
}

/** 5. Receiver Strategy in Each Stage (BT + GL × Stage 1 + Stage 2).
 *  Replicates Choi, Lee & Lim (2025) Fig. 12 / Appendix D.3.
 *  Stage-1 bars: mean a₁ conditional on m₁. Stage-2 bars: mean a₂ conditional on (m₁, θ₁, m₂).
 *  Blue diamonds (◆) mark equilibrium predictions.
 */
function plotReceiver(R) {
  const el = document.getElementById('c-receiver');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';

  if (!(R.bt && R.bt.length) && !(R.gl && R.gl.length)) { Plotly.purge(el); return; }

  const compute = (results) => {
    const stage1 = { 0: { sum: 0, n: 0 }, 1: { sum: 0, n: 0 } };
    const stage2 = {};
    for (const r of results) {
      if (!r.periods || r.periods.length < 2) continue;
      const p0 = r.periods[0], p1 = r.periods[1];
      stage1[p0.sent].sum += p0.at;
      stage1[p0.sent].n++;
      const key = `${p0.sent}|${p0.st}|${p1.sent}`;
      if (!stage2[key]) stage2[key] = { sum: 0, n: 0 };
      stage2[key].sum += p1.at;
      stage2[key].n++;
    }
    return { stage1, stage2 };
  };

  const bt = compute(R.bt);
  const gl = compute(R.gl);

  // Equilibrium predictions (Choi+ 2025 Table 3)
  // BT stage 1: a₁(m=0)=0, a₁(m=1)=1. BT stage 2: depends on history.
  // For BT period 2: bad type always sends m₂=1 → on-path histories are (m₁=0,θ₁=0,m₂=1)=2/3 and (m₁=1,θ₁=1,m₂=1)=2/3.
  // For GL stage 1: a₁(m=0)=1/2, a₁(m=1)=1/2 (equilibrium).
  // We show the bars anchored to equilibrium values observed in-simulation.
  const pred = {
    bt: {
      s1: { 0: 0, 1: 1 },
      s2: { '0|0|0': 0, '0|0|1': 2/3, '1|1|0': 0, '1|1|1': 2/3 },
    },
    gl: {
      s1: { 0: 0.5, 1: 0.5 },
      s2: { '0|1|0': 0, '0|1|1': 1, '0|0|0': 0, '0|0|1': 1, '1|1|0': 1/2, '1|1|1': 1/2 },
    },
  };

  const traces = [];
  const BAR_COL = '#c97373';
  const PRED = '#1e40af';

  const addStage1 = (s1, prd, axx, axy) => {
    const labels = ['m₁=0', 'm₁=1'];
    const vals = [
      s1[0].n ? s1[0].sum / s1[0].n : null,
      s1[1].n ? s1[1].sum / s1[1].n : null,
    ];
    const present = vals.map(v => v != null);
    traces.push({
      type: 'bar',
      x: labels.filter((_, i) => present[i]),
      y: vals.filter(v => v != null),
      marker: { color: BAR_COL, opacity: 0.75 },
      width: 0.5,
      showlegend: false,
      xaxis: axx, yaxis: axy,
      hovertemplate: '%{x}: a₁ = %{y:.3f}<extra></extra>',
    });
    // Prediction diamonds
    traces.push({
      type: 'scatter', mode: 'markers',
      x: labels.filter((_, i) => present[i]),
      y: [prd[0], prd[1]].filter((_, i) => present[i]),
      marker: { symbol: 'diamond', size: 10, color: PRED },
      showlegend: false,
      xaxis: axx, yaxis: axy,
      hovertemplate: 'prediction = %{y}<extra></extra>',
    });
  };

  const STAGE2_ORDER = ['0|0|0', '0|0|1', '0|1|0', '0|1|1', '1|0|0', '1|0|1', '1|1|0', '1|1|1'];
  const addStage2 = (s2, prd, axx, axy) => {
    const labels = [], vals = [], preds = [];
    for (const k of STAGE2_ORDER) {
      const d = s2[k];
      if (!d || d.n === 0) continue;
      const [m1, t1, m2] = k.split('|');
      labels.push(`m₂=${m2}<br>θ₁=${t1}, m₁=${m1}`);
      vals.push(d.sum / d.n);
      preds.push(prd[k] != null ? prd[k] : null);
    }
    traces.push({
      type: 'bar',
      x: labels, y: vals,
      marker: { color: BAR_COL, opacity: 0.75 },
      showlegend: false,
      xaxis: axx, yaxis: axy,
      hovertemplate: 'a₂ = %{y:.3f}<extra></extra>',
    });
    const predLabels = labels.filter((_, i) => preds[i] != null);
    const predVals = preds.filter(v => v != null);
    if (predVals.length) {
      traces.push({
        type: 'scatter', mode: 'markers',
        x: predLabels, y: predVals,
        marker: { symbol: 'diamond', size: 10, color: PRED },
        showlegend: false,
        xaxis: axx, yaxis: axy,
        hovertemplate: 'prediction = %{y}<extra></extra>',
      });
    }
  };

  addStage1(bt.stage1, pred.bt.s1, 'x',  'y');
  addStage1(gl.stage1, pred.gl.s1, 'x2', 'y2');
  addStage2(bt.stage2, pred.bt.s2, 'x3', 'y3');
  addStage2(gl.stage2, pred.gl.s2, 'x4', 'y4');

  const layout = _layout({
    height: 520,
    margin: { l: 52, r: 36, t: 32, b: 60 },
    xaxis:  { gridcolor: gc, domain: [0.00, 0.44] },
    yaxis:  { gridcolor: gc, range: [0, 1.1], domain: [0.60, 1.00], title: { text: 'a<sub>1</sub>', font: { size: 11 } }, ticklabelstandoff: 4 },
    xaxis2: { gridcolor: gc, domain: [0.56, 1.00], anchor: 'y2' },
    yaxis2: { gridcolor: gc, range: [0, 1.1], domain: [0.60, 1.00], side: 'right', anchor: 'x2', ticklabelstandoff: 4 },
    xaxis3: { gridcolor: gc, domain: [0.00, 0.44], anchor: 'y3', tickfont: { size: 8 } },
    yaxis3: { gridcolor: gc, range: [0, 1.1], domain: [0.00, 0.43], anchor: 'x3', title: { text: 'a<sub>2</sub>', font: { size: 11 } }, ticklabelstandoff: 4 },
    xaxis4: { gridcolor: gc, domain: [0.56, 1.00], anchor: 'y4', tickfont: { size: 8 } },
    yaxis4: { gridcolor: gc, range: [0, 1.1], domain: [0.00, 0.43], side: 'right', anchor: 'x4', ticklabelstandoff: 4 },
    annotations: [
      { text: '<b>(a) Stage 1 — BT</b>', xref: 'paper', yref: 'paper', x: 0.22, y: 1.04, showarrow: false, font: { size: 10, color: annColor } },
      { text: '<b>(b) Stage 1 — GL</b>', xref: 'paper', yref: 'paper', x: 0.78, y: 1.04, showarrow: false, font: { size: 10, color: annColor } },
      { text: '<b>(c) Stage 2 — BT</b>', xref: 'paper', yref: 'paper', x: 0.22, y: 0.47, showarrow: false, font: { size: 10, color: annColor } },
      { text: '<b>(d) Stage 2 — GL</b>', xref: 'paper', yref: 'paper', x: 0.78, y: 0.47, showarrow: false, font: { size: 10, color: annColor } },
    ],
  });
  Plotly.react('c-receiver', traces, layout, _cfg);
}

/** 6. Intertemporal Tradeoff of Reputation Building.
 *  Replicates Choi, Lee & Lim (2025) Fig. 14 / Appendix D.4.
 *  Single bar chart showing Δπ₁,₂ = π₁ − π₂ for BT and GL: positive in BT (stage-1 reputation cost),
 *  negative in GL (stage-1 sacrifice pays off in stage 2).
 */
function plotTradeoff(R) {
  const el = document.getElementById('c-tradeoff');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';

  if (!(R.bt && R.bt.length) && !(R.gl && R.gl.length)) { Plotly.purge(el); return; }

  const compute = (results) => {
    let p1 = 0, p2 = 0, n = 0;
    for (const r of results) {
      if (!r.periods || r.periods.length < 2) continue;
      const a = r.periods[0], b = r.periods[1];
      p1 += -((a.at - a.st) ** 2);
      p2 += -((b.at - b.st) ** 2);
      n++;
    }
    return n ? { pi1: p1 / n, pi2: p2 / n, delta: (p1 - p2) / n } : null;
  };

  const bt = compute(R.bt);
  const gl = compute(R.gl);
  const labels = [], vals = [], colors = [];
  if (bt) { labels.push('BT'); vals.push(bt.delta); colors.push('#c97373'); }
  if (gl) { labels.push('GL'); vals.push(gl.delta); colors.push('#c97373'); }

  const trace = {
    type: 'bar',
    x: labels, y: vals,
    marker: { color: colors, opacity: 0.8 },
    width: 0.42,
    text: vals.map(v => v.toFixed(3)),
    textposition: 'outside',
    textfont: { size: 10 },
    showlegend: false,
    hovertemplate: '%{x}: Δπ₁,₂ = %{y:.4f}<extra></extra>',
  };

  const ymax = Math.max(0.02, ...vals.map(v => Math.abs(v))) * 1.4;
  const layout = _layout({
    height: 300,
    margin: { l: 70, r: 20, t: 16, b: 36 },
    xaxis: { gridcolor: gc, fixedrange: true },
    yaxis: {
      gridcolor: gc,
      range: [-ymax, ymax],
      title: { text: 'Δπ<sub>1,2</sub> = π<sub>1</sub> − π<sub>2</sub>', font: { size: 11 } },
      zeroline: true,
      zerolinecolor: dark ? '#5b6472' : '#6b7280',
      zerolinewidth: 1,
      ticklabelstandoff: 4,
    },
  });
  Plotly.react('c-tradeoff', [trace], layout, _cfg);
}

/** Redraw shared charts from cached data */
function redrawAll(agents, R) {
  if (!agents) return;
  plotParams(agents);
  if (R) {
    plotSender(R);
    plotCluster(R);
    plotTrend(R);
    plotReceiver(R);
    plotTradeoff(R);
  }
  plotTypes(agents);
  plotRegions(agents);
}
