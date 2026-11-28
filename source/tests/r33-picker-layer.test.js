/**
 * Track do Oodeus — testes R33 (seletor do vault visível sobre o modal)
 * Nosso modal #modalCaderno tem z-index 9999; o seletor fuzzy do Obsidian
 * usa z-index 50 e aparecia ATRÁS. Fix: abaixar para 1 enquanto o seletor
 * está aberto e restaurar no callback/Escape/fechamento.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const src = read('pages/aba-materia/script2.pagejs');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  check('1: helper de camada existe', src.includes('function __loweringModalParaPicker()'));
  check('2: modal abaixado para z-index 1', src.includes("m.style.zIndex = '1'"));
  check('3: z-index original restaurado', src.includes('m.style.zIndex = old'));
  check('4: restaura no Escape', src.includes("e.key === 'Escape'"));
  check('5: observa fechamento do seletor', src.includes(".modal-container')) restore()"));
  check('6: dois pickers chamam a restauração', (src.match(/const restore = __loweringModalParaPicker\(\);/g) || []).length >= 2);

  const dom = new JSDOM('<!doctype html><html><body>' +
    '<div id="modalCaderno" style="z-index:9999"><input id="modalLinkInput" /></div>' +
    '</body></html>');
  const w = dom.window;
  const ctx = vm.createContext(w);
  for (const name of ['__loweringModalParaPicker', 'buscarArquivoVault', 'buscarNotaVault']) {
    const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)[\\s\\S]*?\\n\\}'));
    check('7: helper extraível ' + name, !!m);
    if (m) vm.runInContext(m[0], ctx);
  }
  const overlay = () => w.document.getElementById('modalCaderno');
  const input = () => w.document.getElementById('modalLinkInput');
  let durante = null;
  w.__CT_HOST__ = {
    pickVaultFile: cb => { durante = overlay().style.zIndex; cb('Materiais/aula.pdf'); },
    pickVaultNote: cb => { durante = overlay().style.zIndex; cb('Minha nota'); },
  };
  w.buscarArquivoVault('modalLinkInput');
  check('8: seletor de arquivos aparece na frente', durante === '1', String(durante));
  check('9: modal restaurado depois da escolha', overlay().style.zIndex === '9999', overlay().style.zIndex);
  check('10: caminho do arquivo preencheu o Link', input().value === 'Materiais/aula.pdf', input().value);

  w.buscarNotaVault('modalLinkInput');
  check('11: seletor de notas aparece na frente', durante === '1', String(durante));
  check('12: modal restaurado depois da nota', overlay().style.zIndex === '9999', overlay().style.zIndex);
  check('13: nota preencheu o Link', input().value === 'Minha nota', input().value);
  dom.window.close();

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
