const s = require('fs').readFileSync('pages/crono/crono-cycle.pagejs', 'utf8');
for (const name of ['getCronogramaConfig', 'isVirtualMateriaId', 'getTimerState', 'resolveMateriaId', 'getNextUnstudiedTopicForSubject']) {
  const re = new RegExp('function ' + name + '\\(', 'g');
  const offs = [];
  let m;
  while ((m = re.exec(s))) offs.push(m.index);
  console.log(name + ': decls em', JSON.stringify(offs));
}
