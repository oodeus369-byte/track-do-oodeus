const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/maest/OneDrive/Documentos/Projeto Padrão/track-oodeus-recon';
const ASSETS = path.join(ROOT, 'assets');
const MIME = { '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.css': 'text/css' };

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ASSETS, []);
const map = {};
for (const f of files) {
  const rel = path.relative(ASSETS, f).replace(/\\/g, '/');
  const ext = path.extname(f).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  map['assets/' + rel] = 'data:' + mime + ';base64,' + fs.readFileSync(f).toString('base64');
}
const out = [
  '/**',
  ' * Assets embutidos [R28] — gerado a partir de assets/ (nao editar a mao).',
  ' * O BRAT instala apenas main.js + manifest.json; com os assets embutidos',
  ' * o plugin funciona em qualquer cofre sem copiar a pasta assets/.',
  ' */',
  'module.exports = ' + JSON.stringify(map, null, 2) + ';',
  '',
].join('\n');
const dest = path.join(ROOT, 'src', 'assets-embedded.js');
fs.writeFileSync(dest, out, 'utf8');
console.log('assets embutidos: ' + files.length);
console.log('arquivo: ' + dest + ' (' + (out.length / 1024 / 1024).toFixed(2) + ' MB)');
