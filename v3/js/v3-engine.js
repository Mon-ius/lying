/**
 * V3 Game Engine — Apple-aesthetic 2D game world.
 * Each agent independently plays as sender against an implicit Bayesian receiver.
 * No agent-to-agent communication — faithful to the Choi, Lee & Lim (2025) model.
 */

/* ---- Helpers ---- */
function _lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }

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

/* ---- Virtual Map ---- */
const MAP_W = 1000, MAP_H = 680;

const BUILDINGS = [
  { id:'village', x:500, y:75,  w:340, h:60,  label:'Population Hub',   icon:'\uD83C\uDFD8\uFE0F', tint:'#34C759', desc:'Agent village' },
  { id:'oracle',  x:500, y:220, w:240, h:50,  label:'Strategy Oracle',  icon:'\uD83D\uDD2E',       tint:'#AF52DE', desc:'Strategy dispatch' },
  { id:'bt',      x:220, y:400, w:240, h:100, label:'BT Arena',         icon:'\uD83D\uDEE1\uFE0F', tint:'#007AFF', desc:'Bad-type Truth-telling' },
  { id:'gl',      x:780, y:400, w:240, h:100, label:'GL Arena',         icon:'\u2694\uFE0F',        tint:'#FF9500', desc:'Good-type Lying' },
  { id:'hall',    x:500, y:590, w:300, h:55,  label:'Hall of Records',  icon:'\uD83C\uDFDB\uFE0F', tint:'#FF3B30', desc:'Classification' },
];
const PATHS = [['village','oracle'],['oracle','bt'],['oracle','gl'],['bt','hall'],['gl','hall']];

/* ---- Apple-inspired color palette ---- */
const RISK_COLORS    = { risk_loving:'#FF3B30', risk_neutral:'#FF9500', risk_averse:'#007AFF' };
const CLS_COLORS     = { equilibrium:'#007AFF', lying_averse:'#34C759', deception_averse:'#FF3B30', inference_error:'#FF9500' };
const PROVIDER_COLORS= { claude:'#FF9500', gpt:'#34C759', gemini:'#007AFF', deepseek:'#AF52DE', qwen:'#5AC8FA', minimax:'#FF2D55', kimi:'#FF6B35', glm:'#5856D6' };
const RISK_LABELS    = { risk_loving:'Risk Lover', risk_neutral:'Risk Neutral', risk_averse:'Risk Averse' };
const CLS_LABELS     = { equilibrium:'Equilibrium', lying_averse:'Lying-Averse', deception_averse:'Deception-Averse', inference_error:'Inference Error' };
const SKIN_TONES     = ['#fdbcb4','#f1c27d','#e0ac69','#c68642','#8d5524','#ffdbac','#deb887','#d2a679'];

const _SF   = "-apple-system,'SF Pro Display','Inter','Segoe UI',sans-serif";
const _SFT  = "-apple-system,'SF Pro Text','Inter','Segoe UI',sans-serif";
const _MONO = "'SF Mono','JetBrains Mono','Fira Code',monospace";

/* ==================================================================
   SPRITE — Refined character with Apple aesthetics
   ================================================================== */
class Sprite {
  constructor(agent, x, y) {
    this.agent = agent;
    this.name = agent._name || `Agent${agent.id}`;
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
  }

  get color() {
    if (this.classification) return CLS_COLORS[this.classification] || '#8e8e93';
    if (this.agent.aiProvider) return PROVIDER_COLORS[this.agent.aiProvider] || '#8e8e93';
    return RISK_COLORS[this.agent.riskType] || '#8e8e93';
  }
  get riskLabel() { return RISK_LABELS[this.agent.riskType] || this.agent.riskType; }
  moveTo(x, y) { this.tx = x; this.ty = y; }

  update(dt, speed) {
    const dx = this.tx - this.x, dy = this.ty - this.y;
    this._moving = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    this.x = _lerp(this.x, this.tx, 5 * speed * dt);
    this.y = _lerp(this.y, this.ty, 5 * speed * dt);
    if (this._moving) this._walkCycle += dt * speed * 8;
  }

