// Monta pages/flashcards/flashcards.pagejs — R8 (etapa-10): flashcards.js COMPLETO
// (original 1-2376, IIFE COM 'use strict') + correções D1-D8 decididas pelo
// Oodeus (2026-11-13, política geral §1.5 do documento-mestre + etapa-10 §PARA
// O DOCUMENTO-MESTRE item 2). Sem seams de navegação (o arquivo não navega);
// pywebview (salvar_arquivo_texto, 1503) fica VERBATIM com guard (precedente).
const fs = require('fs');
const src = fs.readFileSync('C:/Users/maest/AppData/Local/Programs/Track Concursos/www/flashcards.js', 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);
console.log('original:', lines.length, 'linhas | eol:', eol === '\r\n' ? 'CRLF' : 'LF');

let body = lines.join(eol);
function replace1(label, oldStr, newStr, opts = {}) {
  if (!body.includes(oldStr)) throw new Error(label + ': não encontrado');
  body = body.replace(oldStr, newStr);
  console.log('ok:', label);
}

// ===== D1: deckIcon — função órfã (retorna '' e nunca é chamada) =====
replace1('D1 deckIcon', eol + '  function deckIcon(deck) {' + eol + "    return '';" + eol + '  }' + eol,
  eol + '  // [R8-port D1] deckIcon REMOVIDA: retornava \'\' e nunca era chamada (orig 539-541 — única' + eol + '  // ocorrência era a definição). Decisão Oodeus 2026-11-13: dead code não é reproduzido.' + eol);

// ===== D2: renderQuizAnswerOptions — select de gabarito que não existe mais =====
const d2 = [
  '  function renderQuizAnswerOptions(count, selected) {',
  '    var answer = normalizeQuizAnswer(selected);',
  '    var total = Math.max(2, count || 5);',
  '    var html = [];',
  '    for (var i = 0; i < total; i++) {',
  '      var letter = quizLetter(i);',
  "      html.push('<option value=\"' + letter + '\"' + (answer === letter ? ' selected' : '') + '>' + letter + '</option>');",
  '    }',
  "    return html.join('');",
  '  }',
].join(eol);
replace1('D2 renderQuizAnswerOptions', eol + d2 + eol,
  eol + '  // [R8-port D2] renderQuizAnswerOptions REMOVIDA: gerava <option> A-E de um select de' + eol + '  // gabarito que não existe mais (o modal usa radios flashQuizCorrect); nunca era chamada' + eol + '  // (orig 936-945). Decisão Oodeus 2026-11-13.' + eol);

// ===== D3: campo de emoji oculto (#flashDeckEmoji) — markup + CSS =====
const d3line = lines[1113];
if (!d3line || !d3line.includes("id=\"flashDeckEmoji\"")) throw new Error('D3: linha 1114 não é o input do emoji');
replace1('D3 input markup', d3line + eol, '');
replace1('D3 css display:none', 'textarea.flash-input{resize:vertical;line-height:1.5}#flashDeckEmoji{display:none}\',',
  "textarea.flash-input{resize:vertical;line-height:1.5}', // [R8-port D3] #flashDeckEmoji{display:none} removido (campo morto)");
console.log('ok: D3 (input + CSS; saveDeckModal mantém emoji:\'Books\' — vivo)');

// ===== D4: else redundante no calcStreak =====
replace1('D4 else redundante', '      if (byDate[key]) count += 1;' + eol + '      else if (i > 0) break;' + eol + '      else break;' + eol,
  '      if (byDate[key]) count += 1;' + eol + '      else break; // [R8-port D4] else redundante removido (else if (i > 0) break; else break; = mesmo efeito)' + eol);

// ===== D7: Esc fecha os modais (decisão Oodeus — o original não tinha handler) =====
replace1('D7 showModal', "    document.body.appendChild(overlay);" + eol + "    var first = overlay.querySelector('input, textarea, select, button');",
  "    document.body.appendChild(overlay);" + eol +
  "    // [R8-port D7] Esc fecha o modal (decisão Oodeus 2026-11-13: 'Esc nos modais' — o" + eol +
  "    // original só fechava por backdrop/Cancel; o resto do app usa Esc no cronograma)." + eol +
  "    document.addEventListener('keydown', handleFlashModalEscape);" + eol +
  "    var first = overlay.querySelector('input, textarea, select, button');");
