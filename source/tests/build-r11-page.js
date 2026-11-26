// Monta a página Histórico/Métricas (R11, etapa-12):
//   pages/historico/style.css      = original 12-332 (do <style> 11-333)
//   pages/historico/body.html      = original 337-463 (+ seams goPage)
//   pages/historico/script1.pagejs = original 467-518 (IIFE sidebar, verbatim)
//   pages/historico/main.pagejs    = original 521-1953 (+ goPage local + seam
//       522 de redirect — único ponto de navegação do script)
// Dead code D1-D8 do PORT fica verbatim NOS ARQUIVOS (mesma conduta R10:
// duplicação viva/comportamentos replicados); a LISTA D do doc-mestre §1.5
// rege o que NÃO vira tela — aqui o relatório etapa-12 §7 manda conferir que
// nada morto foi removido por engano e nada vivo perdido (checklist §5.7).
// NOTA etapa-12 §6.9: o extend de 9500ms do toast só existia na função morta
// shareTodaySummary (D1) — fica no port verbatim (função órfã replicada).
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/historico.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): theme.js 6, Inter 8, Chart.js CDN 9, html2canvas
// CDN 10, <style> 11, </style> 333, theme.css 334, </head> 335, <body> 336,
// <aside> 339, </aside> 375, <main> 377, </main> 463, data.js 465, <script>
// 466, </script> 519, <script> 520, </script> 1954, nav.js 1958,
// timer-popup.js 1959, </body> 1960, </html> 1961
const tag = (n) => JSON.stringify(lines[n - 1].trim());
console.log('checagem:', tag(6), tag(8), tag(9), tag(10), tag(11), tag(333), tag(334), tag(336), tag(339), tag(375), tag(377), tag(463), tag(465), tag(466), tag(519), tag(520), tag(1954), tag(1958), tag(1959), tag(1960), tag(1961));

const css = lines.slice(11, 332).join(EOL);          // 12-332
let bodyHtml = lines.slice(336, 463).join(EOL);      // 337-463
const script1 = lines.slice(466, 518).join(EOL);     // 467-518
let main = lines.slice(520, 1953).join(EOL);         // 521-1953

