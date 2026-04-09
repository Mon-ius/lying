/**
 * Slide embedded results — runs pre-configured simulations and renders
 * Plotly charts directly into slide containers for academic presentations.
 * Depends on: engine.js, charts.js, i18n.js
 */

/* ---- Presets: three representative parameter configurations ---- */
const SLIDE_PRESETS = {
  default: {
    n: 30, rlPct: 33, rnPct: 34, raPct: 33,
    clMean: 0.5, cdMean: 0.5,
    env: 'both', rounds: 3, nPeriods: 8, ratio: 20, pb: 0.50, miscomm: 0.05,
  },
  highCd: {
    n: 30, rlPct: 33, rnPct: 34, raPct: 33,
    clMean: 0.3, cdMean: 1.2,
    env: 'both', rounds: 3, nPeriods: 8, ratio: 20, pb: 0.50, miscomm: 0.05,
  },
  highCl: {
    n: 30, rlPct: 33, rnPct: 34, raPct: 33,
    clMean: 1.2, cdMean: 0.3,
    env: 'both', rounds: 3, nPeriods: 8, ratio: 20, pb: 0.50, miscomm: 0.05,
  },
};

let _slideCache = {};

function _runPreset(key) {
  if (_slideCache[key]) return _slideCache[key];
  const p = SLIDE_PRESETS[key];
  const agents = createPopulation(p);
  const R = runSim(agents, {
    env: p.env, rounds: p.rounds, x1: 1, x2: p.ratio,
    nPeriods: p.nPeriods, pb: p.pb, miscomm: p.miscomm, seed: 42,
  });
  classify(agents, R);
  _slideCache[key] = { agents, R, p };
  return _slideCache[key];
}

/* ---- Measure exact container dimensions ---- */
function _dim(divId) {
  const el = document.getElementById(divId);
  if (!el) return { w: 280, h: 160 };
  const r = el.getBoundingClientRect();
  return {
    w: Math.max(Math.round(r.width), 100),
    h: Math.max(Math.round(r.height), 80),
  };
}

/* ---- Chart renderers ---- */

function _slidePlotParams(divId, agents) {
  const { w, h } = _dim(divId);
  const items = [
    { k: 'cl', l: 'c<sub>l</sub>', c: '#be185d' },
    { k: 'cd', l: 'c<sub>d</sub>', c: '#4338ca' },
    { k: 'alpha', l: 'α', c: '#0d9488' },
    { k: 'beta', l: 'β', c: '#c2410c' },
  ];
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';
  const traces = [], annotations = [];
  items.forEach((p, i) => {
    const vals = agents.map(a => a[p.k]);
    const mean = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    traces.push({
      x: vals, type: 'histogram', nbinsx: 18,
      marker: { color: p.c, opacity: 0.45 },
      name: p.l, showlegend: false,
      xaxis: 'x' + (i + 1), yaxis: 'y' + (i + 1),
    });
    annotations.push({
      text: `<b>${p.l}</b>  μ=${mean}`,
      xref: 'x' + (i + 1) + ' domain', yref: 'y' + (i + 1) + ' domain',
      x: 0, y: 1.08, showarrow: false,
      font: { size: 9, color: annColor },
    });
  });
  const layout = _layout({
    grid: { rows: 2, columns: 2, pattern: 'independent', xgap: 0.12, ygap: 0.3 },
    width: w, height: h, margin: { l: 36, r: 12, t: 28, b: 22 },
    annotations,
  });
  for (let i = 1; i <= 4; i++) {
    layout['xaxis' + i] = { gridcolor: gc, zeroline: false, automargin: true };
    layout['yaxis' + i] = { gridcolor: gc, zeroline: false, automargin: true };
  }
  Plotly.react(divId, traces, layout, _cfg);
}

