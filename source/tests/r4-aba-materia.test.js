/**
 * Track do Oodeus — testes R4 (aba_materia)
 * Sessão A: ordem de carga + estilos (theme.js → style inline → theme.css →
 *           body → nav boot → Script1 → Script2 → DCL sintético — SEM desvio:
 *           o original também carrega data.js/nav.js antes do Script1).
 * Sessão B: init (guards, topbar, sidebar própria), progresso.
 * Sessão C: accordion single-open + regra CSS do questões-inline.
 * Sessão D: quick-fields Enter + flash 800ms.
 * Sessão E: modal de sessão (sessão e questões separados; data futura → alert).
 * Sessão F: edição consolidadora (escritas raw no localStorage).
 * Sessão G: ajuste manual por diff (valores negativos, nota 'Ajuste manual').
 * Sessão H: popup estudado (5/7/15/30 + data custom; marcar/revisar).
 * Sessão I: revisão manual (modal 5/7/15/30, grava revisaoData) + foco ?foco=&id=.
 * Sessão J: Smart Link (🔗 pulsante, modal de matches).
 * Sessão K: materiais — 4 tipos + NOTA "Anotações" (ADIÇÃO OODEUS, doc-mestre
 *           §3.7): grid 2×3, busca fuzzy via host.pickVaultNote, abertura
 *           interna via host.openVaultNote, filtros com contagem, migração.
 * Sessão L: drag&drop de tópicos (reordena ct_topicos raw) + subtópicos
 *           bloqueados cross-parent.
 * Sessão M: escritas raw (deletarTopico via CT.confirm) + prompts nativos.
 * Sessão N: sidebar pré/pós-edital + revBadge; timer inerte (R5).
 * Realm: jsdom runScripts:'dangerously' + wrapper new win.Function (mesmo
 * mecanismo do plugin — R3). Backing store: leitura direta do localStorage do
 * jsdom (#2056/#2059). Alert/confirm: overlay #ct-alert-overlay (canal do host,
 * R1). Quirks jsdom: DCL real atrasado re-executa listeners DCL (#2053) —
 * asserções de estado síncrono vêm LOGO APÓS a chamada.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');
const {
  PAGE_BODY_CLASS,
  scopeBodySelectors,
  rewriteThemeAssetUrls,
  rewriteBodyAssetSrc,
  rewritePageCssAssetUrls,
  runPageScripts,
} = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const themeSrc = read('src/theme.js');
const dataSrc = read('src/data.js');
const navSrc = read('src/nav.js');
const pageStyleCss = read('pages/aba-materia/style.css');
const pageBodyHtml = read('pages/aba-materia/body.html');
const script1Src = read('pages/aba-materia/script1.pagejs');
const script2Src = read('pages/aba-materia/script2.pagejs');
const themeCss = read('src/theme.css');

const abaPage = {
  scripts: [script1Src, script2Src],
  lazyModules: [],
};

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const vm = require('vm');
function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename: filename || 'script.js' });
}

function storedKey(w, key) {
  const raw = w.localStorage.getItem(key);
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

const tick = (ms) => new Promise(r => setTimeout(r, ms));

function bootPlugin({ seed = {}, preEdital = false, revBadgeSeed = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  // Quirk #2053 (harness): jsdom dispara o DCL REAL atrasado (load em
  // pretendToBeVisual) — no plugin readyState já é 'complete' e nada
  // re-executa. Capturamos os listeners DCL para removê-los após o DCL
  // sintético de cada render (renderAba), evitando re-execução do init.
  w.__ctDclListeners = [];
  const origAddEventListener = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') w.__ctDclListeners.push(fn);
    return origAddEventListener(type, fn, opts);
  };
  // Quirk jsdom: scrollIntoView não existe — o foco usa scrollIntoView smooth
  // (comportamento real do browser; no harness é no-op).
  w.HTMLElement.prototype.scrollIntoView = function () {};
  global.window = w;
  const navigations = [];
  const openedNotes = [];
  const vaultNotes = ['Projetos/Nota Guia.md', 'Concursos/Foco/cronograma-estudo.md', 'raiz.md'];
  let pendingNotePick = null;
  initHost({
    data: JSON.parse(JSON.stringify(seed)),
    persist: () => true,
    window: w,
    navigate: (p) => { navigations.push(p); return true; },
    currentPage: () => (w.__testPage || ''),
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
    // [R4] ponte NOTA (adição Oodeus)
    listVaultNotes: () => vaultNotes.slice(),
    pickVaultNote: (cb) => { pendingNotePick = cb; },
    openVaultNote: (p) => { openedNotes.push(p); },
  });
  w.__testVaultPick = (p) => { const cb = pendingNotePick; pendingNotePick = null; if (cb) cb(p); };
  w.__CT_SHELL__ = true;
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  // Seed de dados (após data.js): concurso + matéria
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: preEdital ? '' : '2026-12-20', preEdital });
  const cId = w.CT.getConcursos()[0].id;
  w.CT.saveMateria({ concursoId: cId, nome: 'Português' });
  const mId = w.CT.getMaterias().filter(m => m.concursoId === cId)[0].id;
  const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mId, nome: 'Concordância' });
  const t2 = w.CT.saveTopico({ concursoId: cId, materiaId: mId, nome: 'Crase' });
  w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Regência' });
  w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Crd. Verbal' });
  const s1 = w.CT.getSubtopicos().filter(s => s.topicoId === t1.id)[0];
  const s2 = w.CT.getSubtopicos().filter(s => s.topicoId === t1.id)[1];
  if (revBadgeSeed) revBadgeSeed(w, { cId, mId, t1, t2, s1, s2 });
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  w.sessionStorage.setItem('ct_materia_ativa', mId);
  return { dom: j, w, navigations, openedNotes, vaultNotes, cId, mId, t1, t2, s1, s2 };
}

function renderAba(t, { search = '' } = {}) {
  const { w } = t;
  if (t.content && t.content.parentNode) t.content.remove();
  w.__CT_PAGE_SEARCH__ = search;
  const head = w.document.head;
  head.querySelectorAll('[data-ct-style]').forEach(n => n.remove());
  const pageStyleEl = w.document.createElement('style');
  pageStyleEl.setAttribute('data-ct-style', 'page');
  pageStyleEl.textContent = scopeBodySelectors(rewritePageCssAssetUrls(pageStyleCss));
  head.appendChild(pageStyleEl);
  const themeStyleEl = w.document.createElement('style');
  themeStyleEl.setAttribute('data-ct-style', 'theme');
  themeStyleEl.textContent = rewriteThemeAssetUrls(scopeBodySelectors(themeCss));
  head.appendChild(themeStyleEl);

  const content = w.document.createElement('div');
  content.className = PAGE_BODY_CLASS;
  w.document.body.appendChild(content);
  content.innerHTML = rewriteBodyAssetSrc(pageBodyHtml);

  w.__ctScriptLog = [];
  w.document.addEventListener('DOMContentLoaded', () => w.__ctScriptLog.push('dcl-marker'));
  runPageScripts(w, content, abaPage, {
    label: 'aba',
    navBoot: () => {
      w.__ctScriptLog.push('nav-boot');
      if (typeof w.__CT_NAV_BOOT === 'function') w.__CT_NAV_BOOT();
    },
  });
  t.content = content;
  // Quirk #2053: após o DCL sintético, remover os listeners DCL capturados —
  // o real atrasado do jsdom não pode re-executar o init (no plugin nada
  // re-executa: readyState 'complete' desde o onload).
  (w.__ctDclListeners || []).splice(0).forEach(fn => {
    try { w.document.removeEventListener('DOMContentLoaded', fn); } catch { /* noop */ }
  });
  return content;
}

