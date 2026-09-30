const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js']);
const T=TP.T;
const m = TP.Gen.generate('seed6', 9);
const W=m.w,H=m.h; const seen=new Uint8Array(W*H); const q=[m.start.x+m.start.y*W]; seen[q[0]]=1;
const ok = t => !(t === T.BEDROCK || t === T.CONCRETE || t === T.MAGMA || t === T.BASALT || t === T.OBSIDIAN);
while(q.length){const c=q.shift(),x=c%W,y=(c/W)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const n=nx+ny*W;if(seen[n]||!ok(m.t[n]))continue;seen[n]=1;q.push(n);}}
let out='';for(let y=0;y<H;y++){let r='';for(let x=0;x<W;x++){const t=m.t[y*W+x];r+=seen[y*W+x]?'+':t===10?'~':TP.TD[t].glyph;}out+=r+'\n';}console.log(out);
