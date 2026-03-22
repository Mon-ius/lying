/**
 * Plotly-based chart rendering — responsive, theme-aware.
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
    { k: 'cl',    l: 'c_l (lying cost)',      c: CL.cl },
    { k: 'cd',    l: 'c_d (deception cost)',   c: CL.cd },
    { k: 'alpha', l: 'α (risk aversion)',      c: CL.alpha },
    { k: 'beta',  l: 'β (altruism)',           c: CL.beta },
  ];
  const traces = items.map((p, i) => ({
    x: agents.map(a => a[p.k]),
    type: 'histogram',
    nbinsx: 22,
    marker: { color: p.c, opacity: 0.45 },
    name: p.l,
    showlegend: false,
    xaxis: 'x' + (i + 1),
    yaxis: 'y' + (i + 1),
  }));
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';
  const annotations = items.map((p, i) => {
    const vals = agents.map(a => a[p.k]);
    const mu = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    const row = Math.floor(i / 2), col = i % 2;
    return {
      text: `<b>${p.l}</b>  μ=${mu}`,
      xref: 'x' + (i + 1) + ' domain', yref: 'y' + (i + 1) + ' domain',
      x: 0, y: 1.12, showarrow: false,
      font: { size: 10, color: annColor },
    };
  });
  const layout = _layout({
    grid: { rows: 2, columns: 2, pattern: 'independent', xgap: 0.08, ygap: 0.12 },
    height: 380,
    margin: { l: 36, r: 12, t: 28, b: 28 },
    annotations,
  });
  for (let i = 1; i <= 4; i++) {
    layout['xaxis' + i] = { gridcolor: gc, zeroline: false };
    layout['yaxis' + i] = { gridcolor: gc, zeroline: false, title: i % 2 === 1 ? '' : '' };
  }
  Plotly.react('c-params', traces, layout, _cfg);
}

/** 2. Joint (c_l, c_d) scatter — colored by classification */
function plotJoint(agents) {
  const groups = {};
  for (const a of agents) {
    const c = a.classification || 'unknown';
    if (!groups[c]) groups[c] = { x: [], y: [] };
    groups[c].x.push(a.cl);
    groups[c].y.push(a.cd);
  }
  const nameMap = { equilibrium: 'Equilibrium', lying_averse: 'Lying-averse', deception_averse: 'Deception-averse', inference_error: 'Inference error' };
  const traces = Object.entries(groups).map(([k, v]) => ({
    x: v.x, y: v.y,
    mode: 'markers',
    type: 'scatter',
    name: nameMap[k] || k,
    marker: { color: CL[k] || '#999', size: 5, opacity: 0.55 },
  }));
  const layout = _layout({
    height: 300,
    xaxis: { ...(_layout().xaxis), title: 'Lying cost c_l' },
    yaxis: { ...(_layout().yaxis), title: 'Deception cost c_d' },
    legend: { x: 1, y: 1, xanchor: 'right', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 52, r: 12, t: 8, b: 42 },
  });
  Plotly.react('c-joint', traces, layout, _cfg);
}

