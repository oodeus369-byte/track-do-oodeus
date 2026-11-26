// Monta a página Cronograma Inteligente (R7, etapa-09 Parte B):
//   pages/crono-inteligente/style.css   = original 10-467 (do <style>)
//   pages/crono-inteligente/body.html   = original 472-970 (+ seams goPage)
//   pages/crono-inteligente/main.pagejs = original 973-4336 (+ goPage local +
//       seam 3701 + correções D1/D2/D3 decididas pelo Oodeus 2026-11-13)
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/cronograma_inteligente.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
const lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): <style> 9, </style> 468, <body> 471, <script src data.js> 971,
// <script> 972, </script> 4337, crono-cycle.js 4338, nav.js 4339, </body> 4340
const tag = (n) => JSON.stringify(lines[n - 1].trim());
console.log('checagem:', tag(9), tag(468), tag(471), tag(971), tag(972), tag(4337), tag(4338), tag(4339), tag(4340));

const css = lines.slice(9, 467).join(EOL);        // 10-467
let bodyHtml = lines.slice(471, 970).join(EOL);   // 472-970
let main = lines.slice(972, 4336).join(EOL);      // 973-4336

// ===== body.html: seams de navegação =====
// 9 pontos location.href (logo 474 + nav-items 478-485, exceto flashcards 482)
const navRe = /onclick="location\.href='([^']+)'"/g;
const navHits = (bodyHtml.match(navRe) || []).length;
bodyHtml = bodyHtml.replace(navRe, "onclick=\"goPage('$1')\"");
// flashcards 482: sessionStorage mantido; location.href → goPage (hash #flashcards
// é descartado pelo navigateTo — pendência R9 de hash/query routing)
const fOld = "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');location.href='dashboard.html#flashcards'\"";
if (!bodyHtml.includes(fOld)) throw new Error('seam flashcards (482) não encontrado');
bodyHtml = bodyHtml.replace(fOld, "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"");
// <a href="ajuda.html"> 488 → + onclick goPage + return false (precedente aba-materia 29)
const aOld = '<a href="ajuda.html" style="text-decoration:none">';
if (!bodyHtml.includes(aOld)) throw new Error('seam <a href> (488) não encontrado');
bodyHtml = bodyHtml.replace(aOld, '<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false" style="text-decoration:none">');
console.log('body: seams location.href =', navHits, '| flashcards + <a href> ok');

const bodyHeader = [
  '<!-- Track do Oodeus — [R7-port] body de cronograma_inteligente.html (linhas 472-970 do',
  '     original www/cronograma_inteligente.html). Adaptações: onclick de navegação',
  '     location.href → goPage (9 pontos: logo 474 + nav-items 478-485; o item',
  '     Flashcards 482 mantém o sessionStorage.setItem e navega dashboard.html#flashcards',
  '     — hash descartado pelo navigateTo, pendência R9); <a href="ajuda.html"> (488)',
  '     recebe onclick goPage + return false (precedente aba-materia). <img src="assets/…">',
  '     mantém o caminho relativo do original — o shell reescreve na renderização.',
  '     Verbatim de propósito (dead codes D4-D11 documentados na etapa-09). -->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R7-port] CSS de cronograma_inteligente.html (linhas 10-467 do',
  '   original www/cronograma_inteligente.html, verbatim). O font link do head',
  '   (Google Fonts Inter) é descartado (precedente R2: páginas levam só CSS/body/',
  '   scripts). url("assets/remix-stats/…") é reescrito pelo shell na renderização',
  '   (rewritePageCssAssetUrls). */',
  '',
].join(EOL);

// ===== main.pagejs: seam + correções D1/D2/D3 =====
// seam único de navegação no script (orig 3701)
const sOld = "onclick=\"location.href=\\'cadastro_edital.html\\'\"";
if (!main.includes(sOld)) throw new Error('seam 3701 não encontrado');
main = main.replace(sOld, "onclick=\"goPage(\\'cadastro_edital.html\\')\"");
// D2 (orig 2455): grid do wizard mostra as horas JÁ SALVAS
const d2old = 'const val = setupHoursModified ? (config.horas[day.key] ?? 0) : 0;';
if (!main.includes(d2old)) throw new Error('D2 (2455) não encontrado');
main = main.replace(d2old, 'const val = config.horas[day.key] ?? 0; // [R7-port D2] horas já salvas (flag setupHoursModified fica inerte — decisão Oodeus 2026-11-13)');
// D1 (orig 1546-1548): branch morto do sinal 'queda' removido
const d1old = [
  '  if (general.pct >= 80 && recent.pct < 65) {',
  "    return { key:'queda', label:'queda recente', className:'drop' };",
  '  }',
  '',
].join(EOL);
if (!main.includes(d1old)) throw new Error('D1 (1546-1548) não encontrado');
main = main.replace(d1old, [
  '  // [R7-port D1] branch morto removido (orig 1546-1548): if (general.pct >= 80 &&',
  "  // recent.pct < 65) → 'queda' era inalcançável (recent.pct < 65 já retornou",
  "  // 'dificuldade' acima). O sinal 'queda' segue morto nos usos (arrays) — verbatim;",
  '  // decisão final eliminado/tornado real é da Etapa 14 (decisão Oodeus 2026-11-13).',
  '',
].join(EOL));
// D3 (orig 2719-2726): sem as leituras dos IDs fantasma #setupRitmo/#setupQuestoes
const d3old = [
  '    ritmo: document.getElementById(\'setupRitmo\')?.value || config.ritmo || \'equilibrado\',',
  '    questoesPct: clampNumber(document.getElementById(\'setupQuestoes\')?.value, 0, 80, config.questoesPct)',
].join(EOL);
if (!main.includes(d3old)) throw new Error('D3 (2719-2726) não encontrado');
main = main.replace(d3old, [
  "    ritmo: config.ritmo || 'equilibrado', // [R7-port D3] sem leitura do ID fantasma #setupRitmo",
  '    questoesPct: config.questoesPct // [R7-port D3] sem leitura do ID fantasma #setupQuestoes',
].join(EOL));
console.log('main: seam 3701 + D1 + D2 + D3 ok');

const mainHeader = [
  '/**',
  ' * Track do Oodeus - [R7-port] script principal de cronograma_inteligente.html',
  ' * (verbatim, linhas 973-4336 do original www/cronograma_inteligente.html).',
  ' * Script inline CLÁSSICO top-level, SEM IIFE e SEM \'use strict\' (como o',
  ' * original); o wrapper do shell (render-util.runPageScripts, estande 1) faz a',
  ' * ponte de nomes para window — os onclick inline enxergam as funções e as',
  ' * let/const top-level via accessors.',
  ' *',
  ' * Boot no fim do arquivo (verbatim): config = loadConfig(); render(); +',
  ' * listener \'storage\' para chaves ct_ + export window.closeCalendarDay.',
  ' *',
  ' * CORREÇÕES decididas pelo Oodeus (2026-11-13, spec etapa-09 §Etapa-14) —',
  ' * "eliminado ou tornado real" na reconstrução:',
  ' *   D1 (orig 1546-1548): branch morto do sinal \'queda\' REMOVIDO (inalcançável).',
  ' *   D2 (orig 2455): wizard mostra as horas JÁ SALVAS (flag setupHoursModified',
  ' *       inerte; as atribuições dela em 1133/2771/2824 ficam verbatim).',
  ' *   D3 (orig 2719-2726): collectSetupAvailability sem leituras dos IDs',
  ' *       FANTASMA #setupRitmo/#setupQuestoes (não existem no DOM) — fallbacks',
  ' *       diretos.',
  ' *',
  ' * Seam único (navegação): onclick inline \'cadastro_edital.html\' (orig 3701) →',
  ' * goPage local (delega a window.__CT_NAV_GO_PAGE do nav.js; fallback',
  ' * location.href original — padrão script1.pagejs do cadastro).',
  ' *',
  ' * Ordem de carregamento do original: data.js (971) → este script (972) →',
  ' * crono-cycle.js (4338) → nav.js (4339). No plugin: data.js roda no onload;',
  ' * nav boot ANTES da cadeia (desvio documentado no render-util R3); cadeia =',
  ' * [este script, crono-cycle.pagejs]. O CI NÃO carrega timer-popup.js (o',
  ' * original também não) — openCycleTimer sai cedo sem #timerPopup (guard do',
  ' * próprio original); initDashboard do crono-cycle sai cedo sem #cronoGrid.',
  ' * Config: chave ct_cronograma_inteligente_<cid>; DEFAULT_CONFIG (984-1001);',
  ' * collectConfigFromUi zera revisaoPct/questoesPct (D4, 1096-1097) — vivos.',
  ' */',
  '// [R7-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  'function goPage(dest) {',
  '  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }',
  '  if (window.__CT_HOST__ && typeof window.__CT_HOST__.navigate === \'function\' && window.__CT_HOST__.navigate(dest)) return;',
  '  window.location.href = dest;',
  '}',
].join(EOL);

const dir = 'pages/crono-inteligente';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const mainOut = mainHeader + EOL + main + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
console.log('gravado:', dir + '/style.css', Buffer.byteLength(cssOut), 'B |', dir + '/body.html', Buffer.byteLength(bodyOut), 'B |', dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B,', mainOut.split(/\r?\n/).length, 'linhas');
