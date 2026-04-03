/**
 * V2 AI Agent Engine — Multi-provider LLM agents for the reputation game.
 * Supports: Anthropic, OpenAI, Google, DeepSeek, Qwen, MiniMax, Kimi, Zhipu.
 * Administrator model generates tailored prompts → dispatched to heterogeneous agents.
 */

/* ---- Retry with backoff for 429 rate-limit errors ---- */
async function withRetry(fn, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) {
      if (i < retries && /429|rate.limit/i.test(e.message)) {
        await new Promise(r => setTimeout(r, (i + 1) * 15000));
      } else throw e;
    }
  }
}

/* ---- Shared OpenAI-compatible API call ---- */
function _openaiCall(label, defaultEP) {
  return async (cfg, system, prompt) => {
    const r = await fetch(cfg.endpoint || defaultEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model, temperature: 0.4,
        ...(/^(gpt-5|o[3-9]|o[1-9]\d)/.test(cfg.model) ? { max_completion_tokens: cfg.maxTokens || 1024 } : { max_tokens: cfg.maxTokens || 1024 }),
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`${label} ${r.status}: ${await r.text()}`);
    const d = await r.json();
    return d.choices[0].message.content.trim();
  };
}

/* ---- Provider Registry ---- */
const PROVIDERS = {
  claude: {
    name: 'Claude',
    models: [
      { id: 'claude-opus-4-6', label: 'Opus 4.6' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    ],
    defaultEndpoint: 'https://anthropic-20250719-b6006324.rootdirectorylab.com/v1/messages',
    call: async (cfg, system, prompt) => {
      const r = await fetch(cfg.endpoint || PROVIDERS.claude.defaultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model, max_tokens: cfg.maxTokens || 1024, temperature: 0.4,
          system, messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) throw new Error(`Claude ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.content[0].text.trim();
    },
  },
  gpt: {
    name: 'GPT',
    models: [
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
    defaultEndpoint: 'https://openai-20250719-f7491cbb.rootdirectorylab.com/v1/chat/completions',
    call: _openaiCall('GPT', 'https://api.openai.com/v1/chat/completions'),
  },
  gemini: {
    name: 'Gemini',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ],
    defaultEndpoint: 'https://gemini-20250719-bdb3d11b.rootdirectorylab.com/v1beta',
    call: async (cfg, system, prompt) => {
      const ep = cfg.endpoint || PROVIDERS.gemini.defaultEndpoint;
      const r = await fetch(`${ep}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: cfg.maxTokens || 1024 },
        }),
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.candidates[0].content.parts[0].text.trim();
    },
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-reasoner', label: 'DeepSeek R1' },
      { id: 'deepseek-chat', label: 'DeepSeek V3' },
    ],
    defaultEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    call: _openaiCall('DeepSeek', 'https://api.deepseek.com/v1/chat/completions'),
  },
  qwen: {
    name: 'Qwen',
    models: [
      { id: 'qwen3-max', label: 'Qwen3 Max' },
      { id: 'qwen3.5-plus', label: 'Qwen3.5 Plus' },
      { id: 'qwq-plus', label: 'QwQ Plus' },
      { id: 'qwen3.5-flash', label: 'Qwen3.5 Flash' },
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
    ],
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    call: _openaiCall('Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
  },
  minimax: {
    name: 'MiniMax',
    models: [
      { id: 'MiniMax-M2.7', label: 'M2.7' },
      { id: 'MiniMax-M2.5', label: 'M2.5' },
      { id: 'MiniMax-M2.1', label: 'M2.1' },
    ],
    defaultEndpoint: 'https://api.minimax.io/v1/chat/completions',
    call: _openaiCall('MiniMax', 'https://api.minimax.io/v1/chat/completions'),
  },
  kimi: {
    name: 'Kimi',
    models: [
      { id: 'kimi-k2.5', label: 'Kimi K2.5' },
      { id: 'moonshot-v1-auto', label: 'Moonshot V1 Auto' },
      { id: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
    ],
    defaultEndpoint: 'https://api.moonshot.cn/v1/chat/completions',
    call: _openaiCall('Kimi', 'https://api.moonshot.cn/v1/chat/completions'),
  },
  glm: {
    name: 'GLM',
    models: [
      { id: 'glm-5', label: 'GLM-5' },
      { id: 'glm-4.5', label: 'GLM-4.5' },
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash' },
    ],
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    call: _openaiCall('GLM', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'),
  },
};

/* ---- Provider config — reads API key/endpoint per section ---- */
function getProviderCfg(provider, modelOverride, section, maxTokens) {
  const el = id => document.getElementById(id);
  const sec = section || 'admin';
  return {
    apiKey: el(`pk-${sec}`)?.value.trim() || '',
    endpoint: el(`pe-${sec}`)?.value.trim() || '',
    model: modelOverride || '',
    maxTokens: maxTokens || 1024,
  };
}

/* ---- Key placeholder hints per provider ---- */
const KEY_PLACEHOLDERS = {
  claude:'sk-ant-...', gpt:'sk-...', gemini:'AIza...', deepseek:'sk-...',
  qwen:'sk-...', minimax:'...', kimi:'sk-...', glm:'...',
};
function updateSectionKey(sec) {
  const provSel = sec === 'admin'
    ? document.getElementById('orch-provider')
    : document.getElementById(`grp-${sec}-prov`);
  const pkEl = document.getElementById(`pk-${sec}`);
  const peEl = document.getElementById(`pe-${sec}`);
  if (provSel && pkEl) pkEl.placeholder = KEY_PLACEHOLDERS[provSel.value] || 'API Key';
  if (peEl) {
    const prov = provSel?.value;
    const hasFixedEP = prov === 'claude' || prov === 'gpt' || prov === 'gemini';
    peEl.value = hasFixedEP ? PROVIDERS[prov].defaultEndpoint : (peEl.dataset.userVal || '');
    peEl.disabled = hasFixedEP;
    if (!hasFixedEP) peEl.dataset.userVal = peEl.value;
  }
}

/* ---- System prompt (shared) ---- */
const GAME_CONTEXT = `You are participating in an N-period reputation game studied by Choi, Lee & Lim (2025), building on Sobel's (2020) formal definitions of lying and deception.

GAME STRUCTURE:
- N periods with increasing reputation weight: x_t interpolates from x₁=1 to x_N=x₂/x₁.
- Each period t: Nature draws state θ_t∈{0,1}. The sender observes θ_t and sends message m_t∈{0,1}. The receiver observes m_t (possibly with noise ε) and takes action a_t.
- Reputation λ_t evolves via Bayesian updating across periods. The final period is myopic.
- Payoff: U = Σ_t −x_t(a_t−target)² with lying and deception costs applied.

FORMAL DEFINITIONS (Sobel 2020):
- Lie (Def. 3): m ≠ θ — the sender's message does not match the true state.
- Deception (Def. 4): D(m,θ) > 0 — the message shifts the receiver's type belief further from truth than the alternative message would.

AUGMENTED UTILITY (Choi+ 2025, §5):
  EU^a = material_payoff − c_l·𝟙{m≠θ} − c_d·D(m,θ)
  where c_l = lying cost (penalises literal lies), c_d = deception cost (penalises belief manipulation).

KEY PROPOSITIONS:
- Prop. 1: In BT, the bad type telling truth is DECEPTIVE (m=θ but D>0).
- Prop. 2: In GL, the good type lying is NON-DECEPTIVE (m≠θ but D=0).
- Prop. 3: BT deviations from equilibrium are driven by c_d.
- Prop. 4: GL deviations from equilibrium are driven by c_l.`;

/* ---- Administrator: generate tailored prompts via main model (batched) ---- */
async function orchestratePrompts(agents, gameType, gameParams, orchCfg) {
  const provider = PROVIDERS[orchCfg.provider];
  if (!provider) throw new Error('Invalid administrator provider');

  const gtDesc = gameType === 'BT'
    ? 'BT (Bad-type Truth-telling): bad type sends m=θ with probability v=P(m=1|θ=0). Equilibrium: v*=1.'
    : 'GL (Good-type Lying): good type sends m=0 with probability w=P(m=0|θ=1). Equilibrium: w*=0.';

  const gameBlock = `GAME: ${gtDesc}
PARAMS: N=${gameParams.nPeriods||2}, x₂/x₁=${gameParams.x2}, p_b=${gameParams.pb}, ε=${(gameParams.miscomm*100).toFixed(0)}%`;

  // Batch agents into groups of 5 to avoid token truncation
  const BATCH = 5;
  const allResults = [];
  for (let i = 0; i < agents.length; i += BATCH) {
    const batch = agents.slice(i, i + BATCH);
    const agentList = batch.map(a =>
      `  ${a.id}: c_l=${a.cl.toFixed(3)}, c_d=${a.cd.toFixed(3)}, α=${a.alpha.toFixed(3)} (${a.riskType.replace('_','-')})`
    ).join('\n');

    const orchPrompt = `Administrator for reputation game experiment.
${gameBlock}
AGENTS:
${agentList}

For EACH agent, write a 2-sentence prompt: state their game+params, ask for a number 0.0–1.0.
Output ONLY: [{"id":N,"prompt":"..."},...]`;

    const cfg = getProviderCfg(orchCfg.provider, orchCfg.model, 'admin', 2048);
    const raw = await withRetry(() => provider.call(cfg, GAME_CONTEXT, orchPrompt));

    const jsonStr = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(jsonStr);
      allResults.push(...parsed);
    } catch {
      throw new Error('Administrator returned invalid JSON: ' + raw.substring(0, 200));
    }
  }
  return allResults;
}

/* ---- Dispatch prompt to individual agent ---- */
async function dispatchToAgent(agent, prompt) {
  const provider = PROVIDERS[agent.aiProvider];
  if (!provider) throw new Error(`Unknown provider: ${agent.aiProvider}`);
  const cfg = getProviderCfg(agent.aiProvider, agent.aiModel, agent.aiSection);
  if (!cfg.apiKey) throw new Error(`No API key for ${agent.aiProvider} (${agent.aiSection})`);

  const system = GAME_CONTEXT + '\n\nYou must output ONLY a single number between 0.0 and 1.0 representing your truth-telling probability. No explanation, no text — just the number.';
  const raw = await withRetry(() => provider.call(cfg, system, prompt));

  // Extract number from response
  const match = raw.match(/([01](?:\.\d+)?|\.\d+)/);
  if (!match) throw new Error(`No number in response: "${raw.substring(0, 100)}"`);
  return { value: Math.max(0, Math.min(1, parseFloat(match[1]))), raw };
}

/* ---- Build agent roster from risk-group UI ---- */
function buildAgentRoster() {
  const counts = getGroupCounts();
  const groups = ['rl', 'rn', 'ra'];
  const roster = [];
  for (const g of groups) {
    const provider = document.getElementById(`grp-${g}-prov`).value;
    const model = document.getElementById(`grp-${g}-model`).value;
    for (let i = 0; i < counts[g]; i++) roster.push({ provider, model, riskGroup: g });
  }
  return roster;
}

/* ---- Compute per-group agent counts from N × composition ---- */
function getGroupCounts() {
  const n = +document.getElementById('s-n').value;
  const rl = +document.getElementById('s-rl').value;
  const rn = +document.getElementById('s-rn').value;
  const ra = +document.getElementById('s-ra').value;
  const tot = rl + rn + ra || 1;
  let nRL = Math.round(n * rl / tot);
  let nRN = Math.round(n * rn / tot);
  let nRA = n - nRL - nRN; // remainder goes to risk-averse to keep sum exact
  if (nRA < 0) { nRN += nRA; nRA = 0; }
  return { rl: nRL, rn: nRN, ra: nRA };
}

/* ---- Update auto-count badges ---- */
function updateGroupCounts() {
  const c = getGroupCounts();
  document.getElementById('rc-rl').value = c.rl;
  document.getElementById('rc-rn').value = c.rn;
  document.getElementById('rc-ra').value = c.ra;
}

/* ---- Dispatch strategies for one game type in one trial ---- */
async function _dispatchGameType(agents, gt, params, orchCfg, progressCb, stepRef, totalSteps, gameLog) {
  // Administrator generates prompts
  if (progressCb) progressCb(++stepRef.v, totalSteps, `Administrator generating ${gt} prompts...`);
  let agentPrompts;
  try {
    agentPrompts = await orchestratePrompts(agents, gt, params, orchCfg);
  } catch (e) {
    agentPrompts = agents.map(a => ({
      id: a.id,
      prompt: buildFallbackPrompt(a, gt, params),
    }));
    gameLog.push({ type: 'orchestrator', gt, status: 'fallback', error: e.message });
  }

  const promptMap = {};
  for (const p of agentPrompts) promptMap[p.id] = p.prompt;

  // Dispatch to each agent (concurrency 4)
  const strategies = {};
  const concurrency = 4;
  for (let i = 0; i < agents.length; i += concurrency) {
    const batch = agents.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (a) => {
      const prompt = promptMap[a.id] || buildFallbackPrompt(a, gt, params);
      const entry = {
        type: 'agent', gt, id: a.id,
        provider: a.aiProvider, model: a.aiModel,
        prompt, response: null, strategy: null, error: null,
      };
      try {
        const { value, raw } = await dispatchToAgent(a, prompt);
        entry.response = raw;
        entry.strategy = value;
      } catch (e) {
        entry.error = e.message;
        const fb = agentStrat(a, gt, params.x1, params.x2, params.pb);
        entry.strategy = fb.strat;
        entry.response = `[fallback: math strategy = ${entry.strategy.toFixed(3)}]`;
      }
      gameLog.push(entry);
      if (progressCb) progressCb(++stepRef.v, totalSteps, `${gt} ${a._name || 'Agent '+a.id} (${a.aiProvider})...`);
      return { id: a.id, strat: entry.strategy };
    }));
    for (const r of results) strategies[r.id] = r.strat;
  }
  return strategies;
}

