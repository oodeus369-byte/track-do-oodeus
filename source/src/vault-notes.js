/**
 * Track do Oodeus — vault-notes.js [R4]
 * Seletor fuzzy de notas do vault — infraestrutura do tipo NOTA "Anotações"
 * (ADIÇÃO OODEUS, documento-mestre §3.7; não existe no original — não é port).
 * Usado pelo modal "Material de estudo" da aba de matéria: o caminho escolhido
 * vira o "link" do material; a abertura é workspace.openLinkText (interna).
 */
const { FuzzySuggestModal } = require('obsidian');

class VaultNoteModal extends FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this._onPick = typeof onPick === 'function' ? onPick : null;
    this.setPlaceholder('Escolha a nota do vault…');
  }

  getItems() {
    try {
      return this.app.vault.getMarkdownFiles().map(f => f.path);
    } catch {
      return [];
    }
  }

  getItemText(path) {
    return String(path || '');
  }

  onChooseItem(path) {
    if (this._onPick && path) this._onPick(String(path));
  }
}

module.exports = { VaultNoteModal };
