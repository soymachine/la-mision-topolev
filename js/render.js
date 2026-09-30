/* ==========================================================
   render.js — dibuja el subsuelo en ASCII sobre canvas
   ========================================================== */
'use strict';
(function (TP) {
  const T = TP.T, TD = TP.TD;
  const R = {
    cv: null, ctx: null, dpr: 1,
    cw: 14, ch: 24, font: 20,       // tamaño de celda y fuente
    ox: 0, oy: 0,                   // desplazamiento del mapa en el canvas
    rulerW: 0,
    cam: { x: 0, y: 0, tx: 0, ty: 0 },
    shake: 0, flash: 0, flashCol: [255, 140, 26],
    hover: null, path: null,
    pv: { x: 0, y: 0, jx: 0, jy: 0, jt: 0 },   // posición visual del jugador
    viewW: 0, viewH: 0
  };
  const rgbCache = {};
  const C = h => rgbCache[h] || (rgbCache[h] = TP.hex2rgb(h));
  const cstr = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  R.hash2 = hash2;

  R.init = function (cv) {
    R.cv = cv; R.ctx = cv.getContext('2d');
  };

  R.resize = function () {
    const cv = R.cv, wrap = cv.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    R.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * R.dpr); cv.height = Math.round(h * R.dpr);
    R.viewW = w; R.viewH = h;
    const opt = TP.Save.opts();
    const rows = opt.zoom === 'enorme' ? 18 : opt.zoom === 'grande' ? 22 : 27;
    // tan grande como quepa a lo ancho, sin mostrar menos de "rows" filas
    let ch = TP.clamp(Math.floor(h / rows), 16, 60);
    const fit = () => {
      R.ch = ch;
      R.font = Math.round(ch * 0.84);
      R.cw = Math.ceil(TP.charWidth(R.font));
      R.rulerW = R.cw * 9;
    };
    fit();
    while (ch > 12 && R.cw * TP.CFG.MAP_W + R.rulerW > w - 8) { ch--; fit(); }
    R.ox = Math.max(R.rulerW, Math.floor((w - R.cw * TP.CFG.MAP_W) / 2 + R.rulerW / 2));
    if (R.ox + R.cw * TP.CFG.MAP_W > w) R.ox = R.rulerW;
    R.oy = 0;
  };

  // conversión celda → píxel de pantalla (CSS px, relativo a la ventana)
  R.cellToScreen = function (x, y) {
    const rect = R.cv.getBoundingClientRect();
    return { x: rect.left + R.ox + x * R.cw - R.cam.x + R.cw / 2, y: rect.top + R.oy + y * R.ch - R.cam.y + R.ch / 2 };
  };
  R.screenToCell = function (sx, sy) {
    const rect = R.cv.getBoundingClientRect();
    const x = Math.floor((sx - rect.left - R.ox + R.cam.x) / R.cw);
    const y = Math.floor((sy - rect.top - R.oy + R.cam.y) / R.ch);
    return { x, y };
  };

  R.snapCamera = function () {
    const G = TP.G; if (!G) return;
    R.pv.x = G.p.x; R.pv.y = G.p.y;
    R.cam.y = R.cam.ty = camTarget();
  };
  function camTarget() {
    const G = TP.G, mh = G.map.h * R.ch;
    let ty = R.pv.y * R.ch + R.ch / 2 - R.viewH * 0.45;
    return TP.clamp(ty, -R.ch, Math.max(-R.ch, mh - R.viewH + R.ch));
  }

  R.addShake = (v) => { if (TP.Save.opts().shake) R.shake = Math.min(18, R.shake + v); };
  R.addFlash = (v, col) => { R.flash = Math.min(0.8, R.flash + v); if (col) R.flashCol = col; };

  // glifos para daño parcial (densidad decreciente)
  const CRACK = { '█': ['█', '▓', '▒', '░'], '▓': ['▓', '▒', '░', '·'], '▒': ['▒', '░', '·', '·'], '░': ['░', '·', '·', '·'], '●': ['●', '○', '○', '·'] };

  function concreteGlyph(m, x, y) {
    const c = (xx, yy) => { const t = TP.W.tile(xx, yy); return t === T.CONCRETE; };
    const L = c(x - 1, y), Rr = c(x + 1, y), U = c(x, y - 1), D = c(x, y + 1);
    if (Rr && D && !L && !U) return '╔';
    if (L && D && !Rr && !U) return '╗';
    if (Rr && U && !L && !D) return '╚';
    if (L && U && !Rr && !D) return '╝';
    if ((U || D) && !L && !Rr) return '║';
    if (L && Rr && D && !U) return '╦';
    if (L && Rr && U && !D) return '╩';
    if (U && D && Rr && !L) return '╠';
    if (U && D && L && !Rr) return '╣';
    return '═';
  }

  R.draw = function (now) {
    const G = TP.G, ctx = R.ctx;
    if (!G || !G.map) return;
    const m = G.map, cw = R.cw, ch = R.ch, dpr = R.dpr;
    const t = now / 1000;
    const vis = TP.W.vis(), sg = TP.W.sonarGlow();

    // posición visual del jugador (interpolación)
    const k = 1 - Math.pow(0.0008, (R._dt || 16) / 1000);
    R.pv.x += (G.p.x - R.pv.x) * Math.min(1, k * 1.6);
    R.pv.y += (G.p.y - R.pv.y) * Math.min(1, k * 1.6);
    if (Math.abs(G.p.x - R.pv.x) > 6 || Math.abs(G.p.y - R.pv.y) > 12) { R.pv.x = G.p.x; R.pv.y = G.p.y; }
    R.cam.ty = camTarget();
    R.cam.y += (R.cam.ty - R.cam.y) * Math.min(1, k);
    R.cam.x = 0;

    let sx = 0, sy = 0;
    if (R.shake > 0.1) { sx = (Math.random() - 0.5) * R.shake; sy = (Math.random() - 0.5) * R.shake; R.shake *= 0.88; } else R.shake = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070504';
    ctx.fillRect(0, 0, R.viewW, R.viewH);
    ctx.translate(Math.round(sx), Math.round(sy));

    const camY = R.cam.y;
    const y0 = Math.max(0, Math.floor(camY / ch) - 1), y1 = Math.min(m.h - 1, Math.ceil((camY + R.viewH) / ch) + 1);
    ctx.font = R.font + 'px ' + getFont();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // regla de profundidad
    drawRuler(ctx, y0, y1, camY);

    // animaciones de cantos activas
    const animMap = {};
    const ANIM_MS = 110;
    for (const a of TP.W.anims) {
      const e = now - a.t0;
      if (e < ANIM_MS) animMap[a.tx + ',' + a.ty] = { a, f: e / ANIM_MS };
    }
    if (TP.W.anims.length && now - TP.W.anims[TP.W.anims.length - 1].t0 > 400) TP.W.anims.length = 0;

    const glowCells = [];
    for (let y = y0; y <= y1; y++) {
      const py = R.oy + y * ch - camY;
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x, px = R.ox + x * cw;
        const seen = m.seen[i];
        const tt = m.t[i];
        if (!seen) {
          const hh = hash2(x, y);
          if (hh < 0.5) { ctx.fillStyle = 'rgba(110,52,14,' + (0.06 + hh * 0.14).toFixed(3) + ')'; ctx.fillText(hh < 0.08 ? '▒' : '░', px + cw / 2, py + ch / 2); }
          continue;
        }
        const d = TD[tt];
        let b = vis[i] > 0 ? vis[i] : 0.36;
        if (vis[i] > 0) b *= 0.94 + 0.06 * Math.sin(t * 7 + x * 0.3);
        const hv = hash2(x, y);
        // fondo
        if (d.bg) {
          let bgc = C(d.bg);
          if (tt === T.MAGMA) { const f = 0.5 + 0.5 * Math.sin(t * 2 + x * 0.6 + y * 0.4); bgc = TP.mix(C('#2a0600'), C('#5a1402'), f); b = Math.max(b, 0.75); }
          ctx.fillStyle = cstr(bgc, Math.min(1, b * 1.1));
          ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
        }
        if (tt === T.EMPTY) {
          if (hv < 0.06 && b > 0.3) { ctx.fillStyle = cstr(C('#3a1a06'), b * 0.9); ctx.fillText('·', px + cw / 2, py + ch / 2); }
          continue;
        }
        let g = d.glyph, fg = C(d.fg), a = b;
        switch (tt) {
          case T.DIRT: case T.ROCK: case T.GRANITE: case T.BASALT: case T.OBSIDIAN: {
            fg = TP.scale(fg, 0.82 + hv * 0.3);
            const dmg = m.hp[i];
            if (dmg > 0) { const f = dmg / d.hp; const arr = CRACK[g]; if (arr) g = arr[Math.min(3, 1 + Math.floor(f * 3))]; }
            break;
          }
          case T.BEDROCK: fg = TP.scale(fg, 0.8 + hv * 0.4); g = hv < 0.5 ? '#' : '╬'; break;
          case T.CONCRETE: g = concreteGlyph(m, x, y); a = Math.max(b, 0.5); break;
          case T.BOULDER: {
            const an = animMap[x + ',' + y];
            if (an) {
              const f = TP.easeOut(an.f);
              const ax = R.ox + TP.lerp(an.a.fx, x, f) * cw, ay = R.oy + TP.lerp(an.a.fy, y, f) * ch - camY;
              ctx.fillStyle = cstr(fg, a);
              ctx.fillText(g, ax + cw / 2, ay + ch / 2);
              continue;
            }
            if (m.hp[i] > 0) g = CRACK['●'][Math.min(3, m.hp[i])];
            break;
          }
          case T.WATER: {
            const w = Math.sin(t * 2.2 + x * 0.9 + y * 0.3);
            g = w > 0.3 ? '≈' : w < -0.4 ? '~' : '≈';
            fg = TP.mix(C('#2f7fb8'), C('#9ad8ff'), 0.5 + 0.5 * w);
            if (TP.W.tile(x, y - 1) !== T.WATER && hv > 0.4) g = '~';
            break;
          }
          case T.MAGMA: {
            const f = 0.5 + 0.5 * Math.sin(t * 3.1 + x * 0.7 + y * 0.5 + hv * 6);
            g = f > 0.66 ? '≈' : f > 0.33 ? '~' : '≋';
            fg = TP.mix(C('#ff3b12'), C('#ffc21a'), f);
            a = Math.max(b, 0.8);
            if (vis[i] > 0 && hv < 0.35) glowCells.push([px, py, g, fg, 10]);
            break;
          }
          case T.GAS: {
            const ph = t * 1.5 + hv * 10;
            g = ['°', '∙', '·', '˚'][Math.floor(ph) % 4];
            a = b * (0.55 + 0.45 * Math.sin(ph * 2));
            break;
          }
          case T.URANIUM: case T.TOPOLEVITE: {
            const pulse = 0.75 + 0.25 * Math.sin(t * (tt === T.URANIUM ? 2.5 : 1.7) + hv * 5);
            a = Math.max(b, 0.45) * pulse + (sg[i] ? 0.4 : 0);
            if (vis[i] > 0 || sg[i]) glowCells.push([px, py, g, fg, tt === T.TOPOLEVITE ? 14 : 10]);
            const dmg = m.hp[i];
            if (dmg > 0 && hv > 0.5) g = '·';
            break;
          }
          case T.IRON: case T.COPPER: case T.GOLD:
            if (sg[i]) a = Math.min(1, b + 0.6);
            if (tt === T.GOLD && vis[i] > 0 && Math.sin(t * 3 + hv * 20) > 0.93) glowCells.push([px, py, g, fg, 8]);
            break;
          case T.CRATE: a = Math.max(b, 0.35) * (Math.sin(t * 4 + hv * 6) > 0 ? 1 : 0.6); break;
          case T.BARREL: break;
          case T.STATION: case T.RELIC:
            a = Math.max(b, 0.6) * (0.8 + 0.2 * Math.sin(t * 3));
            glowCells.push([px, py, g, fg, 16]);
            break;
        }
        ctx.fillStyle = cstr(fg, TP.clamp(a, 0, 1));
        ctx.fillText(g, px + cw / 2, py + ch / 2);
      }
    }

    // brillos (sombras)
    if (glowCells.length) {
      ctx.save();
      for (const [px, py, g, fg, bl] of glowCells) {
        ctx.shadowColor = cstr(fg, 0.9); ctx.shadowBlur = bl;
        ctx.fillStyle = cstr(fg, 0.9);
        ctx.fillText(g, px + cw / 2, py + ch / 2);
      }
      ctx.restore();
    }

    // bombas
    for (const bm of G.bombs) {
      const px = R.ox + bm.x * cw, py = R.oy + bm.y * ch - camY;
      const on = Math.sin(now / (bm.t <= 1 ? 50 : 110)) > 0;
      ctx.save();
      ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = on ? 14 : 4;
      ctx.fillStyle = on ? '#ff3b30' : '#ffd59a';
      ctx.font = 'bold ' + R.font + 'px ' + getFont();
      ctx.fillText(String(bm.t), px + cw / 2, py + ch / 2);
      ctx.restore();
    }

    // gusanos
    for (const w of G.worms) {
      if (w.hp <= 0) continue;
      const f = w.prev && w.t0 ? TP.clamp((now - w.t0) / 140, 0, 1) : 1;
      for (let s = w.segs.length - 1; s >= 0; s--) {
        const sg0 = w.segs[s];
        const i = sg0.y * m.w + sg0.x;
        if (!(vis[i] > 0)) continue;
        let x = sg0.x, y = sg0.y;
        if (f < 1 && w.prev && w.prev[s]) { x = TP.lerp(w.prev[s].x, sg0.x, TP.easeOut(f)); y = TP.lerp(w.prev[s].y, sg0.y, TP.easeOut(f)); }
        const px = R.ox + x * cw, py = R.oy + y * ch - camY;
        const head = s === 0;
        const col = head ? (w.awake ? '#ff3b30' : '#b8402a') : s === w.segs.length - 1 ? '#7a2a12' : '#c4521c';
        const gl = head ? (w.awake ? '@' : 'ó') : s === w.segs.length - 1 ? '∙' : (s % 2 ? 'o' : 'O');
        ctx.fillStyle = 'rgba(20,4,0,.85)';
        ctx.fillRect(px, py, cw, ch);
        ctx.fillStyle = col;
        ctx.fillText(gl, px + cw / 2 + (head && w.awake ? Math.sin(now / 60) * 1.2 : 0), py + ch / 2);
      }
    }

    // jugador
    if (!G.over || G.over.cause === 'victory') {
      const jit = now < R.pv.jt ? (Math.random() - 0.5) * 2.2 : 0;
      const px = R.ox + R.pv.x * cw + jit, py = R.oy + R.pv.y * ch - camY + (now < R.pv.jt ? (Math.random() - 0.5) * 1.5 : 0);
      const hot = TP.clamp((G.p.heat - 60) / 50, 0, 1);
      const bgc = TP.mix(C('#ff8c1a'), C('#ff3b30'), hot * (0.6 + 0.4 * Math.sin(now / 90)));
      ctx.save();
      ctx.shadowColor = cstr(bgc, 0.9); ctx.shadowBlur = 16;
      ctx.fillStyle = cstr(bgc, 1);
      ctx.fillRect(px + 1, py + 1, cw - 2, ch - 2);
      ctx.restore();
      const gl = { down: '▼', up: '▲', left: '◄', right: '►' }[G.p.face];
      ctx.fillStyle = '#0a0503';
      ctx.font = 'bold ' + R.font + 'px ' + getFont();
      ctx.fillText(gl, px + cw / 2, py + ch / 2 + 1);
      ctx.font = R.font + 'px ' + getFont();
    }

    // partículas del mundo
    TP.P.drawWorld(ctx, R, camY, now);

    // hover y ruta
    if (R.path && R.path.length) {
      ctx.fillStyle = 'rgba(255,179,71,.55)';
      for (const [x, y] of R.path) ctx.fillText('·', R.ox + x * cw + cw / 2, R.oy + y * ch - camY + ch / 2);
    }
    if (R.hover && TP.W.inb(R.hover.x, R.hover.y)) {
      const { x, y } = R.hover;
      const px = R.ox + x * cw, py = R.oy + y * ch - camY;
      const i = y * m.w + x;
      const tt = m.t[i];
      const adj = Math.abs(x - G.p.x) + Math.abs(y - G.p.y) === 1;
      ctx.fillStyle = adj ? 'rgba(255,140,26,.92)' : 'rgba(255,140,26,.45)';
      ctx.fillRect(px, py, cw, ch);
      ctx.fillStyle = '#070504';
      const g = m.seen[i] ? (tt === T.CONCRETE ? concreteGlyph(m, x, y) : TD[tt].glyph) : ' ';
      ctx.fillText(g === ' ' ? (adj ? '+' : '·') : g, px + cw / 2, py + ch / 2);
      // esquinas ASCII
      ctx.fillStyle = '#ffb347';
      ctx.font = Math.round(R.font * 0.6) + 'px ' + getFont();
      ctx.fillText('┌', px - 1, py + 2); ctx.fillText('┐', px + cw + 1, py + 2);
      ctx.fillText('└', px - 1, py + ch - 2); ctx.fillText('┘', px + cw + 1, py + ch - 2);
      ctx.font = R.font + 'px ' + getFont();
    }

    // destello
    if (R.flash > 0.01) {
      ctx.fillStyle = cstr(R.flashCol, R.flash);
      ctx.fillRect(-20, -20, R.viewW + 40, R.viewH + 40);
      R.flash *= 0.86;
    }
    // calor: bruma roja en los bordes
    if (G.p.heat > 70 && !G.over) {
      const f = TP.clamp((G.p.heat - 70) / 40, 0, 1) * (0.6 + 0.4 * Math.sin(now / 180));
      const grd = ctx.createRadialGradient(R.viewW / 2, R.viewH / 2, Math.min(R.viewW, R.viewH) * 0.3, R.viewW / 2, R.viewH / 2, Math.max(R.viewW, R.viewH) * 0.7);
      grd.addColorStop(0, 'rgba(255,40,10,0)');
      grd.addColorStop(1, 'rgba(255,40,10,' + (0.35 * f).toFixed(3) + ')');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, R.viewW, R.viewH);
    }
  };

  function drawRuler(ctx, y0, y1, camY) {
    const ch = R.ch, cw = R.cw;
    const x = R.ox - cw * 1.2;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = Math.round(R.font * 0.72) + 'px ' + getFont();
    const G = TP.G;
    for (let y = y0; y <= y1; y++) {
      const py = R.oy + y * ch - camY + ch / 2;
      if (y % 5 === 0) {
        const dm = TP.W.depthM(y);
        ctx.fillStyle = y === G.p.y ? '#ffb347' : 'rgba(194,90,14,.55)';
        ctx.fillText(TP.fmt(dm) + ' m ─', x, py);
      } else {
        ctx.fillStyle = 'rgba(110,49,8,.5)';
        ctx.fillText('·', x - cw * 0.3, py);
      }
    }
    // marcador del jugador
    const py = R.oy + R.pv.y * ch - camY + ch / 2;
    ctx.fillStyle = '#ff8c1a';
    ctx.textAlign = 'left';
    ctx.font = R.font + 'px ' + getFont();
    ctx.fillText('►', x + 2, py);
    ctx.restore();
  }

  let fontName = null;
  function getFont() {
    if (!fontName) fontName = getComputedStyle(document.body).getPropertyValue('--font').trim() || 'monospace';
    return fontName;
  }
  R.getFont = getFont;
  R.jolt = (ms) => { R.pv.jt = performance.now() + (ms || 90); };

  TP.R = R;
})(window.TP);
