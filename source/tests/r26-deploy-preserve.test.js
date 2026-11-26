/**
 * Track do Oodeus — testes R26 (deploy NÃO apagar data.json)
 * O deploy de R17–R25 renomeava data.json → data-v0131-backup.json e deixava
 * o vault sem dados. R26 troca rename por CÓPIA com timestamp e verifica que
 * o original permanece. Teste roda numa CÓPIA do deploy.js com SRC/DST
 * temporários — nada é escrito no vault real.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'deploy.js'), 'utf8');
  check('1: deploy usa cópia (não rename) para data.json',
    /copyFileSync\(oldData/.test(src) && !/renameSync\(oldData/.test(src));
  check('2: verificação exige data.json preservado', src.includes("'data.json preservado'"));
  check('3: backup com timestamp', src.includes('data-v0131-backup-'));

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-deploy-r26-'));
  const SRC = path.join(root, 'src');
  const DST = path.join(root, 'vault');
  fs.mkdirSync(path.join(SRC, 'assets'), { recursive: true });
  fs.mkdirSync(DST, { recursive: true });
  fs.mkdirSync(path.join(DST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(SRC, 'main.bundle.js'), 'bundle-fake');
  fs.writeFileSync(path.join(SRC, 'manifest.json'), JSON.stringify({ id: 'track-do-odeus', version: '1.0.0' }));
  for (let i = 0; i < 91; i++) fs.writeFileSync(path.join(SRC, 'assets', 'a' + i + '.txt'), 'x');
  const sentinel = JSON.stringify({ concursos: [{ nome: 'DADOS DO USUARIO' }] });
  fs.writeFileSync(path.join(DST, 'data.json'), sentinel);
  fs.writeFileSync(path.join(DST, 'main-v0131.js'), 'backup antigo');

  let deploy = src
    .replace(/const SRC = '[^']*';/, "const SRC = " + JSON.stringify(SRC) + ";")
    .replace(/const DST = '[^']*';/, "const DST = " + JSON.stringify(DST) + ";");
  const deployFile = path.join(root, 'deploy-copy.js');
  fs.writeFileSync(deployFile, deploy);

  let out = '';
  try {
    out = execFileSync(process.execPath, [deployFile, '--write'], { encoding: 'utf8' });
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
  check('4: deploy terminou OK', out.includes('DEPLOY OK'), out.slice(-200));
  check('5: data.json continua no vault', fs.existsSync(path.join(DST, 'data.json')));
  check('6: conteúdo de data.json intacto', fs.existsSync(path.join(DST, 'data.json')) && fs.readFileSync(path.join(DST, 'data.json'), 'utf8') === sentinel);
  check('7: backups criados (canonical + timestamp)', fs.existsSync(path.join(DST, 'data-v0131-backup.json')) && fs.readdirSync(DST).some(n => /^data-v0131-backup-\d{4}-\d\d-\d\d/.test(n)));
  check('8: verificação sem FAIL', !out.includes('FAIL '), out.slice(-200));

  fs.rmSync(root, { recursive: true, force: true });
  console.log('== resultado: ' + passed + ' PASS / ' + failed + ' FAIL ==');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERRO: ' + (e && e.stack || e)); process.exit(1); });
