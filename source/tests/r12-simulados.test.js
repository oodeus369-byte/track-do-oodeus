/**
 * Track do Oodeus — testes R12 (etapa-11: simulados.html, página "Simulados")
 *
 * Harness jsdom + vm.runInContext (padrão r9/r10/r11): body.html injetado
 * ANTES dos scripts; cadeia = ordem do original: chart.umd (vendored R9) →
 * IIFE sidebar (330-381) → script principal (384-3715) → timer-popup.js
 * (3721, por último como o <script src>). SEM html2canvas (única CDN da
 * página é o Chart.js 4.4.1). theme.js/data.js rodam ANTES (vm, como no
 * onload do plugin); nav.js NÃO roda (desvio R3). TrackTheme NÃO é
 * stubado: themePalette() usa o fallback literal e os ternários
 * window.TrackTheme ? alpha(...) : rgba-literal assumem o literal —
 * determinístico. Canvas 2D fake (jsdom não implementa canvas). Dead code
 * D1-D15 verbatim (doc-mestre): nada é corrigido.
 *
 * Asserções COPIADAS do probe de dump (convenção #2061): valores de runtime
 * vindos do probe-sim-dump (S1-S8), estáticos do fonte/originais.
 *
 * Decisões do Oodeus (spec etapa-11 §7) cobertas aqui:
 *  1. Gráfico de evolução = DESIGN LOLLIPOP adaptado ao vivo (seção C/E);
 *  2. formatPoints → formatPointsPt em TODOS os usos vivos (seções A/D);
 *  3. patch do card de corte pós-innerHTML em render() (seções A/E).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const simBodyHtml = read('pages/simulados/body.html');
const simMainSrc = read('pages/simulados/main.pagejs');
const simStyleSrc = read('pages/simulados/style.css');
const simScript1Src = read('pages/simulados/script1.pagejs');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');
const chartSrc = read('vendor/chart.umd.pagejs');

// Corpos SEM o header de comentário do port (contagens de dead code devem
// contar só o código, não a documentação).
const bodyCore = simBodyHtml.slice(simBodyHtml.indexOf('-->') + 3);
const mainBody = simMainSrc.slice(simMainSrc.indexOf('*/') + 2);
const styleCore = simStyleSrc.slice(simStyleSrc.indexOf('*/') + 2);
const script1Body = simScript1Src.slice(simScript1Src.indexOf('*/') + 2);

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + String(extra).slice(0, 400) : '')); console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); }
}

const vm = require('vm');
function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename });
}
const lex = (w, expr) => vm.runInContext(expr, w.__ctx, { filename: 'lex-snip' });
const tick = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => s.replace(/\r/g, '');

