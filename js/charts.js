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
    /* Hide y-axis "0" labels — histogram counts obviously start at 0,
       and the label overlaps with the x-axis "0" at the corner. */
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
  const ppm = Math.round(dpi / 0.0254); // pixels per meter
  const bin = atob(dataUrl.split(',')[1]);
  const src = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);
  // Insert pHYs chunk after IHDR (8-byte sig + 25-byte IHDR = offset 33)
  const pos = 33;
  const phys = new Uint8Array(21); // 4 len + 4 type + 9 data + 4 crc
  const dv = new DataView(phys.buffer);
  dv.setUint32(0, 9);
  phys[4]=0x70; phys[5]=0x48; phys[6]=0x59; phys[7]=0x73; // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); phys[16] = 1; // unit=meter
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

  // 1. Capture Plotly chart with solid background + extra top margin
  const origLayout = { paper_bgcolor: gd.layout.paper_bgcolor, plot_bgcolor: gd.layout.plot_bgcolor, 'margin.t': gd.layout.margin?.t };
  await Plotly.relayout(gd, { paper_bgcolor: bg, plot_bgcolor: plotBg, 'margin.t': 36 });
  const dataUrl = await Plotly.toImage(gd, { format: 'png', width: 1600, height: 1000, scale: 2 });
  await Plotly.relayout(gd, { paper_bgcolor: origLayout.paper_bgcolor, plot_bgcolor: origLayout.plot_bgcolor, 'margin.t': origLayout['margin.t'] || 8 });
  const chartImg = new Image(); chartImg.src = dataUrl;
  await new Promise(r => { chartImg.onload = r; });

  // 2. Extract text
  const title = (card.querySelector('h4 span[data-i18n]') || card.querySelector('h4 span')).textContent.trim();
  const noteEl = card.querySelector('.chart-note');
  const noteText = noteEl ? noteEl.innerText.trim() : '';

  // 3. Word-wrap notes
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

  // 4. Build canvas
  const titleH = titleSize + pad + 36;
  const noteH = noteLines.length ? noteLines.length * lineH + pad + 10 : 0;
  const W = chartImg.width + pad * 2;
  const H = titleH + chartImg.height + noteH + pad;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = fg;
  ctx.font = 'bold ' + titleSize + 'px Inter, system-ui, sans-serif';
  ctx.fillText(title, pad, pad + titleSize * 0.8);

  // Separator
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, titleH - 4); ctx.lineTo(W - pad, titleH - 4); ctx.stroke();

  // Chart
  ctx.drawImage(chartImg, pad, titleH);

  // Notes
  if (noteLines.length) {
    const ny = titleH + chartImg.height + 16;
    ctx.beginPath(); ctx.moveTo(pad, ny); ctx.lineTo(W - pad, ny); ctx.stroke();
    ctx.fillStyle = fg2;
    ctx.font = noteSize + 'px Inter, system-ui, sans-serif';
    noteLines.forEach((l, i) => ctx.fillText(l, pad, ny + 24 + i * lineH));
  }

  // Download
  const a = document.createElement('a');
  a.href = _setPngDpi(canvas.toDataURL('image/png'), 300);
  a.download = (name || id) + '.png'; a.click();
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
