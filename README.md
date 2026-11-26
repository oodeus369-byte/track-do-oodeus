# Track do Oodeus

Plugin do Obsidian — reconstrução fiel do aplicativo **Track Concursos v1.0.6** (concursos, cadastro de edital, matérias e tópicos, revisão espaçada, Pomodoro, cronograma, flashcards, dashboard, revisões, histórico, simulados, editais premium e ajuda), adaptado a PC, tablet e celular.

- **ID do plugin:** `track-do-odeus`
- **Versão do manifest:** 1.0.0
- **Compatibilidade:** Obsidian 1.5.0+ (desktop e mobile; `isDesktopOnly: false`)

## Instalar pelo BRAT (recomendado)

1. Instale e habilite o plugin **BRAT** no Obsidian.
   > O repositório é **público**: não é necessário token do GitHub. (Se sobrar um token conectado de quando era privado, pode remover.)
2. Em BRAT, escolha **Add beta plugin** e informe o repositório:
   `oodeus369-byte/track-do-oodeus`
3. Selecione o branch `main` (ou a release mais recente, `v1.0.1`) e confirme.
4. Habilite **Track do Oodeus** em Configurações → Plugins instalados.

> **Importante:** o plugin já instalado manualmente tem o **mesmo ID**. Antes de instalar pelo BRAT no mesmo dispositivo, desative/remova a cópia antiga para não haver duplicidade. No celular, faça isso só depois de confirmar que a sincronização terminou.

## Instalação manual

Copie `manifest.json`, `main.js` e a pasta `assets/` para:

```
<vault>/.obsidian/plugins/track-do-odeus/
```

e habilite o plugin no Obsidian.

## Conteúdo do repositório

- `manifest.json`, `main.js`, `assets/` — plugin pronto para uso (o que o Obsidian carrega).
- `source/` — código-fonte completo, testes e script de build (sem `node_modules`).
- Repositório **privado**: não contém `data.json` (dados pessoais) nem backups de dados.

## Reconstruir o bundle

```bash
cd source
npm install
npm run build      # gera main.bundle.js
node deploy.js --write   # copia para o vault e valida 6 checagens
```

O `deploy.js` usa o caminho do vault configurado no projeto; ajuste se necessário.

## Sincronização

Se usar Syncthing entre PC e celular, não apague arquivos `sync-conflict` sem comparar o conteúdo. Logs de debug do tipo `nexus-hub-debug*.log` podem ser ignorados no `.stignore` para evitar conflitos.

## Nota sobre dados

O repositório NÃO contém `data.json` — ele guarda só o plugin. Seus concursos, matérias e flashcards ficam no arquivo `data.json` do vault. A partir da v1.0.1 o `deploy.js` faz **cópia** de segurança com timestamp e **nunca apaga** esse arquivo.

## Contribuições

O código está aberto: ideias, correções e melhorias são bem-vindas via **Issues** e **Pull Requests**. Antes de mexer, rode a suíte em `source/` (`node tests\*.test.js`) e regenere o bundle com `npm run build`. Os arquivos em `assets/` são de terceiros (logos Track Concursos / Michel Softwares) e não devem ser redistribuídos fora deste uso.

