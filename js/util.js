/* ==========================================================
   util.js — espacio de nombres, RNG con semilla, ruido, helpers
   ========================================================== */
'use strict';
window.TP = window.TP || {};

(function (TP) {
  // ---------- hash / RNG ----------
  TP.hash = function (str) {
    str = String(str);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // mezcla final
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  };

  function RNG(seed) {
    if (!(this instanceof RNG)) return new RNG(seed);
    this.s = (typeof seed === 'number' ? seed : TP.hash(seed)) >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  RNG.prototype.next = function () {
    // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.float = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // weighted: [[valor, peso], ...]
  RNG.prototype.weighted = function (pairs) {
    let tot = 0;
    for (const p of pairs) tot += Math.max(0, p[1]);
    if (tot <= 0) return pairs[0][0];
    let r = this.next() * tot;
    for (const p of pairs) { r -= Math.max(0, p[1]); if (r < 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  TP.RNG = RNG;

  // ---------- ruido de valor 2D + fBm ----------
  TP.makeNoise = function (seed) {
    const rng = new RNG(seed);
    const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
    const idx = [];
    for (let i = 0; i < P; i++) { idx.push(i); vals[i] = rng.next(); }
    rng.shuffle(idx);
    for (let i = 0; i < P * 2; i++) perm[i] = idx[i & 255];
    const lat = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
    const sm = t => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = lat(xi, yi), b = lat(xi + 1, yi), c = lat(xi, yi + 1), d = lat(xi + 1, yi + 1);
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct) {
      oct = oct || 4;
      let amp = 1, fr = 1, sum = 0, norm = 0;
      for (let o = 0; o < oct; o++) {
        sum += n2(x * fr, y * fr) * amp; norm += amp;
        amp *= 0.5; fr *= 2.03;
      }
      return sum / norm;
    }
    return { n2, fbm };
  };

  // ---------- helpers numéricos ----------
  TP.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TP.lerp = (a, b, t) => a + (b - a) * t;
  TP.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  TP.easeOut = t => 1 - Math.pow(1 - t, 3);
  TP.easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  TP.rand = (a, b) => a + Math.random() * (b - a);
  TP.randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  TP.pickr = arr => arr[Math.floor(Math.random() * arr.length)];

  // formato de números a la española: 12.262
  TP.fmt = function (n) {
    n = Math.round(n);
    const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '-' : '') + s;
  };
  TP.roman = function (n) {
    const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
    return s;
  };

  // ---------- colores ----------
  TP.hex2rgb = function (h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  TP.rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  TP.mix = (c1, c2, t) => [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
  TP.scale = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];

  // ---------- DOM / texto ASCII ----------
  TP.$ = (s, root) => (root || document).querySelector(s);
  TP.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  TP.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /*  Un "segmento" es {t:texto, c:clases, a:atributos} o un string.
      Una "línea" es un array de segmentos (o un string).
      Todo se mide en caracteres para poder rellenar marcos ASCII. */
  TP.S = (t, c, a) => ({ t: String(t), c: c || '', a: a || '' });
  TP.lineLen = function (line) {
    if (typeof line === 'string') return line.length;
    let n = 0;
    for (const s of line) n += (typeof s === 'string' ? s.length : s.t.length);
    return n;
  };
  TP.lineHTML = function (line) {
    if (typeof line === 'string') return TP.esc(line);
    let h = '';
    for (const s of line) {
      if (typeof s === 'string') h += TP.esc(s);
      else if (!s.c && !s.a) h += TP.esc(s.t);
      else h += '<span class="' + s.c + '" ' + s.a + '>' + TP.esc(s.t) + '</span>';
    }
    return h;
  };
  // recorta una línea a n caracteres
  TP.lineCut = function (line, n) {
    if (typeof line === 'string') return line.slice(0, n);
    const out = []; let k = 0;
    for (const s of line) {
      const seg = typeof s === 'string' ? { t: s, c: '', a: '' } : s;
      if (k >= n) break;
      const take = seg.t.slice(0, n - k);
      out.push({ t: take, c: seg.c, a: seg.a });
      k += take.length;
    }
    return out;
  };
  TP.pad = (s, n, ch) => { s = String(s); while (s.length < n) s += (ch || ' '); return s.slice(0, n); };
  TP.padL = (s, n, ch) => { s = String(s); while (s.length < n) s = (ch || ' ') + s; return s.slice(-n); };
  TP.center = (s, n) => { s = String(s); const l = Math.max(0, Math.floor((n - s.length) / 2)); return TP.pad(' '.repeat(l) + s, n); };

  const FR = {
    s: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', ml: '├', mr: '┤' },
    d: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', ml: '╠', mr: '╣' }
  };
  /* Construye un marco ASCII.
     o = {w, title, lines, style:'s'|'d', id, cls, attrs, titleCls, right}
     Devuelve HTML. w = ancho total en caracteres incluyendo bordes. */
  TP.box = function (o) {
    const f = FR[o.style || 's'];
    const w = o.w, inner = w - 2;
    let h = '<div class="box ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + ' ' + (o.attrs || '') + '>';
    // borde superior con título
    let top = [TP.S(f.tl, 'fr')];
    let used = 1;
    if (o.title) {
      top.push(TP.S(f.h + ' ', 'fr'));
      top.push(TP.S(o.title, o.titleCls || 'frt'));
      top.push(TP.S(' ', 'fr'));
      used += 3 + o.title.length;
    }
    let rt = o.right || '';
    const rlen = typeof rt === 'string' ? rt.length : TP.lineLen(rt);
    const fill = Math.max(0, w - used - 1 - (rlen ? rlen + 2 : 0));
    top.push(TP.S(f.h.repeat(fill), 'fr'));
    if (rlen) { top.push(TP.S(' ', 'fr')); top = top.concat(typeof rt === 'string' ? [TP.S(rt, 'dim')] : rt); top.push(TP.S(f.h, 'fr')); }
    top.push(TP.S(f.tr, 'fr'));
    h += '<div class="ln">' + TP.lineHTML(top) + '</div>';
    for (const L of (o.lines || [])) {
      if (L === '---') {
        h += '<div class="ln">' + TP.lineHTML([TP.S(f.ml + f.h.repeat(inner) + f.mr, 'fr')]) + '</div>';
        continue;
      }
      if (L && L.sep) {
        const t = L.sep;
        const rest = Math.max(0, inner - t.length - 3);
        h += '<div class="ln">' + TP.lineHTML([TP.S(f.ml + f.h + ' ', 'fr'), TP.S(t, 'frt'), TP.S(' ' + f.h.repeat(rest) + f.mr, 'fr')]) + '</div>';
        continue;
      }
      let line = typeof L === 'string' ? [L] : L;
      let len = TP.lineLen(line);
      if (len > inner) { line = TP.lineCut(line, inner); len = inner; }
      const cls = (L && L.cls) ? ' ' + L.cls : '';
      const attrs = (L && L.attrs) ? ' ' + L.attrs : '';
      h += '<div class="ln' + cls + '"' + attrs + '>' + TP.lineHTML([TP.S(f.v, 'fr')]) + TP.lineHTML(line) + ' '.repeat(inner - len) + TP.lineHTML([TP.S(f.v, 'fr')]) + '</div>';
    }
    h += '<div class="ln">' + TP.lineHTML([TP.S(f.bl + f.h.repeat(inner) + f.br, 'fr')]) + '</div>';
    h += '</div>';
    return h;
  };

  // envuelve texto a n columnas (devuelve array de strings)
  TP.wrap = function (text, n) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let cur = '';
      for (const w of words) {
        if ((cur + (cur ? ' ' : '') + w).length > n) { if (cur) out.push(cur); cur = w; }
        else cur += (cur ? ' ' : '') + w;
      }
      out.push(cur);
    }
    return out;
  };

  // ancho de carácter del tipo de letra a un tamaño dado
  let _mctx = null;
  TP.charWidth = function (px) {
    if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
    _mctx.font = px + 'px ' + getComputedStyle(document.body).getPropertyValue('--font');
    return _mctx.measureText('MMMMMMMMMM').width / 10;
  };

  // eventos simples
  TP.bus = {
    h: {},
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); },
    emit(e, d) { (this.h[e] || []).forEach(f => f(d)); }
  };
})(window.TP);
