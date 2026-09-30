// Simulación sin interfaz: un "bot" juega partidas para detectar errores y medir balance.
const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js', 'world.js']);
const N = +(process.argv[2] || 20);
const res = {}; let totalTurns = 0, maxH = [];
for (let r = 0; r < N; r++) {
  const W = TP.W;
  W.newRun('SIM' + r);
  let G = TP.G, guard = 0;
  while (!G.over && guard++ < 20000) {
    if (G.inStation) {
      if (process.env.V) console.log('h'+G.h, 'fuel', Math.round(G.p.fuel), 'hull', Math.round(G.p.hull), '₽', G.rublos, 'turn', G.turn, 'cargo', JSON.stringify(G.cargo));
      for (const o of TP.ORE_KEYS) { if (G.quota && G.quota.ore === o) W.deliver(o, G.cargo[o]); W.sell(o, G.cargo[o]); }
      W.repair(); W.refuel();
      // compra la mejor broca asequible
      for (const m of [...(G.shop||[])]) if (m.type === 'broca' && G.rublos >= m.price && (m.s.tier > TP.ST.tier || m.s.power > TP.ST.power)) { W.buy(m.id); W.equip(m.id, 'broca'); }
      W.descend(); G = TP.G; continue;
    }
    const p = G.p, st = TP.ST, s = G.map.station;
    if (p.heat > 80) { W.wait(); continue; }
    // hacia la estación, preferentemente hacia abajo
    const opts = [];
    const dx = Math.sign(s.x - p.x), dy = Math.sign(s.y - p.y);
    if (dy > 0) opts.push([0, 1]);
    if (dx) opts.push([dx, 0]);
    if (dy < 0) opts.push([0, -1]);
    opts.push([Math.random() < .5 ? 1 : -1, 0], [0, 1], [0, -1]);
    let ok = false;
    for (const [a, b] of opts) { if (W.act(a, b)) { ok = true; break; } }
    if (!ok) { if (G.dyn > 0) W.dynamite(); else W.wait(); }
  }
  const c = G.over ? G.over.cause : 'timeout';
  res[c] = (res[c] || 0) + 1; totalTurns += G.turn; maxH.push(G.h);
}
console.log(res, 'turnos medios', Math.round(totalTurns / N), 'horizontes', maxH.join(','));
