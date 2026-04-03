/**
 * V1 — Mathematical simulation mode.
 * Depends on: engine.js, charts.js, i18n.js, version-loader.js, app.js (shared)
 */

/* ---- Translatable game log ---- */
function renderLog() {
  const log = document.getElementById('log');
  const sample = window._logSample;
  if (!log || !sample || !sample.length) return;
  const rtMap = { risk_loving: t('rt.rl'), risk_neutral: t('rt.rn'), risk_averse: t('rt.ra') };

  const N = Math.max(...sample.map(r => (r.periods || []).length), 1);

  function agentAnalysis(r) {
    let sobelNote = '';
    if (!r.isLie && r.isDec) sobelNote = t('log.prop1');
    else if (r.isLie && !r.isDec) sobelNote = t('log.prop2');
    const truthWins = r.augT >= r.augL;
    const diff = Math.abs(r.augT - r.augL).toFixed(3);
    const winner = truthWins ? t('log.truth') : t('log.lie');
    return `<div class="log-section"><strong>${t('log.decision')}</strong>
      <div class="log-grid">
        <span>EU\u1d43(${t('log.truth')}) = ${r.augT.toFixed(3)}</span>
        <span>EU\u1d43(${t('log.lie')}) = ${r.augL.toFixed(3)}</span>
        <span>\u2192 ${winner} ${t('log.better')} ${diff}</span>
        <span>${t('log.strategy')} = ${r.strat.toFixed(2)}</span>
      </div>
    </div>
    <div class="log-section"><strong>${t('log.sobel')}</strong>
      <div class="log-grid">
        <span>${r.isLie ? t('log.islie') : t('log.nolie')}</span>
        <span>D = ${r.dec.toFixed(3)} \u2192 ${r.isDec ? t('log.isdec') : t('log.nodec')}</span>
        ${sobelNote ? `<span class="tag tag-sobel">${sobelNote}</span>` : ''}
      </div>
    </div>
    <div class="log-section"><strong>${t('log.profile')}</strong>
      <div class="log-grid">
        <span>c<sub>l</sub> = ${r.cl.toFixed(3)}</span>
        <span>c<sub>d</sub> = ${r.cd.toFixed(3)}</span>
        <span>\u03b1 = ${r.alpha.toFixed(3)} (${rtMap[r.riskType] || r.riskType})</span>
      </div>
    </div>`;
  }

  if (N < 2) {
    log.innerHTML = sample.map((r, i) => {
      const lieTag = r.isLie
        ? `<span class="tag tag-lie">${t('log.lie')}</span>`
        : `<span class="tag tag-truth">${t('log.truth')}</span>`;
      const decTag = r.isDec ? `<span class="tag tag-dec">${t('log.deceptive')}</span>` : '';
      const mcTag = r.mc ? `<span class="tag tag-mc">${t('log.miscomm')}</span>` : '';
      return `<details class="log-entry"${i === 0 ? ' open' : ''}>
  <summary>
    <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700">${r.gt}</span>
    ${t('log.agent')}\u2009${r.id}
    \u2003\u03b8\u2081=${r.s1} \u2192 m=${r.sent} \u2192 a\u2081=${r.a1.toFixed(2)}
    \u2003${lieTag}${decTag ? '\u2002' + decTag : ''}${mcTag ? '\u2002' + mcTag : ''}
    \u2003${t('log.payoff')}=${r.sp.toFixed(2)}
  </summary>
  <div class="log-detail">
    <div class="log-section"><strong>${t('log.p1')}</strong>
      <div class="log-grid">
        <span>\u03b8\u2081 = ${r.s1}</span>
        <span>m = ${r.sent} (${r.isLie ? t('log.lie') : t('log.truth')})</span>
        <span>${t('log.rcv')} = ${r.rcv}${r.mc ? ' \u26a0' : ''}</span>
        <span>a\u2081 = ${r.a1.toFixed(3)}</span>
      </div>
    </div>
    ${agentAnalysis(r)}
  </div>
</details>`;
    }).join('');
    return;
  }

  let html = '';

  for (let pi = 0; pi < N; pi++) {
    const isLast = pi === N - 1;
    const sfx = t('log.periodSuffix');
    const label = isLast && N > 1
      ? `${t('log.period')} ${pi + 1}${sfx} (${t('log.myopic')})`
      : `${t('log.period')} ${pi + 1}${sfx}`;

    const pds = sample.map(r => (r.periods || [])[pi]).filter(Boolean);
    const nBT = sample.filter(r => r.gt === 'BT' && (r.periods || [])[pi]).length;
    const nGL = sample.filter(r => r.gt === 'GL' && (r.periods || [])[pi]).length;
    const countLabel = nBT && nGL ? `${nBT} BT + ${nGL} GL` : `${pds.length} ${t('log.agents')}`;
    const nLie = pds.filter(p => p.isLie).length;
    const nDec = pds.filter(p => p.isDec).length;
    const stats = `${countLabel} \u00b7 ${pds.length - nLie} ${t('log.truth').toLowerCase()} \u00b7 ${nLie} ${t('log.lie').toLowerCase()}${nDec ? ' \u00b7 ' + nDec + ' ' + t('log.deceptive').toLowerCase() : ''}`;

    const rows = sample.map(r => {
      const p = (r.periods || [])[pi];
      if (!p) return '';
      const lieTag = p.isLie
        ? `<span class="tag tag-lie">${t('log.lie')}</span>`
        : `<span class="tag tag-truth">${t('log.truth')}</span>`;
      const decTag = p.isDec ? `<span class="tag tag-dec">${t('log.deceptive')}</span>` : '';
      const mcTag = p.mc ? `<span class="tag tag-mc">${t('log.miscomm')}</span>` : '';
      return `<div class="log-period-row">
  <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700;font-size:.65rem">${r.gt}</span>
  ${t('log.agent')}\u2009${r.id}
  \u2003\u03b8<sub>${pi+1}</sub>=${p.st} \u2192 m=${p.sent} \u2192 a<sub>${pi+1}</sub>=${p.at.toFixed(2)}
  \u2003\u03bb<sub>${pi+1}</sub>=${p.lambda.toFixed(3)}
  \u2003${lieTag}${decTag ? '\u2002' + decTag : ''}${mcTag ? '\u2002' + mcTag : ''}
</div>`;
    }).filter(Boolean).join('');

    html += `<details class="log-period"${pi === 0 ? ' open' : ''}>
  <summary><strong>${label}</strong><span class="log-period-stats">${stats}</span></summary>
  <div class="log-period-body">${rows}</div>
</details>`;
  }

  const aBT = sample.filter(r => r.gt === 'BT').length;
  const aGL = sample.filter(r => r.gt === 'GL').length;
  html += `<details class="log-period">
  <summary><strong>${t('log.analysis')}</strong><span class="log-period-stats">${aBT && aGL ? aBT + ' BT + ' + aGL + ' GL' : sample.length + ' ' + t('log.agents')}</span></summary>
  <div class="log-period-body">`;

  html += sample.map((r, i) => {
    const lieTag = r.isLie
      ? `<span class="tag tag-lie">${t('log.lie')}</span>`
      : `<span class="tag tag-truth">${t('log.truth')}</span>`;
    return `<details class="log-entry"${i === 0 ? ' open' : ''}>
  <summary>
    <span class="tag" style="background:var(--bg-2);color:var(--fg-1);font-weight:700">${r.gt}</span>
    ${t('log.agent')}\u2009${r.id}
    \u2003${t('log.payoff')}=${r.sp.toFixed(2)} \u2003${lieTag}
  </summary>
  <div class="log-detail">${agentAnalysis(r)}</div>
</details>`;
  }).join('');

  html += '</div></details>';
  log.innerHTML = html;
}

