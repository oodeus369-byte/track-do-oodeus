/**
 * Track do Oodeus — shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]
 * Shell de views: cada página do app original vira uma ItemView do Obsidian.
 *
 * Reproduz a ordem de carregamento das páginas (documento-mestre §1.6;
 * etapa-05 §1/§2), que no original era:
 *   concursos.html: theme.js (head) → style inline → theme.css → body →
 *                   data.js → dev_template_ia.js → nav.js → script principal
 *   cadastro_edital.html: theme.js → style inline → theme.css → body →
 *                   Script1 → data.js → nav.js → Script2 → Script3 →
 *                   DOMContentLoaded
 * No plugin:
 *   theme.js + data.js rodam no onload (main.js), ANTES de qualquer view —
 *   data.js não toca DOM no boot; theme.js só aplica data-theme no <html>.
 *   Por render da view, nesta ordem:
 *     1. styles antigos da página removidos → style inline da página injetado
 *        → theme.css injetado DEPOIS (padrão anômalo real: theme.css vence a
 *        cascata — documentado no relatório R1 §4)
 *     2. body injetado (com reescrita de src="assets/…")
 *     3. módulos lazy da página (dev_template_ia só em concursos)
 *     4. cadeia de scripts da página via runPageScripts (render-util):
 *        wrapper `new Function` com env léxico FRESCO por render (re-render
 *        seguro) + ponte mecânica de nomes para window (funções como props,
 *        let/const como accessors — onclick inline vê o binding do wrapper),
 *        nav boot ANTES da cadeia, e o evento DOMContentLoaded sintético por
 *        render (no original ele dispara após o parse de todos os scripts; o
 *        real do plugin já disparou). Ladder: Function → script clássico →
 *        window.eval (degradações registradas em render-util).
 *
 * Reescritas de plataforma (adaptações documentadas):
 *   - CSS: seletores `html, body`/`body` → `.ct-page-body` (o "body" da página
 *     é o contentEl da view; sem isso as regras de fundo vazariam para o app
 *     inteiro). `:root` permanece global (mesmo risco aceito no R1).
 *   - CSS: `url("assets/…")` → assetUrl (máscaras remix-nav do theme.css e
 *     remix-wizard do cadastro).
 *   - HTML: `src="assets/…"` → assetUrl (resolvedor global do host).
 *   - CSS: unidades de altura de viewport (`100vh`/`100dvh`…) →
 *     `calc(var(--ct-vh,1vh)*N)` — a view do plugin não é a janela (R17-C;
 *     --ct-vh medido da leaf em _syncViewVh).
 *   - Query da navegação: `window.__CT_PAGE_SEARCH__` substitui
 *     `window.location.search` no script da página (R3).
 * Sem os seams (ex.: testes em browser puro), os caminhos literais do original
 * são mantidos.
 */
const { ItemView } = require('obsidian');
const {
  PAGE_BODY_CLASS,
  scopeBodySelectors,
  PLATFORM_NEUTRALIZE_CSS,
  rewriteThemeAssetUrls,
  rewriteBodyAssetSrc,
  rewritePageCssAssetUrls,
  rewriteViewportHeightUnits,
  runPageScripts,
} = require('./render-util');
// [R19] Adaptação mobile: drawer da sidebar + botão ☰. Injeta um <style> próprio
// DEPOIS do theme.css (para vencer as regras fixed/margin-left das páginas) e
// reaplica o estado do botão a cada render (o contentEl é esvaziado).
const { MOBILE_CSS, initSidebarToggle } = require('./mobile');

// Assets textuais da página (bundle: loaders .css/.html/.pagejs = text).
const THEME_CSS = require('./theme.css');

