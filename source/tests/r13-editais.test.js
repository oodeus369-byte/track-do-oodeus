/**
 * Track do Oodeus — testes R13 (etapa-13 §3: editais_premium.html, página
 * "Editais Premium")
 *
 * Harness jsdom + vm.runInContext (padrão r9–r12): body.html injetado ANTES
 * dos scripts; cadeia = [main] APENAS (página standalone: sem sidebar, sem
 * guard de concurso, SEM timer-popup.js — nav.js 327 vinha ANTES do script
 * principal no original, único layout invertido da auditoria; no plugin o
 * nav boot roda ANTES da cadeia pelo desvio R3 e o DOM não tem
 * data-nav-icon: nav boot inerte §3.3). theme.js/data.js rodam ANTES (vm,
 * como no onload do plugin). SEM canvas/chart. SEM TrackTheme stubado.
 * Acentos do import manual (orig. 1416 "valido", 1421 "Nao") normalizados
 * pelo R14 (doc-mestre §1.5); dead code: nenhum relevante
 * (§3.4).
 *
 * Asserções COPIADAS do probe de dump (convenção #2061): valores de runtime
 * vindos do probe-editais-dump (S1-S13), estáticos do fonte/originais.
 * Datas dinâmicas construídas com os MESMOS helpers do probe (plus/brDate/
 * localISO) — FUTURE = hoje+10, DETAILS_DATE = hoje+30, PAST = hoje-5.
 *
 * Quirks cobertos aqui (etapa-13 §3.2):
 *  - offline 3 caminhos: sem cache → erro+empty de carga; cache VÁLIDO +
 *    fetch falha → pre-render → erro+grid apagado → as hidratações
 *    re-renderizam e RESTAURAM ("cache local"); TUDO offline → erro+apagado
 *    é o estado FINAL; cache editais [] → "Mostrando o cache local" +
 *    empty de filtros;
 *  - teatro de instalação (wait 180/320/180/620/700) com estágios 28/55/78/100;
 *  - botões de instalação TODOS disabled enquanto installingId (quirk);
 *  - refresh 00:05 (scheduleExamTagRefresh); force limpa os 2 caches antes
 *    do fetch; history API dos 2 modais (push/replace; popstate fecha SEM
 *    replaceState).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const edBodyHtml = read('pages/editais_premium/body.html');
const edMainSrc = read('pages/editais_premium/main.pagejs');
const edStyleSrc = read('pages/editais_premium/style.css');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');

// Corpos SEM o header de comentário do port (contagens devem contar só o
// código, não a documentação).
const bodyCore = edBodyHtml.slice(edBodyHtml.indexOf('-->') + 3);
const mainBody = edMainSrc.slice(edMainSrc.indexOf('*/') + 2);
const styleCore = edStyleSrc.slice(edStyleSrc.indexOf('*/') + 2);

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

// ===== Fixtures (idênticas ao probe de dump) =====
const pad = n => String(n).padStart(2, '0');
const localISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const brDate = d => pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
const plus = n => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); };
const FUTURE = plus(10);
const PAST = plus(-5);
const DETAILS_DATE = plus(30);
const TODAY = plus(0);
const UPDATED = '2026-11-10T12:00:00.000Z';

const EXPORT_JSON = JSON.stringify({
  type: 'concursotrack_single_export',
  concurso: { nome: 'Defensor Público 2027', cargo: 'Defensor Público', banca: 'FGV', dataProva: localISO(FUTURE) },
  materias: [], simulados: [],
});

const CATALOG = {
  atualizadoEm: UPDATED,
  editais: [
    { id: 'def-2027', titulo: 'Defensor Público 2027', cargo: 'Defensor Público', banca: 'FGV', orgao: 'TJSP', ano: '2027',
      arquivo: 'Editais/Defensoria/defensoria-2027.json', imagem: 'Editais/Defensoria/capa.png',
      detalhes: 'Escolaridade: Superior', tags: ['Edital Verticalizado'],
      dataProva: localISO(FUTURE), salario: 'R$ 12.500,00', materiaisLinkados: 'Qconcursos' },
    { id: 'trt-2026', titulo: 'TRT 2026 - Analista', banca: 'TRT', cargo: 'Analista Judiciário',
      arquivo: 'Editais/TRT/trt-2026.json', imagem: 'Editais/TRT/capa.png' },
    { banca: 'a definir', cargo: 'Ficha Informativa Agente', tags: ['mÃ©dio'],
      arquivo: 'Concurso 2026 Agente/ficha.json', imagem: 'Concurso 2026 Agente/capa.png' },
  ],
};

const A_DETAILS = 'Linha **forte** e `codigo` aqui\nData da prova: ' + brDate(FUTURE);
const B_DETAILS = 'Escolaridade: Médio\nRemuneração: R$ 9.800,00\nData da prova: ' + brDate(DETAILS_DATE);

