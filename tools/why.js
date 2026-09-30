const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js']);
for (let s = 0; s < 60; s++) for (const h of [9]) {
  const m = TP.Gen.generate('seed' + s, h);
  const g={w:m.w,h:m.h,t:m.t,in:(x,y)=>x>=0&&y>=0&&x<m.w&&y<m.h,get(x,y){return this.t[y*this.w+x]}};
  if (!TP.Gen.reachable(g, m.start.x, m.start.y, m.station.x, m.station.y)) {
    let out='';for (let y = 0; y < m.h; y++) { let row = ''; for (let x = 0; x < m.w; x++) {const t=m.t[y*m.w+x]; row += (x===m.start.x&&y===m.start.y)?'V':t===10?'~':TP.TD[t].glyph;} out += row + '\n'; }
    console.log('seed'+s, m.start, m.station); console.log(out); process.exit();
  }
}