  draw(ctx, s, dark) {
    if (this.alpha <= 0) return;
    const cx = this.x * s, cy = this.y * s;
    const bodyW = 12 * s, bodyH = 13 * s;
    const headR = 6.5 * s;
    const legH = 5 * s;
    const baseY = cy;

    ctx.globalAlpha = this.alpha * (this.dimmed ? 0.18 : 1);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2 * s, bodyW * 0.6, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fill();

    // Active indicator — subtle ellipse ring on ground
    if (this.active) {
      ctx.save();
      ctx.globalAlpha = this.alpha * 0.35;
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 2 * s, 20 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.strokeStyle = this.color; ctx.lineWidth = 1.5 * s; ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = this.alpha;
    }

    // Legs
    const legSpread = this._moving ? Math.sin(this._walkCycle) * 2.5 * s : 0;
    ctx.fillStyle = dark ? '#48484a' : '#3a3a3c';
    ctx.beginPath(); ctx.roundRect(cx - 3.5 * s + legSpread, baseY - legH, 3 * s, legH + 1 * s, 1.5 * s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + 0.5 * s - legSpread, baseY - legH, 3 * s, legH + 1 * s, 1.5 * s); ctx.fill();

    // Body
    const bodyTop = baseY - legH - bodyH;
    ctx.beginPath();
    ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyH, [3.5 * s, 3.5 * s, 2 * s, 2 * s]);
    ctx.fillStyle = this.color; ctx.fill();

    // Arms
    ctx.fillStyle = this.skin;
    ctx.beginPath(); ctx.roundRect(cx - bodyW / 2 - 3 * s, bodyTop + 2.5 * s, 3 * s, 7 * s, 1.5 * s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(cx + bodyW / 2, bodyTop + 2.5 * s, 3 * s, 7 * s, 1.5 * s); ctx.fill();

    // Head
    const headY = bodyTop - headR * 0.5;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.skin; ctx.fill();

    // Eyes
    ctx.fillStyle = '#1c1c1e';
    ctx.beginPath(); ctx.arc(cx - 2.5 * s, headY - 0.5 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.5 * s, headY - 0.5 * s, 1 * s, 0, Math.PI * 2); ctx.fill();

    // Mouth
    ctx.beginPath();
    ctx.arc(cx, headY + 2 * s, 1.8 * s, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = this._darken(this.skin, 0.3);
    ctx.lineWidth = 0.7 * s; ctx.stroke();

    // Reputation — thin bar
    const barW = 16 * s, barH = 2 * s;
    const barX = cx - barW / 2, barY = headY - headR - 5 * s;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 1 * s); ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * Math.max(0.03, Math.min(1, this.rep)), barH, 1 * s); ctx.fill();

    // Name
    ctx.font = `600 ${Math.round(6.5 * s)}px ${_SF}`;
    ctx.fillStyle = dark ? '#e5e5ea' : '#1c1c1e';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this.name, cx, baseY + 5 * s);

    // Subtitle
    const sub = this.agent.aiProvider || this.riskLabel;
    ctx.font = `400 ${Math.round(5 * s)}px ${_SFT}`;
    ctx.fillStyle = '#8e8e93';
    ctx.fillText(sub, cx, baseY + 13 * s);

    ctx.globalAlpha = 1;
  }

  _darken(hex, amt) {
    const c = hex.startsWith('#') ? hex : '#888888';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `rgb(${Math.max(0,r*(1-amt))|0},${Math.max(0,g*(1-amt))|0},${Math.max(0,b*(1-amt))|0})`;
  }
}

