/**
 * Track do Oodeus — testes R20 (FAB do Pomodoro: escopo da view + arraste mobile)
 *
 * BUG 1 (PC): #timerFab/#timerPopup/#timerOverlay/<style> vivem no
 *   document.body/head. O teardown da R16 só limpava intervalos + keydown; ao
 *   fechar a view do plugin o relógio ficava órfão no Obsidian e só saía
 *   reiniciando o app. Fix: teardown também remove os nós e os listeners de
 *   arraste; shell.onClose() e plugin.onunload() chamam o teardown.
 * BUG 2 (celular): o arraste só usava mousedown/mousemove/mouseup — em touch
 *   não havia como mover o FAB. Fix: touchstart/touchmove/touchend (passive:false)
 *   com as mesmas funções de drag, removidas no teardown.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const vm = require('vm');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const dataSrc = read('src/data.js');
const shellSrc = read('src/shell.js');
const mainSrc = read('main.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function vmRun(w, src, file) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename: file || 'script.js' });
}
function boot() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost/app/', runScripts: 'dangerously',
  });
  const w = dom.window;
  w.setInterval = () => 0;           // intervalos reais não são necessários aqui
  w.clearInterval = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  initHost({ data: {}, persist: () => true, window: w, assetUrl: (r) => 'app://plugin/' + r });
  vmRun(w, dataSrc, 'data.js');
  const c = w.CT.saveConcurso({ nome: 'R20', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  w.CT.saveMateria({ concursoId: c.id || c, nome: 'Português' });
  w.sessionStorage.setItem('ct_concurso_ativo', c.id || c);
  vmRun(w, timerSrc, 'timer-popup.pagejs');
  return { dom, w };
}
function touch(type, x, y, w) {
  const e = new w.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  Object.defineProperty(e, 'changedTouches', { value: [{ clientX: x, clientY: y }] });
  return e;
}

(async () => {
  console.log('== R20-A: arraste por toque ==');
  {
    const { dom, w } = boot();
    const fab = w.document.getElementById('timerFab');
    check('A1: FAB criado no body', !!fab);
    const before = fab.style.left;
    fab.dispatchEvent(touch('touchstart', 220, 700, w));
    w.dispatchEvent(touch('touchmove', 60, 200, w));
    w.dispatchEvent(touch('touchend', 60, 200, w));
    check('A2: touchmove move o FAB', fab.style.left !== before, 'left=' + fab.style.left + ' antes=' + before);
    const pos = (() => { try { return JSON.parse(w.sessionStorage.getItem('ct_timer_state') || '{}').fabPos; } catch { return null; } })();
    check('A3: posição persistida após o toque', !!pos && typeof pos.x === 'number', JSON.stringify(pos));
    check('A4: toque não abriu o popup', (w.document.getElementById('timerPopup') || {}).style && w.document.getElementById('timerPopup').style.display !== 'flex');
    dom.window.close();
  }

  console.log('== R20-B: teardown remove tudo ==');
  {
    const { dom, w } = boot();
    check('B1: teardown registrado', typeof w.__ctTimerPopupTeardown === 'function');
    w.__ctTimerPopupTeardown();
    check('B2: FAB removido', !w.document.getElementById('timerFab'));
    check('B3: popup e overlay removidos', !w.document.getElementById('timerPopup') && !w.document.getElementById('timerOverlay'));
    check('B4: style do timer removido', !w.document.querySelector('style[data-ct-timer-popup]'));
    check('B5: listeners de arraste removidos (mousemove não lança)', (() => {
      try { w.dispatchEvent(new w.MouseEvent('mousemove', { clientX: 10, clientY: 10 })); return true; } catch (e) { return false; }
    })());
    dom.window.close();
  }

  console.log('== R20-C: integração no ciclo de vida ==');
  const onCloseBody = shellSrc.slice(shellSrc.indexOf('onClose()'), shellSrc.indexOf('_syncViewVh(content)'));
  check('C1: shell.onClose chama o teardown', onCloseBody.includes('__ctTimerPopupTeardown'));
  check('C2: shell.onClose remove os nós órfãos', onCloseBody.includes('#timerFab'));
  check('C3: plugin.onunload chama o teardown', /onunload\(\)\s*\{[^}]*__ctTimerPopupTeardown/.test(mainSrc));
  check('C4: timer registra touchstart/touchmove/touchend',
    timerSrc.includes("'touchstart'") && timerSrc.includes("'touchmove'") && timerSrc.includes("'touchend'"));
  check('C5: drag touch é passive:false', timerSrc.includes('passive: false') || timerSrc.includes('passive:false'));
  check('C6: teardown remove listeners de toque',
    timerSrc.includes("removeEventListener('touchmove'") && timerSrc.includes("removeEventListener('touchend'"));
  check('C7: posição salva é clampeada ao redimensionar',
    timerSrc.includes("addEventListener('resize', clampFab)") && timerSrc.includes("removeEventListener('resize', clampFab)"));

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  if (failed) process.exitCode = 1;
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
