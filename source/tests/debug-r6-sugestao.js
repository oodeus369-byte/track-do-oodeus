const fs = require('fs');
const { JSDOM } = require('jsdom');
const { initHost } = require('../src/host');
const vm = require('vm');
const read = (p) => fs.readFileSync(p, 'utf8');
const j = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/app/', runScripts: 'dangerously' });
const w = j.window;
global.window = w;
initHost({ data: {}, persist: () => true, window: w, navigate: () => true, currentPage: () => '', assetBase: () => 'x/', assetUrl: (r) => 'x/' + r });
const ctx = vm.createContext(w);
vm.runInContext(read('src/data.js'), ctx, { filename: 'data.js' });
w.CT.saveConcurso({ nome: 'F', cargo: 'A', banca: 'F', dataProva: '2026-12-20' });
const cId = w.CT.getConcursos()[0].id;
w.CT.saveMateria({ concursoId: cId, nome: 'Direito Constitucional' });
const m1 = w.CT.getMaterias().filter(m => m.concursoId === cId)[0];
const t1 = w.CT.saveTopico({ concursoId: cId, materiaId: m1.id, nome: 'T1' });
const s1 = w.CT.saveSubtopico({ concursoId: cId, topicoId: t1.id, nome: 'S1' });
console.log('t1:', JSON.stringify(t1), '| s1 ret:', JSON.stringify(s1));
console.log('subtopicos persistidos:', JSON.stringify(w.CT.getSubtopicos(t1.id)));
console.log('getTopicos(m1):', JSON.stringify(w.CT.getTopicos(m1.id)));
w.sessionStorage.setItem('ct_concurso_ativo', cId);
w.localStorage.setItem('ct_cronograma_inteligente_' + cId, JSON.stringify({ cicloModo: 'sugerido' }));
vm.runInContext(read('pages/timer/timer-popup.pagejs'), ctx, { filename: 'timer.js' });
vm.runInContext(read('pages/crono/crono-cycle.pagejs'), ctx, { filename: 'crono.js' });

// probe A: replicar getNextUnstudiedTopicForSubject passo a passo (fora da IIFE)
const probeA = (() => {
  const out = {};
  const topicos = w.CT.getTopicos(m1.id) || [];
  for (const t of topicos) {
    if (t.estudado) continue;
    const subs = w.CT.getSubtopicos(t.id) || [];
    if (subs.length) {
      const s = subs.find(x => !x.estudado);
      if (s) { out.hit = 'com-sub'; out.res = { topicoId: t.id, subtopicoId: s.id }; break; }
    } else { out.hit = 'sem-sub'; out.res = { topicoId: t.id, subtopicoId: null }; break; }
  }
  return JSON.stringify(out);
})();
console.log('probe A (replicação da lógica):', probeA);

// probe A2: getCid() e getCronogramaConfig() LÓGICA, dentro do contexto vm
const probeA2 = vm.runInContext(`(function () {
  var cid = window._cCid || window.cId || sessionStorage.getItem('ct_concurso_ativo') || '';
  var raw = null;
  try { raw = localStorage.getItem('ct_cronograma_inteligente_' + cid); } catch (e) { raw = 'ERR ' + String(e); }
  return JSON.stringify({ _cCid: window._cCid, cId: window.cId, cid: cid, raw: raw });
})()`, ctx);
console.log('probe A2 (getCid/cfg lógica):', probeA2);

// probe A3: mesma lógica rodando DENTRO do contexto vm (onde a IIFE executa)
const probeA3 = vm.runInContext(`(function () {
  var out = {};
  var materiaId = ${JSON.stringify(m1.id)};
  out.topicos = JSON.stringify(window.CT.getTopicos(materiaId) || []);
  var topicos = window.CT.getTopicos(materiaId) || [];
  var topicosAll = window.CT.getTopicos() || [];
  out.totalTopicos = topicosAll.length;
  for (var i = 0; i < topicos.length; i++) {
    var t = topicos[i];
    if (t.estudado) continue;
    var subs = window.CT.getSubtopicos(t.id) || [];
    out.subsPrimeiro = JSON.stringify(subs);
    if (subs.length) {
      for (var j2 = 0; j2 < subs.length; j2++) {
        var s2 = subs[j2];
        if (!s2.estudado) { out.res = { topicoId: t.id, subtopicoId: s2.id }; return JSON.stringify(out); }
      }
    } else { out.res = { topicoId: t.id, subtopicoId: null }; return JSON.stringify(out); }
  }
  out.res = null;
  return JSON.stringify(out);
})()`, ctx);
console.log('probe A3 (dentro do vm):', probeA3);

// probe A4: spy nas chamadas window.CT.* + ordem relativa ao evento change do matSelect
const spy = [];
const eventLog = [];
['getTopicos', 'getSubtopicos'].forEach((k) => {
  const orig = w.CT[k].bind(w.CT);
  w.CT[k] = (...a) => { const r = orig(...a); eventLog.push('CT.' + k + '(' + JSON.stringify(a) + ')→' + (Array.isArray(r) ? r.length : String(r))); return r; };
});
const ms = w.document.getElementById('tpMatSelect');
ms.addEventListener('change', () => eventLog.push('EVENT:change(matSelect)'), true); // captura na fase de captura, antes do listener do timer

// probe B: openCycleTimer com try/catch — capturar qualquer throw interno
const item = { id: 'e1', nome: 'DIR. CONSTITUCIONAL', materiaId: m1.id, targetSeconds: 7200, remainingSeconds: 7200 };
let openErr = null;
try { w.CTCycle.openTimerForItem(item); } catch (e) { openErr = e && (e.stack || String(e)); }
const st = JSON.parse(w.sessionStorage.getItem('ct_timer_state') || '{}');
console.log('eventLog (ordem):', JSON.stringify(eventLog, null, 1));
console.log('openErr:', openErr);
console.log('pós-open (estado integral):', JSON.stringify({
  selectedTopic: st.selectedTopic, selectedSubtopic: st.selectedSubtopic,
  selectedMateria: st.selectedMateria, selectedTipo: st.selectedTipo,
  isRevisionCard: st.isRevisionCard, mode: st.mode, open: st.open,
  cyclePreset: st.cyclePreset,
  cfg: w.localStorage.getItem('ct_cronograma_inteligente_' + cId),
}));
process.exit(0);
