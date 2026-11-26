// Monta a página Simulados (R12, etapa-11):
//   pages/simulados/style.css    = original 11-225 (do <style> 10-226)
//   pages/simulados/body.html    = original 230-326 (+ seams goPage)
//   pages/simulados/script1.pagejs = original 330-381 (IIFE sidebar, verbatim)
//   pages/simulados/main.pagejs  = original 384-3715 (+ goPage local + seam
//       385 de redirect + DECISÕES R12 do Oodeus, spec etapa-11 §7):
//       1. renderGraficoGeral → DESIGN LOLLIPOP (711-858, adaptado ao vivo:
//          getSimPct, formatPercentPt, notaCorteMeta.chartValue, tooltip de
//          corte formatNotaCorteTooltip; sub/empty-state do vivo; stage
//          height clamp(280,430,240+16×N)) — o gráfico de barras 2115-2236
//          NÃO é replicado (decisão literal "NÃO é replicado");
//       2. formatPoints → formatPointsPt em TODOS os usos vivos (linhas
//          2297/3087/3394/3503/3539/3543) — "unificar em vírgula"; usos
//          mortos (2400 D11, 2483/2495 D12) ficam formatPoints verbatim;
//       3. patch do card de corte pós-innerHTML: já está em render() (2377).
// Dead code D1-D15 do PORT fica verbatim NOS ARQUIVOS (mesma conduta R10/R11:
// a LISTA D do doc-mestre §1.5 rege o que NÃO vira tela — aqui as gerações
// mortas inteiras são preservadas; conferir "nada vivo sumiu" = checklist
// §5.7 do relatório). Acentos: ficam como no original (aceite R12).
const fs = require('fs');
const orig = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/simulados.html', 'utf8');
const crlf = orig.includes('\r\n');
const EOL = crlf ? '\r\n' : '\n';
let lines = orig.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', crlf ? 'CRLF' : 'LF');

// delimitadores (1-based): theme.js 6, Inter 8, Chart.js CDN 9, <style> 10,
// </style> 226, theme.css 227, </head> 228, <body> 229, <aside> 232,
// </aside> 268, <main> 270, </main> 326, data.js 328, <script> 329,
// </script> 382, <script> 383, </script> 3716, nav.js 3720,
// timer-popup.js 3721, </body> 3722, </html> 3723. SEM html2canvas (só
// Chart.js 4.4.1 CDN, linha 9 — conferido por grep: 0 ocorrências).
const tag = (n) => JSON.stringify(lines[n - 1].trim());
const expect = (n, txt) => { if (lines[n - 1].trim() !== txt) throw new Error('linha ' + n + ' esperava ' + JSON.stringify(txt) + ', achei ' + JSON.stringify(lines[n - 1].trim())); };
expect(6, '<script src="theme.js"></script>');
expect(9, '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>');
expect(10, '<style>');
expect(226, '</style>');
expect(227, '<link rel="stylesheet" href="theme.css">');
expect(228, '</head>');
expect(229, '<body>');
expect(326, '</main>');
expect(328, '<script src="data.js"></script>');
expect(329, '<script>');
expect(382, '</script>');
expect(383, '<script>');
expect(3716, '</script>');
expect(3720, '<script src="nav.js"></script>');
expect(3721, '<script src="timer-popup.js"></script>');
expect(3722, '</body>');
expect(3723, '</html>');
console.log('checagem: 17 delimitadores ok |', tag(6), tag(9), tag(226), tag(328), tag(3716), tag(3721));

