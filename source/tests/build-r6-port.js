// Monta pages/crono/crono-cycle.pagejs — R6+R7: arquivo COMPLETO do original.
// R6 (etapa-08): parte 1 (1-3576). R7 (etapa-09): parte 2 (3577-5046) + boot
// (initDashboard 5335-5349) — com o arquivo inteiro a ordem É a do original
// (a "cauda de hoisting" da R6 volta à posição natural, 5047-5334).
// Seams: 3 de navegação (R6) + 1 asset literal em runtime (logo do PDF, 3807).
const fs = require('fs');
const src = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/crono-cycle.js', 'utf8');
const crlf = src.includes('\r\n');
const lines = src.split(/\r?\n/);
console.log('total linhas:', lines.length, '| eol:', crlf ? 'CRLF' : 'LF');

const part1 = lines.slice(0, 3576);          // 1-3576 (fim de smartBuildTodayShareMessage)
const part2 = lines.slice(3576, 5046);       // 3577-5046 (PDF/WhatsApp/Telegram, modais, patchRender, abrirModalCrono, bindTimerBridge)
const hoist = lines.slice(5046, 5334);       // 5047-5334 (getCronogramaConfig .. buildLivreCycleData — hoisting de function declaration)
const boot = lines.slice(5334, 5349);        // 5335-5349 (initDashboard IIFE com guard #cronoGrid + fechamento da IIFE)
console.log('parte1:', part1.length, '| parte2:', part2.length, '| hoisting:', hoist.length, '| boot:', boot.length);
console.log('fim parte1:', JSON.stringify(part1[3575].trim()));
console.log('ini parte2:', JSON.stringify(part2[0].trim()));
console.log('fim parte2:', JSON.stringify(part2[part2.length - 1].trim()));
console.log('ini hoisting:', JSON.stringify(hoist[0].trim()));
console.log('ini boot:', JSON.stringify(boot[0].trim()));
console.log('fim boot:', JSON.stringify(boot[boot.length - 1].trim()));

const EOL = crlf ? '\r\n' : '\n';
let body = part1.concat(part2, hoist).join(EOL);
// Seam 1: navegação (openMateriaTab) — goPage local
const s1old = "    sessionStorage.setItem('ct_materia_ativa', materiaId);" + EOL + "    window.location.href = 'aba_materia.html';" + EOL + "    return true;";
if (!body.includes(s1old)) throw new Error('seam1 não encontrado');
body = body.replace(s1old, "    sessionStorage.setItem('ct_materia_ativa', materiaId);" + EOL + "    goPage('aba_materia.html');" + EOL + "    return true;");
// Seam 2: onclick programático (controles de compartilhamento do card)
const s2old = "button.onclick = function () { window.location.href = 'cronograma_inteligente.html'; };";
if (!body.includes(s2old)) throw new Error('seam2 não encontrado');
body = body.replace(s2old, "button.onclick = function () { goPage('cronograma_inteligente.html'); };");
// Seam 3: onclick inline em HTML injetado (string) — bridge global __ctGo
const s3old = "onclick=\"location.href=\\'cronograma_inteligente.html\\'\"";
if (!body.includes(s3old)) throw new Error('seam3 não encontrado');
body = body.replace(s3old, "onclick=\"__ctGo(\\'cronograma_inteligente.html\\')\"");
// Seam 4 [R7-port]: asset literal em runtime (logo do PDF off-screen, orig 3807)
// → __ctAssetUrl (precedente main.pagejs/data.js). pywebview (3605), window.open
// (3610), navigator.share (4010) e clipboard (3578) ficam VERBATIM (precedentes).
const s4old = "'<img class=\"smart-pdf-logo\" src=\"assets/logo-oficial-track-concursos.png\" alt=\"Track Concursos\">'";
if (!body.includes(s4old)) throw new Error('seam4 (logo do PDF) não encontrado');
body = body.replace(s4old, "'<img class=\"smart-pdf-logo\" src=\"' + __ctAssetUrl('assets/logo-oficial-track-concursos.png') + '\" alt=\"Track Concursos\">'");
// goPage local + bridge global, logo após a abertura da IIFE
const iifeOpen = '(function () {' + EOL + '  // Remove dash-only restriction to allow timer bridge on all pages';
if (!body.includes(iifeOpen)) throw new Error('abertura da IIFE não encontrada');
body = body.replace(iifeOpen, '(function () {' + EOL + '  // [R6-port] goPage local: navegação pela ponte do host (nav.js define' + EOL + '  // window.__CT_NAV_GO_PAGE); fallback = location.href original. O bridge' + EOL + '  // global window.__ctGo existe para os onclicks INLINE do HTML injetado' + EOL + '  // (escopo de IIFE não é visível para handlers inline).' + EOL + '  function goPage(p) {' + EOL + "    if (typeof window.__CT_NAV_GO_PAGE === 'function') { window.__CT_NAV_GO_PAGE(p); return; }" + EOL + "    window.location.href = p;" + EOL + '  }' + EOL + '  if (!window.__ctGo) window.__ctGo = goPage;' + EOL + '  // Remove dash-only restriction to allow timer bridge on all pages');

