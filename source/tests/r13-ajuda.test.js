/**
 * Track do Oodeus — testes R13 (etapa-13 §4: ajuda.html, página "Ajuda")
 *
 * Harness jsdom + vm.runInContext (padrão r9-r13): body.html injetado ANTES
 * dos scripts; cadeia = [main (608-874), script1 (IIFE sidebar 875-926),
 * timer-popup] NA ORDEM DO ORIGINAL (bloco único 607-927; o plano prévio
 * [script1, main] estava invertido — ordem de carregamento é comportamento).
 * theme.js/data.js rodam ANTES (vm, como no onload do plugin); nav boot NÃO
 * roda (desvio R3 — mas o body TEM data-nav-icon, diferente de editais).
 * SEM TrackTheme stubado. VirtualConsole descarta jsdomErrors (navigation
 * not-implemented do clique em <a href externo>).
 *
 * Asserções COPIADAS do probe de dump (convenção #2061): valores de runtime
 * vindos do probe-ajuda-dump (S1-S11), estáticos do fonte/originais.
 * Dias do timer da sidebar: valor varia com a hora do dia (fuso UTC na
 * interpretação de dataProva) — precedente r4/r9: assertar /^\d+$/ + cor
 * mapeada (≤7 red / ≤30 orange / >30 accent) + estrutura do box.
 *
 * Comportamentos cobertos (etapa-13 §4):
 *  - fetchGitHubStars a cada visita (api.github.com SEM cache) → badge;
 *  - syncGuides: file:/// do DEV (falha esperada → catch silencioso) →
 *    raw GitHub → processAndRender limpa import/export/icon: e executa com
 *    new Function (§6.1 — verbatim); render pula o grupo "Instalação";
 *  - fallbackGuides render imediato; offline → mantém fallback + warns;
 *  - copy toast 2600ms: clipboard API + fallback textarea/execCommand;
 *  - openReleaseNotes: pywebview open_external_url (guard §6.2) → fallback
 *    window.open EXTERNO 'noopener';
 *  - cliques inline: card GitHub/gh-btn (stopPropagation)/link site/
 *    release-note/contact cards/nav-items/logo/guia Pronto;
 *  - flashcards seam: sessionStorage PRESERVADO + goPage dashboard#flashcards;
 *  - sidebar: sem cId → "—"; pós-edital (dias+cor, coberto ×N com rocket);
 *    pré-edital reescreve o timer-box; revBadge por concurso.
 *  - Dead code D1-D3 (style) e D4 (tag cloudflare) verbatim (§4.2).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { initHost } = require('../src/host');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const dataSrc = read('src/data.js');
const ajMainSrc = read('pages/ajuda/main.pagejs');
const ajScript1Src = read('pages/ajuda/script1.pagejs');
const ajBodyHtml = read('pages/ajuda/body.html');
const ajStyleSrc = read('pages/ajuda/style.css');
const timerSrc = read('pages/timer/timer-popup.pagejs');
const shellSrc = read('src/shell.js');
const mainPluginSrc = read('main.js');

// Corpos SEM o header de comentário do port.
const bodyCore = ajBodyHtml.slice(ajBodyHtml.indexOf('-->') + 3);
const mainBody = ajMainSrc.slice(ajMainSrc.indexOf('*/') + 2);
const styleCore = ajStyleSrc.slice(ajStyleSrc.indexOf('*/') + 2);
const script1Body = ajScript1Src.slice(ajScript1Src.indexOf('*/') + 2);

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + String(extra).slice(0, 400) : '')); console.log('  FAIL ' + name + (extra ? ' — ' + String(extra).slice(0, 300) : '')); }
}

function vmRun(w, src, filename) {
  vm.runInContext(src, w.__ctx || (w.__ctx = vm.createContext(w)), { filename });
}
const lex = (w, expr) => vm.runInContext(expr, w.__ctx, { filename: 'lex-snip' });
const tick = (ms) => new Promise(r => setTimeout(r, ms));

// ===== Fixtures (idênticas ao probe) =====
const GUIDE_JS = [
  "import { rocket } from './icon.js';",
  "export const guideGroups = [",
  "  { title: 'Instalação', description: 'Grupo pulado no render.', guides: [{ title: 'Nunca visto', slug: 'nunca', status: 'Pronto' }] },",
  "  { title: 'Primeiros passos', description: 'Do site oficial.', icon: rocket,",
  "    guides: [ { title: 'Guia Dinâmico Pronto', slug: 'dinamico-pronto', status: 'Pronto' }, { title: 'Guia Dinâmico Em breve', slug: 'dinamico-breve', status: 'Em breve' } ] },",
  "  { title: 'Grupo Vazio', description: 'Sem guias listados.', guides: [] },",
  "];",
  "export const guideDetails = { 'dinamico-pronto': { category: 'Primeiros passos', title: 'Guia Dinâmico Pronto', description: 'Descrição vinda do site oficial.' } };",
].join('\n');
const LOCAL_GUIDE_JS = [
  "export const guideGroups = [ { title: 'Primeiros passos', description: 'Do workspace local.', guides: [{ title: 'Guia Local', slug: 'local', status: 'Pronto' }] } ];",
  "export const guideDetails = {};",
].join('\n');
const RELEASE_URL = 'https://github.com/michel-softwares/track-concursos/releases/tag/v1.0.6';
const FILE_URL = 'file:///C:/Users/miche/Desktop/Site%20Track%20Concurso/track-concursos.github.io/src/data/guides.js';
const RAW_URL = 'https://raw.githubusercontent.com/Track-Concursos/track-concursos.github.io/main/src/data/guides.js';

