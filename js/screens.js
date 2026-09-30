/* ==========================================================
   screens.js — título, instrucciones, archivo, opciones, briefing,
   pausa, fin de partida, final y transiciones
   ========================================================== */
'use strict';
(function (TP) {
  const S = TP.S, $ = TP.$;
  const SC = { cur: null, anim: null };
  const A = (n, p) => TP.Audio.play(n, p);

  // ancho disponible en caracteres
  SC.cols = function () {
    const fs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 15;
    return Math.floor(window.innerWidth / TP.charWidth(fs)) - 2;
  };

  SC.show = function (name, arg) {
    if (SC.cur && SC.cur.leave) SC.cur.leave();
    SC.anim = null;
    const scr = $('#screen');
    scr.className = '';
    scr.innerHTML = '';
    SC.cur = null;
    TP.UI.hideTip();
    if (!name) return;
    const def = SCREENS[name];
    SC.cur = Object.assign({ name }, def);
    SC.cur.enter(scr, arg);
    bindButtons(scr);
  };
  SC.close = () => SC.show(null);
  SC.key = function (e) { if (SC.cur && SC.cur.onKey) { SC.cur.onKey(e); return true; } return false; };
  SC.frame = function (dt, now) { if (SC.anim) SC.anim(dt, now); };

  // botones genéricos: data-act en .btn → cur.act(valor)
  function bindButtons(root) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.classList.contains('dis')) return;
      if (TP.UI.DnD.justDropped && performance.now() - TP.UI.DnD.justDropped < 350) return;
      A('click');
      const r = b.getBoundingClientRect();
      TP.P.burstScreen(r.left + r.width / 2, r.top + r.height / 2, '#ffb347', 10);
      SC.cur && SC.cur.act && SC.cur.act(b.getAttribute('data-act'), b, e);
    });
    root.addEventListener('mouseover', e => {
      const b = e.target.closest('[data-act]');
      if (b && b !== SC._lastHover && !b.classList.contains('dis')) {
        SC._lastHover = b; A('hover');
        if (b.dataset.menu !== undefined) setFocus(b.dataset.menu | 0);
        const r = b.getBoundingClientRect();
        for (let i = 0; i < 3; i++) TP.P.spawn({ space: 'screen', x: r.left + 4, y: r.top + r.height / 2, vx: TP.rand(-60, -20), vy: TP.rand(-30, 30), life: 0.35, ch: TP.pickr(['*', '·', '+']), col: '#ffb347', size: 0.6, glow: 5 });
      }
      if (!b) SC._lastHover = null;
    });
  }

  // ---------- menú navegable con teclado ----------
  let focusIdx = 0;
  function setFocus(i) {
    const items = TP.$$('[data-menu]', $('#screen')).filter(el => !el.classList.contains('dis'));
    if (!items.length) return;
    focusIdx = (i + items.length) % items.length;
    items.forEach((el, k) => {
      el.classList.toggle('focus', k === focusIdx);
      const mk = el.querySelector('.mk');
      if (mk) mk.textContent = k === focusIdx ? '►' : ' ';
    });
  }
  function menuKey(e) {
    const items = TP.$$('[data-menu]', $('#screen')).filter(el => !el.classList.contains('dis'));
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { setFocus(focusIdx + 1); A('hover'); return true; }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { setFocus(focusIdx - 1); A('hover'); return true; }
    if (e.key === 'Enter' || e.key === ' ') { const el = items[focusIdx]; if (el) el.click(); return true; }
    return false;
  }
  function menuItem(label, act, i, dis, cls) {
    return '<div class="ln btn' + (dis ? ' dis' : '') + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-menu="' + i + '"><span class="mk"> </span> ' + TP.esc(label) + ' </div>';
  }

  // ---------- logo ----------
  function logoLines() {
    const word = 'TOPOLEV', F = TP.LOGO_FONT, rows = [];
    for (let r = 0; r < 5; r++) rows.push(word.split('').map(c => F[c][r]).join('  '));
    return rows;
  }
  const LOGO_COLS = ['#ffd59a', '#ffb347', '#ff9a2e', '#ff8c1a', '#e0700f', '#c25a0e'];
  function logoHTML(glitch) {
    const rows = logoLines();
    let h = '';
    rows.forEach((row, r) => {
      let line = '';
      for (let i = 0; i < row.length; i++) {
        let c = row[i];
        const col = LOGO_COLS[r + (i % 7 === 0 ? 1 : 0)] || '#c25a0e';
        if (c === '█' && glitch && Math.random() < glitch) c = TP.pickr(['▓', '▒', '░', '#']);
        line += c === ' ' ? ' ' : '<span style="color:' + col + ';text-shadow:0 0 12px rgba(255,140,26,.45)">' + c + '</span>';
      }
      h += line + '\n';
    });
    // sombra inferior
    h += '<span style="color:#3a1a06">' + rows[4].replace(/█/g, '▀') + '</span>';
    return h;
  }

  // ---------- fondo del título ----------
  function titleBG(cv) {
    const ctx = cv.getContext('2d');
    const noise = TP.makeNoise('titulo');
    let off = 0;
    const drills = [];
    return function (dt, now) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#070504'; ctx.fillRect(0, 0, w, h);
      const fs = 18, cw = Math.ceil(TP.charWidth(fs)), ch = 22;
      ctx.font = fs + 'px ' + TP.R.getFont();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      off += dt * 2.2;
      const cols = Math.ceil(w / cw) + 1, rows = Math.ceil(h / ch) + 2;
      const oy = off % 1;
      const base = Math.floor(off);
      const cx = w / 2, cy = h / 2;
      for (let r = 0; r < rows; r++) {
        const wy = base + r;
        for (let c = 0; c < cols; c++) {
          const n = noise.fbm(c * 0.07, wy * 0.07, 3);
          const px = c * cw + cw / 2, py = (r - oy) * ch;
          const dx = (px - cx) / w, dy = (py - cy) / h;
          const fade = TP.clamp(0.95 - Math.hypot(dx * 1.3, dy * 1.6) * 1.7, 0, 1);
          if (fade <= 0.02) continue;
          let g, col;
          if (n < 0.34) continue;
          else if (n < 0.46) { g = '░'; col = [138, 84, 39]; }
          else if (n < 0.58) { g = '▒'; col = [168, 100, 42]; }
          else if (n < 0.68) { g = '▓'; col = [201, 118, 47]; }
          else { g = '█'; col = [91, 80, 74]; }
          const hv = TP.R.hash2(c, wy);
          if (hv < 0.01) { g = '◊'; col = [77, 232, 255]; }
          else if (hv < 0.025) { g = '¤'; col = [238, 138, 69]; }
          ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (fade * 0.22).toFixed(3) + ')';
          ctx.fillText(g, px, py);
        }
      }
      // perforadoras que descienden
      if (Math.random() < dt * 0.6 && drills.length < 3) drills.push({ x: TP.randi(2, cols - 3), y: -2, sp: TP.rand(2, 5) });
      for (let i = drills.length - 1; i >= 0; i--) {
        const d = drills[i];
        d.y += d.sp * dt;
        const px = d.x * cw + cw / 2, py = d.y * ch;
        for (let k = 1; k < 30; k++) {
          ctx.fillStyle = 'rgba(255,140,26,' + (0.14 * (1 - k / 30)).toFixed(3) + ')';
          ctx.fillText('│', px, py - k * ch * 0.6);
        }
        ctx.fillStyle = 'rgba(255,140,26,.55)';
        ctx.fillText('▼', px, py);
        if (Math.random() < 0.4) TP.P.spawn({ space: 'screen', x: px, y: py + 8, vx: TP.rand(-50, 50), vy: TP.rand(-60, -10), ay: 200, life: 0.4, ch: TP.pickr(['.', ',', '\'', '*']), col: '#ffb347', size: 0.5 });
        if (py > h + 40) drills.splice(i, 1);
      }
    };
  }

  // =====================================================
  const SCREENS = {};

  // ---------- TÍTULO ----------
  SCREENS.title = {
    enter(scr) {
      scr.className = 'opaque';
      TP.Main.setGameVisible(false);
      const has = TP.Save.hasRun();
      const recs = TP.Save.records();
      const best = recs.length ? Math.max(...recs.map(r => r.depth || 0)) : 0;
      let i = 0;
      let menu = '';
      if (has) {
        const r = TP.Save.runInfo();
        menu += menuItem('CONTINUAR EXPEDICIÓN   ' + TP.roman((r.h || 0) + 1) + ' · ' + r.seed, 'continue', i++);
      }
      menu += menuItem('NUEVA EXPEDICIÓN', 'new', i++);
      menu += menuItem('INSTRUCCIONES', 'help', i++);
      menu += menuItem('ARCHIVO DE LA MISIÓN', 'records', i++);
      menu += menuItem('OPCIONES', 'options', i++);
      scr.innerHTML =
        '<canvas id="title-bg"></canvas>' +
        '<div class="scr" style="position:relative;z-index:2;text-align:center">' +
        '<div class="ln dim" style="letter-spacing:.9em;margin-bottom:.6em">L A &nbsp; M I S I Ó N</div>' +
        '<div class="logo" id="logo" style="display:inline-block;font-size:1.25em">' + logoHTML(0) + '</div>' +
        '<div class="ln mid" style="margin-top:.9em">КТ-1 «ТОПОЛЕВ» · КОЛЬСКИЙ ПОЛУОСТРОВ · 1970</div>' +
        '<div class="ln dd">────────────────────────────────────────────</div>' +
        '<div class="menu" style="display:inline-block;margin-top:1.2em;text-align:left;min-width:32ch">' + menu + '</div>' +
        '<div class="ln dd" style="margin-top:2.2em">↑↓ ENTER · ' + (best ? 'RÉCORD DE PROFUNDIDAD ' + TP.fmt(best) + ' m' : 'NINGÚN PILOTO HA REGRESADO') + '</div>' +
        '</div>';
      const bg = titleBG($('#title-bg'));
      let gt = 0;
      SC.anim = (dt, now) => {
        bg(dt, now);
        gt += dt;
        if (gt > 0.09) {
          gt = 0;
          const l = $('#logo');
          if (l) l.innerHTML = logoHTML(Math.random() < 0.18 ? 0.04 : 0.0);
        }
      };
      focusIdx = 0; setTimeout(() => setFocus(0), 0);
    },
    act(a) {
      if (a === 'continue') TP.Main.continueRun();
      if (a === 'new') SC.show('newgame');
      if (a === 'help') SC.show('help', { back: 'title' });
      if (a === 'records') SC.show('records');
      if (a === 'options') SC.show('options', { back: 'title' });
    },
    onKey(e) { menuKey(e); }
  };

  // ---------- NUEVA EXPEDICIÓN ----------
  SCREENS.newgame = {
    enter(scr) {
      scr.className = 'opaque';
      const d = new Date();
      const daily = 'KOLA-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      this.daily = daily;
      const W = 56;
      const lines = [
        ' ',
        [S('  Toda expedición nace de una semilla. La misma semilla', 'hi')],
        [S('  genera el mismo subsuelo, las mismas vetas y módulos.', 'hi')],
        ' '
      ];
      scr.innerHTML = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'NUEVA EXPEDICIÓN', lines }) +
        '<div style="margin-top:1em">' +
        menuItem('EXPEDICIÓN ALEATORIA', 'rand', 0) +
        menuItem('EXPEDICIÓN DEL DÍA   (' + daily + ')', 'daily', 1) +
        '<div class="ln"> <span class="dim">  SEMILLA PROPIA: </span><input id="seed-in" maxlength="24" spellcheck="false" style="background:#0f0906;color:#ffb347;border:0;border-bottom:1px solid #6e3108;font:inherit;width:20ch;outline:none;text-transform:uppercase" placeholder="________"></div>' +
        menuItem('EMPEZAR CON ESA SEMILLA', 'seed', 2) +
        '<div class="ln"> </div>' +
        menuItem('VOLVER', 'back', 3) +
        '</div></div>';
      focusIdx = 0; setTimeout(() => setFocus(0), 0);
      const inp = $('#seed-in');
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.act('seed'); if (e.key === 'Escape') inp.blur(); });
    },
    act(a) {
      if (a === 'rand') TP.Main.startRun(null);
      if (a === 'daily') TP.Main.startRun(this.daily);
      if (a === 'seed') { const v = ($('#seed-in').value || '').trim().toUpperCase(); if (v) TP.Main.startRun(v); else $('#seed-in').focus(); }
      if (a === 'back') SC.show('title');
    },
    onKey(e) { if (e.key === 'Escape') SC.show('title'); else menuKey(e); }
  };

  // ---------- BRIEFING (telegrama) ----------
  SCREENS.briefing = {
    enter(scr, arg) {
      scr.className = 'opaque';
      const W = Math.min(74, SC.cols() - 4);
      const text = TP.TXT.intro;
      const wrapped = [];
      text.split('\n').forEach(p => (p ? TP.wrap(p, W - 6) : ['']).forEach(l => wrapped.push(l)));
      this.lines = wrapped; this.n = 0; this.done = false; this.onDone = arg && arg.onDone;
      scr.innerHTML = '<div class="scr"><div id="tg"></div><div class="ln dd center" id="tg-hint" style="margin-top:1em">[ CLIC O TECLA PARA SALTAR ]</div></div>';
      const total = wrapped.join('\n').length;
      let acc = 0;
      const draw = () => {
        let left = Math.floor(this.n);
        const out = wrapped.map(l => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; });
        const cursor = !this.done;
        const lines = [' ', ...out.map((l, i) => [S('  ' + l, i < 3 ? 'xhi b' : 'hi')]), ' '];
        if (cursor) {
          let li = out.findIndex((l, i) => l.length < wrapped[i].length);
          if (li < 0) li = out.length - 1;
          lines[li + 1] = [S('  ' + out[li], li < 3 ? 'xhi b' : 'hi'), S('█', 'blink')];
        }
        $('#tg').innerHTML = TP.box({ w: W, style: 'd', title: 'ТЕЛЕГРАММА', lines });
      };
      SC.anim = (dt) => {
        if (this.done) return;
        acc += dt * 55;
        const prev = Math.floor(this.n);
        this.n = Math.min(total, this.n + dt * 55);
        if (Math.floor(this.n) !== prev) A('type');
        if (this.n >= total) { this.done = true; $('#tg-hint').textContent = '[ PULSA CUALQUIER TECLA PARA DESCENDER ]'; $('#tg-hint').className = 'ln hi center blink'; }
        draw();
      };
      draw();
      scr.addEventListener('click', () => this.next());
    },
    next() {
      if (!this.done) { this.n = 1e9; return; }
      if (this.onDone) this.onDone();
    },
    onKey(e) { this.next(); }
  };

  // ---------- INSTRUCCIONES ----------
  const HELP_TABS = ['MISIÓN', 'CONTROLES', 'EL TOPOLEV', 'SUBSUELO', 'ESTACIÓN', 'CONSEJOS'];
  function helpContent(tab, W) {
    const L = [];
    const p = (t, c) => TP.wrap(t, W - 6).forEach(l => L.push([S('  ' + l, c || 'hi')]));
    const h = t => { L.push(' '); L.push([S('  ' + t, 'xhi b')]); };
    const kv = (k, v, kc) => L.push([S('  ' + TP.pad(k, 16), kc || 'gold b'), S(v, 'hi')]);
    const gl = (g, col, name, desc) => {
      const ds = TP.wrap(desc, W - 30);
      L.push([S('   ' + g + '  ', 'b', 'style="color:' + col + '"'), S(TP.pad(name, 21), 'xhi'), S(ds[0] || '', 'mid')]);
      ds.slice(1).forEach(d => L.push([S(' '.repeat(27)), S(d, 'mid')]));
    };
    if (tab === 0) {
      h('1970. PENÍNSULA DE KOLA.');
      p('Los micrófonos del pozo superprofundo SG-3 registran sonidos que la geología no puede explicar. La Academia de Ciencias envía al KT-1 «Topolev», una perforadora subterránea autopropulsada, a averiguar qué hay ahí abajo.');
      h('TU OBJETIVO');
      p('Desciende a través de diez horizontes hasta los 12.262 metros. Al fondo de cada horizonte te espera una Estación Relé (★) donde podrás comerciar, reparar y mejorar el Topolev.');
      h('EL PLAN QUINQUENAL');
      p('Moscú exige una cuota de mineral en cada horizonte. Cúmplela y recibirás una Orden: una ventaja permanente para el resto de la expedición. Fállala y recibirás una reprimenda. A la tercera, la misión se cancela.');
      h('PERMADEATH');
      p('Si el Topolev se destruye o se queda sin combustible, la expedición termina. La partida se guarda sola: puedes cerrar el navegador y continuar después.');
    } else if (tab === 1) {
      h('TECLADO');
      kv('← ↑ → ↓ / WASD', 'Moverse. Contra la roca: perforar.');
      kv('ESPACIO / .', 'Esperar un turno (enfría más rápido).');
      kv('Q', 'Sonar: revela el subsuelo cercano.');
      kv('E', 'Colocar dinamita (explota en 3 turnos).');
      kv('ESC', 'Menú de pausa.');
      kv('M', 'Activar/desactivar sonido.');
      h('RATÓN');
      kv('Pasar por encima', 'Información de cualquier celda, módulo o mineral.', 'cyan b');
      kv('Clic adyacente', 'Moverse o perforar en esa dirección.', 'cyan b');
      kv('Clic lejano', 'Ruta automática por zonas ya exploradas.', 'cyan b');
      kv('Arrastrar', 'Módulos a ranuras / reciclar; minerales al', 'cyan b');
      L.push([S('                  Mercado o al Plan en la Estación.', 'hi')]);
      h('TÁCTIL');
      p('En pantallas táctiles aparece una cruceta en la esquina inferior izquierda.');
    } else if (tab === 2) {
      h('RECURSOS');
      kv('CASCO', 'Vida. Los golpes, caídas y explosiones lo dañan.', 'red b');
      kv('COMBUSTIBLE', 'Moverse y perforar gastan. Subir cuesta el doble.', 'gold b');
      kv('CALOR', 'Perforar calienta. A 100° el casco se funde.', 'hi b');
      kv('BODEGA', 'Capacidad para mineral.', 'grey b');
      h('EL CALOR');
      p('El calor tiende siempre al calor ambiental de la profundidad (a). Cuanto más hondo, más caliente es la roca y menos margen tienes. Esperar enfría 2,5 veces más rápido. El agua enfría mucho. El magma cercano calienta. El uranio en la bodega irradia.');
      h('GRAVEDAD');
      p('El Topolev se agarra a las paredes laterales. En una caverna sin apoyo, cae. Las caídas de más de 3 filas dañan el casco (salvo si caes al agua).');
      h('MÓDULOS');
      p('Broca (potencia, nivel, calor), Motor (consumo, depósito), Refrigerador, Blindaje (casco, absorción) y dos ranuras Auxiliares con efectos especiales. Se encuentran en cajas (?) y se compran en las Estaciones. Rareza: ');
      L.push([S('   Estándar  ', 'hi'), S('Reforzado  ', 'xhi b'), S('Heroico  ', 'red b'), S('Experimental', 'cyan b')]);
    } else if (tab === 3) {
      h('EL SUBSUELO (cuanto más denso el glifo, más duro)');
      const D = TP.TD, T = TP.T;
      const show = [T.DIRT, T.ROCK, T.GRANITE, T.BASALT, T.OBSIDIAN, T.BEDROCK, T.BOULDER, T.WATER, T.MAGMA, T.GAS, T.BARREL, T.CRATE, T.STATION];
      for (const t of show) { const d = D[t]; gl(d.glyph, d.fg, d.name, d.desc); }
      h('MINERALES');
      for (const k of TP.ORE_KEYS) { const o = TP.ORES[k]; gl(o.glyph, o.color, o.name, 'valor base ' + o.value + ' ₽'); }
      h('FAUNA');
      gl('@', '#ff3b30', 'Olgói-Jorjói', 'Gusano. Duerme hasta que oye ruido.');
    } else if (tab === 4) {
      h('LA ESTACIÓN RELÉ ★');
      p('Al llegar recibirás un telegrama de Moscú. Desde la estación puedes:');
      kv('BODEGA', 'Arrastra minerales al MERCADO para venderlos...');
      kv('', '...o al PLAN para cumplir la cuota del horizonte.');
      kv('SERVICIOS', 'Reparar casco, repostar, comprar dinamita.');
      kv('TIENDA', 'Módulos nuevos (arrastra a la bodega o haz clic).');
      kv('TALLER', 'Arrastra módulos a las ranuras para equiparlos.');
      kv('RECICLAR', 'Convierte módulos que sobran en rublos.');
      kv('DESCENDER', 'Se resuelve el Plan y bajas al siguiente horizonte.');
      h('ENTREGAR DE MÁS');
      p('Si entregas más mineral del exigido, Moscú paga una prima por el exceso (×1,5 del valor). A veces conviene más vender; a veces, entregar.');
    } else {
      h('CONSEJOS DE UN VETERANO (ANÓNIMO)');
      const tips = [
        'Mira el tooltip de una roca antes de perforarla: te dice cuántos golpes y cuánto calor costará.',
        'No perfores junto al gas (°) con el calor por encima de 50°. Mejor aún: prende el gas con dinamita desde lejos.',
        'Los cantos rodados (●) caen cuando les quitas el apoyo. Nunca perfores justo debajo de uno y te quedes quieto... o hazlo a propósito para aplastar a un gusano.',
        'Un canto que cae sobre otro rueda hacia un lado. Las cadenas de cantos son impredecibles.',
        'El agua convierte el magma en obsidiana. A veces abrir un lago es la única forma de cruzar.',
        'El sonar hace ruido. En horizontes con gusanos, úsalo con cabeza.',
        'Guarda al menos un tercio del combustible para imprevistos. Subir cuesta el doble.',
        'El uranio vale mucho, pero calienta el Topolev mientras lo llevas. Véndelo pronto o equipa un forro de plomo.',
        'Una broca de nivel 2 abre el basalto; de nivel 3, la obsidiana. Sin ella, rodea o usa dinamita.',
        'Las Órdenes son permanentes. Cumplir el Plan pronto compensa.'
      ];
      tips.forEach(t => { L.push(' '); TP.wrap(t, W - 9).forEach((l, i) => L.push([S(i ? '     ' : '  ► ', 'red'), S(l, 'hi')])); });
    }
    return L;
  }
  SCREENS.help = {
    enter(scr, arg) {
      this.back = (arg && arg.back) || 'title';
      this.tab = this.tab || 0;
      scr.className = this.back === 'pause' ? 'veil' : 'opaque';
      this.draw(scr);
    },
    draw(scr) {
      scr = scr || $('#screen');
      const W = Math.min(84, SC.cols() - 4);
      let tabs = '<div class="ln" style="margin-bottom:.4em">';
      HELP_TABS.forEach((t, i) => { tabs += '<span class="btn' + (i === this.tab ? ' focus' : '') + '" data-act="tab:' + i + '"> ' + (i + 1) + ' ' + t + ' </span> '; });
      tabs += '</div>';
      const body = helpContent(this.tab, W);
      while (body.length < 24) body.push(' ');
      scr.innerHTML = '<div class="scr" style="animation:none">' + tabs + TP.box({ w: W, style: 'd', title: 'INSTRUCCIONES · ' + HELP_TABS[this.tab], lines: body }) +
        '<div class="ln dd" style="margin-top:.5em">← → CAMBIAR PESTAÑA · ESC VOLVER   <span class="btn" data-act="back">[ VOLVER ]</span></div></div>';
    },
    act(a) {
      if (a === 'back') this.leaveTo();
      else if (a.startsWith('tab:')) { this.tab = +a.slice(4); this.draw(); }
    },
    leaveTo() { if (this.back === 'pause') SC.show('pause'); else SC.show(this.back); },
    onKey(e) {
      if (e.key === 'Escape') this.leaveTo();
      else if (e.key === 'ArrowRight' || e.key === 'd') { this.tab = (this.tab + 1) % HELP_TABS.length; this.draw(); A('hover'); }
      else if (e.key === 'ArrowLeft' || e.key === 'a') { this.tab = (this.tab + HELP_TABS.length - 1) % HELP_TABS.length; this.draw(); A('hover'); }
      else if (/^[1-6]$/.test(e.key)) { this.tab = +e.key - 1; this.draw(); A('hover'); }
    }
  };

  // ---------- ARCHIVO ----------
  SCREENS.records = {
    enter(scr) {
      scr.className = 'opaque';
      const W = Math.min(88, SC.cols() - 4);
      const recs = TP.Save.records();
      const L = [' ', [S('  #   PUNTOS   PROFUNDIDAD  HOR.  ÓRD.  DESENLACE                 SEMILLA', 'dim')], [S('  ' + '─'.repeat(W - 6), 'dd')]];
      if (!recs.length) L.push([S('  Ningún expediente. El archivo espera a su primer piloto.', 'hi')]);
      recs.forEach((r, i) => {
        const c = r.cause === 'victory' ? 'gold b' : i === 0 ? 'xhi b' : 'hi';
        L.push([S('  ' + TP.pad(String(i + 1) + '.', 4), 'dim'), S(TP.padL(TP.fmt(r.score), 7) + '  ', c), S(TP.padL(TP.fmt(r.depth) + ' m', 11) + '  ', 'hi'),
          S(TP.pad(TP.roman(r.h + 1), 6), 'mid'), S(TP.pad('★'.repeat(r.medals || 0) || '—', 6), 'gold'), S(TP.pad(TP.DEATH_SHORT[r.cause] || r.cause, 26), r.cause === 'victory' ? 'gold b' : 'red'), S(TP.pad(r.seed, 12), 'dd')]);
      });
      L.push(' ');
      scr.innerHTML = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'ARCHIVO DE LA MISIÓN TOPOLEV · CLASIFICADO', lines: L }) +
        '<div style="margin-top:.8em">' + menuItem('VOLVER', 'back', 0) + '</div></div>';
      focusIdx = 0; setTimeout(() => setFocus(0), 0);
    },
    act(a) { if (a === 'back') SC.show('title'); },
    onKey(e) { if (e.key === 'Escape') SC.show('title'); else menuKey(e); }
  };

  // ---------- OPCIONES ----------
  SCREENS.options = {
    enter(scr, arg) {
      this.back = (arg && arg.back) || 'title';
      scr.className = this.back === 'pause' ? 'veil' : 'opaque';
      this.draw(scr);
    },
    draw(scr) {
      scr = scr || $('#screen');
      const o = TP.Save.opts();
      const W = 56;
      const opt = (label, act, val) => '<div class="ln btn" data-act="' + act + '" data-menu="' + (this._i++) + '"><span class="mk"> </span> ' + TP.pad(label, 24) + '<span class="xhi b">‹ ' + TP.pad(val, 10) + ' ›</span></div>';
      this._i = 0;
      const vol = '█'.repeat(Math.round(o.volume * 10)) + '░'.repeat(10 - Math.round(o.volume * 10));
      let h = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'OPCIONES', lines: [' ', [S('  Ajustes guardados en este navegador.', 'dim')], ' '] }) + '<div style="margin-top:.6em;min-width:48ch">';
      h += opt('SONIDO', 'sound', o.sound ? 'SÍ' : 'NO');
      h += opt('VOLUMEN', 'volume', vol);
      h += opt('EFECTO CRT', 'crt', o.crt ? 'SÍ' : 'NO');
      h += opt('PARTÍCULAS', 'particles', o.particles.toUpperCase());
      h += opt('TAMAÑO DEL MAPA', 'zoom', o.zoom.toUpperCase());
      h += opt('SACUDIDA DE CÁMARA', 'shake', o.shake ? 'SÍ' : 'NO');
      h += '<div class="ln"> </div>';
      if (this.back === 'title') h += menuItem('BORRAR TODOS LOS DATOS', 'wipe', this._i++, false, 'danger');
      h += menuItem('VOLVER', 'back', this._i++);
      h += '</div></div>';
      scr.innerHTML = h;
      setTimeout(() => setFocus(focusIdx), 0);
    },
    change(a, dir) {
      const o = TP.Save.opts();
      const cyc = (arr, v) => arr[(arr.indexOf(v) + (dir || 1) + arr.length) % arr.length];
      if (a === 'sound') TP.Save.setOpt('sound', !o.sound);
      if (a === 'volume') TP.Save.setOpt('volume', Math.round(TP.clamp(o.volume + 0.1 * (dir || 1), 0, 1) * 10) / 10 || (dir > 0 ? 0.1 : 0));
      if (a === 'crt') TP.Save.setOpt('crt', !o.crt);
      if (a === 'particles') TP.Save.setOpt('particles', cyc(['bajo', 'normal', 'alto'], o.particles));
      if (a === 'zoom') TP.Save.setOpt('zoom', cyc(['auto', 'grande', 'enorme'], o.zoom));
      if (a === 'shake') TP.Save.setOpt('shake', !o.shake);
      this.draw();
    },
    act(a) {
      if (a === 'back') { if (this.back === 'pause') SC.show('pause'); else SC.show('title'); return; }
      if (a === 'wipe') {
        if (this._confirm) { TP.Save.wipeAll(); this._confirm = false; TP.Main.applyOpts(); SC.show('title'); }
        else { this._confirm = true; TP.UI.banner('¿SEGURO?', 'Pulsa otra vez para borrar récords y partida', 'red'); }
        return;
      }
      this.change(a, 1);
    },
    onKey(e) {
      if (e.key === 'Escape') { this.act('back'); return; }
      const items = TP.$$('[data-menu]', $('#screen'));
      const el = items[focusIdx];
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && el) {
        const a = el.getAttribute('data-act');
        if (a !== 'back' && a !== 'wipe') { this.change(a, e.key === 'ArrowLeft' ? -1 : 1); A('click'); }
        return;
      }
      menuKey(e);
    }
  };

  // ---------- PAUSA ----------
  SCREENS.pause = {
    enter(scr) {
      scr.className = 'veil';
      const G = TP.G;
      const W = 44;
      scr.innerHTML = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'PAUSA', lines: [' ', [S('  Expedición ', 'dim'), S(G.seed, 'xhi b')], [S('  Turno ' + G.turn + ' · ' + TP.fmt(TP.W.depthM()) + ' m', 'hi')], ' '] }) +
        '<div style="margin-top:.6em">' +
        menuItem('CONTINUAR', 'resume', 0) + menuItem('INSTRUCCIONES', 'help', 1) + menuItem('OPCIONES', 'options', 2) +
        menuItem('GUARDAR Y SALIR AL MENÚ', 'save', 3) + menuItem('ABANDONAR EXPEDICIÓN', 'quit', 4, false, 'danger') +
        '</div></div>';
      focusIdx = 0; setTimeout(() => setFocus(0), 0);
    },
    act(a) {
      if (a === 'resume') SC.close();
      if (a === 'help') SC.show('help', { back: 'pause' });
      if (a === 'options') SC.show('options', { back: 'pause' });
      if (a === 'save') { TP.Save.saveRun(); SC.show('title'); }
      if (a === 'quit') {
        if (this._c) { this._c = false; TP.W.gameOver('quit'); }
        else { this._c = true; TP.UI.banner('¿ABANDONAR?', 'Pulsa otra vez: la expedición se perderá', 'red'); }
      }
    },
    onKey(e) { if (e.key === 'Escape') SC.close(); else menuKey(e); }
  };

  // ---------- FIN DE PARTIDA ----------
  SCREENS.gameover = {
    enter(scr, arg) {
      scr.className = 'veil';
      const G = TP.G, over = G.over;
      const W = Math.min(64, SC.cols() - 4);
      const L = [' '];
      L.push([S(TP.center('— TRANSMISIÓN INTERRUMPIDA —', W - 2), 'red b')]);
      L.push(' ');
      TP.wrap(over.text || TP.DEATH_SHORT[over.cause] || '', W - 8).forEach(l => L.push([S('   ' + l, 'hi')]));
      L.push(' ');
      L.push({ sep: 'EXPEDIENTE' });
      statLines(L, arg);
      scr.innerHTML = '<div class="scr">' + TP.box({ w: W, style: 'd', title: 'KT-1 «TOPOLEV» · ' + G.seed, lines: L }) +
        '<div style="margin-top:.6em">' + menuItem('NUEVA EXPEDICIÓN', 'new', 0) + menuItem('MISMA SEMILLA', 'retry', 1) + menuItem('MENÚ PRINCIPAL', 'menu', 2) + '</div></div>';
      focusIdx = 0; setTimeout(() => setFocus(0), 0);
    },
    act(a) {
      const seed = TP.G.seed;
      if (a === 'new') SC.show('newgame');
      if (a === 'retry') TP.Main.startRun(seed);
      if (a === 'menu') SC.show('title');
    },
    onKey(e) { menuKey(e); }
  };
  function statLines(L, arg) {
    const G = TP.G, s = G.stats;
    const kv = (k, v, c) => L.push([S('   ' + TP.pad(k, 24), 'dim'), S(String(v), c || 'xhi b')]);
    kv('Profundidad máxima', TP.fmt(s.maxDepth) + ' m');
    kv('Horizonte', TP.roman(G.h + 1) + ' · ' + TP.HORIZON_NAMES[G.h], 'hi');
    kv('Turnos', G.turn, 'hi');
    kv('Rocas perforadas', s.drilled, 'hi');
    kv('Mineral extraído', s.ore, 'hi');
    kv('Gusanos abatidos', s.kills, 'hi');
    kv('Rublos ganados', TP.fmt(G.earned) + ' ₽', 'gold');
    kv('Órdenes', G.medals.length ? G.medals.map(k => TP.MEDALS.find(m => m.key === k).name).join(', ').slice(0, 34) : '—', 'gold');
    kv('Reprimendas', G.strikes, G.strikes ? 'red' : 'hi');
    L.push(' ');
    L.push([S('   ' + TP.pad('PUNTUACIÓN', 24), 'xhi b'), S(TP.fmt(arg && arg.score || TP.W.score()), 'gold b')]);
    if (arg && arg.rank === 0) L.push([S('   ★ NUEVO RÉCORD EN EL ARCHIVO ★', 'gold b blink')]);
    else if (arg && arg.rank > 0 && arg.rank < 15) L.push([S('   Puesto ' + (arg.rank + 1) + ' en el Archivo.', 'hi')]);
    L.push(' ');
  }

  // ---------- FINAL ----------
  SCREENS.victory = {
    enter(scr, arg) {
      scr.className = 'opaque';
      const W = Math.min(70, SC.cols() - 4);
      this.arg = arg;
      const paras = TP.TXT.ending;
      this.i = 0; this.t = 0;
      const draw = () => {
        const L = [' '];
        paras.slice(0, this.i).forEach((p, k) => {
          TP.wrap(p, W - 8).forEach(l => L.push([S('   ' + l, k === 3 ? 'red b' : k >= 5 ? 'xhi b' : 'hi')]));
          L.push(' ');
        });
        if (this.i >= paras.length) {
          L.push([S(TP.center('★  MISIÓN CUMPLIDA  ★', W - 2), 'gold b')]);
          L.push(' ');
          L.push({ sep: 'EXPEDIENTE' });
          statLines(L, this.arg);
        }
        scr.innerHTML = '<div class="scr" style="animation:none">' + TP.box({ w: W, style: 'd', title: '12.262 m · LA CÁMARA', lines: L }) +
          (this.i >= paras.length ? '<div style="margin-top:.6em">' + menuItem('MENÚ PRINCIPAL', 'menu', 0) + '</div>' : '<div class="ln dd center">[ CLIC PARA CONTINUAR ]</div>') + '</div>';
        if (this.i >= paras.length) { focusIdx = 0; setFocus(0); }
      };
      this.draw = draw;
      draw();
      SC.anim = (dt) => {
        if (this.i >= paras.length) return;
        this.t += dt;
        if (this.t > 3.2) { this.t = 0; this.i++; A(this.i === 4 ? 'wake' : 'type'); draw(); if (this.i >= paras.length) A('victory'); }
      };
      scr.addEventListener('click', e => { if (this.i < paras.length && !e.target.closest('[data-act]')) { this.i++; this.t = 0; draw(); } });
    },
    act(a) { if (a === 'menu') SC.show('title'); },
    onKey(e) { if (this.i < TP.TXT.ending.length) { this.i++; this.t = 0; this.draw(); } else menuKey(e); }
  };

  // ---------- TRANSICIÓN DE DESCENSO ----------
  SCREENS.descend = {
    enter(scr, arg) {
      scr.className = 'opaque';
      const from = arg.from, to = arg.to, h = arg.h;
      scr.innerHTML = '<canvas id="title-bg"></canvas><div class="scr" style="position:relative;z-index:2;text-align:center" id="dsc"></div>';
      const bg = titleBG($('#title-bg'));
      let t = 0;
      const dur = 2.4;
      A('descend');
      SC.anim = (dt, now) => {
        t += dt;
        bg(dt * 6, now);
        const f = TP.easeInOut(Math.min(1, t / (dur * 0.8)));
        const d = TP.lerp(from, to, f);
        const W = 46;
        $('#dsc').innerHTML = TP.box({ w: W, style: 'd', lines: [' ',
          [S(TP.center('DESCENDIENDO', W - 2), 'dim')],
          [S(TP.center(TP.fmt(d) + ' m', W - 2), 'xhi b')],
          ' ',
          [S(TP.center('HORIZONTE ' + TP.roman(h + 1), W - 2), 'hi b')],
          [S(TP.center(TP.HORIZON_NAMES[h], W - 2), 'mid')],
          ' ',
          [S(TP.center('[' + '█'.repeat(Math.round(f * 30)) + '░'.repeat(30 - Math.round(f * 30)) + ']', W - 2), 'hi')],
          ' '] });
        if (t >= dur) { SC.anim = null; arg.onDone && arg.onDone(); }
      };
    },
    onKey() { }
  };

  SC.register = (n, d) => { SCREENS[n] = d; };
  SC.menuItem = menuItem; SC.menuKey = menuKey; SC.setFocus = setFocus;
  SC.statLines = statLines;
  TP.Screens = SC;
})(window.TP);
