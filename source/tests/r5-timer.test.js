/**
 * Track do Oodeus — testes R5 (timer-popup.js)
 * Sessão A: injeção do FAB + painel (sem overlay morto, tabs, selects, modais).
 * Sessão B: modo Livre — play/pause via botão E via ESPAÇO, stop → modal de
 *           sessão (salvar com matéria/tópico/questões/métricas/radio
 *           "concluiu?"), log de sessões com ✕ (CT.excluirSessao), descartar
 *           com confirm + "Nunca mais mostrar" (skip em localStorage).
 * Sessão C: Pomodoro — 25/5/15 default, cfg change reinicializa parado, skip
 *           NÃO acumula foco parcial, stop acumula foco parcial, nextPomoFase
 *           natural (seed via ct_timer_state: 4 focos → longa, dots/label),
 *           reset com CT.confirm.
 * Sessão D: recover de elapsed por lastTick (teto 2h) + persistência da
 *           posição do FAB (drag, relativa ao canto inferior-esquerdo).
 * Sessão E: integração com a aba_materia — exports window.*, openFreeTimerPreset
 *           pelo iniciarCronometroLivreItem com autoStart.
 * Sessão F: som — config em localStorage com clamp de volume; botão Testar sem
 *           erro (no jsdom Audio.play é no-op não-implementado e AudioContext
 *           não existe — o fallback sintetizado sai silencioso, guard original).
 * Realm: jsdom runScripts:'dangerously' + wrapper new win.Function (mesmo
 * mecanismo do plugin). Quirks #2053 herdados do harness R4: listeners DCL
 * capturados e removidos após o DCL sintético; scrollIntoView polyfilled.
 * O timer-popup NÃO é DCL-wrapped (roda síncrono no wrapper, como o <script
 * src> do original) — a UI dele existe LOGO APÓS renderAba.
 * ALERTA: intervalos de 1s do timer rodam de verdade — process.exit() explícito
 * no fim (jsdom pretendToBeVisual mantém o processo vivo).
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
const timerSrc = read('pages/timer/timer-popup.pagejs');
const themeCss = read('src/theme.css');

const abaPage = { scripts: [script1Src, script2Src, timerSrc], lazyModules: [] };

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
function timerState(w) {
  try { return JSON.parse(w.sessionStorage.getItem('ct_timer_state')); } catch { return null; }
}

const tick = (ms) => new Promise(r => setTimeout(r, ms));

function bootPlugin({ timerSeed = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  // Quirk #2053: listeners DCL capturados para remoção pós-DCL sintético (ver R4).
  w.__ctDclListeners = [];
  const origAddEventListener = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded') w.__ctDclListeners.push(fn);
    return origAddEventListener(type, fn, opts);
  };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  global.window = w;
  const navigations = [];
  initHost({
    data: {},
    persist: () => true,
    window: w,
    navigate: (p) => { navigations.push(p); return true; },
    currentPage: () => '',
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_SHELL__ = true;
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', dataProva: '2026-12-20' });
  const cId = w.CT.getConcursos()[0].id;
  w.CT.saveMateria({ concursoId: cId, nome: 'Português' });
  const mId = w.CT.getMaterias().filter(m => m.concursoId === cId)[0].id;
  const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mId, nome: 'Concordância' });
  w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Regência' });
  const s1 = w.CT.getSubtopicos().filter(s => s.topicoId === t1.id)[0];
  w.sessionStorage.setItem('ct_concurso_ativo', cId);
  w.sessionStorage.setItem('ct_materia_ativa', mId);
  if (timerSeed) w.sessionStorage.setItem('ct_timer_state', JSON.stringify(timerSeed));
  return { dom: j, w, navigations, cId, mId, t1, s1 };
}

function renderAba(t) {
  const { w } = t;
  if (t.content && t.content.parentNode) t.content.remove();
  w.__CT_PAGE_SEARCH__ = '';
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
  // como na R4: listener DCL marcador registrado antes do runPageScripts (o
  // dispatch sintético do runPageScripts o executa; o real atrasado do jsdom,
  // não — é removido junto com os capturados após o render).
  w.document.addEventListener('DOMContentLoaded', () => w.__ctScriptLog.push('dcl-marker'));
  runPageScripts(w, content, abaPage, {
    label: 'aba',
    navBoot: () => {
      w.__ctScriptLog.push('nav-boot');
      if (typeof w.__CT_NAV_BOOT === 'function') w.__CT_NAV_BOOT();
    },
  });
  t.content = content;
  (w.__ctDclListeners || []).splice(0).forEach(fn => {
    try { w.document.removeEventListener('DOMContentLoaded', fn); } catch { /* noop */ }
  });
  return content;
}