function _slidePlotStrat(divId, R, gt) {
  const strats = gt === 'BT' ? R.btS : R.glS;
  const vals = Object.values(strats);
  if (!vals.length) return;
  const { w, h } = _dim(divId);
  const col = gt === 'BT' ? '#2563eb' : '#dc2626';
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const eq = gt === 'BT' ? 1 : 0;
  const dark = _isDark();
  const traces = [{
    x: vals, type: 'histogram', nbinsx: 16,
    marker: { color: col, opacity: 0.5 },
    showlegend: false,
  }];
  const layout = _layout({
    width: w, height: h,
    xaxis: { ...(_layout().xaxis), title: 'P(truth)', range: [-0.02, 1.02] },
    yaxis: { ...(_layout().yaxis), title: '' },
    shapes: [{
      type: 'line', x0: eq, x1: eq, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: col, width: 2, dash: 'dash' },
    }],
    annotations: [
      { text: `μ = ${avg.toFixed(3)}`, xref: 'paper', yref: 'paper', x: 0.02, y: 0.92, showarrow: false, font: { size: 10, color: dark ? '#c9d1d9' : '#3d4250', family: 'JetBrains Mono, monospace' } },
      { text: gt === 'BT' ? 'v*=1 (eq.)' : 'w*=0 (eq.)', xref: 'paper', yref: 'paper', x: 0.98, y: 0.92, xanchor: 'right', showarrow: false, font: { size: 9, color: col + '99' } },
    ],
    margin: { l: 36, r: 12, t: 8, b: 32 },
  });
  Plotly.react(divId, traces, layout, _cfg);
}

