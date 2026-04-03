/**
 * V3 Game Engine — Polished 2D game world with isometric-style buildings,
 * character sprites, textured terrain, and focused interaction panels.
 */

/* ---- Helpers ---- */
function _lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function _rand(lo, hi) { return lo + Math.random() * (hi - lo); }

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
  const pool = [...NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  agents.forEach((a, i) => { a._name = i < pool.length ? pool[i] : `Agent-${i}`; });
}

/* ---- Virtual Map ---- */
const MAP_W = 1000, MAP_H = 680;

const BUILDINGS = [
  { id:'village', x:500, y:75,  w:340, h:65,  label:'Agent Village',   icon:'\uD83C\uDFD8\uFE0F', roof:'#4ade80', wall:'#166534', wallL:'#15803d', desc:'Population Hub' },
  { id:'oracle',  x:500, y:220, w:240, h:55,  label:'Oracle Chamber',  icon:'\uD83D\uDD2E',       roof:'#c084fc', wall:'#581c87', wallL:'#7e22ce', desc:'Strategy Dispatch' },
  { id:'bt',      x:220, y:400, w:240, h:100, label:'BT Arena',        icon:'\uD83D\uDEE1\uFE0F', roof:'#60a5fa', wall:'#1e3a5f', wallL:'#2563eb', desc:'Bad-type Truth-telling' },
  { id:'gl',      x:780, y:400, w:240, h:100, label:'GL Arena',        icon:'\u2694\uFE0F',        roof:'#fbbf24', wall:'#78350f', wallL:'#b45309', desc:'Good-type Lying' },
  { id:'hall',    x:500, y:590, w:300, h:55,  label:'Hall of Records',  icon:'\uD83C\uDFDB\uFE0F', roof:'#f87171', wall:'#7f1d1d', wallL:'#b91c1c', desc:'Final Classification' },
];
const PATHS = [['village','oracle'],['oracle','bt'],['oracle','gl'],['bt','hall'],['gl','hall']];

const RISK_COLORS    = { risk_loving:'#ef4444', risk_neutral:'#f59e0b', risk_averse:'#3b82f6' };
const CLS_COLORS     = { equilibrium:'#3b82f6', lying_averse:'#22c55e', deception_averse:'#ef4444', inference_error:'#f59e0b' };
const PROVIDER_COLORS= { claude:'#f59e0b', gpt:'#22c55e', gemini:'#3b82f6', deepseek:'#8b5cf6', qwen:'#14b8a6', minimax:'#ec4899', kimi:'#ea580c', glm:'#6366f1' };
const RISK_LABELS    = { risk_loving:'Risk Lover', risk_neutral:'Risk Neutral', risk_averse:'Risk Averse' };
const CLS_LABELS     = { equilibrium:'Equilibrium', lying_averse:'Lying-Averse', deception_averse:'Deception-Averse', inference_error:'Inference Error' };
const SKIN_TONES     = ['#fdbcb4','#f1c27d','#e0ac69','#c68642','#8d5524','#ffdbac','#deb887','#d2a679'];

/* ==================================================================
   SPRITE — Character with head, body, face
   ================================================================== */
class Sprite {
  constructor(agent, x, y) {
    this.agent = agent;
    this.name = agent._name || `Agent${agent.id}`;
    this.initial = this.name[0].toUpperCase();
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.alpha = 0;
    this.rep = 0.5;
    this.classification = '';
    this.dimmed = false;
    this.glowing = false;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobActive = false;
    this.skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
    this._walkCycle = 0;
    this._moving = false;
  }

  get color() {
    if (this.classification) return CLS_COLORS[this.classification] || '#888';
    if (this.agent.aiProvider) return PROVIDER_COLORS[this.agent.aiProvider] || '#888';
    return RISK_COLORS[this.agent.riskType] || '#888';
  }
  get riskLabel() { return RISK_LABELS[this.agent.riskType] || this.agent.riskType; }
  moveTo(x, y) { this.tx = x; this.ty = y; }

  update(dt, speed) {
    const dx = this.tx - this.x, dy = this.ty - this.y;
    this._moving = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    const s = 5 * speed;
    this.x = _lerp(this.x, this.tx, s * dt);
    this.y = _lerp(this.y, this.ty, s * dt);
    if (this._moving) this._walkCycle += dt * speed * 8;
  }

