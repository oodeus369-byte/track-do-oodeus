/**
 * Track do Oodeus — testes R10 (etapa-13 §2: revisoes.html)
 *
 * Harness jsdom + vm.runInContext (mesmo padrão do r9-dashboard.test.js, sem
 * Chart/flashcards/crono): body.html injetado ANTES dos scripts; cadeia =
 * ordem do original: IIFE sidebar (327-383) → script principal (384-823) →
 * timer-popup.js (828, por último como o <script src>). theme.js/data.js rodam
 * ANTES (vm, como no onload do plugin); nav.js NÃO roda (guards typeof cobrem
 * — desvio documentado no render-util R3, e aqui o nav boot ANTES da cadeia).
 * O foco ?revisaoId= vem por window.__CT_PAGE_SEARCH__ (seam [R10-port] 566,
 * padrão aba-materia 1297). SEM correções D1-D12 (doc-mestre R10: dead code
 * verbatim; duplicação badge/nome IIFE×render() replicada).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const revBodyHtml = read('pages/revisoes/body.html');
const revMainSrc = read('pages/revisoes/main.pagejs');
const revStyleSrc = read('pages/revisoes/style.css');
const revScript1Src = read('pages/revisoes/script1.pagejs');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + String(extra).slice(0, 400) : '')); console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); }
}

const vm = require('vm');
function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename });
}
const lex = (w, expr) => vm.runInContext(expr, w.__ctx, { filename: 'lex-snip' });
const tick = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => s.replace(/\r/g, '');

function bootRev({ search = '', hash = '', noCid = false, revisoes = [], questoes = [], configGoal = null, preRun = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + revBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.ResizeObserver = w.ResizeObserver || function () { this.observe = () => {}; this.unobserve = () => {}; this.disconnect = () => {}; };
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
  if (!w.TrackTheme) w.TrackTheme = { palette: () => ({ text: '#fff', border: '#444', bg: '#111' }) };
  vmRun(w, dataSrc, 'data.js');
  const cId = w.CT.saveConcurso({ nome: 'Defensoria 2027', cargo: 'Defensor', banca: 'FGV' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Atualidades' });
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[0], nome: 'Controle de constitucionalidade' });
  w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'Repercussão geral' });
  const s1 = w.CT.getSubtopicos(t1.id)[0];
  const t2 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[1], nome: 'Eleições' });
  if (!noCid) w.sessionStorage.setItem('ct_concurso_ativo', cId);
  w.sessionStorage.setItem('ct_materia_ativa', mIds[0]);
  revisoes.forEach(r => w.CT.agendarRevisao(r.alvoId, r.data));
  questoes.forEach(q => w.CT.lancarQuestoes({ concursoId: cId, materiaId: q.materiaId || mIds[0], topicoId: q.topicoId || t1.id, ...(q.subtopId ? { subtopId: q.subtopId } : {}), resolvidas: q.resolvidas, acertos: q.acertos }));
  if (configGoal) {
    const saved = JSON.parse(w.localStorage.getItem('ct_cronograma_inteligente_' + cId) || '{}');
    w.localStorage.setItem('ct_cronograma_inteligente_' + cId, JSON.stringify({ ...saved, focusAlertsCustomEnabled: true, focusAlertsCustomGoal: configGoal }));
  }
  // shell.renderPage (plugin): expõe search/hash ANTES da cadeia
  w.__CT_PAGE_SEARCH__ = search;
  w.__CT_PAGE_HASH__ = hash;
  if (preRun) preRun(w, cId, mIds, t1, s1, t2);
  vmRun(w, revScript1Src, 'revisoes.html [sidebar]');
  vmRun(w, revMainSrc, 'revisoes.html [inline]');
  vmRun(w, timerSrc, 'timer-popup.js');
  return { dom: j, w, cId, mIds, t1, s1, t2, navSpy };
}

async function awaitBoot(t, extra) {
  const w = t.w;
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r, { once: true }));
  await tick(extra || 80);
}

const hoje = () => new Date(); // usado via CT._dateString nos seeds
const hojeStr = (w) => w.CT._dateString();
const dataStr = (w, dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return w.CT._dateString(d); };

(async () => {
  console.log('== R10-A: fonte/registro/seams estáticos ==');
  {
    const iRev = shellSrc.indexOf("'revisoes.html'");
    const block = iRev > -1 ? shellSrc.slice(iRev, iRev + 1200) : '';
    check('shell.js: revisoes.html registrado com cadeia [script1 sidebar, main, timer-popup] NA ORDEM do original', iRev > -1
      && block.indexOf('../pages/revisoes/script1.pagejs') > -1
      && block.indexOf('../pages/revisoes/main.pagejs') > -1
      && block.indexOf('../pages/timer/timer-popup.pagejs') > -1
      && block.indexOf('../pages/revisoes/script1.pagejs') < block.indexOf('../pages/revisoes/main.pagejs')
      && block.indexOf('../pages/revisoes/main.pagejs') < block.indexOf('../pages/timer/timer-popup.pagejs'), block.slice(0, 300));
    check('shell.js: timer-popup POR ÚLTIMO na cadeia (como o <script src> 828 do original) + lazyModules []', block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/revisoes/main.pagejs') && /lazyModules:\s*\[\]/.test(block));
    check('shell.js: title "Revisões" + icon lucide check-check (asset NAV_ICON_FILES revisoes = check-double é outro: nav R1)', block.includes("title: 'Revisões'") && block.includes("icon: 'check-check'"));
    check('shell.js: header [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]'));
    check('shell.js: dashboard.html segue registrado (edit acidental restaurado) E revisoes.html presente', shellSrc.indexOf("'dashboard.html'") > -1 && iRev > -1);
    check('main.js R9: navigateTo preserva hash (pendingPageHash) — o goPage dashboard.html#flashcards do item Flashcards 198 funciona', mainPluginSrc.includes('this.pendingPageHash = hash;'));
    check('shell.js: __CT_PAGE_SEARCH__/__CT_PAGE_HASH__ expostos (padrão R4/R9)', shellSrc.includes('window.__CT_PAGE_SEARCH__') && shellSrc.includes('window.__CT_PAGE_HASH__'));

    check('body.html: 9 onclick goPage (8 location.href → goPage + flashcards 198 especial) + <a href="ajuda.html"> com goPage+return false', (revBodyHtml.match(/onclick="goPage\('/g) || []).length === 9
      && revBodyHtml.includes("onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"")
      && revBodyHtml.includes('<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false"'), String((revBodyHtml.match(/onclick="goPage\('/g) || []).length));
    check('body.html: SEM location.href restante fora de comentários', !/location\.href/.test(revBodyHtml.replace(/<!--[\s\S]*?-->/g, '')));
    check('body.html: logo 190 é o 1º goPage (concursos.html)', revBodyHtml.indexOf("onclick=\"goPage('concursos.html')\"") > -1 && revBodyHtml.indexOf('brand-logo') < revBodyHtml.indexOf("onclick=\"goPage('concursos.html')\""));
    check('body.html: D1 — #filtroRow SEMPRE VAZIO (dead code verbatim)', /id="filtroRow">\s*<\/div>/.test(revBodyHtml.replace(/\r/g, '')) || /id="filtroRow">\s*<\/div>/.test(norm(revBodyHtml)));
    const bc = revBodyHtml.replace(/<!--[\s\S]*?-->/g, '');
    check('body.html: 3 cards sumário inline-styled (NÃO usa .summary-grid em elemento vivo) + #cntAtrasadas/#cntHoje/#cntFuturas', bc.includes('cntAtrasadas') && bc.includes('cntHoje') && bc.includes('cntFuturas') && !bc.includes('summary-grid'));
    check('body.html: 3 seções inline-styled com #listaAtrasadas/#listaHoje/#listaFuturas + #emptyState (FUTURAS sem contador lbl — verbatim)', ['listaAtrasadas', 'lblAtrasadas', 'listaHoje', 'lblHoje', 'listaFuturas', 'emptyState'].every(id => revBodyHtml.includes('id="' + id + '"')) && !revBodyHtml.includes('lblFuturas'));
    check('body.html: alerta de rendimento no topo (#secRendimentoAlerts display:none + #rendimentoAlertsList)', revBodyHtml.includes('id="secRendimentoAlerts"') && revBodyHtml.includes('id="rendimentoAlertsList"') && /id="secRendimentoAlerts"[^>]*display:none/.test(revBodyHtml));
    check('body.html: popup de revisão (302-325) com overlay closeOutside + opções 5/7/15/30 + popupDataCustom D12 placeholder inerte', revBodyHtml.includes('id="popupOverlay"') && revBodyHtml.includes('onclick="closeOutside(event)"')
      && /popup-opt-num">5</.test(revBodyHtml) && /popup-opt-num">30</.test(revBodyHtml)
      && revBodyHtml.includes('placeholder="Ou escolha uma data específica"') && revBodyHtml.includes('type="date"'));
    check('body.html: popup botões — skip "Não revisar mais" (confirmarRevisao(false)) + ok "✓ Agendar próxima revisão" (confirmarRevisao(true))', revBodyHtml.includes('class="popup-btn-skip" onclick="confirmarRevisao(false)"') && revBodyHtml.includes('class="popup-btn-ok" onclick="confirmarRevisao(true)"'));
    check('body.html: badge #revBadge é o PRIMEIRO .nav-badge do DOM (render usa querySelector — funciona por acaso)', (() => {
      const b1 = bc.indexOf('class="nav-badge"');
      return b1 > -1 && bc.slice(b1, b1 + 80).includes('id="revBadge"') && bc.indexOf('id="flashTabBadge"') > b1;
    })());
    check('style.css: theme.css DEPOIS do inline documentado (padrão anômalo R1) + .review-focus + CSS morto D2-D9 verbatim (.summary-grid, .rev-section, .agenda-)', revStyleSrc.includes('.review-focus') && revStyleSrc.includes('.summary-grid') && revStyleSrc.includes('.rev-section') && revStyleSrc.includes('.agenda-'));
    check('style.css: .rev-card.atrasada/.hoje/.proxima COM border-left colorido (D11 — o inline do template o anula; regra morta replicada)', revStyleSrc.includes('.rev-card.atrasada') && revStyleSrc.includes('.rev-card.hoje') && revStyleSrc.includes('.rev-card.proxima') && revStyleSrc.includes('border-left'));

    check('main.pagejs: goPage local delega a __CT_NAV_GO_PAGE (precedente aba-materia script2)', revMainSrc.includes('function goPage(dest) {') && revMainSrc.includes('if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }') && !revMainSrc.includes('function reloadPagina'));
    check('main.pagejs: seam 386 — redirect sem cId SEM return (o location.href original não interrompe; boot segue até render())', norm(revMainSrc).includes("if (!cId) goPage('concursos.html');") && !/if \(!cId\) goPage\('concursos\.html'\); return/.test(norm(revMainSrc)));
    check('main.pagejs: seam 416 — abrirAlvoRevisao → goPage(\'aba_materia.html?\' + params) com foco topico/subtopico + topicoId set', revMainSrc.includes("goPage('aba_materia.html?' + params.toString());") && revMainSrc.includes("foco: ctx.subtopId ? 'subtopico' : 'topico'") && revMainSrc.includes("params.set('topicoId', ctx.topicoId);"));
    check('main.pagejs: seam 566 — aplicarFocoRevisaoUrl lê window.__CT_PAGE_SEARCH__ || location.search (padrão aba-materia 1297)', revMainSrc.includes("new URLSearchParams(window.__CT_PAGE_SEARCH__ || location.search).get('revisaoId')"));
    check('main.pagejs: D10 — pctClass DEFINIDA e NUNCA chamada (só 2 ocorrências: a decl e a referência CT.pctClass dentro dela)', revMainSrc.includes('function pctClass(p){return CT.pctClass?CT.pctClass(p):\'none\';}') && (revMainSrc.match(/pctClass\(/g) || []).length === 2, String((revMainSrc.match(/pctClass\(/g) || []).length));
    check('main.pagejs: pctColor DELEGADA a CT.pctColor (percentuais dos cards)', revMainSrc.includes('function pctColor(p){return CT.pctColor?CT.pctColor(p):\'var(--text3)\';}'));
    check('main.pagejs: D11 — border inline do template (.rev-card) anula o border-left do CSS (barra colorida nunca aparece)', revMainSrc.includes('style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"'));
    check('main.pagejs: title do botão cronômetro COM acento (R14 normalizou: cronômetro/revisão) + entidades ⏱️ (&#9201;&#65039;)', revMainSrc.includes('Iniciar cronômetro livre para esta revisão') && revMainSrc.includes('&#9201;&#65039;'));
    check('main.pagejs: badge via document.querySelector(\'.nav-badge\') — 1º do DOM (#revBadge por acaso) + duplicação concurso-nome/banca: IIFE usa getElementById(sideNome/sideBanca) e render() usa querySelector(.concurso-nome/.concurso-banca)', revMainSrc.includes("document.querySelector('.nav-badge')") && revScript1Src.includes("document.getElementById('sideNome')") && revScript1Src.includes("document.getElementById('sideBanca')") && revMainSrc.includes("document.querySelector('.concurso-nome')") && revMainSrc.includes("document.querySelector('.concurso-banca')"));
    check('main.pagejs: template cards — atrasada/hoje com Adiar+✓ Revisei+Excluir; futura com Revisar agora+Excluir (tipo futura → class proxima)', revMainSrc.includes("const tipoClass = tipo === 'futura' ? 'proxima' : tipo;") && revMainSrc.includes("onclick=\"adiarRevisao('${alvoId}')\"") && revMainSrc.includes("onclick=\"abrirPopupRevisao('${alvoId}')\"") && revMainSrc.includes("onclick=\"excluirRevisao('${r.id}')\"") && revMainSrc.includes('Revisar agora') && revMainSrc.includes('✓ Revisei') && revMainSrc.includes('Adiar'));
    check('main.pagejs: sort data ASC nas atrasadas/futuras (localeCompare) — hoje NÃO ordena', revMainSrc.includes(".sort((a,b)=>a.data.localeCompare(b.data))") && (revMainSrc.match(/localeCompare\(b\.data\)/g) || []).length === 2);
    check('main.pagejs: render() chama renderRendimentoAlerts + aplicarFocoRevisaoUrl no fim e render() roda no boot (822)', revMainSrc.includes('renderRendimentoAlerts();') && revMainSrc.includes('aplicarFocoRevisaoUrl();') && /render\(\);\s*$/.test(norm(revMainSrc).trimEnd()));
    check('main.pagejs: foco — _focusRevisaoAplicado guard + setTimeout 80ms + scrollIntoView + .review-focus removida após 3200ms (timeout inline de 1 linha)', revMainSrc.includes('if (_focusRevisaoAplicado) return;') && revMainSrc.includes("alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })") && revMainSrc.includes("setTimeout(() => alvo.classList.remove('review-focus'), 3200);"));
    check('main.pagejs: rendimento — getFocusAlertsConfig com clamp 66-99 default 80 (D? verbatim) + buildRendimentoAlert (resolvidas<5→null; pct<=65 critico; abaixo_meta com customEnabled)', (() => {
      const n = norm(revMainSrc);
      return n.includes('goal = Math.min(99, Math.max(66, goal));') && n.includes('if isNaN') === false && n.includes('isNaN(goal)) goal = 80;')
        && n.includes('if (resolvidas < 5 || pct == null) return null;') && n.includes('if (pct <= 65) {') && n.includes("focusConfig.customEnabled && pct < focusConfig.customGoal");
    })());
    check('main.pagejs: calcRecent — 30 mais recentes por horaInicio||createdAt||updatedAt (desc) e pct dos RECENTES tem prioridade sobre o geral', norm(revMainSrc).includes('var da = a.horaInicio || a.createdAt || a.updatedAt || \'\';') && norm(revMainSrc).includes('var recent = calcRecent(qs, 30);') && norm(revMainSrc).includes('var pct = recent.pct != null ? recent.pct : (general.pct != null ? general.pct : null);'));
    check('main.pagejs: alerts sort — BUG falsy-zero verbatim do original: order = {critico:0, abaixo_meta:1} + `order[a.tipo] || 9` faz CRITICO (0 falsy → 9) sortar DEPOIS de abaixo_meta (1); empate por pct ASC', norm(revMainSrc).includes("var order = { critico: 0, abaixo_meta: 1 };") && norm(revMainSrc).includes('var ao = order[a.tipo] || 9;') && norm(revMainSrc).includes('return (a.pct || 0) - (b.pct || 0);'));
    check('main.pagejs: popup — confirmarRevisao com data custom prioridade sobre opções + setHours(12,0,0,0) + CT.concluirRevisao', norm(revMainSrc).includes('const custom = document.getElementById(\'popupDataCustom\').value;') && norm(revMainSrc).includes('d.setHours(12,0,0,0)') && norm(revMainSrc).includes('CT.concluirRevisao(_revTopicoId, proximaData);'));
    check('main.pagejs: adiarRevisao REUTILIZA o popup — troca popup-btn-ok.onclick → adiarConfirmar + skip vira Cancelar + RESTAURA handlers', norm(revMainSrc).includes(".popup-btn-ok').onclick = () => adiarConfirmar();") && norm(revMainSrc).includes(".popup-btn-skip').textContent = 'Cancelar';") && norm(revMainSrc).includes(".popup-btn-skip').onclick = () => confirmarRevisao(false);"));
    check('main.pagejs: adiarConfirmar → CT.agendarRevisao + restauração + render(); fallback dias 7', norm(revMainSrc).includes('CT.agendarRevisao(_revTopicoId, novaData);') && norm(revMainSrc).includes('const dias = sel ? parseInt(sel.textContent) : 7;'));
    check('main.pagejs: excluirRevisao async — await CT.confirm + fallback alert se CT.excluirRevisao falhar', norm(revMainSrc).includes("if (!(await CT.confirm('Excluir esta revisão agendada?'") && norm(revMainSrc).includes("alert('Não foi possível excluir a revisão.');"));
    check('main.pagejs: iniciarCronometroRevisao — preset {tipoEstudo:\'Estudo\', autoStart:true} + openFreeTimerPreset imediato OU retry 60ms (verbatim)', norm(revMainSrc).includes('tipoEstudo: \'Estudo\',') && norm(revMainSrc).includes('autoStart: true') && norm(revMainSrc).includes('}, 60);'));
    check('main.pagejs: abrirAlvoRevisao Ctrl+click → CT.copy(innerText) SEM navegação (precedente R6/R7)', norm(revMainSrc).includes('if (event && event.ctrlKey) {') && norm(revMainSrc).includes('CT.copy(event.currentTarget.innerText);'));
    check('script1.pagejs: IIFE sidebar VERBATIM (328-382) — SEM seams, revBadge por concurso, pré-edital timer-box', (() => {
      const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/revisoes.html', 'utf8').split(/\r?\n/);
      const bloco = orig.slice(327, 382).join('\r\n');
      return revScript1Src.includes(bloco) && !/goPage|location\.href/.test(norm(revScript1Src).replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
    })());
    check('script1.pagejs: NÃO declara goPage nem reloadPagina (script original não navega)', !revScript1Src.includes('function goPage') && !revScript1Src.includes('function reloadPagina'));
    check('data.js: APIs de revisão presentes (getRevisoes/_resolverAlvoRevisao/getContextoRevisao/agendarRevisao/concluirRevisao/excluirRevisao/classificarRevisoes)', ['getRevisoes() {', '_resolverAlvoRevisao(alvo) {', 'getContextoRevisao(revisao) {', 'agendarRevisao(alvoId, data) {', 'concluirRevisao(alvoId, proximaData) {', 'excluirRevisao(revisaoId) {', 'classificarRevisoes() {'].every(s => dataSrc.includes(s)));
    check('data.js: classificarRevisoes compara strings (data < hoje / === / >) e filtra !concluida', norm(dataSrc).includes('revisoes.filter(r => r.data < hoje)') && norm(dataSrc).includes('revisoes.filter(r => r.data === hoje)') && norm(dataSrc).includes('revisoes.filter(r => r.data > hoje)'));
    check('timer-popup.pagejs: define window.openFreeTimerPreset (o retry de 60ms do script principal o consome)', timerSrc.includes('window.openFreeTimerPreset = openFreeTimerPreset;'));
  }

  console.log('== R10-B: boot/guards ==');
  {
    const t = bootRev({ noCid: true });
    check('guard 386: sem ct_concurso_ativo → goPage concursos.html (navSpy)', t.navSpy.includes('nav:concursos.html'), JSON.stringify(t.navSpy));
    check('redirect SEM return: a execução SEGUE até render() — revSub vazio (não "Carregando..."), sumário renderizado como 0', t.w.document.getElementById('revSub').textContent === ''
      && t.w.document.getElementById('cntAtrasadas').textContent === '0'
      && t.w.document.getElementById('emptyState').style.display === '', JSON.stringify([t.w.document.getElementById('revSub').textContent, t.w.document.getElementById('emptyState').style.display]));
    check('renderRendimentoAlerts sem cId → container display:none (guard interno)', t.w.document.getElementById('secRendimentoAlerts').style.display === 'none');
    check('IIFE sidebar sem cId → early return (sideNome/concurso-nome mantêm o "—" do body)', t.w.document.getElementById('sideNome').textContent === '—' && t.w.document.querySelector('.concurso-nome').textContent === '—');
  }
  {
    const t = bootRev();
    await awaitBoot(t, 120);
    check('boot com cId: IIFE sidebar preenche concurso-nome/banca + render() preenche revSub "NOME — N revisão(ões) pendente(s)" (duplicação viva — 2 escritas no mesmo alvo)', t.w.document.querySelector('.concurso-nome').textContent === 'Defensoria 2027'
      && t.w.document.querySelector('.concurso-banca').textContent === 'FGV'
      && t.w.document.getElementById('revSub').textContent === 'Defensoria 2027 — 0 revisão(ões) pendente(s)', t.w.document.getElementById('revSub').textContent);
    check('sem revisões: sumário 0/0/0 + emptyState visível + 3 seções display:none', t.w.document.getElementById('cntAtrasadas').textContent === '0' && t.w.document.getElementById('cntHoje').textContent === '0' && t.w.document.getElementById('cntFuturas').textContent === '0'
      && t.w.document.getElementById('emptyState').style.display === ''
      && t.w.document.getElementById('secAtrasadas').style.display === 'none'
      && t.w.document.getElementById('secHoje').style.display === 'none'
      && t.w.document.getElementById('secFuturas').style.display === 'none');
    check('badge #revBadge vazio com 0 urgentes (textContent \'\')', t.w.document.getElementById('revBadge').textContent === '');
  }

  console.log('== R10-C: render/listas/cards/sort ==');
  {
    const t = bootRev({
      revisoes: [],
      preRun: (w, cId, mIds, t1, s1, t2) => {
        // revisões com ids determinísticos + datas variadas (seed direto no storage)
        w.CT._set('ct_revisoes', [
          { id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false, agendadaEm: '2025-12-01' },
          { id: 'revB', topicoId: t1.id, subtopId: s1.id, data: hojeStr(w), concluida: false, agendadaEm: '2025-12-01' },
          { id: 'revC', topicoId: t2.id, subtopId: null, data: dataStr(w, 20), concluida: false, agendadaEm: '2025-12-01' },
          { id: 'revD', topicoId: t2.id, subtopId: null, data: dataStr(w, 7), concluida: false, agendadaEm: '2025-12-01' },
          { id: 'revX', topicoId: t1.id, subtopId: null, data: '2026-02-01', concluida: true, agendadaEm: '2025-11-01' }, // concluída — ignorada
        ]);
      },
    });
    await awaitBoot(t, 120);
    check('classificação: sumário 1 atrasada / 1 hoje / 2 futuras (concluída ignorada)', t.w.document.getElementById('cntAtrasadas').textContent === '1' && t.w.document.getElementById('cntHoje').textContent === '1' && t.w.document.getElementById('cntFuturas').textContent === '2');
    check('revSub: "Defensoria 2027 — 4 revisão(ões) pendente(s)"', t.w.document.getElementById('revSub').textContent === 'Defensoria 2027 — 4 revisão(ões) pendente(s)', t.w.document.getElementById('revSub').textContent);
    check('badge #revBadge = urgentes (1 atrasada + 1 hoje = 2)', t.w.document.getElementById('revBadge').textContent === '2', t.w.document.getElementById('revBadge').textContent);
    check('querySelector(\'.nav-badge\') CASA o #revBadge (1º do DOM — o querySelector do render funciona por acaso da ordem)', t.w.document.querySelector('.nav-badge') === t.w.document.getElementById('revBadge'));
    check('seções visíveis com contadores (lblAtrasadas 1, lblHoje 1; futuras SEM contador — verbatim)', t.w.document.getElementById('secAtrasadas').style.display === '' && t.w.document.getElementById('lblAtrasadas').textContent === '1' && t.w.document.getElementById('lblHoje').textContent === '1' && t.w.document.getElementById('secFuturas').style.display === '' && t.w.document.getElementById('lblFuturas') === null);
    check('cards: 1 .rev-card.atrasada + 1 .rev-card.hoje + 2 .rev-card.proxima (futura → proxima) com data-revisao-id', (() => {
      const d = t.w.document;
      return d.querySelectorAll('.rev-card.atrasada').length === 1
        && d.querySelectorAll('.rev-card.hoje').length === 1
        && d.querySelectorAll('.rev-card.proxima').length === 2
        && d.querySelectorAll('[data-revisao-id]').length === 4
        && d.querySelector('.rev-card.atrasada').getAttribute('data-revisao-id') === 'revA';
    })());
    check('sort futuras data ASC (revD 7 dias antes de revC no 1º card)', (() => {
      const cards = Array.from(t.w.document.querySelectorAll('#listaFuturas .rev-card'));
      return cards.length === 2 && cards[0].getAttribute('data-revisao-id') === 'revD' && cards[1].getAttribute('data-revisao-id') === 'revC';
    })());
    check('card atrasada: nome do tópico + matéria • subtópico no card de hoje + botões Adiar/✓ Revisei/Excluir + ⏱️ entidades decodificadas + title COM acento (R14)', (() => {
      const d = t.w.document;
      const cardA = d.querySelector('#listaAtrasadas .rev-card');
      const cardH = d.querySelector('#listaHoje .rev-card');
      const txtA = cardA.innerHTML;
      const txtH = cardH.innerHTML;
      const conds = {
        tA_top: txtA.includes('Controle de constitucionalidade'), tA_mat: txtA.includes('DIREITO CONSTITUCIONAL'),
        tH_sub: txtH.includes('Repercussão geral'), tH_mat: txtH.includes('DIREITO CONSTITUCIONAL • Controle de constitucionalidade'),
        adiar: txtA.includes('>Adiar</button>'), revisei: txtA.includes('✓ Revisei'), excluir: txtA.includes('Excluir'),
        relogio: txtA.includes('⏱️'), comAcento: txtA.includes('Iniciar cronômetro livre para esta revisão'),
      };
      if (!Object.values(conds).every(Boolean)) console.log('    DIAG:', JSON.stringify(conds), '| tH:', JSON.stringify(txtH.slice(0, 400)));
      return Object.values(conds).every(Boolean);
    })());
    check('D11 vivo no DOM: card .atrasada TEM border-left na regra CSS mas o style inline border:1px solid var(--border) ANULA (barra colorida nunca aparece — replicada)', (() => {
      const card = t.w.document.querySelector('#listaAtrasadas .rev-card');
      return card.getAttribute('style').includes('border:1px solid var(--border)') && card.getAttribute('style').includes('border-radius:12px');
    })());
    check('card futura: SEM botão Adiar/✓ Revisei; TEM "Revisar agora" + Excluir', (() => {
      const txt = t.w.document.querySelector('#listaFuturas .rev-card').innerHTML;
      return txt.includes('Revisar agora') && txt.includes('Excluir') && !txt.includes('>Adiar</button>') && !txt.includes('✓ Revisei');
    })());
    check('pctBadge do card: pct do topico via CT.calcStats (seed 10/7 → 70% com pctColor)', (() => {
      t.w.CT.lancarQuestoes({ concursoId: t.cId, materiaId: t.mIds[0], topicoId: t.t2.id, resolvidas: 10, acertos: 7 });
      t.w.render();
      const txt = t.w.document.querySelector('#listaFuturas .rev-card').innerHTML;
      return txt.includes('>70%</span>') && txt.includes('font-weight:700');
    })());
    check('concluída (revX) NÃO vira card nem entra no sumário', (() => {
      const d = t.w.document;
      return d.querySelectorAll('[data-revisao-id="revX"]').length === 0 && d.querySelectorAll('[data-revisao-id]').length === 4;
    })());
  }

  console.log('== R10-D: interações ==');
  {
    const t = bootRev({
      revisoes: [],
      preRun: (w, cId, mIds, t1, s1, t2) => {
        w.CT._set('ct_revisoes', [
          { id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false },
          { id: 'revB', topicoId: s1.id, subtopId: s1.id, data: hojeStr(w), concluida: false },
        ]);
      },
    });
    await awaitBoot(t, 120);
    // abrirAlvoRevisao normal (t1)
    t.w.abrirAlvoRevisao({ ctrlKey: false, stopPropagation() {} }, t.t1.id);
    check('abrirAlvoRevisao normal: goPage aba_materia.html?foco=topico&id=<t1>&topicoId=<t1> + sessionStorage ct_materia_ativa/ct_concurso_ativo', t.navSpy.some(p => p === 'nav:aba_materia.html?foco=topico&id=' + t.t1.id + '&topicoId=' + t.t1.id)
      && t.w.sessionStorage.getItem('ct_materia_ativa') === t.mIds[0]
      && t.w.sessionStorage.getItem('ct_concurso_ativo') === t.cId, JSON.stringify(t.navSpy));
    // abrirAlvoRevisao normal (subtopico)
    const n0 = t.navSpy.length;
    t.w.abrirAlvoRevisao({ ctrlKey: false, stopPropagation() {} }, t.s1.id);
    check('abrirAlvoRevisao de subtópico: foco=subtopico&id=<s1>&topicoId=<t1>', t.navSpy.slice(n0).some(p => p === 'nav:aba_materia.html?foco=subtopico&id=' + t.s1.id + '&topicoId=' + t.t1.id), JSON.stringify(t.navSpy.slice(n0)));
    // Ctrl+click → copy, sem navegação
    const n1 = t.navSpy.length;
    let stopped = false;
    t.w.CT.copy = (txt) => { t.w.__copied = txt; };
    t.w.abrirAlvoRevisao({ ctrlKey: true, stopPropagation() { stopped = true; }, currentTarget: { innerText: 'CONTROLE DE CONSTITUCIONALIDADE' } }, t.t1.id);
    check('Ctrl+click: CT.copy(innerText) + stopPropagation + SEM navegação (navSpy parado)', t.w.__copied === 'CONTROLE DE CONSTITUCIONALIDADE' && stopped && t.navSpy.length === n1);
    // iniciarCronometroRevisao com openFreeTimerPreset disponível (timer-popup rodou) — espiona
    let presetSpy = [];
    const origPreset = t.w.openFreeTimerPreset;
    t.w.openFreeTimerPreset = (p) => { presetSpy.push(p); };
    t.w.iniciarCronometroRevisao({ preventDefault() {}, stopPropagation() {} }, t.t1.id);
    check('iniciarCronometroRevisao: preset {materiaId, topicoId, subtopicoId:\'\', tipoEstudo:\'Estudo\', autoStart:true} direto quando openFreeTimerPreset existe', presetSpy.length === 1 && presetSpy[0].tipoEstudo === 'Estudo' && presetSpy[0].autoStart === true && presetSpy[0].topicoId === t.t1.id && presetSpy[0].materiaId === t.mIds[0] && presetSpy[0].subtopicoId === '', JSON.stringify(presetSpy));
    // retry 60ms quando openFreeTimerPreset não existe ainda
    delete t.w.openFreeTimerPreset;
    presetSpy = [];
    t.w.iniciarCronometroRevisao({ preventDefault() {}, stopPropagation() {} }, t.t1.id);
    t.w.openFreeTimerPreset = (p) => { presetSpy.push(p); }; // instalado logo após a checagem síncrona falhar
    await tick(100);
    check('iniciarCronometroRevisao SEM openFreeTimerPreset: retry de 60ms chama o preset quando ele aparece', presetSpy.length === 1 && presetSpy[0].autoStart === true, JSON.stringify(presetSpy));
    // popup confirmar: opção selecionada (5) — sem data custom
    t.w.abrirPopupRevisao(t.t1.id);
    check('abrirPopupRevisao: overlay visible + popupTopico nome + 1ª opção selected + data custom limpa', t.w.document.getElementById('popupOverlay').classList.contains('visible')
      && t.w.document.getElementById('popupTopico').textContent === 'Controle de constitucionalidade'
      && t.w.document.querySelector('.popup-opt.selected .popup-opt-num').textContent === '5'
      && t.w.document.getElementById('popupDataCustom').value === '');
    const antes = t.w.CT.getRevisoes().length;
    t.w.confirmarRevisao(true);
    const depois = t.w.CT.getRevisoes();
    check('confirmarRevisao(true) opção 5: CT.concluirRevisao marca a pendente concluida + agenda nova data (hoje+5, 12h) + popup fecha + render()', (() => {
      const concluida = depois.find(r => r.topicoId === t.t1.id && !r.subtopId && r.concluida && !r.substituida);
      const nova = depois.find(r => r.topicoId === t.t1.id && !r.subtopId && !r.concluida);
      return depois.length === antes + 1 && !!concluida && !!nova && nova.data === dataStr(t.w, 5)
        && !t.w.document.getElementById('popupOverlay').classList.contains('visible')
        && t.w.document.getElementById('cntAtrasadas').textContent === '0';
    })(), JSON.stringify(depois));
    // popup confirmar: data custom tem prioridade
    t.w.abrirPopupRevisao(t.s1.id);
    t.w.document.getElementById('popupDataCustom').value = '2026-12-25';
    t.w.confirmarRevisao(true);
    const novaCustom = t.w.CT.getRevisoes().find(r => r.subtopId === t.s1.id && !r.concluida);
    check('confirmarRevisao(true) COM data custom: custom vence as opções (2026-12-25)', !!novaCustom && novaCustom.data === '2026-12-25', JSON.stringify(novaCustom));
    // confirmarRevisao(false) — não revisar mais (sem nova data)
    t.w.abrirPopupRevisao(t.t1.id);
    const antesF = t.w.CT.getRevisoes().filter(r => r.topicoId === t.t1.id && !r.subtopId && !r.concluida).length;
    t.w.confirmarRevisao(false);
    const depoisF = t.w.CT.getRevisoes().filter(r => r.topicoId === t.t1.id && !r.subtopId && !r.concluida).length;
    check('confirmarRevisao(false): concluirRevisao SEM proximaData — pendência some, NADA é agendado', antesF === 1 && depoisF === 0 && !t.w.CT.getRevisoes().some(r => r.topicoId === t.t1.id && !r.subtopId && !r.concluida));
    // adiarRevisao — troca handlers
    t.w.abrirPopupRevisao(t.t1.id); // reabre (na verdade confirmarRevisao acima fechou; reabrir para adiar)
    const antesAdiar = t.w.CT.getRevisoes().length;
    t.w.adiarRevisao(t.t1.id);
    check('adiarRevisao: título "📅 Adiar: <nome>" + skip vira "Cancelar" + ok trocado para adiarConfirmar', t.w.document.getElementById('popupTopico').textContent.startsWith('📅 Adiar: Controle de constitucionalidade')
      && t.w.document.querySelector('.popup-btn-skip').textContent === 'Cancelar', t.w.document.getElementById('popupTopico').textContent);
    t.w.document.querySelector('.popup-btn-ok').dispatchEvent(new t.w.Event('click', { bubbles: true }));
    check('adiarConfirmar: CT.agendarRevisao com opção 5 (hoje+5) + popup fecha + handlers RESTAURADOS (skip "Não revisar mais"/confirmarRevisao(false)) + render()', (() => {
      const nova = t.w.CT.getRevisoes().find(r => r.topicoId === t.t1.id && !r.subtopId && !r.concluida);
      return t.w.CT.getRevisoes().length === antesAdiar + 1 && nova && nova.data === dataStr(t.w, 5)
        && !t.w.document.getElementById('popupOverlay').classList.contains('visible')
        && t.w.document.querySelector('.popup-btn-skip').textContent === 'Não revisar mais';
    })(), JSON.stringify(t.w.CT.getRevisoes()));
    // adiar via Cancelar (skip) — restaura sem agendar
    t.w.abrirPopupRevisao(t.t1.id);
    t.w.adiarRevisao(t.t1.id);
    const antesCancel = t.w.CT.getRevisoes().length;
    t.w.document.querySelector('.popup-btn-skip').dispatchEvent(new t.w.Event('click', { bubbles: true }));
    check('adiar Cancelar (skip): fecha popup, NÃO agenda e restaura handlers (ok volta a confirmarRevisao(true))', t.w.CT.getRevisoes().length === antesCancel
      && !t.w.document.getElementById('popupOverlay').classList.contains('visible')
      && t.w.document.querySelector('.popup-btn-skip').textContent === 'Não revisar mais');
    // excluirRevisao — confirm true
    let alertSpy = [];
    t.w.alert = (m) => { alertSpy.push(m); };
    t.w.abrirPopupRevisao(t.t1.id);
    t.w.document.getElementById('popupOverlay').classList.remove('visible'); // fechar popup (não interfere)
    const idExcluir = t.w.CT.getRevisoes().find(r => !r.concluida && r.topicoId === t.t1.id && !r.subtopId)?.id;
    const p1 = t.w.excluirRevisao(idExcluir);
    await tick(30);
    const ok = t.w.document.querySelector('.ct-alert-ok');
    check('excluirRevisao: CT.confirm abre overlay com "Excluir" como label de confirmação', !!ok && ok.textContent === 'Excluir', ok && ok.textContent);
    ok.dispatchEvent(new t.w.Event('click', { bubbles: true }));
    await p1;
    await tick(30);
    check('excluirRevisao confirmado: revisão removida do storage + render() atualiza (sem alert de erro)', !t.w.CT.getRevisoes().some(r => r.id === idExcluir) && alertSpy.length === 0, JSON.stringify(alertSpy));
    // excluir id inexistente → fallback alert
    const antesFall = t.w.CT.getRevisoes().length;
    const p2 = t.w.excluirRevisao('nao-existe');
    await tick(30);
    t.w.document.querySelector('.ct-alert-ok').dispatchEvent(new t.w.Event('click', { bubbles: true }));
    await p2;
    await tick(30);
    check('excluirRevisao de id inexistente: CT.excluirRevisao false → fallback alert("Não foi possível excluir a revisão.") e storage intacto', alertSpy.length === 1 && alertSpy[0] === 'Não foi possível excluir a revisão.' && t.w.CT.getRevisoes().length === antesFall, JSON.stringify(alertSpy));
    // closeOutside
    t.w.abrirPopupRevisao(t.t1.id);
    const overlay = t.w.document.getElementById('popupOverlay');
    const ev = new t.w.Event('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: overlay });
    t.w.closeOutside(ev);
    check('closeOutside: click no PRÓPRIO overlay fecha o popup', !overlay.classList.contains('visible'));
  }

  console.log('== R10-E: alerta de rendimento ==');
  {
    // 1) crítico: 30 questões recentes do SUBTÓPICO com pct 50 (30 q × 2 resolvidas, 1 acerto)
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1) => {
      for (let i = 0; i < 30; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 });
    } });
    await awaitBoot(t, 120);
    check('pct 50 nas últimas 60 questões → critico: container visível + card vermelho + texto exato do detalhe', (() => {
      const d = t.w.document;
      if (d.getElementById('secRendimentoAlerts').style.display === 'none') return false;
      const html = d.getElementById('rendimentoAlertsList').innerHTML;
      return html.includes('⚠️ Atenção: Rendimento Baixo em Questões') === false // título está fora da lista
        && html.includes('Rendimento baixo em questões: 50% de acertos nas últimas 60 questões.')
        && html.includes('class="pct-badge r"') && html.includes('50%');
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 300));
    check('botão do alerta → abrirAlvoRevisao (class btn-revisar + onclick inline do alvoId)', t.w.document.getElementById('rendimentoAlertsList').innerHTML.includes('btn-revisar') && t.w.document.getElementById('rendimentoAlertsList').innerHTML.includes("abrirAlvoRevisao(event,'"));
  }
  {
    // 2) SEM custom enabled: pct 50 → critico (não abaixo_meta)
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1) => {
      for (let i = 0; i < 10; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 });
    } });
    await awaitBoot(t, 120);
    check('sem focusAlertsCustomEnabled: pct 50 → critico (abaixo_meta exige customEnabled)', t.w.document.getElementById('rendimentoAlertsList').innerHTML.includes('class="pct-badge r"') && !t.w.document.getElementById('rendimentoAlertsList').innerHTML.includes('abaixo da sua meta'));
  }
  {
    const q = [];
    for (let i = 0; i < 10; i++) q.push({ resolvidas: 2, acertos: 1 }); // 50% — mas <65 → critico
    const t = bootRev({ questoes: [], configGoal: null, preRun: (w, cId, mIds, t1, s1) => {
      // pct 70 nos recentes do subtopico (abaixo da meta 80 default)
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 10, acertos: 7 });
    } });
    await awaitBoot(t, 120);
    check('default goal 80 SEM custom: pct 70 <80 mas customEnabled false → SEM alerta', t.w.document.getElementById('secRendimentoAlerts').style.display === 'none');
  }
  {
    const t = bootRev({ configGoal: 80, preRun: (w, cId, mIds, t1, s1) => {
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 10, acertos: 7 });
    } });
    await awaitBoot(t, 120);
    check('customEnabled goal 80: pct 70 → abaixo_meta com badge y + detalhe "(meta: 80%)"', (() => {
      const html = t.w.document.getElementById('rendimentoAlertsList').innerHTML;
      return html.includes('Rendimento abaixo da sua meta: 70% de acertos nas últimas 10 questões (meta: 80%).') && html.includes('class="pct-badge y"');
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 300));
  }
  {
    const t = bootRev({ configGoal: 150, preRun: (w, cId, mIds, t1, s1) => {
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 100, acertos: 98 });
    } });
    await awaitBoot(t, 120);
    check('clamp superior: goal 150 → clamped 99; pct 98 <99 → alerta COM "(meta: 99%)" (o clamp vence o 150 salvo)', (() => {
      const html = t.w.document.getElementById('rendimentoAlertsList').innerHTML;
      return html.includes('(meta: 99%)') && !html.includes('(meta: 150%)');
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 300));
  }
  {
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1) => {
      // recent = 4 resolvidas (< 5) → SEM alerta (buildRendimentoAlert null)
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 });
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 2 });
    } });
    await awaitBoot(t, 120);
    check('resolvidas < 5 → SEM alerta (buildRendimentoAlert null; recent 4 < 5)', t.w.document.getElementById('secRendimentoAlerts').style.display === 'none', JSON.stringify(t.w.CT.getQuestoes({}).length));
  }
  {
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1, t2) => {
      // t1 (com subtop): pct 50 critico; t2 (sem subtop): pct 70 abaixo_meta (goal 80)
      for (let i = 0; i < 5; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 });
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[1], topicoId: t2.id, resolvidas: 10, acertos: 7 });
      const saved = JSON.parse(w.localStorage.getItem('ct_cronograma_inteligente_' + cId) || '{}');
      w.localStorage.setItem('ct_cronograma_inteligente_' + cId, JSON.stringify({ ...saved, focusAlertsCustomEnabled: true, focusAlertsCustomGoal: 80 }));
    } });
    await awaitBoot(t, 120);
    check('ordem COM BUG fiel: abaixo_meta (y, t2) vem ANTES de critico (r, t1 subtop) — o `order[a.tipo] || 9` com critico=0 falsy inverta a ordem; ambos presentes', (() => {
      const html = t.w.document.getElementById('rendimentoAlertsList').innerHTML;
      const iR = html.indexOf('class="pct-badge r"');
      const iY = html.indexOf('class="pct-badge y"');
      return iR > -1 && iY > -1 && iY < iR && html.includes('Repercussão geral') && html.includes('Eleições');
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 600));
  }
  {
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1, t2) => {
      // 2 críticos (tie 9/9 no sort com o bug) → empate resolvido por pct ASC: 50 antes de 60
      for (let i = 0; i < 5; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 }); // 50%
      for (let i = 0; i < 5; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[1], topicoId: t2.id, resolvidas: 10, acertos: 6 }); // 60%
    } });
    await awaitBoot(t, 120);
    check('empate de críticos: pct ASC (o menor % primeiro)', (() => {
      const html = t.w.document.getElementById('rendimentoAlertsList').innerHTML;
      const badges = html.match(/class="pct-badge r"[^>]*>(\d+)%/g) || [];
      return badges.length === 2 && Number(badges[0].match(/>(\d+)%/)[1]) <= Number(badges[1].match(/>(\d+)%/)[1]);
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 600));
  }
  {
    // pct dos recentes tem prioridade sobre o geral: 31 lançamentos no subtopico,
    // o mais velho com horaInicio ANTIGO explícito (dados espalham por cima do
    // horaInicio do lancarQuestoes) → take(30) determinístico = os 30 novos (50%);
    // geral = 70 resolvidas/30 acertos = 43% → detalhe cita 50% (recente vence)
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1) => {
      for (let i = 0; i < 30; i++) w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 2, acertos: 1 });
      w.CT.lancarQuestoes({ concursoId: cId, materiaId: mIds[0], topicoId: t1.id, subtopId: s1.id, resolvidas: 10, acertos: 0, data: '2025-01-01', horaInicio: '2025-01-01T00:00:00.000Z' });
    } });
    await awaitBoot(t, 120);
    check('prioridade do pct dos RECENTES: geral 43% × recente 50% → detalhe cita 50% nas últimas 60 (recente vence)', (() => {
      const html = t.w.document.getElementById('rendimentoAlertsList').innerHTML;
      return html.includes('Rendimento baixo em questões: 50% de acertos nas últimas 60 questões.');
    })(), t.w.document.getElementById('rendimentoAlertsList').innerHTML.slice(0, 400));
  }

  console.log('== R10-F: foco ?revisaoId= ==');
  {
    const t = bootRev({
      search: '?revisaoId=revB',
      preRun: (w, cId, mIds, t1, s1, t2) => {
        w.CT._set('ct_revisoes', [
          { id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false },
          { id: 'revB', topicoId: s1.id, subtopId: s1.id, data: hojeStr(w), concluida: false },
        ]);
      },
    });
    await awaitBoot(t, 300);
    check('foco: card do revisaoId recebe .review-focus (após timeout 80ms)', (() => {
      const card = t.w.document.querySelector('[data-revisao-id="revB"]');
      return !!card && card.classList.contains('review-focus');
    })());
    await tick(3300);
    check('foco: .review-focus removida após 3200ms', !t.w.document.querySelector('[data-revisao-id="revB"]').classList.contains('review-focus'));
    // guard: render() de novo NÃO re-aplica
    t.w.render();
    await tick(200);
    check('guard _focusRevisaoAplicado: render() subsequente NÃO re-aplica o foco (só 1 vez por boot)', !t.w.document.querySelector('[data-revisao-id="revB"]').classList.contains('review-focus'));
  }
  {
    const t = bootRev({ search: '?revisaoId=zzz', preRun: (w, cId, mIds, t1, s1, t2) => {
      w.CT._set('ct_revisoes', [{ id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false }]);
    } });
    await awaitBoot(t, 300);
    check('foco id inexistente: _focusRevisaoAplicado permanece false (guard não ativado — pode aplicar em render futura se surgir)', lex(t.w, '_focusRevisaoAplicado') === false);
    check('foco sem alvo: nenhum card com review-focus', t.w.document.querySelectorAll('.review-focus').length === 0);
  }
  {
    const t = bootRev({ search: '', preRun: (w, cId, mIds, t1, s1, t2) => {
      w.CT._set('ct_revisoes', [{ id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false }]);
    } });
    await awaitBoot(t, 300);
    check('sem ?revisaoId: aplicarFocoRevisaoUrl retorna cedo (sem foco)', t.w.document.querySelectorAll('.review-focus').length === 0 && lex(t.w, '_focusRevisaoAplicado') === false);
  }

  console.log('== R10-G: duplicação badge/nome + fluxo concluir → render ==');
  {
    const t = bootRev({ preRun: (w, cId, mIds, t1, s1, t2) => {
      w.CT._set('ct_revisoes', [
        { id: 'revA', topicoId: t1.id, subtopId: null, data: '2026-01-05', concluida: false },
        { id: 'revB', topicoId: t1.id, subtopId: s1.id, data: hojeStr(w), concluida: false },
      ]);
    } });
    await awaitBoot(t, 120);
    check('duplicação viva IIFE×render(): render() reescreve .concurso-nome/.concurso-banca que a IIFE já escreveu (mesmos valores, 2 escritas)', t.w.document.querySelector('.concurso-nome').textContent === 'Defensoria 2027' && t.w.document.querySelector('.concurso-banca').textContent === 'FGV');
    // concluir via popup → render atualiza badge/sumário/subtítulo
    t.w.abrirPopupRevisao(t.t1.id); // sem subtopId → revA
    t.w.confirmarRevisao(false);
    check('concluirRevisao → render(): revSub atualiza para "— 1 revisão(ões) pendente(s)"', t.w.document.getElementById('revSub').textContent === 'Defensoria 2027 — 1 revisão(ões) pendente(s)', t.w.document.getElementById('revSub').textContent);
    check('badge desconta: revA atrasada concluída → urgentes = 1 (hoje)', t.w.document.getElementById('revBadge').textContent === '1', t.w.document.getElementById('revBadge').textContent);
    check('flashTabBadge (#flashTabBadge) NÃO é o alvo do querySelector do render (2º .nav-badge)', (() => {
      const badges = t.w.document.querySelectorAll('.nav-badge');
      return badges.length >= 2 && badges[0].id === 'revBadge';
    })(), t.w.document.querySelectorAll('.nav-badge').length);
    // concluirRevisao direto via CT (a outra metade do fluxo)
    t.w.CT.concluirRevisao(t.s1.id, dataStr(t.w, 10));
    t.w.render();
    check('fluxo completo: tudo concluído → badge vazio + atrasada/hoje escondidas + nova futura agendada visível (emptyState NONE — existe futura)', (() => {
      const d = t.w.document;
      return d.getElementById('emptyState').style.display === 'none'
        && d.getElementById('revBadge').textContent === ''
        && d.getElementById('secAtrasadas').style.display === 'none'
        && d.getElementById('secHoje').style.display === 'none'
        && d.getElementById('secFuturas').style.display === ''
        && t.w.CT.getRevisoes().some(r => r.topicoId === t.t1.id && r.subtopId === t.s1.id && !r.concluida && r.data === dataStr(t.w, 10));
    })());
  }

  console.log('');
  console.log('R10: ' + passed + ' PASS / ' + failed + ' FAIL');
  process.exit(failed ? 1 : 0); // timer-popup deixa intervals vivos — sair explicitamente
  if (failures.length) {
    console.log('');
    console.log('FALHAS:');
    failures.forEach(f => console.log('  - ' + f));
    process.exitCode = 1;
  }
})().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
