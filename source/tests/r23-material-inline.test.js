/**
 * Track do Oodeus — testes R23 (botão "+" de material e link [[ no modal)
 * Reproduz o fluxo REAL pelo onclick inline (não chamada direta à função):
 *   + do tópico -> modal "Material de estudo" -> Anotações -> nota do vault
 *   -> Adicionar -> material gravado no tópico.
 * E o novo comportamento pedido: digitar `[[` no campo Link abre sugestões
 * fuzzy das notas do vault; escolher uma insere o wikilink `[[Nota]]`.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const vm = require('vm');
const { initHost } = require('../src/host');
const {
  PAGE_BODY_CLASS, scopeBodySelectors, rewriteThemeAssetUrls,
  rewriteBodyAssetSrc, rewritePageCssAssetUrls, runPageScripts,
} = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const abaPage = {
  scripts: [read('pages/aba-materia/script1.pagejs'), read('pages/aba-materia/script2.pagejs')],
  lazyModules: [],
};
const script2Src = abaPage.scripts[1];
const mainSrc = read('main.js');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function vmRun(w, src, file) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename: file || 'script.js' });
}
function boot() {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously',
  });
  const w = j.window;
  w.__ctDclListeners = [];
  const orig = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') w.__ctDclListeners.push(fn);
    return orig(type, fn, opts);
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  global.window = w;
  const vaultNotes = ['Projetos/Nota Guia.md', 'Concursos/Foco/cronograma-estudo.md', 'raiz.md'];
  const openedNotes = [];
  let pending = null;
  initHost({
    data: {}, persist: () => true, window: w,
    navigate: () => true, currentPage: () => '',
    assetBase: () => 'app://plugin/assets/remix-nav/', assetUrl: (r) => 'app://plugin/' + r,
    listVaultNotes: () => vaultNotes.slice(),
    pickVaultNote: (cb) => { pending = cb; },
    openVaultNote: (p) => { openedNotes.push(p); },
  });
  w.__testVaultPick = (p) => { const cb = pending; pending = null; if (cb) cb(p); };
  w.__CT_SHELL__ = true;
  vmRun(w, read('src/theme.js'), 'theme.js');
  vmRun(w, read('src/data.js'), 'data.js');
  vmRun(w, read('src/nav.js'), 'nav.js');
  const c = w.CT.saveConcurso({ nome: 'R23', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  w.CT.saveMateria({ concursoId: c.id || c, nome: 'Português' });
  w.sessionStorage.setItem('ct_concurso_ativo', c.id || c);
  w.sessionStorage.setItem('ct_materia_ativa', w.CT.getMaterias()[0].id);
  const t1 = w.CT.saveTopico({ concursoId: c.id || c, materiaId: w.CT.getMaterias()[0].id, nome: 'Concordância' });

  const head = w.document.head;
  head.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
  const st = w.document.createElement('style');
  st.setAttribute('data-ct-style', 'page');
  st.textContent = scopeBodySelectors(rewritePageCssAssetUrls(read('pages/aba-materia/style.css')));
  head.appendChild(st);
  const th = w.document.createElement('style');
  th.setAttribute('data-ct-style', 'theme');
  th.textContent = rewriteThemeAssetUrls(scopeBodySelectors(read('src/theme.css')));
  head.appendChild(th);
  let content = null;
  const render = () => {
    if (content && content.parentNode) content.remove();
    content = w.document.createElement('div');
    content.className = PAGE_BODY_CLASS;
    w.document.body.appendChild(content);
    content.innerHTML = rewriteBodyAssetSrc(read('pages/aba-materia/body.html'));
    w.__ctScriptLog = [];
    runPageScripts(w, content, abaPage, { label: 'aba', navBoot: () => {} });
    (w.__ctDclListeners || []).splice(0).forEach(fn => {
      try { w.document.removeEventListener('DOMContentLoaded', fn); } catch (_) {}
    });
    return content;
  };
  content = render();
  return { w, get content() { return content; }, render, t1, vaultNotes, openedNotes };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  console.log('== R23-A: clique real no + ==');
  const b = boot();
  const { w, t1 } = b;
  b.render(); b.render(); // navegar para outra página e voltar (globais órfãos)
  const content = b.content;
  const plus = Array.from(content.querySelectorAll('[onclick*="adicionarMaterialPopup"]'))[0];
  check('A1: botão + existe no DOM renderizado', !!plus, plus && plus.outerHTML.slice(0, 120));
  if (plus) {
    click(w, plus);
    check('A2: clique no + abre o modal de material', !!w.document.getElementById('modalCaderno'));
  }
  const modal = w.document.getElementById('modalCaderno');
  if (modal) {
    click(w, modal.querySelector('#mTipo4'));
    check('A3: Anotações selecionado', modal.querySelector('#modalNotaBtn').style.display !== 'none');
    click(w, modal.querySelector('#modalNotaBtn'));
    w.__testVaultPick('Concursos/Foco/cronograma-estudo.md');
    const link = modal.querySelector('#modalLinkInput');
    check('A4: nota do vault preencheu o Link', link.value === 'Concursos/Foco/cronograma-estudo.md', link.value);
    modal.querySelector('#modalNomeInput').value = 'Minha nota';
    const addBtn = Array.from(modal.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Adicionar');
    check('A5: botão Adicionar existe', !!addBtn);
    if (addBtn) click(w, addBtn);
    const topico = w.CT.getTopico(t1.id);
    check('A6: clique em Adicionar gravou o material no tópico',
      (topico.cadernos || []).some(c => c.rotulo === 'NOTA' && c.url === 'Concursos/Foco/cronograma-estudo.md'),
      JSON.stringify(topico.cadernos));
  }
  w.close && w.close();

  console.log('== R23-B: autocomplete [[');
  {
    const b = boot();
    const w = b.w;
    const modal = w.document.getElementById('modalCaderno') || (() => {
      w.abrirModalCaderno(null, null, true);
      return w.document.getElementById('modalCaderno');
    })();
    const input = modal.querySelector('#modalLinkInput');
    input.value = '[[';
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    const sug = w.document.getElementById('ctVaultWikiSuggest');
    check('B1: digitar [[ abre sugestões de notas', !!sug && sug.querySelectorAll('[data-note]').length > 0,
      sug ? sug.textContent.slice(0, 120) : 'sem sugestões');
    if (sug) {
      const first = sug.querySelector('[data-note]');
      click(w, first);
      check('B2: escolher nota insere wikilink no Link', /^\[\[.+\]\]$/.test(input.value), input.value);
      check('B3: sugestões fecham após escolha', !w.document.getElementById('ctVaultWikiSuggest'));
    }
    w.close && w.close();
  }
  check('C1: fonte contém handler de [[ no modal',
    script2Src.includes('sugerirNotasWiki') && script2Src.includes("conectarWikiNoCampo('modalLinkInput')") && script2Src.includes("lastIndexOf('[['"));
  const neutralize = require('../src/render-util').PLATFORM_NEUTRALIZE_CSS;
  check('C2: overlays invisíveis não interceptam cliques',
    neutralize.includes('.popup-overlay:not(.visible)') && neutralize.includes('.modal-overlay:not(.visible)') && neutralize.includes('pointer-events:none!important'));
  check('C3: descendentes dos overlays também neutralizados',
    neutralize.includes('.popup-overlay:not(.visible) *') && neutralize.includes('.modal-overlay:not(.visible) *'));

  console.log('== R23-D: wikilink salvo sem bloqueio de segurança ==');
  {
    const b = boot();
    const w = b.w;
    w.abrirModalCaderno(null, null, true);
    const modal = w.document.getElementById('modalCaderno');
    const link = modal.querySelector('#modalLinkInput');
    link.value = '[[Projetos/Nota Guia]]';
    link.dispatchEvent(new w.Event('input', { bubbles: true }));
    check('D1: digitar [[ seleciona automaticamente Anotações',
      modal.querySelector('#modalNotaBtn').style.display !== 'none');
    modal.querySelector('#modalNomeInput').value = 'Guia';
    const add = Array.from(modal.querySelectorAll('button')).find(x => (x.textContent || '').trim() === 'Adicionar');
    click(w, add);
    const cad = (w.CT.getMaterias()[0].cadernos || [])[0] || {};
    check('D2: wikilink salvo sem bloqueio', cad.url === '[[Projetos/Nota Guia]]', JSON.stringify(cad));
    check('D3: material salvo como NOTA', cad.rotulo === 'NOTA', cad.rotulo);
    w.abrirCaderno(null, '[[Projetos/Nota Guia]]', 'QUEST');
    check('D4: abrir wikilink usa o host (sem window.open)',
      b.openedNotes.includes('Projetos/Nota Guia'), JSON.stringify(b.openedNotes));
    check('D5: host resolve nota existente antes de abrir',
      mainSrc.includes('getFirstLinkpathDest') && mainSrc.includes('getAbstractFileByPath') && mainSrc.includes('openFile(file)'));
    check('D6: nota inexistente avisa em vez de criar',
      mainSrc.includes('new Notice(') && !mainSrc.includes("openLinkText(p, '', true)"));
    w.close && w.close();
  }

  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
