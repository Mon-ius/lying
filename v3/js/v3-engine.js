/**
 * V3 Game Engine — Stanford-Town-style 2D world for the reputation game.
 * Canvas-based rendering with animated agents, buildings, and game phases.
 */

/* ---- Helpers ---- */
function _lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function _rand(lo, hi) { return lo + Math.random() * (hi - lo); }

/* ---- Map Definition (virtual coords 1000×700) ---- */
const MAP_W = 1000, MAP_H = 700;

const BUILDINGS = [
  { id:'village', x:500,y:80,  w:320,h:65, label:'Agent Village',        emoji:'\uD83C\uDFD8\uFE0F', fill:'#d5e8d4', stroke:'#82b366', darkFill:'#1f3d1f', darkStroke:'#5a9a50' },
  { id:'oracle',  x:500,y:225, w:220,h:55, label:'Administrator Oracle', emoji:'\uD83D\uDD2E',       fill:'#e1d5e7', stroke:'#9673a6', darkFill:'#2a1f35', darkStroke:'#8060a8' },
  { id:'bt',      x:255,y:420, w:210,h:90, label:'BT Arena',             emoji:'\uD83D\uDEE1\uFE0F', fill:'#dae8fc', stroke:'#6c8ebf', darkFill:'#1a2540', darkStroke:'#3d6eaf' },
  { id:'gl',      x:745,y:420, w:210,h:90, label:'GL Arena',             emoji:'\u2694\uFE0F',        fill:'#fff2cc', stroke:'#d6b656', darkFill:'#2d2614', darkStroke:'#b8962e' },
  { id:'hall',    x:500,y:610, w:280,h:55, label:'Hall of Records',      emoji:'\uD83C\uDFDB\uFE0F', fill:'#f8cecc', stroke:'#b85450', darkFill:'#2d1b1b', darkStroke:'#c06060' },
];

const PATHS = [
  ['village','oracle'], ['oracle','bt'], ['oracle','gl'], ['bt','hall'], ['gl','hall'],
];

const RISK_COLORS = { risk_loving:'#dc2626', risk_neutral:'#d97706', risk_averse:'#2563eb' };
const CLS_COLORS  = { equilibrium:'#2563eb', lying_averse:'#16a34a', deception_averse:'#dc2626', inference_error:'#d97706' };
const PROVIDER_COLORS = { claude:'#d97706', gpt:'#16a34a', gemini:'#2563eb', deepseek:'#7c3aed', qwen:'#0d9488', minimax:'#be185d', kimi:'#c2410c', glm:'#4338ca' };

/* ---- Game Agent Sprite ---- */
class Sprite {
  constructor(agent, x, y) {
    this.agent = agent;
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;
    this.radius = 9;
    this.alpha = 0;
    this.rep = 0.5;
    this.classification = '';
    this.featured = false;
    this.label = '' + agent.id;
  }
  get color() {
    if (this.classification) return CLS_COLORS[this.classification] || '#888';
    if (this.agent.aiProvider) return PROVIDER_COLORS[this.agent.aiProvider] || '#888';
    return RISK_COLORS[this.agent.riskType] || '#888';
  }
  moveTo(x, y) { this.tx = x; this.ty = y; }
  update(dt, speed) {
    const s = 5 * speed;
    this.x = _lerp(this.x, this.tx, s * dt);
    this.y = _lerp(this.y, this.ty, s * dt);
  }
  draw(ctx, scale, dark) {
    if (this.alpha <= 0) return;
    const sx = this.x * scale, sy = this.y * scale;
    const r = this.radius * scale;
    ctx.globalAlpha = this.alpha;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.7, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Body circle
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(sx - r * 0.25, sy - r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    // Reputation bar (if featured or classified)
    if (this.featured || this.classification) {
      const bw = r * 2.4, bh = 3 * scale;
      const bx = sx - bw / 2, by = sy - r - bh - 4 * scale;
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = this.color;
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, this.rep)), bh);
    }

    // Label
    if (this.featured) {
      ctx.font = `bold ${Math.round(8 * scale)}px 'JetBrains Mono',monospace`;
      ctx.fillStyle = dark ? '#e6edf3' : '#1a1d23';
      ctx.textAlign = 'center';
      ctx.fillText(this.label, sx, sy + r + 12 * scale);
    }

    ctx.globalAlpha = 1;
  }
}

