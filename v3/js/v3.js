/**
 * V3 — Game Mode: Stanford-Town-style visualization of the reputation game.
 * Supports both math engine (V1) and AI agents (V2) — falls back to math if no API keys.
 * Depends on: engine.js, i18n.js, version-loader.js, app.js, v2/ai-agent.js, v3-engine.js
 */

/* ---- I18N keys for V3 ---- */
(function registerI18n() {
  if (typeof I18N === 'undefined') return;
  const keys = {
    'v3.label': ['V3 Game', 'V3 游戏', 'V3 게임'],
    'btn.gamerun': ['Start Game', '开始游戏', '게임 시작'],
  };
  const langs = ['en', 'zh', 'ko'];
  for (const [k, vals] of Object.entries(keys)) {
    langs.forEach((l, i) => { if (I18N[l]) I18N[l][k] = vals[i]; });
  }
})();

/* ---- Game world instance ---- */
let _v3world = null;

function _getWorld() {
  if (_v3world) return _v3world;
  const canvas = document.getElementById('v3-canvas');
  if (!canvas) return null;
  _v3world = new GameWorld(canvas);
  // Wire callbacks
  _v3world.onLog = (text) => {
    const log = document.getElementById('v3-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'v3-log-entry';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };
  _v3world.onPhase = (label) => {
    const el = document.getElementById('v3-phase');
    if (el) el.textContent = label;
  };
  return _v3world;
}

/* ---- Run V3 game ---- */
async function runV3Game() {
  const btn = document.getElementById('btn-run');
  const prog = document.getElementById('ai-progress');
  btn.classList.add('loading'); btn.disabled = true;

  // Clear log
  const log = document.getElementById('v3-log');
  if (log) log.innerHTML = '';

  // Read params
  const n = +document.getElementById('s-n').value;
  const rl = +document.getElementById('s-rl').value;
  const rn = +document.getElementById('s-rn').value;
  const ra = +document.getElementById('s-ra').value;
  const env = document.getElementById('s-env').value;
  const rounds = +document.getElementById('s-rounds').value;
  const nPeriods = +document.getElementById('s-periods').value;
  const ratio = +document.getElementById('s-ratio').value;
  const bp = +document.getElementById('s-bp').value;
  const miscomm = +document.getElementById('s-miscomm').value / 100;

  // Check for AI keys
  const hasKeys = ['admin','rl','rn','ra'].some(s => document.getElementById('pk-'+s)?.value.trim());

  let agents, R;

  try {
    if (hasKeys) {
      // AI mode — use V2 infrastructure
      if (prog) prog.textContent = 'Running AI experiment...';
      const result = await runMultiTrialAIExperiment((step, total, msg) => {
        if (prog) prog.textContent = `[${step}/${total}] ${msg}`;
      });
      agents = result.agents;
      const lastTrial = result.allTrialResults[result.allTrialResults.length - 1];
      R = lastTrial.R;
      LA = agents; LR = R; LS = result.stats; LGL = result.allGameLogs;
      if (prog) prog.textContent = 'AI experiment complete — starting game...';
    } else {
      // Math mode — use V1 engine
      if (prog) prog.textContent = 'Running simulation...';
      agents = createPopulation({
        n, rlPct: rl, rnPct: rn, raPct: ra,
        clMean: +document.getElementById('s-cl').value,
        cdMean: +document.getElementById('s-cd').value,
      });
      R = runSim(agents, { env, rounds, x1: 1, x2: ratio, nPeriods, pb: bp, miscomm, seed: 42 });
      classify(agents, R);
      LA = agents; LR = R;
      if (prog) prog.textContent = 'Simulation complete — starting game...';
    }

    // Update KPIs
    const C = { equilibrium:0, lying_averse:0, deception_averse:0, inference_error:0 };
    for (const a of agents) C[a.classification]++;
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    document.getElementById('st-eq').textContent = pct('equilibrium');
    document.getElementById('st-la').textContent = pct('lying_averse');
    document.getElementById('st-da').textContent = pct('deception_averse');
    document.getElementById('st-ie').textContent = pct('inference_error');
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    document.getElementById('st-welfare').textContent = allP.length
      ? (allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(2) : '--';

    // Initialise and play game world
    const world = _getWorld();
    if (world) {
      world.reset();
      world.resize();
      world.init(agents, R);
      // Start the game animation
      await world.play();
    }

    if (prog) prog.textContent = hasKeys ? 'Game complete (AI mode)' : 'Game complete (math mode)';
  } catch (e) {
    if (prog) prog.textContent = 'Error: ' + e.message;
    console.error(e);
  }

  btn.classList.remove('loading'); btn.disabled = false;
}

/* ---- Controls ---- */
function v3Pause() {
  const w = _getWorld();
  if (!w) return;
  if (w.state === 'running') { w.pause(); _updateV3Buttons(); }
  else if (w.state === 'paused') { w.resume(); _updateV3Buttons(); }
}

function v3SetSpeed(val) {
  const w = _getWorld();
  if (w) w.speed = parseFloat(val);
  const lbl = document.getElementById('v3-speed-val');
  if (lbl) lbl.textContent = val + 'x';
}

function _updateV3Buttons() {
  const w = _v3world;
  const pauseBtn = document.getElementById('v3-pause');
  if (pauseBtn && w) {
    pauseBtn.textContent = w.state === 'paused' ? '▶ Resume' : '⏸ Pause';
  }
}

/* ---- Register V3 ---- */
registerVersion('v3', {
  runLabel: 'btn.gamerun',
  btnClass: 'btn-game',
  bodyClass: 'mode-game',
  run: runV3Game,
  onActivate: () => {
    // Show AI panel (V3 can use AI keys if available)
    const aiPanel = document.getElementById('p-ai');
    aiPanel.style.display = '';
    aiPanel.classList.remove('collapsed');
    if (typeof initGroupModels === 'function') initGroupModels();
    // Show game container, hide default main content
    const v3c = document.getElementById('v3-container');
    if (v3c) v3c.style.display = '';
    document.querySelectorAll('.v3-hide-in-game').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = 'none');
    // Resize canvas
    setTimeout(() => { const w = _getWorld(); if (w) { w.resize(); w.draw(); } }, 100);
  },
  onDeactivate: () => {
    const v3c = document.getElementById('v3-container');
    if (v3c) v3c.style.display = 'none';
    document.querySelectorAll('.v3-hide-in-game').forEach(el => el.style.display = '');
    document.getElementById('p-ai').style.display = 'none';
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = 'none');
    // Stop animation
    if (_v3world) _v3world.reset();
  },
  redraw: () => {
    if (_v3world && _v3world.state !== 'idle') {
      _v3world.resize();
      _v3world.draw();
    }
  },
});

/* ---- Resize handler ---- */
window.addEventListener('resize', () => {
  if (currentVersion === 'v3' && _v3world) {
    _v3world.resize();
    _v3world.draw();
  }
});
