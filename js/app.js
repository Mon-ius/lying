/**
 * Application shell — theme, tabs, UI event wiring, experiment administration.
 * Depends on: engine.js, charts.js, i18n.js
 */

/* ---- Translatable game log ---- */
function renderLog() {
  const log = document.getElementById('log');
  const sample = window._logSample;
  if (!log || !sample || !sample.length) return;
  const rtMap = { risk_loving: t('rt.rl'), risk_neutral: t('rt.rn'), risk_averse: t('rt.ra') };

  const N = Math.max(...sample.map(r => (r.periods || []).length), 1);

  /* Helper: per-agent decision / Sobel / profile block */
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

  /* --- N < 2: flat per-agent view --- */
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
    ${t('log.agent')}\u2009${r.id}
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

  /* --- N >= 2: period-grouped view with collapsible sections --- */
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
  ${t('log.agent')}\u2009${r.id}
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

  /* Analysis summary — per-agent decision / Sobel / profile */
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
    ${t('log.agent')}\u2009${r.id}
    \u2003${t('log.payoff')}=${r.sp.toFixed(2)} \u2003${lieTag}
  </summary>
  <div class="log-detail">${agentAnalysis(r)}</div>
</details>`;
  }).join('');

  html += '</div></details>';
  log.innerHTML = html;
}

/* ---- Theme management ---- */
const THEME_KEY = 'theme-pref';

function getEffectiveTheme() {
  const pref = localStorage.getItem(THEME_KEY) || 'auto';
  if (pref === 'auto') return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  return pref;
}

function applyTheme() {
  const stored = localStorage.getItem(THEME_KEY) || 'auto';
  document.documentElement.setAttribute('data-theme', stored);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const eff = getEffectiveTheme();
  const next = eff === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  redrawAll(LA, LR, LS);
});

window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  applyTheme();
  redrawAll(LA, LR, LS);
});

applyTheme();

/* ---- Tab navigation ---- */
document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ---- i18n wiring ---- */
document.getElementById('lang-select').addEventListener('change', e => applyI18n(e.target.value));

/* ---- draw.io integration ---- */
(function setupDrawio() {
  const btn = document.getElementById('btn-drawio');
  const base = window.location.href.replace(/\/[^/]*$/, '/');
  btn.href = 'https://app.diagrams.net/#U' + encodeURIComponent(base + 'architecture.drawio');
})();

/* ---- Mobile sidebar toggle ---- */
(function setupSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.querySelector('.sidebar');
  function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); }
  function openSidebar() { sidebar.classList.add('open'); backdrop.classList.add('visible'); }
  if (toggle) toggle.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
})();

/* ---- Hamburger menu (mobile) ---- */
(function setupHamburger() {
  const btn = document.getElementById('nav-hamburger');
  const menu = document.getElementById('nav-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('open');
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('.mobile-toggle, .theme-btn, .paradigm-btn')) menu.classList.remove('open');
  });
  const ls = document.getElementById('lang-select');
  if (ls) ls.addEventListener('change', () => menu.classList.remove('open'));
})();

/* ---- Log view toggle (TXT / 3D) ---- */
function switchLogView(view) {
  document.querySelectorAll('.log-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('log-view-txt').style.display = view === 'txt' ? '' : 'none';
  document.getElementById('log-view-3d').style.display = view === '3d' ? '' : 'none';
  if (view === '3d' && LR && LA) {
    setTimeout(() => plotPointCloud(LR, LA), 60);
  }
}

/* ---- Panel toggle ---- */
function togglePanel(id) { document.getElementById(id).classList.toggle('collapsed'); }

/* ---- Slider value display ---- */
document.querySelectorAll('input[type=range]').forEach(el => {
  const vid = 'v-' + el.id.slice(2);
  const upd = () => {
    const ve = document.getElementById(vid);
    if (!ve) return;
    if (['rl', 'rn', 'ra', 'miscomm'].includes(el.id.slice(2))) ve.textContent = el.value + '%';
    else if (el.id === 's-bp') ve.textContent = parseFloat(el.value).toFixed(2);
    else if (['cl', 'cd'].includes(el.id.slice(2))) ve.textContent = parseFloat(el.value).toFixed(1);
    else ve.textContent = el.value;
  };
  el.addEventListener('input', upd);
  upd();
});

/* ---- Constrained composition sliders (always sum to 100%) ---- */
function updateCompBar() {
  const rl = +document.getElementById('s-rl').value;
  const rn = +document.getElementById('s-rn').value;
  const ra = +document.getElementById('s-ra').value;
  const bar = document.getElementById('comp-bar');
  bar.children[0].style.flex = rl || 0.001;
  bar.children[1].style.flex = rn || 0.001;
  bar.children[2].style.flex = ra || 0.001;
  bar.children[0].querySelector('span').textContent = rl + '%';
  bar.children[1].querySelector('span').textContent = rn + '%';
  bar.children[2].querySelector('span').textContent = ra + '%';
  ['rl', 'rn', 'ra'].forEach(k => {
    document.getElementById('v-' + k).textContent = document.getElementById('s-' + k).value + '%';
  });
}

function constrainRisk(changedId) {
  const ids = ['s-rl', 's-rn', 's-ra'];
  const sliders = ids.map(id => document.getElementById(id));
  const ci = ids.indexOf(changedId);
  const cv = +sliders[ci].value;
  const oi = ids.map((_, i) => i).filter(i => i !== ci);
  const others = oi.map(i => +sliders[i].value);
  const otherSum = others[0] + others[1];
  const remaining = 100 - cv;

  if (otherSum > 0) {
    const r0 = Math.round(others[0] / otherSum * remaining);
    sliders[oi[0]].value = r0;
    sliders[oi[1]].value = remaining - r0;
  } else {
    const half = Math.round(remaining / 2);
    sliders[oi[0]].value = half;
    sliders[oi[1]].value = remaining - half;
  }
  updateCompBar();
  if (typeof updateGroupCounts === 'function') updateGroupCounts();
}

['s-rl', 's-rn', 's-ra'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => constrainRisk(id));
});
document.getElementById('s-n').addEventListener('input', () => {
  if (typeof updateGroupCounts === 'function') updateGroupCounts();
});
updateCompBar();

/* ---- Export data ---- */
function exportJSON() {
  if (!LA || !LR) return;
  // Build per-agent prompt map from game logs (V2)
  const agentPrompts = {};
  if (LGL) {
    const lastLog = LGL[LGL.length - 1];
    lastLog.filter(e => e.type === 'agent').forEach(e => {
      if (!agentPrompts[e.id]) agentPrompts[e.id] = {};
      agentPrompts[e.id][e.gt] = { prompt: e.prompt, response: e.response, error: e.error || null };
    });
  }

  const data = {
    agents: LA.map(a => ({
      id: a.id, cl: a.cl, cd: a.cd, alpha: a.alpha, beta: a.beta,
      riskType: a.riskType, classification: a.classification,
      btStrategy: LR.btS[a.id], glStrategy: LR.glS[a.id],
      ...(a.aiProvider ? { aiProvider: a.aiProvider, aiModel: a.aiModel, modelKey: a.modelKey } : {}),
      ...(agentPrompts[a.id] ? { prompts: agentPrompts[a.id] } : {}),
    })),
    results: { bt: LR.bt, gl: LR.gl },
    params: {
      n: LA.length, env: document.getElementById('s-env').value,
      nPeriods: +document.getElementById('s-periods').value,
      rounds: +document.getElementById('s-rounds').value,
      ratio: +document.getElementById('s-ratio').value,
      bp: +document.getElementById('s-bp').value,
      miscomm: +document.getElementById('s-miscomm').value,
      ...(currentVersion === 'v2' ? { trials: +(document.getElementById('s-trials')?.value || 1) } : {}),
    },
    ...(LS ? { modelStats: LS } : {}),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'experiment_data.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  if (!LA || !LR) return;
  const nP = +document.getElementById('s-periods').value;
  const rounds = +document.getElementById('s-rounds').value;

  // Agent-level summary
  const header = 'id,cl,cd,alpha,beta,riskType,classification,btStrategy,glStrategy,nPeriods,btFinalLambda,glFinalLambda';
  // Get first-round result per agent to extract final lambda
  const btFirst = {}, glFirst = {};
  LR.bt.forEach((r, i) => { if (i % rounds === 0) btFirst[r.id] = r; });
  LR.gl.forEach((r, i) => { if (i % rounds === 0) glFirst[r.id] = r; });
  const rows = LA.map(a => {
    const btLam = btFirst[a.id]?.lambda;
    const glLam = glFirst[a.id]?.lambda;
    return [a.id, a.cl.toFixed(4), a.cd.toFixed(4), a.alpha.toFixed(4), a.beta.toFixed(4),
     a.riskType, a.classification,
     (LR.btS[a.id] ?? '').toString(), (LR.glS[a.id] ?? '').toString(),
     nP,
     btLam != null ? btLam.toFixed(4) : '',
     glLam != null ? glLam.toFixed(4) : '',
    ].join(',');
  });

  // Per-period detail — all rounds, all periods
  const pdHeader = '\nagentId,gameType,round,period,theta,sent,rcv,action,lambda,isLie,isDec,dec,strat,augT,augL,payoff,mc';
  const pdRows = [];
  const addPeriods = (arr) => {
    let prevId = -1, rnd = 0;
    arr.forEach(r => {
      if (r.id !== prevId) { prevId = r.id; rnd = 0; } else { rnd++; }
      if (!r.periods) return;
      r.periods.forEach(p => {
        pdRows.push([r.id, r.gt, rnd + 1, p.t + 1, p.st, p.sent, p.rcv,
          p.at.toFixed(4), p.lambda.toFixed(4),
          p.isLie ? 1 : 0, p.isDec ? 1 : 0, p.dec.toFixed(4),
          p.strat.toFixed(4), p.augT.toFixed(4), p.augL.toFixed(4),
          p.payoff.toFixed(4), p.mc ? 1 : 0,
        ].join(','));
      });
    });
  };
  addPeriods(LR.bt);
  addPeriods(LR.gl);

  // V2 agent prompts and responses
  let promptSection = '';
  if (LGL) {
    const esc = s => s ? '"' + s.replace(/"/g, '""').replace(/\n/g, '\\n') + '"' : '';
    const pHeader = '\ntrial,agentId,gameType,provider,model,strategy,error,prompt,response';
    const pRows = [];
    LGL.forEach((trial, ti) => {
      trial.filter(e => e.type === 'agent').forEach(e => {
        pRows.push([ti + 1, e.id, e.gt, e.provider, e.model,
          e.strategy?.toFixed(4) ?? '', e.error || '',
          esc(e.prompt), esc(e.response),
        ].join(','));
      });
    });
    promptSection = [pHeader, ...pRows].join('\n');
  }

  const csv = [header, ...rows, pdHeader, ...pdRows, promptSection].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'experiment_data.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---- Version toggle ---- */
let currentVersion = 'v1';
function switchVersion(v) {
  currentVersion = v;
  document.querySelectorAll('.paradigm-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  const btn = document.getElementById('btn-run');
  const label = document.getElementById('btn-run-label');
  label.setAttribute('data-i18n', v === 'v2' ? 'btn.airun' : 'btn.run');
  label.textContent = t(v === 'v2' ? 'btn.airun' : 'btn.run');
  btn.classList.toggle('btn-ai', v === 'v2');
  const aiPanel = document.getElementById('p-ai');
  aiPanel.style.display = v === 'v2' ? '' : 'none';
  if (v === 'v2') aiPanel.classList.remove('collapsed');
  document.body.classList.toggle('mode-ai', v === 'v2');
  // Hide V2 charts when switching away; they only appear after experiment runs
  if (v === 'v1') document.querySelectorAll('.v2-chart').forEach(el => el.style.display = 'none');
  // Architecture diagrams follow global version
  document.getElementById('arch-v1').style.display = v === 'v1' ? '' : 'none';
  document.getElementById('arch-v2').style.display = v === 'v2' ? '' : 'none';
  // Initialize group model dropdowns and counts
  if (v === 'v2') initGroupModels();
}

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

  // Aggregate row
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

/* ---- Cached V2 stats and game logs for redraw/export ---- */
let LS = null;
let LGL = null; // V2 game logs (prompts + responses)

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

    // Use last trial for standard charts
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

    // V2 cross-model charts + stats table — show after data is ready
    plotModelStrats(stats);
    plotModelTypes(stats);
    plotModelDeviation(stats);
    renderStatsTable(stats);
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = '');

    // Game log (last trial) — cache for export
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

/* ---- Experiment state ---- */
let LA = null, LR = null;

/* ---- Run experiment ---- */
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

    // Log — sample 1 round per agent (first round of each)
    const btSample = R.bt.filter((_, i) => i % rounds === 0);
    const glSample = R.gl.filter((_, i) => i % rounds === 0);
    window._logSample = [...btSample, ...glSample];
    renderLog();
    plotPointCloud(R, agents);

    btn.classList.remove('loading'); btn.disabled = false;
  }, 60); });
}

/* ---- Init ---- */
window.addEventListener('load', () => {
  const ls = document.getElementById('lang-select');
  ls.value = currentLang;
  applyI18n(currentLang);
  setTimeout(runExperiment, 200);
});

window.addEventListener('resize', () => redrawAll(LA, LR, LS));