/* ---- Multi-trial AI Experiment (V2) ---- */
async function runMultiTrialAIExperiment(progressCb) {
  // Get administrator config
  const orchProvider = document.getElementById('orch-provider').value;
  const orchModel = document.getElementById('orch-model').value;
  const orchCfg = { provider: orchProvider, model: orchModel };

  // Build roster
  const roster = buildAgentRoster();
  if (roster.length < 2) throw new Error('Add at least 2 agents to the roster');

  const env = document.getElementById('s-env').value;
  const rounds = +document.getElementById('s-rounds').value;
  const nPeriods = +document.getElementById('s-periods').value;
  const ratio = +document.getElementById('s-ratio').value;
  const bp = +document.getElementById('s-bp').value;
  const miscomm = +document.getElementById('s-miscomm').value / 100;
  const nTrials = +(document.getElementById('s-trials')?.value || 1);

  let rl = +document.getElementById('s-rl').value;
  let rn = +document.getElementById('s-rn').value;
  let ra = +document.getElementById('s-ra').value;
  const tot = rl + rn + ra;
  rl = rl / tot * 100; rn = rn / tot * 100; ra = ra / tot * 100;

  const agents = createPopulation({
    n: roster.length, rlPct: rl, rnPct: rn, raPct: ra,
    clMean: +document.getElementById('s-cl').value,
    cdMean: +document.getElementById('s-cd').value,
  });

  // Build per-group model config from roster
  const groupModel = {};
  for (const r of roster) {
    if (!groupModel[r.riskGroup]) groupModel[r.riskGroup] = { provider: r.provider, model: r.model };
  }
  const riskToGroup = { risk_loving: 'rl', risk_neutral: 'rn', risk_averse: 'ra' };

  _assignNames(agents);

  // Assign providers and section keys by risk type (not by index)
  agents.forEach(a => {
    const g = riskToGroup[a.riskType];
    const cfg = groupModel[g] || groupModel.ra;
    a.aiProvider = cfg.provider;
    a.aiModel = cfg.model;
    a.aiSection = g;
    a.modelKey = `${cfg.provider}/${cfg.model}`;
  });

  const weights = periodWeights(nPeriods, ratio);
  const gts = env === 'both' ? ['BT', 'GL'] : [env];

  // Progress: per trial → per gt → administer + agents
  const stepsPerTrial = gts.length * (1 + agents.length);
  const totalSteps = nTrials * stepsPerTrial;
  const stepRef = { v: 0 };

  const allTrialResults = [];
  const allGameLogs = [];
  // Per-model tracking: { "provider/model": { btStrats: [], glStrats: [], trials: [] } }
  const modelResults = {};
  for (const a of agents) {
    if (!modelResults[a.modelKey]) {
      modelResults[a.modelKey] = { btStrats: [], glStrats: [], trials: [], agentIds: [] };
    }
    modelResults[a.modelKey].agentIds.push(a.id);
  }

  for (let trial = 0; trial < nTrials; trial++) {
    const seed = 42 + trial * 137;
    const g = mulberry32(seed);
    const R = { bt: [], gl: [], btS: {}, glS: {} };
    const gameLog = [];

    if (progressCb && nTrials > 1) {
      progressCb(stepRef.v, totalSteps, `Trial ${trial + 1}/${nTrials}...`);
    }

    for (const gt of gts) {
      const params = { x1: 1, x2: ratio, pb: bp, miscomm, nPeriods };
      const strategies = await _dispatchGameType(
        agents, gt, params, orchCfg, progressCb, stepRef, totalSteps, gameLog
      );

      // Simulate rounds using playNPeriodGame with AI strategy override
      const P = { weights, pb: bp, miscomm };
      for (const a of agents) {
        const aiStrat = strategies[a.id];
        for (let r = 0; r < rounds; r++) {
          const result = playNPeriodGame(a, gt, P, g, aiStrat);
          (gt === 'BT' ? R.bt : R.gl).push(result);
        }
        (gt === 'BT' ? R.btS : R.glS)[a.id] = aiStrat;

        // Track per-model strategies
        const mk = a.modelKey;
        if (gt === 'BT') modelResults[mk].btStrats.push(aiStrat);
        else modelResults[mk].glStrats.push(aiStrat);
      }
    }

    classify(agents, R);

    // Store per-trial classification snapshot
    const trialSnap = { R, classifications: {} };
    for (const a of agents) {
      trialSnap.classifications[a.id] = a.classification;
      const mk = a.modelKey;
      modelResults[mk].trials.push({ trial, id: a.id, cls: a.classification });
    }

    allTrialResults.push(trialSnap);
    allGameLogs.push(gameLog);
  }

  // Compute cross-model statistics
  const stats = computeModelStats(modelResults, allTrialResults, agents);
  return { agents, allTrialResults, modelResults, stats, allGameLogs };
}

