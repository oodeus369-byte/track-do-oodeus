/**
 * Track do Oodeus — testes R11 (etapa-12: historico.html, página "Métricas")
 *
 * Harness jsdom + vm.runInContext (padrão r9/r10): body.html injetado ANTES
 * dos scripts; cadeia = ordem do original: chart.umd (vendored R9) →
 * html2canvas (vendored R11, 1.4.1) → IIFE sidebar (467-518) → script
 * principal (520-1953) → timer-popup.js (1959, por último como o <script
 * src>). theme.js/data.js rodam ANTES (vm, como no onload do plugin); nav.js
 * NÃO roda (desvio documentado no render-util R3). TrackTheme NÃO é stubado:
 * o themePalette() da página usa o fallback literal (valores = dark real) e os
 * ternários window.TrackTheme ? alpha(...) : rgba-literal assumem o literal —
 * determinístico. Canvas 2D fake (jsdom não implementa canvas). Assimetria
 * janela×global replicada como comportamento esperado. Dead code D1-D8
 * verbatim (doc-mestre): nada é corrigido.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const histBodyHtml = read('pages/historico/body.html');
const histMainSrc = read('pages/historico/main.pagejs');
const histStyleSrc = read('pages/historico/style.css');
const histScript1Src = read('pages/historico/script1.pagejs');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');
const chartSrc = read('vendor/chart.umd.pagejs');
const h2cSrc = read('vendor/html2canvas.pagejs');

// Corpos SEM o header de comentário do port (os checks de contagem de dead
// code D1-D3 e quirks devem contar só o código, não a documentação).
const bodyCore = histBodyHtml.slice(histBodyHtml.indexOf('-->') + 3);
const mainBody = histMainSrc.slice(histMainSrc.indexOf('*/') + 2);

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

// Canvas 2D fake (mesmo padrão do r9-dashboard.test.js: contexto NÃO é
// array-like — length/índices undefined; Chart.js faz t.length && (t=t[0])).
const CANVAS_VALUE_PROPS = new Set(['fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation', 'imageSmoothingEnabled', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'filter']);
function fake2dContext(canvas) {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return canvas;
      if (typeof p === 'symbol') return undefined;
      if (p === 'length' || p === '0' || p === '1') return undefined;
      if (CANVAS_VALUE_PROPS.has(p)) return t[p];
      if (p === 'measureText') return () => ({ width: 12, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 6, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 12 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      if (p === 'createPattern') return () => null;
      if (p === 'isPointInPath' || p === 'isPointInStroke') return () => false;
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

// Seed padrão (sessões em 3 dias distintos + questões):
//   sA hoje m1 30min 10:00 | sB hoje m2 1h 14:00 (tipoEstudo 'Vídeo') |
//   sC hoje SEM matéria 30min 08:00 | sD -3 dias (relativo) m1 4h 09:00 | sE 20/10 m2 1h 11:00
//   q1 hoje m1/t1 10/7 | q2 20/10 m1/t1 10/2 | q3 01/11 m1/t1 5/0 (dia só de questões)
function bootHist({ noCid = false, sessoes = null, questoes = null, ciclo = null, preRun = null, extraQ = null } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body>' + histBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.ResizeObserver = w.ResizeObserver || function () { this.observe = () => {}; this.unobserve = () => {}; this.disconnect = () => {}; };
  const ctxMap = new Map();
  w.HTMLCanvasElement.prototype.getContext = function () {
    if (!ctxMap.has(this)) ctxMap.set(this, fake2dContext(this));
    return ctxMap.get(this);
  };
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
  // TrackTheme NÃO é stubado — fallback literal da própria página
  vmRun(w, dataSrc, 'data.js');
  const cId = w.CT.saveConcurso({ nome: 'Defensoria 2027', cargo: 'Defensor', banca: 'FGV' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
  w.CT.saveMateria({ concursoId: cId, nome: 'Atualidades' });
  const mIds = w.CT.getMaterias().filter(m => m.concursoId === cId).map(m => m.id);
  const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: mIds[0], nome: 'Controle de constitucionalidade' });
  const s1 = w.CT.getSubtopicos(t1.id)[0];
  if (!noCid) w.sessionStorage.setItem('ct_concurso_ativo', cId);
  const hojeStr = w.CT._dateString();
  const dataStr = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return w.CT._dateString(d); };
  // sD usa data RELATIVA (dataStr(-3)) — fix 2026-11-22: com a seed fixa
  // 2026-11-15 a sessão saiu da janela rolante de 7 dias ([hoje-6..hoje]) e o
  // R11-F quebrou sem mudança de código (estouro agendado pelo calendário;
  // estende #2060 — data hardcoded em teste tem data de validade). 20/10 e
  // 01/11 continuam fixas: sempre passado distante, válidas enquanto o relógio
  // estiver em 2026 — as asserções de mês usam os cards do heatmap, não datas
  // absolutas, exceto onde notado.
  const sDData = dataStr(-3);
  const S = sessoes === null ? [
    { materiaId: mIds[0], duracaoSegundos: 1800, horaInicio: hojeStr + 'T10:00:00', data: hojeStr },
    { materiaId: mIds[1], duracaoSegundos: 3600, horaInicio: hojeStr + 'T14:00:00', data: hojeStr, tipoEstudo: 'Vídeo' },
    { duracaoSegundos: 1800, horaInicio: hojeStr + 'T08:00:00', data: hojeStr },
    { materiaId: mIds[0], duracaoSegundos: 14400, horaInicio: sDData + 'T09:00:00', data: sDData },
    { materiaId: mIds[1], duracaoSegundos: 3600, horaInicio: '2026-10-20T11:00:00', data: '2026-10-20' },
  ] : sessoes;
  S.forEach(x => w.CT.registrarSessao({ concursoId: cId, ...x }));
  // erros/horaInicio: lancarQuestoes usa spread (...dados vence o default), o
  // mesmo contrato do registrarSessao — seeds determinísticos (sem erros o
  // doughnut/legenda "Erradas" fica fora; sem horaInicio o lançamento mostra
  // a hora corrente, não-determinístico).
  const Q = questoes === null ? [
    { materiaId: mIds[0], topicoId: t1.id, resolvidas: 10, acertos: 7, erros: 3, data: hojeStr, horaInicio: hojeStr + 'T10:30:00' },
    { materiaId: mIds[0], topicoId: t1.id, resolvidas: 10, acertos: 2, erros: 8, data: '2026-10-20', horaInicio: '2026-10-20T11:30:00' },
    { materiaId: mIds[0], topicoId: t1.id, resolvidas: 5, acertos: 0, erros: 5, data: '2026-11-01', horaInicio: '2026-11-01T15:00:00' },
  ] : questoes;
  Q.forEach(x => w.CT.lancarQuestoes({ concursoId: cId, ...x }));
  // extraQ: lançamentos ADICIONAIS com os mIds DESTE boot (questoes: null
  // substitui Q inteiro — não usar para adicionar; ids de outro boot são
  // órfãos em outro concurso).
  if (extraQ) extraQ(w, cId, mIds, t1);
  if (ciclo) w.localStorage.setItem('ct_ciclo_' + cId, JSON.stringify({ entries: ciclo }));
  w.__CT_PAGE_SEARCH__ = '';
  w.__CT_PAGE_HASH__ = '';
  if (preRun) preRun(w, cId, mIds, t1, s1);
  vmRun(w, chartSrc, 'chart.umd');
  vmRun(w, h2cSrc, 'html2canvas');
  vmRun(w, histScript1Src, 'historico.html [sidebar]');
  vmRun(w, histMainSrc, 'historico.html [inline]');
  vmRun(w, timerSrc, 'timer-popup.js');
  return { dom: j, w, cId, mIds, t1, s1, navSpy, hojeStr, dataStr };
}

async function awaitBoot(t, extra) {
  const w = t.w;
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r, { once: true }));
  await tick(extra || 80);
}

