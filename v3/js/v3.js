/**
 * V3 — Game View: Stanford-Town-style visualization of the reputation game.
 * This is a VIEW layer (not a mode) — available in both Math and AI modes.
 * Depends on: engine.js, i18n.js, version-loader.js, app.js, v3-engine.js
 */

/* ---- Game world instance ---- */
let _v3world = null;

function _getWorld() {
  if (_v3world) return _v3world;
  const canvas = document.getElementById('v3-canvas');
  if (!canvas) return null;
  _v3world = new GameWorld(canvas);
  // Wire callbacks
  _v3world.onLog = (html) => {
    const log = document.getElementById('log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'v3-log-entry';
    div.innerHTML = html;
    log.appendChild(div);
    while (log.children.length > 300) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  };
  _v3world.onPhase = () => {};
  return _v3world;
}

/* ---- Initialize game from existing results ---- */
async function initGameFromResults() {
  if (!LA || !LR) return;
  const world = _getWorld();
  if (!world) return;
  const log = document.getElementById('log');
  if (log) log.innerHTML = '';
  const logCard = document.getElementById('log-card');
  if (logCard) logCard.classList.remove('collapsed');
  world.reset();
  world.resize();
  world.init(LA, LR);
  await world.play();
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
    pauseBtn.textContent = w.state === 'paused' ? '\u25b6 Resume' : '\u23f8 Pause';
  }
}

/* ---- Resize handler ---- */
window.addEventListener('resize', () => {
  if (currentView === 'game' && _v3world) {
    _v3world.resize();
    _v3world.draw();
  }
});
