/**
 * V2 AI Agent Engine — LLM-based agents for the reputation game.
 * Each agent queries a Claude model to decide its strategy.
 * Depends on: engine.js (for playRound, classify, B)
 */

const AI_MODELS = {
  'haiku': 'claude-haiku-4-5-20251001',
  'sonnet': 'claude-sonnet-4-5-20241022',
};

const GAME_SYSTEM_PROMPT = `You are an agent in a two-period reputation game (Choi, Lee & Lim 2025; Sobel 2020).

GAME STRUCTURE:
- Period 1: Nature draws state θ∈{0,1}. You (sender) observe θ and send message m∈{0,1}. The receiver sees m (possibly with noise) and chooses action a₁.
- Period 2: Myopic play based on your reputation λ (receiver's belief about your type).

DEFINITIONS:
- Lie: m ≠ θ (Sobel Def. 3)
- Deception: message shifts receiver's type belief away from truth (Sobel Def. 4)
- Augmented utility: EU^a = material payoff − c_l·𝟙{lie} − c_d·D(m,θ)
  where c_l = lying cost, c_d = deception cost, D = deception measure

You must output ONLY a single number between 0.0 and 1.0 representing your strategy (truth-telling probability). No explanation.`;

function buildAgentPrompt(agent, gameType, params) {
  const { x1, x2, pb, miscomm } = params;
  const gt = gameType === 'BT'
    ? `BT (Bad-type Truth-telling):
You are the BAD type (strategic sender). The behavioral type always tells the truth.
In equilibrium, you should tell the truth at θ=0 to build reputation (deceptive truth-telling, Prop. 1).
Your strategy v = P(m=1|θ=0) — probability of telling truth when θ=0.
Truth-telling here is DECEPTIVE (shifts receiver's belief). Deviating is driven by your deception cost c_d.`
    : `GL (Good-type Lying):
You are the GOOD type (strategic sender). The behavioral type always sends m=1.
In equilibrium, you should lie at θ=1 to reveal your type (non-deceptive lying, Prop. 2).
Your strategy w = P(m=0|θ=1) — probability of lying when θ=1.
Lying here is NON-DECEPTIVE (doesn't distort beliefs). Deviating is driven by your lying cost c_l.`;

  return `GAME: ${gt}

YOUR PARAMETERS:
- Lying cost c_l = ${agent.cl.toFixed(3)}
- Deception cost c_d = ${agent.cd.toFixed(3)}
- Risk aversion α = ${agent.alpha.toFixed(3)} (${agent.riskType.replace('_', '-')})
- Altruism β = ${agent.beta.toFixed(3)}

GAME PARAMETERS:
- Reputation weight x₂/x₁ = ${x2}
- Behavioral-type prior p_b = ${pb}
- Miscommunication rate ε = ${(miscomm * 100).toFixed(0)}%

Consider your costs carefully:
- High c_l means you strongly dislike literal lies
- High c_d means you strongly dislike manipulating beliefs
- Higher x₂/x₁ means reputation matters more

Output your truth-telling probability (0.0 to 1.0):`;
}

async function queryAgent(apiKey, model, agent, gameType, params) {
  const modelId = AI_MODELS[model] || AI_MODELS.haiku;
  const prompt = buildAgentPrompt(agent, gameType, params);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 32,
      system: GAME_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = data.content[0].text.trim();
  const val = parseFloat(text);
  if (isNaN(val)) throw new Error(`Invalid response: "${text}"`);
  return Math.max(0, Math.min(1, val));
}

