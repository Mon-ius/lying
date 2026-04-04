/**
 * Game World — Apple-aesthetic 2D canvas visualization of the reputation game.
 * Shows each step of the sender-receiver game clearly:
 *   1. Nature draws state theta
 *   2. Sender computes strategy & sends message m
 *   3. Miscommunication check (message may be corrupted)
 *   4. Receiver updates belief lambda & takes action a
 *   5. Payoff computed, reputation updated
 *
 * Merges: v3-engine.js + v3.js
 * Depends on: engine.js, modes.js (currentView), app.js (LA, LR, agentName)
 */

/* ---- Helpers ---- */
function _lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/** Wrap text into lines that fit within maxWidth */
function _wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/* ---- Name Pool ---- */
const NAME_POOL = [
  'Alice','Bob','Charlie','Diana','Eve','Frank','Grace','Hank',
  'Iris','Jack','Kate','Leo','Mia','Noah','Olive','Paul',
  'Quinn','Rose','Sam','Tina','Uma','Victor','Wendy','Xander',
  'Yuki','Zara','Amir','Bella','Chen','Dev','Elena','Fadi',
  'Gina','Hugo','Ines','Jax','Kira','Luca','Maya','Niko',
  'Omar','Pia','Ravi','Suki','Theo','Vera','Wren','Yara',
  'Zeke','Ava','Basil','Cleo','Dani','Emil','Freya','Gus',
  'Hana','Ivan','Jade','Kai','Luna','Max','Nora','Otto',
  'Petra','Remy','Sage','Tao','Uri','Veda','Wes','Xia',
  'Yves','Zuri','Ash','Bree','Cruz','Dex','Elsa','Finn',
  'Gia','Heath','Isla','Jules','Knox','Lark','Milo','Nell',
  'Opal','Pike','Rae','Scout','Troy','Viola','Wolf','Yael',
  'Arlo','Bea','Cyrus','Dot','Ezra','Flora','Grant','Hope',
  'Idris','Joy','Kade','Lexi','Mars','Nina','Orion','Pearl',
  'Reed','Sky','Tess','Vale','Zion','Ada','Blake','Cora',
  'Drew','Esme','Felix','Gemma','Hart','Ivy','Jude','Liam',
  'Nyla','Roan',
];
function _assignNames(agents) {
  if (agents[0]?._name) return;
  const pool = [...NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  agents.forEach((a, i) => { a._name = i < pool.length ? pool[i] : `Agent-${i}`; });
}

/** Numbered display name: "1.Alice", "2.Bob" (1-indexed) */
function _dname(agent) { return `${agent.id + 1}.${agent._name || 'Agent' + agent.id}`; }

/* ---- Virtual Map ---- */
let MAP_W = 1000, MAP_H = 720;

const BUILDINGS_BASE = [
  { id:'village', x:500, y:75,  w:340, h:60,  labelKey:'gw.hub',      icon:'\uD83C\uDFB2',       tint:'#34C759', descKey:'gw.hub.d',     noteKey:'gw.hub.n' },
  { id:'oracle',  x:500, y:220, w:240, h:50,  labelKey:'gw.oracle',   icon:'\uD83D\uDCE1',       tint:'#AF52DE', descKey:'gw.oracle.d',  noteKey:'gw.oracle.n' },
  { id:'bt',      x:220, y:370, w:240, h:80,  labelKey:'gw.btarena',  icon:'\uD83D\uDEE1\uFE0F', tint:'#007AFF', descKey:'gw.btarena.d', noteKey:'gw.btarena.n' },
  { id:'gl',      x:780, y:370, w:240, h:80,  labelKey:'gw.glarena',  icon:'\u2694\uFE0F',        tint:'#FF9500', descKey:'gw.glarena.d', noteKey:'gw.glarena.n' },
  { id:'hall',    x:500, y:630, w:300, h:55,  labelKey:'gw.hall',     icon:'\uD83D\uDCCA',       tint:'#FF3B30', descKey:'gw.hall.d',    noteKey:'gw.hall.n' },
];
let BUILDINGS = BUILDINGS_BASE.map(b => ({...b}));
const PATHS = [['village','oracle'],['oracle','bt'],['oracle','gl'],['bt','hall'],['gl','hall']];

/* ---- Apple-inspired color palette ---- */
const RISK_COLORS    = { risk_loving:'#FF3B30', risk_neutral:'#FF9500', risk_averse:'#007AFF' };
const CLS_COLORS     = { equilibrium:'#007AFF', lying_averse:'#34C759', deception_averse:'#FF3B30', inference_error:'#FF9500' };
const PROVIDER_COLORS= { claude:'#FF9500', gpt:'#34C759', gemini:'#007AFF', deepseek:'#AF52DE', qwen:'#5AC8FA', minimax:'#FF2D55', kimi:'#FF6B35', glm:'#5856D6' };
function _riskLabel(rt) { return { risk_loving: t('gw.rt.rl'), risk_neutral: t('gw.rt.rn'), risk_averse: t('gw.rt.ra') }[rt] || rt; }
function _clsLabel(cls) { return { equilibrium: t('gw.cls.eq'), lying_averse: t('gw.cls.la'), deception_averse: t('gw.cls.da'), inference_error: t('gw.cls.ie') }[cls] || cls; }
const SKIN_TONES     = ['#fdbcb4','#f1c27d','#e0ac69','#c68642','#8d5524','#ffdbac','#deb887','#d2a679'];

const _SF   = "-apple-system,'SF Pro Display','Inter','Segoe UI',sans-serif";
const _SFT  = "-apple-system,'SF Pro Text','Inter','Segoe UI',sans-serif";
const _MONO = "'SF Mono','JetBrains Mono','Fira Code',monospace";

/* ==================================================================
   SPRITE
   ================================================================== */
class Sprite {
  constructor(agent, x, y) {
    this.agent = agent;
    this.id = agent.id;
    this.name = agent._name || `Agent${agent.id}`;
    this.displayName = _dname(agent);
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.alpha = 0;
    this.rep = 0.5;
    this.classification = '';
    this.dimmed = false;
    this.active = false;
    this.skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
    this._walkCycle = 0;
    this._moving = false;
    this._moveDelay = 0;     // stagger delay before starting to move (seconds)
    this._gridX = x;         // assigned grid slot (for returning after spotlight)
    this._gridY = y;
  }

  get color() {
    if (this.classification) return CLS_COLORS[this.classification] || '#8e8e93';
    if (this.agent.aiProvider) return PROVIDER_COLORS[this.agent.aiProvider] || '#8e8e93';
    return RISK_COLORS[this.agent.riskType] || '#8e8e93';
  }
  get riskLabel() { return _riskLabel(this.agent.riskType); }
  moveTo(x, y) { this.tx = x; this.ty = y; }

  update(dt, speed) {
    if (this._moveDelay > 0) { this._moveDelay -= dt * speed; return; }
    const dx = this.tx - this.x, dy = this.ty - this.y;
    this._moving = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    this.x = _lerp(this.x, this.tx, 5 * speed * dt);
    this.y = _lerp(this.y, this.ty, 5 * speed * dt);
    if (this._moving) this._walkCycle += dt * speed * 8;
  }

  draw(ctx, s, dark, sc) {
    if (this.alpha <= 0) return;
    sc = sc || 1;
    const cx = this.x * s, cy = this.y * s;
    const bodyW = 12 * s * sc, bodyH = 13 * s * sc;
    const headR = 6.5 * s * sc;
    const legH = 5 * s * sc;
    const baseY = cy;

    ctx.globalAlpha = this.alpha * (this.dimmed ? 0.18 : 1);

    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2 * s * sc, bodyW * 0.6, 2.5 * s * sc, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fill();

    if (this.active) {
      ctx.save();
      ctx.globalAlpha = this.alpha * 0.35;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 2 * s * sc, 20 * s * sc, 7 * s * sc, 0, 0, Math.PI * 2);
      ctx.strokeStyle = this.color; ctx.lineWidth = 1.5 * s * sc; ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = this.alpha;
    }

    const legSpread = this._moving ? Math.sin(this._walkCycle) * 2.5 * s * sc : 0;
    ctx.fillStyle = dark ? '#48484a' : '#3a3a3c';
    ctx.beginPath(); ctx.roundRect(cx - 3.5 * s * sc + legSpread, baseY - legH, 3 * s * sc, legH + 1 * s * sc, 1.5 * s * sc); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + 0.5 * s * sc - legSpread, baseY - legH, 3 * s * sc, legH + 1 * s * sc, 1.5 * s * sc); ctx.fill();

    const bodyTop = baseY - legH - bodyH;
    ctx.beginPath();
    ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyH, [3.5 * s * sc, 3.5 * s * sc, 2 * s * sc, 2 * s * sc]);
    ctx.fillStyle = this.color; ctx.fill();

    ctx.fillStyle = this.skin;
    ctx.beginPath(); ctx.roundRect(cx - bodyW / 2 - 3 * s * sc, bodyTop + 2.5 * s * sc, 3 * s * sc, 7 * s * sc, 1.5 * s * sc); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + bodyW / 2, bodyTop + 2.5 * s * sc, 3 * s * sc, 7 * s * sc, 1.5 * s * sc); ctx.fill();

    const headY = bodyTop - headR * 0.5;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.skin; ctx.fill();

    ctx.fillStyle = '#1c1c1e';
    ctx.beginPath(); ctx.arc(cx - 2.5 * s * sc, headY - 0.5 * s * sc, 1 * s * sc, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.5 * s * sc, headY - 0.5 * s * sc, 1 * s * sc, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, headY + 2 * s * sc, 1.8 * s * sc, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = this._darken(this.skin, 0.3);
    ctx.lineWidth = 0.7 * s * sc; ctx.stroke();

    const nameFs = Math.max(4, Math.round(6.5 * s * sc));
    const subFs = Math.max(3, Math.round(5 * s * sc));
    ctx.font = `600 ${nameFs}px ${_SF}`;
    ctx.fillStyle = dark ? '#e5e5ea' : '#1c1c1e';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this.displayName, cx, baseY + 5 * s * sc);

    if (this.classification) {
      ctx.font = `600 ${subFs}px ${_SFT}`;
      ctx.fillStyle = this.color;
      ctx.fillText(_clsLabel(this.classification), cx, baseY + (5 + 8 * sc) * s);
    } else {
      const sub = this.agent.aiProvider || this.riskLabel;
      ctx.font = `400 ${subFs}px ${_SFT}`;
      ctx.fillStyle = '#8e8e93';
      ctx.fillText(sub, cx, baseY + (5 + 8 * sc) * s);
    }

    ctx.globalAlpha = 1;
  }

  _darken(hex, amt) {
    const c = hex.startsWith('#') ? hex : '#888888';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `rgb(${Math.max(0,r*(1-amt))|0},${Math.max(0,g*(1-amt))|0},${Math.max(0,b*(1-amt))|0})`;
  }
}

