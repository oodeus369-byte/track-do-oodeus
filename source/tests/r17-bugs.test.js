/**
 * Track do Oodeus — testes R17 (3 bugs reportados pelo Oodeus com screenshot)
 *
 * BUG A — imagem da Faixa Branca quebrada no dashboard: FAIXAS usava caminho
 *   cru `'assets/faixas/…'` sem __ctAssetUrl → <img> 404 (natural 0x0, probe
 *   r17a). A mesma classe de crus existia no fallback do foguete (gif de
 *   lançamento), no logo do share do histórico (template literal) e nos logos
 *   MATERIAL_PROVIDERS dos editais. body.html/style.css NÃO entram aqui: esses
 *   crus são resolvidos pelo pipeline do shell (rewriteBodyAssetSrc /
 *   rewritePageCssAssetUrls — design R3).
 *
 * BUG B — modal "Registrar simulado" incompleto (v1 curta): o buildBridgeCode
 *   copiava functions EAGER no topo do wrapper (`window[n] = eval(n)`) ANTES
 *   das reatribuições top-level da cadeia (`abrirModalSimulado = function…`,
 *   `salvarSimulado = function…` rodam DEPOIS do bridge); o onclick inline,
 *   que só resolve pelo objeto global, via a v1 (5120 chars "Registre seu
 *   desempenho") enquanto o binding local já era o v3 rico (TIPO/Tempo
 *   gasto/Modo de registro/Raio-x — probe r17a: modal pós-clique sem
 *   #simTipo/#simModoCalc). Fix: functions usam o MESMO accessor lazy dos
 *   let/const, com teste `eval(k)` no bridge-time (nome superestimado/aninhado
 *   → sem accessor → sem recursão getter→global). Testes r12 passavam porque
 *   `lex` acessa o binding local sem wrapper.
 *
 * BUG C — altura da view cortada no rodapé: a view começa 71px abaixo do topo
 *   (chrome do Obsidian) e `100vh` = janela (1080) ≠ leaf (1009):
 *   `.ct-page-body{min-height:100vh}` → box 1080 com scrollH 1147, últimas
 *   71px inalcançáveis; `.sidebar{height:100vh}` + `@supports 100dvh` idem.
 *   Fix: rewriteViewportHeightUnits (Nvh → calc(var(--ct-vh,1vh)*N)) aplicado
 *   ao page.style e theme.css no shell; literais do nav.js pré-reescritos (o
 *   nav.js roda via vm nos testes, sem require do render-util); shell mede
 *   --ct-vh = leaf.bottom − content.top com ResizeObserver. Fallback 1vh
 *   preserva a semântica de janela fora da view (modais/toasts em
 *   document.body).
 *
 * Sessão A: fonte + avaliação do array FAIXAS com stub de __ctAssetUrl.
 * Sessão B: funcional via runPageScripts — scripts sintéticos v1→v3; o
 *           caminho do bug (global/onclick inline) deve ver a v3.
 * Sessão C: unitário de rewriteViewportHeightUnits + pipeline real do
 *           theme.css + invariantes de fonte (shell/nav).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { rewriteViewportHeightUnits, runPageScripts } = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dashSrc = read('pages/dashboard/main.pagejs');
const histSrc = read('pages/historico/main.pagejs');
const editSrc = read('pages/editais_premium/main.pagejs');
const shellSrc = read('src/shell.js');
const navSrc = read('src/nav.js');
const themeCss = read('src/theme.css');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

(async () => {
  console.log('== R17-A: BUG A — imagens de assets resolvidas via __ctAssetUrl ==');
  {
    // Dashboard: 8 faixas do sistema de faixas (o bug reportado: a Branca).
    check('A1: dashboard FAIXAS — 8 imagens via __ctAssetUrl',
      (dashSrc.match(/imagem: __ctAssetUrl\('assets\/faixas\//g) || []).length === 8,
      'achou=' + (dashSrc.match(/imagem: __ctAssetUrl\('assets\/faixas\//g) || []).length);
    check('A2: dashboard — nenhum imagem: \'assets/\' cruo', !/imagem: 'assets\//.test(dashSrc));
    check('A3: dashboard — foguete do lançamento (launch layer) resolvido',
      dashSrc.includes('<img src="\' + __ctAssetUrl(\'assets/mascots/pre-edital-rocket.gif\') + \'"')
      && !dashSrc.includes('<img src="assets/mascots/pre-edital-rocket.gif"'));
    check('A4: dashboard — fallback preEditalRocketSrc resolvido (gif + still)',
      dashSrc.includes("? __ctAssetUrl('assets/mascots/pre-edital-rocket.gif')")
      && dashSrc.includes(": __ctAssetUrl('assets/mascots/pre-edital-rocket-still.png')"));

    // Avaliação funcional do array: o caminho vira app://plugin/… na view.
    const i0 = dashSrc.indexOf('var FAIXAS = [');
    const i1 = dashSrc.indexOf('];', i0);
    check('A5: FAIXAS extraído do fonte para avaliação', i0 > -1 && i1 > i0);
    const FAIXAS = new Function('__ctAssetUrl', dashSrc.slice(i0, i1 + 2) + '\nreturn FAIXAS;')((rel) => 'app://plugin/' + rel);
    check('A6: FAIXAS avaliado — 8 faixas com src app://plugin/ resolvido (nada cru)',
      FAIXAS.length === 8 && FAIXAS.every(f => f.imagem.startsWith('app://plugin/assets/faixas/')),
      JSON.stringify(FAIXAS.map(f => f.imagem)));

    // Histórico: logo do share (template literal) + fallback da faixa.
    check('A7: histórico — logo do share resolvido ×2 (Estudos do Dia + Gráficos)',
      (histSrc.match(/src="\$\{__ctAssetUrl\('assets\/Track Concursos logo\.png'\)\}"/g) || []).length === 2);
    check('A8: histórico — nenhum src="assets/Track Concursos logo.png" cruo no .pagejs',
      !histSrc.includes('src="assets/Track Concursos logo.png"'));
    check('A9: histórico — fallback da faixa resolvido, sem imagem cru',
      histSrc.includes("imagem: __ctAssetUrl('assets/faixas/faixabranca.png')")
      && !/imagem: 'assets\//.test(histSrc));

    // Editais premium: MATERIAL_PROVIDERS.
    check('A10: editais — 3 logos resolvidos (qconcursos/estrategia/youtube)',
      (editSrc.match(/logo:__ctAssetUrl\('assets\/material-logos\//g) || []).length === 3);
    check('A11: editais — nenhum logo:\'assets/\' cruo', !/logo:'assets\//.test(editSrc));
  }

  console.log('== R17-B: BUG B — bridge lazy: a última atribuição da função vence ==');
  {
    const j = new JSDOM('<!doctype html><html><head></head><body></body></html>',
      { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
    const w = j.window;
    const content = w.document.createElement('div');
    w.document.body.appendChild(content);

    // Espelho da estrutura real: declaração v1 no topo (iida pelo bridge) e
    // reatribuições v3 que rodam DEPOIS do bridge — com cópia eager, o objeto
    // global ficava com a v1 (o bug: modal curto "Registre seu desempenho").
    const scripts = [
      'function abrirModalSimulado(id) { window.__modalV = "v1"; }',
      'function salvarSimulado() { window.__saveV = "v1"; }',
      'abrirModalSimulado = function (id) { window.__modalV = "v3"; };',
      'salvarSimulado = function () { window.__saveV = "v3"; };',
      // Superestimativa do regex: função ANINHADA — não existe no topo do
      // wrapper; o teste eval(k) no bridge-time não define accessor (senão o
      // getter resolveria o global → recursão).
      'function externa() { function soInterna() {} return soInterna; }',
      // var com reatribuição — regressão do accessor lazy de vars.
      'var contador = 1;',
      'contador = 2;',
    ];
    runPageScripts(w, content, { scripts }, { label: 'r17' });

    check('B1: typeof global === function (accessor definido para a declaração)',
      typeof w.abrirModalSimulado === 'function');
    w.abrirModalSimulado(null);
    check('B2: chamada via objeto global (onclick) abre a v3 — com cópia eager abria a v1',
      w.__modalV === 'v3', String(w.__modalV));
    w.salvarSimulado();
    check('B3: salvarSimulado — última atribuição vence no global',
      w.__saveV === 'v3', String(w.__saveV));
    w.eval('abrirModalSimulado(null)');
    check('B4: resolução via eval de escopo global (window.eval) também vê a v3',
      w.__modalV === 'v3', String(w.__modalV));

    // O caminho EXATO do bug: onclick inline do markup (só resolve pelo
    // objeto global). Probe r17a: abria o modal v1.
    const btn = w.document.createElement('button');
    btn.setAttribute('onclick', 'window.__inlineHit = true; abrirModalSimulado()');
    w.document.body.appendChild(btn);
    btn.click();
    check('B5: onclick inline dispara e chama a v3 (com o bug: v1 "Registre seu desempenho")',
      w.__inlineHit === true && w.__modalV === 'v3', 'hit=' + w.__inlineHit + ' modalV=' + w.__modalV);

    check('B6: nome superestimado/aninhado sem accessor (sem recursão getter→global)',
      w.soInterna === undefined);
    check('B7: var reatribuído — getter lazy devolve o valor atual', w.eval('contador') === 2, String(w.eval('contador')));
    w.contador = 5;
    check('B8: escrita via window → setter grava no MESMO binding do wrapper',
      w.eval('contador') === 5, String(w.eval('contador')));
    check('B9: leitura do binding local pós-escrita global', w.eval('contador') === 5);
    j.window.close();
  }

  console.log('== R17-C: BUG C — unidades de altura reescopadas à VIEW (--ct-vh) ==');
  {
    const rw = rewriteViewportHeightUnits;
    check('C1: 100vh → calc(var(--ct-vh,1vh)*100)',
      rw('min-height:100vh') === 'min-height:calc(var(--ct-vh,1vh)*100)', rw('min-height:100vh'));
    check('C2: 100dvh (theme.css, com espaço) → calc',
      rw('height: 100dvh;') === 'height: calc(var(--ct-vh,1vh)*100);', rw('height: 100dvh;'));
    check('C3: negativo -50vh',
      rw('top:-50vh') === 'top:calc(var(--ct-vh,1vh)*-50)', rw('top:-50vh'));
    check('C4: decimal 88.5vh',
      rw('max-height:88.5vh') === 'max-height:calc(var(--ct-vh,1vh)*88.5)');
    check('C5: sufixos svh/lvh/dvh',
      rw('height:100svh;height:100lvh;height:100dvh')
      === 'height:calc(var(--ct-vh,1vh)*100);height:calc(var(--ct-vh,1vh)*100);height:calc(var(--ct-vh,1vh)*100)');
    check('C6: calc(100vh - 132px) → calc aninhado válido',
      rw('height:calc(100vh - 132px)') === 'height:calc(calc(var(--ct-vh,1vh)*100) - 132px)', rw('height:calc(100vh - 132px)'));
    check('C7: vw intacto (só ALTURA de viewport é reescopada)',
      rw('width:100vw;max-width:94vw') === 'width:100vw;max-width:94vw');

    const out = rw('min-height:100vh;height:100dvh;top:-50vh;max-height:88.5vh');
    check('C8: saída sem Nvh cruo (fora do fallback 1vh do próprio var())',
      !/[\d.](d|s|l)?vh/.test(out.replace(/var\(--ct-vh,1vh\)/g, '')), out);

    // Pipeline real: o theme.css do plugin inteiro passa pelo rewrite.
    const themeOut = rewriteViewportHeightUnits(themeCss);
    check('C9: theme.css real — nenhuma declaração 100vh/dvh sobra após o rewrite',
      !/height:\s*100d?vh/.test(themeOut) && !/@supports \(height:\s*100d?vh\)/.test(themeOut));
    check('C10: theme.css real — os 2 pontos (sidebar + @supports) viraram calc(var(--ct-vh,1vh)*100)',
      (themeOut.match(/calc\(var\(--ct-vh,1vh\)\*100\)/g) || []).length >= 2,
      'n=' + (themeOut.match(/calc\(var\(--ct-vh,1vh\)\*100\)/g) || []).length);

    // Invariantes de fonte — shell.
    check('C11: shell aplica o rewrite no page.style',
      shellSrc.includes('rewriteViewportHeightUnits(scopeBodySelectors(rewritePageCssAssetUrls(page.style)))'));
    check('C12: shell aplica o rewrite no THEME_CSS',
      shellSrc.includes('rewriteViewportHeightUnits(rewriteThemeAssetUrls(scopeBodySelectors(THEME_CSS)))'));
    check('C13: shell publica --ct-vh medido (setProperty no contentEl)',
      shellSrc.includes("setProperty('--ct-vh'"));
    check('C14: _syncViewVh chamado ANTES do innerHTML (var disponível no 1º paint)',
      shellSrc.indexOf('this._syncViewVh(content)') < shellSrc.indexOf('content.innerHTML = rewriteBodyAssetSrc(page.body)'));
    check('C15: ResizeObserver acompanha a leaf e desconecta no onClose',
      shellSrc.includes('new RO(apply)') && /onClose\(\)[\s\S]{0,400}_vhRO/.test(shellSrc));

    // Invariantes de fonte — nav.js (pré-reescrito: roda em vm nos testes,
    // sem require do render-util). Comentários removidos para o literal
    // "100vh" do comentário não casar no assert.
    const navBare = stripComments(navSrc);
    check('C16: nav.js sem 100vh/dvh cruo no style do sidebar',
      !/height:\s*100d?vh/.test(navBare) && !/@supports \(height:\s*100d?vh\)/.test(navBare));
    check('C17: nav.js — sidebar + @supports usam calc(var(--ct-vh,1vh)*100)',
      (navBare.match(/height:calc\(var\(--ct-vh,1vh\)\*100\)/g) || []).length >= 2,
      'n=' + (navBare.match(/height:calc\(var\(--ct-vh,1vh\)\*100\)/g) || []).length);
    check('C18: nav.js mantém @media max-width:820px (height:auto) por último (original)',
      /@media \(max-width:820px\)\{\.sidebar\{height:auto;overflow:visible\}/.test(navBare));
  }

  console.log('\n' + passed + ' passaram, ' + failed + ' falharam');
  if (failed) { console.log('FALHAS:\n  - ' + failures.join('\n  - ')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
