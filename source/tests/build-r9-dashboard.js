// Monta a página Dashboard (R9, etapa-04):
//   vendor/chart.umd.pagejs            = Chart.js 4.4.1 UMD vendored (doc-mestre
//                                        linha 39: bundled no plugin, versão
//                                        exata — original carregava via cdnjs, 9)
//   pages/dashboard/style.css          = original 22-1980 (do <style> 21-1981)
//   pages/dashboard/body.html          = original 1986-2332 (+ seams goPage)
//   pages/dashboard/antiflash.pagejs   = original 12-18 (mini-script anti-flash,
//                                        head 11-19; + seam __CT_PAGE_HASH__)
//   pages/dashboard/main.pagejs        = original 2339-5344 (+ goPage/reloadPagina
//                                        locais + 11 seams de navegação)
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/dashboard.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): <script theme.js> 7, Chart.js CDN 9, data.js 10,
// <script anti-flash> 11 (</script> 19), Inter 20, <style> 21, </style> 1981,
// theme.css 1982, <body> 1985, </main> 2332, timer-popup 2335, nav 2336,
// flashcards 2337, <script principal> 2338, </script> 5345, crono-cycle 5346
const tag = (n) => JSON.stringify(lines[n - 1].trim());
console.log('checagem:', tag(7), tag(9), tag(10), tag(11), tag(19), tag(21), tag(1981), tag(1982), tag(1985), tag(2332), tag(2335), tag(2337), tag(2338), tag(5345), tag(5346));

const css = lines.slice(21, 1980).join(EOL);          // 22-1980
let bodyHtml = lines.slice(1985, 2332).join(EOL);     // 1986-2332
const antiflash = lines.slice(11, 18).join(EOL);      // 12-18
// ===== antiflash.pagejs: seam único [R9-port] =====
// location.hash no plugin é o hash do app Obsidian, não da página →
// window.__CT_PAGE_HASH__ (exposto pelo shell por render, análogo a
// __CT_PAGE_SEARCH__); em browser puro, fallback original. Mesmo padrão do
// seam [R9-port] do flashcards.pagejs (ternário na MESMA linha do var).
const afOld = "var wantsFlashcards = /^#flashcards(?::|$)/.test(String(location.hash || ''))";
if (!antiflash.includes(afOld)) throw new Error('seam antiflash (14) não encontrado');
const antiflashOut0 = antiflash.replace(afOld,
  "var pageHash = typeof window.__CT_PAGE_HASH__ === 'string' ? window.__CT_PAGE_HASH__ : String(location.hash || ''); // [R9-port] seam do shell (plugin); fallback original em browser puro\n"
  + '        var wantsFlashcards = /^#flashcards(?::|$)/.test(pageHash)');
if (!antiflashOut0.includes('__CT_PAGE_HASH__')) throw new Error('seam antiflash não aplicado');
let main = lines.slice(2338, 5344).join(EOL);         // 2339-5344

// ===== body.html: seams de navegação =====
// 7 pontos location.href (logo 1989 + nav-items 1993/1996/1997/2000/2001/2002;
// os itens Dashboard/Flashcards usam showDashTab — verbatim, global do
// flashcards.js)
const navRe = /onclick="location\.href='([^']+)'"/g;
const navHits = (bodyHtml.match(navRe) || []).length;
bodyHtml = bodyHtml.replace(navRe, "onclick=\"goPage('$1')\"");
// <a href="ajuda.html"> 2008 → + onclick goPage + return false (precedente R7/aba-materia)
const aOld = '<a href="ajuda.html" style="text-decoration:none">';
if (!bodyHtml.includes(aOld)) throw new Error('seam <a href> (2008) não encontrado');
bodyHtml = bodyHtml.replace(aOld, '<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false" style="text-decoration:none">');
console.log('body: seams location.href =', navHits, '| <a href> ok');

