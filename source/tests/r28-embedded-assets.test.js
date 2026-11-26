/**
 * Track do Oodeus — testes R28 (assets embutidos no bundle)
 * O BRAT instala apenas main.js + manifest.json, sem a pasta assets/. Para o
 * plugin funcionar em qualquer cofre, todos os assets viram data: URL em
 * src/assets-embedded.js e main.assetPath() os resolve antes do caminho do
 * vault. rewriteThemeAssetUrls passa a resolver cada url() pelo assetUrl.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const EMBEDDED = require('../src/assets-embedded');
const { rewriteBodyAssetSrc, rewriteThemeAssetUrls } = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const mainSrc = read('main.js');
const renderSrc = read('src/render-util.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const keys = Object.keys(EMBEDDED);
  check('1: 92 assets embutidos', keys.length === 92, 'total=' + keys.length);
  check('2: todos são data URLs', keys.every(k => /^data:[^;]+;base64,[A-Za-z0-9+/=]+$/.test(EMBEDDED[k])));
  check('3: faixa branca embutida', typeof EMBEDDED['assets/faixas/faixabranca.png'] === 'string');
  check('4: logo e ícone embutidos', !!EMBEDDED['assets/Track Concursos logo.png'] && !!EMBEDDED['assets/michel-m-icon.png']);
  check('5: máscara remix-nav embutida', !!EMBEDDED['assets/remix-nav/home-4-fill.svg']);
  check('6: main.js resolve pelo mapa antes do vault', mainSrc.includes('require(\'./src/assets-embedded\')') && mainSrc.includes('hasOwnProperty.call(EMBEDDED_ASSETS, key)') && mainSrc.includes('return EMBEDDED_ASSETS[key]'));
  check('7: theme.css usa assetUrl por url()', renderSrc.includes("assetUrlOf('assets/' + rel)"));

  global.window = new JSDOM('<!doctype html>').window;
  global.window.__CT_HOST__ = { assetUrl: (rel) => EMBEDDED[rel] || null };
  const html = rewriteBodyAssetSrc('<img src="assets/faixas/faixabranca.png"><img src="https://x/y.png">');
  check('8: body reescreve img para data URL', html.includes('src="data:image/png;base64,') && html.includes('https://x/y.png'));
  const css = rewriteThemeAssetUrls('.a{mask-image:url("assets/remix-nav/home-4-fill.svg")}');
  check('9: theme reescreve máscara para data URL', css.includes('url("data:image/svg+xml;base64,'));
  global.window.__CT_HOST__ = null;

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