/* ---- Run V1 experiment ---- */
function runExperiment() {
  const btn = document.getElementById('btn-run');
  btn.classList.add('loading'); btn.disabled = true;
  requestAnimationFrame(() => { setTimeout(() => {
    const n = +document.getElementById('s-n').value;
    const rl = +document.getElementById('s-rl').value;
    const rn = +document.getElementById('s-rn').value;
    const ra = +document.getElementById('s-ra').value;
    const agents = createPopulation({
      n, rlPct: rl, rnPct: rn, raPct: ra,
      clMean: +document.getElementById('s-cl').value,
      cdMean: +document.getElementById('s-cd').value,
    });
    const env = document.getElementById('s-env').value;
    const rounds = +document.getElementById('s-rounds').value;
    const nPeriods = +document.getElementById('s-periods').value;
    const ratio = +document.getElementById('s-ratio').value;
    const bp = +document.getElementById('s-bp').value;
    const miscomm = +document.getElementById('s-miscomm').value / 100;
    const R = runSim(agents, { env, rounds, x1: 1, x2: ratio, nPeriods, pb: bp, miscomm, seed: 42 });
    const C = classify(agents, R);
    LA = agents; LR = R;

    // KPIs
    const pct = k => (C[k] / n * 100).toFixed(0) + '%';
    document.getElementById('st-eq').textContent = pct('equilibrium');
    document.getElementById('st-la').textContent = pct('lying_averse');
    document.getElementById('st-da').textContent = pct('deception_averse');
    document.getElementById('st-ie').textContent = pct('inference_error');
    document.querySelectorAll('.kpi').forEach((el, i) => {
      const bar = el.querySelector('.bar'); if (!bar) return;
      const vals = [C.equilibrium, C.lying_averse, C.deception_averse, C.inference_error];
      if (i < 4) bar.style.width = (vals[i] / n * 100) + '%';
    });
    const allP = [...R.bt, ...R.gl].map(r => r.sp + r.rp);
    document.getElementById('st-welfare').textContent = allP.length
      ? (allP.reduce((a, b) => a + b, 0) / allP.length).toFixed(2) : '--';

    // Charts
    plotParams(agents);
    plotJoint(agents);
    if (env === 'both' || env === 'BT') plotStrat(R, 'BT');
    if (env === 'both' || env === 'GL') plotStrat(R, 'GL');
    plotTypes(agents);
    plotRegions(agents);
    plotLambda(R);

    // Log
    const btSample = R.bt.filter((_, i) => i % rounds === 0);
    const glSample = R.gl.filter((_, i) => i % rounds === 0);
    window._logSample = [...btSample, ...glSample];
    renderLog();
    plotPointCloud(R, agents);

    btn.classList.remove('loading'); btn.disabled = false;
  }, 60); });
}

/* ---- Register V1 ---- */
registerVersion('v1', {
  runLabel: 'btn.run',
  btnClass: '',
  bodyClass: '',
  run: runExperiment,
  onActivate: () => {
    document.getElementById('p-ai').style.display = 'none';
    document.querySelectorAll('.v2-chart').forEach(el => el.style.display = 'none');
  },
  onDeactivate: () => {},
  redraw: () => {},
});
