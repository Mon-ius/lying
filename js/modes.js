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
    // Stop game animation and restore chart log
    if (typeof _v3world !== 'undefined' && _v3world) _v3world.reset();
    if (window._logSample) renderLog();
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

  const N = Math.max(...sample.map(r => (r.periods || []).length), 1);
  const agents = LA || [];
  const n = agents.length;
  const env = document.getElementById('s-env')?.value || 'both';

  // --- Helpers ---
  function lieTag(isLie) {
    return isLie
      ? `<span class="v3-tag v3-tag-lie">${t('log.lie').toUpperCase()}</span>`
      : `<span class="v3-tag v3-tag-truth">${t('log.truth').toUpperCase()}</span>`;
  }
  function decTag(isDec) {
    return isDec ? ` <span class="v3-tag v3-tag-dec">${t('log.deceptive').toUpperCase()}</span>` : '';
  }
  function mcTag(mc) {
    return mc ? ` <span class="v3-tag" style="background:rgba(255,149,0,0.1);color:#FF9500;border:1px solid rgba(255,149,0,0.2)">${t('log.miscomm').toUpperCase()}</span>` : '';
  }
  function decisionEntry(r, p, pi) {
    const theta = p ? p.st : r.s1;
    const sent = p ? p.sent : r.sent;
    const rcv = p ? p.rcv : r.rcv;
    const action = p ? p.at : r.a1;
    const lambda = p ? p.lambda : (r.lambda || 0);
    const pay = p ? p.payoff : r.sp;
    const isLie = p ? p.isLie : r.isLie;
    const isDec = p ? p.isDec : r.isDec;
    const isMc = p ? p.mc : r.mc;
    const dec = p ? p.dec : r.dec;
    return `<div class="v3-le-decision"><div class="v3-le-pair">` +
      `<strong>${agentName(r.id)}</strong> \u2192 ${t('gw.receiver')} ${lieTag(isLie)}${decTag(isDec)}${mcTag(isMc)}</div>` +
      `<div class="v3-le-detail">` +
      `\u2460 \u03B8=${theta}` +
      ` \u2461 m=${sent}` +
      ` \u2462 rcv=${rcv}${isMc ? '\u26A0' : ''}` +
      ` \u2463 a=${action.toFixed(2)} \u03BB=${lambda.toFixed(2)}` +
      ` \u2464 ${t('gw.payoff').toLowerCase()}=${pay.toFixed(2)}` +
      (dec > 0 ? ` D=${dec.toFixed(2)}` : '') +
      `</div></div>`;
  }

  let html = '';

  // --- Phase 1: Population ---
  html += `<details class="v3-log-group" open>`;
  html += `<summary class="v3-le-phase"><span class="v3-le-icon">\uD83C\uDFD8\uFE0F</span><strong>${t('gw.ph1')}</strong><span class="v3-le-desc"> \u2014 ${n} ${t('gw.agents')}</span></summary>`;
  const showPop = Math.min(n, 8);
  for (let i = 0; i < showPop; i++) {
    const a = agents[i];
    const rt = { risk_loving: t('gw.rt.rl'), risk_neutral: t('gw.rt.rn'), risk_averse: t('gw.rt.ra') }[a.riskType] || a.riskType;
    html += `<div class="v3-log-entry"><div class="v3-le-agent"><strong>${agentName(a.id)}</strong> <span class="v3-le-text"><em>${rt}</em> \u00b7 c\u2097=${a.cl.toFixed(2)} c\u2091=${a.cd.toFixed(2)} \u03B1=${a.alpha.toFixed(2)}</span></div></div>`;
  }
  if (n > showPop) html += `<div class="v3-log-entry"><div class="v3-le-summary">+${n - showPop} ${t('gw.morestrat')}</div></div>`;
  html += `</details>`;

  // --- Arena phases ---
  const envs = env === 'BT' ? ['BT'] : env === 'GL' ? ['GL'] : ['BT', 'GL'];
  for (const gt of envs) {
    const isBT = gt === 'BT';
    const icon = isBT ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F';
    const arenaName = isBT ? t('gw.btarena') : t('gw.glarena');
    const arenaDesc = isBT ? t('gw.btarena.d') : t('gw.glarena.d');
    const gtSample = sample.filter(r => r.gt === gt);
    if (!gtSample.length) continue;

    html += `<details class="v3-log-group" open>`;
    html += `<summary class="v3-le-phase"><span class="v3-le-icon">${icon}</span><strong>${arenaName}</strong><span class="v3-le-desc"> \u2014 ${gtSample.length} ${t('gw.agents')} \u2014 ${arenaDesc}</span></summary>`;

    if (N < 2) {
      // Single period — flat list
      for (const r of gtSample) {
        html += `<div class="v3-log-entry">${decisionEntry(r, null, 0)}</div>`;
      }
    } else {
      // Multi-period — one sub-group per period
      for (let pi = 0; pi < N; pi++) {
        const isLast = pi === N - 1;
        const sfx = t('log.periodSuffix');
        const label = isLast && N > 1
          ? `${t('log.period')} ${pi + 1}${sfx} (${t('log.myopic')})`
          : `${t('log.period')} ${pi + 1}${sfx}`;
        const pds = gtSample.map(r => ({ r, p: (r.periods || [])[pi] })).filter(x => x.p);
        const nLie = pds.filter(x => x.p.isLie).length;
        const nDec = pds.filter(x => x.p.isDec).length;
        const stats = `${pds.length} ${t('gw.agents')} \u00b7 ${pds.length - nLie} ${t('gw.truths')} \u00b7 ${nLie} ${t('gw.lies')}${nDec ? ' \u00b7 ' + nDec + ' ' + t('gw.deceptive') : ''}`;

        html += `<details class="v3-log-group"${pi === 0 ? ' open' : ''}>`;
        html += `<summary class="v3-le-phase"><strong>${label}</strong><span class="v3-le-desc"> \u2014 ${stats}</span></summary>`;
        for (const { r, p } of pds) {
          html += `<div class="v3-log-entry">${decisionEntry(r, p, pi)}</div>`;
        }
        html += `</details>`;
      }
    }

    // Arena summary
    const lies = gtSample.filter(r => r.isLie).length;
    const decs = gtSample.filter(r => r.isDec).length;
    html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDCCA ${arenaName}: <strong>${gtSample.length - lies}</strong> ${t('gw.truths')}, <strong>${lies}</strong> ${t('gw.lies')}, <strong>${decs}</strong> ${t('gw.deceptive')}</div></div>`;
    html += `</details>`;
  }

  // --- Phase 5: Classification ---
  html += `<details class="v3-log-group">`;
  html += `<summary class="v3-le-phase"><span class="v3-le-icon">\uD83C\uDFDB\uFE0F</span><strong>${t('gw.ph5')}</strong><span class="v3-le-desc"> \u2014 ${t('gw.profiles')}</span></summary>`;
  const C = { equilibrium: 0, lying_averse: 0, deception_averse: 0, inference_error: 0 };
  for (const a of agents) {
    if (a.classification) C[a.classification]++;
    const cls = { equilibrium: t('gw.cls.eq'), lying_averse: t('gw.cls.la'), deception_averse: t('gw.cls.da'), inference_error: t('gw.cls.ie') }[a.classification] || a.classification;
    html += `<div class="v3-log-entry"><div class="v3-le-agent"><strong>${agentName(a.id)}</strong> <span class="v3-le-text">\u2192 <strong>${cls}</strong> \u00b7 c\u2097=${a.cl.toFixed(2)} c\u2091=${a.cd.toFixed(2)}</span></div></div>`;
  }
  const pct = k => n > 0 ? (C[k] / n * 100).toFixed(0) + '%' : '0%';
  html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDD35 ${t('gw.cls.eq')}: ${C.equilibrium} (${pct('equilibrium')})</div></div>`;
  html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDFE2 ${t('gw.cls.la')}: ${C.lying_averse} (${pct('lying_averse')})</div></div>`;
  html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDD34 ${t('gw.cls.da')}: ${C.deception_averse} (${pct('deception_averse')})</div></div>`;
  html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDFE0 ${t('gw.cls.ie')}: ${C.inference_error} (${pct('inference_error')})</div></div>`;
  const allP = [...(LR?.bt || []), ...(LR?.gl || [])].map(r => r.sp + r.rp);
  if (allP.length) html += `<div class="v3-log-entry"><div class="v3-le-summary">\uD83D\uDCB0 ${t('gw.avgwelf')}: ${(allP.reduce((a,b)=>a+b,0)/allP.length).toFixed(3)}</div></div>`;
  html += `</details>`;

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
    plotSender(R);
    plotCluster(R);
    plotTrend(R);
    plotReceiver(R);
    plotTradeoff(R);
    plotTypes(agents);
    plotRegions(agents);

    // Log
    const btSample = R.bt.filter((_, i) => i % rounds === 0);
    const glSample = R.gl.filter((_, i) => i % rounds === 0);
    window._logSample = [...btSample, ...glSample];
    renderLog();

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
    plotParams(agents);
    plotSender(LR);
    plotCluster(LR);
    plotTrend(LR);
    plotReceiver(LR);
    plotTradeoff(LR);
    plotTypes(agents);
    plotRegions(agents);

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
