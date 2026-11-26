// Monta a página Editais Premium (R13, etapa-13 §3):
//   pages/editais_premium/style.css  = original 10-172 (do <style> 9-173)
//   pages/editais_premium/body.html  = original 177-324 (+ seams goPage ×4)
//   pages/editais_premium/main.pagejs = original 329-1538 (+ goPage local no
//       topo — os onclick do body chamam goPage; SEM redirect: a página não
//       tem guard de concurso; verbatim no resto: window.open 1083, pywebview
//       selecionar_arquivo_json 1426-1427, history API dos modais
//       1042-1074, fetch 849/916/1155/1354, boot 1536-1538)
// Página standalone (§1): SEM sidebar, SEM timer-popup.js; nav.js (327) vem
// ANTES do script principal (único layout invertido da auditoria) mas o DOM
// não tem data-nav-icon — nav boot inerte (§3.3). Dead code: nenhum
// relevante (§3.4 — script coeso, CSS sem bloco morto). Acentos ausentes
// (1416 "valido", 1421 "Nao") ficam como no original (doc-mestre §1.5).
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/editais_premium.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): theme.js 7, Inter 8, <style> 9, </style> 173,
// theme.css 174, </head> 175, <body> 176, </div> (.page) 324, data.js 326,
// nav.js 327, <script> 328, </script> 1539, </body> 1540, </html> 1541.
const tag = (n) => JSON.stringify(lines[n - 1].trim());
const expect = (n, txt) => { if (lines[n - 1].trim() !== txt) throw new Error('linha ' + n + ' esperava ' + JSON.stringify(txt) + ', achei ' + JSON.stringify(lines[n - 1].trim())); };
expect(7, '<script src="theme.js"></script>');
expect(8, '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">');
expect(9, '<style>');
expect(173, '</style>');
expect(174, '<link rel="stylesheet" href="theme.css">');
expect(175, '</head>');
expect(176, '<body>');
expect(326, '<script src="data.js"></script>');
expect(327, '<script src="nav.js"></script>');
expect(328, '<script>');
expect(1539, '</script>');
expect(1540, '</body>');
expect(1541, '</html>');
console.log('checagem: 14 delimitadores ok |', tag(7), tag(9), tag(173), tag(326), tag(1539));

const css = lines.slice(9, 172).join(EOL);          // 10-172
let bodyHtml = lines.slice(176, 324).join(EOL);     // 177-324
let main = lines.slice(328, 1538).join(EOL);        // 329-1538

// ===== body.html: seams de navegação =====
// 4 pontos location.href='concursos.html' (logo 179, Voltar 188, successBar
// 239, modal 256) — página standalone sem sidebar. Nenhum href="ajuda.html"
// no body (grep da etapa: as outras páginas têm, esta não).
if (bodyHtml.includes('goPage(')) throw new Error('body já contém goPage(');
if (bodyHtml.includes('href="ajuda.html"')) throw new Error('body inesperado com href="ajuda.html"');
const navRe = /onclick="location\.href='([^']+)'"/g;
const dests = (bodyHtml.match(navRe) || []).map(s => s.replace(/^onclick="location\.href='/, '').replace(/'"$/, ''));
if (dests.length !== 4) throw new Error('esperava 4 seams location.href, achei ' + dests.length);
if (dests.some(d => d !== 'concursos.html')) throw new Error('destinos inesperados: ' + dests.join(', '));
bodyHtml = bodyHtml.replace(/onclick="location\.href='([^']+)'"/g, "onclick=\"goPage('$1')\"");
console.log('body: seams location.href =', dests.length, '(todas concursos.html)');

// ===== main.pagejs: goPage local no topo =====
// Sem redirect (página sem guard de concurso — etapa-13 §1): o goPage existe
// só para servir os 4 onclick do body (a ponte do wrapper o expõe p/ window).
if (!main.startsWith('const CATALOG_URL = ')) throw new Error('main não começa com CATALOG_URL');
if (main.includes('function goPage')) throw new Error('main já define goPage');
if (!main.endsWith('loadCatalog(false);')) throw new Error('main não termina no boot loadCatalog(false); (tail: ' + JSON.stringify(main.slice(-40)) + ')');
const goBlock = [
  '// [R13-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  '// Os 4 onclick do body chamam goPage (seams R13) — a ponte de nomes do',
  '// wrapper (render-util.runPageScripts) expõe esta função para window.',
  'function goPage(dest) {',
  '  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }',
  '  window.location.href = dest;',
  '}',
].join(EOL);
main = goBlock + EOL + main;
console.log('main: goPage local no topo ok | boot final preservado');

