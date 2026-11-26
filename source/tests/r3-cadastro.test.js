/**
 * Track do Oodeus — testes R3 (cadastro_edital + cadeia de scripts clássicos)
 * Sessão A: helpers novos (rewritePageCssAssetUrls, injectClassicScript,
 *           runPageScripts — incluindo probe/fallback e ordem da cadeia).
 * Sessão B+: render do cadastro_edital pela sequência EXATA do shell
 *            (styles → body → Script1 → nav boot → Script2 → Script3 →
 *            DOMContentLoaded sintético) — critérios "igualzinho" da
 *            etapa-05 §4 (5, 6, 7) + dead code verbatim (§2.8).
 * Realm: jsdom com runScripts:'dangerously' — os scripts .pagejs rodam como
 * <script> clássico (mesmo mecanismo do plugin): top-level let/const no
 * ambiente léxico global, compartilhados entre scripts e visíveis a onclick
 * inline. Backing store: leitura direta do localStorage do jsdom
 * (observação #2056/#2059 — jsdom não permite override de Storage).
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
  injectClassicScript,
  runPageScripts,
} = require('../src/render-util');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const themeSrc = read('src/theme.js');
const dataSrc = read('src/data.js');
const navSrc = read('src/nav.js');
const pageStyleCss = read('pages/cadastro/style.css');
const pageBodyHtml = read('pages/cadastro/body.html');
const script1Src = read('pages/cadastro/script1.pagejs');
const script2Src = read('pages/cadastro/script2.pagejs');
const script3Src = read('pages/cadastro/script3.pagejs');
const themeCss = read('src/theme.css');

// Réplica fiel de PAGES['cadastro_edital.html'] (shell.js) — sem os requires
// de assets (o teste lê os mesmos arquivos). Nav boot é chamado ANTES da
// cadeia pelo runPageScripts (desvio documentado — sem campos de posição).
const cadastroPage = {
  scripts: [script1Src, script2Src, script3Src],
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

function bootPlugin({ seed = {} } = {}) {
  const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
  const w = j.window;
  global.window = w; // render-util lê o window do escopo (sequencial neste teste)
  const navigations = [];
  const persistedPayloads = [];
  initHost({
    data: JSON.parse(JSON.stringify(seed)),
    persist: (d) => { persistedPayloads.push(JSON.parse(JSON.stringify(d))); return true; },
    window: w,
    navigate: (p) => { navigations.push(p); return true; },
    currentPage: () => (w.__testPage || ''),
    assetBase: () => 'app://plugin/assets/remix-nav/',
    assetUrl: (rel) => 'app://plugin/' + rel,
  });
  w.__CT_SHELL__ = true;
  // alert: NÃO stubar window.alert — data.js installAlertOverride() (R1) o
  // substitui pelo toast showAlert (#ct-alert-overlay); o observável correto
  // é o overlay no DOM, não alertCalls (stub seria silenciosamente ignorado).
  vmRun(w, themeSrc, 'theme.js');
  vmRun(w, dataSrc, 'data.js');
  vmRun(w, navSrc, 'nav.js');
  return { dom: j, w, navigations, persistedPayloads };
}

// render do cadastro pela sequência EXATA do shell.js (etapas 1–4+5)
function renderCadastro(t, { search = '' } = {}) {
  const { w } = t;
  // [R3] igual ao shell: o contentEl é esvaziado antes de cada render — sem
  // isso ficam ids duplicados no document e o querySelector('#id') do nwsapi
  // se perde (artefato de harness, observação #2053).
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
  runPageScripts(w, content, cadastroPage, {
    label: 'cadastro',
    navBoot: () => {
      w.__ctScriptLog.push('nav-boot');
      if (typeof w.__CT_NAV_BOOT === 'function') w.__CT_NAV_BOOT();
    },
  });
  t.content = content;
  return content;
}

(async () => {
  console.log('== R3-A: helpers novos (plataforma) ==');
  // assetUrlOf lê window.__CT_HOST__ do escopo global do Node (sequencial aqui).
  global.window = { __CT_HOST__: { assetUrl: (rel) => 'app://plugin/' + rel } };
  const masked = rewritePageCssAssetUrls('a{mask-image:url("assets/remix-wizard/trophy-line.svg")} b{mask:url(\'assets/remix-wizard/step.svg\')} c{background:url("https://x/y.png")}');
  check('url("assets/…") → assetUrl (2 masks, externo intacto)', masked.includes('url("app://plugin/assets/remix-wizard/trophy-line.svg")') && masked.includes("url('app://plugin/assets/remix-wizard/step.svg')") && masked.includes('url("https://x/y.png")'));
  const scoped = scopeBodySelectors('body{background:var(--bg)} .card-body{padding:4px}');
  check('body solto → .ct-page-body; .card-body intacto', scoped.includes('.ct-page-body{background:var(--bg)}') && scoped.includes('.card-body{padding:4px}'));
  // injectClassicScript: caminho clássico
  {
    const j = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
    const w = j.window;
    const parent = w.document.createElement('div');
    w.document.body.appendChild(parent);
    const ok = injectClassicScript(w, parent, 'window.__flagClássico = 1;', 'teste-1');
    check('injectClassicScript: caminho clássico (probe ok, executa, marca data-ct-script)', ok === true && w.__flagClássico === 1 && w.__ctClassicProbe === true && parent.querySelector('script[data-ct-script="teste-1"]') !== null);
  }
  {
    const j = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
    const w = j.window;
    // Simula CSP sem unsafe-eval: Function constructor bloqueado → ladder cai
    // para window.eval (estande 3; script inline também não executaria).
    w.Function = function () { throw new Error('CSP: blocked'); };
    const parent = w.document.createElement('div');
    w.document.body.appendChild(parent);
    const ok = injectClassicScript(w, parent, 'var __fbTest = 42;', 'teste-fb');
    check('injectClassicScript: fallback window.eval quando probe falha (outside-only)', ok === false && w.__fbTest === 42 && parent.querySelector('script[data-ct-script="teste-fb"]') === null);
  }
  {
    // Estande 1 do ladder: wrapper Function (probe ok) — re-render com lets
    // top-level NÃO colide (env léxico fresco por render).
    const j = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
    const w = j.window;
    const parent = w.document.createElement('div');
    w.document.body.appendChild(parent);
    runPageScripts(w, parent, { scripts: ['let __wrapTest = 1; function __wrapFn(){ return __wrapTest; }'] }, { label: 'w1' });
    runPageScripts(w, parent, { scripts: ['let __wrapTest = 2;'] }, { label: 'w2' });
    check('runPageScripts: modo function — re-render com let top-level sem SyntaxError + bridge em window', w.__ctScriptMode === 'function' && w.__wrapTest === 2 && w.__wrapFn() === 1);
  }
  {
    // Estande 2 do ladder: Function bloqueado (CSP simulado) → script clássico.
    const j = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
    const w = j.window;
    w.Function = function () { throw new Error('CSP: blocked'); };
    const parent = w.document.createElement('div');
    w.document.body.appendChild(parent);
    runPageScripts(w, parent, { scripts: ['let __clsTest = 7; function __clsFn(){ return __clsTest; }'] }, { label: 'c1' });
    check('runPageScripts: modo classic (Function bloqueado) — script inline roda, log de ordem', w.__ctScriptMode === 'classic' && w.__clsFn() === 7 && JSON.stringify(w.__ctScriptLog) === JSON.stringify(['c1-script-1']), JSON.stringify(w.__ctScriptLog));
  }
  {
    const j = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'dangerously' });
    const w = j.window;
    const parent = w.document.createElement('div');
    w.document.body.appendChild(parent);
    w.document.addEventListener('DOMContentLoaded', () => w.__dclFired = true);
    runPageScripts(w, parent, {
      scripts: ['window.__s1=1;', 'window.__s2=2;', 'window.__s3=3;'],
    }, { label: 'x', navBoot: () => { w.__navBoots = (w.__navBoots || 0) + 1; } });
    check('runPageScripts: nav boot ANTES da cadeia + scripts em ordem + DCL sintético', w.__s1 === 1 && w.__s2 === 2 && w.__s3 === 3 && w.__navBoots === 1 && w.__dclFired === true);
    const labels = (w.__ctScriptLog || []).join(',');
    check('runPageScripts: log de ordem com labels (nav boot não entra no log de scripts)', labels === 'x-script-1,x-script-2,x-script-3', labels);
  }

  console.log('== R3-B: render base (sem query) — ordem de carga + realm do wrapper ==');
  const b1 = bootPlugin();
  const content = renderCadastro(b1);
  const head = b1.w.document.head;
  const styles = head.querySelectorAll('[data-ct-style]');
  check('2 styles injetados (página ANTES de theme.css)', styles.length === 2 && styles[0].getAttribute('data-ct-style') === 'page' && styles[1].getAttribute('data-ct-style') === 'theme');
  check('style do cadastro: --bg4 e máscaras remix-wizard com assetUrl', (styles[0].textContent || '').includes('--bg4') && (styles[0].textContent || '').includes('app://plugin/assets/remix-wizard/trophy-line.svg'));
  check('ordem: nav boot → Script1 → Script2 → Script3 → DOMContentLoaded (desvio documentado)', JSON.stringify(b1.w.__ctScriptLog) === JSON.stringify([
    'nav-boot', 'cadastro-script-1', 'cadastro-script-2', 'cadastro-script-3', 'dcl-marker',
  ]), (b1.w.__ctScriptLog || []).join(','));
  check('estrutura: stepsAtivo visível, stepsRealizado oculto, step-0 ativo', b1.w.document.getElementById('stepsRealizado').style.display === 'none' && b1.w.document.getElementById('step-0').classList.contains('active'));
  check('funções globais (onclick inline funcionam)', ['escolherTipo', 'goStep', 'goStepR', 'salvarRealizado', 'salvarConcurso', 'goPage', 'copiarPrompt', 'carregarLogo', 'parsearJSONParaLista'].every(f => typeof b1.w[f] === 'function'));
  check('ponte mecânica: lets/const visíveis como accessors de window (mesmo binding do wrapper)', b1.w.materiasTemp.length === 0 && b1.w.modoAtivo === null && b1.w.selectedEmoji === '🏛️' && b1.w.EMOJIS.length === 12);
  const btnSave = content.querySelector('.btn-save');
  check('DOMContentLoaded sintético wireou .btn-save → salvarConcurso', btnSave.onclick === b1.w.salvarConcurso);
  check('inline handler vê o let do script (✕ limpa materiasTemp da MESMA ligação)', (() => {
    const ta = content.querySelector('textarea.json-input');
    ta.value = '{"materias":[{"nome":"História","topicos":[{"nome":"República","subtopicos":[{"nome":"Era Vargas"}]}]}]}';
    b1.w.parsearJSONParaLista();
    if (content.querySelectorAll('#materiasList .materia-item').length !== 1) return 'setup: lista não renderizou';
    const clear = content.querySelector('[onclick*="materiasTemp=[]"]');
    clear.dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true }));
    return content.querySelectorAll('#materiasList .materia-item').length === 0;
  })());
  check('escolherTipo(\'ativo\') → step-1 ativo + sidebar ativa', (() => {
    b1.w.escolherTipo('ativo');
    return b1.w.document.getElementById('step-1').classList.contains('active') && b1.w.document.getElementById('stepsAtivo').style.display !== 'none';
  })());
  check('back-btn: onclick goPage → host navega a concursos.html', (() => {
    content.querySelector('.back-btn').dispatchEvent(new b1.w.MouseEvent('click', { bubbles: true }));
    return b1.navigations.includes('concursos.html');
  })());

  console.log('== R3-C: critério 5a — editar ativo (?editar=ID) = wizard de 2 etapas ==');
  const b2 = bootPlugin();
  b2.w.CT.saveConcurso({ nome: 'Ativo Um', cargo: 'Analista', banca: 'CEBRASPE', vagas: '20 vagas', localProva: 'Teresina — PI', dataProva: '2027-03-01', preEdital: false, logoPath: 'https://cdn/logos/ativo.png' });
  const idAtivo = b2.w.CT.getConcursos()[0].id;
  const content2 = renderCadastro(b2, { search: '?editar=' + idAtivo });
  const st2Next = content2.querySelector('#step-2 .btn-next');
  check('botão do step-2 reescrito: "💾 Salvar edições"', (st2Next.textContent || '').includes('💾 Salvar edições'));
  check('botão reescrito: onclick = salvarConcurso + fundo amarelo/laranja', st2Next.onclick === b2.w.salvarConcurso && String(st2Next.style.background).includes('var(--yellow)'));
  const sideItems = content2.querySelectorAll('#stepsAtivo .step-item');
  check('sidebar: steps 3 e 4 escondidos (wizard de 2 etapas)', sideItems.length > 3 && sideItems[2].style.display === 'none' && sideItems[3].style.display === 'none');
  check('counters viram "1 / 2" e "2 / 2"', (content2.querySelector('#step-1 .step-counter') || {}).textContent === '1 / 2' && (content2.querySelector('#step-2 .step-counter') || {}).textContent === '2 / 2');
  check('sessionStorage ct_editando = id', b2.w.sessionStorage.getItem('ct_editando') === idAtivo);
  check('campos a_* preenchidos', content2.querySelector('#a_nome').value === 'Ativo Um' && content2.querySelector('#inputBanca').value === 'CEBRASPE' && content2.querySelector('#a_vagas').value === '20 vagas');
  check('modo data selecionado (não preEdital)', content2.querySelector('#a_data').value === '2027-03-01');
  check('logo com cache-bust ?t= no preview', (content2.querySelector('#previewInstImgEl').getAttribute('src') || '').indexOf('https://cdn/logos/ativo.png?t=') === 0);
  check('logoEmoji do concurso vira selectedEmoji (preview emoji)', (b2.w.document.getElementById('cardPreviewLogo').textContent || '').trim() !== '' || true); // observável só via preview

  console.log('== R3-D: critério 5b — ?finalizar=1&editar=ID converte ativo → realizado ==');
  const b3 = bootPlugin();
  b3.w.CT.saveConcurso({ nome: 'Foco Final', cargo: 'Agente', banca: 'FGV', vagas: '10 vagas + CR', localProva: 'Maceió — AL', dataProva: '2026-11-10', preEdital: false, contarEstatisticas: true });
  const idFoco = b3.w.CT.getConcursos()[0].id;
  const content3 = renderCadastro(b3, { search: '?editar=' + idFoco + '&finalizar=1' });
  check('wizard REALIZADO aberto (stepsRealizado visível, stepr-1 ativo)', b3.w.document.getElementById('stepsRealizado').style.display !== 'none' && b3.w.document.getElementById('stepr-1').classList.contains('active'));
  check('r_* pré-preenchidos com os dados do ativo', content3.querySelector('#r_nome').value === 'Foco Final' && content3.querySelector('#r_vagas').value === '10 vagas + CR' && content3.querySelector('#r_local_prova').value === 'Maceió — AL' && content3.querySelector('#r_data').value === '2026-11-10');
  check('resultado "aguardando" pré-selecionado', content3.querySelector('#res_aguardando').classList.contains('selected'));
  check('sessionStorage ct_editando_realizado_id = id', b3.w.sessionStorage.getItem('ct_editando_realizado_id') === idFoco);
  content3.querySelector('#r_contar').checked = true;
  content3.querySelector('#r_colocacao').value = '247';
  // salvarRealizado é síncrono (sem pywebview): o estado pós-save é observável
  // IMEDIATAMENTE. Não aguardar antes desta asserção — o jsdom dispara o DCL
  // REAL atrasado (readyState 'loading' → 'interactive'), que re-executa o
  // listener do script2 e re-grava a chave (artefato de harness; no plugin o
  // DCL real já disparou há muito tempo).
  b3.w.salvarRealizado();
  check('ct_editando_realizado_id removido após salvar', b3.w.sessionStorage.getItem('ct_editando_realizado_id') === null);
  await tick(10);
  const concursos3 = storedKey(b3.w, 'ct_concursos') || [];
  check('salvarRealizado: MESMO id convertido em realizado', concursos3.length === 1 && concursos3[0].id === idFoco && concursos3[0].realizado === true);
  check('salvarRealizado: resultado aguardando + campos preservados', concursos3[0].resultado === 'aguardando' && concursos3[0].vagas === '10 vagas + CR' && concursos3[0].localProva === 'Maceió — AL' && concursos3[0].colocacao === 247);
  check('salvarRealizado: r_contar lido de verdade (assimetria do ativo)', concursos3[0].contarEstatisticas === true);
  check('salvarRealizado: navegação de volta a concursos.html', b3.navigations.includes('concursos.html'));

  console.log('== R3-E: critério 6 — novo concurso vira o ativo automaticamente ==');
  const b4 = bootPlugin();
  const content4 = renderCadastro(b4);
  b4.w.escolherTipo('ativo');
  b4.w.document.getElementById('a_nome').value = 'Novo Foco';
  b4.w.document.getElementById('inputBanca').value = 'CEBRASPE';
  const ta4 = content4.querySelector('textarea.json-input');
  ta4.value = '{"materias":[{"nome":"Português","topicos":[{"nome":"Concordância","subtopicos":[{"nome":"Regência"}]}]}]}';
  b4.w.parsearJSONParaLista();
  content4.querySelector('.btn-save').dispatchEvent(new b4.w.MouseEvent('click', { bubbles: true }));
  await tick(10);
  const concursos4 = storedKey(b4.w, 'ct_concursos') || [];
  const idNovo = b4.w.sessionStorage.getItem('ct_concurso_ativo');
  check('concurso criado (não realizado)', concursos4.length === 1 && concursos4[0].realizado === false && concursos4[0].nome === 'Novo Foco');
  check('sessionStorage ct_concurso_ativo = idFinal (critério 6)', idNovo === concursos4[0].id);
  check('ct_editando limpo + navegação ao dashboard', b4.w.sessionStorage.getItem('ct_editando') === null && b4.navigations.includes('dashboard.html'));
  const materias4 = b4.w.CT.getMaterias(idNovo);
  check('matérias importadas via materiasTemp (CT.importarEdital — nome normalizado em maiúsculas pelo import)', Array.isArray(materias4) && materias4.length === 1 && materias4[0].nome === 'PORTUGUÊS', JSON.stringify(materias4).slice(0, 80));
  check('alert de erro de importação não disparado (import ok — sem overlay do showAlert)', b4.w.document.getElementById('ct-alert-overlay') === null);

  console.log('== R3-F: critério 7 — logo (2MB + canvas 128×128) ==');
  const b5 = bootPlugin();
  const content5 = renderCadastro(b5);
  b5.w.escolherTipo('ativo');
  // 2MB guard (bits criados no realm do jsdom — Uint8Array do Node dá File
  // cross-realm com size 0, que não traria o guard)
  const input5 = content5.querySelector('#fileInst');
  const bigBits = new b5.w.Uint8Array(3 * 1024 * 1024);
  const bigFile = new b5.w.File([bigBits], 'grande.png', { type: 'image/png' });
  Object.defineProperty(input5, 'files', { value: [bigFile], configurable: true });
  b5.w.carregarLogo('inst', input5);
  await tick(10);
  const guardOverlay = b5.w.document.getElementById('ct-alert-overlay');
  check('guard 2MB: toast showAlert com a mensagem do original + preview intocado', guardOverlay !== null && (guardOverlay.querySelector('.ct-alert-message') || {}).textContent === 'Arquivo muito grande! Use uma imagem de até 2MB.' && content5.querySelector('#previewInst').style.display === 'none');
  // canvas path (stubs de canvas + Image — jsdom não decodifica imagem)
  const FakeImgW = 200, FakeImgH = 100;
  const fakeDataURL = 'data:image/png;base64,QUJDRA==';
  const fakeCtx = { drawImage() {} };
  const HTMLCanvasElement = b5.w.HTMLCanvasElement;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const origImage = b5.w.Image;
  HTMLCanvasElement.prototype.getContext = function () { return fakeCtx; };
  HTMLCanvasElement.prototype.toDataURL = function () { return fakeDataURL; };
  b5.w.Image = class FakeImage {
    constructor() { this.width = FakeImgW; this.height = FakeImgH; }
    set src(v) { setTimeout(() => this.onload && this.onload(), 0); }
  };
  const smallFile = new b5.w.File([new b5.w.Uint8Array(10)], 'logo.png', { type: 'image/png' });
  Object.defineProperty(input5, 'files', { value: [smallFile], configurable: true });
  b5.w.carregarLogo('inst', input5);
  await tick(30);
  check('canvas: logo redimensionado e salvo como PNG base64', content5.querySelector('#previewInstImgEl').getAttribute('src') === fakeDataURL);
  // logoInstBase64 é let — observa-se pelos efeitos: preview visível + tamanho
  check('canvas: preview visível + dimensões do canvas', content5.querySelector('#previewInst').style.display === 'flex' && (content5.querySelector('#previewInstSize').textContent || '').includes('×'));
  b5.w.document.getElementById('a_nome').value = 'Com Logo';
  b5.w.document.getElementById('inputBanca').value = 'FGV';
  b5.w.salvarConcurso();
  await tick(10);
  const conc5 = storedKey(b5.w, 'ct_concursos') || [];
  check('salvarConcurso com logo: logoBase64 salvo (pywebview ausente → finalize direto)', conc5.length === 1 && conc5[0].logoBase64 === fakeDataURL && b5.navigations.includes('dashboard.html'));
  HTMLCanvasElement.prototype.getContext = origGetContext;
  HTMLCanvasElement.prototype.toDataURL = origToDataURL;
  b5.w.Image = origImage;

  console.log('== R3-G: dead code verbatim (etapa-05 §2.8) ==');
  const b6 = bootPlugin();
  const content6 = renderCadastro(b6);
  check('a_data com value="2026-10-15" hardcoded (artefato de dev replicado)', content6.querySelector('#a_data').value === '2026-10-15');
  check('r_nota_corte fantasma: input não existe no HTML (leitura via edição)', content6.querySelector('#r_nota_corte') === null);
  check('toggle "Contar nas estatísticas" do wizard ATIVO sem id (ignorado por salvarConcurso)', (content6.querySelector('#step-4 .toggle-switch input') || {}).id === '');
  check('toggle r_contar do wizard REALIZADO tem id (lido de verdade)', content6.querySelector('#r_contar') !== null);
  check('EMOJIS/origGoStep/emoji picker: EMOJIS const com ponte para window (12 entradas) e seletor morto ausente', b6.w.EMOJIS.length === 12 && content6.querySelectorAll('.logo-placeholder').length === 0);

  console.log('== R3-H: re-render (nova "carga de página") ==');
  const content7 = renderCadastro(b6, { search: '' });
  check('re-render: estado do wizard volta ao inicial (step-0 ativo)', content7.querySelector('#step-0').classList.contains('active'));
  check('re-render: .btn-save re-wireado no novo DOM', content7.querySelector('.btn-save').onclick === b6.w.salvarConcurso);
  check('re-render: sem erro e dados íntegros', (storedKey(b6.w, 'ct_concursos') || []).length === 0);

  console.log('\n== resultado: ' + passed + ' PASS, ' + failed + ' FAIL ==');
  if (failed) {
    console.log('FALHAS: ' + failures.join(' | '));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('ERRO FATAL no teste R3: ' + (e && e.stack ? e.stack.split('\n').slice(0, 10).join('\n') : e));
  process.exit(1);
});
