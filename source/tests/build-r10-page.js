// Monta a página Revisões (R10, etapa-13 §2):
//   pages/revisoes/style.css      = original 10-181 (do <style> 9-182)
//   pages/revisoes/body.html      = original 186-325 (+ seams goPage)
//   pages/revisoes/script1.pagejs = original 328-382 (IIFE sidebar, verbatim)
//   pages/revisoes/main.pagejs    = original 385-822 (+ goPage local + seams
//       386/416 de navegação + seam __CT_PAGE_SEARCH__ 566)
// SEM correções D1-D12 (decisão doc-mestre R10: dead code verbatim; a
// duplicação badge/nome IIFE×render() é replicada).
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/revisoes.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): theme.js 6, Inter 8, <style> 9, </style> 182,
// theme.css 183, <body> 185, <aside> 188, <main> 227, </main> 301,
// data.js 326, <script> 327, </script> 383, <script> 384, </script> 823,
// nav.js 827, timer-popup.js 828, </body> 829, </html> 830
const tag = (n) => JSON.stringify(lines[n - 1].trim());
console.log('checagem:', tag(6), tag(8), tag(9), tag(182), tag(183), tag(185), tag(188), tag(227), tag(301), tag(326), tag(327), tag(383), tag(384), tag(823), tag(827), tag(828), tag(829), tag(830));

const css = lines.slice(9, 181).join(EOL);          // 10-181
let bodyHtml = lines.slice(185, 325).join(EOL);     // 186-325
const script1 = lines.slice(327, 382).join(EOL);    // 328-382
let main = lines.slice(384, 822).join(EOL);         // 385-822