const okText = (t) => ({ ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t) });
const okJson = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });

function bootAjuda({ mode = 'online', cid = null, preRun } = {}) {
  const vc = new VirtualConsole();
  const j = new JSDOM('<!doctype html><html><head></head><body>' + ajBodyHtml + '</body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously', virtualConsole: vc });
  const w = j.window;
  const execLog = [];
  w.document.execCommand = (c) => { execLog.push(c); return true; };
  global.window = w;
  const navSpy = [];
  initHost({
    data: {}, persist: () => true, window: w,
    navigate: (p) => { navSpy.push(p); return true; },
    currentPage: () => '', assetBase: () => 'app://plugin/assets/remix-nav/', assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_NAV_GO_PAGE = (p) => { navSpy.push('nav:' + p); };
  const warns = [];
  const logs = [];
  w.console.warn = (...a) => warns.push(a.map(x => String(x && x.message || x)).join(' '));
  w.console.log = (...a) => logs.push(a.map(String).join(' '));
  const fetchLog = [];
  w.fetch = async (url) => {
    const u = String(url);
    fetchLog.push(u);
    if (mode === 'offline') throw new Error('network down');
    if (u.includes('api.github.com')) return okJson({ stargazers_count: 1234 });
    if (u.startsWith('file:///')) {
      if (mode === 'localok') return okText(LOCAL_GUIDE_JS);
      throw new Error('Not allowed to load local resource');
    }
    if (u.includes('raw.githubusercontent.com/Track-Concursos')) return okText(GUIDE_JS);
    throw new Error('unexpected fetch ' + u);
  };
  const opens = [];
  w.open = (u, t, f) => { opens.push([u, t, f]); return null; };
  vmRun(w, dataSrc, 'data.js');
  let cId = null;
  if (cid) {
    cId = w.CT.saveConcurso(cid);
    w.sessionStorage.setItem('ct_concurso_ativo', cId);
    const m = w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
    const tpc = w.CT.saveTopico({ concursoId: cId, materiaId: (m && m.id) || w.CT.getMaterias()[0].id, nome: 'Controle de constitucionalidade' });
    w.__tpcId = (tpc && tpc.id) || null;
  }
  if (preRun) preRun(w, cId);
  vmRun(w, ajMainSrc, 'ajuda.html [inline]');
  vmRun(w, ajScript1Src, 'ajuda.html [sidebar]');
  vmRun(w, timerSrc, 'timer-popup.js');
  return { dom: j, w, cId, navSpy, fetchLog, warns, logs, opens, execLog };
}

const txt = (w, id) => (w.document.getElementById(id) || {}).textContent;
const html = (w, id) => (w.document.getElementById(id) || {}).innerHTML;

function guidesDump(w) {
  const grid = w.document.getElementById('guidesGrid');
  return [...grid.querySelectorAll(':scope > .guide-card')].map(card => ({
    icon: (card.querySelector('.guide-card-icon') || {}).textContent,
    title: (card.querySelector('.guide-card-title') || {}).textContent,
    desc: (card.querySelector('.guide-card-desc') || {}).textContent,
    items: [...card.querySelectorAll('.guide-item')].map(el => ({
      cls: el.className,
      tag: el.tagName,
      title: (el.querySelector('.guide-item-title') || {}).textContent,
      titleStyle: (el.querySelector('.guide-item-title') || {}).getAttribute('style'),
      desc: (el.querySelector('.guide-item-desc') || {}).textContent,
      badge: (el.querySelector('.guide-status-badge') || {}).textContent,
      badgeCls: (el.querySelector('.guide-status-badge') || {}).className,
      href: el.getAttribute('href'),
      onclick: el.getAttribute('onclick'),
    })),
    empty: (card.querySelector('.guide-list') || {}).innerHTML,
  }));
}

function timerDump(w) {
  const box = w.document.querySelector('.timer-box');
  const num = w.document.getElementById('sideTimer');
  return {
    nome: (w.document.getElementById('sideNome') || {}).textContent,
    banca: (w.document.getElementById('sideBanca') || {}).textContent,
    num: num && num.textContent,
    numColor: num && num.style.color,
    label: (w.document.getElementById('sideTimerLabel') || {}).textContent,
    boxPad: box && box.style.padding,
    boxHtml: box && box.innerHTML,
    revBadge: { text: (w.document.getElementById('revBadge') || {}).textContent, display: (w.document.getElementById('revBadge') || {}).style.display },
  };
}

// Dígitos normalizados (nº de dias varia com a hora do dia — precedente r4/r9).
const numz = (s) => String(s).replace(/\d+/g, '#');
const plus = (n) => { const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  console.log('== R13-A: fonte/registro/seams estáticos ==');
  {
    const iAj = shellSrc.indexOf("'ajuda.html'");
    const iEnd = iAj > -1 ? shellSrc.indexOf('\n  },', iAj) : -1;
    const block = iEnd > -1 ? shellSrc.slice(iAj, iEnd) : '';
    check('shell.js: ajuda.html registrado com cadeia [main, script1, timer-popup] NA ORDEM do original (principal 608-874 ANTES da IIFE 875-926)', iAj > -1
      && block.indexOf('../pages/ajuda/main.pagejs') > -1
      && block.indexOf('../pages/ajuda/script1.pagejs') > block.indexOf('../pages/ajuda/main.pagejs')
      && block.indexOf('../pages/timer/timer-popup.pagejs') > block.indexOf('../pages/ajuda/script1.pagejs'));
    check('shell.js: title "Ajuda" + icon lucide help-circle + lazyModules []', block.includes("title: 'Ajuda'") && block.includes("icon: 'help-circle'") && /lazyModules:\s*\[\]/.test(block));
    check('shell.js: header [R2+…+R12+R13]', shellSrc.includes('shell.js [R2+R3+R4+R5+R7+R9+R10+R11+R12+R13]'));
    check('shell.js: comentários R13 das duas páginas + demais páginas seguem registradas', shellSrc.includes('R13: editais_premium.html') && shellSrc.includes('R13: ajuda.html') && ["'dashboard.html'", "'revisoes.html'", "'historico.html'", "'simulados.html'"].every(x => shellSrc.includes(x)));
    check('main.js R9: navigateTo preserva hash + __CT_PAGE_SEARCH__/__CT_PAGE_HASH__ no shell (regressão)', mainPluginSrc.includes('this.pendingPageHash = hash;') && shellSrc.includes('window.__CT_PAGE_SEARCH__') && shellSrc.includes('window.__CT_PAGE_HASH__'));

    check('body.html: 9 seams goPage (logo + 8 nav-items; flashcards com sessionStorage+hash preservados) + logo é a 1ª', (ajBodyHtml.match(/onclick="[^"]*goPage\('/g) || []).length === 9
      && ajBodyHtml.includes("sessionStorage.setItem('ct_dashboard_tab','flashcards');goPage('dashboard.html#flashcards')")
      && ajBodyHtml.indexOf('brand-logo') < ajBodyHtml.indexOf('onclick="goPage(\'concursos.html\')"'));
    check('body.html: SEM location.href restante (fora do header) + SEM redirect/guard (página funciona sem concurso §4.1)', !/location\.href/.test(bodyCore) && !bodyCore.includes('ct_concurso_ativo'));
    check('body.html: ids vivos (github-stars-badge/guidesGrid/copyToast*/side*/revBadge/sideLogoImg/flashTabBadge) + nav-item Ajuda active', ['github-stars-badge', 'guidesGrid', 'copyToast', 'copyToastTitle', 'copyToastText', 'sideNome', 'sideBanca', 'sideTimer', 'sideTimerLabel', 'revBadge', 'sideLogoImg', 'flashTabBadge'].every(id => ajBodyHtml.includes('id="' + id + '"'))
      && /class="nav-item active" onclick="goPage\('ajuda\.html'\)"/.test(ajBodyHtml));
    check('body.html: card GitHub com window.open EXTERNO verbatim ×2 (card + gh-btn com stopPropagation) + link do site', (ajBodyHtml.match(/window\.open\('https:\/\/github\.com\/michel-softwares\/track-concursos','_blank','noopener'\)/g) || []).length === 2
      && ajBodyHtml.includes("event.stopPropagation(); window.open('https://track-concursos.github.io','_blank','noopener')")
      && ajBodyHtml.includes('id="github-stars-badge"'));
    check('body.html: release-note-card "Notas da atualização v1.0.6" com onclick openReleaseNotes(event)', ajBodyHtml.includes('class="release-note-card"') && ajBodyHtml.includes('onclick="openReleaseNotes(event)"') && ajBodyHtml.includes('Notas da atualização v1.0.6'));
    check('body.html: contact-cards (copyEmailAddress/copyPixKey) + "Buy Me <s>a Coffee</s> Claude tokens" verbatim + toast default "Chave PIX copiada"', ajBodyHtml.includes('onclick="copyEmailAddress(event)"') && ajBodyHtml.includes('onclick="copyPixKey(event)"')
      && ajBodyHtml.includes('Buy Me <s>a Coffee</s> Claude tokens') && ajBodyHtml.includes('>Chave PIX copiada<') && ajBodyHtml.includes('michelaraujo100@gmail.com pronta para colar.'));
    check('body.html: D4 tag cloudflare email-decode VERBATIM (§4.2) + data.js removido da linha 605 (bodyCore — o header cita o atributo em comentário)', ajBodyHtml.includes('<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>') && !bodyCore.includes('src="data.js"'));
    check('body.html: footer "Vedada modificação ou comercialização sem autorização." + sidebar sem concurso mostra "—"', ajBodyHtml.includes('Vedada modificação ou comercialização sem autorização.') && ajBodyHtml.includes('id="sideNome">—<'));

    check('style.css: header R13-port + D1 offer-* / D2 tip-row / D3 tips-section VERBATIM (§4.2) + vivo .gh-btn/.gh-count/.copy-toast/.guide-card', ajStyleSrc.includes('[R13-port]')
      && ['.offer-', '.tip-row', '.tip-num', '.tip-text', '.tips-section'].every(x => styleCore.includes(x))
      && ['.gh-btn', '.gh-count', '.copy-toast', '.contact-card', '.guide-card'].every(x => styleCore.includes(x)));

    check('main.pagejs: goPage local NO TOPO (antes de copyToastTimer) delegando a __CT_NAV_GO_PAGE (precedente R10-R13)', ajMainSrc.includes('function goPage(dest) {') && ajMainSrc.indexOf('function goPage') < ajMainSrc.indexOf('let copyToastTimer'));
    // O ÚNICO location.* do script é o fallback do goPage seam (padrão
    // nav.js: window.location.href = dest quando __CT_NAV_GO_PAGE falta).
    const mainNoGoPage = mainBody.replace(/function goPage\(dest\) \{[\s\S]*?\n\}/, '');
    check('main.pagejs: SEM location fora do fallback do goPage seam e SEM guard de concurso (§4.1)', !/location\.(href|search|hash)/.test(mainNoGoPage)
      && (mainBody.match(/location\.href/g) || []).length === 1 && mainBody.includes('window.location.href = dest;')
      && !mainBody.includes('ct_concurso_ativo'));
    check('main.pagejs: script CLÁSSICO — SEM \'use strict\' no corpo + 2 IIFEs isoladas (fetchGitHubStars + initGuides) + goPage NÃO é IIFE', !mainBody.includes("'use strict'")
      && (mainBody.match(/\(async function fetchGitHubStars/g) || []).length === 1 && (mainBody.match(/\(async function initGuides/g) || []).length === 1);
    check('main.pagejs: openReleaseNotes pywebview open_external_url guard VERBATIM (§6.2) + fallback window.open EXTERNO "noopener"', mainBody.includes("typeof window.pywebview.api.open_external_url === 'function'") && mainBody.includes("window.open(url, '_blank', 'noopener');") && mainBody.includes(RELEASE_URL));
    check('main.pagejs: fetchGitHubStars SEM cache (api.github.com com t=Date.now) + badge stargazers_count', mainBody.includes('api.github.com/repos/michel-softwares/track-concursos?t=${Date.now()}') && mainBody.includes('data.stargazers_count'));
    check('main.pagejs: syncGuides — file:/// do DEV verbatim (§6.1) ANTES do raw GitHub + catch silencioso do local', mainBody.indexOf("fetch('file:///C:/Users/miche/Desktop/Site%20Track%20Concurso/track-concursos.github.io/src/data/guides.js')") > -1
      && mainBody.indexOf('file:///C:/Users/miche') < mainBody.indexOf('raw.githubusercontent.com/Track-Concursos')
      && mainBody.includes('// Falha esperada quando executado fora do ambiente de desenvolvimento local'));
    check('main.pagejs: processAndRender — limpeza import/export/icon: + new Function (§6.1 verbatim)', mainBody.includes(".replace(/import\\s+[\\s\\S]*?\\s+from\\s+['\"].*?['\"];?/g, '')") && mainBody.includes('.replace(/\\bexport\\s+/g, \'\')')
      && mainBody.includes('.replace(/icon:\\s*[a-zA-Z0-9]+,/g, \'\')') && mainBody.includes('new Function(cleanText + "\\nreturn { guideGroups, guideDetails };")()'));
    check('main.pagejs: render pula o grupo "Instalação" (§4.1) + fallbackGuides com 4 grupos + guideDetails p/ 2 slugs', mainBody.includes("if (group.title === 'Instalação') return;")
      && (mainBody.match(/title: '(Instalação|Primeiros passos|Organização de estudos|Recursos avançados)',/g) || []).length === 4
      && mainBody.includes("'requisitos-instalacao'") && mainBody.includes("'primeiro-concurso'"));
    check('main.pagejs: copy toast 2600ms + clipboard API com fallback textarea/execCommand', mainBody.includes('toast.classList.remove(\'show\'), 2600)') && mainBody.includes('navigator.clipboard.writeText') && mainBody.includes("document.execCommand('copy')"));
    check('main.pagejs: item Pronto → window.open EXTERNO do guia (788) + desc fallback "Guia explicativo sobre este recurso."', mainBody.includes("window.open('https://track-concursos.github.io/#/guias?guia=${g.slug}','_blank','noopener')") && mainBody.includes('Guia explicativo sobre este recurso.'));
    check('script1.pagejs: IIFE sidebar VERBATIM (875-926) — guard !cId return, PRÉ-EDITAL/Pós-Edital, revBadge, SEM goPage', script1Body.includes('SIDEBAR CONCURSO') && script1Body.includes("if (!cId) return;") && script1Body.includes('✦ PRÉ-EDITAL') && script1Body.includes('revBadge') && !script1Body.includes('goPage'));
    check('package.json/runner: test:r13 registrado', JSON.parse(read('package.json')).scripts['test:r13'] === 'node tests/r13-editais.test.js && node tests/r13-ajuda.test.js');
  }

  console.log('== R13-B: boot online — estrelas/guides/sidebar (S1) ==');
  {
    const t = bootAjuda({});
    await tick(250);
    const w = t.w;
    check('S1: fetch na ORDEM — api.github.com (com ?t=) → file:/// do DEV → raw GitHub', t.fetchLog.length === 3
      && t.fetchLog[0].startsWith('https://api.github.com/repos/michel-softwares/track-concursos?t=') && t.fetchLog[1] === FILE_URL && t.fetchLog[2] === RAW_URL, JSON.stringify(t.fetchLog));
    check('S1: badge "1234" (stargazers_count) + SEM warns + log "Guias sincronizados com sucesso a partir do GitHub."', txt(w, 'github-stars-badge') === '1234'
      && JSON.stringify(t.warns) === '[]' && JSON.stringify(t.logs) === JSON.stringify(['Guias sincronizados com sucesso a partir do GitHub.']), JSON.stringify(t.warns));
    check('S1: guides dinâmicos — 2 cards (Instalação PULADA + Grupo Vazio) com estrutura exata', JSON.stringify(guidesDump(w).map(g => ({ icon: g.icon, title: g.title, desc: g.desc, nItems: g.items.length })))
      === JSON.stringify([
        { icon: '🎓', title: 'Primeiros passos', desc: 'Do site oficial.', nItems: 2 },
        { icon: '💡', title: 'Grupo Vazio', desc: 'Sem guias listados.', nItems: 0 },
      ]), JSON.stringify(guidesDump(w).map(g => g.title)));
    check('S1: item Pronto = <a href=#> com onclick window.open EXTERNO do guia + desc do guideDetails; item Em breve = div inerte com titleStyle', JSON.stringify(guidesDump(w)[0].items)
      === JSON.stringify([
        { cls: 'guide-item pronto', tag: 'A', title: 'Guia Dinâmico Pronto', titleStyle: null, desc: 'Descrição vinda do site oficial.', badge: 'Pronto', badgeCls: 'guide-status-badge pronto', href: '#', onclick: "event.preventDefault(); event.stopPropagation(); window.open('https://track-concursos.github.io/#/guias?guia=dinamico-pronto','_blank','noopener')" },
        { cls: 'guide-item em-breve', tag: 'DIV', title: 'Guia Dinâmico Em breve', titleStyle: 'color: var(--text3);', desc: 'Disponível em breve nas próximas atualizações.', badge: 'Em breve', badgeCls: 'guide-status-badge em-breve', href: null, onclick: null },
      ]), JSON.stringify(guidesDump(w)[0].items));
    check('S1: card vazio → "Nenhum guia disponível." (guide-list exato)', guidesDump(w)[1].empty === '\n          <div style="font-size: 12px; color: var(--text3); padding: 10px 0;">Nenhum guia disponível.</div>\n        ');
    check('S1: toast default do HTML (show false + "Chave PIX copiada") antes de qualquer cópia', w.document.getElementById('copyToast').classList.contains('show') === false
      && txt(w, 'copyToastTitle') === 'Chave PIX copiada' && txt(w, 'copyToastText') === 'michelaraujo100@gmail.com pronta para colar.');
    check('S1: sidebar sem cId → "—" em nome/banca/timer + label "dias para a prova" + revBadge "0" display none', JSON.stringify(timerDump(w))
      === JSON.stringify({ nome: '—', banca: '—', num: '—', numColor: '', label: 'dias para a prova', boxPad: '', boxHtml: '\n      <div class="timer-num" id="sideTimer">—</div>\n      <div class="timer-label" id="sideTimerLabel">dias para a prova</div>\n    ', revBadge: { text: '0', display: 'none' } }), JSON.stringify(timerDump(w)));
    check('S1: boot SEM navegação e SEM window.open (navSpy/opens vazios)', t.navSpy.length === 0 && t.opens.length === 0, JSON.stringify([t.navSpy, t.opens]));
  }

  console.log('== R13-C: offline — fallback + warns (S2) ==');
  {
    const t = bootAjuda({ mode: 'offline' });
    await tick(250);
    const w = t.w;
    check('S2: badge mantém o default do HTML ("0" trim) — fetch das estrelas falhou', txt(w, 'github-stars-badge').trim() === '0');
    check('S2: 2 warns exatos (estrelas + sync GitHub) + SEM log de sucesso', JSON.stringify(t.warns) === JSON.stringify([
      'Erro ao carregar estrelas do GitHub: network down',
      'Erro ao sincronizar com GitHub, mantendo fallback local: network down',
    ]) && JSON.stringify(t.logs) === '[]', JSON.stringify(t.warns));
    check('S2: fallback render imediato — 3 cards (Instalação também pulada no fallback) com descrições do hardcoded', JSON.stringify(guidesDump(w).map(g => ({ icon: g.icon, title: g.title, desc: g.desc, nItems: g.items.length })))
      === JSON.stringify([
        { icon: '🎓', title: 'Primeiros passos', desc: 'Criando ou importando seu primeiro card de Concurso.', nItems: 2 },
        { icon: '📚', title: 'Organização de estudos', desc: 'Use progresso, questões e simulados para tomar decisões melhores.', nItems: 3 },
        { icon: '✨', title: 'Recursos avançados', desc: 'Espaço para guias futuros sobre ferramentas, automações e prompts com IA.', nItems: 4 },
      ]), JSON.stringify(guidesDump(w).map(g => g.title)));
    check('S2: itens do fallback — 1º Em breve (div), 2º Pronto com desc do guideDetails + onclick guia=primeiro-concurso; demais 9 Em breve', JSON.stringify(guidesDump(w)[0].items)
      === JSON.stringify([
        { cls: 'guide-item em-breve', tag: 'DIV', title: 'Cadastrando seu pré ou pós-edital', titleStyle: 'color: var(--text3);', desc: 'Disponível em breve nas próximas atualizações.', badge: 'Em breve', badgeCls: 'guide-status-badge em-breve', href: null, onclick: null },
        { cls: 'guide-item pronto', tag: 'A', title: 'Baixando e Importando um Edital Premium', titleStyle: null, desc: 'Saiba como baixar Editais Premium do site e importá-los no Track Concursos.', badge: 'Pronto', badgeCls: 'guide-status-badge pronto', href: '#', onclick: "event.preventDefault(); event.stopPropagation(); window.open('https://track-concursos.github.io/#/guias?guia=primeiro-concurso','_blank','noopener')" },
      ]), JSON.stringify(guidesDump(w)[0].items));
    check('S2: grupos 2/3 com 3+4 itens todos "Em breve" (div inerte, titleStyle var(--text3))', guidesDump(w).slice(1).every(g => g.items.length > 0 && g.items.every(i => i.cls === 'guide-item em-breve' && i.tag === 'DIV' && i.titleStyle === 'color: var(--text3);' && i.desc === 'Disponível em breve nas próximas atualizações.')));
  }

  console.log('== R13-D: cópia (fallback + API) (S3-S4) ==');
  {
    const t = bootAjuda({});
    await tick(250);
    const w = t.w;
    lex(w, "copyEmailAddress({preventDefault(){}})");
    await tick(30);
    check('S3a: e-mail → toast show + title/text exatos + execCommand 1× (fallback textarea) + timer 2600ms agendado + textarea removida + SEM window.open', w.document.getElementById('copyToast').classList.contains('show') === true
      && txt(w, 'copyToastTitle') === 'E-mail copiado' && txt(w, 'copyToastText') === 'michel.araujo.py@gmail.com pronto para colar.'
      && JSON.stringify(t.execLog) === JSON.stringify(['copy']) && lex(w, 'copyToastTimer') === 2
      && w.document.querySelectorAll('body > textarea').length === 0 && t.opens.length === 0, JSON.stringify(t.execLog));
    lex(w, "copyPixKey({preventDefault(){}})");
    await tick(30);
    check('S3b: pix → title/text exatos + execCommand 2× acumulado', txt(w, 'copyToastTitle') === 'Chave PIX copiada'
      && txt(w, 'copyToastText') === 'michelaraujo100@gmail.com pronta para colar.' && JSON.stringify(t.execLog) === JSON.stringify(['copy', 'copy']));
    const evEmail = new w.MouseEvent('click', { bubbles: true, cancelable: true });
    w.document.querySelector('.contact-card').dispatchEvent(evEmail);
    await tick(30);
    check('S3c: clique real no contact-card → preventDefault (href "#" não navega) + cópia do e-mail + execCommand 3×', evEmail.defaultPrevented === true
      && txt(w, 'copyToastTitle') === 'E-mail copiado' && JSON.stringify(t.execLog) === JSON.stringify(['copy', 'copy', 'copy']));
  }
  {
    const t = bootAjuda({});
    await tick(250);
    const w = t.w;
    const wrote = [];
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (v) => { wrote.push(v); } }, configurable: true });
    lex(w, "copyTextValue('michel.araujo.py@gmail.com', 'E-mail copiado', 'michel.araujo.py@gmail.com pronto para colar.')");
    await tick(50);
    check('S4: caminho clipboard API → writeText com o valor + toast show + SEM execCommand (fallback não dispara)', JSON.stringify(wrote) === JSON.stringify(['michel.araujo.py@gmail.com'])
      && w.document.getElementById('copyToast').classList.contains('show') === true && JSON.stringify(t.execLog) === '[]' && txt(w, 'copyToastTitle') === 'E-mail copiado', JSON.stringify(t.execLog));
  }

  console.log('== R13-E: openReleaseNotes pywebview/fallback (S5) ==');
  {
    const t = bootAjuda({});
    await tick(250);
    const w = t.w;
    const pyCalls = [];
    w.pywebview = { api: { open_external_url: async (u) => { pyCalls.push(u); } } };
    await lex(w, 'openReleaseNotes()');
    check('S5a: pywebview presente → open_external_url com a URL da release + SEM window.open (guard §6.2)', JSON.stringify(pyCalls) === JSON.stringify([RELEASE_URL]) && t.opens.length === 0, JSON.stringify([pyCalls, t.opens]));
    delete w.pywebview;
    await lex(w, 'openReleaseNotes()');
    check('S5b: sem pywebview → window.open EXTERNO (url, _blank, noopener)', JSON.stringify(t.opens) === JSON.stringify([[RELEASE_URL, '_blank', 'noopener']]), JSON.stringify(t.opens));
  }

  console.log('== R13-F: cliques inline reais (S6) ==');
  {
    const t = bootAjuda({});
    await tick(250);
    const w = t.w;
    const click = (sel) => { const el = w.document.querySelector(sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
    const expect1 = (u) => JSON.stringify(t.opens) === JSON.stringify([[u, '_blank', 'noopener']]);
    click('.dev-card-link');
    check('S6: card GitHub → window.open repo _blank noopener', expect1('https://github.com/michel-softwares/track-concursos'), JSON.stringify(t.opens));
    t.opens.length = 0;
    click('.gh-btn');
    check('S6: botão Star (stopPropagation) → UMA chamada (não duplica com o card)', expect1('https://github.com/michel-softwares/track-concursos') && t.opens.length === 1, JSON.stringify(t.opens));
    t.opens.length = 0;
    click('.dev-tagline a');
    check('S6: link do site na tagline → window.open track-concursos.github.io', expect1('https://track-concursos.github.io'), JSON.stringify(t.opens));
    t.opens.length = 0;
    click('.release-note-card');
    check('S6: release-note-card → openReleaseNotes (sem pywebview) → URL da release', expect1(RELEASE_URL), JSON.stringify(t.opens));
    t.opens.length = 0;
    click('.contact-card');
    check('S6: contact E-mail → SEM window.open + toast "E-mail copiado"', t.opens.length === 0 && txt(w, 'copyToastTitle') === 'E-mail copiado');
    click('.contact-card + .contact-card');
    check('S6: contact PIX → SEM window.open + toast "Chave PIX copiada"', txt(w, 'copyToastTitle') === 'Chave PIX copiada');
    t.navSpy.length = 0;
    const mc = [...w.document.querySelectorAll('.nav-item')].find(el => el.textContent.includes('Meus Concursos'));
    mc.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('S6: nav-item Meus Concursos → nav:concursos.html', JSON.stringify(t.navSpy) === JSON.stringify(['nav:concursos.html']), JSON.stringify(t.navSpy));
    t.navSpy.length = 0;
    const fc = [...w.document.querySelectorAll('.nav-item')].find(el => el.textContent.includes('Flashcards'));
    fc.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('S6: nav-item Flashcards → sessionStorage ct_dashboard_tab PRESERVADO + nav:dashboard.html#flashcards (hash R9)', JSON.stringify(t.navSpy) === JSON.stringify(['nav:dashboard.html#flashcards']) && w.sessionStorage.getItem('ct_dashboard_tab') === 'flashcards', JSON.stringify(t.navSpy));
    t.navSpy.length = 0;
    click('.sidebar-logo img');
    check('S6: logo da sidebar → nav:concursos.html', JSON.stringify(t.navSpy) === JSON.stringify(['nav:concursos.html']), JSON.stringify(t.navSpy));
    t.opens.length = 0;
    const pronto = w.document.querySelector('a.guide-item.pronto');
    check('S6: existe item de guia Pronto no render dinâmico', !!pronto);
    pronto.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('S6: clique no guia Pronto → window.open EXTERNO #/guias?guia=dinamico-pronto', expect1('https://track-concursos.github.io/#/guias?guia=dinamico-pronto'), JSON.stringify(t.opens));
    t.navSpy.length = 0;
    const aj = [...w.document.querySelectorAll('.nav-item')].find(el => el.textContent.trim().endsWith('Ajuda'));
    aj.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    check('S6: nav-item Ajuda (ativa) → nav:ajuda.html (navega para a própria página, como no original)', JSON.stringify(t.navSpy) === JSON.stringify(['nav:ajuda.html']), JSON.stringify(t.navSpy));
  }

  console.log('== R13-G: sidebar com concurso (S7-S10) ==');
  {
    const t = bootAjuda({ cid: { nome: 'Defensoria 2027', cargo: 'Defensor', banca: 'FGV', dataProva: plus(20) } });
    await tick(250);
    const d = timerDump(t.w);
    check('S7: pós-edital → nome/banca + dias (número) + label + boxPad "8px 10px" + cor orange (≤30) + SEM bloco Coberto (coberto 0)', d.nome === 'Defensoria 2027' && d.banca === 'FGV'
      && /^\d+$/.test(d.num || '') && d.label === 'dias para a prova' && d.boxPad === '8px 10px' && d.numColor === 'var(--orange)'
      && d.boxHtml.includes('style="color: var(--orange);"') && !d.boxHtml.includes('Pós-Edital'), JSON.stringify(d));
    check('S7: boxHtml normalizado (dígitos→#) idêntico ao dump + revBadge "0"/none + boot SEM navegação', numz(d.boxHtml) === numz('<div class="timer-num" id="sideTimer" style="color: var(--orange);">19</div><div class="timer-label" id="sideTimerLabel">dias para a prova</div>')
      && d.revBadge.text === '0' && d.revBadge.display === 'none' && t.navSpy.length === 0, numz(d.boxHtml));
  }
  {
    const t = bootAjuda({ cid: { nome: 'Defensoria 2027', banca: 'FGV', dataProva: plus(9), coberto: 3 } });
    await tick(250);
    const d = timerDump(t.w);
    check('S8: pós-edital coberto 3 → bloco "✦ Pós-Edital" + "Coberto ×3" + rocket.gif (coberto>0) + boxPad + cor orange', d.boxPad === '8px 10px' && d.numColor === 'var(--orange)'
      && d.boxHtml.includes('✦ Pós-Edital') && d.boxHtml.includes('Coberto <span style="color:var(--accent2)">×3</span>')
      && d.boxHtml.includes('src="app://plugin/assets/mascots/pre-edital-rocket.gif"') && /^\d+$/.test(d.num || ''), JSON.stringify(d.boxHtml.slice(0, 200)));
    check('S8: boxHtml normalizado idêntico ao dump (estrutura do bloco coberto)', numz(d.boxHtml) === numz('<div class="timer-num" id="sideTimer" style="color: var(--orange);">8</div><div class="timer-label" id="sideTimerLabel">dias para a prova</div><div style="margin-top:5px; border-top:1px solid var(--border); padding-top:5px; display:flex; flex-direction:column; align-items:center;"><div style="font-size:10px; font-weight:700; color:var(--accent); text-transform:uppercase; letter-spacing:0.5px">✦ Pós-Edital</div><div style="font-size:11px; font-weight:600; color:var(--text3)"><img src="app://plugin/assets/mascots/pre-edital-rocket.gif" alt="Foguete da cobertura" style="width:18px;height:18px;object-fit:contain;display:inline-block;vertical-align:-4px;"> Coberto <span style="color:var(--accent2)">×3</span></div></div>'), numz(d.boxHtml));
  }
  {
    const t = bootAjuda({ cid: { nome: 'Edital Novo', banca: 'FGV', preEdital: true, coberto: 0 } });
    await tick(250);
    const d = timerDump(t.w);
    check('S9: PRÉ-EDITAL → timer-box REESCRITO (id sideTimer some) + boxPad "12px 12px 10px" + boxHtml EXATO do dump (rocket still ×0)', d.nome === 'Edital Novo' && d.num === null && d.boxPad === '12px 12px 10px'
      && d.boxHtml === '<div style="display:flex; flex-direction:column; align-items:center; gap:6px"><div style="font-size:12px; font-weight:700; color:var(--accent2); text-transform:uppercase; letter-spacing:1.5px">✦ PRÉ-EDITAL</div><div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:16px; font-weight:600; color:var(--text3)"><img src="app://plugin/assets/mascots/pre-edital-rocket-still.png" alt="Foguete da cobertura" style="width:30px;height:30px;object-fit:contain;display:inline-block;vertical-align:-4px;vertical-align:0;"> <span style="color:var(--text)">coberto</span> <span style="color:var(--accent2); font-weight:800">×0</span></div></div>', JSON.stringify(d.boxHtml));
  }
  {
    const t = bootAjuda({ cid: { nome: 'Defensoria 2027', banca: 'FGV', dataProva: plus(20) }, preRun: (w) => { if (w.__tpcId) w.CT.agendarRevisao(w.__tpcId, plus(0)); } });
    await tick(250);
    const d = timerDump(t.w);
    check('S10: revisão de HOJE do concurso → revBadge "1" com display "" (urgentes>0); sem revisões → "0"/none (S1/S7)', d.revBadge.text === '1' && d.revBadge.display === '' && /^\d+$/.test(d.num || '') && d.numColor === 'var(--orange)', JSON.stringify(d.revBadge));
  }

  console.log('== R13-H: syncGuides pelo workspace do dev (S11) ==');
  {
    const t = bootAjuda({ mode: 'localok' });
    await tick(250);
    const w = t.w;
    check('S11: file:/// OK → render do LOCAL (para antes do GitHub: 2 fetches) + log "…a partir do workspace local."', t.fetchLog.length === 2
      && t.fetchLog[1] === FILE_URL && JSON.stringify(t.logs) === JSON.stringify(['Guias sincronizados com sucesso a partir do workspace local.']), JSON.stringify(t.fetchLog));
    check('S11: guias locais renderizados — 1 card "Do workspace local." com Guia Pronto onclick guia=local', JSON.stringify(guidesDump(w).map(g => ({ icon: g.icon, title: g.title, desc: g.desc, nItems: g.items.length })))
      === JSON.stringify([{ icon: '🎓', title: 'Primeiros passos', desc: 'Do workspace local.', nItems: 1 }])
      && guidesDump(w)[0].items[0].onclick === "event.preventDefault(); event.stopPropagation(); window.open('https://track-concursos.github.io/#/guias?guia=local','_blank','noopener')", JSON.stringify(guidesDump(w)));
  }

  console.log('');
  console.log(`== R13-ajuda: ${passed} PASS / ${failed} FAIL ==`);
  if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERRO:', e); process.exit(2); });