// Canvas 2D fake (mesmo padrão do r9/r11: contexto NÃO é array-like).
const CANVAS_VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'filter']);
function fake2dContext(canvas) {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return canvas;
      if (typeof p === 'symbol') return undefined;
      if (p === 'length' || p === '0' || p === '1') return undefined;
      if (CANVAS_VALUE_PROPS.has(p)) return t[p];
      if (p === 'measureText') return () => ({ width: 12, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 6, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 12 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      if (p === 'createPattern') return () => null;
      if (p === 'isPointInPath' || p === 'isPointInStroke') return () => false;
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

// Seed do Painel da Prova do simulado C (dumps S1-S8: 34/45 acertos,
// 68,5/100 pts, pct 75.6 — items/materias com pontos 28.5/40).
function dpSeed(mIds) {
  return {
    version: 2, origem: 'painel-prova', scoringMode: 'tradicional', errorPenalty: 1,
    totalAcertos: 34, totalEmBranco: 0, totalErros: 11, totalQuestoes: 45,
    questoesFeitas: 45, totalPontosObtidos: 68.5, totalPontosMax: 100,
    pct: 75.6, pctPonderada: 75.6, notaFinal10: null,
    minimumFailures: [], reprovadoMinimos: false, ignoredBlocks: [], ignoredPontos: 0,
    items: [
      { key: 'g1::' + mIds[0] + '::0', type: 'materia', groupId: 'g1', materiaId: mIds[0], nome: 'Direito Constitucional', groupName: 'Conhecimentos Gerais', questoes: 20, peso: 2, minPts: 0, groupMinPts: 0, scoringMode: 'tradicional', errorPenalty: 1, acertos: 14, emBranco: 0, erros: 6, pct: 70, nota10: null, pontosObtidos: 28.5, pontosMax: 40 },
      { key: 'g1::' + mIds[1] + '::1', type: 'materia', groupId: 'g1', materiaId: mIds[1], nome: 'Atualidades', groupName: 'Conhecimentos Gerais', questoes: 25, peso: 2, minPts: 0, groupMinPts: 0, scoringMode: 'tradicional', errorPenalty: 1, acertos: 20, emBranco: 0, erros: 5, pct: 80, nota10: null, pontosObtidos: 40, pontosMax: 50 },
    ],
    materias: [
      { materiaId: mIds[0], nome: 'Direito Constitucional', questoes: 20, acertos: 14, pct: 70, pontosObtidos: 28.5, pontosMax: 40 },
      { materiaId: mIds[1], nome: 'Atualidades', questoes: 25, acertos: 20, pct: 80, pontosObtidos: 40, pontosMax: 50 },
    ],
  };
}

// Seeds padrão R12: 4 sims — A pct70 (obs 'primeiro'), B pct80,
// C acertos 34/45 (desempenhoPainel + tempo 45min), D pendente com link.
function defaultSims(cId, mIds) {
  return [
    { concursoId: cId, nome: 'Gran Cursos - Simulado 1', criadoEm: '2026-10-10', tipo: 'realizado', pct: 70, obs: 'primeiro' },
    { concursoId: cId, nome: 'FGV Simulado 2', criadoEm: '2026-10-20', tipo: 'realizado', pct: 80 },
    { concursoId: cId, nome: 'Simulado com Raio-x', criadoEm: '2026-11-05', tipo: 'realizado', acertosTotal: 34, questoesTotal: 45, questoesFeitas: 45, tempoMinutos: 45, pontosObtidos: 68.5, pontosMax: 100, desempenhoPainel: dpSeed(mIds) },
    { concursoId: cId, nome: 'Simulado Pendente', criadoEm: '2026-11-10', tipo: 'pendente', link: 'https://example.com/sim', pct: null, obs: 'falta fazer' },
  ];
}

function bootSim({ noCid = false, sims = undefined, corte = null, painelCfg = false, preRun = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + simBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.ResizeObserver = w.ResizeObserver || function () { this.observe = () => {}; this.unobserve = () => {}; this.disconnect = () => {}; };
  const ctxMap = new Map();
  w.HTMLCanvasElement.prototype.getContext = function () {
    if (!ctxMap.has(this)) ctxMap.set(this, fake2dContext(this));
    return ctxMap.get(this);
  };
  global.window = w;
  const navSpy = [];
  initHost({
    data: {},
    persist: () => true,
    window: w,
    navigate: (p) => { navSpy.push(p); return true; },
    currentPage: () => '',
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_NAV_GO_PAGE = (p) => { navSpy.push('nav:' + p); };
  // TrackTheme NÃO é stubado — fallback literal da própria página
  vmRun(w, dataSrc, 'data.js');
  const cId = w.CT.saveConcurso({ nome: 'Defensoria 2027', cargo: 'Defensor', banca: 'FGV' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Atualidades' });
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  if (!noCid) w.sessionStorage.setItem('ct_concurso_ativo', cId);
  (sims === undefined ? defaultSims(cId, mIds) : sims).forEach(s => w.CT.saveSimulado(s));
  if (corte) w.CT.saveConcurso({ id: cId, ...corte });
  // Config do Painel da Prova compartilhada com cadastro_edital.html
  // (mesmo formato do modal v3: groups[].items {id,q,w}).
  if (painelCfg) w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify({
    scoringMode: 'tradicional', errorPenalty: 1,
    groups: [{ id: 'g1', name: 'Conhecimentos Gerais', items: [
      { id: mIds[0], q: 20, w: 2 },
      { id: mIds[1], q: 25, w: 2 },
    ] }],
  }));
  w.__CT_PAGE_SEARCH__ = '';
  w.__CT_PAGE_HASH__ = '';
  if (preRun) preRun(w, cId, mIds);
  vmRun(w, chartSrc, 'chart.umd');
  vmRun(w, simScript1Src, 'simulados.html [sidebar]');
  vmRun(w, simMainSrc, 'simulados.html [inline]');
  vmRun(w, timerSrc, 'timer-popup.js');
  return { dom: j, w, cId, mIds, navSpy };
}

async function awaitBoot(t, extra) {
  const w = t.w;
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r, { once: true }));
  await tick(extra || 80);
}

const txt = (w, id) => (w.document.getElementById(id) || {}).textContent;
const html = (w, id) => (w.document.getElementById(id) || {}).innerHTML;

function chartDump(w) {
  const c = lex(w, '_chartSim');
  if (!c) return null;
  return {
    datasets: c.config.data.datasets.map(d => ({
      label: d.label, type: d.type, data: d.data, borderColor: d.borderColor, borderWidth: d.borderWidth,
      borderDash: d.borderDash, tension: d.tension, fill: d.fill, pointRadius: d.pointRadius,
      pointBackgroundColor: d.pointBackgroundColor, pointBorderColor: d.pointBorderColor,
    })),
    plugins: (c.config.plugins || []).map(p => p.id),
    legendDisplay: c.config.options.plugins.legend && c.config.options.plugins.legend.display,
    tooltipLabelOut: c.config.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Nota' }, raw: 75.6 }),
    tooltipCorteOut: c.config.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Corte' }, raw: 72.5 }),
    tooltipMediaOut: c.config.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Média' }, raw: 75.2 }),
    // Sem callback afterBody no lollipop vivo → null (o dump JSON também
    // serializa undefined como null — convenção #2061).
    afterBodyOut: c.config.options.plugins.tooltip.callbacks.afterBody ? c.config.options.plugins.tooltip.callbacks.afterBody([{ dataIndex: 2 }]) : null,
    scales: { x: c.config.options.scales.x, y: c.config.options.scales.y },
    layout: c.config.options.layout,
    maintain: c.config.options.maintainAspectRatio,
  };
}

// Extrai os 4 valores das stat-cards (valor + cor) na ordem do DOM.
function statValues(w) {
  const re = /sim-stat-value" style="color:([^"]+)">([^<]*)</g;
  const out = [];
  let m;
  const h = html(w, 'simStats');
  while ((m = re.exec(h))) out.push({ color: m[1], value: m[2] });
  return out;
}

(async () => {
  console.log('== R12-A: fonte/registro/seams estáticos ==');
  {
    const iSim = shellSrc.indexOf("'simulados.html'");
    const block = iSim > -1 ? shellSrc.slice(iSim, iSim + 2600) : '';
    check('shell.js: simulados.html registrado com cadeia [chart.umd, script1 sidebar, main, timer-popup] NA ORDEM do original', iSim > -1
      && block.indexOf('../vendor/chart.umd.pagejs') > -1
      && block.indexOf('../pages/simulados/script1.pagejs') > block.indexOf('../vendor/chart.umd.pagejs')
      && block.indexOf('../pages/simulados/main.pagejs') > block.indexOf('../pages/simulados/script1.pagejs')
      && block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/simulados/main.pagejs'));
    check('shell.js: SEM html2canvas no bloco (página usa só Chart.js 4.4.1 CDN — grep 0 ocorrências no original)', !block.includes('html2canvas'));
    check('shell.js: title "Simulados" + icon lucide clipboard-list + timer-popup POR ÚLTIMO + lazyModules []', block.includes("title: 'Simulados'") && block.includes("icon: 'clipboard-list'") && block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/simulados/main.pagejs') && /lazyModules:\s*\[\]/.test(block));
    check('shell.js: header [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]'));
    check('shell.js: dashboard/revisoes/historico/concursos seguem registrados (sem edit acidental)', ["'dashboard.html'", "'revisoes.html'", "'historico.html'", "'concursos.html'"].every(x => shellSrc.includes(x)));
    check('main.js R9: navigateTo preserva hash (pendingPageHash) + __CT_PAGE_SEARCH__/__CT_PAGE_HASH__ no shell (regressão)', mainPluginSrc.includes('this.pendingPageHash = hash;') && shellSrc.includes('window.__CT_PAGE_SEARCH__') && shellSrc.includes('window.__CT_PAGE_HASH__'));

    check('body.html: 9 onclick goPage (logo 234 + nav-items) + flashcards sessionStorage preservado + <a href="ajuda.html"> com goPage+return false', (simBodyHtml.match(/onclick="goPage\('/g) || []).length === 9
      && simBodyHtml.includes("goPage('dashboard.html#flashcards')")
      && simBodyHtml.includes("sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')")
      && simBodyHtml.includes('<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false"'));
    check('body.html: SEM location.href restante (fora do header de comentário)', !/location\.href/.test(bodyCore));
    check('body.html: logo é o 1º goPage (concursos.html) + nav-item active Simulados', simBodyHtml.indexOf('brand-logo') < simBodyHtml.indexOf("onclick=\"goPage('concursos.html')\"") && /class="nav-item active" onclick="goPage\('simulados\.html'\)"/.test(simBodyHtml));
    check('body.html: ids vivos todos presentes (simSub/simStats/simChartWrap/chartSimStage/simChartSub/listaSimulados/simMateriaChartWrap/simMateriaChartStage/simMateriaChartSub/simMateriaResumo/simMateriaMetric/sideNome/sideBanca/sideTimer/sideTimerLabel/revBadge/sideLogoImg/flashTabBadge)', ['simSub', 'simStats', 'simChartWrap', 'chartSimStage', 'simChartSub', 'listaSimulados', 'simMateriaChartWrap', 'simMateriaChartStage', 'simMateriaChartSub', 'simMateriaResumo', 'simMateriaMetric', 'sideNome', 'sideBanca', 'sideTimer', 'sideTimerLabel', 'revBadge', 'sideLogoImg', 'flashTabBadge'].every(id => simBodyHtml.includes('id="' + id + '"')));
    check('body.html: simSub default "Acompanhe sua evolução" + sideNome/sideBanca default "—"', simBodyHtml.includes('>Acompanhe sua evolução</div>') && simBodyHtml.includes('id="sideNome">—<'));

    check('style.css: CSS morto D14 verbatim (RANKING SIMULADOS + POPUP NOVO SIMULADO, 16 classes)', ['.ranking-list', '.rank-row', '.rank-pos', '.rank-nome', '.rank-pct', '.section-divider', '.popup-overlay', '.popup-title', '.form-group', '.form-label', '.form-input', '.tipo-opts', '.tipo-opt', '.popup-btns', '.btn-cancel', '.btn-salvar'].every(x => styleCore.includes(x)));
    check('style.css: CSS vivo preservado (.sim-select, .ph-meta, spinners webkit escondidos)', ['.sim-select', '.ph-meta', '::-webkit-inner-spin-button'].every(x => styleCore.includes(x)));

    check('main.pagejs: goPage local delega a __CT_NAV_GO_PAGE (precedente revisões/aba-materia)', simMainSrc.includes('function goPage(dest) {') && simMainSrc.includes('if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }'));
    check('main.pagejs: seam 385 — redirect sem cId SEM return (o location.href original não interrompe; boot segue até render())', norm(simMainSrc).includes("if (!cId) goPage('concursos.html');") && !/if \(!cId\) goPage\('concursos\.html'\); return/.test(norm(simMainSrc)));
    check('main.pagejs: script CLÁSSICO — SEM IIFE e SEM \'use strict\' (terceiro estilo do app, etapa-11 §1)', !mainBody.includes("'use strict'"));

    // Decisão 1 (lollipop) no fonte: escopo da função VIVA renderGraficoGeral.
    const rgStart = mainBody.indexOf('function renderGraficoGeral(simsFeitos, tendencia, media, notaCorteMeta) {');
    const rgEnd = mainBody.indexOf('function renderListaSimuladosDetalhada', rgStart);
    const liveRg = rgStart > -1 && rgEnd > rgStart ? mainBody.slice(rgStart, rgEnd) : '';
    check('decisão 1: renderGraficoGeral viva ÚNICA e isolável (1758-1935, termina antes de renderListaSimuladosDetalhada)', rgStart > -1 && rgEnd > rgStart && liveRg.length > 0);
    check('decisão 1 (estático): corpo viva com plugin simuladosLollipop + legend display:false + formatPercentPt + chartValue + formatNotaCorteTooltip + stage clamp(280,430,240+16×N)', liveRg.includes("id: 'simuladosLollipop'")
      && liveRg.includes('legend: { display: false }')
      && liveRg.includes('formatPercentPt(')
      && liveRg.includes('notaCorteMeta.chartValue')
      && liveRg.includes('formatNotaCorteTooltip(notaCorteMeta)')
      && liveRg.includes('Math.max(280, Math.min(430, 240 + (simsFeitos.length * 16)))'));
    check('decisão 1 (estático): função viva SEM gráfico de barras (maxBarThickness/type bar ausentes) — o único maxBarThickness do arquivo é o D1 morto', !liveRg.includes('maxBarThickness') && !liveRg.includes("type: 'bar'") && (mainBody.match(/maxBarThickness/g) || []).length === 1);
    check('decisão 1: gráfico de barras/lollipop MORTOS preservados (D1: if (false) ×2 + "Grafico final" + stats antigas s.pct+%)', (mainBody.match(/if \(false && simsFeitos/g) || []).length === 2 && mainBody.includes('Grafico final') && mainBody.includes("s.pct+'%'") && (mainBody.match(/simuladosLollipop/g) || []).length === 2);

    // Decisão 2 (formatPointsPt em todos os usos vivos).
    const nFmt = (mainBody.match(/formatPoints\(/g) || []).length;
    const nFmtPt = (mainBody.match(/formatPointsPt\(/g) || []).length;
    check('decisão 2: formatPoints( só no def + D11 + D12 (5 ocorrências); formatPointsPt( 19 (def + 8 pré-existentes + 10 convertidos)', nFmt === 5 && nFmtPt === 19, 'fmt=' + nFmt + ' fmtPt=' + nFmtPt);
    check('decisão 2: usos VIVOS convertidos — lista RAIO-X, formatPainelMinimumScore, linhas do painel, resumo (6 linhas verificadas)', [
      'formatPointsPt(sim.desempenhoPainel.totalPontosObtidos)}/${formatPointsPt(sim.desempenhoPainel.totalPontosMax)}',
      'return mode === \'media_areas\' ? formatGrade10(value) : formatPointsPt(value);',
      'máximo ${formatPointsPt(entry.pontosMax)} pts',
      '${formatPointsPt(state.pontosObtidos)} pts',
      '${formatPointsPt(totalPontos)}/${formatPointsPt(painelInfo.totalPontos)} pts',
      '${formatPointsPt(ultimoPontos)} pts',
    ].every(x => mainBody.includes(x)));
    check('decisão 2: def formatPoints(1343) + usos MORTOS D11/D12 verbatim (máximo … formatPoints(entry.pontosMax), ptsEl formatPoints(pontos), resumo formatPoints(totalPontos))', mainBody.includes('function formatPoints(value) {')
      && mainBody.includes('máximo ${formatPoints(entry.pontosMax)} pts')
      && mainBody.includes('ptsEl.textContent = `${formatPoints(pontos)} pts`')
      && mainBody.includes('${formatPoints(totalPontos)}/${formatPoints(painelInfo.totalPontos)} pts'));

    // Decisão 3: patch do card de corte em render().
    check('decisão 3: patch pós-innerHTML em render() — corteStatValue.textContent = notaCorteMeta.display', mainBody.includes("if (corteStatValue) corteStatValue.textContent = notaCorteMeta.value != null ? notaCorteMeta.display : '—';"));

    // Dead code D1-D15 (contagens de preservação).
    check('D1 — render() antigo: function render( ×1 + render = function ×1 (reatribuição 2329)', (mainBody.match(/function render\(/g) || []).length === 1 && (mainBody.match(/render = function/g) || []).length === 1);
    check('D2/D4/v3 — abrirModalSimulado: 1 declaração (v1) + 2 assignments (v2 D4 + v3 vivo) + "Notas por matéria (opcional)" ×2', (mainBody.match(/function abrirModalSimulado\(/g) || []).length === 1 && (mainBody.match(/abrirModalSimulado = function/g) || []).length === 2 && (mainBody.match(/Notas por matéria \(opcional\)/g) || []).length === 2);
    check('D3/D4/v3 — salvarSimulado: 1 declaração (v1) + 2 assignments (v2 D4 + v3 vivo)', (mainBody.match(/function salvarSimulado\(/g) || []).length === 1 && (mainBody.match(/salvarSimulado = function/g) || []).length === 2);
    check('D4/v2 — alternarCamposSimulado: 1 declaração + 2 assignments', (mainBody.match(/function alternarCamposSimulado\(/g) || []).length === 1 && (mainBody.match(/alternarCamposSimulado = function/g) || []).length === 2);
    check('D5 — deletarSimulado v1 verbatim (filtro concursoId preserva outros concursos) + v2 assignment vivo', mainBody.includes('async function deletarSimulado(id)') && mainBody.includes('s.concursoId!==cId||s.id!==id') && (mainBody.match(/deletarSimulado = async function/g) || []).length === 1);
    check('D6 — abrirModalCorte/salvarCorte v1: título "🎯 Nota de corte" + alert(\'Valor inválido!\') COM acento; v2 vivo com alert(\'Valor inválido!\') — R14 normalizou o v2 (antes sem acento)', mainBody.includes('🎯 Nota de corte') && (mainBody.match(/alert\('Valor inválido!'\)/g) || []).length === 2 && (mainBody.match(/abrirModalCorte = function/g) || []).length === 2 && (mainBody.match(/salvarCorte = function/g) || []).length === 2);
    check('D7-D13 — gerações antigas: loadPainelProvaConfig/getPainelMateriaInfo/buildMateriaOverviewState/renderGraficoMateria/buildPainelAutoRowsHTML/atualizarResumoPainelSimulado/buildPainelSnapshotFromModal ×2 cada + snapshot version: 1', ['function loadPainelProvaConfig(', 'function getPainelMateriaInfo(', 'function buildMateriaOverviewState(', 'function renderGraficoMateria(', 'function buildPainelAutoRowsHTML(', 'function atualizarResumoPainelSimulado(', 'function buildPainelSnapshotFromModal('].every(p => (mainBody.match(new RegExp(p.replace(/[()]/g, '\\$&'), 'g')) || []).length === 2) && (mainBody.match(/version: 1/g) || []).length === 1);
    check('D15 — renderDeltaInline ÓRFÃ: definida 1× e chamada 0× (só a declaração)', (mainBody.match(/function renderDeltaInline\(/g) || []).length === 1 && (mainBody.match(/renderDeltaInline\(/g) || []).length === 1);
    check('getNotaCorteMaxObjetiva: cadastro (pontuacaoMax) PRIMEIRO, depois sims reverse, depois painel — precedência documentada', mainBody.indexOf('const cadastroMax = Number(concurso?.pontuacaoMax);') < mainBody.indexOf('const sims = Array.isArray(simsFeitos) ? [...simsFeitos].reverse() : [];'));

    check('script1.pagejs: IIFE sidebar VERBATIM (330-381) — SEM seams, sem TrackTheme desprotegido, revBadge por concurso', script1Body.includes('SIDEBAR CONCURSO') && script1Body.includes("getElementById('sideNome')") && script1Body.includes('revBadge') && !script1Body.includes('goPage') && !/TrackTheme/.test(script1Body));
    check('package.json/runner: test:r12 registrado', JSON.parse(read('package.json')).scripts['test:r12'] === 'node tests/r12-simulados.test.js');
  }

  console.log('== R12-B: boot/guards ==');
  {
    const t = bootSim({ noCid: true });
    await awaitBoot(t, 120);
    check('guard 385: sem ct_concurso_ativo → goPage concursos.html (navSpy)', t.navSpy.includes('nav:concursos.html'), JSON.stringify(t.navSpy));
    check('redirect SEM return: execução segue até render() — que sai cedo (concurso não resolve): simSub mantém o default do body e statsVazio', t.w.document.getElementById('simSub').textContent === 'Acompanhe sua evolução' && t.w.document.getElementById('simStats').innerHTML === '');
    check('IIFE sidebar sem cId → early return (sideNome mantém o "—" do body) + lista vazia', t.w.document.getElementById('sideNome').textContent === '—' && t.w.document.getElementById('listaSimulados').innerHTML === '');
  }
  {
    const t = bootSim({});
    await awaitBoot(t, 150);
    check('boot com cId: simSub "Defensoria 2027 — 3 realizado(s) • 1 pendente(s)"', t.w.document.getElementById('simSub').textContent === 'Defensoria 2027 — 3 realizado(s) • 1 pendente(s)', t.w.document.getElementById('simSub').textContent);
    check('duplicação: render() reescreve .concurso-nome/.concurso-banca que a IIFE já escreveu (sideNome/sideBanca corretos)', t.w.document.querySelector('.concurso-nome').textContent === 'Defensoria 2027' && t.w.document.querySelector('.concurso-banca').textContent === 'FGV');
    check('boot normal: NENHUMA navegação disparada (navSpy vazio)', t.navSpy.length === 0, JSON.stringify(t.navSpy));
  }

  console.log('== R12-C: render/stats/gráfico lollipop/lista ==');
  {
    const t = bootSim({});
    await awaitBoot(t, 150);
    const w = t.w;
    const stats = statValues(w);
    const statsH = html(w, 'simStats');
    check('stats: 4 cards na ordem achievement/exam/average/target-color com cores yellow/accent/accent2/green', (statsH.match(/data-sim-stat-icon="([^"]+)"/g) || []).join(',') === 'data-sim-stat-icon="achievement",data-sim-stat-icon="exam",data-sim-stat-icon="average",data-sim-stat-icon="target-color"'
      && /data-sim-stat-icon="achievement" aria-hidden="true" style="color:var\(--yellow\)"/.test(statsH)
      && /data-sim-stat-icon="exam" aria-hidden="true" style="color:var\(--accent\)"/.test(statsH)
      && /data-sim-stat-icon="average" aria-hidden="true" style="color:var\(--accent2\)"/.test(statsH)
      && /data-sim-stat-icon="target-color" aria-hidden="true" style="color:var\(--green\)"/.test(statsH));
    check('stats: valores 80% (score-good) / 75.6% (score-ok) / 75.2% (score-ok) / — (yellow) + labels Melhor nota/Último simulado/Média geral/Nota de corte', stats.length === 4
      && stats[0].value === '80%' && stats[0].color === 'var(--score-good)'
      && stats[1].value === '75.6%' && stats[1].color === 'var(--score-ok)'
      && stats[2].value === '75.2%' && stats[2].color === 'var(--score-ok)'
      && stats[3].value === '—' && stats[3].color === 'var(--yellow)'
      && ['Melhor nota', 'Último simulado', 'Média geral', 'Nota de corte'].every(x => statsH.includes(x)), JSON.stringify(stats));
    check('stats: delta do último "↑ +0.4%" (formatDiff COM +) + "em relação à média geral" + Tempo "45min • 45 • 1 min/q"', statsH.includes('↑ +0.4%') && statsH.includes('em relação à média geral') && statsH.includes('Tempo: <strong style="color:var(--text2)">45min</strong>') && statsH.includes('<strong style="color:var(--text2)">45</strong> questões feitas') && statsH.includes('1 min/q'));
    check('stats: card de corte clicável (onclick abrirModalCorte())', statsH.includes('onclick="abrirModalCorte()"'));

    const cd = chartDump(w);
    check('gráfico lollipop: Nota line [70,80,75.6] accent2 alpha 0.32 + pointRadius [5,5,7] + bg vars (pctColor) + borda #0f1220', !!cd
      && cd.datasets[0].label === 'Nota' && cd.datasets[0].data.join(',') === '70,80,75.6'
      && cd.datasets[0].borderColor === 'rgba(124,92,252,0.32)' && cd.datasets[0].borderWidth === 2 && cd.datasets[0].tension === 0.35 && cd.datasets[0].fill === false
      && cd.datasets[0].pointRadius.join(',') === '5,5,7'
      && cd.datasets[0].pointBackgroundColor.join(',') === 'var(--score-mid),var(--score-good),var(--score-ok)'
      && cd.datasets[0].pointBorderColor === '#0f1220', JSON.stringify(cd && cd.datasets[0]));
    check('gráfico lollipop: plugins [simuladosLollipop] + legend display:false + maintainAspectRatio false + layout pad 20/8/8/0', !!cd
      && cd.plugins.join(',') === 'simuladosLollipop' && cd.legendDisplay === false && cd.maintain === false
      && cd.layout.padding.top === 20 && cd.layout.padding.right === 8 && cd.layout.padding.left === 8 && cd.layout.padding.bottom === 0);
    check('gráfico: SEM dataset Corte (sem corte salvo) + Média [75.2×3] accent2 0.68 dash [4,4] pointRadius 0', !!cd
      && !cd.datasets.some(d => d.label === 'Corte')
      && cd.datasets.some(d => d.label === 'Média' && d.data.join(',') === '75.2,75.2,75.2' && d.borderColor === 'rgba(124,92,252,0.68)' && d.borderDash.join(',') === '4,4' && d.pointRadius === 0));
    check('gráfico tooltips: " Nota: 75,6%" + " Média geral: 75,2%" + corte null → " Nota de corte: —" + SEM afterBody (decisão 1)', !!cd
      && cd.tooltipLabelOut === ' Nota: 75,6%' && cd.tooltipMediaOut === ' Média geral: 75,2%'
      && cd.tooltipCorteOut === ' Nota de corte: —' && cd.afterBodyOut === null);
    check('escalas do lollipop: y grid rgba(255,255,255,0.05) 0–100 ticks #555a72 + x grid display:false ticks #c8cde2', !!cd
      && cd.scales.y.grid.color === 'rgba(255,255,255,0.05)' && cd.scales.y.min === 0 && cd.scales.y.max === 100 && cd.scales.y.ticks.color === '#555a72'
      && cd.scales.x.grid.display === false && cd.scales.x.ticks.color === '#c8cde2');
    check('stage height 288px (3 sims: clamp 240+16×3)', w.document.getElementById('chartSimStage').style.height === '288px', w.document.getElementById('chartSimStage').style.height);
    const sub = html(w, 'simChartSub');
    check('sub do gráfico: "Desempenho do Simulado mais recente" 75,6% • 68,5 pts + deltas "↓ 4,4%" (vírgula) e "↑ 0,4% e • 0 pts"', sub.includes('Desempenho do Simulado mais recente:')
      && sub.includes('75,6%') && sub.includes('68,5 pts')
      && sub.includes('↓ 4,4%') && sub.includes('em relação ao anterior')
      && sub.includes('↑ 0,4%') && sub.includes('• 0 pts') && sub.includes('em relação à média geral'));

    const lista = html(w, 'listaSimulados');
    check('lista: seção "Para fazer" ANTES de "Realizados" + pendente PENDENTE roxo + obs + 🔗 link', lista.indexOf('Para fazer') < lista.indexOf('Realizados')
      && lista.includes('>PENDENTE<') && lista.includes('rgba(124,92,252,0.12)') && lista.includes('falta fazer') && lista.includes('🔗 https://example.com/sim'));
    check('lista pendente: 4 botões — a href target _blank "▶ Fazer Simulado" + "✓ Registrar resultado" (abrirModalSimulado(id,true)) + ✏️ + ✕', (() => {
      const i = lista.indexOf('Simulado Pendente');
      const chunk = lista.slice(i, i + 2600);
      return chunk.includes('target="_blank" rel="noopener noreferrer"') && chunk.includes('▶ Fazer Simulado')
        && /abrirModalSimulado\('[a-z0-9]+', true\)/.test(chunk) && chunk.includes('✓ Registrar resultado')
        && chunk.includes('✏️') && chunk.includes('deletarSimulado(this.dataset.sid)');
    })());
    check('lista realizados na ordem C → B → A (criadoEm desc) com RAIO-X "34/45 acertos • 68,5/100 pts" (vírgula, decisão 2) + Tempo "45min • 45 • 1 min/q"', (() => {
      const iC = lista.indexOf('Simulado com Raio-x');
      const iB = lista.indexOf('FGV Simulado 2');
      const iA = lista.indexOf('Gran Cursos - Simulado 1');
      return iC > -1 && iB > iC && iA > iB
        && lista.includes('34/45 acertos • 68,5/100 pts') && lista.includes('RAIO-X')
        && lista.includes('Tempo: <strong style="color:var(--text2)">45min</strong>') && lista.includes('1 min/q');
    })(), lista.slice(0, 400));
    check('lista: diffs do item C "↓ 4.4%" (formatDiff PONTO, fora das decisões) + pct "75.6%" score-ok; B "↑ +10%" score-good "80%"; A "—" score-mid "70%" + obs "primeiro"', lista.includes('↓ 4.4%')
      && lista.includes('>75.6%<') && lista.includes('color:var(--score-ok)')
      && lista.includes('↑ +10%') && lista.includes('>80%<') && lista.includes('color:var(--score-good)')
      && lista.includes('—') && lista.includes('>70%<') && lista.includes('color:var(--score-mid)') && lista.includes('primeiro'));
    check('QUIRK lista×sub: diff PONTO na lista ("↓ 4.4%") e VÍRGULA no sub ("↓ 4,4%") — formatters distintos preservados', lista.includes('↓ 4.4%') && sub.includes('↓ 4,4%'));
    check('QUIRK stats: formatPercent PONTO ("75.6%", "75.2%") — fora das decisões, mantido', statsH.includes('75.6%') && statsH.includes('75.2%'));

    check('raio-x: wrap visível + sub "2 matéria(s) analisadas • comparativo por percentual • 0 com comparação ao simulado anterior"', w.document.getElementById('simMateriaChartWrap').style.display === ''
      && txt(w, 'simMateriaChartSub') === '2 matéria(s) analisadas • comparativo por percentual • 0 com comparação ao simulado anterior', txt(w, 'simMateriaChartSub'));
    check('resumo raio-x: "Maior facilidade" #9cf7cc Atualidades 80% 40 pts 1 sim. / "Maior dificuldade" #f5874a DC 70% 28,5 pts + "Sem simulado anterior"', (() => {
      const h = html(w, 'simMateriaResumo');
      const iFac = h.indexOf('Maior facilidade');
      const iDif = h.indexOf('Maior dificuldade');
      const cAtual = h.indexOf('Atualidades', iFac);
      const cDC = h.indexOf('Direito Constitucional', iDif);
      return iFac > -1 && iDif > iFac && cAtual > iFac && cDC > iDif
        && h.includes('color:#9cf7cc') && h.includes('color:#f5874a')
        && h.includes('>80%<') && h.includes('40 pts') && h.includes('>70%<') && h.includes('28,5 pts')
        && h.includes('1 sim.') && h.includes('Sem simulado anterior');
    })(), html(w, 'simMateriaResumo').slice(0, 600));
    check('sidebar: nome/banca ok + timer "—" label "dias para a prova" + revBadge "0" + sideLogoImg vazio', txt(w, 'sideNome') === 'Defensoria 2027' && txt(w, 'sideBanca') === 'FGV'
      && txt(w, 'sideTimer') === '—' && txt(w, 'sideTimerLabel') === 'dias para a prova' && txt(w, 'revBadge') === '0' && txt(w, 'sideLogoImg') === '');

    check('re-render não acumula charts (destroy antes de recriar)', (() => {
      const before = lex(w, 'Object.keys(Chart.instances || {}).length');
      w.render();
      const after = lex(w, 'Object.keys(Chart.instances || {}).length');
      return before === after && after > 0;
    })(), String(lex(w, 'Object.keys(Chart.instances || {}).length')));

    // deletarSimulado v2: gravação DIRETA em localStorage (bypass da API CT)
    w.CT.confirm = () => Promise.resolve(true);
    const antes = w.CT.getSimulados(t.cId).length;
    const alvo = w.CT.getSimulados(t.cId).find(s => s.nome === 'FGV Simulado 2');
    await lex(w, 'deletarSimulado(' + JSON.stringify(alvo.id) + ')');
    await tick(30);
    const raw = JSON.parse(w.localStorage.getItem('ct_simulados')).map(s => s.nome);
    check('deletar: confirm true → 4→3 no localStorage DIRETO (só por id, sem filtro de concurso — v2) + FGV fora', antes === 4 && w.CT.getSimulados(t.cId).length === 3 && raw.length === 3 && !raw.includes('FGV Simulado 2'), JSON.stringify(raw));
    check('deletar: simSub re-render "2 realizado(s) • 1 pendente(s)"', txt(w, 'simSub') === 'Defensoria 2027 — 2 realizado(s) • 1 pendente(s)', txt(w, 'simSub'));
  }

  console.log('== R12-D: modal de registro (painel automático/manual/pendente) ==');
  {
    const t = bootSim({ painelCfg: true });
    await awaitBoot(t, 150);
    const w = t.w;
    const alertSpy = [];
    w.alert = (m) => alertSpy.push(m);
    const hojeBR = (() => { const p = w.CT._today().split('-'); return p[2] + '/' + p[1] + '/' + p[0]; })();

    lex(w, 'abrirModalSimulado(null)');
    await tick(80);
    check('modal novo: existe + selects tipo "realizado" modo "automatico" (painelCfg presente)', !!w.document.getElementById('modalSim')
      && w.document.getElementById('simTipo').value === 'realizado' && w.document.getElementById('simModoCalc').value === 'automatico');
    check('modal novo: wraps — questões/link/nota NONE, painel e modo VISIBLE, bloco de matérias existe', w.document.getElementById('simQuestoesFeitasWrap').style.display === 'none'
      && w.document.getElementById('simLinkWrap').style.display === 'none'
      && w.document.getElementById('simNotaWrap').style.display === 'none'
      && w.document.getElementById('simPainelWrap').style.display === ''
      && w.document.getElementById('simModoWrap').style.display === ''
      && !!w.document.getElementById('simMateriasWrap'));
    check('painel automático: título "Raio-x automático por matéria" + resumo inicial 0% score-low "0/45 acertos • 0/90 pts" + "Nota ponderada: 0%" + "0/2" + "2 matéria(s) ainda sem dados completos"', (() => {
      const p = html(w, 'simPainelWrap');
      const r = html(w, 'simPainelSummary');
      return p.includes('Raio-x automático por matéria') && p.includes('Preencha os acertos de cada matéria')
        && r.includes('color:var(--score-low)">0%<') && r.includes('0/45 acertos • 0/90 pts') && r.includes('Nota ponderada: 0%')
        && r.includes('>0/2<') && r.includes('2 matéria(s) ainda sem dados completos');
    })(), html(w, 'simPainelSummary').slice(0, 400));
    const inputs = [...w.document.querySelectorAll('#simPainelWrap input[id^="spaInput_"]')];
    check('painel automático: 2 inputs spaInput_0 max 20 / spaInput_1 max 25 (peso 2 × questões da config)', inputs.length === 2
      && inputs[0].id === 'spaInput_0' && inputs[0].max === '20' && inputs[1].id === 'spaInput_1' && inputs[1].max === '25', JSON.stringify(inputs.map(i => ({ id: i.id, max: i.max }))));
    check('painel automático: linha da matéria UPPERCASE + acentos normalizados R14 — "DIREITO CONSTITUCIONAL" + "Conhecimentos Gerais - 20 questões - peso 2 - máximo 40 pts"', (() => {
      const p = html(w, 'simPainelWrap');
      return p.includes('DIREITO CONSTITUCIONAL') && p.includes('Conhecimentos Gerais - 20 questões - peso 2 - máximo 40 pts');
    })());

    // BLOQUEIO: blocos vazios → alert do 1º bloco + highlight + modal aberto
    w.document.getElementById('simNome').value = 'Bloqueado';
    lex(w, 'salvarSimulado()');
    await tick(30);
    check('bloqueio automático (blocos vazios): alert "Preencha os dados de DIREITO CONSTITUCIONAL para usar o cálculo automático." + modal ABERTO + nada salvo', alertSpy.length === 1
      && alertSpy[0] === 'Preencha os dados de DIREITO CONSTITUCIONAL para usar o cálculo automático.'
      && !!w.document.getElementById('modalSim')
      && !w.CT.getSimulados(t.cId).some(s => s.nome === 'Bloqueado') && w.CT.getSimulados(t.cId).length === 4, JSON.stringify(alertSpy));
    check('bloqueio automático: highlightInput no 1º input (borderColor var(--red) — restaura em 1200ms)', inputs[0].style.borderColor === 'var(--red)', inputs[0].style.borderColor);
    alertSpy.length = 0;

    // Preenche 14/20 e 20/25 → resumo completo
    inputs[0].value = '14';
    inputs[1].value = '20';
    inputs[0].dispatchEvent(new w.Event('input', { bubbles: true }));
    inputs[1].dispatchEvent(new w.Event('input', { bubbles: true }));
    lex(w, 'atualizarResumoPainelSimulado()');
    await tick(20);
    check('resumo preenchido: "75.6%" score-ok (PONTO — quirk preservado) + "34/45 acertos • 68/90 pts" (VÍRGULA, decisão 2) + "Nota ponderada: 75.6%"', (() => {
      const r = html(w, 'simPainelSummary');
      return r.includes('color:var(--score-ok)">75.6%<') && r.includes('34/45 acertos • 68/90 pts') && r.includes('Nota ponderada: 75.6%');
    })(), html(w, 'simPainelSummary').slice(0, 400));
    check('resumo preenchido: "2/2" verde + "Tudo pronto para calcular"', (() => {
      const r = html(w, 'simPainelSummary');
      return r.includes('color:var(--green)">2/2<') && r.includes('Tudo pronto para calcular');
    })());

    // Salva (tempo 1h30 + nome)
    w.document.getElementById('simTempoHoras').value = '1';
    w.document.getElementById('simTempoMinutos').value = '30';
    w.document.getElementById('simNome').value = 'Simulado Novo';
    lex(w, 'salvarSimulado()');
    await tick(30);
    const novo = w.CT.getSimulados(t.cId).find(s => s.nome === 'Simulado Novo');
    check('salvar automático: SEM alert + modal FECHADO + total 5 + campos base (pct 75.6, notas 70/80, acertos 34/45, tempo 90min, pts 68/90)', alertSpy.length === 0
      && !w.document.getElementById('modalSim') && w.CT.getSimulados(t.cId).length === 5 && !!novo
      && novo.tipo === 'realizado' && novo.pct === 75.6 && novo.obs === '' && novo.link === ''
      && novo.notasMaterias[t.mIds[0]] === 70 && novo.notasMaterias[t.mIds[1]] === 80
      && novo.acertosTotal === 34 && novo.questoesTotal === 45 && novo.questoesFeitas === 45
      && novo.tempoMinutos === 90 && novo.pontosObtidos === 68 && novo.pontosMax === 90
      && novo.criadoEm === w.CT._today(), JSON.stringify(novo && { pct: novo.pct, tempo: novo.tempoMinutos }));
    check('salvar automático: desempenhoPainel v2 — version 2, scoringMode tradicional, totals 34/68/90, ignoredBlocks 0 (número), minimumFailures []', !!novo && novo.desempenhoPainel
      && novo.desempenhoPainel.version === 2 && novo.desempenhoPainel.scoringMode === 'tradicional'
      && novo.desempenhoPainel.totalAcertos === 34 && novo.desempenhoPainel.totalPontosObtidos === 68 && novo.desempenhoPainel.totalPontosMax === 90
      && novo.desempenhoPainel.ignoredBlocks === 0 && Array.isArray(novo.desempenhoPainel.minimumFailures) && novo.desempenhoPainel.minimumFailures.length === 0);
    check('salvar automático: items do snapshot UPPERCASE — DIREITO CONSTITUCIONAL (14 acertos, 70%, 28/40 pts, peso 2, grupo "Conhecimentos Gerais") + ATUALIDADES (20, 80%, 40/50) + materias ×2', !!novo && novo.desempenhoPainel.items.length === 2
      && novo.desempenhoPainel.items[0].nome === 'DIREITO CONSTITUCIONAL' && novo.desempenhoPainel.items[0].acertos === 14 && novo.desempenhoPainel.items[0].pct === 70
      && novo.desempenhoPainel.items[0].pontosObtidos === 28 && novo.desempenhoPainel.items[0].pontosMax === 40 && novo.desempenhoPainel.items[0].questoes === 20
      && novo.desempenhoPainel.items[0].peso === 2 && novo.desempenhoPainel.items[0].groupName === 'Conhecimentos Gerais'
      && novo.desempenhoPainel.items[1].nome === 'ATUALIDADES' && novo.desempenhoPainel.items[1].acertos === 20 && novo.desempenhoPainel.items[1].pct === 80
      && novo.desempenhoPainel.items[1].pontosObtidos === 40 && novo.desempenhoPainel.items[1].pontosMax === 50
      && novo.desempenhoPainel.materias.length === 2);
    check('após salvar: simSub "4 realizado(s) • 1 pendente(s)"', txt(w, 'simSub') === 'Defensoria 2027 — 4 realizado(s) • 1 pendente(s)', txt(w, 'simSub'));
    check('lista após salvar: item de hoje (dd/mm) + RAIO-X "34/45 acertos • 68/90 pts" (vírgula) + Tempo "1h30 • 45 • 2 min/q" + diff "↑ 0%" + pct "75.6%"', (() => {
      const l = html(w, 'listaSimulados');
      const i = l.indexOf('Simulado Novo');
      const chunk = i > -1 ? l.slice(i - 400, i + 900) : '';
      return i > -1 && chunk.includes(hojeBR) && chunk.includes('34/45 acertos • 68/90 pts') && chunk.includes('RAIO-X')
        && chunk.includes('1h30') && chunk.includes('2 min/q') && chunk.includes('↑ 0%') && chunk.includes('>75.6%<');
    })(), html(w, 'listaSimulados').slice(Math.max(0, html(w, 'listaSimulados').indexOf('Simulado Novo') - 200), html(w, 'listaSimulados').indexOf('Simulado Novo') + 700));

    // Edição de sim COM desempenhoPainel (modo automático reabre preenchido)
    const comRaio = w.CT.getSimulados(t.cId).find(s => s.nome === 'Simulado com Raio-x');
    lex(w, 'abrirModalSimulado(' + JSON.stringify(comRaio.id) + ')');
    await tick(80);
    check('edição sim C: selects realizado/automatico + spaInputs 14/20 preenchidos + tempo 0h45 + questoes/nota VAZIOS (painel presente)', w.document.getElementById('simTipo').value === 'realizado'
      && w.document.getElementById('simModoCalc').value === 'automatico'
      && [...w.document.querySelectorAll('#simPainelWrap input[id^="spaInput_"]')].map(i => i.value).join(',') === '14,20'
      && w.document.getElementById('simTempoHoras').value === '0' && w.document.getElementById('simTempoMinutos').value === '45'
      && w.document.getElementById('simQuestoesFeitas').value === '' && w.document.getElementById('simNota').value === '');
    check('edição sim C: resumo com linha de Tempo "45min • 1 min/q em 45 questões feitas"', html(w, 'simPainelSummary').includes('45min') && html(w, 'simPainelSummary').includes('em 45 questões feitas'));
    lex(w, "document.getElementById('modalSim').remove()");

    // Pendente SEM link → highlight, SEM alert, não salva
    lex(w, 'abrirModalSimulado(null)');
    await tick(80);
    w.document.getElementById('simTipo').value = 'pendente';
    lex(w, 'alternarCamposSimulado()');
    w.document.getElementById('simNome').value = 'Pendente Sem Link';
    lex(w, 'salvarSimulado()');
    await tick(30);
    check('pendente sem link: SEM alert (só highlight) + modal ABERTO + nada salvo + wraps (link visível; nota/painel/questões hidden)', alertSpy.length === 0
      && !!w.document.getElementById('modalSim') && !w.CT.getSimulados(t.cId).some(s => s.nome === 'Pendente Sem Link')
      && w.document.getElementById('simLinkWrap').style.display === ''
      && w.document.getElementById('simNotaWrap').style.display === 'none'
      && w.document.getElementById('simPainelWrap').style.display === 'none'
      && w.document.getElementById('simQuestoesFeitasWrap').style.display === 'none', JSON.stringify(alertSpy));
    w.document.getElementById('simLink').value = 'https://example.com/novo';
    lex(w, 'salvarSimulado()');
    await tick(30);
    const pend = w.CT.getSimulados(t.cId).find(s => s.nome === 'Pendente Sem Link');
    check('pendente com link: salva com pct/notas/painel/tempo TODOS null + simSub "3 realizado(s) • 2 pendente(s)"', !!pend
      && pend.tipo === 'pendente' && pend.link === 'https://example.com/novo' && pend.pct === null
      && pend.notasMaterias === null && pend.desempenhoPainel === null && pend.acertosTotal === null
      && pend.questoesTotal === null && pend.questoesFeitas === null && pend.tempoMinutos === null
      && pend.pontosObtidos === null && pend.pontosMax === null
      && txt(w, 'simSub') === 'Defensoria 2027 — 4 realizado(s) • 2 pendente(s)', txt(w, 'simSub'));

    // Manual simples (nota + notas por matéria, sem tempo)
    lex(w, 'abrirModalSimulado(null)');
    await tick(80);
    w.document.getElementById('simNome').value = 'Manual Simples';
    w.document.getElementById('simModoCalc').value = 'manual';
    lex(w, 'alternarCamposSimulado()');
    w.document.getElementById('simNota').value = '85';
    w.document.getElementById('nm_' + t.mIds[0]).value = '60';
    w.document.getElementById('nm_' + t.mIds[1]).value = '90';
    lex(w, 'salvarSimulado()');
    await tick(30);
    const man = w.CT.getSimulados(t.cId).find(s => s.nome === 'Manual Simples');
    check('manual: salva pct 85 + notasMaterias 60/90 + desempenhoPainel null + tempo/questões null + simSub "4 realizado(s) • 2 pendente(s)"', !!man
      && man.pct === 85 && man.notasMaterias[t.mIds[0]] === 60 && man.notasMaterias[t.mIds[1]] === 90
      && man.desempenhoPainel === null && man.tempoMinutos === null && man.questoesFeitas === null
      && txt(w, 'simSub') === 'Defensoria 2027 — 5 realizado(s) • 2 pendente(s)', txt(w, 'simSub'));

    // Tempo SEM questões → alert + highlight + não salva
    lex(w, 'abrirModalSimulado(null)');
    await tick(80);
    w.document.getElementById('simNome').value = 'Manual Com Tempo';
    w.document.getElementById('simModoCalc').value = 'manual';
    lex(w, 'alternarCamposSimulado()');
    w.document.getElementById('simNota').value = '50';
    w.document.getElementById('simTempoHoras').value = '2';
    alertSpy.length = 0;
    lex(w, 'salvarSimulado()');
    await tick(30);
    check('tempo SEM questões: alert "Informe quantas questões foram feitas para calcular minutos por questão." + modal ABERTO + nada salvo', alertSpy.length === 1
      && alertSpy[0] === 'Informe quantas questões foram feitas para calcular minutos por questão.'
      && !!w.document.getElementById('modalSim') && !w.CT.getSimulados(t.cId).some(s => s.nome === 'Manual Com Tempo'), JSON.stringify(alertSpy));
    w.document.getElementById('simQuestoesFeitas').value = '40';
    lex(w, 'salvarSimulado()');
    await tick(30);
    const mt = w.CT.getSimulados(t.cId).find(s => s.nome === 'Manual Com Tempo');
    check('tempo COM questões: salva questoesFeitas 40 + tempoMinutos 120 + pct 50 + notasMaterias 0/0 (QUIRK: Number(\'\') = 0 nos campos vazios)', !!mt
      && mt.questoesFeitas === 40 && mt.tempoMinutos === 120 && mt.pct === 50
      && mt.notasMaterias[t.mIds[0]] === 0 && mt.notasMaterias[t.mIds[1]] === 0, JSON.stringify(mt && mt.notasMaterias));

    // Nota fora do range (150) → highlight, sem alert, não salva
    lex(w, 'abrirModalSimulado(null)');
    await tick(80);
    w.document.getElementById('simNome').value = 'Manual Ruim';
    w.document.getElementById('simModoCalc').value = 'manual';
    lex(w, 'alternarCamposSimulado()');
    w.document.getElementById('simNota').value = '150';
    alertSpy.length = 0;
    lex(w, 'salvarSimulado()');
    await tick(30);
    check('nota 150 (>100): SEM alert + modal ABERTO + nada salvo + highlight no simNota (borderColor var(--red))', alertSpy.length === 0
      && !!w.document.getElementById('modalSim') && !w.CT.getSimulados(t.cId).some(s => s.nome === 'Manual Ruim')
      && w.document.getElementById('simNota').style.borderColor === 'var(--red)', w.document.getElementById('simNota').style.borderColor);
  }

  console.log('== R12-E: nota de corte (percentual/pontos) ==');
  {
    const t = bootSim({});
    await awaitBoot(t, 150);
    const w = t.w;
    const alertSpy = [];
    w.alert = (m) => alertSpy.push(m);

    lex(w, 'abrirModalCorte()');
    await tick(20);
    const mc = html(w, 'modalCorte');
    check('modal de corte: overlay id modalCorte + card 420px + ids inputCorteTipo/inputCorte/hintCorte + opções Percentual (%) selected / Nota objetiva (pts)', !!w.document.getElementById('modalCorte')
      && mc.includes('width:420px') && mc.includes('id="inputCorteTipo"') && mc.includes('id="inputCorte"') && mc.includes('id="hintCorte"')
      && mc.includes('<option value="percentual" selected') && mc.includes('<option value="pontos">'));
    check('modal de corte: título "Nota de corte" + descrição + hint percentual "Use percentual de acertos/aproveitamento, de 0 a 100%."', mc.includes('>Nota de corte<')
      && mc.includes('Defina a meta em percentual ou em nota geral da prova objetiva.')
      && txt(w, 'hintCorte') === 'Use percentual de acertos/aproveitamento, de 0 a 100%.', txt(w, 'hintCorte'));

    w.document.getElementById('inputCorteTipo').value = 'percentual';
    lex(w, 'atualizarModalCorteTipo()');
    w.document.getElementById('inputCorte').value = '72,5';
    lex(w, 'salvarCorte()');
    await tick(20);
    const c1 = w.CT.getConcurso(t.cId);
    check('salvar corte 72,5 (percentual): notaCorte 72.5 (ponto decimal) + tipo percentual + SEM alert + modal FECHADO', c1.notaCorte === 72.5 && c1.notaCorteTipo === 'percentual'
      && alertSpy.length === 0 && !w.document.getElementById('modalCorte'), JSON.stringify({ nc: c1.notaCorte, alertSpy }));
    check('decisão 3 (runtime): stat4 do card de corte patchada para "72,5%" (formatPercentPt, VÍRGULA)', (() => {
      const m = html(w, 'simStats').match(/sim-stat-value" style="color:var\(--yellow\)">([^<]*)</);
      return m && m[1] === '72,5%';
    })(), (html(w, 'simStats').match(/sim-stat-value" style="color:var\(--yellow\)">([^<]*)</) || [])[1]);
    const cd1 = chartDump(w);
    check('decisão 1 (runtime corte %): dataset Corte [72.5×3] dash [8,6] rgba(245,200,66,0.62) + tooltip " Nota de corte: 72,5%" (formatPercentPt)', !!cd1
      && cd1.datasets.some(d => d.label === 'Corte' && d.data.join(',') === '72.5,72.5,72.5' && d.borderDash.join(',') === '8,6' && d.borderColor === 'rgba(245,200,66,0.62)')
      && cd1.tooltipCorteOut === ' Nota de corte: 72,5%', cd1 && cd1.tooltipCorteOut);

    // Corte em PONTOS (85) — maxObjetiva vem dos sims (sim C pontosMax 100)
    lex(w, 'abrirModalCorte()');
    await tick(20);
    w.document.getElementById('inputCorteTipo').value = 'pontos';
    lex(w, 'atualizarModalCorteTipo()');
    check('corte pontos: hint "Nota máxima objetiva detectada: 100 pts." (R14 normalizou; maxObjetiva do sim C, SEM pontuacaoMax no cadastro)', txt(w, 'hintCorte') === 'Nota máxima objetiva detectada: 100 pts.', txt(w, 'hintCorte'));
    w.document.getElementById('inputCorte').value = '85';
    lex(w, 'salvarCorte()');
    await tick(20);
    const c2 = w.CT.getConcurso(t.cId);
    check('salvar corte 85 pontos: notaCorte 85 + tipo pontos + SEM alert + stat4 "85 pts" (formatPointsPt)', c2.notaCorte === 85 && c2.notaCorteTipo === 'pontos'
      && alertSpy.length === 0
      && ((html(w, 'simStats').match(/sim-stat-value" style="color:var\(--yellow\)">([^<]*)</) || [])[1] === '85 pts'));
    const cd2 = chartDump(w);
    check('corte pontos: tooltip " Nota de corte: 85 pts (85%)" (equiv % via chartValue) + linha Corte presente', !!cd2
      && cd2.tooltipCorteOut === ' Nota de corte: 85 pts (85%)' && cd2.datasets.some(d => d.label === 'Corte'), cd2 && cd2.tooltipCorteOut);
  }
  {
    // S6: pontuacaoMax NO CADASTRO (fonte preferida de maxObjetiva)
    const t = bootSim({ corte: { notaCorte: 85, notaCorteTipo: 'pontos', pontuacaoMax: 100 } });
    await awaitBoot(t, 150);
    const w = t.w;
    const cd = chartDump(w);
    check('corte pontos com pontuacaoMax 100 no cadastro: stat4 "85 pts" + Corte [85×3] (chartValue 85) + tooltip "85 pts (85%)"', !!cd
      && ((html(w, 'simStats').match(/sim-stat-value" style="color:var\(--yellow\)">([^<]*)</) || [])[1] === '85 pts')
      && cd.datasets.some(d => d.label === 'Corte' && d.data.join(',') === '85,85,85')
      && cd.tooltipCorteOut === ' Nota de corte: 85 pts (85%)');
    lex(w, 'abrirModalCorte()');
    await tick(20);
    check('modal corte reabre com estado salvo: tipo pontos + valor "85" + placeholder "Ex: 72,5" + hint de pontos', w.document.getElementById('inputCorteTipo').value === 'pontos'
      && w.document.getElementById('inputCorte').value === '85'
      && w.document.getElementById('inputCorte').placeholder === 'Ex: 72,5'
      && txt(w, 'hintCorte') === 'Nota máxima objetiva detectada: 100 pts.');
    lex(w, "document.getElementById('modalCorte').remove()");

    // S6b: SEM pontuacaoMax → fallback para os sims (mesmo valor 100)
    const t2 = bootSim({ corte: { notaCorte: 85, notaCorteTipo: 'pontos' } });
    await awaitBoot(t2, 120);
    lex(t2.w, 'abrirModalCorte()');
    await tick(20);
    const cd2 = chartDump(t2.w);
    check('corte pontos SEM pontuacaoMax: hint cai no fallback dos sims ("100 pts" via pontosMax do sim C) + linha Corte [85×3] no gráfico', txt(t2.w, 'hintCorte') === 'Nota máxima objetiva detectada: 100 pts.'
      && !!cd2 && cd2.datasets.some(d => d.label === 'Corte' && d.data.join(',') === '85,85,85'), txt(t2.w, 'hintCorte'));
  }

  console.log('== R12-F: raio-x por matéria (pct/acertos/pontos) ==');
  {
    const t = bootSim({});
    await awaitBoot(t, 150);
    const w = t.w;
    const cd = lex(w, '_chartMateria');
    check('raio-x: wrap visível + dataset ÚNICO "Último simulado" [80,70] (Atualidades→DC) + cores #9cf7cc/#f5874a alpha 0.82 + barThickness 14 + radius 8', w.document.getElementById('simMateriaChartWrap').style.display === ''
      && !!cd && cd.config.data.datasets.length === 1 && cd.config.data.datasets[0].label === 'Último simulado'
      && cd.config.data.datasets[0].data.join(',') === '80,70'
      && cd.config.data.datasets[0].backgroundColor.join(',') === 'rgba(156,247,204,0.82),rgba(245,135,74,0.82)'
      && cd.config.data.datasets[0].barThickness === 14 && cd.config.data.datasets[0].borderRadius === 8, String(cd && cd.config.data.datasets[0].data));
    check('raio-x: labels ordenados por pct desc [Atualidades, Direito Constitucional] + eixo Y category (barras horizontais)', !!cd
      && cd.config.data.labels.join(',') === 'Atualidades,Direito Constitucional' && cd.config.options.scales.y.type === 'category');
    w.document.getElementById('simMateriaMetric').value = 'acertos';
    w.document.getElementById('simMateriaMetric').dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick(30);
    const cd2 = lex(w, '_chartMateria');
    check('métrica acertos: data [20,14] + sub "comparativo por acertos"', !!cd2
      && cd2.config.data.datasets[0].data.join(',') === '20,14'
      && txt(w, 'simMateriaChartSub') === '2 matéria(s) analisadas • comparativo por acertos • 0 com comparação ao simulado anterior', txt(w, 'simMateriaChartSub'));
    w.document.getElementById('simMateriaMetric').value = 'pontos';
    w.document.getElementById('simMateriaMetric').dispatchEvent(new w.Event('change', { bubbles: true }));
    await tick(30);
    const cd3 = lex(w, '_chartMateria');
    check('métrica pontos: data [40,28.5] (VÍRGULA no resumo 28,5 pts) + sub "comparativo por pontos"', !!cd3
      && cd3.config.data.datasets[0].data.join(',') === '40,28.5'
      && txt(w, 'simMateriaChartSub') === '2 matéria(s) analisadas • comparativo por pontos • 0 com comparação ao simulado anterior'
      && html(w, 'simMateriaResumo').includes('28,5 pts'), txt(w, 'simMateriaChartSub'));
  }

  console.log('== R12-G: página vazia + quirks ==');
  {
    const t = bootSim({ sims: [] });
    await awaitBoot(t, 150);
    const w = t.w;
    const stats = statValues(w);
    check('vazia: 4 stats "—" (3 text3 + corte yellow) + simSub "0 realizado(s) • 0 pendente(s)"', stats.length === 4
      && stats.every(s => s.value === '—')
      && stats.slice(0, 3).every(s => s.color === 'var(--text3)') && stats[3].color === 'var(--yellow)'
      && txt(w, 'simSub') === 'Defensoria 2027 — 0 realizado(s) • 0 pendente(s)', JSON.stringify(stats));
    check('vazia: chart wrap visível + empty state "Registre seu primeiro simulado…" + sub "Sem dados suficientes ainda." + _chartSim null', w.document.getElementById('simChartWrap').style.display === ''
      && html(w, 'chartSimStage').includes('sim-chart-empty') && html(w, 'chartSimStage').includes('Registre seu primeiro simulado para visualizar a evolução da nota.')
      && txt(w, 'simChartSub') === 'Sem dados suficientes ainda.' && lex(w, '_chartSim') === null);
    check('vazia: lista com 📋 "Nenhum simulado registrado" + Clique em "＋ Registrar simulado" para começar.', (() => {
      const l = html(w, 'listaSimulados');
      return l.includes('📋') && l.includes('Nenhum simulado registrado') && l.includes('Clique em "＋ Registrar simulado" para começar.');
    })());
    check('vazia: raio-x com sub "Registre acertos por matéria…" + empty "Ainda não há dados detalhados por matéria nos simulados registrados."', w.document.getElementById('simMateriaChartWrap').style.display === ''
      && txt(w, 'simMateriaChartSub') === 'Registre acertos por matéria para liberar o raio-x completo.'
      && html(w, 'simMateriaChartStage').includes('Ainda não há dados detalhados por matéria nos simulados registrados.'), txt(w, 'simMateriaChartSub'));
  }

  console.log('');
  console.log(`== R12: ${passed} PASS / ${failed} FAIL ==`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(2); });
