/**
 * AI Cross-Model Comparison Charts (Figs 8-10).
 * Depends on: charts.js (_isDark, _layout, _cfg, CL, t)
 */

/** 8. Cross-Model Strategy Comparison — grouped bar with error bars */
function plotModelStrats(stats) {
  const el = document.getElementById('c-model-strats');
  if (!el || !stats?.perModel) return;
  const dark = _isDark();
  const models = Object.keys(stats.perModel);
  if (!models.length) return;

  const labels = models.map(m => {
    const parts = m.split('/');
    return parts.length > 1 ? parts[1] : m;
  });

  const btMeans = models.map(m => stats.perModel[m].bt.mean);
  const btErr   = models.map(m => stats.perModel[m].bt.ci || stats.perModel[m].bt.std);
  const glMeans = models.map(m => stats.perModel[m].gl.mean);
  const glErr   = models.map(m => stats.perModel[m].gl.ci || stats.perModel[m].gl.std);

  const traces = [];
  if (btMeans.some(v => v > 0 || !isNaN(v))) {
    traces.push({
      x: labels, y: btMeans, name: 'BT (v)',
      type: 'bar',
      marker: { color: 'rgba(37,99,235,0.65)' },
      error_y: { type: 'data', array: btErr, visible: true, color: dark ? '#8b949e' : '#666' },
    });
  }
  if (glMeans.some(v => v > 0 || !isNaN(v))) {
    traces.push({
      x: labels, y: glMeans, name: 'GL (w)',
      type: 'bar',
      marker: { color: 'rgba(220,38,38,0.65)' },
      error_y: { type: 'data', array: glErr, visible: true, color: dark ? '#8b949e' : '#666' },
    });
  }

  const layout = _layout({
    height: 340,
    barmode: 'group',
    xaxis: { ...(_layout().xaxis), title: '', tickangle: -30, tickfont: { size: 9 } },
    yaxis: { ...(_layout().yaxis), title: t('ax.ttp'), range: [0, 1.15] },
    legend: { x: 0.02, y: 0.98, font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 48, r: 16, t: 8, b: 72 },
    shapes: [
      { type: 'line', x0: -0.5, x1: labels.length - 0.5, y0: 1, y1: 1,
        line: { color: 'rgba(37,99,235,0.4)', width: 1.5, dash: 'dash' } },
      { type: 'line', x0: -0.5, x1: labels.length - 0.5, y0: 0, y1: 0,
        line: { color: 'rgba(220,38,38,0.4)', width: 1.5, dash: 'dash' } },
    ],
    annotations: [
      { text: 'v*=1', x: labels.length - 0.6, y: 1.04, showarrow: false,
        font: { size: 9, color: 'rgba(37,99,235,0.7)', family: 'JetBrains Mono, monospace' } },
    ],
  });
  Plotly.react('c-model-strats', traces, layout, _cfg);
}

/** 9. Cross-Model Classification — stacked horizontal bar per model */
function plotModelTypes(stats) {
  const el = document.getElementById('c-model-types');
  if (!el || !stats?.perModel) return;
  const dark = _isDark();
  const models = Object.keys(stats.perModel);
  if (!models.length) return;

  const labels = models.map(m => {
    const parts = m.split('/');
    return parts.length > 1 ? parts[1] : m;
  });

  const CLS_KEYS = ['equilibrium', 'lying_averse', 'deception_averse', 'inference_error'];
  const clsNames = { equilibrium: t('cls.eq'), lying_averse: t('cls.la'), deception_averse: t('cls.da'), inference_error: t('cls.ie') };

  const traces = CLS_KEYS.map(k => ({
    y: labels,
    x: models.map(m => (stats.perModel[m].cls[k] || 0) * 100),
    name: clsNames[k] || k.replace(/_/g, ' '),
    type: 'bar',
    orientation: 'h',
    marker: { color: CL[k], opacity: 0.75 },
    texttemplate: '%{x:.0f}%',
    textposition: 'inside',
    textfont: { size: 9, color: '#fff' },
    insidetextanchor: 'middle',
    hovertemplate: '%{y}: %{x:.1f}%<extra>' + (clsNames[k] || k) + '</extra>',
  }));

  const layout = _layout({
    height: Math.max(220, models.length * 50 + 80),
    barmode: 'stack',
    xaxis: { ...(_layout().xaxis), title: '%', range: [0, 105] },
    yaxis: { ...(_layout().yaxis), automargin: true, tickfont: { size: 9 } },
    legend: { x: 0.5, y: -0.15, xanchor: 'center', orientation: 'h', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 120, r: 16, t: 8, b: 48 },
  });
  Plotly.react('c-model-types', traces, layout, _cfg);
}

/** 10. Model vs. Equilibrium Deviation — scatter with error ellipses */
function plotModelDeviation(stats) {
  const el = document.getElementById('c-model-deviation');
  if (!el || !stats?.perModel) return;
  const dark = _isDark();
  const models = Object.keys(stats.perModel);
  if (!models.length) return;

  const palette = ['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0d9488','#be185d','#c2410c',
                    '#4338ca','#65a30d','#0891b2','#e11d48'];

  const traces = [];
  models.forEach((m, i) => {
    const d = stats.perModel[m];
    const label = m.split('/').pop();
    const col = palette[i % palette.length];

    const btCi = d.bt.ci || d.bt.std;
    const glCi = d.gl.ci || d.gl.std;
    if (btCi > 0 || glCi > 0) {
      const pts = 40;
      const ex = [], ey = [];
      for (let j = 0; j <= pts; j++) {
        const angle = (j / pts) * 2 * Math.PI;
        ex.push(d.btDev + btCi * Math.cos(angle));
        ey.push(d.glDev + glCi * Math.sin(angle));
      }
      traces.push({
        x: ex, y: ey, mode: 'lines',
        line: { color: col, width: 1, dash: 'dot' },
        showlegend: false, hoverinfo: 'skip',
      });
    }

    traces.push({
      x: [d.btDev], y: [d.glDev],
      mode: 'markers+text', name: label,
      marker: { color: col, size: 10, symbol: 'diamond', opacity: 0.85 },
      text: [label], textposition: 'top center',
      textfont: { size: 8, color: dark ? '#c9d1d9' : '#3d4250' },
      hovertemplate: `<b>${label}</b><br>BT dev: %{x:.3f}<br>GL dev: %{y:.3f}<extra></extra>`,
    });
  });

  traces.push({
    x: [0], y: [0],
    mode: 'markers', name: 'Equilibrium',
    marker: { color: dark ? '#c9d1d9' : '#333', size: 12, symbol: 'star', line: { width: 1, color: dark ? '#fff' : '#000' } },
    hovertemplate: 'Perfect equilibrium<extra></extra>',
  });

  const maxDev = Math.max(0.15, ...models.map(m => Math.max(stats.perModel[m].btDev, stats.perModel[m].glDev) * 1.3));
  const layout = _layout({
    height: 380,
    xaxis: { ...(_layout().xaxis), title: 'BT deviation |v − v*|', range: [-0.02, maxDev] },
    yaxis: { ...(_layout().yaxis), title: 'GL deviation |w − w*|', range: [-0.02, maxDev], scaleanchor: 'x', scaleratio: 1 },
    legend: { x: 1, y: 1, xanchor: 'right', font: { size: 9 }, bgcolor: 'rgba(0,0,0,0)' },
    margin: { l: 56, r: 16, t: 8, b: 48 },
  });
  Plotly.react('c-model-deviation', traces, layout, _cfg);
}
