// Monta a página Ajuda (R13, etapa-13 §4):
//   pages/ajuda/style.css    = original 10-478 (do <style> 9-479)
//   pages/ajuda/body.html    = original 483-605 (+ seams goPage ×9;
//       linha 605: tag cloudflare D4 verbatim + <script src="data.js"> da
//       MESMA linha removido — data.js roda no onload do plugin)
//   pages/ajuda/main.pagejs  = original 608-874 (+ goPage local no topo)
//   pages/ajuda/script1.pagejs = original 875-926 (IIFE sidebar verbatim,
//       inclusive o comentário de seção 875)
// Cadeia do shell: [main, script1, timer-popup] — ORDEM DO ORIGINAL: o
// arquivo tem UM bloco <script> (607-927) em que o principal (608-874)
// executa ANTES da IIFE sidebar (875-926); o plano prévio da rodada tinha
// [script1, main] invertido — ordem de carregamento é comportamento.
// Sem guard de concurso (§4.1 — a página funciona sem concurso, a sidebar
// mostra "—"). Dead code D1-D3 no style.css e D4 no body (§4.2, verbatim).
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/ajuda.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): theme.js 6, title 7, Inter 8, <style> 9,
// </style> 479, theme.css 480, </head> 481, <body> 482, <aside> 484,
// </aside> 518, <main> 520, </main> 596, copyToast 598-604,
// cloudflare+data.js 605, nav.js 606, <script> 607, </script> 927,
// timer-popup.js 928 (ÚLTIMA linha — o original não fecha </body>/</html>).
const tag = (n) => JSON.stringify(lines[n - 1].trim());
const expect = (n, txt) => { if (lines[n - 1].trim() !== txt) throw new Error('linha ' + n + ' esperava ' + JSON.stringify(txt) + ', achei ' + JSON.stringify(lines[n - 1].trim())); };
expect(6, '<script src="theme.js"></script>');
expect(7, '<title>Track Concursos — Ajuda</title>');
expect(8, '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">');
expect(9, '<style>');
expect(479, '</style>');
expect(480, '<link rel="stylesheet" href="theme.css">');
expect(481, '</head>');
expect(482, '<body>');
expect(484, '<aside class="sidebar">');
expect(518, '</aside>');
expect(520, '<main class="main">');
expect(596, '</main>');
expect(606, '<script src="nav.js"></script>');
expect(607, '<script>');
expect(927, '</script>');
expect(928, '<script src="timer-popup.js"></script>');
console.log('checagem: 16 delimitadores ok |', tag(6), tag(9), tag(479), tag(607), tag(927), tag(928));

const CF_TAG = '<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>';
const DATA_TAG = '<script src="data.js"></script>';
if (lines[604].trim() !== CF_TAG + DATA_TAG) throw new Error('linha 605 não é cloudflare+data.js: ' + JSON.stringify(lines[604].trim()));

const css = lines.slice(9, 478).join(EOL);          // 10-478
let bodyHtml = lines.slice(482, 605).join(EOL);     // 483-605
let main = lines.slice(607, 874).join(EOL);         // 608-874
const script1 = lines.slice(874, 926).join(EOL);    // 875-926 (verbatim)