(async () => {
  console.log('== R11-A: fonte/registro/seams estáticos ==');
  {
    const iHist = shellSrc.indexOf("'historico.html'");
    const block = iHist > -1 ? shellSrc.slice(iHist, iHist + 1400) : '';
    check('shell.js: historico.html registrado com cadeia [chart.umd, html2canvas, script1 sidebar, main, timer-popup] NA ORDEM do original', iHist > -1
      && block.indexOf('../vendor/chart.umd.pagejs') > -1
      && block.indexOf('../vendor/html2canvas.pagejs') > block.indexOf('../vendor/chart.umd.pagejs')
      && block.indexOf('../pages/historico/script1.pagejs') > block.indexOf('../vendor/html2canvas.pagejs')
      && block.indexOf('../pages/historico/main.pagejs') > block.indexOf('../pages/historico/script1.pagejs')
      && block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/historico/main.pagejs'));
    check('shell.js: timer-popup POR ÚLTIMO na cadeia (como o <script src> 1959 do original) + lazyModules []', block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/historico/main.pagejs') && /lazyModules:\s*\[\]/.test(block));
    check('shell.js: title "Métricas" + icon lucide bar-chart-3 (o ícone remix NAV_ICON_FILES historico é o asset do nav R1 — outra coisa)', block.includes("title: 'Métricas'") && block.includes("icon: 'bar-chart-3'"));
    check('shell.js: header [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]'));
    check('shell.js: dashboard.html/revisoes.html seguem registrados (sem edit acidental)', shellSrc.indexOf("'dashboard.html'") > -1 && shellSrc.indexOf("'revisoes.html'") > -1);
    check('main.js R9: navigateTo preserva hash (pendingPageHash) — regressão guardada', mainPluginSrc.includes('this.pendingPageHash = hash;'));
    check('shell.js: __CT_PAGE_SEARCH__/__CT_PAGE_HASH__ expostos (padrão R4/R9/R10)', shellSrc.includes('window.__CT_PAGE_SEARCH__') && shellSrc.includes('window.__CT_PAGE_HASH__'));

    check('body.html: 9 onclick goPage (8 location.href → goPage + flashcards 349 especial) + <a href="ajuda.html"> com goPage+return false', (histBodyHtml.match(/onclick="goPage\('/g) || []).length === 9
      && histBodyHtml.includes("goPage('dashboard.html#flashcards')")
      && histBodyHtml.includes('<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false"'));
    check('body.html: SEM location.href restante (fora do header de comentário)', !/location\.href/.test(bodyCore));
    check('body.html: logo 341 é o 1º goPage (concursos.html)', histBodyHtml.indexOf('brand-logo') < histBodyHtml.indexOf("onclick=\"goPage('concursos.html')\""));
    check('body.html: chips de janela 7/14/30/0 com "Desde o início" ACTIVE por padrão', ['setJanela(7,this)', 'setJanela(14,this)', 'setJanela(30,this)', 'setJanela(0,this)'].every(x => histBodyHtml.includes(x))
      && /class="filtro-chip active" onclick="setJanela\(0,this\)"[^>]*>Desde o início</.test(histBodyHtml));
    check('body.html: ids vivos todos presentes (statsGlobais/lblHoras/chartHoras/lblQuestoes/chartQuestoes/analiseMateriasResumo/pizzaShareCard/lblPizza/chartPizza/pizzaLegend/todayShareCard/todayShareBtn)', ['statsGlobais', 'lblHoras', 'chartHoras', 'lblQuestoes', 'chartQuestoes', 'analiseMateriasResumo', 'pizzaShareCard', 'lblPizza', 'chartPizza', 'pizzaLegend', 'todayShareCard', 'todayShareBtn'].every(id => histBodyHtml.includes('id="' + id + '"')));
    check('body.html: pizzaShareCard e todayShareCard são clicáveis (PRINT) e canvas dos doughnuts de hoje presentes', /id="pizzaShareCard"[^>]*role="button"/.test(histBodyHtml) && histBodyHtml.includes('id="todayShareCard"') && ['chartQuestoes', 'chartPizza', 'chartTodayHours', 'chartTodayQuestions'].every(id => histBodyHtml.includes('<canvas id="' + id + '"')));

    check('style.css: CSS morto D4-D8 verbatim (heatmap v1 .heatmap*/.l0-.l4, PROGRESSO .materias-list/.mat-prog-*, MELHORES DIAS .best-days/.best-day-*, gráficos antigos .chart-grid-*/.chart-card*, stats antigos .stats-row/.stat-card*/.stat-*/.filtro-sep)', ['.heatmap-col', '.heatmap-cell', '.heatmap-month', '.heatmap-legend', '.materias-list', '.mat-prog-', '.best-days', '.best-day-', '.chart-grid-2', '.chart-card', '.chart-header', '.chart-legend', '.legend-item', '.stats-row', '.stat-card', '.stat-icon', '.stat-val', '.stat-label', '.stat-delta', '.filtro-sep'].every(x => histStyleSrc.includes(x)));
    check('style.css: classes VIVAS do heatmap v2 + .shareable-chart-card + overlay PRINT z-index 120000', ['.heatmap-month-card', '.heatmap-day-btn', '.heatmap-day-out', '.heatmap-period-btn', '.shareable-chart-card'].every(x => histStyleSrc.includes(x)) && /120000/.test(histStyleSrc));

    check('main.pagejs: goPage local delega a __CT_NAV_GO_PAGE (precedente revisões/aba-materia) + SEM reloadPagina', histMainSrc.includes('function goPage(dest) {') && histMainSrc.includes('if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }') && !histMainSrc.includes('function reloadPagina'));
    check('main.pagejs: seam 522 — redirect sem cId SEM return (o location.href original não interrompe; boot segue até render())', norm(histMainSrc).includes("if (!cId) goPage('concursos.html');") && !/if \(!cId\) goPage\('concursos\.html'\); return/.test(norm(histMainSrc)));

    check('D1 — shareTodaySummary ÓRFÃ verbatim (nunca chamada): toast "@TrackConcursos" + extend 9500ms via hideTimeout + download track-concursos-estudos-de-hoje.png', mainBody.includes('async function shareTodaySummary()')
      && mainBody.includes('@TrackConcursos')
      && mainBody.includes('9500')
      && mainBody.includes("toastEl.hideTimeout")
      && mainBody.includes("'track-concursos-estudos-de-hoje.png'")
      && (mainBody.match(/shareTodaySummary/g) || []).length === 1);
    check('D2 — PIZZA_COLORS (20 cores) DEFINIDA e NUNCA usada (só a declaração; a viva é getPizzaColors)', mainBody.includes('const PIZZA_COLORS = [') && (mainBody.match(/PIZZA_COLORS/g) || []).length === 1);
    const d3From = mainBody.indexOf("const labels = datas.map");
    const d3Rest = mainBody.slice(d3From).replace("const labels = datas.map(d => { const p=d.split('-'); return p[2]+'/'+p[1]; });", '');
    check('D3 — labels dd/mm calculada e NUNCA usada no render(): a declaração existe e, do ponto dela ao fim do arquivo, todo "labels" restante é chave de config (labels:)', d3From > -1
      && d3Rest.match(/(?<![\w$])labels(?!\s*:)/g) === null);

    check('heatmap: 5 níveis por ratio com limiares 0.9/0.72/0.5/0.28 + texto #082016 em ratio>=0.72 + fallback literal heat1 #17382b / heat5 #3ecf8e', histMainSrc.includes('ratio >= 0.9') && histMainSrc.includes('ratio >= 0.72') && histMainSrc.includes('ratio >= 0.5') && histMainSrc.includes('ratio >= 0.28') && histMainSrc.includes('#082016') && histMainSrc.includes("heat1: '#17382b'") && histMainSrc.includes("heat5: '#3ecf8e'"));
    check('heatmap: semana começa SEGUNDA ((getDay()+6)%7) + weekLabels SEG..DOM + monthLabels JAN..DEZ', histMainSrc.includes('(monthStart.getDay() + 6) % 7') && histMainSrc.includes("['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']") && histMainSrc.includes("['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']"));
    check('heatmap: empty "Nenhum estudo registrado no período." (R14 normalizou período)', histMainSrc.includes('Nenhum estudo registrado no período.'));
    check('heatmap: célula fora do mês é div .heatmap-day-out não-clicável com stopPropagation + título Fora de MES/ANO', histMainSrc.includes('heatmap-day-out') && histMainSrc.includes('onclick="event.stopPropagation()"') && histMainSrc.includes('title="Fora de ${month.title}/${month.year}"'));
    check('heatmap: dia fora do range MAS no mês = heatOut e AINDA clicável (button openDayDetail)', histMainSrc.includes('const inRange = key >= datas[0] && key <= datas[datas.length - 1];') && histMainSrc.includes('heatmap-day-btn') && histMainSrc.includes("onclick=\"event.stopPropagation(); openDayDetail('${day.key}')\""));
    check('heatmap: controle Análise anual (select de anos com dados, sort DESC + botão Ver → openSelectedYearDetail)', histMainSrc.includes('Análise anual') && histMainSrc.includes('openSelectedYearDetail()') && histMainSrc.includes('Number(b) - Number(a)'));
    check('modal único: botão fechar é letra "x" MINÚSCULA (title Fechar) + SEM handler de Esc + closeDayDetail destrói os charts', histMainSrc.includes('title="Fechar">x</button>') && !/Escape/.test(histMainSrc) && histMainSrc.includes('if (_chartDayHours) { _chartDayHours.destroy(); _chartDayHours = null; }'));

    check('análise: bar chart top 6 por pct desc (tiebreak resolvidas) + labels truncados 22 + cores rgba 93/80/75/50 fill 0.82 + barThickness 16 + radius 8', histMainSrc.includes('.slice(0, 6)')
      && histMainSrc.includes("m.nome.slice(0, 22) + '...'")
      && ['rgba(52,245,141,0.82)', 'rgba(156,247,204,0.82)', 'rgba(255,228,92,0.82)', 'rgba(245,135,74,0.82)', 'rgba(245,90,90,0.82)'].every(c => histMainSrc.includes(c))
      && histMainSrc.includes('barThickness: 16') && histMainSrc.includes('borderRadius: 8'));
    check('análise: tooltip " % | A/R acertos" + eixo x 0–100 com ticks "%"', histMainSrc.includes("' ' + item.pct + '% | ' + item.acertos + '/' + item.resolvidas + ' acertos'") && histMainSrc.includes('min: 0') && histMainSrc.includes('max: 100') && histMainSrc.includes("return value + '%';"));
    check('análise: resumo "Maior facilidade" #9cf7cc / "Maior dificuldade" var(--orange) top/bottom 3 + empty "Resolva questões no período para aparecer aqui."', histMainSrc.includes("'Maior facilidade', '#9cf7cc'") && histMainSrc.includes("'Maior dificuldade', 'var(--orange)'") && histMainSrc.includes('.slice(0, 3)') && histMainSrc.includes('Resolva questões no período para aparecer aqui.'));
    check('análise: lblQuestoes DUPLA escrita na mesma render (N questões no período → sobrescrito por N matérias com questões no período / Sem questões suficientes)', (histMainSrc.match(/lblQuestoes'\)\.textContent/g) || []).length === 2 && histMainSrc.includes("' matérias com questões no período'") && histMainSrc.includes('Sem questões suficientes no período'));

    check('pizza: cutout 55% + maintainAspectRatio TRUE (ÚNICO chart da página assim: 1 true × 3 false) + dados em HORAS float toFixed(2) + hoverOffset 8', norm(histMainSrc).includes("cutout: '55%'") && (histMainSrc.match(/maintainAspectRatio: true/g) || []).length === 1 && (histMainSrc.match(/maintainAspectRatio: false/g) || []).length === 3 && histMainSrc.includes('(m.seg/3600).toFixed(2)') && histMainSrc.includes('hoverOffset: 8'));
    check('pizza: tooltip formatStudyTime(seg) + pct + legenda custom nome/tempo/pct com paleta CICLANDO (i % paletteColors.length)', histMainSrc.includes("formatStudyTime(ranking[ctx.dataIndex].seg)") && histMainSrc.includes("CT.formatarTempo(m.seg)||'0min'") && (histMainSrc.match(/paletteColors\[i % paletteColors\.length\]/g) || []).length >= 3);
    check('estudos do dia: sessões de hoje sort horaInicio DESC + hora HH:MM pt-BR + "Sessão livre" sem matéria', histMainSrc.includes(".sort((a,b) => String(b.horaInicio || '').localeCompare(String(a.horaInicio || '')))") && histMainSrc.includes("toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })") && histMainSrc.includes("'Sessão livre'"));
    check('estudos do dia: cor herdada do ranking global por NOME da matéria (homônimas colidem — vivo)', histMainSrc.includes('colorByMateria.set(m.nome, paletteColors[i % paletteColors.length])'));
    check('makeDoughnutChart: destrói o chart ANTERIOR (recebe currentChart) + clearRect quando vazio', histMainSrc.includes('if (currentChart) currentChart.destroy();') && histMainSrc.includes('ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);'));

    check('cards PRINT: html2canvas {backgroundColor:null, scale:2, useCORS:true, logging:false} ×3 + cutout 58% ×2 + borda #0d0f14 3px', (histMainSrc.match(/backgroundColor: null,/g) || []).length === 3 && (histMainSrc.match(/scale: 2,/g) || []).length === 3 && (histMainSrc.match(/useCORS: true,/g) || []).length === 3 && (histMainSrc.match(/logging: false/g) || []).length === 3 && (histMainSrc.match(/cutout: '58%'/g) || []).length === 2 && (histMainSrc.match(/borderColor: '#0d0f14',/g) || []).length === 2 && (histMainSrc.match(/borderWidth: 3,/g) || []).length === 2);
    check('cards PRINT: kickers "Gráficos de Estudo"/"Estudos do Dia" + gráfico da distribuição com 30ms de delay + downloads com nomes exatos', histMainSrc.includes('Gráficos de Estudo') && histMainSrc.includes('Estudos do Dia') && histMainSrc.includes('setTimeout(function() { renderizarGraficoPopupDistribuicao(state); }, 30)') && histMainSrc.includes("'track-concursos-distribuicao-por-materia.png'") && histMainSrc.includes("'track-concursos-estudos-do-dia.png'"));
    check('cards PRINT: estados de fallback `if (!_pizzaShareState) render();` / `if (!_todayShareState) render();`', histMainSrc.includes('if (!_pizzaShareState) render();') && histMainSrc.includes('if (!_todayShareState) render();'));
    check('faixa: getFaixaAtualMetricas → CT._cardExportFaixa(concursoId, stats) + fallback literal Faixa Branca/faixabranca.png/#e8eaf2 + faixa-preta-icon SÓ para "Faixa Preta"', histMainSrc.includes('CT._cardExportFaixa(concursoId, stats)') && histMainSrc.includes("nome: 'Faixa Branca'") && histMainSrc.includes('faixabranca.png') && histMainSrc.includes("'#e8eaf2'") && histMainSrc.includes("faixa && faixa.nome === 'Faixa Preta'"));
    check('popup distribuição: stats 2×2 — "Edital coberto" xN = coberto+cobertoPre; "sem acertos registrados" (sem acento); agregado "Outras matérias" #94a3b8 quando >8', histMainSrc.includes('(c.coberto || 0) + (c.cobertoPre || 0)') && histMainSrc.includes('sem acertos registrados') && histMainSrc.includes("'Outras matérias'") && histMainSrc.includes("'#94a3b8'") && histMainSrc.includes('const maxRows = 8'));
    check('meta do ciclo: lê ct_ciclo_<cid>.entries + weekFactor = diasDoPeríodo/7 + mensagens exatas + empty', histMainSrc.includes("localStorage.getItem('ct_ciclo_' + (cId || ''))") && histMainSrc.includes('const weekFactor = periodDays / 7;') && histMainSrc.includes('Meta batida. Excelente consistência') && histMainSrc.includes('Você estudou, e isso conta') && histMainSrc.includes('Nenhuma matéria do ciclo apareceu neste período.') && histMainSrc.includes('Meta do ciclo x tempo estudado'));

    check('quirk diasComAtividade: calculada e NUNCA exibida (só declaração + return de buildDayActivity; os 5 stats usam diasComEstudo)', (mainBody.match(/diasComAtividade/g) || []).length === 2 && mainBody.includes('const diasComEstudo = new Set(sessoes.filter(temEstudoRegistrado).map(s => s.data)).size;'));
    check('script1.pagejs: IIFE sidebar VERBATIM (467-518) — SEM seams, sem TrackTheme desprotegido, revBadge por concurso', (() => {
      const body = histScript1Src.slice(histScript1Src.indexOf('*/') + 2);
      return body.includes('SIDEBAR CONCURSO') && body.includes("getElementById('sideNome')") && body.includes('revBadge') && !body.includes('goPage') && !/TrackTheme/.test(body);
    })());
    check('vendored: html2canvas 1.4.1 (header exato) requerido no shell — pendência herdada do R9 fechada', h2cSrc.includes('html2canvas 1.4.1') && shellSrc.includes("require('../vendor/html2canvas.pagejs')") && shellSrc.includes("require('../vendor/chart.umd.pagejs')"));
    check('package.json/runner: test:r11 registrado', JSON.parse(read('package.json')).scripts['test:r11'] === 'node tests/r11-historico.test.js');
  }

  console.log('== R11-B: boot/guards ==');
  {
    const t = bootHist({ noCid: true });
    await awaitBoot(t, 120);
    check('guard 522: sem ct_concurso_ativo → goPage concursos.html (navSpy)', t.navSpy.includes('nav:concursos.html'), JSON.stringify(t.navSpy));
    check('redirect SEM return: execução segue até render() — que sai cedo (concurso não resolve): histSub mantém "Carregando..." e statsGlobais vazio', t.w.document.getElementById('histSub').textContent === 'Carregando...' && t.w.document.getElementById('statsGlobais').innerHTML === '');
    check('IIFE sidebar sem cId → early return (sideNome mantém o "—" do body)', t.w.document.getElementById('sideNome').textContent === '—');
  }
  {
    const t = bootHist({});
    await awaitBoot(t, 120);
    check('boot com cId: histSub "Defensoria 2027 — todos os dias" (janela 0 = Desde o início)', t.w.document.getElementById('histSub').textContent === 'Defensoria 2027 — todos os dias', t.w.document.getElementById('histSub').textContent);
    check('duplicação: render() reescreve .concurso-nome/.concurso-banca que a IIFE já escreveu (mesmos valores, 2 escritas)', t.w.document.querySelector('.concurso-nome').textContent === 'Defensoria 2027' && t.w.document.querySelector('.concurso-banca').textContent === 'FGV');
    check('stats globais 4 cards: Horas totais 7h / Questões no total 25 / Taxa de acertos 36% / Tópicos concluídos 0/1 (1 tópico criado, 0 estudados)', (() => {
      const html = t.w.document.getElementById('statsGlobais').innerHTML;
      return html.includes('>7h<') && html.includes('>25<') && html.includes('>36%<') && html.includes('>0/1<')
        && html.includes('Horas totais') && html.includes('Questões no total') && html.includes('Taxa de acertos') && html.includes('Tópicos concluídos');
    })(), t.w.document.getElementById('statsGlobais').innerHTML.slice(0, 700));
  }

  console.log('== R11-C: render/heatmap/análise/pizza/estudos do dia ==');
  {
    const t = bootHist({});
    await awaitBoot(t, 120);
    const w = t.w;
    const d = w.document;
    const sDTitle = t.dataStr(-3).split('-').reverse().join('/'); // DD/MM/2026 do seed relativo
    const hm = d.getElementById('chartHoras').innerHTML;
    check('heatmap: 2 cards por mês (OUT e NOV de 2026) com título + ano', hm.includes('>OUT</div>') && hm.includes('>NOV</div>') && hm.includes('>2026</div>'), hm.slice(0, 300));
    check('heatmap: weekLabels SEG..DOM no card (7 labels)', ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].every(x => hm.includes('>' + x + '</div>')));
    check('heatmap: dia máximo sD (-3 dias, 4h, ratio 1) = heat5 #3ecf8e + texto "4h" + cor de texto #082016 (ratio>=0.72)', (() => {
      const btn = [...d.querySelectorAll('.heatmap-day-btn')].find(b => b.title.startsWith(sDTitle));
      const st = btn && btn.getAttribute('style');
      return !!btn && st.includes('background:#3ecf8e') && btn.innerHTML.includes('4h') && st.includes('color:#082016');
    })());
    check('heatmap: hoje (2h, ratio 0.5) = heat3 #268b61 (limiar >=0.5)', (() => {
      const btn = [...d.querySelectorAll('.heatmap-day-btn')].find(b => b.title.startsWith(t.hojeStr.split('-').reverse().join('/')));
      return !!btn && btn.getAttribute('style').includes('background:#268b61');
    })(), [...d.querySelectorAll('.heatmap-day-btn')].map(b => b.title).join(' | '));
    check('heatmap: 20/10 (1h, ratio 0.25 <0.28) = heat1 #17382b', (() => {
      const btn = [...d.querySelectorAll('.heatmap-day-btn')].find(b => b.title.startsWith('20/10/2026'));
      return !!btn && btn.getAttribute('style').includes('background:#17382b');
    })());
    check('heatmap: rodapé "3 dias com estudo" • "Maior carga: 4h"', hm.includes('3 dias com estudo') && hm.includes('Maior carga: 4h'));
    check('heatmap: legenda Menos/empty/heat1/heat2/heat3/heat5/Mais — HEAT4 NÃO APARECE (#2fbd7b ausente; #3ecf8e presente)', (() => {
      const leg = hm.slice(hm.indexOf('Menos'));
      return leg.includes('Menos') && leg.includes('Mais') && leg.includes('#17382b') && leg.includes('#1f5f46') && leg.includes('#268b61') && leg.includes('#3ecf8e') && !leg.includes('#2fbd7b');
    })(), hm.slice(hm.indexOf('Menos'), hm.indexOf('Menos') + 400));
    check('heatmap: controle Análise anual no rodapé (label + select + Ver) com os anos com dados (2026)', hm.includes('Análise anual') && /<option value="2026">2026<\/option>/.test(hm) && hm.includes('openSelectedYearDetail()'));
    check('heatmap: célula fora do mês = div .heatmap-day-out com title "Fora de OUT/2026" (não é button)', (() => {
      const outs = [...d.querySelectorAll('.heatmap-day-out')];
      return outs.length > 0 && outs[0].title.includes('Fora de OUT/2026') && outs[0].getAttribute('onclick').includes('stopPropagation');
    })(), d.querySelectorAll('.heatmap-day-out').length);

    check('análise: lblQuestoes final "1 matérias com questões no período" (2ª escrita vence a 1ª; SEM singularização — verbatim)', d.getElementById('lblQuestoes').textContent === '1 matérias com questões no período', d.getElementById('lblQuestoes').textContent);
    check('análise: bar chart top6 pct DESC — só m1 tem questões (m2 0 resolvidas é filtrada): labels [DIREITO CONSTITUCIONAL]', (() => {
      const ch = lex(w, '_chartQuestoes && _chartQuestoes.data.labels.join("|")');
      return ch === 'DIREITO CONSTITUCIONAL';
    })(), String(lex(w, '_chartQuestoes && _chartQuestoes.data.labels.join("|")')));
    check('análise: pct do bar chart [36] — desempenhoMaterias = questões DA MATÉRIA no período (q1+q2+q3 = 25 resolvidas, 9 acertos = 36%)', (() => {
      const data = lex(w, '_chartQuestoes && _chartQuestoes.data.datasets[0].data.join(",")');
      return data === '36';
    })(), String(lex(w, '_chartQuestoes && _chartQuestoes.data.datasets[0].data.join(",")')));
    check('análise resumo: "Maior facilidade" cita DIREITO CONSTITUCIONAL 9/17 53%? — NÃO: desempenho por matéria usa stats DO PERÍODO (m1 = q1+q2+q3 = 25 resolvidas 9 acertos = 36%)', (() => {
      const html = d.getElementById('analiseMateriasResumo').innerHTML;
      return html.includes('Maior facilidade') && html.includes('DIREITO CONSTITUCIONAL') && /9\/25 acertos/.test(html) && html.includes('36%') && html.includes('Maior dificuldade');
    })(), d.getElementById('analiseMateriasResumo').innerHTML.slice(0, 500));
    check('pizza GLOBAL: _chartPizza cutout 55% + maintainAspectRatio true + data em horas [4.5, 2] (m1 4h30 + m2 2h — a sessão SEM matéria de hoje fica FORA: ranking só itera matérias; global 7h vem de totalSegundos)', (() => {
      const ch = lex(w, '_chartPizza');
      return ch && ch.options.cutout === '55%' && ch.options.maintainAspectRatio === true && ch.data.datasets[0].data.join(',') === '4.5,2';
    })(), String(lex(w, '_chartPizza && JSON.stringify(_chartPizza.data.datasets[0].data)')));
    check('pizza: lblPizza "6h30m no total" (formatarTempo da SOMA do ranking, não do global)', d.getElementById('lblPizza').textContent === '6h30m no total', d.getElementById('lblPizza').textContent);
    check('pizza: legenda custom m1 69% (4h30m/6h30m) antes de m2 31%, com tempo formatado CT.formatarTempo', (() => {
      const leg = d.getElementById('pizzaLegend').innerHTML;
      const i1 = leg.indexOf('DIREITO CONSTITUCIONAL');
      const i2 = leg.indexOf('ATUALIDADES');
      return i1 > -1 && i2 > i1 && leg.includes('>69%<') && leg.includes('>31%<') && leg.includes('4h30m') && leg.includes('2h');
    })(), d.getElementById('pizzaLegend').innerHTML.slice(0, 500));
    check('estudos do dia: "Hoje (dd/mm/yyyy)" no sub + horas 2h + 10 questões', d.getElementById('todaySummarySub').textContent === 'Hoje (' + t.hojeStr.split('-').reverse().join('/') + ')' && d.getElementById('todayHoursSub').textContent === '2h estudados hoje' && d.getElementById('todayQuestionsSub').textContent === '10 questões feitas hoje', [d.getElementById('todaySummarySub').textContent, d.getElementById('todayHoursSub').textContent, d.getElementById('todayQuestionsSub').textContent].join(' | '));
    check('estudos do dia: sessões sort horaInicio DESC (14:00 m2 primeiro, 08:00 "Sessão livre" por último) + meta tipoEstudo "Vídeo"', (() => {
      const html = d.getElementById('todaySessionsList').innerHTML;
      const i14 = html.indexOf('14:00');
      const i10 = html.indexOf('10:00');
      const i08 = html.indexOf('08:00');
      return i14 > -1 && i14 < i10 && i10 < i08 && html.includes('ATUALIDADES') && html.includes('Sessão livre') && html.includes('Vídeo') && html.includes('1h');
    })(), d.getElementById('todaySessionsList').innerHTML.slice(0, 600));
    check('estudos do dia: legendas — horas de hoje m1 30min 25% / m2 1h 50% (pct sobre totalSegHoje 2h; sessão sem matéria fora dos items mas dentro do total); questões Certas 7 (70%) / Erradas 3 (30%)', (() => {
      const h = d.getElementById('todayHoursLegend').innerHTML;
      const q = d.getElementById('todayQuestionsLegend').innerHTML;
      return h.includes('DIREITO CONSTITUCIONAL') && h.includes('30min') && h.includes('>25%<') && h.includes('ATUALIDADES') && h.includes('>1h<') && h.includes('>50%<')
        && q.includes('Certas') && q.includes('Erradas') && q.includes('>70%<') && q.includes('>30%<');
    })(), [d.getElementById('todayHoursLegend').innerHTML.slice(0, 300), d.getElementById('todayQuestionsLegend').innerHTML.slice(0, 300)].join(' || '));
    check('estudos do dia: doughnuts de hoje criados (cutout 55%, maintainAspectRatio FALSE; horas [0.5,1] só matérias; questões [7,3] Certas/Erradas)', (() => {
      const a = lex(w, '_chartTodayHours');
      const b = lex(w, '_chartTodayQuestions');
      return a && b && a.options.cutout === '55%' && a.options.maintainAspectRatio === false && a.data.datasets[0].data.join(',') === '0.5,1' && b.data.datasets[0].data.join(',') === '7,3';
    })(), String(lex(w, "(_chartTodayHours && _chartTodayQuestions) ? _chartTodayHours.data.datasets[0].data.join(',')+'|'+_chartTodayQuestions.data.datasets[0].data.join(',') : 'null'")));
    check('charts destruídos antes de recriar: re-render (setJanela mesmo valor) não acumula Chart registry', (() => {
      const before = lex(w, 'Object.keys(Chart.instances || {}).length');
      w.render();
      const after = lex(w, 'Object.keys(Chart.instances || {}).length');
      return before === after;
    })(), String(lex(w, 'Object.keys(Chart.instances || {}).length')));
  }

  console.log('== R11-D: modal openDayDetail (dia/mês/ano) + meta do ciclo ==');
  {
    const t = bootHist({ ciclo: [
      { materiaId: null, id: 'e0', targetSeconds: 0 },
      { materiaId: null, id: 'e1', targetSeconds: 3600 },
      { materiaId: null, id: 'e2', targetSeconds: 25200 },
    ] });
    // entries SEM materiaId somam ao weeklyTarget global (o sort por |saldo|
    // usa rows por matéria — entries sem matéria entram no total e não nas rows)
    await awaitBoot(t, 120);
    const w = t.w;
    const d = w.document;
    const sDISO = t.dataStr(-3); // seed relativo de sD (ver comentário no bootHist)
    const sDBR = sDISO.split('-').reverse().join('/');
    w.openDayDetail(sDISO);
    let ov = d.getElementById('dayDetailOverlay');
    check('openDayDetail(dia): overlay com título "Atividades de ' + sDBR + '" + "1 registros encontrados neste dia"', ov && ov.innerHTML.includes('Atividades de ' + sDBR) && ov.innerHTML.includes('1 registros encontrados neste dia'), ov && ov.innerHTML.slice(0, 300));
    check('dia sD (-3): 5 stats (Horas estudadas 4h / Questões feitas 0 / Taxa de acerto - / Matérias movimentadas 1 / Dias com estudo 1)', (() => {
      const vals = [...ov.querySelectorAll('.day-detail-stat-value')].map(e => e.textContent);
      return vals[0] === '4h' && vals[1] === '0' && vals[2] === '-' && vals[3] === '1' && vals[4] === '1' && ov.innerHTML.includes('Horas estudadas') && ov.innerHTML.includes('Dias com estudo');
    })(), [...ov.querySelectorAll('.day-detail-stat-value')].map(e => e.textContent).join(' | '));
    check('dia sD (-3): resumo por matéria — meta "1 sessões de estudo | 0 acertos | 0 questões | sem questões" + 2 barras (Tempo estudado 100%; SEM barra de questões quando 0)', (() => {
      const row = ov.querySelector('.day-detail-materia-row');
      const meta = row.querySelector('.day-detail-materia-meta').textContent;
      const barras = row.querySelectorAll('.day-detail-bar').length;
      return meta === '1 sessões de estudo | 0 acertos | 0 questões | sem questões' && barras === 1 && row.innerHTML.includes('Tempo estudado') && !row.innerHTML.includes('Questões feitas</span>');
    })(), ov.querySelector('.day-detail-materia-row') && ov.querySelector('.day-detail-materia-row').innerHTML.slice(0, 400));
    check('dia sD (-3): sessões — hora 09:00, matéria DIREITO CONSTITUCIONAL, duração 4h', (() => {
      const row = ov.querySelector('.today-session-item');
      return row.innerHTML.includes('09:00') && row.innerHTML.includes('DIREITO CONSTITUCIONAL') && row.innerHTML.includes('4h');
    })(), ov.querySelector('.today-session-item') && ov.querySelector('.today-session-item').innerHTML.slice(0, 300));
    w.closeDayDetail();
    check('closeDayDetail: overlay removido + charts do modal destruídos (_chartDayHours null)', !d.getElementById('dayDetailOverlay') && lex(w, '_chartDayHours') === null && lex(w, '_chartDayQuestions') === null);

    w.openDayDetail('2026-10-20');
    ov = d.getElementById('dayDetailOverlay');
    check('dia 20/10: 2 registros (sessão m2 11:00 + lançamento m1 11:30 com tópico) — lançamentos com question-result 2 acertos/10 questões/20% acerto', (() => {
      const q = [...ov.querySelectorAll('.today-session-item')].find(r => r.innerHTML.includes('acertos'));
      return ov.innerHTML.includes('2 registros encontrados neste dia') && !!q && q.innerHTML.includes('11:30') && q.innerHTML.includes('DIREITO CONSTITUCIONAL') && q.innerHTML.includes('Controle de constitucionalidade') && q.innerHTML.includes('2<small>acertos</small>') && q.innerHTML.includes('10<small>questões</small>') && q.innerHTML.includes('20%<small>acerto</small>');
    })(), ov.innerHTML.slice(ov.innerHTML.indexOf('Lançamentos'), ov.innerHTML.indexOf('Lançamentos') + 700));
    check('dia 20/10: painel "Questões do dia" "2 acertos e 8 erros" + legenda Certas 2 | 20% e Erradas 8 | 80% (erros do campo erros do lançamento)', (() => {
      const sub = [...ov.querySelectorAll('.day-detail-panel-sub')].map(e => e.textContent).join(' | ');
      const leg = ov.innerHTML.slice(ov.innerHTML.indexOf('Certas'), ov.innerHTML.indexOf('Certas') + 600);
      return sub.includes('2 acertos e 8 erros') && leg.includes('Erradas') && leg.includes('8 | 80%') && leg.includes('2 | 20%');
    })(), ov.innerHTML.slice(ov.innerHTML.indexOf('Questões do dia'), ov.innerHTML.indexOf('Questões do dia') + 700));
    check('dia 20/10: questões da matéria m1 (sem sessão) entram no resumo (meta "0 sessões de estudo | 2 acertos | 10 questões | 20% de acerto" + 2 barras: Tempo estudado 0min cor da matéria + Questões feitas 10 #FFD700)', (() => {
      const rows = [...ov.querySelectorAll('.day-detail-materia-row')];
      const m1 = rows.find(r => r.innerHTML.includes('DIREITO CONSTITUCIONAL'));
      return !!m1 && m1.textContent.includes('0 sessões de estudo | 2 acertos | 10 questões | 20% de acerto') && m1.querySelectorAll('.day-detail-bar').length === 2 && m1.innerHTML.includes('Tempo estudado') && m1.innerHTML.includes('Questões feitas') && m1.innerHTML.includes('#FFD700');
    })(), ov.innerHTML.slice(ov.innerHTML.indexOf('Resumo por matéria'), ov.innerHTML.indexOf('Resumo por matéria') + 900));
    w.closeDayDetail();

    w.openDayDetail('2026-11-01');
    ov = d.getElementById('dayDetailOverlay');
    check('QUIRK diasComEstudo × diasComAtividade: dia SÓ de questões → stat "Dias com estudo" 0 (os 5 stats usam diasComEstudo) mas buildDayActivity calcula diasComAtividade = 1 (nunca exibido)', (() => {
      const vals = [...ov.querySelectorAll('.day-detail-stat-value')].map(e => e.textContent);
      return vals[4] === '0' && lex(w, 'buildDayActivity("2026-11-01","2026-11-01").diasComAtividade') === 1;
    })(), [...ov.querySelectorAll('.day-detail-stat-value')].map(e => e.textContent).join(' | '));
    check('dia só de questões (q3 COM tópico): detalhe do item é o nome do tópico; o painel se chama "Lançamentos de questões" (plural) e o sub traz "0 acertos e 5 erros"', ov.innerHTML.includes('Lançamentos de questões') && ov.innerHTML.includes('0 acertos e 5 erros') && ov.innerHTML.includes('Controle de constitucionalidade'), ov.innerHTML.slice(ov.innerHTML.indexOf('Lançamentos'), ov.innerHTML.indexOf('Lançamentos') + 400));
    w.closeDayDetail();

    // Fallback do lançamento SEM tópico (questão nova em boot próprio, 02/11):
    // detalhe = 'Lançamento de questões' (verbatim, orig 874)
    const tF = bootHist({ extraQ: (w2, cId2, mIds2) => w2.CT.lancarQuestoes({ concursoId: cId2, materiaId: mIds2[1], resolvidas: 4, acertos: 1, erros: 3, data: '2026-11-02', horaInicio: '2026-11-02T16:00:00' }) });
    await awaitBoot(tF, 120);
    tF.w.openDayDetail('2026-11-02');
    const ovF = tF.w.document.getElementById('dayDetailOverlay');
    check('QUIRK fallback: lançamento SEM tópico → meta do item é "Lançamento de questões" (singular) + resumo "0 sessões de estudo | 1 acertos | 4 questões | 25% de acerto"', (() => {
      const item = [...ovF.querySelectorAll('.today-session-item')].find(r => r.innerHTML.includes('acertos'));
      const row = ovF.querySelector('.day-detail-materia-row');
      return !!item && item.innerHTML.includes('Lançamento de questões') && item.innerHTML.includes('ATUALIDADES') && item.innerHTML.includes('16:00')
        && !!row && row.textContent.includes('0 sessões de estudo | 1 acertos | 4 questões | 25% de acerto');
    })(), ovF.innerHTML.slice(ovF.innerHTML.indexOf('Lançamentos'), ovF.innerHTML.indexOf('Lançamentos') + 600));
    tF.w.closeDayDetail();

    // Mês: outubro 2026 = 31 dias; weeklyTarget 28800 (1h+7h) → expected
    // round(28800*31/7) = 127543; estudado no mês = 1h → saldo -123943
    w.openMonthDetail(2026, 9);
    ov = d.getElementById('dayDetailOverlay');
    check('openMonthDetail(2026, 9): título "Estatísticas de outubro de 2026" + scopeText "neste mês" + questionsTitle "Questões do mês"', ov.innerHTML.includes('Estatísticas de outubro de 2026') && ov.innerHTML.includes('neste mês') && ov.innerHTML.includes('Questões do mês'), ov.innerHTML.slice(0, 300));
    check('meta do ciclo NOV/out: painel "Meta do ciclo x tempo estudado" presente + badge amarelo (saldo negativo) + pct esperado', (() => {
      const panel = ov.querySelector('.cycle-goal-panel');
      const badge = panel && panel.querySelector('.cycle-goal-badge');
      return !!panel && panel.innerHTML.includes('Meta do ciclo x tempo estudado') && !!badge && badge.textContent.includes('% da meta') && badge.getAttribute('style').includes('var(--yellow)') && panel.innerHTML.includes('Você estudou, e isso conta');
    })(), ov.querySelector('.cycle-goal-panel') && ov.querySelector('.cycle-goal-panel').innerHTML.slice(0, 500));
    check('meta do ciclo: 3 stats (.cycle-goal-value) — Estudado 1h / Previsto pelo ciclo 35h25m (formatStudyTime de 127543) / Saldo -34h25m (formatSignedStudyTime) + tabela Matéria|Estudado|Meta|Saldo', (() => {
      const panel = ov.querySelector('.cycle-goal-panel');
      const stats = [...panel.querySelectorAll('.cycle-goal-value')].map(e => e.textContent);
      return stats.length === 3 && stats[0] === '1h' && stats[1] === '35h25m' && stats[2] === '-34h25m' && panel.innerHTML.includes('Matéria') && panel.innerHTML.includes('Previsto pelo ciclo') && panel.innerHTML.includes('Saldo');
    })(), ov.querySelector('.cycle-goal-panel') && [...ov.querySelector('.cycle-goal-panel').querySelectorAll('.cycle-goal-value')].map(e => e.textContent).join(' | '));
    check('meta do ciclo OUT: rows só com matéria ESTUDADA no mês (entries sem materiaId não criam meta por matéria) — ATUALIDADES 1h / Meta 0min / Saldo +1h verde (m1 aparece no overlay pelos LANÇAMENTOS de out, mas não nas rows do ciclo)', (() => {
      const rows = [...ov.querySelectorAll('.cycle-goal-matters .cycle-goal-row')];
      return rows.length === 1 && rows[0].innerHTML.includes('ATUALIDADES') && rows[0].innerHTML.includes('+1h') && rows[0].innerHTML.includes('0min');
    })(), [...ov.querySelectorAll('.cycle-goal-matters .cycle-goal-row')].map(r => r.textContent).join(' | '));
    check('meta do ciclo: lex readCycleGoalComparison — weeklyTarget 28800, periodDays 31, weekFactor 31/7, expectedTotal 127543, balance -123943', (() => {
      const c = lex(w, 'readCycleGoalComparison(buildDayActivity("2026-10-01","2026-10-31"))');
      return c && c.weeklyTarget === 28800 && c.periodDays === 31 && Math.abs(c.weekFactor - 31 / 7) < 1e-9 && c.expectedTotal === 127543 && c.balance === 3600 - 127543;
    })(), JSON.stringify(lex(w, 'readCycleGoalComparison(buildDayActivity("2026-10-01","2026-10-31"))')));
    w.closeDayDetail();

    // Novembro (30 dias): expected round(28800*30/7)=123429; estudado 21600 →
    // ainda negativo; para META BATIDA: outro boot com target menor
    w.openYearDetail(2026);
    ov = d.getElementById('dayDetailOverlay');
    check('openYearDetail(2026): "Retrospectiva de estudos de 2026" + "neste ano" + showCycleGoal (panel presente)', ov.innerHTML.includes('Retrospectiva de estudos de 2026') && ov.innerHTML.includes('neste ano') && !!ov.querySelector('.cycle-goal-panel'));
    w.closeDayDetail();
  }
  {
    // Meta batida: target 3600/wk só para m1; novembro 30 dias → expected
    // round(3600*30/7)=15429; estudado nov = 1800+14400 = 16200 → saldo +771
    const t = bootHist({ ciclo: [{ materiaId: null, id: 'e1', targetSeconds: 3600 }] });
    await awaitBoot(t, 120);
    t.w.openMonthDetail(2026, 10);
    const ov = t.w.document.getElementById('dayDetailOverlay');
    const panel = ov.querySelector('.cycle-goal-panel');
    check('META BATIDA: badge VERDE (saldo >=0) + mensagem "Meta batida. Excelente consistência..." + pct ~105%', !!panel && panel.innerHTML.includes('Meta batida. Excelente consistência') && panel.querySelector('.cycle-goal-badge').getAttribute('style').includes('var(--green)'), panel && panel.innerHTML.slice(0, 500));
    check('META BATIDA: lex — expectedTotal 15429, balance 6171 (studiedTotal 21600 INCLUI a sessão sem matéria de hoje; buildDayActivity usa totalSegundos, ao contrário do ranking da pizza), rows 2 por matéria', (() => {
      const c = lex(t.w, 'readCycleGoalComparison(buildDayActivity("2026-11-01","2026-11-30"))');
      return c && c.expectedTotal === 15429 && c.balance === 6171 && c.studiedTotal === 21600 && c.rows.length === 2 && c.rows[0].balance === 16200 && c.rows[1].balance === 3600;
    })(), JSON.stringify(lex(t.w, 'readCycleGoalComparison(buildDayActivity("2026-11-01","2026-11-30"))')));
    check('ciclo SEM overlap: empty "Nenhuma matéria do ciclo apareceu neste período." (mês sem estudado e sem target resolvível → rows vazias)', (() => {
      t.w.closeDayDetail();
      t.w.openMonthDetail(2025, 0); // janeiro 2025: sem atividade
      const p = t.w.document.querySelector('.cycle-goal-panel');
      return p && p.innerHTML.includes('Nenhuma matéria do ciclo apareceu neste período.');
    })(), t.w.document.querySelector('.cycle-goal-panel') && t.w.document.querySelector('.cycle-goal-panel').innerHTML.slice(0, 300));
  }

  console.log('== R11-E: popups PRINT (distribuição + estudos do dia) ==');
  {
    const t = bootHist({});
    await awaitBoot(t, 120);
    const w = t.w;
    const d = w.document;
    w.abrirPopupDistribuicaoMateria();
    let ov = d.getElementById('materiaShareOverlay');
    check('popup distribuição: overlay .materia-share-overlay + card "Gráficos de Estudo" + título/sub do concurso', ov && ov.innerHTML.includes('Gráficos de Estudo') && ov.innerHTML.includes('Defensoria 2027') && ov.innerHTML.includes('FGV | Defensor'), ov && ov.innerHTML.slice(0, 400));
    check('popup distribuição: stats 2×2 — Horas estudadas 6h30m (SOMA do ranking, sem a sessão sem matéria) / Edital coberto x0 / faixa (img faixas/) / Questões 25 com label "36% acertos"', (() => {
      const stats = [...ov.querySelectorAll('.materia-share-stat-value')].map(e => e.textContent);
      const belt = ov.querySelector('.materia-share-belt img');
      return stats[0] === '6h30m' && stats[1] === 'x0' && stats[2] === 'Faixa Branca' && stats[3] === '25' && ov.innerHTML.includes('36% acertos') && !!belt && belt.getAttribute('src').includes('faixas/');
    })(), [...ov.querySelectorAll('.materia-share-stat-value')].map(e => e.textContent).join(' | '));
    check('popup distribuição: lista top 8 — m1 "25 questões | 36% de acertos" 4h30m 69% / m2 0 questões → "sem acertos registrados" (sem acento) 2h 31%', (() => {
      const rows = [...ov.querySelectorAll('.materia-share-row')];
      const r1 = rows.find(r => r.innerHTML.includes('DIREITO CONSTITUCIONAL'));
      const r2 = rows.find(r => r.innerHTML.includes('ATUALIDADES'));
      return !!r1 && r1.innerHTML.includes('25 questões | 36% de acertos') && r1.innerHTML.includes('4h30m') && r1.innerHTML.includes('>69%<')
        && !!r2 && r2.innerHTML.includes('0 questões | sem acertos registrados') && r2.innerHTML.includes('2h') && r2.innerHTML.includes('>31%<');
    })(), ov.querySelector('.materia-share-list') && ov.querySelector('.materia-share-list').innerHTML.slice(0, 800));
    await tick(40);
    check('popup distribuição: doughnut 58% com borda #0d0f14 3px (após delay 30ms) + Fechar/Copiar imagem', (() => {
      const ch = lex(w, '_chartPizzaShare');
      return ch && ch.options.cutout === '58%' && ch.data.datasets[0].borderColor === '#0d0f14' && ch.data.datasets[0].borderWidth === 3 && ov.innerHTML.includes('Copiar imagem') && ov.innerHTML.includes('Fechar');
    })(), String(lex(w, '_chartPizzaShare && _chartPizzaShare.options.cutout')));
    w.fecharPopupDistribuicaoMateria();
    check('fecharPopupDistribuicaoMateria: overlay removido + _chartPizzaShare null', !d.getElementById('materiaShareOverlay') && lex(w, '_chartPizzaShare') === null);

    w.abrirPopupEstudosDia();
    ov = d.getElementById('todayVerticalOverlay');
    check('popup estudos do dia: overlay #todayVerticalOverlay .materia-share-overlay + kicker "Estudos do Dia" + sub "Hoje | dd/mm/yyyy | FGV | Defensor"', ov && ov.innerHTML.includes('Estudos do Dia') && ov.innerHTML.includes('Hoje | ' + t.hojeStr.split('-').reverse().join('/')) && ov.innerHTML.includes('FGV | Defensor'), ov && ov.innerHTML.slice(0, 400));
    check('popup estudos do dia: faixa em destaque WIDE + 4 métricas (Horas estudadas 2h / Questões feitas 10 / Acertos 70% / Sessões de estudo 3)', (() => {
      const m = [...ov.querySelectorAll('.today-vertical-metric')];
      const wide = m[0];
      const vals = m.slice(1).map(e => e.querySelector('.materia-share-stat-value').textContent);
      return wide.classList.contains('wide') && !!wide.querySelector('.materia-share-belt') && vals[0] === '2h' && vals[1] === '10' && vals[2] === '70%' && vals[3] === '3' && ov.innerHTML.includes('Horas estudadas') && ov.innerHTML.includes('Sessões de estudo');
    })(), [...ov.querySelectorAll('.today-vertical-metric')].map(e => e.textContent).join(' | '));
    check('popup estudos do dia: bloco "Horas por matéria hoje" + doughnut 112×112 (tooltip DESABILITADO, animation 0, cutout 58%) + top 5 rows NA ORDEM de horasItems (m1 30min 25%, m2 1h 50%)', (() => {
      const ch = lex(w, '_chartTodayVerticalHours');
      const rows = [...ov.querySelectorAll('.today-vertical-study-row')];
      return ov.innerHTML.includes('Horas por matéria hoje') && ch && ch.options.plugins.tooltip.enabled === false && ch.options.animation.duration === 0 && ch.options.cutout === '58%' && rows.length === 2 && rows[0].innerHTML.includes('DIREITO CONSTITUCIONAL') && rows[0].innerHTML.includes('30min') && rows[0].innerHTML.includes('25%') && rows[1].innerHTML.includes('ATUALIDADES') && rows[1].innerHTML.includes('1h') && rows[1].innerHTML.includes('50%');
    })(), [...ov.querySelectorAll('.today-vertical-study-row')].map(r => r.textContent).join(' | '));
    w.fecharPopupEstudosDia();
    check('fecharPopupEstudosDia: overlay removido + _chartTodayVerticalHours null', !d.getElementById('todayVerticalOverlay') && lex(w, '_chartTodayVerticalHours') === null);
    check('todayShareBtn: click → stopPropagation + abrirPopupEstudosDia (listener do boot 1949-1952)', (() => {
      const btn = d.getElementById('todayShareBtn');
      const ev = new w.Event('click', { bubbles: true });
      let stopped = false;
      const orig = ev.stopPropagation;
      ev.stopPropagation = () => { stopped = true; orig.call(ev); };
      btn.dispatchEvent(ev);
      const opened = !!d.getElementById('todayVerticalOverlay');
      w.fecharPopupEstudosDia();
      return stopped && opened;
    })());
  }

  console.log('== R11-F: assimetria da janela (7/14/30/0) ==');
  {
    const t = bootHist({});
    await awaitBoot(t, 120);
    const w = t.w;
    const d = w.document;
    const chip7 = d.querySelectorAll('.filtro-chip')[0];
    w.setJanela(7, chip7);
    await tick(20);
    check('setJanela(7): chip "7 dias" fica active e "Desde o início" perde + histSub "— últimos 7 dias"', chip7.classList.contains('active') && !d.querySelectorAll('.filtro-chip')[3].classList.contains('active') && d.getElementById('histSub').textContent === 'Defensoria 2027 — últimos 7 dias', d.getElementById('histSub').textContent);
    check('ASSIMETRIA stats globais: Horas totais CONTINUA 7h (sessão de 20/10 fora da janela conta igual)', (() => {
      return d.getElementById('statsGlobais').innerHTML.includes('>7h<');
    })(), d.getElementById('statsGlobais').innerHTML.slice(0, 300));
    check('ASSIMETRIA heatmap: só 1 card (NOV) — outubro inteiro sai; dias do mês FORA do range = heatOut rgba(255,255,255,0.02) mas AINDA são buttons clicáveis', (() => {
      const hm = d.getElementById('chartHoras').innerHTML;
      const outs = [...d.querySelectorAll('.heatmap-day-btn')].filter(b => b.getAttribute('style').includes('rgba(255,255,255,0.02)'));
      return !hm.includes('>OUT</div>') && outs.length > 0 && outs[0].getAttribute('onclick').includes('openDayDetail');
    })(), d.querySelectorAll('.heatmap-month-card').length);
    check('lblHoras do PERÍODO: "6h em 2 dias ativos" (sD -3 4h + hoje 2h; 20/10 fora)', d.getElementById('lblHoras').textContent === '6h em 2 dias ativos', d.getElementById('lblHoras').textContent);
    check('ASSIMETRIA análise: janela 7 → só m1 tem questões no período (q2/q3 fora) → lblQuestoes "1 matérias com questões no período" (sem singular, verbatim) + bar [70] (só q1: 7/10)', d.getElementById('lblQuestoes').textContent === '1 matérias com questões no período' && lex(w, '_chartQuestoes.data.datasets[0].data.join(",")') === '70', d.getElementById('lblQuestoes').textContent);
    check('ASSIMETRIA pizza: GLOBAL — legend continua m1 69% / m2 31% e lblPizza 6h30m no total (ignora a janela)', (() => {
      const leg = d.getElementById('pizzaLegend').innerHTML;
      return leg.includes('>69%<') && leg.includes('>31%<') && d.getElementById('lblPizza').textContent === '6h30m no total';
    })(), d.getElementById('pizzaLegend').innerHTML.slice(0, 300));
    check('ASSIMETRIA estudos do dia: sempre HOJE — sub "Hoje (...)" e legendas inalteradas', d.getElementById('todaySummarySub').textContent.startsWith('Hoje (') && d.getElementById('todayHoursSub').textContent === '2h estudados hoje');
  }

  console.log('== R11-G: página vazia + quirks de texto ==');
  {
    const t = bootHist({ sessoes: [], questoes: [] });
    await awaitBoot(t, 120);
    const d = t.w.document;
    check('página vazia (janela 0, sem registros): datas [] → heatmap empty "Nenhum estudo registrado no período." (R14 normalizou)', d.getElementById('chartHoras').innerHTML.includes('Nenhum estudo registrado no período.'));
    check('página vazia: lblHoras "0min em 0 dias ativos" + lblQuestoes "Sem questões suficientes no período"', d.getElementById('lblHoras').textContent === '0min em 0 dias ativos' && d.getElementById('lblQuestoes').textContent === 'Sem questões suficientes no período', [d.getElementById('lblHoras').textContent, d.getElementById('lblQuestoes').textContent].join(' | '));
    check('página vazia: lblPizza "Nenhuma sessão registrada" + legenda AINDA mostra as 2 matérias (ranking itera getMaterias mesmo sem sessões: rows 0min/0%, pct 0) — o empty "Nenhuma sessão registrada ainda." só quando o concurso não tem matérias', (() => {
      const leg = d.getElementById('pizzaLegend').innerHTML;
      return leg.includes('DIREITO CONSTITUCIONAL') && leg.includes('ATUALIDADES') && leg.includes('0min') && leg.includes('>0%<') && !leg.includes('Nenhuma sessão registrada ainda.') && lex(t.w, '_chartPizza') === null;
    })(), d.getElementById('pizzaLegend').innerHTML.slice(0, 400));
    check('página vazia: estudos do dia — "Nenhuma hora registrada hoje"/"Nenhuma questão registrada hoje"/"Nenhuma sessão de estudo hoje."', d.getElementById('todayHoursSub').textContent === 'Nenhuma hora registrada hoje' && d.getElementById('todayQuestionsSub').textContent === 'Nenhuma questão registrada hoje' && d.getElementById('todaySessionsList').innerHTML.includes('Nenhuma sessão de estudo hoje.'));
  }

  console.log('');
  console.log(`== R11: ${passed} PASS / ${failed} FAIL ==`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(2); });
