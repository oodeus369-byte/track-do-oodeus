/**
 * Track do Oodeus — testes R16 (3 bugs reportados pelo Oodeus com screenshot)
 *
 * BUG1 — pomodoro com FAB duplicado: a cadeia de scripts re-executa a cada
 *   render da view (re-render in-place), diferente do original (location.href
 *   zera o DOM). Cada navegação acumulava +1 #timerFab, +1 #timerPopup, +1
 *   <style>, +1 listener keydown e +1 setInterval (probe r16h: 1→2→3 FABs).
 * BUG2 — "Novo Tópico" não adicionava: window.prompt() lança "prompt() is not
 *   supported." no Electron e as funções eram síncronas (mriam no prompt antes
 *   de CT.saveTopico). Fix: CT.prompt modal assíncrono (src/data.js.showPrompt)
 *   + call sites em await.
 * BUG3 — layout quebrado no Cronograma Inteligente: regras de plataforma
 *   (app.css `button`, app.css `button:not(.clickable-icon)` e um <style>
 *   EXTERNO inline#44 de outro plugin/tema) venciam a classe .choice-card do
 *   port (0,1,0): uppercase/nowrap/center faziam os filhos dimensionar por
 *   max-content (card 483 → scrollWidth 968; grid 980 → 2059 — probe r16k).
 * BUG4 — achado na revalidação (pré-existente, mesma família do BUG1): o
 *   dispatch DCL sintético re-disparava handlers de renders anteriores/outras
 *   páginas — o handler da aba (script2 L62) chamava goPage em TODO render,
 *   inclusive no do dashboard → render síncrono → dispatch → handler → … →
 *   stack overflow (probe r16o: RangeError ×49; TypeError ×N em
 *   renderPainelProva via listeners/timers órfãos). Fix em runPageScripts:
 *   DCL one-shot + limpeza dos listeners da cadeia no próximo render.
 *
 * Sessão A: idempotência do timer-popup em jsdom (3 renders → 1 FAB/1 popup/
 *           1 style; intervalo do timer não acumula; teardown automático).
 * Sessão B: CT.prompt — contrato do nativo (string|''|null) + end-to-end do
 *           adicionarTopico + call sites sem prompt() nativo (dead code do
 *           cadastro preservado e provado morto).
 * Sessão C: choice-card — neutralizador com valores UA medidos (r16k), escopo
 *           .ct-page-body, paridade byte-a-byte com o original e invariantes
 *           (não sobrescreve regra nossa; mesma cor de fundo).
 * Sessão D: invariantes de fonte — limpeza do shell (navegar para fora),
 *           guard de intervalo do crono-cycle, teardown/marca do timer.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { PLATFORM_NEUTRALIZE_CSS, scopeBodySelectors, rewriteThemeAssetUrls, rewriteBodyAssetSrc, rewritePageCssAssetUrls, runPageScripts } = require('../src/render-util');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const themeSrc = read('src/theme.js');
const dataSrc = read('src/data.js');
const navSrc = read('src/nav.js');
const shellSrc = read('src/shell.js');
const themeCss = read('src/theme.css');
const pageStyleCss = read('pages/aba-materia/style.css');
const pageBodyHtml = read('pages/aba-materia/body.html');
const script1Src = read('pages/aba-materia/script1.pagejs');
const script2Src = read('pages/aba-materia/script2.pagejs');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const flashSrc = read('pages/flashcards/flashcards.pagejs');
const concSrc = read('pages/concursos/main.pagejs');
const cadSrc = read('pages/cadastro/script3.pagejs');
const cadBody = read('pages/cadastro/body.html');
const cronoSrc = read('pages/crono/crono-cycle.pagejs');
const cronoCss = read('pages/crono-inteligente/style.css');
const origCi = fs.readFileSync('C:\\Users\\maest\\AppData\\Local\\Programs\\Track Concursos\\www\\cronograma_inteligente.html', 'utf8');

const abaPage = { scripts: [script1Src, script2Src, timerSrc], lazyModules: [] };

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
const tick = (ms) => new Promise(r => setTimeout(r, ms));

// Prompt nativo fora de comentário/string (o cabeçalho dos ports cita "prompt()").
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}
const barePrompt = /(?<![.\w])prompt\s*\(/;

function bootPlugin({ timerSeed = null, onNavigate = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  // Quirk #2053 (harness R4/R5): listeners DCL capturados para remoção pós-DCL.
  w.__ctDclListeners = [];
  const origAddEventListener = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') w.__ctDclListeners.push(fn);
    return origAddEventListener(type, fn, opts);
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  global.window = w;
  initHost({
    data: {},
    persist: () => true,
    window: w,
    navigate: (p) => { if (onNavigate) onNavigate(p); return true; },
    currentPage: () => '',
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_SHELL__ = true;
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  const cId = w.CT.getConcursos()[0].id;
  w.CT.saveMateria({ concursoId: cId, nome: 'Português' });
  const mId = w.CT.getMaterias().filter(m => m.concursoId === cId)[0].id;
  const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mId, nome: 'Concordância' });
  w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Regência' });
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  w.sessionStorage.setItem('ct_materia_ativa', mId);
  if (timerSeed) w.sessionStorage.setItem('ct_timer_state', JSON.stringify(timerSeed));
  return { dom: j, w, cId, mId, t1 };
}

// Espelho do appOodeusRender do shell (styles + body + runPageScripts). NÃO
// remove #timerFab/#timerPopup de propósito: é exatamente o cenário do bug1.
function renderAba(t) {
  const { w } = t;
  if (t.content && t.content.parentNode) t.content.remove();
  w.__CT_PAGE_SEARCH__ = '';
  const head = w.document.head;
  head.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
  const pageStyleEl = w.document.createElement('style');
  pageStyleEl.setAttribute('data-ct-style', 'page');
  pageStyleEl.textContent = PLATFORM_NEUTRALIZE_CSS + scopeBodySelectors(rewritePageCssAssetUrls(pageStyleCss));
  head.appendChild(pageStyleEl);
  const themeStyleEl = w.document.createElement('style');
  themeStyleEl.setAttribute('data-ct-style', 'theme');
  themeStyleEl.textContent = rewriteThemeAssetUrls(scopeBodySelectors(themeCss));
  head.appendChild(themeStyleEl);

  const content = w.document.createElement('div');
  content.className = 'ct-page-body';
  w.document.body.appendChild(content);
  content.innerHTML = rewriteBodyAssetSrc(pageBodyHtml);

  w.__ctScriptLog = [];
  w.document.addEventListener('DOMContentLoaded', () => w.__ctScriptLog.push('dcl-marker'));
  runPageScripts(w, content, abaPage, {
    label: 'aba',
    navBoot: () => {
      w.__ctScriptLog.push('nav-boot');
      if (typeof w.__CT_NAV_BOOT === 'function') w.__CT_NAV_BOOT();
    },
  });
  t.content = content;
  (w.__ctDclListeners || []).splice(0).forEach(fn => {
    try { w.document.removeEventListener('DOMContentLoaded', fn); } catch { /* noop */ }
  });
  return content;
}

