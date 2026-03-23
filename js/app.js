/**
 * Application shell — theme, tabs, UI event wiring, experiment orchestration.
 * Depends on: engine.js, charts.js, i18n.js
 */

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

/* ---- Composition bar ---- */
function updateCompBar() {
  const rl = +document.getElementById('s-rl').value;
  const rn = +document.getElementById('s-rn').value;
  const ra = +document.getElementById('s-ra').value;
  const total = rl + rn + ra;
  const bar = document.getElementById('comp-bar');
  bar.children[0].style.flex = rl;
  bar.children[1].style.flex = rn;
  bar.children[2].style.flex = ra;
  const ct = document.getElementById('comp-total');
  ct.textContent = '= ' + total + '%';
  ct.className = 'comp-total ' + (total === 100 ? 'ok' : 'warn');
}
['s-rl', 's-rn', 's-ra'].forEach(id => document.getElementById(id).addEventListener('input', updateCompBar));
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
    addRosterRow('anthropic', 'claude-haiku-4-5-20251001');
    addRosterRow('openai', 'gpt-4o-mini');
  }
}

/* ---- Run AI experiment (V2 multi-provider) ---- */
async function runAI() {
  const roster = buildAgentRoster();
  if (roster.length < 2) { alert('Add at least 2 agents to the roster.'); return; }
  // Check that at least one provider key is filled
  const anyKey = ['anthropic','openai','google','custom'].some(p => document.getElementById('pk-'+p)?.value.trim());
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
    let rl = +document.getElementById('s-rl').value;
    let rn = +document.getElementById('s-rn').value;
    let ra = +document.getElementById('s-ra').value;
    const total = rl + rn + ra;
    rl = rl / total * 100; rn = rn / total * 100; ra = ra / total * 100;
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

    // Log
    const log = document.getElementById('log');
    const sample = [...R.bt.slice(0, 6), ...R.gl.slice(0, 6)];
    log.innerHTML = sample.map(r => {
      const tag = r.isLie ? '<span class="tag tag-lie">LIE</span>' : '<span class="tag tag-truth">TRUTH</span>';
      const dec = r.isDec ? '&ensp;<span class="tag tag-dec">DECEPTIVE</span>' : '';
      const mc = r.mc ? '&ensp;<span class="tag tag-mc">MISCOMM</span>' : '';
      return `<span class="${r.isLie ? 'lie' : 'truth'}">${r.gt}&ensp;Agent ${r.id}&ensp;\u03b8=${r.s1}&ensp;sent=${r.sent}&ensp;rcv=${r.rcv}&ensp;a=${r.a1.toFixed(2)}&ensp;${tag}${dec}${mc}&ensp;payoff=${r.sp.toFixed(2)}</span>`;
    }).join('<br>');

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
