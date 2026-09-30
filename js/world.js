/* ==========================================================
   world.js — lógica del juego: turnos, física, IA, acciones
   Estado serializable en TP.G; efectos visuales vía TP.bus('fx')
   ========================================================== */
'use strict';
(function (TP) {
  const T = TP.T, TD = TP.TD, CFG = TP.CFG;
  const W = {};           // API pública (TP.W)
  let G = null;           // estado de la partida
  let st = null;          // estadísticas derivadas
  let occ = null;         // ocupación de gusanos (índice+1)
  let vis = null;         // visibilidad actual (brillo 0..1)
  let sonarGlow = null;   // realce del sonar (turnos restantes)
  let chain = [];         // explosiones pendientes (reacción en cadena)
  let dfield = null;      // campo de distancias al jugador (IA)

  const fx = (k, d) => TP.bus.emit('fx', Object.assign({ k }, d || {}));
  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // ---------------- utilidades de mapa ----------------
  const M = () => G.map;
  const inb = (x, y) => x >= 0 && y >= 0 && x < M().w && y < M().h;
  const idx = (x, y) => y * M().w + x;
  const tile = (x, y) => (inb(x, y) ? M().t[idx(x, y)] : T.BEDROCK);
  function setTile(x, y, v) { if (!inb(x, y)) return; const i = idx(x, y); M().t[i] = v; M().hp[i] = 0; }
  const isP = (x, y) => G.p.x === x && G.p.y === y;
  const wormAt = (x, y) => (inb(x, y) ? occ[idx(x, y)] - 1 : -1);
  const passable = t => !TD[t].solid;                 // el jugador puede estar ahí
  const opaque = t => TD[t].solid && t !== T.MAGMA;   // bloquea la visión (el magma brilla)
  W.tile = tile; W.inb = inb; W.idx = idx; W.wormAt = (x, y) => wormAt(x, y);

  function log(m, c) {
    G.log.push({ m, c: c || '', t: G.turn });
    if (G.log.length > 60) G.log.shift();
    TP.bus.emit('log');
  }
  W.log = log;

  // ---------------- creación ----------------
  W.newRun = function (seed) {
    seed = String(seed || Math.floor(Math.random() * 1e9).toString(36).toUpperCase());
    G = {
      v: CFG.VERSION, seed, h: 0, turn: 0, rublos: 40, earned: 0,
      medals: [], strikes: 0, dyn: 3,
      equip: TP.Items.starter(), inv: [],
      p: { x: 0, y: 0, face: 'down', hull: 100, fuel: 200, heat: 0, sonarCd: 0 },
      cargo: { iron: 0, copper: 0, gold: 0, uranium: 0, topolevite: 0 },
      map: null, worms: [], bombs: [], quota: null,
      stats: { drilled: 0, ore: 0, kills: 0, maxDepth: 0, explosions: 0, started: Date.now() },
      log: [], quakeT: 0, over: null, inStation: false, shop: null, stationDone: {},
      rng: TP.hash(seed + '|run')
    };
    TP.G = G;
    W.recalc();
    G.p.hull = st.hullMax; G.p.fuel = st.fuelMax;
    W.loadHorizon(0);
    log('KT-1 «Topolev» en posición. Semilla ' + seed + '.', 'hi');
    return G;
  };

  // rng de la partida (determinista y serializable)
  W.rng = function () {
    const r = new TP.RNG(G.rng);
    const v = r.next();
    G.rng = r.s;
    return v;
  };
  const rnd = () => W.rng();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const chance = p => rnd() < p;

  W.loadHorizon = function (h) {
    G.h = h;
    const m = TP.Gen.generate(G.seed, h);
    G.map = { w: m.w, h: m.h, t: m.t, hp: m.hp, seen: m.seen, start: m.start, station: m.station, final: m.final };
    G.worms = m.worms;
    G.bombs = [];
    G.quota = m.quota;
    G.p.x = m.start.x; G.p.y = m.start.y; G.p.face = 'down';
    G.inStation = false; G.shop = null;
    G.quakeT = 80 + rint(0, 60);
    chain = [];
    initTransient();
    applyGravity(true);
    updateVision();
    const name = TP.HORIZON_NAMES[h];
    log('Horizonte ' + TP.roman(h + 1) + ': ' + name + '.', 'xhi');
    if (G.quota) log('Plan: entregar ' + G.quota.amount + '× ' + TP.ORES[G.quota.ore].name + ' en la Estación.', 'mid');
    if (m.final) log('La señal viene de abajo. Muy cerca.', 'red');
    TP.bus.emit('horizon', h);
  };

  function initTransient() {
    const n = M().w * M().h;
    occ = new Int16Array(n);
    vis = new Float32Array(n);
    sonarGlow = new Uint8Array(n);
    rebuildOcc();
  }
  function rebuildOcc() {
    occ.fill(0);
    G.worms.forEach((w, i) => { if (w.hp > 0) for (const s of w.segs) occ[idx(s.x, s.y)] = i + 1; });
  }

  // cargar partida guardada
  W.load = function (g) {
    G = g; TP.G = G;
    const n = g.map.w * g.map.h;
    const toU8 = a => (a instanceof Uint8Array ? a : Uint8Array.from(a || new Array(n).fill(0)));
    g.map.t = toU8(g.map.t); g.map.hp = toU8(g.map.hp); g.map.seen = toU8(g.map.seen);
    W.recalc();
    initTransient();
    updateVision();
    return G;
  };

  W.recalc = function () { st = TP.Items.derive(G); W.st = st; TP.ST = st; return st; };

  // ---------------- consultas ----------------
  W.depthM = (y) => ((G.h * CFG.MAP_H + (y === undefined ? G.p.y : y)) * CFG.M_PER_ROW);
  W.ambient = () => Math.max(0, TP.AMBIENT[G.h] - st.ambRed);
  W.cargoUsed = () => TP.ORE_KEYS.reduce((a, k) => a + G.cargo[k], 0);
  W.vis = () => vis;
  W.sonarGlow = () => sonarGlow;
  W.hitsFor = function (t) {
    const d = TD[t];
    if (!d.drill) return Infinity;
    const cur = 0;
    return Math.ceil((d.hp - cur) / st.power);
  };
  W.cellInfo = function (x, y) {
    if (!inb(x, y)) return null;
    const i = idx(x, y);
    const seen = M().seen[i], t = M().t[i];
    const wi = occ[i] - 1;
    const bomb = G.bombs.find(b => b.x === x && b.y === y);
    return { x, y, t, seen, visible: vis[i] > 0, def: TD[t], dmg: M().hp[i], worm: wi >= 0 ? G.worms[wi] : null, bomb, player: isP(x, y) };
  };
  W.score = function () {
    const depth = Math.round(G.stats.maxDepth);
    return Math.max(0, depth + Math.round(G.earned / 2) + G.medals.length * 400 - G.strikes * 250 + (G.over && G.over.cause === 'victory' ? 5000 : 0));
  };

  // ---------------- daño y recursos ----------------
  function hurt(amount, cause, kind) {
    let a = amount * (1 - st.dr);
    if (kind === 'crush' || kind === 'fall') a *= (1 - st.shock);
    a = Math.max(1, Math.round(a));
    G.p.hull -= a;
    fx('hurt', { amt: a, x: G.p.x, y: G.p.y });
    if (G.p.hull <= 0) { G.p.hull = 0; gameOver(cause || 'hull'); }
    return a;
  }
  function useFuel(n) {
    G.p.fuel = Math.max(0, G.p.fuel - n);
  }
  function addHeat(n) { G.p.heat = TP.clamp(G.p.heat + n, 0, 130); }

  function gameOver(cause) {
    if (G.over) return;
    G.over = { cause, text: TP.TXT.death[cause] || '', turn: G.turn };
    log('— TRANSMISIÓN INTERRUMPIDA —', 'red');
    TP.bus.emit('gameover', G.over);
  }
  W.gameOver = gameOver;

  // ---------------- ruido (despierta gusanos) ----------------
  function noise(x, y, r, byPlayer) {
    if (byPlayer) r *= (1 - st.silent);
    if (r <= 0.5) return;
    for (const w of G.worms) {
      if (w.hp <= 0) continue;
      const hd = w.segs[0];
      if (TP.dist(hd.x, hd.y, x, y) <= r) {
        if (!w.awake) { w.awake = true; if (vis[idx(hd.x, hd.y)] > 0) log('¡Algo se mueve en la roca!', 'red'); fx('wake', { x: hd.x, y: hd.y }); }
        w.calm = 35;
      }
    }
  }

  // ---------------- acciones del jugador ----------------
  /* devuelve true si se consumió un turno */
  W.act = function (dx, dy) {
    if (G.over || G.inStation) return false;
    const p = G.p;
    p.face = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    const nx = p.x + dx, ny = p.y + dy;
    const t = tile(nx, ny), d = TD[t];

    // gusano → embestida
    const wi = wormAt(nx, ny);
    if (wi >= 0) {
      const w = G.worms[wi];
      const dmg = st.power * 2 + 1;
      w.hp -= dmg; w.awake = true; w.calm = 35;
      addHeat(2 * st.heatMult); useFuel(1 * st.fuelMult);
      fx('hitworm', { x: nx, y: ny, amt: dmg });
      if (w.hp <= 0) killWorm(wi, 'drill');
      else log('Embistes al gusano (' + dmg + ').', 'hi');
      return endTurn();
    }

    if (t === T.MAGMA) { log('¡Magma! El Topolev no lo resistiría.', 'red'); fx('deny', { x: nx, y: ny }); return false; }
    if (!d.drill && d.solid) { log(d.name + ': impenetrable.', 'dim'); fx('deny', { x: nx, y: ny }); return false; }

    if (d.solid) {
      // empujar canto en horizontal
      if (t === T.BOULDER && dy === 0) {
        const bx = nx + dx;
        if (tile(bx, ny) === T.EMPTY && wormAt(bx, ny) < 0 && !G.bombs.some(b => b.x === bx && b.y === ny)) {
          setTile(bx, ny, T.BOULDER); setTile(nx, ny, T.EMPTY);
          W.anims.push({ k: 'boulder', fx: nx, fy: ny, tx: bx, ty: ny, t0: performance.now() });
          useFuel(2 * st.fuelMult);
          moveTo(nx, ny);
          fx('push', { x: bx, y: ny });
          return endTurn();
        }
      }
      if (d.tier > st.tier) {
        log(d.name + ': requiere broca de nivel ' + d.tier + '.', 'red');
        fx('deny', { x: nx, y: ny });
        return false;
      }
      // golpe de broca
      const i = idx(nx, ny);
      M().hp[i] = Math.min(255, M().hp[i] + st.power);
      addHeat(d.heat * st.heatMult);
      useFuel(0.7 * st.fuelMult * st.drillFuel);
      noise(nx, ny, d.noise * (1 + G.h * 0.08), true);
      fx('drill', { x: nx, y: ny, t, dx, dy, heat: G.p.heat });
      checkGasIgnition(nx, ny);
      if (G.over) return true;
      if (M().hp[i] >= d.hp) {
        breakTile(nx, ny, t);
        G.stats.drilled++;
        moveTo(nx, ny);
      }
      return endTurn();
    }

    // movimiento a celda libre
    if (dy < 0 && t !== T.WATER && !hasGrip(nx, ny)) {
      log('Nada a lo que agarrarse para subir.', 'dim');
      fx('deny', { x: nx, y: ny });
      return false;
    }
    useFuel((dy < 0 ? 1.4 : 0.6) * st.fuelMult);
    moveTo(nx, ny);
    return endTurn();
  };

  function hasGrip(x, y) {
    const l = tile(x - 1, y), r = tile(x + 1, y);
    return TD[l].solid || TD[r].solid || wormAt(x - 1, y) >= 0 || wormAt(x + 1, y) >= 0;
  }
  function supported(x, y) {
    const b = tile(x, y + 1);
    if (TD[b].solid || wormAt(x, y + 1) >= 0) return true;
    if (b === T.STATION || b === T.RELIC) return true;
    return hasGrip(x, y);
  }

  function moveTo(x, y) {
    const p = G.p;
    p.x = x; p.y = y;
    pickup(x, y);
    fx('step', { x, y });
  }

  function pickup(x, y) {
    const t = tile(x, y);
    if (t === T.BARREL) {
      const amt = 40 + G.h * 6;
      const got = Math.min(amt, st.fuelMax - G.p.fuel);
      G.p.fuel += got;
      setTile(x, y, T.EMPTY);
      log('Bidón: +' + Math.round(got) + ' de combustible.', 'gold');
      fx('pickup', { x, y, glyph: 'Б', color: '#ffb347', txt: '+' + Math.round(got) + ' COMB.', target: 'fuel' });
    } else if (t === T.CRATE) {
      setTile(x, y, T.EMPTY);
      openCrate(x, y);
    } else if (t === T.STATION) {
      G.inStation = true;
      log('Acoplado a la Estación Relé.', 'xhi');
      TP.bus.emit('station');
    } else if (t === T.RELIC) {
      G.stats.maxDepth = CFG.FINAL_DEPTH;
      G.over = { cause: 'victory', text: '', turn: G.turn };
      TP.bus.emit('victory');
    }
  }

  function openCrate(x, y) {
    const r = rnd();
    if (r < 0.46) {
      const m = TP.Items.random(G.h, new TP.RNG(G.rng + G.turn * 7 + x), 0.05);
      rnd();
      if (G.inv.length < 6) {
        G.inv.push(m);
        log('Caja: ' + TP.Items.fullName(m) + '.', TP.RARITY[m.rarity].cls);
        fx('pickup', { x, y, glyph: TP.MOD_TYPES[m.type].glyph, color: '#ffd59a', txt: 'MÓDULO', target: 'mods' });
      } else {
        const v = Math.round(m.price * 0.3);
        G.rublos += v; G.earned += v;
        log('Caja: módulo sin espacio, desguazado por ' + v + '₽.', 'dim');
      }
    } else if (r < 0.66) {
      G.dyn += 2;
      log('Caja: 2 cartuchos de dinamita.', 'red');
      fx('pickup', { x, y, glyph: '!', color: '#ff3b30', txt: '+2 DINAMITA', target: 'dyn' });
    } else if (r < 0.86) {
      const a = Math.min(35, st.hullMax - G.p.hull);
      G.p.hull += a;
      log('Caja: kit de reparación (+' + a + ' casco).', 'green');
      fx('pickup', { x, y, glyph: '+', color: '#8cff3c', txt: '+' + a + ' CASCO', target: 'hull' });
    } else {
      const v = rint(30, 70) + G.h * 10;
      G.rublos += v; G.earned += v;
      log('Caja: sobre con ' + v + '₽ (y una nota: "no escuche el canal 7").', 'gold');
      fx('pickup', { x, y, glyph: '₽', color: '#ffd23f', txt: '+' + v + '₽', target: 'rub' });
    }
  }

  function breakTile(x, y, t) {
    const d = TD[t];
    setTile(x, y, T.EMPTY);
    fx('break', { x, y, t });
    if (d.ore) {
      const o = d.ore;
      let n = 1;
      if (st.magnet && chance(st.magnet)) n = 2;
      let got = 0;
      for (let k = 0; k < n; k++) {
        if (W.cargoUsed() < st.cargo) { G.cargo[o]++; got++; G.stats.ore++; }
      }
      if (got) {
        fx('ore', { x, y, ore: o, n: got });
        if (got > 1) log('+' + got + ' ' + TP.ORES[o].name + ' (electroimán).', TP.ORES[o].cls);
      } else {
        log('Bodega llena: ' + TP.ORES[o].name + ' perdido.', 'red');
        fx('lost', { x, y, ore: o });
      }
    }
  }

  // gas: si se perfora cerca con calor alto, prende
  function checkGasIgnition(x, y) {
    if (G.p.heat < st.gasTh) return;
    for (const [dx, dy] of DIR8) {
      if (tile(x + dx, y + dy) === T.GAS) {
        const p = TP.clamp((G.p.heat - st.gasTh + 10) / 40, 0.15, 0.95);
        if (chance(p)) {
          log('¡CHISPA EN EL GRISÚ!', 'red');
          explode(x + dx, y + dy, 1, 'gas');
          return;
        }
      }
    }
  }

  W.wait = function () {
    if (G.over || G.inStation) return false;
    G._waited = true;
    useFuel(0.25);
    return endTurn();
  };

  W.sonar = function () {
    if (G.over || G.inStation) return false;
    if (G.p.sonarCd > 0) { log('Sonar recargando (' + G.p.sonarCd + ').', 'dim'); return false; }
    if (G.p.fuel < st.sonarCost) { log('Combustible insuficiente para el sonar.', 'red'); return false; }
    useFuel(st.sonarCost);
    G.p.sonarCd = 6;
    const R = st.sonarR;
    const { x, y } = G.p;
    let found = 0;
    for (let yy = y - R; yy <= y + R; yy++) for (let xx = x - R; xx <= x + R; xx++) {
      if (!inb(xx, yy)) continue;
      const d = TP.dist(x, y, xx, yy);
      if (d > R) continue;
      const i = idx(xx, yy);
      if (!M().seen[i] && TD[M().t[i]].ore) found++;
      M().seen[i] = 1;
      sonarGlow[i] = Math.max(sonarGlow[i], 1 + Math.round(d / 2));
    }
    fx('sonar', { x, y, r: R });
    noise(x, y, R + 4, false);
    log('Sonar: radio ' + R + (found ? ', ' + found + ' vetas nuevas.' : '.'), 'cyan');
    return endTurn();
  };

  W.dynamite = function () {
    if (G.over || G.inStation) return false;
    if (G.dyn <= 0) { log('No queda dinamita.', 'red'); return false; }
    if (G.bombs.some(b => b.x === G.p.x && b.y === G.p.y)) return false;
    G.dyn--;
    G.bombs.push({ x: G.p.x, y: G.p.y, t: 3, r: st.dynR });
    log('Dinamita colocada. ¡Aléjate! (3 turnos)', 'red');
    fx('bomb', { x: G.p.x, y: G.p.y });
    return endTurn();
  };

  // ---------------- explosiones ----------------
  function explode(x, y, r, src) {
    G.stats.explosions++;
    fx('explode', { x, y, r, src });
    const rr = r + 0.75;
    const hitW = new Set();
    for (let yy = y - r - 1; yy <= y + r + 1; yy++) for (let xx = x - r - 1; xx <= x + r + 1; xx++) {
      if (!inb(xx, yy)) continue;
      const d = TP.dist(x, y, xx, yy);
      if (d > rr) continue;
      const t = tile(xx, yy);
      const wi = wormAt(xx, yy);
      if (wi >= 0) hitW.add(wi);
      if (t === T.BEDROCK || t === T.CONCRETE || t === T.STATION || t === T.RELIC || t === T.MAGMA) continue;
      if (t === T.GAS) { setTile(xx, yy, T.EMPTY); if (!(xx === x && yy === y)) chain.push({ x: xx, y: yy, r: 1, src: 'gas' }); continue; }
      if (t === T.BARREL) { setTile(xx, yy, T.EMPTY); chain.push({ x: xx, y: yy, r: 1, src: 'barrel' }); continue; }
      if (TD[t].ore) { if (chance(0.5)) { setTile(xx, yy, T.EMPTY); fx('break', { x: xx, y: yy, t }); } continue; }
      if (t !== T.EMPTY) { setTile(xx, yy, T.EMPTY); fx('break', { x: xx, y: yy, t, quiet: true }); }
    }
    for (const wi of hitW) {
      const w = G.worms[wi];
      if (w.hp <= 0) continue;
      w.hp -= 14; w.awake = true; w.calm = 35;
      if (w.hp <= 0) killWorm(wi, 'blast');
    }
    const pd = TP.dist(x, y, G.p.x, G.p.y);
    if (pd <= rr) { log('¡La explosión alcanza al Topolev!', 'red'); hurt(28, 'blast'); }
    else if (pd <= rr + 1) hurt(9, 'blast');
    if (pd <= rr + 3) addHeat(12);
    noise(x, y, 14 + r * 4, false);
    rebuildOcc();
  }

  function killWorm(wi, how) {
    const w = G.worms[wi];
    w.hp = 0;
    G.stats.kills++;
    const v = 25 + G.h * 8;
    G.rublos += v; G.earned += v;
    fx('wormdie', { segs: w.segs.map(s => ({ x: s.x, y: s.y })) });
    log('Olgói-Jorjói abatido. El Instituto de Biología paga ' + v + '₽.', 'gold');
    rebuildOcc();
  }

  // ---------------- fin de turno: simulación del mundo ----------------
  function endTurn() {
    if (G.over) return true;
    G.turn++;
    const waited = !!G._waited; G._waited = false;
    const p = G.p;
    if (p.sonarCd > 0) p.sonarCd--;
    for (let i = 0; i < sonarGlow.length; i++) if (sonarGlow[i]) sonarGlow[i]--;

    // 1. reacciones en cadena pendientes
    const pend = chain; chain = [];
    for (const c of pend) { if (G.over) break; explode(c.x, c.y, c.r, c.src); }

    // 2. bombas
    for (const b of G.bombs) b.t--;
    const boom = G.bombs.filter(b => b.t <= 0);
    G.bombs = G.bombs.filter(b => b.t > 0);
    for (const b of boom) { if (G.over) break; explode(b.x, b.y, b.r, 'dyn'); }

    // 3. física
    physicsBoulders();
    physicsWater();

    // 4. gusanos
    wormsAct();

    // 5. gravedad del jugador
    applyGravity(false);

    // 6. calor
    heatTick(waited);

    // 7. módulos especiales
    if (st.repairEvery && G.turn % st.repairEvery === 0 && p.hull < st.hullMax) p.hull = Math.min(st.hullMax, p.hull + 1);

    // 8. temblores
    if (G.h >= 3 && !M().final) {
      G.quakeT--;
      if (G.quakeT <= 0) { quake(); G.quakeT = 70 + rint(0, 70) - G.h * 3; }
    }

    // 9. fin
    if (p.fuel <= 0 && !G.over) { log('¡Depósito vacío!', 'red'); gameOver('fuel'); }
    const dm = W.depthM();
    if (dm > G.stats.maxDepth) G.stats.maxDepth = dm;
    updateVision();
    TP.bus.emit('turn');
    return true;
  }
  W.endTurn = endTurn;

  function heatTick(waited) {
    const p = G.p, amb = W.ambient();
    if (p.heat > amb) p.heat = Math.max(amb, p.heat - st.cooling * (waited ? 2.5 : 1));
    else p.heat = Math.min(amb, p.heat + 1.5);
    if (tile(p.x, p.y) === T.WATER) { p.heat = Math.max(0, p.heat - 7); if (G.turn % 3 === 0) fx('bubbles', { x: p.x, y: p.y }); }
    let mag = 0;
    for (const [dx, dy] of DIR8) if (tile(p.x + dx, p.y + dy) === T.MAGMA) mag++;
    if (mag) addHeat(mag * 3 * (1 - st.asbest));
    const u = G.cargo.uranium;
    if (u) addHeat(u * 0.35 * (st.lead >= 2 ? 0 : st.lead === 1 ? 0.5 : 1));
    if (st.thermo && p.heat > 45) {
      const c = Math.min(st.thermo, p.heat - 45);
      p.heat -= c; p.fuel = Math.min(st.fuelMax, p.fuel + c * 0.6);
    }
    if (p.heat >= 100) {
      const dmg = 3 + Math.floor((p.heat - 100) / 5);
      G.p.hull -= dmg;
      fx('hurt', { amt: dmg, x: p.x, y: p.y, heat: true });
      if (G.turn % 2 === 0) log('¡SOBRECALENTAMIENTO! −' + dmg + ' casco.', 'red');
      if (G.p.hull <= 0) { G.p.hull = 0; gameOver('heat'); }
    }
  }

  function applyGravity(silent) {
    const p = G.p;
    let d = 0, water = false;
    while (!supported(p.x, p.y) && d < 80) {
      const b = tile(p.x, p.y + 1);
      if (TD[b].solid) break;
      p.y++; d++;
      if (tile(p.x, p.y) === T.WATER) water = true;
      pickup(p.x, p.y);
      if (G.over || G.inStation) break;
    }
    if (d > 0 && !silent) {
      fx('fall', { x: p.x, y: p.y, d });
      if (d >= 4 && !water) {
        const dmg = (d - 3) * 4;
        log('Caída de ' + d + ' filas.', 'red');
        hurt(dmg, 'hull', 'fall');
      }
      // aplasta a un gusano
      const wi = wormAt(p.x, p.y + 1);
      if (wi >= 0 && d >= 2) { const w = G.worms[wi]; w.hp -= 6; if (w.hp <= 0) killWorm(wi, 'fall'); }
    }
  }

  // --- cantos rodados ---
  W.anims = [];
  function physicsBoulders() {
    const m = M(), w = m.w, h = m.h;
    if (!m.fall) m.fall = new Uint8Array(w * h);
    const moved = new Uint8Array(w * h);
    const now = performance.now();
    for (let y = h - 2; y >= 1; y--) {
      const dir = (G.turn & 1) ? 1 : -1;
      for (let k = 1; k < w - 1; k++) {
        const x = dir > 0 ? k : w - 1 - k;
        const i = y * w + x;
        if (m.t[i] !== T.BOULDER || moved[i]) continue;
        const bi = i + w, bt = m.t[bi];
        const free = t => t === T.EMPTY || t === T.WATER || t === T.GAS;
        const bomb = (xx, yy) => G.bombs.some(b => b.x === xx && b.y === yy);
        if (isP(x, y + 1)) {
          if (m.fall[i]) {
            m.fall[i] = 0;
            log('¡Un canto rodado golpea el Topolev!', 'red');
            fx('crush', { x, y: y + 1 });
            hurt(22 + G.h * 2, 'boulder', 'crush');
            if (G.over) return;
          }
          continue;
        }
        const wi = occ[bi] - 1;
        if (wi >= 0) {
          if (m.fall[i]) { const wm = G.worms[wi]; wm.hp -= 8; m.fall[i] = 0; fx('crush', { x, y: y + 1 }); if (wm.hp <= 0) killWorm(wi, 'boulder'); }
          continue;
        }
        if (free(bt) && !bomb(x, y + 1)) {
          m.t[bi] = T.BOULDER; m.hp[bi] = 0; m.t[i] = bt; m.hp[i] = 0;
          m.fall[bi] = 1; m.fall[i] = 0; moved[bi] = 1;
          W.anims.push({ k: 'boulder', fx: x, fy: y, tx: x, ty: y + 1, t0: now });
          continue;
        }
        if (bt === T.BOULDER) {
          const s = chance(0.5) ? 1 : -1;
          let rolled = false;
          for (const dx of [s, -s]) {
            const sx = x + dx;
            if (m.t[y * w + sx] === T.EMPTY && m.t[(y + 1) * w + sx] === T.EMPTY && !isP(sx, y) && !isP(sx, y + 1) && occ[y * w + sx] === 0 && occ[(y + 1) * w + sx] === 0) {
              const j = y * w + sx;
              m.t[j] = T.BOULDER; m.hp[j] = 0; m.t[i] = T.EMPTY; m.hp[i] = 0;
              m.fall[j] = 1; m.fall[i] = 0; moved[j] = 1;
              W.anims.push({ k: 'boulder', fx: x, fy: y, tx: sx, ty: y, t0: now });
              rolled = true; break;
            }
          }
          if (rolled) continue;
        }
        if (m.fall[i]) { fx('thud', { x, y }); }
        m.fall[i] = 0;
      }
    }
    if (W.anims.length > 200) W.anims.splice(0, W.anims.length - 200);
  }

  // --- agua ---
  function physicsWater() {
    const m = M(), w = m.w, h = m.h;
    const moved = new Uint8Array(w * h);
    let any = false;
    for (let y = h - 2; y >= 1; y--) {
      const dir = chance(0.5) ? 1 : -1;
      for (let k = 1; k < w - 1; k++) {
        const x = dir > 0 ? k : w - 1 - k;
        const i = y * w + x;
        if (m.t[i] !== T.WATER || moved[i]) continue;
        any = true;
        const bi = i + w;
        const canGo = j => (m.t[j] === T.EMPTY || m.t[j] === T.GAS) && occ[j] === 0;
        if (canGo(bi) && !isP(x, y + 1)) { const g = m.t[bi]; m.t[bi] = T.WATER; m.t[i] = g; moved[bi] = 1; continue; }
        const s = chance(0.5) ? 1 : -1;
        let done = false;
        for (const dx of [s, -s]) {
          const j = i + dx, jb = j + w;
          if (canGo(j) && canGo(jb) && !isP(x + dx, y) && !isP(x + dx, y + 1)) {
            m.t[jb] = T.WATER; m.t[i] = T.EMPTY; moved[jb] = 1; done = true; break;
          }
        }
        if (done) continue;
        // nivelar: sólo si hay agua encima (presión)
        if (m.t[i - w] === T.WATER) {
          for (const dx of [s, -s]) {
            const j = i + dx;
            if (canGo(j) && !isP(x + dx, y)) { m.t[j] = T.WATER; m.t[i] = T.EMPTY; moved[j] = 1; break; }
          }
        }
      }
    }
    if (!any) return;
    // agua + magma → obsidiana + vapor
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (m.t[i] !== T.MAGMA) continue;
      for (const [dx, dy] of DIR4) {
        const j = (y + dy) * w + x + dx;
        if (m.t[j] === T.WATER) {
          m.t[i] = T.OBSIDIAN; m.hp[i] = 0; m.t[j] = T.EMPTY;
          fx('steam', { x: x + dx, y: y + dy });
          if (vis[i] > 0) log('El agua solidifica el magma: obsidiana.', 'purple');
          break;
        }
      }
    }
  }

  // --- temblores ---
  function quake() {
    fx('quake', {});
    log('¡TEMBLOR! El techo se resquebraja.', 'red');
    const { x, y } = G.p;
    let n = 0;
    for (let yy = y - 14; yy <= y + 10; yy++) for (let xx = x - 16; xx <= x + 16; xx++) {
      if (!inb(xx, yy)) continue;
      const t = tile(xx, yy);
      if ((t === T.DIRT || t === T.ROCK || t === T.GRANITE) && tile(xx, yy + 1) === T.EMPTY && chance(0.14)) {
        setTile(xx, yy, T.BOULDER); n++;
      }
    }
    noise(x, y, 22, false);
    return n;
  }

  // ---------------- gusanos ----------------
  const wormPass = t => t === T.EMPTY || t === T.WATER || t === T.GAS || t === T.DIRT || t === T.ROCK;
  function buildDField() {
    const m = M(), n = m.w * m.h;
    if (!dfield || dfield.length !== n) dfield = new Int16Array(n);
    dfield.fill(-1);
    const q = [idx(G.p.x, G.p.y)];
    dfield[q[0]] = 0;
    let qi = 0;
    while (qi < q.length) {
      const c = q[qi++], cx = c % m.w, cy = (c / m.w) | 0, dd = dfield[c];
      if (dd > 40) continue;
      for (const [dx, dy] of DIR4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (dfield[j] >= 0) continue;
        if (!wormPass(m.t[j])) continue;
        dfield[j] = dd + 1; q.push(j);
      }
    }
  }

  function wormsAct() {
    const alive = G.worms.filter(w => w.hp > 0);
    if (!alive.length) return;
    let built = false;
    for (let wi = 0; wi < G.worms.length; wi++) {
      const w = G.worms[wi];
      if (w.hp <= 0) continue;
      w.prev = w.segs.map(s => ({ x: s.x, y: s.y }));
      w.t0 = performance.now();
      if (!w.awake) continue;
      w.tick = (w.tick || 0) + 1;
      w.calm--;
      if (w.calm <= 0) { w.awake = false; continue; }
      if (w.cd > 0) w.cd--;
      const hd = w.segs[0];
      // morder
      if (Math.abs(hd.x - G.p.x) + Math.abs(hd.y - G.p.y) === 1) {
        if (w.cd <= 0) {
          w.cd = 2;
          log('¡El gusano muerde el casco!', 'red');
          fx('bite', { x: G.p.x, y: G.p.y });
          hurt(8 + G.h * 1.6, 'worm');
          if (G.over) return;
        }
        continue;
      }
      if (w.tick % w.speed !== 0) continue;
      if (!built) { buildDField(); built = true; }
      let best = null, bd = 9999;
      for (const [dx, dy] of DIR4) {
        const nx = hd.x + dx, ny = hd.y + dy;
        if (!inb(nx, ny) || isP(nx, ny)) continue;
        const j = idx(nx, ny);
        if (occ[j]) continue;
        if (!wormPass(M().t[j])) continue;
        const dd = dfield[j] < 0 ? 999 : dfield[j];
        const score = dd + rnd() * 0.5;
        if (score < bd) { bd = score; best = [nx, ny]; }
      }
      if (!best) continue;
      const [nx, ny] = best;
      const t = tile(nx, ny);
      if (t === T.DIRT || t === T.ROCK) { setTile(nx, ny, T.EMPTY); fx('wormdig', { x: nx, y: ny, t }); }
      w.segs.unshift({ x: nx, y: ny });
      w.segs.pop();
      rebuildOcc();
    }
  }

  // ---------------- visión ----------------
  function los(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0, walls = 0;
    while (true) {
      if (x === x1 && y === y1) return true;
      // la luz penetra una capa de roca: se ve la superficie y lo que hay justo detrás
      if (!(x === x0 && y === y0) && opaque(tile(x, y)) && ++walls >= 2) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  function updateVision() {
    vis.fill(0);
    const R = st.vision, { x, y } = G.p, m = M();
    for (let yy = y - R - 1; yy <= y + R + 1; yy++) for (let xx = x - R - 1; xx <= x + R + 1; xx++) {
      if (!inb(xx, yy)) continue;
      const d = TP.dist(x, y, xx, yy);
      if (d > R + 0.5) continue;
      if (d > 1.5 && !los(x, y, xx, yy)) continue;
      const i = idx(xx, yy);
      vis[i] = TP.clamp(1 - Math.pow(d / (R + 1), 2) * 0.75, 0.2, 1);
      m.seen[i] = 1;
    }
    // el magma visible ilumina su entorno inmediato
  }
  W.updateVision = () => updateVision();

  // ---------------- estación ----------------
  W.leaveStation = function () {
    G.inStation = false;
    // dar un paso fuera para no reentrar
    log('Desacoplado de la Estación.', 'dim');
  };

  W.sell = function (ore, n) {
    n = Math.min(n, G.cargo[ore]);
    if (n <= 0) return 0;
    let price = TP.ORES[ore].value * st.sellMult * (ore === 'uranium' ? st.leadSell : 1);
    price *= 1 + G.h * 0.04;
    const v = Math.round(price * n);
    G.cargo[ore] -= n; G.rublos += v; G.earned += v;
    return v;
  };
  W.orePrice = ore => Math.round(TP.ORES[ore].value * st.sellMult * (ore === 'uranium' ? st.leadSell : 1) * (1 + G.h * 0.04) * 10) / 10;

  W.deliver = function (ore, n) {
    if (!G.quota || G.quota.ore !== ore) return 0;
    n = Math.min(n, G.cargo[ore]);
    if (n <= 0) return 0;
    G.cargo[ore] -= n; G.quota.delivered += n;
    return n;
  };

  W.repairCost = () => Math.ceil((st.hullMax - G.p.hull) * TP.PRICES.repair);
  W.repair = function (amount) {
    const need = st.hullMax - G.p.hull;
    const a = Math.min(need, amount === undefined ? need : amount, Math.floor(G.rublos / TP.PRICES.repair));
    if (a <= 0) return 0;
    G.rublos -= a * TP.PRICES.repair; G.p.hull += a;
    return a;
  };
  W.refuel = function (amount) {
    const need = Math.floor(st.fuelMax - G.p.fuel);
    const a = Math.min(need, amount === undefined ? need : amount, Math.floor(G.rublos / TP.PRICES.fuel));
    if (a <= 0) return 0;
    G.rublos -= a * TP.PRICES.fuel; G.p.fuel += a;
    return a;
  };
  W.buyDynamite = function () {
    const c = TP.PRICES.dynamite + G.h * 2;
    if (G.rublos < c) return false;
    G.rublos -= c; G.dyn++;
    return true;
  };
  W.dynPrice = () => TP.PRICES.dynamite + G.h * 2;

  // tienda: se genera al llegar a la estación
  W.stationEnter = function () {
    if (!G.stationDone[G.h]) {
      G.stationDone[G.h] = true;
      const r = new TP.RNG(G.seed + '|shop' + G.h);
      G.shop = [];
      const types = r.shuffle(['broca', 'motor', 'refri', 'blindaje', 'aux', 'aux', 'broca']);
      for (let i = 0; i < 4; i++) {
        const m = TP.Items.make(types[i], Math.min(9, G.h + 1), TP.Items.rollRarity(G.h + 1, r, 0.03), r);
        m.price = Math.round(m.price * 1.25 / 5) * 5;
        G.shop.push(m);
      }
      const fuelGift = Math.min(40, Math.floor(st.fuelMax - G.p.fuel));
      if (fuelGift > 0) { G.p.fuel += fuelGift; log('Asignación estatal: +' + fuelGift + ' de combustible.', 'gold'); }
      const bonus = st.dynBonus + st.starDyn;
      if (bonus) { G.dyn += bonus; log('Suministro: +' + bonus + ' dinamita (condecoraciones y módulos).', 'red'); }
      G.telegram = buildTelegram();
    }
  };

  function buildTelegram() {
    const h = G.h, q = G.quota;
    const lines = [];
    lines.push('TELEGRAMA · RELÉ Nº ' + (h + 1) + ' · ' + TP.fmt(W.depthM(M().station.y)) + ' M');
    lines.push('');
    lines.push(TP.TXT.lore[h] || '');
    if (q) lines.push('RECUERDE EL PLAN: ' + q.amount + ' UNIDADES DE ' + TP.ORES[q.ore].name.toUpperCase() + '. STOP.');
    const fl = TP.TXT.flavor[TP.hash(G.seed + h) % TP.TXT.flavor.length];
    if (h % 2 === 1) lines.push(fl);
    return lines.join('\n');
  }

  W.buy = function (id) {
    const i = G.shop.findIndex(m => m.id === id);
    if (i < 0) return false;
    const m = G.shop[i];
    if (G.rublos < m.price || G.inv.length >= 6) return false;
    G.rublos -= m.price;
    G.shop.splice(i, 1);
    G.inv.push(m);
    return m;
  };
  W.scrapValue = m => Math.round(m.price * (G.inStation ? 0.35 : 0));

  /* equipar: mueve un módulo (del inventario o de otra ranura) a una ranura */
  W.equip = function (id, slot) {
    const src = findMod(id);
    if (!src || !TP.Items.fits(src.m, slot)) return false;
    const prev = G.equip[slot];
    if (src.where === 'inv') {
      G.inv.splice(src.i, 1);
      if (prev) G.inv.push(prev);
      G.equip[slot] = src.m;
    } else if (src.where === 'slot') {
      if (src.slot === slot) return false;
      G.equip[src.slot] = prev && TP.Items.fits(prev, src.slot) ? prev : null;
      if (prev && !TP.Items.fits(prev, src.slot)) G.inv.push(prev);
      G.equip[slot] = src.m;
    } else return false;
    afterEquip();
    return true;
  };
  W.unequip = function (slot) {
    const m = G.equip[slot];
    if (!m || G.inv.length >= 6) return false;
    if (!/aux/.test(slot)) return false; // las ranuras básicas no pueden quedar vacías
    G.equip[slot] = null; G.inv.push(m);
    afterEquip();
    return true;
  };
  W.scrap = function (id) {
    const src = findMod(id);
    if (!src) return false;
    if (src.where === 'slot' && !/aux/.test(src.slot)) return false;
    if (src.where === 'shop') return false;
    const m = src.m;
    if (src.where === 'inv') G.inv.splice(src.i, 1); else G.equip[src.slot] = null;
    let msg;
    if (G.inStation) {
      const v = Math.round(m.price * 0.35);
      G.rublos += v; G.earned += v; msg = 'Reciclado: +' + v + '₽';
    } else {
      const f = Math.min(15 + m.rarity * 10, st.fuelMax - G.p.fuel);
      G.p.fuel += f; msg = 'Chatarra quemada: +' + Math.round(f) + ' combustible';
    }
    afterEquip();
    log(msg + '.', 'gold');
    return msg;
  };
  function afterEquip() {
    W.recalc();
    G.p.hull = Math.min(G.p.hull, st.hullMax);
    G.p.fuel = Math.min(G.p.fuel, st.fuelMax);
    TP.bus.emit('equip');
  }
  function findMod(id) {
    let i = G.inv.findIndex(m => m.id === id);
    if (i >= 0) return { where: 'inv', i, m: G.inv[i] };
    for (const s of TP.SLOTS) if (G.equip[s] && G.equip[s].id === id) return { where: 'slot', slot: s, m: G.equip[s] };
    if (G.shop) { i = G.shop.findIndex(m => m.id === id); if (i >= 0) return { where: 'shop', i, m: G.shop[i] }; }
    return null;
  }
  W.findMod = findMod;

  /* resolver cuota y descender. Devuelve {medal, strike, over} */
  W.descend = function () {
    const res = { medal: null, strike: false };
    const q = G.quota;
    if (q) {
      if (q.delivered >= q.amount) {
        const owned = new Set(G.medals);
        const avail = TP.MEDALS.filter(m => !owned.has(m.key));
        if (avail.length) {
          const md = avail[Math.floor(rnd() * avail.length)];
          G.medals.push(md.key); res.medal = md;
          log('Condecorado: ' + md.name + '.', 'gold');
        } else { G.rublos += 150; G.earned += 150; res.medal = { name: 'Prima de 150₽', desc: '' }; }
        // exceso entregado: prima
        const extra = q.delivered - q.amount;
        if (extra > 0) { const v = Math.round(extra * TP.ORES[q.ore].value * 1.5); G.rublos += v; G.earned += v; res.extra = v; }
      } else {
        G.strikes++; res.strike = true;
        log('Reprimenda oficial nº ' + G.strikes + '.', 'red');
        if (G.strikes >= 3) { gameOver('strikes'); res.over = true; return res; }
      }
    }
    W.recalc();
    W.loadHorizon(G.h + 1);
    return res;
  };

  W.get = () => G;
  W.st = null;
  TP.W = W;
})(window.TP);
