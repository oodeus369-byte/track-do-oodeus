/**
 * Track do Oodeus — main.js [R0+R1+R2+R3+R4+R9]
 * Ciclo do plugin: carrega o data.json, inicia a ponte (__CT_HOST__) ANTES do
 * núcleo de dados rodar, e então executa os módulos globais na MESMA ordem de
 * carregamento do original (comportamento — documento-mestre §1.6):
 *   theme.js (antes de tudo: evita flash de tema) → data.js → [nav]
 *
 * R2: cada página do app original vira uma ItemView (src/shell.js). O nav.js
 * NÃO roda boot no onload (flag __CT_SHELL__): o boot dele acontece POR RENDER
 * da view, via window.__CT_NAV_BOOT — análogo ao load de cada página original.
 * A página de concursos replica a ordem real de concursos.html:
 *   style inline → theme.css → body → dev_template_ia.js → nav.js → script
 * (data.js já rodou no onload, antes do body existir; não toca DOM no boot).
 */
const { Plugin, Notice } = require('obsidian');
const { initHost } = require('./src/host');
const { VIEW_TYPE, PAGES, TrackPageView } = require('./src/shell');
// [R28] Assets embutidos: o BRAT instala só main.js + manifest.json, sem a
// pasta assets/. Resolver por aqui primeiro mantém todas as imagens funcionando
// em qualquer cofre; o caminho do vault continua como fallback.
const EMBEDDED_ASSETS = require('./src/assets-embedded');
const { VaultNoteModal } = require('./src/vault-notes');

