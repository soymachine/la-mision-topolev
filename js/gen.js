/* ==========================================================
   gen.js — generación procedural de horizontes
   ========================================================== */
'use strict';
(function (TP) {
  const T = TP.T;

  function Grid(w, h) {
    this.w = w; this.h = h;
    this.t = new Uint8Array(w * h);
    this.hp = new Uint8Array(w * h);   // daño acumulado
  }
  Grid.prototype.in = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
  Grid.prototype.get = function (x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.BEDROCK; };
  Grid.prototype.set = function (x, y, v) { if (this.in(x, y)) { this.t[y * this.w + x] = v; this.hp[y * this.w + x] = 0; } };
  TP.Grid = Grid;

  const PROTECTED = new Set([T.BEDROCK, T.CONCRETE, T.STATION, T.RELIC]);

  /* simulación rápida de fluidos durante la generación (asentar lagos) */
  function settleFluids(g, rng, iters) {
    for (let it = 0; it < iters; it++) {
      let moved = false;
      for (let y = g.h - 2; y >= 0; y--) {
        const dir = rng.chance(0.5) ? 1 : -1;
        for (let i = 0; i < g.w; i++) {
          const x = dir > 0 ? i : g.w - 1 - i;
          const v = g.get(x, y);
          if (v !== T.WATER && v !== T.MAGMA) continue;
          if (g.get(x, y + 1) === T.EMPTY) { g.set(x, y + 1, v); g.set(x, y, T.EMPTY); moved = true; continue; }
          const s = rng.chance(0.5) ? 1 : -1;
          for (const d of [s, -s]) {
            if (g.get(x + d, y) === T.EMPTY && g.get(x + d, y + 1) === T.EMPTY) {
              g.set(x + d, y + 1, v); g.set(x, y, T.EMPTY); moved = true; break;
            }
          }
        }
      }
      if (!moved) break;
    }
    // agua junto a magma → obsidiana
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== T.MAGMA) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (g.get(x + dx, y + dy) === T.WATER) { g.set(x, y, T.OBSIDIAN); break; }
      }
    }
  }

  /* BFS de accesibilidad para una broca de nivel 1 (sin atravesar basalto ni magma) */
  function reachable(g, sx, sy, tx, ty) {
    const seen = new Uint8Array(g.w * g.h), q = [sx + sy * g.w];
    seen[q[0]] = 1;
    const ok = t => !(t === T.BEDROCK || t === T.CONCRETE || t === T.MAGMA || t === T.BASALT || t === T.OBSIDIAN);
    while (q.length) {
      const c = q.shift(), x = c % g.w, y = (c / g.w) | 0;
      if (x === tx && y === ty) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!g.in(nx, ny)) continue;
        const n = nx + ny * g.w;
        if (seen[n]) continue;
        const t = g.t[n];
        if (!ok(t) && !(nx === tx && ny === ty)) continue;
        seen[n] = 1; q.push(n);
      }
    }
    return false;
  }

  /* corredor de emergencia: paseo aleatorio descendente que ablanda lo imposible */
  function carveCorridor(g, rng, sx, sy, tx, ty) {
    // primero hasta la vertical del objetivo (5 filas por encima), luego recto hacia abajo
    const soft = (x, y) => {
      const t = g.get(x, y);
      if (t === T.BASALT || t === T.OBSIDIAN || t === T.MAGMA) g.set(x, y, T.ROCK);
    };
    let x = sx, y = sy;
    soft(x, y);
    const my = ty - 5;
    let guard = 0;
    while ((x !== tx || y !== my) && guard++ < 2000) {
      const dx = Math.sign(tx - x), dy = Math.sign(my - y);
      if (dy !== 0 && (dx === 0 || rng.chance(0.6))) y += dy; else x += dx;
      soft(x, y);
    }
    for (let yy = my; yy < ty; yy++) soft(tx, yy);
  }

  /* genera un horizonte. h = 0..9 */
  function generate(seed, h) {
    const W = TP.CFG.MAP_W, H = TP.CFG.MAP_H;
    const rng = new TP.RNG(seed + '|h' + h);
    const noise = TP.makeNoise(seed + '|n' + h);
    const noise2 = TP.makeNoise(seed + '|m' + h);
    const g = new Grid(W, H);
    const final = h === TP.CFG.HORIZONS - 1;
    const hf = h / 9;

    // 1. estratos
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = noise.fbm(x * 0.075, y * 0.06, 4);
      const d = y / H;
      let v = n * 0.75 + hf * 0.42 + d * 0.12 - 0.12 + (rng.next() - 0.5) * 0.06;
      let t;
      if (v < 0.30) t = T.DIRT;
      else if (v < 0.50) t = T.ROCK;
      else if (v < 0.68) t = T.GRANITE;
      else t = h >= 1 ? T.BASALT : T.GRANITE;
      g.set(x, y, t);
    }

    // 2. cavernas por autómata celular
    const fill = 0.5 - hf * 0.02;
    let cave = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) cave[i] = rng.chance(fill) ? 1 : 0; // 1 = pared
    for (let it = 0; it < 5; it++) {
      const nc = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) c++;
          else c += cave[nx + ny * W];
        }
        nc[x + y * W] = c >= 5 ? 1 : 0;
      }
      cave = nc;
    }
    // las cavernas no ocupan todo: máscara con ruido
    for (let y = 3; y < H - 7; y++) for (let x = 1; x < W - 1; x++) {
      if (!cave[x + y * W] && noise2.fbm(x * 0.05 + 50, y * 0.05, 2) > 0.47) g.set(x, y, T.EMPTY);
    }

    // 3. vetas de mineral
    const veinCount = 16 + h * 2 + rng.int(0, 5);
    const oreTotals = {};
    const ow = TP.oreWeights(h);
    for (let v = 0; v < veinCount; v++) {
      const ore = rng.weighted(ow);
      const tile = TP.ORES[ore].tile;
      let x = rng.int(2, W - 3), y = rng.int(5, H - 8);
      const len = ore === 'topolevite' ? rng.int(1, 3) : ore === 'uranium' || ore === 'gold' ? rng.int(2, 4) : rng.int(3, 6);
      for (let i = 0; i < len; i++) {
        const t = g.get(x, y);
        if (t === T.DIRT || t === T.ROCK || t === T.GRANITE || t === T.BASALT) {
          g.set(x, y, tile);
          oreTotals[ore] = (oreTotals[ore] || 0) + 1;
        }
        const d = rng.int(0, 3);
        x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d];
        x = TP.clamp(x, 1, W - 2); y = TP.clamp(y, 4, H - 8);
      }
    }

    // 4. bolsas de gas
    if (h >= 1) {
      const gasCount = 2 + Math.floor(h * 0.8) + rng.int(0, 2);
      for (let i = 0; i < gasCount; i++) {
        let x = rng.int(3, W - 4), y = rng.int(10, H - 10);
        const size = rng.int(3, 7);
        for (let k = 0; k < size; k++) {
          const t = g.get(x, y);
          if (t !== T.EMPTY && !PROTECTED.has(t) && !TP.TD[t].ore) g.set(x, y, T.GAS);
          x += rng.int(-1, 1); y += rng.int(-1, 1);
        }
      }
    }

    // 5. magma en profundidad (bolsas)
    if (h >= 3) {
      const thr = 0.74 - (h - 3) * 0.022;
      for (let y = 12; y < H - 8; y++) for (let x = 1; x < W - 1; x++) {
        const n = noise2.fbm(x * 0.09 + 200, y * 0.09, 3);
        if (n > thr && g.get(x, y) !== T.EMPTY) g.set(x, y, T.MAGMA);
      }
      // algo de topolevita junto al magma
      if (h >= 4) {
        let tp = 0;
        for (let k = 0; k < 400 && tp < 2 + (h >> 2); k++) {
          const x = rng.int(2, W - 3), y = rng.int(12, H - 9);
          const t = g.get(x, y);
          if (t !== T.GRANITE && t !== T.BASALT && t !== T.ROCK) continue;
          let near = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.get(x + dx, y + dy) === T.MAGMA) near = true;
          if (near) { g.set(x, y, T.TOPOLEVITE); oreTotals.topolevite = (oreTotals.topolevite || 0) + 1; tp++; }
        }
      }
    }

    // 6. agua y magma en cavernas (se asientan)
    const empties = [];
    for (let y = 4; y < H - 8; y++) for (let x = 1; x < W - 1; x++) if (g.get(x, y) === T.EMPTY) empties.push([x, y]);
    rng.shuffle(empties);
    const waterN = h <= 7 ? Math.floor(empties.length * (0.07 - h * 0.006)) : 0;
    const magmaN = h >= 4 ? Math.floor(empties.length * (0.015 + (h - 4) * 0.01)) : 0;
    let ei = 0;
    for (let i = 0; i < waterN && ei < empties.length; i++, ei++) g.set(empties[ei][0], empties[ei][1], T.WATER);
    for (let i = 0; i < magmaN && ei < empties.length; i++, ei++) {
      const [x, y] = empties[ei];
      if (y > 16) g.set(x, y, T.MAGMA);
    }
    settleFluids(g, rng, 120);

    // 7. cantos rodados: techos de cavernas y sueltos en tierra
    for (let y = 3; y < H - 7; y++) for (let x = 1; x < W - 1; x++) {
      const t = g.get(x, y);
      if ((t === T.DIRT || t === T.ROCK) && g.get(x, y + 1) === T.EMPTY && rng.chance(0.09 + hf * 0.05)) g.set(x, y, T.BOULDER);
      else if (t === T.DIRT && rng.chance(0.025)) g.set(x, y, T.BOULDER);
    }

    // 8. bordes de lecho rocoso
    for (let y = 0; y < H; y++) { g.set(0, y, T.BEDROCK); g.set(W - 1, y, T.BEDROCK); }
    for (let x = 0; x < W; x++) { g.set(x, 0, T.BEDROCK); g.set(x, H - 1, T.BEDROCK); }

    // 9. entrada (arriba)
    const sx = rng.int(8, W - 9), sy = 1;
    for (let y = 1; y <= 3; y++) for (let x = sx - 2; x <= sx + 2; x++) {
      if (y <= 2 || Math.abs(x - sx) <= 1) g.set(x, y, T.EMPTY);
    }
    // cama de roca bajo la entrada para no caer
    for (let x = sx - 2; x <= sx + 2; x++) {
      const t = g.get(x, 4);
      if (!TP.isSolid(t) || t === T.BOULDER || t === T.BASALT || t === T.OBSIDIAN || t === T.MAGMA) g.set(x, 4, T.ROCK);
    }
    for (let x = sx - 1; x <= sx + 1; x++) g.set(x, 3, T.DIRT);
    // nada peligroso cerca de la entrada
    for (let y = 1; y <= 8; y++) for (let x = sx - 4; x <= sx + 4; x++) {
      const t = g.get(x, y);
      if (t === T.MAGMA || t === T.GAS || t === T.WATER) g.set(x, y, T.ROCK);
      if (t === T.BOULDER && y <= 6) g.set(x, y, T.DIRT);
    }

    // 10. estación (o La Cámara en el último horizonte)
    let stx, sty;
    if (!final) {
      const rw = 9, rh = 5;
      const rx = rng.int(3, W - rw - 3), ry = H - rh - 2; // esquina sup-izq
      // alrededor: roca normal (sin magma cerca)
      for (let y = ry - 3; y <= ry + rh; y++) for (let x = rx - 3; x <= rx + rw + 2; x++) {
        const t = g.get(x, y);
        if (t === T.MAGMA || t === T.GAS || t === T.WATER || t === T.BOULDER) g.set(x, y, T.ROCK);
      }
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        const edge = x === rx || x === rx + rw - 1 || y === ry || y === ry + rh - 1;
        g.set(x, y, edge ? T.CONCRETE : T.EMPTY);
      }
      // puertas: arriba al centro y laterales
      const cx = rx + (rw >> 1);
      g.set(cx, ry, T.EMPTY);
      g.set(rx, ry + rh - 2, T.EMPTY); g.set(rx + rw - 1, ry + rh - 2, T.EMPTY);
      stx = cx; sty = ry + rh - 2;
      g.set(stx, sty, T.STATION);
    } else {
      // La Cámara: gran cavidad esférica al fondo
      const cx = W >> 1, cy = H - 14, r = 10;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r * 1.6; x <= cx + r * 1.6; x++) {
        const xi = Math.round(x);
        if (!g.in(xi, y) || xi <= 0 || xi >= W - 1 || y >= H - 1) continue;
        const d = Math.hypot((xi - cx) / 1.6, y - cy);
        if (d < r - 0.5) g.set(xi, y, T.EMPTY);
        else if (d < r + 1.2) g.set(xi, y, rng.chance(0.18) ? T.TOPOLEVITE : T.OBSIDIAN);
      }
      // entrada a la cámara: abertura superior de granito (perforable con broca 1)
      for (let y = cy - r - 2; y <= cy - r + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) g.set(x, y, T.GRANITE);
      // suelo
      for (let x = cx - 3; x <= cx + 3; x++) g.set(x, cy + r - 1, T.OBSIDIAN);
      stx = cx; sty = cy + r - 2;
      g.set(stx, sty, T.RELIC);
    }

    // 11. suministros
    const floorCells = [];
    for (let y = 6; y < H - 8; y++) for (let x = 1; x < W - 1; x++) {
      if (g.get(x, y) === T.EMPTY && TP.isSolid(g.get(x, y + 1)) && g.get(x, y + 1) !== T.MAGMA) floorCells.push([x, y]);
    }
    rng.shuffle(floorCells);
    const barrels = 2 + rng.int(0, 2) + (h >= 5 ? 1 : 0), crates = 1 + rng.int(0, 2);
    let fi = 0;
    for (let i = 0; i < barrels && fi < floorCells.length; i++, fi++) g.set(floorCells[fi][0], floorCells[fi][1], T.BARREL);
    for (let i = 0; i < crates && fi < floorCells.length; i++, fi++) g.set(floorCells[fi][0], floorCells[fi][1], T.CRATE);
    // si no hay cavernas suficientes, bidones enterrados
    for (let i = fi; i < barrels + crates; i++) {
      const x = rng.int(2, W - 3), y = rng.int(10, H - 10);
      if (!PROTECTED.has(g.get(x, y))) g.set(x, y, i % 2 ? T.CRATE : T.BARREL);
    }

    // 12. accesibilidad
    const target = !final ? [stx, sty] : [stx, sty];
    if (!reachable(g, sx, sy, target[0], target[1])) {
      carveCorridor(g, rng, sx, sy + 3, target[0], target[1]);
    }

    // 13. recuento real de minerales (lo que quedó tras gas/magma)
    const oreCount = {};
    for (let i = 0; i < W * H; i++) { const o = TP.TD[g.t[i]].ore; if (o) oreCount[o] = (oreCount[o] || 0) + 1; }

    // 14. gusanos
    const worms = [];
    if (h >= 2) {
      const n = Math.min(1 + Math.floor((h - 2) / 2) + (rng.chance(0.4) ? 1 : 0), 5);
      const cands = [];
      for (let y = 18; y < H - 10; y++) for (let x = 2; x < W - 2; x++) if (g.get(x, y) === T.EMPTY) cands.push([x, y]);
      rng.shuffle(cands);
      for (let i = 0; i < n && i < cands.length; i++) {
        const [x, y] = cands[i];
        const len = 3 + Math.min(4, (h >> 1)) + rng.int(0, 1);
        const segs = [];
        for (let k = 0; k < len; k++) segs.push({ x, y });
        worms.push({ id: 'w' + i, segs, hp: 6 + h * 2, maxHp: 6 + h * 2, awake: false, calm: 0, cd: 0, speed: h >= 6 ? 1 : 2, tick: 0 });
      }
    }

    // 15. cuota del horizonte
    let quota = null;
    if (!final) {
      const cands = Object.keys(oreCount).filter(k => oreCount[k] >= 3 && k !== 'topolevite');
      const pickFrom = cands.length ? cands : Object.keys(oreCount);
      if (pickFrom.length) {
        // prioriza el mineral más valioso "razonable"
        const ore = rng.weighted(pickFrom.map(k => [k, 1 + TP.ORES[k].value / 8]));
        const avail = oreCount[ore];
        const amount = TP.clamp(Math.round(avail * (0.35 + hf * 0.2)), 2, 10);
        quota = { ore, amount, delivered: 0 };
      }
    }

    return {
      w: W, h: H, t: g.t, hp: g.hp, seen: new Uint8Array(W * H),
      start: { x: sx, y: sy }, station: { x: stx, y: sty }, worms, quota, oreCount, final
    };
  }

  TP.Gen = { generate, reachable, settleFluids };
})(window.TP);
