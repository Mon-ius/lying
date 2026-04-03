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

/** 2. Joint (c_l, c_d) scatter — colored by classification */
function plotJoint(agents) {
  const groups = {};
  for (const a of agents) {
    const c = a.classification || 'unknown';
    if (!groups[c]) groups[c] = { x: [], y: [] };
    groups[c].x.push(a.cl);
    groups[c].y.push(a.cd);
  }
  const nameMap = { equilibrium: t('cls.eq'), lying_averse: t('cls.la'), deception_averse: t('cls.da'), inference_error: t('cls.ie') };
  const traces = Object.entries(groups).map(([k, v]) => ({
    x: v.x, y: v.y,
    mode: 'markers',
    type: 'scatter',
    name: nameMap[k] || k,
    marker: { color: CL[k] || '#999', size: 5, opacity: 0.55 },
  }));
  const allCl = agents.map(a => a.cl), allCd = agents.map(a => a.cd);
  const axMax = Math.min(Math.max(...allCl, ...allCd) * 1.1, 15);
  const layout = _layout({
    height: 400,
    xaxis: { ...(_layout().xaxis), title: t('ax.cl'), range: [0, axMax], scaleanchor: 'y', scaleratio: 1 },
    yaxis: { ...(_layout().yaxis), title: t('ax.cd'), range: [0, axMax] },
    legend: { x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)', tracegroupgap: 2 },
    margin: { l: 52, r: 16, t: 8, b: 42 },
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
  const layout = _layout({
    height: 260,
    xaxis: { ...(_layout().xaxis), title: t('ax.ttp'), range: [-0.02, 1.02] },
    yaxis: { ...(_layout().yaxis), title: t('ax.obs') },
    shapes: [{
      type: 'line', x0: eq, x1: eq, y0: 0, y1: 1,
      xref: 'x', yref: 'paper',
      line: { color: col, width: 2, dash: 'dash' },
    }],
    annotations: [
      { text: `μ = ${avg.toFixed(3)}`, xref: 'paper', yref: 'paper', x: 0.02, y: 0.95, showarrow: false, font: { size: 11, color: dark ? '#c9d1d9' : '#3d4250', family: 'JetBrains Mono, monospace' } },
    ],
    margin: { l: 48, r: 12, t: 8, b: 36 },
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

/** 7. Reputation dynamics — λ trajectory across N periods */
function plotLambda(R) {
  const el = document.getElementById('c-lambda');
  if (!el) return;
  const dark = _isDark();
  const gc = dark ? '#1e242e' : '#eef0f3';

  const collect = (arr) => {
    if (!arr.length || !arr[0].periods) return null;
    const N = arr[0].periods.length;
    if (N < 2) return null;
    const sums = new Float64Array(N), sqSums = new Float64Array(N);
    let count = 0;
    for (const r of arr) {
      if (!r.periods || r.periods.length !== N) continue;
      for (let t = 0; t < N; t++) {
        sums[t] += r.periods[t].lambda;
        sqSums[t] += r.periods[t].lambda ** 2;
      }
      count++;
    }
    if (!count) return null;
    const means = [], stds = [], xs = [];
    for (let t = 0; t < N; t++) {
      xs.push(t + 1);
      const m = sums[t] / count;
      means.push(m);
      stds.push(Math.sqrt(Math.max(0, sqSums[t] / count - m * m)));
    }
    return { xs, means, stds, count };
  };

  const bt = collect(R.bt);
  const gl = collect(R.gl);
  if (!bt && !gl) { Plotly.purge(el); return; }

  const traces = [];
  const addBand = (d, name, color) => {
    if (!d) return;
    const upper = d.means.map((m, i) => m + d.stds[i]);
    const lower = d.means.map((m, i) => m - d.stds[i]);
    traces.push({
      x: [...d.xs, ...d.xs.slice().reverse()],
      y: [...upper, ...lower.reverse()],
      fill: 'toself', fillcolor: color.replace('1)', '0.12)'),
      line: { width: 0 }, showlegend: false, hoverinfo: 'skip',
    });
    traces.push({
      x: d.xs, y: d.means,
      mode: 'lines+markers', name,
      line: { color: color, width: 2.5 },
      marker: { size: 5 },
    });
  };

  addBand(bt, 'BT', 'rgba(37,99,235,1)');
  addBand(gl, 'GL', 'rgba(220,38,38,1)');

  const ref = bt || gl;
  const N = ref.xs.length;
  const ratio = parseFloat(document.getElementById('s-ratio')?.value || 20);
  const weights = [];
  for (let t = 0; t < N; t++) weights.push(Math.pow(ratio, t / (N - 1)));
  traces.push({
    x: ref.xs, y: weights,
    mode: 'lines', name: 'x\u209c',
    line: { color: dark ? 'rgba(150,160,175,0.4)' : 'rgba(100,110,130,0.3)', width: 1.5, dash: 'dot' },
    yaxis: 'y2',
  });

  const layout = _layout({
    height: 320,
    xaxis: { ...(_layout().xaxis), title: t('ax.period'), dtick: 1 },
    yaxis: { ...(_layout().yaxis), title: '\u03bb', range: [0, 1.05] },
    yaxis2: { overlaying: 'y', side: 'right', title: 'x\u209c', showgrid: false, zeroline: false,
              gridcolor: gc, range: [0, Math.max(...weights) * 1.1],
              tickfont: { size: 9, color: dark ? '#555' : '#bbb' },
              titlefont: { size: 10, color: dark ? '#555' : '#bbb' } },
    legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 48, r: 48, t: 8, b: 36 },
  });
  Plotly.react('c-lambda', traces, layout, _cfg);
}

/** Point Cloud — Communication Trajectory Cloud */
function plotPointCloud(R, agents) {
  const el = document.getElementById('c-pointcloud');
  if (!el || !R) return;
  const view3d = document.getElementById('log-view-3d');
  if (view3d && view3d.style.display === 'none') return;

  const dark = _isDark();
  const isV2 = typeof currentVersion !== 'undefined' && currentVersion === 'ai';
  const rounds = +(document.getElementById('s-rounds')?.value) || 1;
  const _rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };

  const clsC = { equilibrium:'#2563eb', lying_averse:'#16a34a', deception_averse:'#dc2626', inference_error:'#d97706' };
  const clsN = { equilibrium:t('cls.eq'), lying_averse:t('cls.la'), deception_averse:t('cls.da'), inference_error:t('cls.ie') };
  const v2P = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0d9488','#be185d','#c2410c'];

  const bt0 = R.bt.filter((_, i) => i % rounds === 0);
  const gl0 = R.gl.filter((_, i) => i % rounds === 0);
  const hasBT = bt0.length > 0, hasGL = gl0.length > 0;
  if (!hasBT && !hasGL) { Plotly.purge(el); return; }
  const N = Math.max(bt0[0]?.periods?.length || 0, gl0[0]?.periods?.length || 0);

  if (N < 2) {
    const wm = {};
    for (const r of [...R.bt, ...R.gl]) { if (!wm[r.id]) wm[r.id]={s:0,n:0}; wm[r.id].s+=r.sp+r.rp; wm[r.id].n++; }
    const grp = {};
    for (const a of agents) {
      const gk = isV2 && a.modelKey ? (a.modelKey||'unknown').split('/').pop() : (a.classification||'unknown');
      if (!grp[gk]) grp[gk]={x:[],y:[],z:[],text:[]};
      const g = grp[gk], w = wm[a.id] ? wm[a.id].s/wm[a.id].n : 0;
      g.x.push(R.btS[a.id]??1); g.y.push(R.glS[a.id]??0); g.z.push(w);
      g.text.push(`<b>Agent ${a.id}</b><br>v=${(R.btS[a.id]??1).toFixed(3)} GL=${(R.glS[a.id]??0).toFixed(3)}<br>Welfare=${w.toFixed(3)}<br>${clsN[a.classification]||a.classification}`);
    }
    const tr=[]; let ci=0;
    for (const [k,g] of Object.entries(grp)) {
      tr.push({x:g.x,y:g.y,z:g.z,text:g.text,mode:'markers',type:'scatter3d',name:isV2?k:(clsN[k]||k.replace(/_/g,' ')),
        marker:{color:isV2?v2P[ci%v2P.length]:(clsC[k]||'#888'),size:4.5,opacity:0.8},hovertemplate:'%{text}<extra></extra>'}); ci++;
    }
    const gc=dark?'#1e242e':'#eef0f3', fc=dark?'#8b949e':'#6b7080';
    Plotly.react('c-pointcloud',tr,{paper_bgcolor:'rgba(0,0,0,0)',font:{family:'Inter,sans-serif',size:10,color:fc},margin:{l:0,r:0,t:8,b:0},autosize:true,
      scene:{xaxis:{title:{text:'v (BT)',font:{size:10}},gridcolor:gc,backgroundcolor:'rgba(0,0,0,0)',range:[-0.05,1.1]},
             yaxis:{title:{text:'GL truth-telling',font:{size:10}},gridcolor:gc,backgroundcolor:'rgba(0,0,0,0)',range:[-0.05,1.1]},
             zaxis:{title:{text:'Welfare',font:{size:10}},gridcolor:gc,backgroundcolor:'rgba(0,0,0,0)'},
             bgcolor:dark?'#0d1117':'#fafbfc',camera:{eye:{x:1.7,y:1.5,z:1.0}}},
      legend:{x:0.01,y:0.98,font:{size:9},bgcolor:'rgba(0,0,0,0)'},showlegend:true},{responsive:true,displayModeBar:'hover'});
    return;
  }

  const glOff = hasBT ? N + 1 : 0;
  const agentMap = {}; agents.forEach(a => { agentMap[a.id] = a; });

  const maxShow = 50;
  const showIds = new Set();
  if (agents.length <= maxShow) { agents.forEach(a => showIds.add(a.id)); }
  else { const step = Math.max(1, Math.floor(agents.length / maxShow));
    for (let i = 0; i < agents.length && showIds.size < maxShow; i += step) showIds.add(agents[i].id); }

  const groups = {};
  const ensure = gk => { if (!groups[gk]) groups[gk] = { mx:[],my:[],mz:[],mt:[],ms:[],msz:[], lx:[],ly:[],lz:[] }; return groups[gk]; };

  const addResult = (r, xOff) => {
    if (!showIds.has(r.id) || !r.periods) return;
    const a = agentMap[r.id], cls = a?.classification || 'unknown';
    const gk = isV2 && a?.modelKey ? (a.modelKey||'unknown').split('/').pop() : cls;
    const g = ensure(gk);
    const mk = a?.modelKey ? ` (${a.modelKey.split('/').pop()})` : '';

    for (const p of r.periods) {
      const x = p.t + 1 + xOff;
      g.mx.push(x); g.my.push(p.lambda); g.mz.push(p.at);
      g.ms.push(p.isLie ? 'diamond' : 'circle');
      g.msz.push(p.isDec ? 3 : 4.5);
      g.mt.push(
        `<b>Agent ${r.id}</b>${mk} \u00b7 ${r.gt} P${p.t+1}<br>` +
        `\u03b8=${p.st} \u2192 m=${p.sent} \u2192 a=${p.at.toFixed(2)}<br>` +
        `${p.isLie?'Lie':'Truth'}${p.isDec?' (deceptive)':''}${p.mc?' \u26a0mc':''}<br>` +
        `\u03bb=${p.lambda.toFixed(3)} | payoff=${p.payoff.toFixed(3)}`
      );
      g.lx.push(x); g.ly.push(p.lambda); g.lz.push(p.at);
    }
    g.lx.push(null); g.ly.push(null); g.lz.push(null);
  };
  bt0.forEach(r => addResult(r, 0));
  gl0.forEach(r => addResult(r, glOff));

  const traces = []; let ci = 0;
  for (const [k, g] of Object.entries(groups)) {
    const col = isV2 ? v2P[ci % v2P.length] : (clsC[k] || '#888');
    const name = isV2 ? k : (clsN[k] || k.replace(/_/g, ' '));
    if (g.lx.length) traces.push({
      x:g.lx, y:g.ly, z:g.lz, mode:'lines', type:'scatter3d',
      connectgaps:false, line:{color:_rgba(col,0.3),width:2},
      showlegend:false, hoverinfo:'skip',
    });
    traces.push({
      x:g.mx, y:g.my, z:g.mz, text:g.mt, mode:'markers', type:'scatter3d', name,
      marker:{color:col, size:g.msz, opacity:0.8, symbol:g.ms},
      hovertemplate:'%{text}<extra></extra>',
    });
    ci++;
  }

  const addMean = (results, xOff, label, col, sym) => {
    if (!results.length || !results[0].periods) return;
    const nP = results[0].periods.length;
    const sums = Array.from({length:nP}, () => ({l:0,a:0,n:0}));
    for (const r of results) { if (!r.periods) continue;
      for (const p of r.periods) { sums[p.t].l+=p.lambda; sums[p.t].a+=p.at; sums[p.t].n++; } }
    const x=[],y=[],z=[],txt=[];
    for (let i=0;i<nP;i++) { if (!sums[i].n) continue;
      const ml=sums[i].l/sums[i].n, ma=sums[i].a/sums[i].n;
      x.push(i+1+xOff); y.push(ml); z.push(ma);
      txt.push(`<b>${label} P${i+1}</b><br>\u03bb\u0304=${ml.toFixed(3)}<br>a\u0304=${ma.toFixed(3)}<br>n=${sums[i].n}`);
    }
    traces.push({ x,y,z,text:txt, mode:'lines+markers', type:'scatter3d', name:label+' mean',
      line:{color:_rgba(col,0.9),width:5.5},
      marker:{color:col,size:7,symbol:sym,line:{width:1.5,color:dark?'#000':'#fff'}},
      hovertemplate:'%{text}<extra></extra>' });
  };
  addMean(bt0, 0, 'BT', '#2563eb', 'circle');
  addMean(gl0, glOff, 'GL', '#dc2626', 'diamond');

  if (hasBT && hasGL) {
    const dx = N + 0.5;
    traces.push({ x:[dx,dx,dx,dx,dx], y:[0,0,1.05,1.05,0], z:[0,1,1,0,0],
      mode:'lines', type:'scatter3d', showlegend:false,
      line:{color:dark?'rgba(200,210,225,0.12)':'rgba(100,110,130,0.08)',width:1.5,dash:'dash'}, hoverinfo:'skip' });
  }

  const pb = +(document.getElementById('s-bp')?.value) || 0.5;
  const totalX = (hasBT?N:0) + (hasGL?N:0) + (hasBT&&hasGL?1:0);
  traces.push({ x:[0.5,totalX+0.5], y:[pb,pb], z:[0,0],
    mode:'lines', type:'scatter3d', name:'\u03bb\u2080='+pb.toFixed(2),
    line:{color:dark?'rgba(200,210,225,0.25)':'rgba(100,110,130,0.2)',width:1.5,dash:'dot'}, hoverinfo:'skip' });

  const tv=[], tt=[];
  if (hasBT) for (let i=1;i<=N;i++) { tv.push(i); tt.push('BT.'+i); }
  if (hasGL) for (let i=1;i<=N;i++) { tv.push(i+glOff); tt.push('GL.'+i); }

  const anns = [];
  if (hasBT) anns.push({ x:(N+1)/2, y:-0.1, z:0, text:'BT', font:{size:11,color:'#2563eb'}, showarrow:false });
  if (hasGL) anns.push({ x:glOff+(N+1)/2, y:-0.1, z:0, text:'GL', font:{size:11,color:'#dc2626'}, showarrow:false });

  const gc = dark?'#1e242e':'#eef0f3', fc = dark?'#8b949e':'#6b7080';
  const layout = {
    paper_bgcolor:'rgba(0,0,0,0)', font:{family:'Inter,sans-serif',size:10,color:fc},
    margin:{l:0,r:0,t:8,b:0}, autosize:true,
    scene: {
      xaxis: { title:{text:'',font:{size:1}}, gridcolor:gc, backgroundcolor:'rgba(0,0,0,0)',
               tickvals:tv, ticktext:tt, tickfont:{size:8,family:'JetBrains Mono,monospace'} },
      yaxis: { title:{text:'\u03bb (belief)',font:{size:10}}, gridcolor:gc, backgroundcolor:'rgba(0,0,0,0)', range:[-0.1,1.1] },
      zaxis: { title:{text:'Receiver action',font:{size:10}}, gridcolor:gc, backgroundcolor:'rgba(0,0,0,0)' },
      bgcolor: dark?'#0d1117':'#fafbfc',
      camera: { eye:{x:2.0, y:0.8, z:1.2} },
      annotations: anns,
    },
    legend:{x:0.01,y:0.98,font:{size:9},bgcolor:'rgba(0,0,0,0)'}, showlegend:true,
  };

  Plotly.react('c-pointcloud', traces, layout, {responsive:true, displayModeBar:'hover'});
}

/** Redraw shared charts from cached data */
function redrawAll(agents, R) {
  if (!agents) return;
  plotParams(agents);
  plotJoint(agents);
  if (R) { plotStrat(R, 'BT'); plotStrat(R, 'GL'); plotLambda(R); plotPointCloud(R, agents); }
  plotTypes(agents);
  plotRegions(agents);
}
