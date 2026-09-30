/* ==========================================================
   particles.js — partículas ASCII (mundo y pantalla) y "juice"
   Escucha TP.bus 'fx' y traduce eventos del mundo en partículas,
   sonidos, sacudidas y textos flotantes.
   ========================================================== */
'use strict';
(function (TP) {
  const T = TP.T, TD = TP.TD;
  const P = { list: [], max: 1400 };
  const rgb = {};
  const C = h => (Array.isArray(h) ? h : rgb[h] || (rgb[h] = TP.hex2rgb(h)));
  const mult = () => ({ bajo: 0.45, normal: 1, alto: 1.7 }[TP.Save.opts().particles] || 1);

  /* o: {x,y (celdas si world, px si screen), vx,vy, ax,ay, drag, life, ch, col, col2,
        size (escala de fuente), space, glow, bold, fadeIn, text, to:{x,y}, onEnd} */
  P.spawn = function (o) {
    if (P.list.length >= P.max) P.list.shift();
    const p = Object.assign({ vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, life: 1, ch: '·', col: '#ff8c1a', size: 1, space: 'world', glow: 0, age: 0 }, o);
    p.c1 = C(p.col); p.c2 = p.col2 ? C(p.col2) : null;
    P.list.push(p);
    return p;
  };

  P.update = function (dt) {
    for (let i = P.list.length - 1; i >= 0; i--) {
      const p = P.list[i];
      p.age += dt;
      if (p.age >= p.life) { if (p.onEnd) p.onEnd(p); P.list.splice(i, 1); continue; }
      if (p.to) {
        // vuelo con curva hacia un destino (pantalla)
        const f = TP.easeInOut(Math.min(1, p.age / p.life));
        const cx = (p.sx + p.to.x) / 2 + p.bend, cy = Math.min(p.sy, p.to.y) - 80;
        const u = 1 - f;
        p.x = u * u * p.sx + 2 * u * f * cx + f * f * p.to.x;
        p.y = u * u * p.sy + 2 * u * f * cy + f * f * p.to.y;
        continue;
      }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag) { const k = Math.pow(1 - p.drag, dt * 60); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.chs) p.ch = p.chs[Math.min(p.chs.length - 1, Math.floor(p.age / p.life * p.chs.length))];
    }
  };

  function drawList(ctx, space, map, camY, fontPx, font) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let lastFont = '';
    for (const p of P.list) {
      if (p.space !== space) continue;
      const f = p.age / p.life;
      let a = p.fade === false ? 1 : 1 - f * f;
      if (p.fadeIn) a *= Math.min(1, p.age / p.fadeIn);
      const c = p.c2 ? TP.mix(p.c1, p.c2, f) : p.c1;
      let x = p.x, y = p.y;
      if (space === 'world') { x = map.ox + p.x * map.cw; y = map.oy + p.y * map.ch - camY; }
      const fs = Math.round(fontPx * p.size * (p.grow ? 1 + f * p.grow : 1));
      const fnt = (p.bold ? 'bold ' : '') + fs + 'px ' + font;
      if (fnt !== lastFont) { ctx.font = fnt; lastFont = fnt; }
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + TP.clamp(a, 0, 1).toFixed(3) + ')';
      if (p.glow) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = p.glow; } else ctx.shadowBlur = 0;
      ctx.fillText(p.text || p.ch, x, y);
    }
    ctx.restore();
  }
  P.drawWorld = (ctx, R, camY) => drawList(ctx, 'world', R, camY, R.font, R.getFont());
  P.drawScreen = (ctx, fontPx) => drawList(ctx, 'screen', null, 0, fontPx, TP.R.getFont());

  // ---------- emisores ----------
  const DEBRIS = ['.', ',', '\'', '`', '·', ':', ';'];
  P.debris = function (x, y, col, n, dir) {
    n = Math.round(n * mult());
    for (let i = 0; i < n; i++) {
      const ang = dir ? Math.atan2(-dir[1], -dir[0]) + TP.rand(-1.1, 1.1) : TP.rand(0, Math.PI * 2);
      const sp = TP.rand(2, 7);
      P.spawn({ x: x + 0.5 + TP.rand(-0.3, 0.3), y: y + 0.5 + TP.rand(-0.3, 0.3), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, ay: 22, drag: 0.02, life: TP.rand(0.3, 0.7), ch: TP.pickr(DEBRIS), col, size: TP.rand(0.6, 1) });
    }
  };
  P.sparks = function (x, y, n, hot) {
    n = Math.round(n * mult());
    for (let i = 0; i < n; i++) {
      const ang = TP.rand(0, Math.PI * 2), sp = TP.rand(4, 11);
      P.spawn({ x: x + 0.5, y: y + 0.5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 3, ay: 18, drag: 0.03, life: TP.rand(0.15, 0.45), ch: TP.pickr(['*', '+', '·', '\'']), col: hot ? '#fff1b0' : '#ffd23f', col2: '#ff3b12', size: TP.rand(0.5, 0.8), glow: 6 });
    }
  };
  P.steam = function (x, y, n) {
    n = Math.round(n * mult());
    for (let i = 0; i < n; i++) {
      P.spawn({ x: x + 0.5 + TP.rand(-0.4, 0.4), y: y + 0.5, vx: TP.rand(-0.6, 0.6), vy: TP.rand(-3.5, -1.5), drag: 0.01, life: TP.rand(0.8, 1.8), ch: TP.pickr(['°', '˚', '~', '∙', 'o']), col: '#f2ede6', col2: '#6b6258', size: TP.rand(0.6, 1.1), grow: 0.4 });
    }
  };
  P.explosion = function (x, y, r, src) {
    const n = Math.round((40 + r * 30) * mult());
    const hot = src === 'gas' ? '#d8ff5a' : '#fff1b0';
    for (let i = 0; i < n; i++) {
      const ang = TP.rand(0, Math.PI * 2), sp = TP.rand(3, 14 + r * 4);
      P.spawn({ x: x + 0.5, y: y + 0.5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay: 6, drag: 0.06, life: TP.rand(0.35, 1.0), ch: TP.pickr(['#', '*', '@', '%', '&', '+', '▓', '▒', '░']), col: hot, col2: '#6e1a04', size: TP.rand(0.7, 1.3), glow: 8, bold: true });
    }
    // anillo
    const ring = Math.round(24 * mult());
    for (let i = 0; i < ring; i++) {
      const ang = (i / ring) * Math.PI * 2;
      P.spawn({ x: x + 0.5, y: y + 0.5, vx: Math.cos(ang) * (8 + r * 5), vy: Math.sin(ang) * (8 + r * 5) * 0.8, drag: 0.08, life: 0.5, ch: '○', col: '#ffb347', col2: '#ff3b12', size: 0.8 });
    }
    // humo
    for (let i = 0; i < 14 * mult(); i++) {
      P.spawn({ x: x + 0.5 + TP.rand(-r, r), y: y + 0.5 + TP.rand(-r, r), vx: TP.rand(-1, 1), vy: TP.rand(-2, -0.5), life: TP.rand(1, 2.2), ch: TP.pickr(['░', '▒', '~']), col: '#5a4a3e', col2: '#1a120c', size: TP.rand(0.9, 1.4), grow: 0.5, fadeIn: 0.2 });
    }
  };
  P.ring = function (x, y, r, col, ch) {
    const n = Math.round(Math.max(24, r * 7));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      P.spawn({ x: x + 0.5, y: y + 0.5, vx: Math.cos(ang) * r * 1.6, vy: Math.sin(ang) * r * 1.6, life: 0.62, ch: ch || '·', col, col2: '#0a2a33', size: 0.9, glow: 6 });
    }
  };
  P.floatText = function (x, y, text, col, space, size) {
    P.spawn({ x: space === 'screen' ? x : x + 0.5, y: space === 'screen' ? y : y + 0.2, vy: space === 'screen' ? -40 : -1.6, drag: 0.03, life: 1.1, text, col, size: size || 0.8, bold: true, space: space || 'world', glow: 4 });
  };
  // vuela desde una celda del mapa hasta un elemento del HUD
  P.flyTo = function (x, y, glyph, col, targetId, onEnd) {
    const el = document.getElementById(targetId);
    const s = TP.R.cellToScreen(x, y);
    let to = { x: window.innerWidth - 100, y: 100 };
    if (el) { const r = el.getBoundingClientRect(); to = { x: r.left + Math.min(r.width, 60) / 2 + 6, y: r.top + r.height / 2 }; }
    P.spawn({ space: 'screen', sx: s.x, sy: s.y, x: s.x, y: s.y, to, bend: TP.rand(-120, 120), life: TP.rand(0.6, 0.85), ch: glyph, col, size: 1.3, glow: 12, bold: true, fade: false, onEnd });
  };
  P.burstScreen = function (x, y, col, n, chs) {
    for (let i = 0; i < n * mult(); i++) {
      const ang = TP.rand(0, Math.PI * 2), sp = TP.rand(40, 160);
      P.spawn({ space: 'screen', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ay: 200, drag: 0.04, life: TP.rand(0.3, 0.7), ch: TP.pickr(chs || ['*', '+', '·']), col, size: 0.7, glow: 5 });
    }
  };

  // partículas ambientales (llamado cada frame desde main)
  let ambT = 0;
  P.ambient = function (dt) {
    const G = TP.G;
    if (!G || !G.map || G.over) return;
    ambT += dt;
    if (ambT < 0.06) return;
    ambT = 0;
    const vis = TP.W.vis(), m = G.map;
    const R = 7, px = G.p.x, py = G.p.y;
    for (let k = 0; k < 3 * mult(); k++) {
      const x = px + TP.randi(-R, R), y = py + TP.randi(-R, R);
      if (!TP.W.inb(x, y)) continue;
      const i = y * m.w + x;
      if (!(vis[i] > 0)) continue;
      const t = m.t[i];
      if (t === T.MAGMA && Math.random() < 0.7) {
        P.spawn({ x: x + Math.random(), y: y + 0.3, vx: TP.rand(-0.5, 0.5), vy: TP.rand(-3, -1.2), life: TP.rand(0.6, 1.4), ch: TP.pickr(['\'', '·', '*', '˙']), col: '#ffc21a', col2: '#ff3b12', size: 0.6, glow: 6 });
      } else if (t === T.WATER && m.t[i - m.w] !== T.WATER && Math.random() < 0.25) {
        P.spawn({ x: x + Math.random(), y: y + 0.6, vy: -0.8, life: 0.8, ch: TP.pickr(['o', '°', '∘']), col: '#9ad8ff', size: 0.5 });
      } else if (t === T.EMPTY && Math.random() < 0.08) {
        P.spawn({ x: x + Math.random(), y: y + Math.random(), vx: TP.rand(-0.1, 0.1), vy: TP.rand(0.1, 0.4), life: TP.rand(1.5, 3), ch: '·', col: '#6e3108', size: 0.6, fadeIn: 0.5 });
      } else if (t === T.GAS && Math.random() < 0.4) {
        P.spawn({ x: x + Math.random(), y: y + Math.random(), vx: TP.rand(-0.3, 0.3), vy: TP.rand(-0.6, -0.1), life: TP.rand(1, 2), ch: TP.pickr(['°', '∙', '˚']), col: '#b4d63c', size: 0.6, fadeIn: 0.4 });
      } else if ((t === T.TOPOLEVITE || t === T.URANIUM) && Math.random() < 0.5) {
        P.spawn({ x: x + Math.random(), y: y + Math.random(), vy: -0.3, life: 1, ch: '·', col: TD[t].fg, size: 0.5, glow: 8, fadeIn: 0.3 });
      }
    }
    // calor alto: humo del Topolev
    if (G.p.heat > 65 && Math.random() < (G.p.heat - 60) / 60) {
      P.spawn({ x: G.p.x + 0.5 + TP.rand(-0.3, 0.3), y: G.p.y + 0.2, vx: TP.rand(-0.5, 0.5), vy: TP.rand(-2.5, -1), life: TP.rand(0.7, 1.3), ch: TP.pickr(['~', '°', '∙']), col: G.p.heat > 95 ? '#ff5a2a' : '#8a7a6e', col2: '#231a14', size: 0.8, grow: 0.4 });
    }
  };

  // ---------- traducción de eventos del mundo ----------
  const A = (n, p) => TP.Audio.play(n, p);
  TP.bus.on('fx', function (e) {
    const R = TP.R;
    switch (e.k) {
      case 'drill': {
        const d = TD[e.t];
        P.debris(e.x, e.y, d.fg, 5 + d.hp, [e.dx, e.dy]);
        if (d.hp >= 4 || e.heat > 60) P.sparks(e.x - e.dx * 0.5, e.y - e.dy * 0.5, 3 + d.hp, e.heat > 60);
        R.jolt(90);
        if (d.hp >= 4) R.addShake(1.5);
        A('drill', { hard: d.hp });
        break;
      }
      case 'break': {
        const d = TD[e.t];
        P.debris(e.x, e.y, d.fg, e.quiet ? 3 : 9);
        if (!e.quiet) A('break');
        break;
      }
      case 'ore': {
        const o = TP.ORES[e.ore];
        for (let i = 0; i < e.n; i++) {
          setTimeout(() => P.flyTo(e.x, e.y, o.glyph, o.color, 'hud-cargo', () => { TP.bus.emit('cargoPulse', e.ore); A('drop'); }), i * 120);
        }
        P.floatText(e.x, e.y, '+' + e.n + ' ' + o.name.toUpperCase(), o.color);
        P.ring(e.x, e.y, 0.8, o.color, '·');
        A('ore', { v: o.value });
        break;
      }
      case 'lost': P.floatText(e.x, e.y, 'BODEGA LLENA', '#ff3b30'); A('deny'); break;
      case 'pickup':
        P.flyTo(e.x, e.y, e.glyph, e.color, 'hud-' + e.target, () => TP.bus.emit('hudPulse', e.target));
        P.floatText(e.x, e.y, e.txt, e.color);
        A('pickup');
        break;
      case 'step': break;
      case 'push': P.debris(e.x, e.y, '#d8ad7c', 4); A('thud'); break;
      case 'deny': R.addShake(1); A('deny'); break;
      case 'hurt':
        P.floatText(e.x, e.y - 0.3, '−' + e.amt, e.heat ? '#ff8c1a' : '#ff3b30', 'world', 0.9);
        if (!e.heat) { R.addShake(6); R.addFlash(0.25, [255, 40, 20]); A('hurt'); }
        else if (Math.random() < 0.5) A('alarm');
        TP.bus.emit('hudPulse', 'hull');
        break;
      case 'explode':
        P.explosion(e.x, e.y, e.r, e.src);
        R.addShake(10 + e.r * 5); R.addFlash(0.45, e.src === 'gas' ? [200, 255, 90] : [255, 200, 120]);
        A('explode', { r: e.r });
        break;
      case 'sonar':
        P.ring(e.x, e.y, e.r * 0.62, '#4de8ff', '·');
        setTimeout(() => P.ring(e.x, e.y, e.r * 0.4, '#4de8ff', '∙'), 140);
        A('sonar');
        break;
      case 'steam': P.steam(e.x, e.y, 14); A('steam'); break;
      case 'bubbles':
        for (let i = 0; i < 3; i++) P.spawn({ x: e.x + 0.3 + Math.random() * 0.4, y: e.y + 0.5, vy: TP.rand(-2, -1), vx: TP.rand(-0.3, 0.3), life: 0.8, ch: TP.pickr(['o', '°']), col: '#9ad8ff', size: 0.5 });
        break;
      case 'fall': P.debris(e.x, e.y + 0.4, '#8a5427', 4 + e.d); R.addShake(Math.min(8, e.d * 1.5)); A('fall'); break;
      case 'thud': P.debris(e.x, e.y + 0.4, '#d8ad7c', 5); A('thud'); break;
      case 'crush': P.debris(e.x, e.y, '#d8ad7c', 10); R.addShake(7); A('thud'); break;
      case 'bomb': P.sparks(e.x, e.y, 6); A('bomb'); break;
      case 'wake': A('wake'); R.addShake(2); break;
      case 'bite': P.debris(e.x, e.y, '#ff3b30', 8); A('bite'); break;
      case 'hitworm': P.debris(e.x, e.y, '#c4521c', 10); P.floatText(e.x, e.y, '−' + e.amt, '#ffb347'); A('bite'); R.addShake(3); break;
      case 'wormdie':
        for (const s of e.segs) { P.debris(s.x, s.y, '#c4521c', 8); P.debris(s.x, s.y, '#6b1a08', 4); }
        R.addShake(6); A('wormdie');
        break;
      case 'wormdig': P.debris(e.x, e.y, TD[e.t].fg, 3); break;
      case 'quake': R.addShake(18); A('quake'); break;
    }
  });

  TP.P = P;
})(window.TP);
