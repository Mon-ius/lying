/**
 * Application shell — theme, tabs, UI event wiring, exports.
 * Depends on: engine.js, charts.js, i18n.js, version-loader.js
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
  fullRedraw();
});

window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  applyTheme();
  fullRedraw();
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

/* ---- Experiment state (shared across versions) ---- */
let LA = null, LR = null;
let LS = null;   // V2 cross-model stats (set by v2.js)
let LGL = null;  // V2 game logs (set by v2.js)

/** Get agent display name by id (uses names assigned by _assignNames) */
function agentName(id) {
  return LA?.[id]?._name || 'Agent ' + id;
}

/* ---- Export data ---- */
function exportJSON() {
  if (!LA || !LR) return;
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
      id: a.id, name: a._name || 'Agent ' + a.id,
      cl: a.cl, cd: a.cd, alpha: a.alpha, beta: a.beta,
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
      ...(currentVersion === 'ai' ? { trials: +(document.getElementById('s-trials')?.value || 1) } : {}),
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

  const header = 'id,name,cl,cd,alpha,beta,riskType,classification,btStrategy,glStrategy,nPeriods,btFinalLambda,glFinalLambda';
  const btFirst = {}, glFirst = {};
  LR.bt.forEach((r, i) => { if (i % rounds === 0) btFirst[r.id] = r; });
  LR.gl.forEach((r, i) => { if (i % rounds === 0) glFirst[r.id] = r; });
  const rows = LA.map(a => {
    const btLam = btFirst[a.id]?.lambda;
    const glLam = glFirst[a.id]?.lambda;
    return [a.id, a._name || '', a.cl.toFixed(4), a.cd.toFixed(4), a.alpha.toFixed(4), a.beta.toFixed(4),
     a.riskType, a.classification,
     (LR.btS[a.id] ?? '').toString(), (LR.glS[a.id] ?? '').toString(),
     nP,
     btLam != null ? btLam.toFixed(4) : '',
     glLam != null ? glLam.toFixed(4) : '',
    ].join(',');
  });

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

/* ---- Init ---- */
window.addEventListener('load', () => {
  const ls = document.getElementById('lang-select');
  ls.value = currentLang;
  applyI18n(currentLang);
  setTimeout(() => runCurrentVersion(), 200);
});

window.addEventListener('resize', () => fullRedraw());
