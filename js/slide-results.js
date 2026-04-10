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

/** Paper Fig. 9 / Appendix D.1 — Sender strategy (bar + histogram) for a single treatment. */
function _slidePlotSender(divId, R, gt) {
  const strats = gt === 'BT' ? R.btS : R.glS;
  const vals = Object.values(strats || {});
  if (!vals.length) return;
  const { w, h } = _dim(divId);
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const BAR = '#c97373', PRED = '#1e40af';
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const eq = gt === 'BT' ? 1 : 0;
  const traces = [
    {
      type: 'bar', x: [gt], y: [mean],
      marker: { color: BAR, opacity: 0.75 }, width: 0.5,
      showlegend: false, xaxis: 'x', yaxis: 'y',
    },
    {
      type: 'scatter', mode: 'markers', x: [gt], y: [eq],
      marker: { symbol: 'diamond', size: 10, color: PRED },
      showlegend: false, xaxis: 'x', yaxis: 'y',
    },
    {
      type: 'histogram', x: vals,
      xbins: { start: -0.025, end: 1.025, size: 0.05 },
      marker: { color: BAR, opacity: 0.75 },
      showlegend: false, xaxis: 'x2', yaxis: 'y2',
    },
    {
      type: 'scatter', mode: 'markers', x: [eq], y: [Math.max(1, vals.length)],
      marker: { symbol: 'x', size: 10, color: PRED, line: { width: 2 } },
      showlegend: false, xaxis: 'x2', yaxis: 'y2', hoverinfo: 'skip',
    },
  ];
  const layout = _layout({
    width: w, height: h,
    margin: { l: 40, r: 10, t: 6, b: 32 },
    xaxis: { gridcolor: gc, domain: [0.00, 0.16], tickfont: { size: 9 }, fixedrange: true },
    yaxis: { gridcolor: gc, range: [0, 1.05], title: { text: 'P(truth)', font: { size: 9 } }, ticklabelstandoff: 3 },
    xaxis2: { gridcolor: gc, domain: [0.26, 1.00], range: [-0.02, 1.02], title: { text: 'P(truth)', font: { size: 9 } } },
    yaxis2: { gridcolor: gc, anchor: 'x2', side: 'right', showticklabels: false, ticks: '' },
    bargap: 0.05,
  });
  Plotly.react(divId, traces, layout, _cfg);
}

/** Paper Fig. 11 — Sender strategy time trend (two lines: t=1 and t=2), both treatments side by side. */
function _slidePlotTrend(divId, R) {
  const { w, h } = _dim(divId);
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';
  const annColor = dark ? '#c9d1d9' : '#3d4250';

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
  const C_S1 = '#db2777', C_S2 = '#f59e0b';
  const traces = [];
  const addLines = (d, axx, axy, showLegend) => {
    if (!d || !d.xs.length) return;
    traces.push({ type: 'scatter', mode: 'lines+markers', x: d.xs, y: d.y1, line: { color: C_S1, width: 2 }, marker: { size: 5 }, name: 't=1', showlegend: showLegend, legendgroup: 's1', xaxis: axx, yaxis: axy });
    traces.push({ type: 'scatter', mode: 'lines+markers', x: d.xs, y: d.y2, line: { color: C_S2, width: 2 }, marker: { size: 5 }, name: 't=2', showlegend: showLegend, legendgroup: 's2', xaxis: axx, yaxis: axy });
  };
  addLines(btD, 'x',  'y',  true);
  addLines(glD, 'x2', 'y2', false);

  const layout = _layout({
    width: w, height: h,
    margin: { l: 48, r: 48, t: 26, b: 32 },
    xaxis:  { gridcolor: gc, domain: [0.00, 0.42], title: { text: 'Round', font: { size: 9 } }, dtick: 1 },
    yaxis:  { gridcolor: gc, range: [-0.02, 1.02], title: { text: 'P(m=1|θ₁=0)', font: { size: 9 } } },
    xaxis2: { gridcolor: gc, domain: [0.58, 1.00], title: { text: 'Round', font: { size: 9 } }, dtick: 1, anchor: 'y2' },
    yaxis2: { gridcolor: gc, range: [-0.02, 1.02], side: 'right', title: { text: 'P(m=1|θ₁=1)', font: { size: 9 }, standoff: 6 }, anchor: 'x2' },
    legend: { x: 0.5, y: 1.15, xanchor: 'center', orientation: 'h', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    annotations: [
      { text: '<b>BT</b>', xref: 'paper', yref: 'paper', x: 0.02, y: 1.08, showarrow: false, font: { size: 10, color: annColor } },
      { text: '<b>GL</b>', xref: 'paper', yref: 'paper', x: 0.60, y: 1.08, showarrow: false, font: { size: 10, color: annColor } },
    ],
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
    _slidePlotSender('sc-strat-bt-def', def.R, 'BT');
    _slidePlotSender('sc-strat-bt-hcd', hCd.R, 'BT');
  },
  17: () => {
    const def = _runPreset('default'), hCl = _runPreset('highCl');
    _slidePlotSender('sc-strat-gl-def', def.R, 'GL');
    _slidePlotSender('sc-strat-gl-hcl', hCl.R, 'GL');
  },
  20: () => {
    const def = _runPreset('default');
    _slidePlotTrend('sc-trend', def.R);
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
