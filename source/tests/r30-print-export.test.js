/**
 * Track do Oodeus — testes R30 (exportar print em Métricas não trava)
 * No celular, `navigator.clipboard.write()` pode nunca resolver e
 * `html2canvas`/`toBlob` podem demorar muito; o await pendurava a view.
 * Fix: limite de tempo em cada etapa, guard de reentrada e fallback para
 * download quando o clipboard não responde.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const src = read('pages/historico/main.pagejs');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  check('1: guard de reentrada nas 3 funções de print',
    (src.match(/_printExportBusy\) return;/g) || []).length >= 3);
  check('2: options originais preservadas (3× scale:2)', (src.match(/scale: 2,/g) || []).length === 3);
  check('3: timeout envolvendo html2canvas/toBlob', (src.match(/__printComTimeout\(/g) || []).length >= 6);
  check('4: clipboard com limite de 4s', src.includes("4000, 'Clipboard não respondeu'"));
  check('5: fallback para download', src.includes('__copiarOuBaixarPrint') && src.includes('link.download = nome'));

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const w = dom.window;
  w.URL.createObjectURL = () => 'blob:teste';
  w.URL.revokeObjectURL = () => {};
  w.ClipboardItem = function () {};
  w.navigator.clipboard = { write: () => new Promise(() => {}) }; // nunca resolve
  let baixou = null;
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = function (tag) {
    const el = origCreate(tag);
    if (tag === 'a') el.click = function () { baixou = el.download; };
    return el;
  };
  const ctx = vm.createContext(w);
  for (const re of [/function __printComTimeout[\s\S]*?\n\}/, /async function __copiarOuBaixarPrint[\s\S]*?\n\}/]) {
    const m = src.match(re);
    check('6: helper extraível ' + re.source.slice(0, 28), !!m);
    if (m) vm.runInContext(m[0], ctx);
  }
  const started = Date.now();
  let reason = null;
  try { await w.__printComTimeout(new Promise(() => {}), 60, 'timeout'); } catch (e) { reason = e.message; }
  check('7: promise pendurada é interrompida pelo timeout', reason === 'timeout' && Date.now() - started < 400, reason);
  const destino = await w.__copiarOuBaixarPrint(new w.Blob(['x']), 'print.png');
  check('8: clipboard travado cai para download', destino === 'download' && baixou === 'print.png', destino + ' / ' + baixou);
  dom.window.close();

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