  draw(ctx, s, dark, time) {
    if (this.alpha <= 0 || this.dimmed) return;
    const cx = this.x * s, cy = this.y * s;
    const bob = this.bobActive ? Math.sin(time / 200 + this.bobPhase) * 2 * s : 0;
    const H = 28 * s; // total character height
    const bodyW = 12 * s, bodyH = 14 * s;
    const headR = 7 * s;
    const legH = 6 * s;
    const baseY = cy + bob;

    ctx.globalAlpha = this.alpha;

    // Glow ring on ground
    if (this.glowing) {
      ctx.save();
      ctx.globalAlpha = this.alpha * 0.4;
      const gr = 22 * s;
      const gg = ctx.createRadialGradient(cx, baseY + 2 * s, 4 * s, cx, baseY + 2 * s, gr);
      gg.addColorStop(0, 'rgba(250,204,21,0.5)');
      gg.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.beginPath(); ctx.arc(cx, baseY + 2 * s, gr, 0, Math.PI * 2);
      ctx.fillStyle = gg; ctx.fill();
      ctx.restore();
      ctx.globalAlpha = this.alpha;
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 2 * s, bodyW * 0.7, 3 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();

    // Legs
    const legSpread = this._moving ? Math.sin(this._walkCycle) * 3 * s : 0;
    const legTop = baseY - legH;
    ctx.fillStyle = dark ? '#4b5563' : '#374151';
    // Left leg
    ctx.beginPath();
    ctx.roundRect(cx - 4 * s + legSpread, legTop, 3.5 * s, legH + 1 * s, 1.5 * s);
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.roundRect(cx + 0.5 * s - legSpread, legTop, 3.5 * s, legH + 1 * s, 1.5 * s);
    ctx.fill();

    // Body (vest/shirt)
    const bodyTop = baseY - legH - bodyH;
    const bodyGrad = ctx.createLinearGradient(cx - bodyW / 2, bodyTop, cx + bodyW / 2, bodyTop + bodyH);
    bodyGrad.addColorStop(0, this.color);
    bodyGrad.addColorStop(1, this._darken(this.color, 0.25));
    ctx.beginPath();
    ctx.roundRect(cx - bodyW / 2, bodyTop, bodyW, bodyH, [4 * s, 4 * s, 2 * s, 2 * s]);
    ctx.fillStyle = bodyGrad; ctx.fill();
    // Body outline
    ctx.strokeStyle = this._darken(this.color, 0.4);
    ctx.lineWidth = 1 * s; ctx.stroke();

    // Arms
    const armY = bodyTop + 3 * s;
    ctx.fillStyle = this.skin;
    // Left arm
    ctx.beginPath();
    ctx.roundRect(cx - bodyW / 2 - 3.5 * s, armY, 3.5 * s, 8 * s, 2 * s);
    ctx.fill();
    // Right arm
    ctx.beginPath();
    ctx.roundRect(cx + bodyW / 2, armY, 3.5 * s, 8 * s, 2 * s);
    ctx.fill();

    // Head
    const headY = bodyTop - headR * 0.6;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = this.skin; ctx.fill();
    ctx.strokeStyle = this._darken(this.skin, 0.2);
    ctx.lineWidth = 0.8 * s; ctx.stroke();

    // Face — eyes
    const eyeY = headY - 1 * s;
    const eyeSpacing = 3 * s;
    ctx.fillStyle = dark ? '#1f2937' : '#111827';
    ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, 1.2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, 1.2 * s, 0, Math.PI * 2); ctx.fill();
    // Mouth
    ctx.beginPath();
    ctx.arc(cx, headY + 2.5 * s, 2 * s, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = this._darken(this.skin, 0.35);
    ctx.lineWidth = 0.8 * s; ctx.stroke();

    // Hair (color strip on top of head)
    ctx.beginPath();
    ctx.arc(cx, headY, headR, Math.PI * 1.1, Math.PI * 1.9);
    ctx.lineTo(cx + headR * 0.6, headY - headR * 0.7);
    ctx.closePath();
    ctx.fillStyle = dark ? '#6b7280' : '#374151';
    ctx.fill();

    // Reputation bar
    const barW = 20 * s, barH = 2.5 * s;
    const barX = cx - barW / 2, barY = headY - headR - 6 * s;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 1.5 * s); ctx.fill();
    const fillW = barW * Math.max(0.02, Math.min(1, this.rep));
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 1.5 * s); ctx.fill();