module.exports = class TrackOodeusPlugin extends Plugin {
  async onload() {
    const data = (await this.loadData()) || {};
    this.activeTrackView = null;
    this.currentPageName = '';
    this.pendingPageName = '';
    this.pendingPageSearch = '';
    this.pendingPageHash = '';

    initHost({
      data,
      persist: (d) => this.saveData(d),
      window,
      // [R2] Navegação entre páginas: troca de view. Nunca deixar o renderer
      // navegar de URL (páginas ainda não portadas viram aviso no console,
      // como decisão da R1).
      navigate: (dest) => this.navigateTo(dest),
      // [R2] Página corrente: a view ativa; '' → fallback 'concursos.html'.
      currentPage: () => this.activeTrackView ? this.activeTrackView.page : '',
      // [R1] Base dos assets de ícones dentro do plugin instalado.
      assetBase: () => this.assetPath('assets/remix-nav/'),
      // [R2] URL utilizável de qualquer asset relativo à raiz do app original.
      assetUrl: (rel) => this.assetPath(rel),
      // [R4] Ponte do tipo NOTA "Anotações" (adição Oodeus): lista/seletor
      // fuzzy/abertura interna de notas do vault via workspace.openLinkText.
      listVaultNotes: () => this.app.vault.getMarkdownFiles().map(f => f.path),
      pickVaultNote: (cb) => new VaultNoteModal(this.app, cb).open(),
      // [R24] Abrir NOTA/wikilink: resolver para um arquivo EXISTENTE antes.
      // `openLinkText(texto, '', true)` cria uma nota nova quando o link não
      // resolve — era o que acontecia ao clicar no material (o Oodeus via
      // "abriu outra nota, não a minha"). getFirstLinkpathDest resolve links
      // do Obsidian; getAbstractFileByPath cobre caminho completo. Se não
      // existir, avisa em vez de criar.
      openVaultNote: (path) => {
        let p = String(path || '').trim().replace(/^\[\[|\]\]$/g, '').replace(/\.md$/i, '').trim();
        if (!p) return;
        const app = this.app;
        const active = app.workspace.getActiveFile && app.workspace.getActiveFile();
        const source = active ? active.path : '';
        let file = null;
        try {
          if (app.metadataCache && typeof app.metadataCache.getFirstLinkpathDest === 'function') {
            file = app.metadataCache.getFirstLinkpathDest(p, source);
          }
          if (!file && app.vault && typeof app.vault.getAbstractFileByPath === 'function') {
            file = app.vault.getAbstractFileByPath(p.endsWith('.md') ? p : p + '.md');
          }
        } catch (_) { /* vault em migração — cai no aviso */ }
        if (file) {
          app.workspace.getLeaf(true).openFile(file);
          return;
        }
        new Notice('Nota do vault não encontrada: ' + p);
      },
    });

    // [R2] flag para o nav.js: não dar boot no onload (sem DOM de página);
    // o shell chama __CT_NAV_BOOT por render.
    window.__CT_SHELL__ = true;

    require('./src/theme');
    // Núcleo de dados (CT). Expõe window.CT e window.CTi.
    require('./src/data');
    // nav.js: IIFE define as funções; boot fica para o render da view.
    require('./src/nav');

    this.registerView(VIEW_TYPE, (leaf) => new TrackPageView(leaf, this));

    this.addRibbonIcon('rocket', 'Track do Oodeus', () => {
      this.openPage('concursos.html');
    });
    this.addCommand({
      id: 'abrir-track',
      name: 'Abrir Track',
      callback: () => this.openPage('concursos.html'),
    });
  }

  onunload() {
    // styles injetados pelo shell não devem sobreviver ao plugin
    document.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
    // [R20] o cronômetro flutuante é criado em document.body — matar a instância
    // e remover os nós evita que ele continue no Obsidian após desativar o plugin.
    if (typeof window.__ctTimerPopupTeardown === 'function') {
      try { window.__ctTimerPopupTeardown(); } catch (_) { /* noop */ }
    }
    document.querySelectorAll('#timerFab, #timerPopup, #timerOverlay, style[data-ct-timer-popup]')
      .forEach(n => n.remove());
  }

  assetPath(rel) {
    if (!rel) return '';
    const key = String(rel).replace(/^\//, '').replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(EMBEDDED_ASSETS, key)) return EMBEDDED_ASSETS[key];
    return this.app.vault.adapter.getResourcePath(`${this.manifest.dir}/${key}`);
  }

  // [R2] goPage dest → página. Página corrente = re-render (mimética do reload
  // do original). Outra página portada = troca de view. Não portada = aviso
  // (o host assume a navegação e não faz nada — nunca navegar de URL).
  // [R3] A query (ex.: '?editar=ID&finalizar=1') vai para pendingPageSearch —
  // o shell a expõe ao script da página como window.__CT_PAGE_SEARCH__
  // (seam do location.search; a "URL corrente" da página no plugin).
  // [R9] O hash (ex.: '#flashcards:<deckId>' — syncDeckToTopic do flashcards
  // gera 'dashboard.html#flashcards:<deckId>') NÃO é mais descartado: vai para
  // pendingPageHash — o shell o expõe como window.__CT_PAGE_HASH__ (seam do
  // location.hash; o mini-script anti-flash do dashboard e o boot do
  // flashcards o consomem).
  navigateTo(dest) {
    const raw = String(dest || '');
    const hIdx = raw.indexOf('#');
    const hash = hIdx === -1 ? '' : raw.slice(hIdx);
    const noHash = hIdx === -1 ? raw : raw.slice(0, hIdx);
    const qIdx = noHash.indexOf('?');
    this.pendingPageSearch = qIdx === -1 ? '' : noHash.slice(qIdx);
    const name = qIdx === -1 ? noHash : noHash.slice(0, qIdx);
    this.pendingPageHash = hash;
    if (!PAGES[name]) {
      console.warn('[track-oodeus-recon] página ainda não portada: ' + raw);
      return true;
    }
    this.openPage(name);
    return true;
  }

  async openPage(name) {
    if (!PAGES[name]) return;
    // leaf existente com a view do Track: reusa e troca de página (re-render
    // se for a mesma página — mimética do reload do original).
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length) {
      const leaf = leaves[0];
      const view = leaf.view;
      if (view && view.page === name) {
        this.pendingPageName = '';
        view.renderPage();
      } else {
        this.pendingPageName = name;
        await leaf.setViewState({ type: VIEW_TYPE, state: { page: name }, active: true });
      }
      this.app.workspace.revealLeaf(leaf);
      return;
    }
    const leaf = this.app.workspace.getLeaf('tab');
    this.pendingPageName = name;
    await leaf.setViewState({ type: VIEW_TYPE, state: { page: name }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
};