// ===== DECISÃO 2: formatPoints → formatPointsPt nos usos VIVOS =====
// Linhas vivas: 2297 (lista RAIO-X), 3087 (formatPainelMinimumScore),
// 3394 (linhas do painel v2), 3503/3539/3543 (resumo v2). Mortas preservadas:
// 1343 (definição), 2400 (D11), 2483/2495 (D12).
const VIVO_FMT = [2297, 3087, 3394, 3503, 3539, 3543];
for (const n of VIVO_FMT) {
  const before = lines[n - 1];
  if (!/formatPoints\(/.test(before)) throw new Error('linha ' + n + ' sem formatPoints(');
  const after = before.replace(/formatPoints\(/g, 'formatPointsPt(');
  if (after === before) throw new Error('linha ' + n + ' não mudou');
  lines[n - 1] = after;
  console.log('formatPoints→Pt linha', n, ':', (before.match(/formatPoints\(/g) || []).length, 'x');
}
// guarda: os mortos continuam intocados
for (const n of [1343, 2400, 2483, 2495]) {
  if (!/formatPoints\(/.test(lines[n - 1])) throw new Error('linha morta ' + n + ' foi alterada!');
}

const css = lines.slice(10, 225).join(EOL);          // 11-225
let bodyHtml = lines.slice(229, 326).join(EOL);      // 230-326
const script1 = lines.slice(329, 381).join(EOL);     // 330-381
let main = lines.slice(383, 3715).join(EOL);         // 384-3715

// ===== body.html: seams de navegação =====
// 8 pontos location.href (logo 234 + nav-items 238-241/243-245) + 1 especial
// (flashcards 242, com sessionStorage antes) — mesmo padrão do R10/R11
const navRe = /onclick="location\.href='([^']+)'"/g;
const navHits = (bodyHtml.match(navRe) || []).length;
if (navHits !== 8) throw new Error('esperava 8 seams location.href, achei ' + navHits);
bodyHtml = bodyHtml.replace(navRe, "onclick=\"goPage('$1')\"");
const fOld = "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');location.href='dashboard.html#flashcards'\"";
if (!bodyHtml.includes(fOld)) throw new Error('seam flashcards (242) não encontrado');
bodyHtml = bodyHtml.replace(fOld, "onclick=\"sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')\"");
const aOld = '<a href="ajuda.html" style="text-decoration:none">';
if (!bodyHtml.includes(aOld)) throw new Error('seam <a href> (248) não encontrado');
bodyHtml = bodyHtml.replace(aOld, '<a href="ajuda.html" onclick="goPage(\'ajuda.html\');return false" style="text-decoration:none">');
console.log('body: seams location.href =', navHits, '| flashcards + <a href> ok');

// ===== main.pagejs: goPage local + seam de redirect =====
const goAnchor = ["const cId = sessionStorage.getItem('ct_concurso_ativo');", "if (!cId) location.href = 'concursos.html';"].join(EOL);
if (!main.startsWith(goAnchor)) throw new Error('goPage anchor (384-385) não encontrado no início do main');
main = main.replace(goAnchor, [
  "const cId = sessionStorage.getItem('ct_concurso_ativo');",
  '// [R12-port] Navegação entre páginas (mesmo contrato do goPage do nav.js).',
  'function goPage(dest) {',
  "  if (window.__CT_NAV_GO_PAGE) { window.__CT_NAV_GO_PAGE(dest); return; }",
  "  window.location.href = dest;",
  '}',
  '// Seam do redirect (orig 385): o location.href do original NÃO interrompe a',
  '// execução do script (a navegação só é commitada depois) — sem return, o',
  '// boot segue até render() como no original.',
  "if (!cId) goPage('concursos.html');",
].join(EOL));
console.log('main: goPage local + seam 385 ok');

// ===== DECISÃO 1: renderGraficoGeral → design lollipop =====
// A cirurgia é por índice dentro do corpo da função (2068-2237): mantém o
// prólogo vivo (guards/destroy/empty state/deltas/sub) e troca só o
// construção do chart (2101 stage height + 2115-2236) pelo lollipop
// adaptado (711-858 + as 4 adaptações da spec §7).
const fnStart = main.indexOf('function renderGraficoGeral(simsFeitos, tendencia, media, notaCorteMeta) {');
if (fnStart < 0 || main.indexOf('function renderGraficoGeral', fnStart + 1) > -1) throw new Error('renderGraficoGeral não é única');
const fnEnd = main.indexOf('function renderListaSimuladosDetalhada', fnStart);
if (fnEnd < 0) throw new Error('fim de renderGraficoGeral não encontrado');
let fnBlock = main.slice(fnStart, fnEnd);

const hOld = "stage.style.height = '300px';";
if (fnBlock.split(hOld).length !== 2) throw new Error("stage height '300px' não único no fnBlock");
fnBlock = fnBlock.replace(hOld, "stage.style.height = Math.max(280, Math.min(430, 240 + (simsFeitos.length * 16))) + 'px';");

const closeSuffix = EOL + '}' + EOL;
if (!fnBlock.endsWith(closeSuffix)) throw new Error('fnBlock não termina com } (tail: ' + JSON.stringify(fnBlock.slice(-12)) + ')');
const head = fnBlock.slice(0, fnBlock.length - closeSuffix.length); // termina em "  });"
if (!head.endsWith('  });')) throw new Error('head não termina no fecho do new Chart');
const chartAnchor = '  const labels = simsFeitos.map((sim, index) => {';
if (head.split(chartAnchor).length !== 2) throw new Error('chartAnchor não único');
const prefix = head.slice(0, head.indexOf(chartAnchor)); // inclui o stage height já trocado

// corpo novo = esqueleto do lollipop morto (711-858) com as adaptações
// vivas: getSimPct (notas), formatPercentPt (labels %, tooltip),
// notaCorteMeta.chartValue (corte convertido) + formatNotaCorteTooltip.
const newChart = [
  "  const labels = simsFeitos.map((sim, index) => {",
  "    const nome = (sim.nome || '').trim();",
  "    return nome ? (nome.length > 16 ? nome.slice(0, 16) + '...' : nome) : `Simulado ${index + 1}`;",
  "  });",
  "  const notas = simsFeitos.map(sim => {",
  "    const pct = getSimPct(sim);",
  "    return pct != null ? pct : 0;",
  "  });",
  "  const corteChartValue = notaCorteMeta && notaCorteMeta.chartValue != null ? Number(notaCorteMeta.chartValue) : null;",
  "  const ctx = document.getElementById('chartSim').getContext('2d');",
  "  const lollipopPlugin = {",
  "    id: 'simuladosLollipop',",
  "    beforeDatasetsDraw(chart) {",
  "      const meta = chart.getDatasetMeta(0);",
  "      const yScale = chart.scales.y;",
  "      const ctx2 = chart.ctx;",
  "      ctx2.save();",
  "      meta.data.forEach((point, index) => {",
  "        const pct = notas[index];",
  "        ctx2.beginPath();",
  "        ctx2.strokeStyle = pctColor(pct);",
  "        ctx2.globalAlpha = 0.36;",
  "        ctx2.lineWidth = index === notas.length - 1 ? 8 : 6;",
  "        ctx2.lineCap = 'round';",
  "        ctx2.moveTo(point.x, yScale.getPixelForValue(0));",
  "        ctx2.lineTo(point.x, point.y + 6);",
  "        ctx2.stroke();",
  "      });",
  "      ctx2.restore();",
  "    },",
  "    afterDatasetsDraw(chart) {",
  "      const meta = chart.getDatasetMeta(0);",
  "      const ctx2 = chart.ctx;",
  "      ctx2.save();",
  "      ctx2.textAlign = 'center';",
  "      ctx2.textBaseline = 'bottom';",
  "      ctx2.font = '700 11px Inter';",
  "      meta.data.forEach((point, index) => {",
  "        ctx2.fillStyle = pctColor(notas[index]);",
  "        ctx2.fillText(formatPercentPt(notas[index]), point.x, point.y - 10);",
  "      });",
  "      ctx2.restore();",
  "    }",
  "  };",
  "",
  "  const datasets = [{",
  "    type: 'line',",
  "    label: 'Nota',",
  "    data: notas,",
  "    borderColor: window.TrackTheme ? TrackTheme.alpha(theme.accent2, 0.32) : 'rgba(124,92,252,0.32)',",
  "    borderWidth: 2,",
  "    tension: 0.35,",
  "    fill: false,",
  "    pointRadius: notas.map((_, index) => index === notas.length - 1 ? 7 : 5),",
  "    pointHoverRadius: notas.map((_, index) => index === notas.length - 1 ? 8 : 6),",
  "    pointBorderWidth: 2,",
  "    pointBorderColor: theme.chartSurfaceBorder,",
  "    pointBackgroundColor: notas.map(n => pctColor(n))",
  "  }];",
  "",
  "  if (corteChartValue != null) {",
  "    datasets.push({",
  "      type: 'line',",
  "      label: 'Corte',",
  "      data: Array(notas.length).fill(corteChartValue),",
  "      borderColor: window.TrackTheme ? TrackTheme.alpha(theme.yellow, 0.62) : 'rgba(245,200,66,0.62)',",
  "      borderWidth: 2,",
  "      borderDash: [8, 6],",
  "      pointRadius: 0,",
  "      tension: 0",
  "    });",
  "  }",
  "",
  "  if (media != null) {",
  "    datasets.push({",
  "      type: 'line',",
  "      label: 'Média',",
  "      data: Array(notas.length).fill(media),",
  "      borderColor: window.TrackTheme ? TrackTheme.alpha(theme.accent2, 0.68) : 'rgba(124,92,252,0.68)',",
  "      borderWidth: 2,",
  "      borderDash: [4, 4],",
  "      pointRadius: 0,",
  "      tension: 0",
  "    });",
  "  }",
  "",
  "  _chartSim = new Chart(ctx, {",
  "    data: { labels, datasets },",
  "    plugins: [lollipopPlugin],",
  "    options: {",
  "      responsive: true,",
  "      maintainAspectRatio: false,",
  "      layout: { padding: { top: 20, right: 8, left: 8, bottom: 0 } },",
  "      plugins: {",
  "        legend: { display: false },",
  "        tooltip: {",
  "          backgroundColor: theme.tooltipBg,",
  "          borderColor: theme.tooltipBorder,",
  "          borderWidth: 1,",
  "          titleColor: theme.tooltipTitle,",
  "          bodyColor: theme.tooltipBody,",
  "          padding: 12,",
  "          cornerRadius: 10,",
  "          callbacks: {",
  "            title: function(items) {",
  "              const item = simsFeitos[items[0].dataIndex];",
  "              return (item.nome || ('Simulado ' + (items[0].dataIndex + 1))) + ' - ' + formatSimDate(item.criadoEm || CT._today());",
  "            },",
  "            label: function(ctx3) {",
  "              if (ctx3.dataset.label === 'Corte') return formatNotaCorteTooltip(notaCorteMeta);",
  "      if (ctx3.dataset.label === 'Média') return ' Média geral: ' + formatPercentPt(ctx3.raw);",
  "              return ' Nota: ' + formatPercentPt(ctx3.raw);",
  "            }",
  "          }",
  "        }",
  "      },",
  "      scales: {",
  "        x: {",
  "          ticks: { color: theme.chartAxisStrong, font:{size:10}, maxRotation:0, minRotation:0 },",
  "          grid: { display:false }",
  "        },",
  "        y: {",
  "          ticks: { color: theme.chartAxis, font:{size:10}, callback: v => v + '%' },",
  "          grid: { color: theme.chartGrid },",
  "          min: 0,",
  "          max: 100",
  "        }",
  "      }",
  "    }",
  "  });",
];
const newFn = prefix + newChart.join(EOL) + closeSuffix;
main = main.slice(0, fnStart) + newFn + main.slice(fnEnd);
console.log('main: lollipop (decisão 1) aplicado — renderGraficoGeral', newChart.length, 'linhas no chart body');

// ===== headers =====
const bodyHeader = [
  '<!-- Track do Oodeus — [R12-port] body de simulados.html (linhas 230-326 do',
  '     original www/simulados.html). Adaptações: onclick de navegação',
  '     location.href → goPage (8 pontos: logo 234 + nav-items 238-241/243-245;',
  '     o item Flashcards 242 mantém o sessionStorage.setItem e navega',
  '     dashboard.html#flashcards — hash PRESERVADO pelo navigateTo desde a',
  '     R9); <a href="ajuda.html"> (248) recebe onclick goPage + return false',
  '     (precedente R10/R11). <img src="assets/…"> mantém o caminho relativo',
  '     do original — o shell reescreve na renderização. Verbatim de propósito:',
  '     o body não tem blocos mortos (D14 é CSS, no style.css). Botões da',
  '     lista ("▶ Fazer Simulado") e o modal são criados pelo JS.',
  '-->',
  '',
].join(EOL);
const cssHeader = [
  '/* Track do Oodeus — [R12-port] CSS de simulados.html (linhas 11-225 do',
  '   original www/simulados.html, verbatim). O font link do head (Google Fonts',
  '   Inter, linha 8) é descartado (precedente R2). url("assets/…") é',
  '   reescrito pelo shell na renderização (rewritePageCssAssetUrls).',
  '   Dead code D14 verbatim (CSS morto da etapa-11 §3: bloco RANKING',
  '   SIMULADOS .ranking-list/.rank-row/.rank-pos/.rank-nome/.rank-pct,',
  '   .section-divider, e bloco POPUP NOVO SIMULADO .popup-overlay/.popup/',
  '   .popup-title/.form-group/.form-label/.form-input/.tipo-opts/.tipo-opt*/',
  '   .popup-btns/.btn-cancel/.btn-salvar — verificado por grep na etapa:',
  '   nenhuma usada no HTML/JS vivo). CSS vivo notável preservado: spinners',
  '   de input[type=number] escondidos via webkit (208-209), .ph-meta (212),',
  '   .sim-select (156). */',
  '',
].join(EOL);
const script1Header = [
  '/**',
  ' * Track do Oodeus - [R12-port] IIFE sidebar de simulados.html (verbatim,',
  ' * linhas 330-381 do original www/simulados.html). Idêntica às outras',
  ' * páginas (logo cache-bust, PRÉ-EDITAL reescreve o timer-box, Pós-Edital',
  ' * reescreve com "Coberto ×N", revBadge por concurso; mesma fonte multilinha',
  ' * de historico/revisoes). Sem seams — não navega. Roda como 2º script da',
  ' * cadeia (o data.js do original 328 roda no onload do plugin).',
  ' */',
].join(EOL);
const mainHeader = [
  '/**',
  ' * Track do Oodeus - [R12-port] script principal de simulados.html',
  ' * (original 384-3715 + seams + decisões R12). Script inline CLÁSSICO',
  " * top-level, SEM IIFE e SEM 'use strict' (como o original); o wrapper do",
  ' * shell (render-util.runPageScripts) faz a ponte de nomes para window — os',
  ' * onclick inline enxergam as funções e as let/const top-level via accessors.',
  ' *',
  ' * Conteúdo vivo (etapa-11 §4): render() (2329-2383) com o PATCH',
  ' * pós-innerHTML do 4º card (decisão 3 do Oodeus: "replicar tal como está" —',
  ' * notaCorteMeta.display vira o valor do card); renderGraficoGeral (2068) com',
  ' * DESIGN LOLLIPOP (decisão 1 — corpo novo abaixo, substitui o gráfico de',
  ' * barras; o lollipop morto vivia dentro do render() antigo, 711-858);',
  ' * Raio-x por matéria v2 (3224-3375, select pct/acertos/pontos); lista viva',
  ' * renderListaSimuladosDetalhada (2238-2328, RAIO-X/TEMPO/MÍNIMOS no item);',
  ' * modal v3 (2591-2723) + salvarSimulado v3 (2724-2818) com cálculo',
  ' * automático do Painel da Prova (chave ct_config_prova_<cid> compartilhada',
  ' * com cadastro_edital.html — interoperabilidade obrigatória); nota de corte',
  ' * v2 percentual/pontos (abrirModalCorte 1253, salvarCorte 1302);',
  ' * deletarSimulado v2 (assignment 2819, grava DIRETO em localStorage',
  ' * ct_simulados — bypass da API CT, vivo); boot render() (3715).',
  ' *',
  ' * Decisões do Oodeus (spec etapa-11 §7, 2026-11-13):',
  ' * 1. Gráfico de evolução = DESIGN LOLLIPOP da 3ª geração, adaptado ao',
  ' *     vivo: notas via getSimPct (cobre acertos/questões), labels/tooltip',
  ' *     em formatPercentPt (vírgula), corte = notaCorteMeta.chartValue (pts',
  ' *     convertido em %) com tooltip formatNotaCorteTooltip, sub do vivo',
  ' *     (desempenho recente + deltas), empty state do vivo, stage height',
  ' *     clamp(280,430,240+16×N), legend display:false, hastes alpha 0.36',
  ' *     (lineWidth 8 na última), Nota accent2 alpha 0.32 pointRadius 7/5,',
  ' *     corte [8,6] 0.62, média [4,4] 0.68. O gráfico de barras vivo',
  ' *     (2115-2236 do original) NÃO é replicado (decisão literal).',
  ' *  2. formatPoints → formatPointsPt em TODOS os usos VIVOS (lista RAIO-X',
  ' *     2297 + formatPainelMinimumScore 3087 + linhas do painel 3394 +',
  ' *     resumo 3503/3539/3543) — "unificar em vírgula". Os usos MORTOS',
  ' *     (D11 2400, D12 2483/2495) ficam formatPoints verbatim e a função',
  ' *     formatPoints (1343) permanece definida. NOTA de auditoria: a spec',
  ' *     §4.8 documentou o ponto decimal só na lista ("o resto da página usa',
  ' *     vírgula"), mas o original também exibia ponto no modal v2 — a',
  ' *     premissa da decisão estava incompleta; a unificação cobre a página',
  ' *     viva inteira.',
  ' *',
  ' * Dead code D1-D15 verbatim (cascata inteira preservada: render() antigo',
  ' * 490-938 com as 3 gerações de gráfico mortas — line 535, bar 606, lollipop',
  ' * 711 (fonte da decisão 1); gerações antigas de abrirModalSimulado v1/v2,',
  ' * salvarSimulado v1/v2, alternarCamposSimulado v1, deletarSimulado v1',
  ' * (1208), abrirModalCorte/salvarCorte v1 (1215/1239, alert "Valor inválido!"',
  ' * COM acento), loadPainelProvaConfig/getPainelMateriaInfo v1,',
  ' * buildMateriaOverviewState/renderGraficoMateria/buildPainelAutoRowsHTML/',
  ' * atualizarResumoPainelSimulado/buildPainelSnapshotFromModal v1,',
  ' * renderDeltaInline órfã (1553); D14 = CSS). Acentos ausentes ficam como no',
  ' * original até a passada de aceite (doc-mestre §1.5).',
  ' *',
  ' * Seams [R12-port]: goPage local (precedente revisões/aba-materia); redirect',
  ' * sem cId (385 — SEM return: o location.href original não interrompe). Sem',
  ' * location.search/hash. Links target="_blank" (sim.link, 888/2268) verbatim',
  ' * (precedente R6/R7/R9 — não navegam para páginas do app).',
  ' *',
  ' * Ordem de carregamento do original: theme.js (6) → Inter (8) → Chart.js',
  ' * 4.4.1 CDN (9, ÚNICA dependência CDN — SEM html2canvas nesta página) →',
  ' * style inline (10-226) → theme.css (227) → body (230-326) → data.js (328)',
  ' * → IIFE sidebar (329-382) → este script (383-3716) → nav.js (3720) →',
  ' * timer-popup.js (3721). No plugin: theme/data no onload; nav boot ANTES da',
  ' * cadeia (desvio R3); cadeia = [chart.umd (vendored R9), IIFE sidebar,',
  ' * este script, timer-popup (por último, como o <script src> 3721)].',
  ' */',
].join(EOL);

const dir = 'pages/simulados';
fs.mkdirSync(dir, { recursive: true });
const cssOut = cssHeader + css + EOL;
const bodyOut = bodyHeader + bodyHtml + EOL;
const script1Out = script1Header + EOL + script1 + EOL;
const mainOut = mainHeader + EOL + main + EOL;
fs.writeFileSync(dir + '/style.css', cssOut, 'utf8');
fs.writeFileSync(dir + '/body.html', bodyOut, 'utf8');
fs.writeFileSync(dir + '/script1.pagejs', script1Out, 'utf8');
fs.writeFileSync(dir + '/main.pagejs', mainOut, 'utf8');
console.log('gravado:', dir + '/style.css', Buffer.byteLength(cssOut), 'B |', dir + '/body.html', Buffer.byteLength(bodyOut), 'B |', dir + '/script1.pagejs', Buffer.byteLength(script1Out), 'B |', dir + '/main.pagejs', Buffer.byteLength(mainOut), 'B,', mainOut.split(/\r?\n/).length, 'linhas');