(async () => {
  console.log('== R16-A: BUG1 — FAB/popup/style/intervalos idempotentes por navegação ==');
  {
    const t = bootPlugin({
      timerSeed: { mode: 'free', open: false, freeRunning: true, freeSeconds: 10, lastTick: Date.now(), pomoRunning: false, sessions: [], fabPos: { x: 215, y: 28 } },
    });
    const { w } = t;

    // Espelho de intervalos ativos (nestas telas só o timer usa setInterval).
    const live = new Set();
    const origSI = w.setInterval;
    const origCI = w.clearInterval;
    w.setInterval = function (fn, ms) { const id = origSI.call(w, fn, ms); live.add(id); return id; };
    w.clearInterval = function (id) { live.delete(id); return origCI.call(w, id); };

    // Espelho de add/removeEventListener('keydown').
    let keyAdds = 0;
    let keyRemoves = 0;
    const origAdd = w.document.addEventListener.bind(w.document);
    const origRemove = w.document.removeEventListener.bind(w.document);
    w.document.addEventListener = function (type, fn, opts) { if (type === 'keydown') keyAdds++; return origAdd(type, fn, opts); };
    w.document.removeEventListener = function (type, fn, opts) { if (type === 'keydown') keyRemoves++; return origRemove(type, fn, opts); };

    renderAba(t); // 1ª navegação
    const fab1 = w.document.querySelectorAll('#timerFab').length;
    const live1 = live.size;
    renderAba(t); // 2ª
    renderAba(t); // 3ª

    const fabs = w.document.querySelectorAll('#timerFab').length;
    const popups = w.document.querySelectorAll('#timerPopup').length;
    const styles = w.document.querySelectorAll('style[data-ct-timer-popup]').length;
    check('1ª render já cria o FAB', fab1 === 1, 'fab=' + fab1);
    check('3 navegações → 1 só #timerFab (acumulava 3; r16h)', fabs === 1, 'fabs=' + fabs);
    check('3 navegações → 1 só #timerPopup', popups === 1, 'popups=' + popups);
    check('3 navegações → 1 só <style> do timer (marcado data-ct-timer-popup)', styles === 1, 'styles=' + styles);
    check('timer rodando: 1 intervalo ativo após 1ª render', live1 === 1, 'live=' + live1);
    check('timer rodando: continua 1 intervalo após 3 renders (teardown limpa o anterior)', live.size === 1, 'live=' + live.size);
    check('keydown: teardown automático entre renders (adds>=3, removes>=2)', keyAdds >= 3 && keyRemoves >= 2, 'adds=' + keyAdds + ' removes=' + keyRemoves);
    check('teardown registrado no window pela instância viva', typeof w.__ctTimerPopupTeardown === 'function');

    w.__ctTimerPopupTeardown();
    check('teardown manual: intervalo do timer zerado', live.size === 0, 'live=' + live.size);
    check('teardown manual: keydown da instância removido', keyRemoves >= 3, 'removes=' + keyRemoves);
    await tick(50);
  }

  console.log('== R16-B: BUG2 — CT.prompt modal (Electron não implementa prompt()) ==');
  {
    check('data.js declara showPrompt + prompt(message, defaultValue)',
      dataSrc.includes('showPrompt(message, options = {})') && dataSrc.includes('prompt(message, defaultValue'));

    check('aba-materia script2 sem prompt() nativo (fora comentários)', !barePrompt.test(stripComments(script2Src)));
    check('flashcards sem prompt() nativo (fora comentários)', !barePrompt.test(stripComments(flashSrc)));
    check('concursos main sem prompt() nativo (fora comentários)', !barePrompt.test(stripComments(concSrc)));
    check('nenhum port usa window.prompt(', !/window\.prompt\s*\(/.test(stripComments(script2Src + flashSrc + concSrc)));
    check('cadastro script3: prompt() nativo SÓ no dead code (.logo-placeholder fora do body)',
      barePrompt.test(stripComments(cadSrc)) && !cadBody.includes('logo-placeholder'));

    const t = bootPlugin();
    const content = renderAba(t);
    const { w } = t;

    check('call sites da aba viraram AsyncFunction',
      w.adicionarTopico.constructor.name === 'AsyncFunction'
      && w.renomearTopico.constructor.name === 'AsyncFunction'
      && w.renomearSubtopico.constructor.name === 'AsyncFunction');

    // Contrato do nativo: OK → string digitada.
    let res1 = 'pendente';
    const p1 = w.CT.prompt('Nome do tópico:', 'Inicial').then(v => { res1 = v; });
    await tick(20);
    const ov1 = w.document.getElementById('ct-alert-overlay');
    check('prompt: overlay com input + mensagem exibida',
      !!ov1 && !!ov1.querySelector('.ct-prompt-input') && ov1.querySelector('.ct-alert-message').textContent === 'Nome do tópico:');
    check('prompt: valor padrão pré-preenchido (2º arg como o nativo)', !!ov1 && ov1.querySelector('.ct-prompt-input').value === 'Inicial');
    ov1.querySelector('.ct-prompt-input').value = 'Tópico R16';
    ov1.querySelector('.ct-alert-ok').click();
    await p1;
    check('prompt OK → resolve com o texto digitado', res1 === 'Tópico R16', String(res1));
    check('prompt: overlay removido após OK', !w.document.getElementById('ct-alert-overlay'));

    // Escape → null (nativo cancela).
    let res2 = 'pendente';
    const p2 = w.CT.prompt('x').then(v => { res2 = v; });
    await tick(20);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await p2;
    check('prompt Escape → null', res2 === null, String(res2));

    // Cancelar → null.
    let res3 = 'pendente';
    const p3 = w.CT.prompt('y').then(v => { res3 = v; });
    await tick(20);
    w.document.getElementById('ct-alert-overlay').querySelector('.ct-alert-cancel').click();
    await p3;
    check('prompt Cancelar → null', res3 === null, String(res3));

    // OK vazio → '' (nativo devolve string vazia, não null).
    let res4 = 'pendente';
    const p4 = w.CT.prompt('z').then(v => { res4 = v; });
    await tick(20);
    w.document.getElementById('ct-alert-overlay').querySelector('.ct-alert-ok').click();
    await p4;
    check('prompt OK vazio → "" (como o nativo)', res4 === '', JSON.stringify(res4));

    // End-to-end: o botão "＋ Novo tópico" que não adicionava (bug reportado).
    const p5 = w.adicionarTopico();
    await tick(20);
    const ov5 = w.document.getElementById('ct-alert-overlay');
    check('adicionarTopico abre o modal (sem "prompt() is not supported.")', !!ov5);
    ov5.querySelector('.ct-prompt-input').value = 'Tópico Novo R16';
    ov5.querySelector('.ct-alert-ok').click();
    await p5;
    await tick(30);
    check('adicionarTopico: tópico salvo via modal', (w.CT.getTopicos() || []).some(x => x.nome === 'Tópico Novo R16'));
    check('adicionarTopico: renderTopicos atualizou a lista no DOM', content.textContent.includes('Tópico Novo R16'));
    await tick(50);
  }

  console.log('== R16-C: BUG3 — choice-card neutro às regras de plataforma ==');
  {
    const NEUT = PLATFORM_NEUTRALIZE_CSS;
    check('neutralizador tem bloco .ct-page-body .choice-card (0,2,0 — vence button 0,0,1 e .x button 0,1,1)',
      NEUT.includes('.ct-page-body .choice-card{'));
    // Valores medidos no probe r16k: UA do Chromium em iframe srcdoc isolado
    // (text-transform:none, letter-spacing:normal, white-space:normal,
    // align-items:normal, justify-content:normal, font-size:13.3333px,
    // font-weight:400) + valores que a cascata do original deixava valer as
    // regras do port (color/background; box-shadow só no :hover da página).
    const props = ['text-transform:none', 'letter-spacing:normal', 'white-space:normal',
      'align-items:normal', 'justify-content:normal', 'height:auto',
      'font-size:13.3333px', 'font-weight:400',
      'color:var(--text)', 'background-color:var(--bg2)', 'box-shadow:none'];
    const faltando = props.filter(p => !NEUT.includes(p));
    check('restaura as 11 propriedades (UA medido + valores do port)', faltando.length === 0, faltando.join(','));

    // Escopo: casa dentro da view, não casa fora (empty-states/menus do Obsidian).
    const dom = new JSDOM('<!doctype html><html><head></head><body>'
      + '<div class="ct-page-body"><button class="choice-card">a</button></div>'
      + '<button class="choice-card">b</button></body></html>');
    const [dentro, fora] = dom.window.document.querySelectorAll('.choice-card');
    check('regra casa no choice-card DENTRO da view', dentro.matches('.ct-page-body .choice-card'));
    check('regra NÃO casa FORA da view (UI do Obsidian intacta)', !fora.matches('.ct-page-body .choice-card'));

    // Paridade "igualzinho": a regra do port continua byte-idêntica à do original.
    const blocoPort = (cronoCss.match(/(^|[\s,{}])\.choice-card(?![\w-])[^{]*\{[^}]*\}/) || [''])[0].replace(/\s+/g, ' ').trim();
    check('regra .choice-card do port idêntica à do original (paridade mantida)',
      blocoPort.length > 0 && origCi.replace(/\s+/g, ' ').includes(blocoPort), blocoPort.slice(0, 90));

    // Invariantes: o neutralizador não sobrescreve estilo nosso — as duas
    // propriedades que ele repete são exatamente as que o port declara.
    check('port declara color:var(--text) e background:var(--bg2) — neutralizador repete os MESMOS valores (sem conflito)',
      /(^|[\s,{}])\.choice-card[^{]*\{[^}]*color:var\(--text\)/.test(cronoCss)
      && /(^|[\s,{}])\.choice-card[^{]*\{[^}]*background:var\(--bg2\)/.test(cronoCss));
    check('port .choice-card NÃO declara nenhuma propriedade de plataforma (nada nosso é sobrescrito)',
      !/(^|[\s,{}])\.choice-card[^{]*\{[^}]*(text-transform|white-space|align-items|justify-content|letter-spacing)\s*:/.test(cronoCss));
    check('paridade do original preservada: o original TAMBÉM não declara essas props em .choice-card',
      !/\.choice-card(?![\w-])[^{]*\{[^}]*(text-transform|white-space|align-items|justify-content|letter-spacing)\s*:/.test(origCi));
  }

  console.log('== R16-D: invariantes de fonte (shell + crono-cycle + timer) ==');
  {
    check('shell remove FAB/popup/style do timer a cada render (navegar para fora não deixa órfãos)',
      shellSrc.includes('#timerFab, #timerPopup, #timerOverlay, style[data-ct-timer-popup]'));
    check('shell mantém a limpeza dos styles [data-ct-style] (R15)',
      shellSrc.includes("document.querySelectorAll('[data-ct-style]')"));
    check('crono-cycle: guard de intervalo entre navegações (__ctCronoSyncInterval)',
      /if \(window\.__ctCronoSyncInterval\) clearInterval\(window\.__ctCronoSyncInterval\);/.test(cronoSrc)
      && cronoSrc.includes('window.__ctCronoSyncInterval = window.setInterval(syncCycleTimerUI, 250)'));
    check('timer-popup: teardown registrado no fim do IIFE',
      timerSrc.includes('window.__ctTimerPopupTeardown = function'));
    check('timer-popup: teardown chamado no topo do IIFE (idempotência)',
      timerSrc.includes('try { window.__ctTimerPopupTeardown(); }'));
    check('timer-popup: <style> marcado com data-ct-timer-popup (alvo da limpeza)',
      timerSrc.includes("css.setAttribute('data-ct-timer-popup', '')"));
    check('timer-popup: limpeza de elementos antigos no topo do IIFE',
      timerSrc.includes("document.querySelectorAll('#timerFab, #timerPopup, style[data-ct-timer-popup]')"));
  }

  console.log('== R16-E: BUG4 — listeners por render (loop de navegação do probe r16o) ==');
  {
    // Achado na revalidação da R16 (pré-existente, mesma família do BUG1:
    // render in-place sem teardown). O dispatch DCL sintético re-disparava
    // handlers de renders/outras páginas: o handler da aba (script2 L62)
    // chamava goPage('dashboard.html') em TODO render — inclusive no do
    // dashboard → openPage mesmapágina → render síncrono → dispatch →
    // handler → … → stack overflow (probe r16o: RangeError ×49 em
    // _emitDataUpdated via flashcards boot; TypeError ×N em renderPainelProva
    // via listeners/timers live órfãos). Fix em runPageScripts: DCL one-shot
    // (wrapper remove-se ANTES de invocar) + limpeza dos demais listeners da
    // cadeia no início do próximo render (win.__ctPageListeners).

    // E1: handler DCL dispara UMA vez por render.
    const navs = [];
    const t = bootPlugin({ onNavigate: (p) => navs.push(p) });
    t.w.sessionStorage.removeItem('ct_concurso_ativo');
    t.w.sessionStorage.removeItem('ct_materia_ativa');
    renderAba(t);
    check('E1 handler da aba navega 1× na própria render (sem chaves → dashboard)', navs.length === 1 && navs[0] === 'dashboard.html', JSON.stringify(navs));
    t.w.document.dispatchEvent(new t.w.Event('DOMContentLoaded'));
    check('E1 re-dispatch manual de DCL NÃO re-navega (one-shot)', navs.length === 1, JSON.stringify(navs));
    renderAba(t);
    check('E1 2ª render navega exatamente 1× (handler novo, sem acúmulo)', navs.length === 2 && navs[1] === 'dashboard.html', JSON.stringify(navs));
    t.w.document.dispatchEvent(new t.w.Event('DOMContentLoaded'));
    check('E1 re-dispatch após a 2ª render também não navega', navs.length === 2, JSON.stringify(navs));

    // E2: demais listeners document/window da cadeia são removidos no início
    // do próximo render (acúmulo +1 por navegação).
    const t2 = bootPlugin();
    const docRemoves = [];
    const origDocRemove = t2.w.document.removeEventListener.bind(t2.w.document);
    t2.w.document.removeEventListener = function (type, fn, opts) { docRemoves.push(type); return origDocRemove(type, fn, opts); };
    const winRemoves = [];
    const origWinRemove = t2.w.removeEventListener.bind(t2.w);
    t2.w.removeEventListener = function (type, fn, opts) { winRemoves.push(type); return origWinRemove(type, fn, opts); };
    renderAba(t2); // 1ª: não há render anterior para limpar
    const r1 = docRemoves.length;
    renderAba(t2); // 2ª: limpa os da 1ª (click document do script2 L998 etc.)
    check('E2 2ª render remove listeners document da cadeia anterior (inclui click)', docRemoves.length > r1 && docRemoves.includes('click'), JSON.stringify(docRemoves));
    check('E2 registro por render exposto em win.__ctPageListeners', Array.isArray(t2.w.__ctPageListeners));

    const ru = read('src/render-util.js');
    check('E2 fonte: wrapper de window.addEventListener com registro', ru.includes('win.addEventListener = function (type, fn, opts)'));
    check('E2 fonte: wrappers restaurados no finally (não vaza para fora da cadeia)', ru.includes('win.document.addEventListener = origDocAdd;') && ru.includes('win.addEventListener = origWinAdd;'));
    check('E2 fonte: limpeza roda mesmo para página sem scripts', ru.indexOf('const prevListeners') < ru.indexOf('if (!scripts.length) return;'));

    // E3: nav global (navBoot ANTES da captura) sobrevive — Adaptação #7.
    check('E3 fonte: navBoot chamado ANTES da instalação dos wrappers', ru.indexOf("if (typeof navBoot === 'function') navBoot();") < ru.indexOf('const origDocAdd ='));
    await tick(50);
  }

  console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
  if (failed) { console.log('FALHAS:\n  - ' + failures.join('\n  - ')); process.exit(1); }
  process.exit(0); // timers de 1s do timer-popup mantêm o jsdom vivo
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
