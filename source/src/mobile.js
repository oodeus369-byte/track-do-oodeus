/**
 * Track do Oodeus — mobile.js [R19]
 * Adaptação da view a celular/tablet SEM alterar o desktop (≥1025px fica
 * pixel-idêntico ao original aprovado).
 *
 * Diagnóstico (probe CDP r19, 2026-11-26): a sidebar do original é
 * `position:fixed; width:220px` e o `.main` tem `margin-left:220px`. Numa
 * viewport de 390px isso deixa o `.main` com 88px de largura — é por isso que
 * os cards ficam cortados no celular. O scroll da view é o próprio
 * `.ct-page-body` (`view-content ct-page-body`).
 *
 * Solução: até 1024px a sidebar vira drawer absoluto dentro do `.ct-page-body`
 * (fora da lateral: `transform:translateX(-115%)`), o `.main` ocupa 100% da
 * largura e um botão ☰ (holder sticky de 48px, que reserva espaço para o
 * botão não cobrir o título da página) abre/fecha o drawer com scrim. O estado
 * vive no plugin e sobrevive às re-renders; por padrão começa fechado (no
 * desktop a sidebar segue visível por CSS, com botão oculto — nada muda).
 */
const TOGGLE_ID = 'ctSidebarToggle';
const SCRIM_ID = 'ctSidebarScrim';
const HOLDER_CLASS = 'ct-sidebar-toggle-holder';
const OPEN_CLASS = 'ct-sidebar-open';

const MOBILE_CSS = `
/* R19: desktop intacto — botão e scrim não existem visualmente acima de 1024px. */
.ct-page-body { position: relative; }
.ct-sidebar-toggle-holder { display: none; }
.ct-sidebar-scrim { display: none; }

@media (max-width: 1024px) {
  .ct-page-body .sidebar {
    position: absolute !important;
    top: 0; bottom: 0; left: 0;
    width: min(86vw, 300px) !important;
    max-width: none !important;
    min-width: 0 !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 16px 0 24px !important;
    z-index: 500 !important;
    transform: translateX(-115%);
    transition: transform .22s ease;
    overflow-x: hidden;
    overflow-y: auto;
    box-shadow: 8px 0 28px rgba(0,0,0,.45);
  }
  .ct-page-body.${OPEN_CLASS} .sidebar { transform: translateX(0) !important; }

  .ct-page-body .main {
    margin-left: 0 !important;
    width: 100% !important;
    max-width: none !important;
    padding: 16px 12px 32px !important;
  }

  .ct-page-body .ct-sidebar-toggle-holder {
    display: block !important;
    position: sticky;
    top: 0;
    height: 48px;
    z-index: 600;
  }
  .ct-page-body .ct-sidebar-toggle {
    position: absolute;
    top: 6px;
    left: 6px;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg3);
    color: var(--text);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
  }
  /* Com o drawer aberto o botão vai para o canto direito (não cobre o logo
     nem sai da tela num celular estreito). */
  .ct-page-body.${OPEN_CLASS} .ct-sidebar-toggle { left: auto !important; right: 10px; }
  .ct-page-body .ct-sidebar-toggle:active { transform: scale(.94); }

  .ct-page-body .ct-sidebar-scrim {
    display: block !important;
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 450;
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease;
  }
  .ct-page-body.${OPEN_CLASS} .ct-sidebar-scrim { opacity: 1; pointer-events: auto; }

  /* O CSS do timer usa left:215px/right:auto, que deixa o FAB no meio da
     paisagem; anular o left e subir 76px resolve em QUALQUER largura estreita. */
  /* Sem !important: a posição gravada pelo arraste (inline style) deve vencer. */
  #timerFab { left: auto; bottom: 76px; right: 10px; }

  /* [R22] O painel vinha com left:228px e width:310px do original: 228+310
     = 538px, então num celular de 390px ficavam 148px cortados e ele era
     inutilizável, independentemente de onde o FAB estivesse. Centralizar e
     limitar a largura à viewport mantém o painel inteiro visível e tocável. */
  #timerPopup {
    left: 50% !important;
    right: auto !important;
    width: min(310px, calc(100vw - 24px)) !important;
    max-width: calc(100vw - 24px) !important;
    bottom: 76px !important;
    transform: translateX(-50%) !important;
  }
}

@media (max-width: 820px) {
  /* Retrato: letra um pouco menor e cards mais compactos, na MESMA ordem do PC.
     As grids de cada página já têm @media próprio — não as sobrescrevemos. */
  .ct-page-body .main { font-size: 13px; }
  .ct-page-body .main .page-title { font-size: 22px !important; letter-spacing: 0 !important; }
  .ct-page-body .main .page-subtitle,
  .ct-page-body .main .header-date { font-size: 11px !important; }
  .ct-page-body .main h2 { font-size: 16px !important; }

  /* O FAB do timer vive no document.body; a barra inferior do Obsidian mobile
     ocupa ~64px, então o botão sobe para não cobrir o conteúdo. */
}

@media (min-width: 1025px) {
  .ct-sidebar-toggle-holder, .ct-sidebar-toggle, .ct-sidebar-scrim { display: none !important; }
}
`;