/* ==================================================================
   GAME WORLD — Apple-aesthetic, individual agent decisions
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
    this._scale = 1; this._offsetX = 0; this._offsetY = 0; this._interactions = 0;
    this._decisionCard = null; // {arenaId, name, color, tag, isLie, info, alpha, _fadeIn, _fadeOut}
    this._dragging = false; this._dragSX = 0; this._dragSY = 0; this._dragOX = 0; this._dragOY = 0;
    this._setupInput();
    this.resize();
  }

  _setupInput() {
    const c = this.canvas;
    c.style.cursor = 'grab';
    c.addEventListener('mousedown', e => {
      this._dragging = true; this._dragSX = e.clientX; this._dragSY = e.clientY;
      this._dragOX = this._offsetX; this._dragOY = this._offsetY; c.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      this._offsetX = this._dragOX + (e.clientX - this._dragSX) * devicePixelRatio;
      this._offsetY = this._dragOY + (e.clientY - this._dragSY) * devicePixelRatio;
      if (!this._running) this.draw();
    });
    window.addEventListener('mouseup', () => { if (this._dragging) { this._dragging = false; c.style.cursor = 'grab'; } });
    c.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return; const t = e.touches[0];
      this._dragging = true; this._dragSX = t.clientX; this._dragSY = t.clientY;
      this._dragOX = this._offsetX; this._dragOY = this._offsetY;
    }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (!this._dragging || e.touches.length !== 1) return; const t = e.touches[0];
      this._offsetX = this._dragOX + (t.clientX - this._dragSX) * devicePixelRatio;
      this._offsetY = this._dragOY + (t.clientY - this._dragSY) * devicePixelRatio;
      if (!this._running) this.draw();
    }, { passive: true });
    c.addEventListener('touchend', () => { this._dragging = false; }, { passive: true });
    c.addEventListener('dblclick', () => { this._offsetX = 0; this._offsetY = 0; if (!this._running) this.draw(); });
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
    this.phaseProgress = 0; this._interactions = 0; this._decisionCard = null;
    _assignNames(agents);
    const v = this._buildingMap.village;
    const cols = Math.ceil(Math.sqrt(agents.length * 1.8));
    agents.forEach((a, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const sp = new Sprite(a, v.x - (cols - 1) * 16 + col * 32, v.y - 5 + row * 28);
      sp.alpha = 0;
      this.sprites.push(sp);
    });
  }

  /* ================================================================
     DRAWING — Clean, minimal, Apple-like
     ================================================================ */
  draw() {
    const ctx = this.ctx, s = this._scale;
    const dark = typeof _isDark === 'function' && _isDark();
    const W = this.canvas.width, H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Background — clean neutral gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { bg.addColorStop(0, '#1c1c1e'); bg.addColorStop(1, '#000000'); }
    else { bg.addColorStop(0, '#f5f5f7'); bg.addColorStop(1, '#e5e5ea'); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // World transform
    const cx = (W - MAP_W * s) / 2 + this._offsetX;
    const cy = (H - MAP_H * s) / 2 + this._offsetY;
    ctx.setTransform(1, 0, 0, 1, cx, cy);

    this._drawPaths(ctx, s, dark);
    this._drawBuildings(ctx, s, dark);
    const sorted = [...this.sprites].sort((a, b) => a.y - b.y);
    for (const sp of sorted) sp.draw(ctx, s, dark);
    if (this._decisionCard) this._drawDecisionCard(ctx, s, dark);

    // Banner (screen-space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawBanner(ctx, s, dark, W, H);
  }

  _drawPaths(ctx, s, dark) {
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.2)' : 'rgba(60,60,67,0.1)';
    ctx.lineCap = 'round';
    for (const [fromId, toId] of PATHS) {
      const a = this._buildingMap[fromId], b = this._buildingMap[toId];
      const ax = a.x * s, ay = a.y * s, bx = b.x * s, by = b.y * s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 + (by - ay) * 0.06, (ay + by) / 2, bx, by);
      ctx.stroke();
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

      // Top accent line
      const accentW = Math.min(bw * 0.35, 80 * s);
      ctx.save(); ctx.globalAlpha = 0.65;
      ctx.fillStyle = b.tint;
      ctx.beginPath();
      ctx.roundRect(b.x * s - accentW / 2, by, accentW, 2.5 * s, [1.5 * s, 1.5 * s, 0, 0]);
      ctx.fill(); ctx.restore();

      // Icon
      ctx.font = `${Math.round(16 * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, b.x * s, (b.y - 4) * s);

      // Label
      ctx.font = `600 ${Math.round(8 * s)}px ${_SF}`;
      ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
      ctx.fillText(b.label, b.x * s, (b.y + 10) * s);

      // Description
      ctx.font = `400 ${Math.round(5.5 * s)}px ${_SFT}`;
      ctx.fillStyle = '#8e8e93';
      ctx.fillText(b.desc, b.x * s, (b.y + 20) * s);
    }
  }

  _drawDecisionCard(ctx, s, dark) {
    const d = this._decisionCard;
    if (!d || d.alpha <= 0) return;
    const arena = this._buildingMap[d.arenaId];
    const panelW = 270 * s, panelH = 52 * s;
    const px = arena.x * s - panelW / 2, py = (arena.y + 68) * s;

    ctx.globalAlpha = d.alpha;

    // Card background
    ctx.save();
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 16 * s; ctx.shadowOffsetY = 3 * s;
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 10 * s);
    ctx.fillStyle = dark ? 'rgba(44,44,46,0.92)' : 'rgba(255,255,255,0.95)';
    ctx.fill(); ctx.restore();

    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 10 * s);
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.25)' : 'rgba(60,60,67,0.08)';
    ctx.lineWidth = 0.5 * s; ctx.stroke();

    // Agent color dot + name
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(px + 14 * s, py + 14 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();

    ctx.font = `600 ${Math.round(8 * s)}px ${_SFT}`;
    ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(d.name, px + 22 * s, py + 14 * s);

    // Truth/Lie tag (right side)
    if (d.tag) {
      const tagColor = d.isLie ? (dark ? '#FF453A' : '#FF3B30') : (dark ? '#30D158' : '#34C759');
      ctx.font = `700 ${Math.round(7 * s)}px ${_SFT}`;
      ctx.fillStyle = tagColor; ctx.textAlign = 'right';
      ctx.fillText(d.tag, px + panelW - 12 * s, py + 14 * s);
    }

    // Info line (centered below)
    if (d.info) {
      ctx.font = `500 ${Math.round(7 * s)}px ${_MONO}`;
      ctx.fillStyle = '#8e8e93'; ctx.textAlign = 'center';
      ctx.fillText(d.info, arena.x * s, py + 37 * s);
    }

    ctx.globalAlpha = 1;
  }

  _drawBanner(ctx, s, dark, W, H) {
    if (!this.phaseLabel) return;
    const bH = 38 * s;

    // Frosted glass background
    ctx.fillStyle = dark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.88)';
    ctx.fillRect(0, 0, W, bH);
    ctx.strokeStyle = dark ? 'rgba(84,84,88,0.25)' : 'rgba(60,60,67,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, bH); ctx.lineTo(W, bH); ctx.stroke();

    // Phase label
    ctx.font = `700 ${Math.round(11 * s)}px ${_SF}`;
    ctx.fillStyle = dark ? '#f5f5f7' : '#1c1c1e';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(this.phaseLabel, 16 * s, bH * 0.5);

    // Subtitle
    if (this.phaseSub) {
      ctx.font = `400 ${Math.round(8 * s)}px ${_SFT}`;
      ctx.fillStyle = '#8e8e93'; ctx.textAlign = 'right';
      ctx.fillText(this.phaseSub, W - 16 * s, bH * 0.5);
    }

    // Progress bar
    if (this.phaseProgress > 0 && this.phaseProgress < 1) {
      ctx.fillStyle = dark ? '#0A84FF' : '#007AFF';
      ctx.fillRect(0, bH - 2 * s, W * this.phaseProgress, 2 * s);
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
    // Decision card fade animation
    if (this._decisionCard) {
      const d = this._decisionCard;
      if (d._fadeIn) { d.alpha = Math.min(1, d.alpha + dt * 5); if (d.alpha >= 1) d._fadeIn = false; }
      if (d._fadeOut) { d.alpha = Math.max(0, d.alpha - dt * 5); }
    }
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
  _log(html) { if (this.onLog) this.onLog(html); }
  _spriteOf(id) { return this.sprites.find(sp => sp.agent.id === id); }

  _arrangeIn(buildingId, list) {
    const b = this._buildingMap[buildingId];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.8)));
    list.forEach((sp, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      sp.moveTo(b.x - (cols - 1) * 15 + col * 30, b.y - 8 + row * 26);
    });
  }

  /* ================================================================
     LOG HELPERS — Clean entries for shared game log
     ================================================================ */
  _logPhase(icon, title, desc) {
    this._log(`<div class="v3-le-phase"><span class="v3-le-icon">${icon}</span><strong>${title}</strong>${desc ? `<span class="v3-le-desc"> \u2014 ${desc}</span>` : ''}</div>`);
  }
  _logAgent(sp, text) {
    this._log(`<div class="v3-le-agent"><span class="v3-le-dot" style="background:${sp.color}"></span><strong>${sp.name}</strong> <span class="v3-le-text">${text}</span></div>`);
  }
  _logDecision(sp, result) {
    const lieTag = result.isLie ? '<span class="v3-tag v3-tag-lie">LIE</span>' : '<span class="v3-tag v3-tag-truth">TRUTH</span>';
    const decTag = result.isDec ? ' <span class="v3-tag v3-tag-dec">DECEPTIVE</span>' : '';
    this._log(
      `<div class="v3-le-decision"><div class="v3-le-pair">` +
      `<span class="v3-le-dot" style="background:${sp.color}"></span>` +
      `<strong>${sp.name}</strong> \u2192 Receiver ${lieTag}${decTag}</div>` +
      `<div class="v3-le-detail">\u03B8=${result.s1} m=${result.sent} a=${result.a1.toFixed(2)} \u03BB=${result.lambda.toFixed(2)} pay=${result.sp.toFixed(2)}</div></div>`
    );
  }
  _logSummary(icon, text) {
    this._log(`<div class="v3-le-summary"><span class="v3-le-icon">${icon}</span>${text}</div>`);
  }

  /* ================================================================
     AGENT DECISION ANIMATION — Individual agent vs implicit receiver
     ================================================================ */
  async _animateDecision(sp, result, arenaId) {
    const arena = this._buildingMap[arenaId];

    // Dim all others, highlight this agent
    for (const s of this.sprites) s.dimmed = (s !== sp);
    sp.active = true;
    sp.moveTo(arena.x, arena.y - 12);
    await this._wait(350);

    // Decision card — step 1: state drawn
    this._decisionCard = {
      arenaId, name: sp.name, color: sp.color,
      tag: '', isLie: false, info: `\u03B8 = ${result.s1}`,
      alpha: 0, _fadeIn: true, _fadeOut: false,
    };
    await this._wait(450);

    // Step 2: message sent + truth/lie
    this._decisionCard.tag = result.isLie ? 'LIE' : 'TRUTH';
    this._decisionCard.isLie = result.isLie;
    this._decisionCard.info = `\u03B8=${result.s1}  \u2192  m=${result.sent}  \u2192  a=${result.a1.toFixed(2)}`;
    await this._wait(450);

    // Step 3: full result
    this._decisionCard.info = `\u03B8=${result.s1}  m=${result.sent}  a=${result.a1.toFixed(2)}  \u03BB=${result.lambda.toFixed(2)}  pay=${result.sp.toFixed(2)}`;
    await this._wait(450);

    // Fade out card
    this._decisionCard._fadeOut = true;
    await this._wait(200);
    this._decisionCard = null;

    // Update agent state
    sp.rep = result.strat ?? 0.5;
    this._logDecision(sp, result);
    this._interactions++;
    sp.active = false;
    for (const s of this.sprites) s.dimmed = false;
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
    this._setPhase('\u2460 Population', `${n} agents`);
    this._logPhase('\uD83C\uDFD8\uFE0F', 'Phase 1 \u2014 Population', `${n} agents entering`);
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].alpha = 1;
      this._logAgent(this.sprites[i], `enters <em>(${this.sprites[i].riskLabel})</em>`);
      this.phaseProgress = (i + 1) / n;
      if (i < 5 || i % Math.max(1, Math.floor(n / 6)) === 0) await this._wait(60);
    }
    this._logSummary('\u2713', `All <strong>${n}</strong> agents arrived`);
    await this._wait(400);

    /* Phase 2: Oracle */
    this._setPhase('\u2461 Strategy Oracle', 'Dispatching');
    this._logPhase('\uD83D\uDD2E', 'Phase 2 \u2014 Oracle', 'Generating strategies');
    this.phaseProgress = 0;
    this._arrangeIn('oracle', this.sprites);
    await this._wait(600);
    const show = Math.min(5, n);
    for (let i = 0; i < show; i++) {
      this._logAgent(this.sprites[i], 'receives strategy');
      this.phaseProgress = (i + 1) / show;
      await this._wait(150);
    }
    if (n > show) this._logSummary('\uD83D\uDCDC', `+${n - show} more receive strategies`);
    await this._wait(350);

    /* Phase 3: BT Arena */
    if (env === 'both' || env === 'BT') await this._playArena('bt', R, rounds, n);
    /* Phase 4: GL Arena */
    if (env === 'both' || env === 'GL') await this._playArena('gl', R, rounds, n);

    /* Phase 5: Classification */
    this._setPhase('\u2464 Classification', 'Analyzing');
    this._logPhase('\uD83C\uDFDB\uFE0F', 'Phase 5 \u2014 Classification', 'Analyzing profiles');
    this.phaseProgress = 0;
    this._arrangeIn('hall', this.sprites);
    await this._wait(600);
    const C = { equilibrium:0, lying_averse:0, deception_averse:0, inference_error:0 };
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      sp.classification = sp.agent.classification || '';
      if (sp.classification) C[sp.classification]++;
      this._logAgent(sp, `\u2192 <strong>${CLS_LABELS[sp.classification] || sp.classification}</strong>`);
      this.phaseProgress = (i + 1) / n;
      if (i < 5 || i % Math.max(1, Math.floor(n / 5)) === 0) await this._wait(60);
    }
    await this._wait(300);
    this._logPhase('\uD83D\uDCCA', 'Results', '');
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    this._logSummary('\uD83D\uDD35', `Equilibrium: ${C.equilibrium} (${pct('equilibrium')})`);
    this._logSummary('\uD83D\uDFE2', `Lying-Averse: ${C.lying_averse} (${pct('lying_averse')})`);
    this._logSummary('\uD83D\uDD34', `Deception-Averse: ${C.deception_averse} (${pct('deception_averse')})`);
    this._logSummary('\uD83D\uDFE0', `Inference Error: ${C.inference_error} (${pct('inference_error')})`);
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    if (allP.length) this._logSummary('\uD83D\uDCB0', `Avg welfare: ${(allP.reduce((a,b)=>a+b,0)/allP.length).toFixed(3)}`);
    this._logSummary('\uD83C\uDFAE', `Total decisions: ${this._interactions}`);

    /* Done */
    this._setPhase('\u2705 Complete', `${n} agents \u00B7 ${this._interactions} decisions`);
    this._logPhase('\uD83C\uDF89', 'Game Complete', `${n} agents classified`);
    this.phaseProgress = 1;
    this.state = 'done';
  }

  async _playArena(type, R, rounds, n) {
    const isBT = type === 'bt';
    const stratMap = isBT ? R.btS : R.glS;
    const records = isBT ? R.bt : R.gl;
    const phaseNum = isBT ? '\u2462' : '\u2463';
    const arenaLabel = isBT ? 'BT Arena' : 'GL Arena';
    const arenaDesc = isBT ? 'Bad-type Truth-telling' : 'Good-type Lying';
    const arenaEmoji = isBT ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F';

    const agentIds = Object.keys(stratMap).map(Number);
    const arenaSprites = agentIds.map(id => this._spriteOf(id)).filter(Boolean);
    const totalAgents = arenaSprites.length;
    // Show detailed animation for a subset, fast-forward the rest
    const detailCount = Math.min(totalAgents, Math.max(3, Math.min(8, Math.ceil(n / 4))));

    this._setPhase(`${phaseNum} ${arenaLabel}`, `${totalAgents} agents`);
    this._logPhase(arenaEmoji, `${arenaLabel}`, `${totalAgents} agents \u2014 ${arenaDesc}`);
    this.phaseProgress = 0;
    this._arrangeIn(type, arenaSprites);
    await this._wait(400);

    // Each agent plays individually against the implicit Bayesian receiver
    const resultMap = {};
    records.filter((_, idx) => idx % rounds === 0).forEach(r => { resultMap[r.id] = r; });

    for (let i = 0; i < detailCount && i < arenaSprites.length; i++) {
      const sp = arenaSprites[i];
      const res = resultMap[sp.agent.id];
      if (!res) continue;
      this._setPhase(`${phaseNum} ${arenaLabel}`, `${sp.name} (${i + 1}/${totalAgents})`);
      await this._animateDecision(sp, res, type);
      this.phaseProgress = (i + 1) / totalAgents;
      await this._wait(100);
    }

    // Fast-forward remaining agents
    if (totalAgents > detailCount) {
      this._logSummary('\u26A1', `Fast-forward <strong>${totalAgents - detailCount}</strong> more ${type.toUpperCase()} decisions`);
      for (const sp of arenaSprites) {
        sp.rep = isBT ? (stratMap[sp.agent.id] ?? 0.5) : 1 - (stratMap[sp.agent.id] ?? 0.5);
      }
      this.phaseProgress = 0.9;
      await this._wait(300);
      const round1 = records.filter((_, idx) => idx % rounds === 0);
      const lies = round1.filter(r => r.isLie).length;
      this._logSummary('\uD83D\uDCCA', `${arenaLabel}: <strong>${round1.length - lies}</strong> truths, <strong>${lies}</strong> lies`);
    } else {
      for (const sp of arenaSprites) {
        sp.rep = isBT ? (stratMap[sp.agent.id] ?? 0.5) : 1 - (stratMap[sp.agent.id] ?? 0.5);
      }
    }
    this.phaseProgress = 1;
    await this._wait(400);
  }

  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  reset() {
    this.state = 'idle'; this.stopLoop();
    this.sprites = [];
    this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
    this._offsetX = 0; this._offsetY = 0; this._decisionCard = null;
  }
}
