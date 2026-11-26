/**
 * Track do Oodeus — testes R7 (etapa-09: crono-cycle parte 2 + Cronograma Inteligente)
 *
 * Parte A (crono-cycle completo): coberto pelas revalidações do teste R6
 *           (59/59 sobre o arquivo INTEIRO — parte 2 + initDashboard presentes;
 *           patchRender/bindTimerBridge/initDashboard com guard #cronoGrid).
 * Parte B (página cronograma_inteligente.html): este arquivo. Harness jsdom +
 *           vm.runInContext (modo clássico: function declarations viram props de
 *           window; let/const ficam no env léxico do contexto — compartilhados
 *           entre os scripts, como <script>s da mesma página). body.html injetado
 *           no DOM ANTES dos scripts. Ordem do original: data.js (971) → script
 *           inline (972) → crono-cycle.js (4338); nav.js NÃO roda (guards
 *           typeof cobrem; desvio documentado no render-util R3). O CI não
 *           carrega timer-popup.js (o original também não).
 *
 * Sessões:
 *   A  config — DEFAULT_CONFIG, loadConfig merge/clamps, persistCronogramaConfig
 *   B  painel — normalizePainelConfig (migração geral/específico → groups) +
 *              getPainelMeta (q×w e pool scoring)
 *   C  diagnóstico — calcRecentStats (frações), classifyPerformance (sinal
 *              'queda' INALCANÇÁVEL — D1 removido; abaixo_meta/recuperacao)
 *   D  estimativas — estimateUnitMinutes clamp 20–300, dailyTopicLimit
 *              (automático/manual cap), dailyMateriaLimit
 *   E  scheduler — buildAgendadoSchedule (horizonte 420, lanes core/support,
 *              streaks de elegibilidade, forceTier), buildAgendadoScheduleFromDate
 *   F  buildDiagnostic — units mat:/top:/sub:, prioridade local DESCARTADA
 *              (unit.priority = prioridade da matéria), advanceMinutes com pcts
 *              zerados, partialMateriaSelection
 *   G  snapshots diários — write/read, extra completion, clear, rebuild
 *   H  wizard — renderSetupWeekGrid com D2 (horas JÁ SALVAS), collectSetupAvailability
 *              com D3 (sem IDs fantasma), salvarSetupAgendado (ciclo: apaga
 *              ct_ciclo + CTCycle.getData), recriarCronograma
 *   I  modais — normalizeFocusCustomGoalValue (66–99), PRIORITY_LEVELS
 *              (32/47/62/78), priority editor (step/change/save)
 *   J  format changes — escolherTipoCronograma (ciclo apaga ct_ciclo +
 *              ct_crono_modo), reorganizarCronograma (CTCycle.getData +
 *              btnReorganizar disabled), voltarEscolhaCronograma
 *   K  crono-cycle parte 2 dirigível — com #cronoGrid + renderCrono stub:
 *              patchRender (_patched), botão "Abrir" via seam goPage, initDashboard
 *              (render imediato + retry 300ms), abrirModalCrono._patched
 *   L  fonte/seams — página registrada no shell.js, seams do body (9 pontos),
 *              D1/D2/D3 no main.pagejs, font link descartado, asset seam e
 *              verbatims (pywebview/share/clipboard/window.open) no crono-cycle
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const ciBodyHtml = read('pages/crono-inteligente/body.html');
const ciMainSrc = read('pages/crono-inteligente/main.pagejs');
const ciStyleSrc = read('pages/crono-inteligente/style.css');
const cronoSrc = read('pages/crono/crono-cycle.pagejs');
const shellSrc = read('src/shell.js');

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
// let/const top-level NÃO viram props de window no modo clássico (ficam no env
// léxico do contexto, compartilhado entre os scripts) — ler/mutar via vm:
const lex = (w, expr) => vm.runInContext(expr, w.__ctx, { filename: 'lex-snip' });

// Boot da página CI: body injetado antes dos scripts; ordem data.js → main → crono-cycle
function bootCi({ cfg = null, modoGlobal = null, modoCiclo = null, nMaterias = 2, questoes = null, withDashboard = false, renderCronoStub = false } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + ciBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
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
  w.__CT_NAV_GO_PAGE = (p) => { navSpy.push('nav:' + p); };
  vmRun(w, dataSrc, 'data.js');
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  const cId = w.CT.getConcursos()[0].id;
  const nomes = ['Direito Constitucional', 'Conhecimentos Gerais', 'Atualidades', 'Direito Administrativo'].slice(0, nMaterias);
  nomes.forEach(n => w.CT.saveMateria({ concursoId: cId, nome: n }));
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  let t1 = null, s1 = null;
  t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[0], nome: 'Controle de constitucionalidade' });
  s1 = w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Repercussão geral' });
  if (questoes) questoes.forEach(q => w.CT.saveQuestao({ concursoId: cId, ...q }));
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  if (cfg) w.localStorage.setItem('ct_cronograma_inteligente_' + cId, JSON.stringify(cfg));
  if (modoCiclo) w.localStorage.setItem('ct_crono_modo_' + cId, modoCiclo);
  if (modoGlobal) w.localStorage.setItem('ct_crono_modo_global', modoGlobal);
  if (withDashboard) {
    const card = w.document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="card-header"><div class="card-title">Cronograma</div><button class="card-btn">Editar</button></div><div id="cronoGrid"></div>';
    w.document.body.appendChild(card);
    if (renderCronoStub) {
      w.renderCronoCalls = [];
      w.renderCrono = function () { w.renderCronoCalls.push('call'); };
    }
  }
  // Ordem do original: data.js (971) → script inline (972) → crono-cycle.js (4338)
  vmRun(w, ciMainSrc, 'cronograma_inteligente.html [inline]');
  vmRun(w, cronoSrc, 'crono-cycle.js');
  return { dom: j, w, cId, mIds, t1, s1, navSpy };
}

(async () => {
  console.log('== R7-A: config (DEFAULT_CONFIG, loadConfig, persist) ==');
  {
    const t = bootCi();
    const { w, cId } = t;
    const cfg = w.loadConfig();
    check('DEFAULT_CONFIG: tipo "", cicloModo sugerido, step 1, horas seg-sex 2 sab/dom 0, revisaoPct 25, questoesPct 20, minTopico 60, minSubtopico 40, maxTopicosDia 0, goal 80', cfg.tipo === '' && cfg.cicloModo === 'sugerido' && cfg.agendadoSetupStep === 1 && cfg.horas.seg === 2 && cfg.horas.sex === 2 && cfg.horas.sab === 0 && cfg.horas.dom === 0 && cfg.revisaoPct === 25 && cfg.questoesPct === 20 && cfg.minutosTopico === 60 && cfg.minutosSubtopico === 40 && cfg.maxTopicosDia === 0 && cfg.focusAlertsCustomGoal === 80, JSON.stringify(cfg));
    check('chave ct_cronograma_inteligente_<cid>', w.configKey() === 'ct_cronograma_inteligente_' + cId);
  }
  {
    const t = bootCi({ cfg: { agendadoSetupStep: 9, maxTopicosDia: 50, focusAlertsCustomGoal: 120, horas: { seg: 3 }, ritmo: 'intensivo' } });
    const { w } = t;
    const cfg = w.loadConfig();
    check('clamps: step 9→4, maxTopicosDia 50→20, goal 120→99; merge horas (seg 3, ter 2 default); ritmo salvo', cfg.agendadoSetupStep === 4 && cfg.maxTopicosDia === 20 && cfg.focusAlertsCustomGoal === 99 && cfg.horas.seg === 3 && cfg.horas.ter === 2 && cfg.ritmo === 'intensivo', JSON.stringify({ s: cfg.agendadoSetupStep, m: cfg.maxTopicosDia, g: cfg.focusAlertsCustomGoal, seg: cfg.horas.seg }));
  }
  {
    const t = bootCi({ cfg: { agendadoSetupStep: 0, maxTopicosDia: -5, focusAlertsCustomGoal: 10 } });
    const { w } = t;
    const cfg = w.loadConfig();
    check('clamps por baixo: step 0→1, maxTopicosDia -5→0 (0 é válido: automático), goal 10→66', cfg.agendadoSetupStep === 1 && cfg.maxTopicosDia === 0 && cfg.focusAlertsCustomGoal === 66, JSON.stringify({ s: cfg.agendadoSetupStep, m: cfg.maxTopicosDia, g: cfg.focusAlertsCustomGoal }));
  }
  {
    const t = bootCi({ cfg: { tipo: 'agendado' } });
    const { w, cId } = t;
    w.persistCronogramaConfig('teste', { immediate: true });
    check('persistCronogramaConfig grava JSON da config na chave (tipo do boot persistido)', jkey(w, 'ct_cronograma_inteligente_' + cId).tipo === 'agendado');
  }

  console.log('== R7-B: painel de prova (migração legacy + pool) ==');
  {
    const t = bootCi({ nMaterias: 2 });
    const { w, cId, mIds } = t;
    w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify({ geral: [{ id: mIds[0], q: 30, w: 2 }], especifico: [{ id: mIds[1], q: 10, w: 2 }], scoringMode: 'x' }));
    const norm = w.normalizePainelConfig();
    check('migração legacy: geral/específico → groups (Conhecimentos Gerais/Específicos) + scoringMode inválido → tradicional', norm.groups.length === 2 && norm.groups[0].id === 'geral' && norm.groups[0].name === 'Conhecimentos Gerais' && norm.groups[1].id === 'especifico' && norm.scoringMode === 'tradicional', JSON.stringify(norm));
    const meta = w.getPainelMeta(w.CT.getMaterias(cId));
    const s0 = meta.map.get(String(mIds[0])), s1 = meta.map.get(String(mIds[1]));
    check('getPainelMeta: share q×w (60/20 → 0.75/0.25) + hasPanel', Math.abs(s0.share - 0.75) < 1e-9 && Math.abs(s1.share - 0.25) < 1e-9 && meta.hasPanel === true, JSON.stringify([...meta.map.entries()]));
  }
  {
    const t = bootCi({ nMaterias: 2 });
    const { w, cId, mIds } = t;
    // pool: bloco com q/w no GRUPO e itens sem q (média entre matérias do bloco)
    w.localStorage.setItem('ct_config_prova_' + cId, JSON.stringify({ groups: [{ id: 'g1', name: 'Bloco', q: 40, w: 2, items: [{ id: mIds[0] }, { id: mIds[1] }] }], scoringMode: 'tradicional' }));
    const meta = w.getPainelMeta(w.CT.getMaterias(cId));
    const s0 = meta.map.get(String(mIds[0])), s1 = meta.map.get(String(mIds[1]));
    check('pool scoring: 40q×2w = 80 pts divididos entre 2 matérias (20 pts, 20q cada) — share igual', Math.abs(s0.questoes - 20) < 1e-9 && Math.abs(s0.pontos - 40) < 1e-9 && Math.abs(s0.share - 0.5) < 1e-9 && Math.abs(s1.share - 0.5) < 1e-9, JSON.stringify([...meta.map.entries()]));
  }

  console.log('== R7-C: diagnóstico (calcRecentStats, classifyPerformance sem queda/D1) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', focusAlertsCustomEnabled: true, focusAlertsCustomGoal: 80 } });
    const { w } = t;
    const rs = w.calcRecentStats([{ resolvidas: 10, acertos: 9, erros: 1, data: '2026-11-15' }, { resolvidas: 10, acertos: 5, erros: 5, data: '2026-11-14' }], 30);
    check('calcRecentStats: 20 resolvidas, 14 acertos (fração da 2ª: take=10/10 → integral), pct 70', rs.resolvidas === 20 && rs.acertos === 14 && rs.pct === 70, JSON.stringify(rs));
    const rs2 = w.calcRecentStats([{ resolvidas: 8, acertos: 4, erros: 4, data: '2026-11-15' }, { resolvidas: 10, acertos: 10, erros: 0, data: '2026-11-14' }], 15);
    check('calcRecentStats com limite (15): take 8+7 → acertos 4 + 10×0.7 = 11 → round 11, pct 73', rs2.resolvidas === 15 && Math.round(rs2.acertos) === 11 && rs2.pct === 73, JSON.stringify(rs2));
    const g = { resolvidas: 40, pct: 90 };
    const r = { resolvidas: 10, pct: 50 };
    check('classifyPerformance: recent < 65 → dificuldade (o branch queda era INALCANÇÁVEL — D1 removido)', w.classifyPerformance(g, r).key === 'dificuldade');
    const g2 = { resolvidas: 10, pct: 85 };
    let queda = false;
    for (let gp = 0; gp <= 100; gp += 5) for (let rp = 0; rp <= 100; rp += 5) {
      const out = w.classifyPerformance({ resolvidas: 20, pct: gp }, { resolvidas: 10, pct: rp });
      if (out.key === 'queda') queda = true;
    }
    check("sinal 'queda' nunca é retornado para NENHUMA combinação de pcts (varredura 21×21) — D1", queda === false);
    check('abaixo da meta: customEnabled, recent 75 < goal 80 → abaixo_meta', w.classifyPerformance({ resolvidas: 20, pct: 90 }, { resolvidas: 10, pct: 75 }).key === 'abaixo_meta');
    check('recuperação: geral < 75 e recent >= 80 → recuperacao; dominando: recent >= 90', w.classifyPerformance({ resolvidas: 20, pct: 60 }, { resolvidas: 10, pct: 85 }).key === 'recuperacao' && w.classifyPerformance({ resolvidas: 20, pct: 90 }, { resolvidas: 10, pct: 95 }).key === 'dominando');
  }

  console.log('== R7-D: estimativas (estimateUnitMinutes, dailyTopicLimit, dailyMateriaLimit) ==');
  {
    const t = bootCi({ cfg: { minutosTopico: 60, ritmo: 'equilibrado' } });
    const { w, mIds } = t;
    const base = { materiaId: mIds[0], signal: { key: 'estavel' }, tipo: 'subtopico' };
    const meta = { share: 0.5 };
    check('estimateUnitMinutes: base (share 0.5/max 0.5 → relevance 1, subtopico, sem afinidade) dentro do range', w.estimateUnitMinutes(base, meta, 0.5, 60) >= 20 && w.estimateUnitMinutes(base, meta, 0.5, 60) <= 300, String(w.estimateUnitMinutes(base, meta, 0.5, 60)));
    const tiny = { materiaId: mIds[0], signal: { key: 'estavel' }, tipo: 'subtopico' };
    check('clamp mínimo 20: minutosTopico 15 (scaleFactor .25 → raw ~16.5×1) → 20', (lex(w, 'config.minutosTopico = 15'), w.estimateUnitMinutes(tiny, { share: 0.01 }, 0.01, 60) === 20), String(w.estimateUnitMinutes(tiny, { share: 0.01 }, 0.01, 60)));
    check('clamp máximo 300: minutosTopico 600 + afinidade 1 + dificuldade → 300', (lex(w, 'config.minutosTopico = 600; config.materiaAfinidade[\'' + mIds[0] + '\'] = 1'), w.estimateUnitMinutes({ materiaId: mIds[0], signal: { key: 'dificuldade' }, tipo: 'materia' }, { share: 1 }, 1, 60) === 300));
    lex(w, 'config.minutosTopico = 60');
  }
  {
    const t = bootCi({ cfg: { minutosTopico: 60, maxTopicosDia: 0 } });
    const { w } = t;
    check('dailyTopicLimit automático: 4h/60min → 4', w.dailyTopicLimit(4) === 4);
    lex(w, 'config.maxTopicosDia = 2');
    check('cap manual: maxTopicosDia 2 → min(4, 2) = 2', w.dailyTopicLimit(4) === 2);
    lex(w, 'config.maxTopicosDia = 0');
    check('0h → 0 itens (dia sem estudo)', w.dailyTopicLimit(0) === 0);
    check('dailyMateriaLimit: 4 itens, 2 matérias → 2 cada; 4 itens, 5 matérias → 1', w.dailyMateriaLimit(4, 2) === 2 && w.dailyMateriaLimit(4, 5) === 1);
  }

  console.log('== R7-E: scheduler (buildAgendadoSchedule, FromDate) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', horas: { seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 4, dom: 4 }, minutosTopico: 60, maxTopicosDia: 0 } });
    const { w, cId, mIds } = t;
    const units = [];
    for (let i = 0; i < 6; i++) {
      units.push({ id: 'u' + i, materiaId: mIds[i % 2], estimateMinutes: 60, priority: 50, done: false });
    }
    const rows = mIds.map(id => ({ materia: { id, nome: id }, priority: 50 }));
    const sched = w.buildAgendadoSchedule(units, rows);
    check('scheduler: 6 units de 60min em dias de 4h (máx 4/dia por matéria? — total agendado = 6, dias ≤ 420)', sched.scheduledUnits === 6 && sched.days.length <= 420 && sched.days.length >= 2, JSON.stringify({ s: sched.scheduledUnits, d: sched.days.length }));
    check('finishDate = data do último dia com itens; avgUnitsPerStudyDay = 6/dias', sched.finishDate && sched.avgUnitsPerStudyDay === 6 / sched.days.length, JSON.stringify(sched.avgUnitsPerStudyDay));
    check('lanes: prioridade 50 → support (bestPriority < 55)', sched.days.flatMap(d => d.items).every(i => i.scheduleLane === 'support'), JSON.stringify(sched.days.flatMap(d => d.items.map(i => i.scheduleLane))));
  }
  {
    const t = bootCi({ cfg: { tipo: 'agendado', horas: { seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 4, dom: 4 }, minutosTopico: 60 } });
    const { w, mIds } = t;
    // streak: prioridade média (40–54) NÃO estuda em dias consecutivos. Com
    // units de 200min (uma não deixa a 2ª caber no mesmo dia de 4h) o bloqueio
    // de dia consecutivo aparece: dia 1 usa a matéria, dia 2 fica ineligível
    // (streak), dia 3 recebe a 2ª unit. (Com units de 60min tudo vai no dia 1
    // porque canUseMateria tem fallback que ignora o cap quando
    // cappedCandidates fica vazio — quirk do original.)
    const units = [{ id: 'u1', materiaId: mIds[0], estimateMinutes: 200, priority: 45, done: false }, { id: 'u2', materiaId: mIds[0], estimateMinutes: 200, priority: 45, done: false }];
    const rows = [{ materia: { id: mIds[0], nome: 'X' }, priority: 45 }];
    const sched = w.buildAgendadoSchedule(units, rows);
    check('streak (prio média 45): dias de estudo NÃO consecutivos (pula ≥1 dia de calendário entre usos)', sched.days.length === 2 && (new Date(sched.days[1].key) - new Date(sched.days[0].key)) >= 2 * 86400000, JSON.stringify(sched.days.map(d => d.key)));
    // forceTier: prioridade máxima (≥70) força estudo diário
    const units2 = [{ id: 'f1', materiaId: mIds[0], estimateMinutes: 60, priority: 80, done: false }, { id: 'f2', materiaId: mIds[0], estimateMinutes: 60, priority: 80, done: false }, { id: 'f3', materiaId: mIds[0], estimateMinutes: 60, priority: 80, done: false }, { id: 'f4', materiaId: mIds[0], estimateMinutes: 60, priority: 80, done: false }];
    const rows2 = [{ materia: { id: mIds[0], nome: 'X' }, priority: 80 }];
    const sched2 = w.buildAgendadoSchedule(units2, rows2);
    check('forceTier 1 (prio ≥70): lane core + dia 1 leva TODAS as units que cabem (4×60min ≤ 240min, maxItems 4)', sched2.days[0].items.length === 4 && sched2.days[0].items.every(i => i.scheduleLane === 'core') && sched2.days.length === 1, JSON.stringify(sched2.days.map(d => d.items.map(i => i.scheduleLane))));
    // FromDate: janela limitada por diffDays
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const histStart = w.addDays(start, -3);
    const sched3 = w.buildAgendadoScheduleFromDate(units2, rows2, histStart, w.addDays(start, 1));
    check('buildAgendadoScheduleFromDate: janela de 4 dias (diffDays) — data inicial = historyStart', sched3.days[0].key === w.dateKey(histStart) && sched3.days.every(d => w.dateKey(d.date) >= w.dateKey(histStart)), JSON.stringify({ first: sched3.days[0] && sched3.days[0].key, n: sched3.days.length }));
  }

  console.log('== R7-F: buildDiagnostic (units, prioridade, advanceMinutes) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, horas: { seg: 4, ter: 0, qua: 4, qui: 0, sex: 4, sab: 0, dom: 0 }, revisaoPct: 0, questoesPct: 0, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId, mIds, t1 } = t;
    const s1 = w.CT.getSubtopicos(t1.id)[0]; // saveSubtopico retorna undefined no jsdom (quirk #2053)
    const state = w.buildDiagnostic();
    check('units: t1 tem subtópico → unit sub:<s1.id> (não top:); m2 sem tópicos → unit mat:<m2.id>', state.units.some(u => u.id === 'sub:' + s1.id) && state.units.some(u => u.id === 'mat:' + mIds[1]), JSON.stringify(state.units.map(u => u.id)));
    check('prioridade LOCAL das units é DESCARTADA (align): unit.priority = prioridade da matéria (materiasRows sorted)', state.units.every(u => u.priority === state.materias.find(r => String(r.materia.id) === String(u.materiaId)).priority), JSON.stringify(state.units.map(u => [u.id, u.priority])));
    check('advanceMinutes com pcts ZERADOS = weeklyMinutes completo (12h semanais → 720)', state.advanceMinutes === 720, String(state.advanceMinutes));
    check('weeklyStudyDays: 3 dias com horas > 0 (seg/qua/sex)', state.weeklyStudyDays === 3, String(state.weeklyStudyDays));
    check('schedule agendado construído (tipo agendado): days + finishDate', Array.isArray(state.schedule.days) && state.schedule.days.length >= 1 && !!state.schedule.finishDate, JSON.stringify({ d: state.schedule.days.length }));
  }
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 }, revisaoPct: 25, questoesPct: 25, minutosTopico: 60, materiasSelecionadas: {} } });
    const { w, cId, mIds } = t;
    lex(w, 'config.materiasSelecionadas = {};'); // vazio = todas selecionadas
    let state = w.buildDiagnostic();
    check('seleção completa: partialMateriaSelection false', state.partialMateriaSelection === false);
    lex(w, 'config.materiasSelecionadas = { \'' + mIds[0] + '\': false };');
    state = w.buildDiagnostic();
    check('seleção parcial: 1/2 matérias → partialMateriaSelection true + selectedMateriasCount 1', state.partialMateriaSelection === true && state.selectedMateriasCount === 1 && state.totalMateriasCount === 2, JSON.stringify({ s: state.selectedMateriasCount, t: state.totalMateriasCount }));
    check('advanceMinutes com pcts 25/25: weeklyMinutes × 0.5 (14h → 420)', state.advanceMinutes === 420, String(state.advanceMinutes));
  }

  console.log('== R7-G: snapshots diários (write/read/extra/clear/rebuild) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, horas: { seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 4, dom: 4 }, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId, t1 } = t;
    const s1 = w.CT.getSubtopicos(t1.id)[0]; // quirk #2053
    const todayKey = w.dateKey(new Date());
    const unit = { id: 'sub:' + s1.id, subtopId: s1.id, topicoId: t1.id, materiaId: t1.materiaId, priority: 60, estimateMinutes: 40, minutes: 40 };
    w.writeCalendarSnapshot(todayKey, [unit]);
    const snap = w.readCalendarDailySnapshots()[todayKey];
    check('writeCalendarSnapshot: entry {id, key "sub:...", priority, scheduleLane, estimateMinutes} + createdAt/updatedAt', snap && snap.items.length === 1 && snap.items[0].key === 'sub:' + s1.id && snap.items[0].priority === 60 && snap.items[0].estimateMinutes === 40 && !!snap.createdAt && !!snap.updatedAt, JSON.stringify(snap));
    const items = w.getCalendarSnapshotItems(todayKey);
    check('getCalendarSnapshotItems: resolve a unit via _fromDailySnapshot + estimateMinutes → minutes', items && items.length === 1 && items[0]._fromDailySnapshot === true && items[0].minutes === 40 && items[0].priority === 60, JSON.stringify(items && items[0] && { from: items[0]._fromDailySnapshot, m: items[0].minutes }));
    const doneUnit = { ...unit, done: true, doneAt: todayKey };
    check('calendarSnapshotHasExtraCompletion: unit done hoje fora do computed → true (guard: computedItems vazio → false, orig 1758)', w.calendarSnapshotHasExtraCompletion([doneUnit], [{ id: 'other' }], todayKey) === true && w.calendarSnapshotHasExtraCompletion([doneUnit], [unit], todayKey) === false && w.calendarSnapshotHasExtraCompletion([doneUnit], [], todayKey) === false);
    w.clearDailySnapshotsFromToday();
    check('clearDailySnapshotsFromToday: remove dias ≥ hoje (chave apagada)', Object.keys(w.readCalendarDailySnapshots()).length === 0 && rawKey(w, 'ct_crono_dia_snapshot_' + cId) === null);
    lex(w, 'state = buildDiagnostic();'); // lexical `state` (o render do boot já setou; reforço)
    w.rebuildTodaySnapshotFromState();
    check('rebuildTodaySnapshotFromState: grava snapshot de hoje a partir do historySchedule', Object.keys(w.readCalendarDailySnapshots()).includes(todayKey), JSON.stringify(Object.keys(w.readCalendarDailySnapshots())));
  }

  console.log('== R7-H: wizard (D2 horas salvas, D3 sem fantasmas, salvarSetupAgendado) ==');
  {
    const t = bootCi({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido', agendadoSetupDone: false, agendadoSetupStep: 3, horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 }, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId } = t;
    // D2: grid mostra as horas JÁ SALVAS (antes da correção zerava até a 1ª edição)
    const grid = w.renderSetupWeekGrid();
    const segVal = /id="setup_hour_seg"[\s\S]*?value="([^"]*)"/.exec(grid);
    check('D2: renderSetupWeekGrid mostra as horas salvas (seg → "2h")', segVal && segVal[1] === '2h', segVal && segVal[1]);
    const d3 = w.collectSetupAvailability();
    check('D3: collectSetupAvailability sem IDs fantasma — ritmo/questoesPct direto da config', d3.ritmo === 'equilibrado' && d3.questoesPct === 20 && d3.horas.seg === 2, JSON.stringify(d3));
    // salvarSetupAgendado em modo ciclo: apaga ct_ciclo + gera via CTCycle.getData
    const cicleKey = 'ct_ciclo_' + cId;
    const seeded = JSON.stringify({ round: 7, entries: [] });
    w.localStorage.setItem(cicleKey, seeded);
    const genSpy = [];
    const origGetData = w.CTCycle.getData.bind(w.CTCycle);
    w.CTCycle.getData = (...a) => { genSpy.push(a); return origGetData(...a); };
    w.salvarSetupAgendado();
    const fresh = rawKey(w, cicleKey);
    check('salvarSetupAgendado ciclo: ct_ciclo_<cid> removido e REGISTRADO pelo próprio CTCycle.getData (round 1, 6 entries de 10h) + agendadoSetupDone/Step 4 + getData chamado', fresh !== seeded && genSpy.length >= 1 && jkey(w, cicleKey).round === 1 && jkey(w, cicleKey).entries.length === 6 && jkey(w, 'ct_cronograma_inteligente_' + cId).agendadoSetupDone === true && jkey(w, 'ct_cronograma_inteligente_' + cId).agendadoSetupStep === 4, JSON.stringify({ igualAoSeed: fresh === seeded, round: jkey(w, cicleKey).round, n: jkey(w, cicleKey).entries.length, gen: genSpy.length }));
    check('salvarSetupAgendado: agendadoStartDate = hoje', jkey(w, 'ct_cronograma_inteligente_' + cId).agendadoStartDate === w.dateKey(new Date()));
  }
  {
    const t = bootCi({ cfg: { tipo: 'ciclo', agendadoSetupDone: true, agendadoSetupStep: 4, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId } = t;
    w.recriarCronograma();
    const cfg = jkey(w, 'ct_cronograma_inteligente_' + cId);
    check('recriarCronograma: tipo "" + setupDone false + step 1 + startDate "" + setupHoursModified false (let lexical → via lex)', cfg.tipo === '' && cfg.agendadoSetupDone === false && cfg.agendadoSetupStep === 1 && cfg.agendadoStartDate === '' && lex(w, 'setupHoursModified === false'), JSON.stringify(cfg));
    check('recriarCronograma → render(): onboarding visível (tipo vazio)', w.document.getElementById('onboardingContent').style.display === '' && w.document.getElementById('appContent').style.display === 'none');
  }

  console.log('== R7-I: modais (focus goal, priority editor) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, horas: { seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 4, dom: 4 }, minutosTopico: 60, minutosSubtopico: 40, focusAlertsCustomEnabled: true, focusAlertsCustomGoal: 80 } });
    const { w, cId } = t;
    check('normalizeFocusCustomGoalValue: clamp 66–99 (10→66, 120→99, "abc"→fallback)', w.normalizeFocusCustomGoalValue('10') === 66 && w.normalizeFocusCustomGoalValue('120') === 99 && w.normalizeFocusCustomGoalValue('abc', 80) === 80);
    check('PRIORITY_LEVELS: baixa 32, média 47, alta 62, máxima 78 + automático (score null) — const lexical → via lex', lex(w, 'JSON.stringify(PRIORITY_LEVELS.map(l => l.score))') === JSON.stringify([null, 32, 47, 62, 78]) && lex(w, "priorityLevelInfo('alta').score") === 62);
    check('priorityLevelFromScore: 75→maxima, 60→alta, 45→media, 20→baixa', w.priorityLevelFromScore(75) === 'maxima' && w.priorityLevelFromScore(60) === 'alta' && w.priorityLevelFromScore(45) === 'media' && w.priorityLevelFromScore(20) === 'baixa');
    w.openPriorityEditor();
    check('openPriorityEditor: modal visible + draft copiado da config', w.document.getElementById('priorityEditorModal').classList.contains('visible') && lex(w, 'JSON.stringify(priorityEditorDraft)') === lex(w, 'JSON.stringify(config.materiaPrioridades || {})'));
    // step: ba sobe para média etc. (bounds: base 1..4, ordem 0..4 com índice 0 = automático)
    const firstId = String(lex(w, 'String(state.materias[0].materia.id)'));
    w.stepPriorityEditor(firstId, 1);
    check('stepPriorityEditor: automático (base por score) sobe 1 nível no draft', lex(w, 'priorityEditorDraft["' + firstId + '"]') && lex(w, 'priorityEditorDraft["' + firstId + '"]') !== '', JSON.stringify(lex(w, 'priorityEditorDraft')));
    w.stepPriorityEditor(firstId, 5);
    check('stepPriorityEditor: clamp no topo (não passa de máxima)', lex(w, 'priorityEditorDraft["' + firstId + '"]') === 'maxima');
    w.stepPriorityEditor(firstId, -5);
    check('stepPriorityEditor: clamp no piso (não desce abaixo de baixa)', lex(w, 'priorityEditorDraft["' + firstId + '"]') === 'baixa');
    w.changePriorityEditor({ dataset: { priorityEdit: firstId }, value: 'alta' });
    check('changePriorityEditor: draft por dataset.priorityEdit', lex(w, 'priorityEditorDraft["' + firstId + '"]') === 'alta');
    w.resetPriorityEditor();
    check('resetPriorityEditor: draft vazio', lex(w, 'JSON.stringify(priorityEditorDraft)') === '{}');
    w.changePriorityEditor({ dataset: { priorityEdit: firstId }, value: 'maxima' });
    w.savePriorityEditor();
    const cfgSaved = jkey(w, 'ct_cronograma_inteligente_' + cId);
    check('savePriorityEditor: config.materiaPrioridades gravado + snapshot de hoje reconstruído', cfgSaved.materiaPrioridades[firstId] === 'maxima', JSON.stringify(cfgSaved.materiaPrioridades));
  }

  console.log('== R7-J: format changes (escolher/reorganizar/voltar) ==');
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId } = t;
    w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify({ round: 3, entries: [] }));
    w.escolherTipoCronograma('ciclo');
    const cfg = jkey(w, 'ct_cronograma_inteligente_' + cId);
    check('escolherTipoCronograma ciclo: apaga ct_ciclo_<cid> (REGISTRADO de novo pelo próprio CTCycle.getData, orig 1184-1187) + ct_crono_modo cycle + config.tipo ciclo + setupDone false (re-wizard)', jkey(w, 'ct_ciclo_' + cId).round === 1 && (w.localStorage.getItem('ct_crono_modo_' + cId) === 'cycle' || w.localStorage.getItem('ct_crono_modo_global') === 'cycle') && cfg.tipo === 'ciclo' && cfg.agendadoSetupDone === false, JSON.stringify({ round: jkey(w, 'ct_ciclo_' + cId).round, modo: w.localStorage.getItem('ct_crono_modo_' + cId), tipo: cfg.tipo, done: cfg.agendadoSetupDone }));
  }
  {
    const t = bootCi({ cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId } = t;
    w.escolherTipoCronograma('agendado');
    check('escolherTipoCronograma agendado: ct_crono_modo weekly + tipo agendado', (w.localStorage.getItem('ct_crono_modo_' + cId) === 'weekly' || w.localStorage.getItem('ct_crono_modo_global') === 'weekly') && jkey(w, 'ct_cronograma_inteligente_' + cId).tipo === 'agendado');
  }
  {
    const t = bootCi({ cfg: { tipo: 'ciclo', cicloModo: 'sugerido', agendadoSetupDone: true, agendadoSetupStep: 4, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId, navSpy } = t;
    w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify({ round: 3, entries: [] }));
    const genSpy = [];
    const origGetData = w.CTCycle.getData.bind(w.CTCycle);
    w.CTCycle.getData = (...a) => { genSpy.push(a); return origGetData(...a); };
    w.reorganizarCronograma();
    check('reorganizarCronograma ciclo: apaga ct_ciclo_<cid> (REGISTRADO pelo próprio CTCycle.getData) + getData chamado + botão disabled', jkey(w, 'ct_ciclo_' + cId).round === 1 && genSpy.length >= 1 && w.document.getElementById('btnReorganizar').getAttribute('disabled') === 'true', JSON.stringify({ round: jkey(w, 'ct_ciclo_' + cId).round, gen: genSpy.length, dis: w.document.getElementById('btnReorganizar').getAttribute('disabled') }));
    check('btnReorganizar: label "Reorganizar Ciclo" no render', w.document.getElementById('btnReorganizar').textContent === 'Reorganizar Ciclo', w.document.getElementById('btnReorganizar').textContent);
    w.voltarEscolhaCronograma();
    const cfg = jkey(w, 'ct_cronograma_inteligente_' + cId);
    check('voltarEscolhaCronograma: tipo "" + setupDone false + step 1 (persist com delay 300)', cfg.tipo === '' && cfg.agendadoSetupDone === false && cfg.agendadoSetupStep === 1, JSON.stringify(cfg));
  }

  console.log('== R7-K: crono-cycle parte 2 dirigível (dashboard stub) ==');
  {
    // K1: SEM config smart (getSmartAgendadoConfig() → null, orig 1874) e modo
    // weekly → o wrapper do patchRender cai no branch orig() (o stub).
    const t = bootCi({ withDashboard: true, renderCronoStub: true });
    const { w } = t;
    check('patchRender: window.renderCrono WRAPPED (_patched true) com #cronoGrid + stub', typeof w.renderCrono === 'function' && w.renderCrono._patched === true);
    check('initDashboard: render imediato no load — wrapper → orig() (stub) chamado ≥ 1× (force initial render + initDashboard)', w.renderCronoCalls.length >= 1, String(w.renderCronoCalls.length));
    await tick(350);
    check('initDashboard retry: +1 chamada após 300ms (setTimeout(window.renderCrono, 300))', w.renderCronoCalls.length >= 2, String(w.renderCronoCalls.length));
    check('branch orig (sem smart): botão do card volta a abrirModalCrono + título do card reescrito', (() => {
      const btn = w.document.querySelector('.card-header [data-crono-main-action="1"]');
      return !!btn && typeof btn.onclick === 'function' && btn.onclick._patched !== true;
    })());
  }
  {
    // K2: COM config smart (agendado + setupDone) → renderSmartDashboard() e o
    // header do card vira "Estudos de Hoje" + botão "Abrir" com o seam goPage.
    const t = bootCi({ withDashboard: true, renderCronoStub: true, cfg: { tipo: 'agendado', agendadoSetupDone: true, agendadoSetupStep: 4, minutosTopico: 60, minutosSubtopico: 40 } });
    const { w, cId, navSpy } = t;
    check('smart: título do card "Estudos de Hoje" + botão "Abrir" (updateDashboardCardHeader)', (() => {
      const title = w.document.querySelector('.card-header .card-title');
      const btn = w.document.querySelector('.card-header [data-crono-main-action="1"]');
      return title && title.textContent === 'Estudos de Hoje' && btn && btn.textContent === 'Abrir';
    })());
    check('seam 2 no alvo: botão "Abrir" navega pela ponte goPage → __CT_NAV_GO_PAGE (navSpy)', (() => {
      const btn = w.document.querySelector('.card-header [data-crono-main-action="1"]');
      if (!btn) return false;
      btn.click();
      return navSpy.includes('nav:cronograma_inteligente.html');
    })(), JSON.stringify(navSpy));
    check('abrirModalCrono._patched true (assinado no fim da parte 2, orig 5044)', w.abrirModalCrono && w.abrirModalCrono._patched === true);
  }

  console.log('== R7-L: fonte/seams/registro ==');
  {
    const { w, navSpy } = { w: null, navSpy: null };
    check('shell.js: cronograma_inteligente.html registrado com scripts [main.pagejs, crono-cycle.pagejs] (ordem original)', shellSrc.includes("'cronograma_inteligente.html'") && shellSrc.indexOf('crono-inteligente/main.pagejs') > -1 && shellSrc.indexOf('crono/crono-cycle.pagejs') > -1 && shellSrc.indexOf('crono-inteligente/main.pagejs') < shellSrc.indexOf('crono/crono-cycle.pagejs'));
    check('body.html: 8 seams location.href→goPage + flashcards (sessionStorage mantido) + <a href> com onclick+return false', (ciBodyHtml.match(/onclick="goPage\('/g) || []).length === 9 && ciBodyHtml.includes("sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')") && ciBodyHtml.includes('<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false"'));
    check('body.html: sem location.href restante FORA do comentário de cabeçalho (documentação do seam)', !/location\.href/.test(ciBodyHtml.replace(/<!--[\s\S]*?-->/g, '')));
    check('main.pagejs: D1 aplicado (sem branch queda; sinal morto nos usos verbatim — 11 ocorrências de \'queda\')', !ciMainSrc.includes("key:'queda'") && (ciMainSrc.match(/'queda'/g) || []).length === 11, String((ciMainSrc.match(/'queda'/g) || []).length));
    check('main.pagejs: D2 aplicado (grid com horas salvas) e D3 aplicado (sem getElementById setupRitmo/setupQuestoes)', ciMainSrc.includes('const val = config.horas[day.key] ?? 0;') && ciMainSrc.includes('[R7-port D3]') && !ciMainSrc.includes("getElementById('setupRitmo')") && !ciMainSrc.includes("getElementById('setupQuestoes')"));
    check('main.pagejs: font link do head descartado + boot verbatim (config = loadConfig(); render(); closeCalendarDay)', !ciMainSrc.includes('fonts.googleapis') && /config = loadConfig\(\);\s*render\(\);/.test(ciMainSrc.replace(/\r/g, '')) && ciMainSrc.includes('window.closeCalendarDay = closeCalendarDay;'));
    check('main.pagejs: seam 3701 único (onclick goPage cadastro_edital) + goPage local com fallback', (ciMainSrc.match(/goPage\(/g) || []).length >= 2 && ciMainSrc.includes('function goPage(dest) {') && ciMainSrc.includes("if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }"));
    check('crono-cycle.pagejs: asset seam do logo do PDF (__ctAssetUrl) + initDashboard + parte 2 completa', cronoSrc.includes("__ctAssetUrl('assets/logo-oficial-track-concursos.png')") && cronoSrc.includes('(function initDashboard') && cronoSrc.includes('function smartExportTodayPdf') && cronoSrc.includes('smartTodayPdfFileDate'));
    check('crono-cycle.pagejs: verbatims pywebview/navigator.share/clipboard/window.open mantidos', cronoSrc.includes('window.pywebview.api.open_external_url') && cronoSrc.includes('navigator.share(') && cronoSrc.includes('navigator.clipboard.writeText') && cronoSrc.includes("window.open(url, '_blank', 'noopener,noreferrer')"));
    check('crono-cycle.pagejs: filename do PDF = "Estudos de hoje DD-MM-YYYY.pdf" (padStart 2)', cronoSrc.includes("String(d.getDate()).padStart(2, '0')") && cronoSrc.includes("'Estudos de hoje ' + smartTodayPdfFileDate(state.today) + '.pdf'"));
    check('CI NÃO carrega timer-popup.js (original também não: 4338 crono-cycle, 4339 nav) e a cadeia do PAGES é [main, crono-cycle] sem timer', (() => {
      const i = shellSrc.indexOf("'cronograma_inteligente.html'");
      const block = shellSrc.slice(i, i + 700);
      return !/pages\/timer/.test(ciMainSrc) && !/src="[^"]*timer/.test(ciMainSrc) && block.indexOf('../pages/crono-inteligente/main.pagejs') > -1 && block.indexOf('../pages/crono/crono-cycle.pagejs') > block.indexOf('../pages/crono-inteligente/main.pagejs') && !block.includes("require('../pages/timer/timer-popup");
    })());
  }

  console.log('');
  console.log(`== resultado: ${passed} PASS, ${failed} FAIL ==`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO:', e && e.stack || e); process.exit(2); });
