/**
 * Track do Oodeus — render-util.js [R2]
 * Helpers puros do shell de views (sem dependência do obsidian — testáveis em
 * Node/jsdom): reescrita de seletores `body`, de URLs de assets no CSS e no
 * HTML do body das páginas.
 */
const PAGE_BODY_CLASS = 'ct-page-body';

// Resolvedor de asset relativo (fallback: caminho literal do original).
function assetUrlOf(rel) {
  if (typeof window === 'undefined') return rel;
  const h = window.__CT_HOST__;
  if (h && typeof h.assetUrl === 'function') {
    // [R18] `?v=1` é cache-buster do servidor HTTP do original. O adapter do
    // vault trata '?' como parte do PATH (codifica `%3F`) e já acrescenta o
    // próprio timestamp. Separa a query ANTES de resolver, senão o resource
    // vira `arquivo.png%3Fv=1?179566` e o <img> fica 0×0 (resíduo R17 §6.2).
    const raw = String(rel == null ? '' : rel);
    const q = raw.indexOf('?');
    const u = h.assetUrl(q === -1 ? raw : raw.slice(0, q));
    if (u) return u;
  }
  return rel;
}

// Asset base dos ícones do nav (fallback: caminho relativo do original).
function assetBaseOf() {
  if (typeof window === 'undefined') return 'assets/remix-nav/';
  const h = window.__CT_HOST__;
  if (h && typeof h.assetBase === 'function') {
    const b = h.assetBase();
    if (b) return b;
  }
  return 'assets/remix-nav/';
}