// ===== body.html: seams de navegação =====
// 8 pontos simples location.href (logo 486 + nav-items 490/491/492/493/495/
// 496/497 — inclui o próprio ajuda.html 497) + 1 especial (Flashcards 494:
// sessionStorage.setItem antes, navega dashboard.html#flashcards — hash
// preservado pelo navigateTo desde a R9). Mesmo padrão do R10/R11/R12.
if (bodyHtml.includes('goPage(')) throw new Error('body já contém goPage(');
const plainRe = /onclick="location\.href='([^']+)'"/g;
const dests = (bodyHtml.match(plainRe) || []).map(s => s.replace(/^onclick="location\.href='/, '').replace(/'"$/, ''));
const want = ['ajuda.html', 'concursos.html', 'concursos.html', 'cronograma_inteligente.html', 'dashboard.html', 'historico.html', 'revisoes.html', 'simulados.html'];
if (dests.length !== 8) throw new Error('esperava 8 seams location.href simples, achei ' + dests.length);
if (dests.slice().sort().join('|') !== want.join('|')) throw new Error('destinos inesperados: ' + dests.slice().sort().join(', '));
bodyHtml = bodyHtml.replace(plainRe, "onclick=\"goPage('$1')\"");
const fOld = "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');location.href='dashboard.html#flashcards'\"";
if (bodyHtml.split(fOld).length !== 2) throw new Error('seam flashcards (494) não encontrada');
bodyHtml = bodyHtml.replace(fOld, "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"");
// Linha 605 (D4): a tag cloudflare fica verbatim; o data.js da MESMA linha
// sai (data.js roda no onload do plugin — nos outros bodies ele está em
// linha própria e fora do slice).
if (bodyHtml.split(CF_TAG + DATA_TAG).length !== 2) throw new Error('par cloudflare+data.js não único no body');
bodyHtml = bodyHtml.replace(CF_TAG + DATA_TAG, CF_TAG);
const scriptTags = (bodyHtml.match(/<script/g) || []).length;
if (scriptTags !== 1) throw new Error('esperava só a tag cloudflare no body, achei ' + scriptTags + ' tags <script');
console.log('body: seams = 8 simples + flashcards | data.js removido da 605 | cloudflare D4 verbatim');

// ===== main.pagejs: goPage local no topo =====
// Sem redirect (página funciona sem concurso — §4.1): o goPage existe só
// para servir os 9 onclick do body.
if (!main.startsWith('let copyToastTimer = null;')) throw new Error('main não começa com copyToastTimer');
if (main.includes('function goPage')) throw new Error('main já define goPage');
if (!main.endsWith('})();')) throw new Error('main não termina no fecho da IIFE syncGuides (tail: ' + JSON.stringify(main.slice(-30)) + ')');
const goBlock = [
  '// [R13-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  '// Os 9 onclick do body chamam goPage (seams R13) — a ponte de nomes do',
  '// wrapper (render-util.runPageScripts) expõe esta função para window.',
  'function goPage(dest) {',
  '  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }',
  '  window.location.href = dest;',
  '}',
].join(EOL);
main = goBlock + EOL + main;

// ===== script1.pagejs (IIFE sidebar): verbatim =====
if (!script1.startsWith('// ── SIDEBAR CONCURSO')) throw new Error('script1 não começa no comentário SIDEBAR CONCURSO (tail: ' + JSON.stringify(script1.slice(0, 40)) + ')');
if (!script1.endsWith('})();')) throw new Error('script1 não termina com })();');
console.log('main: goPage local no topo ok | script1: IIFE sidebar verbatim 875-926');

// ===== headers =====
const bodyHeader = [
  '<!-- Track do Oodeus — [R13-port] body de ajuda.html (linhas 483-605 do',
  '     original www/ajuda.html). Adaptações: onclick de navegação',
  '     location.href → goPage (8 pontos simples: logo 486 + nav-items',
  '     490/491/492/493/495/496/497 — o item Ajuda 497 navega para a própria',
  '     página, como no original) + 1 especial (Flashcards 494:',
  "     sessionStorage.setItem('ct_dashboard_tab','flashcards') PRESERVADO +",
  "     goPage('dashboard.html#flashcards') — hash preservado pelo navigateTo",
  '     desde a R9); e na linha 605 a tag cloudflare email-decode (D4, externa',
  '     inexistente — verbatim; inerte porque tags <script> injetadas via',
  '     innerHTML não executam) fica e o <script src="data.js"> da MESMA linha',
  '     é removido (data.js roda no onload do plugin). <img src="assets/…">',
  '     mantém o caminho relativo do original — o shell reescreve na',
  '     renderização. Verbatim de propósito: sidebar idêntica às outras',
  '     páginas (com "—" sem concurso), card GitHub com clone do botão Star,',
  '     contato PIX com <s> riscado, footer "Vedada modificação...", toast',
  '     default "Chave PIX copiada" (§4.3).',
  '-->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R13-port] CSS de ajuda.html (linhas 10-478 do',
  '   original www/ajuda.html, verbatim). O font link do head (Google Fonts',
  '   Inter, linha 8) é descartado (precedente R2). url("assets/…") é',
  '   reescrito pelo shell na renderização (rewritePageCssAssetUrls).',
  '   Dead code D1-D3 verbatim (etapa-13 §4.2): D1 bloco .offer-* (80-140) +',
  '   todos os overrides light-theme (174-211) — card de oferta nunca',
  '   presente no HTML; D2 .tip-row/.tip-num/.tip-text (161-165); D3',
  '   .tips-section (159) inerte — o container zera o estilo com inline',
  '   (582). D4 (tag cloudflare 605) está no body.html. CSS vivo notável',
  '   preservado: .gh-btn/.gh-count (clone do botão Star), .copy-toast,',
  '   .release-note-card, .contact-card, main max-width:860px (única página',
  '   com main estreito). */',
  '',
].join(EOL);
const mainHeader = [
  '/**',
  ' * Track do Oodeus - [R13-port] script principal de ajuda.html (original',
  " * 608-874 + goPage local no topo). O original tem UM bloco <script>",
  ' * (607-927); o split em main+script1.pagejs é para a cadeia do shell (ver',
  " * script1.pagejs). Script inline CLÁSSICO top-level, SEM IIFE de corpo e",
  " * SEM 'use strict' (como o original); IIFEs isoladas para fetchGitHubStars",
  ' * (685-702) e initGuides/syncGuides (704-874). O wrapper do shell',
  ' * (render-util.runPageScripts) faz a ponte de nomes para window — os',
  ' * onclick inline enxergam as funções (inclusive o goPage abaixo).',
  ' *',
  ' * Conteúdo vivo (etapa-13 §4.1): copy toast (showCopyToast 2600ms,',
  ' * updateCopyToast, copyTextValue + fallback textarea/execCommand);',
  ' * openReleaseNotes com pywebview open_external_url (675-676, guard',
  ' * verbatim §6.2) e fallback window.open (682, EXTERNO — verbatim',
  ' * precedente R6/R7/R9); fetchGitHubStars (fetch api.github.com SEM cache,',
  ' * a cada visita); initGuides com fallbackGuides hardcoded e render',
  ' * imediato, depois syncGuides: tenta file:///C:/Users/miche/Desktop/Site%',
  ' * 20Track%20Concurso/... (caminho do DEV hardcoded — falha esperada fora',
  ' * dele, §6.1) e depois raw GitHub (Track-Concursos/track-concursos.github.io);',
  ' * processAndRender limpa imports/exports/icon: e executa o JS remoto com',
  ' * new Function (867 — eval de conteúdo remoto, comportamento a replicar',
  ' * tal como está §6.1); render pula o grupo "Instalação"; item Pronto →',
  ' * window.open do guia (788, EXTERNO).',
  ' *',
  ' * Dead code: D1-D3 no style.css e D4 no body (§4.2, verbatim). Sem',
  ' * redirect de concurso (§4.1: funciona sem concurso). Toast default',
  ' * "Chave PIX copiada" hardcoded no HTML (601-602) — sempre sobrescrito',
  ' * antes de exibir (§4.3).',
  ' *',
  ' * Seams [R13-port]: goPage local no topo (os 9 onclick do body chamam',
  ' * goPage); este script NÃO tem location.href (nenhum). window.open e',
  ' * pywebview verbatim (precedente R6/R7/R9). Sem location.search/hash.',
  ' *',
  ' * Ordem de carregamento do original: theme.js (6) → Inter (8) → style',
  ' * inline (9-479) → theme.css (480) → body (482-605) → data.js (605, na',
  ' * MESMA linha da tag cloudflare) → nav.js (606) → BLOCO ÚNICO <script>',
  ' * (607-927): este script (608-874) e DEPOIS a IIFE sidebar (875-926) →',
  ' * timer-popup.js (928, última linha — o original não fecha',
  ' * </body>/</html>). No plugin: theme/data no onload; nav boot ANTES da',
  ' * cadeia (desvio R3); cadeia = [este script, script1 (IIFE sidebar),',
  ' * timer-popup] — ordem do original (o plano prévio da rodada tinha',
  ' * [script1, main] invertido; ordem de carregamento é comportamento).',
  ' */',
].join(EOL);
const script1Header = [
  '/**',
  ' * Track do Oodeus - [R13-port] IIFE sidebar de ajuda.html (verbatim,',
  ' * linhas 875-926 do original www/ajuda.html — inclui o comentário de',
  ' * seção 875). Idêntica às outras páginas (logo cache-bust, PRÉ-EDITAL',
  ' * reescreve o timer-box, Pós-Edital reescreve com "Coberto ×N", revBadge',
  ' * por concurso numa linha compacta — §4.1/§5.4). SEM seams — não navega.',
  ' * Roda como 2º script da cadeia (DEPOIS do principal, ordem do bloco',
  ' * único original 607-927; o data.js do original 605 roda no onload do',
  ' * plugin). Guard: sem ct_concurso_ativo → return (a página funciona sem',
  ' * concurso — o bloco mostra "—", §4.1).',
  ' */',
].join(EOL);

const dir = 'pages/ajuda';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const mainOut = mainHeader + EOL + main + EOL;
const script1Out = script1Header + EOL + script1 + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
fs.writeFileSync(dir + '/script1.pagejs', script1Out, 'utf8');
console.log('gravado:', dir + '/style.css', Buffer.byteLength(cssOut), 'B |', dir + '/body.html', Buffer.byteLength(bodyOut), 'B |', dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B |', dir + '/script1.pagejs', Buffer.byteLength(script1Out), 'B');
