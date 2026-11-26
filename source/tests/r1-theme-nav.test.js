/**
 * Track do Oodeus — testes R1 (sistema visual + nav.js)
 * Sessão A: theme.js puro (jsdom) — contratos da Etapa 2 §5.
 * Sessão B: stack completa na ordem do original (theme → data → nav) em jsdom
 *           com host anexado — contratos da Etapa 3 §11 + integração dados→sidebar.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const themeSrc = read('theme.js');
const dataSrc = read('data.js');
const navSrc = read('nav.js');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function bootTheme({ storedTheme = null, vars = {} } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/concursos.html' });
  const w = dom.window;
  if (storedTheme != null) w.localStorage.setItem('ct_theme', storedTheme);
  // cssVar lê computed style: shim map-backed (o jsdom não resolve custom props)
  w.getComputedStyle = () => ({ getPropertyValue: (n) => (vars[n] !== undefined ? vars[n] : '') });
  const events = [];
  w.__events = events;
  w.addEventListener('ct-themechange', (e) => events.push(e.detail));
  vmRun(w, themeSrc);
  return { dom, w };
}

function vmRun(w, src, filename) {
  const vm = require('vm');
  vm.runInContext(src, dom.getContext(w), { filename: filename || 'script.js' });
}
const dom = { getContext(w) { return w.__ctx || (w.__ctx = require('vm').createContext(w)); } };

function bootFullStack({ page = null, seed = {} } = {}) {
  const markup = `<!doctype html><html><head></head><body>
  <nav class="nav" id="nav">
    <div class="nav-item" id="navDashboardOverview" onclick="location.href='dashboard.html'">Dashboard</div>
    <div class="nav-item" id="navRevisoes" data-nav="nav-revisoes">Revisões <span class="nav-badge" id="revBadge" style="display:none">0</span></div>
    <div class="nav-item" data-nav="nav-simulados">Simulados</div>
    <div class="nav-item" data-nav="nav-config">Config</div>
  </nav>
  <div class="sidebar">
    <div class="sidebar-logo"><span>Track</span></div>
    <div class="sidebar-concurso"></div>
  </div>
  <button data-goto="dashboard.html" id="btnGoto">Voltar</button>
  </body></html>`;
  const j = new JSDOM(markup, { pretendToBeVisual: true, url: 'http://localhost/app/concursos.html' });
  const w = j.window;
  const navigations = [];
  const host = initHost({
    data: JSON.parse(JSON.stringify(seed.data || {})),
    persist: () => true,
    window: w,
    navigate: (p) => { navigations.push(p); return true; },
    currentPage: () => (page || ''),
    assetBase: () => 'plugin-assets/remix-nav/',
  });
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  return { dom: j, w, CT: w.CTi(), navigations, host };
}

(async () => {
  console.log('== R1-A: theme.js (contratos Etapa 2 §5) ==');
  const t1 = bootTheme({});
  check('boot: data-theme=dark default', t1.w.document.documentElement.getAttribute('data-theme') === 'dark');
  check('boot: sem persistência e sem evento no load', t1.w.localStorage.getItem('ct_theme') === null && t1.w.__events.length === 0);
  check('API window.TrackTheme exposta', typeof t1.w.TrackTheme === 'object' && t1.w.TrackTheme.key === 'ct_theme');
  check('TrackTheme.setTheme light → data-theme', t1.w.TrackTheme.setTheme('light') === 'light' && t1.w.document.documentElement.getAttribute('data-theme') === 'light');
  check('setTheme persiste ct_theme', t1.w.localStorage.getItem('ct_theme') === 'light');
  check('ct-themechange disparado com palette', t1.w.__events.length === 1 && t1.w.__events[0].theme === 'light' && typeof t1.w.__events[0].palette === 'object' && 'heat5' in t1.w.__events[0].palette);

  const t2 = bootTheme({ storedTheme: 'light' });
  check('boot lê ct_theme salvo (light)', t2.w.document.documentElement.getAttribute('data-theme') === 'light');
  const t3 = bootTheme({ storedTheme: 'azul' });
  check('tema inválido → dark (resolveTheme)', t3.w.document.documentElement.getAttribute('data-theme') === 'dark');

  const t4 = bootTheme({});
  t4.w.TrackTheme.toggle();
  check('toggle: dark → light', t4.w.document.documentElement.getAttribute('data-theme') === 'light');
  t4.w.TrackTheme.toggle();
  check('toggle: light → dark', t4.w.document.documentElement.getAttribute('data-theme') === 'dark');

  const t5 = bootTheme({});
  t5.w.TrackTheme.setTheme('light');
  t5.w.__events.length = 0;
  const ev = new t5.w.Event('storage');
  ev.key = 'ct_theme'; ev.newValue = 'dark';
  t5.w.dispatchEvent(ev);
  check('storage event: aplica sem persistir', t5.w.document.documentElement.getAttribute('data-theme') === 'dark' && t5.w.localStorage.getItem('ct_theme') === 'light' && t5.w.__events.length === 1);

  const t6 = bootTheme({});
  t6.w.document.body.innerHTML = '<button data-theme-toggle id="tgl">tema</button>';
  t6.w.document.dispatchEvent(new t6.w.Event('DOMContentLoaded'));
  t6.w.document.getElementById('tgl').dispatchEvent(new t6.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('delegação [data-theme-toggle] alterna', t6.w.document.documentElement.getAttribute('data-theme') === 'light');

  console.log('== R1-B: stack completa theme→data→nav (contratos Etapa 3 §11) ==');
  // Boot limpo, sem concurso
  const b1 = bootFullStack();
  check('estilos injetados (5 ids canônicos)', ['tc-nav-icon-style', 'tc-sidebar-scroll-style', 'tc-version-style', 'flashcards-nav-style', 'sidebar-concurso-nav-style'].every(id => b1.w.document.getElementById(id)));
  check('version check anexado com v1.0.6', (b1.w.document.querySelector('.sidebar-logo .tc-version-current') || {}).textContent === 'v1.0.6');
  check('item Flashcards criado após Revisões', !!(b1.w.document.getElementById('navFlashcardsDashboard') && b1.w.document.getElementById('navFlashcardsDashboard').previousElementSibling.id === 'navRevisoes'));
  check('ícone do Dashboard injetado (data-nav-icon)', b1.w.document.querySelector('#navDashboardOverview .tc-nav-icon[data-nav-icon="dashboard"]') !== null);
  check('URL do ícone usa assetBase do host', (b1.w.document.querySelector('#navDashboardOverview .tc-nav-icon').getAttribute('style') || '').includes('plugin-assets/remix-nav/home-4-fill.svg'));
  const card1 = b1.w.document.querySelector('.sidebar-concurso');
  check('card sem concurso: canônico com —', card1.getAttribute('data-sidebar-canonical') === '1' && (card1.querySelector('#sideNome') || {}).textContent === '—');
  check('card clicável (role=button)', card1.getAttribute('role') === 'button' && card1.classList.contains('clickable'));
  check('API window.CT_renderSidebarConcursoInfo exposta', typeof b1.w.CT_renderSidebarConcursoInfo === 'function');
  check('badge de revisões escondida sem revisões', (b1.w.document.getElementById('revBadge') || {}).style.display === 'none');

  // navegação declarativa + rota descartada
  b1.w.document.querySelector('[data-nav="nav-simulados"]').dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true }));
  check('nav-simulados navega via host', b1.navigations.includes('simulados.html'));
  const navCountBefore = b1.navigations.length;
  b1.w.document.querySelector('[data-nav="nav-config"]').dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true }));
  check('nav-config: rota descartada (não navega)', b1.navigations.length === navCountBefore);
  b1.w.document.getElementById('btnGoto').dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true }));
  check('[data-goto] navega', b1.navigations.includes('dashboard.html'));

  // flashcards: criar item e navegar
  b1.navigations.length = 0;
  b1.w.document.getElementById('navFlashcardsDashboard').dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('openFlashcards: ct_dashboard_tab=flashcards', b1.w.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards');
  check('openFlashcards: navega dashboard.html#flashcards', b1.navigations.includes('dashboard.html#flashcards'));

  // Card com concurso ativo (pós-edital, sem dataProva → —)
  const c2 = bootFullStack({ page: 'dashboard.html' });
  c2.CT.saveConcurso({ nome: 'Concurso Teste', banca: 'CEBRASPE', cargo: 'Analista', salario: 'R$ 12.345,67 + auxílio' });
  const cid = c2.CT.getConcursos()[0].id;
  c2.w.sessionStorage.setItem('ct_concurso_ativo', cid);
  c2.w.CT_renderSidebarConcursoInfo();
  const card2 = c2.w.document.querySelector('.sidebar-concurso');
  check('card com concurso: nome e banca renderizados', (card2.querySelector('#sideNome') || {}).textContent === 'Concurso Teste' && (card2.querySelector('#sideBanca') || {}).textContent === 'CEBRASPE');
  check('card: cargo/salário canônico com sufixo preservado', ((card2.querySelector('.concurso-salario') || {}).textContent || '') === 'R$ 12.345,67 + auxílio');
  check('card: sem dataProva → timer —', (card2.querySelector('#sideTimer') || {}).textContent === '—');

  // pós-edital com dataProva → dias coloridos
  c2.CT.saveConcurso({ id: cid, nome: 'Concurso Teste', banca: 'CEBRASPE', cargo: 'Analista', dataProva: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10) });
  c2.w.CT_renderSidebarConcursoInfo();
  const diasTxt = (c2.w.document.querySelector('#sideTimer') || {}).textContent;
  const diasCor = (c2.w.document.querySelector('#sideTimer') || {}).style ? c2.w.document.querySelector('#sideTimer').getAttribute('style') || '' : '';
  check('card pós-edital: dias numéricos', /^\d+$/.test(String(diasTxt).trim()), 'diasTxt=' + diasTxt);
  check('card pós-edital: dias > 30 → cor accent', diasCor.includes('var(--accent)') && !diasCor.includes('var(--orange)'), diasCor);

  // pré-edital → painel rocket
  const c3 = bootFullStack({ page: 'dashboard.html' });
  c3.CT.saveConcurso({ nome: 'Pré-Edital', preEdital: true, coberto: 3 });
  const cid3 = c3.CT.getConcursos()[0].id;
  c3.w.sessionStorage.setItem('ct_concurso_ativo', cid3);
  c3.w.CT_renderSidebarConcursoInfo();
  const card3 = c3.w.document.querySelector('.sidebar-concurso');
  check('pré-edital: kicker PRÉ-EDITAL', ((card3.querySelector('.pre-rocket-kicker') || {}).textContent || '').toUpperCase().includes('PRÉ-EDITAL'));
  check('pré-edital: coberto ×3', ((card3.querySelector('.pre-rocket-count') || {}).textContent || '').includes('×3'));
  check('pré-edital: modo pre-edital-mode', card3.querySelector('.timer-box').classList.contains('pre-edital-mode'));

  // clique no card fora do dashboard → flag + navegação
  const c4 = bootFullStack({ page: 'concursos.html' });
  c4.CT.saveConcurso({ nome: 'X' });
  const cid4 = c4.CT.getConcursos()[0].id;
  c4.w.sessionStorage.setItem('ct_concurso_ativo', cid4);
  c4.w.CT_renderSidebarConcursoInfo();
  c4.navigations.length = 0;
  c4.w.document.querySelector('.sidebar-concurso').dispatchEvent(new c4.w.MouseEvent('click', { bubbles: true }));
  check('clique no card: flag ct_open_concurso_options', c4.w.sessionStorage.getItem('ct_open_concurso_options') === '1');
  check('clique no card: navega ao dashboard', c4.navigations.includes('dashboard.html'));

  // badge de flashcards (due) — regra da Etapa 3 §6
  const c5 = bootFullStack({ page: 'dashboard.html' });
  c5.CT.saveConcurso({ nome: 'Y' });
  const cid5 = c5.CT.getConcursos()[0].id;
  c5.w.sessionStorage.setItem('ct_concurso_ativo', cid5);
  c5.CT._set('ct_flashcards', [
    { concursoId: cid5, srs: { status: 'new' } },
    { concursoId: cid5, srs: { status: 'review', nextReview: '2099-01-01T00:00:00' } },
    { concursoId: 'outro', srs: { status: 'new' } },
  ]);
  c5.w.CT_renderSidebarConcursoInfo();
  const badge = c5.w.document.getElementById('flashTabBadge');
  check('badge flashcards: 1 due (>0 visível com contagem)', badge.textContent === '1' && badge.style.display === 'inline-flex');

  // integração: ct-data-updated (emitido por questões/sessões — Etapa 1 §23) →
  // refresh do card com o concurso ativo corrente (Etapa 3 §10)
  const c6 = bootFullStack({ page: 'dashboard.html' });
  c6.CT.saveConcurso({ nome: 'Antes' });
  const cid6 = c6.CT.getConcursos()[0].id;
  c6.w.sessionStorage.setItem('ct_concurso_ativo', cid6);
  c6.w.CT_renderSidebarConcursoInfo();
  check('setup: card mostra o concurso ativo', (c6.w.document.querySelector('#sideNome') || {}).textContent === 'Antes');
  c6.CT.saveConcurso({ nome: 'Novo Ativo' });
  const cid6b = c6.CT.getConcursos().find(c => c.nome === 'Novo Ativo').id;
  c6.w.sessionStorage.setItem('ct_concurso_ativo', cid6b);
  // evento de questão (lancarQuestoes) dispara o listener do nav.js
  c6.CT.lancarQuestoes({ concursoId: cid6b, materiaId: null, resolvidas: 10, acertos: 8, erros: 2 });
  check('ct-data-updated (questões) → card re-renderizado com o ativo corrente', (c6.w.document.querySelector('#sideNome') || {}).textContent === 'Novo Ativo');

  console.log('\n== resultado: ' + passed + ' PASS, ' + failed + ' FAIL ==');
  if (failed) {
    console.log('FALHAS: ' + failures.join(' | '));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('ERRO FATAL no teste R1: ' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join('\n') : e));
  process.exit(1);
});
