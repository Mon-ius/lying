/**
 * V3 Game Engine — Commercial-grade Stanford-Town-style 2D game world.
 * Canvas rendering with named agents, detailed per-pair interactions, rich animations.
 */

/* ---- Helpers ---- */
function _lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function _rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function _lightenHex(hex, amt) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + (255 - r) * amt) | 0},${Math.min(255, g + (255 - g) * amt) | 0},${Math.min(255, b + (255 - b) * amt) | 0})`;
}

/* ---- Diverse Name Pool (130 names) ---- */
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
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  agents.forEach((a, i) => { a._name = i < pool.length ? pool[i] : `Agent-${i}`; });
}

/* ---- Map Definition (virtual 1000x700) ---- */
const MAP_W = 1000, MAP_H = 700;

const BUILDINGS = [
  { id:'village', x:500, y:80,  w:360, h:70,  label:'Agent Village',    emoji:'\uD83C\uDFD8\uFE0F', fill:'#d5e8d4', stroke:'#82b366', darkFill:'#1f3d1f', darkStroke:'#5a9a50', desc:'Population hub' },
  { id:'oracle',  x:500, y:230, w:250, h:60,  label:'Oracle Chamber',   emoji:'\uD83D\uDD2E',       fill:'#e1d5e7', stroke:'#9673a6', darkFill:'#2a1f35', darkStroke:'#8060a8', desc:'Strategy dispatch' },
  { id:'bt',      x:240, y:430, w:250, h:110, label:'BT Arena',         emoji:'\uD83D\uDEE1\uFE0F', fill:'#dae8fc', stroke:'#6c8ebf', darkFill:'#1a2540', darkStroke:'#3d6eaf', desc:'Bad-type Truth-telling' },
  { id:'gl',      x:760, y:430, w:250, h:110, label:'GL Arena',         emoji:'\u2694\uFE0F',        fill:'#fff2cc', stroke:'#d6b656', darkFill:'#2d2614', darkStroke:'#b8962e', desc:'Good-type Lying' },
  { id:'hall',    x:500, y:620, w:320, h:60,  label:'Hall of Records',  emoji:'\uD83C\uDFDB\uFE0F', fill:'#f8cecc', stroke:'#b85450', darkFill:'#2d1b1b', darkStroke:'#c06060', desc:'Final classification' },
];

const PATHS = [
  ['village','oracle'], ['oracle','bt'], ['oracle','gl'], ['bt','hall'], ['gl','hall'],
];

const RISK_COLORS    = { risk_loving:'#dc2626', risk_neutral:'#d97706', risk_averse:'#2563eb' };
const CLS_COLORS     = { equilibrium:'#2563eb', lying_averse:'#16a34a', deception_averse:'#dc2626', inference_error:'#d97706' };
const PROVIDER_COLORS= { claude:'#d97706', gpt:'#16a34a', gemini:'#2563eb', deepseek:'#7c3aed', qwen:'#0d9488', minimax:'#be185d', kimi:'#c2410c', glm:'#4338ca' };
const RISK_LABELS    = { risk_loving:'Risk Lover', risk_neutral:'Risk Neutral', risk_averse:'Risk Averse' };
const CLS_LABELS     = { equilibrium:'Equilibrium', lying_averse:'Lying-Averse', deception_averse:'Deception-Averse', inference_error:'Inference Error' };

/* ==================================================================
   SPRITE — Agent visual representation
   ================================================================== */
class Sprite {
  constructor(agent, x, y) {
    this.agent = agent;
    this.name = agent._name || `Agent${agent.id}`;
    this.initial = this.name[0].toUpperCase();
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.radius = 13;
    this.alpha = 0;
    this.rep = 0.5;
    this.classification = '';
    this.dimmed = false;
    this.glowing = false;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobActive = false;
    this.facing = 1;
    this._prevX = x;
    this._trail = [];
  }

  get color() {
    if (this.classification) return CLS_COLORS[this.classification] || '#888';
    if (this.agent.aiProvider) return PROVIDER_COLORS[this.agent.aiProvider] || '#888';
    return RISK_COLORS[this.agent.riskType] || '#888';
  }

  get riskLabel() { return RISK_LABELS[this.agent.riskType] || this.agent.riskType; }

  moveTo(x, y) { this.tx = x; this.ty = y; }

  update(dt, speed) {
    this._prevX = this.x;
    const s = 5 * speed;
    this.x = _lerp(this.x, this.tx, s * dt);
    this.y = _lerp(this.y, this.ty, s * dt);
    if (Math.abs(this.x - this._prevX) > 0.05) this.facing = this.x > this._prevX ? 1 : -1;
    // Movement trail (throttled)
    if ((Math.abs(this.x - this.tx) > 2 || Math.abs(this.y - this.ty) > 2) && Math.random() < 0.25) {
      this._trail.push({ x: this.x, y: this.y, a: 0.3 });
      if (this._trail.length > 8) this._trail.shift();
    }
    this._trail = this._trail.filter(t => { t.a -= dt * 2; return t.a > 0; });
  }

  draw(ctx, scale, dark, time) {
    if (this.alpha <= 0) return;
    const sx = this.x * scale, r = this.radius * scale;
    const bob = this.bobActive ? Math.sin(time / 180 + this.bobPhase) * 2.5 * scale : 0;
    const cy = this.y * scale + bob;
    const a = this.dimmed ? this.alpha * 0.18 : this.alpha;
    ctx.globalAlpha = a;

    // Trail
    for (const t of this._trail) {
      ctx.globalAlpha = t.a * a;
      ctx.beginPath(); ctx.arc(t.x * scale, t.y * scale, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = this.color; ctx.fill();
    }
    ctx.globalAlpha = a;

    // Glow
    if (this.glowing) {
      const gr = r + 7 * scale;
      const gg = ctx.createRadialGradient(sx, cy, r, sx, cy, gr);
      gg.addColorStop(0, 'rgba(255,215,0,0.45)');
      gg.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.beginPath(); ctx.arc(sx, cy, gr, 0, Math.PI * 2);
      ctx.fillStyle = gg; ctx.fill();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(sx, this.y * scale + r * 0.95, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fill();

    // Body — gradient circle
    const grad = ctx.createRadialGradient(sx - r * 0.3, cy - r * 0.3, r * 0.05, sx, cy, r);
    grad.addColorStop(0, _lightenHex(this.color, 0.4));
    grad.addColorStop(1, this.color);
    ctx.beginPath(); ctx.arc(sx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5 * scale; ctx.stroke();

    // Classification inner ring
    if (this.classification) {
      ctx.beginPath(); ctx.arc(sx, cy, r - 2.5 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = CLS_COLORS[this.classification] || '#888';
      ctx.lineWidth = 2 * scale; ctx.stroke();
    }

    // Initial letter
    ctx.save();
    ctx.font = `800 ${Math.round(11 * scale)}px 'Inter','Segoe UI',sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 2 * scale;
    ctx.fillText(this.initial, sx, cy + 0.5 * scale);
    ctx.restore();

    // Reputation bar
    const bw = r * 2.6, bh = 3.5 * scale;
    const bx = sx - bw / 2, by = cy - r - bh - 5 * scale;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 2 * scale);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'; ctx.fill();
    const fillW = bw * Math.max(0.02, Math.min(1, this.rep));
    ctx.beginPath(); ctx.roundRect(bx, by, fillW, bh, 2 * scale);
    ctx.fillStyle = this.color; ctx.fill();

    // Name tag
    ctx.font = `700 ${Math.round(7.5 * scale)}px 'Inter','Segoe UI',sans-serif`;
    ctx.fillStyle = dark ? '#d0d7de' : '#24292f';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this.name, sx, cy + r + 4 * scale);

    // Subtitle (risk type or provider)
    const sub = this.agent.aiProvider || this.riskLabel;
    ctx.font = `500 ${Math.round(5.5 * scale)}px 'Inter',sans-serif`;
    ctx.fillStyle = dark ? '#8b949e' : '#6b7080';
    ctx.fillText(sub, sx, cy + r + 14 * scale);

    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   BUBBLE — Speech / thought / event / success
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
    if (t < 0.12) this.alpha = t / 0.12;
    else if (this.ttl < 0.5) this.alpha = this.ttl / 0.5;
    else this.alpha = 1;
    this.y -= 6 * dt * speed;
  }
  get alive() { return this.ttl > 0; }
  draw(ctx, scale, dark) {
    if (this.alpha <= 0) return;
    const sx = this.x * scale, sy = this.y * scale;
    ctx.globalAlpha = this.alpha;
    const fs = Math.round(10 * scale);
    ctx.font = `600 ${fs}px 'Inter',sans-serif`;
    const tw = ctx.measureText(this.text).width;
    const pad = 8 * scale, h = fs + pad * 2, w = tw + pad * 2;
    const rx = sx - w / 2, ry = sy - h, rad = 6 * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 2 * scale;

    const styles = {
      thought: { bg: dark ? 'rgba(124,58,237,0.92)' : 'rgba(124,58,237,0.1)',  border: dark ? '#9f7aea' : 'rgba(124,58,237,0.4)', text: dark ? '#e9d5ff' : '#7c3aed' },
      event:   { bg: dark ? 'rgba(220,38,38,0.92)' : 'rgba(220,38,38,0.1)',   border: dark ? '#f87171' : 'rgba(220,38,38,0.4)',  text: dark ? '#fecaca' : '#dc2626' },
      success: { bg: dark ? 'rgba(22,163,74,0.92)' : 'rgba(22,163,74,0.1)',   border: dark ? '#4ade80' : 'rgba(22,163,74,0.4)',  text: dark ? '#bbf7d0' : '#16a34a' },
      speech:  { bg: dark ? 'rgba(30,36,46,0.95)' : 'rgba(255,255,255,0.97)', border: dark ? '#444c56' : '#d0d7de',               text: dark ? '#e6edf3' : '#1a1d23' },
    };
    const s = styles[this.type] || styles.speech;

    ctx.beginPath(); ctx.roundRect(rx, ry, w, h, rad);
    ctx.fillStyle = s.bg; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = s.border; ctx.lineWidth = 1.2 * scale; ctx.stroke();

    // Pointer
    ctx.beginPath();
    ctx.moveTo(sx - 5 * scale, ry + h);
    ctx.lineTo(sx, ry + h + 6 * scale);
    ctx.lineTo(sx + 5 * scale, ry + h);
    ctx.closePath(); ctx.fillStyle = s.bg; ctx.fill();

    ctx.fillStyle = s.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    this.vx = _rand(-45, 45); this.vy = _rand(-65, -10);
    this.color = color; this.ttl = ttl || 1.2; this.maxTTL = this.ttl;
    this.r = _rand(2, 5);
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 55 * dt; this.ttl -= dt; }
  get alive() { return this.ttl > 0; }
  draw(ctx, scale) {
    ctx.globalAlpha = this.ttl / this.maxTTL;
    ctx.beginPath(); ctx.arc(this.x * scale, this.y * scale, this.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = this.color; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ==================================================================
   CONNECTOR — Animated dashed line between two sprites
   ================================================================== */
class Connector {
  constructor(from, to, color, ttl) {
    this.from = from; this.to = to;
    this.color = color || '#888'; this.ttl = ttl || 3; this.maxTTL = this.ttl;
    this.dashOff = 0;
  }
  update(dt, speed) { this.ttl -= dt * speed; this.dashOff += 40 * dt * speed; }
  get alive() { return this.ttl > 0; }
  draw(ctx, scale) {
    const a = Math.min(1, this.ttl / (this.maxTTL * 0.25));
    ctx.globalAlpha = a * 0.5;
    ctx.setLineDash([5 * scale, 3 * scale]);
    ctx.lineDashOffset = this.dashOff * scale;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(this.from.x * scale, this.from.y * scale);
    ctx.lineTo(this.to.x * scale, this.to.y * scale);
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
    this.sprites = [];
    this.bubbles = [];
    this.particles = [];
    this.connectors = [];
    this.phase = 'idle';
    this.phaseLabel = '';
    this.phaseSub = '';
    this.phaseProgress = 0;
    this.speed = 1;
    this.state = 'idle';
    this._running = false;
    this._raf = null;
    this._lastTime = 0;
    this._time = 0;
    this._buildingMap = {};
    BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
    this.results = null;
    this.agents = null;
    this.onPhase = null;
    this.onLog = null;
    this._scale = 1;
    this._interactions = 0;
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = Math.max(500, Math.min(750, w * 0.65));
    this.canvas.width = w * devicePixelRatio;
    this.canvas.height = h * devicePixelRatio;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._scale = this.canvas.width / MAP_W;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---- Init from simulation results ---- */
  init(agents, results) {
    this.agents = agents;
    this.results = results;
    this.sprites = []; this.bubbles = []; this.particles = []; this.connectors = [];
    this.phase = 'idle'; this.phaseLabel = ''; this.phaseSub = '';
    this.phaseProgress = 0; this._interactions = 0;

    _assignNames(agents);

    const v = this._buildingMap.village;
    const cols = Math.ceil(Math.sqrt(agents.length * 1.8));
    agents.forEach((a, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const cx = v.x - (cols - 1) * 16 + col * 32;
      const cy = v.y - 8 + row * 28;
      const sp = new Sprite(a, cx, cy);
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
    const time = this._time;
    ctx.clearRect(0, 0, W, H);

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { grad.addColorStop(0, '#0f1a0f'); grad.addColorStop(0.5, '#0d170d'); grad.addColorStop(1, '#0a120a'); }
    else { grad.addColorStop(0, '#c8e6c0'); grad.addColorStop(0.5, '#b8dbb0'); grad.addColorStop(1, '#a3d197'); }
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Grid dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    for (let gx = 20; gx < MAP_W; gx += 35)
      for (let gy = 20; gy < MAP_H; gy += 35) {
        ctx.beginPath(); ctx.arc(gx * s, gy * s, 1 * s, 0, Math.PI * 2); ctx.fill();
      }

    this._drawPaths(ctx, s, dark);
    this._drawBuildings(ctx, s, dark);
    for (const c of this.connectors) c.draw(ctx, s);
    for (const p of this.particles) p.draw(ctx, s);
    // Depth-sort sprites by y
    const sorted = [...this.sprites].sort((a, b) => a.y - b.y);
    for (const sp of sorted) sp.draw(ctx, s, dark, time);
    for (const b of this.bubbles) b.draw(ctx, s, dark);
    this._drawBanner(ctx, s, dark, W, H);
  }

  _drawPaths(ctx, s, dark) {
    ctx.setLineDash([8 * s, 5 * s]);
    ctx.strokeStyle = dark ? 'rgba(200,210,180,0.08)' : 'rgba(80,60,40,0.1)';
    ctx.lineWidth = 3 * s;
    for (const [fromId, toId] of PATHS) {
      const a = this._buildingMap[fromId], b = this._buildingMap[toId];
      ctx.beginPath(); ctx.moveTo(a.x * s, a.y * s); ctx.lineTo(b.x * s, b.y * s); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  _drawBuildings(ctx, s, dark) {
    for (const b of BUILDINGS) {
      const x = (b.x - b.w / 2) * s, y = (b.y - b.h / 2) * s;
      const w = b.w * s, h = b.h * s, r = 10 * s;

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath(); ctx.roundRect(x + 4 * s, y + 4 * s, w, h, r); ctx.fill();

      // Body gradient
      const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
      const base = dark ? b.darkFill : b.fill;
      bgGrad.addColorStop(0, _lightenHex(base, 0.12));
      bgGrad.addColorStop(1, base);
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = bgGrad; ctx.fill();
      ctx.strokeStyle = dark ? b.darkStroke : b.stroke;
      ctx.lineWidth = 2 * s; ctx.stroke();

      // Decorative windows
      const wCount = Math.floor(b.w / 55);
      const wW = 12 * s, wH = 10 * s, gap = (w - wCount * wW) / (wCount + 1);
      ctx.fillStyle = dark ? 'rgba(255,200,50,0.12)' : 'rgba(255,255,255,0.5)';
      for (let wi = 0; wi < wCount; wi++) {
        const wx = x + gap + wi * (wW + gap);
        ctx.beginPath(); ctx.roundRect(wx, y + h * 0.22, wW, wH, 2 * s); ctx.fill();
      }

      // Emoji
      ctx.font = `${Math.round(22 * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.emoji, b.x * s, (b.y - 8) * s);

      // Label
      ctx.font = `700 ${Math.round(10 * s)}px 'Inter','Segoe UI',sans-serif`;
      ctx.fillStyle = dark ? '#d0d7de' : '#24292f';
      ctx.fillText(b.label, b.x * s, (b.y + 16) * s);

      // Description
      ctx.font = `400 ${Math.round(7 * s)}px 'Inter',sans-serif`;
      ctx.fillStyle = dark ? '#8b949e' : '#6b7080';
      ctx.fillText(b.desc, b.x * s, (b.y + 27) * s);
    }
  }

  _drawBanner(ctx, s, dark, W, H) {
    if (!this.phaseLabel) return;
    const bH = 42 * s;

    ctx.fillStyle = dark ? 'rgba(13,17,23,0.88)' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, W, bH);
    ctx.strokeStyle = dark ? '#30363d' : '#d0d7de'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, bH); ctx.lineTo(W, bH); ctx.stroke();

    ctx.font = `800 ${Math.round(13 * s)}px 'Inter',sans-serif`;
    ctx.fillStyle = dark ? '#e6edf3' : '#1a1d23';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(this.phaseLabel, 16 * s, bH * 0.5);

    if (this.phaseSub) {
      ctx.font = `500 ${Math.round(9 * s)}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = dark ? '#8b949e' : '#6b7080';
      ctx.textAlign = 'right';
      ctx.fillText(this.phaseSub, W - 16 * s, bH * 0.5);
    }

    // Progress bar
    if (this.phaseProgress > 0 && this.phaseProgress < 1) {
      const pGrad = ctx.createLinearGradient(0, 0, W * this.phaseProgress, 0);
      pGrad.addColorStop(0, '#16a34a'); pGrad.addColorStop(1, '#0d9488');
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, bH - 2.5 * s, W * this.phaseProgress, 2.5 * s);
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

  /* ---- Async helpers ---- */
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
  _addBubble(x, y, text, type, ttl) { this.bubbles.push(new Bubble(x, y, text, type || 'speech', ttl || 2.5)); }
  _burst(x, y, color, n) { for (let i = 0; i < (n || 8); i++) this.particles.push(new Particle(x, y, color)); }
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
     RICH LOG HELPERS (output HTML)
     ================================================================ */
  _logPhase(icon, title, desc) {
    this._log(`<div class="v3-le-phase"><span class="v3-le-icon">${icon}</span><strong>${title}</strong>${desc ? `<span class="v3-le-desc"> — ${desc}</span>` : ''}</div>`);
  }

  _logAgent(sp, text) {
    this._log(
      `<div class="v3-le-agent">` +
        `<span class="v3-le-dot" style="background:${sp.color}"></span>` +
        `<strong>${sp.name}</strong> ` +
        `<span class="v3-le-text">${text}</span>` +
      `</div>`
    );
  }

  _logMatch(sender, receiver, result) {
    const lieTag = result.isLie
      ? '<span class="v3-tag v3-tag-lie">LIE</span>'
      : '<span class="v3-tag v3-tag-truth">TRUTH</span>';
    const decTag = result.isDec ? ' <span class="v3-tag v3-tag-dec">DECEPTIVE</span>' : '';
    this._log(
      `<div class="v3-le-match">` +
        `<div class="v3-le-pair">` +
          `<span class="v3-le-dot" style="background:${sender.color}"></span><strong>${sender.name}</strong>` +
          `<span class="v3-le-arrow">\u2192</span>` +
          `<span class="v3-le-dot" style="background:${receiver.color}"></span><strong>${receiver.name}</strong>` +
          ` ${lieTag}${decTag}` +
        `</div>` +
        `<div class="v3-le-detail">\u03B8=${result.s1} m=${result.sent} a=${result.a1.toFixed(2)} \u03BB=${result.lambda.toFixed(2)} pay=${result.sp.toFixed(2)}</div>` +
      `</div>`
    );
  }

  _logSummary(icon, text) {
    this._log(`<div class="v3-le-summary"><span class="v3-le-icon">${icon}</span>${text}</div>`);
  }

  /* ================================================================
     PER-PAIR INTERACTION ANIMATION
     ================================================================ */
  async _animateInteraction(senderSp, receiverSp, result, arenaId) {
    const arena = this._buildingCenter(arenaId);
    const sX = arena.x - 50, rX = arena.x + 50, aY = arena.y;

    // Spotlight pair
    for (const sp of this.sprites) sp.dimmed = (sp !== senderSp && sp !== receiverSp);
    senderSp.glowing = true; receiverSp.glowing = true;
    senderSp.bobActive = true; receiverSp.bobActive = true;

    // Move to arena center
    senderSp.moveTo(sX, aY); receiverSp.moveTo(rX, aY);
    this.connectors.push(new Connector(senderSp, receiverSp, '#d97706', 5));
    await this._wait(450);

    // 1) State revealed to sender
    this._addBubble(senderSp.x, senderSp.y - 38, `\u03B8 = ${result.s1}`, 'thought', 2.5);
    await this._wait(350);

    // 2) Sender's decision
    if (result.isLie) {
      this._addBubble(senderSp.x, senderSp.y - 38, `Send m=${result.sent} (lie)`, 'event', 2.5);
      this._burst(senderSp.x, senderSp.y, '#dc2626', 14);
    } else {
      this._addBubble(senderSp.x, senderSp.y - 38, `Send m=${result.sent} (truth)`, 'success', 2.5);
      this._burst(senderSp.x, senderSp.y, '#16a34a', 8);
    }
    await this._wait(400);

    // 3) Receiver's action
    this._addBubble(receiverSp.x, receiverSp.y - 38, `Action a=${result.a1.toFixed(2)}`, 'speech', 2);
    await this._wait(350);

    // 4) Belief update
    this._addBubble((sX + rX) / 2, aY - 55, `\u03BB = ${result.lambda.toFixed(2)}`, 'thought', 2);
    await this._wait(300);

    // 5) Update reputation
    senderSp.rep = result.strat ?? 0.5;

    // Log the interaction
    this._logMatch(senderSp, receiverSp, result);
    this._interactions++;

    // Cleanup spotlight
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

    /* ---- Phase 1: Populate Village ---- */
    this._setPhase('\u2460 Populating Village', `${n} agents`);
    this._logPhase('\uD83C\uDFD8\uFE0F', 'Phase 1 \u2014 Population', `${n} agents entering the village`);

    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      sp.alpha = 1;
      this._burst(sp.x, sp.y, sp.color, 5);
      this._logAgent(sp, `enters the village <em>(${sp.riskLabel})</em>`);
      this.phaseProgress = (i + 1) / n;
      // Stagger entrance: show first 8 individually, then batch
      if (i < 8 || i % Math.max(1, Math.floor(n / 10)) === 0) await this._wait(100);
    }
    this._logSummary('\u2713', `All <strong>${n}</strong> agents have arrived`);
    await this._wait(500);

    /* ---- Phase 2: Oracle Chamber ---- */
    this._setPhase('\u2461 Oracle Chamber', 'Dispatching strategies');
    this._logPhase('\uD83D\uDD2E', 'Phase 2 \u2014 Oracle', 'Administrator generating strategies');
    this.phaseProgress = 0;

    this._arrangeIn('oracle', this.sprites);
    const oc = this._buildingCenter('oracle');
    this._burst(oc.x, oc.y, '#9673a6', 25);
    await this._wait(700);

    const oracleShow = Math.min(6, n);
    for (let i = 0; i < oracleShow; i++) {
      const sp = this.sprites[i];
      this._addBubble(sp.x, sp.y - 38, '\uD83D\uDCDC Strategy assigned', 'thought', 2);
      this._logAgent(sp, 'receives game prompt');
      this.phaseProgress = (i + 1) / oracleShow;
      await this._wait(220);
    }
    if (n > oracleShow) this._logSummary('\uD83D\uDCDC', `+${n - oracleShow} more agents receive prompts`);
    await this._wait(400);

    /* ---- Phase 3: BT Arena ---- */
    if (env === 'both' || env === 'BT') {
      await this._playArena('bt', R, rounds, n);
    }

    /* ---- Phase 4: GL Arena ---- */
    if (env === 'both' || env === 'GL') {
      await this._playArena('gl', R, rounds, n);
    }

    /* ---- Phase 5: Classification ---- */
    this._setPhase('\u2464 Hall of Records', 'Behavioral classification');
    this._logPhase('\uD83C\uDFDB\uFE0F', 'Phase 5 \u2014 Classification', 'Analyzing behavioral profiles');
    this.phaseProgress = 0;

    this._arrangeIn('hall', this.sprites);
    await this._wait(700);

    const C = { equilibrium: 0, lying_averse: 0, deception_averse: 0, inference_error: 0 };
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      sp.classification = sp.agent.classification || '';
      if (sp.classification) C[sp.classification]++;
      this._burst(sp.x, sp.y, CLS_COLORS[sp.classification] || '#888', 5);
      const clsLabel = CLS_LABELS[sp.classification] || sp.classification;
      this._logAgent(sp, `classified as <strong>${clsLabel}</strong>`);
      this.phaseProgress = (i + 1) / n;
      if (i < 8 || i % Math.max(1, Math.floor(n / 8)) === 0) {
        this._addBubble(sp.x, sp.y - 38, clsLabel, 'speech', 2.5);
        await this._wait(120);
      }
    }
    await this._wait(500);

    // Final stats
    this._logPhase('\uD83D\uDCCA', 'Final Results', '');
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    this._logSummary('\uD83D\uDD35', `Equilibrium: ${C.equilibrium} (${pct('equilibrium')})`);
    this._logSummary('\uD83D\uDFE2', `Lying-Averse: ${C.lying_averse} (${pct('lying_averse')})`);
    this._logSummary('\uD83D\uDD34', `Deception-Averse: ${C.deception_averse} (${pct('deception_averse')})`);
    this._logSummary('\uD83D\uDFE0', `Inference Error: ${C.inference_error} (${pct('inference_error')})`);

    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    if (allP.length) this._logSummary('\uD83D\uDCB0', `Avg welfare: ${(allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(3)}`);
    this._logSummary('\uD83C\uDFAE', `Total interactions: ${this._interactions}`);

    /* ---- Phase 6: Done ---- */
    this._setPhase('\uD83C\uDF89 Game Complete', `${n} agents \u00B7 ${this._interactions} interactions`);
    this._logPhase('\uD83C\uDF89', 'Game Complete', `${n} agents classified`);
    this.phaseProgress = 1;
    this.state = 'done';

    // Celebration
    const hc = this._buildingCenter('hall');
    for (let i = 0; i < 40; i++) {
      this._burst(hc.x + _rand(-120, 120), hc.y + _rand(-30, 30),
        ['#dc2626', '#16a34a', '#2563eb', '#d97706', '#7c3aed'][i % 5], 3);
    }
  }

  /* ---- Arena sub-routine (BT or GL) ---- */
  async _playArena(type, R, rounds, n) {
    const isBT = type === 'bt';
    const stratMap = isBT ? R.btS : R.glS;
    const records = isBT ? R.bt : R.gl;
    const phaseNum = isBT ? '\u2462' : '\u2463';
    const phaseN = isBT ? 3 : 4;
    const arenaLabel = isBT ? 'BT Arena' : 'GL Arena';
    const arenaDesc = isBT ? 'Bad-type Truth-telling' : 'Good-type Lying';
    const arenaEmoji = isBT ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F';

    const agentIds = Object.keys(stratMap).map(Number);
    const arenaSprites = agentIds.map(id => this._spriteOf(id)).filter(Boolean);
    const pairs = this._createPairs(agentIds);
    const totalPairs = pairs.length;
    const detailCount = Math.min(totalPairs, Math.max(3, Math.min(12, Math.ceil(n / 3))));

    this._setPhase(`${phaseNum} ${arenaLabel}`, `${totalPairs} matches \u2014 ${arenaDesc}`);
    this._logPhase(arenaEmoji, `Phase ${phaseN} \u2014 ${arenaLabel}`, `${totalPairs} sender\u2013receiver matches`);
    this.phaseProgress = 0;

    this._arrangeIn(type, arenaSprites);
    await this._wait(500);

    // Build round-1 result lookup
    const resultMap = {};
    const round1 = records.filter((_, idx) => idx % rounds === 0);
    for (const r of round1) resultMap[r.id] = r;

    // Detailed interactions
    for (let pi = 0; pi < detailCount && pi < pairs.length; pi++) {
      const [sId, rId] = pairs[pi];
      const sSp = this._spriteOf(sId), rSp = this._spriteOf(rId);
      const res = resultMap[sId];
      if (!sSp || !rSp || !res) continue;

      this._setPhase(`${phaseNum} ${arenaLabel}`, `Match ${pi + 1}/${totalPairs}: ${sSp.name} vs ${rSp.name}`);
      await this._animateInteraction(sSp, rSp, res, type);
      this.phaseProgress = (pi + 1) / totalPairs;
      await this._wait(150);
    }

    // Fast-forward remaining
    if (totalPairs > detailCount) {
      const remaining = totalPairs - detailCount;
      this._logSummary('\u26A1', `Fast-forwarding <strong>${remaining}</strong> more ${type.toUpperCase()} matches\u2026`);
      for (const sp of arenaSprites) {
        const s = stratMap[sp.agent.id] ?? 0.5;
        sp.rep = isBT ? s : 1 - s;
      }
      this.phaseProgress = 0.85;
      await this._wait(350);

      const lies = round1.filter(r => r.isLie).length;
      this._logSummary('\uD83D\uDCCA', `${arenaLabel} done: <strong>${round1.length - lies}</strong> truths, <strong>${lies}</strong> lies`);
    } else {
      // Update reps for any not covered
      for (const sp of arenaSprites) {
        const s = stratMap[sp.agent.id] ?? 0.5;
        sp.rep = isBT ? s : 1 - s;
      }
    }

    this.phaseProgress = 1;
    await this._wait(500);
  }

  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  reset() {
    this.state = 'idle'; this.stopLoop();
    this.sprites = []; this.bubbles = []; this.particles = []; this.connectors = [];
    this.phaseLabel = ''; this.phaseSub = ''; this.phaseProgress = 0;
  }
}
