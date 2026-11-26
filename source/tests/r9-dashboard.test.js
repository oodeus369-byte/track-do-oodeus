/**
 * Track do Oodeus — testes R9 (etapa-04: dashboard.html — a página mais
 * complexa do app)
 *
 * Harness jsdom + vm.runInContext (mesmo padrão do r7-ci.test.js/r8):
 * body.html injetado ANTES dos scripts; ordem da cadeia = ordem do original:
 *   Chart.js 4.4.1 vendored (doc-mestre 39) → mini-script anti-flash →
 *   timer-popup.js → flashcards.js → script principal → crono-cycle.js (por
 *   último — pacto etapa-04 §11). theme.js/data.js rodam ANTES (vm, como no
 *   onload do plugin); nav.js NÃO roda (guards typeof cobrem — desvio
 *   documentado no render-util R3). O hash vem por window.__CT_PAGE_HASH__
 *   (seam [R9-port] do shell; main.js R9 preserva o hash em pendingPageHash).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const dashBodyHtml = read('pages/dashboard/body.html');
const dashMainSrc = read('pages/dashboard/main.pagejs');
const dashStyleSrc = read('pages/dashboard/style.css');
const dashAntiflashSrc = read('pages/dashboard/antiflash.pagejs');
const chartSrc = read('vendor/chart.umd.pagejs');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const flashcardsSrc = read('pages/flashcards/flashcards.pagejs');
const cronoSrc = read('pages/crono/crono-cycle.pagejs');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');

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
const rawKey = (w, k) => w.localStorage.getItem(k);
const jkey = (w, k) => { try { return JSON.parse(rawKey(w, k)); } catch { return null; } };

// Canvas 2D fake (jsdom não implementa canvas — Chart.js precisa de um ctx
// com TODOS os métodos como no-ops).
const CANVAS_VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'filter']);
function fake2dContext(canvas) {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return canvas;
      if (typeof p === 'symbol') return undefined;
      // contexto 2D real não é array-like: length/índices indefinidos (Chart.js
      // faz t.length && (t = t[0]) em getCanvas — truthy quebraria a resolução)
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

function bootDash({ hash = '', nMaterias = 2, questoes = [], sessoes = [], simulados = [], configProva = null, crono = null, faixaIdx = null, flashTab = false, t1sub = false, dataProva = '2026-12-20', activate = 'main', coberto = 0, decksSeed = null, preRun = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + dashBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
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
  if (!w.TrackTheme) w.TrackTheme = { palette: () => ({ text: '#fff', border: '#444', bg: '#111' }) };
  vmRun(w, dataSrc, 'data.js');
  w.CT.saveConcurso({ nome: 'Defensoria 2027', cargo: 'Defensor', banca: 'FGV', dataProva });
  if (activate === 'pre') w.CT.saveConcurso({ nome: 'Pré TCE', banca: 'TCE', dataProva: '2027-03-15', preEdital: true });
  w.CT.saveConcurso({ nome: 'Delegado 2024', banca: 'PC-PR', dataProva: '2024-10-01', realizado: true });
  if (coberto) { w.CT.saveConcurso({ nome: 'Policia 2025', banca: 'PC', dataProva: '2025-08-10', realizado: true }); } // usado só em I/merge (realizados no pool de destino)
  const concursos = w.CT.getConcursos();
  const target = activate === 'pre' ? concursos.find(c => c.preEdital) : concursos.find(c => c.nome === 'Defensoria 2027');
  const cId = target.id;
  const nomes = ['Direito Constitucional', 'Conhecimentos Gerais', 'Atualidades'].slice(0, nMaterias);
  nomes.forEach(n => w.CT.saveMateria({ concursoId: cId, nome: n }));
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  let t1 = null, s1 = null;
  t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[0], nome: 'Controle de constitucionalidade' });
  if (t1sub) s1 = w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Repercussão geral' });
  questoes.forEach(q => w.CT.lancarQuestoes({ concursoId: cId, materiaId: q.materiaId || mIds[0], topicoId: t1.id, ...q }));
  sessoes.forEach(s => w.CT.registrarSessao({ concursoId: cId, materiaId: s.materiaId || mIds[0], ...s }));
  simulados.forEach(s => w.CT.saveSimulado({ concursoId: cId, ...s }));
  if (configProva) w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify(configProva));
  if (crono) w.localStorage.setItem('ct_crono_' + cId, JSON.stringify(crono));
  if (faixaIdx !== null) w.localStorage.setItem('ct_faixa_idx_' + cId, String(faixaIdx));
  if (decksSeed) w.localStorage.setItem('ct_flashcard_decks', JSON.stringify(decksSeed.map(d => ({ ...d, concursoId: d.concursoId || cId }))));
  if (flashTab) w.sessionStorage.setItem('ct_dashboard_tab', 'flashcards');
  if (!hash.includes('noCid')) w.sessionStorage.setItem('ct_concurso_ativo', cId);
  // shell.renderPage (plugin): expõe search/hash ANTES da cadeia
  w.__CT_PAGE_SEARCH__ = '';
  w.__CT_PAGE_HASH__ = hash === 'noCid' ? '' : hash;
  // Cadeia = ordem do original (head → body → tail; theme/data/nav no "onload")
  if (preRun) preRun(w, cId, mIds, t1);
  vmRun(w, chartSrc, 'vendor/chart.umd.pagejs');
  vmRun(w, dashAntiflashSrc, 'dashboard.html [anti-flash]');
  vmRun(w, timerSrc, 'timer-popup.js');
  vmRun(w, flashcardsSrc, 'flashcards.js');
  vmRun(w, dashMainSrc, 'dashboard.html [inline]');
  vmRun(w, cronoSrc, 'crono-cycle.js');
  return { dom: j, w, cId, mIds, t1, s1, navSpy };
}

async function awaitBoot(t, extra) {
  const w = t.w;
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r, { once: true }));
  await tick(extra || 80); // renderFaixa (50ms) + timeouts curtos do boot
}

(async () => {
  console.log('== R9-A: fonte/registro/seams ==');
  {
    const iDash = shellSrc.indexOf("'dashboard.html'");
    const block = iDash > -1 ? shellSrc.slice(iDash, iDash + 1800) : '';
    check('shell.js: dashboard.html registrado com a cadeia completa NA ORDEM do original [Chart.js vendored, anti-flash, timer-popup, flashcards, main, crono-cycle]', iDash > -1
      && block.indexOf('../vendor/chart.umd.pagejs') > -1
      && block.indexOf('../pages/dashboard/antiflash.pagejs') > -1
      && block.indexOf('../pages/timer/timer-popup.pagejs') > -1
      && block.indexOf('../pages/flashcards/flashcards.pagejs') > -1
      && block.indexOf('../pages/dashboard/main.pagejs') > -1
      && block.indexOf('../pages/crono/crono-cycle.pagejs') > -1
      && block.indexOf('../vendor/chart.umd.pagejs') < block.indexOf('../pages/dashboard/antiflash.pagejs')
      && block.indexOf('../pages/dashboard/antiflash.pagejs') < block.indexOf('../pages/timer/timer-popup.pagejs')
      && block.indexOf('../pages/timer/timer-popup.pagejs') < block.indexOf('../pages/flashcards/flashcards.pagejs')
      && block.indexOf('../pages/flashcards/flashcards.pagejs') < block.indexOf('../pages/dashboard/main.pagejs')
      && block.indexOf('../pages/dashboard/main.pagejs') < block.indexOf('../pages/crono/crono-cycle.pagejs'), block.slice(0, 300));
    check('shell.js: header [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13] e crono-cycle POR ÚLTIMO na cadeia (pacto §11)', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]') && block.indexOf('../pages/crono/crono-cycle.pagejs') > block.indexOf('../pages/dashboard/main.pagejs'));
    check('main.js R9: navigateTo preserva o hash em pendingPageHash (não descarta mais em split(\'#\')[0]) + init no onload', mainPluginSrc.includes('this.pendingPageHash = hash;') && !mainPluginSrc.includes("raw.split('#')[0]") && mainPluginSrc.includes("raw.indexOf('#')") && mainPluginSrc.includes('this.pendingPageHash = \'\';'));
    check('shell.js: renderPage expõe window.__CT_PAGE_HASH__ DEPOIS de __CT_PAGE_SEARCH__ (análogo)', shellSrc.includes('window.__CT_PAGE_HASH__') && shellSrc.indexOf('__CT_PAGE_HASH__') > shellSrc.indexOf('__CT_PAGE_SEARCH__'));
    check('body.html: 7 onclick location.href → goPage (logo + 6 nav-items; Dashboard/Flashcards usam showDashTab — verbatim)', (dashBodyHtml.match(/onclick="goPage\('/g) || []).length === 8
      && dashBodyHtml.includes("onclick=\"showDashTab('overview')\"") && dashBodyHtml.includes("onclick=\"showDashTab('flashcards')\"")
      && dashBodyHtml.includes('<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false"'), String((dashBodyHtml.match(/onclick="goPage\('/g) || []).length));
    check('body.html: sem location.href restante FORA do comentário de cabeçalho', !/location\.href/.test(dashBodyHtml.replace(/<!--[\s\S]*?-->/g, '')));
    check('body.html: 2 modais estáticos ANINHADOS dentro do <aside> (anomalia real do DOM — etapa-04 §1)', (() => {
      const asideEnd = dashBodyHtml.indexOf('</aside>');
      return dashBodyHtml.indexOf('id="modalMerge"') > -1 && dashBodyHtml.indexOf('id="modalMerge"') < asideEnd
        && dashBodyHtml.indexOf('id="modalPreEditalReset"') > -1 && dashBodyHtml.indexOf('id="modalPreEditalReset"') < asideEnd;
    })());
    check('body.html: esqueleto de 2 abas — #dashboardFlashcards display:none com #flashcardsDashboardRoot', dashBodyHtml.includes('<section id="dashboardFlashcards" style="display:none">') && dashBodyHtml.includes('<div id="flashcardsDashboardRoot">'));
    check('main.pagejs: 6 goPage (guards 2340/2913, abrirMateria→aba_materia 3901, empty state 3966, merge→concursos 5335, finalizarBatalha 5343) + 5 reloadPagina (2473/4547/4568/4575/4603)', dashMainSrc.includes("if (!cId) { goPage('concursos.html'); }")
      && dashMainSrc.includes("if (!c) { goPage('concursos.html'); return; }")
      && dashMainSrc.includes("function abrirMateria(mid) { sessionStorage.setItem('ct_materia_ativa', mid); goPage('aba_materia.html'); }")
      && dashMainSrc.includes("onclick=\"goPage(\\'cronograma_inteligente.html\\'") && dashMainSrc.includes('✨ Começar Agora')
      && dashMainSrc.includes("goPage('concursos.html');")
      && dashMainSrc.includes("goPage('cadastro_edital.html?editar=' + encodeURIComponent(cId) + '&finalizar=1');")
      && dashMainSrc.includes('setTimeout(function () { reloadPagina(); }, 180);')
      && (dashMainSrc.match(/reloadPagina\(\);/g) || []).length === 5, String((dashMainSrc.match(/reloadPagina\(\);/g) || []).length));
    check('main.pagejs: goPage local delega a __CT_NAV_GO_PAGE + reloadPagina (precedente aba-materia script2)', dashMainSrc.includes('function goPage(dest) {') && dashMainSrc.includes('if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }') && dashMainSrc.includes('function reloadPagina() {') && dashMainSrc.includes("window.__CT_NAV_GO_PAGE('dashboard.html')"));
    check('main.pagejs: window.open verbatim (link edital Ctrl 5276) — precedente R6/R7', dashMainSrc.includes("window.open(url, '_blank', 'noopener,noreferrer');"));
    check('main.pagejs: duplicações preservadas — renderPainelProva ×2 + abrirModalConfigProva ×2 (a ÚLTIMA declaração vence, intercaladas no original), morta referencia isAreaMean', (() => {
      const f1 = dashMainSrc.indexOf('function renderPainelProva');
      const f2 = dashMainSrc.indexOf('function renderPainelProva', f1 + 1);
      const m1 = dashMainSrc.indexOf('function abrirModalConfigProva');
      const m2 = dashMainSrc.indexOf('function abrirModalConfigProva', m1 + 1);
      return f1 > -1 && f2 > f1 && m1 > -1 && m2 > m1 && dashMainSrc.includes('isAreaMean');
    })());
    check('main.pagejs: código morto preservado — renderPreEditalTimerBoxLegacy, stub _checkSemanaCompleta (4978), _getSemanasCompletas nem definida, typo novaSemanaCmpleta, "Banca nao informada"', dashMainSrc.includes('renderPreEditalTimerBoxLegacy')
      && /_checkSemanaCompleta\s*=\s*function\s*\(\)\s*\{\s*return false;\s*\};/.test(dashMainSrc.replace(/\r/g, ''))
      && !dashMainSrc.includes('function _getSemanasCompletas')
      && dashMainSrc.includes('novaSemanaCmpleta') && dashMainSrc.includes('Banca nao informada'));
    check('body.html: canvas #chartSemanal legado display:none + "Sequencia diaria!" (box para sempre escondida pelo stub 4978)', dashBodyHtml.includes('<canvas id="chartSemanal" height="130" style="display:none">') && dashBodyHtml.includes('Sequencia diaria!') && dashBodyHtml.includes('semanaCompletaBox'));
    check('main.pagejs: FAIXAS com 8 faixas + FAIXA_FRASE_PADRAO = frase de Josué 1:9 (a da Roxa, não a da Branca)', (() => {
      const m = /var FAIXAS = \[([\s\S]*?)\];/.exec(dashMainSrc.replace(/\r/g, ''));
      return !!m && (m[1].match(/imagem:/g) || []).length === 8 && dashMainSrc.includes('Josué 1:9');
    })());
    check('main.pagejs: weekly reset remove TODAS as chaves ct_cest_* (scan global do localStorage, orig 3039-3063) + archiveWeeklyMetrics antes', dashMainSrc.includes('CT.archiveWeeklyMetrics(savedWeek);') && dashMainSrc.replace(/\r/g, '').includes("k.startsWith('ct_cest_')") && dashMainSrc.replace(/\r/g, '').includes("localStorage.setItem('ct_crono_week', weekKey);"));
    check('antiflash.pagejs: mini-script verbatim + seam único [R9-port] de __CT_PAGE_HASH__ (falta do seam → fallback location.hash)', dashAntiflashSrc.includes('ct-initial-flashcards') && dashAntiflashSrc.includes('__CT_PAGE_HASH__') && dashAntiflashSrc.includes("sessionStorage.getItem('ct_dashboard_tab') === 'flashcards'") && dashAntiflashSrc.includes('location.hash'));
    check('flashcards.pagejs: adaptação ÚNICA [R9-port] de hash (arquivo R8 aprovado + 1 linha mudada — __CT_PAGE_HASH__ ×2 na MESMA linha: leitura ternária)', flashcardsSrc.replace(/\r/g, '').includes("var hash = typeof window.__CT_PAGE_HASH__ === 'string' ? window.__CT_PAGE_HASH__ : String(window.location.hash || ''); // [R9-port] hash da página via seam do shell (plugin); fallback original em browser puro") && (flashcardsSrc.replace(/\r/g, '').match(/__CT_PAGE_HASH__/g) || []).length === 2);
    check('Chart.js vendored: arquivo completo 4.4.1 UMD (MIT) — doc-mestre 39 (bundled no plugin, versão exata)', chartSrc.includes('Chart.js v4.4.1') && chartSrc.includes('typeof exports') && Buffer.byteLength(chartSrc, 'utf8') > 200000, String(Buffer.byteLength(chartSrc, 'utf8')));
    check('style.css: media queries dos 3 modos [data-dashboard-mode] (weekly/cycle/smart) + theme.css DEPOIS do inline documentado', dashStyleSrc.includes('data-dashboard-mode="weekly"') && dashStyleSrc.includes('data-dashboard-mode="cycle"') && dashStyleSrc.includes('data-dashboard-mode="smart"') && dashStyleSrc.includes('theme.css'));
  }

  console.log('== R9-B: boot (guards + run() completo) ==');
  {
    const t = bootDash({ hash: 'noCid' });
    check('guard 2340: sem ct_concurso_ativo → goPage concursos.html (navSpy)', t.navSpy.includes('nav:concursos.html'), JSON.stringify(t.navSpy));
    check('run() aborta sem cId (boot inerte — sem título preenchido)', t.w.document.getElementById('dashSub').textContent === 'Carregando...', t.w.document.getElementById('dashSub').textContent);
  }
  {
    const t = bootDash();
    t.w.sessionStorage.setItem('ct_concurso_ativo', 'zzz-inexistente');
    t.w.sessionStorage.setItem('ct_concurso_ativo', t.w.CT.getConcursos()[0].id);
    await awaitBoot(t);
    check('run() completo: título = nome do concurso, sub e header date preenchidos', t.w.document.getElementById('dashTitle').textContent === 'Defensoria 2027' && t.w.document.getElementById('dashSub').textContent.length > 0 && t.w.document.getElementById('dashDate').textContent !== '—', JSON.stringify([t.w.document.getElementById('dashSub').textContent, t.w.document.getElementById('dashDate').textContent]));
    check('guard 2913: ct_concurso_ativo inexistente → goPage concursos.html no run()', (() => {
      const t2 = bootDash({ preRun: (w2) => w2.sessionStorage.setItem('ct_concurso_ativo', 'zzz') });
      return t2.navSpy.includes('nav:concursos.html');
    })(), JSON.stringify(t.navSpy));
    check('sideCard clickable com title "Clique para ver ou editar informações..." (abrirModalMerge)', t.w.document.getElementById('sideCard').classList.contains('clickable') && String(t.w.document.getElementById('sideCard').title || '').includes('Clique'), t.w.document.getElementById('sideCard').className);
    check('sideNome/sideBanca/sideTimer preenchidos (33 dias para 2026-12-20)', t.w.document.getElementById('sideNome').textContent === 'Defensoria 2027' && t.w.document.getElementById('sideBanca').textContent === 'FGV' && t.w.document.getElementById('sideTimer').textContent !== '—', JSON.stringify([t.w.document.getElementById('sideNome').textContent, t.w.document.getElementById('sideTimer').textContent]));
    check('banner exam-day escondido com prova futura (dias > 0)', t.w.document.getElementById('bannerExamDay').style.display === 'none', t.w.document.getElementById('bannerExamDay').style.display);
    check('stats iniciais: sTopicos "0/1" (t1 sem sub) + sHoras "0h" + sSimulado "—" + sSimMedia "média em todos: —"', t.w.document.getElementById('sTopicos').textContent === '0/1' && t.w.document.getElementById('sHoras').textContent === '0h' && t.w.document.getElementById('sSimulado').textContent === '—' && t.w.document.getElementById('sSimMedia').textContent.includes('média em todos: —'), JSON.stringify([t.w.document.getElementById('sTopicos').textContent, t.w.document.getElementById('sHoras').textContent]));
    check('tabela de matérias render inicial (nome UPPERCASE via _formatMateriaNome) + 2 matérias', (t.w.document.getElementById('materiasTbody').querySelectorAll('tr').length >= 2) && t.w.document.getElementById('materiasTbody').innerHTML.includes('DIREITO CONSTITUCIONAL'));
    check('window._dashboardLiveSnapshot (snapshot global) com concurso/questões', !!t.w._dashboardLiveSnapshot && typeof t.w._dashboardLiveSnapshot === 'object' && 'questoes' in t.w._dashboardLiveSnapshot, JSON.stringify(t.w._dashboardLiveSnapshot || {}).slice(0, 120));
  }
  {
    const t = bootDash({ dataProva: '2026-11-16' }); // ontem → dias <= 0
    await awaitBoot(t);
    check('banner exam-day VISÍVEL quando dias <= 0 ("Sua Batalha foi Realizada! ⚔️" + botão Finalizar)', t.w.document.getElementById('bannerExamDay').style.display !== 'none' && t.w.document.getElementById('bannerExamDay').textContent.includes('Sua Batalha foi Realizada!'), t.w.document.getElementById('bannerExamDay').style.display);
    t.w.finalizarBatalhaAutomatico();
    check('finalizarBatalhaAutomatico → cadastro_edital.html?editar=<cId>&finalizar=1 (query suportada pelo navigateTo, R3)', t.navSpy.some(p => p.startsWith('nav:cadastro_edital.html?editar=') && p.endsWith('&finalizar=1')), JSON.stringify(t.navSpy));
  }
  {
    const t = bootDash({ simulados: [{ data: '2026-11-10', pct: 80, criadoEm: '2026-11-10' }, { data: '2026-11-12', pct: 90, criadoEm: '2026-11-12' }] });
    await awaitBoot(t);
    check('último simulado: sSimulado 90% colorido (CT.ultimoSimulado ordena por criadoEm DESC) + média em todos: 85%', t.w.document.getElementById('sSimulado').textContent === '90%' && t.w.document.getElementById('sSimMedia').textContent.includes('85%'), JSON.stringify([t.w.document.getElementById('sSimulado').textContent, t.w.document.getElementById('sSimMedia').textContent]));
    check('sQuestoes/sAcertos via run() inline (mesmo código do live)', t.w.document.getElementById('sQuestoes').textContent === '0' && t.w.document.getElementById('sAcertos').textContent === '—');
  }

  console.log('== R9-C: gráficos (Chart.js vendored real + doughnuts) ==');
  {
    const t = bootDash();
    await awaitBoot(t);
    check('Chart.js 4.4.1 REAL carregado da cadeia (window.Chart.version)', t.w.Chart && t.w.Chart.version === '4.4.1', t.w.Chart && String(t.w.Chart.version));
    const cH = t.w.document.getElementById('chartSemanalHoras');
    const cQ = t.w.document.getElementById('chartSemanalQuestoes');
    check('boot cria os 2 doughnuts inline (sem destroy prévio) e REGISTRA no registry do Chart', t.w.Chart.getChart(cH) && t.w.Chart.getChart(cQ));
    check('canvas #chartSemanal legado SEM chart (display:none — nunca usado)', !t.w.Chart.getChart(t.w.document.getElementById('chartSemanal')) && t.w.document.getElementById('chartSemanal').style.display === 'none');
    check('renderDashboardWeeklyLive destrói e recria (Chart.getChart destroy + new)', (() => {
      const before = t.w.Chart.getChart(cH);
      t.w.renderDashboardWeeklyLive(t.w.buildDashboardSnapshot());
      const after = t.w.Chart.getChart(cH);
      return before && after && before !== after;
    })());
    check('resize listener: ensureWeeklyChartsResponsive no boot (window resize)', (() => { t.w.dispatchEvent(new t.w.Event('resize')); return true; })());
  }

  console.log('== R9-D: sistema live (debounce 90ms + deltas + storage event) ==');
  {
    const t = bootDash();
    await awaitBoot(t);
    const sQuestoes = t.w.document.getElementById('sQuestoes');
    t.w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mIds[0], topicoId: t.t1.id, resolvidas: 5, acertos: 5, erros: 0 });
    await tick(30);
    check('debounce 90ms: nada mudou 30ms após o evento (sQuestoes ainda 0, sem delta)', sQuestoes.textContent === '0' && !t.w.document.querySelector('.ct-live-delta'), sQuestoes.textContent);
    await tick(300);
    check('após 90ms: renderDashboardLive — sQuestoes 5 com delta animado .ct-live-delta (base 5 + delta "+5" = textContent "5+5")', sQuestoes.textContent === '5+5' && !!t.w.document.querySelector('.ct-live-delta'), JSON.stringify([sQuestoes.textContent, !!t.w.document.querySelector('.ct-live-delta')]));
    check('tabela de matérias re-renderizada em modo LIVE (emoji entidades &#128308; em badges — variação documentada) + snapshot reffeito', (() => {
      const html = t.w.document.getElementById('materiasTbody').innerHTML;
      return t.w._dashboardLiveSnapshot && t.w._dashboardLiveSnapshot.questoes === 5 && (html.includes('data-live-pct') || html.includes('data-live-tempo'));
    })(), t.w.document.getElementById('materiasTbody').innerHTML.slice(0, 200));
    t.w.atualizarDashboardAgora();
    await tick(30);
    check('atualizarDashboardAgora (animate false): renderDashboardLive imediato — sem crash e snapshot íntegro', t.w._dashboardLiveSnapshot.questoes === 5);
    (() => {
      const ev = new t.w.Event('storage');
      t.w.dispatchEvent(ev);
    })();
    await tick(250);
    check('listener storage (chaves ct_sessoes|ct_questoes|...): roda animate false sem crash', t.w._dashboardLiveSnapshot.questoes === 5);
    check('renderFaixa pós-live (renderDashboardLive chama renderFaixa + renderPainelProva)', !!t.w.document.getElementById('faixaNome').textContent);
  }

  console.log('== R9-E: painel da prova (versão VIVA: 3 modos + useBlockData + X/Y + minPts) ==');
  {
    const cfg = { groups: [{ id: 'geral', name: 'Conhecimentos Gerais', items: [{ id: 'GERAL_ID', q: 30, w: 2 }] }, { id: 'especifico', name: 'Específicos', items: [] }], scoringMode: 'tradicional' };
    const t = bootDash({ configProva: cfg, preRun: (w, cId) => { w.__seedGeral = w.CT.getMaterias(cId)[0].id; } });
    await awaitBoot(t);
    const ger = t.w.__seedGeral;
    // config veio com id placeholder — reescreve com o id real e re-render
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, JSON.stringify({ groups: [{ id: 'geral', name: 'Conhecimentos Gerais', items: [{ id: ger, q: 30, w: 2 }] }], scoringMode: 'tradicional' }));
    t.w.renderPainelProva();
    check('tradicional: #dashNotaMax "Nota Máx: 60" (30q × 2w) e resumo com o grupo', t.w.document.getElementById('dashNotaMax').textContent === 'Nota Máx: 60', t.w.document.getElementById('dashNotaMax').textContent);
    check('normalização migra legacy geral/especifico → groups (apenas grupos NÃO-VAZIOS migram) + scoringMode inválido → tradicional', (() => {
      const raw = { geral: [{ id: ger, q: 10, w: 1 }], especifico: [{ id: ger, q: 5, w: 2 }], scoringMode: 'x' };
      const norm = t.w.normalizePainelConfig(raw);
      const normVazio = t.w.normalizePainelConfig({ geral: [], especifico: [] });
      return norm.groups.length === 2 && norm.scoringMode === 'tradicional' && norm.groups[0].id === 'mig_g' && norm.groups[1].id === 'mig_e' && normVazio.groups.length === 0 && t.w.normalizePainelConfig({ groups: [{ id: 'x', name: 'X', items: [] }] }).groups.length === 1;
    })());
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, JSON.stringify({ groups: [{ id: 'geral', name: 'G', items: [{ id: ger, q: 20, w: 1 }] }], scoringMode: 'cebraspe', errorPenalty: 0.3 }));
    t.w.renderPainelProva();
    check('cebraspe: nota máxima = questões (20) e penalidade por erro exibida (-0,3)', t.w.document.getElementById('dashNotaMax').textContent === 'Nota Máx: 20' && t.w.document.getElementById('dashProvaResumo').innerHTML.includes('0,3'), JSON.stringify([t.w.document.getElementById('dashNotaMax').textContent, t.w.document.getElementById('dashProvaResumo').innerHTML.slice(0, 300)]));
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, JSON.stringify({ groups: [{ id: 'geral', name: 'G', items: [{ id: ger, q: 20, w: 1 }] }], scoringMode: 'media_areas' }));
    t.w.renderPainelProva();
    check('media_areas: peso na média, nota fixa "10,0000" (formatPainelNumero com vírgula)', t.w.document.getElementById('dashProvaResumo').innerHTML.includes('10,0000'), t.w.document.getElementById('dashProvaResumo').innerHTML.slice(0, 300));
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, JSON.stringify({ groups: [{ id: 'geral', name: 'G', items: [{ id: ger, q: 'x', w: 'y' }] }], scoringMode: 'tradicional' }));
    t.w.renderPainelProva();
    check('marcadores X/Y (imprevisível): item mostra "--" e o bloco cai em pool scoring (useBlockData inferido)', t.w.document.getElementById('dashProvaResumo').innerHTML.includes('--'), t.w.document.getElementById('dashProvaResumo').innerHTML.slice(0, 400));
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, JSON.stringify({ groups: [
      { id: 'geral', name: 'G', items: [{ id: ger, q: 10, w: 1, minPts: 2 }] },
      { id: 'red', name: 'Redação', type: 'redacao', redType: 'Discursiva', pts: 10, minPts: 6, isClassificatoriaOnly: true },
    ], scoringMode: 'tradicional' }));
    t.w.renderPainelProva();
    check('minPts por item ("Nota min.: 2" no nome da matéria) e por bloco redação classificatória ("Nota mínima: 6") no resumo', (() => {
      const r = t.w.document.getElementById('dashProvaResumo').innerHTML;
      return r.includes('Nota min.: 2') && r.includes('Nota mínima: 6');
    })(), t.w.document.getElementById('dashProvaResumo').innerHTML.slice(0, 400));
  }
  {
    const t = bootDash({ preRun: (w, cId, mIds) => w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify({ groups: [{ id: 'geral', name: 'G', items: [{ id: mIds[0], q: 20, w: 1 }] }], scoringMode: 'cebraspe', errorPenalty: 0.3 })) });
    await awaitBoot(t);
    t.w.abrirModalConfigProva();
    const bodyHtml = t.w.document.body.innerHTML;
    check('abrirModalConfigProva (VIVA): "CESPE / CEBRASPE" no seletor + coluna Disponíveis + "Dados do bloco" (useBlockData) + "Nota min."', bodyHtml.includes('CEBRASPE') && bodyHtml.includes('Disponíveis') && bodyHtml.includes('Dados do bloco') && bodyHtml.includes('Nota min.'), (() => { const i = bodyHtml.indexOf('CEBRASPE'); return bodyHtml.slice(Math.max(0, i - 150), i + 200); })());
    check('modal criado dinamicamente e re-render após fechar (window.reRenderModalConfigProva existe)', typeof t.w.reRenderModalConfigProva === 'function');
    t.w.localStorage.setItem('ct_config_prova_' + t.cId, '{}');
    t.w.renderPainelProva();
    check('sem config: resumo pede configuração ("Clique aqui para configurar") e nota 0', t.w.document.getElementById('dashNotaMax').textContent === 'Nota Máx: 0' && t.w.document.getElementById('dashProvaResumo').innerHTML.includes('Clique aqui para configurar'), JSON.stringify([t.w.document.getElementById('dashNotaMax').textContent, t.w.document.getElementById('dashProvaResumo').innerHTML.slice(0, 150)]));
  }

  console.log('== R9-F: cronograma semanal + faixa ==');
  {
    const t = bootDash();
    await awaitBoot(t);
    const grid = t.w.document.getElementById('cronoGrid');
    check('empty state promocional: "Monte seu Cronograma Inteligente" + botão ✨ Começar Agora → cronograma_inteligente.html', grid.innerHTML.includes('Monte seu Cronograma Inteligente') && grid.innerHTML.includes('✨ Começar Agora'), grid.innerHTML.slice(0, 200));
    const btn = Array.from(grid.querySelectorAll('button')).find(b => b.textContent.includes('Começar Agora'));
    if (btn) btn.click();
    check('botão do empty state navega via seam goPage → __CT_NAV_GO_PAGE (navSpy)', t.navSpy.includes('nav:cronograma_inteligente.html'), JSON.stringify(t.navSpy));
    check('faixa inicial: nome "Faixa Branca" + #faixaEmoji com <img> da imagem da faixa (faixabranca.png, faixaIconStyle) + "Nenhum dia de estudo seguido"', t.w.document.getElementById('faixaNome').textContent === 'Faixa Branca' && t.w.document.getElementById('faixaEmoji').innerHTML.includes('faixabranca.png') && t.w.document.getElementById('faixaEmoji').innerHTML.includes('<img src=') && t.w.document.getElementById('faixaSemanas').textContent === 'Nenhum dia de estudo seguido', JSON.stringify([t.w.document.getElementById('faixaEmoji').innerHTML, t.w.document.getElementById('faixaSemanas').textContent]));
    check('#semanaCompletaBox para sempre escondida (stub 4978) — "Sequencia diaria!" no body, nunca exibida', t.w.document.getElementById('semanaCompletaBox').style.display === 'none');
    check('FAIXAS/FAIXA_FRASE_PADRAO globais: 8 faixas + frase padrão Josué 1:9', t.w.FAIXAS.length === 8 && t.w.FAIXA_FRASE_PADRAO.includes('Josué 1:9'), JSON.stringify(t.w.FAIXAS.map(f => f.nome || f.label)).slice(0, 120));
    check('tooltip da faixa (não-máxima) com .belt-tooltip + metas da próxima', t.w.document.getElementById('faixaSection').innerHTML.includes('belt-tooltip'), t.w.document.getElementById('faixaSection').innerHTML.slice(t.w.document.getElementById('faixaSection').innerHTML.indexOf('belt-tooltip') - 50, t.w.document.getElementById('faixaSection').innerHTML.indexOf('belt-tooltip') + 250));
  }
  {
    // renderCrono weekly usa chaves de DATA COMPLETA (CT._dateString do domingo
    // da semana corrente) e valores = NOMES das matérias (não ids, não seg/ter).
    // BUG FIEL DO ORIGINAL: o script roda top-down — a IIFE run() (@631) chama
    // initCrono (@786), que carrega ct_crono_<cid> e renderiza; MAS o assignment
    // `var _cData = {}, _cCid = null, _cMats = [];` (@1626) executa DEPOIS e
    // RESETA o estado — o boot SEMPRE cai no promo (verificado com probe
    // instrumentado: [DBG renderCrono] vê _cData={} pós-run; initCrono manual
    // → 7 cards). Reproduzido identicamente no dashboard.html original.
    const t = bootDash({ preRun: (w, cId, mIds) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
      const dsDom = w.CT._dateString(d);
      w.localStorage.setItem('ct_crono_' + cId, JSON.stringify({ [dsDom]: ['DIREITO CONSTITUCIONAL'] }));
    } });
    await awaitBoot(t);
    const grid = t.w.document.getElementById('cronoGrid');
    check('BUG FIEL: no boot, run()/initCrono roda ANTES do var _cData={} (@1626) que reseta — mesmo com ct_crono populado, o grid mostra o PROMO (1 filho) e _cCid=null', grid.getAttribute('data-dashboard-mode') === 'weekly' && grid.children.length === 1 && t.w._cCid == null && JSON.stringify(t.w._cData) === '{}', JSON.stringify([grid.getAttribute('data-dashboard-mode'), grid.children.length, t.w._cCid, t.w._cData]));
    t.w.initCrono(t.cId, []); // re-init manual: recarrega ct_crono_<cid> e renderiza (pós-reset o estado está são)
    check('initCrono manual: #cronoGrid data-dashboard-mode="weekly" com 7 cards de dia (Dom..Sab, dd/mm no header, hoje destacado)', grid.getAttribute('data-dashboard-mode') === 'weekly' && grid.children.length === 7, JSON.stringify([grid.getAttribute('data-dashboard-mode'), grid.children.length]));
    const chip = Array.from(grid.querySelectorAll('div')).find(d => String(d.title || '').includes('clique para marcar'));
    check('chip da matéria: title = "<NOME> — clique para marcar", texto com o nome COMPLETO (patchCronoGridNames do pacto §11 reescreve após o render), estado 0 (sem ✓/✗)', !!chip && chip.title === 'DIREITO CONSTITUCIONAL — clique para marcar' && chip.textContent === 'DIREITO CONSTITUCIONAL' && !chip.textContent.includes('✓') && !chip.textContent.includes('✗'), chip && JSON.stringify([chip.title, chip.textContent]));
    const d0 = new Date(); d0.setHours(12, 0, 0, 0); d0.setDate(d0.getDate() - d0.getDay());
    const dsDom = t.w.CT._dateString(d0);
    const key = 'ct_cest_' + t.cId + '_' + dsDom + '_DIREITO CONSTITUCIONAL';
    const cestVal = () => t.w.localStorage.getItem(key);
    chip.click();
    check('chip click 1: ct_cest_<cid>_<dsDom>_<nome> = 1 → inline "✓ DIREITO CO" verde (#27a06b), SEM re-render do grid', cestVal() === '1' && chip.textContent === '✓ DIREITO CO' && chip.style.background === 'rgb(39, 160, 107)', JSON.stringify([cestVal(), chip.textContent, chip.style.background]));
    chip.click();
    check('chip click 2: estado 2 (✗ vermelho #f55a5a)', cestVal() === '2' && chip.textContent === '✗ DIREITO CO' && chip.style.background === 'rgb(245, 90, 90)', JSON.stringify([cestVal(), chip.textContent, chip.style.background]));
    chip.click();
    check('chip click 3: volta a 0 — cor base restaurada (#4f8ef7 default) e sem emoji', cestVal() === '0' && chip.textContent === 'DIREITO CO' && chip.style.background === 'rgb(79, 142, 247)', JSON.stringify([cestVal(), chip.textContent, chip.style.background]));
  }
  {
    const t = bootDash({ questoes: Array.from({ length: 26 }, (_, i) => ({ resolvidas: 10, acertos: 10, erros: 0, data: '2026-11-16', materiaId: 'M_ID', topicoId: 'T_ID' })), faixaIdx: 0 });
    await awaitBoot(t);
    check('faixa por "qualquer métrica isolada bata": 260 questões ≥ 250 → Faixa Amarela', t.w.document.getElementById('faixaNome').textContent === 'Faixa Amarela', t.w.document.getElementById('faixaNome').textContent);
    let nomeFaixaAwait = null;
    {
      const t2 = bootDash({ questoes: Array.from({ length: 26 }, () => ({ resolvidas: 10, acertos: 10, erros: 0, data: '2026-11-16', materiaId: 'M_ID', topicoId: 'T_ID' })), faixaIdx: 3 });
      await awaitBoot(t2);
      nomeFaixaAwait = t2.w.document.getElementById('faixaNome').textContent;
    }
    check('anti-regressão: com idx salvo 3 e earned 1 (Amarela), a faixa efetiva é a Laranja — nunca desce', nomeFaixaAwait === 'Faixa Laranja', nomeFaixaAwait);
    check('faixaSemanas com questões: "N dias de estudos seguidos 🔥" (ou variantes do original)', t.w.document.getElementById('faixaSemanas').textContent.includes('dia'), t.w.document.getElementById('faixaSemanas').textContent);
  }
  {
    // bônus: CT.getTotalCoberturasEdital(concurso) conta coberto+cobertoPre DO
    // PRÓPRIO concurso ativo (não de outro) → +1 nível via aplicarBonusFaixaEdital
    const t = bootDash({ questoes: Array.from({ length: 26 }, () => ({ resolvidas: 10, acertos: 10, erros: 0, data: '2026-11-16', materiaId: 'M_ID', topicoId: 'T_ID' })), preRun: (w, cId) => {
      const lista = JSON.parse(w.localStorage.getItem('ct_concursos') || '[]');
      w.localStorage.setItem('ct_concursos', JSON.stringify(lista.map(c => c.id === cId ? { ...c, coberto: 1 } : c)));
    } });
    await awaitBoot(t);
    check('bônus de edital: 1 cobertura no concurso ativo = +1 nível (Amarela +1 → Faixa Vermelha)', t.w.document.getElementById('faixaNome').textContent === 'Faixa Vermelha', JSON.stringify([t.w.document.getElementById('faixaNome').textContent, t.w.CT.getTotalCoberturasEdital(t.w.CT.getConcurso(t.cId))]));
  }
  {
    const t = bootDash({ questoes: Array.from({ length: 80 }, () => ({ resolvidas: 10, acertos: 10, erros: 0, data: '2026-11-16', materiaId: 'M_ID', topicoId: 'T_ID' })), faixaIdx: 0 });
    await awaitBoot(t);
    await tick(1100);
    check('celebração ao subir de faixa: showBeltCelebration injeta o banner central após 1000ms', (() => {
      const html = t.w.document.body.innerHTML;
      return html.includes('Resumo da jornada') || html.includes('tada') || html.includes('fallDown');
    })(), t.w.document.body.innerHTML.slice(t.w.document.body.innerHTML.length - 600));
    check('confetti: createConfetti cria partículas fixas (fallDown, @keyframes no head)', (t.w.document.head.innerHTML.match(/fallDown/g) || []).length > 0 || t.w.document.body.innerHTML.includes('fallDown'));
  }
  {
    const t = bootDash({ preRun: (w, cId) => w.localStorage.setItem('ct_faixa_frase_' + cId, 'Frase personalizada do concurso') });
    await awaitBoot(t);
    check('frase personalizada (ct_faixa_frase_<cid>, trim, máx 240) aparece na #faixaFrase', t.w.document.getElementById('faixaFrase').textContent.includes('Frase personalizada do concurso'), t.w.document.getElementById('faixaFrase').textContent);
  }

  console.log('== R9-G: weekly reset (apaga ct_cest_* de TODOS os concursos) ==');
  {
    const t = bootDash({
      crono: { seg: ['M1_ID'] },
      preRun: (w, cId, mIds) => {
        w.localStorage.setItem('ct_crono_week', '1999_w1');
        w.localStorage.setItem('ct_cest_999_seg_Direito', '1'); // outro concurso
        w.localStorage.setItem('ct_cest_' + cId + '_seg_Outro', '2');
      },
    });
    await awaitBoot(t);
    const ks = Object.keys(t.w.localStorage).filter(k => k.startsWith('ct_cest_'));
    check('weekly reset: TODAS as chaves ct_cest_* apagadas (do concurso corrente E de outros)', ks.length === 0, JSON.stringify(ks));
    const wk = t.w.localStorage.getItem('ct_crono_week');
    check('ct_crono_week atualizado para a semana corrente (ano + "_w" + número, domingo=1º dia, fórmula do original) e != 1999_w1', wk !== '1999_w1' && /_w\d+$/.test(String(wk)), String(wk));
  }
  {
    const t = bootDash();
    await awaitBoot(t);
    check('sem ct_crono_week salvo: grava a semana corrente SEM reset (first run — nenhuma ct_cest_* apagada, archiveWeeklyMetrics não chamado)', !!t.w.localStorage.getItem('ct_crono_week') && /_w\d+$/.test(String(t.w.localStorage.getItem('ct_crono_week'))), String(t.w.localStorage.getItem('ct_crono_week')));
  }

  console.log('== R9-H: matérias (criar/clonar/importar JSON/deletar) ==');
  {
    const t = bootDash({ preRun: (w, cId) => { const oId = w.CT.saveConcurso({ nome: 'Outro Concurso', dataProva: '2027-01-01' }); w.CT.saveMateria({ concursoId: oId, nome: 'Raciocínio Lógico' }); } });
    await awaitBoot(t);
    t.w.abrirModalAddMateriaDash();
    check('abrirModalAddMateriaDash: modal com 3 abas (Criar Manualmente/Clonar/Importar Via JSON) + prompt de IA em textarea readonly', !!t.w.document.getElementById('modalAddMatDash') && t.w.document.getElementById('modalAddMatDash').innerHTML.includes('Importar Via JSON') && !!t.w.document.getElementById('dashMatJsonPrompt'), t.w.document.getElementById('modalAddMatDash') && t.w.document.getElementById('modalAddMatDash').innerHTML.slice(0, 200));
    t.w.document.getElementById('dashMatNome').value = 'MATEMÁTICA'; // UPPERCASE: saveMateria normaliza via _formatMateriaNome e _dConfirm reencontra por nome === nome
    lex(t.w, "_dTops.push({ nome: 'Porcentagem', subtopicos: ['Juros simples'] })");
    t.w._dConfirm();
    check('criar manualmente: materia + topico + subtopico salvos (ids top_d<tc>/sub_d<tc>) + modal removido + reloadPagina → navSpy dashboard.html', !!t.w.CT.getMaterias(t.cId).find(m => m.nome === 'MATEMÁTICA')
      && t.w.CT.getTopicos().some(x => x.nome === 'Porcentagem' && String(x.id).startsWith('top_d'))
      && t.w.CT.getSubtopicos().some(x => x.nome === 'Juros simples' && String(x.id).startsWith('sub_d'))
      && !t.w.document.getElementById('modalAddMatDash')
      && t.navSpy.includes('nav:dashboard.html'), JSON.stringify([t.w.CT.getMaterias(t.cId).map(m => m.nome), t.w.CT.getTopicos().map(x => [x.nome, x.id]), t.navSpy]));
    // quirk fiel do original: com a caixa original do usuário, saveMateria UPPERCASE
    // o nome e o find de _dConfirm (m.nome === nome) falha → tópicos NÃO salvos
    t.w.abrirModalAddMateriaDash();
    t.w.document.getElementById('dashMatNome').value = 'Física';
    t.w._dConfirm();
    check('quirk preservado: nome em caixa mista → matéria salva UPPERCASE ("FÍSICA") mas tópicos NÃO salvos (find de _dConfirm falha no original)', !!t.w.CT.getMaterias(t.cId).find(m => m.nome === 'FÍSICA') && !t.w.CT.getTopicos().some(x => x.nome === 'Física'), JSON.stringify(t.w.CT.getMaterias(t.cId).map(m => m.nome)));
    // clonar
    const outra = t.w.CT.getConcursos().find(c => c.nome === 'Outro Concurso');
    const matOutra = t.w.CT.getMaterias(outra.id)[0];
    t.w.abrirModalAddMateriaDash();
    t.w.exibirMateriasParaClonar(outra.id);
    check('Clonar: cards por concurso + lista de matérias (nome UPPERCASE via _formatMateriaNome); "Banca nao informada" quando o concurso não tem banca (typo sem acento preservado — Outro Concurso foi criado sem banca)', !!t.w.document.getElementById('subjectCloneList') && t.w.document.getElementById('subjectCloneList').innerHTML.includes('RACIOCÍNIO LÓGICO') && t.w.document.getElementById('contestCloneGrid').innerHTML.includes('Banca nao informada'), t.w.document.getElementById('contestCloneGrid').innerHTML.slice(0, 300));
    const itemClone = t.w.document.querySelector('#subjectCloneList .subject-clone-item');
    t.w.selecionarMateriaParaClonar(matOutra.id, itemClone);
    check('selecionarMateriaParaClonar: #dashMatCloneId preenchido + btnConfirmaClone habilitado', t.w.document.getElementById('dashMatCloneId').value === matOutra.id && t.w.document.getElementById('btnConfirmaClone').disabled === false);
    t.w._dClonarMateriaConfirm();
    check('clonar confirmado: CT.vincularMateria(mId, cId) + reload', t.w.CT.getMaterias(t.cId).some(m => m.id === matOutra.id), JSON.stringify(t.w.CT.getMaterias(t.cId).map(m => m.id)));
    // JSON
    t.w.abrirModalAddMateriaDash();
    t.w.document.getElementById('dashMatJson').value = JSON.stringify({ materias: [{ nome: 'Informatica', topicos: [{ nome: 'Windows', subtopicos: ['Atalhos'] }] }] });
    t.w._dConfirmJson();
    check('importar via JSON: CT.importarMateriaJson(raw, cId) — matéria+tópico+subtópico criados (nome UPPERCASE via _formatMateriaNome) + reload', !!t.w.CT.getMaterias(t.cId).find(m => m.nome === 'INFORMATICA') && t.w.CT.getSubtopicos().some(s => s.nome === 'Atalhos'), JSON.stringify(t.w.CT.getMaterias(t.cId).map(m => m.nome)));
    // deletar
    const del = t.w.CT.getMaterias(t.cId).find(m => m.nome === 'INFORMATICA');
    t.w.deletarMateria(del.id);
    check('deletarMateria: modal próprio #modalDelMat com confirmação (mensagem varia se vínculo outro concurso)', !!t.w.document.getElementById('modalDelMat'), t.w.document.body.innerHTML.slice(t.w.document.body.innerHTML.indexOf('modalDelMat'), t.w.document.body.innerHTML.indexOf('modalDelMat') + 200));
    t.w._confDelMat(del.id);
    check('_confDelMat: CT.desvincularOuDeletarMateria(mId, cId) + reload', !t.w.CT.getMaterias(t.cId).some(m => m.id === del.id) && t.navSpy.includes('nav:dashboard.html'), JSON.stringify([t.w.CT.getMaterias(t.cId).map(m => m.nome), t.navSpy]));
  }

  console.log('== R9-I: modais merge/fusão + informações + link Ctrl ==');
  {
    const t = bootDash();
    await awaitBoot(t);
    t.w.abrirModalMerge();
    check('abrirModalMerge (pós-edital): label "✦ Informações do Edital" + fusion tool ESCONDIDO + campos preenchidos', t.w.document.getElementById('modalLabel').textContent.includes('Informações do Edital') && t.w.document.getElementById('fusionToolCard').style.display === 'none', JSON.stringify([t.w.document.getElementById('modalLabel').textContent, t.w.document.getElementById('fusionToolCard').style.display]));
    check('export cards SEMPRE visíveis (Exportar Template / Exportar imagem do card) + dev tools visibility aplicada', t.w.document.getElementById('btnExportTemplate') && t.w.document.getElementById('btnExportCardImage') && t.w.document.getElementById('btnExportTemplate').style.display !== 'none');
    t.w.document.getElementById('infoBanca').value = 'NOVA BANCA';
    t.w.salvarInfoConcursoDashboard();
    check('salvarInfoConcursoDashboard: grava em c + CT.saveConcurso + #sideBanca atualizado + toast "Informações do concurso salvas. ✅"', t.w.CT.getConcurso(t.cId).banca === 'NOVA BANCA' && t.w.document.getElementById('sideBanca').textContent === 'NOVA BANCA', JSON.stringify([t.w.CT.getConcurso(t.cId).banca, t.w.document.getElementById('sideBanca').textContent]));
    check('CT_renderSidebarConcursoInfo chamado quando existe (nav.js) — guard typeof', (() => {
      let chamou = false;
      t.w.CT_renderSidebarConcursoInfo = () => { chamou = true; };
      t.w.document.getElementById('infoBanca').value = 'B2';
      t.w.salvarInfoConcursoDashboard();
      return chamou;
    })());
    // link Ctrl
    const openSpy = [];
    const origOpen = t.w.open;
    t.w.open = (u, a, b) => { openSpy.push(u); return null; };
    t.w.document.getElementById('infoLinkEdital').value = 'www.planalto.gov.br/ccivil/x';
    t.w.abrirLinkEditalComCtrl({ ctrlKey: true, preventDefault() {}, currentTarget: null });
    check('abrirLinkEditalComCtrl: exige event.ctrlKey (sem evento → early return) + normaliza link sem esquema (https:// adicionado) + window.open(url, "_blank", "noopener,noreferrer") verbatim', openSpy.length === 1 && openSpy[0] === 'https://www.planalto.gov.br/ccivil/x', JSON.stringify(openSpy));
    check('normalizarLinkEditalAbrir: file:// e https?:// aceitos; domínio cru recebe https:// (quirk fiel: TLD de 1 letra "a.b" não casa com [a-z]{2,} → volta cru)', t.w.normalizarLinkEditalAbrir('file:///C:/x.pdf') === 'file:///C:/x.pdf' && t.w.normalizarLinkEditalAbrir('https://a.b') === 'https://a.b' && t.w.normalizarLinkEditalAbrir('planalto.gov.br') === 'https://planalto.gov.br' && t.w.normalizarLinkEditalAbrir('a.b') === 'a.b');
    t.w.open = origOpen;
    // fusão
    const tPre = bootDash({ activate: 'pre' });
    await awaitBoot(tPre);
    tPre.w.abrirModalMerge();
    check('abrirModalMerge (pré-edital): label "✦ Informações do Pré-Edital" + fusion tool VISÍVEL + btnConfirmMerge.dataset.allowed=1 + #selectDestino com concursos realizados ("nome (banca)")', tPre.w.document.getElementById('modalLabel').textContent.includes('Pré-Edital') && tPre.w.document.getElementById('fusionToolCard').style.display !== 'none' && tPre.w.document.getElementById('btnConfirmMerge').dataset.allowed === '1' && tPre.w.document.getElementById('selectDestino').innerHTML.includes('Delegado 2024 (PC-PR)'), JSON.stringify([tPre.w.document.getElementById('modalLabel').textContent, tPre.w.document.getElementById('selectDestino').innerHTML]));
    const destOpt = Array.from(tPre.w.document.querySelectorAll('#selectDestino option')).find(o => o.value); // 1ª option COM valor (o placeholder tem value="" — option[value] casaria com ele)
    const destId = destOpt && destOpt.value;
    tPre.w.document.getElementById('selectDestino').value = destId;
    tPre.w.verificarMerge();
    check('verificarMerge: habilita #btnConfirmMerge + mostra #mergePreview (⚠️ aviso de EXCLUÍDO permanente)', tPre.w.document.getElementById('btnConfirmMerge').disabled === false && tPre.w.document.getElementById('mergePreview').style.display !== 'none', JSON.stringify([tPre.w.document.getElementById('btnConfirmMerge').disabled, tPre.w.document.getElementById('mergePreview').style.display]));
    const confirmSpy = [];
    const fusionSpy = [];
    const origConfirm = tPre.w.CT.confirm;
    const origFusion = tPre.w.CT.fusionarConcursos.bind(tPre.w.CT);
    tPre.w.CT.confirm = (...a) => { confirmSpy.push(a); return Promise.resolve(true); };
    tPre.w.CT.fusionarConcursos = (...a) => { fusionSpy.push(a); return origFusion(...a); };
    await tPre.w.executarMerge();
    await tick(50);
    check('executarMerge: CT.confirm (confirmLabel "Fusionar") → CT.fusionarConcursos(cId, destId) → alert com contagens → goPage concursos.html', fusionSpy.length === 1 && fusionSpy[0][0] === tPre.cId && fusionSpy[0][1] === destId && tPre.navSpy.includes('nav:concursos.html'), JSON.stringify([fusionSpy, tPre.navSpy]));
    const cancelSpy = [];
    tPre.w.CT.confirm = () => Promise.resolve(false);
    const navLen = tPre.navSpy.length;
    await tPre.w.executarMerge();
    check('executarMerge cancelado: confirm false → sem fusão e sem navegação', tPre.navSpy.length === navLen && cancelSpy.length === 0);
  }

  console.log('== R9-J: tabs overview/flashcards + hash routing ==');
  {
    const t = bootDash({ t1sub: true });
    await awaitBoot(t);
    check('boot sem hash: overview visível, flashcards display:none, ct_dashboard_tab = overview, SEM ct-initial-flashcards', t.w.document.getElementById('dashboardOverview').style.display !== 'none' && t.w.document.getElementById('dashboardFlashcards').style.display === 'none' && t.w.sessionStorage.getItem('ct_dashboard_tab') === 'overview' && !t.w.document.documentElement.classList.contains('ct-initial-flashcards'), JSON.stringify([t.w.document.getElementById('dashboardFlashcards').style.display, t.w.sessionStorage.getItem('ct_dashboard_tab')]));
    t.w.showDashTab('flashcards');
    check('showDashTab (global do flashcards): overview none, flash visível, ct-dashboard-mounted no body, sessionStorage flashcards, badge #flashTabBadge no nav', t.w.document.getElementById('dashboardOverview').style.display === 'none' && t.w.document.getElementById('dashboardFlashcards').style.display !== 'none' && t.w.document.body.classList.contains('ct-dashboard-mounted') && t.w.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards' && !!t.w.document.getElementById('flashTabBadge'));
    check('aba flashcards renderizada: #flashcardsDashboardRoot com árvore (flash-tree) do deck espelho da matéria (nome UPPERCASE do espelho)', t.w.document.getElementById('flashcardsDashboardRoot').innerHTML.includes('flash-tree') && t.w.document.getElementById('flashcardsDashboardRoot').innerHTML.includes('DIREITO CONSTITUCIONAL'), t.w.document.getElementById('flashcardsDashboardRoot').innerHTML.slice(0, 150));
    t.w.showDashTab('overview');
    check('showDashTab overview: reversão + ct-initial-flashcards removido do <html>', t.w.document.getElementById('dashboardOverview').style.display !== 'none' && t.w.sessionStorage.getItem('ct_dashboard_tab') === 'overview');
  }
  {
    const t = bootDash({ hash: '#flashcards', t1sub: true });
    check('boot com __CT_PAGE_HASH__ "#flashcards": anti-flash adiciona ct-initial-flashcards no <html> (mini-script, seam R9-port)', t.w.document.documentElement.classList.contains('ct-initial-flashcards'), String(t.w.document.documentElement.className));
    await awaitBoot(t);
    check('boot do flashcards lê o seam: aba flashcards ativa + sessionStorage flashcards + root renderizado', t.w.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards' && t.w.document.getElementById('dashboardFlashcards').style.display !== 'none' && t.w.document.getElementById('flashcardsDashboardRoot').innerHTML.length > 100);
  }
  {
    const hoje = new Date().toISOString().slice(0, 10);
    const t = bootDash({
      hash: '#flashcards:fcdeck_test',
      t1sub: true,
      decksSeed: [{ id: 'fcdeck_test', name: 'Baralho Hash', sourceType: 'custom', emoji: 'Books', order: 1, parentId: null, createdAt: hoje, updatedAt: hoje }],
      preRun: (w, cId) => {
        const cards = [{ id: 'fccard_t1', concursoId: cId, deckId: 'fcdeck_test', type: 'flip', front: 'Card do hash', back: 'R', options: [], optionExplanations: [], hint: '', answer: '', explanation: '', tags: [], createdAt: hoje, updatedAt: hoje, srs: { status: 'new', ease: 2.5, interval: 0, reviews: 0, lapses: 0, nextReview: null } }];
        w.localStorage.setItem('ct_flashcards', JSON.stringify(cards));
      },
    });
    await awaitBoot(t, 300);
    const view = t.w.document.getElementById('flashMainView');
    check('boot com hash "#flashcards:<deckId>": openDeck(deckId) via setTimeout 0 — view do baralho "Baralho Hash" com o card', !!view && view.innerHTML.includes('Baralho Hash') && view.innerHTML.includes('Card do hash'), view && view.innerHTML.slice(0, 250));
    check('syncDeckToTopic fecha o ciclo: url do caderno FLASH aponta dashboard.html#flashcards:<deckId> (C8 do R8)', flashcardsSrc.includes("'dashboard.html#flashcards:'") || flashcardsSrc.includes("'dashboard.html#flashcards:' +"), flashcardsSrc.slice(flashcardsSrc.indexOf('FLASH'), flashcardsSrc.indexOf('FLASH') + 200));
  }

  console.log('== R9-K: pacto crono-cycle (último da cadeia) ==');
  {
    const t = bootDash({ preRun: (w, cId, mIds) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
      w.localStorage.setItem('ct_crono_' + cId, JSON.stringify({ [w.CT._dateString(d)]: ['DIREITO CONSTITUCIONAL'] }));
    } });
    await awaitBoot(t);
    check('pacto §11: window.renderCrono WRAPPED pelo crono-cycle (_patched true) — o weekly do dashboard sobrevive como base', typeof t.w.renderCrono === 'function' && t.w.renderCrono._patched === true);
    check('pacto §11: window.abrirModalCrono substituído (_patched true) — o botão ✏️ Editar abre o editor do crono-cycle', typeof t.w.abrirModalCrono === 'function' && t.w.abrirModalCrono._patched === true);
    check('modo weekly (fallback sem ct_crono_modo): cronoGrid data-dashboard-mode="weekly" via orig() do dashboard + patchCronoGridNames', (() => {
      const g = t.w.document.getElementById('cronoGrid');
      return g.getAttribute('data-dashboard-mode') === 'weekly';
    })(), JSON.stringify(t.w.document.getElementById('cronoGrid').getAttribute('data-dashboard-mode')));
    t.w.initCrono(t.cId, []); // re-init manual (bug fiel do reset pós-run, ver R9-F)
    check('initCrono patch guard: o renderCrono local do dashboard EXISTE e é o que o crono-cycle embrulhou — weekly + patchCronoGridNames (chip com o nome completo no texto)', (() => {
      const chip = Array.from(t.w.document.getElementById('cronoGrid').querySelectorAll('div')).find(d => String(d.title || '').includes('clique para marcar'));
      return !!chip && chip.title.includes('DIREITO CONSTITUCIONAL') && chip.textContent === 'DIREITO CONSTITUCIONAL';
    })(), t.w.document.getElementById('cronoGrid').innerHTML.slice(0, 200));
  }

  console.log('');
  console.log(`== R9: ${passed} PASS / ${failed} FAIL ==`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO DO HARNESS:', e && e.stack || e); process.exit(2); });