// ===== headers =====
const bodyHeader = [
  '<!-- Track do Oodeus — [R13-port] body de editais_premium.html (linhas',
  '     177-324 do original www/editais_premium.html). Adaptações: onclick de',
  '     navegação location.href → goPage (4 pontos, todas concursos.html: logo',
  '     179, "Voltar para Meus Concursos" 188, successBar 239, modal "Ver em',
  '     Meus Concursos" 256). Página standalone: SEM sidebar e SEM link de',
  '     ajuda no body (grep da etapa: 0 ocorrências de href="ajuda.html").',
  '     <img src="assets/…"> mantém o caminho relativo do original — o shell',
  '     reescreve na renderização. HTML estático com entidades (&aacute; etc.)',
  '     preservadas. Verbatim de propósito: nenhum bloco morto no body (§3.4).',
  '-->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R13-port] CSS de editais_premium.html (linhas 10-172',
  '   do original www/editais_premium.html, verbatim). O font link do head',
  '   (Google Fonts Inter, linha 8) é descartado (precedente R2).',
  '   url("assets/…") é reescrito pelo shell na renderização',
  '   (rewritePageCssAssetUrls). Atenção: o :root desta página (linha 10) é',
  '   PRÓPRIO e redefine as variáveis localmente — traz',
  '   --premium-card-width:378px e NÃO define --green2 (diferente de',
  '   revisoes — etapa-13 §2.1); mantido verbatim. Sem bloco de CSS morto',
  '   (§3.4: "CSS sem bloco morto detectado"). */',
  '',
].join(EOL);
const mainHeader = [
  '/**',
  ' * Track do Oodeus - [R13-port] script principal de editais_premium.html',
  ' * (original 329-1538 + goPage local no topo). Script inline CLÁSSICO',
  " * top-level, SEM IIFE e SEM 'use strict' (como o original); o wrapper do",
  ' * shell (render-util.runPageScripts) faz a ponte de nomes para window — os',
  ' * onclick inline enxergam as funções (inclusive o goPage abaixo) e as',
  ' * let/const top-level via accessors.',
  ' *',
  ' * Pipeline de dados (etapa-13 §3.2): CATALOG_URL =',
  ' * raw.githubusercontent.com/michel-softwares/Editais-Premium/main/catalog.json;',
  ' * caches ct_premium_catalog_cache_v1 (catálogo) e',
  ' * ct_premium_materials_cache_v3 (materiais); loadCatalog/applyCatalog com',
  ' * render do cache antes do fetch, saveCache + re-render por token',
  ' * incremental (examHydrationToken/materialHydrationToken invalidam',
  ' * resultados atrasados); normalizeItem com tolerância a mojibake (mÃ©dio)',
  ' * e banca uppercase pt-BR ("a definir"→"A definir"); inferDetailsPaths +',
  ' * fetchDetailsText (.txt e variantes "Ficha Informativa X.txt");',
  ' * hidratação de data/salário/nível/materiais via Promise.allSettled;',
  ' * 6 providers de materiais (tec e google-drive SEM logo; typo "estratgia"',
  ' * tolerado; genérico substituído por específicos no merge); detecção de',
  ' * já-instalado com sameLooseText (normalize sem acento, substring ≥9);',
  ' * instalação com teatro de estágios (wait 180/320/180/620/700 —',
  ' * comportamento visível, replicar tal como está §6.3); import manual com',
  ' * FileReader + pywebview selecionar_arquivo_json (1426, guard verbatim',
  ' * §6.2) e drag & drop com manualDragDepth; refresh das tags de prova às',
  ' * 00:05 (scheduleExamTagRefresh 957-965); listeners: 4 filtros,',
  ' * click-outside/Escape/popstate dos 2 modais (history API pushState',
  ' * 1042/1063 + replaceState 1053/1074 — verbatim §6.3); boot no fim:',
  ' * updateManualState(); scheduleExamTagRefresh(); loadCatalog(false);',
  ' * (1536-1538).',
  ' *',
  ' * Dead code: nenhum relevante (§3.4 — script coeso, ~70 funções com uso;',
  ' * primeira página da auditoria praticamente sem dead code). Acentos',
  ' * ausentes nos erros do import manual (1416 "valido", 1421 "Nao") ficam',
  ' * como no original até a passada de aceite (doc-mestre §1.5). Erros de',
  ' * fetch todos silenciosos (try/catch `_` — verbatim).',
  ' *',
  ' * Seams [R13-port]: goPage local no topo (precedente R10/R11/R12) — os 4',
  ' * onclick do body chamam goPage; este script NÃO tem redirect (página sem',
  ' * guard de concurso, §1). window.open externo (1083) verbatim (precedente',
  ' * R6/R7/R9). Sem location.search/hash.',
  ' *',
  ' * Ordem de carregamento do original: theme.js (7) → Inter (8) → style',
  ' * inline (9-173) → theme.css (174) → body (176-324) → data.js (326) →',
  ' * nav.js (327, ANTES do script principal — único layout invertido da',
  ' * auditoria; DOM sem data-nav-icon: nav boot inerte, §3.3) → este script',
  ' * (328-1539). SEM timer-popup.js. No plugin: theme/data no onload; nav boot',
  ' * ANTES da cadeia (desvio R3 — nav.js já era antes do script no original);',
  ' * cadeia = [este script] apenas.',
  ' */',
].join(EOL);

const dir = 'pages/editais_premium';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const mainOut = mainHeader + EOL + main + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
console.log('gravado:', dir + '/style.css', Buffer.byteLength(cssOut), 'B |', dir + '/body.html', Buffer.byteLength(bodyOut), 'B |', dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B,', mainOut.split(/\r?\n/).length, 'linhas');
