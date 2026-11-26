/**
 * Track do Oodeus — testes R15 (bugfix pós-deploy: colisão `.empty-state`)
 * O app original usa `.empty-state` para o placeholder do grid; o app.css do
 * Obsidian usa a MESMA classe para overlays vazios
 * (`position:absolute; width/height:100%; display:flex`) e cobria o wrapper
 * inteiro da view, engolindo os cliques (22 de 29 clicáveis — CDP 2026-11-22).
 * Sessão A: constante do neutralizador (render-util) — forma e escopo.
 * Sessão B: shell injeta o neutralizador ANTES do CSS da página.
 * Sessão C: prova de escopo em jsdom — a regra casa dentro de `.ct-page-body`
 *           e NÃO casa fora (empty-states do próprio Obsidian intactos).
 * Sessão D: invariantes de colisão — o CSS do port para `.empty-state` não
 *           declara nenhuma propriedade que o neutralizador restaura (disjuntos
 *           = não sobrescreve o estilo nosso), e o neutralizador não tem regra
 *           bare.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { PLATFORM_NEUTRALIZE_CSS, scopeBodySelectors } = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const shellSrc = read('src/shell.js');
const concursosCss = read('pages/concursos/style.css');
const revisoesCss = read('pages/revisoes/style.css');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

// Propriedades que o app.css do Obsidian declara em `.empty-state` bare e que
// o neutralizador restaura (dump do CDP diag6/8, 2026-11-22).
const PROPS_PLATAFORMA = ['position', 'top', 'inset-inline-start', 'width', 'height', 'container-type', 'display', 'align-items', 'justify-content', 'flex-direction'];

console.log('Sessão A — constante do neutralizador');
check('PLATFORM_NEUTRALIZE_CSS exportada e não vazia',
  typeof PLATFORM_NEUTRALIZE_CSS === 'string' && PLATFORM_NEUTRALIZE_CSS.length > 0);
check('seletor escopado em .ct-page-body (0,2,0 — vence o .empty-state 0,1,0 do app.css)',
  PLATFORM_NEUTRALIZE_CSS.startsWith('.ct-page-body .empty-state{'));
check('sem regra bare (nenhuma declaração fora do escopo do view)',
  !/(^|[},])\s*\.empty-state\s*\{/.test(PLATFORM_NEUTRALIZE_CSS.replace('.ct-page-body .empty-state{', '')));
check('restaura position:static e display:block (anula absolute/flex do platform)',
  PLATFORM_NEUTRALIZE_CSS.includes('position:static') && PLATFORM_NEUTRALIZE_CSS.includes('display:block'));
check('anula o container-type do platform (inline-size criava containment)',
  PLATFORM_NEUTRALIZE_CSS.includes('container-type:normal'));

console.log('Sessão B — injeção no shell');
check('shell.js importa a constante do render-util',
  shellSrc.includes('PLATFORM_NEUTRALIZE_CSS') && shellSrc.includes("require('./render-util')"));
check('shell prepend o neutralizador ao style da página (antes do CSS portado) [R17-C: o rewrite de vh entra entre o neutralizador e o scopeBodySelectors]',
  shellSrc.includes('PLATFORM_NEUTRALIZE_CSS + rewriteViewportHeightUnits(scopeBodySelectors('));

console.log('Sessão C — prova de escopo em jsdom');
{
  const dom = new JSDOM('<!doctype html><html><head></head><body>' +
    '<div class="ct-page-body"><div class="empty-state">Nenhum concurso ainda</div></div>' +
    '<div class="empty-state">overlay vazio do Obsidian</div>' +
    '</body></html>');
  const [dentro, fora] = dom.window.document.querySelectorAll('.empty-state');
  check('regra casa no empty-state DENTRO da view', dentro.matches('.ct-page-body .empty-state'));
  check('regra NÃO casa no empty-state FORA da view (Obsidian intacto)', !fora.matches('.ct-page-body .empty-state'));
}

console.log('Sessão D — invariantes de colisão');
function declaraPropriedade(css, prop) {
  // varre só o bloco `.empty-state{...}` bare do CSS do port
  const re = /(^|[\s,{}])\.empty-state(?![\w-])[^{]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (new RegExp('(?:^|;)\\s*' + prop.replace(/-/g, '-') + '\\s*:').test(';' + m[2])) return true;
  }
  return false;
}
for (const [nome, css] of [['concursos', concursosCss], ['revisoes', revisoesCss]]) {
  const conflitos = PROPS_PLATAFORMA.filter((p) => declaraPropriedade(css, p));
  check('CSS de ' + nome + ': .empty-state não declara nenhuma propriedade que o neutralizador restaura (disjuntos)',
    conflitos.length === 0, conflitos.join(','));
}
{
  // as regras do port seguem byte-iguais às do original (critério "igualzinho")
  const orig = fs.readFileSync('C:\\Users\\maest\\AppData\\Local\\Programs\\Track Concursos\\www\\concursos.html', 'utf8');
  const blocoPort = (concursosCss.match(/(^|[\s,{}])\.empty-state(?![\w-])[^{]*\{[^}]*\}/) || [''])[0].replace(/\s+/g, ' ').trim();
  check('regra .empty-state do port idêntica à do original (paridade mantida)',
    blocoPort.length > 0 && orig.replace(/\s+/g, ' ').includes(blocoPort));
}

console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
if (failed) { console.log('FALHAS:\n  - ' + failures.join('\n  - ')); process.exit(1); }