replace1('D7 closeModal', "  function closeModal() {" + eol + "    var old = document.getElementById('flashModalOverlay');" + eol + "    if (old) old.remove();" + eol + '  }',
  "  function closeModal() {" + eol +
  "    document.removeEventListener('keydown', handleFlashModalEscape); // [R8-port D7]" + eol +
  "    var old = document.getElementById('flashModalOverlay');" + eol +
  "    if (old) old.remove();" + eol +
  '  }' + eol +
  '  // [R8-port D7] handler único (o showModal registra, o closeModal desregistra):' + eol +
  '  function handleFlashModalEscape(event) {' + eol +
  "    if (event.key === 'Escape') closeModal();" + eol +
  '  }');

// ===== D8: state.booted setado e nunca lido =====
replace1('D8 prop booted', '    study: null,' + eol + '    booted: false,' + eol, '    study: null,' + eol + '    // [R8-port D8] booted REMOVIDO: era setado (orig 565) e nunca lido.\n');
replace1('D8 set booted', '    state.booted = true;' + eol, '');

// ===== D6: acentos ausentes normalizados (lista completa da varredura) =====
const d6 = [
  ['Caracteres matematicos', 'Caracteres matemáticos', 2],
  ["return '1 mes';", "return '1 mês';", 1],
  ['<small>Revisao</small>', '<small>Revisão</small>', 1],
  ['Atividade dos ultimos 7 dias', 'Atividade dos últimos 7 dias', 1],
  ['<div class="flash-pie-popover-title">Ultimos 7 dias</div>', '<div class="flash-pie-popover-title">Últimos 7 dias</div>', 1],
  ["'Nao foi possivel acessar os dados do edital agora.'", "'Não foi possível acessar os dados do edital agora.'", 1],
  ['Este baralho ainda nao esta vinculado a um topico do edital. Use a sincronizacao geral dos flashcards ou abra um baralho criado a partir da estrutura do edital.',
   'Este baralho ainda não está vinculado a um tópico do edital. Use a sincronização geral dos flashcards ou abra um baralho criado a partir da estrutura do edital.', 1],
  ["Esse baralho ja esta linkado. Acesse o topico pela aba de materia.", 'Esse baralho já está linkado. Acesse o tópico pela aba de matéria.', 1],
  ["'Baralho ja linkado'", "'Baralho já linkado'", 1],
  ["targetKind === 'subtopico' ? 'subtopico' : 'topico'", "targetKind === 'subtopico' ? 'subtópico' : 'tópico'", 1],
  ['Agora voce pode acessa-lo rapidamente pela aba de materia.', 'Agora você pode acessá-lo rapidamente pela aba de matéria.', 1],
  ['Clique aqui para linkar esse baralho em seu topico correspondente do edital, assim voce acessa ele rapidamente clicando direto do topico na aba da materia',
   'Clique aqui para linkar esse baralho em seu tópico correspondente do edital, assim você acessa ele rapidamente clicando direto do tópico na aba da matéria', 1],
  ["Escolha uma materia, topico ou subtopico para importar.", 'Escolha uma matéria, tópico ou subtópico para importar.', 1],
  ['questoes quando disponiveis', 'questões quando disponíveis', 1],
  ['Aceita CSV com cabecalho', 'Aceita CSV com cabeçalho', 1],
  ["'Importacao concluida: '", "'Importação concluída: '", 1],
  ["'CSV vazio ou invalido.'", "'CSV vazio ou inválido.'", 1],
  ["'JSON invalido. Verifique o arquivo exportado.'", "'JSON inválido. Verifique o arquivo exportado.'", 1],
  ["'JSON sem questoes reconheciveis.'", "'JSON sem questões reconhecíveis.'", 1],
  ['card(s) disponiveis em', 'card(s) disponíveis em', 1],
  ['Limitar quantidade por topico/subtopico', 'Limitar quantidade por tópico/subtópico', 1],
  ['<label>Maximo por topico/subtopico</label>', '<label>Máximo por tópico/subtópico</label>', 1],
  ['<label>Selecao</label>', '<label>Seleção</label>', 1],
  ['<option value="random">Aleatorios</option>', '<option value="random">Aleatórios</option>', 1],
  ['<option value="hard">Mais dificeis</option>', '<option value="hard">Mais difíceis</option>', 1],
  ['Marque qual alternativa esta correta.', 'Marque qual alternativa está correta.', 1],
  ["+ ' esta correta.'", "+ ' está correta.'", 1],
  ["+ ' esta incorreta.'", "+ ' está incorreta.'", 1],
  ['<strong>Dificil</strong>', '<strong>Difícil</strong>', 1],
  ['<small>Dificil</small>', '<small>Difícil</small>', 1],
  ['<strong>Facil</strong>', '<strong>Fácil</strong>', 1],
  ['<small>Facil</small>', '<small>Fácil</small>', 1],
  ['Sessao concluida', 'Sessão concluída', 1],
  ["'Sincronizacao concluida: '", "'Sincronização concluída: '", 1],
  ["materia.nome || 'Materia'", "materia.nome || 'Matéria'", 1],
  ["topico.nome || 'Topico'", "topico.nome || 'Tópico'", 1],
  ["subtopico.nome || 'Subtopico'", "subtopico.nome || 'Subtópico'", 1],
  ['Organize seus flashcards por materia, topico e subtopico deste concurso.', 'Organize seus flashcards por matéria, tópico e subtópico deste concurso.', 1],
  ['Todos os estudos e revisoes registrados', 'Todos os estudos e revisões registrados', 1],
  ['Comentario da alternativa ', 'Comentário da alternativa ', 1],
  ['<label>Explicacao</label>', '<label>Explicação</label>', 1],
  ['separe por virgula', 'separe por vírgula', 1],
  ['confirmAggregateStudy()">Comecar</button>', 'confirmAggregateStudy()">Começar</button>', 1],
  ['Escolha uma alternativa para ver o comentario.', 'Escolha uma alternativa para ver o comentário.', 1],
];
d6.forEach(([from, to, expected]) => {
  const n = body.split(from).length - 1;
  if (n !== expected) throw new Error('D6: "' + from.slice(0, 50) + '" esperado ' + expected + '×, encontrado ' + n + '×');
  body = body.split(from).join(to);
});
console.log('ok: D6 acentos (' + d6.length + ' padrões)');
// ===== Cabeçalho de proveniência =====
const header = [
  '/**',
  " * Track do Oodeus — [R8-port] flashcards.js COMPLETO (IIFE COM 'use strict', como o",
  ' * original — D5 unificado; original www/flashcards.js, 122.644 B / 2.376 linhas, LF).',
  ' *',
  ' * Componente de ABA do dashboard (não é página): injeta em #flashcardsDashboardRoot e',
  ' * expõe window.FlashcardsDashboard (35 métodos) + window.showDashTab. No original o',
  ' * dashboard.html carrega este arquivo; o dashboard é a R9 — lá ele entra na cadeia de',
  ' * scripts da página. Boot verbatim (2373-2374): DOMContentLoaded ou imediato → boot()',
  ' * (installStyles + syncFromTrack + updateTabBadge + hash routing #flashcards(:deckId)).',
  ' *',
  ' * CORREÇÕES decididas pelo Oodeus (2026-11-13, política geral §1.5 + etapa-10 item 2)',
  ' * — marcadas [R8-port Dn] no código:',
  ' *   D1 deckIcon removida (órfã); D2 renderQuizAnswerOptions removida (select morto);',
  " *   D3 #flashDeckEmoji removido (input display:none + CSS; emoji:'Books' de",
  ' *      saveDeckModal é vivo e fica); D4 else redundante do calcStreak simplificado;',
  " *   D5 'use strict' mantido (o original JÁ tem — padrão não-uniforme do app);",
  ' *   D6 acentos normalizados (40+ strings — toasts, labels, fallbacks de nome);',
  ' *   D7 Esc fecha os modais (ADIÇÃO: handleFlashModalEscape registrado em showModal e',
  ' *      removido em closeModal — o original só fechava por backdrop);',
  ' *   D8 state.booted removido (setado e nunca lido).',
  ' *',
  ' * SEM seams: o arquivo não navega (location ausente); pywebview (salvar_arquivo_texto,',
  ' * 1503) fica VERBATIM com guard — no plugin cai no fallback Blob + <a download>',
  ' * (Eletron do Obsidian faz download); CT.toast/confirm/showAlert/queueAutoSave/',
  ' * _emitDataUpdated/_id/_today via ponte do host; storage ct_flashcard_* global com',
  ' * filtro por concurso (getDecks/getCards/getLog) + merge na escrita (verbatim).',
  ' */',
  '',
].join(eol);

const out = header + body;
fs.mkdirSync('pages/flashcards', { recursive: true });
fs.writeFileSync('pages/flashcards/flashcards.pagejs', out, 'utf8');
console.log('gravado pages/flashcards/flashcards.pagejs:', Buffer.byteLength(out), 'bytes,', out.split(/\r?\n/).length, 'linhas');