// Mapa de páginas portadas. R2: concursos.html; R3: cadastro_edital.html
// (etapa-05 §2 — scripts 1/2/3 na ordem original dentro do wrapper; nav boot
// ANTES da cadeia — desvio documentado no render-util.runPageScripts).
const PAGES = {
  'concursos.html': {
    title: 'Meus Concursos',
    icon: 'rocket',
    style: require('../pages/concursos/style.css'),
    body: require('../pages/concursos/body.html'),
    scripts: [require('../pages/concursos/main.pagejs')],
    lazyModules: ['dev_template_ia'],
  },
  'cadastro_edital.html': {
    title: 'Cadastrar Concurso',
    icon: 'file-plus-2',
    style: require('../pages/cadastro/style.css'),
    body: require('../pages/cadastro/body.html'),
    scripts: [
      require('../pages/cadastro/script1.pagejs'),
      require('../pages/cadastro/script2.pagejs'),
      require('../pages/cadastro/script3.pagejs'),
    ],
    lazyModules: [],
  },
  // R4: aba_materia.html (etapa-06). Ordem idêntica ao original: body →
  // data.js → nav.js → Script1 (IIFE sidebar) → Script2 (principal) →
  // timer-popup.js. No plugin: data.js no onload; nav boot antes da cadeia
  // (sem desvio — nav.js também é antes do Script1 no original);
  // timer-popup.js é a R5 — terceiro script do wrapper, como o <script src>.
  'aba_materia.html': {
    title: 'Matéria',
    icon: 'book-2',
    style: require('../pages/aba-materia/style.css'),
    body: require('../pages/aba-materia/body.html'),
    scripts: [
      require('../pages/aba-materia/script1.pagejs'),
      require('../pages/aba-materia/script2.pagejs'),
      // R5: timer-popup.js roda DEPOIS do Script2, como o <script src> 3800 do
      // original (etapa-07 §1.1). IIFE — sem colisão lexical no wrapper.
      require('../pages/timer/timer-popup.pagejs'),
    ],
    lazyModules: [],
  },
  // R7: cronograma_inteligente.html (etapa-09). Ordem do original: body →
  // data.js (971) → script inline principal (972-4337, clássico top-level
  // sem IIFE; boot síncrono no fim: config = loadConfig(); render();) →
  // crono-cycle.js (4338) → nav.js (4339). No plugin: data.js no onload;
  // nav boot ANTES da cadeia (desvio documentado no render-util R3);
  // cadeia = [CI main, crono-cycle]. O CI NÃO carrega timer-popup.js (o
  // original também não — openCycleTimer sai cedo sem #timerPopup);
  // initDashboard do crono-cycle sai cedo sem #cronoGrid (inerte no CI).
  'cronograma_inteligente.html': {
    title: 'Cronograma Inteligente',
    icon: 'compass-3',
    style: require('../pages/crono-inteligente/style.css'),
    body: require('../pages/crono-inteligente/body.html'),
    scripts: [
      require('../pages/crono-inteligente/main.pagejs'),
      require('../pages/crono/crono-cycle.pagejs'),
    ],
    lazyModules: [],
  },
  // R9: dashboard.html (etapa-04) — a página mais complexa do app. Ordem do
  // original: theme.js (7) → Chart.js 4.4.1 CDN (9) → data.js (10) →
  // mini-script anti-flash (11-19) → Inter (20) → <style> (21-1981) →
  // theme.css (1982, DEPOIS do inline) → body (1985) → timer-popup.js (2335)
  // → nav.js (2336) → flashcards.js (2337) → script principal (2338) →
  // crono-cycle.js (5346, POR ÚLTIMO — pacto etapa-04 §11: wrap de
  // window.renderCrono com _patched + substituição de abrirModalCrono;
  // modos visuais por data-dashboard-mode; o renderCrono weekly do dashboard
  // sobrevive como base/fallback). No plugin: theme.js/data.js no onload;
  // nav boot ANTES da cadeia (desvio R3); theme.css depois do style inline
  // (padrão anômalo real, R1); Chart.js VENDORED (doc-mestre 39: bundled no
  // plugin, versão exata — sem rede); o mini-script anti-flash roda por
  // render (2º da cadeia, síncrono — sem paint entre o body e a cadeia) com
  // seam __CT_PAGE_HASH__; flashcards.pagejs carrega na cadeia (o original
  // carrega flashcards.js no dashboard) com adaptação única [R9-port] de
  // hash (leitura via __CT_PAGE_HASH__).
  'dashboard.html': {
    title: 'Dashboard',
    icon: 'layout-dashboard',
    style: require('../pages/dashboard/style.css'),
    body: require('../pages/dashboard/body.html'),
    scripts: [
      require('../vendor/chart.umd.pagejs'),
      require('../pages/dashboard/antiflash.pagejs'),
      require('../pages/timer/timer-popup.pagejs'),
      require('../pages/flashcards/flashcards.pagejs'),
      require('../pages/dashboard/main.pagejs'),
      require('../pages/crono/crono-cycle.pagejs'),
    ],
    lazyModules: [],
  },
  // R10: revisoes.html (etapa-13 §2). Ordem do original: theme.js (6) →
  // style inline 9-182 → theme.css (183) → body 185-325 → data.js (326) →
  // IIFE sidebar (327-383) → script principal (384-823) → nav.js (827) →
  // timer-popup.js (828). No plugin: theme.js/data.js no onload; nav boot
  // ANTES da cadeia (desvio R3 — no original nav.js é DEPOIS do script
  // principal); cadeia = [IIFE sidebar, principal, timer-popup.pagejs] — o
  // timer-popup entra por último como o <script src> 828, e o
  // iniciarCronometroRevisao cobre o timing com retry de 60ms (verbatim,
  // 419-443). Sem D1-D12 (doc-mestre R10: dead code verbatim; duplicação
  // badge/concurso-nome/banca IIFE×render() replicada). Foco ?revisaoId= via
  // __CT_PAGE_SEARCH__ (seam 566, padrão aba-materia).
  'revisoes.html': {
    title: 'Revisões',
    icon: 'check-check',
    style: require('../pages/revisoes/style.css'),
    body: require('../pages/revisoes/body.html'),
    scripts: [
      require('../pages/revisoes/script1.pagejs'),
      require('../pages/revisoes/main.pagejs'),
      require('../pages/timer/timer-popup.pagejs'),
    ],
    lazyModules: [],
  },
  // R11: historico.html (etapa-12) — página "Métricas". Ordem do original:
  // theme.js (6) → Inter (8) → Chart.js 4.4.1 CDN (9) → html2canvas 1.4.1
  // CDN (10) → style inline 12-332 → theme.css (334) → body 337-463 →
  // data.js (465) → IIFE sidebar (467-518) → script principal (520-1954) →
  // nav.js (1958) → timer-popup.js (1959). No plugin: theme.js/data.js no
  // onload; nav boot ANTES da cadeia (desvio R3); Chart.js vendored (R9) e
  // html2canvas vendored (R11 — pendência herdada do R9 fechada: o original
  // só usa html2canvas nos cards PRINT desta página e dos simulados);
  // cadeia = [chart.umd, html2canvas, IIFE sidebar, principal,
  // timer-popup.pagejs] — timer-popup por último como o <script src> 1959.
  // Semântica assimétrica viva replicada (janela afeta heatmap/análise/
  // lblHoras; stats globais e pizza sempre globais; Estudos do dia = hoje);
  // dead codes D1-D8 verbatim (doc-mestre: conferir que nada vivo sumiu).
  'historico.html': {
    title: 'Métricas',
    icon: 'bar-chart-3',
    style: require('../pages/historico/style.css'),
    body: require('../pages/historico/body.html'),
    scripts: [
      require('../vendor/chart.umd.pagejs'),
      require('../vendor/html2canvas.pagejs'),
      require('../pages/historico/script1.pagejs'),
      require('../pages/historico/main.pagejs'),
      require('../pages/timer/timer-popup.pagejs'),
    ],
    lazyModules: [],
  },
  // R12: simulados.html (etapa-11) — página de simulados por concurso. Ordem
  // do original: theme.js (6) → Inter (8) → Chart.js 4.4.1 CDN (9, ÚNICA CDN
  // — SEM html2canvas nesta página) → style inline (10-226) → theme.css (227)
  // → body (230-326) → data.js (328) → IIFE sidebar (329-382) → script
  // principal (383-3716) → nav.js (3720) → timer-popup.js (3721). No plugin:
  // theme.js/data.js no onload; nav boot ANTES da cadeia (desvio R3);
  // cadeia = [chart.umd, IIFE sidebar, principal, timer-popup.pagejs] —
  // timer-popup por último como o <script src> 3721. Chart.js vendored (R9).
  // Decisões do Oodeus (etapa-11 §7): gráfico de evolução com DESIGN
  // LOLLIPOP adaptado (substitui o gráfico de barras vivo); formatPoints →
  // formatPointsPt em todos os usos vivos (unificação em vírgula); patch do
  // card de corte pós-innerHTML verbatim. Dead code D1-D15 verbatim
  // (doc-mestre: conferir que nada vivo sumiu).
  'simulados.html': {
    title: 'Simulados',
    icon: 'clipboard-list',
    style: require('../pages/simulados/style.css'),
    body: require('../pages/simulados/body.html'),
    scripts: [
      require('../vendor/chart.umd.pagejs'),
      require('../pages/simulados/script1.pagejs'),
      require('../pages/simulados/main.pagejs'),
      require('../pages/timer/timer-popup.pagejs'),
    ],
    lazyModules: [],
  },
  // R13: editais_premium.html (etapa-13 §3) — loja de Editais Premium. Ordem
  // do original: theme.js (7) → Inter (8) → style inline (9-173) → theme.css
  // (174) → body (176-324) → data.js (326) → nav.js (327, ANTES do script
  // principal — único layout invertido da auditoria) → script principal
  // (328-1539). Página STANDALONE (§1): sem sidebar, sem guard de concurso,
  // SEM timer-popup.js. No plugin: theme/data no onload; nav boot ANTES da
  // cadeia (desvio R3 — nav.js já era antes do script no original; DOM sem
  // data-nav-icon: nav boot inerte, §3.3); cadeia = [main] apenas. Seams:
  // 4× location.href → goPage no body (logo/Voltar/successBar/modal) + goPage
  // local no topo do main para os onclick; window.open externo (1083),
  // pywebview selecionar_arquivo_json (1426) e history API dos modais
  // (1042-1074) verbatim (precedente R6/R7/R9, §6.2/§6.3). Sem dead code
  // (§3.4); teatro de instalação (wait 180/320/180/620/700), refresh 00:05 e
  // mojibake mÃ©dio/estratgia verbatim (§6.3). Boot1536-1538 verbatim.
  'editais_premium.html': {
    title: 'Editais Premium',
    icon: 'store',
    style: require('../pages/editais_premium/style.css'),
    body: require('../pages/editais_premium/body.html'),
    scripts: [require('../pages/editais_premium/main.pagejs')],
    lazyModules: [],
  },
  // R13: ajuda.html (etapa-13 §4) — Ajuda & Contato. Ordem do original:
  // theme.js (6) → Inter (8) → style inline (9-479) → theme.css (480) → body
  // (482-605, com a tag cloudflare D4 verbatim e o data.js na MESMA linha
  // 605 — removido do body: data.js roda no onload) → data.js (605) → nav.js
  // (606) → BLOCO ÚNICO <script> (607-927): principal (608-874) e DEPOIS a
  // IIFE sidebar (875-926) → timer-popup.js (928, última linha — o original
  // não fecha </body>/</html>). Sem guard de concurso (§4.1 — funciona sem
  // concurso, sidebar mostra "—"). No plugin: theme/data no onload; nav boot
  // ANTES da cadeia (desvio R3); cadeia = [main, script1, timer-popup] —
  // ORDEM DO ORIGINAL (o plano prévio da rodada tinha [script1, main]
  // invertido; ordem de carregamento é comportamento). Seams: 9× location.href
  // → goPage no body (logo + 7 nav-items; flashcards 494 mantém o
  // sessionStorage e navega dashboard.html#flashcards) + goPage local no topo
  // do main. pywebview open_external_url (675), window.open externo (682/788)
  // e new Function dos guias (867) com caminho file:/// hardcoded verbatim
  // (§6.1). Dead code D1-D3 no style, D4 no body (§4.2, verbatim).
  'ajuda.html': {
    title: 'Ajuda',
    icon: 'help-circle',
    style: require('../pages/ajuda/style.css'),
    body: require('../pages/ajuda/body.html'),
    scripts: [
      require('../pages/ajuda/main.pagejs'),
      require('../pages/ajuda/script1.pagejs'),
      require('../pages/timer/timer-popup.pagejs'),
    ],
    lazyModules: [],
  },
};

