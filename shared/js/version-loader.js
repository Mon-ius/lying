/**
 * Version registration system — enables V1/V2/V3+ paradigm switching.
 * Each version registers: { run, onActivate, onDeactivate, redraw, runLabel, btnClass, bodyClass }
 */

const VERSIONS = {};
let currentVersion = 'v1';

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
  document.querySelectorAll('[id^="arch-v"]').forEach(el => {
    el.style.display = el.id === 'arch-' + v ? '' : 'none';
  });
  // Body mode class
  document.body.className = document.body.className.replace(/\bmode-\w+/g, '');
  if (cfg.bodyClass) document.body.classList.add(cfg.bodyClass);
  // Version-specific activation
  if (cfg.onActivate) cfg.onActivate();
}

function runCurrentVersion() {
  const cfg = VERSIONS[currentVersion];
  if (cfg?.run) cfg.run();
}

/** Redraw shared charts + version-specific charts */
function fullRedraw() {
  redrawAll(LA, LR);
  const cfg = VERSIONS[currentVersion];
  if (cfg?.redraw) cfg.redraw();
}
