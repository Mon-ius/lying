/**
 * Core simulation engine — game-theory computations.
 * Pure logic, no DOM dependencies.
 */

/* ---- Random number utilities ---- */
function randn(g) {
  let u = 0, v = 0;
  while (!u) u = g();
  while (!v) v = g();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function lognormal(g, m, s) { return Math.exp(m + s * randn(g)); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/* ---- Population generation ---- */
function createPopulation(p) {
  const { n, rlPct, rnPct, raPct, clMean, cdMean } = p;
  const g = mulberry32(42), agents = [];
  const nRL = Math.round(n * rlPct / 100);
  const nRN = Math.round(n * rnPct / 100);
  const nRA = n - nRL - nRN;
  const ra = [];
  for (let i = 0; i < nRL; i++) ra.push('risk_loving');
  for (let i = 0; i < nRN; i++) ra.push('risk_neutral');
  for (let i = 0; i < nRA; i++) ra.push('risk_averse');
  // Fisher-Yates shuffle
  for (let i = ra.length - 1; i > 0; i--) {
    const j = Math.floor(g() * (i + 1));
    [ra[i], ra[j]] = [ra[j], ra[i]];
  }
  const rp = {
    risk_loving:  { loc: -.5, scale: .2 },
    risk_neutral: { loc: 0,   scale: .05 },
    risk_averse:  { loc: .8,  scale: .3 },
  };
  for (let i = 0; i < n; i++) {
    const cl = Math.max(0, lognormal(g, clMean, 1));
    const cd = Math.max(0, lognormal(g, cdMean, 1));
    const rt = ra[i], r = rp[rt];
    const alpha = r.loc + r.scale * randn(g);
    const beta = clamp(.1 + .3 * randn(g), -1, 1);
    agents.push({ id: i, cl, cd, alpha, beta, riskType: rt, classification: '' });
  }
  return agents;
}

/* ---- Bayesian belief system ---- */
const B = {
  /** Posterior type belief λ(m,θ,v) in BT */
  btL(m, s, v, p) {
    if (!m && !s) { const d = p + (1 - p) * (1 - v); return d > 1e-12 ? p / d : .5; }
    if (m === 1 && !s) return 0;
    if (m === 1 && s === 1) return p;
    return p;
  },
  /** Posterior type belief λ(m,θ,w) in GL */
  glL(m, s, w, p) {
    if (!m) return 1;
    if (m === 1 && !s) return 0;
    const a = (1 - p) * (1 - w), b = p, t = a + b;
    return t > 1e-12 ? a / t : .5;
  },
  /** Receiver action a(m) in BT */
  btA(m, v, p) {
    if (!m) return 0;
    const r = .5 + (1 - p) * v * .5;
    return r > 1e-12 ? .5 / r : 1;
  },
  /** Receiver action a(m) in GL */
  glA(m, w, p) {
    if (!m) {
      const a = (1 - p) * w * .5, b = (1 - p) * .5, t = a + b;
      return t > 1e-12 ? a / t : 0;
    }
    const a = p * .5, b = p * .5 + (1 - p) * (1 - w) * .5, t = a + b;
    return t > 1e-12 ? b / t : .5;
  },
  /** Deception measure D(m,θ) in BT — Sobel Definition 4 */
  btD(m, s, v, p) {
    if (s) return 0;
    const l0 = B.btL(0, 0, v, p), l1 = B.btL(1, 0, v, p);
    return Math.abs(B.btL(m, 0, v, p) - Math.min(l0, l1));
  },
  /** Deception measure D(m,θ) in GL — Sobel Definition 4 */
  glD(m, s, w, p) {
    if (s !== 1) return 0;
    const l0 = B.glL(0, 1, w, p), l1 = B.glL(1, 1, w, p);
    return Math.abs(B.glL(m, 1, w, p) - Math.max(l0, l1));
  },
};

/* ---- Agent strategy (augmented utility maximisation) ---- */
function agentStrat(a, gt, x1, x2, pb) {
  if (gt === 'BT') {
    const v = 0;
    const a11 = B.btA(1, v, pb);
    const l00 = B.btL(0, 0, v, pb), l10 = B.btL(1, 0, v, pb);
    const at = 1 / (2 - l00), al = 1 / (2 - l10);
    const augT = -x1 * (0 - 1) ** 2 - x2 * (at - 1) ** 2 - a.cd * B.btD(0, 0, v, pb);
    const augL = -x1 * (a11 - 1) ** 2 - x2 * (al - 1) ** 2 - a.cl - a.cd * B.btD(1, 0, v, pb);
    const s = augT > augL + 1e-10 ? 1 : augL > augT + 1e-10 ? 0 : .5;
    return { strat: s, augT, augL };
  }
  const w = 1;
  const a10 = B.glA(0, w, pb), a11 = B.glA(1, w, pb);
  const l11 = B.glL(1, 1, w, pb);
  const augLie = -x1 * (a10 - 1) ** 2 - a.cl - a.cd * B.glD(0, 1, w, pb);
  const augTr  = -x1 * (a11 - 1) ** 2 - x2 * (1 - l11) ** 2 - a.cd * B.glD(1, 1, w, pb);
  const s = augLie > augTr + 1e-10 ? 1 : augTr > augLie + 1e-10 ? 0 : .5;
  return { strat: s, augT: augTr, augL: augLie };
}

/* ---- Period weight generation ---- */
function periodWeights(N, ratio) {
  if (N <= 1) return [1];
  const w = [];
  for (let t = 0; t < N; t++) w.push(Math.pow(ratio, t / (N - 1)));
  return w;  // [1, ..., ratio] geometric interpolation
}

/* ---- N-period game execution with carried state ---- */
function playNPeriodGame(a, gt, P, g, stratOverride) {
  const { weights, pb, miscomm } = P;
  const N = weights.length;
  let lambda = pb;
  const periods = [];
  let totalSP = 0, totalRP = 0;

  for (let t = 0; t < N; t++) {
    const xt = weights[t];
    const xNext = t < N - 1 ? weights[t + 1] : 0;
    const st = g() < .5 ? 0 : 1;
    const { strat, augT, augL } = stratOverride != null
      ? { strat: stratOverride, augT: NaN, augL: NaN }
      : agentStrat(a, gt, xt, xNext, lambda);

    let sent, v, w;
    if (gt === 'BT') {
      if (!st) { sent = g() < strat ? 0 : 1; v = 1 - strat; } else { sent = 1; v = 1 - strat; }
      w = 0;
    } else {
      if (st === 1) { sent = g() < strat ? 0 : 1; w = strat; } else { sent = 0; w = strat; }
      v = 0;
    }

    let rcv = sent;
    if (miscomm > 0 && g() < miscomm) rcv = 1 - rcv;

    const sp = gt === 'BT' ? v : w;
    const at = gt === 'BT' ? B.btA(rcv, sp, lambda) : B.glA(rcv, sp, lambda);
    const newLambda = gt === 'BT' ? B.btL(rcv, st, sp, lambda) : B.glL(rcv, st, sp, lambda);
    const isLie = sent !== st;
    const dec = gt === 'BT' ? B.btD(sent, st, sp, lambda) : B.glD(sent, st, sp, lambda);
    const pSP = gt === 'BT' ? -xt * (at - 1) ** 2 : -xt * (at - st) ** 2;
    const pRP = -xt * (at - st) ** 2;

    periods.push({ t, st, sent, rcv, at, lambda: newLambda, isLie, dec, isDec: dec > 1e-6, strat, augT, augL, v, w, sp, mc: sent !== rcv, payoff: pSP });
    totalSP += pSP;
    totalRP += pRP;
    lambda = newLambda;
  }

  // Lying / deception costs (applied once based on first strategic period)
  const p0 = periods[0];
  totalSP += -(p0.isLie ? a.cl : 0) - a.cd * p0.dec;

  // Truth-telling probability for classification (first period strategic choice)
  const tp = gt === 'BT' ? (p0.st === 0 ? p0.strat : 1) : (p0.st === 1 ? 1 - p0.strat : 1);

  // Backward-compatible result object
  return {
    gt, id: a.id, N,
    s1: p0.st, s2: periods[N - 1].st,
    sent: p0.sent, rcv: p0.rcv,
    a1: p0.at, a2: periods[N - 1].at,
    sp: totalSP, rp: totalRP,
    isLie: p0.isLie, isDec: p0.isDec, dec: p0.dec,
    tp, strat: p0.strat, mc: p0.mc,
    lambda: periods[N - 1].lambda,
    v: p0.v, w: p0.w, augT: p0.augT, augL: p0.augL,
    cl: a.cl, cd: a.cd, alpha: a.alpha, riskType: a.riskType,
    periods,
  };
}

/* ---- Full simulation ---- */
function runSim(agents, P) {
  const { env, rounds, x1, x2, pb, miscomm, nPeriods } = P;
  const g = mulberry32(P.seed || 42);
  const gts = env === 'both' ? ['BT', 'GL'] : [env];
  const weights = periodWeights(nPeriods || 2, x2 / x1);
  const R = { bt: [], gl: [], btS: {}, glS: {} };
  for (const gt of gts) {
    for (const a of agents) {
      const ss = [];
      for (let r = 0; r < rounds; r++) {
        const res = playNPeriodGame(a, gt, { weights, pb, miscomm }, g);
        (gt === 'BT' ? R.bt : R.gl).push(res);
        ss.push(res.tp);
      }
      const avg = ss.reduce((a, b) => a + b, 0) / ss.length;
      (gt === 'BT' ? R.btS : R.glS)[a.id] = avg;
    }
  }
  return R;
}

/* ---- Behavioral classification (Figure 5 logic) ---- */
function classify(agents, R) {
  const C = { equilibrium: 0, lying_averse: 0, deception_averse: 0, inference_error: 0 };
  for (const a of agents) {
    const bt = R.btS[a.id], gl = R.glS[a.id];
    let c = 'equilibrium';
    if (bt !== undefined && gl !== undefined) {
      const bT = bt > .5, gL = gl < .5;
      if (bT && !gL) c = 'lying_averse';
      else if (!bT && gL) c = 'deception_averse';
      else if (!bT && !gL) c = 'inference_error';
    } else if (bt !== undefined) {
      c = bt > .5 ? 'equilibrium' : 'deception_averse';
    } else if (gl !== undefined) {
      c = gl < .5 ? 'equilibrium' : 'lying_averse';
    }
    a.classification = c;
    C[c]++;
  }
  return C;
}
