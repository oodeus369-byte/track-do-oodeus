/**
 * Track do Oodeus — host.js [R0-port]
 * Ponte de plataforma: substitui o que no original era `window.name`
 * (armazenamento virtual) e o canal `window.pywebview.api` do executável Python.
 *
 * Contrato exposto em `window.__CT_HOST__` (data.js consome estes três métodos):
 *   readVirtual()          → objeto com os valores persistidos das 11 chaves main
 *   persistVirtual(str)    → grava o payload do storage virtual (string JSON)
 *   salvarBackup(json, reason) → Promise<{ok, rotulo}> — mesmas reasons do original
 *
 * A persistência real é o data.json do plugin: `__ctVirtualStorage` guarda o
 * payload do storage virtual (string JSON, formato idêntico ao que ia para o
 * window.name) e `__ctBackups` guarda os backups de segurança.
 */
const VIRTUAL_FIELD = '__ctVirtualStorage';
const BACKUP_FIELD = '__ctBackups';

let _hostData = null;
let _hostPersist = null;
let _hostLoaded = false;
let _hostNavigate = null;
let _hostCurrentPage = null;
let _hostAssetBase = null;
let _hostAssetUrl = null;
let _hostListVaultNotes = null;
let _hostPickVaultNote = null;
let _hostOpenVaultNote = null;

function initHost({ data = null, persist = null, window: hostWindow, navigate = null, currentPage = null, assetBase = null, assetUrl = null, listVaultNotes = null, pickVaultNote = null, openVaultNote = null } = {}) {
  _hostData = data && typeof data === 'object' ? data : {};
  _hostPersist = typeof persist === 'function' ? persist : null;
  _hostNavigate = typeof navigate === 'function' ? navigate : null;
  _hostCurrentPage = typeof currentPage === 'function' ? currentPage : null;
  _hostAssetBase = typeof assetBase === 'function' ? assetBase : null;
  _hostAssetUrl = typeof assetUrl === 'function' ? assetUrl : null;
  _hostListVaultNotes = typeof listVaultNotes === 'function' ? listVaultNotes : null;
  _hostPickVaultNote = typeof pickVaultNote === 'function' ? pickVaultNote : null;
  _hostOpenVaultNote = typeof openVaultNote === 'function' ? openVaultNote : null;
  _hostLoaded = true;

  const api = {
    readVirtual() {
      try {
        const raw = _hostData && _hostData[VIRTUAL_FIELD];
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },

    persistVirtual(jsonString) {
      if (!_hostLoaded) return Promise.resolve(false);
      if (_hostData && typeof _hostData === 'object') {
        _hostData[VIRTUAL_FIELD] = String(jsonString);
      }
      if (_hostPersist) {
        try {
          return Promise.resolve(_hostPersist(_hostData)).catch(() => false);
        } catch {
          return Promise.resolve(false);
        }
      }
      return Promise.resolve(true);
    },

    async salvarBackup(json, reason = 'salvo-manual') {
      try {
        if (!_hostLoaded || !_hostPersist) return { ok: false };
        const list = Array.isArray(_hostData[BACKUP_FIELD]) ? _hostData[BACKUP_FIELD] : [];
        const rotulo = 'Backup ' + new Date().toLocaleString('pt-BR');
        list.push({ rotulo, reason, exportadoEm: new Date().toISOString(), json });
        _hostData[BACKUP_FIELD] = list;
        await _hostPersist(_hostData);
        return { ok: true, rotulo };
      } catch {
        return { ok: false };
      }
    },

    // [R1-port] Navegação entre páginas (troca de view). Retorna true quando o
    // host assumiu a navegação; false deixa o chamador usar o fallback original.
    navigate(page) {
      if (!_hostNavigate) return false;
      try {
        return _hostNavigate(page) !== false;
      } catch {
        return false;
      }
    },

    // [R1-port] Página corrente (nome do arquivo da view ativa); vazio deixa o
    // nav.js cair no fallback 'concursos.html'.
    currentPage() {
      try {
        return _hostCurrentPage ? _hostCurrentPage() : '';
      } catch {
        return '';
      }
    },

    // [R1-port] Base dos assets (ex.: remix-nav) no plugin; vazio mantém o
    // caminho relativo do original.
    assetBase() {
      try {
        return _hostAssetBase ? _hostAssetBase() : '';
      } catch {
        return '';
      }
    },

    // [R2-port] URL utilizável de um asset relativo à raiz do app original
    // (ex.: 'assets/faixas/faixapreta.png'). Vazio deixa o chamador usar o
    // caminho literal do original (comportamento de browser fora do plugin).
    assetUrl(rel) {
      try {
        return (_hostAssetUrl && _hostAssetUrl(rel)) || '';
      } catch {
        return '';
      }
    },

    // [R4-port] Notas do vault — ponte do tipo NOTA "Anotações" (adição
    // Oodeus, documento-mestre §3.7). Sem callbacks (browser puro), inertes.
    listVaultNotes() {
      try {
        return _hostListVaultNotes ? _hostListVaultNotes() : [];
      } catch {
        return [];
      }
    },

    pickVaultNote(cb) {
      try {
        if (_hostPickVaultNote) _hostPickVaultNote(cb);
      } catch { /* seletor indisponível — callback fica pendente */ }
    },

    openVaultNote(path) {
      try {
        if (_hostOpenVaultNote) _hostOpenVaultNote(path);
      } catch { /* nota inexistente etc. — silencioso como window.open falhando */ }
    },
  };

  // Anexo: alvo explícito (testes em vm passam o sandbox.window) ou o window
  // global do browser — em Node puro, sem alvo, a API fica só no retorno.
  const target = hostWindow || (typeof window !== 'undefined' ? window : null);
  if (target) {
    target.__CT_HOST__ = api;
    // [R2-port] Resolvedor global de assets. Definido junto com a ponte para
    // garantir que exista ANTES de data.js/dev_template_ia.js/páginas rodarem
    // (os literais de asset do data.js chamam window.__ctAssetUrl).
    // Sem assetUrl configurado, devolve o caminho literal do original
    // (comportamento de browser fora do plugin).
    if (typeof target.__ctAssetUrl !== 'function') {
      target.__ctAssetUrl = function __ctAssetUrl(rel) {
        const h = target.__CT_HOST__;
        if (h && typeof h.assetUrl === 'function') {
          // [R18] mesma regra de assetUrlOf: cache-buster `?v=` do original
          // não é parte do path no vault (viraria `%3F` + 404).
          const raw = String(rel == null ? '' : rel);
          const q = raw.indexOf('?');
          const u = h.assetUrl(q === -1 ? raw : raw.slice(0, q));
          if (u) return u;
        }
        return String(rel == null ? '' : rel);
      };
    }
  }
  return api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initHost, VIRTUAL_FIELD, BACKUP_FIELD };
}
