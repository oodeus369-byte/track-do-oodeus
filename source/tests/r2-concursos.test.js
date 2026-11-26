/**
 * Track do Oodeus — testes R2 (página Concursos + shell de views)
 * Sessão A: helpers de render (render-util) — reescritas de plataforma.
 * Sessão B+: render da página concursos pela sequência EXATA do shell
 *            (styles → body → dev_template_ia → nav boot → script via vm —
 *            realm clássico) — critérios "igualzinho" da Etapa 5 §4 (1–4)
 *            + backing store (observação #2056: asserir contra o payload
 *            persistido, não contra a fachada).
 * Nota de ambiente: os helpers de render-util leem o `window` global do escopo
 * (no renderer do Obsidian é o global real; no teste, bootPlugin fixa
 * global.window = w por boot, sequencial).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');
const {
  PAGE_BODY_CLASS,
  scopeBodySelectors,
  rewriteThemeAssetUrls,
  rewriteBodyAssetSrc,
  rewritePageCssAssetUrls,
  runPageScripts,
} = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const themeSrc = read('src/theme.js');
const dataSrc = read('src/data.js');
const navSrc = read('src/nav.js');
const devSrc = read('src/dev_template_ia.js');
const pageMainSrc = read('pages/concursos/main.pagejs');
const pageStyleCss = read('pages/concursos/style.css');
const pageBodyHtml = read('pages/concursos/body.html');
const themeCss = read('src/theme.css');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const vm = require('vm');
function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename: filename || 'script.js' });
}

// Backing store real (no jsdom o override do Storage não gruda — Chromium real
// permite; os dados do CT vivem no localStorage do jsdom, que é o backing store
// por trás da fachada CT nesta sessão de teste).
function storedKey(w, key) {
  const raw = w.localStorage.getItem(key);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

// boot em jsdom na sequência do plugin (theme → data → nav, com shell flag)
function bootPlugin({ seed = {} } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  global.window = w; // render-util lê o window do escopo (sequencial neste teste)
  const navigations = [];
  const persistedPayloads = [];
  initHost({
    data: JSON.parse(JSON.stringify(seed)),
    persist: (d) => { persistedPayloads.push(JSON.parse(JSON.stringify(d))); return true; },
    window: w,
    navigate: (p) => { navigations.push(p); return true; },
    currentPage: () => (w.__testPage || ''),
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_SHELL__ = true;
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  return { dom: j, w, navigations, persistedPayloads };
}

// render da página concursos pela sequência EXATA do shell.js (etapas 1–5)
function renderConcursos(t) {
  const { w } = t;
  const head = w.document.head;
  head.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
  const pageStyleEl = w.document.createElement('style');
  pageStyleEl.setAttribute('data-ct-style', 'page');
  pageStyleEl.textContent = scopeBodySelectors(pageStyleCss);
  head.appendChild(pageStyleEl);
  const themeStyleEl = w.document.createElement('style');
  themeStyleEl.setAttribute('data-ct-style', 'theme');
  themeStyleEl.textContent = rewriteThemeAssetUrls(scopeBodySelectors(themeCss));
  head.appendChild(themeStyleEl);

  const content = w.document.createElement('div');
  content.className = PAGE_BODY_CLASS;
  w.document.body.appendChild(content);
  content.innerHTML = rewriteBodyAssetSrc(pageBodyHtml);

  vmRun(w, devSrc, 'dev_template_ia.js');
  // [R3] cadeia de scripts pelo runner REAL do shell (injeção clássica +
  // DOMContentLoaded sintético por render — mesma ordem do original).
  runPageScripts(w, content, { scripts: [pageMainSrc] }, {
    label: 'concursos.html',
    navBoot: () => { if (typeof w.__CT_NAV_BOOT === 'function') w.__CT_NAV_BOOT(); },
  });
  t.content = content;
  return content;
}

(async () => {
  console.log('== R2-A: helpers de render (plataforma) ==');
  const scope = scopeBodySelectors('body{background:#000} .card-body{padding:4px}\nhtml,\nbody {\n  color:#fff;\n}\nbody, .x { margin:0 }');
  const regexBareBody = /(^|[^\w.-])body\s*\{/;
  check('body solto → .ct-page-body', scope.includes('.ct-page-body{background:#000}'));
  check('html,\\nbody do theme.css → .ct-page-body (sem body nem html, restantes)', !regexBareBody.test(scope) && !scope.includes('html,'));
  check('.card-body NÃO é tocado', scope.includes('.card-body{padding:4px}'));
  const prevWindow = global.window;
  global.window = { __CT_HOST__: { assetUrl: (r) => 'app://t/' + r } };
  const htmlRewritten = rewriteBodyAssetSrc('<img src="assets/Track Concursos logo.png" alt="a"><img src="https://ext/x.png">');
  global.window = prevWindow;
  check('body: src="assets/…" → assetUrl; externo intacto', htmlRewritten.includes('src="app://t/assets/Track Concursos logo.png"') && htmlRewritten.includes('https://ext/x.png'));

  console.log('== R2-B: boot do plugin na ordem do original (shell flag) ==');
  const b0 = bootPlugin();
  check('__CT_SHELL__ suprime boot imediato do nav (sem estilos injetados)', !b0.w.document.getElementById('tc-nav-icon-style'));
  check('nav expõe __CT_NAV_BOOT e __CT_NAV_GO_PAGE', typeof b0.w.__CT_NAV_BOOT === 'function' && typeof b0.w.__CT_NAV_GO_PAGE === 'function');

  console.log('== R2-C: render da página Concursos (ordem de carga — crit. 1) ==');
  const b1 = bootPlugin();
  const content = renderConcursos(b1);
  const head = b1.w.document.head;
  const styles = head.querySelectorAll('[data-ct-style]');
  check('2 styles injetados na ordem original (página ANTES de theme.css)', styles.length === 2 && styles[0].getAttribute('data-ct-style') === 'page' && styles[1].getAttribute('data-ct-style') === 'theme');
  check('style inline da página byte-preservado no <style>', (styles[0].textContent || '').includes('  :root{--bg:#0d0f14'));
  check('theme.css injetado depois, com assetBase nas máscaras', (styles[1].textContent || '').includes('app://plugin/assets/remix-nav/home-4-line.svg') && !regexBareBody.test(styles[1].textContent));
  check('contentEl com classe ct-page-body', content.className === PAGE_BODY_CLASS);
  check('modais estáticos presentes (modalDetalhes/modalPerfil/modalImportPremium/modalDevToolsHub)', ['modalDetalhes', 'modalPerfil', 'modalImportPremium', 'modalDevToolsHub'].every(id => content.querySelector('#' + id)));
  check('logo do top-bar com assetUrl do plugin', (content.querySelector('img.brand-logo') || { getAttribute: () => '' }).getAttribute('src') === 'app://plugin/assets/Track Concursos logo.png');
  check('dev_template_ia carregado SÓ aqui (4 métodos em window.CT)', ['modeloTemplateEditalIA', 'gerarPromptTemplateEditalIA', 'pacotePromptTemplateEditalIA', 'exportarPacotePromptTemplateEditalIA'].every(m => typeof b1.w.CT[m] === 'function'));
  check('nav boot por render: estilos canônicos do nav', ['tc-nav-icon-style', 'tc-version-style', 'flashcards-nav-style', 'sidebar-concurso-nav-style'].every(id => b1.w.document.getElementById(id)));
  check('versão v1.0.6 anexada ao .logo (nav mira .sidebar-logo/.logo)', (b1.w.document.querySelector('.logo .tc-version-current') || {}).textContent === 'v1.0.6');
  check('render() top-level rodou: stats globais (0 estudo → 0min)', (content.querySelector('#sHoras') || {}).textContent === '0min');
  check('empty-state no gridFoco sem concursos', (content.querySelector('#gridFoco .empty-title') || {}).textContent === 'Nenhum concurso ainda');
  check('seção realizados escondida sem realizados', content.querySelector('#secRealizados').style.display === 'none');
  check('funções globais do script (onclick inline funcionam)', typeof b1.w.abrirDash === 'function' && typeof b1.w.render === 'function' && typeof b1.w.goPage === 'function');

  console.log('== R2-D: gênero flexível (crit. 2) ==');
  const b2 = bootPlugin();
  renderConcursos(b2);
  check('flexGenero masculino default', b2.w.flexGenero('Aprovado', 'Aprovada') === 'Aprovado');
  b2.w.localStorage.setItem('ct_profile_genero', 'feminino');
  check('flexGenero lê fallback do localStorage', b2.w.flexGenero('Aprovado', 'Aprovada') === 'Aprovada');
  check('resultadoTexto sensível a gênero', b2.w.resultadoTexto('cr').includes('Classificad'));
  b2.w.localStorage.removeItem('ct_profile_genero');

  console.log('== R2-E: cards ativos com FAIXAS local + faixa por assetUrl (crit. 3) ==');
  const b3 = bootPlugin();
  b3.w.CT.saveConcurso({ nome: 'Foco Um', banca: 'CEBRASPE' });
  b3.w.CT.saveConcurso({ nome: 'Foco Dois' });
  renderConcursos(b3);
  const gF = b3.w.document.getElementById('gridFoco');
  check('2 cards de concurso no gridFoco', gF.querySelectorAll('[data-contest-card]').length === 2);
  const card1 = gF.querySelector('[data-contest-card]');
  // ordenarMeusConcursos: fallback = nome (localeCompare) → 'Foco Dois' primeiro
  check('card: nome do concurso (ordem fallback por nome)', ((card1.querySelector('.card-nome') || {}).textContent || '').includes('Foco Dois'));
  check('card: faixa via cópia local de FAIXAS com assetUrl', (card1.querySelector('img[src*="faixas/faixabranca.png"]') || { getAttribute: () => '' }).getAttribute('src') === 'app://plugin/assets/faixas/faixabranca.png');
  check('card: handle de drag presente', card1.querySelector('[data-drag-handle]') !== null);
  check('add-card "+ Novo concurso" presente', gF.querySelector('.add-card .add-text').textContent === 'Novo concurso');

  console.log('== R2-F: drag&drop pointer-based + persistência via CT._set (crit. 4) ==');
  const b4 = bootPlugin();
  b4.w.CT.saveConcurso({ nome: 'A' });
  b4.w.CT.saveConcurso({ nome: 'B' });
  b4.w.CT.saveConcurso({ nome: 'C' });
  renderConcursos(b4);
  const ids = b4.w.CT.getConcursos().map(c => c.id);
  b4.w.salvarOrganizacaoMeusConcursos('mira', [ids[2], ids[0]]);
  const stored1 = storedKey(b4.w, 'ct_concursos');
  check('backing store: grupoMeusConcursos=mira nos 2 passados', stored1.find(c => c.id === ids[0]).grupoMeusConcursos === 'mira' && stored1.find(c => c.id === ids[2]).grupoMeusConcursos === 'mira');
  check('backing store: ordemMeusConcursos 1..n conforme passado', stored1.find(c => c.id === ids[2]).ordemMeusConcursos === 1 && stored1.find(c => c.id === ids[0]).ordemMeusConcursos === 2);
  check('B (não passado) sem grupo/ordem', stored1.find(c => c.id === ids[1]).grupoMeusConcursos === undefined);
  // re-render pela função global do script → grids na ordem/grupo gravados
  b4.w.render();
  const gF4 = b4.w.document.getElementById('gridFoco');
  const gM4 = b4.w.document.getElementById('gridMira');
  const namesFoco = Array.from(gF4.querySelectorAll('[data-contest-card] .card-nome')).map(e => e.textContent.trim());
  const namesMira = Array.from(gM4.querySelectorAll('[data-contest-card] .card-nome')).map(e => e.textContent.trim());
  check('grupo mira no gridMira na ordem gravada', JSON.stringify(namesMira) === JSON.stringify(['C', 'A']), namesMira.join('|'));
  check('B continua no gridFoco', JSON.stringify(namesFoco) === JSON.stringify(['B']), namesFoco.join('|'));
  // moverGrupoConcurso toggle
  b4.w.moverGrupoConcurso(ids[1], 'mira');
  const stored2 = storedKey(b4.w, 'ct_concursos');
  check('moverGrupoConcurso: B vai para mira com ordem max+1', stored2.find(c => c.id === ids[1]).grupoMeusConcursos === 'mira' && stored2.find(c => c.id === ids[1]).ordemMeusConcursos === 3);
  // drag pointer-based: mousedown no handle → ghost + placeholder
  const cardA = b4.w.document.querySelector('[data-contest-card]');
  const handle = cardA.querySelector('[data-drag-handle]');
  handle.dispatchEvent(new b4.w.MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
  check('startContestPointerDrag: card .dragging + ghost no body + placeholder', cardA.classList.contains('dragging') && b4.w.document.querySelector('.drag-ghost') !== null && b4.w.document.querySelector('.concurso-placeholder') !== null);
  b4.w.document.dispatchEvent(new b4.w.MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 }));
  b4.w.document.dispatchEvent(new b4.w.MouseEvent('mouseup', { bubbles: true }));
  check('endContestPointerDrag: ghost/placeholder removidos', b4.w.document.querySelector('.drag-ghost') === null && b4.w.document.querySelector('.concurso-placeholder') === null);
  check('endContestPointerDrag: dados íntegros após o drop', (storedKey(b4.w, 'ct_concursos') || []).length === 3);

  console.log('== R2-G: toggleStat + abrirDash/goPage (navegação via host) ==');
  const b5 = bootPlugin();
  b5.w.CT.saveConcurso({ nome: 'X' });
  const idX = b5.w.CT.getConcursos()[0].id;
  renderConcursos(b5);
  b5.w.toggleStat(idX, false);
  const stored5 = storedKey(b5.w, 'ct_concursos');
  check('toggleStat: contarEstatisticas=false no backing store', stored5[0].contarEstatisticas === false);
  b5.w.abrirDash(idX);
  check('abrirDash: ct_concurso_ativo + navegação ao dashboard via host', b5.w.sessionStorage.getItem('ct_concurso_ativo') === idX && b5.navigations.includes('dashboard.html'));
  b5.w.goPage('cadastro_edital.html?editar=abc');
  check('goPage da página: host recebe query string', b5.navigations.includes('cadastro_edital.html?editar=abc'));

  console.log('== R2-H: premium — cache fallback sem fetch (jsdom) ==');
  const b6 = bootPlugin();
  b6.w.localStorage.setItem('ct_premium_catalog_cache_v1', JSON.stringify({
    editais: [{ id: 'e1', titulo: 'Edital Teste', banca: 'FP', arquivo: 'https://raw/x.json', atualizadoEm: '2026-01-01' }],
    atualizadoEm: '2026-01-01T00:00:00Z',
  }));
  renderConcursos(b6);
  // fetch indisponível no jsdom → força (botão Atualizar) ANTES de qualquer
  // pré-aplicação: catch aplica o cache e define o status local (original 1497–1506)
  await b6.w.carregarCatalogoPremium(true);
  const status6 = (b6.w.document.getElementById('premiumCatalogStatus') || {}).textContent || '';
  check('fallback ao cache: status local da biblioteca', status6.includes('cache local'), status6);
  const grid6 = b6.w.document.getElementById('premiumCatalogGrid');
  check('catálogo do cache renderizado no grid', (grid6.textContent || '').includes('Edital Teste'));
  // abrir o modal normalmente: pré-aplicação do cache + modal visível
  b6.w.abrirModalImportPremium();
  const overlay6 = b6.w.document.getElementById('modalImportPremium');
  check('modalImportPremium visível', overlay6.classList.contains('visible'));

  console.log('== R2-I: boot duplo do nav sem quebrar ==');
  const before = b6.w.document.querySelectorAll('#tc-nav-icon-style').length;
  b6.w.__CT_NAV_BOOT();
  b6.w.__CT_NAV_BOOT();
  const after = b6.w.document.querySelectorAll('#tc-nav-icon-style').length;
  check('boot duplo/triplo: estilos idempotentes (1 de cada)', before === 1 && after === 1);
  check('boot duplo: listeners globais uma única vez (guard)', b6.w.__ctNavGlobalListeners === true);

  console.log('\n== resultado: ' + passed + ' PASS, ' + failed + ' FAIL ==');
  if (failed) {
    console.log('FALHAS: ' + failures.join(' | '));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('ERRO FATAL no teste R2: ' + (e && e.stack ? e.stack.split('\n').slice(0, 10).join('\n') : e));
  process.exit(1);
});