/* ---- Backward-compatible single-trial wrapper ---- */
async function runAIExperiment(progressCb) {
  const saved = document.getElementById('s-trials')?.value;
  if (document.getElementById('s-trials')) document.getElementById('s-trials').value = '1';
  const res = await runMultiTrialAIExperiment(progressCb);
  if (document.getElementById('s-trials') && saved) document.getElementById('s-trials').value = saved;
  const lastTrial = res.allTrialResults[res.allTrialResults.length - 1];
  return { agents: res.agents, R: lastTrial.R, gameLog: res.allGameLogs[0] };
}

/* ---- Cross-model statistics ---- */
function computeModelStats(modelResults, allTrialResults, agents) {
  const _mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const _std = (arr, mu) => {
    if (arr.length < 2) return 0;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / (arr.length - 1));
  };
  const _ci95 = (mu, sd, n) => n < 2 ? 0 : 1.96 * sd / Math.sqrt(n);

  const perModel = {};
  const CLS_KEYS = ['equilibrium', 'lying_averse', 'deception_averse', 'inference_error'];

  for (const [mk, data] of Object.entries(modelResults)) {
    const btMu = _mean(data.btStrats);
    const btSd = _std(data.btStrats, btMu);
    const glMu = _mean(data.glStrats);
    const glSd = _std(data.glStrats, glMu);

    // Classification proportions across trials
    const clsCounts = {};
    for (const k of CLS_KEYS) clsCounts[k] = 0;
    let totalCls = 0;
    for (const t of data.trials) {
      if (t.cls && clsCounts[t.cls] !== undefined) clsCounts[t.cls]++;
      totalCls++;
    }
    const clsProps = {};
    for (const k of CLS_KEYS) clsProps[k] = totalCls ? clsCounts[k] / totalCls : 0;

    perModel[mk] = {
      label: mk,
      n: data.agentIds.length,
      bt: { mean: btMu, std: btSd, ci: _ci95(btMu, btSd, data.btStrats.length), values: data.btStrats },
      gl: { mean: glMu, std: glSd, ci: _ci95(glMu, glSd, data.glStrats.length), values: data.glStrats },
      cls: clsProps,
      clsCounts,
      totalCls,
      // Deviation from equilibrium: BT v*=1, GL w*=0
      btDev: Math.abs(btMu - 1),
      glDev: Math.abs(glMu - 0),
    };
  }

  // Aggregate across all models
  const allBt = Object.values(modelResults).flatMap(d => d.btStrats);
  const allGl = Object.values(modelResults).flatMap(d => d.glStrats);
  const aggBtMu = _mean(allBt);
  const aggGlMu = _mean(allGl);
  const aggClsCounts = {};
  for (const k of CLS_KEYS) aggClsCounts[k] = 0;
  let aggTotal = 0;
  for (const data of Object.values(modelResults)) {
    for (const t of data.trials) {
      if (t.cls && aggClsCounts[t.cls] !== undefined) aggClsCounts[t.cls]++;
      aggTotal++;
    }
  }
  const aggClsProps = {};
  for (const k of CLS_KEYS) aggClsProps[k] = aggTotal ? aggClsCounts[k] / aggTotal : 0;

  const aggregate = {
    bt: { mean: aggBtMu, std: _std(allBt, aggBtMu), ci: _ci95(aggBtMu, _std(allBt, aggBtMu), allBt.length) },
    gl: { mean: aggGlMu, std: _std(allGl, aggGlMu), ci: _ci95(aggGlMu, _std(allGl, aggGlMu), allGl.length) },
    cls: aggClsProps,
    nTrials: allTrialResults.length,
    nModels: Object.keys(perModel).length,
  };

  return { perModel, aggregate };
}