// ===== body.html: seams de navegação =====
// 8 pontos location.href (logo 341 + nav-items 345-348/350-352) + 1 especial
// (flashcards 349, com sessionStorage antes) — mesmo padrão do R10
const navRe = /onclick="location\.href='([^']+)'"/g;
const navHits = (bodyHtml.match(navRe) || []).length;
if (navHits !== 8) throw new Error('esperava 8 seams location.href, achei ' + navHits);
bodyHtml = bodyHtml.replace(navRe, "onclick=\"goPage('$1')\"");
// flashcards 349: sessionStorage mantido; location.href → goPage com hash
const fOld = "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');location.href='dashboard.html#flashcards'\"";
if (!bodyHtml.includes(fOld)) throw new Error('seam flashcards (349) não encontrado');
bodyHtml = bodyHtml.replace(fOld, "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"");
// <a href="ajuda.html"> 355 → + onclick goPage + return false (precedente R10)
const aOld = '<a href="ajuda.html" style="text-decoration:none">';
if (!bodyHtml.includes(aOld)) throw new Error('seam <a href> (355) não encontrado');
bodyHtml = bodyHtml.replace(aOld, '<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false" style="text-decoration:none">');
console.log('body: seams location.href =', navHits, '| flashcards + <a href> ok');

const bodyHeader = [
  '<!-- Track do Oodeus — [R11-port] body de historico.html (linhas 337-463 do',
  '     original www/historico.html). Adaptações: onclick de navegação',
  '     location.href → goPage (9 pontos: logo 341 + nav-items 345-352; o item',
  '     Flashcards 349 mantém o sessionStorage.setItem e navega',
  '     dashboard.html#flashcards — hash PRESERVADO pelo navigateTo desde a',
  '     R9); <a href="ajuda.html"> (355) recebe onclick goPage + return false',
  '     (precedente revisões 204). <img src="assets/…"> mantém o caminho',
  '     relativo do original — o shell reescreve na renderização.',
  '     Verbatim de propósito: dead codes D4-D8 (CSS morto) vivem no style.css;',
  '     classes .metrics-* SEM definição CSS (só media queries) — layout por',
  '     style inline (etapa-12 §7 nota). -->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R11-port] CSS de historico.html (linhas 12-332 do',
  '   original www/historico.html, verbatim). O font link do head (Google Fonts',
  '   Inter) é descartado (precedente R2). url("assets/…") é reescrito pelo',
  '   shell na renderização (rewritePageCssAssetUrls).',
  '   Dead code D4-D8 verbatim (heatmap v1 .heatmap*/.l0-.l4, PROGRESSO POR',
  '   MATÉRIA .materias-list/.mat-prog-*, MELHORES DIAS .best-days/.best-day-*',
  '   gold/silver/bronze, gráficos antigos .chart-grid-*/.chart-card*/… —',
  '   EXCETO .shareable-chart-card, que é VIVA — e stats antigos .stats-row/',
  '   .stat-card*/.stat-*/.filtro-sep). A página usa .metrics-stats-grid/',
  '   .metrics-main-grid/.metrics-secondary-grid/.metrics-panel como classes',
  '   SEM definição (só nos media queries 313-321) — layout por style inline,',
  '   replicado como está (etapa-12 §7 nota). */',
  '',
].join(EOL);

// ===== main.pagejs: goPage local + seam de redirect =====
// goPage local (precedente revisões/aba-materia script2)
const goOld = "const cId = sessionStorage.getItem('ct_concurso_ativo');\r\nif (!cId) location.href = 'concursos.html';";
if (!main.includes(goOld)) throw new Error('goPage anchor (521-522) não encontrado');
main = main.replace(goOld, [
  "const cId = sessionStorage.getItem('ct_concurso_ativo');",
  '// [R11-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  'function goPage(dest) {',
  "  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }",
  "  window.location.href = dest;",
  '}',
  '// Seam do redirect (orig 522): o location.href do original NÃO interrompe a',
  '// execução do script (a navegação só é commitada depois) — sem return, o',
  '// boot segue até render() como no original.',
  "if (!cId) goPage('concursos.html');",
].join(EOL));
console.log('main: goPage local + seam 522 ok');

const mainHeader = [
  '/**',
  " * Track do Oodeus - [R11-port] script principal de historico.html",
  ' * (original 521-1953 + seams). Script inline CLÁSSICO top-level, SEM IIFE e',
  " * SEM 'use strict' (como o original); o wrapper do shell",
  ' * (render-util.runPageScripts) faz a ponte de nomes para window — os onclick',
  ' * inline enxergam as funções e as let/const top-level via accessors.',
  ' *',
  ' * Conteúdo (etapa-12): render() (1590-1947) com a SEMÂNTICA ASSIMÉTRICA',
  ' * viva — janela (7/14/30/0) afeta heatmap/análise por matéria/#lblHoras;',
  ' * stats globais e pizza são SEMPRE globais; Estudos do dia é sempre hoje.',
  ' * Heatmap v2 de cards por mês (1430-1588) com 5 níveis por ratio da maior',
  ' * carga (heat1→heat5; limiares 0.9/0.72/0.5/0.28) e legenda SEM heat4',
  ' * (detalhe vivo). Modal único openDayDetail reutilizado p/ dia/mês/ano',
  ' * (showCycleGoal) com painel "Meta do ciclo x tempo estudado" lendo',
  " * ct_ciclo_<cid>.entries (interoperabilidade obrigatória com o ciclo).",
  ' * Cards PRINT verticais (html2canvas scale 2 → clipboard/download;',
  ' * distribuição por matéria 1304 + estudos do dia 1094). Charts destruídos',
  ' * antes de recriar; pizza GLOBAL cutout 55% em horas float com',
  ' * maintainAspectRatio:true (único); "Estudos do dia" herda cor por NOME da',
  ' * matéria (homônimas colidem — vivo). Dias com estudo × diasComAtividade',
  ' * (o segundo calculado e nunca exibido — replicado como está).',
  ' *',
  ' * Dead codes D1-D8 verbatim (shareTodaySummary órfã com o único toast',
  ' * "@TrackConcursos" e extend 9500ms, D1; PIZZA_COLORS sem uso, D2; labels',
  ' * dd/mm calculada e nunca usada, D3). Acentos ausentes: normalização',
  ' * silenciosa é decisão do doc-mestre §1.5 — AQUI OS TEXTOS FICAM COMO NO',
  ' * ORIGINAL ("No periodo", "sem acertos registrados", "x" minúsculo) até a',
  ' * passada de aceite aplicar a política.',
  ' *',
  ' * Seams [R11-port]: goPage local (precedente revisões/aba-materia); redirect',
  ' * sem cId (522 — sem return: o location.href do original não interrompe a',
  ' * execução). Sem location.search/hash neste script (o foco é o ?revisaoId',
  ' * da revisões, não daqui).',
  ' *',
  ' * Ordem de carregamento do original: Chart.js CDN (9) → html2canvas CDN',
  ' * (10) → style/theme.css (11-334) → body (337-463) → data.js (465) → IIFE',
  ' * sidebar (467-518) → este script (520-1954) → nav.js (1958) →',
  ' * timer-popup.js (1959). No plugin: theme.js/data.js no onload; nav boot',
  ' * ANTES da cadeia (desvio R3); cadeia = [chart.umd (vendored R9),',
  ' * html2canvas (vendored R11 — pendência do R9 fechada: o original só usa',
  ' * html2canvas nos cards PRINT), IIFE sidebar, este script, timer-popup',
  ' * (por último, como o <script src> 1959)].',
  ' */',
].join(EOL);

const script1Header = [
  '/**',
  " * Track do Oodeus - [R11-port] IIFE sidebar de historico.html (verbatim,",
  ' * linhas 467-518 do original www/historico.html). Idêntica às outras',
  ' * páginas (logo cache-bust, PRÉ-EDITAL reescreve o timer-box, Pós-Edital',
  ' * reescreve com "Coberto ×N", revBadge por concurso; mesma fonte multilinha',
  ' * de simulados/revisoes). Sem seams — não navega. Roda como 3º script da',
  ' * cadeia (o data.js do original 465 roda no onload do plugin).',
  ' */',
].join(EOL);

const dir = 'pages/historico';
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
