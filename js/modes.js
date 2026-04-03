/**
 * Mode management — Math/AI paradigm switching, Chart/Game view toggling,
 * and both mode runners.
 *
 * Merges: version-loader.js + v1.js + v2.js
 * Depends on: engine.js, charts.js, ai-charts.js, i18n.js, app.js, ai-agent.js
 */

/* ==================================================================
   MODE REGISTRY & VIEW TOGGLE
   ================================================================== */

const VERSIONS = {};
let currentVersion = 'math';
let currentView = 'chart';

function registerVersion(id, config) {
  VERSIONS[id] = config;
}

function switchVersion(v) {
  if (VERSIONS[currentVersion]?.onDeactivate) VERSIONS[currentVersion].onDeactivate();
  currentVersion = v;
  document.querySelectorAll('.paradigm-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  const cfg = VERSIONS[v];
  if (!cfg) return;
  // Run button
  const btn = document.getElementById('btn-run');
  const label = document.getElementById('btn-run-label');
  label.setAttribute('data-i18n', cfg.runLabel || 'btn.run');
  label.textContent = t(cfg.runLabel || 'btn.run');
  btn.className = 'btn-run' + (cfg.btnClass ? ' ' + cfg.btnClass : '');
  // Architecture diagrams — show matching, hide others
  document.querySelectorAll('.arch-diagram').forEach(el => {
    el.style.display = el.id === 'arch-' + v ? '' : 'none';
  });
  // Body mode class
  document.body.className = document.body.className.replace(/\bmode-\w+/g, '');
  if (cfg.bodyClass) document.body.classList.add(cfg.bodyClass);
  // Version-specific activation
  if (cfg.onActivate) cfg.onActivate();
}

function switchView(view) {
  currentView = view;
  // Update toggle buttons
  document.querySelectorAll('.view-toggle-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view)
  );
  if (view === 'chart') {
    // Show chart elements, hide game
    const v3c = document.getElementById('v3-container');
    if (v3c) v3c.style.display = 'none';
    document.querySelectorAll('.chart-game-toggle').forEach(el => el.style.display = '');
    // Stop game animation
    if (typeof _v3world !== 'undefined' && _v3world) _v3world.reset();
  } else {
    // Show game, hide chart elements
    const v3c = document.getElementById('v3-container');
    if (v3c) v3c.style.display = '';
    document.querySelectorAll('.chart-game-toggle').forEach(el => el.style.display = 'none');
    // Resize canvas + init game if data exists
    setTimeout(() => {
      if (typeof _getWorld === 'function') {
        const w = _getWorld();
        if (w) { w.resize(); w.draw(); }
      }
      if (LA && LR && typeof initGameFromResults === 'function') {
        initGameFromResults();
      }
    }, 100);
  }
}

/** Called by mode run functions after setting LA/LR to auto-init game if in game view */
function afterRun() {
  if (currentView === 'game' && typeof initGameFromResults === 'function') {
    initGameFromResults();
  }
}

function runCurrentVersion() {
  const cfg = VERSIONS[currentVersion];
  if (cfg?.run) cfg.run();
}

/** Redraw shared charts + version-specific charts */
function fullRedraw() {
  if (currentView === 'chart') {
    redrawAll(LA, LR);
    const cfg = VERSIONS[currentVersion];
    if (cfg?.redraw) cfg.redraw();
  } else if (typeof _v3world !== 'undefined' && _v3world && _v3world.state !== 'idle') {
    _v3world.resize();
    _v3world.draw();
  }
}

/* ==================================================================
   MATH MODE — Translatable game log + deterministic simulation
   ================================================================== */

function renderLog() {
  const log = document.getElementById('log');
  const sample = window._logSample;
  if (!log || !sample || !sample.length) return;
  const rtMap = { risk_loving: t('rt.rl'), risk_neutral: t('rt.rn'), risk_averse: t('rt.ra') };

  const N = Math.max(...sample.map(r => (r.periods || []).length), 1);

  function agentAnalysis(r) {
    let sobelNote = '';
    if (!r.isLie && r.isDec) sobelNote = t('log.prop1');
    else if (r.isLie && !r.isDec) sobelNote = t('log.prop2');
    const truthWins = r.augT >= r.augL;
    const diff = Math.abs(r.augT - r.augL).toFixed(3);
    const winner = truthWins ? t('log.truth') : t('log.lie');
    return `<div class="log-section"><strong>${t('log.decision')}</strong>
      <div class="log-grid">
        <span>EU\u1d43(${t('log.truth')}) = ${r.augT.toFixed(3)}</span>
        <span>EU\u1d43(${t('log.lie')}) = ${r.augL.toFixed(3)}</span>
        <span>\u2192 ${winner} ${t('log.better')} ${diff}</span>
        <span>${t('log.strategy')} = ${r.strat.toFixed(2)}</span>
      </div>
    </div>
    <div class="log-section"><strong>${t('log.sobel')}</strong>
      <div class="log-grid">
        <span>${r.isLie ? t('log.islie') : t('log.nolie')}</span>
        <span>D = ${r.dec.toFixed(3)} \u2192 ${r.isDec ? t('log.isdec') : t('log.nodec')}</span>
        ${sobelNote ? `<span class="tag tag-sobel">${sobelNote}</span>` : ''}
      </div>
    </div>
    <div class="log-section"><strong>${t('log.profile')}</strong>
      <div class="log-grid">
        <span>c<sub>l</sub> = ${r.cl.toFixed(3)}</span>
        <span>c<sub>d</sub> = ${r.cd.toFixed(3)}</span>
        <span>\u03b1 = ${r.alpha.toFixed(3)} (${rtMap[r.riskType] || r.riskType})</span>
      </div>
    </div>`;
  }

  if (N < 2) {
    log.innerHTML = sample.map((r, i) => {
      const lieTag = r.isLie
        ? `<span class="tag tag-lie">${t('log.lie')}</span>`
        : `<span class="tag tag-truth">${t('log.truth')}</span>`;
      const decTag = r.isDec ? `<span class="tag tag-dec">${t('log.deceptive')}</span>` : '';
      const mcTag = r.mc ? `<span class="tag tag-mc">${t('log.miscomm')}</span>` : '';
      return `<details class="log-entry"${i === 0 ? ' open' : ''}>
  <summary>
    <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700">${r.gt}</span>
    ${t('log.agent')}\u2009${agentName(r.id)}
    \u2003\u03b8\u2081=${r.s1} \u2192 m=${r.sent} \u2192 a\u2081=${r.a1.toFixed(2)}
    \u2003${lieTag}${decTag ? '\u2002' + decTag : ''}${mcTag ? '\u2002' + mcTag : ''}
    \u2003${t('log.payoff')}=${r.sp.toFixed(2)}
  </summary>
  <div class="log-detail">
    <div class="log-section"><strong>${t('log.p1')}</strong>
      <div class="log-grid">
        <span>\u03b8\u2081 = ${r.s1}</span>
        <span>m = ${r.sent} (${r.isLie ? t('log.lie') : t('log.truth')})</span>
        <span>${t('log.rcv')} = ${r.rcv}${r.mc ? ' \u26a0' : ''}</span>
        <span>a\u2081 = ${r.a1.toFixed(3)}</span>
      </div>
    </div>
    ${agentAnalysis(r)}
  </div>
</details>`;
    }).join('');
    return;
  }

  let html = '';

  for (let pi = 0; pi < N; pi++) {
    const isLast = pi === N - 1;
    const sfx = t('log.periodSuffix');
    const label = isLast && N > 1
      ? `${t('log.period')} ${pi + 1}${sfx} (${t('log.myopic')})`
      : `${t('log.period')} ${pi + 1}${sfx}`;

    const pds = sample.map(r => (r.periods || [])[pi]).filter(Boolean);
    const nBT = sample.filter(r => r.gt === 'BT' && (r.periods || [])[pi]).length;
    const nGL = sample.filter(r => r.gt === 'GL' && (r.periods || [])[pi]).length;
    const countLabel = nBT && nGL ? `${nBT} BT + ${nGL} GL` : `${pds.length} ${t('log.agents')}`;
    const nLie = pds.filter(p => p.isLie).length;
    const nDec = pds.filter(p => p.isDec).length;
    const stats = `${countLabel} \u00b7 ${pds.length - nLie} ${t('log.truth').toLowerCase()} \u00b7 ${nLie} ${t('log.lie').toLowerCase()}${nDec ? ' \u00b7 ' + nDec + ' ' + t('log.deceptive').toLowerCase() : ''}`;

    const rows = sample.map(r => {
      const p = (r.periods || [])[pi];
      if (!p) return '';
      const lieTag = p.isLie
        ? `<span class="tag tag-lie">${t('log.lie')}</span>`
        : `<span class="tag tag-truth">${t('log.truth')}</span>`;
      const decTag = p.isDec ? `<span class="tag tag-dec">${t('log.deceptive')}</span>` : '';
      const mcTag = p.mc ? `<span class="tag tag-mc">${t('log.miscomm')}</span>` : '';
      return `<div class="log-period-row">
  <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700;font-size:.65rem">${r.gt}</span>
  ${t('log.agent')}\u2009${agentName(r.id)}
  \u2003\u03b8<sub>${pi+1}</sub>=${p.st} \u2192 m=${p.sent} \u2192 a<sub>${pi+1}</sub>=${p.at.toFixed(2)}
  \u2003\u03bb<sub>${pi+1}</sub>=${p.lambda.toFixed(3)}
  \u2003${lieTag}${decTag ? '\u2002' + decTag : ''}${mcTag ? '\u2002' + mcTag : ''}
</div>`;
    }).filter(Boolean).join('');

    html += `<details class="log-period"${pi === 0 ? ' open' : ''}>
  <summary><strong>${label}</strong><span class="log-period-stats">${stats}</span></summary>
  <div class="log-period-body">${rows}</div>
</details>`;
  }

  const aBT = sample.filter(r => r.gt === 'BT').length;
  const aGL = sample.filter(r => r.gt === 'GL').length;
  html += `<details class="log-period">
  <summary><strong>${t('log.analysis')}</strong><span class="log-period-stats">${aBT && aGL ? aBT + ' BT + ' + aGL + ' GL' : sample.length + ' ' + t('log.agents')}</span></summary>
  <div class="log-period-body">`;

  html += sample.map((r, i) => {
    const lieTag = r.isLie
      ? `<span class="tag tag-lie">${t('log.lie')}</span>`
      : `<span class="tag tag-truth">${t('log.truth')}</span>`;
    return `<details class="log-entry"${i === 0 ? ' open' : ''}>
  <summary>
    <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700">${r.gt}</span>
    ${t('log.agent')}\u2009${agentName(r.id)}
    \u2003${t('log.payoff')}=${r.sp.toFixed(2)} \u2003${lieTag}
  </summary>
  <div class="log-detail">${agentAnalysis(r)}</div>
</details>`;
  }).join('');

  html += '</div></details>';
  log.innerHTML = html;
}

/* ---- Run Math experiment ---- */
function runExperiment() {
  const btn = document.getElementById('btn-run');
  btn.classList.add('loading'); btn.disabled = true;
  requestAnimationFrame(() => { setTimeout(() => {
    const n = +document.getElementById('s-n').value;
    const rl = +document.getElementById('s-rl').value;
    const rn = +document.getElementById('s-rn').value;
    const ra = +document.getElementById('s-ra').value;
    const agents = createPopulation({
      n, rlPct: rl, rnPct: rn, raPct: ra,
      clMean: +document.getElementById('s-cl').value,
      cdMean: +document.getElementById('s-cd').value,
    });
    _assignNames(agents);
    const env = document.getElementById('s-env').value;
    const rounds = +document.getElementById('s-rounds').value;
    const nPeriods = +document.getElementById('s-periods').value;
    const ratio = +document.getElementById('s-ratio').value;
    const bp = +document.getElementById('s-bp').value;
    const miscomm = +document.getElementById('s-miscomm').value / 100;
    const R = runSim(agents, { env, rounds, x1: 1, x2: ratio, nPeriods, pb: bp, miscomm, seed: 42 });
    const C = classify(agents, R);
    LA = agents; LR = R;

    // KPIs
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    document.getElementById('st-eq').textContent = pct('equilibrium');
    document.getElementById('st-la').textContent = pct('lying_averse');
    document.getElementById('st-da').textContent = pct('deception_averse');
    document.getElementById('st-ie').textContent = pct('inference_error');
    document.querySelectorAll('.kpi').forEach((el, i) => {
      const bar = el.querySelector('.bar'); if (!bar) return;
      const vals = [C.equilibrium, C.lying_averse, C.deception_averse, C.inference_error];
      if (i < 4) bar.style.width = (vals[i] / n * 100) + '%';
    });
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    document.getElementById('st-welfare').textContent = allP.length
      ? (allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(2) : '--';

    // Charts
    plotParams(agents);
    plotJoint(agents);
    if (env === 'both' || env === 'BT') plotStrat(R, 'BT');
    if (env === 'both' || env === 'GL') plotStrat(R, 'GL');
    plotTypes(agents);
    plotRegions(agents);
    plotLambda(R);

    // Log
    const btSample = R.bt.filter((_, i) => i % rounds === 0);
    const glSample = R.gl.filter((_, i) => i % rounds === 0);
    window._logSample = [...btSample, ...glSample];
    renderLog();
    plotPointCloud(R, agents);

    afterRun();
    btn.classList.remove('loading'); btn.disabled = false;
  }, 60); });
}

/* ==================================================================
   AI MODE — Stats table renderer + multi-provider experiment
   ================================================================== */

function renderStatsTable(stats) {
  const el = document.getElementById('stats-table');
  if (!el || !stats?.perModel) return;
  const models = Object.keys(stats.perModel);
  if (!models.length) { el.innerHTML = ''; return; }

  const fmt = (v, d) => isNaN(v) ? '--' : v.toFixed(d || 3);
  const fmtCI = (m, ci) => `${fmt(m)} \u00b1 ${fmt(ci)}`;

  let html = `<table class="stats-table">
    <thead><tr>
      <th>${t('stats.model')}</th><th>n</th>
      <th>${t('stats.btstrat')}</th><th>${t('stats.glstrat')}</th>
      <th>${t('cls.eq')}</th><th>${t('cls.la')}</th><th>${t('cls.da')}</th><th>${t('cls.ie')}</th>
    </tr></thead><tbody>`;

  for (const [mk, d] of Object.entries(stats.perModel)) {
    const label = mk.split('/').pop();
    html += `<tr>
      <td><strong>${label}</strong></td>
      <td>${d.n}</td>
      <td>${fmtCI(d.bt.mean, d.bt.ci)}</td>
      <td>${fmtCI(d.gl.mean, d.gl.ci)}</td>
      <td>${(d.cls.equilibrium * 100).toFixed(0)}%</td>
      <td>${(d.cls.lying_averse * 100).toFixed(0)}%</td>
      <td>${(d.cls.deception_averse * 100).toFixed(0)}%</td>
      <td>${(d.cls.inference_error * 100).toFixed(0)}%</td>
    </tr>`;
  }

  const agg = stats.aggregate;
  html += `<tr style="border-top:2px solid var(--border);font-weight:600">
    <td>${t('stats.aggregate') || 'All models'}</td>
    <td>${agg.nModels}</td>
    <td>${fmtCI(agg.bt.mean, agg.bt.ci)}</td>
    <td>${fmtCI(agg.gl.mean, agg.gl.ci)}</td>
    <td colspan="4">${agg.nTrials} ${t('stats.trials') || 'trials'}</td>
  </tr>`;

  html += '</tbody></table>';
  el.innerHTML = html;
}

async function runAI() {
  const roster = buildAgentRoster();
  if (roster.length < 2) { alert('Need at least 2 agents \u2014 increase agent count or adjust composition.'); return; }
  const anyKey = ['admin','rl','rn','ra'].some(s => document.getElementById('pk-'+s)?.value.trim());
  if (!anyKey) { alert('Enter at least one API key (in Administrator or Agent Groups).'); return; }

  const btn = document.getElementById('btn-run');
  const prog = document.getElementById('ai-progress');
  btn.classList.add('loading'); btn.disabled = true;
  const nTrials = +(document.getElementById('s-trials')?.value || 1);
  prog.textContent = nTrials > 1 ? `Starting multi-trial AI experiment (${nTrials} trials)...` : 'Starting AI experiment...';

  try {
    const { agents, allTrialResults, stats, allGameLogs } = await runMultiTrialAIExperiment((step, total, msg) => {
      prog.textContent = `[${step}/${total}] ${msg}`;
    });

    const lastTrial = allTrialResults[allTrialResults.length - 1];
    LA = agents; LR = lastTrial.R; LS = stats;

    // KPIs from aggregate stats
    const n = agents.length;
    const C = { equilibrium: 0, lying_averse: 0, deception_averse: 0, inference_error: 0 };
    for (const a of agents) C[a.classification]++;
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    document.getElementById('st-eq').textContent = pct('equilibrium');
    document.getElementById('st-la').textContent = pct('lying_averse');
    document.getElementById('st-da').textContent = pct('deception_averse');
    document.getElementById('st-ie').textContent = pct('inference_error');
    document.querySelectorAll('.kpi').forEach((el, i) => {
      const bar = el.querySelector('.bar'); if (!bar) return;
      const vals = [C.equilibrium, C.lying_averse, C.deception_averse, C.inference_error];
      if (i < 4) bar.style.width = (vals[i] / n * 100) + '%';
    });
    const allP = [...LR.bt, ...LR.gl].map(r => r.sp + r.rp);
    document.getElementById('st-welfare').textContent = allP.length
      ? (allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(2) : '--';

    // Standard charts
    const env = document.getElementById('s-env').value;
    plotParams(agents);
    plotJoint(agents);
    if (env === 'both' || env === 'BT') plotStrat(LR, 'BT');
    if (env === 'both' || env === 'GL') plotStrat(LR, 'GL');
    plotTypes(agents);
    plotRegions(agents);
    plotLambda(LR);

    // Cross-model charts + stats table
    plotModelStrats(stats);
    plotModelTypes(stats);
    plotModelDeviation(stats);
    renderStatsTable(stats);
    document.querySelectorAll('.ai-chart').forEach(el => el.style.display = '');

    // Game log
    LGL = allGameLogs;
    const lastLog = allGameLogs[allGameLogs.length - 1];
    renderGameLog(lastLog, agents);
    plotPointCloud(LR, LA);
    const totalAI = allGameLogs.reduce((s, lg) => s + lg.filter(e => e.type === 'agent' && !e.error).length, 0);
    const totalFB = allGameLogs.reduce((s, lg) => s + lg.filter(e => e.type === 'agent' && e.error).length, 0);
    prog.textContent = `Done \u2014 ${nTrials} trial${nTrials > 1 ? 's' : ''}, ${totalAI} AI calls, ${totalFB} fallbacks, ${n} agents`;

    afterRun();
  } catch (e) {
    prog.textContent = 'Error: ' + e.message;
  }
  btn.classList.remove('loading'); btn.disabled = false;
}

/* ==================================================================
   MODE REGISTRATION
   ================================================================== */

registerVersion('math', {
  runLabel: 'btn.run',
  btnClass: '',
  bodyClass: '',
  run: runExperiment,
  onActivate: () => {
    document.getElementById('p-ai').style.display = 'none';
    document.querySelectorAll('.ai-chart').forEach(el => el.style.display = 'none');
  },
  onDeactivate: () => {},
  redraw: () => {},
});

registerVersion('ai', {
  runLabel: 'btn.airun',
  btnClass: 'btn-ai',
  bodyClass: 'mode-ai',
  run: runAI,
  onActivate: () => {
    const aiPanel = document.getElementById('p-ai');
    aiPanel.style.display = '';
    aiPanel.classList.remove('collapsed');
    initGroupModels();
  },
  onDeactivate: () => {
    document.getElementById('p-ai').style.display = 'none';
    document.querySelectorAll('.ai-chart').forEach(el => el.style.display = 'none');
  },
  redraw: () => {
    if (LS) { plotModelStrats(LS); plotModelTypes(LS); plotModelDeviation(LS); }
  },
});
