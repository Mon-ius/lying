/**
 * Internationalization — translation dictionaries.
 */
const I18N = {
  en: {
    'header.title':'The Anatomy of Honesty',
    'nav.experiment':'Experiment','nav.architecture':'Architecture','nav.glossary':'Glossary',
    'panel.population':'Population','panel.costs':'Utility Costs','panel.game':'Game Mechanics',
    'label.nagents':'Number of agents','label.riskcomp':'Risk attitude composition',
    'label.riskloving':'Risk-loving (\u03b1<0)','label.riskneutral':'Risk-neutral (\u03b1\u22480)',
    'label.riskaverse':'Risk-averse (\u03b1>0)',
    'label.clmean':'Lying cost c<sub>l</sub> (log-normal \u03bc)',
    'label.cdmean':'Deception cost c<sub>d</sub> (log-normal \u03bc)',
    'label.env':'Environment','label.rounds':'Rounds per agent','label.ratio':'x\u2082/x\u2081 ratio',
    'label.bp':'Behavioral-type prior','label.miscomm':'Miscommunication rate',
    'hint.cl':'Higher \u2192 more aversion to literal lies','hint.cd':'Higher \u2192 more aversion to manipulating beliefs',
    'hint.ratio':'Reputation-building incentive strength','hint.miscomm':'Prob. received message is flipped',
    'btn.run':'Run Experiment','btn.json':'Export JSON','btn.csv':'Export CSV',
    'env.both':'Both (BT + GL)','env.bt':'BT \u2014 Bad-type truth-telling','env.gl':'GL \u2014 Good-type lying',
    'kpi.eq':'Equilibrium','kpi.la':'Lying-averse','kpi.da':'Deception-averse','kpi.ie':'Inference error','kpi.welfare':'Avg. welfare',
    'chart.params':'Fig. 1 &mdash; Utility Parameter Distributions',
    'chart.joint':'Fig. 2 &mdash; Joint (c<sub>l</sub>, c<sub>d</sub>) Distribution',
    'chart.stratbt':'Fig. 3 &mdash; Strategy Distribution &mdash; BT','chart.stratgl':'Fig. 4 &mdash; Strategy Distribution &mdash; GL',
    'chart.types':'Fig. 5 &mdash; Agent Type Proportions',
    'chart.regions':'Fig. 6 &mdash; Equilibrium Regions (c<sub>l</sub> vs c<sub>d</sub>)',
    'log.title':'Sample game log',
    'arch.title':'Game System Architecture',
    'arch.desc':'Complete architecture of the multi-agent reputation game system. Click \u201cEdit in draw.io\u201d to modify the diagram.',
    'arch.edit':'Edit in draw.io',
    'def.lie.t':'Lie (Sobel 2020, Definition 3)',
    'def.lie.d':'A message <em>m</em> is a <strong>lie</strong> if and only if <em>m</em> \u2260 <em>\u03b8</em> \u2014 the sender sends a message that does not match the true state.',
    'def.dec.t':'Deception (Sobel 2020, Definition 4)',
    'def.dec.d':'A message <em>m</em> is <strong>deceptive</strong> if it shifts the receiver\u2019s type belief away from truth, compared to the alternative message.',
    'def.eua.t':'Augmented Utility (Choi+ 2025, \u00a75)',
    'def.eua.d':'Agents maximize material payoff minus honesty costs: lying cost (<em>c<sub>l</sub></em>) for literal lies and deception cost (<em>c<sub>d</sub></em>) proportional to belief distortion.',
    'def.dt.t':'Deceptive Truth-telling (Prop. 1)',
    'def.dt.d':'In BT, the bad type tells the truth to build reputation. The message is <strong>literally true</strong> (m=\u03b8) but <strong>deceptive</strong> (shifts type beliefs).',
    'def.ndl.t':'Non-deceptive Lying (Prop. 2)',
    'def.ndl.d':'In GL, the good type lies to reveal type. The message is a <strong>literal lie</strong> (m\u2260\u03b8) but <strong>not deceptive</strong> (doesn\u2019t distort type beliefs).',
    'def.cls.t':'Behavioral Classification (Fig. 5)',
    'def.cls.d':'Agents are classified by equilibrium adherence: <strong>Equilibrium</strong> (both), <strong>Lying-averse</strong> (BT\u2713 GL\u2717), <strong>Deception-averse</strong> (BT\u2717 GL\u2713), <strong>Inference error</strong> (neither).',
    'gloss.title':'Glossary & Reference','gloss.abbr':'Abbreviations & Indices',
    'gloss.math':'Mathematical Notation','gloss.plots':'Plot Descriptions','gloss.papers':'Source Papers',
  },
  zh: {
    'header.title':'\u8bda\u5b9e\u7684\u89e3\u5256\u5b66',
    'nav.experiment':'\u5b9e\u9a8c','nav.architecture':'\u67b6\u6784','nav.glossary':'\u672f\u8bed\u8868',
    'panel.population':'\u79cd\u7fa4\u8bbe\u7f6e','panel.costs':'\u6548\u7528\u6210\u672c','panel.game':'\u535a\u5f08\u53c2\u6570',
    'label.nagents':'\u667a\u80fd\u4f53\u6570\u91cf','label.riskcomp':'\u98ce\u9669\u6001\u5ea6\u7ec4\u6210',
    'label.riskloving':'\u98ce\u9669\u504f\u597d (\u03b1<0)','label.riskneutral':'\u98ce\u9669\u4e2d\u6027 (\u03b1\u22480)',
    'label.riskaverse':'\u98ce\u9669\u538c\u6076 (\u03b1>0)',
    'label.clmean':'\u8bf4\u8c0e\u6210\u672c c<sub>l</sub> (\u5bf9\u6570\u6b63\u6001 \u03bc)',
    'label.cdmean':'\u6b3a\u9a97\u6210\u672c c<sub>d</sub> (\u5bf9\u6570\u6b63\u6001 \u03bc)',
    'label.env':'\u535a\u5f08\u73af\u5883','label.rounds':'\u6bcf\u667a\u80fd\u4f53\u8f6e\u6570','label.ratio':'x\u2082/x\u2081 \u6bd4\u7387',
    'label.bp':'\u884c\u4e3a\u7c7b\u578b\u5148\u9a8c\u6982\u7387','label.miscomm':'\u4fe1\u606f\u8bef\u4f20\u7387',
    'hint.cl':'\u8d8a\u9ad8 \u2192 \u8d8a\u538c\u6076\u5b57\u9762\u8c0e\u8a00','hint.cd':'\u8d8a\u9ad8 \u2192 \u8d8a\u538c\u6076\u64cd\u7eb5\u4fe1\u5ff5',
    'hint.ratio':'\u58f0\u8a89\u5efa\u8bbe\u6fc0\u52b1\u5f3a\u5ea6','hint.miscomm':'\u63a5\u6536\u6d88\u606f\u88ab\u7ffb\u8f6c\u7684\u6982\u7387',
    'btn.run':'\u8fd0\u884c\u5b9e\u9a8c','btn.json':'\u5bfc\u51fa JSON','btn.csv':'\u5bfc\u51fa CSV',
    'env.both':'\u4e24\u8005 (BT + GL)','env.bt':'BT \u2014 \u574f\u7c7b\u578b\u8bf4\u771f\u8bdd','env.gl':'GL \u2014 \u597d\u7c7b\u578b\u8bf4\u8c0e',
    'kpi.eq':'\u5747\u8861','kpi.la':'\u8bf4\u8c0e\u538c\u6076','kpi.da':'\u6b3a\u9a97\u538c\u6076','kpi.ie':'\u63a8\u65ad\u8bef\u5dee','kpi.welfare':'\u5e73\u5747\u798f\u5229',
    'chart.params':'\u56fe 1 &mdash; \u6548\u7528\u53c2\u6570\u5206\u5e03',
    'chart.joint':'\u56fe 2 &mdash; (c<sub>l</sub>, c<sub>d</sub>) \u8054\u5408\u5206\u5e03',
    'chart.stratbt':'\u56fe 3 &mdash; \u7b56\u7565\u5206\u5e03 &mdash; BT','chart.stratgl':'\u56fe 4 &mdash; \u7b56\u7565\u5206\u5e03 &mdash; GL',
    'chart.types':'\u56fe 5 &mdash; \u667a\u80fd\u4f53\u7c7b\u578b\u6bd4\u4f8b',
    'chart.regions':'\u56fe 6 &mdash; \u5747\u8861\u533a\u57df (c<sub>l</sub> vs c<sub>d</sub>)',
    'log.title':'\u535a\u5f08\u65e5\u5fd7\u6837\u672c',
    'arch.title':'\u535a\u5f08\u7cfb\u7edf\u67b6\u6784',
    'arch.desc':'\u591a\u667a\u80fd\u4f53\u58f0\u8a89\u535a\u5f08\u7cfb\u7edf\u7684\u5b8c\u6574\u67b6\u6784\u3002\u70b9\u51fb\u201c\u5728 draw.io \u4e2d\u7f16\u8f91\u201d\u4ee5\u4fee\u6539\u56fe\u8868\u3002',
    'arch.edit':'\u5728 draw.io \u4e2d\u7f16\u8f91',
    'def.lie.t':'\u8c0e\u8a00 (Sobel 2020, \u5b9a\u4e49 3)',
    'def.lie.d':'\u5f53\u6d88\u606f <em>m</em> \u2260 <em>\u03b8</em> \u65f6\uff0c\u5373\u53d1\u9001\u8005\u53d1\u51fa\u4e0e\u4e16\u754c\u771f\u5b9e\u72b6\u6001\u4e0d\u7b26\u7684\u6d88\u606f\uff0c\u5219\u4e3a<strong>\u8c0e\u8a00</strong>\u3002',
    'def.dec.t':'\u6b3a\u9a97 (Sobel 2020, \u5b9a\u4e49 4)',
    'def.dec.d':'\u5f53\u6d88\u606f <em>m</em> \u5c06\u63a5\u6536\u8005\u7684\u7c7b\u578b\u4fe1\u5ff5\u504f\u79bb\u4e86\u771f\u5b9e\u503c\uff0c\u76f8\u5bf9\u4e8e\u66ff\u4ee3\u6d88\u606f\u800c\u8a00\uff0c\u5219\u4e3a<strong>\u6b3a\u9a97</strong>\u3002',
    'def.eua.t':'\u589e\u5f3a\u6548\u7528 (Choi+ 2025, \u00a75)',
    'def.eua.d':'\u667a\u80fd\u4f53\u6700\u5927\u5316\u7269\u8d28\u6536\u76ca\u51cf\u53bb\u8bda\u5b9e\u6210\u672c\uff1a\u5b57\u9762\u8c0e\u8a00\u7684\u8bf4\u8c0e\u6210\u672c (<em>c<sub>l</sub></em>) \u548c\u4e0e\u4fe1\u5ff5\u626d\u66f2\u6210\u6b63\u6bd4\u7684\u6b3a\u9a97\u6210\u672c (<em>c<sub>d</sub></em>)\u3002',
    'def.dt.t':'\u6b3a\u9a97\u6027\u8bf4\u771f\u8bdd (\u547d\u9898 1)',
    'def.dt.d':'\u5728 BT \u4e2d\uff0c\u574f\u7c7b\u578b\u8bf4\u771f\u8bdd\u4ee5\u5efa\u7acb\u58f0\u8a89\u3002\u6d88\u606f\u662f<strong>\u5b57\u9762\u771f\u5b9e</strong>\u7684 (m=\u03b8) \u4f46<strong>\u5177\u6709\u6b3a\u9a97\u6027</strong> (\u6539\u53d8\u7c7b\u578b\u4fe1\u5ff5)\u3002',
    'def.ndl.t':'\u975e\u6b3a\u9a97\u6027\u8c0e\u8a00 (\u547d\u9898 2)',
    'def.ndl.d':'\u5728 GL \u4e2d\uff0c\u597d\u7c7b\u578b\u8bf4\u8c0e\u4ee5\u63ed\u793a\u7c7b\u578b\u3002\u6d88\u606f\u662f<strong>\u5b57\u9762\u8c0e\u8a00</strong> (m\u2260\u03b8) \u4f46<strong>\u975e\u6b3a\u9a97\u6027</strong> (\u4e0d\u626d\u66f2\u7c7b\u578b\u4fe1\u5ff5)\u3002',
    'def.cls.t':'\u884c\u4e3a\u5206\u7c7b (\u56fe 5)',
    'def.cls.d':'\u6839\u636e\u5747\u8861\u9075\u5faa\u7a0b\u5ea6\u5206\u7c7b\uff1a<strong>\u5747\u8861</strong> (\u4e24\u8005\u90fd\u9075\u5faa), <strong>\u8bf4\u8c0e\u538c\u6076</strong> (BT\u2713 GL\u2717), <strong>\u6b3a\u9a97\u538c\u6076</strong> (BT\u2717 GL\u2713), <strong>\u63a8\u65ad\u8bef\u5dee</strong> (\u90fd\u4e0d\u9075\u5faa)\u3002',
    'gloss.title':'\u672f\u8bed\u8868\u4e0e\u53c2\u8003','gloss.abbr':'\u7f29\u5199\u4e0e\u7d22\u5f15',
    'gloss.math':'\u6570\u5b66\u7b26\u53f7','gloss.plots':'\u56fe\u8868\u8bf4\u660e','gloss.papers':'\u6765\u6e90\u8bba\u6587',
  },
};

let currentLang = localStorage.getItem('lang') || 'en';

function applyI18n(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const dict = I18N[lang] || I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.innerHTML = dict[key];
  });
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }] });
  }
}
