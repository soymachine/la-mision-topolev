/* ==========================================================
   ui.js — HUD lateral, tooltips (rollover), drag & drop, avisos
   ========================================================== */
'use strict';
(function (TP) {
  const S = TP.S;
  const UI = { HW: 42, bars: {}, tipEl: null };
  const $ = TP.$;

  // ---------------- tamaño del HUD ----------------
  UI.layout = function () {
    const hud = $('#hud');
    const w = window.innerWidth, h = window.innerHeight;
    const lines = 50;
    let fs = Math.min(17, Math.floor(h / (lines * 1.18)), Math.floor((w * 0.36) / (UI.HW * 0.61)));
    fs = Math.max(9, fs);
    hud.style.fontSize = fs + 'px';
    UI.hudFs = fs;
    document.documentElement.style.setProperty('--fs', Math.max(12, Math.min(17, Math.floor(Math.min(w / 110, h / 44)))) + 'px');
  };

  // ---------------- barras ASCII ----------------
  function bar(val, max, len, cols) {
    const f = TP.clamp(val / max, 0, 1);
    const full = f * len;
    const n = Math.floor(full);
    const part = full - n;
    const segs = [];
    for (let i = 0; i < len; i++) {
      let ch = '░', c = 'dd';
      if (i < n) { ch = '█'; c = cols(i / len); }
      else if (i === n && part > 0.05) { ch = part > 0.66 ? '▓' : part > 0.33 ? '▒' : '░'; c = cols(i / len); }
      segs.push(S(ch, c));
    }
    return segs;
  }
  const hullCol = f => (UI.bars.hull.v / TP.ST.hullMax < 0.3 ? 'red' : 'hi');
  const fuelCol = () => (UI.bars.fuel.v / TP.ST.fuelMax < 0.2 ? 'red' : 'gold');
  const heatCol = f => (f > 0.8 ? 'red' : f > 0.55 ? 'hi' : 'mid');

  function barLine(key) {
    const G = TP.G, st = TP.ST, b = UI.bars[key];
    const L = 20;
    if (key === 'hull') return [S(' CASCO  ', 'dim'), ...bar(b.v, st.hullMax, L, hullCol), S(' ' + TP.padL(Math.round(b.v), 3) + '/' + TP.pad(st.hullMax, 4), b.v / st.hullMax < 0.3 ? 'red b' : 'xhi')];
    if (key === 'fuel') return [S(' COMB.  ', 'dim'), ...bar(b.v, st.fuelMax, L, fuelCol), S(' ' + TP.padL(Math.round(b.v), 3) + '/' + TP.pad(st.fuelMax, 4), b.v / st.fuelMax < 0.2 ? 'red b blink' : 'xhi')];
    const amb = TP.W.ambient();
    const hot = b.v >= 100;
    return [S(' CALOR  ', 'dim'), ...bar(b.v, 100, L, heatCol), S(' ' + TP.padL(Math.round(b.v), 3) + '°', hot ? 'red b blink' : b.v > 75 ? 'red b' : 'xhi'), S(' a' + TP.pad(Math.round(amb), 3), 'dd')];
  }

  UI.initBars = function () {
    const G = TP.G;
    UI.bars = { hull: { v: G.p.hull }, fuel: { v: G.p.fuel }, heat: { v: G.p.heat } };
  };

  // ---------------- construcción del HUD ----------------
  UI.renderHUD = function () {
    const G = TP.G, st = TP.ST;
    if (!G || !G.map) return;
    const W = UI.HW, inner = W - 2;
    const hud = $('#hud');
    if (!UI.bars.hull) UI.initBars();
    const hn = TP.HORIZON_NAMES[G.h];
    let html = '';

    // cabecera
    const hdr = [
      [S(' HORIZONTE ', 'dim'), S(TP.pad(TP.roman(G.h + 1), 5), 'xhi b'), S(TP.pad(hn, inner - 16), 'hi')],
      [S(' PROF. ', 'dim'), S(TP.padL(TP.fmt(TP.W.depthM()), 6) + ' m', 'xhi b', 'id="hud-depth"'), S('   OBJ. ', 'dim'), S(TP.fmt(TP.CFG.FINAL_DEPTH) + ' m', 'mid')],
      { sep: 'ESTADO' },
      Object.assign(barLine('hull'), { attrs: 'id="hud-hull" data-tip="txt:hull"' }),
      Object.assign(barLine('fuel'), { attrs: 'id="hud-fuel" data-tip="txt:fuel"' }),
      Object.assign(barLine('heat'), { attrs: 'id="hud-heat" data-tip="txt:heat"' })
    ];
    // bodega
    const used = TP.W.cargoUsed();
    hdr.push({ sep: 'BODEGA ' + used + '/' + st.cargo });
    const oreCell = k => {
      const o = TP.ORES[k], n = G.cargo[k];
      return [S(' ' + o.glyph + ' ', o.cls + (n ? '' : ' dd')), S(TP.pad(o.name, 10), n ? 'hi' : 'dd', 'class="hov" data-tip="ore:' + k + '"'), S(TP.padL(n, 3) + '  ', n ? 'xhi b' : 'dd')];
    };
    const cargoLines = [
      [...oreCell('iron'), ...oreCell('copper')],
      [...oreCell('gold'), ...oreCell('uranium')],
      [...oreCell('topolevite'), S('   ', ''), S(TP.padL(TP.fmt(G.rublos) + ' ₽', 12), 'gold b', 'id="hud-rub" data-tip="txt:rub"')]
    ];
    cargoLines[0].attrs = 'id="hud-cargo"';
    hdr.push(...cargoLines);

    // módulos
    hdr.push({ sep: 'MÓDULOS' });
    for (const slot of TP.SLOTS) {
      const m = G.equip[slot];
      const type = slot.startsWith('aux') ? 'aux' : slot;
      const gl = TP.MOD_TYPES[type].glyph;
      let line;
      if (m) {
        const nm = TP.Items.fullName(m);
        line = [S(' ' + gl + ' ', TP.RARITY[m.rarity].cls), S(TP.pad(TP.SLOT_NAMES[slot], 9), 'dim'), S(TP.pad(nm, inner - 13), TP.RARITY[m.rarity].cls + ' drag', 'data-drag="mod:' + m.id + '" data-tip="mod:' + m.id + '"')];
      } else {
        line = [S(' ' + gl + ' ', 'dd'), S(TP.pad(TP.SLOT_NAMES[slot], 9), 'dd'), S(TP.pad('[ vacío ]', inner - 13), 'dd')];
      }
      line.attrs = 'data-drop="slot:' + slot + '" class="drop"';
      line.cls = 'drop';
      hdr.push(line);
    }
    // inventario
    const inv = [S(' INV ', 'dim')];
    for (let i = 0; i < 6; i++) {
      const m = G.inv[i];
      if (m) inv.push(S('[' + TP.MOD_TYPES[m.type].glyph + ']', TP.RARITY[m.rarity].cls + ' drag btn', 'data-drag="mod:' + m.id + '" data-tip="mod:' + m.id + '" data-click="equip:' + m.id + '"'));
      else inv.push(S('[·]', 'dd'));
    }
    inv.push(S(' '));
    inv.push(S(G.inStation ? '[RECICLAR]' : '[QUEMAR]', 'mid drop', 'data-drop="scrap" data-tip="txt:scrap"'));
    const invL = inv; invL.attrs = 'id="hud-mods" data-drop="inv"'; invL.cls = 'drop';
    hdr.push(invL);

    // equipo
    hdr.push({ sep: 'EQUIPO' });
    const sonarReady = G.p.sonarCd <= 0;
    hdr.push([
      S(' [E] ', 'dim'), S('DINAMITA ×' + G.dyn, G.dyn ? 'red b btn' : 'dd', 'id="hud-dyn" data-click="dyn" data-tip="txt:dyn"'),
      S('   [Q] ', 'dim'), S('SONAR ' + (sonarReady ? 'LISTO' : '(' + G.p.sonarCd + ')'), sonarReady ? 'cyan b btn' : 'dd', 'data-click="sonar" data-tip="txt:sonar"')
    ]);
    hdr.push([S(' [ESPACIO] ', 'dim'), S('ESPERAR/ENFRIAR', 'hi btn', 'data-click="wait" data-tip="txt:wait"'), S('  [ESC] ', 'dim'), S('MENÚ', 'hi btn', 'data-click="menu"')]);

    // plan
    hdr.push({ sep: 'PLAN QUINQUENAL' });
    if (G.quota) {
      const q = G.quota, o = TP.ORES[q.ore];
      const have = G.cargo[q.ore];
      const ok = have + q.delivered >= q.amount;
      hdr.push([S(' Entregar ', 'dim'), S(q.amount + '× ', 'xhi b'), S(o.glyph + ' ' + o.name, o.cls + ' b'), S('  bodega ', 'dim'), S((have + q.delivered) + '/' + q.amount, ok ? 'green b' : 'red b')]);
    } else hdr.push([S(G.map.final ? ' Sin plan. Sólo descienda.' : ' Sin plan asignado.', 'dim')]);
    const strikes = [S(' Reprimendas ', 'dim')];
    for (let i = 0; i < 3; i++) strikes.push(S(i < G.strikes ? '■' : '□', i < G.strikes ? 'red b' : 'dd'));
    strikes.push(S('  Órdenes ', 'dim'));
    if (!G.medals.length) strikes.push(S('—', 'dd'));
    for (const k of G.medals) strikes.push(S('★', 'gold b hov', 'data-tip="medal:' + k + '"'));
    hdr.push(strikes);

    // registro
    hdr.push({ sep: 'REGISTRO' });
    const logLines = [];
    const recent = G.log.slice(-9);
    for (let i = recent.length - 1; i >= 0 && logLines.length < 8; i--) {
      const e = recent[i];
      const wr = TP.wrap(e.m, inner - 3);
      for (let j = wr.length - 1; j >= 0 && logLines.length < 8; j--) logLines.unshift({ t: wr[j], c: e.c, first: j === 0, age: recent.length - 1 - i });
    }
    while (logLines.length < 8) logLines.unshift(null);
    for (const L of logLines) {
      if (!L) { hdr.push(' '); continue; }
      const c = L.age === 0 ? (L.c || 'xhi') : L.age < 3 ? (L.c || 'hi') + '' : 'dim';
      hdr.push([S(L.first ? ' › ' : '   ', 'dim'), S(L.t, c + (L.age > 3 ? ' dd' : ''))]);
    }

    html += TP.box({ w: W, title: 'KT-1 «TOPOLEV»', right: 'T' + G.turn, lines: hdr });
    hud.innerHTML = html;
  };

  // actualiza sólo las barras (animación)
  UI.tickHUD = function (dt) {
    const G = TP.G;
    if (!G || !UI.bars.hull) return;
    const k = 1 - Math.pow(0.001, dt);
    for (const key of ['hull', 'fuel', 'heat']) {
      const b = UI.bars[key], target = G.p[key];
      if (Math.abs(b.v - target) < 0.05) { if (b.v !== target) { b.v = target; drawBar(key); } continue; }
      b.v += (target - b.v) * Math.min(1, k * 1.5);
      drawBar(key);
    }
  };
  function drawBar(key) {
    const el = document.getElementById('hud-' + key);
    if (!el) return;
    const inner = UI.HW - 2;
    const line = barLine(key);
    const len = TP.lineLen(line);
    el.innerHTML = TP.lineHTML([S('│', 'fr')]) + TP.lineHTML(line) + ' '.repeat(Math.max(0, inner - len)) + TP.lineHTML([S('│', 'fr')]);
  }

  // pulsos visuales al recibir cosas
  function pulse(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.animate([{ background: 'rgba(255,140,26,.35)' }, { background: 'transparent' }], { duration: 450, easing: 'ease-out' });
  }
  TP.bus.on('cargoPulse', () => pulse('hud-cargo'));
  TP.bus.on('hudPulse', k => pulse('hud-' + k));

  // ---------------- tooltips ----------------
  UI.tipHTML = function (key) {
    const G = TP.G, st = TP.ST;
    const [kind, ...rest] = key.split(':');
    const arg = rest.join(':');
    const w = 38;
    if (kind === 'mod') {
      const f = TP.W.findMod(arg);
      if (!f) return null;
      return modTip(f.m, f.where, w);
    }
    if (kind === 'ore') {
      const o = TP.ORES[arg];
      const lines = [
        [S(' ' + o.glyph + ' ', o.cls + ' b'), S(o.name, 'xhi b')],
        [S(' Precio base: ', 'dim'), S(TP.W.orePrice(arg) + ' ₽/u', 'gold')],
        [S(' En bodega: ', 'dim'), S(String(G.cargo[arg]), 'xhi')]
      ];
      if (arg === 'uranium') lines.push([S(' Irradia calor en la bodega.', 'green')]);
      if (G.quota && G.quota.ore === arg) lines.push([S(' ★ Mineral del Plan Quinquenal', 'red b')]);
      return TP.box({ w, title: 'MINERAL', lines });
    }
    if (kind === 'medal') {
      const md = TP.MEDALS.find(m => m.key === arg);
      return TP.box({ w, title: 'ORDEN', lines: [[S(' ★ ', 'gold b'), S(md.name, 'xhi b')], ...TP.wrap(md.desc, w - 4).map(l => [S(' ' + l, 'hi')])] });
    }
    if (kind === 'txt') {
      const T = {
        hull: 'Integridad del casco. A cero, el Topolev queda sepultado. Repara en la Estación o con cajas.',
        fuel: 'Moverse y perforar consume combustible. Subir cuesta el doble. Busca bidones (Б).',
        heat: 'Perforar calienta. El calor tiende al ambiente (a) de la profundidad. Esperar y el agua enfrían. A 100° el casco sufre.',
        rub: 'Rublos. Vende mineral en la Estación para comprar módulos, reparaciones y combustible.',
        dyn: 'Dinamita [E]: explota a los 3 turnos y rompe casi todo. Prende el gas. ¡Aléjate!',
        sonar: 'Sonar [Q]: revela un radio grande a través de la roca. Cuesta ' + st.sonarCost + ' de combustible y hace ruido.',
        wait: 'Esperar un turno [ESPACIO]: enfría ' + (st.cooling * 2.5).toFixed(1) + '° en lugar de ' + st.cooling + '°.',
        scrap: G.inStation ? 'Arrastra aquí un módulo para reciclarlo por rublos.' : 'Arrastra aquí un módulo para quemarlo como combustible de emergencia.'
      };
      return TP.box({ w, lines: TP.wrap(T[arg] || arg, w - 4).map(l => [S(' ' + l, 'hi')]) });
    }
    if (kind === 'raw') return arg;
    return null;
  };

  function modTip(m, where, w) {
    const r = TP.RARITY[m.rarity];
    const lines = [];
    lines.push([S(' ' + TP.MOD_TYPES[m.type].glyph + ' ', r.cls), S(m.name, 'xhi b')]);
    lines.push([S('   ' + m.model + ' «' + m.ep + '»', 'hi')]);
    lines.push([S('   ' + r.name.toUpperCase(), r.cls)]);
    lines.push('---');
    const cmpSlot = m.type === 'aux' ? null : m.type;
    const cur = cmpSlot && TP.G.equip[cmpSlot] && TP.G.equip[cmpSlot].id !== m.id ? TP.G.equip[cmpSlot] : null;
    const curL = cur ? TP.Items.statLines(cur) : null;
    TP.Items.statLines(m).forEach((s, i) => {
      if (!s.k) { TP.wrap(s.v, w - 5).forEach(l => lines.push([S('  ' + l, 'cyan')])); return; }
      const L = [S('  ' + TP.pad(s.k, 14), 'dim'), S(TP.pad(String(s.v), 12), 'xhi b')];
      if (curL && curL[i] && curL[i].n !== null && s.n !== curL[i].n) {
        const better = (s.n - curL[i].n) * s.better > 0;
        L.push(S(better ? '▲ ' : '▼ ', better ? 'green b' : 'red b'));
        L.push(S(String(curL[i].v).slice(0, 6), 'dd'));
      }
      lines.push(L);
    });
    lines.push('---');
    if (where === 'shop') lines.push([S('  Precio ', 'dim'), S(m.price + ' ₽', TP.G.rublos >= m.price ? 'gold b' : 'red b')]);
    else if (TP.G.inStation) lines.push([S('  Reciclaje ', 'dim'), S(Math.round(m.price * 0.35) + ' ₽', 'gold')]);
    const hint = where === 'shop' ? 'Clic o arrastra a la bodega para comprar.' : where === 'inv' ? 'Clic para equipar · arrastra a una ranura.' : 'Arrastra al inventario o a otra ranura.';
    TP.wrap(hint, w - 4).forEach(l => lines.push([S('  ' + l, 'dd')]));
    return TP.box({ w, title: 'MÓDULO', lines });
  }

  UI.showTip = function (html, x, y) {
    const el = $('#tooltip');
    if (!html) { el.classList.add('hidden'); return; }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.style.fontSize = (UI.hudFs || 14) + 'px';
    el.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    let tx = x + 18, ty = y + 14;
    if (tx + r.width > window.innerWidth - 6) tx = x - r.width - 14;
    if (ty + r.height > window.innerHeight - 6) ty = window.innerHeight - r.height - 6;
    el.style.left = Math.max(4, tx) + 'px';
    el.style.top = Math.max(4, ty) + 'px';
  };
  UI.hideTip = () => { const el = $('#tooltip'); el.classList.add('hidden'); el._html = null; };

  // tooltip para una celda del mapa
  UI.cellTip = function (x, y) {
    const info = TP.W.cellInfo(x, y);
    if (!info) return null;
    const G = TP.G, st = TP.ST, w = 34;
    if (!info.seen) return TP.box({ w, lines: [[S(' Roca sin explorar.', 'dim')], [S(' Usa el sonar [Q] para ver.', 'dd')]] });
    const d = info.def, L = [];
    if (info.player) {
      L.push([S(' ▼ ', 'hi b'), S('KT-1 «Topolev»', 'xhi b')]);
      L.push([S(' Tú. Rodeado de roca.', 'dim')]);
    } else if (info.worm && info.visible) {
      L.push([S(' @ ', 'red b'), S('Olgói-Jorjói', 'red b')]);
      L.push([S(' Gusano de las profundidades.', 'dim')]);
      L.push([S(' Vida ' + Math.max(0, info.worm.hp) + '/' + info.worm.maxHp + (info.worm.awake ? ' · DESPIERTO' : ' · dormido'), info.worm.awake ? 'red' : 'mid')]);
      L.push([S(' Embístelo con la broca.', 'dd')]);
    } else {
      const glyph = d.glyph === ' ' ? '·' : d.glyph;
      L.push([S(' ' + glyph + ' ', 'b', 'style="color:' + d.fg + '"'), S(d.name, 'xhi b')]);
      TP.wrap(d.desc || '', w - 4).forEach(l => L.push([S(' ' + l, 'hi')]));
      if (d.drill) {
        L.push('---');
        const left = Math.max(0, d.hp - info.dmg);
        const hits = Math.ceil(left / st.power);
        if (d.tier > st.tier) L.push([S(' ✕ Broca insuficiente (nivel ' + d.tier + ')', 'red b')]);
        else {
          L.push([S(' Dureza ' + d.hp + (info.dmg ? ' (resta ' + left + ')' : '') + ' → ', 'dim'), S(hits + (hits === 1 ? ' golpe' : ' golpes'), 'xhi b')]);
          L.push([S(' Calor ≈ +' + Math.round(d.heat * st.heatMult * hits) + '°', G.p.heat + d.heat * st.heatMult * hits > 90 ? 'red' : 'mid')]);
        }
        if (d.ore) L.push([S(' Valor ' + TP.W.orePrice(d.ore) + ' ₽', 'gold')]);
      }
      if (info.bomb) L.push([S(' ¡DINAMITA! ' + info.bomb.t + ' turnos', 'red b blink')]);
      if (!info.visible) L.push([S(' (recuerdo — fuera de la vista)', 'dd')]);
    }
    return TP.box({ w, lines: L });
  };

  // ---------------- drag & drop ----------------
  const DnD = { drag: null, start: null, ghost: null, over: null, handlers: [] };
  UI.DnD = DnD;
  /* handler: {can(dragKey, dropKey) → bool, drop(dragKey, dropKey, el)} */
  DnD.use = function (h) { DnD.handler = h; };

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    const el = e.target.closest('[data-drag]');
    if (!el) return;
    DnD.start = { x: e.clientX, y: e.clientY, el, key: el.getAttribute('data-drag') };
  });
  document.addEventListener('pointermove', function (e) {
    if (DnD.start && !DnD.drag) {
      if (Math.hypot(e.clientX - DnD.start.x, e.clientY - DnD.start.y) > 6) beginDrag(e);
    }
    if (DnD.drag) moveDrag(e);
  });
  document.addEventListener('pointerup', function (e) {
    if (DnD.drag) { endDrag(e); e.stopPropagation(); DnD.justDropped = performance.now(); }
    DnD.start = null;
  }, true);

  function beginDrag(e) {
    const key = DnD.start.key;
    DnD.drag = key;
    DnD.start.el.classList.add('dragging');
    const g = $('#drag-ghost');
    g.style.fontSize = (UI.hudFs || 14) + 'px';
    g.innerHTML = ghostHTML(key);
    g.classList.remove('hidden');
    UI.hideTip();
    document.body.style.cursor = 'grabbing';
    TP.Audio.play('click');
    // resaltar destinos válidos
    TP.$$('[data-drop]').forEach(d => {
      const ok = DnD.handler && DnD.handler.can(key, d.getAttribute('data-drop'));
      d.classList.toggle('can', !!ok);
      if (ok) d.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 300 });
    });
  }
  function ghostHTML(key) {
    const [k, id] = key.split(':');
    if (k === 'mod') {
      const f = TP.W.findMod(id);
      if (!f) return '';
      const m = f.m;
      return TP.box({ w: 30, lines: [[S(' ' + TP.MOD_TYPES[m.type].glyph + ' ', TP.RARITY[m.rarity].cls + ' b'), S(TP.pad(m.name, 24), 'xhi b')], [S('   ' + m.model + ' «' + m.ep + '»', 'hi')]] });
    }
    if (k === 'ore') {
      const o = TP.ORES[id];
      const n = DnD.start && DnD.start.el.getAttribute('data-n');
      return TP.box({ w: 20, lines: [[S(' ' + o.glyph + ' ', o.cls + ' b'), S(o.name + ' ×' + (n || TP.G.cargo[id]), 'xhi b')]] });
    }
    return '';
  }
  function moveDrag(e) {
    const g = $('#drag-ghost');
    g.style.left = (e.clientX + 12) + 'px';
    g.style.top = (e.clientY + 8) + 'px';
    const under = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.hasAttribute && el.hasAttribute('data-drop'));
    if (DnD.over && DnD.over !== under) DnD.over.classList.remove('over', 'bad');
    DnD.over = under || null;
    if (under) {
      under.classList.add('over');
      const ok = DnD.handler && DnD.handler.can(DnD.drag, under.getAttribute('data-drop'));
      under.classList.toggle('bad', !ok);
    }
  }
  function endDrag(e) {
    const key = DnD.drag;
    const target = DnD.over;
    $('#drag-ghost').classList.add('hidden');
    document.body.style.cursor = '';
    TP.$$('.dragging').forEach(el => el.classList.remove('dragging'));
    TP.$$('[data-drop]').forEach(d => d.classList.remove('over', 'bad', 'can'));
    DnD.drag = null; DnD.over = null;
    if (target && DnD.handler) {
      const dk = target.getAttribute('data-drop');
      if (DnD.handler.can(key, dk)) {
        DnD.handler.drop(key, dk, target, e);
        TP.P.burstScreen(e.clientX, e.clientY, '#ffb347', 14);
        TP.Audio.play('drop');
      } else TP.Audio.play('deny');
    }
  }

  // ---------------- aviso central ----------------
  UI.banner = function (title, sub, cls) {
    const el = document.createElement('div');
    el.className = 'banner';
    el.style.cssText = 'position:fixed;left:50%;top:22%;transform:translate(-50%,-50%);z-index:45;pointer-events:none;background:rgba(7,5,4,.9);font-size:' + Math.round((UI.hudFs || 14) * 1.25) + 'px';
    const w = Math.max(title.length, (sub || '').length) + 8;
    el.innerHTML = TP.box({ w, style: 'd', lines: [[S(TP.center(title, w - 2), (cls || 'xhi') + ' b')], ...(sub ? [[S(TP.center(sub, w - 2), 'hi')]] : [])] });
    document.body.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translate(-50%,-40%) scale(.96)', filter: 'blur(3px)' }, { opacity: 1, transform: 'translate(-50%,-50%)', filter: 'none' }], { duration: 260, easing: 'ease-out' });
    setTimeout(() => {
      const a = el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-60%)' }], { duration: 500, easing: 'ease-in' });
      a.onfinish = () => el.remove();
    }, 1800);
  };

  // ---------------- cruceta táctil ----------------
  UI.buildTouch = function () {
    const el = $('#touch');
    const b = (k, t) => '<button class="tb" data-touch="' + k + '">' + t + '</button>';
    el.innerHTML =
      '<div>' + b('none', ' ') + b('up', '▲') + b('none', ' ') + b('sonar', 'Q') + '</div>' +
      '<div>' + b('left', '◄') + b('wait', '·') + b('right', '►') + b('dyn', 'E') + '</div>' +
      '<div>' + b('none', ' ') + b('down', '▼') + b('none', ' ') + b('menu', '≡') + '</div>';
    el.querySelectorAll('[data-touch="none"]').forEach(x => (x.style.visibility = 'hidden'));
  };

  TP.UI = UI;
})(window.TP);