const bodyHeader = [
  '<!-- Track do Oodeus — [R9-port] body de dashboard.html (linhas 1986-2332 do',
  '     original www/dashboard.html). Adaptações: onclick de navegação',
  '     location.href → goPage (7 pontos: logo 1989 + nav-items 1993/1996/1997/',
  '     2000/2001/2002; os itens Dashboard #navDashboardOverview e Flashcards',
  '     #navFlashcardsDashboard usam showDashTab — verbatim, global exposto pelo',
  '     flashcards.js, que roda antes do script principal); <a href="ajuda.html">',
  '     (2008) recebe onclick goPage + return false (precedente aba-materia/R7).',
  '     <img src="assets/…"> mantém o caminho relativo do original — o shell',
  '     reescreve na renderização. Os 2 modais estáticos (#modalMerge e',
  '     #modalPreEditalReset) continuam ANINHADOS dentro do <aside> da sidebar',
  '     — posição real do DOM (etapa-04 §1, anomalia a replicar). -->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R9-port] CSS de dashboard.html (linhas 22-1980 do',
  '   original www/dashboard.html, verbatim). O font link do head',
  '   (Google Fonts Inter) é descartado (precedente R2: páginas levam só',
  '   CSS/body/scripts). url("assets/remix-stats/…") é reescrito pelo shell na',
  '   renderização (rewritePageCssAssetUrls). O original carrega theme.css',
  '   DEPOIS deste inline (1982) — o shell replica a ordem (style → theme.css). */',
  '',
].join(EOL);
const antiflashHeader = [
  '/**',
  ' * Track do Oodeus - [R9-port] mini-script anti-flash do <head> de',
  ' * dashboard.html (original 12-18 + 1 seam __CT_PAGE_HASH__, ver mais abaixo).',
  ' * No original, roda ANTES do primeiro paint: se o hash casa',
  ' * ^#flashcards(:|$) ou sessionStorage.ct_dashboard_tab === \'flashcards\',',
  ' * adiciona ct-initial-flashcards no <html> (o CSS inline esconde o overview',
  ' * e mostra a aba flashcards antes do primeiro paint). No plugin, roda como',
  ' * 2º script da cadeia da página (por render, síncrono — sem paint entre o',
  ' * inject do body e a cadeia). Seam único [R9-port]: location.hash é do app',
  ' * Obsidian, não da página → window.__CT_PAGE_HASH__ (exposto pelo shell por',
  ' * render, análogo a __CT_PAGE_SEARCH__); em browser puro, fallback original.',
  ' */',
].join(EOL);

// ===== main.pagejs: seams de navegação (11 pontos) =====
let seams = 0;
function seam(oldStr, newStr, label) {
  if (!main.includes(oldStr)) throw new Error('seam ' + label + ' não encontrado');
  main = main.replace(oldStr, newStr);
  seams++;
}
// 1. guard do boot (2340): sem concurso ativo → concursos.html
seam("if (!cId) { location.href = 'concursos.html'; }",
     "if (!cId) { goPage('concursos.html'); }",
     '2340');
// 2. reinício de pré-edital (2473): reload após 180ms
seam('setTimeout(function () { location.reload(); }, 180);',
     'setTimeout(function () { reloadPagina(); }, 180);',
     '2473');
// 3. guard do run() (2913): concurso inexistente → concursos.html
seam("if (!c) { location.href = 'concursos.html'; return; }",
     "if (!c) { goPage('concursos.html'); return; }",
     '2913');
// 4. abrirMateria (3901): → aba_materia.html
seam("function abrirMateria(mid) { sessionStorage.setItem('ct_materia_ativa', mid); location.href = 'aba_materia.html'; }",
     "function abrirMateria(mid) { sessionStorage.setItem('ct_materia_ativa', mid); goPage('aba_materia.html'); }",
     '3901');
// 5. empty state do cronograma (3966): "✨ Começar Agora" → cronograma_inteligente.html
seam('onclick="location.href=\\\'cronograma_inteligente.html\\\'"',
     'onclick="goPage(\\\'cronograma_inteligente.html\\\')"',
     '3966');
// 6. _confDelMat (4547): delete matéria → reload
seam('CT.desvincularOuDeletarMateria(mId, cId);\r\n      location.reload();',
     'CT.desvincularOuDeletarMateria(mId, cId);\r\n      reloadPagina();',
     '4547');
// 7. _dConfirm (4568): criar matéria manualmente → reload
seam("document.getElementById('modalAddMatDash')?.remove(); location.reload();",
     "document.getElementById('modalAddMatDash')?.remove(); reloadPagina();",
     '4568');
// 8. _dClonarMateriaConfirm (4574-4575): clonar matéria → reload
seam("document.getElementById('modalAddMatDash')?.remove();\r\n      location.reload();",
     "document.getElementById('modalAddMatDash')?.remove();\r\n      reloadPagina();",
     '4575');
// 9. _dConfirmJson (4602-4603): importar JSON → reload (mesma forma textual do 4575 — 2ª ocorrência)
seam("document.getElementById('modalAddMatDash')?.remove();\r\n      location.reload();",
     "document.getElementById('modalAddMatDash')?.remove();\r\n      reloadPagina();",
     '4603');
// 10. executarMerge (5335): fusão ok → concursos.html
seam("location.href = 'concursos.html';",
     "goPage('concursos.html');",
     '5335');
// 11. finalizarBatalhaAutomatico (5343): → cadastro em modo edição + finalizar
seam("location.href = 'cadastro_edital.html?editar=' + encodeURIComponent(cId) + '&finalizar=1';",
     "goPage('cadastro_edital.html?editar=' + encodeURIComponent(cId) + '&finalizar=1');",
     '5343');
// window.open (5276) fica VERBATIM (link do edital com Ctrl — precedente R6/R7).
console.log('main: 11 seams de navegação ok | window.open verbatim');

