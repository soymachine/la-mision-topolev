const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js']);
const seed = process.argv[2] || 'demo', h = +(process.argv[3] || 0);
const m = TP.Gen.generate(seed, h);
let out = '';
for (let y = 0; y < m.h; y++) { let row = ''; for (let x = 0; x < m.w; x++) row += (x===m.start.x&&y===m.start.y)?'V':TP.TD[m.t[y*m.w+x]].glyph; out += row + '\n'; }
console.log(out); console.log(JSON.stringify(m.quota), JSON.stringify(m.oreCount), m.worms.length);