/* ---- Fallback prompt (no administrator) ---- */
function buildFallbackPrompt(agent, gameType, params) {
  const gt = gameType === 'BT'
    ? `BT (Bad-type Truth-telling): You are the BAD type. In equilibrium v*=1: tell truth to build reputation (deceptive). Your strategy: v = P(m=1|θ=0).`
    : `GL (Good-type Lying): You are the GOOD type. In equilibrium w*=0: lie to reveal type (non-deceptive). Your strategy: w = P(m=0|θ=1).`;
  return `GAME: ${gt}
N periods = ${params.nPeriods || 2}, x₂/x₁=${params.x2}, p_b=${params.pb}, ε=${(params.miscomm*100).toFixed(0)}%
YOUR PARAMS: c_l=${agent.cl.toFixed(3)}, c_d=${agent.cd.toFixed(3)}, α=${agent.alpha.toFixed(3)} (${agent.riskType.replace('_','-')}), β=${agent.beta.toFixed(3)}
Output truth-telling probability (0.0–1.0):`;
}

/* ---- Rich game log renderer ---- */
function renderGameLog(gameLog, agents) {
  const el = document.getElementById('log');
  if (!gameLog.length) { el.innerHTML = '<em>No AI log entries</em>'; return; }

  const providerBadge = (p) => {
    const colors = { anthropic: '#d97706', openai: '#16a34a', google: '#2563eb', custom: '#7c3aed' };
    return `<span class="tag" style="background:${colors[p] || '#666'}20;color:${colors[p] || '#666'}">${p}</span>`;
  };

  let html = '';
  const orchEntries = gameLog.filter(e => e.type === 'orchestrator');
  if (orchEntries.length) {
    html += orchEntries.map(e =>
      `<div class="log-entry log-orch"><span class="tag tag-mc">ORCH</span> ${e.gt} — ${e.status}${e.error ? ': ' + e.error : ''}</div>`
    ).join('');
  }

  const agentEntries = gameLog.filter(e => e.type === 'agent');
  for (const e of agentEntries) {
    const a = agents.find(a => a.id === e.id);
    const stratTag = e.error
      ? '<span class="tag tag-lie">FALLBACK</span>'
      : '<span class="tag tag-truth">AI</span>';
    const modelTag = providerBadge(e.provider);
    html += `<details class="log-entry" open>
      <summary>
        ${e.gt} ${agentName(e.id)} ${modelTag} <span class="tag" style="background:var(--bg-3);color:var(--fg-2)">${e.model}</span>
        ${stratTag} strategy=${e.strategy?.toFixed(3) ?? '?'}
        ${a ? `c<sub>l</sub>=${a.cl.toFixed(2)} c<sub>d</sub>=${a.cd.toFixed(2)}` : ''}
      </summary>
      <div class="log-detail">
        <div class="log-section"><strong>${t('log.prompt')}:</strong><pre>${escapeHtml(e.prompt)}</pre></div>
        <div class="log-section"><strong>${t('log.response')}:</strong><pre>${escapeHtml(e.response || 'N/A')}</pre></div>
        ${e.error ? `<div class="log-section log-error"><strong>${t('log.error')}:</strong> ${escapeHtml(e.error)}</div>` : ''}
      </div>
    </details>`;
  }
  el.innerHTML = html;
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- Group model UI helpers ---- */
function updateGroupModels(group) {
  const p = document.getElementById(`grp-${group}-prov`).value;
  const modelSel = document.getElementById(`grp-${group}-model`);
  const prov = PROVIDERS[p];
  modelSel.innerHTML = prov.models.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
}

function initGroupModels() {
  ['rl', 'rn', 'ra'].forEach(g => { updateGroupModels(g); updateSectionKey(g); });
  updateOrchModels();
  updateSectionKey('admin');
  updateGroupCounts();
}

function updateOrchModels() {
  const p = document.getElementById('orch-provider').value;
  const modelSel = document.getElementById('orch-model');
  const prov = PROVIDERS[p];
  modelSel.innerHTML = prov.models.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
}