/* ---- Bubble (speech / thought / event) ---- */
class Bubble {
  constructor(x, y, text, type, ttl) {
    this.x = x; this.y = y;
    this.text = text;
    this.type = type; // 'speech' | 'thought' | 'event'
    this.ttl = ttl || 2.5;
    this.maxTTL = this.ttl;
    this.alpha = 0;
  }
  update(dt, speed) {
    this.ttl -= dt * speed;
    const t = 1 - this.ttl / this.maxTTL;
    if (t < 0.1) this.alpha = t / 0.1;
    else if (this.ttl < 0.4) this.alpha = this.ttl / 0.4;
    else this.alpha = 1;
    this.y -= 8 * dt * speed; // float up slowly
  }
  get alive() { return this.ttl > 0; }
  draw(ctx, scale, dark) {
    if (this.alpha <= 0) return;
    const sx = this.x * scale, sy = this.y * scale;
    ctx.globalAlpha = this.alpha;
    const fs = Math.round(10 * scale);
    ctx.font = `600 ${fs}px 'Inter',sans-serif`;
    const tw = ctx.measureText(this.text).width;
    const pad = 6 * scale, h = fs + pad * 2, w = tw + pad * 2;
    const rx = sx - w / 2, ry = sy - h;
    const r = 5 * scale;

    // Background
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, r);
    if (this.type === 'thought') {
      ctx.fillStyle = dark ? 'rgba(124,58,237,0.85)' : 'rgba(124,58,237,0.12)';
      ctx.strokeStyle = dark ? '#7c3aed' : 'rgba(124,58,237,0.5)';
    } else if (this.type === 'event') {
      ctx.fillStyle = dark ? 'rgba(220,38,38,0.85)' : 'rgba(220,38,38,0.12)';
      ctx.strokeStyle = dark ? '#dc2626' : 'rgba(220,38,38,0.5)';
    } else {
      ctx.fillStyle = dark ? 'rgba(30,36,46,0.92)' : 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = dark ? '#30363d' : '#dfe1e6';
    }
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pointer triangle
    ctx.beginPath();
    ctx.moveTo(sx - 4 * scale, ry + h);
    ctx.lineTo(sx, ry + h + 5 * scale);
    ctx.lineTo(sx + 4 * scale, ry + h);
    ctx.fill();

    // Text
    ctx.fillStyle = this.type === 'thought' ? (dark ? '#fff' : '#7c3aed') :
                    this.type === 'event' ? (dark ? '#fff' : '#dc2626') :
                    (dark ? '#e6edf3' : '#1a1d23');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, sx, ry + h / 2);
    ctx.globalAlpha = 1;
  }
}

