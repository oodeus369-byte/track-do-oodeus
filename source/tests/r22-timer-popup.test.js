/**
 * Track do Oodeus — testes R22 (painel do timer cortado no celular)
 * O CSS original do timer-popup fixa `#timerPopup{left:228px;width:310px}`:
 * num celular de 390px o painel terminava em 538px (148px fora da tela),
 * não importava onde o FAB estivesse. O override mobile centraliza o painel e
 * limita a largura a `100vw - 24px`, somente até 1024px (desktop intacto).
 */
const fs = require('fs');
const path = require('path');
const { MOBILE_CSS } = require('../src/mobile');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const timerSrc = read('pages/timer/timer-popup.pagejs');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const start1024 = MOBILE_CSS.indexOf('@media (max-width: 1024px)');
  const start820 = MOBILE_CSS.indexOf('@media (max-width: 820px)');
  const p = MOBILE_CSS.indexOf('#timerPopup {');

  check('1: regra do painel existe', p !== -1);
  check('2: regra fica dentro do bloco <=1024px', p > start1024 && p < start820, 'p=' + p);
  check('3: painel centralizado', MOBILE_CSS.includes('left: 50% !important') && MOBILE_CSS.includes('transform: translateX(-50%) !important'));
  check('4: largura limitada à viewport', MOBILE_CSS.includes('width: min(310px, calc(100vw - 24px)) !important'));
  check('5: max-width também limitado', MOBILE_CSS.includes('max-width: calc(100vw - 24px) !important'));
  check('6: painel sobe acima da barra do Obsidian mobile', MOBILE_CSS.includes('bottom: 76px !important'));
  check('7: desktop não recebe override (regra só no media query)', MOBILE_CSS.indexOf('#timerPopup') === p);
  check('8: CSS original do timer preservado (left:228px/width:310px)',
    timerSrc.includes('bottom: 90px; left: 228px; right: auto;') && timerSrc.includes('width: 310px;'));
  check('9: markup do painel continua com id timerPopup', timerSrc.includes("id = 'timerPopup'"));

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  if (failed) process.exitCode = 1;
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
