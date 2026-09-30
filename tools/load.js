// Carga los scripts del juego en Node (sin DOM) para pruebas.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load(files) {
  const ctx = { window: {}, console, Math, Date, setTimeout, clearTimeout, performance };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  return ctx.TP;
};