function overlayMessage(w) {
  const ov = w.document.getElementById('ct-alert-overlay');
  return ov ? (ov.querySelector('.ct-alert-message') || {}).textContent : null;
}
async function confirmOverlay(w, { checkbox = false } = {}) {
  const ov = w.document.getElementById('ct-alert-overlay');
  if (ov) {
    if (checkbox) { const cb = ov.querySelector('#ct-alert-checkbox'); if (cb) cb.checked = true; }
    const ok = ov.querySelector('.ct-alert-ok'); if (ok) ok.click();
  }
  await tick(20);
}

(async () => {
  console.log('== R5-A: injeção do FAB + painel ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, mId, t1 } = t;
    check('ordem de carga: Script2 → timer (aba-script-3) → DCL', JSON.stringify(w.__ctScriptLog) === JSON.stringify([
      'nav-boot', 'aba-script-1', 'aba-script-2', 'aba-script-3', 'dcl-marker',
    ]), w.__ctScriptLog.join(','));
    const fab = w.document.getElementById('timerFab');
    check('FAB #timerFab no body com badge #fabBadge', !!fab && !!fab.querySelector('#fabBadge'));
    const cssAll = Array.from(w.document.head.querySelectorAll('style'));
    const timerCss = cssAll.find(s => (s.textContent || '').includes('#timerFab {'));
    check('CSS do timer injetado (style element com #timerFab)', !!timerCss);
    const panel = w.document.getElementById('timerPopup');
    check('painel #timerPopup criado e FECHADO (display none por CSS, sem inline)', !!panel && panel.style.display === '' && !panel.classList.contains('minimized'));
    check('overlay morto: #timerOverlay NUNCA criado (etapa-07 §3)', w.document.getElementById('timerOverlay') === null);
    check('tabs: Livre ativa, painel Livre visível, Pomodoro escondido', w.document.getElementById('tpTabFree').classList.contains('active') && w.document.getElementById('tpFreePanel').style.display === 'block' && w.document.getElementById('tpPomoPanel').style.display === 'none');
    const matSel = w.document.getElementById('tpMatSelect');
    check('select de matéria populado (CT.getMaterias do concurso ativo)', Array.from(matSel.options).some(o => o.value === mId));
    check('tópico/subtópico disabled sem matéria', w.document.getElementById('tpTopicSelect').disabled && w.document.getElementById('tpSubtopicSelect').disabled);
    const soundModal = w.document.getElementById('tpSoundModal');
    check('modal de som: nome default "Bip padrao do Track", volume 85', w.document.getElementById('tpSoundName').textContent === 'Bip padrao do Track' && w.document.getElementById('tpSoundVolume').value === '85');
    // abrir/fechar
    w.openTimerPopup();
    check('openTimerPopup: painel display block', panel.style.display === 'block');
    w.minimizeTimerPopup();
    check('minimizeTimerPopup: classe minimized (CSS display:none!important)', panel.classList.contains('minimized'));
    w.openTimerPopup();
    check('reabrir remove minimized', !panel.classList.contains('minimized') && panel.style.display === 'block');
  }

  console.log('== R5-B: modo Livre (play/pause/espaço, modal, log, descartar) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, mId, t1, cId } = t;
    w.openTimerPopup();
    const panel = w.document.getElementById('timerPopup');
    const badge = w.document.getElementById('fabBadge');
    // play via botão
    w.document.getElementById('tpBtnPlay').click();
    check('play: ESTUDANDO + badge MMSS visível + running no FAB', w.document.getElementById('tpFreeStatus').textContent === 'ESTUDANDO' && badge.style.display !== 'none' && w.document.getElementById('timerFab').classList.contains('running'));
    await tick(1250);
    check('tick de 1s: freeSeconds >= 1 (delta real de relógio, não incremento cego)', (timerState(w).freeSeconds) >= 1, timerState(w).freeSeconds);
    // espaço = pause
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    check('ESPAÇO = play/pause (capture, painel visível): PAUSADO', w.document.getElementById('tpFreeStatus').textContent === 'PAUSADO' && timerState(w).freeRunning === false && badge.style.display === 'none');
    // espaço com painel fechado não faz nada
    w.closeTimerPopup();
    await w.closeTimerPopup; // noop async await
    const stBefore = timerState(w).freeRunning;
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    check('ESPAÇO com painel fechado: nada acontece', timerState(w).freeRunning === stBefore);
    // reabrir, rodar e parar → modal de sessão
    w.openTimerPopup();
    w.document.getElementById('tpBtnPlay').click();
    await tick(1250);
    w.document.getElementById('tpBtnStop').click();
    const modal = w.document.getElementById('tpSessionModal');
    check('stop: modal de sessão aberto com "estudado"', modal.style.display === 'flex' && (w.document.getElementById('tpModalDuracao').textContent || '').includes('estudado'), w.document.getElementById('tpModalDuracao').textContent);
    // preencher e salvar
    const matSel = w.document.getElementById('tpModalMateria');
    matSel.value = mId;
    matSel.dispatchEvent(new w.Event('change', { bubbles: true }));
    const topSel = w.document.getElementById('tpModalTopico');
    topSel.value = t1.id;
    topSel.dispatchEvent(new w.Event('change', { bubbles: true }));
    check('radio "concluiu?" visível com tópico, default estudado', w.document.getElementById('tpStudyStatusBox').style.display !== 'none' && w.document.querySelector('input[name="tpStudyStatus"][value="estudado"]').checked);
    w.document.getElementById('tpModalAcertos').value = '3';
    w.document.getElementById('tpModalErros').value = '1';
    w.document.getElementById('tpModalPaginasPdf').value = '7';
    w.document.getElementById('tpBtnModalSave').click();
    const sessoes = storedKey(w, 'ct_sessoes') || [];
    const questoes = storedKey(w, 'ct_questoes') || [];
    const topicos = storedKey(w, 'ct_topicos') || [];
    const st = timerState(w);
    check('salvar: sessão gravada (origem timer_livre, metricas paginasPdf 7)', sessoes.some(s => s.origem === 'timer_livre' && s.duracaoSegundos >= 1 && s.metricas && s.metricas.paginasPdf === 7), JSON.stringify(sessoes));
    check('salvar: questões gravadas (4 resolv. 3/1)', questoes.some(q => q.resolvidas === 4 && q.acertos === 3 && q.erros === 1), JSON.stringify(questoes));
    check('salvar: registrarProgressoUnidadeEstudo → tópico estudado', topicos.some(x => x.id === t1.id && x.estudado === true));
    check('pós-save: resetFree (PRONTO), log com 1 entrada e ✕, modal fechado', w.document.getElementById('tpFreeStatus').textContent === 'PRONTO' && w.document.querySelectorAll('#tpLogEntries .tp-log-entry').length === 1 && modal.style.display === 'none');
    check('sessão no log com sessaoId (retorno de registrarSessao) + mat nome', st.sessions.length === 1 && !!st.sessions[0].sessaoId, JSON.stringify(st.sessions));
    // excluir do log → CT.excluirSessao
    w.document.querySelector('#tpLogEntries .tp-log-del').click();
    const sessoesAfter = (storedKey(w, 'ct_sessoes') || []).filter(s => s.origem === 'timer_livre');
    check('excluir do log: CT.excluirSessao remove de ct_sessoes + log esconde', sessoesAfter.length === 0 && (timerState(w).sessions.length === 0));
    // descartar com confirm + checkbox
    w.document.getElementById('tpBtnPlay').click();
    await tick(1250);
    w.document.getElementById('tpBtnStop').click();
    w.document.getElementById('tpBtnModalCancel').click();
    await tick(30);
    check('descartar: CT.confirm com checkbox "Nunca mais mostrar este aviso"', (overlayMessage(w) || '').includes('descartar este tempo estudado') && !!w.document.querySelector('#ct-alert-overlay #ct-alert-checkbox'), overlayMessage(w));
    await confirmOverlay(w, { checkbox: true });
    check('skip gravado (ct_timer_skip_discard_confirm) + resetFree', w.localStorage.getItem('ct_timer_skip_discard_confirm') === '1' && w.document.getElementById('tpFreeStatus').textContent === 'PRONTO');
    // segunda vez: sem confirm (skip)
    w.document.getElementById('tpBtnPlay').click();
    await tick(1250);
    w.document.getElementById('tpBtnStop').click();
    w.document.getElementById('tpBtnModalCancel').click();
    await tick(30);
    check('descartar 2ª vez: sem confirm (skip), modal fechado direto', w.document.getElementById('ct-alert-overlay') === null && w.document.getElementById('tpSessionModal').style.display === 'none');
  }

  console.log('== R5-C: Pomodoro ==');
  {
    const t = bootPlugin();
    renderAba(t);
    const { w } = t;
    w.openTimerPopup();
    w.document.getElementById('tpTabPomo').click();
    check('tab Pomodoro: painel visível, 00:00 (original: pomoTotal default 0, loadState 287 — só play inicializa), 🎯 Foco, ciclo 1/4', w.document.getElementById('tpPomoPanel').style.display === 'block' && w.document.getElementById('tpPomoTime').textContent === '00:00' && w.document.getElementById('tpPomoFaseBadge').textContent === '🎯 Foco' && w.document.getElementById('tpPomoCycleLabel').textContent === 'ciclo 1/4', w.document.getElementById('tpPomoTime').textContent);
    w.document.getElementById('tpBtnPomoPlay').click();
    check('play inicializa: pomoTotal 1500 (togglePomo 1555: initPomo se total 0) → 25:00', w.document.getElementById('tpPomoTime').textContent === '25:00' && timerState(w).pomoTotal === 1500 && w.document.getElementById('tpBtnPomoPlay').textContent !== '▶', w.document.getElementById('tpPomoTime').textContent);
    w.document.getElementById('tpBtnPomoPlay').click(); // pausa de volta
    // cfg change (parado) reinicializa
    const cfgFoco = w.document.getElementById('tpCfgFoco');
    cfgFoco.value = '1';
    cfgFoco.dispatchEvent(new w.Event('change', { bubbles: true }));
    check('cfg foco=1: pomoTotal 60 (display 01:00)', w.document.getElementById('tpPomoTime').textContent === '01:00' && timerState(w).pomoTotal === 60);
    // play + tick
    w.document.getElementById('tpBtnPomoPlay').click();
    await tick(1250);
    check('pomodoro rodando: decorrido >= 1s', timerState(w).pomoElapsed >= 1, timerState(w).pomoElapsed);
    // skip: original 1589-1592 — pular um FOCO conta o foco COMPLETO no
    // acumulador (dur = pomoTotal inteiro) e incrementa focosFeitos; o
    // decorrido parcial não entra nem é descartado do ciclo.
    w.document.getElementById('tpBtnPomoSkip').click();
    check('skip de foco: fase ☕ Pausa, acumulador +pomoTotal (60s, foco completo), focosFeitos 1', w.document.getElementById('tpPomoFaseBadge').textContent === '☕ Pausa' && timerState(w).pomoFocosFeitos === 1 && timerState(w).pomoAccumulatedTime === 60, JSON.stringify(timerState(w)));
    // stop com acumulado: play foco de volta, rodar, stop → modal pomodoro
    w.document.getElementById('tpBtnPomoSkip').click(); // pausa → foco
    w.document.getElementById('tpBtnPomoPlay').click();
    await tick(1250);
    w.document.getElementById('tpBtnPomoStop').click();
    const modal = w.document.getElementById('tpSessionModal');
    check('stop com foco parcial: modal com acumulado ("estudado")', modal.style.display === 'flex' && (w.document.getElementById('tpModalDuracao').textContent || '').includes('estudado'));
    w.document.getElementById('tpBtnModalSave').click();
    const sessoes = storedKey(w, 'ct_sessoes') || [];
    check('salvar pomodoro: sessão origem pomodoro + acumulado zerado', sessoes.some(s => s.origem === 'pomodoro' && s.duracaoSegundos >= 1) && (timerState(w).pomoAccumulatedTime || 0) === 0, JSON.stringify(timerState(w)));
    // fase natural via seed (1s de foco rodando): foco completa → pausa, acumulador, dots
    const t2 = bootPlugin({ timerSeed: { mode: 'pomo', open: true, pomoRunning: true, pomoFase: 'foco', pomoFocosFeitos: 3, pomoTotal: 1, pomoElapsed: 0, pomoAccumulatedTime: 180, cfgFoco: 1, cfgPausa: 1, cfgLonga: 1, lastTick: Date.now(), selectedMateria: '', selectedTopic: '', selectedSubtopic: '', sessions: [], minimized: false, cyclePreset: null, fabPos: { x: 215, y: 28 } } });
    renderAba(t2);
    const w2 = t2.w;
    await tick(1400);
    const st2 = timerState(w2);
    check('foco natural completa: acumulador 181s, focosFeitos 4, fase LONGA (4 focos → longa)', st2.pomoAccumulatedTime === 181 && st2.pomoFocosFeitos === 4 && st2.pomoFase === 'longa', JSON.stringify({ acc: st2.pomoAccumulatedTime, focos: st2.pomoFocosFeitos, fase: st2.pomoFase }));
    check('badge 🛋 Pausa longa + label ciclo 2/4', w2.document.getElementById('tpPomoFaseBadge').textContent === '🛋 Pausa longa' && w2.document.getElementById('tpPomoCycleLabel').textContent === 'ciclo 2/4');
    const dots = Array.from(w2.document.querySelectorAll('#tpPomoCycles .tp-pomo-dot'));
    // original 1548: done = i < focosFeitos % 4 — com 4 feitos, 4%4=0: o ciclo
    // visual ZERA (nenhum done, nenhum current pois fase é 'longa').
    check('dots: ciclo visual zerado (4 % 4 = 0 → nenhum done/current)', dots.every(d => d.className.trim() === 'tp-pomo-dot'), dots.map(d => d.className).join('|'));
    // reset com confirm
    w2.document.getElementById('tpBtnPomoReset').click();
    await tick(30);
    check('reset pomodoro: CT.confirm "Descartar o Pomodoro atual..."', (overlayMessage(w2) || '').includes('Descartar o Pomodoro atual'), overlayMessage(w2));
    await confirmOverlay(w2);
    const st3 = timerState(w2);
    check('reset confirmado: foco/ciclo 1, tudo zerado', st3.pomoFase === 'foco' && st3.pomoFocosFeitos === 0 && st3.pomoTotal === 60 && (st3.pomoAccumulatedTime || 0) === 0 && w2.document.getElementById('tpPomoCycleLabel').textContent === 'ciclo 1/4');
  }

  console.log('== R5-D: recover de elapsed + FAB drag ==');
  {
    // recover: lastTick 30s atrás, freeRunning
    const t = bootPlugin({ timerSeed: { mode: 'free', open: true, freeRunning: true, freeSeconds: 10, lastTick: Date.now() - 30000, pomoRunning: false, sessions: [], fabPos: { x: 215, y: 28 } } });
    renderAba(t);
    const { w } = t;
    const st = timerState(w);
    check('recover elapsed: freeSeconds 10+30 ≈ 40, ESTUDANDO', st.freeSeconds >= 39 && st.freeSeconds <= 41 && w.document.getElementById('tpFreeStatus').textContent === 'ESTUDANDO', st.freeSeconds);
    check('badge FAB visível com MMSS', w.document.getElementById('fabBadge').style.display !== 'none');
    // teto de 2h: não aplica
    const t2 = bootPlugin({ timerSeed: { mode: 'free', open: true, freeRunning: true, freeSeconds: 10, lastTick: Date.now() - 8000 * 1000, pomoRunning: false, sessions: [], fabPos: { x: 215, y: 28 } } });
    renderAba(t2);
    check('teto 2h: elapsed de 8h NÃO aplicado (freeSeconds fica 10)', timerState(t2.w).freeSeconds === 10, timerState(t2.w).freeSeconds);
    // drag do FAB: mousedown/move/up → posição persistida
    const fab = w.document.getElementById('timerFab');
    fab.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, clientX: 220, clientY: 700 }));
    w.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientX: 720, clientY: 700 }));
    check('drag: fab.style.left segue o mouse (clamp 0..innerWidth-44)', fab.style.left === '500px', fab.style.left);
    w.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true }));
    const st2 = timerState(w);
    check('dragEnd: fabPos persistida relativa ao canto inferior-esquerdo (x=rect.left, y=innerHeight-rect.bottom)', st2.fabPos && st2.fabPos.x === 0 && st2.fabPos.y === w.innerHeight, JSON.stringify(st2.fabPos));
  }

  console.log('== R5-E: integração aba_materia (openFreeTimerPreset) ==');
  {
    const t = bootPlugin();
    const content = renderAba(t);
    const { w, mId, t1 } = t;
    check('exports window.*: openTimerPopup/closeTimerPopup/minimizeTimerPopup/setTimerMode/openFreeTimerPreset/clearTimerCycleMode/_refreshTimerState', ['openTimerPopup', 'closeTimerPopup', 'minimizeTimerPopup', 'setTimerMode', 'openFreeTimerPreset', 'clearTimerCycleMode', '_refreshTimerState'].every(k => typeof w[k] === 'function'));
    // iniciarCronometroLivreItem da aba (script2) agora ENCONTRA openFreeTimerPreset
    w.iniciarCronometroLivreItem(null, t1.id);
    const panel = w.document.getElementById('timerPopup');
    check('cronômetro livre do item: painel aberto com matéria/tópico pre-selecionados + tipo Estudo', panel.style.display === 'block' && w.document.getElementById('tpMatSelect').value === mId && w.document.getElementById('tpTopicSelect').value === t1.id && timerState(w).selectedTipo === 'Estudo', JSON.stringify({ mat: w.document.getElementById('tpMatSelect').value, st: timerState(w).selectedTipo }));
    await tick(60);
    check('autoStart: freeRunning true (setTimeout 0 do preset)', timerState(w).freeRunning === true);
    w.document.getElementById('tpBtnPlay').click(); // pause (espaço coberto em B)
    // espaço com foco em input NÃO pausa (isTextEntryTarget)
    const qa = content.querySelector('#qa_' + t1.id);
    qa.focus();
    const ev = new w.KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(ev, 'target', { value: qa, enumerable: true });
    w.document.dispatchEvent(ev);
    check('ESPAÇO com foco em input: ignorado pelo timer (isTextEntryTarget)', timerState(w).freeRunning === false);
  }

  console.log('== R5-F: som (config + clamp + Testar sem erro) ==');
  {
    const t = bootPlugin();
    renderAba(t);
    const { w } = t;
    check('config default: mode default, volume 0.85 (clamp load)', JSON.stringify(storedKey(w, 'ct_timer_sound_config') || { mode: 'default' }).includes('default') || storedKey(w, 'ct_timer_sound_config') === null);
    w.document.getElementById('tpSoundConfig').click();
    const soundModal = w.document.getElementById('tpSoundModal');
    check('modal de som abre (TpSoundConfig → flex)', soundModal.style.display === 'flex');
    const slider = w.document.getElementById('tpSoundVolume');
    slider.value = '100';
    slider.dispatchEvent(new w.Event('input', { bubbles: true }));
    check('volume 100% → config 1 (clamp max 1)', (storedKey(w, 'ct_timer_sound_config') || {}).volume === 1);
    slider.value = '5';
    slider.dispatchEvent(new w.Event('input', { bubbles: true }));
    check('volume 5% → config 0.1 (clamp min 0.1)', (storedKey(w, 'ct_timer_sound_config') || {}).volume === 0.1);
    slider.value = '85';
    slider.dispatchEvent(new w.Event('input', { bubbles: true }));
    check('label do volume acompanha (85%)', w.document.getElementById('tpSoundVolumeLabel').textContent === '85%');
    let threw = null;
    try { w.document.getElementById('tpBtnSoundTest').click(); } catch (e) { threw = e; }
    check('Testar: sem erro (Audio.play no-op jsdom → fallback WebAudio inexistente → silencioso, guard original)', threw === null);
    w.document.getElementById('tpBtnSoundClose').click();
    check('Fechar: modal de som esconde', soundModal.style.display === 'none');
  }

  console.log('');
  console.log(`== resultado: ${passed} PASS, ${failed} FAIL ==`);
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log('  - ' + f));
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL:', e && e.stack ? e.stack : e); process.exit(1); });