function applyState(contentEl, open) {
  if (!contentEl || !contentEl.classList) return;
  contentEl.classList.toggle(OPEN_CLASS, !!open);
  const btn = contentEl.querySelector('#' + TOGGLE_ID);
  if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

/**
 * Cria (ou reutiliza, em re-renders) o botão e o scrim dentro do contentEl.
 * O estado é guardado no plugin para sobreviver à navegação entre páginas.
 */
function initSidebarToggle(contentEl, plugin) {
  if (!contentEl || typeof contentEl.querySelector !== 'function') return null;
  const doc = contentEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  let holder = contentEl.querySelector('.' + HOLDER_CLASS);
  if (!holder) {
    holder = doc.createElement('div');
    holder.className = HOLDER_CLASS;
    const btn = doc.createElement('button');
    btn.id = TOGGLE_ID;
    btn.className = 'ct-sidebar-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir ou fechar o menu');
    btn.setAttribute('aria-controls', 'ctSidebar');
    btn.textContent = '\u2630';
    holder.appendChild(btn);
    contentEl.insertBefore(holder, contentEl.firstChild);
  }
  let scrim = contentEl.querySelector('#' + SCRIM_ID);
  if (!scrim) {
    scrim = doc.createElement('div');
    scrim.id = SCRIM_ID;
    scrim.className = 'ct-sidebar-scrim';
    contentEl.appendChild(scrim);
  }

  // Estado = só a escolha manual do usuário. No desktop a sidebar já é visível
  // por CSS (botão oculto), então o padrão `false` não muda nada lá; em telas
  // estreitas ele mantém o drawer fechado até o usuário abrir. Sem listener de
  // resize: re-renders do dashboard não dessincronizam classe e posição.
  const open = !!(plugin && plugin.__ctSidebarOpen === true);
  if (plugin) plugin.__ctSidebarOpen = open;
  applyState(contentEl, open);

  const btn = contentEl.querySelector('#' + TOGGLE_ID);
  if (btn && !btn.__ctBound) {
    btn.__ctBound = true;
    btn.addEventListener('click', (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const cur = plugin && typeof plugin.__ctSidebarOpen === 'boolean' ? plugin.__ctSidebarOpen : false;
      const next = !cur;
      if (plugin) plugin.__ctSidebarOpen = next;
      applyState(contentEl, next);
    });
  }
  if (scrim && !scrim.__ctBound) {
    scrim.__ctBound = true;
    scrim.addEventListener('click', () => {
      if (plugin) plugin.__ctSidebarOpen = false;
      applyState(contentEl, false);
    });
  }
  return btn;
}

module.exports = { MOBILE_CSS, initSidebarToggle, applyState, TOGGLE_ID, SCRIM_ID, OPEN_CLASS };
