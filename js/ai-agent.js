/**
 * V2 AI Agent Engine — Multi-provider LLM agents for the reputation game.
 * Supports: Anthropic, OpenAI, Google, DeepSeek, Qwen, MiniMax, Kimi, Zhipu.
 * Orchestrator model generates tailored prompts → dispatched to heterogeneous agents.
 */

/* ---- Shared OpenAI-compatible API call ---- */
function _openaiCall(label, defaultEP) {
  return async (cfg, system, prompt) => {
    const r = await fetch(cfg.endpoint || defaultEP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model, max_tokens: 1024, temperature: 0.4,
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
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6', label: 'Opus 4.6' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
    ],
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    call: async (cfg, system, prompt) => {
      const r = await fetch(cfg.endpoint || PROVIDERS.anthropic.defaultEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model, max_tokens: 1024, temperature: 0.4,
          system, messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.content[0].text.trim();
    },
  },
  openai: {
    name: 'OpenAI',
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
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    call: _openaiCall('OpenAI', 'https://api.openai.com/v1/chat/completions'),
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ],
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    call: async (cfg, system, prompt) => {
      const ep = cfg.endpoint || PROVIDERS.google.defaultEndpoint;
      const r = await fetch(`${ep}/models/${cfg.model}:generateContent?key=${cfg.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });
      if (!r.ok) throw new Error(`Google ${r.status}: ${await r.text()}`);
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
  zhipu: {
    name: 'Zhipu',
    models: [
      { id: 'glm-5', label: 'GLM-5' },
      { id: 'glm-4.5', label: 'GLM-4.5' },
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash' },
    ],
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    call: _openaiCall('Zhipu', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'),
  },
};

/* ---- Provider config store (sessionStorage) ---- */
function getProviderConfig(provider) {
  const el = id => document.getElementById(id);
  return {
    apiKey: el(`pk-${provider}`)?.value.trim() || '',
    endpoint: el(`pe-${provider}`)?.value.trim() || '',
    model: el(`pm-${provider}`)?.value || '',
  };
}

function getProviderCfg(provider, modelOverride) {
  const c = getProviderConfig(provider);
  if (modelOverride) c.model = modelOverride;
  return c;
}

/* ---- System prompt (shared) ---- */
const GAME_CONTEXT = `You are participating in a two-period reputation game studied by Choi, Lee & Lim (2025), building on Sobel's (2020) formal definitions of lying and deception.

GAME STRUCTURE:
- Period 1: Nature draws state θ∈{0,1}. The sender observes θ and sends message m∈{0,1}. The receiver observes m (possibly with noise ε) and takes action a₁.
- Period 2: Myopic play. The receiver's belief about the sender's type (reputation λ) determines action a₂.
- Payoff: U = −x₁(a₁−target)² − x₂(a₂−target)² where x₂/x₁ reflects reputation incentive.

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

/* ---- Orchestrator: generate tailored prompts via main model ---- */
async function orchestratePrompts(agents, gameType, gameParams, orchCfg) {
  const provider = PROVIDERS[orchCfg.provider];
  if (!provider) throw new Error('Invalid orchestrator provider');

  const agentList = agents.map(a =>
    `  Agent ${a.id}: c_l=${a.cl.toFixed(3)}, c_d=${a.cd.toFixed(3)}, α=${a.alpha.toFixed(3)} (${a.riskType.replace('_','-')}), β=${a.beta.toFixed(3)}, model=${a.aiProvider}/${a.aiModel}`
  ).join('\n');

  const gtDesc = gameType === 'BT'
    ? 'BT (Bad-type Truth-telling): bad type sends m=θ with probability v=P(m=1|θ=0). Equilibrium: v*=1.'
    : 'GL (Good-type Lying): good type sends m=0 with probability w=P(m=0|θ=1). Equilibrium: w*=0.';

  const orchPrompt = `You are the orchestrator for a multi-agent reputation game experiment.

GAME TYPE: ${gtDesc}

GAME PARAMETERS:
- x₂/x₁ ratio = ${gameParams.x2} (reputation incentive)
- Behavioral-type prior p_b = ${gameParams.pb}
- Miscommunication rate ε = ${(gameParams.miscomm * 100).toFixed(0)}%

AGENTS:
${agentList}

TASK: Generate a personalised game prompt for EACH agent. Each prompt should:
1. Explain the specific game they're playing (${gameType})
2. State their personal parameters and what they imply
3. Explain the equilibrium strategy and why deviating might be rational given their costs
4. Ask them to output a single number between 0.0 and 1.0

Output a JSON array of objects: [{"id": 0, "prompt": "..."}, {"id": 1, "prompt": "..."}, ...]
Output ONLY the JSON array, no other text.`;

  const cfg = getProviderCfg(orchCfg.provider, orchCfg.model);
  const raw = await provider.call(cfg, GAME_CONTEXT, orchPrompt);

  // Parse JSON from response (handle markdown code fences)
  const jsonStr = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error('Orchestrator returned invalid JSON: ' + raw.substring(0, 200));
  }
}

/* ---- Dispatch prompt to individual agent ---- */
async function dispatchToAgent(agent, prompt) {
  const provider = PROVIDERS[agent.aiProvider];
  if (!provider) throw new Error(`Unknown provider: ${agent.aiProvider}`);
  const cfg = getProviderCfg(agent.aiProvider, agent.aiModel);
  if (!cfg.apiKey) throw new Error(`No API key for ${agent.aiProvider}`);

  const system = GAME_CONTEXT + '\n\nYou must output ONLY a single number between 0.0 and 1.0 representing your truth-telling probability. No explanation, no text — just the number.';
  const raw = await provider.call(cfg, system, prompt);

  // Extract number from response
  const match = raw.match(/([01](?:\.\d+)?|\.\d+)/);
  if (!match) throw new Error(`No number in response: "${raw.substring(0, 100)}"`);
  return { value: Math.max(0, Math.min(1, parseFloat(match[1]))), raw };
}

/* ---- Build agent roster from UI ---- */
function buildAgentRoster() {
  const rows = document.querySelectorAll('.roster-row');
  const roster = [];
  rows.forEach(row => {
    const provider = row.querySelector('.roster-provider')?.value;
    const model = row.querySelector('.roster-model')?.value;
    const count = +(row.querySelector('.roster-count')?.value || 1);
    if (provider && model) {
      for (let i = 0; i < count; i++) roster.push({ provider, model });
    }
  });
  return roster;
}

/* ---- Full AI Experiment (V2) ---- */
async function runAIExperiment(progressCb) {
  // Get orchestrator config
  const orchProvider = document.getElementById('orch-provider').value;
  const orchModel = document.getElementById('orch-model').value;
  const orchCfg = { provider: orchProvider, model: orchModel };

  // Build roster
  const roster = buildAgentRoster();
  if (roster.length < 2) throw new Error('Add at least 2 agents to the roster');

  const env = document.getElementById('s-env').value;
  const rounds = +document.getElementById('s-rounds').value;
  const ratio = +document.getElementById('s-ratio').value;
  const bp = +document.getElementById('s-bp').value;
  const miscomm = +document.getElementById('s-miscomm').value / 100;

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

  // Assign providers to agents
  agents.forEach((a, i) => {
    a.aiProvider = roster[i].provider;
    a.aiModel = roster[i].model;
  });

  const params = { x1: 1, x2: ratio, pb: bp, miscomm };
  const gts = env === 'both' ? ['BT', 'GL'] : [env];
  const R = { bt: [], gl: [], btS: {}, glS: {} };
  const g = mulberry32(42);
  const gameLog = []; // rich log

  let step = 0;
  const totalSteps = gts.length * (1 + agents.length); // orchestrate + dispatch per gt

  for (const gt of gts) {
    // Step 1: Orchestrator generates prompts
    if (progressCb) progressCb(++step, totalSteps, `Orchestrator generating ${gt} prompts...`);
    let agentPrompts;
    try {
      agentPrompts = await orchestratePrompts(agents, gt, params, orchCfg);
    } catch (e) {
      // Fallback: generate prompts locally
      agentPrompts = agents.map(a => ({
        id: a.id,
        prompt: buildFallbackPrompt(a, gt, params),
      }));
      gameLog.push({ type: 'orchestrator', gt, status: 'fallback', error: e.message });
    }

    const promptMap = {};
    for (const p of agentPrompts) promptMap[p.id] = p.prompt;

    // Step 2: Dispatch to each agent (concurrency 4)
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
          entry.strategy = agentStrat(a, gt, params.x1, params.x2, params.pb);
          entry.response = `[fallback: math strategy = ${entry.strategy.toFixed(3)}]`;
        }
        gameLog.push(entry);
        if (progressCb) progressCb(++step, totalSteps, `${gt} Agent ${a.id} (${a.aiProvider})...`);
        return { id: a.id, strat: entry.strategy };
      }));
      for (const r of results) strategies[r.id] = r.strat;
    }

    // Step 3: Simulate rounds with AI strategies
    for (const a of agents) {
      const aiStrat = strategies[a.id];
      for (let r = 0; r < rounds; r++) {
        const s1 = g() < .5 ? 0 : 1, s2 = g() < .5 ? 0 : 1;
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
        const sp_ = gt === 'BT' ? -1*(a1-1)**2 - ratio*(a2-1)**2 : -1*(a1-s1)**2 - ratio*(a2-s2)**2;
        const rp_ = -1*(a1-s1)**2 - ratio*(a2-s2)**2;
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
  return { agents, R, gameLog };
}

/* ---- Fallback prompt (no orchestrator) ---- */
function buildFallbackPrompt(agent, gameType, params) {
  const gt = gameType === 'BT'
    ? `BT (Bad-type Truth-telling): You are the BAD type. In equilibrium v*=1: tell truth to build reputation (deceptive). Your strategy: v = P(m=1|θ=0).`
    : `GL (Good-type Lying): You are the GOOD type. In equilibrium w*=0: lie to reveal type (non-deceptive). Your strategy: w = P(m=0|θ=1).`;
  return `GAME: ${gt}
YOUR PARAMS: c_l=${agent.cl.toFixed(3)}, c_d=${agent.cd.toFixed(3)}, α=${agent.alpha.toFixed(3)} (${agent.riskType.replace('_','-')}), β=${agent.beta.toFixed(3)}
GAME: x₂/x₁=${params.x2}, p_b=${params.pb}, ε=${(params.miscomm*100).toFixed(0)}%
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
    html += `<details class="log-entry">
      <summary>
        ${e.gt} Agent ${e.id} ${modelTag} <span class="tag" style="background:var(--bg-3);color:var(--fg-2)">${e.model}</span>
        ${stratTag} strategy=${e.strategy?.toFixed(3) ?? '?'}
        ${a ? `c<sub>l</sub>=${a.cl.toFixed(2)} c<sub>d</sub>=${a.cd.toFixed(2)}` : ''}
      </summary>
      <div class="log-detail">
        <div class="log-section"><strong>Prompt:</strong><pre>${escapeHtml(e.prompt)}</pre></div>
        <div class="log-section"><strong>Response:</strong><pre>${escapeHtml(e.response || 'N/A')}</pre></div>
        ${e.error ? `<div class="log-section log-error"><strong>Error:</strong> ${escapeHtml(e.error)}</div>` : ''}
      </div>
    </details>`;
  }
  el.innerHTML = html;
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- Roster UI helpers ---- */
function addRosterRow(provider, model) {
  const container = document.getElementById('agent-roster');
  const p = provider || 'anthropic';
  const prov = PROVIDERS[p];
  const m = model || prov.models[0]?.id || '';
  const row = document.createElement('div');
  row.className = 'roster-row';
  row.innerHTML = `
    <select class="roster-provider" onchange="updateRosterModels(this)">
      ${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}" ${k===p?'selected':''}>${v.name}</option>`).join('')}
    </select>
    <select class="roster-model">
      ${prov.models.map(mm => `<option value="${mm.id}" ${mm.id===m?'selected':''}>${mm.label}</option>`).join('')}
    </select>
    <div class="roster-row-sub">
      <span class="roster-count-label">Count</span>
      <input type="number" class="roster-count" value="1" min="1" max="10" title="Number of agents with this config">
      <button class="roster-remove" onclick="this.closest('.roster-row').remove()" title="Remove">&times;</button>
    </div>
  `;
  container.appendChild(row);
}

function updateRosterModels(sel) {
  const row = sel.closest('.roster-row');
  const modelSel = row.querySelector('.roster-model');
  const p = sel.value;
  const prov = PROVIDERS[p];
  modelSel.innerHTML = prov.models.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
}

function updateOrchModels() {
  const p = document.getElementById('orch-provider').value;
  const modelSel = document.getElementById('orch-model');
  const prov = PROVIDERS[p];
  modelSel.innerHTML = prov.models.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
}
