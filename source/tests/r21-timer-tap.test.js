/**
 * Track do Oodeus — testes R21 (toque no FAB deve abrir o painel)
 * A R20 adicionou touchstart/touchmove/touchend, mas chamava preventDefault no
 * touchstart (cancela o click sintético do mobile) e marcava dragged=true com
 * qualquer micro-movimento — no celular nada abria e no PC só o clique bem no
 * centro funcionava. Fix: folga de 6px antes de considerar arraste, sem
 * preventDefault no touchstart, e abertura explícita no touchend sem movimento
 * (com supressão do click sintético seguinte).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const vm = require('vm');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const dataSrc = read('src/data.js');

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
  w.setInterval = () => 0;
  w.clearInterval = () => {};
  initHost({ data: {}, persist: () => true, window: w, assetUrl: (r) => 'app://plugin/' + r });
  vmRun(w, dataSrc, 'data.js');
  const c = w.CT.saveConcurso({ nome: 'R21', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  w.CT.saveMateria({ concursoId: c.id || c, nome: 'Português' });
  w.sessionStorage.setItem('ct_concurso_ativo', c.id || c);
  vmRun(w, timerSrc, 'timer-popup.pagejs');
  return { dom, w, fab: w.document.getElementById('timerFab') };
}
function touchEvent(type, pts, w) {
  const e = new w.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : pts });
  Object.defineProperty(e, 'changedTouches', { value: pts });
  return e;
}
const isOpen = (w) => {
  const p = w.document.getElementById('timerPopup');
  return !!p && p.style.display === 'block' && !p.classList.contains('minimized');
};

(async () => {
  console.log('== R21-A: toque abre o painel ==');
  {
    const { dom, w, fab } = boot();
    check('A1: painel começa fechado', !isOpen(w));
    const a = [{ clientX: 100, clientY: 200 }];
    fab.dispatchEvent(touchEvent('touchstart', a, w));
    w.dispatchEvent(touchEvent('touchend', a, w));
    check('A2: toque sem movimento abre o painel', isOpen(w));
    // click sintético que o navegador dispara depois do touchend
    fab.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    check('A3: click sintético não fecha o painel aberto pelo toque', isOpen(w));
    dom.window.close();
  }
  {
    const { dom, w, fab } = boot();
    const a = [{ clientX: 100, clientY: 200 }];
    const b = [{ clientX: 103, clientY: 203 }];
    fab.dispatchEvent(touchEvent('touchstart', a, w));
    w.dispatchEvent(touchEvent('touchmove', b, w));
    w.dispatchEvent(touchEvent('touchend', b, w));
    check('A4: micro-movimento (3px) ainda conta como clique', isOpen(w));
    dom.window.close();
  }
  {
    const { dom, w, fab } = boot();
    const a = [{ clientX: 100, clientY: 200 }];
    const b = [{ clientX: 40, clientY: 120 }];
    fab.dispatchEvent(touchEvent('touchstart', a, w));
    w.dispatchEvent(touchEvent('touchmove', b, w));
    w.dispatchEvent(touchEvent('touchend', b, w));
    check('A5: arraste de verdade NÃO abre o painel', !isOpen(w));
    dom.window.close();
  }

  console.log('== R21-B: mouse com jitter ==');
  {
    const { dom, w, fab } = boot();
    fab.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 200 }));
    w.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientX: 103, clientY: 202 }));
    w.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true, clientX: 103, clientY: 202 }));
    fab.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    check('B1: clique de mouse com 3px de jitter abre', isOpen(w));
    dom.window.close();
  }

  console.log('== R21-C: invariantes de fonte ==');
  check('C1: folga de arraste declarada', /TAP_SLOP\s*=\s*8/.test(timerSrc));
  check('C2: touchend sem movimento abre o painel', /isTouch && !moved[\s\S]{0,80}togglePopup\(\)/.test(timerSrc));
  check('C3: click sintético suprimido', timerSrc.includes("fab.dataset.touchTap === 'true'"));
  check('C4: dragMove usa a folga', timerSrc.includes('Math.abs(dx) + Math.abs(dy) < TAP_SLOP'));
  check('C5: touchstart NÃO chama preventDefault',
    !/touchstart[\s\S]{0,260}preventDefault\(\)/.test(timerSrc));

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  if (failed) process.exitCode = 1;
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
