// deploy.js — publica o recon no Obsidian: backup do v0.13.1 + cópia + verificação
// Uso: node deploy.js           (dry-run: mostra o que faria)
//      node deploy.js --write   (executa)
const fs = require('fs');
const path = require('path');

const SRC = 'C:\\Users\\maest\\OneDrive\\Documentos\\Projeto Padrão\\track-oodeus-recon';
const DST = 'C:\\Users\\maest\\Obsidian\\Oodeus\\.obsidian\\plugins\\track-do-odeus';
const WRITE = process.argv.includes('--write');
const log = (...a) => console.log(WRITE ? '' : '[dry-run]', ...a);

function copyDir(from, to) {
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, e.name), t = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(t, { recursive: true }); n += copyDir(f, t); }
    else { fs.copyFileSync(f, t); n++; }
  }
  return n;
}
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return n;
}

// --- pré-condições ---
const bundle = path.join(SRC, 'main.bundle.js');
const manifest = path.join(SRC, 'manifest.json');
if (!fs.existsSync(bundle)) { console.error('FALTA bundle: ' + bundle); process.exit(1); }
const mf = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (mf.id !== 'track-do-odeus') { console.error('manifest id inesperado: ' + mf.id); process.exit(1); }
if (!fs.existsSync(path.join(SRC, 'assets'))) { console.error('FALTA assets/'); process.exit(1); }
fs.mkdirSync(DST, { recursive: true });

// --- passos ---
const steps = [];
const oldMain = path.join(DST, 'main.js');
const bakMain = path.join(DST, 'main-v0131.js');
if (fs.existsSync(oldMain) && !fs.existsSync(bakMain)) steps.push(['backup main.js → main-v0131.js', () => fs.renameSync(oldMain, bakMain)]);
else if (fs.existsSync(oldMain)) steps.push(['backup main.js (main-v0131.js já existe) → main-v0131-bak.js', () => fs.renameSync(oldMain, path.join(DST, 'main-v0131-bak.js'))]);

const oldCss = path.join(DST, 'styles.css');
if (fs.existsSync(oldCss)) steps.push(['backup styles.css → styles-v0131.css (fora do auto-load)', () => fs.renameSync(oldCss, path.join(DST, 'styles-v0131.css'))]);

// [R26] NUNCA remover data.json: ele contém os dados do usuário. Cada deploy
// anterior renomeava o arquivo para data-v0131-backup.json e deixava o vault
// sem dados ("start limpo") — ao rodar R17–R25 isso apagou o dado real do
// Oodeus. Agora fazemos CÓPIA (com timestamp) e mantemos o original intacto.
const oldData = path.join(DST, 'data.json');
const hadData = fs.existsSync(oldData);
if (hadData) steps.push(['cópia de segurança de data.json (mantém o original)', () => {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  fs.copyFileSync(oldData, path.join(DST, 'data-v0131-backup-' + stamp + '.json'));
  fs.copyFileSync(oldData, path.join(DST, 'data-v0131-backup.json'));
}]);

steps.push(['copiar main.bundle.js → main.js', () => fs.copyFileSync(bundle, path.join(DST, 'main.js'))]);
steps.push(['copiar manifest.json', () => fs.copyFileSync(manifest, path.join(DST, 'manifest.json'))]);
let assetsN = 0;
steps.push(['copiar assets/ (91 arquivos)', () => { assetsN = copyDir(path.join(SRC, 'assets'), path.join(DST, 'assets')); }]);

console.log('== deploy track-do-odeus v' + mf.version + ' ==');
for (const [d] of steps) console.log('  ' + d);
if (!WRITE) { console.log('\n(dry-run; rode com --write)'); process.exit(0); }
for (const [d, fn] of steps) { fn(); console.log('OK  ' + d); }

// --- verificação ---
const dstMain = path.join(DST, 'main.js');
const ok = [];
ok.push(['main.js = bundle (' + fs.statSync(dstMain).size + ' B)', fs.statSync(dstMain).size === fs.statSync(bundle).size]);
const dm = JSON.parse(fs.readFileSync(path.join(DST, 'manifest.json'), 'utf8'));
ok.push(['manifest id=' + dm.id + ' v=' + dm.version, dm.id === 'track-do-odeus' && dm.version === mf.version]);
ok.push(['assets copiados (' + assetsN + ')', assetsN === countFiles(path.join(SRC, 'assets')) && assetsN >= 91]);
ok.push(['styles.css antigo removido do auto-load', !fs.existsSync(path.join(DST, 'styles.css'))]);
ok.push(['data.json preservado', !hadData || fs.existsSync(oldData)]);
ok.push(['backup main-v0131.js presente', fs.existsSync(bakMain)]);
console.log('\n== verificação ==');
let fail = 0;
for (const [d, v] of ok) { console.log((v ? 'PASS ' : 'FAIL ') + d); if (!v) fail++; }
console.log(fail ? '\nDEPLOY COM FALHAS: ' + fail : '\nDEPLOY OK — abra o Obsidian e ative/confera o plugin (recarregar app).');
process.exit(fail ? 1 : 0);
