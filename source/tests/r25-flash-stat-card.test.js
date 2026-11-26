/**
 * Track do Oodeus — testes R25 (cards de estatística dos flashcards)
 * No painel "Meus Baralhos", 3 cards são <button> e 2 são <div>. As regras de
 * button da plataforma venciam as do port: display:flex, align/justify:center,
 * white-space:nowrap, font 13.5px — 38px de altura contra 97px dos <div>.
 * Fix: neutralizador escopado restaura display:block, align normal, fonte 15px
 * e altura automática para button.flash-stat-card.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { PLATFORM_NEUTRALIZE_CSS } = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const flashSrc = read('pages/flashcards/flashcards.pagejs');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  check('1: 5 cards renderizados (3 buttons + 2 divs)',
    /statCard\([^)]*'blue'[^)]*\)/.test(flashSrc) && /statCard\([^)]*'yellow'\)/.test(flashSrc) && /var tag = action \? 'button' : 'div'/.test(flashSrc));
  check('2: neutralizador mira button.flash-stat-card', PLATFORM_NEUTRALIZE_CSS.includes('.ct-page-body button.flash-stat-card{'));
  check('3: display block e align normal', PLATFORM_NEUTRALIZE_CSS.includes('display:block!important') && PLATFORM_NEUTRALIZE_CSS.includes('align-items:normal!important'));
  check('4: white-space normal e altura automática', PLATFORM_NEUTRALIZE_CSS.includes('white-space:normal!important') && PLATFORM_NEUTRALIZE_CSS.includes('height:auto!important'));
  check('5: fonte 15px dos cards <div>', PLATFORM_NEUTRALIZE_CSS.includes('font-size:15px!important'));
  check('6: hover continua com box-shadow do port', PLATFORM_NEUTRALIZE_CSS.includes('button.flash-stat-card:not(:hover):not(:focus-visible){box-shadow:none!important;}'));

  const dom = new JSDOM('<!doctype html><html><head></head><body><div class="ct-page-body">' +
    '<button class="flash-stat-card clickable blue"><div class="flash-stat-value">0</div><div class="flash-stat-label">Total de cards</div></button>' +
    '<div class="flash-stat-card yellow"><div class="flash-stat-value">0</div><div class="flash-stat-label">Streak</div></div>' +
    '</div></body></html>');
  const st = dom.window.document.createElement('style');
  st.textContent = PLATFORM_NEUTRALIZE_CSS;
  dom.window.document.head.appendChild(st);
  const btn = dom.window.document.querySelector('button.flash-stat-card');
  const cs = dom.window.getComputedStyle(btn);
  check('7: CSS aplicado ao button em jsdom', cs.display === 'block' && cs.whiteSpace === 'normal',
    'display=' + cs.display + ' white=' + cs.whiteSpace);
  dom.window.close();

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
