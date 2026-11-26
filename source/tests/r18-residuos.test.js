/**
 * Track do Oodeus — testes R18 (resíduos pré-existentes achados na revalidação R17)
 *
 * RESÍDUO 1 — logoMichelSoftwares.png 0×0: o literal `assets/…png?v=1` chega
 *   cru ao resolvedor do host; `getResourcePath` trata '?' como parte do path
 *   (`%3Fv=1`) e ainda anexa o cache-bust `?179566`. O '?v=1' é cache-buster
 *   do servidor HTTP original e não tem sentido num resource do vault.
 *   Fix: separar a query ANTES de chamar `assetUrl` (render-util.assetUrlOf e
 *   host.__ctAssetUrl); sem host configurado o literal permanece intacto.
 *
 * RESÍDUO 2 — TypeError `classList` no Escape: o handler global do nav.js chama
 *   `closePopup()`; no original cada página é um load completo, então a função
 *   da página anterior não existe. No plugin o `window` persiste entre renders
 *   e o `closePopup` órfão (revisoes/aba-materia) faz
 *   `getElementById('popupOverlay'|'popup-overlay').classList` sem null-check.
 *   Fix: null-check nas funções — se o overlay não existe, não fazem nada.
 *
 * O `TypeError: children` intermitente (sem stack, não reproduzido em 6 probes)
 * NÃO entra aqui: sem evidência não se corrige código por suposição.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { assetUrlOf, rewriteBodyAssetSrc } = require('../src/render-util');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const revSrc = read('pages/revisoes/main.pagejs');
const abaSrc = read('pages/aba-materia/script2.pagejs');
const concSrc = read('pages/concursos/main.pagejs');
const dashSrc = read('pages/dashboard/main.pagejs');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

// resolvedor que imita o adapter do Obsidian: '?' no rel vira parte do path
const obsidianLike = (rel) => 'app://vault/' + String(rel).replace(/\?/g, '%3F') + '?179566';

function withHost(fn) {
  const previous = global.window;
  const dom = new JSDOM('<body></body>');
  global.window = dom.window;
  dom.window.__CT_HOST__ = { assetUrl: obsidianLike };
  try { return fn(dom.window); } finally { global.window = previous; dom.window.close(); }
}

function extractFn(src, name) {
  const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{[^}]*\\}'));
  return m ? m[0] : null;
}

(async () => {
  console.log('== R18-A: assets com query string (logoMichelSoftwares) ==');
  withHost(() => {
    const got = assetUrlOf('assets/logoMichelSoftwares.png?v=1');
    check('A1: query separada antes do assetUrl (sem %3F)',
      got.indexOf('logoMichelSoftwares.png%3F') === -1, got);
    check('A2: resource resolvido com o cache-bust do host',
      got === 'app://vault/assets/logoMichelSoftwares.png?179566', got);
    const html = rewriteBodyAssetSrc('<img src="assets/logoMichelSoftwares.png?v=1" alt="x">');
    check('A3: rewriteBodyAssetSrc resolve o literal do body sem %3F',
      html.indexOf('app://vault/assets/logoMichelSoftwares.png?179566') !== -1 && html.indexOf('%3F') === -1, html);
    const css = require('../src/render-util').rewritePageCssAssetUrls('url("assets/x.png?v=2")');
    check('A4: rewritePageCssAssetUrls também separa a query', css.indexOf('%3F') === -1, css);
  });
  {
    const previous = global.window;
    const dom = new JSDOM('<body></body>');
    global.window = dom.window; // sem __CT_HOST__: comportamento de browser fora do plugin
    const got = assetUrlOf('assets/logoMichelSoftwares.png?v=1');
    check('A5: sem host, literal original preservado (inclusive ?v=1)',
      got === 'assets/logoMichelSoftwares.png?v=1', got);
    global.window = previous;
    dom.window.close();
  }
  withHost((win) => {
    initHost({ assetUrl: obsidianLike, window: win });
    const got = win.__ctAssetUrl('assets/logo-oficial-track-concursos.png?v=1.0.6');
    check('A6: __ctAssetUrl do host também separa a query',
      got === 'app://vault/assets/logo-oficial-track-concursos.png?179566', got);
  });
  {
    const dom = new JSDOM('<body></body>');
    initHost({ window: dom.window });
    const got = dom.window.__ctAssetUrl('assets/a.png?v=7');
    check('A7: __ctAssetUrl sem assetUrl devolve o literal cru', got === 'assets/a.png?v=7', got);
    dom.window.close();
  }
  {
    const pages = ['dashboard', 'revisoes', 'historico', 'aba-materia', 'ajuda', 'simulados', 'crono-inteligente'];
    let totals = 0;
    let broken = 0;
    for (const p of pages) {
      const html = read('pages/' + p + '/body.html');
      const matches = html.match(/src="assets\/[^"]+\?v=[^"]+"/g) || [];
      totals += matches.length;
      const out = withHost(() => rewriteBodyAssetSrc(html));
      if (out.indexOf('%3F') !== -1) broken++;
    }
    check('A8: body.html real das 7 páginas — nenhum src com %3F', broken === 0, 'paginas Quebradas=' + broken);
    check('A9: literals ?v= presentes no original (o teste não está vazio)', totals > 0, 'total=' + totals);
  }

  console.log('== R18-B: Escape com closePopup órfão ==');
  for (const [label, src, id, name] of [
    ['revisoes', revSrc, 'popupOverlay', 'closePopup'],
    ['aba-materia', abaSrc, 'popup-overlay', 'closePopup'],
    ['aba-materia ctxMenu', abaSrc, 'ctxMenu', 'closeCtxMenu'],
    ['concursos detalhes', concSrc, 'modalDetalhes', 'fecharModalDetalhes'],
    ['dashboard merge', dashSrc, 'modalMerge', 'fecharModalMerge'],
    ['aba-materia ajuste', abaSrc, 'modal-ajuste-materia', 'fecharModalAjuste'],
  ]) {
    const fnSrc = extractFn(src, name);
    check('B/' + label + ': função ' + name + ' extraída da fonte', !!fnSrc, fnSrc || 'nao encontrada');
    if (!fnSrc) continue;
    const mk = new Function('document', 'return (' + fnSrc + '\n)');
    {
      const dom = new JSDOM('<body></body>');
      let threw = null;
      try { mk(dom.window.document)(); } catch (e) { threw = e; }
      check('B/' + label + ': overlay ausente — sem throw', threw === null, threw && threw.message);
      dom.window.close();
    }
    {
      const dom = new JSDOM('<body><div id="' + id + '" class="visible"></div></body>');
      const el = dom.window.document.getElementById(id);
      let threw = null;
      try { mk(dom.window.document)(); } catch (e) { threw = e; }
      const ok = threw === null && (name === 'closeCtxMenu' ? el.style.display === 'none' : !el.classList.contains('visible'));
      check('B/' + label + ': overlay presente — continua fechando', ok, threw && threw.message);
      dom.window.close();
    }
  }
  check('B-fonte: revisoes.closePopup tem null-check',
    /function closePopup\(\)\s*\{\s*(?:var|const|let)\s+\w+\s*=\s*document\.getElementById\('popupOverlay'\);\s*if\s*\(\w+\)/.test(revSrc));
  check('B-fonte: aba-materia.closePopup tem null-check',
    /function closePopup\(\)\s*\{\s*(?:var|const|let)\s+\w+\s*=\s*document\.getElementById\('popup-overlay'\);\s*if\s*\(\w+\)/.test(abaSrc));
  check('B-fonte: nav.js handler inalterado (fix nas páginas, não no handler global)',
    read('src/nav.js').includes("if (typeof closePopup === 'function') closePopup();"));

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  if (failed) process.exitCode = 1;
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