const mainHeader = [
  '/**',
  ' * Track do Oodeus - [R9-port] script principal de dashboard.html',
  ' * (verbatim, linhas 2339-5344 do original www/dashboard.html). Script inline',
  ' * CLÁSSICO top-level, SEM IIFE (o boot é a IIFE (function run(){...})(); em',
  ' * 2910); o wrapper do shell (render-util.runPageScripts, estande 1) faz a',
  ' * ponte de nomes para window — os onclick inline enxergam as funções.',
  ' *',
  ' * DUPLICAÇÕES PRESERVADAS (padrão do original, etapa-04 §7/§14):',
  ' *   renderPainelProva ×2 (3159 morta — referencia isAreaMean inexistente;',
  ' *     3517 viva, com 3 modos de correção) e abrirModalConfigProva ×2',
  ' *     (3267 morta, 3628 viva) — a ÚLTIMA declaração vence (hoisting),',
  ' *     replicado fielmente; renderPreEditalTimerBoxLegacy (2394) morta;',
  ' *     6 funções do cronograma antigo mortas; canvas #chartSemanal',
  ' *     display:none; feature "semana completa" desligada por stub (4978:',
  ' *     _checkSemanaCompleta = function(){return false;}) com',
  ' *     _getSemanasCompletas nem definida; typo novaSemanaCmpleta; "Banca',
  ' *     nao informada" sem acento; #semanaCompletaBox ("Sequencia diaria!")',
  ' *     para sempre escondida — tudo verbatim, parte do "igualzinho".',
  ' *',
  ' * SEAMS DE NAVEGAÇÃO (11 pontos; window.open do link do edital 5276 fica',
  ' * verbatim — precedente R6/R7):',
  ' *   goPage local (delega a window.__CT_NAV_GO_PAGE; fallback location.href',
  ' *   original — padrão script1.pagejs/crono-inteligente/crono-cycle) nos',
  ' *   redirects de página: guard boot 2340, guard run() 2913, abrirMateria',
  ' *   3901 (→ aba_materia.html), empty state 3966 (→ cronograma_inteligente),',
  ' *   executarMerge 5335 (→ concursos.html), finalizarBatalhaAutomatico 5343',
  ' *   (→ cadastro_edital.html?editar=ID&finalizar=1 — navigateTo suporta a',
  ' *   query, R3); reloadPagina (precedente aba-materia script2) nos 5',
  ' *   location.reload: confirmarReinicioPreEdital 2473, _confDelMat 4547,',
  ' *   _dConfirm 4568, _dClonarMateriaConfirm 4575, _dConfirmJson 4603.',
  ' *',
  ' * Ordem de carregamento do original: theme.js (7) → Chart.js 4.4.1 CDN (9)',
  ' * → data.js (10) → mini-script anti-flash (11-19) → Inter (20) → <style>',
  ' * (21-1981) → theme.css (1982) → body (1985) → timer-popup.js (2335) →',
  ' * nav.js (2336) → flashcards.js (2337) → este script (2338) →',
  ' * crono-cycle.js (5346, POR ÚLTIMO — pacto etapa-04 §11: o crono-cycle faz',
  ' * wrap de window.renderCrono com _patched e substitui window.abrirModalCrono;',
  ' * os modos visuais do card Cronograma semanal são chaveados por',
  ' * data-dashboard-mode via renderCrono do dashboard, que sobrevive como',
  ' * base/fallback). No plugin: theme.js/data.js rodam no onload; nav boot',
  ' * ANTES da cadeia (desvio documentado no render-util R3); theme.css depois',
  ' * do style inline (shell, padrão anômalo real); cadeia = [Chart.js vendored',
  ' * (doc-mestre 39: bundled, versão exata), anti-flash [R9-port],',
  ' * timer-popup.pagejs, flashcards.pagejs (adaptado [R9-port] de hash), este',
  ' * script, crono-cycle.pagejs].',
  ' */',
  '// [R9-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  'function goPage(dest) {',
  '  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }',
  '  if (window.__CT_HOST__ && typeof window.__CT_HOST__.navigate === \'function\' && window.__CT_HOST__.navigate(dest)) return;',
  '  window.location.href = dest;',
  '}',
  '// [R9-port] location.reload → re-render da view corrente (goPage da própria',
  '// página — a R2 o define como re-render mimético do reload; em browser puro',
  '// cai no reload original). Precedente: aba-materia script2 (R4).',
  'function reloadPagina() {',
  '  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(\'dashboard.html\'); return; }',
  '  window.location.reload();',
  '}',
].join(EOL);

const dir = 'pages/dashboard';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const antiflashOut = antiflashHeader + EOL + antiflashOut0 + EOL;
const mainOut = mainHeader + EOL + main + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/antiflash.pagejs', antiflashOut, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
console.log('gravado:',
  dir + '/style.css', Buffer.byteLength(cssOut), 'B |',
  dir + '/body.html', Buffer.byteLength(bodyOut), 'B |',
  dir + '/antiflash.pagejs', Buffer.byteLength(antiflashOut), 'B |',
  dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B,', mainOut.split(/\r?\n/).length, 'linhas');
