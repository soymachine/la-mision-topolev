/* ==========================================================
   station.js — Estación Relé: telegrama, mercado, plan, taller,
   tienda, servicios y descenso
   ========================================================== */
'use strict';
(function (TP) {
  const S = TP.S, $ = TP.$, SC = TP.Screens;
  const A = (n, p) => TP.Audio.play(n, p);

  const ST = {
    tgN: 0,
    enter(scr) {
      scr.className = 'veil';
      TP.W.stationEnter();
      this.tgN = TP.G._tgShown === TP.G.h ? 1e9 : 0;
      this.draw();
      SC_anim(this);
    },
    draw() {
      const G = TP.G, st = TP.ST;
      const scr = $('#screen');
      const cols = SC.cols();
      const W = Math.min(126, cols - 2);
      const c3 = Math.floor(W / 3);
      const cLast = W - c3 * 2;

      // --- telegrama ---
      const tg = TP.wrap(G.telegram || '', W - 6);
      const total = tg.join('\n').length;
      let left = Math.floor(this.tgN);
      const tgl = tg.map(l => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; });
      const tgLines = tgl.map((l, i) => [S('  ' + l, i === 0 ? 'xhi b' : 'hi')]);
      if (this.tgN < total) tgLines.push([S('  █', 'blink')]);
      this.tgTotal = total;

      // --- bodega ---
      const bod = [];
      for (const k of TP.ORE_KEYS) {
        const o = TP.ORES[k], n = G.cargo[k];
        const isQ = G.quota && G.quota.ore === k;
        if (!n) { bod.push([S(' ' + o.glyph + ' ' + TP.pad(o.name, 11) + '  —', 'dd')]); continue; }
        bod.push([
          S(' ' + o.glyph + ' ' + TP.pad(o.name, 11) + ' ×' + TP.pad(n, 3), o.cls + ' b drag', 'data-drag="ore:' + k + '" data-n="' + n + '" data-tip="ore:' + k + '"'),
          S(' '), S('[VENDER]', 'btn', 'data-act="sell:' + k + '"'),
          ...(isQ ? [S(' '), S('[PLAN]', 'btn red', 'data-act="quota:' + k + '"')] : [])
        ]);
      }
      bod.push(' ');
      bod.push([S(' Arrastra el mineral →', 'dd')]);

      // --- plan ---
      const pl = [];
      if (G.quota) {
        const q = G.quota, o = TP.ORES[q.ore];
        const ok = q.delivered >= q.amount;
        pl.push([S(' Exigido: ', 'dim'), S(q.amount + '× ' + o.glyph + ' ' + o.name, o.cls + ' b')]);
        pl.push([S(' Entregado: ', 'dim'), S(q.delivered + '/' + q.amount, ok ? 'green b' : 'red b')]);
        const f = Math.min(1, q.delivered / q.amount), bl = c3 - 6;
        pl.push([S(' [', 'dim'), S('█'.repeat(Math.round(f * bl)), ok ? 'green' : 'hi'), S('░'.repeat(bl - Math.round(f * bl)), 'dd'), S(']', 'dim')]);
        pl.push(' ');
        pl.push(ok ? [S(' ★ PLAN CUMPLIDO. Una Orden espera.', 'gold b')] : [S(' Suelta aquí el mineral del Plan.', 'hi')]);
        pl.push([S(' Exceso: prima ×1,5 del valor.', 'dd')]);
      } else pl.push([S(' Sin plan en este horizonte.', 'dim')]);
      const strikes = [S(' Reprimendas: ', 'dim')];
      for (let i = 0; i < 3; i++) strikes.push(S(i < G.strikes ? '■ ' : '□ ', i < G.strikes ? 'red b' : 'dd'));
      pl.push(strikes);

      // --- mercado ---
      const mk = [];
      for (const k of TP.ORE_KEYS) {
        const o = TP.ORES[k];
        mk.push([S(' ' + o.glyph + ' ' + TP.pad(o.name, 11), o.cls), S(TP.padL(TP.W.orePrice(k).toFixed(1), 6) + ' ₽/u', 'gold')]);
      }
      mk.push(' ');
      mk.push([S(' ', ''), S('[VENDER TODO SALVO EL PLAN]', 'btn', 'data-act="sellall"')]);

      // --- taller: equipado ---
      const eq = [];
      for (const slot of TP.SLOTS) {
        const m = G.equip[slot];
        const type = slot.startsWith('aux') ? 'aux' : slot;
        const L = m
          ? [S(' ' + TP.MOD_TYPES[type].glyph + ' ', TP.RARITY[m.rarity].cls), S(TP.pad(TP.SLOT_NAMES[slot], 9), 'dim'), S(TP.pad(m.name + ' ' + m.model, c3 - 15), TP.RARITY[m.rarity].cls + ' drag', 'data-drag="mod:' + m.id + '" data-tip="mod:' + m.id + '"')]
          : [S(' ' + TP.MOD_TYPES[type].glyph + ' ', 'dd'), S(TP.pad(TP.SLOT_NAMES[slot], 9), 'dd'), S('[ vacío ]', 'dd')];
        L.attrs = 'data-drop="slot:' + slot + '"'; L.cls = 'drop';
        eq.push(L);
      }
      // --- inventario ---
      const inv = [];
      for (let i = 0; i < 6; i++) {
        const m = G.inv[i];
        if (m) inv.push([S(' ' + TP.MOD_TYPES[m.type].glyph + ' ', TP.RARITY[m.rarity].cls), S(TP.pad(m.name + ' ' + m.model, c3 - 6), TP.RARITY[m.rarity].cls + ' drag btn', 'data-drag="mod:' + m.id + '" data-tip="mod:' + m.id + '" data-act="equip:' + m.id + '"')]);
        else inv.push([S(' · ', 'dd'), S('[ libre ]', 'dd')]);
      }
      const invBox = { attrs: 'data-drop="inv"', cls: 'drop' };
      // --- tienda ---
      const shop = [];
      for (const m of (G.shop || [])) {
        const can = G.rublos >= m.price && G.inv.length < 6;
        shop.push([S(' ' + TP.MOD_TYPES[m.type].glyph + ' ', TP.RARITY[m.rarity].cls), S(TP.pad(m.name + ' ' + m.model, cLast - 14), TP.RARITY[m.rarity].cls + ' drag btn', 'data-drag="mod:' + m.id + '" data-tip="mod:' + m.id + '" data-act="buy:' + m.id + '"'), S(TP.padL(m.price + '₽', 7), can ? 'gold b' : 'red')]);
      }
      if (!shop.length) shop.push([S(' Agotado. Vuelva el próximo quinquenio.', 'dim')]);
      while (shop.length < 5) shop.push(' ');
      shop.push([S(' ', ''), S('[ RECICLAR MÓDULO: arrástralo aquí ]', 'mid drop', 'data-drop="scrap" data-tip="txt:scrap"')]);

      // --- servicios ---
      const rc = TP.W.repairCost(), fneed = Math.floor(st.fuelMax - G.p.fuel);
      const btn = (label, act, dis) => S('[' + label + ']', 'btn' + (dis ? ' dis' : ''), 'data-act="' + act + '"');
      const serv = [
        [S(' CASCO ', 'dim'), S(TP.padL(Math.round(G.p.hull), 3) + '/' + st.hullMax, G.p.hull < st.hullMax * 0.4 ? 'red b' : 'xhi b'), S('   '),
          btn('REPARAR TODO ' + rc + '₽', 'repair', rc <= 0 || G.rublos < TP.PRICES.repair), S(' '), btn('+10', 'repair10', rc <= 0 || G.rublos < TP.PRICES.repair),
          S('     COMB. ', 'dim'), S(TP.padL(Math.round(G.p.fuel), 3) + '/' + st.fuelMax, G.p.fuel < st.fuelMax * 0.3 ? 'red b' : 'xhi b'), S('   '),
          btn('REPOSTAR ' + fneed * TP.PRICES.fuel + '₽', 'refuel', fneed <= 0 || G.rublos < 1), S(' '), btn('+25', 'refuel25', fneed <= 0 || G.rublos < 1),
          S('     DINAMITA ', 'dim'), S('×' + G.dyn, 'red b'), S(' '), btn('COMPRAR ' + TP.W.dynPrice() + '₽', 'dyn', G.rublos < TP.W.dynPrice())],
        ' ',
        [S(' '), S('[ ◄ VOLVER AL HORIZONTE ]', 'btn', 'data-act="leave" data-tip="raw:' + TP.esc(TP.box({ w: 34, lines: TP.wrap('Sal de la estación para seguir explorando este horizonte (por ejemplo, para completar el Plan).', 30).map(l => [S(' ' + l, 'hi')]) })) + '"'),
          S('          '),
          S('[ DESCENDER AL HORIZONTE ' + TP.roman(G.h + 2) + ' ▼ ]', 'btn xhi b', 'data-act="descend"'),
          S('          '), S(TP.fmt(G.rublos) + ' ₽', 'gold b', 'id="st-rub"')]
      ];

      const pad = (arr, n) => { while (arr.length < n) arr.push(' '); return arr; };
      const midH = 8;
      let h = '<div class="scr st" style="font-size:' + (TP.UI.hudFs ? Math.min(TP.UI.hudFs + 1, 16) : 14) + 'px">';
      h += TP.box({ w: W, style: 'd', title: 'ESTACIÓN RELÉ Nº ' + (G.h + 1) + ' · ' + TP.fmt(TP.W.depthM(G.map.station.y)) + ' m', right: 'ТЕЛЕГРАММА', lines: [' ', ...tgLines, ' '] });
      h += '<div style="display:flex">';
      h += TP.box({ w: c3, title: 'BODEGA ' + TP.W.cargoUsed() + '/' + st.cargo, lines: pad(bod, midH) });
      h += TP.box({ w: c3, title: 'PLAN QUINQUENAL', lines: pad(pl, midH), attrs: 'data-drop="quota"', cls: 'drop', titleCls: 'red b' });
      h += TP.box({ w: cLast, title: 'MERCADO ESTATAL', lines: pad(mk, midH), attrs: 'data-drop="sell"', cls: 'drop', titleCls: 'gold b' });
      h += '</div><div style="display:flex">';
      h += TP.box({ w: c3, title: 'TALLER · EQUIPADO', lines: eq });
      h += TP.box(Object.assign({ w: c3, title: 'INVENTARIO ' + G.inv.length + '/6', lines: inv }, invBox));
      h += TP.box({ w: cLast, title: 'TIENDA DEL KOMBINAT', lines: pad(shop, 6), titleCls: 'cyan b' });
      h += '</div>';
      h += TP.box({ w: W, title: 'SERVICIOS', lines: serv });
      h += '</div>';
      scr.innerHTML = h;
    },
    act(a, el, e) {
      const G = TP.G, W = TP.W;
      const [k, v] = a.split(':');
      const at = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const cx = at.left + at.width / 2, cy = at.top + at.height / 2;
      if (k === 'sell') { const n = W.sell(v, G.cargo[v]); if (n) { money(cx, cy, n); } }
      if (k === 'quota') { const n = W.deliver(v, G.cargo[v]); if (n) { TP.P.floatText(cx, cy, '+' + n + ' AL PLAN', '#ff3b30', 'screen'); A('drop'); } }
      if (k === 'sellall') {
        let tot = 0;
        for (const o of TP.ORE_KEYS) { if (G.quota && G.quota.ore === o && G.quota.delivered < G.quota.amount) continue; tot += W.sell(o, G.cargo[o]); }
        if (tot) money(cx, cy, tot); else A('deny');
      }
      if (k === 'repair') { if (W.repair()) A('buy'); }
      if (k === 'repair10') { if (W.repair(10)) A('buy'); }
      if (k === 'refuel') { if (W.refuel()) A('buy'); }
      if (k === 'refuel25') { if (W.refuel(25)) A('buy'); }
      if (k === 'dyn') { if (W.buyDynamite()) A('buy'); else A('deny'); }
      if (k === 'buy') { const m = W.buy(v); if (m) { A('buy'); TP.P.floatText(cx, cy, '−' + m.price + '₽', '#ffd23f', 'screen'); } else { A('deny'); TP.UI.banner('NO ES POSIBLE', G.inv.length >= 6 ? 'Inventario lleno' : 'Rublos insuficientes', 'red'); } }
      if (k === 'equip') { const f = W.findMod(v); if (f) { const slot = f.m.type === 'aux' ? (!G.equip.aux1 ? 'aux1' : !G.equip.aux2 ? 'aux2' : 'aux1') : f.m.type; W.equip(v, slot); A('drop'); } }
      if (k === 'leave') { W.leaveStation(); SC.close(); TP.Main.afterStationLeave(); return; }
      if (k === 'descend') { this.tryDescend(); return; }
      TP.UI.hideTip();
      this.draw();
      TP.UI.renderHUD();
    },
    tryDescend() {
      const G = TP.G, q = G.quota;
      if (q && q.delivered < q.amount && !this._confirm) {
        this._confirm = true;
        const have = G.cargo[q.ore];
        TP.UI.banner('PLAN INCUMPLIDO', have ? 'Tienes ' + have + ' en bodega sin entregar. Pulsa otra vez para descender.' : 'Recibirás una reprimenda. Pulsa otra vez para descender.', 'red');
        setTimeout(() => (this._confirm = false), 4000);
        return;
      }
      this._confirm = false;
      const fromD = TP.W.depthM();
      const res = TP.W.descend();
      if (res.over) return; // gameover gestionado por main
      SC.show('verdict', { res, fromD });
    },
    onKey(e) {
      if (this.tgN < this.tgTotal) { this.tgN = 1e9; this.draw(); return; }
      if (e.key === 'Escape') this.act('leave');
      if (e.key === 'Enter') this.tryDescend();
    },
    leave() { TP.G._tgShown = TP.G.h; }
  };

  function money(x, y, n) {
    A('buy');
    TP.P.floatText(x, y - 10, '+' + n + ' ₽', '#ffd23f', 'screen', 1.1);
    TP.P.burstScreen(x, y, '#ffd23f', 18, ['₽', '*', '·', '$']);
    const r = document.getElementById('st-rub');
    if (r) r.animate([{ background: 'rgba(255,210,63,.4)' }, { background: 'transparent' }], { duration: 600 });
  }

  function SC_anim(self) {
    let acc = 0;
    SC.anim = (dt) => {
      if (self.tgN >= self.tgTotal) return;
      const prev = Math.floor(self.tgN);
      self.tgN += dt * 60;
      if (Math.floor(self.tgN) !== prev) A('type');
      acc += dt;
      if (acc > 0.05 || self.tgN >= self.tgTotal) { acc = 0; self.draw(); }
    };
  }

  // drag & drop dentro de la estación (y del HUD)
  ST.can = function (drag, drop) {
    const G = TP.G;
    const [dk, id] = drag.split(':');
    if (dk === 'ore') {
      if (!G.cargo[id]) return false;
      if (drop === 'sell') return true;
      if (drop === 'quota') return !!(G.quota && G.quota.ore === id);
      return false;
    }
    if (dk === 'mod') {
      const f = TP.W.findMod(id);
      if (!f) return false;
      if (f.where === 'shop') {
        if (G.rublos < f.m.price) return false;
        if (drop === 'inv') return G.inv.length < 6;
        if (drop.startsWith('slot:')) return TP.Items.fits(f.m, drop.slice(5));
        return false;
      }
      if (drop.startsWith('slot:')) return TP.Items.fits(f.m, drop.slice(5)) && !(f.where === 'slot' && f.slot === drop.slice(5));
      if (drop === 'inv') return f.where === 'slot' && /aux/.test(f.slot) && G.inv.length < 6;
      if (drop === 'scrap') return f.where === 'inv' || (f.where === 'slot' && /aux/.test(f.slot));
    }
    return false;
  };
  ST.drop = function (drag, drop, el, e) {
    const G = TP.G, W = TP.W;
    const [dk, id] = drag.split(':');
    const x = e.clientX, y = e.clientY;
    if (dk === 'ore') {
      if (drop === 'sell') { const n = W.sell(id, G.cargo[id]); if (n) money(x, y, n); }
      if (drop === 'quota') { const n = W.deliver(id, G.cargo[id]); if (n) { TP.P.floatText(x, y, '+' + n + ' AL PLAN', '#ff3b30', 'screen'); A('medal'); } }
    } else if (dk === 'mod') {
      const f = W.findMod(id);
      if (f.where === 'shop') {
        const m = W.buy(id);
        if (m) { TP.P.floatText(x, y, '−' + m.price + '₽', '#ffd23f', 'screen'); if (drop.startsWith('slot:')) W.equip(id, drop.slice(5)); A('buy'); }
      } else if (drop.startsWith('slot:')) W.equip(id, drop.slice(5));
      else if (drop === 'inv') W.unequip(f.slot);
      else if (drop === 'scrap') { const msg = W.scrap(id); if (msg) TP.P.floatText(x, y, msg.toUpperCase(), '#ffd23f', 'screen'); }
    }
    TP.UI.hideTip();
    if (SC.cur && SC.cur.name === 'station') ST.draw();
    TP.UI.renderHUD();
  };

  SC.register('station', ST);

  // ---------- veredicto del Plan ----------
  SC.register('verdict', {
    enter(scr, arg) {
      scr.className = 'veil';
      const { res } = arg;
      const G = TP.G;
      const W = 58;
      const L = [' '];
      if (res.medal) {
        L.push([S(TP.center('PLAN CUMPLIDO', W - 2), 'green b')]);
        L.push(' ');
        L.push([S(TP.center('★', W - 2), 'gold b pulse')]);
        L.push([S(TP.center(res.medal.name.toUpperCase(), W - 2), 'gold b')]);
        if (res.medal.desc) L.push([S(TP.center(res.medal.desc, W - 2), 'hi')]);
        if (res.extra) L.push([S(TP.center('Prima por exceso: +' + res.extra + ' ₽', W - 2), 'gold')]);
        A('medal');
        setTimeout(() => { const r = scr.getBoundingClientRect(); TP.P.burstScreen(r.width / 2, r.height / 2, '#ffd23f', 60, ['★', '*', '+', '·']); }, 150);
      } else if (res.strike) {
        L.push([S(TP.center('PLAN INCUMPLIDO', W - 2), 'red b')]);
        L.push(' ');
        L.push([S(TP.center('REPRIMENDA OFICIAL Nº ' + G.strikes, W - 2), 'red b blink')]);
        L.push([S(TP.center(G.strikes >= 2 ? 'Una más y será relevado.' : 'Moscú toma nota.', W - 2), 'hi')]);
        A('strike');
        TP.R.addShake(8);
      } else {
        L.push([S(TP.center('SIN PLAN QUE EVALUAR', W - 2), 'dim')]);
      }
      L.push(' ');
      scr.innerHTML = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'VEREDICTO DE MOSCÚ', lines: L }) + '<div style="margin-top:.6em">' + SC.menuItem('DESCENDER ▼', 'go', 0) + '</div></div>';
      this.arg = arg;
      setTimeout(() => SC.setFocus(0), 0);
    },
    act(a) { if (a === 'go') this.go(); },
    go() {
      const G = TP.G;
      SC.show('descend', { from: this.arg.fromD, to: TP.W.depthM(), h: G.h, onDone: () => { SC.close(); TP.Main.onHorizonStart(); } });
    },
    onKey(e) { if (e.key === 'Enter' || e.key === ' ') this.go(); }
  });

  TP.Station = ST;
})(window.TP);