    // Name tag
    ctx.font = `700 ${Math.round(7 * s)}px 'Inter','Segoe UI',sans-serif`;
    ctx.fillStyle = dark ? '#e5e7eb' : '#1f2937';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this.name, cx, baseY + 5 * s);

    // Subtitle
    const sub = this.agent.aiProvider || this.riskLabel;
    ctx.font = `500 ${Math.round(5 * s)}px 'Inter',sans-serif`;
    ctx.fillStyle = dark ? '#9ca3af' : '#6b7280';
    ctx.fillText(sub, cx, baseY + 14 * s);

    ctx.globalAlpha = 1;
  }

  _darken(hex, amt) {
    const c = hex.startsWith('#') ? hex : '#888888';
    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
    return `rgb(${Math.max(0,r*(1-amt))|0},${Math.max(0,g*(1-amt))|0},${Math.max(0,b*(1-amt))|0})`;
  }
}

/* ==================================================================
   BUBBLE — Speech/thought/event popup
   ================================================================== */
class Bubble {
  constructor(x, y, text, type, ttl) {
    this.x = x; this.y = y; this.text = text;
    this.type = type || 'speech';
    this.ttl = ttl || 2.5; this.maxTTL = this.ttl;
    this.alpha = 0;
  }
  update(dt, speed) {
    this.ttl -= dt * speed;
    const t = 1 - this.ttl / this.maxTTL;
    if (t < 0.1) this.alpha = t / 0.1;
    else if (this.ttl < 0.4) this.alpha = this.ttl / 0.4;
    else this.alpha = 1;
    this.y -= 4 * dt * speed;
  }
  get alive() { return this.ttl > 0; }
  draw(ctx, s, dark) {
    if (this.alpha <= 0) return;
    const sx = this.x * s, sy = this.y * s;
    ctx.globalAlpha = this.alpha * 0.95;
    const fs = Math.round(9 * s);
    ctx.font = `600 ${fs}px 'Inter',sans-serif`;
    const tw = ctx.measureText(this.text).width;
    const pad = 7 * s, h = fs + pad * 2, w = tw + pad * 2;
    const rx = sx - w / 2, ry = sy - h, rad = 5 * s;

    const colors = {
      thought: { bg: dark ? '#7c3aed' : '#f3e8ff', border: dark ? '#a78bfa' : '#c084fc', text: dark ? '#f5f3ff' : '#6d28d9' },
      event:   { bg: dark ? '#dc2626' : '#fef2f2', border: dark ? '#f87171' : '#fca5a5', text: dark ? '#fef2f2' : '#b91c1c' },
      success: { bg: dark ? '#16a34a' : '#f0fdf4', border: dark ? '#4ade80' : '#86efac', text: dark ? '#f0fdf4' : '#15803d' },
      speech:  { bg: dark ? '#1f2937' : '#ffffff', border: dark ? '#4b5563' : '#d1d5db', text: dark ? '#f3f4f6' : '#111827' },
    };
    const c = colors[this.type] || colors.speech;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 6 * s; ctx.shadowOffsetY = 2 * s;
    ctx.beginPath(); ctx.roundRect(rx, ry, w, h, rad);
    ctx.fillStyle = c.bg; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = c.border; ctx.lineWidth = 1 * s; ctx.stroke();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(sx - 4 * s, ry + h); ctx.lineTo(sx, ry + h + 5 * s); ctx.lineTo(sx + 4 * s, ry + h);
    ctx.closePath(); ctx.fillStyle = c.bg; ctx.fill();

    ctx.fillStyle = c.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.text, sx, ry + h / 2);
    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   PARTICLE — Burst effect
   ================================================================== */
class Particle {
  constructor(x, y, color, ttl) {
    this.x = x; this.y = y;
    this.vx = _rand(-40, 40); this.vy = _rand(-55, -10);
    this.color = color; this.ttl = ttl || 1; this.maxTTL = this.ttl;
    this.r = _rand(1.5, 4);
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 50 * dt; this.ttl -= dt; }
  get alive() { return this.ttl > 0; }
  draw(ctx, s) {
    ctx.globalAlpha = this.ttl / this.maxTTL;
    ctx.beginPath(); ctx.arc(this.x * s, this.y * s, this.r * s, 0, Math.PI * 2);
    ctx.fillStyle = this.color; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   CONNECTOR — Dashed line between sprites
   ================================================================== */
class Connector {
  constructor(from, to, color, ttl) {
    this.from = from; this.to = to;
    this.color = color || '#888'; this.ttl = ttl || 3; this.maxTTL = this.ttl;
    this.dashOff = 0;
  }
  update(dt, speed) { this.ttl -= dt * speed; this.dashOff += 35 * dt * speed; }
  get alive() { return this.ttl > 0; }
  draw(ctx, s) {
    const a = Math.min(1, this.ttl / (this.maxTTL * 0.25));
    ctx.globalAlpha = a * 0.45;
    ctx.setLineDash([5 * s, 4 * s]);
    ctx.lineDashOffset = this.dashOff * s;
    ctx.strokeStyle = this.color; ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(this.from.x * s, this.from.y * s);
    ctx.lineTo(this.to.x * s, this.to.y * s);
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   GAME WORLD
   ================================================================== */
class GameWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = []; this.bubbles = []; this.particles = []; this.connectors = [];
    this.phase = 'idle'; this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
    this.speed = 1; this.state = 'idle';
    this._running = false; this._raf = null; this._lastTime = 0; this._time = 0;
    this._buildingMap = {}; BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
    this.results = null; this.agents = null;
    this.onPhase = null; this.onLog = null;
    this._scale = 1; this._offsetX = 0; this._offsetY = 0; this._interactions = 0;
    // Interaction panel state
    this._interactionPanel = null; // {sender, receiver, step, result, arenaId}
    // Drag
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
      const d = devicePixelRatio;
      this._offsetX = this._dragOX + (e.clientX - this._dragSX) * d;
      this._offsetY = this._dragOY + (e.clientY - this._dragSY) * d;
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
      const d = devicePixelRatio;
      this._offsetX = this._dragOX + (t.clientX - this._dragSX) * d;
      this._offsetY = this._dragOY + (t.clientY - this._dragSY) * d;
      if (!this._running) this.draw();
    }, { passive: true });
    c.addEventListener('touchend', () => { this._dragging = false; }, { passive: true });
    c.addEventListener('dblclick', () => { this._offsetX = 0; this._offsetY = 0; if (!this._running) this.draw(); });
  }

