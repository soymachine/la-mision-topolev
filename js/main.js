/* ==========================================================
   main.js — arranque, bucle principal, entrada, orquestación
   ========================================================== */
'use strict';
(function (TP) {
  const $ = TP.$, SC = TP.Screens, UI = TP.UI, R = TP.R, W = TP.W;
  const Main = { gameVisible: false, auto: null, lastKey: 0 };
  let fxc, fctx, hudDirty = false;

  // ---------------- arranque ----------------
  function boot() {
    R.init($('#map'));
    fxc = $('#fx'); fctx = fxc.getContext('2d');
    UI.layout();
    UI.buildTouch();
    Main.applyOpts();
    UI.DnD.use({ can: TP.Station.can, drop: TP.Station.drop });
    bindInput();
    SC.show('title');
    // la fuente puede tardar: recalcular medidas cuando cargue
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { onResize(); });
    requestAnimationFrame(loop);
  }

  Main.applyOpts = function () {
    const o = TP.Save.opts();
    $('#crt').classList.toggle('off', !o.crt);
    TP.Audio.setVolume();
    onResize();
  };
  TP.bus.on('opts', () => Main.applyOpts());

  function onResize() {
    UI.layout();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fxc.width = Math.round(window.innerWidth * dpr); fxc.height = Math.round(window.innerHeight * dpr);
    if (Main.gameVisible) { R.resize(); UI.renderHUD(); }
    if (SC.cur && SC.cur.draw && ['station', 'help', 'options'].includes(SC.cur.name)) SC.cur.draw();
  }
  window.addEventListener('resize', onResize);

  Main.setGameVisible = function (v) {
    Main.gameVisible = v;
    $('#game-layer').classList.toggle('hidden', !v);
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    $('#touch').classList.toggle('on', v && touch);
    if (v) { R.resize(); }
  };

  // ---------------- flujo de partida ----------------
  Main.startRun = function (seed) {
    TP.Audio.init();
    TP.P.list.length = 0;
    W.newRun(seed);
    TP.Save.saveRun();
    SC.show('briefing', { onDone: () => { SC.close(); Main.onHorizonStart(); } });
  };
  Main.continueRun = function () {
    TP.Audio.init();
    const g = TP.Save.loadRun();
    if (!g) { SC.show('title'); return; }
    W.load(g);
    TP.P.list.length = 0;
    SC.close();
    Main.setGameVisible(true);
    R.snapCamera();
    UI.initBars();
    UI.renderHUD();
    W.log('Transmisión restablecida.', 'dim');
    if (TP.G.inStation) SC.show('station');
  };
  Main.onHorizonStart = function () {
    Main.setGameVisible(true);
    R.snapCamera();
    UI.initBars();
    UI.renderHUD();
    const G = TP.G;
    UI.banner('HORIZONTE ' + TP.roman(G.h + 1), TP.HORIZON_NAMES[G.h] + ' · ' + TP.fmt(W.depthM()) + ' m');
    TP.Save.saveRun();
  };
  Main.afterStationLeave = function () {
    UI.renderHUD();
    TP.Save.saveRun();
  };

  TP.bus.on('station', () => {
    Main.auto = null;
    TP.Save.saveRun();
    setTimeout(() => { if (TP.G.inStation && !TP.G.over) SC.show('station'); }, 350);
  });

  function finishRun() {
    const G = TP.G;
    const score = W.score();
    const rec = { score, depth: Math.round(G.stats.maxDepth), h: G.h, seed: G.seed, cause: G.over.cause, medals: G.medals.length, date: Date.now(), turns: G.turn };
    const rank = TP.Save.addRecord(rec);
    TP.Save.clearRun();
    return { score, rank };
  }
  TP.bus.on('gameover', (over) => {
    Main.auto = null;
    const res = finishRun();
    const G = TP.G;
    if (over.cause !== 'strikes' && over.cause !== 'quit') {
      TP.P.explosion(G.p.x, G.p.y, 1, 'dyn');
      R.addShake(14); R.addFlash(0.6, [255, 60, 20]);
    }
    TP.Audio.play('death');
    UI.renderHUD();
    setTimeout(() => SC.show('gameover', res), over.cause === 'quit' || over.cause === 'strikes' ? 200 : 1600);
  });
  TP.bus.on('victory', () => {
    Main.auto = null;
    const res = finishRun();
    R.addFlash(0.8, [255, 240, 220]);
    setTimeout(() => SC.show('victory', res), 1400);
  });

  TP.bus.on('log', () => { hudDirty = true; });
  TP.bus.on('equip', () => { hudDirty = true; });

  // ---------------- acciones ----------------
  function doAction(fn) {
    if (!TP.G || TP.G.over || SC.cur) return false;
    const r = fn();
    if (r) {
      hudDirty = true;
      if (TP.G.turn % 8 === 0) TP.Save.saveRun();
      // alarmas de calor
      if (TP.G.p.heat > 85 && TP.G.p.heat < 100 && TP.G.turn % 4 === 0) TP.Audio.play('alarm');
    }
    return r;
  }
  const act = (dx, dy) => doAction(() => W.act(dx, dy));

  // ---------------- entrada ----------------
  function bindInput() {
    window.addEventListener('keydown', e => {
      TP.Audio.init();
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'm' || e.key === 'M') { if (!SC.cur || SC.cur.name !== 'newgame') { TP.Save.setOpt('sound', !TP.Save.opts().sound); UI.banner(TP.Save.opts().sound ? 'SONIDO ACTIVADO' : 'SONIDO DESACTIVADO'); return; } }
      if (SC.cur) { if (!e.repeat || /Arrow/.test(e.key)) SC.key(e); e.preventDefault(); return; }
      if (!Main.gameVisible || !TP.G) return;
      const now = performance.now();
      if (e.repeat && now - Main.lastKey < 95) { e.preventDefault(); return; }
      Main.lastKey = now;
      Main.auto = null; R.path = null;
      const k = e.key;
      let used = true;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') act(0, -1);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') act(0, 1);
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') act(-1, 0);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') act(1, 0);
      else if (k === ' ' || k === '.' || k === 'z' || k === 'Z') doAction(() => W.wait());
      else if (k === 'q' || k === 'Q') doAction(() => W.sonar());
      else if (k === 'e' || k === 'E') doAction(() => W.dynamite());
      else if (k === 'Escape' || k === 'p' || k === 'P') { if (!TP.G.over) SC.show('pause'); }
      else if (k === 'Enter' && TP.G.inStation) SC.show('station');
      else used = false;
      if (used) e.preventDefault();
    });

    // clics en el HUD (data-click)
    $('#hud').addEventListener('click', e => {
      const b = e.target.closest('[data-click]');
      if (!b || SC.cur) return;
      if (UI.DnD.justDropped && performance.now() - UI.DnD.justDropped < 350) return;
      const [k, v] = b.getAttribute('data-click').split(':');
      TP.Audio.play('click');
      if (k === 'dyn') doAction(() => W.dynamite());
      if (k === 'sonar') doAction(() => W.sonar());
      if (k === 'wait') doAction(() => W.wait());
      if (k === 'menu') SC.show('pause');
      if (k === 'equip') {
        const f = W.findMod(v);
        if (f) {
          const G = TP.G;
          const slot = f.m.type === 'aux' ? (!G.equip.aux1 ? 'aux1' : !G.equip.aux2 ? 'aux2' : 'aux1') : f.m.type;
          W.equip(v, slot);
          W.log('Equipado: ' + TP.Items.fullName(f.m) + '.', TP.RARITY[f.m.rarity].cls);
          TP.Audio.play('drop');
        }
      }
      UI.renderHUD();
    });

    // táctil
    $('#touch').addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-touch]');
      if (!b) return;
      e.preventDefault();
      TP.Audio.init();
      const k = b.getAttribute('data-touch');
      const run = () => {
        if (k === 'up') act(0, -1); else if (k === 'down') act(0, 1);
        else if (k === 'left') act(-1, 0); else if (k === 'right') act(1, 0);
        else if (k === 'wait') doAction(() => W.wait());
        else if (k === 'sonar') doAction(() => W.sonar());
        else if (k === 'dyn') doAction(() => W.dynamite());
        else if (k === 'menu') SC.show('pause');
      };
      run();
      if (/up|down|left|right/.test(k)) {
        const iv = setInterval(run, 160);
        const stop = () => { clearInterval(iv); window.removeEventListener('pointerup', stop); };
        window.addEventListener('pointerup', stop);
      }
    });

    // ratón sobre el mapa
    const cv = $('#map');
    cv.addEventListener('mousemove', e => {
      if (!TP.G || SC.cur) return;
      const c = R.screenToCell(e.clientX, e.clientY);
      if (!W.inb(c.x, c.y)) { R.hover = null; UI.hideTip(); return; }
      if (!R.hover || R.hover.x !== c.x || R.hover.y !== c.y) {
        R.hover = c;
        const d = Math.abs(c.x - TP.G.p.x) + Math.abs(c.y - TP.G.p.y);
        R.path = d > 1 && !Main.auto ? findPath(c.x, c.y) : Main.auto ? R.path : null;
      }
      UI.showTip(UI.cellTip(c.x, c.y), e.clientX, e.clientY);
    });
    cv.addEventListener('mouseleave', () => { R.hover = null; if (!Main.auto) R.path = null; UI.hideTip(); });
    cv.addEventListener('click', e => {
      TP.Audio.init();
      if (!TP.G || SC.cur || TP.G.over) return;
      const c = R.screenToCell(e.clientX, e.clientY);
      const p = TP.G.p;
      const dx = c.x - p.x, dy = c.y - p.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) { Main.auto = null; act(dx, dy); return; }
      if (dx === 0 && dy === 0) { if (TP.G.inStation) SC.show('station'); else doAction(() => W.wait()); return; }
      const path = findPath(c.x, c.y);
      if (path && path.length) { Main.auto = { path: path.slice(), t: 0, hull: p.hull }; R.path = path; }
      else { TP.Audio.play('deny'); }
    });

    // tooltips del DOM
    document.addEventListener('mousemove', e => {
      if (e.target === cv) return;
      if (UI.DnD.drag) return;
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { if (!$('#tooltip').classList.contains('hidden')) UI.hideTip(); return; }
      const key = el.getAttribute('data-tip');
      const html = key.startsWith('raw:') ? key.slice(4) : UI.tipHTML(key);
      UI.showTip(html, e.clientX, e.clientY);
    });

    window.addEventListener('beforeunload', () => { if (TP.G && !TP.G.over) TP.Save.saveRun(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && TP.G && !TP.G.over && Main.gameVisible) TP.Save.saveRun(); });
  }

  // ruta por celdas vistas y transitables
  function findPath(tx, ty) {
    const G = TP.G, m = G.map, w = m.w;
    if (!W.inb(tx, ty) || !m.seen[ty * w + tx]) return null;
    const t = m.t[ty * w + tx];
    if (TP.TD[t].solid) return null;
    const start = G.p.y * w + G.p.x, goal = ty * w + tx;
    const prev = new Int32Array(w * m.h).fill(-1);
    prev[start] = start;
    const q = [start];
    let qi = 0;
    while (qi < q.length) {
      const c = q[qi++];
      if (c === goal) break;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!W.inb(nx, ny)) continue;
        const n = ny * w + nx;
        if (prev[n] >= 0 || !m.seen[n]) continue;
        if (TP.TD[m.t[n]].solid || W.wormAt(nx, ny) >= 0) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    const path = [];
    let c = goal;
    while (c !== start) { path.unshift([c % w, (c / w) | 0]); c = prev[c]; }
    return path.length > 120 ? null : path;
  }

  function stepAuto(dt) {
    const a = Main.auto;
    if (!a || SC.cur || !TP.G || TP.G.over) { if (a && (SC.cur || TP.G.over)) Main.auto = null; return; }
    a.t += dt;
    if (a.t < 0.1) return;
    a.t = 0;
    const p = TP.G.p;
    if (p.hull < a.hull) { Main.auto = null; R.path = null; W.log('Ruta interrumpida: daños.', 'red'); hudDirty = true; return; }
    const next = a.path.shift();
    if (!next) { Main.auto = null; R.path = null; return; }
    const dx = next[0] - p.x, dy = next[1] - p.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      // quizá caímos: recalcular hacia el destino
      const goal = a.path.length ? a.path[a.path.length - 1] : next;
      const np = findPath(goal[0], goal[1]);
      if (np && np.length) { a.path = np; R.path = np; } else { Main.auto = null; R.path = null; }
      return;
    }
    const ok = act(dx, dy);
    if (!ok) { Main.auto = null; R.path = null; return; }
    R.path = a.path;
    if (!a.path.length) { Main.auto = null; R.path = null; }
  }

  // ---------------- bucle ----------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    R._dt = dt * 1000;
    TP.P.update(dt);
    if (Main.gameVisible) {
      TP.P.ambient(dt);
      stepAuto(dt);
      R.draw(now);
      if (hudDirty) { hudDirty = false; UI.renderHUD(); }
      UI.tickHUD(dt);
    }
    SC.frame(dt, now);
    // partículas de pantalla
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, fxc.width, fxc.height);
    TP.P.drawScreen(fctx, UI.hudFs ? UI.hudFs + 2 : 16);
    requestAnimationFrame(loop);
  }

  TP.Main = Main;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.TP);
