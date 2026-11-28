/**
 * Track do Oodeus — testes R31 (material com arquivo universal do vault)
 * Antes: só C:\... virava file:// e qualquer outro caminho caía na checagem
 * "apenas https://". Agora: arquivos dentro do vault usam caminho relativo
 * (portátil entre PC/celular/tablet) e caminhos absolutos POSIX/Android também
 * viram file://. O seletor de arquivos do vault serve para todos os tipos.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const script2 = read('pages/aba-materia/script2.pagejs');
const hostSrc = read('src/host.js');
const mainSrc = read('main.js');
const notesSrc = read('src/vault-notes.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  check('1: host expõe listVaultFiles/pickVaultFile', hostSrc.includes('listVaultFiles()') && hostSrc.includes('pickVaultFile(cb)'));
  check('2: main.js liga os novos callbacks', mainSrc.includes('listVaultFiles: () =>') && mainSrc.includes('pickVaultFile: (cb) =>'));
  check('3: VaultFileModal lista todos os arquivos', notesSrc.includes('class VaultFileModal') && notesSrc.includes('getFiles()'));
  check('4: modal tem botão de arquivo do vault', script2.includes('id="modalArquivoBtn"') && script2.includes('buscarArquivoVault('));
  check('5: helper de caminho interno existe', script2.includes('function ehCaminhoVaultInterno(url)'));
  check('6: bypass na criação e na edição', (script2.match(/ehCaminhoVaultInterno\(url\)\)\s*\n\s*\? \{ ok: true, url \}/g) || []).length === 2);
  check('7: abrir usa host para caminho do vault', script2.includes("if (tipo === 'NOTA' || ehLinkWiki(url) || ehCaminhoVaultInterno(url))"));
  check('8: placeholder explica arquivo do vault', script2.includes('arquivo do vault'));

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const ctx = vm.createContext(dom.window);
  for (const name of ['ehLinkWiki', 'notaDeLinkWiki', 'ehCaminhoVaultInterno', 'normalizarUrlMaterialInput']) {
    const re = new RegExp('function ' + name + '\\([^)]*\\)[\\s\\S]*?\\n\\}');
    const m = script2.match(re);
    check('9: helper extraível ' + name, !!m);
    if (m) vm.runInContext(m[0], ctx);
  }
  const w = dom.window;
  check('10: caminho do vault reconhecido', w.ehCaminhoVaultInterno('Materiais/aula.pdf') === true);
  check('11: wikilink reconhecido', w.ehCaminhoVaultInterno('[[Minha nota]]') === true);
  check('12: caminho do Windows NÃO é do vault', w.ehCaminhoVaultInterno('C:\\livros\\aula.pdf') === false);
  check('13: https NÃO é do vault', w.ehCaminhoVaultInterno('https://site/a.pdf') === false);
  check('14: caminho Android vira file://', w.normalizarUrlMaterialInput('/storage/emulated/0/Download/a.pdf') === 'file:///storage/emulated/0/Download/a.pdf', w.normalizarUrlMaterialInput('/storage/emulated/0/Download/a.pdf'));
  check('15: caminho Windows continua file://', w.normalizarUrlMaterialInput('C:\\livros\\aula.pdf') === 'file:///C:/livros/aula.pdf', w.normalizarUrlMaterialInput('C:\\livros\\aula.pdf'));
  check('16: https intacto', w.normalizarUrlMaterialInput('https://site/a.pdf') === 'https://site/a.pdf');
  dom.window.close();

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
