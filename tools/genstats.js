const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js']);
const T = TP.T; const N = +(process.argv[2]||40);
for (let h = 0; h < 10; h++) {
  const acc = {}; let fails = 0, noq = 0;
  for (let s = 0; s < N; s++) {
    const m = TP.Gen.generate('seed' + s, h);
    for (const t of m.t) acc[t] = (acc[t] || 0) + 1;
    if (!TP.Gen.reachable({w:m.w,h:m.h,t:m.t,in:(x,y)=>x>=0&&y>=0&&x<m.w&&y<m.h,get(x,y){return this.t[y*this.w+x]}}, m.start.x, m.start.y, m.station.x, m.station.y)) fails++;
    if (!m.quota && !m.final) noq++;
  }
  const tot = N * TP.CFG.MAP_W * TP.CFG.MAP_H;
  const pct = k => (100 * (acc[T[k]] || 0) / tot).toFixed(1);
  console.log('h' + h, ['EMPTY','DIRT','ROCK','GRANITE','BASALT','MAGMA','WATER','GAS','BOULDER','OBSIDIAN'].map(k => k.slice(0,4) + ':' + pct(k)).join(' '), 'unreach:' + fails, 'noquota:' + noq);
}