  resize() {
    const c = this.canvas;
    const cssW = c.clientWidth || c.parentElement?.clientWidth || 700;
    const aspect = MAP_H / MAP_W;
    const cssH = Math.max(380, Math.round(cssW * aspect));
    c.width = cssW * devicePixelRatio;
    c.height = cssH * devicePixelRatio;
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    this._scale = Math.min(c.width / MAP_W, c.height / MAP_H);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  init(agents, results) {
    this.agents = agents; this.results = results;
    this.sprites = []; this.bubbles = []; this.particles = []; this.connectors = [];
    this.phase = 'idle'; this.phaseLabel = ''; this.phaseSub = '';
    this.phaseProgress = 0; this._interactions = 0; this._interactionPanel = null;
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
     DRAWING
     ================================================================ */
  draw() {
    const ctx = this.ctx, s = this._scale;
    const dark = typeof _isDark === 'function' && _isDark();
    const W = this.canvas.width, H = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Background — grass gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { bg.addColorStop(0, '#0c1a0c'); bg.addColorStop(0.4, '#0a150a'); bg.addColorStop(1, '#081008'); }
    else { bg.addColorStop(0, '#a7d9a0'); bg.addColorStop(0.4, '#8fce85'); bg.addColorStop(1, '#7ac470'); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Grass texture dots
    const dotC = dark ? 'rgba(80,120,60,0.08)' : 'rgba(60,100,40,0.06)';
    ctx.fillStyle = dotC;
    for (let i = 0; i < 200; i++) {
      const gx = (i * 137.5) % W, gy = (i * 97.3 + 50) % H;
      ctx.beginPath(); ctx.arc(gx, gy, 1.5 * s * (0.5 + Math.sin(i) * 0.3), 0, Math.PI * 2); ctx.fill();
    }

    // World transform
    const cx = (W - MAP_W * s) / 2 + this._offsetX;
    const cy = (H - MAP_H * s) / 2 + this._offsetY;
    ctx.setTransform(1, 0, 0, 1, cx, cy);

    this._drawPaths(ctx, s, dark);
    this._drawBuildings(ctx, s, dark);
    for (const cn of this.connectors) cn.draw(ctx, s);
    for (const p of this.particles) p.draw(ctx, s);
    const sorted = [...this.sprites].sort((a, b) => a.y - b.y);
    for (const sp of sorted) sp.draw(ctx, s, dark, this._time);
    for (const b of this.bubbles) b.draw(ctx, s, dark);

    // Interaction panel (world-space)
    if (this._interactionPanel) this._drawInteractionPanel(ctx, s, dark);

    // Banner (screen-space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawBanner(ctx, s, dark, W, H);
  }

  _drawPaths(ctx, s, dark) {
    const pathW = 18 * s;
    ctx.lineCap = 'round';
    for (const [fromId, toId] of PATHS) {
      const a = this._buildingMap[fromId], b = this._buildingMap[toId];
      // Path shadow
      ctx.strokeStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = pathW + 2 * s;
      ctx.beginPath(); ctx.moveTo(a.x * s, a.y * s); ctx.lineTo(b.x * s, b.y * s); ctx.stroke();
      // Path fill (stone/dirt)
      ctx.strokeStyle = dark ? '#2a2a1f' : '#d4c9a8';
      ctx.lineWidth = pathW;
      ctx.beginPath(); ctx.moveTo(a.x * s, a.y * s); ctx.lineTo(b.x * s, b.y * s); ctx.stroke();
      // Center line
      ctx.setLineDash([4 * s, 6 * s]);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(a.x * s, a.y * s); ctx.lineTo(b.x * s, b.y * s); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawBuildings(ctx, s, dark) {
    for (const b of BUILDINGS) {
      const bx = (b.x - b.w / 2) * s, by = (b.y - b.h / 2) * s;
      const bw = b.w * s, bh = b.h * s;
      const roofH = 16 * s;
      const rad = 4 * s;

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.roundRect(bx + 4 * s, by + 4 * s, bw, bh, rad); ctx.fill();

      // Main wall
      const wGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      wGrad.addColorStop(0, dark ? b.wall : '#f8fafc');
      wGrad.addColorStop(1, dark ? this._darkenC(b.wall, 0.3) : '#e2e8f0');
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, rad);
      ctx.fillStyle = wGrad; ctx.fill();
      ctx.strokeStyle = dark ? b.wallL : '#cbd5e1'; ctx.lineWidth = 1.5 * s; ctx.stroke();

      // Roof
      ctx.beginPath();
      ctx.moveTo(bx - 6 * s, by);
      ctx.lineTo(b.x * s, by - roofH);
      ctx.lineTo(bx + bw + 6 * s, by);
      ctx.closePath();
      const rGrad = ctx.createLinearGradient(bx, by - roofH, bx, by);
      rGrad.addColorStop(0, b.roof);
      rGrad.addColorStop(1, this._darkenC(b.roof, 0.2));
      ctx.fillStyle = rGrad; ctx.fill();
      ctx.strokeStyle = this._darkenC(b.roof, 0.35); ctx.lineWidth = 1 * s; ctx.stroke();

      // Windows
      const winCount = Math.max(2, Math.floor(b.w / 50));
      const winW = 10 * s, winH = 10 * s;
      const winGap = (bw - winCount * winW) / (winCount + 1);
      const winY = by + bh * 0.3;
      for (let wi = 0; wi < winCount; wi++) {
        const wx = bx + winGap + wi * (winW + winGap);
        ctx.fillStyle = dark ? 'rgba(250,204,21,0.2)' : 'rgba(147,197,253,0.4)';
        ctx.beginPath(); ctx.roundRect(wx, winY, winW, winH, 1.5 * s); ctx.fill();
        ctx.strokeStyle = dark ? 'rgba(250,204,21,0.3)' : 'rgba(100,150,220,0.3)';
        ctx.lineWidth = 0.5 * s; ctx.stroke();
        // Window cross
        ctx.strokeStyle = dark ? 'rgba(250,204,21,0.15)' : 'rgba(100,150,220,0.2)';
        ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx, winY + winH / 2); ctx.lineTo(wx + winW, winY + winH / 2); ctx.stroke();
      }

      // Door
      const doorW = 10 * s, doorH = 14 * s;
      const doorX = b.x * s - doorW / 2, doorY = by + bh - doorH;
      ctx.fillStyle = dark ? '#78350f' : '#92400e';
      ctx.beginPath(); ctx.roundRect(doorX, doorY, doorW, doorH, [2 * s, 2 * s, 0, 0]); ctx.fill();
      // Door knob
      ctx.fillStyle = dark ? '#fbbf24' : '#d97706';
      ctx.beginPath(); ctx.arc(doorX + doorW * 0.75, doorY + doorH * 0.55, 1.2 * s, 0, Math.PI * 2); ctx.fill();

      // Icon on roof
      ctx.font = `${Math.round(16 * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, b.x * s, by - roofH * 0.35);

      // Label
      ctx.font = `700 ${Math.round(9 * s)}px 'Inter','Segoe UI',sans-serif`;
      ctx.fillStyle = dark ? '#f3f4f6' : '#1e293b';
      ctx.fillText(b.label, b.x * s, by + bh + 12 * s);
      // Description
      ctx.font = `400 ${Math.round(6 * s)}px 'Inter',sans-serif`;
      ctx.fillStyle = dark ? '#9ca3af' : '#64748b';
      ctx.fillText(b.desc, b.x * s, by + bh + 21 * s);
    }
  }

  _drawInteractionPanel(ctx, s, dark) {
    const p = this._interactionPanel;
    if (!p || !p.sender || !p.receiver) return;
    const arena = this._buildingMap[p.arenaId];
    const panelW = 260 * s, panelH = 50 * s;
    const px = arena.x * s - panelW / 2, py = (arena.y + 70) * s;

    // Panel background
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10 * s; ctx.shadowOffsetY = 3 * s;
    ctx.fillStyle = dark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 6 * s); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = dark ? '#374151' : '#e5e7eb'; ctx.lineWidth = 1 * s; ctx.stroke();

    const fs = Math.round(8 * s);
    ctx.textBaseline = 'middle';

    // Sender name (left)
    ctx.font = `700 ${fs}px 'Inter',sans-serif`;
    ctx.fillStyle = p.sender.color; ctx.textAlign = 'left';
    ctx.fillText(p.sender.name, px + 8 * s, py + 12 * s);

    // Arrow
    ctx.fillStyle = dark ? '#9ca3af' : '#6b7280'; ctx.textAlign = 'center';
    ctx.fillText('\u2192', arena.x * s, py + 12 * s);

    // Receiver name (right)
    ctx.font = `700 ${fs}px 'Inter',sans-serif`;
    ctx.fillStyle = p.receiver.color; ctx.textAlign = 'right';
    ctx.fillText(p.receiver.name, px + panelW - 8 * s, py + 12 * s);

    // Info line
    if (p.info) {
      ctx.font = `600 ${Math.round(7 * s)}px 'JetBrains Mono','Fira Code',monospace`;
      ctx.fillStyle = p.infoColor || (dark ? '#d1d5db' : '#374151');
      ctx.textAlign = 'center';
      ctx.fillText(p.info, arena.x * s, py + 32 * s);
    }
  }

  _drawBanner(ctx, s, dark, W, H) {
    if (!this.phaseLabel) return;
    const bH = 36 * s;
    ctx.fillStyle = dark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.93)';
    ctx.fillRect(0, 0, W, bH);
    ctx.strokeStyle = dark ? '#374151' : '#e5e7eb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, bH); ctx.lineTo(W, bH); ctx.stroke();

    ctx.font = `800 ${Math.round(11 * s)}px 'Inter',sans-serif`;
    ctx.fillStyle = dark ? '#f3f4f6' : '#111827';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(this.phaseLabel, 14 * s, bH * 0.5);

    if (this.phaseSub) {
      ctx.font = `500 ${Math.round(8 * s)}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = dark ? '#9ca3af' : '#6b7280';
      ctx.textAlign = 'right';
      ctx.fillText(this.phaseSub, W - 14 * s, bH * 0.5);
    }

    if (this.phaseProgress > 0 && this.phaseProgress < 1) {
      const pGrad = ctx.createLinearGradient(0, 0, W * this.phaseProgress, 0);
      pGrad.addColorStop(0, '#22c55e'); pGrad.addColorStop(1, '#14b8a6');
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, bH - 2 * s, W * this.phaseProgress, 2 * s);
    }
  }

  _darkenC(hex, amt) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.max(0,r*(1-amt))|0},${Math.max(0,g*(1-amt))|0},${Math.max(0,b*(1-amt))|0})`;
  }

  /* ================================================================
     ANIMATION LOOP
     ================================================================ */
  _loop(ts) {
    if (!this._lastTime) this._lastTime = ts;
    const dt = Math.min(0.1, (ts - this._lastTime) / 1000);
    this._lastTime = ts; this._time = ts;
    for (const sp of this.sprites) sp.update(dt, this.speed);
    for (const b of this.bubbles) b.update(dt, this.speed);
    this.bubbles = this.bubbles.filter(b => b.alive);
    for (const c of this.connectors) c.update(dt, this.speed);
    this.connectors = this.connectors.filter(c => c.alive);
    for (const p of this.particles) p.update(dt * this.speed);
    this.particles = this.particles.filter(p => p.alive);
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
  _addBubble(x, y, text, type, ttl) { this.bubbles.push(new Bubble(x, y, text, type || 'speech', ttl || 2)); }
  _burst(x, y, color, n) { for (let i = 0; i < (n || 6); i++) this.particles.push(new Particle(x, y, color)); }
  _buildingCenter(id) { const b = this._buildingMap[id]; return { x: b.x, y: b.y }; }
  _spriteOf(id) { return this.sprites.find(sp => sp.agent.id === id); }

  _arrangeIn(buildingId, list) {
    const b = this._buildingMap[buildingId];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.8)));
    list.forEach((sp, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      sp.moveTo(b.x - (cols - 1) * 15 + col * 30, b.y - 8 + row * 26);
    });
  }

  _createPairs(ids) {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const pairs = [];
    for (let i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]);
    return pairs;
  }

  /* ================================================================
     LOG HELPERS
     ================================================================ */
  _logPhase(icon, title, desc) {
    this._log(`<div class="v3-le-phase"><span class="v3-le-icon">${icon}</span><strong>${title}</strong>${desc ? `<span class="v3-le-desc"> \u2014 ${desc}</span>` : ''}</div>`);
  }
  _logAgent(sp, text) {
    this._log(`<div class="v3-le-agent"><span class="v3-le-dot" style="background:${sp.color}"></span><strong>${sp.name}</strong> <span class="v3-le-text">${text}</span></div>`);
  }
  _logMatch(sender, receiver, result) {
    const lieTag = result.isLie ? '<span class="v3-tag v3-tag-lie">LIE</span>' : '<span class="v3-tag v3-tag-truth">TRUTH</span>';
    const decTag = result.isDec ? ' <span class="v3-tag v3-tag-dec">DECEPTIVE</span>' : '';
    this._log(
      `<div class="v3-le-match"><div class="v3-le-pair"><span class="v3-le-dot" style="background:${sender.color}"></span><strong>${sender.name}</strong>` +
      `<span class="v3-le-arrow">\u2192</span><span class="v3-le-dot" style="background:${receiver.color}"></span><strong>${receiver.name}</strong> ${lieTag}${decTag}</div>` +
      `<div class="v3-le-detail">\u03B8=${result.s1} m=${result.sent} a=${result.a1.toFixed(2)} \u03BB=${result.lambda.toFixed(2)} pay=${result.sp.toFixed(2)}</div></div>`
    );
  }
  _logSummary(icon, text) {
    this._log(`<div class="v3-le-summary"><span class="v3-le-icon">${icon}</span>${text}</div>`);
  }

  /* ================================================================
     INTERACTION ANIMATION — with info panel
     ================================================================ */
  async _animateInteraction(senderSp, receiverSp, result, arenaId) {
    const arena = this._buildingCenter(arenaId);
    const sX = arena.x - 60, rX = arena.x + 60, aY = arena.y - 10;

    // Hide others, spotlight pair
    for (const sp of this.sprites) sp.dimmed = (sp !== senderSp && sp !== receiverSp);
    this.bubbles = []; this.particles = []; this.connectors = [];
    senderSp.glowing = true; receiverSp.glowing = true;
    senderSp.bobActive = true; receiverSp.bobActive = true;

    senderSp.moveTo(sX, aY); receiverSp.moveTo(rX, aY);
    this.connectors.push(new Connector(senderSp, receiverSp, '#f59e0b', 8));
    this._interactionPanel = { sender: senderSp, receiver: receiverSp, arenaId, info: '', infoColor: '' };
    await this._wait(400);

    // Step 1: State
    this._interactionPanel.info = `\u03B8 = ${result.s1}  (state revealed)`;
    this._interactionPanel.infoColor = '';
    await this._wait(550);

    // Step 2: Message
    const dark = typeof _isDark === 'function' && _isDark();
    if (result.isLie) {
      this._interactionPanel.info = `m = ${result.sent}  \u2022  LIE`;
      this._interactionPanel.infoColor = '#ef4444';
      this._burst(senderSp.x, senderSp.y - 15, '#ef4444', 5);
    } else {
      this._interactionPanel.info = `m = ${result.sent}  \u2022  TRUTH`;
      this._interactionPanel.infoColor = '#22c55e';
    }
    await this._wait(550);

    // Step 3: Action + belief
    this._interactionPanel.info = `a = ${result.a1.toFixed(2)}   \u03BB = ${result.lambda.toFixed(2)}   pay = ${result.sp.toFixed(2)}`;
    this._interactionPanel.infoColor = '';
    await this._wait(550);

    // Cleanup
    this._interactionPanel = null;
    senderSp.rep = result.strat ?? 0.5;
    this._logMatch(senderSp, receiverSp, result);
    this._interactions++;
    senderSp.glowing = false; receiverSp.glowing = false;
    senderSp.bobActive = false; receiverSp.bobActive = false;
    for (const sp of this.sprites) sp.dimmed = false;
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
    this._setPhase('\u2460 Populating Village', `${n} agents`);
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
    this._setPhase('\u2461 Oracle Chamber', 'Dispatching strategies');
    this._logPhase('\uD83D\uDD2E', 'Phase 2 \u2014 Oracle', 'Generating strategies');
    this.phaseProgress = 0;
    this._arrangeIn('oracle', this.sprites);
    await this._wait(600);
    const show = Math.min(5, n);
    for (let i = 0; i < show; i++) {
      this._logAgent(this.sprites[i], 'receives prompt');
      this.phaseProgress = (i + 1) / show;
      await this._wait(150);
    }
    if (n > show) this._logSummary('\uD83D\uDCDC', `+${n - show} more receive prompts`);
    await this._wait(350);

    /* Phase 3: BT Arena */
    if (env === 'both' || env === 'BT') await this._playArena('bt', R, rounds, n);
    /* Phase 4: GL Arena */
    if (env === 'both' || env === 'GL') await this._playArena('gl', R, rounds, n);

    /* Phase 5: Classification */
    this._setPhase('\u2464 Hall of Records', 'Classification');
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
    this._logSummary('\uD83C\uDFAE', `Total interactions: ${this._interactions}`);

    /* Done */
    this._setPhase('\uD83C\uDF89 Complete', `${n} agents \u00B7 ${this._interactions} interactions`);
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
    const pairs = this._createPairs(agentIds);
    const totalPairs = pairs.length;
    const detailCount = Math.min(totalPairs, Math.max(3, Math.min(10, Math.ceil(n / 3))));

    this._setPhase(`${phaseNum} ${arenaLabel}`, `${totalPairs} matches`);
    this._logPhase(arenaEmoji, `${arenaLabel}`, `${totalPairs} matches \u2014 ${arenaDesc}`);
    this.phaseProgress = 0;
    this._arrangeIn(type, arenaSprites);
    await this._wait(400);

    const resultMap = {};
    records.filter((_, idx) => idx % rounds === 0).forEach(r => resultMap[r.id] = r);

    for (let pi = 0; pi < detailCount && pi < pairs.length; pi++) {
      const [sId, rId] = pairs[pi];
      const sSp = this._spriteOf(sId), rSp = this._spriteOf(rId);
      const res = resultMap[sId];
      if (!sSp || !rSp || !res) continue;
      this._setPhase(`${phaseNum} ${arenaLabel}`, `Match ${pi+1}/${totalPairs}: ${sSp.name} vs ${rSp.name}`);
      await this._animateInteraction(sSp, rSp, res, type);
      this.phaseProgress = (pi + 1) / totalPairs;
      await this._wait(120);
    }

    if (totalPairs > detailCount) {
      this._logSummary('\u26A1', `Fast-forward <strong>${totalPairs - detailCount}</strong> more ${type.toUpperCase()} matches`);
      for (const sp of arenaSprites) sp.rep = isBT ? (stratMap[sp.agent.id] ?? 0.5) : 1 - (stratMap[sp.agent.id] ?? 0.5);
      this.phaseProgress = 0.9;
      await this._wait(300);
      const round1 = records.filter((_, idx) => idx % rounds === 0);
      const lies = round1.filter(r => r.isLie).length;
      this._logSummary('\uD83D\uDCCA', `${arenaLabel}: <strong>${round1.length - lies}</strong> truths, <strong>${lies}</strong> lies`);
    } else {
      for (const sp of arenaSprites) sp.rep = isBT ? (stratMap[sp.agent.id] ?? 0.5) : 1 - (stratMap[sp.agent.id] ?? 0.5);
    }
    this.phaseProgress = 1;
    await this._wait(400);
  }

  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  reset() {
    this.state = 'idle'; this.stopLoop();
    this.sprites = []; this.bubbles = []; this.particles = []; this.connectors = [];
    this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
    this._offsetX = 0; this._offsetY = 0; this._interactionPanel = null;
  }
}