const ok = (body) => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body });
const notFound = () => ({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' });

function makeFetch(opts = {}) {
  const fn = async (url) => {
    const u = String(url);
    if (opts.onFetch) opts.onFetch(u);
    const isCatalog = u.includes('Editais-Premium/main/catalog.json');
    if (opts.failAll) throw new Error('network down');
    if (opts.failCatalog && isCatalog) throw new Error('network down');
    if (!isCatalog && opts.delayHydrate) await tick(opts.delayHydrate);
    if (isCatalog) return ok(JSON.stringify(CATALOG));
    if (u.includes('Editais/Defensoria/detalhes.txt')) {
      await tick(60); // hidratação A é síncrona; só toggleDetails busca isto
      return ok(A_DETAILS);
    }
    if (u.includes('Editais/TRT/detalhes.txt')) return ok(B_DETAILS);
    if (u.includes('Editais/Defensoria/defensoria-2027.json')) return ok(EXPORT_JSON);
    if (u.includes('Editais/TRT/trt-2026.json')) return ok(JSON.stringify({ cadernos: [{ url: 'https://tecconcursos.com.br/caderno/1' }] }));
    if (u.includes('Concurso 2026 Agente/ficha.json')) return ok('{}');
    return notFound();
  };
  return fn;
}

function boot({ fetchImpl, preRun } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + edBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  w.document.execCommand = () => true;
  global.window = w;
  const navSpy = [];
  initHost({
    data: {}, persist: () => true, window: w,
    navigate: (p) => { navSpy.push(p); return true; },
    currentPage: () => '', assetBase: () => 'app://plugin/assets/remix-nav/', assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_NAV_GO_PAGE = (p) => { navSpy.push('nav:' + p); };
  vmRun(w, dataSrc, 'data.js');
  w.fetch = fetchImpl || makeFetch();
  if (preRun) preRun(w);
  vmRun(w, edMainSrc, 'editais_premium.html [inline]');
  return { dom: j, w, navSpy };
}

const txt = (w, id) => (w.document.getElementById(id) || {}).textContent;
const html = (w, id) => (w.document.getElementById(id) || {}).innerHTML;
const allButtons = (w) => [...w.document.querySelectorAll('.install-btn')].map(b => {
  const card = b.closest('article');
  const title = card ? (card.querySelector('.card-title') || {}).textContent : '?';
  return `${title} :: ${b.textContent.trim()} :: ${(b.getAttribute('style') || '')} :: ${b.className} :: disabled=${b.disabled} :: aria=${b.getAttribute('aria-busy')}`;
});

(async () => {
  console.log('== R13-A: fonte/registro/seams estáticos ==');
  {
    const iSim = shellSrc.indexOf("'editais_premium.html'");
    // Bloco = SÓ a entrada de editais (fecha no "  }," da própria entrada);
    // ir até 'ajuda.html' pegaria o comentário R13 da ajuda, que menciona
    // timer-popup/script1 (comentário não é cadeia).
    const iEnd = iSim > -1 ? shellSrc.indexOf('\n  },', iSim) : -1;
    const block = iEnd > -1 ? shellSrc.slice(iSim, iEnd) : '';
    check('shell.js: editais_premium.html registrado com cadeia [main] APENAS (standalone: sem sidebar, sem timer-popup)', iSim > -1
      && block.includes('../pages/editais_premium/main.pagejs')
      && !block.includes('timer-popup')
      && !block.includes('script1')
      && !block.includes('vendor/chart'));
    check('shell.js: title "Editais Premium" + icon lucide store + lazyModules []', block.includes("title: 'Editais Premium'") && block.includes("icon: 'store'") && /lazyModules:\s*\[\]/.test(block));
    check('shell.js: header [R2+…+R12+R13]', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]'));
    check('shell.js: comentários R13 das duas páginas presentes + demais páginas seguem registradas', shellSrc.includes('R13: editais_premium.html') && shellSrc.includes('R13: ajuda.html') && ["'dashboard.html'", "'revisoes.html'", "'historico.html'", "'simulados.html'"].every(x => shellSrc.includes(x)));
    check('main.js R9: navigateTo preserva hash + __CT_PAGE_SEARCH__/__CT_PAGE_HASH__ no shell (regressão)', mainPluginSrc.includes('this.pendingPageHash = hash;') && shellSrc.includes('window.__CT_PAGE_SEARCH__') && shellSrc.includes('window.__CT_PAGE_HASH__'));

    const firstGo = edBodyHtml.indexOf("goPage('");
    check('body.html: 4 seams goPage (todas concursos.html: logo/Voltar/successBar/modal) + a 1ª é do logo', (edBodyHtml.match(/onclick="goPage\('/g) || []).length === 4
      && (edBodyHtml.match(/onclick="goPage\('([^']+)'\)"/g) || []).every(s => s.includes("'concursos.html'"))
      && edBodyHtml.slice(Math.max(0, firstGo - 60), firstGo).includes('<div class="logo"'));
    check('body.html: SEM location.href restante + SEM link de ajuda (página standalone §1) + SEM data-nav-icon (nav boot inerte §3.3)', !/location\.href/.test(bodyCore) && !bodyCore.includes('href="ajuda.html"') && !bodyCore.includes('data-nav-icon'));
    check('body.html: ids vivos todos presentes (manual*/summary*/success*/installed*/request*/filtros/status/catalogGrid)', ['manualDropZone', 'manualImportBtn', 'manualFileName', 'manualFileMeta', 'manualError', 'manualFileInput', 'summaryTotal', 'summaryFiltered', 'successBar', 'successText', 'installedModal', 'installedModalTitle', 'installedModalCopy', 'installedModalBox', 'requestModal', 'requestModalTitle', 'searchInput', 'nivelSelect', 'bancaSelect', 'salarySelect', 'status', 'catalogGrid'].every(id => edBodyHtml.includes('id="' + id + '"')));
    check('body.html: import manual default "Nenhum arquivo selecionado" + "Selecione um arquivo .json" + successBar "Edital Premium instalado com sucesso."', edBodyHtml.includes('>Nenhum arquivo selecionado<') && edBodyHtml.includes('>Selecione um arquivo .json<') && edBodyHtml.includes('>Edital Premium instalado com sucesso.<'));

    check('style.css: header R13-port verbatim + :root PRÓPRIO com --premium-card-width:378px e SEM --green2 (§2.1)', edStyleSrc.includes('[R13-port]') && styleCore.includes('--premium-card-width') && !styleCore.includes('--green2'));
    check('style.css: entidades/& estilos vivos preservados (§3.4: nenhum bloco de CSS morto)', ['material-highlight', 'install-btn', 'modal-overlay', 'success-bar', 'empty'].every(x => styleCore.includes(x)));

    check('main.pagejs: goPage local NO TOPO delegando a __CT_NAV_GO_PAGE + ANTES de CATALOG_URL (precedente R10/R11/R12)', edMainSrc.includes('function goPage(dest) {') && edMainSrc.includes('if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }') && edMainSrc.indexOf('function goPage') < edMainSrc.indexOf('const CATALOG_URL'));
    check('main.pagejs: SEM redirect/guard de concurso (página standalone §1)', !mainBody.includes("sessionStorage.getItem('ct_concurso_ativo')"));
    check('main.pagejs: script CLÁSSICO — SEM IIFE e SEM \'use strict\' + começa no comentário [R13-port]', !mainBody.includes("'use strict'") && mainBody.trimStart().startsWith('// [R13-port] Navegação'));
    check('main.pagejs: boot final verbatim 1536-1538 (updateManualState → scheduleExamTagRefresh → loadCatalog(false))', norm(mainBody).trimEnd().endsWith('loadCatalog(false);') && (mainBody.match(/updateManualState\(\);/g) || []).length >= 1 && (mainBody.match(/scheduleExamTagRefresh\(\);/g) || []).length >= 1);
    check('main.stage: CATALOG_URL michel-softwares/Editais-Premium + caches v1/v3', mainBody.includes('raw.githubusercontent.com/michel-softwares/Editais-Premium/main/catalog.json') && mainBody.includes('ct_premium_catalog_cache_v1') && mainBody.includes('ct_premium_materials_cache_v3'));
    check('main.pagejs: 6 providers de materiais (tec e google-drive SEM logo — §3.1)', (mainBody.match(/\{ key:'/g) || []).length === 6 && mainBody.includes("key:'generic'") && mainBody.includes("key:'tec', label:'Tec Concursos', headline:'Com cadernos de questões do Tec Concursos', logo:''"));
    check('main.pagejs: teatro de instalação wait(180/320/180/620/700) ×5 + estágios 28/55/78/100 verbatim (§6.3)', (mainBody.match(/await wait\(/g) || []).length === 5 && mainBody.includes('await wait(620)') && mainBody.includes('await wait(700)') && mainBody.includes("progress:28") && mainBody.includes("progress:55") && mainBody.includes("progress:78") && mainBody.includes("progress:100"));
    check('main.pagejs: refresh das tags de prova às 00:05 (scheduleExamTagRefresh)', mainBody.includes(', 0, 5, 0)') && mainBody.includes('function scheduleExamTagRefresh(){'));
    check('main.pagejs: window.open EXTERNO verbatim + pywebview selecionar_arquivo_json guard verbatim (§6.2)', mainBody.includes("window.open(url, '_blank', 'noopener,noreferrer');") && mainBody.includes("typeof window.pywebview.api.selecionar_arquivo_json === 'function'"));
    check('main.pagejs: history API dos modais pushState ×2 + replaceState ×2 verbatim (§6.3)', (mainBody.match(/history\.pushState\(/g) || []).length === 2 && (mainBody.match(/history\.replaceState\(/g) || []).length === 2);
    check('main.pagejs: fetch ×4 (fetchDetailsText/hidratação/loadCatalog/installItem) — fetch todos silenciosos', (mainBody.match(/await fetch\(/g) || []).length === 4);
    check('main.pagejs: acentos do import manual NORMALIZADOS R14 (orig. 1416 "valido", 1421 "Nao" → "válido"/"Não") + "válido" do 1186 mantido (doc-mestre §1.5)', mainBody.includes('Selecione um arquivo JSON válido.') && mainBody.includes('Não foi possível ler o arquivo selecionado.') && mainBody.includes('JSON válido do Edital Premium.'));
    check('main.pagejs: §3.4 sem dead code marcador (SEM if (false), SEM console.log)', !mainBody.includes('if (false') && !mainBody.includes('console.log'));
    check('package.json/runner: test:r13 registrado', JSON.parse(read('package.json')).scripts['test:r13'] === 'node tests/r13-editais.test.js && node tests/r13-ajuda.test.js');
  }

  console.log('== R13-B: boot online + render (S1) ==');
  {
    const t = boot({});
    await tick(150);
    const w = t.w;
    const grid = html(w, 'catalogGrid');
    check('S1: status "<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online"', html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online', html(w, 'status'));
    check('S1: summaryTotal/Filtered "3"', txt(w, 'summaryTotal') === '3' && txt(w, 'summaryFiltered') === '3');
    check('S1: opções de nível ["", Medio, Superior] com rótulos "Todos/Nível Médio/Nível Superior"', JSON.stringify([...w.document.getElementById('nivelSelect').options].map(o => o.value + '|' + o.textContent)) === JSON.stringify(['|Todos', 'Medio|Nível Médio', 'Superior|Nível Superior']));
    check('S1: opções de banca ["", a definir, fgv, trt] sort pt-BR — label default "Todas" e rótulos formatados do catálogo (item.banca já "A definir")', JSON.stringify([...w.document.getElementById('bancaSelect').options].map(o => o.value + '|' + o.textContent)) === JSON.stringify(['|Todas', 'a definir|A definir', 'fgv|FGV', 'trt|TRT']));
    check('S1: 3 cards, 1º has-materials, card-top FGV/2027, título Defensor Público 2027', (grid.match(/<article class="/g) || []).length === 3
      && (grid.match(/<article class="[^"]*"/) || [''])[0] === '<article class="card has-materials"'
      && (grid.match(/<div class="card-top">[\s\S]*?<\/div>/) || [''])[0] === '<div class="card-top"><span>FGV</span><span class="card-year">2027</span></div>'
      && (grid.match(/<div class="card-title">[^<]*</) || [''])[0] === '<div class="card-title">Defensor Público 2027<');
    check('S1: tags do card A na ordem exata (Nível/banca/ano/gold/exam/verticalizado)', JSON.stringify((() => { const i = grid.indexOf('Defensor Público 2027'); const c = grid.slice(i, i + 2600); return (c.match(/<span class="tag[^"]*"[^>]*>[^<]*<\/span>/g) || []).map(s => s.replace(/<[^>]+>/g, '')); })())
      === JSON.stringify(['Nível Superior', 'FGV', '2027', 'Materiais Linkados', '⚠️ 10 dias para a prova • ' + brDate(FUTURE), 'Edital Verticalizado Completo']));
    check('S1: HTML cru das tags (tag exam + gold) + entity/whitespace preservados', JSON.stringify((() => { const i = grid.indexOf('Defensor Público 2027'); const c = grid.slice(i, i + 2600); return (c.match(/<span class="tag[^"]*"[^>]*>[\s\S]*?<\/span>/g) || []).slice(0, 6); })())
      === JSON.stringify(['<span class="tag ">Nível Superior</span>', '<span class="tag ">FGV</span>', '<span class="tag ">2027</span>', '<span class="tag gold">Materiais Linkados</span>', '<span class="tag exam">⚠️ 10 dias para a prova • ' + brDate(FUTURE) + '</span>', '<span class="tag ">Edital Verticalizado Completo</span>']));
    check('S1: material-highlight Qconcursos com logo + headline "Com cadernos de questões do Qconcursos" [R17-A: logo resolvido via __ctAssetUrl — o literal cru dava 404 no plugin; janela i+560 porque o prefixo app://plugin/ somou 13 chars ao src]', (() => { const i = grid.indexOf('material-highlight'); const h = i > -1 ? grid.slice(i - 10, i + 560) : ''; return h.includes('material-highlight" title="Qconcursos"') && h.includes('material-highlight-logo" src="app://plugin/assets/material-logos/qconcursos.png"') && h.includes('Materiais de estudo linkados') && h.includes('Com cadernos de questões do Qconcursos') && h.includes('<div class="tags"><span class="tag'); })());
    check('S1: botão Instalar exato (onclick installItem + aria-busy false + progress 0%)', (grid.match(/<button class="btn-primary install-btn"[\s\S]*?<\/button>/) || [''])[0] === `<button class="btn-primary install-btn" type="button" onclick="event.stopPropagation();installItem(decodeURIComponent('def-2027'))" aria-busy="false" style="--install-progress:0%"><span class="install-label">Instalar</span></button>`);
    check('S1: img do card A resolvida contra o catálogo com cache-bust ?v=atualizadoEm URL-encoded', (grid.match(/<div class="media"><img src="[^"]*"/) || [''])[0] === '<div class="media"><img src="https://raw.githubusercontent.com/michel-softwares/Editais-Premium/main/Editais/Defensoria/capa.png?v=2026-11-10T12%3A00%3A00.000Z"');
    check('S1: boot SEM navegação (página sem guard) + SEM toast criado', t.navSpy.length === 0 && w.document.getElementById('ct-main-toast') === null, JSON.stringify(t.navSpy));
  }

  console.log('== R13-C: unit quirks + tags de prova + filtros (S2-S4) ==');
  {
    const t = boot({});
    await tick(150);
    const w = t.w;
    // S2 — normalização
    check('S2: formatPremiumBanca "a definir"→"A definir" (uppercase pt-BR) + "fgv"→"FGV" + bancaKey lowercase', lex(w, "formatPremiumBanca('a definir')") === 'A definir' && lex(w, "formatPremiumBanca('fgv')") === 'FGV' && lex(w, "premiumBancaKey('a definir')") === 'a definir');
    check('S2: canonicalLevel com tolerância a mojibake (mÃ©dio→Medio) + Ensino Médio→Medio + Fundamental II→Fundamental + fallback Nao informado', lex(w, "canonicalLevel('mÃ©dio')") === 'Medio' && lex(w, "canonicalLevel('Ensino Médio')") === 'Medio' && lex(w, "canonicalLevel('Ensino Fundamental II')") === 'Fundamental' && lex(w, "canonicalLevel('qualquer coisa')") === 'Nao informado');
    check('S2: displayLevel "Medio"→"Nível Médio" + default "Não informado"', lex(w, "displayLevel('Medio')") === 'Nível Médio' && lex(w, "displayLevel('x')") === 'Não informado');
    check('S2: sameLooseText igual/curto/substring≥9 true + diferente false (detecção de já-instalado)', lex(w, "sameLooseText('Defensor Público', 'defensor publico')") === true && lex(w, "sameLooseText('Def', 'def')") === true && lex(w, "sameLooseText('Defensor Pub', 'Prefeitura do Defensor Publico')") === true && lex(w, "sameLooseText('FGV', 'TRT')") === false);
    check('S2: parseMoneyBR 12.500,00→12500 / 12500→12500 / 1.234→1234 / 1.23→1.23 / vazio→0', lex(w, "parseMoneyBR('12.500,00')") === 12500 && lex(w, "parseMoneyBR('12500')") === 12500 && lex(w, "parseMoneyBR('1.234')") === 1234 && lex(w, "parseMoneyBR('1.23')") === 1.23 && lex(w, "parseMoneyBR('')") === 0);
    check('S2: titleFromPath "Pasta%202027%20FGV/capa.png"→"Pasta FGV" (decode + strip ano 20xx) + slug kebab', lex(w, "titleFromPath({imagem:'Pasta%202027%20FGV/capa.png'})") === 'Pasta FGV' && lex(w, "slug('Defensor Público 2027')") === 'defensor-publico-2027');
    check('S2: normalizePremiumTag — atualizado→null, verticalizado→Completo, materiais→gold, genérico passa, nível→null', JSON.stringify(lex(w, "normalizePremiumTag('atualizado em 2026')")) === 'null' && JSON.stringify(lex(w, "normalizePremiumTag('Edital Verticalizado')")) === '{"label":"Edital Verticalizado Completo","kind":""}' && JSON.stringify(lex(w, "normalizePremiumTag('Materiais Linkados')")) === '{"label":"Materiais Linkados","kind":"gold"}' && JSON.stringify(lex(w, "normalizePremiumTag('qualquer')")) === '{"label":"qualquer","kind":""}' && JSON.stringify(lex(w, "normalizePremiumTag('Nível Médio')")) === 'null');
    check('S2: catalogMeta {updated, source:online} + ids na ordem do catálogo (C sem id→titleFromPath "concurso-agente")', JSON.stringify(lex(w, 'catalogMeta')) === '{"updated":"2026-11-10T12:00:00.000Z","source":"online"}' && JSON.stringify(lex(w, 'catalogItems.map(i => i.id)')) === '["def-2027","trt-2026","concurso-agente"]');
    check('S2: itemA normalizado (bancaKey fgv, level Superior, examDate local, salary 12500, materials [qconcursos], .search concatenado)', JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='def-2027');return {titulo:i.titulo,cargo:i.cargo,banca:i.banca,bancaKey:i.bancaKey,ano:i.ano,level:i.level,examDate:String(i.examDate),salaryValue:i.salaryValue,materials:i.materials.map(m=>m.key),search:i.search};})()"))
      === JSON.stringify({ titulo: 'Defensor Público 2027', cargo: 'Defensor Público', banca: 'FGV', bancaKey: 'fgv', ano: '2027', level: 'Superior', examDate: String(FUTURE), salaryValue: 12500, materials: ['qconcursos'], search: 'defensor publico 2027 defensor publico fgv tjsp 2027 superior edital verticalizado' }));
    check('S2: itemB (sem dataProva/salário no catálogo → JÁ hidratado aos 150ms: examDate dos .txt, salary 9800, materials [tec])', JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='trt-2026');return {level:i.level,examDate:String(i.examDate),salaryValue:i.salaryValue,materialsHydrated:i.materialsHydrated,materials:i.materials.map(m=>m.key)};})()"))
      === JSON.stringify({ level: 'Medio', examDate: String(DETAILS_DATE), salaryValue: 9800, materialsHydrated: true, materials: ['tec'] }));
    check('S2: itemC quirks — cargo "Ficha Informativa…"→\'\' (linha 527), banca "a definir"→"A definir", level mojibake→Medio, examDate null, 5 detailsUrls', JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='concurso-agente');return {id:i.id,titulo:i.titulo,cargo:i.cargo,banca:i.banca,level:i.level,examDate:String(i.examDate),detailsUrls:i.detailsUrls.length};})()"))
      === JSON.stringify({ id: 'concurso-agente', titulo: 'Concurso Agente', cargo: '', banca: 'A definir', level: 'Medio', examDate: 'null', detailsUrls: 5 }));
    // S3 — tags de prova
    check('S3: buildExamDateTag futuro(10d) + hoje + sem data→null', JSON.stringify(lex(w, 'buildExamDateTag({examDate:' + JSON.stringify(localISO(FUTURE)) + '})')) === JSON.stringify({ label: '⚠️ 10 dias para a prova • ' + brDate(FUTURE), kind: 'exam' })
      && JSON.stringify(lex(w, 'buildExamDateTag({examDate:' + JSON.stringify(localISO(TODAY)) + '})')) === JSON.stringify({ label: '⚠️ Prova hoje • ' + brDate(TODAY), kind: 'exam' })
      && JSON.stringify(lex(w, 'buildExamDateTag({})')) === 'null');
    check('S3: passado → "já aconteceu…" kind "exam past" + title "Data da prova: dd/mm/yyyy"', JSON.stringify(lex(w, 'buildExamDateTag({examDate:' + JSON.stringify(localISO(PAST)) + '})'))
      === JSON.stringify({ label: '⚠️ A prova desse concurso já aconteceu. Use a estrutura como preparação para o próximo concurso', kind: 'exam past', title: 'Data da prova: ' + brDate(PAST) }));
    check('S3: parseExamDate iso→meia-noite local / br dd/mm/yyyy / inválida→null / "15 de março de 2027"→15/03', String(lex(w, 'parseExamDate(' + JSON.stringify(localISO(FUTURE)) + ')')) === String(FUTURE)
      && String(lex(w, 'parseExamDate("05/03/2027")')) === String(new Date(2027, 2, 5))
      && String(lex(w, 'parseExamDate("nao informada")')) === 'null'
      && String(lex(w, 'parseExamDate("15 de março de 2027")')) === String(new Date(2027, 2, 15)));
    check('S3: tag EXATA no card A (10 dias) e no card B (30 dias, vinda do .txt hidratado)', (() => { const g = html(w, 'catalogGrid'); const iA = g.indexOf('Defensor Público 2027'); const cA = g.slice(iA, iA + 2600); const iB = g.indexOf('TRT 2026'); const cB = g.slice(iB, iB + 2600); return (cA.match(/⚠️[^<]*/) || [''])[0] === '⚠️ 10 dias para a prova • ' + brDate(FUTURE) && (cB.match(/⚠️[^<]*/) || [''])[0] === '⚠️ 30 dias para a prova • ' + brDate(DETAILS_DATE); })());
    // S4 — filtros
    const titles = () => (html(w, 'catalogGrid').match(/<div class="card-title">[^<]*</g) || []).map(s => s.replace(/<div class="card-title">/, '').replace(/<$/, ''));
    const setInput = (id, v, ev) => { const el = w.document.getElementById(id); el.value = v; el.dispatchEvent(new w.Event(ev, { bubbles: true })); };
    check('S4: default 3 títulos na ordem do catálogo', JSON.stringify(titles()) === JSON.stringify(['Defensor Público 2027', 'TRT 2026 - Analista', 'Concurso Agente']));
    setInput('searchInput', 'defensor', 'input');
    check('S4: busca "defensor" → 1 card + status singular "1 edital encontrado · … · catálogo online"', JSON.stringify(titles()) === JSON.stringify(['Defensor Público 2027']) && html(w, 'status') === '<strong>1</strong> edital encontrado · atualizado em 10/11/2026 · catálogo online', html(w, 'status'));
    setInput('searchInput', '', 'input');
    setInput('searchInput', 'zzz', 'input');
    check('S4: busca sem resultado → empty state de FILTROS (não o de carga)', titles().length === 0 && html(w, 'catalogGrid') === '<div class="empty">Nenhum edital encontrado com esses filtros. Tente limpar a busca ou escolher outra banca.</div>', html(w, 'catalogGrid'));
    setInput('searchInput', '', 'input');
    setInput('nivelSelect', 'Medio', 'change');
    check('S4: nível Medio → [TRT, Concurso Agente] (A é Superior; C vira Medio via mojibake)', JSON.stringify(titles()) === JSON.stringify(['TRT 2026 - Analista', 'Concurso Agente']));
    setInput('nivelSelect', '', 'change');
    setInput('bancaSelect', 'fgv', 'change');
    check('S4: banca fgv → [Defensor Público 2027]', JSON.stringify(titles()) === JSON.stringify(['Defensor Público 2027']));
    setInput('bancaSelect', '', 'change');
    setInput('salarySelect', 'desc', 'change');
    check('S4: salário desc → [12500, 9800, 0] (empate C→TRT por título pt-BR)', JSON.stringify(titles()) === JSON.stringify(['Defensor Público 2027', 'TRT 2026 - Analista', 'Concurso Agente']));
    setInput('salarySelect', '', 'change');
    check('S4: limpar filtros → ordem default restaurada', JSON.stringify(titles()) === JSON.stringify(['Defensor Público 2027', 'TRT 2026 - Analista', 'Concurso Agente']));
  }

  console.log('== R13-D: hidratação + caches + toggleDetails (S5-S6) ==');
  {
    const t = boot({});
    await tick(250);
    const w = t.w;
    check('S5: itemB pós-hidratação idêntico (examDate dos .txt, salary 9800, [tec]) + itemA intacto', JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='trt-2026');return {level:i.level,examDate:String(i.examDate),salaryValue:i.salaryValue,materialsHydrated:i.materialsHydrated,materials:i.materials.map(m=>m.key)};})()"))
      === JSON.stringify({ level: 'Medio', examDate: String(DETAILS_DATE), salaryValue: 9800, materialsHydrated: true, materials: ['tec'] })
      && JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='def-2027');return {level:i.level,examDate:String(i.examDate),salaryValue:i.salaryValue,materialsHydrated:i.materialsHydrated,materials:i.materials.map(m=>m.key)};})()"))
      === JSON.stringify({ level: 'Superior', examDate: String(FUTURE), salaryValue: 12500, materialsHydrated: true, materials: ['qconcursos'] }));
    check('S5: itemC NÃO hidratado (fileUrl com %20 → 404 → materialsHydrated fica false — linha 646)', JSON.stringify(lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='concurso-agente');return {materialsHydrated:i.materialsHydrated};})()")) === '{"materialsHydrated":false}');
    check('S5: filtros finais preservados ["",Medio,Superior]/["",a definir,fgv,trt]', JSON.stringify([...w.document.getElementById('nivelSelect').options].map(o => o.value)) === JSON.stringify(['', 'Medio', 'Superior']) && JSON.stringify([...w.document.getElementById('bancaSelect').options].map(o => o.value)) === JSON.stringify(['', 'a definir', 'fgv', 'trt']));
    check('S5: cache do catálogo gravado (3 editais) + cache v3 com chaves fileUrl|versão (A [], B ["tec"]; C ausente)', (() => { const c = w.localStorage.getItem('ct_premium_catalog_cache_v1'); return c && JSON.parse(c).editais.length === 3; })()
      && w.localStorage.getItem('ct_premium_materials_cache_v3') === '{"https://raw.githubusercontent.com/michel-softwares/Editais-Premium/main/Editais/Defensoria/defensoria-2027.json|2026-11-10T12:00:00.000Z":[],"https://raw.githubusercontent.com/michel-softwares/Editais-Premium/main/Editais/TRT/trt-2026.json|2026-11-10T12:00:00.000Z":["tec"]}', w.localStorage.getItem('ct_premium_materials_cache_v3'));
    check('S5: status final segue "catálogo online"', html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online', html(w, 'status'));

    const g = () => html(w, 'catalogGrid');
    // S6 — C: loading síncrono → 404 → note → fechar
    lex(w, "toggleDetails('concurso-agente')");
    check('S6: C sem cache → loading SÍNCRONO "Carregando detalhes do edital..." + card expanded', (g().match(/details-loading">[^<]*/) || [''])[0] === 'details-loading">Carregando detalhes do edital...' && /<article class="card expanded"/.test(g()));
    await tick(60);
    check('S6: C após 404 → note default "Edital Premium pronto para instalar no Track Concursos." + loading Some', (g().match(/details-note">[^<]*/) || [''])[0] === 'details-note">Edital Premium pronto para instalar no Track Concursos.' && !g().includes('details-loading'));
    lex(w, "toggleDetails('concurso-agente')");
    check('S6: re-clique fecha (selectedId \'\' → sem expanded)', !/<article class="card expanded"/.test(g()));
    // S6 — A: inline primeiro, depois markdown do fetch (60ms)
    lex(w, "toggleDetails('def-2027')");
    check('S6: A com detalhes inline → details-text "Escolaridade: Superior" SEM loading (texto já existe)', (g().match(/<div class="details-text">[^<]*/) || [''])[0] === '<div class="details-text">Escolaridade: Superior' && !g().includes('details-loading'));
    await tick(150);
    check('S6: A após fetch → markdown **forte**→<strong> e `codigo`→<code> + data da prova (markdownLite)', (g().match(/<div class="details-text">[\s\S]*?<\/div>/) || [''])[0] === '<div class="details-text">Linha <strong>forte</strong> e <code>codigo</code> aqui\nData da prova: ' + brDate(FUTURE) + '</div>');
    check('S6: loadingDetailsId limpo após fetch', lex(w, 'loadingDetailsId') === '');
    // S6 — B: cache do boot → imediato
    lex(w, "toggleDetails('trt-2026')");
    check('S6: B com cache do boot → details-text imediato do .txt (sem loading)', (g().match(/<div class="details-text">[\s\S]*?<\/div>/) || [''])[0] === '<div class="details-text">Escolaridade: Médio\nRemuneração: R$ 9.800,00\nData da prova: ' + brDate(DETAILS_DATE) + '</div>' && !g().includes('details-loading'));
    check('S6: detailsCache na ordem de inserção [trt-2026 (boot), concurso-agente (\'\' do catch), def-2027 (toggle)]', JSON.stringify(lex(w, 'Object.keys(detailsCache)')) === JSON.stringify(['trt-2026', 'concurso-agente', 'def-2027']));
  }

  console.log('== R13-E: instalação sucesso/falha + já-instalado/modais (S7-S9) ==');
  {
    const t = boot({});
    await tick(250);
    const w = t.w;
    // Captura EVENT-DRIVEN (valores do dump; amostragem por transição de
    // estado): fronteiras fixas de ms eram corrida contra os waits da página
    // (captura em 700ms vs transição em 680ms perdia sob latência de loop).
    const snap = () => { const b = (html(w, 'catalogGrid').match(/<button class="btn-primary install-btn[^"]*"[^>]*>[\s\S]*?<\/button>/) || [''])[0]; return b.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' || ' + (b.match(/--install-progress:[^;"]*/) || [''])[0] + ' || ' + (b.match(/class="[^"]*"/) || [''])[0]; };
    const until = async (pred, name) => { const t0 = Date.now(); for (;;) { const v = { b: snap(), s: html(w, 'status') }; if (pred(v)) return v; if (Date.now() - t0 > 4000) throw new Error('timeout ' + name); await tick(20); } };
    lex(w, "installItem('def-2027')");
    const buttons_t0 = allButtons(w);
    const g0 = { b: snap(), s: html(w, 'status') };
    const g1 = await until(v => v.b.startsWith('Download completo'), 'S7-download');
    const g2 = await until(v => v.b.startsWith('Instalando...'), 'S7-instalando');
    const g3 = await until(v => v.b.startsWith('Instalado'), 'S7-instalado');
    const g4 = await until(v => v.s.includes('editals encontrados'), 'S7-restore');
    const g5 = { b: snap(), s: html(w, 'status') };
    const stages = [
      ['t0', g0.b, g0.s],
      ['download', g1.b, g1.s],
      ['instalando', g2.b, g2.s],
      ['instalado', g3.b, g3.s],
      ['restaurado', g4.b, g4.s],
      ['restaurado+', g5.b, g5.s],
    ];
    check('S7: teatro de estágios exato (event-driven: Baixando 28% → Download 55% → Instalando 78% → Instalado 100% → status restaurado)', JSON.stringify(stages) === JSON.stringify([
      ['t0', 'Baixando... || --install-progress:28% || class="btn-primary install-btn installing stage-running"', 'Baixando <strong>Defensor Público 2027</strong>...'],
      ['download', 'Download completo || --install-progress:55% || class="btn-primary install-btn installing stage-running"', 'Download completo de <strong>Defensor Público 2027</strong>.'],
      ['instalando', 'Instalando... || --install-progress:78% || class="btn-primary install-btn installing stage-running"', 'Instalando <strong>Defensor Público 2027</strong> no Track...'],
      ['instalado', 'Instalado || --install-progress:100% || class="btn-primary install-btn installing stage-installed"', '<strong>Defensor Público 2027</strong> instalado.'],
      ['restaurado', 'Instalado || --install-progress:100% || class="btn-primary install-btn stage-installed"', '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online'],
      ['restaurado+', 'Instalado || --install-progress:100% || class="btn-primary install-btn stage-installed"', '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online'],
    ]), JSON.stringify(stages));
    check('S7 t0: TODOS os botões disabled durante a instalação (quirk locked=Boolean(installingId)) + o ativo em stage-running aria=true', JSON.stringify(buttons_t0) === JSON.stringify([
      'Defensor Público 2027 :: Baixando... :: --install-progress:28% :: btn-primary install-btn installing stage-running :: disabled=true :: aria=true',
      'TRT 2026 - Analista :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false',
      'Concurso Agente :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false',
    ]), JSON.stringify(buttons_t0));
    const concursos = w.CT.getConcursos();
    const instalado = concursos.find(c => c.nome === 'Defensor Público 2027');
    check('S7 final: botões liberados — A "Instalado" 100% stage-installed disabled=false; demais "Instalar" idle', JSON.stringify(allButtons(w)) === JSON.stringify([
      'Defensor Público 2027 :: Instalado :: --install-progress:100% :: btn-primary install-btn stage-installed :: disabled=false :: aria=false',
      'TRT 2026 - Analista :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=false :: aria=false',
      'Concurso Agente :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=false :: aria=false',
    ]), JSON.stringify(allButtons(w)));
    check('S7 final: successBar visible + successText "Edital Premium instalado: Defensor Público 2027. Bons estudos!" + toast "OK Edital Premium instalado com sucesso."', w.document.getElementById('successBar').classList.contains('visible')
      && txt(w, 'successText') === 'Edital Premium instalado: Defensor Público 2027. Bons estudos!'
      && (w.document.getElementById('ct-main-toast') || {}).innerHTML === '<span style="font-size:18px">OK</span> Edital Premium instalado com sucesso.');
    check('S7: concurso salvo com premiumCatalog* (id aleatório; installedAt = premiumInstalledAt ISO; campos fixos)', !!instalado && /^[a-z0-9]{10,20}$/.test(instalado.id)
      && instalado.premiumCatalogId === 'def-2027'
      && instalado.premiumFileUrl === 'https://raw.githubusercontent.com/michel-softwares/Editais-Premium/main/Editais/Defensoria/defensoria-2027.json'
      && /^\d{4}-\d{2}-\d{2}T/.test(instalado.premiumInstalledAt) && instalado.premiumInstalledAt === instalado.premiumCatalog.installedAt
      && instalado.premiumCatalog.catalogId === 'def-2027' && instalado.premiumCatalog.title === 'Defensor Público 2027'
      && instalado.premiumCatalog.banca === 'FGV' && instalado.premiumCatalog.cargo === 'Defensor Público'
      && instalado.premiumCatalog.fileUrl === instalado.premiumFileUrl
      && instalado.premiumCatalog.imageUrl === 'https://raw.githubusercontent.com/michel-softwares/Editais-Premium/main/Editais/Defensoria/capa.png', JSON.stringify(instalado));
    check('S7 final: totalConcursos 1 + installingId/installStage limpos + grid sem "installing" + status restaurado + navSpy vazio', concursos.length === 1 && lex(w, 'installingId') === '' && lex(w, 'installStage') === ''
      && !html(w, 'catalogGrid').includes('installing') && html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online' && t.navSpy.length === 0);
  }
  {
    const t = boot({});
    await tick(250);
    const w = t.w;
    // Event-driven (mesmo motivo do S7: a fronteira 700ms caía entre a
    // detecção da falha (~680ms) e o finally (~1380ms) e perdia sob latência).
    const snapAll = () => allButtons(w).find(s => s.startsWith('TRT 2026')) || '';
    const snapA = () => allButtons(w).find(s => s.startsWith('Defensor')) || '';
    const snapF = () => ({ b: snapAll(), a: snapA(), s: html(w, 'status') });
    const untilF = async (pred, name) => { const t0 = Date.now(); for (;;) { const v = snapF(); if (pred(v)) return v; if (Date.now() - t0 > 4000) throw new Error('timeout ' + name); await tick(20); } };
    lex(w, "installItem('trt-2026')");
    const f0 = snapF();
    const f1 = await untilF(v => v.b.includes(' :: Download completo ::'), 'S8-download');
    const f2 = await untilF(v => v.b.includes(' :: Instalando... ::'), 'S8-instalando');
    const f3 = await untilF(v => v.b.includes(' :: Falhou ::'), 'S8-falhou');
    const f4 = await untilF(v => v.b.includes(' :: Instalar ::'), 'S8-idle');
    const stages = [
      ['t0', f0.b, f0.a, f0.s],
      ['download', f1.b, f1.a, f1.s],
      ['instalando', f2.b, f2.a, f2.s],
      ['falhou', f3.b, f3.a, f3.s],
      ['idle', f4.b, f4.a, f4.s],
    ];
    check('S8: falha (JSON tipo inválido) — estágios exatos (event-driven): Baixando→Download→Instalando→Falhou 100% stage-failed→idle "Instalar" + status de erro persistente', JSON.stringify(stages) === JSON.stringify([
      ['t0', 'TRT 2026 - Analista :: Baixando... :: --install-progress:28% :: btn-primary install-btn installing stage-running :: disabled=true :: aria=true', 'Defensor Público 2027 :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false', 'Baixando <strong>TRT 2026 - Analista</strong>...'],
      ['download', 'TRT 2026 - Analista :: Download completo :: --install-progress:55% :: btn-primary install-btn installing stage-running :: disabled=true :: aria=true', 'Defensor Público 2027 :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false', 'Download completo de <strong>TRT 2026 - Analista</strong>.'],
      ['instalando', 'TRT 2026 - Analista :: Instalando... :: --install-progress:78% :: btn-primary install-btn installing stage-running :: disabled=true :: aria=true', 'Defensor Público 2027 :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false', 'Instalando <strong>TRT 2026 - Analista</strong> no Track...'],
      ['falhou', 'TRT 2026 - Analista :: Falhou :: --install-progress:100% :: btn-primary install-btn installing stage-failed :: disabled=true :: aria=true', 'Defensor Público 2027 :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=true :: aria=false', 'Não foi possível baixar ou instalar esse edital premium. Tente atualizar a biblioteca e repetir.'],
      ['idle', 'TRT 2026 - Analista :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=false :: aria=false', 'Defensor Público 2027 :: Instalar :: --install-progress:0% :: btn-primary install-btn :: disabled=false :: aria=false', 'Não foi possível baixar ou instalar esse edital premium. Tente atualizar a biblioteca e repetir.'],
    ]), JSON.stringify(stages));
    check('S8 final: 0 concursos + installingId limpo + status com classe error', w.CT.getConcursos().length === 0 && lex(w, 'installingId') === ''
      && html(w, 'status') === 'Não foi possível baixar ou instalar esse edital premium. Tente atualizar a biblioteca e repetir.'
      && w.document.getElementById('status').classList.contains('error'));
  }
  {
    const t = boot({ preRun: (w) => { w.CT.saveConcurso({ nome: 'Defensor Público 2027', cargo: 'Defensor Público', banca: 'FGV' }); } });
    await tick(250);
    const w = t.w;
    check('S9: detecção loose (sameLooseText) acha o concurso pré-salvo', lex(w, "(()=>{const i=catalogItems.find(x=>x.id==='def-2027');const c=getInstalledPremiumContest(i);return c?c.nome:null;})()") === 'Defensor Público 2027');
    check('S9: botão já-instalado — label "Instalado" + title "Você já possui este edital instalado no perfil atual" + 100%', (() => { const b = (html(w, 'catalogGrid').match(/<button class="btn-primary install-btn[^"]*"[^>]*>[\s\S]*?<\/button>/) || [''])[0]; return (b.match(/install-label">[^<]*/) || [''])[0] === 'install-label">Instalado' && (b.match(/title="[^"]*"/) || [''])[0] === 'title="Você já possui este edital instalado no perfil atual"' && (b.match(/--install-progress:[^;"]*/) || [''])[0] === '--install-progress:100%'; })());
    lex(w, "installItem('def-2027')");
    check('S9: instalar já-instalado → modal installed visible + pushState {installedPremiumModal:true} + SEM novo concurso', w.document.getElementById('installedModal').classList.contains('visible')
      && JSON.stringify(w.history.state) === '{"installedPremiumModal":true}' && w.CT.getConcursos().length === 1);
    check('S9: copy do modal exata + box "Defensor Público 2027" / "FGV | Defensor Público"', txt(w, 'installedModalCopy') === 'O botão ficou verde porque este Edital Premium já está instalado no perfil atual. Para evitar duplicidade, o Track não instala uma segunda cópia automaticamente.'
      && html(w, 'installedModalBox') === '\n    <div class="installed-name">Defensor Público 2027</div>\n    <div class="installed-meta">FGV | Defensor Público</div>\n  ', JSON.stringify(html(w, 'installedModalBox')));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
    check('S9: Escape fecha installed + replaceState {…false}', !w.document.getElementById('installedModal').classList.contains('visible') && JSON.stringify(w.history.state) === '{"installedPremiumModal":false}');
    lex(w, 'openRequestNotice()');
    check('S9: request modal abre + pushState {installed:false, request:true}', w.document.getElementById('requestModal').classList.contains('visible') && JSON.stringify(w.history.state) === '{"installedPremiumModal":false,"requestPremiumModal":true}');
    w.dispatchEvent(new w.Event('popstate'));
    check('S9: popstate fecha request SEM replaceState (fromHistory=true → state intacto)', !w.document.getElementById('requestModal').classList.contains('visible') && JSON.stringify(w.history.state) === '{"installedPremiumModal":false,"requestPremiumModal":true}');
    lex(w, 'openRequestNotice()');
    check('S9: reabrir após popstate → pushState de novo (flag resetada) + Escape fecha com replaceState {request:false}', JSON.stringify(w.history.state) === '{"installedPremiumModal":false,"requestPremiumModal":true}'
      && (w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })), !w.document.getElementById('requestModal').classList.contains('visible'))
      && JSON.stringify(w.history.state) === '{"installedPremiumModal":false,"requestPremiumModal":false}');
    check('S9: requestMessage prefixo exato', lex(w, 'requestMessage()') === 'Olá! Não achei meu concurso na biblioteca de Editais Premium do Track Concursos. Gostaria de solicitar um Edital Premium. Concurso/cargo: ');
    const opens = [];
    w.open = (u, tgt, feat) => { opens.push([u, tgt, feat]); return null; };
    lex(w, 'openWhatsAppRequest()');
    check('S9: window.open do WhatsApp EXTERNO (phone 5589981383459 + msg encodeURIComponent + noopener,noreferrer)', !!opens[0]
      && opens[0][0].slice(0, 120) === 'https://api.whatsapp.com/send?phone=5589981383459&text=Ol%C3%A1!%20N%C3%A3o%20achei%20meu%20concurso%20na%20biblioteca%2'
      && opens[0][2] === 'noopener,noreferrer', opens[0] && opens[0][0]);
    lex(w, 'copyRequestEmail()');
    check('S9: copyRequestEmail sem clipboard → fallback execCommand → toast "OK E-mail copiado para a área de transferência."', (w.document.getElementById('ct-main-toast') || {}).innerHTML === '<span style="font-size:18px">OK</span> E-mail copiado para a área de transferência.', (w.document.getElementById('ct-main-toast') || {}).innerHTML);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
    check('S9: Escape sem modal aberto não lança erro (execCommand stub ok)', true);
  }

  console.log('== R13-F: import manual + pywebview + drag & drop (S10-S11) ==');
  {
    const t = boot({});
    await tick(250);
    const w = t.w;
    check('S10: estado inicial "Nenhum arquivo selecionado"/"Selecione um arquivo .json"/botão disabled', txt(w, 'manualFileName') === 'Nenhum arquivo selecionado' && txt(w, 'manualFileMeta') === 'Selecione um arquivo .json' && w.document.getElementById('manualImportBtn').disabled === true);
    lex(w, "readManualJsonFile(new File(['x'], 'nota.txt'))");
    check('S10: extensão errada → "Selecione um arquivo JSON válido." (R14 normalizou) + display block', txt(w, 'manualError') === 'Selecione um arquivo JSON válido.' && w.document.getElementById('manualError').style.display === 'block');
    lex(w, "readManualJsonFile(new File(['" + EXPORT_JSON.replace(/'/g, "\\'") + "'], 'meu-edital.json'))");
    await tick(80);
    check('S10: .json carregado → nome/meta "Arquivo carregado · 179 B" + botão habilitado + erro Some', txt(w, 'manualFileName') === 'meu-edital.json' && txt(w, 'manualFileMeta') === 'Arquivo carregado · 179 B' && w.document.getElementById('manualImportBtn').disabled === false && txt(w, 'manualError') === '');
    lex(w, 'importManualFile()');
    await tick(50);
    check('S10: import OK → successText "Arquivo importado: meu-edital.json." + successBar + toast + estado resetado + 1 concurso', txt(w, 'successText') === 'Arquivo importado: meu-edital.json.'
      && w.document.getElementById('successBar').classList.contains('visible')
      && (w.document.getElementById('ct-main-toast') || {}).innerHTML === '<span style="font-size:18px">OK</span> Edital Premium importado com sucesso.'
      && txt(w, 'manualFileName') === 'Nenhum arquivo selecionado' && txt(w, 'manualFileMeta') === 'Selecione um arquivo .json'
      && w.document.getElementById('manualImportBtn').disabled === true && w.CT.getConcursos().length === 1);
    lex(w, 'importManualFile()');
    check('S10: importar sem conteúdo → "Selecione um arquivo JSON antes de importar."', txt(w, 'manualError') === 'Selecione um arquivo JSON antes de importar.');
    lex(w, "setManualFileLoaded('{\\\"type\\\":\\\"x\\\"}', 'bad.json', 10)");
    lex(w, 'importManualFile()');
    await tick(30);
    check('S10: tipo inválido → "O arquivo não pode ser importado. Verifique se ele é um JSON válido do Edital Premium." + btn volta "Importar" habilitado (conteúdo mantido)', txt(w, 'manualError') === 'O arquivo não pode ser importado. Verifique se ele é um JSON válido do Edital Premium.'
      && w.document.getElementById('manualImportBtn').textContent === 'Importar' && w.document.getElementById('manualImportBtn').disabled === false);
    lex(w, "setManualFileLoaded('{}', undefined, 0)");
    check('S10: setManualFileLoaded sem nome → default "Edital Premium.json" + size Blob "Arquivo carregado · 2 B"', txt(w, 'manualFileName') === 'Edital Premium.json' && txt(w, 'manualFileMeta') === 'Arquivo carregado · 2 B');
    check('S10: fileSize 0→"" / 512→"512 B" / 2048→"2 KB" / 3MB→"3 MB"', lex(w, 'fileSize(0)') === '' && lex(w, 'fileSize(512)') === '512 B' && lex(w, 'fileSize(2048)') === '2 KB' && lex(w, 'fileSize(3 * 1024 * 1024)') === '3 MB');
  }
  {
    const t = boot({});
    await tick(250);
    const w = t.w;
    // pywebview ok (caminho windows → basename)
    w.pywebview = { api: { selecionar_arquivo_json: async () => ({ ok: true, conteudo: EXPORT_JSON, caminho: 'C:\\edits\\meu.json' }) } };
    await lex(w, 'openManualFile()');
    check('S11: pywebview ok → basename do caminho "meu.json" + "Arquivo carregado · 179 B" + sem erro', txt(w, 'manualFileName') === 'meu.json' && txt(w, 'manualFileMeta') === 'Arquivo carregado · 179 B' && txt(w, 'manualError') === '');
    w.pywebview.api.selecionar_arquivo_json = async () => ({ ok: false, motivo: 'cancelado' });
    lex(w, "setManualFileLoaded('', 'x', 0)");
    await lex(w, 'openManualFile()');
    check('S11: pywebview cancelado (motivo "cancelado") → SILENCIOSO (sem erro) + nome mantido "x"', txt(w, 'manualError') === '' && txt(w, 'manualFileName') === 'x');
    w.pywebview.api.selecionar_arquivo_json = async () => ({ ok: false, motivo: 'disco' });
    await lex(w, 'openManualFile()');
    check('S11: pywebview erro (outro motivo) → "Não foi possível carregar o arquivo selecionado."', txt(w, 'manualError') === 'Não foi possível carregar o arquivo selecionado.');
    delete w.pywebview;
    let clicked = false;
    w.document.getElementById('manualFileInput').click = () => { clicked = true; };
    lex(w, 'openManualFile()');
    check('S11: sem pywebview → clica o input file (guard §6.2 verbatim)', clicked === true);
    const zone = w.document.getElementById('manualDropZone');
    const mkDrag = (type) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = { types: ['Files'], files: [], dropEffect: '' }; return e; };
    zone.dispatchEvent(mkDrag('dragenter'));
    check('S11: dragenter → .drag-over', zone.classList.contains('drag-over') === true);
    zone.dispatchEvent(mkDrag('dragleave'));
    check('S11: dragleave → remove .drag-over', zone.classList.contains('drag-over') === false);
    zone.dispatchEvent(mkDrag('dragenter'));
    zone.dispatchEvent(mkDrag('dragover'));
    const dropEv = mkDrag('drop');
    dropEv.dataTransfer.files = [new w.File(['{}'], 'arrastado.json')];
    zone.dispatchEvent(dropEv);
    await tick(80);
    check('S11: drop na zona → lê arquivo "arrastado.json" + limpa drag', txt(w, 'manualFileName') === 'arrastado.json' && zone.classList.contains('drag-over') === false);
    zone.dispatchEvent(mkDrag('dragenter'));
    const outside = mkDrag('drop');
    outside.dataTransfer.files = [new w.File(['x'], 'fora.txt')];
    w.document.body.dispatchEvent(outside);
    check('S11: drop FORA da zona → limpa drag e NÃO mexe no arquivo carregado', zone.classList.contains('drag-over') === false && txt(w, 'manualFileName') === 'arrastado.json' && txt(w, 'manualError') === '');
    zone.dispatchEvent(mkDrag('dragenter'));
    const dropTxt = mkDrag('drop');
    dropTxt.dataTransfer.files = [new w.File(['x'], 'nota.txt')];
    zone.dispatchEvent(dropTxt);
    await tick(50);
    check('S11: drop .txt na zona → erro de extensão "Selecione um arquivo JSON válido." (R14 normalizou)', txt(w, 'manualError') === 'Selecione um arquivo JSON válido.');
  }

  console.log('== R13-G: offline 3 caminhos + cache/force/timer (S12-S13) ==');
  {
    const ERR = 'Não foi possível carregar a biblioteca premium. Verifique sua conexão e tente atualizar novamente.';
    const GRID_ERR = '<div class="empty">A biblioteca premium não carregou agora. Clique em Atualizar ou tente novamente em instantes.</div>';
    // 12a: sem cache + fetch falha
    {
      const t = boot({ fetchImpl: makeFetch({ failCatalog: true }) });
      await tick(200);
      const w = t.w;
      check('S12a: SEM cache + fetch falha → status de ERRO + empty state de carga', html(w, 'status') === ERR && w.document.getElementById('status').classList.contains('error') && html(w, 'catalogGrid') === GRID_ERR, html(w, 'status'));
    }
    // 12b: cache VÁLIDO + fetch falha + hidratações OK → restaura
    {
      const t = boot({ fetchImpl: makeFetch({ failCatalog: true }), preRun: (w) => { w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify(CATALOG)); } });
      await tick(200);
      const w = t.w;
      check('S12b: cache VÁLIDO + fetch falha + hidratações ok → RESTAURA: 3 cards + "cache local" + SEM erro (re-render pós-erro)', html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · cache local'
        && !w.document.getElementById('status').classList.contains('error') && (html(w, 'catalogGrid').match(/<article/g) || []).length === 3, html(w, 'status'));
    }
    // 12b': hidratações atrasadas → captura a sequência erro+apagado → restaurado
    {
      const t = boot({ fetchImpl: makeFetch({ failCatalog: true, delayHydrate: 300 }), preRun: (w) => { w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify(CATALOG)); } });
      await tick(50);
      const w = t.w;
      check('S12b\' meio (hidratações pendentes): pre-render → ERRO + grid apagado (else branch, §3.2)', html(w, 'status') === ERR && w.document.getElementById('status').classList.contains('error') && html(w, 'catalogGrid') === GRID_ERR, html(w, 'status'));
      await tick(500);
      check('S12b\' fim (hidratações concluíram): re-render restaura 3 cards + "cache local" + limpa error', html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · cache local'
        && !w.document.getElementById('status').classList.contains('error') && (html(w, 'catalogGrid').match(/<article/g) || []).length === 3, html(w, 'status'));
    }
    // 12d: TUDO offline → erro+apagado é o estado FINAL
    {
      const t = boot({ fetchImpl: makeFetch({ failAll: true }), preRun: (w) => { w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify(CATALOG)); } });
      await tick(200);
      const w = t.w;
      check('S12d: TUDO offline (catálogo+hidratações) → erro+grid apagado É o estado FINAL (quirk §3.2)', html(w, 'status') === ERR && w.document.getElementById('status').classList.contains('error') && html(w, 'catalogGrid') === GRID_ERR && (html(w, 'catalogGrid').match(/<article/g) || []).length === 0, html(w, 'status'));
    }
    // 12c: cache editais []
    {
      const t = boot({ fetchImpl: makeFetch({ failCatalog: true }), preRun: (w) => { w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify({ atualizadoEm: UPDATED, editais: [] })); } });
      await tick(200);
      const w = t.w;
      check('S12c: cache editais [] → "Não foi possível sincronizar agora. Mostrando o cache local da biblioteca." SEM erro + empty de FILTROS', html(w, 'status') === 'Não foi possível sincronizar agora. Mostrando o cache local da biblioteca.'
        && !w.document.getElementById('status').classList.contains('error') && html(w, 'catalogGrid') === '<div class="empty">Nenhum edital encontrado com esses filtros. Tente limpar a busca ou escolher outra banca.</div>', html(w, 'status'));
    }
    // 13a: cache + fetch OK → online
    {
      const t = boot({ preRun: (w) => { w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify(CATALOG)); } });
      await tick(200);
      const w = t.w;
      check('S13a: cache presente + fetch OK → fonte final "catálogo online" + 3 cards', html(w, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online' && (html(w, 'catalogGrid').match(/<article/g) || []).length === 3);
    }
    // 13b: force limpa os 2 caches antes do fetch
    {
      const notes = [];
      let w1 = null;
      const fi = makeFetch({ onFetch: (u) => { if (u.includes('catalog.json') && w1) notes.push({ cache: w1.localStorage.getItem('ct_premium_catalog_cache_v1') !== null, mats: w1.localStorage.getItem('ct_premium_materials_cache_v3') !== null }); } });
      const t = boot({ fetchImpl: fi });
      await tick(200);
      w1 = t.w;
      check('S13b: boot online grava os 2 caches (catálogo v1 + materiais v3)', w1.localStorage.getItem('ct_premium_catalog_cache_v1') !== null && w1.localStorage.getItem('ct_premium_materials_cache_v3') !== null && html(w1, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online');
      notes.length = 0;
      w1.fetch = makeFetch({ onFetch: (u) => { if (u.includes('catalog.json')) notes.push({ cache: w1.localStorage.getItem('ct_premium_catalog_cache_v1') !== null, mats: w1.localStorage.getItem('ct_premium_materials_cache_v3') !== null }); } });
      await lex(w1, 'loadCatalog(true)');
      await tick(200);
      check('S13b: loadCatalog(true) limpa os 2 caches ANTES do fetch (notes {false,false} no momento do fetch) + online + detailsCache resetado p/ [trt-2026] + selectedId \'\'', JSON.stringify(notes) === '[{"cache":false,"mats":false}]'
        && html(w1, 'status') === '<strong>3</strong> editals encontrados · atualizado em 10/11/2026 · catálogo online'
        && (html(w1, 'catalogGrid').match(/<article/g) || []).length === 3
        && JSON.stringify(lex(w1, 'Object.keys(detailsCache)')) === '["trt-2026"]' && lex(w1, 'selectedId') === '', JSON.stringify(notes));
    }
    // 13c: timer 00:05 + boot sem concurso + goPage + sem guard
    {
      const t = boot({});
      await tick(200);
      const w = t.w;
      const antes = lex(w, 'examRefreshTimer');
      check('S13c: scheduleExamTagRefresh agendou o refresh (timer truthy) e REAGENDA (handle novo)', lex(w, 'examRefreshTimer') !== null && typeof antes === 'number' && antes > 0, String(antes));
      lex(w, 'scheduleExamTagRefresh()');
      const depois = lex(w, 'examRefreshTimer');
      check('S13c: reagendamento troca o handle (clearTimeout + novo setTimeout às 00:05)', typeof depois === 'number' && depois > 0 && String(depois) !== String(antes), String(depois));
      check('S13c: boot SEM concurso → navSpy vazio (página standalone sem guard) + body sem sidebar (sideNome inexistente → "sem-side") + cId null', t.navSpy.length === 0 && txt(w, 'sideNome') === undefined || txt(w, 'sideNome') === 'sem-side' ? (t.navSpy.length === 0 && (w.document.getElementById('sideNome') === null) && w.sessionStorage.getItem('ct_concurso_ativo') === null) : false, JSON.stringify(t.navSpy));
      check('S13c: goPage exposto como global (onclick do body) + main SEM guard de concurso + botão Tema no body', typeof lex(w, 'goPage') === 'function' && !edMainSrc.includes("sessionStorage.getItem('ct_concurso_ativo')") && !!w.document.querySelector('[data-theme-toggle]'));
    }
  }

  console.log('');
  console.log(`== R13-editais: ${passed} PASS / ${failed} FAIL ==`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(2); });