const header = [
  '/**',
  ' * Track do Oodeus - [R6+R7-port] crono-cycle.js COMPLETO (verbatim, linhas 1-5349',
  ' * do original www/crono-cycle.js). IIFE SEM use strict (como o original).',
  ' *',
  ' * R6 (etapa-08): motor de ciclos (1-3576) + cauda de hoisting — com o arquivo',
  ' * completo (R7), as funções de hoisting (5047-5334: getCronogramaConfig,',
  ' * calculateCycleSubjectPriorities, buildSuggestedCycleData,',
  ' * getNextUnstudiedTopicForSubject, buildLivreCycleData) voltam à posição',
  ' * original (usadas pelo motor desde a linha 459, definidas no fim).',
  ' * R7 (etapa-09): parte 2 (3577-5046 — PDF/WhatsApp/Telegram dos "Estudos de',
  ' * hoje", modais do compartilhamento, patchRender, abrirModalCrono,',
  ' * bindTimerBridge) + boot initDashboard (5335-5349, guard #cronoGrid — inerte',
  ' * no CI, arming no dashboard R9).',
  ' *',
  ' * Seams (únicos):',
  ' *   1. goPage local (4 pontos): openMateriaTab (123), botão de share (1167),',
  ' *      onclick inline (1190) e asset do logo do PDF (3807, __ctAssetUrl).',
  ' *      pywebview (3605-3610), window.open (3610), navigator.share (4010) e',
  ' *      navigator.clipboard (3578) ficam VERBATIM (precedentes R3-R6).',
  ' *   2. nada mais: CT.confirm/alert, CTToast (guard try/catch), renderCrono,',
  ' *      abrirMateria, CTCycle-self são guardados pelo próprio original;',
  ' *      storage ct_ciclo_<cid>/ct_crono_mats_<cid>/ct_timer_state funciona',
  ' *      pela ponte do host.',
  ' *',
  ' * Carregamento no original: dashboard.html (5346) e cronograma_inteligente.html',
  ' * (4338) — R9/R7. No plugin: CI carrega como 2º script da página',
  ' * cronograma_inteligente.html; dashboard (R9) carregará depois.',
  ' */',
  '',
].join(EOL);

const out = header + body + EOL + boot.join(EOL) + EOL;
fs.mkdirSync('pages/crono', { recursive: true });
fs.writeFileSync('pages/crono/crono-cycle.pagejs', out, 'utf8');
console.log('gravado pages/crono/crono-cycle.pagejs:', Buffer.byteLength(out), 'bytes,', out.split(/\r?\n/).length, 'linhas');