function _slidePlotRegions(divId, agents) {
  const { w, h } = _dim(divId);
  const mx = 5, res = 60;
  const dark = _isDark();
  const z = [];
  for (let j = 0; j < res; j++) {
    const row = [];
    for (let i = 0; i < res; i++) {
      const cd = (i / res) * mx, cl = (j / res) * mx;
      row.push(cl > .8 * cd + .2 ? 0 : cl > .3 * cd ? 1 : 2);
    }
    z.push(row);
  }
  const heatmap = {
    z, type: 'heatmap', x0: 0, dx: mx / res, y0: 0, dy: mx / res,
    colorscale: [
      [0, dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)'],
      [0.5, dark ? 'rgba(217,119,6,0.25)' : 'rgba(217,119,6,0.12)'],
      [1, dark ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.12)'],
    ],
    showscale: false, hoverinfo: 'skip',
  };
  const mkLine = fn => {
    const x = [], y = [];
    for (let i = 0; i <= 80; i++) { const cd = (i / 80) * mx; x.push(cd); y.push(fn(cd)); }
    return { x, y };
  };
  const lc = dark ? 'rgba(200,210,225,0.5)' : 'rgba(50,60,80,0.35)';
  const dc = dark ? 'rgba(200,210,225,0.4)' : 'rgba(50,60,80,0.25)';
  const solidLine = mkLine(cd => .8 * cd + .2);
  const dashedLine = mkLine(cd => .3 * cd);
  const solidTrace = { x: solidLine.x, y: solidLine.y, mode: 'lines', line: { color: lc, width: 2 }, showlegend: false, hoverinfo: 'skip' };
  const dashTrace = { x: dashedLine.x, y: dashedLine.y, mode: 'lines', line: { color: dc, width: 2, dash: 'dash' }, showlegend: false, hoverinfo: 'skip' };
  const groups = {};
  const nameMap = { equilibrium: 'Equilibrium', lying_averse: 'Lying-averse', deception_averse: 'Deception-averse', inference_error: 'Inference error' };
  const CL = { equilibrium: '#2563eb', lying_averse: '#16a34a', deception_averse: '#dc2626', inference_error: '#d97706' };
  for (const a of agents) {
    if (a.cd > mx || a.cl > mx) continue;
    const c = a.classification;
    if (!groups[c]) groups[c] = { x: [], y: [] };
    groups[c].x.push(a.cd); groups[c].y.push(a.cl);
  }
  const dotTraces = Object.entries(groups).map(([k, v]) => ({
    x: v.x, y: v.y, mode: 'markers', type: 'scatter',
    name: nameMap[k] || k,
    marker: { color: CL[k] || '#999', size: 5, opacity: 0.6 },
  }));
  const layout = _layout({
    width: w, height: h,
    xaxis: { ...(_layout().xaxis), title: 'c_d', range: [0, mx] },
    yaxis: { ...(_layout().yaxis), title: 'c_l', range: [0, mx] },
    legend: { x: 0.98, y: 0.02, xanchor: 'right', yanchor: 'bottom', font: { size: 8 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 42, r: 12, t: 8, b: 32 },
  });
  Plotly.react(divId, [heatmap, solidTrace, dashTrace, ...dotTraces], layout, _cfg);
}

function _slidePlotLambda(divId, R, ratio) {
  const { w, h } = _dim(divId);
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const collect = arr => {
    if (!arr.length || !arr[0].periods) return null;
    const N = arr[0].periods.length;
    if (N < 2) return null;
    const sums = new Float64Array(N), sqSums = new Float64Array(N);
    let count = 0;
    for (const r of arr) {
      if (!r.periods || r.periods.length !== N) continue;
      for (let t = 0; t < N; t++) { sums[t] += r.periods[t].lambda; sqSums[t] += r.periods[t].lambda ** 2; }
      count++;
    }
    if (!count) return null;
    const means = [], stds = [], xs = [];
    for (let t = 0; t < N; t++) { xs.push(t + 1); const m = sums[t] / count; means.push(m); stds.push(Math.sqrt(Math.max(0, sqSums[t] / count - m * m))); }
    return { xs, means, stds };
  };
  const bt = collect(R.bt), gl = collect(R.gl);
  if (!bt && !gl) return;
  const traces = [];
  const addBand = (d, name, color) => {
    if (!d) return;
    traces.push({
      x: [...d.xs, ...d.xs.slice().reverse()],
      y: [...d.means.map((m, i) => m + d.stds[i]), ...d.means.map((m, i) => m - d.stds[i]).reverse()],
      fill: 'toself', fillcolor: color.replace('1)', '0.12)'),
      line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
    });
    traces.push({ x: d.xs, y: d.means, mode: 'lines+markers', name, line: { color, width: 2.5 }, marker: { size: 4 } });
  };
  addBand(bt, 'BT', 'rgba(37,99,235,1)');
  addBand(gl, 'GL', 'rgba(220,38,38,1)');
  const layout = _layout({
    width: w, height: h,
    xaxis: { ...(_layout().xaxis), title: 'Period', dtick: 1 },
    yaxis: { ...(_layout().yaxis), title: 'λ', range: [0, 1.05] },
    legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 42, r: 12, t: 8, b: 32 },
  });
  Plotly.react(divId, traces, layout, _cfg);
}

function _slidePlotTypes(divId, agents) {
  const { w, h } = _dim(divId);
  const n = agents.length;
  const cls = {};
  for (const a of agents) cls[a.classification] = (cls[a.classification] || 0) + 1;
  const nameMap = { equilibrium: 'Eq.', lying_averse: 'Lying-av.', deception_averse: 'Decep.-av.', inference_error: 'Inf. error' };
  const CL = { equilibrium: '#2563eb', lying_averse: '#16a34a', deception_averse: '#dc2626', inference_error: '#d97706' };
  const entries = Object.entries(cls).sort((a, b) => a[1] - b[1]);
  const lMargin = Math.min(90, Math.round(w * 0.3));
  const trace = {
    y: entries.map(([k]) => nameMap[k] || k),
    x: entries.map(([, v]) => (v / n * 100)),
    type: 'bar', orientation: 'h',
    marker: { color: entries.map(([k]) => CL[k] || '#888'), opacity: 0.7 },
    text: entries.map(([, v]) => (v / n * 100).toFixed(0) + '%'),
    textposition: 'inside',
    insidetextanchor: 'end',
    textfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#fff' },
    showlegend: false,
    cliponaxis: false,
  };
  const layout = _layout({
    width: w, height: h,
    margin: { l: lMargin, r: 8, t: 4, b: 16 },
    xaxis: { ...(_layout().xaxis), range: [0, 102], showticklabels: false, zeroline: false },
    yaxis: { ...(_layout().yaxis), zeroline: false, tickfont: { size: 9 } },
    bargap: 0.25,
  });
  Plotly.react(divId, [trace], layout, _cfg);
}

