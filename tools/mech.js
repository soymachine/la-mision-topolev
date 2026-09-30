// Pruebas de mecánicas concretas en escenarios construidos a mano.
const TP = require('./load')(['util.js', 'data.js', 'items.js', 'gen.js', 'world.js']);
const T = TP.T, W = TP.W;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
function blank(h) {
  W.newRun('MECH'); const G = TP.G;
  if (h) { G.h = h; }
  const m = G.map; m.t.fill(T.ROCK); m.hp.fill(0);
  for (let y = 0; y < m.h; y++) { m.t[y * m.w] = T.BEDROCK; m.t[y * m.w + m.w - 1] = T.BEDROCK; }
  G.worms = []; G.bombs = []; G.p.heat = 0; G.p.hull = 100; G.p.fuel = 200;
  W.load(G); return G;
}
const set = (x, y, t) => { const G = TP.G; G.map.t[y * G.map.w + x] = t; };
const get = (x, y) => TP.G.map.t[y * TP.G.map.w + x];

// 1. perforar tierra: se mueve
let G = blank(); G.p.x = 10; G.p.y = 10; set(10, 10, T.EMPTY); set(10, 11, T.DIRT);
W.act(0, 1); ok(G.p.y === 11 && get(10, 11) === T.EMPTY, 'perforar tierra avanza');
// 2. roca 2 golpes
set(10, 12, T.ROCK); W.act(0, 1); ok(G.p.y === 11, 'roca: primer golpe no avanza'); W.act(0, 1); ok(G.p.y === 12, 'roca: segundo golpe avanza');
// 3. basalto requiere nivel 2
set(10, 13, T.BASALT); const t0 = G.turn; W.act(0, 1); ok(G.turn === t0 && G.p.y === 12, 'basalto bloqueado con broca 1 (sin gastar turno)');
// 4. caída
G = blank(); for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) set(x, y, T.EMPTY);
G.p.x = 10; G.p.y = 5; W.load(G); W.wait(); ok(G.p.y === 14, 'cae hasta el suelo (y=' + G.p.y + ')'); ok(G.p.hull < 100, 'daño por caída: ' + G.p.hull);
// 5. canto cae sobre jugador
G = blank(); for (let y = 5; y < 12; y++) set(10, y, T.EMPTY); set(10, 4, T.BOULDER);
G.p.x = 10; G.p.y = 11; W.load(G);
for (let i = 0; i < 8; i++) W.wait();
ok(G.p.hull < 100, 'canto aplasta al jugador (casco ' + G.p.hull + ')');
// 6. empujar canto
G = blank(); for (let x = 8; x < 14; x++) set(x, 10, T.EMPTY); set(11, 10, T.BOULDER); G.p.x = 10; G.p.y = 10; W.load(G);
W.act(1, 0); ok(get(12, 10) === T.BOULDER && G.p.x === 11, 'empujar canto a la derecha');
// 7. gas + calor alto explota
G = blank(); set(10, 10, T.EMPTY); set(11, 10, T.GAS); set(10, 11, T.ROCK); G.p.x = 10; G.p.y = 10; W.load(G);
G.p.heat = 99; let exploded = false;
for (let i = 0; i < 10 && !exploded; i++) { set(10, 11, T.ROCK); G.map.hp.fill(0); W.act(0, 1); if (get(11, 10) !== T.GAS) exploded = true; G.p.y = 10; G.p.heat = 99; }
ok(exploded, 'el gas explota al perforar en caliente');
// 8. dinamita
G = blank(); for (let x = 5; x < 15; x++) set(x, 10, T.EMPTY); G.p.x = 8; G.p.y = 10; W.load(G);
W.dynamite(); W.act(1, 0); W.act(1, 0); W.act(1, 0);
ok(G.bombs.length === 0 && get(8, 9) === T.EMPTY, 'dinamita explota y rompe roca');
// 9. agua + magma = obsidiana
G = blank(); set(10, 10, T.WATER); set(10, 11, T.EMPTY); set(10, 12, T.MAGMA); G.p.x = 20; G.p.y = 20; set(20, 20, T.EMPTY); W.load(G);
for (let i = 0; i < 4; i++) W.wait();
ok(get(10, 12) === T.OBSIDIAN, 'agua solidifica el magma');
// 10. gusano despierta, persigue y muerde
G = blank(5); for (let x = 3; x < 30; x++) set(x, 10, T.EMPTY);
G.p.x = 5; G.p.y = 10; G.worms = [{ id: 'w', segs: [{ x: 15, y: 10 }, { x: 16, y: 10 }, { x: 17, y: 10 }], hp: 10, maxHp: 10, awake: false, calm: 0, cd: 0, speed: 1, tick: 0 }];
W.load(G); W.sonar();
for (let i = 0; i < 10; i++) W.wait();
ok(G.p.hull < 100, 'el gusano muerde (casco ' + G.p.hull + ')');
const wh = G.worms[0].segs[0]; for (let i = 0; i < 6 && G.worms[0].hp > 0; i++) W.act(Math.sign(G.worms[0].segs[0].x - G.p.x), 0);
ok(G.worms[0].hp <= 0, 'el gusano muere a embestidas');
// 11. estación y descenso
W.newRun('MECH2'); G = TP.G; const s = G.map.station; G.p.x = s.x; G.p.y = s.y - 1; W.act(0, 1);
ok(G.inStation, 'entrar en la estación'); W.stationEnter(); ok(G.shop && G.shop.length === 4, 'tienda con 4 módulos');
G.cargo[G.quota.ore] = G.quota.amount; W.deliver(G.quota.ore, 99); const r = W.descend();
ok(r.medal && G.h === 1, 'cuota cumplida → orden y horizonte II');
// 12. calor ≥100 daña
G.p.heat = 125; const hb = G.p.hull; W.wait(); ok(G.p.hull < hb, 'sobrecalentamiento daña el casco');
// 13. equipar
const m = TP.Items.make('aux', 3, 1, new TP.RNG(1)); G.inv.push(m); W.equip(m.id, 'aux2'); ok(G.equip.aux2 === m, 'equipar auxiliar');
const b2 = TP.Items.make('broca', 6, 2, new TP.RNG(3)); G.inv.push(b2); W.equip(b2.id, 'broca'); ok(G.equip.broca === b2 && G.inv.some(x => x.name.startsWith('Broca')), 'cambiar broca devuelve la vieja al inventario');
console.log(fails ? fails + ' FALLOS' : 'TODO OK');
