/**
 * Track do Oodeus — testes R0 (fundação de dados)
 * Roda o data.js portado num sandbox Node (vm) com shims de window/document/
 * localStorage e prova a semântica do storage virtual contra o host:
 *   1. boot + acesso via CTi()
 *   2. _set/_get roteados às 11 chaves main (virtual) e resto no localStorage
 *   3. persistência no data.json (host) + round-trip em nova sessão
 *   4. migração do localStorage legado (código vivo do original, 4476–4482)
 *   5. dirty flag + chaves de skip (ct_backup_nome/ct_profile_genero)
 *   6. autoBackup via __CT_HOST__.salvarBackup → markSavedState
 *   7. limparLixo no boot (comportamento vivo)
 *   8. _clearTrackStorage limpa o virtual
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { initHost, VIRTUAL_FIELD, BACKUP_FIELD } = require('../src/host');

const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'data.js'), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL ' + name); }
}

function makeLocalStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => (Array.from(map.keys())[i] ?? null),
    get length() { return map.size; },
    _map: map,
  };
}

function bootSession({ hostData = {}, localStorageSeed = {}, persistFn = null } = {}) {
  const sandbox = {
    window: { name: '', addEventListener() {}, CTi: null, __CT_HOST__: null, setTimeout, clearTimeout, setInterval, clearInterval },
    document: { addEventListener() {}, getElementById() { return null; }, createElement() { return { style: {}, classList: { add() {}, toggle() {} }, setAttribute() {}, addEventListener() {} }; } },
    localStorage: makeLocalStorage(localStorageSeed),
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; } },
  };
  // Host ANTES do data.js rodar: o boot do núcleo lê o storage virtual
  // sincronamente via window.__CT_HOST__ (como lia do window.name no original).
  const host = initHost({
    data: JSON.parse(JSON.stringify(hostData)),
    persist: persistFn,
    window: sandbox.window,
  });
  const ctx = vm.createContext(sandbox);
  try {
    vm.runInContext(dataSrc, ctx, { filename: 'data.js' });
  } catch (e) {
    throw new Error('boot falhou: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
  }
  if (typeof sandbox.window.CTi !== 'function') {
    throw new Error('window.CTi não foi exposto pelo data.js');
  }
  return { CT: sandbox.window.CTi(), host, sandbox };
}

(async () => {
  console.log('== R0: round-trip da camada de dados ==');

  // ── Sessão 1: boot limpo, escrita, persistência ──
  let disk = {}; // simula o data.json do plugin
  let s1;
  try {
    s1 = bootSession({ hostData: {}, persistFn: (d) => { disk = d; } });
    check('boot da sessão 1 (CTi exposto)', typeof s1.CT._get === 'function');
  } catch (e) {
    console.log('  ERRO no boot: ' + e.message);
    process.exit(1);
  }
  const CT1 = s1.CT;

  CT1._set('ct_concursos', [{ id: 'a1', nome: 'Teste' }]);
  // Leitura via o MAPA RAW (o localStorage.getItem aqui é o override, que
  // devolve o valor virtual por design — checar o raw exige o mapa de trás).
  check('_set virtual: chave NÃO chega ao localStorage raw', !s1.sandbox.localStorage._map.has('ct_concursos'));
  check('_get lê de volta', (CT1._get('ct_concursos')[0] || {}).nome === 'Teste');
  const payloadAfterSet = disk[VIRTUAL_FIELD];
  check('payload persistido no data.json (host)', typeof payloadAfterSet === 'string' && JSON.parse(payloadAfterSet).ct_concursos.includes('"Teste"'));

  check('dirty após escrita', CT1.hasUnsavedChanges() === true);

  let backupRes = null;
  try { backupRes = await CT1.autoBackup({ reason: 'teste' }); } catch (e) { backupRes = { erro: e.message }; }
  check('autoBackup via __CT_HOST__ → {ok:true}', !!(backupRes && backupRes.ok));
  check('rotulo de backup presente', !!(backupRes && backupRes.rotulo));
  check('hasUnsavedChanges() false após backup (markSavedState)', CT1.hasUnsavedChanges() === false);
  check('backup gravado no data.json com reason', Array.isArray(disk[BACKUP_FIELD]) && disk[BACKUP_FIELD].length === 1 && disk[BACKUP_FIELD][0].reason === 'teste');

  // ── chaves de skip (sem dirty) ──
  CT1.markSavedState();
  CT1._set('ct_backup_nome', 'X');
  check('ct_backup_nome NÃO marca dirty (regra do original)', CT1.hasUnsavedChanges() === false);
  CT1._set('ct_profile_genero', 'feminino');
  check('ct_profile_genero NÃO marca dirty (regra do original)', CT1.hasUnsavedChanges() === false);
  CT1._set('ct_test_outra', 'v');
  check('ct_* fora do virtual e fora do skip marca dirty', CT1.hasUnsavedChanges() === true);

  const payload1 = disk[VIRTUAL_FIELD];

  // ── Sessão 2: reload do data.json → round-trip ──
  const s2 = bootSession({ hostData: { [VIRTUAL_FIELD]: payload1 } });
  check('round-trip: dado sobrevive à nova sessão', (s2.CT._get('ct_concursos')[0] || {}).nome === 'Teste');

  // ── Sessão 3: migração do localStorage legado (comportamento vivo) ──
  let disk3 = {};
  const s3 = bootSession({
    localStorageSeed: { ct_concursos: '[{"nome":"LEGACY"}]' },
    persistFn: (d) => { disk3 = d; },
  });
  check('migração: valor legado adotado pelo virtual', (s3.CT._get('ct_concursos')[0] || {}).nome === 'LEGACY');
  check('migração: chave removida do localStorage raw (via _ctOriginalRemoveItem)', !s3.sandbox.localStorage._map.has('ct_concursos'));

  // ── Sessão 4: limparLixo no boot (comportamento vivo do original) ──
  const lixoPayload = JSON.stringify({ ct_materias: JSON.stringify([{ nome: 'Teste' }, { nome: 'Real' }]) });
  const s4 = bootSession({ hostData: { [VIRTUAL_FIELD]: lixoPayload } });
  const mats = s4.CT._get('ct_materias');
  check('limparLixo: "Teste" removida no boot', mats.length === 1 && mats[0].nome === 'Real');

  // ── Sessão 5: _clearTrackStorage limpa o virtual ──
  const s5 = bootSession({ hostData: { [VIRTUAL_FIELD]: payload1 } });
  s5.CT._clearTrackStorage();
  check('_clearTrackStorage: virtual vazio', s5.CT._get('ct_concursos').length === 0);

  console.log('\n== resultado: ' + passed + ' PASS, ' + failed + ' FAIL ==');
  if (failed) {
    console.log('FALHAS: ' + failures.join(' | '));
    process.exit(1);
  }
  process.exit(0);
})();