/** 3. Strategy distribution — BT or GL histogram */
function plotStrat(R, gt) {
  const cid = gt === 'BT' ? 'c-strat-bt' : 'c-strat-gl';
  const strats = gt === 'BT' ? R.btS : R.glS;
  const vals = Object.values(strats);
  if (!vals.length) return;
  const col = gt === 'BT' ? '#2563eb' : '#dc2626';
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const eq = gt === 'BT' ? 1 : 0;
  const traces = [{
    x: vals,
    type: 'histogram',
    nbinsx: 20,
    marker: { color: col, opacity: 0.5 },
    name: 'Observed',
    showlegend: false,
  }];
  const dark = _isDark();
  const noteColor = dark ? '#8b949e' : '#6b7080';
  const note1 = gt === 'BT'
    ? 'v = P(m=1|θ=0) · Eq: p=1.0 · Dashed = eq.'
    : 'w = P(m=0|θ=1) · Eq: p=0.0 · Dashed = eq.';
  const note2 = gt === 'BT'
    ? 'Prop. 3: deviation driven by c_d'
    : 'Prop. 4: deviation driven by c_l';
  const layout = _layout({
    height: 260,
    xaxis: { ...(_layout().xaxis), title: 'Truth-telling probability', range: [-0.02, 1.02] },
    yaxis: { ...(_layout().yaxis), title: 'Observations (%)' },
    shapes: [{
      type: 'line', x0: eq, x1: eq, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: col, width: 2, dash: 'dash' },
    }],
    annotations: [
      { text: `μ = ${avg.toFixed(3)}`, xref: 'paper', yref: 'paper', x: 0.02, y: 0.95, showarrow: false, font: { size: 11, color: dark ? '#c9d1d9' : '#3d4250', family: 'JetBrains Mono, monospace' } },
      { text: note1, xref: 'paper', yref: 'paper', x: 0, y: -0.22, showarrow: false, font: { size: 9, color: noteColor }, xanchor: 'left' },
      { text: note2, xref: 'paper', yref: 'paper', x: 0, y: -0.32, showarrow: false, font: { size: 9, color: noteColor }, xanchor: 'left' },
    ],
    margin: { l: 48, r: 12, t: 8, b: 64 },
  });
  Plotly.react(cid, traces, layout, _cfg);
}

/** 4. Agent type proportions — horizontal bar chart */
function plotTypes(agents) {
  const n = agents.length;
  const risk = {}, cls = {};
  for (const a of agents) {
    risk[a.riskType] = (risk[a.riskType] || 0) + 1;
    cls[a.classification] = (cls[a.classification] || 0) + 1;
  }
  const mkTrace = (data, group) => {
    const entries = Object.entries(data).sort((a, b) => a[1] - b[1]);
    return {
      y: entries.map(([k]) => k.replace(/_/g, ' ')),
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
  const riskTrace = mkTrace(risk, 'Risk');
  const clsTrace = mkTrace(cls, 'Classification');
  // Stack vertically using subplots
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
  // Build heatmap z-data
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
  // Boundary lines
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
  // Agent dots grouped by classification
  const groups = {};
  const nameMap = { equilibrium: 'Equilibrium', lying_averse: 'Lying-averse', deception_averse: 'Deception-averse', inference_error: 'Inference error' };
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
    hovertemplate: 'c_d=%{x:.2f}<br>c_l=%{y:.2f}<extra>' + (nameMap[k] || k) + '</extra>',
  }));
  // Region legend entries (shapes in legend)
  const regTraces = [
    { name: 'Full reputation', color: 'rgba(37,99,235,0.3)', dash: undefined },
    { name: 'Partial', color: 'rgba(217,119,6,0.3)', dash: undefined },
    { name: 'No reputation', color: 'rgba(220,38,38,0.3)', dash: 'dash' },
  ].map(r => ({
    x: [null], y: [null], mode: 'lines',
    line: { color: r.color, width: 8, dash: r.dash },
    name: r.name,
  }));
  const noteColor = dark ? '#8b949e' : '#6b7080';
  const layout = _layout({
    height: 320,
    xaxis: { ...(_layout().xaxis), title: 'Deception cost c_d', range: [0, mx] },
    yaxis: { ...(_layout().yaxis), title: 'Lying cost c_l', range: [0, mx] },
    legend: { x: 1, y: 1, xanchor: 'right', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 48, r: 12, t: 8, b: 56 },
    annotations: [{
      text: 'Props. 3 & 4 · Solid = full/partial · Dashed = partial/none',
      xref: 'paper', yref: 'paper', x: 0, y: -0.2,
      showarrow: false, font: { size: 9, color: noteColor }, xanchor: 'left',
    }],
  });
  Plotly.react('c-regions', [heatmap, solidTrace, dashTrace, ...regTraces, ...dotTraces], layout, _cfg);
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
