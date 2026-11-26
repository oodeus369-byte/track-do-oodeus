/**
 * Track do Oodeus — testes R6 (crono-cycle.js parte 1, motor + cauda de hoisting)
 * Sessão A: carregamento do arquivo sem página anfitriã (dashboard R9/CI R7) — API
 *           window.CTCycle (6 métodos), _getCronoMats/_saveCronoMats, bridge __ctGo,
 *           renderCrono NÃO patchado (patchRender é da R7), getData inerte sem ciclo ativo.
 * Sessão B: mats do crono — import do concurso (abbreviações Dir./Con., exceção
 *           ATUALIDADES), cards virtuais SIMULADO/REVISAO no fim em cinza neutro,
 *           cores sequenciais da paleta, dedup por normName, cache de sugestões,
 *           cor do usuário preservada, expansão "At." → ATUALIDADES.
 * Sessão C: motor do ciclo — geração sugerida (alloc proporcional por prioridade,
 *           chunks ≤ 2h, interleave espaçado), pointer normalization, formato de
 *           entry, evento ct-cycle-updated, migração orderIds, reconcile skipped→done,
 *           finalizeItem (done/skipped + stats), handleTimerSave (sessionHistory,
 *           idempotência, done + stat ciclo_timer), refundCycleTime, restart
 *           (snapshot CT + stats CICLO COMPLETO/INICIADO).
 * Sessão D: ponte timer — openTimerForItem (7 passos do original): cyclePreset em
 *           ct_timer_state, trava de selects, REVISAO/SIMULADO, console.log
 *           [CycleTimer] (odor mantido). QUIRK DO ORIGINAL (verificado com probe
 *           de ordem em tests/debug-r6-sugestao.js): a sugestão de tópico/subtópico
 *           É calculada (getTopicos/getSubtopicos) e aplicada no passo 3, mas o
 *           próprio passo 7 despacha 'change' no matSelect e o listener do timer
 *           (timer-popup.js, linha 741 do original) ZERA selectedTopic/selectedSubtopic
 *           e re-popula sem pré-seleção — a sugestão é transitória/invisível no
 *           estado final. Port 100% fiel: o teste verifica o comportamento líquido.
 * Sessão E: modo livre (targets 0, filtro materiasSelecionadas), fallback 15h sem
 *           cfg.horas, fallback global de modo, painel de prova (share q×w → prioridade).
 * Sessão F: contratos de fonte (seams, ordem do hoisting, initDashboard ausente).
 * Realm: jsdom runScripts:'dangerously' + vm.runInContext (como R4/R5). Ordem de
 * carga do dashboard original: data.js → ... → timer-popup.js (2335) → crono-cycle.js
 * (5346). Nenhuma página carrega crono-cycle no plugin ainda — o arquivo é dirigido
 * direto pelo harness; card/bridge/polling armam-se com a parte 2 (R7).
 * ALERTA: process.exit explícito (pretendToBeVisual mantém o processo vivo).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const cronoSrc = read('pages/crono/crono-cycle.pagejs');

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
const tkey = (w, k) => { try { return JSON.parse(w.sessionStorage.getItem(k)); } catch { return null; } };

function boot({ cfg = null, modoCiclo = null, modoGlobal = null, seedTopicoEstudado = false, nMaterias = 4 } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  global.window = w;
  const navSpy = [];
  initHost({
    data: {},
    persist: () => true,
    window: w,
    navigate: (p) => { navSpy.push(p); return true; },
    currentPage: () => '',
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  vmRun(w, dataSrc, 'data.js');
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  const cId = w.CT.getConcursos()[0].id;
  const nomes = ['Direito Constitucional', 'Conhecimentos Gerais', 'Atualidades', 'Direito Administrativo'].slice(0, nMaterias);
  nomes.forEach(n => w.CT.saveMateria({ concursoId: cId, nome: n }));
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  let t1 = null, s1 = null;
  if (nMaterias >= 1) {
    t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[0], nome: 'Controle de constitucionalidade' });
    s1 = w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Repercussão geral' });
    if (seedTopicoEstudado) {
      const topicos = jkey(w, 'ct_topicos') || [];
      const t = topicos.find(x => x.id === t1.id);
      if (t) { t.estudado = true; w.localStorage.setItem('ct_topicos', JSON.stringify(topicos)); }
    }
  }
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  if (cfg) w.localStorage.setItem('ct_cronograma_inteligente_' + cId, JSON.stringify(cfg));
  if (modoCiclo) w.localStorage.setItem('ct_crono_modo_' + cId, modoCiclo);
  if (modoGlobal) w.localStorage.setItem('ct_crono_modo_global', modoGlobal);
  const consoleLogs = [];
  const origLog = w.console.log.bind(w.console);
  w.console.log = function (...a) { consoleLogs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); origLog(...a); };
  // Ordem do dashboard original: timer-popup (2335) ANTES de crono-cycle (5346)
  vmRun(w, timerSrc, 'timer-popup.js');
  vmRun(w, cronoSrc, 'crono-cycle.js');
  return { dom: j, w, cId, mIds, t1, s1, consoleLogs, navSpy };
}

(async () => {
  console.log('== R6-A: carregamento do arquivo (sem página anfitriã) + API ==');
  {
    const t = boot();
    const { w, cId, navSpy } = t;
    check('window.CTCycle com 6 métodos (getData/handleTimerSave/finalizeItem/openTimerForItem/restart/refundCycleTime)', !!w.CTCycle && ['getData', 'handleTimerSave', 'finalizeItem', 'openTimerForItem', 'restart', 'refundCycleTime'].every(k => typeof w.CTCycle[k] === 'function'));
    check('window._getCronoMats/_saveCronoMats expostos', typeof w._getCronoMats === 'function' && typeof w._saveCronoMats === 'function');
    check('bridge window.__ctGo definido; renderCrono NÃO patchado (patchRender é R7)', typeof w.__ctGo === 'function' && typeof w.renderCrono === 'undefined');
    w.__CT_NAV_GO_PAGE = (p) => navSpy.push('nav:' + p);
    w.__ctGo('cronograma_inteligente.html');
    check('__ctGo delega a window.__CT_NAV_GO_PAGE (nav.js)', navSpy.includes('nav:cronograma_inteligente.html'), navSpy.join(','));
    const empty = w.CTCycle.getData({ skipPersist: true });
    check('getData sem ciclo ativo (viewMode weekly, cfg {}): vazio e NÃO gera', empty.round === 1 && Array.isArray(empty.items) && empty.items.length === 0 && rawKey(w, 'ct_ciclo_' + cId) === null);
  }

  console.log('== R6-B: mats do crono (import, abreviações, virtuais, cores) ==');
  {
    const t = boot();
    const { w, cId, mIds } = t;
    const mats = w._getCronoMats();
    check('import automático: 4 reais abreviadas + 2 virtuais no fim (Administrativo vira Adm. DEPOIS de Dir. → "Dir. Adm.")', JSON.stringify(mats.map(m => m.nome)) === JSON.stringify(['DIR. CONSTITUCIONAL', 'CON. GERAIS', 'ATUALIDADES', 'DIR. ADM.', 'SIMULADO', 'REVISAO']), JSON.stringify(mats.map(m => m.nome)));
    check('exceção da abreviação: "Atualidades" não vira "At." (normName !== ATUALIDADES)', mats[2].nome === 'ATUALIDADES');
    check('cores sequenciais da paleta (19) para as reais', mats[0].cor === '#f55a5a' && mats[1].cor === '#4f8ef7' && mats[2].cor === '#7c5cfc' && mats[3].cor === '#3ecf8e', JSON.stringify(mats.slice(0, 4).map(m => m.cor)));
    check('virtuais: SIMULADO/REVISAO em cinza neutro #607d8b com ids v-simulado/v-revisao', mats[4].cor === '#607d8b' && mats[5].cor === '#607d8b' && mats[4].materiaId === 'v-simulado' && mats[5].materiaId === 'v-revisao');
    check('materiaId resolvido (getMaterias do concurso)', mats[0].materiaId === mIds[0]);
    const raw = jkey(w, 'ct_crono_mats_' + cId);
    check('persistido em ct_crono_mats_<cid> (6)', Array.isArray(raw) && raw.length === 6);
    const sug = jkey(w, 'ct_crono_sugestoes_' + cId);
    check('cache de sugestões de cor ct_crono_sugestoes_<cid>', sug && sug['DIR. CONSTITUCIONAL'] === '#f55a5a' && sug['REVISAO'] === '#607d8b');
    check('re-leitura idempotente (sem duplicar especiais — filter antes do push de novo)', w._getCronoMats().length === 6);
  }
  {
    const t = boot();
    const { w, cId, mIds } = t;
    w._getCronoMats(); // importa
    w._saveCronoMats(w._getCronoMats().concat([{ nome: 'DIR. CONSTITUCIONAL', cor: '#fff', materiaId: mIds[0] }]));
    check('_saveCronoMats dedup por normName (duplicata descartada)', jkey(w, 'ct_crono_mats_' + cId).length === 6);
    w._saveCronoMats([{ nome: 'DIR. CONSTITUCIONAL', cor: '#123456', materiaId: mIds[0] }, { nome: 'ATUALIDADES', cor: '', materiaId: mIds[2] }]);
    const mats2 = w._getCronoMats();
    check('cor do usuário NUNCA sobrescrita (hydrate preserva item.cor)', mats2[0].cor === '#123456');
    check('hydrate "At." expande de volta para ATUALIDADES (materiaOriginal é Atualidades)', mats2[1].nome === 'ATUALIDADES', mats2[1].nome);
  }

  console.log('== R6-C: motor do ciclo ==');
  {
    // Geração sugerida: 2 matérias, m1 com tópico estudado (coverage 1.0), m2 sem tópicos (1.15)
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido', horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 } }, seedTopicoEstudado: true, nMaterias: 2 });
    const { w, cId, mIds } = t;
    let cycleEvents = 0;
    let eventDetail = null;
    w.addEventListener('ct-cycle-updated', (e) => { cycleEvents++; eventDetail = e.detail; });
    const data = w.CTCycle.getData({});
    check('evento ct-cycle-updated disparado na gravação (detail.concursoId)', cycleEvents >= 1 && eventDetail && String(eventDetail.concursoId) === String(cId), JSON.stringify(eventDetail));
    check('geração sugerida: 6 entries (m1 4.5h = 3 chunks, m2 5.5h = 3 chunks)', data.items.length === 6, JSON.stringify(data.items.map(i => [i.baseId, i.targetSeconds])));
    const tot = {};
    data.items.forEach(i => { tot[i.baseId] = (tot[i.baseId] || 0) + i.targetSeconds; });
    const totais = Object.values(tot).sort((a, b) => b - a);
    check('soma dos targets = 10h semanais (36000s), chunk ≤ 7200 (2h)', totais[0] === 19800 && totais[1] === 16200 && totais[0] + totais[1] === 36000 && data.items.every(i => i.targetSeconds <= 7200), JSON.stringify(totais));
    check('prioridade: cobertura maior → target menor (m1 estudada 16200 < m2 sem tópicos 19800)', totais[0] === 19800 && totais[1] === 16200);
    const seq = data.items.map(i => i.baseId);
    let adjacente = false;
    for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) adjacente = true;
    check('interleave espaçado: nenhuma sessão do mesmo subject adjacente (spaced distribution)', !adjacente, seq.join(' | '));
    check('entry format: id entry_*, baseId base_<NORMNAME>, status pending', data.items.every(i => String(i.id).indexOf('entry_') === 0) && data.items[0].baseId.indexOf('base_') === 0 && data.items.every(i => i.status === 'pending'));
    check('pointer: currentIndex/currentItemId = primeiro pending', data.currentIndex === 0 && data.currentItemId === data.items[0].id);
    const raw = jkey(w, 'ct_ciclo_' + cId);
    check('raw persistido com entries (sem nome/cor — resolvidos do crono na leitura) + round/startedAt/sessionHistory', Array.isArray(raw.entries) && raw.entries.length === 6 && !('nome' in raw.entries[0]) && raw.round === 1 && Array.isArray(raw.sessionHistory) && raw.sessionHistory.length === 0, JSON.stringify(Object.keys(raw)));
    check('clamp: remainingSeconds de entrada maior que target é clampado (buildCycleEntry 377)', (() => {
      // _saveCronoMats SUBSTITUI a lista: só a matéria real + a de teste ficam.
      w._saveCronoMats([{ nome: 'TESTE CLAMP', cor: '#abcdef', materiaId: '' }]);
      const raw2 = jkey(w, 'ct_ciclo_' + cId);
      raw2.entries.push({ id: 'entry_clamp_1', baseId: 'base_TESTE CLAMP', materiaId: '', targetSeconds: 100, remainingSeconds: 500, status: 'pending', skippedSeconds: 0, lastPendingSeconds: 0, updatedAt: '' });
      w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify(raw2));
      const d2 = w.CTCycle.getData({});
      const clampItem = d2.items.find(i => i.id === 'entry_clamp_1');
      return !!clampItem && clampItem.remainingSeconds === 100 && clampItem.targetSeconds === 100;
    })());
  }
  {
    // Migração orderIds (formato antigo)
    const t = boot({ nMaterias: 2 });
    const { w, cId } = t;
    w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify({ orderIds: ['a', 'b'], currentItemId: 'x', currentIndex: 3 }));
    w.CTCycle.getData({});
    const raw = jkey(w, 'ct_ciclo_' + cId);
    check('migração orderIds → entries (zera): orderIds [], entries [], pointer limpo', Array.isArray(raw.orderIds) && raw.orderIds.length === 0 && Array.isArray(raw.entries) && raw.entries.length === 0 && raw.currentItemId === '' && raw.currentIndex === 0, JSON.stringify(raw));
  }
  {
    // Reconcile: skipped com total estudado ≥ target vira done retroativamente
    const t = boot({ nMaterias: 2 });
    const { w, cId } = t;
    w._getCronoMats();
    const base1 = 'base_DIR. CONSTITUCIONAL';
    const base2 = 'base_CON. GERAIS';
    w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify({
      round: 1, startedAt: '', currentIndex: 0, currentItemId: '', sessionHistory: [{ id: 'h1', sessaoId: 'h1', itemId: 'e1', duracao: 3600, ts: 0 }],
      entries: [
        { id: 'e1', baseId: base1, materiaId: '', targetSeconds: 3600, remainingSeconds: 0, status: 'skipped', skippedSeconds: 0, lastPendingSeconds: 0, updatedAt: '' },
        { id: 'e2', baseId: base2, materiaId: '', targetSeconds: 3600, remainingSeconds: 0, status: 'skipped', skippedSeconds: 1800, lastPendingSeconds: 1800, updatedAt: '' },
      ],
    }));
    const data = w.CTCycle.getData({});
    const e1 = data.items.find(i => i.id === 'e1');
    const e2 = data.items.find(i => i.id === 'e2');
    check('reconcile: skipped com histórico 3600 ≥ target 3600 → done retroativo (status/remaining/skipped zerados)', e1.status === 'done' && e1.remainingSeconds === 0 && e1.skippedSeconds === 0, JSON.stringify(e1));
    check('reconcile: skipped com 1800 < target 3600 PERMANECE skipped', e2.status === 'skipped' && e2.skippedSeconds === 1800, JSON.stringify(e2));
  }
  {
    // finalize + handleTimerSave + refund + restart
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido', horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 } }, seedTopicoEstudado: true, nMaterias: 2 });
    const { w, cId } = t;
    const data = w.CTCycle.getData({});
    const it0 = data.items[0];
    const it2 = data.items[2];
    check('finalizeItem em pending CHEIO → skipped com skippedSeconds = target inteiro + stat ciclo_finalizado (quirk: "se 0 fica done, senão skipped" — cheio tem pending = target > 0)', (() => {
      w.CTCycle.finalizeItem(it0.id);
      const stats = jkey(w, 'ct_ciclo_stats_' + cId) || [];
      const d = w.CTCycle.getData({ skipPersist: true });
      const it = d.items.find(i => i.id === it0.id);
      return it.status === 'skipped' && it.skippedSeconds === it0.targetSeconds && it.lastPendingSeconds === it0.targetSeconds && stats.some(s => s.origem === 'ciclo_finalizado' && s.materiaNome === it0.nome && s.concluida === false);
    })(), JSON.stringify(jkey(w, 'ct_ciclo_stats_' + cId)));
    check('pointer avança: currentIndex = próximo pending (item1)', w.CTCycle.getData({ skipPersist: true }).currentItemId === data.items[1].id);
    // partial → finalize skipped
    const partial = w.CTCycle.getData({ skipPersist: true });
    const it1 = partial.items[1];
    w.CTCycle.handleTimerSave({ itemId: it1.id, materiaId: partial.items[1].materiaId, studiedSeconds: 1800, remainingSeconds: it1.targetSeconds - 1800, sessaoId: 'sess_partial' });
    w.CTCycle.finalizeItem(it1.id);
    const stats2 = jkey(w, 'ct_ciclo_stats_' + cId) || [];
    const afterFinal = w.CTCycle.getData({ skipPersist: true });
    const it1f = afterFinal.items.find(i => i.id === it1.id);
    check('finalizeItem em pending parcial → skipped (lastPending/skippedSeconds 5400 = remaining pós-sessão) + stat ciclo_finalizado', it1f.status === 'skipped' && it1f.skippedSeconds === it1.targetSeconds - 1800 && it1f.lastPendingSeconds === it1.targetSeconds - 1800 && stats2.some(s => s.origem === 'ciclo_finalizado' && s.concluida === false), JSON.stringify(it1f));
    // handleTimerSave completa item2
    const target2 = it2.targetSeconds;
    const dBefore = w.CTCycle.getData({ skipPersist: true });
    w.CTCycle.handleTimerSave({ itemId: it2.id, materiaId: it2.materiaId, studiedSeconds: target2, remainingSeconds: 0, sessaoId: 'sess_A' });
    const afterSave = w.CTCycle.getData({ skipPersist: true });
    const it2s = afterSave.items.find(i => i.id === it2.id);
    check('handleTimerSave: sessionHistory push {id=sessaoId, duracao, itemId, nome} (a sessão PARCIAL anterior também está — 2 no total) e done + stat ciclo_timer', it2s.status === 'done' && afterSave.sessionHistory.length === 2 && afterSave.sessionHistory[1].id === 'sess_A' && afterSave.sessionHistory[1].duracao === target2 && (jkey(w, 'ct_ciclo_stats_' + cId) || []).some(s => s.origem === 'ciclo_timer' && s.materiaNome === it2.nome), JSON.stringify(afterSave.sessionHistory));
    w.CTCycle.handleTimerSave({ itemId: it2.id, materiaId: it2.materiaId, studiedSeconds: target2, remainingSeconds: 0, sessaoId: 'sess_A' });
    check('handleTimerSave idempotente por sessaoId (2ª chamada não duplica — history segue 2)', w.CTCycle.getData({ skipPersist: true }).sessionHistory.length === 2);
    // refund
    w.CTCycle.refundCycleTime(it2.id, target2, 'sess_A');
    const afterRefund = w.CTCycle.getData({ skipPersist: true });
    const it2r = afterRefund.items.find(i => i.id === it2.id);
    check('refundCycleTime: remove SÓ sess_A do history (sess_partial permanece → 1), done→pending, remaining = min(target, r+sec)', afterRefund.sessionHistory.length === 1 && afterRefund.sessionHistory[0].id === 'sess_partial' && it2r.status === 'pending' && it2r.remainingSeconds === Math.min(target2, target2), JSON.stringify(it2r));
    // restart
    const statsBefore = (jkey(w, 'ct_ciclo_stats_' + cId) || []).length;
    const restarted = w.CTCycle.restart();
    const rawAfter = jkey(w, 'ct_ciclo_' + cId);
    const snaps = jkey(w, 'ct_ciclo_snapshots_' + cId) || [];
    const stats = jkey(w, 'ct_ciclo_stats_' + cId) || [];
    check('restart: round+1, todos pending com remaining = target, sessionHistory zerada, pointer no 1º com target>0', restarted.round === 2 && rawAfter.round === 2 && rawAfter.entries.every(e => e.status === 'pending' && e.remainingSeconds === e.targetSeconds) && rawAfter.sessionHistory.length === 0, JSON.stringify(rawAfter).slice(0, 200));
    check('restart: snapshot do ciclo encerrado em ct_ciclo_snapshots_<cid> (status complete)', snaps.length >= 1 && snaps.some(s => s.status === 'complete'), JSON.stringify(snaps).slice(0, 160));
    check('restart: stats CICLO COMPLETO (ciclo_reset) + CICLO INICIADO (ciclo_start, round 2)', stats.some(s => s.materiaNome === 'CICLO COMPLETO' && s.origem === 'ciclo_reset') && stats.some(s => s.materiaNome === 'CICLO INICIADO' && s.origem === 'ciclo_start' && s.round === 2) && stats.length === statsBefore + 2);
  }

  console.log('== R6-D: ponte timer (openTimerForItem, 7 passos) ==');
  {
    const t = boot({ cfg: { cicloModo: 'sugerido' }, nMaterias: 2 });
    const { w, cId, mIds, t1, consoleLogs } = t;
    const item = { id: 'entry_test_1', nome: 'DIR. CONSTITUCIONAL', materiaId: mIds[0], targetSeconds: 7200, remainingSeconds: 7200 };
    // spy: a sugestão chama CT.getSubtopicos(t1.id) ANTES do wipe do passo 7
    const subsCalls = [];
    const origSubs = w.CT.getSubtopicos.bind(w.CT);
    w.CT.getSubtopicos = (...a) => { const r = origSubs(...a); subsCalls.push(a[0]); return r; };
    w.CTCycle.openTimerForItem(item);
    const panel = w.document.getElementById('timerPopup');
    const st = tkey(w, 'ct_timer_state');
    check('passo 4: popup aberto (display block) + aba Livre ativa', panel.style.display === 'block' && w.document.getElementById('tpFreePanel').style.display === 'block' && w.document.getElementById('tpTabFree').classList.contains('active'));
    check('passo 3: cyclePreset em ct_timer_state {itemId, materiaId, materiaNome, startRemaining, targetSeconds} + mode free + open + parado', st.cyclePreset && st.cyclePreset.itemId === 'entry_test_1' && st.cyclePreset.materiaId === mIds[0] && st.cyclePreset.materiaNome === 'DIR. CONSTITUCIONAL' && st.cyclePreset.startRemaining === 7200 && st.cyclePreset.targetSeconds === 7200 && st.mode === 'free' && st.open === true && st.freeRunning === false, JSON.stringify(st.cyclePreset));
    check('QUIRK do original: sugestão É calculada (getSubtopicos(t1) chamado no passo 3) mas o change do passo 7 (listener do timer) ZERA selectedTopic/selectedSubtopic no estado final', subsCalls.includes(t1.id) && st.selectedTopic === '' && st.selectedSubtopic === '', JSON.stringify({ subsCalls, top: st.selectedTopic, sub: st.selectedSubtopic }));
    check('passo 7: matSelect travado no valor da matéria (painel E modal)', w.document.getElementById('tpMatSelect').value === mIds[0] && w.document.getElementById('tpMatSelect').disabled === true && w.document.getElementById('tpModalMateria').disabled === true);
    check('passo 7 wipe na UI: tópico populado SEM pré-seleção (2 options, value "") e subtópico placeholder disabled (a pré-seleção transitória do passo 5 é desfeita)', w.document.getElementById('tpTopicSelect').options.length === 2 && w.document.getElementById('tpTopicSelect').value === '' && w.document.getElementById('tpSubtopicSelect').value === '', JSON.stringify({ opts: w.document.getElementById('tpTopicSelect').options.length, t: w.document.getElementById('tpTopicSelect').value, s: w.document.getElementById('tpSubtopicSelect').value, sDis: w.document.getElementById('tpSubtopicSelect').disabled }));
    check('console.log "[CycleTimer]" de debug presente (odor mantido, linhas 891/987)', t.consoleLogs.some(l => l.indexOf('[CycleTimer]') === 0), t.consoleLogs.slice(0, 3).join(' // '));
    // REVISÃO
    w.CTCycle.openTimerForItem({ id: 'entry_v_rev', nome: 'REVISAO', materiaId: 'v-revisao', targetSeconds: 0, remainingSeconds: 0 });
    const st2 = tkey(w, 'ct_timer_state');
    check('REVISAO: selectedTipo "Revisão" + isRevisionCard true + SEM sugestão (virtual)', st2.selectedTipo === 'Revisão' && st2.isRevisionCard === true && st2.selectedTopic === '' && st2.cyclePreset.materiaId === 'v-revisao', JSON.stringify(st2.selectedTipo));
    check('REVISAO: matSelect fica TRAVADO mas value "" — a option "v-revisao" não existe no select populado pelo timer (setting .value sem option → ""), quirk do original; o polling R7 é que destrava depois', w.document.getElementById('tpMatSelect').disabled === true && w.document.getElementById('tpMatSelect').value === '' && st2.selectedMateria === '', JSON.stringify({ v: w.document.getElementById('tpMatSelect').value, sm: st2.selectedMateria }));
    // SIMULADO
    w.CTCycle.openTimerForItem({ id: 'entry_v_sim', nome: 'SIMULADO', materiaId: 'v-simulado', targetSeconds: 0, remainingSeconds: 0 });
    const st3 = tkey(w, 'ct_timer_state');
    check('SIMULADO: selectedTipo "Simulado", isRevisionCard false', st3.selectedTipo === 'Simulado' && st3.isRevisionCard === false);
  }

  console.log('== R6-E: modo livre, fallbacks de config, painel de prova ==');
  {
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'livre', horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 } }, nMaterias: 2 });
    const { w, cId, mIds } = t;
    const data = w.CTCycle.getData({});
    check('livre: entries só das mats REAIS com targetSeconds 0 ("a definir"); pointer "" — isCyclePendingItem exige target>0, nenhum pendente elegível (normalize zera; NÃO é items[0].id)', data.items.length === 2 && data.items.every(i => i.targetSeconds === 0 && i.status === 'pending') && data.currentItemId === '', JSON.stringify(data.items.map(i => i.baseId)));
  }
  {
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'livre', materiasSelecionadas: {} }, nMaterias: 2 });
    const { w } = t;
    // marca m1 como NÃO selecionada (matéria ausente do mapa = selecionada por padrão)
    const cfg = jkey(w, 'ct_cronograma_inteligente_' + t.cId);
    cfg.materiasSelecionadas[t.mIds[0]] = false;
    w.localStorage.setItem('ct_cronograma_inteligente_' + t.cId, JSON.stringify(cfg));
    const data = w.CTCycle.getData({});
    check('filtro materiasSelecionadas: m1 desmarcada sai; ausente do mapa = selecionada (m2 fica)', data.items.length === 1 && data.items[0].baseId === 'base_CON. GERAIS', JSON.stringify(data.items.map(i => i.baseId)));
  }
  {
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido' }, nMaterias: 2 });
    const { w, cId } = t;
    const data = w.CTCycle.getData({});
    const tot = {};
    data.items.forEach(i => { tot[i.baseId] = (tot[i.baseId] || 0) + i.targetSeconds; });
    const totais = Object.values(tot).sort((a, b) => b - a);
    check('fallback 15h sem cfg.horas (weeklyHours = 15 → 54000s)', totais[0] + totais[1] === 54000, JSON.stringify(totais));
  }
  {
    const t = boot({ modoGlobal: 'cycle', nMaterias: 2 });
    const { w, cId } = t;
    const data = w.CTCycle.getData({});
    check('fallback global de modo: sem modo por-cid, ct_crono_modo_global cycle → ciclo ATIVO e gera (sem cfg) — 15h default → 7.5h/matéria → 4 chunks cada = 8 itens, soma 54000', data.items.length === 8 && data.items.reduce((s, i) => s + i.targetSeconds, 0) === 54000 && rawKey(w, 'ct_ciclo_' + cId) !== null, JSON.stringify(data.items.map(i => i.baseId)));
  }
  {
    const t = boot({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido', horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 } }, nMaterias: 2 });
    const { w, cId, mIds } = t;
    w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify({ groups: [{ id: 'g1', name: 'Geral', items: [{ id: mIds[0], q: 30, w: 2 }, { id: mIds[1], q: 10, w: 2 }] }], scoringMode: 'tradicional' }));
    const data = w.CTCycle.getData({});
    const tot = {};
    data.items.forEach(i => { tot[i.baseId] = (tot[i.baseId] || 0) + i.targetSeconds; });
    const totais = Object.values(tot).sort((a, b) => b - a);
    check('painel de prova: share q×w (60/20 → 0.75/0.25) → allocations 7.5h/2.5h (27000/9000)', totais[0] === 27000 && totais[1] === 9000, JSON.stringify(totais));
  }

  console.log('== R6-F: contratos de fonte (seams + hoisting) ==');
  {
    const src = cronoSrc;
    const idxMotor = src.indexOf('function getCycleData(');
    const idxTail = src.indexOf('function getCronogramaConfig()');
    check('hoisting replicado: getCronogramaConfig (cauda) DEPOIS de getCycleData (motor) no arquivo', idxMotor >= 0 && idxTail > idxMotor);
    check('initDashboard PRESENTE (arquivo completo R7: original 5337-5349, guard #cronoGrid)', src.indexOf('(function initDashboard') > -1);
    check('seam inline no fonte: onclick __ctGo(\'cronograma_inteligente.html\')', src.includes("onclick=\"__ctGo(\\'cronograma_inteligente.html\\')\""));
    check('seams goPage: openMateriaTab (aba_materia) e botão de share (cronograma_inteligente)', src.includes("goPage('aba_materia.html')") && src.includes("button.onclick = function () { goPage('cronograma_inteligente.html'); };"));
    check('goPage local com fallback location.href original (browser puro)', src.includes("if (typeof window.__CT_NAV_GO_PAGE === 'function') { window.__CT_NAV_GO_PAGE(p); return; }") && src.includes('window.location.href = p;'));
    check('dead code if(false) do importFromContest mantido (paridade, etapa-08 §7)', src.includes('if (false) {'));
    check('setInterval(syncCycleTimerUI, 250) presente no fonte (polling do bridge) + bindTimerBridge() ARMADO no load (R7: orig 5045; guard #cronoGrid torna inerte sem dashboard)', src.includes('setInterval(syncCycleTimerUI, 250)') && src.indexOf('bindTimerBridge() {') > -1 && src.indexOf('bindTimerBridge();') > -1);
    check('avança 1 item: card do ciclo verbatim (renderCycleDashboard + renderSmartDashboard no fonte, arming via patchRender R7 orig 4173)', src.includes('function renderCycleDashboard()') && src.includes('function renderSmartDashboard()'));
  }

  console.log('');
  console.log(`== resultado: ${passed} PASS, ${failed} FAIL ==`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(1); });