// Módulos lazy por página (só executam quando a página renderiza — no original,
// cada script só existia na página que o referenciava).
const LAZY_MODULES = {
  dev_template_ia: () => require('./dev_template_ia'),
};

const VIEW_TYPE = 'track-page-view';

class TrackPageView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.page = plugin.pendingPageName || 'concursos.html';
    this._opened = false;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return (PAGES[this.page] || {}).title || 'Track'; }
  getIcon() { return (PAGES[this.page] || {}).icon || 'rocket'; }

  // Estado do leaf: a página persistida no workspace restaura a view certa.
  getState() { return { page: this.page }; }

  async setState(state) {
    const p = state && PAGES[state.page] ? state.page : null;
    if (!p) return;
    this.page = p;
    if (this._opened) this.renderPage();
  }

  async onOpen() {
    this._opened = true;
    this.renderPage();
  }

  onClose() {
    if (this._vhRO) { try { this._vhRO.disconnect(); } catch (_) { /* noop */ } this._vhRO = null; }
    // [R20] FAB/painel/CSS vivem no document.body/head — sem isto o relógio
    // ficava órfão no Obsidian quando a view fechava (só saía reiniciando).
    if (typeof window.__ctTimerPopupTeardown === 'function') {
      try { window.__ctTimerPopupTeardown(); } catch (_) { /* noop */ }
    }
    document.querySelectorAll('#timerFab, #timerPopup, #timerOverlay, style[data-ct-timer-popup]')
      .forEach(n => n.remove());
    if (this.plugin.activeTrackView === this) this.plugin.activeTrackView = null;
  }

  // [R17-C] --ct-vh = 1vh da VIEW (não da janela). O rewrite do shell
  // transforma todo Nvh do CSS injetado em calc(var(--ct-vh,1vh)*N); sem
  // isto, 100vh = janela inteira e a view — que começa abaixo do chrome do
  // Obsidian (71px no probe r17a) — estourava a leaf: as últimas 71px do
  // rodapé ficavam fora da área visível e inalcançáveis. Mede
  // leaf.bottom − content.top (correto também em split, onde a leaf não
  // vai até o fim da janela) e acompanha por ResizeObserver. Fallback do
  // rewrite é 1vh (janela): fora do contentEl — modais/toasts em
  // document.body — o comportamento continua o do original.
  _syncViewVh(content) {
    if (this._vhRO) { try { this._vhRO.disconnect(); } catch (_) { /* noop */ } this._vhRO = null; }
    const doc = content.ownerDocument || document;
    const win = doc.defaultView || window;
    const leafEl = content.closest('.workspace-leaf-content') || content.parentElement;
    const apply = () => {
      try {
        const r = content.getBoundingClientRect();
        const lr = leafEl && leafEl.getBoundingClientRect();
        const bottom = lr && lr.bottom > 0 ? lr.bottom : (win && win.innerHeight ? win.innerHeight : 0);
        const h = bottom - r.top;
        if (h > 0) content.style.setProperty('--ct-vh', (h / 100).toFixed(4) + 'px');
      } catch (_) { /* medição indisponível — fallback 1vh do rewrite */ }
    };
    apply();
    const RO = (win && win.ResizeObserver) || (typeof ResizeObserver !== 'undefined' ? ResizeObserver : null);
    if (RO && leafEl) {
      this._vhRO = new RO(apply);
      this._vhRO.observe(leafEl);
    }
  }

  renderPage() {
    const page = PAGES[this.page];
    if (!page) return;
    this.plugin.activeTrackView = this;
    this.plugin.currentPageName = this.page;
    // [R3] Query da navegação (ex.: '?editar=ID&finalizar=1') visível ao
    // script da página via window.__CT_PAGE_SEARCH__ (seam do location.search).
    window.__CT_PAGE_SEARCH__ = typeof this.plugin.pendingPageSearch === 'string' ? this.plugin.pendingPageSearch : '';
    // [R9] Hash da navegação (ex.: '#flashcards:<deckId>') visível ao script
    // da página via window.__CT_PAGE_HASH__ (seam do location.hash — no plugin
    // o location é do app Obsidian, não da página).
    window.__CT_PAGE_HASH__ = typeof this.plugin.pendingPageHash === 'string' ? this.plugin.pendingPageHash : '';
    this.appOodeusRender(page);
  }

  appOodeusRender(page) {
    // ── 1. CSS: remove os styles da renderização anterior e injeta na ordem
    // do <head> original (style inline da página → theme.css) ──
    document.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
    // [R16] Leftovers do body criados pelos scripts de página: o FAB/popup do
    // timer e o <style> deles vivem FORA do contentEl (document.body/head) e,
    // no original, morriam a cada navegação (location.href zera o DOM). Sem
    // isto, sair de uma tela de estudo deixava FAB/popup órfãos nas demais
    // (bug R16-1); nas telas de estudo o timer-popup recria os seus na hora.
    document.querySelectorAll('#timerFab, #timerPopup, #timerOverlay, style[data-ct-timer-popup]')
      .forEach(n => n.remove());

    const pageStyleEl = document.createElement('style');
    pageStyleEl.setAttribute('data-ct-style', 'page');
    // Neutralizador de colisão com o app.css do Obsidian (`.empty-state` do
    // platform cobria a página e engolia os cliques) vai ANTES do CSS da
    // página, no mesmo <style>: regras são mais específicas (0,2,0 vs
    // 0,1,0), então a ordem interna não importa para a cascata — ver
    // render-util.PLATFORM_NEUTRALIZE_CSS (probe CDP 2026-11-22 comprovou).
    pageStyleEl.textContent = PLATFORM_NEUTRALIZE_CSS + rewriteViewportHeightUnits(scopeBodySelectors(rewritePageCssAssetUrls(page.style)));
    document.head.appendChild(pageStyleEl);

    const themeStyleEl = document.createElement('style');
    themeStyleEl.setAttribute('data-ct-style', 'theme');
    themeStyleEl.textContent = rewriteViewportHeightUnits(rewriteThemeAssetUrls(scopeBodySelectors(THEME_CSS)));
    document.head.appendChild(themeStyleEl);

    // ── 2. body: injeta o markup da página com src="assets/…" reescrito ──
    const content = this.contentEl;
    content.empty();
    content.addClass(PAGE_BODY_CLASS);
    // [R17-C] publica 1vh da VIEW em --ct-vh (o rewrite acima usa
    // var(--ct-vh,1vh)) — ver _syncViewVh.
    this._syncViewVh(content);
    content.innerHTML = rewriteBodyAssetSrc(page.body);

    // [R19] CSS mobile DEPOIS do theme.css (precisa vencer `.sidebar{position:fixed}`
    // e `.main{margin-left:220px}` das páginas) + botão/scrim do drawer. Como o
    // contentEl é esvaziado no início do render, ambos são recriados aqui.
    const mobileStyleEl = document.createElement('style');
    mobileStyleEl.setAttribute('data-ct-style', 'mobile');
    mobileStyleEl.textContent = MOBILE_CSS;
    document.head.appendChild(mobileStyleEl);
    initSidebarToggle(content, this.plugin);

    // ── 3. módulos lazy da página (original: cada <script src> só na página) ──
    for (const name of page.lazyModules || []) {
      const req = LAZY_MODULES[name];
      if (req) req();
    }

    // ── 4+5. cadeia de scripts: wrapper Function (env fresco por render +
    // ponte de nomes p/ window), nav boot ANTES da cadeia e DOMContentLoaded
    // sintético por render (ver render-util.runPageScripts) ──
    runPageScripts(window, content, page, {
      label: this.page,
      navBoot: () => {
        if (typeof window.__CT_NAV_BOOT === 'function') window.__CT_NAV_BOOT();
      },
    });
  }
}

module.exports = {
  VIEW_TYPE,
  PAGES,
  TrackPageView,
};
