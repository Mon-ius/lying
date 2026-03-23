/**
 * Application shell — theme, tabs, UI event wiring, experiment orchestration.
 * Depends on: engine.js, charts.js, i18n.js
 */

/* ---- Translatable game log ---- */
function renderLog() {
  const log = document.getElementById('log');
  const sample = window._logSample;
  if (!log || !sample || !sample.length) return;
  const rtMap = { risk_loving: t('rt.rl'), risk_neutral: t('rt.rn'), risk_averse: t('rt.ra') };

  log.innerHTML = sample.map((r, i) => {
    const lieTag = r.isLie
      ? `<span class="tag tag-lie">${t('log.lie')}</span>`
      : `<span class="tag tag-truth">${t('log.truth')}</span>`;
    const decTag = r.isDec ? `<span class="tag tag-dec">${t('log.deceptive')}</span>` : '';
    const mcTag = r.mc ? `<span class="tag tag-mc">${t('log.miscomm')}</span>` : '';

    let sobelNote = '';
    if (!r.isLie && r.isDec) sobelNote = t('log.prop1');
    else if (r.isLie && !r.isDec) sobelNote = t('log.prop2');

    const truthWins = r.augT >= r.augL;
    const diff = Math.abs(r.augT - r.augL).toFixed(3);
    const winner = truthWins ? t('log.truth') : t('log.lie');

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
    <div class="log-section"><strong>${t('log.p2')}</strong>
      <div class="log-grid">
        <span>\u03b8\u2082 = ${r.s2}</span>
        <span>\u03bb = ${r.lambda.toFixed(3)}</span>
        <span>a\u2082 = ${r.a2.toFixed(3)}</span>
        <span>${t('log.payoff')}: S=${r.sp.toFixed(2)} R=${r.rp.toFixed(2)}</span>
      </div>
    </div>
    <div class="log-section"><strong>${t('log.decision')}</strong>
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
    </div>
  </div>
</details>`;
  }).join('');
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
  redrawAll(LA, LR);
});

window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  applyTheme();
  redrawAll(LA, LR);
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
}

['s-rl', 's-rn', 's-ra'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => constrainRisk(id));
});
updateCompBar();

/* ---- Export data ---- */
function exportJSON() {
  if (!LA || !LR) return;
  const data = {
    agents: LA.map(a => ({
      id: a.id, cl: a.cl, cd: a.cd, alpha: a.alpha, beta: a.beta,
      riskType: a.riskType, classification: a.classification,
      btStrategy: LR.btS[a.id], glStrategy: LR.glS[a.id],
    })),
    results: { bt: LR.bt, gl: LR.gl },
    params: {
      n: LA.length, env: document.getElementById('s-env').value,
      rounds: +document.getElementById('s-rounds').value,
      ratio: +document.getElementById('s-ratio').value,
      bp: +document.getElementById('s-bp').value,
      miscomm: +document.getElementById('s-miscomm').value,
    },
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
  const header = 'id,cl,cd,alpha,beta,riskType,classification,btStrategy,glStrategy';
  const rows = LA.map(a =>
    [a.id, a.cl.toFixed(4), a.cd.toFixed(4), a.alpha.toFixed(4), a.beta.toFixed(4),
     a.riskType, a.classification,
     (LR.btS[a.id] ?? '').toString(), (LR.glS[a.id] ?? '').toString()
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'experiment_agents.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---- Version toggle ---- */
let currentVersion = 'v1';
function switchVersion(v) {
  currentVersion = v;
  document.querySelectorAll('.paradigm-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  document.getElementById('btn-run').style.display = v === 'v1' ? '' : 'none';
  document.getElementById('p-ai').classList.toggle('collapsed', v === 'v1');
  document.body.classList.toggle('mode-ai', v === 'v2');
  // Seed default roster row if empty
  if (v === 'v2' && !document.querySelectorAll('.roster-row').length) {
    addRosterRow('claude', 'claude-haiku-4-5');
    addRosterRow('gpt', 'gpt-4o-mini');
    addRosterRow('deepseek', 'deepseek-chat');
  }
}

/* ---- Architecture version toggle ---- */
function switchArchVersion(v) {
  document.querySelectorAll('.arch-ver-btn').forEach(b => b.classList.toggle('active', b.dataset.arch === v));
  document.getElementById('arch-v1').style.display = v === 'v1' ? '' : 'none';
  document.getElementById('arch-v2').style.display = v === 'v2' ? '' : 'none';
}

/* ---- Run AI experiment (V2 multi-provider) ---- */
async function runAI() {
  const roster = buildAgentRoster();
  if (roster.length < 2) { alert('Add at least 2 agents to the roster.'); return; }
  // Check that at least one provider key is filled
  const anyKey = ['claude','gpt','gemini','deepseek','qwen','minimax','kimi','glm'].some(p => document.getElementById('pk-'+p)?.value.trim());
  if (!anyKey) { alert('Enter at least one provider API key.'); return; }

  const btn = document.getElementById('btn-ai-run');
  const prog = document.getElementById('ai-progress');
  btn.classList.add('loading'); btn.disabled = true;
  prog.textContent = 'Starting AI experiment...';
  try {
    const { agents, R, gameLog } = await runAIExperiment((step, total, msg) => {
      prog.textContent = `[${step}/${total}] ${msg}`;
    });
    LA = agents; LR = R;
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
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    document.getElementById('st-welfare').textContent = allP.length
      ? (allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(2) : '--';
    const env = document.getElementById('s-env').value;
    plotParams(agents);
    plotJoint(agents);
    if (env === 'both' || env === 'BT') plotStrat(R, 'BT');
    if (env === 'both' || env === 'GL') plotStrat(R, 'GL');
    plotTypes(agents);
    plotRegions(agents);
    // Rich game log
    renderGameLog(gameLog, agents);
    const aiCalls = gameLog.filter(e => e.type === 'agent' && !e.error).length;
    const fallbacks = gameLog.filter(e => e.type === 'agent' && e.error).length;
    prog.textContent = `Done — ${aiCalls} AI calls, ${fallbacks} fallbacks, ${n} agents`;
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
    const ratio = +document.getElementById('s-ratio').value;
    const bp = +document.getElementById('s-bp').value;
    const miscomm = +document.getElementById('s-miscomm').value / 100;
    const R = runSim(agents, { env, rounds, x1: 1, x2: ratio, pb: bp, miscomm, seed: 42 });
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

    // Log — sample 1 round per agent (first round of each), up to 6 agents
    const btSample = R.bt.filter((_, i) => i % rounds === 0).slice(0, 6);
    const glSample = R.gl.filter((_, i) => i % rounds === 0).slice(0, 6);
    window._logSample = [...btSample, ...glSample];
    renderLog();

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

window.addEventListener('resize', () => redrawAll(LA, LR));
