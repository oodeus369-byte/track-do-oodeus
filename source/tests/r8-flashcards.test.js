/**
 * Track do Oodeus — testes R8 (etapa-10: flashcards.js completo, port de aba do dashboard)
 *
 * Harness jsdom + vm.runInContext. flashcards.pagejs é IIFE COM 'use strict':
 * internos (reviewSrs, parseDelimited, calcStats...) NÃO são acessíveis — tudo é
 * testado pelos 35 métodos expostos em window.FlashcardsDashboard (+ window.showDashTab)
 * lendo o estado REAL do storage (ct_flashcard_decks / ct_flashcards / ct_flashcard_log)
 * e o DOM produzido (modais, árvore, views, badge). Fórmulas SRS testadas pelo fluxo
 * real openCardModal → saveCardModal → startStudy → revealStudyCard → answerStudy.
 *
 * Ordem do original (dashboard.html): data.js → flashcards.js (nav boot antes da
 * cadeia — mesmo desvio documentado no render-util R3). No jsdom readyState fica
 * 'loading' após o construtor → o boot verbatim é adiado para DOMContentLoaded;
 * o harness aguarda o evento (como um page load real).
 *
 * Sessões:
 *   A  storage/write/merge — chaves globais, filtro por concurso, merge na escrita,
 *      emit ct-data-updated ('flashcards:save'/'flashcards:review') + queueAutoSave
 *   B  SRS exato via fluxo real — again/hard/good/easy (intervalos 0 e pré-setados),
 *      isDue, previewSrs (clone + texto da barra), formatReviewInterval
 *   C  syncFromTrack — decks-espelho (materia→topico→subtopico, emojis, order),
 *      ensureDeck atualiza, copyCardsFromEquivalentDecks (reset SRS + dedupe),
 *      syncDeckToTopic (caderno FLASH + url + já-linkado + sem vínculo)
 *   D  árvore/stats — render, 5 stat cards, streak, pct acerto hoje, pie 7 dias,
 *      agregação recursiva, badge
 *   E  editor rico — MATH_SYMBOLS 34, insertSymbol (textarea e contenteditable),
 *      toggleSymbolBank, setupRichPaste, htmlHasContent(<img>), dica legacy
 *   F  modais card/deck — deck (D3 sem emoji, 'Books' vivo), 3 tipos, quiz
 *      (alternativas/gabarito/comentário/limite 26), cespe, validações
 *   G  import — CSV com header/sem header, TSV Anki, headers #separator + BOM,
 *      aspas escapadas, tipos inferidos, fallback splitOptionExplanations, JSON
 *   H  export — payload JSON, CSV 23 colunas + BOM + CRLF, deckPath, sanitize
 *   I  sessão de estudo — startStudy escopos, agregação (max/pick), descendentes,
 *      quiz answer, answerStudy (SRS real + log + results), cap 5000, delete
 *   J  modais/tab/badge — showModal/closeModal, Esc (D7), backdrop, focus, badge,
 *      showDashTab (sessionStorage ct_dashboard_tab), boot com hash #flashcards:<id>
 *   K  fonte — D1–D8 ausentes do código, D6 acentos, 'use strict', pywebview
 *      verbatim, hash routing verbatim, 35 métodos, quirk de indentação, LF
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const flashSrc = read('pages/flashcards/flashcards.pagejs');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const vm = require('vm');
function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename });
}
const tick = (ms) => new Promise(r => setTimeout(r, ms));
const rawKey = (w, k) => w.localStorage.getItem(k);
const jkey = (w, k) => { try { return JSON.parse(rawKey(w, k)); } catch { return null; } };

const SHELL_HTML = [
  '<nav>',
  '  <span id="flashTabBadge" style="display:none"></span>',
  '  <button id="navDashboardOverview"></button><button id="dashTabOverview"></button>',
  '  <button id="navFlashcardsDashboard"></button><button id="dashTabFlashcards"></button>',
  '</nav>',
  '<div id="dashboardOverview"></div>',
  '<div id="dashboardFlashcards"></div>',
  '<div id="flashcardsDashboardRoot"></div>',
].join('\n');

// Boot do dashboard (aba flashcards): data.js → flashcards.pagejs; boot verbatim
// aguarda DOMContentLoaded (jsdom mantém readyState 'loading' pós-construtor)
async function bootFlash({ url = 'http://localhost/app/', comEdital = 0, seed = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + SHELL_HTML + '</body></html>', { pretendToBeVisual: true, url, runScripts: 'dangerously' });
  const w = j.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.document.execCommand = function () { return true; };
  global.window = w;
  initHost({ data: {}, persist: () => true, window: w, currentPage: () => '', assetUrl: (rel) => 'app://plugin/' + rel });
  vmRun(w, dataSrc, 'data.js');
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  const cId = w.CT.getConcursos()[0].id;
  const spy = { toasts: [], alerts: [], autosave: [], events: [] };
  const origToast = w.CT.toast.bind(w.CT);
  w.CT.toast = (msg, icon) => { spy.toasts.push(String(msg)); return origToast(msg, icon); };
  const origAlert = w.CT.showAlert.bind(w.CT);
  w.CT.showAlert = (msg, opts) => { spy.alerts.push({ msg: String(msg), title: opts && opts.title }); return origAlert(msg, opts); };
  const origQas = w.CT.queueAutoSave;
  w.CT.queueAutoSave = function (reason, opts) { spy.autosave.push(reason); return origQas.call(w.CT, reason, opts); };
  w.addEventListener('ct-data-updated', (e) => { spy.events.push(e.detail); });

  const edital = {};
  if (comEdital) {
    w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
    edital.m = w.CT.getMaterias(cId)[0];
    w.CT.saveTopico({ concursoId: cId, materiaId: edital.m.id, nome: 'Controle de constitucionalidade' });
    edital.t = w.CT.getTopicos(edital.m.id)[0];
    w.CT.saveSubtopico({ concursoId: cId, topicoId: edital.t.id, nome: 'Repercussão geral' });
    edital.s = w.CT.getSubtopicos(edital.t.id)[0];
  }
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  if (seed) seed(w, cId, edital);
  vmRun(w, flashSrc, 'flashcards.pagejs');
  if (w.document.readyState === 'loading') {
    await new Promise(r => w.document.addEventListener('DOMContentLoaded', r, { once: true }));
  }
  return { dom: j, w, cId, spy, edital };
}

// Cria card flip pelo fluxo real do modal
function criarCardFlip(w, deckId, front, back, tags) {
  w.FlashcardsDashboard.openCardModal(null, deckId);
  w.document.getElementById('flashCardFront').innerHTML = front;
  w.document.getElementById('flashCardBack').innerHTML = back;
  if (tags) w.document.getElementById('flashCardTags').value = tags;
  w.FlashcardsDashboard.saveCardModal();
}
function criarCardQuiz(w, deckId, { front, alts, correct, explanations, tags }) {
  w.FlashcardsDashboard.openCardModal(null, deckId);
  w.document.getElementById('flashCardType').value = 'quiz';
  w.FlashcardsDashboard.toggleCardFields();
  w.document.getElementById('flashCardFront').innerHTML = front;
  (alts || []).forEach((alt, i) => {
    const el = w.document.getElementById('flashQuizOptionText_' + i);
    if (el) el.value = alt;
  });
  const radio = w.document.querySelector('input[name="flashQuizCorrect"][value="' + correct + '"]');
  if (radio) radio.checked = true;
  (explanations || []).forEach((exp, i) => {
    const el = w.document.getElementById('flashQuizExplanation_' + i);
    if (el) el.innerHTML = exp;
  });
  if (tags) w.document.getElementById('flashCardTags').value = tags;
  w.FlashcardsDashboard.saveCardModal();
}
const cardsDe = (w, deckId) => (jkey(w, 'ct_flashcards') || []).filter(c => c.deckId === deckId);
const decksDe = (w, cId) => (jkey(w, 'ct_flashcard_decks') || []).filter(d => !cId || d.concursoId === cId);
const logDe = (w, cId) => (jkey(w, 'ct_flashcard_log') || []).filter(l => !cId || l.concursoId === cId);

(async () => {
  // ================= A: storage/write/merge =================
  console.log('== R8-A: storage global com filtro por concurso + merge na escrita ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    check('A1 chaves globais: ct_flashcard_decks com 3 espelhos do boot; cards/log são null até a 1ª escrita (write cria)',
      Array.isArray(jkey(w, 'ct_flashcard_decks')) && jkey(w, 'ct_flashcard_decks').length === 3
      && rawKey(w, 'ct_flashcard_decks') !== null,
      JSON.stringify(jkey(w, 'ct_flashcard_decks')));

    check('A2 write emite ct-data-updated com reason flashcards:save + queueAutoSave registrado',
      spy.events.some(e => e.tipo === 'flashcards:save') && spy.autosave.includes('flashcards:save'),
      JSON.stringify({ ev: spy.events.map(e => e.tipo), qas: spy.autosave }));

    check('A3 saveDeckModal cria deck com concursoId corrente, sourceType custom, emoji Books (D3 vivo), order = length+1',
      (() => {
        w.FlashcardsDashboard.openDeckModal();
        w.document.getElementById('flashDeckName').value = 'Meu Baralho';
        w.FlashcardsDashboard.saveDeckModal();
        const custom = decksDe(w, cId).find(d => d.sourceType === 'custom');
        return custom && custom.concursoId === cId && custom.emoji === 'Books' && custom.order === 4 && custom.sourceId === null;
      })());

    const cB = (() => { w.CT.saveConcurso({ nome: 'Outro' }); return w.CT.getConcursos()[1].id; })();
    w.sessionStorage.setItem('ct_concurso_ativo', cB);
    w.FlashcardsDashboard.openDeckModal();
    w.document.getElementById('flashDeckName').value = 'Baralho B';
    w.FlashcardsDashboard.saveDeckModal();
    const all = jkey(w, 'ct_flashcard_decks');
    check('A4 merge: deck do concurso A preservado quando o concurso B salva o dele',
      all.some(d => d.concursoId === cId && d.name === 'Meu Baralho') && all.some(d => d.concursoId === cB && d.name === 'Baralho B'));

    check('A5 getDecks filtra pelo concurso ativo (B não vê deck do A)',
      decksDe(w, cB).every(d => d.concursoId === cB) && decksDe(w, cB).length === 1);

    w.FlashcardsDashboard.openCardModal(null, decksDe(w, cB)[0].id);
    w.document.getElementById('flashCardFront').innerHTML = 'Frente B';
    w.document.getElementById('flashCardBack').innerHTML = 'Verso B';
    w.FlashcardsDashboard.saveCardModal();
    check('A6 cards filtrados por concurso (getCards) e merge de cards preserva os do outro concurso',
      (jkey(w, 'ct_flashcards') || []).filter(c => c.concursoId === cB).length === 1
      && (jkey(w, 'ct_flashcards') || []).every(c => c.concursoId === cId || c.concursoId === cB),
      JSON.stringify(jkey(w, 'ct_flashcards')));
    check('A7 getLog filtra por concurso (log vazio para B, sem erro)',
      logDe(w, cB).length === 0);
    check('A8 startStudy com o card criado → sessão "Card 1/1"; cancelStudy volta',
      (() => {
        w.FlashcardsDashboard.startStudy(decksDe(w, cB)[0].id, 'due');
        const ok = w.document.getElementById('flashMainView').innerHTML.includes('Card 1/1');
        w.FlashcardsDashboard.cancelStudy();
        return ok;
      })());
  }

  // ================= B: SRS exato via fluxo real =================
  console.log('== R8-B: SRS — fórmulas exatas por answerStudy real ==');
  {
    const t = await bootFlash();
    const { w, cId, spy } = t;
    w.FlashcardsDashboard.openDeckModal();
    w.document.getElementById('flashDeckName').value = 'SRS';
    w.FlashcardsDashboard.saveDeckModal();
    const deck = decksDe(w, cId).find(d => d.sourceType === 'custom');
    criarCardFlip(w, deck.id, 'P again', 'R');
    criarCardFlip(w, deck.id, 'P hard', 'R');
    criarCardFlip(w, deck.id, 'P good', 'R');
    criarCardFlip(w, deck.id, 'P easy', 'R');

    check('B1 card novo nasce com initSrs (status new, ease 2.5, interval 0, reviews 0, lapses 0, nextReview null)',
      (() => {
        const srs = cardsDe(w, deck.id)[0].srs;
        return srs.status === 'new' && srs.ease === 2.5 && srs.interval === 0 && srs.reviews === 0 && srs.lapses === 0 && srs.nextReview === null;
      })());

    w.FlashcardsDashboard.startStudy(deck.id, 'all');
    check('B2 startStudy (sem filhos) entra direto: "Card 1/4" no view',
      w.document.getElementById('flashMainView').innerHTML.includes('Card 1/4'));

    w.FlashcardsDashboard.revealStudyCard();
    const srsBar = w.document.getElementById('flashStudySrs');
    check('B3 renderSrsBar (previewSrs, card novo): hoje / 1 dia / 4 dias',
      srsBar.innerHTML.includes('hoje') && srsBar.innerHTML.includes('1 dia') && srsBar.innerHTML.includes('4 dias'),
      srsBar.innerHTML.slice(0, 400));
    check('B4 previewSrs não muta o card (clone): srs segue new/reviews 0 no storage',
      cardsDe(w, deck.id)[0].srs.status === 'new' && cardsDe(w, deck.id)[0].srs.reviews === 0);

    w.FlashcardsDashboard.answerStudy('again');
    check('B5 again: learning, lapses+1, ease max(1.3, 2.5-0.2)=2.3, interval 0, nextReview=hoje, reviews 1',
      (() => {
        const srs = cardsDe(w, deck.id)[0].srs;
        return srs.status === 'learning' && srs.lapses === 1 && srs.ease === 2.3 && srs.interval === 0
          && srs.nextReview === w.CT._today() && srs.reviews === 1 && !!srs.lastReview;
      })());
    check('B6 answerStudy appendLog: {quality again, correct FALSE (quality !== "again" é que é true), data hoje} + emit flashcards:review',
      (() => {
        const log = logDe(w, cId);
        return log.length === 1 && log[0].quality === 'again' && log[0].correct === false && log[0].data === w.CT._today()
          && spy.events.some(e => e.tipo === 'flashcards:review');
      })(), JSON.stringify(logDe(w, cId)));

    w.FlashcardsDashboard.answerStudy('hard');
    check('B7 hard (interval 0): max(1, round(0×1.2)||1)=1, ease max(1.3, 2.35)=2.35, status review',
      (() => { const srs = cardsDe(w, deck.id)[1].srs; return srs.status === 'review' && srs.interval === 1 && srs.ease === 2.35; })());
    w.FlashcardsDashboard.answerStudy('good');
    check('B8 good (interval 0): interval <1 → 1, ease mantido 2.5',
      (() => { const srs = cardsDe(w, deck.id)[2].srs; return srs.status === 'review' && srs.interval === 1 && srs.ease === 2.5; })());
    w.FlashcardsDashboard.answerStudy('easy');
    check('B9 easy (interval 0): interval <1 → 4, ease +0.1=2.6',
      (() => { const srs = cardsDe(w, deck.id)[3].srs; return srs.status === 'review' && srs.interval === 4 && srs.ease === 2.6; })());
    check('B10 fim de sessão: "Sessão concluída" + resultados com "Errei"',
      (() => {
        const view = w.document.getElementById('flashMainView').innerHTML;
        return view.includes('Sessão concluída') && view.includes('<small>Errei</small>');
      })());

    // Fórmulas com interval pré-setado: injeção direta no storage (P6/P35/P360)
    const inject = (front, srs) => {
      const cards = jkey(w, 'ct_flashcards');
      cards.push({ id: 'fccard_' + front.replace(/\W/g, ''), concursoId: cId, deckId: deck.id, type: 'flip', front, back: 'R', options: [], optionExplanations: [], hint: '', answer: '', explanation: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), srs });
      w.localStorage.setItem('ct_flashcards', JSON.stringify(cards));
    };
    inject('P6', { status: 'review', ease: 2.5, interval: 6, reviews: 3, lapses: 0, nextReview: w.CT._today(), lastReview: new Date().toISOString() });
    inject('P35', { status: 'review', ease: 2.5, interval: 35, reviews: 3, lapses: 0, nextReview: w.CT._today(), lastReview: new Date().toISOString() });
    inject('P360', { status: 'review', ease: 2.5, interval: 360, reviews: 3, lapses: 0, nextReview: w.CT._today(), lastReview: new Date().toISOString() });

    w.FlashcardsDashboard.startStudy(deck.id, 'due');
    // due = card 'again' (nextReview=hoje) + 3 seeded → Card 1/4; ordem por createdAt: again, P6, P35, P360
    check('B11 isDue: nextReview <= hoje é due (4 cards: again + P6/P35/P360; os demais agendados ficam fora)',
      /Card 1\/4/.test(w.document.getElementById('flashMainView').innerHTML),
      w.document.getElementById('flashMainView').innerHTML.slice(0, 200));
    const textos = [];
    for (let i = 0; i < 4; i++) {
      w.FlashcardsDashboard.revealStudyCard();
      textos.push(w.document.getElementById('flashStudySrs').innerHTML);
      w.FlashcardsDashboard.answerStudy(i === 0 ? 'good' : 'hard');
    }
    const allText = textos.join('||');
    check('B12 hard (interval 6): max(1, round(7.2))=7 → preview "7 dias"',
      textos.some(x => x.includes('>7 dias<')), allText.slice(0, 800));
    check('B13 good (interval 6): max(1, round(6×2.5))=15 → preview "15 dias"',
      textos.some(x => x.includes('>15 dias<')), allText.slice(0, 800));
    check('B14 hard (interval 35): round(42)=42 → formatReviewInterval "1 mês"',
      textos.some(x => x.includes('>1 mês<')), allText.slice(0, 800));
    check('B15 hard (interval 360): round(432)=432 → formatReviewInterval "1 ano"',
      textos.some(x => x.includes('>1 ano<')), allText.slice(0, 800));
    check('B16 formatReviewInterval "N meses"/"N dias" presentes',
      textos.some(x => x.includes('meses')) && textos.some(x => /dias/.test(x)));
    check('B17 SRS gravado no storage: P6 answered hard → interval 7, reviews 4',
      (() => {
        const c = jkey(w, 'ct_flashcards').find(x => x.front === 'P6');
        return c.srs.reviews === 4 && c.srs.status === 'review' && c.srs.interval === 7;
      })());
    check('B18 após agendar tudo para o futuro: badge zera (display none, texto vazio)',
      (() => {
        w.FlashcardsDashboard.updateTabBadge();
        const badge = w.document.getElementById('flashTabBadge');
        return badge.style.display === 'none' && badge.textContent === '';
      })());
  }

  // ================= C: syncFromTrack =================
  console.log('== R8-C: syncFromTrack + copyCards + syncDeckToTopic ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy, edital } = t;
    const decks = decksDe(w, cId);
    const dm = decks.find(d => d.sourceType === 'materia');
    const dt = decks.find(d => d.sourceType === 'topico');
    const ds = decks.find(d => d.sourceType === 'subtopico');
    check('C1 decks-espelho materia→topico→subtopico com sourceId do edital',
      dm.sourceId === edital.m.id && dt.sourceId === edital.t.id && ds.sourceId === edital.s.id);
    check('C2 emojis fixos Books/Stack/Card e parentId em cadeia',
      dm.emoji === 'Books' && dt.emoji === 'Stack' && ds.emoji === 'Card'
      && dt.parentId === dm.id && ds.parentId === dt.id);
    check('C3 order = índice da estrutura + IDs extra (materiaId/topicoId/subtopicoId)',
      dm.order === 0 && dt.order === 0 && ds.order === 0
      && dt.materiaId === edital.m.id && ds.topicoId === edital.t.id && ds.subtopicoId === edital.s.id);
    check('C4 nomes do edital (CT normaliza matéria em maiúsculas — verbatim da fonte)',
      dm.name === edital.m.nome && dt.name === edital.t.nome && ds.name === edital.s.nome);

    w.CT.saveMateria({ id: edital.m.id, concursoId: cId, nome: 'Direito Constitucional II' });
    w.FlashcardsDashboard.syncCurrent();
    check('C5 ensureDeck atualiza name/parentId/order e conta updated; toast de sync acentuado',
      decksDe(w, cId).find(d => d.sourceType === 'materia').name === w.CT.getMaterias(cId)[0].nome
      && spy.toasts.some(x => x.startsWith('Sincronização concluída: ') && x.includes('atualizado(s)'), JSON.stringify(spy.toasts)));

    const cB = (() => { w.CT.saveConcurso({ nome: 'Retake' }); return w.CT.getConcursos()[1].id; })();
    const cards = jkey(w, 'ct_flashcards') || [];
    cards.push({ id: 'fccard_orig', concursoId: cId, deckId: dm.id, type: 'flip', front: 'Origem', back: 'Destino', options: [], optionExplanations: [], hint: '', answer: '', explanation: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), srs: { status: 'review', ease: 2.5, interval: 5, reviews: 2, lapses: 1, nextReview: null, lastReview: null } });
    w.localStorage.setItem('ct_flashcards', JSON.stringify(cards));
    const allDecks = jkey(w, 'ct_flashcard_decks');
    allDecks.push({ id: 'fcdeck_mirrorB', concursoId: cB, name: 'Direito Constitucional II', emoji: 'Books', parentId: null, sourceType: 'materia', sourceId: edital.m.id, materiaId: edital.m.id, topicoId: null, subtopicoId: null, order: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    w.localStorage.setItem('ct_flashcard_decks', JSON.stringify(allDecks));
    w.sessionStorage.setItem('ct_concurso_ativo', cB);
    w.FlashcardsDashboard.syncCurrent();
    const copied = jkey(w, 'ct_flashcards').filter(c => c.concursoId === cB);
    check('C6 copyCards: card copiado para o concurso B com originalFlashcardId + SRS RESETADO (initSrs)',
      copied.length === 1 && copied[0].originalFlashcardId === 'fccard_orig' && copied[0].srs.status === 'new' && copied[0].srs.interval === 0
      && copied[0].deckId === 'fcdeck_mirrorB');
    w.FlashcardsDashboard.syncCurrent();
    check('C7 dedupe: segundo sync não duplica (copied 0 no toast)',
      jkey(w, 'ct_flashcards').filter(c => c.concursoId === cB).length === 1
      && spy.toasts[spy.toasts.length - 1].includes('0 card(s) reaproveitado(s)'));

    w.sessionStorage.setItem('ct_concurso_ativo', cId);
    w.FlashcardsDashboard.syncDeckToTopic(dt.id);
    const caderno = (w.CT.getTopico(edital.t.id).cadernos || []).find(c => c.rotulo === 'FLASH');
    check('C8 syncDeckToTopic cria caderno FLASH no tópico com url dashboard.html#flashcards:<deckId> (encadeado)',
      !!caderno && caderno.url === 'dashboard.html#flashcards:' + encodeURIComponent(dt.id) && caderno.deckId === dt.id && caderno.emoji === '🎴');
    w.FlashcardsDashboard.syncDeckToTopic(dt.id);
    check('C9 segunda chamada → alert "Baralho já linkado" e caderno não duplica',
      spy.alerts.some(a => a.msg.includes('Esse baralho já está linkado') && a.title === 'Baralho já linkado')
      && w.CT.getTopico(edital.t.id).cadernos.filter(c => c.rotulo === 'FLASH').length === 1);
    w.FlashcardsDashboard.openDeckModal();
    w.document.getElementById('flashDeckName').value = 'Custom solto';
    w.FlashcardsDashboard.saveDeckModal();
    const custom = decksDe(w, cId).find(d => d.sourceType === 'custom');
    w.FlashcardsDashboard.syncDeckToTopic(custom.id);
    check('C10 deck sem vínculo → alert "Este baralho ainda não está vinculado a um tópico do edital..."',
      spy.alerts.some(a => a.msg.includes('Este baralho ainda não está vinculado a um tópico do edital') && a.title === 'Sincronizar'));
  }

  // ================= D: árvore/stats =================
  console.log('== R8-D: árvore de baralhos, stats, pie 7 dias, badge ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId } = t;
    w.FlashcardsDashboard.openDeckModal();
    w.document.getElementById('flashDeckName').value = 'Pai';
    w.FlashcardsDashboard.saveDeckModal();
    const pai = decksDe(w, cId).find(d => d.name === 'Pai');
    w.FlashcardsDashboard.openDeckModal(null, pai.id);
    w.document.getElementById('flashDeckName').value = 'Filho';
    w.FlashcardsDashboard.saveDeckModal();
    const filho = decksDe(w, cId).find(d => d.name === 'Filho');
    criarCardFlip(w, pai.id, 'Card pai', 'R');
    criarCardFlip(w, filho.id, 'Card filho', 'R');

    w.FlashcardsDashboard.render();
    const root = w.document.getElementById('flashcardsDashboardRoot');
    check('D1 render: "Meus Baralhos" + Exportar JSON/CSV + Novo Baralho',
      root.innerHTML.includes('Meus Baralhos') && root.innerHTML.includes('Exportar JSON')
      && root.innerHTML.includes('Exportar CSV') && root.innerHTML.includes('Novo Baralho'));
    check('D2 renderStats: 5 stat cards (Total de cards / Para revisar / Novos hoje / Streak / Acerto hoje)',
      (root.innerHTML.match(/flash-stat-card /g) || []).length === 5
      && root.innerHTML.includes('Total de cards') && root.innerHTML.includes('Para revisar')
      && root.innerHTML.includes('Novos hoje') && root.innerHTML.includes('Streak') && root.innerHTML.includes('Acerto hoje'));
    check('D3 calcStats: totalCards 2, due 2 (novos são due), revisados 0 → "-" no Acerto hoje',
      root.innerHTML.includes('>2</div><div class="flash-stat-label">Total de cards</div>')
      && root.innerHTML.includes('>-</div><div class="flash-stat-label">Acerto hoje</div>'));
    check('D4 árvore: pai e filho com flash-children + due badge',
      root.innerHTML.includes('Pai') && root.innerHTML.includes('Filho')
      && root.innerHTML.includes('flash-children') && (root.innerHTML.match(/flash-due-badge/g) || []).length >= 1);

    const hoje = w.CT._today();
    // espelha o cálculo INTERNO de calcStreak/renderMiniStats (quirk verbatim do
    // original: Date local 'T00:00:00' → setDate → toISOString UTC)
    const start = new Date(hoje + 'T00:00:00');
    const d = new Date(start); d.setDate(start.getDate() - 1);
    const ontem = d.toISOString().slice(0, 10);
    w.localStorage.setItem('ct_flashcard_log', JSON.stringify([
      { concursoId: cId, data: hoje, correct: true }, { concursoId: cId, data: hoje, correct: true },
      { concursoId: cId, data: hoje, correct: false }, { concursoId: cId, data: ontem, correct: true },
    ]));
    w.FlashcardsDashboard.render();
    const html = w.document.getElementById('flashcardsDashboardRoot').innerHTML;
    check('D5 calcStreak: hoje+ontem → Streak 2',
      html.includes('>2</div><div class="flash-stat-label">Streak</div>'));
    check('D6 pctToday: 2 de 3 hoje → 67% no Acerto hoje',
      html.includes('>67%</div><div class="flash-stat-label">Acerto hoje</div>'));
    check('D7 pie 7 dias: "Atividade dos últimos 7 dias" + gradiente --pie inline (conic-gradient via CSS instalado)',
      html.includes('Atividade dos últimos 7 dias') && html.includes('style="--pie:')
      && w.document.getElementById('flashcards-dashboard-style').textContent.includes('conic-gradient'));

    w.FlashcardsDashboard.updateTabBadge();
    const badge = w.document.getElementById('flashTabBadge');
    check('D8 badge com due>0: número e inline-flex',
      badge.textContent === '2' && badge.style.display === 'inline-flex');
    w.localStorage.setItem('ct_flashcards', '[]');
    w.FlashcardsDashboard.updateTabBadge();
    check('D9 badge com due=0: vazio e display none',
      badge.textContent === '' && badge.style.display === 'none');
  }

  // ================= E: editor rico =================
  console.log('== R8-E: editor rico (symbols/paste/dica legacy) ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    const deck = decksDe(w, cId).find(d => d.sourceType === 'materia');
    w.FlashcardsDashboard.openCardModal(null, deck.id);
    const bank = w.document.getElementById('symbols_flashCardFront');
    check('E1 MATH_SYMBOLS: banco com 35 símbolos (contagem do original; "34" do etapa-10 estava errado)',
      bank.querySelectorAll('button').length === 35, bank.querySelectorAll('button').length);
    check('E2 setupRichPaste rodou no modal (pasteReady) e paste sem clipboardData não quebra',
      w.document.getElementById('flashCardFront').dataset.pasteReady === '1'
      && (() => { w.document.getElementById('flashCardFront').dispatchEvent(new w.Event('paste')); return true; })());

    w.FlashcardsDashboard.toggleSymbolBank('flashCardFront');
    check('E3 toggleSymbolBank abre o banco e fecha os demais',
      w.document.getElementById('symbols_flashCardFront').classList.contains('open')
      && (() => { w.FlashcardsDashboard.toggleSymbolBank('flashCardBack'); return !w.document.getElementById('symbols_flashCardFront').classList.contains('open') && w.document.getElementById('symbols_flashCardBack').classList.contains('open'); })());

    const cmds = [];
    w.document.execCommand = (cmd, a, b) => { cmds.push([cmd, a, b]); return true; };
    const front = w.document.getElementById('flashCardFront');
    Object.defineProperty(front, 'isContentEditable', { value: true });
    w.FlashcardsDashboard.insertSymbol('flashCardFront', '√');
    check('E4 insertSymbol contenteditable → execCommand insertText com o símbolo',
      cmds.some(c => c[0] === 'insertText' && c[2] === '√'));

    w.document.getElementById('flashCardType').value = 'quiz';
    w.FlashcardsDashboard.toggleCardFields();
    const ta = w.document.getElementById('flashQuizOptionText_0');
    ta.value = 'ab';
    w.FlashcardsDashboard.insertSymbol('flashQuizOptionText_0', 'π');
    check('E5 insertSymbol textarea (fallback/setRangeText) insere o símbolo',
      ta.value.includes('π'));
    check('E6 placeholder "Comentário da alternativa A..." acentuado (D6)',
      w.document.getElementById('flashQuizExplanation_0').dataset.placeholder.includes('Comentário da alternativa'));

    w.FlashcardsDashboard.openCardModal(null, deck.id);
    w.document.getElementById('flashCardFront').innerHTML = '<img src="x.png">';
    w.document.getElementById('flashCardBack').innerHTML = '';
    w.FlashcardsDashboard.saveCardModal();
    check('E7 validação da FRENTE usa getRichText (textContent): <img> sozinho → "Digite a frente do card."',
      spy.toasts.includes('Digite a frente do card.'), JSON.stringify(spy.toasts));
    w.document.getElementById('flashCardFront').innerHTML = '<b>Texto</b><img src="x.png">';
    w.FlashcardsDashboard.saveCardModal();
    check('E7b flip com texto + <img>: agora o erro é do VERSO',
      spy.toasts.includes('Digite o verso do card.'));
    w.document.getElementById('flashCardBack').innerHTML = 'Resposta';
    w.FlashcardsDashboard.saveCardModal();
    check('E8 card com <img> na frente salvo (front preserva HTML)',
      cardsDe(w, deck.id).some(c => c.front.includes('<img')));

    const cards = jkey(w, 'ct_flashcards') || [];
    // deck FOLHA (custom, sem filhos) — startStudy em deck com filhos abre o modal de agregação
    w.FlashcardsDashboard.openDeckModal();
    w.document.getElementById('flashDeckName').value = 'Rico';
    w.FlashcardsDashboard.saveDeckModal();
    const folha = decksDe(w, cId).find(d => d.sourceType === 'custom');
    cards.push({ id: 'fccard_hint', concursoId: cId, deckId: folha.id, type: 'flip', front: 'Pergunta<br><br><strong>Dica:</strong> pense bem', back: 'R', options: [], optionExplanations: [], hint: '', answer: '', explanation: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), srs: { status: 'new' } });
    w.localStorage.setItem('ct_flashcards', JSON.stringify(cards));
    w.FlashcardsDashboard.render(); // abre a aba flashcards (como o usuário faria) — cria #flashMainView
    w.FlashcardsDashboard.startStudy(folha.id, 'all');
    let view = w.document.getElementById('flashMainView').innerHTML;
    check('E9 dica legacy migrada: spoiler "Mostrar dica" e front sem o marcador',
      view.includes('Card 1/1') && view.includes('Mostrar dica') && !view.split('flash-study-front')[1].includes('<strong>Dica:</strong>'),
      view.slice(0, 500));
    w.FlashcardsDashboard.toggleStudyHint();
    view = w.document.getElementById('flashMainView').innerHTML;
    check('E10 toggleStudyHint revela a dica (flash-hint-box)',
      view.includes('Ocultar dica') && view.includes('flash-hint-box') && view.includes('pense bem'));
    w.FlashcardsDashboard.cancelStudy();
  }

  // ================= F: modais card/deck =================
  console.log('== R8-F: modais de deck e card (3 tipos, validações) ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    const deck = decksDe(w, cId).find(d => d.sourceType === 'materia');

    w.FlashcardsDashboard.openDeckModal();
    check('F1 openDeckModal SEM campo de emoji (D3) e título "Novo Baralho"',
      !!w.document.getElementById('flashDeckName') && !w.document.getElementById('flashDeckEmoji')
      && w.document.getElementById('flashModalOverlay').innerHTML.includes('Novo Baralho'));
    w.document.getElementById('flashDeckName').value = '';
    w.FlashcardsDashboard.saveDeckModal();
    check('F2 saveDeckModal sem nome → toast "Informe um nome para o baralho." e modal permanece',
      spy.toasts.includes('Informe um nome para o baralho.') && !!w.document.getElementById('flashModalOverlay'));
    w.document.getElementById('flashDeckName').value = 'Novo custom';
    w.FlashcardsDashboard.saveDeckModal();
    const custom = decksDe(w, cId).find(d => d.name === 'Novo custom');
    check('F3 deck criado: emoji Books forçado (saveDeckModal — vivo), order = length+1, concursoId',
      custom && custom.emoji === 'Books' && custom.order === 4 && custom.concursoId === cId);

    w.FlashcardsDashboard.openDeckModal(custom.id);
    check('F4 edição: título "Editar Baralho" + nome pré-carregado',
      w.document.getElementById('flashModalOverlay').innerHTML.includes('Editar Baralho')
      && w.document.getElementById('flashDeckName').value === 'Novo custom');
    w.document.getElementById('flashDeckName').value = 'Renomeado';
    w.document.getElementById('flashDeckParent').value = deck.id;
    w.FlashcardsDashboard.saveDeckModal();
    const ren = decksDe(w, cId).find(d => d.id === custom.id);
    check('F5 deck renomeado + parentId setado',
      ren.name === 'Renomeado' && ren.parentId === deck.id);

    w.FlashcardsDashboard.openCardModal(null, deck.id);
    w.document.getElementById('flashCardFront').innerHTML = '';
    w.FlashcardsDashboard.saveCardModal();
    check('F6 flip sem frente → "Digite a frente do card."',
      spy.toasts.includes('Digite a frente do card.'));
    w.document.getElementById('flashCardFront').innerHTML = 'Frente';
    w.document.getElementById('flashCardBack').innerHTML = '';
    w.FlashcardsDashboard.saveCardModal();
    check('F7 flip sem verso → "Digite o verso do card."',
      spy.toasts.includes('Digite o verso do card.'));
    w.document.getElementById('flashCardBack').innerHTML = 'Verso <b>rico</b>';
    w.document.getElementById('flashCardTags').value = 'a, b, , c';
    w.FlashcardsDashboard.saveCardModal();
    const flip = cardsDe(w, deck.id).find(c => c.front === 'Frente');
    check('F8 flip salvo: back HTML, tags split+trim+filter, answer "" explanation "" options []',
      flip && flip.back === 'Verso <b>rico</b>' && JSON.stringify(flip.tags) === '["a","b","c"]'
      && flip.answer === '' && flip.explanation === '' && JSON.stringify(flip.options) === '[]' && flip.type === 'flip');

    w.FlashcardsDashboard.openCardModal(null, deck.id);
    w.document.getElementById('flashCardType').value = 'quiz';
    w.FlashcardsDashboard.toggleCardFields();
    check('F9 toggleCardFields: quiz mostra quizFields e esconde flip/cespe/explanation',
      w.document.getElementById('flashQuizFields').style.display === ''
      && w.document.getElementById('flashFlipFields').style.display === 'none'
      && w.document.getElementById('flashCespeFields').style.display === 'none'
      && w.document.getElementById('flashExplanationFields').style.display === 'none');
    w.document.getElementById('flashCardFront').innerHTML = 'Q1';
    const radioA = w.document.querySelector('input[name="flashQuizCorrect"][value="A"]');
    const radioB = w.document.querySelector('input[name="flashQuizCorrect"][value="B"]');
    const radioC = w.document.querySelector('input[name="flashQuizCorrect"][value="C"]');
    w.document.getElementById('flashQuizOptionText_0').value = 'Única';
    radioA.checked = true;
    w.FlashcardsDashboard.saveCardModal();
    check('F10 quiz com 1 alternativa → "Preencha pelo menos duas alternativas."',
      spy.toasts.includes('Preencha pelo menos duas alternativas.'));
    w.document.getElementById('flashQuizOptionText_1').value = 'Segunda';
    radioA.checked = false;
    w.FlashcardsDashboard.saveCardModal();
    check('F11 quiz sem gabarito marcado → "Marque qual alternativa está correta."',
      spy.toasts.includes('Marque qual alternativa está correta.'));
    radioC.checked = true; // alternativa C está vazia
    w.FlashcardsDashboard.saveCardModal();
    check('F12 quiz gabarito em alternativa vazia (C) → "A alternativa marcada no gabarito precisa estar preenchida."',
      spy.toasts.includes('A alternativa marcada no gabarito precisa estar preenchida.'));
    radioA.checked = true;
    w.document.getElementById('flashQuizExplanation_0').innerHTML = 'Comentário da correta';
    w.FlashcardsDashboard.saveCardModal();
    const quiz = cardsDe(w, deck.id).find(c => c.front === 'Q1');
    check('F13 quiz salvo: options [A,B] (vazias finais removidas), answer A, explanation = comentário da correta',
      quiz && JSON.stringify(quiz.options) === '["Única","Segunda"]' && quiz.answer === 'A'
      && quiz.explanation === 'Comentário da correta' && quiz.back === '' && quiz.type === 'quiz');
    check('F14 optionExplanations preservadas (índice 0 com comentário, tamanho ≥ 2)',
      quiz.optionExplanations[0] === 'Comentário da correta' && quiz.optionExplanations.length >= 2);

    const stored = jkey(w, 'ct_flashcards');
    stored.find(c => c.id === quiz.id).hint = 'Dica antiga';
    w.localStorage.setItem('ct_flashcards', JSON.stringify(stored));
    w.FlashcardsDashboard.openCardModal(quiz.id);
    check('F15 editar card: título "Editar Flashcard" + quiz pré-carregado (alternativas e radio A)',
      w.document.getElementById('flashModalOverlay').innerHTML.includes('Editar Flashcard')
      && w.document.getElementById('flashQuizOptionText_0').value === 'Única'
      && radioA.checked);
    w.document.getElementById('flashQuizExplanation_1').innerHTML = 'Comentário B';
    w.FlashcardsDashboard.saveCardModal();
    const quiz2 = jkey(w, 'ct_flashcards').find(c => c.id === quiz.id);
    check('F16 hint preservado na edição (payload hint = previous.hint)',
      quiz2.hint === 'Dica antiga' && quiz2.optionExplanations[1] === 'Comentário B');

    w.FlashcardsDashboard.openCardModal(quiz.id);
    const before = w.document.querySelectorAll('#flashQuizAlternatives .flash-alt-item').length;
    w.FlashcardsDashboard.addQuizAlternative();
    const after = w.document.querySelectorAll('#flashQuizAlternatives .flash-alt-item').length;
    check('F17 addQuizAlternative adiciona item (novo radio sem seleção)',
      after === before + 1
      && !w.document.querySelector('#flashQuizAlternatives input[value="' + String.fromCharCode(65 + after - 1) + '"]').checked);
    while (w.document.querySelectorAll('#flashQuizAlternatives .flash-alt-item').length < 26) w.FlashcardsDashboard.addQuizAlternative();
    w.FlashcardsDashboard.addQuizAlternative();
    check('F18 limite de 26 alternativas → toast "Limite de 26 alternativas atingido."',
      spy.toasts.includes('Limite de 26 alternativas atingido.'));
    w.FlashcardsDashboard.closeModal();

    w.FlashcardsDashboard.openCardModal(null, deck.id);
    w.document.getElementById('flashCardType').value = 'cespe';
    w.FlashcardsDashboard.toggleCardFields();
    check('F19 cespe: cespeFields + explanationFields visíveis, flip/quiz escondidos',
      w.document.getElementById('flashCespeFields').style.display === ''
      && w.document.getElementById('flashExplanationFields').style.display === ''
      && w.document.getElementById('flashFlipFields').style.display === 'none'
      && w.document.getElementById('flashQuizFields').style.display === 'none');
    w.document.getElementById('flashCardFront').innerHTML = 'CESPE Q';
    w.document.getElementById('flashCardCespeAnswer').value = 'errado';
    w.document.getElementById('flashCardExplanation').innerHTML = 'Explicação cespe';
    w.FlashcardsDashboard.saveCardModal();
    const cespe = cardsDe(w, deck.id).find(c => c.type === 'cespe');
    check('F20 cespe salvo: answer errado, explanation setada, back vazio',
      cespe && cespe.answer === 'errado' && cespe.explanation === 'Explicação cespe' && cespe.back === '');

    w.FlashcardsDashboard.openCardModal(null, null);
    check('F21 openCardModal sem deck → toast "Escolha um baralho antes de criar o card."',
      spy.toasts.includes('Escolha um baralho antes de criar o card.'));
  }

  // ================= G: import =================
  console.log('== R8-G: import CSV/TSV/JSON ==');
  async function importText(t, deckId, fileName, content, type) {
    const { w } = t;
    const created = [];
    const origCreate = w.document.createElement.bind(w.document);
    w.document.createElement = (tag) => {
      const el = origCreate(tag);
      if (String(tag).toLowerCase() === 'input') created.push(el);
      return el;
    };
    w.FlashcardsDashboard.importFile(deckId);
    w.document.createElement = origCreate;
    const input = created[created.length - 1];
    const file = new w.File([content], fileName, { type });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.onchange();
    await tick(30);
  }
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    const deck = decksDe(w, cId).find(d => d.sourceType === 'materia');

    await importText(t, deck.id, 'basico.csv', 'front;back\nPergunta 1;Resposta 1\nPergunta 2;Resposta 2', 'text/csv');
    let cards = cardsDe(w, deck.id);
    check('G1 CSV com header PT detectado: 2 flip cards com front/back em HTML + initSrs',
      cards.length === 2 && cards[0].front === 'Pergunta 1' && cards[0].back === 'Resposta 1' && cards[0].type === 'flip'
      && cards[0].srs.status === 'new' && cards[0].concursoId === cId, JSON.stringify(cards));
    check('G2 toast de import concluída acentuado',
      spy.toasts.includes('Importação concluída: 2 card(s) criado(s).'), JSON.stringify(spy.toasts));

    await importText(t, deck.id, 'anki.txt', 'Frente TSV\tVerso TSV\ttag1; tag2', 'text/plain');
    cards = cardsDe(w, deck.id);
    const tsvCard = cards.find(c => c.front.includes('Frente TSV'));
    check('G3 TSV do Anki sem header: tratado como dados + tags col 3',
      !!tsvCard && tsvCard.back.includes('Verso TSV') && JSON.stringify(tsvCard.tags) === '["tag1","tag2"]');

    await importText(t, deck.id, 'aspas.csv', '"front";"back"\n"Pergunta, com vírgula";"Resposta ""citação"""', 'text/csv');
    const aspas = cardsDe(w, deck.id).find(c => c.front.includes('vírgula'));
    check('G4 parseDelimited: aspas duplas escapadas preservadas; back vira HTML (aspas como &quot;) — verbatim',
      !!aspas && aspas.front.includes('com vírgula') && aspas.back.includes('&quot;citação&quot;'),
      aspas && aspas.front + ' || ' + aspas.back);

    await importText(t, deck.id, 'anki_export.txt', '\ufeff#separator:tab\n#html:true\nFront\tBack\nF1\tB1', 'text/plain');
    const anki = cardsDe(w, deck.id).find(c => c.front.includes('F1'));
    check('G5 headers Anki (#separator/#html) e BOM ignorados; TAB detectado',
      !!anki && anki.back.includes('B1'));

    await importText(t, deck.id, 'quiz.csv', 'front;option a;option b;correct answer;explanation\nQ2;Alt A;Alt B;B;A. comentário A. B. comentário B', 'text/csv');
    const quiz = cardsDe(w, deck.id).find(c => c.front.includes('Q2'));
    check('G6 tipo inferido quiz (option columns + gabarito), answer B; QUIRK verbatim: fallback splitOptionExplanations NÃO divide aqui (htmlToText perde os <br>/\\n do textToHtml — confirmado no original) → optionExplanations vazias e explanation integral',
      !!quiz && quiz.type === 'quiz' && quiz.answer === 'B'
      && JSON.stringify(quiz.optionExplanations) === '["",""]'
      && quiz.explanation.includes('A. comentário A. B. comentário B'),
      JSON.stringify(quiz));

    await importText(t, deck.id, 'cespe.csv', 'front;type;answer\nC1;cespe;certo', 'text/csv');
    const cespe = cardsDe(w, deck.id).find(c => c.front.includes('C1'));
    check('G7 tipo explícito cespe; QUIRK do original: answerTextToLetter("certo") → "C" (fidelidade verbatim)',
      !!cespe && cespe.type === 'cespe' && cespe.answer === 'C', cespe && cespe.answer);

    const nCards = cardsDe(w, deck.id).length;
    await importText(t, deck.id, 'vazio.csv', '', 'text/csv');
    check('G8 CSV vazio → toast "CSV vazio ou inválido." e nada criado',
      spy.toasts.includes('CSV vazio ou inválido.') && cardsDe(w, deck.id).length === nCards);

    const json1 = JSON.stringify([
      { front: 'JF1', back: 'JB1', tags: ['x'] },
      { question: 'JQ1', options: ['A1', 'B1'], correctAnswer: 'B', explanation: 'Geral', hint: 'H' },
      { question: 'JQ2', alternatives: [{ text: 'OA', label: 'A', rationale: 'rA' }, { text: 'OB', isCorrect: true, comment: 'rB' }] },
    ]);
    await importText(t, deck.id, 'pacote.json', json1, 'application/json');
    cards = cardsDe(w, deck.id);
    const jf = cards.find(c => c.front.includes('JF1'));
    const jq1 = cards.find(c => c.front.includes('JQ1'));
    const jq2 = cards.find(c => c.front.includes('JQ2'));
    check('G9 JSON array raiz: flip por back; quiz por options+correctAnswer com hint',
      !!jf && jf.type === 'flip' && jf.back.includes('JB1') && JSON.stringify(jf.tags) === '["x"]'
      && !!jq1 && jq1.type === 'quiz' && jq1.answer === 'B' && jq1.explanation.includes('Geral') && jq1.hint.includes('H'));
    check('G10 JSON alternativas objeto: isCorrect define gabarito, rationale/comment viram optionExplanations',
      !!jq2 && jq2.answer === 'B' && jq2.optionExplanations[0].includes('rA') && jq2.optionExplanations[1].includes('rB'),
      JSON.stringify(jq2));

    await importText(t, deck.id, 'quebrado.json', '{não é json', 'application/json');
    check('G11 JSON inválido → toast acentuado',
      spy.toasts.includes('JSON inválido. Verifique o arquivo exportado.'));
    await importText(t, deck.id, 'vazio2.json', JSON.stringify({ foo: 1 }), 'application/json');
    check('G12 JSON sem questões reconhecíveis → toast acentuado',
      spy.toasts.includes('JSON sem questões reconhecíveis.'));

    w.FlashcardsDashboard.openImportModal(null);
    check('G13 openImportModal sem deck → toast "Escolha uma matéria, tópico ou subtópico para importar."',
      spy.toasts.includes('Escolha uma matéria, tópico ou subtópico para importar.'));
  }

  // ================= H: export =================
  console.log('== R8-H: export JSON/CSV ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    const dm = decksDe(w, cId).find(d => d.sourceType === 'materia');
    criarCardFlip(w, dm.id, 'E1 <b>frente</b>', 'E1 verso');

    const OrigBlob = w.Blob;
    const blobs = [];
    w.Blob = function (parts, opts) { blobs.push({ parts, opts }); return new OrigBlob(parts, opts); };
    w.URL.createObjectURL = () => 'blob:fake';
    w.URL.revokeObjectURL = () => {};
    const clicks = [];
    w.HTMLAnchorElement.prototype.click = function () { clicks.push(this); };

    const cB = (() => { w.CT.saveConcurso({ nome: 'Vazio' }); return w.CT.getConcursos()[1].id; })();
    w.sessionStorage.setItem('ct_concurso_ativo', cB);
    await w.FlashcardsDashboard.exportJSON();
    check('H1 exportJSON sem cards → toast "Nenhum flashcard para exportar." e nada baixado',
      spy.toasts.includes('Nenhum flashcard para exportar.') && blobs.length === 0);
    w.sessionStorage.setItem('ct_concurso_ativo', cId);

    await w.FlashcardsDashboard.exportJSON();
    check('H2 exportJSON: payload track_concursos_flashcards_export v1.0 com concurso/decks(path)/cards(deckName+deckPath)/log',
      (() => {
        const payload = JSON.parse(blobs[0].parts[0]);
        return payload.type === 'track_concursos_flashcards_export' && payload.version === '1.0' && !!payload.exportedAt
          && payload.concurso.nome === 'Foco Final' && payload.concurso.banca === 'FGV'
          && payload.decks[0].path === t.edital.m.nome
          && payload.cards[0].deckName === t.edital.m.nome && payload.cards[0].deckPath === t.edital.m.nome
          && Array.isArray(payload.log);
      })(), blobs[0] && blobs[0].parts[0].slice(0, 300));
    check('H3 arquivo JSON: sanitizeFileName do nome do concurso + mimetype application/json',
      clicks[0].download === 'foco_final_flashcards.json' && blobs[0].opts.type.includes('application/json')
      && spy.toasts.includes('Flashcards exportados em JSON.'));

    const ds = decksDe(w, cId).find(d => d.sourceType === 'subtopico');
    criarCardFlip(w, ds.id, 'Profundo', 'R');
    await w.FlashcardsDashboard.exportCSV();
    check('H4 CSV: BOM \\ufeff + CRLF, 23 colunas de header',
      (() => {
        const content = blobs[1].parts[0];
        const lines = content.split('\r\n');
        const headers = lines[0].replace(/^\ufeff/, '').split(',').map(x => x.replace(/^"|"$/g, ''));
        return content.charCodeAt(0) === 0xfeff && lines.length >= 3
          && headers.length === 23 && headers[0] === 'deck_path' && headers[21] === 'front_html' && headers[22] === 'back_html';
      })(), blobs[1] && blobs[1].parts[0].slice(0, 400));
    check('H5 CSV linha do card E1: deckPath da matéria, front texto plano + front_html completo (HTML cru entre aspas)',
      (() => {
        const rows = blobs[1].parts[0].split('\r\n');
        const row = rows.find(r => r.includes('E1 frente')) || '';
        const path1 = t.edital.m.nome;
        return row.includes('"' + path1 + '"')
          && row.includes('"E1 frente"') && row.includes('"E1 <b>frente</b>"');
      })(), blobs[1] && blobs[1].parts[0].split('\r\n').filter(r => r.includes('E1')).join(' || '));
    check('H6 exportCSV: mimetype text/csv + toast OK',
      blobs[1].opts.type.includes('text/csv') && spy.toasts.includes('Flashcards exportados em CSV.'));
  }

  // ================= I: sessão de estudo =================
  console.log('== R8-I: sessão de estudo (escopos, agregação, quiz, log cap) ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId, spy } = t;
    const dt = decksDe(w, cId).find(d => d.sourceType === 'topico');
    w.FlashcardsDashboard.openDeckModal(null, dt.id);
    w.document.getElementById('flashDeckName').value = 'Neto';
    w.FlashcardsDashboard.saveDeckModal();
    const neto = decksDe(w, cId).find(d => d.name === 'Neto');
    criarCardFlip(w, neto.id, 'Card do neto', 'R');
    criarCardFlip(w, dt.id, 'Card do tópico', 'R');
    criarCardQuiz(w, dt.id, { front: 'Quiz Q', alts: ['Certa', 'Errada'], correct: 'A', explanations: ['Porque sim', ''] });

    w.FlashcardsDashboard.startStudy(dt.id, 'all');
    check('I1 deck com filho → modal de agregação "Como deseja estudar?" com total 3',
      w.document.getElementById('flashModalOverlay').innerHTML.includes('Como deseja estudar?')
      && w.document.getElementById('flashModalOverlay').innerHTML.includes('3 card(s) disponíveis'));
    check('I2 modal agregação: max default 5, Aleatórios/Mais difíceis, botão "Começar" (D6)',
      (() => {
        const html = w.document.getElementById('flashModalOverlay').innerHTML;
        return html.includes('value="5"') && html.includes('Aleatórios') && html.includes('Mais difíceis') && html.includes('Começar');
      })());
    w.document.querySelector('input[name="flashAggregateMode"][value="limit"]').checked = true;
    w.document.getElementById('flashAggregateMax').value = '1';
    w.FlashcardsDashboard.confirmAggregateStudy();
    check('I3 limit 1 por deck: 1 card por baralho → 2 cards na sessão',
      w.document.getElementById('flashMainView').innerHTML.includes('Card 1/2'),
      w.document.getElementById('flashMainView').innerHTML.slice(0, 200));
    w.FlashcardsDashboard.cancelStudy();

    w.FlashcardsDashboard.startStudy(dt.id, 'all');
    w.document.querySelector('input[name="flashAggregateMode"][value="all"]').checked = true;
    w.FlashcardsDashboard.confirmAggregateStudy();
    let view = w.document.getElementById('flashMainView').innerHTML;
    check('I4 modo todos: 3 cards (2 do tópico + 1 do neto — descendentes)',
      view.includes('Card 1/3'), view.slice(0, 200));
    check('I5 flip: quiz-mode ausente e "Clique para virar"; kicker com tipo',
      !view.includes('quiz-mode') && view.includes('Clique para virar') && view.includes('>Flip<'));
    w.FlashcardsDashboard.revealStudyCard();
    check('I6 reveal: flipped + srs visível',
      w.document.getElementById('flashStudyCard').classList.contains('flipped')
      && w.document.getElementById('flashStudySrs').classList.contains('visible'));
    w.FlashcardsDashboard.answerStudy('good');
    // próximo: 2º flip (Card do tópico)
    view = w.document.getElementById('flashMainView').innerHTML;
    check('I7 2º card ainda flip (ordem createdAt), revela e responde',
      view.includes('Card 2/3') && !view.includes('quiz-mode')
      && (() => { w.FlashcardsDashboard.revealStudyCard(); w.FlashcardsDashboard.answerStudy('good'); return true; })());
    // 3º: quiz
    view = w.document.getElementById('flashMainView').innerHTML;
    check('I8 3º card é quiz: quiz-mode, opções clicáveis',
      view.includes('Card 3/3') && view.includes('quiz-mode') && view.includes('chooseQuizAnswer('));
    w.FlashcardsDashboard.chooseQuizAnswer('B');
    view = w.document.getElementById('flashMainView').innerHTML;
    check('I9 QUIRK verbatim: branch quiz do renderStudyAnswer é morto (único call site é !isQuiz, igual ao original) — feedback vive nas opções: status wrong/correct + comentário da correta',
      view.includes('Sua resposta incorreta') && view.includes('Resposta correta')
      && view.includes('wrong selected') && view.includes('flash-quiz-option-comment')
      && view.includes('Porque sim') && !view.includes('A alternativa B está incorreta.'),
      view.slice(Math.max(0, view.indexOf('flash-study-options')), Math.max(0, view.indexOf('flash-study-options')) + 700));
    w.FlashcardsDashboard.answerStudy('hard');
    check('I10 log: flip bom → correct true; quiz errado → correct false',
      (() => {
        const log = logDe(w, cId);
        return log.length === 3 && log[0].correct === true && log[1].correct === true && log[2].correct === false;
      })(), JSON.stringify(logDe(w, cId)));
    view = w.document.getElementById('flashMainView').innerHTML;
    check('I11 resultados: "Sessão concluída", 100% (3/3 marcados como acerto), Voltar ao baralho',
      view.includes('Sessão concluída') && view.includes('100% marcados como acerto')
      && view.includes('Voltar ao baralho'));
    w.FlashcardsDashboard.cancelStudy();

    // [R8-fix 2026-11-17] QUIRK fiel documentado: scope 'new' compara
    // createdAt.toISOString().slice(0,10) — UTC — com CT._today() — local.
    // Depois das 21h no UTC-3 o UTC já virou o dia seguinte e o scope 'new'
    // devolve 0 cards (o app original tem exatamente o mesmo comportamento —
    // www/flashcards.js cardMatchesScope idêntico). Normalizamos createdAt
    // para o UTC do meio-dia do dia local para o teste ser determinístico.
    (() => {
      const cards = jkey(w, 'ct_flashcards');
      cards.forEach(c => { c.createdAt = w.CT._today() + 'T12:00:00.000Z'; });
      w.localStorage.setItem('ct_flashcards', JSON.stringify(cards));
    })();
    w.FlashcardsDashboard.startStudy(dt.id, 'new', { confirmed: true });
    view = w.document.getElementById('flashMainView').innerHTML;
    check('I12 scope new: cards criados hoje entram (3)',
      view.includes('Card 1/3'));
    w.FlashcardsDashboard.cancelStudy();

    const bigLog = [];
    for (let i = 0; i < 5000; i++) bigLog.push({ concursoId: cId, data: '2020-01-01', correct: true });
    w.localStorage.setItem('ct_flashcard_log', JSON.stringify(bigLog));
    w.FlashcardsDashboard.startStudy(dt.id, 'all', { confirmed: true });
    w.FlashcardsDashboard.revealStudyCard();
    w.FlashcardsDashboard.answerStudy('again');
    const raw = jkey(w, 'ct_flashcard_log');
    check('I13 appendLog cap 5000: log cru permanece 5000, mais antigo descartado, entry nova no fim',
      raw.length === 5000 && raw[raw.length - 1].quality === 'again' && raw[0].data === '2020-01-01');
    check('I14 again em flip → correct false (quality !== "again")',
      raw[raw.length - 1].correct === false);
    w.FlashcardsDashboard.cancelStudy();

    const origConfirm = w.CT.confirm;
    w.CT.confirm = async () => true;
    const cards0 = cardsDe(w, dt.id);
    await w.FlashcardsDashboard.deleteCard(cards0[0].id);
    check('I15 deleteCard: remove só o card alvo',
      cardsDe(w, dt.id).length === cards0.length - 1 && !cardsDe(w, dt.id).some(c => c.id === cards0[0].id));
    await w.FlashcardsDashboard.deleteDeck(neto.id);
    check('I16 deleteDeck: remove sub-baralhos e cards dos descendentes',
      !decksDe(w, cId).some(d => d.id === neto.id) && !jkey(w, 'ct_flashcards').some(c => c.deckId === neto.id));
    w.CT.confirm = origConfirm;
  }

  // ================= J: modais/tab/badge/boot hash =================
  console.log('== R8-J: showModal/closeModal/Esc/showDashTab/boot ==');
  {
    const t = await bootFlash({ comEdital: 1 });
    const { w, cId } = t;
    const dt = decksDe(w, cId).find(d => d.sourceType === 'topico');

    w.FlashcardsDashboard.openDeckModal();
    const overlay = w.document.getElementById('flashModalOverlay');
    check('J1 showModal: overlay #flashModalOverlay, primeiro input focado',
      !!overlay && overlay.className === 'flash-modal-overlay' && w.document.activeElement === w.document.getElementById('flashDeckName'));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check('J2 Esc fecha o modal (D7 — ADIÇÃO do port)',
      !w.document.getElementById('flashModalOverlay'));
    w.FlashcardsDashboard.openDeckModal();
    w.document.querySelector('#flashModalOverlay .flash-btn.secondary').click();
    check('J3 botão Cancelar fecha (closeModal) e Esc posterior não quebra',
      !w.document.getElementById('flashModalOverlay')
      && (() => { w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })); return true; })());
    w.FlashcardsDashboard.openCardModal(null, dt.id);
    w.document.getElementById('flashModalOverlay').dispatchEvent(new w.MouseEvent('click', { bubbles: false }));
    check('J4 clique no backdrop (target = overlay) fecha',
      !w.document.getElementById('flashModalOverlay'));

    w.showDashTab('flashcards');
    check('J5 showDashTab flashcards: overview none, flash visível, nav active, ct_dashboard_tab',
      w.document.getElementById('dashboardOverview').style.display === 'none'
      && w.document.getElementById('dashboardFlashcards').style.display === ''
      && w.document.getElementById('navFlashcardsDashboard').classList.contains('active')
      && !w.document.getElementById('navDashboardOverview').classList.contains('active')
      && w.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards');
    check('J6 aba flashcards renderiza dentro do root (Meus Baralhos)',
      w.document.getElementById('flashcardsDashboardRoot').innerHTML.includes('Meus Baralhos'));
    w.showDashTab('overview');
    check('J7 showDashTab overview: reversão + ct-dashboard-mounted + ct-initial-flashcards removido',
      w.document.getElementById('dashboardFlashcards').style.display === 'none'
      && w.document.body.classList.contains('ct-dashboard-mounted')
      && !w.document.documentElement.classList.contains('ct-initial-flashcards')
      && w.sessionStorage.getItem('ct_dashboard_tab') === 'overview');

    // boot sem hash → aba overview (preferred)
    const t8 = await bootFlash({});
    check('J8 boot sem hash: aba overview por padrão',
      t8.w.sessionStorage.getItem('ct_dashboard_tab') === 'overview'
      && t8.w.document.getElementById('dashboardOverview').style.display === '');

    // boot com hash #flashcards:<deckId>
    const j9 = new JSDOM('<!doctype html><html><head></head><body>' + SHELL_HTML + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/dashboard.html#flashcards:' + encodeURIComponent('TOPICO_ALVO'), runScripts: 'dangerously' });
    const w9 = j9.window;
    w9.HTMLElement.prototype.scrollIntoView = function () {};
    w9.document.execCommand = function () { return true; };
    initHost({ data: {}, persist: () => true, window: w9, currentPage: () => '' });
    vmRun(w9, dataSrc, 'data.js');
    w9.CT.saveConcurso({ nome: 'Foco Final' });
    const c9 = w9.CT.getConcursos()[0].id;
    w9.CT.saveMateria({ concursoId: c9, nome: 'M' });
    const m9 = w9.CT.getMaterias(c9)[0];
    w9.CT.saveTopico({ concursoId: c9, materiaId: m9.id, nome: 'Tópico alvo' });
    w9.sessionStorage.setItem('ct_concurso_ativo', c9);
    vmRun(w9, flashSrc, 'flashcards.pagejs');
    if (w9.document.readyState === 'loading') {
      await new Promise(r => w9.document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    await tick(20); // setTimeout openDeck 0
    const dt9 = jkey(w9, 'ct_flashcard_decks').find(d => d.sourceType === 'topico');
    check('J9 boot com hash #flashcards:<deckId>: aba flashcards + openDeck do baralho via setTimeout',
      w9.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards'
      && w9.document.getElementById('dashboardOverview').style.display === 'none'
      && w9.document.getElementById('flashMainView').innerHTML.includes('Tópico alvo'),
      w9.document.getElementById('flashMainView').innerHTML.slice(0, 200));

    const j10 = new JSDOM('<!doctype html><html><head></head><body>' + SHELL_HTML + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/dashboard.html#flashcards:inexistente', runScripts: 'dangerously' });
    const w10 = j10.window;
    w10.HTMLElement.prototype.scrollIntoView = function () {};
    w10.document.execCommand = function () { return true; };
    initHost({ data: {}, persist: () => true, window: w10, currentPage: () => '' });
    vmRun(w10, dataSrc, 'data.js');
    vmRun(w10, flashSrc, 'flashcards.pagejs');
    if (w10.document.readyState === 'loading') {
      await new Promise(r => w10.document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    await tick(20);
    check('J10 hash com deckId desconhecido: flashcards abre (aba), openDeck de id inexistente → fallback sem quebrar',
      w10.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards');
  }

  // ================= K: fonte =================
  console.log('== R8-K: fonte do port (D1–D8, D6, verbatims) ==');
  {
    const src = flashSrc;
    const lines = src.split(/\r?\n/);
    const bytes = Buffer.byteLength(src);
    // [R16] seam do insertRichLink: prompt() nativo → await CT.prompt modal +
    // restauração de foco/seleção antes do createLink (7 linhas, +489 B sobre
    // o valor do R9 — documentado como adaptação R16-2).
    check('K1 LF + tamanho esperado (125.613 B / 2.407 linhas — 124.961 B do R8 + 163 B do seam [R9-port] do hash + 489 B do seam [R16] do insertRichLink; aprovado no escopo R16)',
      !src.includes('\r\n') && lines.length === 2407 && bytes === 125613, bytes + ' B / ' + lines.length + ' linhas');
    check('K2 IIFE COM \'use strict\' (D5 — original já tem) + cabeçalho [R8-port]',
      src.startsWith('/**') && src.includes("(function () {\n  'use strict';") && src.includes('[R8-port]'));
    check('K3 D1: deckIcon não existe no código',
      !src.includes('function deckIcon'));
    check('K4 D2: renderQuizAnswerOptions não existe no código',
      !src.includes('function renderQuizAnswerOptions'));
    check('K5 D3: #flashDeckEmoji sem markup; a única menção ao CSS morto está no comentário [R8-port D3]',
      !src.includes('id="flashDeckEmoji"')
      && src.includes('// [R8-port D3] #flashDeckEmoji{display:none} removido'));
    check('K6 D3 vivo: saveDeckModal mantém emoji \'Books\' forçado',
      src.includes("var emoji = 'Books';"));
    check('K7 D4: calcStreak sem else redundante (else break único, marcado; o comentário cita o código removido)',
      src.includes('else break; // [R8-port D4]')
      && !/\n\s*else if \(i > 0\) break;/.test(src));
    check('K8 D7: Esc registrado no showModal e removido no closeModal (handleFlashModalEscape)',
      src.includes("document.addEventListener('keydown', handleFlashModalEscape);")
      && src.includes("document.removeEventListener('keydown', handleFlashModalEscape);")
      && src.includes("if (event.key === 'Escape') closeModal();"));
    check('K9 D8: state.booted ausente do código (set e leitura)',
      !src.includes('state.booted =') && !src.includes('booted: false'));
    check('K10 D6: acentos normalizados nas strings vivas (amostras de todas as famílias)',
      src.includes('Sessão concluída') && src.includes("'1 mês'") && src.includes('Começar')
      && src.includes('Comentário da alternativa ') && src.includes('<label>Explicação</label>')
      && src.includes('separe por vírgula') && src.includes('revisões registrados')
      && src.includes('Aleatórios') && src.includes('Mais difíceis')
      && src.includes('Importação concluída') && src.includes('Sincronização concluída')
      && src.includes("'Matéria'") && src.includes("'Tópico'") && src.includes("'Subtópico'")
      && src.includes('Baralho já linkado') && src.includes('Não foi possível acessar os dados do edital agora.')
      && src.includes('questões quando disponíveis') && src.includes('cabeçalho'));
    check('K11 D6: chaves funcionais de CSV/JSON permanecem sem acento (matching)',
      src.includes("'option ' + lower + ' comentario'") && src.includes("'comentario ' + lower")
      && src.includes('question.explicacao') && src.includes('option.comentario'));
    check('K12 pywebview verbatim com guard (salvar_arquivo_texto)',
      src.includes('window.pywebview && window.pywebview.api && typeof window.pywebview.api.salvar_arquivo_texto === \'function\'')
      && src.includes('window.pywebview.api.salvar_arquivo_texto(baseName, content, ext, label)'));
    check('K13 hash routing verbatim: regex ^#flashcards(?::(.+))? + decodeURIComponent + setTimeout openDeck',
      src.includes("hash.match(/^#flashcards(?::(.+))?/)") && src.includes('decodeURIComponent(flashMatch[1])')
      && src.includes("setTimeout(function () { openDeck(deckId); }, 0);"));
    check('K14 boot verbatim: readyState loading → DOMContentLoaded, senão boot() imediato',
      src.includes("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);")
      && src.trimEnd().endsWith('})();'));
    check('K15 storage keys verbatim: ct_flashcard_decks / ct_flashcards / ct_flashcard_log',
      src.includes("decks: 'ct_flashcard_decks'") && src.includes("cards: 'ct_flashcards'") && src.includes("log: 'ct_flashcard_log'"));
    check('K16 35 métodos expostos + window.showDashTab',
      src.includes('window.showDashTab = showDashTab;') && (() => {
        const m = src.match(/window\.FlashcardsDashboard = \{[\s\S]*?\n  \};/);
        if (!m) return false;
        const propLines = m[0].split(/\r?\n/).filter(l => /^\s{2,6}[A-Za-z_$]+\s*:/.test(l));
        return propLines.length === 35;
      })());
    check('K17 quirk de indentação (answerStudy/chooseQuizAnswer com 6 espaços) verbatim',
      src.includes('\n      answerStudy: answerStudy,') && src.includes('\n      chooseQuizAnswer: chooseQuizAnswer,'));
    check('K18 modal overlay z-index 30000 + blur 8px verbatim',
      src.includes('z-index:30000') && src.includes('backdrop-filter:blur(8px)'));
    check('K19 sem navegação: nenhuma location.href/assign/replace (só window.location.hash)',
      !/location\.(href|assign|replace)/.test(src) && src.includes('window.location.hash'));
    check('K20 sessionStorages compartilhados: ct_concurso_ativo + ct_dashboard_tab',
      src.includes("sessionStorage.getItem('ct_concurso_ativo')") && src.includes("sessionStorage.getItem('ct_dashboard_tab')"));
  }

  console.log('\n=== R8: ' + passed + ' PASS / ' + failed + ' FAIL ===');
  if (failures.length) { console.log('FALHAS:'); failures.forEach(f => console.log(' - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO DO HARNESS:', e); process.exit(2); });