/* ---- Lazy per-slide rendering ---- */
let _slideRendered = {};
let _slideDataReady = false;

function _ensureSlideData() {
  if (_slideDataReady) return;
  _runPreset('default');
  _runPreset('highCd');
  _runPreset('highCl');
  _slideDataReady = true;
}

const _SLIDE_CHARTS = {
  12: () => {
    const def = _runPreset('default'), hCd = _runPreset('highCd'), hCl = _runPreset('highCl');
    _slidePlotTypes('sc-types-def', def.agents);
    _slidePlotTypes('sc-types-hcd', hCd.agents);
    _slidePlotTypes('sc-types-hcl', hCl.agents);
  },
  15: () => {
    _slidePlotParams('sc-params', _runPreset('default').agents);
  },
  16: () => {
    const def = _runPreset('default'), hCd = _runPreset('highCd');
    _slidePlotStrat('sc-strat-bt-def', def.R, 'BT');
    _slidePlotStrat('sc-strat-bt-hcd', hCd.R, 'BT');
  },
  17: () => {
    const def = _runPreset('default'), hCl = _runPreset('highCl');
    _slidePlotStrat('sc-strat-gl-def', def.R, 'GL');
    _slidePlotStrat('sc-strat-gl-hcl', hCl.R, 'GL');
  },
  20: () => {
    const def = _runPreset('default');
    _slidePlotLambda('sc-lambda', def.R, def.p.ratio);
  },
  22: () => {
    const def = _runPreset('default'), hCd = _runPreset('highCd'), hCl = _runPreset('highCl');
    _slidePlotRegions('sc-regions-def', def.agents);
    _slidePlotRegions('sc-regions-hcd', hCd.agents);
    _slidePlotRegions('sc-regions-hcl', hCl.agents);
  },
};

function renderSlideCharts(slideNum) {
  const fn = _SLIDE_CHARTS[slideNum];
  if (!fn) return;
  _ensureSlideData();
  // Double rAF: first rAF triggers layout, second reads resolved dimensions
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fn();
    _slideRendered[slideNum] = true;
  }));
}

function _invalidateSlideCharts() {
  _slideRendered = {};
}

function renderAllSlideCharts() {
  _ensureSlideData();
  for (const num of Object.keys(_SLIDE_CHARTS)) {
    _SLIDE_CHARTS[num]();
    _slideRendered[num] = true;
  }
}

function renderSlideResults() {
  const active = document.querySelector('#slides-viewport .slide.active');
  if (active) renderSlideCharts(parseInt(active.dataset.slide));
}

/* ---- Auto-render when slides tab is shown ---- */
document.addEventListener('DOMContentLoaded', () => {
  const slidesTab = document.querySelector('[data-tab="slides"]');
  if (slidesTab) {
    slidesTab.addEventListener('click', () => {
      setTimeout(renderSlideResults, 300);
    });
  }
});

/* ---- Re-render on theme change ---- */
window.addEventListener('load', () => {
  const origApply = window.applyTheme;
  if (origApply) {
    window.applyTheme = function () {
      origApply();
      if (_slideDataReady) {
        _invalidateSlideCharts();
        const slidesTab = document.getElementById('tab-slides');
        if (slidesTab && slidesTab.classList.contains('active')) renderSlideResults();
      }
    };
  }
});