// ===== body.html: seams de navegação =====
// 8 pontos location.href (logo 190 + nav-items 194-197/199-201) + 1 especial
// (flashcards 198, com sessionStorage antes) = 9 pontos de navegação
const navRe = /onclick="location\.href='([^']+)'"/g;
const navHits = (bodyHtml.match(navRe) || []).length;
if (navHits !== 8) throw new Error('esperava 8 seams location.href, achei ' + navHits);
bodyHtml = bodyHtml.replace(navRe, "onclick=\"goPage('$1')\"");
// flashcards 198: sessionStorage mantido; location.href → goPage. O hash
// #flashcards AGORA é preservado pelo navigateTo (R9 fechou a pendência R7)
const fOld = "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');location.href='dashboard.html#flashcards'\"";
if (!bodyHtml.includes(fOld)) throw new Error('seam flashcards (198) não encontrado');
bodyHtml = bodyHtml.replace(fOld, "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"");
// <a href="ajuda.html"> 204 → + onclick goPage + return false (precedente aba-materia)
const aOld = '<a href="ajuda.html" style="text-decoration:none">';
if (!bodyHtml.includes(aOld)) throw new Error('seam <a href> (204) não encontrado');
bodyHtml = bodyHtml.replace(aOld, '<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false" style="text-decoration:none">');
console.log('body: seams location.href =', navHits, '| flashcards + <a href> ok');

const bodyHeader = [
  '<!-- Track do Oodeus — [R10-port] body de revisoes.html (linhas 186-325 do',
  '     original www/revisoes.html). Adaptações: onclick de navegação',
  '     location.href → goPage (9 pontos: logo 190 + nav-items 194-201; o item',
  '     Flashcards 198 mantém o sessionStorage.setItem e navega',
  '     dashboard.html#flashcards — hash PRESERVADO pelo navigateTo desde a R9);',
  '     <a href="ajuda.html"> (204) recebe onclick goPage + return false',
  '     (precedente aba-materia). <img src="assets/…"> mantém o caminho',
  '     relativo do original — o shell reescreve na renderização.',
  '     Verbatim de propósito: dead codes D1-D12 (filtroRow vazio, CSS morto',
  '     .summary-grid/.rev-section*/.agenda-*, placeholder inerte do date input)',
  '     e o popup de revisão (303-324) — doc-mestre R10: sem correções. -->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R10-port] CSS de revisoes.html (linhas 10-181 do',
  '   original www/revisoes.html, verbatim). O font link do head (Google Fonts',
  '   Inter) é descartado (precedente R2). url("assets/remix-nav/…") é',
  '   reescrito pelo shell na renderização (rewritePageCssAssetUrls).',
  '   Dead code D1-D9 verbatim (filtro-*, summary-grid, rev-section*, rev-list,',
  '   rev-card-left/…, atraso-badge*, btn-adiar, agenda de 7 dias, empty-state). */',
  '',
].join(EOL);

// ===== main.pagejs: goPage local + seams =====
// goPage local (precedente aba-materia script2)
const goOld = "const cId = sessionStorage.getItem('ct_concurso_ativo');\r\nif (!cId) location.href = 'concursos.html';";
if (!main.includes(goOld)) throw new Error('goPage anchor (385-386) não encontrado');
main = main.replace(goOld, [
  "const cId = sessionStorage.getItem('ct_concurso_ativo');",
  '// [R10-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  'function goPage(dest) {',
  "  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }",
  "  window.location.href = dest;",
  '}',
  '// Seam do redirect (orig 386): o location.href do original NÃO interrompe a',
  '// execução do script (a navegação só é commitada depois) — sem return, o',
  '// boot segue até render() como no original.',
  "if (!cId) goPage('concursos.html');",
].join(EOL));
// seam 416: navegação com query (foco do tópico/subtópico)
const s416 = "location.href = 'aba_materia.html?' + params.toString();";
if (!main.includes(s416)) throw new Error('seam 416 não encontrado');
main = main.replace(s416, "goPage('aba_materia.html?' + params.toString()); // [R10-port]");
// seam 566: location.search → __CT_PAGE_SEARCH__ (padrão aba-materia 1297)
const s566 = "const revisaoId = new URLSearchParams(location.search).get('revisaoId');";
if (!main.includes(s566)) throw new Error('seam 566 não encontrado');
main = main.replace(s566, "const revisaoId = new URLSearchParams(window.__CT_PAGE_SEARCH__ || location.search).get('revisaoId'); // [R10-port] seam location.search");
console.log('main: goPage local + seams 386/416/566 ok');

const mainHeader = [
  '/**',
  " * Track do Oodeus - [R10-port] script principal de revisoes.html",
  ' * (original 385-822 + seams). Script inline CLÁSSICO top-level, SEM IIFE e',
  " * SEM 'use strict' (como o original); o wrapper do shell",
  ' * (render-util.runPageScripts) faz a ponte de nomes para window — os onclick',
  ' * inline enxergam as funções e as let/const top-level via accessors.',
  ' *',
  ' * Sem correções D1-D12 (doc-mestre R10): dead code verbatim (pctClass',
  " * definida e nunca chamada, D10; border-left do .rev-card anulado pelo",
  ' * border inline do template, D11; placeholder inerte do date input, D12) e a',
  ' * duplicação viva replicada (badge via document.querySelector(\'.nav-badge\')',
  ' * — 1º do DOM = #revBadge por acaso da ordem; concurso-nome/banca escritos',
  ' * pela IIFE sidebar E por render()).',
  ' *',
  ' * Seams [R10-port]: goPage local (precedente aba-materia script2); redirect',
  ' * sem cId (386 — sem return: o location.href do original não interrompe a',
  ' * execução); abrirAlvoRevisao → aba_materia.html?foco=… (416);',
  ' * aplicarFocoRevisaoUrl lê window.__CT_PAGE_SEARCH__ || location.search (566,',
  ' * padrão aba-materia 1297) — o foco ?revisaoId= com .review-focus 3200ms.',
  ' *',
  ' * Ordem de carregamento do original: data.js (326) → IIFE sidebar (327-383)',
  ' * → este script (384-823) → nav.js (827) → timer-popup.js (828). No plugin:',
  ' * data.js roda no onload; nav boot ANTES da cadeia (desvio documentado no',
  ' * render-util R3); cadeia = [IIFE sidebar, este script, timer-popup.pagejs]',
  ' * — o timer-popup entra por último como o <script src> 828; o',
  ' * iniciarCronometroRevisao cobre o timing com retry de 60ms (419-443,',
  ' * verbatim). Popup de revisão: confirmarRevisao (data custom prioridade →',
  ' * concluirRevisao), adiarRevisao reutiliza o popup trocando handlers',
  ' * (768-787), excluirRevisao com CT.confirm (809-816).',
  ' */',
].join(EOL);

const script1Header = [
  '/**',
  " * Track do Oodeus - [R10-port] IIFE sidebar de revisoes.html (verbatim,",
  ' * linhas 328-382 do original www/revisoes.html). Idêntica às outras páginas',
  ' * (logo cache-bust, PRÉ-EDITAL reescreve o timer-box, Pós-Edital reescreve',
  ' * com "Coberto ×N", revBadge por concurso; mesma fonte multilinha de',
  ' * simulados/historico). Sem seams — não navega. Roda como 1º script da',
  ' * cadeia (o data.js do original 326 roda no onload do plugin). A',
  ' * duplicação badge/concurso-nome/banca com render() é viva e replicada.',
  ' */',
].join(EOL);

const dir = 'pages/revisoes';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const script1Out = script1Header + EOL + script1 + EOL;
const mainOut = mainHeader + EOL + main + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/script1.pagejs', script1Out, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
console.log('gravado:', dir + '/style.css', Buffer.byteLength(cssOut), 'B |', dir + '/body.html', Buffer.byteLength(bodyOut), 'B |', dir + '/script1.pagejs', Buffer.byteLength(script1Out), 'B |', dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B,', mainOut.split(/\r?\n/).length, 'linhas');