async function runAIExperiment(apiKey, model, progressCb) {
  const nAI = +document.getElementById('s-ai-n').value;
  const env = document.getElementById('s-env').value;
  const rounds = +document.getElementById('s-rounds').value;
  const ratio = +document.getElementById('s-ratio').value;
  const bp = +document.getElementById('s-bp').value;
  const miscomm = +document.getElementById('s-miscomm').value / 100;

  let rl = +document.getElementById('s-rl').value;
  let rn = +document.getElementById('s-rn').value;
  let ra = +document.getElementById('s-ra').value;
  const total = rl + rn + ra;
  rl = rl / total * 100; rn = rn / total * 100; ra = ra / total * 100;

  const agents = createPopulation({
    n: nAI, rlPct: rl, rnPct: rn, raPct: ra,
    clMean: +document.getElementById('s-cl').value,
    cdMean: +document.getElementById('s-cd').value,
  });

  const params = { x1: 1, x2: ratio, pb: bp, miscomm };
  const gts = env === 'both' ? ['BT', 'GL'] : [env];
  const totalCalls = agents.length * gts.length;
  let done = 0;

  const R = { bt: [], gl: [], btS: {}, glS: {} };
  const g = mulberry32(42);
  const aiLog = [];

  for (const gt of gts) {
    // Query all agents for this game type (parallel with concurrency limit)
    const concurrency = 3;
    const strategies = {};

    for (let i = 0; i < agents.length; i += concurrency) {
      const batch = agents.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(async (a) => {
        try {
          const strat = await queryAgent(apiKey, model, a, gt, params);
          aiLog.push({ id: a.id, gt, strat, raw: strat.toFixed(3) });
          return { id: a.id, strat };
        } catch (e) {
          aiLog.push({ id: a.id, gt, error: e.message });
          // Fallback to mathematical strategy
          const fallback = agentStrat(a, gt, params.x1, params.x2, params.pb);
          return { id: a.id, strat: fallback };
        }
      }));

      for (const r of results) {
        strategies[r.id] = r.strat;
        done++;
        if (progressCb) progressCb(done, totalCalls);
      }
    }

    // Run simulation rounds using AI-determined strategies
    for (const a of agents) {
      const aiStrat = strategies[a.id];
      for (let r = 0; r < rounds; r++) {
        const s1 = g() < .5 ? 0 : 1;
        const s2 = g() < .5 ? 0 : 1;
        let sent, v, w;
        if (gt === 'BT') {
          if (!s1) { sent = g() < aiStrat ? 0 : 1; v = 1 - aiStrat; } else { sent = 1; v = 1 - aiStrat; }
          w = 0;
        } else {
          if (s1 === 1) { sent = g() < aiStrat ? 0 : 1; w = aiStrat; } else { sent = 0; w = aiStrat; }
          v = 0;
        }
        let rcv = sent;
        if (miscomm > 0 && g() < miscomm) rcv = 1 - rcv;
        const sp = gt === 'BT' ? v : w;
        const a1 = gt === 'BT' ? B.btA(rcv, sp, bp) : B.glA(rcv, sp, bp);
        const tb = gt === 'BT' ? B.btL(rcv, s1, sp, bp) : B.glL(rcv, s1, sp, bp);
        const a2 = gt === 'BT' ? clamp(tb * s2 + (1 - tb), 0, 1) : clamp(tb * s2 + (1 - tb) * .5, 0, 1);
        const sp_ = gt === 'BT' ? -1 * (a1 - 1) ** 2 - ratio * (a2 - 1) ** 2 : -1 * (a1 - s1) ** 2 - ratio * (a2 - s2) ** 2;
        const rp_ = -1 * (a1 - s1) ** 2 - ratio * (a2 - s2) ** 2;
        const isLie = sent !== s1;
        const dec = gt === 'BT' ? B.btD(sent, s1, sp, bp) : B.glD(sent, s1, sp, bp);
        const tp = gt === 'BT' ? (s1 === 0 ? aiStrat : 1) : (s1 === 1 ? 1 - aiStrat : 1);
        (gt === 'BT' ? R.bt : R.gl).push({
          gt, id: a.id, s1, s2, sent, rcv, a1, a2, sp: sp_, rp: rp_,
          isLie, isDec: dec > 1e-6, tp, strat: aiStrat, mc: sent !== rcv,
        });
      }
      (gt === 'BT' ? R.btS : R.glS)[a.id] = strategies[a.id];
    }
  }

  classify(agents, R);
  return { agents, R, aiLog };
}