/* ---- Particle ---- */
class Particle {
  constructor(x, y, color, ttl) {
    this.x = x; this.y = y;
    this.vx = _rand(-30, 30); this.vy = _rand(-50, -10);
    this.color = color; this.ttl = ttl || 1; this.maxTTL = this.ttl;
    this.r = _rand(2, 4);
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 40 * dt; this.ttl -= dt; }
  get alive() { return this.ttl > 0; }
  draw(ctx, scale) {
    const a = this.ttl / this.maxTTL;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(this.x * scale, this.y * scale, this.r * scale, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
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
    this.phase = 'idle';
    this.phaseLabel = '';
    this.phaseSub = '';
    this.speed = 1;
    this.state = 'idle'; // idle | running | paused | done
    this._running = false;
    this._raf = null;
    this._lastTime = 0;
    this._buildingMap = {};
    BUILDINGS.forEach(b => this._buildingMap[b.id] = b);
    this.results = null;
    this.agents = null;
    this.onPhase = null; // callback(phase, sub)
    this.onLog = null;   // callback(text)
    this._scale = 1;
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

  /* ---- Initialise from simulation results ---- */
  init(agents, results) {
    this.agents = agents;
    this.results = results;
    this.sprites = [];
    this.bubbles = [];
    this.particles = [];
    this.phase = 'idle';
    this.phaseLabel = '';
    this.phaseSub = '';

    // Create sprites in the village
    const v = this._buildingMap.village;
    const cols = Math.ceil(Math.sqrt(agents.length * 1.5));
    agents.forEach((a, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const cx = v.x - (cols - 1) * 14 + col * 28;
      const cy = v.y - 5 + row * 24;
      const sp = new Sprite(a, cx, cy);
      sp.alpha = 0;
      // Feature first few agents for detailed view
      if (i < Math.min(4, agents.length)) sp.featured = true;
      if (a.aiProvider) sp.label = `${a.aiProvider[0].toUpperCase()}${a.id}`;
      else sp.label = `A${a.id}`;
      this.sprites.push(sp);
    });
  }

  /* ---- Drawing ---- */
  draw() {
    const ctx = this.ctx, s = this._scale;
    const dark = typeof _isDark === 'function' && _isDark();
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background — gradient grass
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { grad.addColorStop(0, '#141e14'); grad.addColorStop(1, '#0d170d'); }
    else { grad.addColorStop(0, '#c8e6c0'); grad.addColorStop(1, '#a3d197'); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid dots
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    for (let gx = 0; gx < MAP_W; gx += 40)
      for (let gy = 0; gy < MAP_H; gy += 40) {
        ctx.beginPath(); ctx.arc(gx * s, gy * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      }

    // Paths
    this._drawPaths(ctx, s, dark);
    // Buildings
    this._drawBuildings(ctx, s, dark);
    // Particles (behind agents)
    for (const p of this.particles) p.draw(ctx, s);
    // Agents
    for (const sp of this.sprites) sp.draw(ctx, s, dark);
    // Bubbles
    for (const b of this.bubbles) b.draw(ctx, s, dark);
    // Phase banner
    this._drawBanner(ctx, s, dark, W, H);
  }

  _drawPaths(ctx, s, dark) {
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.strokeStyle = dark ? 'rgba(200,210,180,0.15)' : 'rgba(80,60,40,0.18)';
    ctx.lineWidth = 2.5 * s;
    for (const [fromId, toId] of PATHS) {
      const a = this._buildingMap[fromId], b = this._buildingMap[toId];
      ctx.beginPath();
      ctx.moveTo(a.x * s, a.y * s);
      ctx.lineTo(b.x * s, b.y * s);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  _drawBuildings(ctx, s, dark) {
    for (const b of BUILDINGS) {
      const x = (b.x - b.w / 2) * s, y = (b.y - b.h / 2) * s;
      const w = b.w * s, h = b.h * s, r = 8 * s;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath(); ctx.roundRect(x + 3 * s, y + 3 * s, w, h, r); ctx.fill();
      // Fill
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = dark ? b.darkFill : b.fill;
      ctx.fill();
      ctx.strokeStyle = dark ? b.darkStroke : b.stroke;
      ctx.lineWidth = 1.8 * s;
      ctx.stroke();
      // Emoji
      ctx.font = `${Math.round(18 * s)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.emoji, b.x * s, (b.y - 6) * s);
      // Label
      ctx.font = `600 ${Math.round(9 * s)}px 'Inter',sans-serif`;
      ctx.fillStyle = dark ? '#c9d1d9' : '#3d4250';
      ctx.fillText(b.label, b.x * s, (b.y + 14) * s);
    }
  }

  _drawBanner(ctx, s, dark, W, H) {
    if (!this.phaseLabel) return;
    // Semi-transparent banner across top
    ctx.fillStyle = dark ? 'rgba(13,17,23,0.75)' : 'rgba(255,255,255,0.8)';
    ctx.fillRect(0, 0, W, 36 * s);
    ctx.strokeStyle = dark ? '#30363d' : '#dfe1e6';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 36 * s); ctx.lineTo(W, 36 * s); ctx.stroke();
    // Phase text
    ctx.font = `700 ${Math.round(13 * s)}px 'Inter',sans-serif`;
    ctx.fillStyle = dark ? '#e6edf3' : '#1a1d23';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(this.phaseLabel, 14 * s, 18 * s);
    // Sub text
    if (this.phaseSub) {
      ctx.font = `400 ${Math.round(10 * s)}px 'Inter',sans-serif`;
      ctx.fillStyle = dark ? '#8b949e' : '#6b7080';
      ctx.textAlign = 'right';
      ctx.fillText(this.phaseSub, W - 14 * s, 18 * s);
    }
  }

  /* ---- Animation loop ---- */
  _loop(ts) {
    if (!this._lastTime) this._lastTime = ts;
    const dt = Math.min(0.1, (ts - this._lastTime) / 1000);
    this._lastTime = ts;

    // Update sprites
    for (const sp of this.sprites) sp.update(dt, this.speed);
    // Update bubbles
    for (const b of this.bubbles) b.update(dt, this.speed);
    this.bubbles = this.bubbles.filter(b => b.alive);
    // Update particles
    for (const p of this.particles) p.update(dt * this.speed);
    this.particles = this.particles.filter(p => p.alive);

    this.draw();
    if (this._running) this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  startLoop() {
    if (this._running) return;
    this._running = true;
    this._lastTime = 0;
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }
  stopLoop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  /* ---- Async helpers ---- */
  async _wait(ms) {
    const steps = Math.max(1, Math.ceil(ms / 50));
    for (let i = 0; i < steps; i++) {
      while (this.state === 'paused') await new Promise(r => setTimeout(r, 80));
      if (this.state === 'idle') return;
      await new Promise(r => setTimeout(r, Math.max(10, 50 / this.speed)));
    }
  }

  _setPhase(label, sub) {
    this.phaseLabel = label;
    this.phaseSub = sub || '';
    if (this.onPhase) this.onPhase(label, sub);
  }

  _log(text) { if (this.onLog) this.onLog(text); }

  _addBubble(x, y, text, type, ttl) {
    this.bubbles.push(new Bubble(x, y, text, type || 'speech', ttl || 2.5));
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < (n || 8); i++) this.particles.push(new Particle(x, y, color));
  }

  _buildingCenter(id) {
    const b = this._buildingMap[id];
    return { x: b.x, y: b.y };
  }

  /* ---- Arrange sprites in a grid inside a building ---- */
  _arrangeIn(buildingId, list) {
    const b = this._buildingMap[buildingId];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.6)));
    list.forEach((sp, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const cx = b.x - (cols - 1) * 13 + col * 26;
      const cy = b.y - 5 + row * 22;
      sp.moveTo(cx, cy);
    });
  }

  /* ==================================================================
     GAME PHASES
     ================================================================== */
  async play() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.startLoop();

    const R = this.results;
    const agents = this.agents;
    const rounds = +(document.getElementById('s-rounds')?.value) || 1;
    const env = document.getElementById('s-env')?.value || 'both';

    // PHASE 1: Populate
    this._setPhase('Phase 1 — Populating Village', `${agents.length} agents`);
    this._log(`Creating ${agents.length} agents...`);
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].alpha = 1;
      this._burst(this.sprites[i].x, this.sprites[i].y, RISK_COLORS[agents[i].riskType], 5);
      if (i % 4 === 0) await this._wait(80);
    }
    await this._wait(800);

    // PHASE 2: Oracle
    this._setPhase('Phase 2 — Oracle Generates Prompts', 'Dispatching strategies...');
    this._log('Administrator generating game prompts...');
    const oc = this._buildingCenter('oracle');
    this._burst(oc.x, oc.y, '#9673a6', 20);
    await this._wait(600);
    // Show prompt bubbles for featured agents
    for (const sp of this.sprites.filter(s => s.featured)) {
      this._addBubble(sp.x, sp.y - 30, '📜 Prompt received', 'thought', 2);
    }
    await this._wait(1200);

    // PHASE 3: BT Game
    const btSprites = this.sprites.filter((_, i) => R.btS && R.btS[agents[i].id] !== undefined);
    const glSprites = this.sprites.filter((_, i) => R.glS && R.glS[agents[i].id] !== undefined);

    if (env === 'both' || env === 'BT') {
      this._setPhase('Phase 3 — BT Arena', 'Bad-type Truth-telling');
      this._log('Agents enter BT Arena — Bad-type Truth-telling game...');
      this._arrangeIn('bt', btSprites);
      await this._wait(1500);

      // Show game play for featured agents
      const btFirst = R.bt.filter((_, i) => i % rounds === 0);
      for (const sp of btSprites.filter(s => s.featured)) {
        const r = btFirst.find(r => r.id === sp.agent.id);
        if (!r) continue;
        const strat = R.btS[r.id];
        this._addBubble(sp.x, sp.y - 30, `θ=${r.s1}`, 'speech', 2);
        this._log(`Agent ${r.id}: θ=${r.s1}, strategy=${strat?.toFixed(2)}`);
        await this._wait(500);
        this._addBubble(sp.x, sp.y - 30, `m=${r.sent} ${r.isLie ? '(lie!)' : '(truth)'}`, r.isLie ? 'event' : 'speech', 2.5);
        if (r.isLie) this._burst(sp.x, sp.y, '#dc2626', 10);
        else this._burst(sp.x, sp.y, '#16a34a', 6);
        await this._wait(600);
        sp.rep = strat ?? 0.5;
        this._addBubble(sp.x, sp.y - 30, `a=${r.a1.toFixed(2)} λ=${r.lambda.toFixed(2)}`, 'thought', 2);
        await this._wait(600);
      }
      // Update non-featured
      for (const sp of btSprites) {
        const s = R.btS[sp.agent.id];
        sp.rep = s ?? 0.5;
      }
      await this._wait(800);
    }

    if (env === 'both' || env === 'GL') {
      this._setPhase('Phase 4 — GL Arena', 'Good-type Lying');
      this._log('Agents enter GL Arena — Good-type Lying game...');
      this._arrangeIn('gl', glSprites);
      await this._wait(1500);

      const glFirst = R.gl.filter((_, i) => i % rounds === 0);
      for (const sp of glSprites.filter(s => s.featured)) {
        const r = glFirst.find(r => r.id === sp.agent.id);
        if (!r) continue;
        const strat = R.glS[r.id];
        this._addBubble(sp.x, sp.y - 30, `θ=${r.s1}`, 'speech', 2);
        this._log(`Agent ${r.id}: θ=${r.s1}, strategy=${strat?.toFixed(2)}`);
        await this._wait(500);
        this._addBubble(sp.x, sp.y - 30, `m=${r.sent} ${r.isLie ? '(lie!)' : '(truth)'}`, r.isLie ? 'event' : 'speech', 2.5);
        if (r.isLie) this._burst(sp.x, sp.y, '#dc2626', 10);
        else this._burst(sp.x, sp.y, '#16a34a', 6);
        await this._wait(600);
        sp.rep = 1 - (strat ?? 0.5);
        this._addBubble(sp.x, sp.y - 30, `a=${r.a1.toFixed(2)} λ=${r.lambda.toFixed(2)}`, 'thought', 2);
        await this._wait(600);
      }
      for (const sp of glSprites) {
        const s = R.glS[sp.agent.id];
        sp.rep = 1 - (s ?? 0.5);
      }
      await this._wait(800);
    }

    // PHASE 5: Classification
    this._setPhase('Phase 5 — Classification', 'Behavioral analysis');
    this._log('Classifying agents...');
    this._arrangeIn('hall', this.sprites);
    await this._wait(1500);

    const C = { equilibrium:0, lying_averse:0, deception_averse:0, inference_error:0 };
    for (const sp of this.sprites) {
      sp.classification = sp.agent.classification || '';
      if (sp.classification) C[sp.classification]++;
      this._burst(sp.x, sp.y, CLS_COLORS[sp.classification] || '#888', 4);
    }
    this._log(`Results: EQ=${C.equilibrium} LA=${C.lying_averse} DA=${C.deception_averse} IE=${C.inference_error}`);
    await this._wait(1200);

    // Show classification for featured
    for (const sp of this.sprites.filter(s => s.featured)) {
      const cls = sp.classification.replace(/_/g, '-');
      this._addBubble(sp.x, sp.y - 30, cls, 'speech', 4);
    }
    await this._wait(2000);

    // PHASE 6: Done
    this._setPhase('Game Complete', `${agents.length} agents classified`);
    this._log('Game simulation complete!');
    this.state = 'done';
  }

  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  reset() {
    this.state = 'idle';
    this.stopLoop();
    this.sprites = [];
    this.bubbles = [];
    this.particles = [];
    this.phaseLabel = '';
    this.phaseSub = '';
  }
}
