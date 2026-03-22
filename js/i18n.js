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
    'label.clmean':'Lying cost c\u2097 (log-normal \u03bc)','label.cdmean':'Deception cost c\u2084 (log-normal \u03bc)',
    'label.env':'Environment','label.rounds':'Rounds per agent','label.ratio':'x\u2082/x\u2081 ratio',
    'label.bp':'Behavioral-type prior','label.miscomm':'Miscommunication rate',
    'hint.cl':'Higher \u2192 more aversion to literal lies','hint.cd':'Higher \u2192 more aversion to manipulating beliefs',
    'hint.ratio':'Reputation-building incentive strength','hint.miscomm':'Prob. received message is flipped',
    'btn.run':'Run Experiment',
    'env.both':'Both (BT + GL)','env.bt':'BT \u2014 Bad-type truth-telling','env.gl':'GL \u2014 Good-type lying',
    'kpi.eq':'Equilibrium','kpi.la':'Lying-averse','kpi.da':'Deception-averse','kpi.ie':'Inference error','kpi.welfare':'Avg. welfare',
    'chart.params':'Utility Parameter Distributions','chart.joint':'Joint (c\u2097, c\u2084) Distribution',
    'chart.stratbt':'Strategy Distribution \u2014 BT','chart.stratgl':'Strategy Distribution \u2014 GL',
    'chart.types':'Agent Type Proportions','chart.regions':'Equilibrium Regions (c\u2097 vs c\u2084)',
    'log.title':'Sample game log',
    'arch.title':'Game System Architecture',
    'arch.desc':'Complete architecture of the multi-agent reputation game system. Click \u201cEdit in draw.io\u201d to modify the diagram.',
    'arch.edit':'Edit in draw.io',
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
    'label.clmean':'\u8bf4\u8c0e\u6210\u672c c\u2097 (\u5bf9\u6570\u6b63\u6001 \u03bc)','label.cdmean':'\u6b3a\u9a97\u6210\u672c c\u2084 (\u5bf9\u6570\u6b63\u6001 \u03bc)',
    'label.env':'\u535a\u5f08\u73af\u5883','label.rounds':'\u6bcf\u667a\u80fd\u4f53\u8f6e\u6570','label.ratio':'x\u2082/x\u2081 \u6bd4\u7387',
    'label.bp':'\u884c\u4e3a\u7c7b\u578b\u5148\u9a8c\u6982\u7387','label.miscomm':'\u4fe1\u606f\u8bef\u4f20\u7387',
    'hint.cl':'\u8d8a\u9ad8 \u2192 \u8d8a\u538c\u6076\u5b57\u9762\u8c0e\u8a00','hint.cd':'\u8d8a\u9ad8 \u2192 \u8d8a\u538c\u6076\u64cd\u7eb5\u4fe1\u5ff5',
    'hint.ratio':'\u58f0\u8a89\u5efa\u8bbe\u6fc0\u52b1\u5f3a\u5ea6','hint.miscomm':'\u63a5\u6536\u6d88\u606f\u88ab\u7ffb\u8f6c\u7684\u6982\u7387',
    'btn.run':'\u8fd0\u884c\u5b9e\u9a8c',
    'env.both':'\u4e24\u8005 (BT + GL)','env.bt':'BT \u2014 \u574f\u7c7b\u578b\u8bf4\u771f\u8bdd','env.gl':'GL \u2014 \u597d\u7c7b\u578b\u8bf4\u8c0e',
    'kpi.eq':'\u5747\u8861','kpi.la':'\u8bf4\u8c0e\u538c\u6076','kpi.da':'\u6b3a\u9a97\u538c\u6076','kpi.ie':'\u63a8\u65ad\u8bef\u5dee','kpi.welfare':'\u5e73\u5747\u798f\u5229',
    'chart.params':'\u6548\u7528\u53c2\u6570\u5206\u5e03','chart.joint':'(c\u2097, c\u2084) \u8054\u5408\u5206\u5e03',
    'chart.stratbt':'\u7b56\u7565\u5206\u5e03 \u2014 BT','chart.stratgl':'\u7b56\u7565\u5206\u5e03 \u2014 GL',
    'chart.types':'\u667a\u80fd\u4f53\u7c7b\u578b\u6bd4\u4f8b','chart.regions':'\u5747\u8861\u533a\u57df (c\u2097 vs c\u2084)',
    'log.title':'\u535a\u5f08\u65e5\u5fd7\u6837\u672c',
    'arch.title':'\u535a\u5f08\u7cfb\u7edf\u67b6\u6784',
    'arch.desc':'\u591a\u667a\u80fd\u4f53\u58f0\u8a89\u535a\u5f08\u7cfb\u7edf\u7684\u5b8c\u6574\u67b6\u6784\u3002\u70b9\u51fb\u201c\u5728 draw.io \u4e2d\u7f16\u8f91\u201d\u4ee5\u4fee\u6539\u56fe\u8868\u3002',
    'arch.edit':'\u5728 draw.io \u4e2d\u7f16\u8f91',
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
    if (dict[key]) el.textContent = dict[key];
  });
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }] });
  }
}