// Seeded alert/confirm reader — o canal do host é o overlay (R1).
function overlayMessage(w) {
  const ov = w.document.getElementById('ct-alert-overlay');
  return ov ? (ov.querySelector('.ct-alert-message') || {}).textContent : null;
}
async function confirmOverlay(w) {
  const ov = w.document.getElementById('ct-alert-overlay');
  if (ov) { const ok = ov.querySelector('.ct-alert-ok'); if (ok) ok.click(); }
  await tick(20);
}

(async () => {
  console.log('== R4-A: ordem de carga + estilos ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w } = t;
    const styles = w.document.head.querySelectorAll('[data-ct-style]');
    check('2 styles injetados (página ANTES de theme.css)', styles.length === 2 && styles[0].getAttribute('data-ct-style') === 'page' && styles[1].getAttribute('data-ct-style') === 'theme');
    const pageCss = styles[0].textContent || '';
    check('style da aba: sidebar-concurso e quick-field presentes', pageCss.includes('.sidebar-concurso') && pageCss.includes('.quick-field'));
    check('ordem: nav boot → Script1 → Script2 → DOMContentLoaded (sem desvio)', JSON.stringify(w.__ctScriptLog) === JSON.stringify([
      'nav-boot', 'aba-script-1', 'aba-script-2', 'dcl-marker',
    ]), (w.__ctScriptLog || []).join(','));
    check('CSS accordion: questoes-inline some com sub-open (regra 231)', pageCss.replace(/\s+/g, ' ').includes('.topico-card.sub-open > .topico-body > .questoes-inline { display:none; }'));
    check('body.html: ctxMenu morto presente no DOM (paridade, etapa-06 §13)', w.document.getElementById('ctxMenu') !== null);
    check('sidebar própria estática + nav.js ainda rodou (ícones tc-nav-icon)', !!content.querySelector('.sidebar') && w.document.getElementById('tc-nav-icon-style') !== null);
  }

  console.log('== R4-B: init + sidebar ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, cId, mId, t1, s1 } = t;
    check('guard: sem guard redirect no render OK (navegations vazio)', t.navigations.length === 0, JSON.stringify(t.navigations));
    check('topbarNome: 📘 + nome da matéria (saveMateria normaliza p/ caixa alta) + botão ⋮', (content.querySelector('#topbarNome').textContent || '').includes('📘') && (content.querySelector('#topbarNome').textContent || '').toUpperCase().includes('PORTUGU'));
    check('sidebar: sideNome/sideBanca preenchidos pelo Script1', w.document.getElementById('sideNome').textContent === 'Foco Final' && w.document.getElementById('sideBanca').textContent === 'FGV');
    check('timer da sidebar: dias para a prova (30 dias até 2026-12-20)', /^\d+$/.test(w.document.getElementById('sideTimer').textContent), w.document.getElementById('sideTimer').textContent);
    check('progresso: 0% (nenhum tópico estudado)', (content.querySelector('#progPct') || {}).textContent === '0%');
    check('tópicos renderizados: 2 cards (tc_*)', !!content.querySelector('#tc_' + t1.id) && w.document.querySelectorAll('.topico-card').length === 2);
    check('quick-fields do tópico: qa_/qe_ presentes', !!content.querySelector('#qa_' + t1.id) && !!content.querySelector('#qe_' + t1.id));
    // guards de redirect: nova boot sem ct_materia_ativa → dashboard
    const t2b = bootPlugin();
    t2b.w.sessionStorage.removeItem('ct_materia_ativa');
    renderAba(t2b);
    check('guard: sem ct_materia_ativa → goPage(dashboard.html)', t2b.navigations.includes('dashboard.html'), JSON.stringify(t2b.navigations));
  }

  console.log('== R4-C: accordion single-open ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1, t2, s1, s2 } = t;
    // Assinatura original: render chama toggleTopico('tc_'+id) / toggleSub('sc_'+id)
    w.toggleTopico('tc_' + t1.id);
    check('toggleTopico abre o card (classe open)', content.querySelector('#tc_' + t1.id).classList.contains('open'));
    w.toggleTopico('tc_' + t2.id);
    check('single-open: abrir t2 FECHA t1', content.querySelector('#tc_' + t2.id).classList.contains('open') && !content.querySelector('#tc_' + t1.id).classList.contains('open'));
    w.toggleSub('sc_' + s1.id);
    check('toggleSub abre o subtópico + marca pai sub-open', (() => {
      const row = content.querySelector('#sc_' + s1.id);
      return row && row.querySelector('.sub-body').style.display !== 'none' && content.querySelector('#tc_' + t1.id).classList.contains('sub-open');
    })());
    w.toggleSub('sc_' + s2.id);
    check('toggleSub: abrir s2 fecha s1 (sub-body dos outros none)', content.querySelector('#sc_' + s2.id).querySelector('.sub-body').style.display !== 'none' && content.querySelector('#sc_' + s1.id).querySelector('.sub-body').style.display === 'none');
  }

  console.log('== R4-D: quick-fields Enter + flash 800ms ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1 } = t;
    const qa = content.querySelector('#qa_' + t1.id);
    const qe = content.querySelector('#qe_' + t1.id);
    qa.value = '7';
    qe.value = '3';
    qa.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // estado síncrono logo após o Enter (DCL real atrasado do jsdom não re-render
    // renderTopicos aqui — lancarAmbos é chamado direto)
    const qs = storedKey(w, 'ct_questoes') || [];
    check('Enter → CT.lancarQuestoes (resolvidas 10, acertos 7, erros 3)', qs.length === 1 && qs[0].resolvidas === 10 && qs[0].acertos === 7 && qs[0].erros === 3, JSON.stringify(qs));
    check('flash verde 800ms nos dois campos (síncrono)', qa.style.borderColor === 'var(--green)' && qe.value === '' && qa.value === '');
    await tick(850);
    check('flash limpa após ~800ms', qa.style.borderColor === '');
    // qhist re-renderizado (id qhist_<tid>; Taxa com pct)
    const qhist = content.querySelector('#qhist_' + t1.id);
    check('qhist atualizado com a taxa (70%)', qhist && (qhist.textContent || '').includes('70') && (qhist.textContent || '').includes('Resolvidas:'), qhist && qhist.textContent.replace(/\s+/g, ' ').slice(0, 90));
    check('Enter com 0/0 não lança (guard)', (() => {
      const before = (storedKey(w, 'ct_questoes') || []).length;
      qa.value = ''; qe.value = '';
      qa.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return (storedKey(w, 'ct_questoes') || []).length === before;
    })());
  }

  console.log('== R4-E: modal de sessão (questões/horas separados) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1 } = t;
    w.abrirModalSessaoQuestoes(t1.id, '');
    const modal = w.document.getElementById('modalSessaoQuestoes');
    check('modal aberto com campos Data/Acertos/Erros/Horas/Minutos', !!modal && !!modal.querySelector('#sessaoData') && !!modal.querySelector('#sessaoAcertos') && !!modal.querySelector('#sessaoHoras') && !!modal.querySelector('#sessaoPaginasPdf'));
    check('data default = hoje e max = hoje', modal.querySelector('#sessaoData').value === w.CT._today() && modal.querySelector('#sessaoData').getAttribute('max') === w.CT._today());
    modal.querySelector('#sessaoAcertos').value = '5';
    modal.querySelector('#sessaoErros').value = '2';
    modal.querySelector('#sessaoHoras').value = '1';
    modal.querySelector('#sessaoMinutos').value = '30';
    modal.querySelector('#sessaoPaginasPdf').value = '12';
    w.salvarModalSessaoQuestoes(t1.id, '');
    const sessoes = storedKey(w, 'ct_sessoes') || [];
    const questoes = storedKey(w, 'ct_questoes') || [];
    check('sessão gravada (5400s) com métricas paginasPdf', sessoes.length === 1 && sessoes[0].duracaoSegundos === 5400 && sessoes[0].metricas && sessoes[0].metricas.paginasPdf === 12, JSON.stringify(sessoes));
    check('questões gravadas separadamente (7 resolvidas)', questoes.length === 1 && questoes[0].resolvidas === 7, JSON.stringify(questoes));
    check('modal fechado após salvar', w.document.getElementById('modalSessaoQuestoes') === null);
    // data futura → alert (CT.alert renderiza o overlay em requestAnimationFrame —
    // jsdom pretendToBeVisual: ler o overlay depois de um tick)
    w.abrirModalSessaoQuestoes(t1.id, '');
    const m2 = w.document.getElementById('modalSessaoQuestoes');
    m2.querySelector('#sessaoAcertos').value = '1';
    m2.querySelector('#sessaoData').value = '2027-01-01';
    w.salvarModalSessaoQuestoes(t1.id, '');
    await tick(30);
    check('data futura → alert "Escolha hoje ou uma data anterior"', (overlayMessage(w) || '').includes('Escolha hoje ou uma data anterior'), overlayMessage(w));
    const after = (storedKey(w, 'ct_questoes') || []).length;
    check('data futura não grava', after === 1);
    // nada informado → alert
    await confirmOverlay(w);
    m2.querySelector('#sessaoAcertos').value = '';
    m2.querySelector('#sessaoData').value = w.CT._today();
    w.salvarModalSessaoQuestoes(t1.id, '');
    await tick(30);
    check('nada informado → alert "Informe questões..."', (overlayMessage(w) || '').includes('Informe questões'), overlayMessage(w));
    await confirmOverlay(w);
  }

  console.log('== R4-F: edição consolidadora (escritas raw) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1, s1 } = t;
    // seed: 2 sessões + 2 lançamentos no t1
    w.CT.registrarSessao({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, duracaoSegundos: 1800 });
    w.CT.registrarSessao({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, duracaoSegundos: 900 });
    w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, resolvidas: 4, acertos: 3, erros: 1 });
    w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, resolvidas: 6, acertos: 2, erros: 4 });
    // lançamento de SUBTÓPICO que deve sobreviver à consolidação do tópico
    w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, subtopId: s1.id, resolvidas: 10, acertos: 10, erros: 0 });
    // abrir painel de edição e salvar totais consolidados
    w.abrirModalAjuste === undefined; // noop: usa painel inline
    const panel = content.querySelector('#editQ_' + t1.id);
    check('painel editar totais existe (editQ_)', !!panel && !!panel.querySelector('#editAcertos_' + t1.id) && !!panel.querySelector('#editH_' + t1.id));
    panel.querySelector('#editAcertos_' + t1.id).value = '9';
    panel.querySelector('#editErros_' + t1.id).value = '3';
    panel.querySelector('#editH_' + t1.id).value = '2';
    panel.querySelector('#editMin_' + t1.id).value = '30';
    w.salvarEdicaoEstat(t1.id);
    const questoes = storedKey(w, 'ct_questoes') || [];
    const sessoes = storedKey(w, 'ct_sessoes') || [];
    const topicosQ = questoes.filter(q => q.topicoId === t1.id && !q.subtopId);
    const subsQ = questoes.filter(q => q.subtopId === s1.id);
    check('consolidação: 1 único lançamento do tópico (12 resolv., 9/3)', topicosQ.length === 1 && topicosQ[0].resolvidas === 12 && topicosQ[0].acertos === 9 && topicosQ[0].erros === 3, JSON.stringify(topicosQ));
    check('consolidação preserva lançamento do subtópico (10/10)', subsQ.length === 1 && subsQ[0].acertos === 10);
    check('sessões: 1 única consolidada (9000s) via localStorage.setItem raw', sessoes.length === 1 && sessoes[0].duracaoSegundos === 9000, JSON.stringify(sessoes));
  }

  console.log('== R4-G: ajuste manual por diff (negativo) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w } = t;
    // seed: 2h de sessão + 10 acertos
    w.CT.registrarSessao({ concursoId: t.cId, materiaId: t.mId, topicoId: t.t1.id, duracaoSegundos: 7200 });
    w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mId, topicoId: t.t1.id, resolvidas: 10, acertos: 10, erros: 0 });
    const modalFix = w.document.getElementById('modal-ajuste-materia');
    check('modal-ajuste-materia existe no HTML (601-637)', !!modalFix);
    w.abrirModalAjuste();
    check('adjH/adjA pré-preenchidos (2h, 10 acertos)', w.document.getElementById('adjH').value === '2' && w.document.getElementById('adjA').value === '10');
    check('_adjInitial guardado (7200s, 10, 0)', JSON.stringify(w._adjInitial) === JSON.stringify({ seg: 7200, acertos: 10, erros: 0 }), JSON.stringify(w._adjInitial));
    check('histórico dos lançamentos hospedado DENTRO do modal (ensureAjusteHistoryHost)', !!modalFix.querySelector('.adj-history-list') && modalFix.contains(modalFix.querySelector('.adj-history-list')));
    // reduzir: 1h30 e 8 acertos → diff negativo
    w.document.getElementById('adjH').value = '1';
    w.document.getElementById('adjM').value = '30';
    w.document.getElementById('adjA').value = '8';
    w.document.getElementById('adjE').value = '0';
    w.salvarAjusteManual();
    const sessoes = storedKey(w, 'ct_sessoes') || [];
    const questoes = storedKey(w, 'ct_questoes') || [];
    check('diff de sessão NEGATIVO gravado (-1800s, nota Ajuste manual)', sessoes.some(s => s.duracaoSegundos === -1800 && s.nota === 'Ajuste manual'), JSON.stringify(sessoes));
    check('diff de questões NEGATIVO gravado (-2 acertos, nota Ajuste manual)', questoes.some(q => q.acertos === -2 && q.nota === 'Ajuste manual'), JSON.stringify(questoes));
    const totalSessoes = (storedKey(w, 'ct_sessoes') || []).length;
    check('histórico lista sessões (⏱️) e lançamentos (📝) ordenados por horaInicio desc', totalSessoes === 2 && questoes.length === 2);
  }

  console.log('== R4-H: popup estudado (5/7/15/30 + custom) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1, t2, s1 } = t;
    w.abrirPopupTopico(t1.id);
    check('popup-overlay visível com 4 opções + custom', w.document.getElementById('popup-overlay').classList.contains('visible') && w.document.querySelectorAll('#popup-overlay .popup-opt').length === 4 && !!w.document.querySelector('#popup-overlay .popup-custom input'));
    check('primeira opção selecionada por default', w.document.querySelector('#popup-overlay .popup-opt.selected .popup-opt-num').textContent === '5');
    w.confirmarEstudado();
    const tObj = w.CT.getTopico(t1.id);
    const revisoes = storedKey(w, 'ct_revisoes') || [];
    const dPlus5 = (() => { const d = new Date(); d.setDate(d.getDate() + 5); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
    check('confirmarEstudado: tópico estudado + revisão hoje+5 (' + dPlus5 + ')', tObj.estudado === true && revisoes.some(r => r.topicoId === t1.id && r.data === dPlus5 && !r.concluida), JSON.stringify(revisoes));
    check('popup fechado + card .estudado no re-render', w.document.getElementById('popup-overlay').classList.contains('visible') === false);
    // sub: data custom vence
    w.abrirPopupSubtopico(s1.id);
    w.document.querySelector('#popup-overlay .popup-custom input').value = '2026-12-25';
    w.confirmarEstudado();
    const sObj = w.CT.getSubtopicos().find(x => x.id === s1.id);
    check('subtópico: registrarProgressoUnidadeEstudo + revisão com data custom', sObj.estudado === true && (storedKey(w, 'ct_revisoes') || []).some(r => r.subtopId === s1.id && r.data === '2026-12-25'));
    // Não revisar
    w.abrirPopupTopico(t2.id);
    w.naoRevisar();
    const t2Obj = w.CT.getTopico(t2.id);
    check('Não revisar: estudado SEM revisão', t2Obj.estudado === true && !(storedKey(w, 'ct_revisoes') || []).some(r => r.topicoId === t2.id));
  }

  console.log('== R4-I: revisão manual + foco ?foco=&id= ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1 } = t;
    w.abrirPopupMarcarRevisao(t1.id, '');
    const modal = w.document.getElementById('modalManualReview');
    check('modal de revisão manual com 4 opções + data (min=hoje)', !!modal && modal.querySelectorAll('.popup-opt').length === 4 && modal.querySelector('#manualReviewDate').getAttribute('min') === w.CT._today());
    // digitar data deseleciona as opções (oninput)
    modal.querySelector('#manualReviewDate').value = '2026-11-30';
    modal.querySelector('#manualReviewDate').dispatchEvent(new w.Event('input', { bubbles: true }));
    check('digitar data deseleciona as opções', w.document.querySelectorAll('#modalManualReview .popup-opt.selected').length === 0);
    w.salvarRevisaoManual();
    const tObj = w.CT.getTopico(t1.id);
    check('revisão manual: agendarRevisao + revisaoData no tópico', (storedKey(w, 'ct_revisoes') || []).some(r => r.topicoId === t1.id && r.data === '2026-11-30') && tObj.revisaoData === '2026-11-30');
    check('badge de revisão no card (rev. 30/11)', (content.querySelector('#tc_' + t1.id).textContent || '').includes('30/11') || (w.document.querySelector('#tc_' + t1.id + ' .topico-card') || w.document.querySelector('#tc_' + t1.id)).textContent.includes('30/11'));
    check('toast "Revisão marcada para 30/11"', (w.document.body.textContent || '').includes('Revisão marcada para 30/11') || (w.document.getElementById('ct-toast') || {}).textContent?.includes?.('30/11'));
    // foco
    const c2 = renderAba(t, { search: '?foco=topico&id=' + t1.id });
    await tick(150);
    const card = c2.querySelector('#tc_' + t1.id);
    check('foco: card aberto + review-focus (outline/glow)', card.classList.contains('open') && card.classList.contains('review-focus'));
    const outrosAbertos = Array.from(c2.querySelectorAll('.topico-card.open')).filter(el => el !== card);
    check('foco: fecha os outros tópicos', outrosAbertos.length === 0);
    await tick(2700);
    check('review-focus some após 2600ms', !card.classList.contains('review-focus'));
  }

  console.log('== R4-J: Smart Link ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, cId, mId } = t;
    // segundo concurso com matéria homônima + cadernos (fonte do match)
    w.CT.saveConcurso({ nome: 'Outro Concurso', dataProva: '2027-06-01' });
    const c2Id = w.CT.getConcursos().find(c => c.id !== cId).id;
    w.CT.saveMateria({ concursoId: c2Id, nome: 'Português' });
    const m2Id = w.CT.getMaterias().filter(m => m.concursoId === c2Id)[0].id;
    const m2 = w.CT.getMateria(m2Id);
    m2.cadernos = [{ id: 'c1', rotulo: 'QUEST', url: 'https://www.qconcursos.com/questoes', nome: 'Caderno', emoji: '📓', estudado: false }];
    w.CT.saveMateria(m2);
    // re-render para o Smart Link do título aparecer
    const c3 = renderAba(t);
    const glow = c3.querySelector('#topbarNome .link-glow');
    check('Smart Link 🔗 pulsante no título (matéria sem cadernos + matches)', !!glow, c3.querySelector('#topbarNome').innerHTML.slice(0, 120));
    w.abrirModalLink(mId, 'Português', 'materia');
    const modal = w.document.getElementById('modalSmartLink');
    check('modal Smart Link lista o concurso de origem', !!modal && (modal.textContent || '').includes('Outro Concurso'), modal && modal.textContent.slice(0, 160));
  }

  console.log('== R4-K: materiais — 4 tipos + NOTA (adição Oodeus) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, mId } = t;
    check('CADERNO_TIPOS com 5 entradas (4 originais + NOTA)', w.CADERNO_TIPOS.length === 5 && w.CADERNO_TIPOS[4].rotulo === 'NOTA' && w.CADERNO_TIPOS[4].label === 'Anotações' && w.CADERNO_TIPOS[4].emoji === '📝');
    w.abrirModalCaderno(null, null, true);
    const modal = w.document.getElementById('modalCaderno');
    check('grid de tipos: 5 opções (mTipo0..mTipo4)', !!modal && [0,1,2,3,4].every(i => modal.querySelector('#mTipo' + i)));
    w.selecionarTipoModal(4);
    check('selecionar NOTA: botão 🔍 Buscar nota do vault visível', modal.querySelector('#modalNotaBtn').style.display !== 'none');
    w.selecionarTipoModal(0);
    check('selecionar QUEST: botão nota escondido de volta', modal.querySelector('#modalNotaBtn').style.display === 'none');
    w.selecionarTipoModal(4);
    // busca fuzzy via host
    w.buscarNotaVault('modalLinkInput');
    w.__testVaultPick('Concursos/Foco/cronograma-estudo.md');
    check('pickVaultNote: caminho da nota preenche o campo Link', modal.querySelector('#modalLinkInput').value === 'Concursos/Foco/cronograma-estudo.md');
    modal.querySelector('#modalNomeInput').value = 'Minha nota de estudo';
    w.confirmarModalCaderno(false);
    const m = w.CT.getMateria(mId);
    const cad = (m.cadernos || [])[0] || {};
    check('material NOTA criado: rotulo/emoji 📝/url = caminho da nota/estudado false', cad.rotulo === 'NOTA' && cad.emoji === '📝' && cad.url === 'Concursos/Foco/cronograma-estudo.md' && cad.nome === 'Minha nota de estudo' && cad.estudado === false, JSON.stringify(cad));
    check('NOTA não ganha assistido (só VIDEO)', !('assistido' in cad));
    check('chip do material com ícone 📝 (materialIconHtml fallback emoji)', (content.querySelector('#cadernos-materia').textContent || '').includes('📝'));
    // abrir via host.openVaultNote
    w.abrirCaderno(null, 'Concursos/Foco/cronograma-estudo.md', 'NOTA');
    check('abrirCaderno NOTA → host.openVaultNote (interna, sem obsidian://)', t.openedNotes.includes('Concursos/Foco/cronograma-estudo.md') && t.navigations.length === 0, JSON.stringify(t.openedNotes));
    // migração idempotente preserva o NOTA
    w.CT_MigratePDFEmojis();
    const mAfter = w.CT.getMateria(mId);
    check('CT_MigratePDFEmojis idempotente: NOTA mantém 📝', mAfter.cadernos[0].emoji === '📝' && mAfter.cadernos[0].rotulo === 'NOTA');
    // filtros com contagem
    w.abrirMateriaisDoItem('', '');
    const popup = w.document.getElementById('materialsPopup') || w.document.querySelector('.materials-popup') || w.document.body;
    const filterTexts = Array.from(popup.querySelectorAll('button, .material-filter, [onclick*="setMaterialFilter"], [onclick*="materialFilter"]')).map(b => (b.textContent || '').trim()).filter(Boolean);
    check('filtros: Todos + 5 tipos presentes', (popup.textContent || '').includes('Todos') && filterTexts.some(txt => txt.includes('Anotações')), JSON.stringify(filterTexts.slice(0, 12)));
    check('contagem por tipo: Anotações (1)', (popup.textContent || '').match(/Anota(ç|c)\u00f5es[^0-9]*1/) !== null, (popup.textContent || '').slice(0, 400));
    // editar material: mudar tipo para QUEST deleta nada de NOTA; safe-check bypass
    w.abrirEditarMaterialPopup('', '', cad.id);
    const editModal = w.document.getElementById('modalEditarMaterial');
    check('modal editar: 5 opções de tipo + botão nota visível para NOTA', editModal.querySelectorAll('#editMaterialTipo option').length === 5 && editModal.querySelector('#editMaterialNotaBtn').style.display !== 'none');
    editModal.querySelector('#editMaterialTipo').value = 'QUEST';
    editModal.querySelector('#editMaterialTipo').dispatchEvent(new w.Event('change', { bubbles: true }));
    check('mudar tipo esconde o botão nota', editModal.querySelector('#editMaterialNotaBtn').style.display === 'none');
    // [R31] salvar com tipo QUEST e caminho de vault: agora é aceito — o
    // caminho relativo do vault é universal entre PC/celular/tablet.
    w.salvarEdicaoMaterialPopup('', '', cad.id);
    await tick(30);
    check('caminho do vault aceito para tipo não-NOTA (sem bloqueio)', !(overlayMessage(w) || '').includes('Link bloqueado'), overlayMessage(w));
    const cad2 = (w.CT.getMateria(mId).cadernos || [])[0];
    check('material atualizado para QUEST com url do vault', cad2.rotulo === 'QUEST' && cad2.url === 'Concursos/Foco/cronograma-estudo.md', JSON.stringify(cad2));
    // editar novamente: nome trocado, url preservada
    w.abrirEditarMaterialPopup('', '', cad.id);
    const edit2 = w.document.getElementById('modalEditarMaterial');
    edit2.querySelector('#editMaterialNome').value = 'Nota renomeada';
    w.salvarEdicaoMaterialPopup('', '', cad.id);
    const cad3 = (w.CT.getMateria(mId).cadernos || [])[0];
    check('editar: nome trocado, url do vault preservada', cad3.nome === 'Nota renomeada' && cad3.url === 'Concursos/Foco/cronograma-estudo.md', JSON.stringify(cad3));
  }

  console.log('== R4-L: drag & drop de tópicos ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1, t2 } = t;
    const order0 = (storedKey(w, 'ct_topicos') || []).filter(x => x.materiaId === t.mId).map(x => x.id);
    check('ordem inicial t1 → t2', JSON.stringify(order0) === JSON.stringify([t1.id, t2.id]));
    // arrastar t2 PARA t1 (drop antes de t1)
    const fakeDT = { effectAllowed: '', dropEffect: '', setData() {}, getData: () => '' };
    const evDragStart = { currentTarget: content.querySelector('#tc_' + t2.id), dataTransfer: fakeDT, stopPropagation() {}, preventDefault() {} };
    w.dragStart(evDragStart, 'topico', t2.id);
    await tick(5); // setTimeout 0 do opacity 0.4
    check('dragStart: opacity 0.4 no card arrastado', content.querySelector('#tc_' + t2.id).style.opacity === '0.4');
    const evDrop = { currentTarget: content.querySelector('#tc_' + t1.id), dataTransfer: fakeDT, stopPropagation() {}, preventDefault() {} };
    w.drop(evDrop, 'topico', t1.id);
    const order1 = (storedKey(w, 'ct_topicos') || []).filter(x => x.materiaId === t.mId).map(x => x.id);
    check('drop: t2 passa na frente (reordena ct_topicos raw)', JSON.stringify(order1) === JSON.stringify([t2.id, t1.id]), JSON.stringify(order1));
    // drop chama renderTopicos: cards re-criados (o dragEnd original roda no
    // elemento antigo, destacado — no DOM novo não sobra opacity 0.4)
    const novoEl = content.querySelector('#tc_' + t2.id);
    check('pós-drop: card novo re-renderizado sem opacity 0.4', !!novoEl && novoEl.style.opacity !== '0.4');
    w.dragEnd(evDrop);
    check('dragEnd: nenhum card com borderTop marcado', Array.from(content.querySelectorAll('.topico-card')).every(el => (el.style.borderTop || '') === ''));
    // subtópicos cross-parent bloqueados (o subtópico novo precisa estar no
    // DOM: re-render como no browser, onde ele só é arrastável se renderizado)
    w.CT.saveSubtopico({ concursoId: t.cId, topicoId: t2.id, nome: 'Sub do t2' });
    const s1b = w.CT.getSubtopicos().filter(x => x.topicoId === t2.id)[0];
    w.renderTopicos();
    const evDropSub = { currentTarget: content.querySelector('#sc_' + s1b.id), dataTransfer: fakeDT, stopPropagation() {}, preventDefault() {} };
    w.dragStart({ currentTarget: content.querySelector('#sc_' + t.s1.id), dataTransfer: fakeDT, stopPropagation() {}, preventDefault() {} }, 'subtopico', t.s1.id, t1.id);
    w.drop(evDropSub, 'subtopico', s1b.id, t2.id);
    await tick(30);
    check('subtópico cross-parent → alert "Arraste apenas dentro do mesmo tópico."', (overlayMessage(t.w) || '').includes('Arraste apenas dentro do mesmo tópico'), overlayMessage(t.w));
    await confirmOverlay(t.w);
  }

  console.log('== R4-M: escritas raw (deletarTopico) + prompts nativos ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, t1 } = t;
    w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mId, topicoId: t1.id, resolvidas: 5, acertos: 5, erros: 0 });
    w.CT.agendarRevisao(t1.id, '2026-11-20');
    const delPromise = w.deletarTopico(t1.id);
    await tick(20);
    const okBtn = w.document.querySelector('#ct-alert-overlay .ct-alert-ok');
    check('deletarTopico: CT.confirm com texto do tópico', (overlayMessage(w) || '').includes('Concordância'), overlayMessage(w));
    okBtn.click();
    await delPromise;
    await tick(20);
    const topicosRaw = storedKey(w, 'ct_topicos') || [];
    const questoesRaw = storedKey(w, 'ct_questoes') || [];
    check('escrita RAW: ct_topicos sem o tópico (localStorage.setItem direto)', !topicosRaw.some(x => x.id === t1.id));
    check('escrita RAW: ct_questoes filtradas por topicoId', !questoesRaw.some(x => x.topicoId === t1.id));
    check('escrita RAW: ct_revisoes filtradas via getContextoRevisao', !(storedKey(w, 'ct_revisoes') || []).some(r => (w.CT.getContextoRevisao(r) || {}).topicoId === t1.id));
    // [R16] prompt() nativo → CT.prompt modal: o Electron lança "prompt() is
    // not supported." e a função morria antes de CT.saveTopico (bug R16-2).
    // Assert por fonte ajustado para a nova forma (modal assíncrono, R16).
    check('CT.prompt modal (R16) em adicionarTopico/renomear — assert por fonte', typeof w.adicionarTopico === 'function' && w.adicionarTopico.toString().includes('CT.prompt(') && w.renomearTopico.toString().includes('CT.prompt(') && w.renomearSubtopico.toString().includes('CT.prompt('));
  }

  console.log('== R4-N: sidebar pré/pós-edital + revBadge + timer inerte ==');
  {
    // pré-edital
    const tp = bootPlugin({ preEdital: true });
    const contentP = renderAba(tp);
    check('pré-edital: box do timer substituído por ✦ PRÉ-EDITAL + foguete', (contentP.querySelector('.sidebar-concurso').textContent || '').includes('PRÉ-EDITAL'), contentP.querySelector('.sidebar-concurso').textContent.replace(/\s+/g, ' ').slice(0, 120));
    // revBadge
    const tr = bootPlugin({ revBadgeSeed: (w, x) => { w.CT.agendarRevisao(x.t1.id, '2026-11-10'); } });
    const contentR = renderAba(tr);
    const badge = contentR.querySelector('#revBadge');
    check('revBadge com revisão atrasada: contagem >= 1 visível', badge && badge.style.display !== 'none' && parseInt(badge.textContent) >= 1, badge && badge.textContent);
    // timer inerte (openFreeTimerPreset é da R5)
    const { w } = tr;
    let threw = null;
    try { w.iniciarCronometroLivreItem(null, tr.t1.id); } catch (e) { threw = e; }
    check('cronômetro livre inerte sem timer-popup (R5): sem erro', threw === null && typeof w.openFreeTimerPreset === 'undefined');
    await tick(80);
    check('retry único de 60ms: nada quebra depois', true);
  }

  console.log('');
  console.log(`== resultado: ${passed} PASS, ${failed} FAIL ==`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(1); });