/* ==================================================================
   GAME WORLD
   ================================================================== */
class GameWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = [];
    this.phase = 'idle'; this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
    this.speed = 1; this.state = 'idle';
    this._running = false; this._raf = null; this._lastTime = 0; this._time = 0;
    this._buildingMap = {}; BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
    this.results = null; this.agents = null;
    this.onPhase = null; this.onLog = null;
    this._scale = 1; this._offsetX = 0; this._offsetY = 0; this._zoom = 1; this._interactions = 0;
    this.spriteScale = 1;
    this._decisionCard = null;
    this._activeSprite = null;
    this._showLegend = false;
    this._logGroup = null;
    // Camera system
    this._cam = { x: 500, y: 360, zoom: 1 };
    this._camTarget = null;
    this._camFollow = true;
    this._dragging = false; this._dragSX = 0; this._dragSY = 0; this._dragOX = 0; this._dragOY = 0;
    this._setupInput();
    this.resize();
  }

  _setupInput() {
    const c = this.canvas;
    c.style.cursor = 'grab';
    this._zoom = 1;

    // --- Drag (pan) ---
    c.addEventListener('mousedown', e => {
      this._dragging = true; this._dragSX = e.clientX; this._dragSY = e.clientY;
      this._dragOX = this._offsetX; this._dragOY = this._offsetY; c.style.cursor = 'grabbing';
      this._camFollow = false; this._updateFollowLabel();
    });
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      this._offsetX = this._dragOX + (e.clientX - this._dragSX) * devicePixelRatio;
      this._offsetY = this._dragOY + (e.clientY - this._dragSY) * devicePixelRatio;
      if (!this._running) this.draw();
    });
    window.addEventListener('mouseup', () => { if (this._dragging) { this._dragging = false; c.style.cursor = 'grab'; } });

    // --- Touch: drag + pinch zoom ---
    let lastPinchDist = 0;
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const tp = e.touches[0];
        this._dragging = true; this._dragSX = tp.clientX; this._dragSY = tp.clientY;
        this._dragOX = this._offsetX; this._dragOY = this._offsetY;
      } else if (e.touches.length === 2) {
        this._dragging = false;
        lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && this._dragging) {
        const tp = e.touches[0];
        this._offsetX = this._dragOX + (tp.clientX - this._dragSX) * devicePixelRatio;
        this._offsetY = this._dragOY + (tp.clientY - this._dragSY) * devicePixelRatio;
        if (!this._running) this.draw();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastPinchDist > 0) {
          const factor = dist / lastPinchDist;
          this._zoom = Math.max(0.3, Math.min(5, this._zoom * factor));
          if (!this._running) this.draw();
          this._updateZoomLabel();
        }
        lastPinchDist = dist;
      }
    }, { passive: true });
    c.addEventListener('touchend', () => { this._dragging = false; lastPinchDist = 0; }, { passive: true });

    // --- Scroll wheel zoom ---
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this._camFollow = false; this._updateFollowLabel();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this._zoom = Math.max(0.3, Math.min(5, this._zoom * delta));
      if (!this._running) this.draw();
      this._updateZoomLabel();
    }, { passive: false });

    // --- Double-click: reset view ---
    c.addEventListener('dblclick', () => {
      this._offsetX = 0; this._offsetY = 0; this._zoom = 1;
      this._updateZoomLabel();
      if (!this._running) this.draw();
    });
  }

  _updateZoomLabel() {
    const el = document.getElementById('v3-zoom-val');
    if (el) el.textContent = Math.round(this._zoom * 100) + '%';
  }

  zoomIn()  { this._camFollow = false; this._updateFollowLabel(); this._zoom = Math.min(5, this._zoom * 1.25); this._updateZoomLabel(); if (!this._running) this.draw(); }
  zoomOut() { this._camFollow = false; this._updateFollowLabel(); this._zoom = Math.max(0.3, this._zoom * 0.8); this._updateZoomLabel(); if (!this._running) this.draw(); }
  zoomFit() { this._camFollow = false; this._updateFollowLabel(); this._zoom = 1; this._offsetX = 0; this._offsetY = 0; this._updateZoomLabel(); if (!this._running) this.draw(); }

  /* ---- Camera system ---- */
  /** Focus on a building, auto-calculating zoom to fit it nicely */
  _focusBuilding(id, maxZoom) {
    const b = this._buildingMap[id];
    if (!b || !this._camFollow) return;
    const W = this.canvas.width, H = this.canvas.height, s = this._scale;
    const pad = 1.4;
    const fitW = W / (b.w * pad * s);
    const fitH = H / (b.h * pad * s);
    this._camTarget = { x: b.x, y: b.y, zoom: Math.min(fitW, fitH, maxZoom || 2.5) };
  }
  /** Focus on a sprite with its decision card (card above, sprite below) */
  _focusSprite(sp) {
    if (!this._camFollow) return;
    // Card is ~175 units above sprite center; center camera between them
    this._camTarget = { x: sp.tx, y: sp.ty - 60, zoom: Math.min(1.8, this.canvas.width / (280 * this._scale)) };
  }
  /** Focus on arena stage zone: shows the action stage + decision card above */
  _focusStage(arenaId) {
    if (!this._camFollow) return;
    const b = this._buildingMap[arenaId];
    if (!b) return;
    const headerH = 48;
    const stageH = b._stageH || 80;
    // Center on stage area, offset up for card space
    const stageY = b.y - b.h / 2 + headerH + stageH / 2;
    this._camTarget = { x: b.x, y: stageY - 40, zoom: Math.min(2.0, this.canvas.width / (350 * this._scale)) };
  }
  /** Zoom out to see the full map */
  _focusAll() {
    if (!this._camFollow) return;
    this._camTarget = { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 };
  }
  /** Toggle camera follow mode */
  toggleFollow() {
    this._camFollow = !this._camFollow;
    if (this._camFollow && !this._camTarget) this._focusAll();
    this._updateFollowLabel();
  }
  _updateFollowLabel() {
    const el = document.getElementById('v3-follow-btn');
    if (el) el.classList.toggle('active', this._camFollow);
  }
  /** Apply camera lerp each frame */
  _updateCamera(dt) {
    if (!this._camTarget || !this._camFollow) return;
    const ct = this._camTarget;
    const spd = 3 * dt;
    this._cam.x = _lerp(this._cam.x, ct.x, spd);
    this._cam.y = _lerp(this._cam.y, ct.y, spd);
    this._cam.zoom = _lerp(this._cam.zoom, ct.zoom, spd);
    // Convert camera world position → offset/zoom
    const s = this._scale;
    this._zoom = this._cam.zoom;
    this._offsetX = s * this._zoom * (MAP_W / 2 - this._cam.x);
    this._offsetY = s * this._zoom * (MAP_H / 2 - this._cam.y);
    this._updateZoomLabel();
  }

  resize() {
    const c = this.canvas;
    const cssW = c.clientWidth || c.parentElement?.clientWidth || 700;
    const cssH = Math.max(380, Math.round(cssW * MAP_H / MAP_W));
    c.width = cssW * devicePixelRatio;
    c.height = cssH * devicePixelRatio;
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    this._scale = Math.min(c.width / MAP_W, c.height / MAP_H);
  }

  init(agents, results) {
    this.agents = agents; this.results = results;
    this.sprites = [];
    this.phase = 'idle'; this.phaseLabel = ''; this.phaseSub = '';
    this.phaseProgress = 0; this._interactions = 0; this._decisionCard = null; this._showLegend = false;
    _assignNames(agents);

    const n = agents.length;
    if (n <= 20) this.spriteScale = 1.0;
    else if (n <= 50) this.spriteScale = 0.75;
    else if (n <= 100) this.spriteScale = 0.6;
    else this.spriteScale = 0.45;

    this._autosizeBuildings(n);
    this._cam = { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 };
    this._camTarget = null; this._camFollow = true; this._updateFollowLabel();

    // Place sprites initially at village, using same layout as _arrangeIn
    const v = this._buildingMap.village;
    const sc = this.spriteScale;
    const gapX = 38 * sc, gapY = 55 * sc;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.ceil(n / cols);
    const gridW = (cols - 1) * gapX, gridH = (rows - 1) * gapY;
    const headerH = 48;
    const areaTop = v.y - v.h / 2 + headerH;
    const areaH = v.h - headerH;
    const startX = v.x - gridW / 2;
    const startY = areaTop + (areaH - gridH) / 2;
    agents.forEach((a, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const gx = startX + col * gapX, gy = startY + row * gapY;
      const sp = new Sprite(a, gx, gy);
      sp._gridX = gx; sp._gridY = gy;
      sp.alpha = 0;
      this.sprites.push(sp);
    });
  }

  _autosizeBuildings(n) {
    BUILDINGS = BUILDINGS_BASE.map(b => ({...b}));
    this._buildingMap = {};

    const sc = this.spriteScale;
    // Sprite footprint: character ~35*sc tall, name+sub label ~20*sc below
    const spriteFootW = 38 * sc;   // width per agent slot
    const spriteFootH = 55 * sc;   // height per agent slot (character + labels)
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.5)));
    const rows = Math.ceil(n / cols);
    // Building needs: header (28) + grid + padding
    const neededW = cols * spriteFootW + 80;
    const neededH = rows * spriteFootH + 80;  // 28 header + padding top/bottom

    // Arena buildings get an extra "action stage" zone above the queue grid
    const STAGE_H = Math.max(80, 65 * sc + 30);

    for (const b of BUILDINGS) {
      b.w = Math.max(b.w, neededW);
      if (b.id === 'bt' || b.id === 'gl') {
        b._stageH = STAGE_H;
        b.h = Math.max(b.h, neededH + STAGE_H);
      } else {
        b._stageH = 0;
        b.h = Math.max(b.h, neededH);
      }
    }

    // Reflow vertical layout: stack buildings with proper spacing
    const margin = 25;
    const village = BUILDINGS.find(b => b.id === 'village');
    const oracle  = BUILDINGS.find(b => b.id === 'oracle');
    const bt      = BUILDINGS.find(b => b.id === 'bt');
    const gl      = BUILDINGS.find(b => b.id === 'gl');
    const hall    = BUILDINGS.find(b => b.id === 'hall');

    village.y = village.h / 2 + 30;
    oracle.y  = village.y + village.h / 2 + margin + oracle.h / 2;
    const arenaY = oracle.y + oracle.h / 2 + margin + Math.max(bt.h, gl.h) / 2;
    bt.y = arenaY; gl.y = arenaY;
    // Protocol panel needs ~140px below arena, then hall
    hall.y = arenaY + Math.max(bt.h, gl.h) / 2 + 150 + hall.h / 2;

    // Expand map to fit
    const totalH = hall.y + hall.h / 2 + 40;
    MAP_H = Math.max(720, totalH);
    MAP_W = Math.max(1000, Math.max(neededW + 80, bt.w + gl.w + 200));

    // Keep arenas apart
    bt.x = Math.min(bt.x, MAP_W / 2 - bt.w / 2 - 30);
    gl.x = Math.max(gl.x, MAP_W / 2 + gl.w / 2 + 30);
    // Center village, oracle, hall
    village.x = MAP_W / 2; oracle.x = MAP_W / 2; hall.x = MAP_W / 2;

    BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
  }

  /** Center of the action stage within an arena building */
  _stageCenter(buildingId) {
    const b = this._buildingMap[buildingId];
    const headerH = 48;
    const stageH = b._stageH || 80;
    return { x: b.x, y: b.y - b.h / 2 + headerH + stageH / 2 + 5 };
  }

  /** Point on the edge of a building rectangle closest to the line toward (tx,ty) */
  _edgePoint(b, tx, ty) {
    const dx = tx - b.x, dy = ty - b.y;
    const hw = b.w / 2, hh = b.h / 2;
    if (dx === 0 && dy === 0) return { x: b.x, y: b.y };
    const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);
    return { x: b.x + dx * scale, y: b.y + dy * scale };
  }

  /* ================================================================
     DRAWING
     ================================================================ */
  draw() {
    const ctx = this.ctx, s = this._scale;
    const dark = typeof _isDark === 'function' && _isDark();
    const W = this.canvas.width, H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { bg.addColorStop(0, '#1c1c1e'); bg.addColorStop(1, '#000000'); }
    else { bg.addColorStop(0, '#f5f5f7'); bg.addColorStop(1, '#e5e5ea'); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // World transform (with zoom)
    const z = this._zoom || 1;
    const sz = s * z;
    const cx = (W - MAP_W * sz) / 2 + this._offsetX;
    const cy = (H - MAP_H * sz) / 2 + this._offsetY;
    ctx.setTransform(z, 0, 0, z, cx, cy);

    this._drawPaths(ctx, s, dark);
    this._drawBuildings(ctx, s, dark);
    const sorted = [...this.sprites].sort((a, b) => a.y - b.y);
    for (const sp of sorted) sp.draw(ctx, s, dark, this.spriteScale);
    if (this._decisionCard) this._drawDecisionCard(ctx, s, dark);

    // Screen-space overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawBanner(ctx, s, dark, W, H);
    if (this._showLegend) this._drawLegend(ctx, s, dark, W, H);
  }

  _drawPaths(ctx, s, dark) {
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    const color = dark ? 'rgba(84,84,88,0.3)' : 'rgba(60,60,67,0.15)';
    for (const [fromId, toId] of PATHS) {
      const a = this._buildingMap[fromId], b = this._buildingMap[toId];
      const from = this._edgePoint(a, b.x, b.y);
      const to   = this._edgePoint(b, a.x, a.y);
      const ax = from.x * s, ay = from.y * s, bx = to.x * s, by = to.y * s;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      // subtle perpendicular offset for a gentle curve
      const perpX = -(by - ay) * 0.06, perpY = (bx - ax) * 0.06;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx + perpX, my + perpY, bx, by);
      ctx.stroke();
      // small arrowhead at destination
      const arrL = 5 * s;
      const dx = bx - (mx + perpX), dy = by - (my + perpY);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - ux * arrL - uy * arrL * 0.45, by - uy * arrL + ux * arrL * 0.45);
      ctx.lineTo(bx - ux * arrL + uy * arrL * 0.45, by - uy * arrL - ux * arrL * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawBuildings(ctx, s, dark) {
    for (const b of BUILDINGS) {
      const bx = (b.x - b.w / 2) * s, by = (b.y - b.h / 2) * s;
      const bw = b.w * s, bh = b.h * s;
      const rad = 14 * s;

      // Card shadow
      ctx.save();
      ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)';
      ctx.shadowBlur = 24 * s; ctx.shadowOffsetY = 4 * s;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rad);
      ctx.fillStyle = dark ? 'rgba(44,44,46,0.6)' : 'rgba(255,255,255,0.8)';
      ctx.fill(); ctx.restore();

      // Border
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rad);
      ctx.strokeStyle = dark ? 'rgba(84,84,88,0.25)' : 'rgba(60,60,67,0.08)';
      ctx.lineWidth = 0.5 * s; ctx.stroke();

      // Top accent bar (full width)
      ctx.save(); ctx.globalAlpha = 0.7;
      ctx.fillStyle = b.tint;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 2.5 * s, [rad, rad, 0, 0]);
      ctx.fill(); ctx.restore();

      // Header area: icon + label + desc anchored at top of card
      const hdrY = by + 14 * s;
      ctx.font = `${Math.round(11 * s)}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, bx + 10 * s, hdrY);

      // Title + description on same line: "1. Nature Stage — State θ drawn; ..."
      const _STEP_IDS = ['village','oracle','bt','gl','hall'];
      const stepIdx = _STEP_IDS.indexOf(b.id);
      const labelText = stepIdx >= 0 ? `${stepIdx + 1}. ${t(b.labelKey)}` : t(b.labelKey);
      const descText = t(b.descKey);
      ctx.font = `600 ${Math.round(7.5 * s)}px ${_SF}`;
      ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
      const labelW = ctx.measureText(labelText).width;
      ctx.fillText(labelText, bx + 24 * s, hdrY);
      ctx.font = `400 ${Math.round(5.5 * s)}px ${_SFT}`;
      ctx.fillStyle = '#8e8e93';
      ctx.fillText(`\u2014 ${descText}`, bx + 24 * s + labelW + 6 * s, hdrY);

      // Yellow explanatory note just below the title line
      if (b.noteKey) {
        const noteText = t(b.noteKey);
        if (noteText && noteText !== b.noteKey) {
          const noteFs = Math.round(4.5 * s);
          const noteX = bx + 12 * s;
          const noteY = hdrY + 10 * s;
          // "Note:" prefix in bold
          ctx.font = `600 ${noteFs}px ${_SFT}`;
          ctx.fillStyle = dark ? 'rgba(255,204,0,0.7)' : 'rgba(180,130,0,0.65)';
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          const prefixW = ctx.measureText('Note: ').width;
          ctx.fillText('Note:', noteX, noteY);
          // Note body wraps after prefix on first line
          ctx.font = `400 ${noteFs}px ${_SFT}`;
          const noteMaxW = bw - 24 * s;
          const lines = _wrapText(ctx, noteText, noteMaxW - prefixW);
          if (lines.length > 0) {
            ctx.fillText(lines[0], noteX + prefixW, noteY);
            // Remaining lines at full width
            const restLines = _wrapText(ctx, lines.slice(1).join(' '), noteMaxW);
            for (let li = 0; li < Math.min(restLines.length, 2); li++) {
              ctx.fillText(restLines[li], noteX, noteY + (li + 1) * (noteFs + 2 * s));
            }
          }
        }
      }

      // Arena buildings: draw stage / queue zone divider
      if (b._stageH) {
        const headerH = 48;
        const divY = by + (headerH + b._stageH) * s;

        // Subtle stage background highlight
        ctx.fillStyle = dark ? 'rgba(10,132,255,0.04)' : 'rgba(0,122,255,0.03)';
        ctx.fillRect(bx + 4 * s, by + headerH * s, bw - 8 * s, b._stageH * s);

        // Dashed divider between stage and queue
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4 * s, 4 * s]);
        ctx.moveTo(bx + 16 * s, divY);
        ctx.lineTo(bx + bw - 16 * s, divY);
        ctx.strokeStyle = dark ? 'rgba(84,84,88,0.3)' : 'rgba(60,60,67,0.12)';
        ctx.lineWidth = 0.5 * s; ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Zone labels
        ctx.font = `500 ${Math.round(5 * s)}px ${_SFT}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = dark ? 'rgba(10,132,255,0.45)' : 'rgba(0,122,255,0.35)';
        ctx.fillText(`\u26A1 ${t('gw.stage')}`, bx + 12 * s, by + (headerH + 8) * s);
        ctx.fillStyle = dark ? 'rgba(142,142,147,0.45)' : 'rgba(60,60,67,0.3)';
        ctx.fillText(`\uD83D\uDCCB ${t('gw.queue')}`, bx + 12 * s, divY + 8 * s);
      }
    }
  }

  _drawDecisionCard(ctx, s, dark) {
    const d = this._decisionCard;
    if (!d || d.alpha <= 0) return;
    const sp = this._activeSprite;
    if (!sp) return;

    const panelW = Math.min(340 * s, MAP_W * s - 20 * s);
    const panelH = 105 * s;
    // Position above the sprite's head
    const rawPx = sp.x * s - panelW / 2;
    const px = Math.max(10 * s, Math.min(rawPx, MAP_W * s - panelW - 10 * s));
    const py = (sp.y - 70) * s - panelH;

    ctx.globalAlpha = d.alpha;

    // Panel background
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 20 * s; ctx.shadowOffsetY = 4 * s;
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 12 * s);
    ctx.fillStyle = dark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.97)';
    ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 12 * s);
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.3)' : 'rgba(60,60,67,0.1)';
    ctx.lineWidth = 0.5 * s; ctx.stroke();

    // Header: agent name + step counter
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(px + 14 * s, py + 13 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.font = `600 ${Math.round(8 * s)}px ${_SFT}`;
    ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(d.name, px + 22 * s, py + 13 * s);
    ctx.font = `500 ${Math.round(6.5 * s)}px ${_MONO}`;
    ctx.fillStyle = '#8e8e93'; ctx.textAlign = 'right';
    ctx.fillText(`${t('gw.step')} ${d.step}/5`, px + panelW - 12 * s, py + 13 * s);

    // --- 5-NODE FLOW DIAGRAM ---
    // Layout: 5 nodes evenly spaced horizontally with arrows between them
    const flowY = py + 48 * s;
    const nodeR = 14 * s;
    const flowL = px + 30 * s, flowR = px + panelW - 30 * s;
    const gap = (flowR - flowL) / 4;
    const nodeX = [0, 1, 2, 3, 4].map(i => flowL + i * gap);
    const icons = ['\uD83C\uDFB2', '\uD83D\uDCAC', '\uD83D\uDD00', '\uD83E\uDDE0', '\uD83D\uDCB0'];
    const labels = ['\u03B8', 'm', '\u03B5', 'a', '$'];

    // Draw connecting arrows first (behind nodes)
    for (let i = 0; i < 4; i++) {
      const active = d.step > i + 1;
      const current = d.step === i + 2;
      ctx.beginPath();
      ctx.moveTo(nodeX[i] + nodeR + 2 * s, flowY);
      ctx.lineTo(nodeX[i + 1] - nodeR - 2 * s, flowY);
      ctx.strokeStyle = active || current
        ? (dark ? '#0A84FF' : '#007AFF')
        : (dark ? 'rgba(84,84,88,0.3)' : 'rgba(60,60,67,0.15)');
      ctx.lineWidth = (active || current) ? 2 * s : 1 * s;
      ctx.stroke();
      // Arrowhead
      if (active || current) {
        const ax = nodeX[i + 1] - nodeR - 2 * s;
        ctx.beginPath();
        ctx.moveTo(ax, flowY - 3 * s);
        ctx.lineTo(ax + 4 * s, flowY);
        ctx.lineTo(ax, flowY + 3 * s);
        ctx.fillStyle = dark ? '#0A84FF' : '#007AFF';
        ctx.fill();
      }
    }

    // Draw nodes
    for (let i = 0; i < 5; i++) {
      const active = d.step > i;
      const current = d.step === i + 1;

      // Node circle
      ctx.beginPath(); ctx.arc(nodeX[i], flowY, nodeR, 0, Math.PI * 2);
      if (current) {
        ctx.fillStyle = dark ? '#0A84FF' : '#007AFF';
        ctx.fill();
        ctx.strokeStyle = dark ? '#4DA6FF' : '#4DA6FF';
        ctx.lineWidth = 2 * s; ctx.stroke();
      } else if (active) {
        ctx.fillStyle = dark ? 'rgba(10,132,255,0.2)' : 'rgba(0,122,255,0.1)';
        ctx.fill();
        ctx.strokeStyle = dark ? '#0A84FF' : '#007AFF';
        ctx.lineWidth = 1 * s; ctx.stroke();
      } else {
        ctx.fillStyle = dark ? 'rgba(84,84,88,0.15)' : 'rgba(60,60,67,0.06)';
        ctx.fill();
        ctx.strokeStyle = dark ? 'rgba(84,84,88,0.3)' : 'rgba(60,60,67,0.15)';
        ctx.lineWidth = 0.5 * s; ctx.stroke();
      }

      // Node icon
      ctx.font = `${Math.round(11 * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[i], nodeX[i], flowY - 0.5 * s);

      // Value below node (if step reached)
      if (active || current) {
        ctx.font = `700 ${Math.round(7.5 * s)}px ${_MONO}`;
        ctx.fillStyle = current
          ? (dark ? '#4DA6FF' : '#007AFF')
          : (dark ? '#e5e5ea' : '#1c1c1e');
        ctx.textBaseline = 'top';
        const val = d.values[i] || '';
        ctx.fillText(val, nodeX[i], flowY + nodeR + 3 * s);
      }

      // Label above node
      ctx.font = `500 ${Math.round(5.5 * s)}px ${_SFT}`;
      ctx.fillStyle = (active || current) ? (dark ? '#c9d1d9' : '#3d4250') : '#8e8e93';
      ctx.textBaseline = 'bottom';
      ctx.fillText(labels[i], nodeX[i], flowY - nodeR - 3 * s);
    }

    // Bottom detail line — current step description
    if (d.detail) {
      ctx.font = `400 ${Math.round(6.5 * s)}px ${_SFT}`;
      ctx.fillStyle = dark ? '#8e8e93' : '#6b7080';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.detail, px + panelW / 2, py + panelH - 12 * s);
    }

    // Truth/Lie badge (if available, top-right area)
    if (d.tag) {
      const tagColor = d.isLie ? '#FF3B30' : '#34C759';
      const tagW = 42 * s, tagH = 14 * s;
      const tx = px + panelW - tagW - 50 * s, ty = py + 5 * s;
      ctx.beginPath(); ctx.roundRect(tx, ty, tagW, tagH, 4 * s);
      ctx.fillStyle = tagColor + '1A'; ctx.fill();
      ctx.strokeStyle = tagColor + '40'; ctx.lineWidth = 0.5 * s; ctx.stroke();
      ctx.font = `700 ${Math.round(7 * s)}px ${_SFT}`;
      ctx.fillStyle = tagColor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.tag, tx + tagW / 2, ty + tagH / 2);
    }

    ctx.globalAlpha = 1;
  }

  _drawBanner(ctx, s, dark, W, H) {
    if (!this.phaseLabel) return;
    const bH = 38 * s;

    ctx.fillStyle = dark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.88)';
    ctx.fillRect(0, 0, W, bH);
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.25)' : 'rgba(60,60,67,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, bH); ctx.lineTo(W, bH); ctx.stroke();

    ctx.font = `700 ${Math.round(11 * s)}px ${_SF}`;
    ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(this.phaseLabel, 16 * s, bH * 0.5);

    if (this.phaseSub) {
      ctx.font = `400 ${Math.round(8 * s)}px ${_SFT}`;
      ctx.fillStyle = '#8e8e93'; ctx.textAlign = 'right';
      ctx.fillText(this.phaseSub, W - 16 * s, bH * 0.5);
    }

    if (this.phaseProgress > 0 && this.phaseProgress < 1) {
      ctx.fillStyle = dark ? '#0A84FF' : '#007AFF';
      ctx.fillRect(0, bH - 2 * s, W * this.phaseProgress, 2 * s);
    }
  }

  _drawLegend(ctx, s, dark, W, H) {
    const items = [
      { label: t('gw.cls.eq'), color: CLS_COLORS.equilibrium },
      { label: t('gw.cls.la'), color: CLS_COLORS.lying_averse },
      { label: t('gw.cls.da'), color: CLS_COLORS.deception_averse },
      { label: t('gw.cls.ie'), color: CLS_COLORS.inference_error },
    ];
    const fs = Math.round(8 * s);
    const dotR = 4 * s;
    const rowH = 18 * s;
    const padX = 14 * s, padY = 10 * s;
    const panelW = 140 * s, panelH = padY * 2 + items.length * rowH;
    const px = W - panelW - 14 * s, py = 48 * s;

    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 12 * s; ctx.shadowOffsetY = 2 * s;
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 10 * s);
    ctx.fillStyle = dark ? 'rgba(44,44,46,0.88)' : 'rgba(255,255,255,0.9)';
    ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 10 * s);
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.25)' : 'rgba(60,60,67,0.08)';
    ctx.lineWidth = 0.5 * s; ctx.stroke();

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${fs}px ${_SFT}`;
    for (let i = 0; i < items.length; i++) {
      const iy = py + padY + i * rowH + rowH / 2;
      ctx.fillStyle = items[i].color;
      ctx.beginPath(); ctx.arc(px + padX, iy, dotR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark ? '#e5e5ea' : '#1c1c1e';
      ctx.fillText(items[i].label, px + padX + dotR + 8 * s, iy);
    }
  }

  /* ================================================================
     ANIMATION LOOP
     ================================================================ */
  _loop(ts) {
    if (!this._lastTime) this._lastTime = ts;
    const dt = Math.min(0.1, (ts - this._lastTime) / 1000);
    this._lastTime = ts; this._time = ts;
    for (const sp of this.sprites) sp.update(dt, this.speed);
    if (this._decisionCard) {
      const d = this._decisionCard;
      if (d._fadeIn) { d.alpha = Math.min(1, d.alpha + dt * 5); if (d.alpha >= 1) d._fadeIn = false; }
      if (d._fadeOut) { d.alpha = Math.max(0, d.alpha - dt * 5); }
    }
    this._updateCamera(dt);
    this.draw();
    if (this._running) this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  startLoop() { if (this._running) return; this._running = true; this._lastTime = 0; this._raf = requestAnimationFrame(ts => this._loop(ts)); }
  stopLoop() { this._running = false; if (this._raf) cancelAnimationFrame(this._raf); }

  async _wait(ms) {
    const steps = Math.max(1, Math.ceil(ms / 50));
    for (let i = 0; i < steps; i++) {
      while (this.state === 'paused') await new Promise(r => setTimeout(r, 80));
      if (this.state === 'idle') return;
      await new Promise(r => setTimeout(r, Math.max(8, 50 / this.speed)));
    }
  }

  _setPhase(label, sub) { this.phaseLabel = label; this.phaseSub = sub || ''; if (this.onPhase) this.onPhase(label); }
  _log(html) {
    if (!this.onLog) return;
    const div = document.createElement('div');
    div.className = 'v3-log-entry';
    div.innerHTML = html;
    const target = this._logGroup || document.getElementById('log');
    if (target) { target.appendChild(div); target.scrollTop = target.scrollHeight; }
  }
  _spriteOf(id) { return this.sprites.find(sp => sp.agent.id === id); }

  _arrangeIn(buildingId, list, stagger) {
    const b = this._buildingMap[buildingId];
    const sc = this.spriteScale;
    const gapX = 38 * sc, gapY = 55 * sc;
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.5)));
    const rows = Math.ceil(list.length / cols);
    const gridW = (cols - 1) * gapX;
    const gridH = (rows - 1) * gapY;
    // Header takes ~28px at top; arena buildings also have a stage zone
    const headerH = 48;
    const stageH = b._stageH || 0;
    const areaTop = b.y - b.h / 2 + headerH + stageH;
    const areaH = b.h - headerH - stageH;
    const startX = b.x - gridW / 2;
    const startY = areaTop + (areaH - gridH) / 2;
    // Stagger per-sprite delay so sprites don't all cross paths at once.
    // Cap total stagger to ~0.5s so the wait after _arrangeIn is enough.
    const perDelay = stagger !== false ? Math.min(0.035, 0.5 / Math.max(1, list.length)) : 0;
    list.forEach((sp, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const gx = startX + col * gapX, gy = startY + row * gapY;
      sp._gridX = gx; sp._gridY = gy;
      sp.moveTo(gx, gy);
      sp._moveDelay = perDelay * i;
    });
  }

  /* ================================================================
     LOG HELPERS
     ================================================================ */
  _logPhase(icon, title, desc) {
    const log = document.getElementById('log');
    if (!log) return;
    const details = document.createElement('details');
    details.className = 'v3-log-group';
    details.open = true;
    const summary = document.createElement('summary');
    summary.className = 'v3-le-phase';
    summary.innerHTML = `<span class="v3-le-icon">${icon}</span><strong>${title}</strong>${desc ? `<span class="v3-le-desc"> \u2014 ${desc}</span>` : ''}`;
    details.appendChild(summary);
    log.appendChild(details);
    this._logGroup = details;
    log.scrollTop = log.scrollHeight;
  }
  _logAgent(sp, text) {
    this._log(`<div class="v3-le-agent"><span class="v3-le-dot" style="background:${sp.color}"></span><strong>${sp.displayName}</strong> <span class="v3-le-text">${text}</span></div>`);
  }
  _logDecision(sp, result) {
    const lieTag = result.isLie ? `<span class="v3-tag v3-tag-lie">${t('log.lie').toUpperCase()}</span>` : `<span class="v3-tag v3-tag-truth">${t('log.truth').toUpperCase()}</span>`;
    const decTag = result.isDec ? ` <span class="v3-tag v3-tag-dec">${t('log.deceptive').toUpperCase()}</span>` : '';
    const mcTag = result.mc ? ` <span class="v3-tag" style="background:rgba(255,149,0,0.1);color:#FF9500;border:1px solid rgba(255,149,0,0.2)">${t('log.miscomm').toUpperCase()}</span>` : '';
    this._log(
      `<div class="v3-le-decision"><div class="v3-le-pair">` +
      `<span class="v3-le-dot" style="background:${sp.color}"></span>` +
      `<strong>${sp.displayName}</strong> \u2192 ${t('gw.receiver')} ${lieTag}${decTag}${mcTag}</div>` +
      `<div class="v3-le-detail">` +
      `\u2460 \u03B8=${result.s1}` +
      ` \u2461 m=${result.sent}` +
      ` \u2462 rcv=${result.rcv}${result.mc ? '\u26A0' : ''}` +
      ` \u2463 a=${result.a1.toFixed(2)} \u03BB=${result.lambda.toFixed(2)}` +
      ` \u2464 ${t('gw.payoff').toLowerCase()}=${result.sp.toFixed(2)}` +
      `</div></div>`
    );
  }
  _logSummary(icon, text) {
    this._log(`<div class="v3-le-summary"><span class="v3-le-icon">${icon}</span>${text}</div>`);
  }

  /* ================================================================
     5-STEP DECISION ANIMATION
     Each agent's decision is broken into the 5 steps of the
     sender-receiver game, shown clearly on the decision card:
       Step 1: Nature draws state theta
       Step 2: Sender computes strategy & sends message m
       Step 3: Miscommunication check
       Step 4: Receiver updates belief lambda & takes action a
       Step 5: Payoff computed
     ================================================================ */
  async _animateDecision(sp, result, arenaId, stepScale) {
    const stage = this._stageCenter(arenaId);
    const w = ms => Math.round(ms * (stepScale || 1));

    // Move agent from queue to action stage — no dimming, others stay visible
    sp.active = true;
    this._activeSprite = sp;
    sp._moveDelay = 0;
    sp.moveTo(stage.x, stage.y);
    this._focusStage(arenaId);
    await this._wait(w(350));

    // Card state — values array accumulates results per step, step increments
    const card = {
      arenaId, name: sp.displayName, color: sp.color,
      step: 0, tag: '', isLie: false,
      values: ['', '', '', '', ''],
      detail: '',
      alpha: 0, _fadeIn: true, _fadeOut: false,
    };
    this._decisionCard = card;

    // Step 1: Nature draws theta
    card.step = 1;
    card.values[0] = `${result.s1}`;
    card.detail = `${t('gw.nature')} ${result.s1}`;
    await this._wait(w(500));

    // Step 2: Sender sends message
    card.step = 2;
    card.values[1] = `${result.sent}`;
    card.tag = result.isLie ? t('gw.lie').toUpperCase() : t('gw.truth').toUpperCase();
    card.isLie = result.isLie;
    card.detail = `${t('gw.sender.obs')} \u03B8=${result.s1}, ${t('gw.sender.sends')} m=${result.sent}` +
      (result.isLie ? ` (m\u2260\u03B8 \u2014 ${t('gw.lie')})` : ` (m=\u03B8 \u2014 ${t('gw.truth')})`);
    await this._wait(w(500));

    // Step 3: Channel / miscommunication
    card.step = 3;
    card.values[2] = result.mc ? `${result.sent}\u2192${result.rcv}` : '\u2713';
    card.detail = result.mc
      ? `${t('gw.ch.noise')} ${t('gw.ch.sent')} ${result.sent} \u2192 ${t('gw.ch.rcv')} ${result.rcv}`
      : `${t('gw.ch.ok')} rcv = ${result.rcv}`;
    await this._wait(w(450));

    // Step 4: Receiver belief update + action
    card.step = 4;
    card.values[3] = `${result.a1.toFixed(2)}`;
    const decLabel = result.isDec
      ? `D=${result.dec.toFixed(2)} (${t('gw.deceptive')})`
      : `D=0 (${t('gw.honest')})`;
    card.detail = `${t('gw.receiver')}: \u03BB=${result.lambda.toFixed(3)}, action a=${result.a1.toFixed(3)} \u2502 ${decLabel}`;
    await this._wait(w(500));

    // Step 5: Payoff
    card.step = 5;
    card.values[4] = `${result.sp.toFixed(2)}`;
    card.detail = `${t('gw.payoff')} = ${result.sp.toFixed(3)}` +
      (result.isLie ? ` (${t('gw.incl')} c\u2097=${result.cl.toFixed(2)})` : '') +
      (result.isDec ? ` (${t('gw.incl')} c\u2091\u00B7D=${(result.cd * result.dec).toFixed(2)})` : '');
    await this._wait(w(500));

    // Fade out card
    card._fadeOut = true;
    await this._wait(w(250));
    this._decisionCard = null;

    // Update agent state and return sprite to queue
    sp.rep = result.strat ?? 0.5;
    this._logDecision(sp, result);
    this._interactions++;
    sp.active = false;
    this._activeSprite = null;
    sp.moveTo(sp._gridX, sp._gridY);
    sp._moveDelay = 0;
    // Zoom back out to full arena view
    this._focusBuilding(arenaId);
  }

  /* ================================================================
     GAME PHASES
     ================================================================ */
  async play() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.startLoop();
    const R = this.results, agents = this.agents, n = agents.length;
    const rounds = +(document.getElementById('s-rounds')?.value) || 1;
    const env = document.getElementById('s-env')?.value || 'both';

    /* Phase 1: Populate */
    this._camFollow = true; this._updateFollowLabel();
    this._focusBuilding('village');
    this._setPhase(`\u2460 ${t('gw.population')}`, `${n} ${t('gw.agents')}`);
    this._logPhase('\uD83C\uDFD8\uFE0F', t('gw.ph1'), `${n} ${t('gw.entering')}`);
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].alpha = 1;
      this._logAgent(this.sprites[i], `${t('gw.enters')} <em>(${this.sprites[i].riskLabel})</em>`);
      this.phaseProgress = (i + 1) / n;
      if (i < 5 || i % Math.max(1, Math.floor(n / 6)) === 0) await this._wait(60);
    }
    this._logSummary('\u2713', `${t('gw.arrived')} \u2014 <strong>${n}</strong>`);
    await this._wait(400);

    /* Phase 2: Oracle */
    this._focusBuilding('oracle');
    this._setPhase(`\u2461 ${t('gw.oracle')}`, t('gw.dispatching'));
    this._logPhase('\uD83D\uDD2E', t('gw.ph2'), t('gw.genstrat'));
    this.phaseProgress = 0;
    this._arrangeIn('oracle', this.sprites);
    await this._wait(600);
    const show = Math.min(5, n);
    for (let i = 0; i < show; i++) {
      this._logAgent(this.sprites[i], t('gw.rcvstrat'));
      this.phaseProgress = (i + 1) / show;
      await this._wait(150);
    }
    if (n > show) this._logSummary('\uD83D\uDCDC', `+${n - show} ${t('gw.morestrat')}`);
    await this._wait(350);

    /* Phase 3: BT Arena */
    if (env === 'both' || env === 'BT') await this._playArena('bt', R, rounds, n);
    /* Phase 4: GL Arena */
    if (env === 'both' || env === 'GL') await this._playArena('gl', R, rounds, n);

    /* Phase 5: Classification */
    this._focusBuilding('hall');
    this._setPhase(`\u2464 ${t('gw.hall.d')}`, t('gw.analyzing'));
    this._showLegend = true;
    this._logPhase('\uD83C\uDFDB\uFE0F', t('gw.ph5'), t('gw.profiles'));
    this.phaseProgress = 0;
    this._arrangeIn('hall', this.sprites);
    await this._wait(600);
    const C = { equilibrium:0, lying_averse:0, deception_averse:0, inference_error:0 };
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      sp.classification = sp.agent.classification || '';
      if (sp.classification) C[sp.classification]++;
      this._logAgent(sp, `\u2192 <strong>${_clsLabel(sp.classification)}</strong>`);
      this.phaseProgress = (i + 1) / n;
      if (i < 5 || i % Math.max(1, Math.floor(n / 5)) === 0) await this._wait(60);
    }
    await this._wait(300);
    this._logPhase('\uD83D\uDCCA', t('gw.results'), '');
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    this._logSummary('\uD83D\uDD35', `${t('gw.cls.eq')}: ${C.equilibrium} (${pct('equilibrium')})`);
    this._logSummary('\uD83D\uDFE2', `${t('gw.cls.la')}: ${C.lying_averse} (${pct('lying_averse')})`);
    this._logSummary('\uD83D\uDD34', `${t('gw.cls.da')}: ${C.deception_averse} (${pct('deception_averse')})`);
    this._logSummary('\uD83D\uDFE0', `${t('gw.cls.ie')}: ${C.inference_error} (${pct('inference_error')})`);
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    if (allP.length) this._logSummary('\uD83D\uDCB0', `${t('gw.avgwelf')}: ${(allP.reduce((a,b)=>a+b,0)/allP.length).toFixed(3)}`);
    this._logSummary('\uD83C\uDFAE', `${t('gw.totaldec')}: ${this._interactions}`);

    /* Done */
    this._focusAll();
    this._setPhase(`\u2705 ${t('gw.complete')}`, `${n} ${t('gw.agents')} \u00B7 ${this._interactions} ${t('gw.decisions')}`);
    this._logPhase('\uD83C\uDF89', t('gw.complete'), `${n} ${t('gw.classified')}`);
    this.phaseProgress = 1;
    this.state = 'done';
  }

  async _playArena(type, R, rounds, n) {
    const isBT = type === 'bt';
    const stratMap = isBT ? R.btS : R.glS;
    const records = isBT ? R.bt : R.gl;
    const phaseNum = isBT ? '\u2462' : '\u2463';
    const arenaLabel = isBT ? t('gw.btarena') : t('gw.glarena');
    const arenaDesc = isBT ? t('gw.btarena.d') : t('gw.glarena.d');
    const arenaEmoji = isBT ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F';

    const agentIds = Object.keys(stratMap).map(Number);
    const arenaSprites = agentIds.map(id => this._spriteOf(id)).filter(Boolean);
    const totalAgents = arenaSprites.length;

    this._focusBuilding(type);
    this._setPhase(`${phaseNum} ${arenaLabel}`, `${totalAgents} ${t('gw.agents')}`);
    this._logPhase(arenaEmoji, arenaLabel, `${totalAgents} ${t('gw.agents')} \u2014 ${arenaDesc}`);
    this._logSummary('\uD83D\uDCD6', t('gw.protocol'));
    this._logSummary('', t('gw.protosteps'));
    this.phaseProgress = 0;
    this._arrangeIn(type, arenaSprites);
    await this._wait(400);

    // Adaptive step timing: scale down wait times for large populations
    const stepScale = totalAgents <= 10 ? 1.0
      : totalAgents <= 30 ? 0.6
      : totalAgents <= 60 ? 0.3
      : totalAgents <= 100 ? 0.16 : 0.08;

    // Each agent plays individually against the implicit Bayesian receiver
    const resultMap = {};
    records.filter((_, idx) => idx % rounds === 0).forEach(r => { resultMap[r.id] = r; });

    // ALL agents perform on the action stage
    for (let i = 0; i < arenaSprites.length; i++) {
      const sp = arenaSprites[i];
      const res = resultMap[sp.agent.id];
      if (!res) continue;
      this._setPhase(`${phaseNum} ${arenaLabel}`, `${sp.displayName} (${i + 1}/${totalAgents})`);
      await this._animateDecision(sp, res, type, stepScale);
      sp.rep = isBT ? (stratMap[sp.agent.id] ?? 0.5) : 1 - (stratMap[sp.agent.id] ?? 0.5);
      this.phaseProgress = (i + 1) / totalAgents;
      await this._wait(Math.round(100 * stepScale));
    }

    // Summary stats
    const round1 = records.filter((_, idx) => idx % rounds === 0);
    const lies = round1.filter(r => r.isLie).length;
    const decs = round1.filter(r => r.isDec).length;
    this._logSummary('\uD83D\uDCCA', `${arenaLabel}: <strong>${round1.length - lies}</strong> ${t('gw.truths')}, <strong>${lies}</strong> ${t('gw.lies')}, <strong>${decs}</strong> ${t('gw.deceptive')}`);
    this.phaseProgress = 1;
    await this._wait(400);
  }

  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  reset() {
    this.state = 'idle'; this.stopLoop();
    this.sprites = []; this.spriteScale = 1;
    this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
    this._offsetX = 0; this._offsetY = 0; this._zoom = 1; this._decisionCard = null; this._showLegend = false;
    this._logGroup = null;
    this._cam = { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 };
    this._camTarget = null; this._camFollow = true;
    MAP_W = 1000; MAP_H = 720;
    BUILDINGS = BUILDINGS_BASE.map(b => ({...b}));
    this._buildingMap = {};
    BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
  }
}

/* ==================================================================
   GAME VIEW INTEGRATION (formerly v3.js)
   ================================================================== */

let _v3world = null;

function _getWorld() {
  if (_v3world) return _v3world;
  const canvas = document.getElementById('v3-canvas');
  if (!canvas) return null;
  _v3world = new GameWorld(canvas);
  _v3world.onLog = true;  // signal that logging is enabled
  _v3world.onPhase = () => {};
  return _v3world;
}

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
    pauseBtn.innerHTML = w.state === 'paused' ? `\u25b6 <span data-i18n="gw.resume">${t('gw.resume')}</span>` : `\u23f8 <span data-i18n="gw.pause">${t('gw.pause')}</span>`;
  }
}

window.addEventListener('resize', () => {
  if (currentView === 'game' && _v3world) {
    _v3world.resize();
    _v3world.draw();
  }
});
