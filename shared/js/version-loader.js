/**
 * Mode registration system — enables Math/AI paradigm switching
 * and Chart/Game view toggling within each mode.
 * Each mode registers: { run, onActivate, onDeactivate, redraw, runLabel, btnClass, bodyClass }
 */

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