// [R2-port] Reescrita de seletores `body` para a classe do contentEl. Só toca
// em seletores de elemento (não em `.card-body` etc.): primeiro o par
// `html, body {` (theme.css), depois o `body` solto.
function scopeBodySelectors(css) {
  const sel = '.' + PAGE_BODY_CLASS;
  return css
    .replace(/html,\s*body\s*([{,])/g, sel + '$1')
    .replace(/(^|[,\s;{])body([,\s{])/g, '$1' + sel + '$2');
}

// [pós-deploy] Neutralizador de colisão de classe com o app.css do Obsidian.
// O app original usa `.empty-state` para o placeholder do grid ("Nenhum
// concurso ainda") e o Obsidian usa a MESMA classe para os overlays vazios
// dele: `position:absolute; width/height:100%; top:0; display:flex` — que no
// plugin cobria o wrapper inteiro (1200×911) e engolia os cliques (22 de 29
// clicáveis cobertos; diagnóstico CDP 2026-11-22). A regra do port para
// `.empty-state` é idêntica à do original e não declara `position`, então a
// do platform vencia por cascata. Este neutralizador: (a) é mais específico
// (`.ct-page-body .empty-state` = 0,2,0 vs `.empty-state` = 0,1,0 do
// app.css), (b) é escopado ao contentEl da view para NÃO tocar nos
// empty-states do próprio Obsidian, e (c) só declara propriedades disjuntas
// das regras do port (text-align/padding/color/grid-column) — restaura os
// defaults do elemento original sem sobrescrever estilo nosso.
const PLATFORM_NEUTRALIZE_CSS =
  '.ct-page-body .empty-state{position:static;top:auto;inset-inline-start:auto;' +
  'width:auto;height:auto;container-type:normal;display:block;' +
  'align-items:normal;justify-content:normal;flex-direction:row;}' +
  // [R16] Colisão de REGRAS DE PLATAFORMA no <button class="choice-card"> do
  // Cronograma Inteligente (bug R16-3; probes CDP r16i/r16k, 2026-11-22):
  //   • app.css `button` (0,0,1): display:inline-flex; align-items:center;
  //     justify-content:center; text-wrap-mode:nowrap; height:var(--input-height);
  //     font-size:var(--font-ui-small); font-weight:var(--input-font-weight);
  //   • app.css `button:not(.clickable-icon)` (0,1,1 — VENCE a classe 0,1,0
  //     do port): color:var(--text-color); background-color:var(--interactive-
  //     normal); box-shadow:var(--input-shadow);
  //   • inline#44 (style EXTERNO — outro plugin/tema, não nosso; sem snippet
  //     do usuário, letter-spacing:.04em inexistente no bundle) `button`
  //     (0,0,1): text-transform:uppercase; letter-spacing:0.04em; font-size:0.9em.
  // O port só declara display:flex;flex-direction:column;text-align:left, então
  // a plataforma vencia: com align-items:center + white-space:nowrap os filhos
  // dimensionavam por max-content (card 483px com scrollWidth 968; grid 980 →
  // 2059; shell 1267 → 2202) e o card de 260px estourava — screenshot do Oodeus.
  // Este bloco (0,2,0) restaura o que o ORIGINAL recebia do UA do Chromium
  // (pywebview = mesmo motor; valores medidos em iframe srcdoc isolado, probe
  // r16k: text-transform:none, letter-spacing:normal, white-space:normal,
  // align-items:normal, justify-content:normal, font-size:13.3333px,
  // font-weight:400) e o que a cascata do original deixava valer as regras do
  // port (color/background do .choice-card; box-shadow só no :hover, que é
  // 0,2,0 e vem DEPOIS no <style> da página — empate resolvido pela ordem).
  '.ct-page-body .choice-card{' +
  'text-transform:none;letter-spacing:normal;white-space:normal;' +
  'align-items:normal;justify-content:normal;height:auto;' +
  'font-size:13.3333px;font-weight:400;' +
  'color:var(--text);background-color:var(--bg2);box-shadow:none;}' +
  // [R23] Overlays escondidos só com `opacity:0` (sem classe .visible) seguem
  // no DOM com `display:flex`. O overlay até tem pointer-events:none, mas os
  // FILHOS herdam o default `auto` e interceptam cliques reais em TODOS os
  // botões da página (probe CDP r23: elementFromPoint -> .popup-title de
  // #modal-ajuste-materia invisível). No original a navegação descartava o
  // DOM; aqui a view persiste. Neutralizar overlay + descendentes.
  '.ct-page-body .popup-overlay:not(.visible),' +
  '.ct-page-body .modal-overlay:not(.visible){pointer-events:none!important;}' +
  '.ct-page-body .popup-overlay:not(.visible) *,' +
  '.ct-page-body .modal-overlay:not(.visible) *{pointer-events:none!important;}' +
  // [R25] "Meus Baralhos": 3 dos 5 cards de estatística são <button> e 2 são
  // <div>. As regras de `button` da plataforma venciam as do port (mesma
  // família do .choice-card da R16): display:flex, align/justify:center,
  // white-space:nowrap, font 13.5px — altura 38px contra 97px dos <div>.
  // Restaura os valores medidos no original/nos cards <div>.
  '.ct-page-body button.flash-stat-card{' +
  'display:block!important;align-items:normal!important;justify-content:normal!important;' +
  'white-space:normal!important;height:auto!important;min-height:0!important;' +
  'font-size:15px!important;letter-spacing:normal!important;text-transform:none!important;' +
  'padding:18px 20px!important;width:100%!important;text-align:left!important;' +
  'appearance:none!important;background:var(--bg2)!important;color:var(--text)!important;' +
  'border:1px solid var(--border)!important;border-radius:14px!important;}' +
  '.ct-page-body button.flash-stat-card:not(:hover):not(:focus-visible){box-shadow:none!important;}';

// [R2-port] URLs de assets dentro do theme.css (máscaras de ícone remix-nav).
function rewriteThemeAssetUrls(css) {
  const h = typeof window !== 'undefined' ? window.__CT_HOST__ : null;
  // [R28] Com host que resolve assets (plugin real), troca cada url() pelo
  // assetUrl — que agora devolve data: dos assets embutidos. Sem assetUrl
  // (harness que só fornece assetBase), mantém o comportamento antigo.
  if (h && typeof h.assetUrl === 'function') {
    return css.replace(/url\((['"]?)assets\/([^'")]+)\1\)/g,
      (m, q, rel) => 'url(' + q + assetUrlOf('assets/' + rel) + q + ')');
  }
  return css.replace(/assets\/remix-nav\//g, assetBaseOf());
}

// [R2-port] src="assets/…" do body → assetUrl (img do logo etc.).
function rewriteBodyAssetSrc(html) {
  return html.replace(/src="(assets\/[^"]+)"/g, (m, rel) => 'src="' + assetUrlOf(rel) + '"');
}

// [R3-port] url("assets/…") dentro do CSS da página (máscaras de ícone
// remix-wizard do cadastro). Só toca em url() com caminho assets/ relativo.
function rewritePageCssAssetUrls(css) {
  return css.replace(/url\((['"]?)assets\/([^'")]+)\1\)/g, (m, q, rel) => 'url(' + q + assetUrlOf('assets/' + rel) + q + ')');
}

// [R17-C] Unidade de altura de viewport reescopada à VIEW do plugin. No
// original a página É a janela (pywebview: 100vh = janela inteira). No
// plugin a view começa abaixo do chrome do Obsidian (71px medidos no probe
// r17a) e 100vh estourava a leaf: .ct-page-body com min-height 1080px em
// leaf de 1009px — o box ficava 71px além da área visível e as últimas
// 71px do rodapé eram inalcançáveis (scroll terminava antes do fim do
// conteúdo). Todo Nvh/Nsvh/Nlvh/Ndv vira calc(var(--ct-vh,1vh)*N): a shell
// publica --ct-vh em px no contentEl (altura da leaf, sincronizada por
// ResizeObserver) e o fallback 1vh preserva o comportamento da janela FORA
// da view (modais/toasts em document.body continuam com vh de janela).
// Reescreve também a condição de @supports (height:100dvh) — vira uma
// declaration com var(), sintaticamente válida → true — e o corpo do bloco
// recebe o mesmo calc.
function rewriteViewportHeightUnits(css) {
  return css.replace(
    /(-?)(\d+(?:\.\d+)?)(?:d|s|l)?vh(?![\w-])/g,
    (m, sign, n) => 'calc(var(--ct-vh,1vh)*' + (sign ? '-' : '') + n + ')'
  );
}

// Log de ordem de execução dos scripts da página (diagnóstico/testes).
function initScriptLog(win) {
  if (!Array.isArray(win.__ctScriptLog)) {
    try { win.__ctScriptLog = []; } catch (_) { /* window congelado — log ausente */ }
  }
  return win.__ctScriptLog;
}

// [R3-port] Injeção de script CLÁSSICO — replica um <script> inline da página
// original: top-level function declarations viram props de window (hoisting
// entre scripts) e let/const vão para o ambiente léxico global, onde são
// compartilhados entre os scripts e visíveis a onclick inline. Usado pelo
// runPageScripts no modo 'classic' (estande 2 do ladder) e disponível
// diretamente. Sem script inline executável (CSP), cai para window.eval —
// realm de eval NÃO compartilha let/const nem hoisting (degradação
// registrada; probe local detecta o ambiente uma vez).
function injectClassicScript(win, parentEl, code, label) {
  initScriptLog(win).push(label || 'script');
  if (win.__ctClassicProbe === undefined) {
    try {
      const probe = win.document.createElement('script');
      probe.setAttribute('data-ct-script', 'probe');
      probe.textContent = 'window.__ctClassicProbe = true;';
      parentEl.appendChild(probe);
    } catch (_) { /* ambiente hostil — segue para o fallback */ }
    if (win.__ctClassicProbe !== true) {
      try {
        console.warn('[track-oodeus-recon] script inline não executou (CSP?) — fallback window.eval em ' + (label || 'script') + ' (let/const do script não compartilham estado entre scripts/handlers inline)');
      } catch (_) {}
    }
  }
  if (win.__ctClassicProbe === true) {
    const el = win.document.createElement('script');
    el.setAttribute('data-ct-script', label || '');
    el.textContent = code;
    parentEl.appendChild(el); // execução síncrona, como <script> inline do original
    return true;
  }
  win.eval(code);
  return false;
}

// [R3-port] Mecanismo de execução da cadeia de scripts da página.
//
// Problema: um <script> clássico re-executado no MESMO window colide com as
// let/const top-level ("SyntaxError: Identifier 'modoAtivo' has already been
// declared") — no browser original cada navegação criava um realm novo, o
// plugin reusa o mesmo window por render. Solução (estande 1): envolver a
// cadeia inteira num `new win.Function(código)` — env léxico FRESCO por
// render, re-render seguro — com uma ponte mecânica de nomes para window:
//   - function declarations → props de window (como no original, onde o
//     hoisting de script clássico cria props de window); feita no TOPO do
//     wrapper (function declarations são içadas para o topo do corpo da
//     Function, então todos os nomes de função já existem) e SEMPRE como
//     accessor lazy [R17-B] — a cópia de valor congelava a v1 antes das
//     reatribuições top-level (abrirModalSimulado/salvarSimulado/render do
//     simulados) e o onclick inline abria o modal errado;
//   - let/const/var → accessors get/set em window (get/set via eval direto
//     dentro do closure do wrapper), para que onclick/oninput inline — que
//     só resolvem pelo objeto global — vejam e alterem o MESMO binding do
//     wrapper (body.html chama `materiasTemp=[]` inline).
//   Nomes extraídos por regex do código (superestimativa segura: nome não
//   resolvido no topo do wrapper → ReferenceError → pulado pelo try/catch).
// Ladder de fallback (probe uma vez por window, win.__ctScriptMode):
//   1. 'function' — new win.Function disponível (não bloqueado por CSP sem
//      unsafe-eval) → wrapper + ponte. Esperado no plugin e nos testes.
//   2. 'classic'  — <script> inline clássico por script (realm fiel, let/const
//      compartilhados, mas RE-RENDER da mesma página quebra com
//      SyntaxError — Design A: fechar/reabrir a view recarrega).
//   3. 'eval'     — window.eval por script (R2): function decls viram props
//      de window, mas let/const NÃO compartilham estado entre scripts nem
//      com handlers inline (degradação máxima, só sobrevive o fluxo básico).
const CT_GLOBAL_DENYLIST = new Set([
  'window', 'document', 'location', 'navigator', 'history', 'screen', 'console',
  'alert', 'confirm', 'prompt', 'eval', 'Function', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Date', 'Math', 'JSON', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'Reflect', 'Proxy', 'Intl', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity', 'setTimeout',
  'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'fetch', 'XMLHttpRequest', 'localStorage',
  'sessionStorage', 'addEventListener', 'removeEventListener',
  'dispatchEvent', 'FileReader', 'File', 'Blob', 'URL', 'URLSearchParams',
  'Image', 'Event', 'MouseEvent', 'CustomEvent', 'Node', 'Element',
  'HTMLElement', 'HTMLCanvasElement', 'performance', 'crypto', 'atob', 'btoa',
  'TextDecoder', 'TextEncoder', 'queueMicrotask', 'structuredClone',
]);

// Extrai nomes de declarações top-level (superestimativa: regex não distingue
// escopo — nomes que não existem no topo do wrapper falham no eval do bridge
// e são pulados). Captura `function Nome(`, `let/const/var Nome =`.
function extractTopLevelNames(code) {
  const funcs = [];
  const vars = [];
  const seen = new Set();
  const push = (arr, n) => {
    if (!seen.has(n) && !CT_GLOBAL_DENYLIST.has(n)) { seen.add(n); arr.push(n); }
  };
  const reF = /(?:^|[^.\w$])function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  const reV = /(?:^|[^.\w$])(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*(?:=[^=]|[;\r\n])/g;
  let m;
  while ((m = reF.exec(code))) push(funcs, m[1]);
  while ((m = reV.exec(code))) push(vars, m[1]);
  return { funcs, vars };
}

// Corpo do bridge: roda no TOPO do wrapper (funções já içadas; accessors são
// lazy — só tocam o binding quando um handler lê/ escreve).
//
// [R17-B] functions usam o MESMO accessor lazy dos let/const. A cópia eager
// anterior (`window[n] = eval(n)`) capturava a PRIMEIRA versão da função no
// topo do wrapper — ANTES das reatribuições top-level da cadeia
// (`abrirModalSimulado = function…`, `salvarSimulado = function…`,
// `render = function…` do simulados rodam DEPOIS do bridge) — então o
// onclick inline, que só resolve pelo objeto global, via a v1 curta
// ("Registre seu desempenho", 5120 chars) enquanto o binding local já era o
// v3 rico (TIPO/Tempo gasto/Modo de registro/Raio-x — probe r17a: modal
// pós-clique sem #simTipo/#simModoCalc). No original os scripts rodam no
// escopo global e a última atribuição vencia naturalmente. Para nomes
// superestimados pelo regex (funções ANINHADADAS — não existem no topo do
// wrapper) o `eval(k)` de teste no bridge-time lança e o getter nem é
// definido — igual à cópia eager, que os pulava — e evita lookup global →
// getter → recursão.
function buildBridgeCode(funcs, vars) {
  // [R17-B] Guard anti-recursão: um setter/getter só é reentrado quando o
  // identificador NÃO tem binding local e resolve a própria accessor no
  // global (vars superestimados — o TDZ impede o teste de existência). Em vez
  // de estourar a pilha (RangeError), o setter grava como data prop do
  // window — a mesma semântica do original, onde `window.k = v` é uma
  // escrita de propriedade — e o getter devolve undefined (igual ao catch).
  const lines = [';(function () {', 'var __ctSetBusy = {};', 'var __ctGetBusy = {};'];
  const defineAccessor = (k) =>
    'var __d = Object.getOwnPropertyDescriptor(window, ' + k + ');' +
    ' if (!__d || __d.configurable !== false) {' +
    ' Object.defineProperty(window, ' + k + ', {' +
    ' get: function () { if (__ctGetBusy[' + k + ']) return undefined; __ctGetBusy[' + k + '] = true; try { return eval(' + k + '); } catch (e) { return undefined; } finally { delete __ctGetBusy[' + k + ']; } },' +
    ' set: function (__v) { if (__ctSetBusy[' + k + ']) { Object.defineProperty(window, ' + k + ', { value: __v, writable: true, configurable: true, enumerable: true }); return; } __ctSetBusy[' + k + '] = true; try { eval(' + k + ' + " = __v"); } finally { delete __ctSetBusy[' + k + ']; } },' +
    ' configurable: true }); }';
  for (const n of funcs) {
    const k = JSON.stringify(n);
    // [R17-B] Só cria accessor se eval(k) resolve um valor DIFERENTE do que
    // já está em window — isto é, um binding LOCAL do wrapper (function
    // declaration hoisted). Nome sem declaração real no topo (superestimada
    // em comentário/string, ou valor deixado por uma render anterior — ex.:
    // openFreeTimerPreset, aninhada no timer-popup, cujo eval na 2ª render
    // resolvia a data prop do window) mantém a data prop do window, igual à
    // cópia eager antiga: sem accessor, `window.k = v` não passa pelo setter
    // e a recursão setter→eval→global→setter (RangeError no probe r16) fica
    // impossível. Para vars o teste é impossível (lets top-level estão em
    // TDZ no bridge-time) — aí vale o guard do __ctSetBusy abaixo.
    lines.push('try { var __fv = eval(' + k + '); if (__fv !== window[' + k + ']) { ' + defineAccessor(k) + ' } } catch (e) {}');
  }
  for (const n of vars) {
    const k = JSON.stringify(n);
    lines.push('try { ' + defineAccessor(k) + ' } catch (e) {}');
  }
  lines.push('})();');
  return lines.join('\n');
}

// Probe do ladder — uma única vez por window.
function scriptExecMode(win, parentEl) {
  if (win.__ctScriptMode) return win.__ctScriptMode;
  let mode = '';
  try {
    new win.Function('window.__ctFnProbe = true;')();
    if (win.__ctFnProbe === true) mode = 'function';
  } catch (_) { /* CSP sem unsafe-eval — estande 2 */ }
  if (!mode) {
    try {
      const probe = win.document.createElement('script');
      probe.setAttribute('data-ct-script', 'probe');
      probe.textContent = 'window.__ctClassicProbe = true;';
      (parentEl || win.document.head || win.document.documentElement).appendChild(probe);
    } catch (_) { /* segue para estande 3 */ }
    if (win.__ctClassicProbe === true) mode = 'classic';
  }
  if (!mode) mode = 'eval';
  try {
    if (mode === 'classic') {
      console.warn('[track-oodeus-recon] new Function indisponível (CSP sem unsafe-eval?) — scripts clássicos inline; RE-RENDER da mesma página vai colidir com let/const top-level (fechar/reabrir a view recarrega)');
    } else if (mode === 'eval') {
      console.warn('[track-oodeus-recon] nem new Function nem script inline executam (CSP?) — fallback window.eval por script (let/const NÃO compartilham estado entre scripts/handlers inline)');
    }
  } catch (_) {}
  win.__ctScriptMode = mode;
  return mode;
}

// [R3-port] Cadeia de scripts da página.
//   concursos:   body → dev_template_ia (lazy) → nav boot → script → DOMContentLoaded
//   cadastro:    body → nav boot → wrapper(Script1+Script2+Script3) → DOMContentLoaded
// DESVIO documentado (cadastro): o original intercala nav.js entre Script1 e
// Script2 (Script1 → data.js → nav.js → Script2 → Script3); com o wrapper
// único a intercalação é impossível, e o nav boot roda ANTES da cadeia.
// Verificado: nada nos scripts depende do nav no momento do parse (CT. só em
// funções disparadas por interação) e o nav não depende deles. data.js roda
// no onload do plugin (decisão R2). O DOMContentLoaded sintético por render
// replica o evento real do original (que dispara após o parse de todos os
// scripts do body) — no plugin o real já disparou (readyState 'complete');
// script2 de cadastro é 100% DOMContentLoaded-wrapped e morreria sem isso.
function runPageScripts(win, parentEl, page, { label = 'page', navBoot = null } = {}) {
  // [R16-4] Limpeza de listeners da render ANTERIOR. No original cada página
  // é um page load novo (listeners morrem no unload); no plugin o render é
  // in-place e os scripts re-executam a cada navegação — sem isto, cada
  // render acumulava +1 listener (click/keydown/ct-data-updated/storage/
  // ct-cycle-updated…) e handlers DCL de OUTRAS páginas re-disparavam: o
  // handler da aba (script2 L62) chamava goPage('dashboard.html') no dispatch
  // do dashboard → openPage mesmapágina → render síncrono → dispatch →
  // handler → … → stack overflow (probe r16o: RangeError ×49 em
  // _emitDataUpdated via flashcards boot; TypeError ×N em renderPainelProva
  // via timers live órfãos). Registrado em win.__ctPageListeners durante o
  // exec; removido aqui, ANTES do próximo exec. nav.js instala os listeners
  // globais no navBoot (ANTES da captura) e não é afetado (Adaptação #7).
  const prevListeners = win.__ctPageListeners || [];
  for (const rec of prevListeners) {
    try { rec.target.removeEventListener(rec.type, rec.fn, rec.opts); } catch (_) { /* noop */ }
  }
  win.__ctPageListeners = [];
  const scripts = page.scripts || [];
  if (!scripts.length) return;
  initScriptLog(win);
  if (typeof navBoot === 'function') navBoot();
  // [R16-4] Captura dos listeners desta cadeia. DCL vira one-shot: o wrapper
  // remove-se ANTES de invocar o handler (semântica do evento real do
  // original — dispara uma vez por page load; seguro até dispatch aninhado).
  // Demais document/window listeners ficam registrados para a limpeza do
  // próximo render. Wrapper instalado DEPOIS do navBoot de propósito.
  const origDocAdd = win.document.addEventListener.bind(win.document);
  const origDocRemove = win.document.removeEventListener.bind(win.document);
  const origWinAdd = win.addEventListener.bind(win);
  const isListener = (fn) => typeof fn === 'function' || (fn && typeof fn === 'object' && typeof fn.handleEvent === 'function');
  win.document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded' && isListener(fn)) {
      const wrapper = function (...args) {
        try { origDocRemove('DOMContentLoaded', wrapper, opts); } catch (_) { /* noop */ }
        return typeof fn === 'function' ? fn.apply(this, args) : fn.handleEvent.apply(fn, args);
      };
      const r = origDocAdd('DOMContentLoaded', wrapper, opts);
      win.__ctPageListeners.push({ target: win.document, type, fn: wrapper, opts });
      return r;
    }
    const r = origDocAdd(type, fn, opts);
    if (isListener(fn)) win.__ctPageListeners.push({ target: win.document, type, fn, opts });
    return r;
  };
  win.addEventListener = function (type, fn, opts) {
    const r = origWinAdd(type, fn, opts);
    if (isListener(fn)) win.__ctPageListeners.push({ target: win, type, fn, opts });
    return r;
  };
  try {
    const mode = scriptExecMode(win, parentEl);
    if (mode === 'function') {
      const { funcs, vars } = extractTopLevelNames(scripts.join('\n;\n'));
      const chunks = scripts.map((code, i) =>
        'window.__ctScriptLog && window.__ctScriptLog.push(' +
        JSON.stringify(label + '-script-' + (i + 1)) + ');\n' + code);
      const body = buildBridgeCode(funcs, vars) + '\n' + chunks.join('\n;\n');
      new win.Function(body)();
    } else if (mode === 'classic') {
      scripts.forEach((code, i) => {
        injectClassicScript(win, parentEl, code, label + '-script-' + (i + 1));
      });
    } else {
      scripts.forEach((code, i) => {
        initScriptLog(win).push(label + '-script-' + (i + 1));
        win.eval(code);
      });
    }
    win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
  } finally {
    win.document.addEventListener = origDocAdd;
    win.addEventListener = origWinAdd;
  }
}

module.exports = {
  PAGE_BODY_CLASS,
  assetUrlOf,
  assetBaseOf,
  scopeBodySelectors,
  PLATFORM_NEUTRALIZE_CSS,
  rewriteThemeAssetUrls,
  rewriteBodyAssetSrc,
  rewritePageCssAssetUrls,
  rewriteViewportHeightUnits,
  injectClassicScript,
  runPageScripts,
};
