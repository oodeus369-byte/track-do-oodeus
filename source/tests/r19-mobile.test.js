/**
 * Track do Oodeus — testes R19 (adaptação mobile: drawer da sidebar + botão)
 *
 * Diagnóstico (probe CDP r19): com viewport 390px a sidebar é `position:fixed;
 * width:220px` e o `.main` tem `margin-left:220px`, então o conteúdo sobra com
 * apenas 88px. O scroll da view é o próprio `.ct-page-body`.
 * Fix: MOBILE_CSS (injetado pelo shell DEPOIS do theme.css) transforma a
 * sidebar em drawer absoluto até 1024px, zera a margin do main e mostra um
 * botão ☰ com scrim; estado no plugin sobrevive às re-renders. Desktop ≥1025px
 * permanece intacto (botão/scrim escondidos).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  MOBILE_CSS, initSidebarToggle, TOGGLE_ID, SCRIM_ID, OPEN_CLASS,
} = require('../src/mobile');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const shellSrc = read('src/shell.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function makeView(width) {
  const dom = new JSDOM('<div class="ct-page-body"><aside class="sidebar"></aside><div class="main"><h1 class="page-title">Painel</h1></div></div>');
  Object.defineProperty(dom.window, 'innerWidth', { value: width, configurable: true });
  global.window = dom.window;
  const content = dom.window.document.querySelector('.ct-page-body');
  return { dom, content };
}

(async () => {
  console.log('== R19-A: CSS do drawer ==');
  check('A1: media query do drawer (<=1024px)', MOBILE_CSS.includes('@media (max-width: 1024px)'));
  check('A2: media query de retrato (<=820px)', MOBILE_CSS.includes('@media (max-width: 820px)'));
  check('A3: guarda do desktop (>=1025px)', MOBILE_CSS.includes('@media (min-width: 1025px)'));
  check('A4: sidebar vira absoluta dentro da view', MOBILE_CSS.includes('position: absolute !important'));
  check('A5: largura adaptada do drawer', MOBILE_CSS.includes('width: min(86vw, 300px) !important'));
  check('A6: main ocupa 100% (margin-left zerada)', MOBILE_CSS.includes('margin-left: 0 !important') && MOBILE_CSS.includes('width: 100% !important'));
  check('A7: estado aberto move o drawer para dentro', MOBILE_CSS.includes('.' + OPEN_CLASS + ' .sidebar') && MOBILE_CSS.includes('translateX(0)'));
  check('A7b: drawer totalmente fora da área visível quando fechado', MOBILE_CSS.includes('translateX(-115%)'));
  check('A7c: botão não cobre o título (holder com 48px)', MOBILE_CSS.includes('height: 48px'));
  check('A8: esconde botão/scrim no desktop', /@media \(min-width: 1025px\)\s*\{[^}]*display: none !important/.test(MOBILE_CSS));
  check('A9: FAB sobe acima da barra do Obsidian mobile', MOBILE_CSS.includes('bottom: 76px; right: 10px'));
  check('A9b: FAB anula o left:215px sem travar o arraste (sem !important)', MOBILE_CSS.includes('left: auto;') && !/#timerFab \{[^}]*!important/.test(MOBILE_CSS));
  check('A9c: botão com drawer aberto vai para o canto direito', MOBILE_CSS.includes('ct-sidebar-toggle { left: auto !important; right: 10px; }'));
  check('A9d: FAB adaptado em toda largura estreita (não só retrato)',
    MOBILE_CSS.indexOf('#timerFab') < MOBILE_CSS.indexOf('@media (max-width: 820px)'));
  check('A9e: cabeçalho do tópico quebra em retrato', MOBILE_CSS.includes('.topico-header { flex-wrap: wrap !important'));
  check('A9f: nome do tópico ocupa a linha inteira', MOBILE_CSS.includes('.topico-nome {') && MOBILE_CSS.includes('flex: 1 1 100% !important'));
  check('A9g: ações do tópico vão para a linha seguinte', MOBILE_CSS.includes('.topico-actions { flex: 1 1 100% !important; flex-wrap: wrap !important'));
  check('A9h: nome do subtópico também quebra', MOBILE_CSS.includes('.sub-nome {'));
  {
    const bloco = MOBILE_CSS.slice(MOBILE_CSS.indexOf('.ct-page-body .topico-header'),
      MOBILE_CSS.indexOf('@media (min-width: 1025px)')).replace(/\}\s*$/, '');
    const dom = new JSDOM('<div class="ct-page-body"><div class="topico-card"><div class="topico-header">' +
      '<div style="flex:1;min-width:0;display:flex"><span class="topico-nome">Compreensao e interpretacao de textos</span></div>' +
      '<div class="topico-actions"><button class="btn-marcar-revisao">MARCAR REVISAO</button></div>' +
      '</div></div></div>');
    const st = dom.window.document.createElement('style');
    st.textContent = bloco;
    dom.window.document.head.appendChild(st);
    const cs = (s) => dom.window.getComputedStyle(dom.window.document.querySelector(s));
    check('A9i: CSS aplicado — header quebra', cs('.topico-header').flexWrap === 'wrap');
    check('A9j: CSS aplicado — nome ocupa a linha', cs('.topico-header > div').flexBasis === '100%');
    check('A9k: CSS aplicado — texto não fica coluna de 1 letra', cs('.topico-nome').whiteSpace === 'normal');
    check('A9l: CSS aplicado — ações quebram', cs('.topico-actions').flexWrap === 'wrap');
    dom.window.close();
  }
  check('A10: nenhum vh cru (usa o seam --ct-vh da R17)', !/\b\d+(?:\.\d+)?(?:d|s|l)?vh\b/.test(MOBILE_CSS.replace(/86vw/g, '')));
  check('A11: tipografia menor só em retrato', MOBILE_CSS.includes('font-size: 13px') && MOBILE_CSS.includes('font-size: 22px !important'));

  console.log('== R19-B: botão e estado ==');
  {
    const { dom, content } = makeView(390);
    const plugin = {};
    const btn = initSidebarToggle(content, plugin);
    const scrim = content.querySelector('#' + SCRIM_ID);
    check('B1: botão ☰ criado', !!btn && btn.textContent === '\u2630', btn && btn.textContent);
    check('B2: scrim criado', !!scrim);
    check('B3: acessibilidade do botão', btn.getAttribute('aria-label') === 'Abrir ou fechar o menu' && btn.getAttribute('aria-expanded') === 'false');
    check('B4: retrato começa FECHADO (conteúdo largo)', !content.classList.contains(OPEN_CLASS) && plugin.__ctSidebarOpen === false);
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    check('B5: clique abre o drawer', content.classList.contains(OPEN_CLASS) && plugin.__ctSidebarOpen === true && btn.getAttribute('aria-expanded') === 'true');
    scrim.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    check('B6: clique no scrim fecha', !content.classList.contains(OPEN_CLASS) && plugin.__ctSidebarOpen === false);
    initSidebarToggle(content, plugin);
    check('B7: reinicializar não duplica botão/scrim',
      content.querySelectorAll('#' + TOGGLE_ID).length === 1 && content.querySelectorAll('#' + SCRIM_ID).length === 1);
    dom.window.close();
  }
  {
    const { dom, content } = makeView(1280);
    const plugin = {};
    initSidebarToggle(content, plugin);
    check('B8: desktop começa com a classe fechada (sidebar visível por CSS)',
      !content.classList.contains(OPEN_CLASS) && plugin.__ctSidebarOpen === false);
    dom.window.close();
  }
  {
    // re-render: novo contentEl (esvaziado no shell), mesmo plugin → estado preservado
    const a = makeView(390);
    const plugin = {};
    const btn = initSidebarToggle(a.content, plugin);
    btn.dispatchEvent(new a.dom.window.MouseEvent('click', { bubbles: true }));
    const b = makeView(390);
    initSidebarToggle(b.content, plugin);
    check('B9: estado sobrevive à navegação (re-render)', b.content.classList.contains(OPEN_CLASS));
    a.dom.window.close(); b.dom.window.close();
  }

  {
    const { dom, content } = makeView(390);
    const plugin = {};
    const btn = initSidebarToggle(content, plugin);
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    Object.defineProperty(dom.window, 'innerWidth', { value: 1280, configurable: true });
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    check('B10: girar a tela não desfaz a escolha manual', content.classList.contains(OPEN_CLASS) && plugin.__ctSidebarOpen === true);
    dom.window.close();
  }

  console.log('== R19-C: integração e páginas reais ==');
  check('C1: shell importa o módulo mobile', shellSrc.includes("require('./mobile')"));
  check('C2: shell injeta MOBILE_CSS', shellSrc.includes('mobileStyleEl.textContent = MOBILE_CSS'));
  check('C3: style mobile marcado para limpeza no render', shellSrc.includes("setAttribute('data-ct-style', 'mobile')"));
  check('C4: shell inicializa o botão após o innerHTML', shellSrc.indexOf('initSidebarToggle(content, this.plugin)') > shellSrc.indexOf('content.innerHTML = rewriteBodyAssetSrc(page.body)'));
  const pages = ['dashboard', 'concursos', 'revisoes', 'historico', 'simulados', 'ajuda', 'aba-materia', 'crono-inteligente', 'cadastro', 'editais_premium'];
  const bad = [];
  let withSidebar = 0;
  for (const p of pages) {
    const body = read('pages/' + p + '/body.html');
    if (/class="sidebar"/.test(body)) {
      withSidebar++;
      if (!/class="main"/.test(body)) bad.push(p);
    }
  }
  check('C5: páginas com sidebar também têm .main (seletores casam)', bad.length === 0 && withSidebar >= 5, 'sem main=' + bad.join(',') + ' com sidebar=' + withSidebar);
  check('C6: nenhuma inline style de page mexe no botão',
    !MOBILE_CSS.includes('position: fixed') && !MOBILE_CSS.includes('margin-left: 220px'));

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  if (failed) process.exitCode = 1;
  global.window = undefined;
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
