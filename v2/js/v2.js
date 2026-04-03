/**
 * V2 — AI Agent experiment mode.
 * Depends on: engine.js, charts.js, i18n.js, version-loader.js, app.js (shared),
 *             v2/js/ai-agent.js, v2/js/v2-charts.js
 */

/* ---- Stats table renderer ---- */
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

/* ---- Run AI experiment (V2 multi-provider, multi-trial) ---- */
async function runAI() {
  const roster = buildAgentRoster();
  if (roster.length < 2) { alert('Need at least 2 agents — increase agent count or adjust composition.'); return; }
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

    // V2 cross-model charts + stats table
    plotModelStrats(stats);
    plotModelTypes(stats);
    plotModelDeviation(stats);
    renderStatsTable(stats);
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = '');

    // Game log
    LGL = allGameLogs;
    const lastLog = allGameLogs[allGameLogs.length - 1];
    renderGameLog(lastLog, agents);
    plotPointCloud(LR, LA);
    const totalAI = allGameLogs.reduce((s, lg) => s + lg.filter(e => e.type === 'agent' && !e.error).length, 0);
    const totalFB = allGameLogs.reduce((s, lg) => s + lg.filter(e => e.type === 'agent' && e.error).length, 0);
    prog.textContent = `Done — ${nTrials} trial${nTrials > 1 ? 's' : ''}, ${totalAI} AI calls, ${totalFB} fallbacks, ${n} agents`;
  } catch (e) {
    prog.textContent = 'Error: ' + e.message;
  }
  btn.classList.remove('loading'); btn.disabled = false;
}

/* ---- Register V2 ---- */
registerVersion('v2', {
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
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = 'none');
  },
  redraw: () => {
    if (LS) { plotModelStrats(LS); plotModelTypes(LS); plotModelDeviation(LS); }
  },
});
