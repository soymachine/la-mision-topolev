/* ==========================================================
   save.js — persistencia en localStorage (partida, récords, opciones)
   ========================================================== */
'use strict';
(function (TP) {
  const K_RUN = 'topolev.run.v1', K_REC = 'topolev.records.v1', K_OPT = 'topolev.opts.v1';
  const DEF = { sound: true, volume: 0.7, crt: true, particles: 'normal', zoom: 'auto', shake: true };
  let opts = null;

  function get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

  // Uint8Array → cadena compacta (base64)
  function packU8(a) {
    let s = '';
    for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
    return btoa(s);
  }
  function unpackU8(s) {
    const b = atob(s), a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }

  const S = {
    opts() { if (!opts) opts = Object.assign({}, DEF, get(K_OPT) || {}); return opts; },
    setOpt(k, v) { S.opts()[k] = v; set(K_OPT, opts); TP.bus.emit('opts'); },

    hasRun() { const r = get(K_RUN); return !!(r && r.v === TP.CFG.VERSION && !r.over); },
    runInfo() { return get(K_RUN); },
    saveRun() {
      const G = TP.G;
      if (!G || G.over) return false;
      const m = G.map;
      const snap = Object.assign({}, G, {
        map: Object.assign({}, m, { t: packU8(m.t), hp: packU8(m.hp), seen: packU8(m.seen), fall: undefined, packed: true }),
        worms: G.worms.map(w => ({ id: w.id, segs: w.segs, hp: w.hp, maxHp: w.maxHp, awake: w.awake, calm: w.calm, cd: w.cd, speed: w.speed, tick: w.tick })),
        savedAt: Date.now()
      });
      return set(K_RUN, snap);
    },
    loadRun() {
      const r = get(K_RUN);
      if (!r || r.v !== TP.CFG.VERSION) return null;
      if (r.map && r.map.packed) {
        r.map.t = unpackU8(r.map.t); r.map.hp = unpackU8(r.map.hp); r.map.seen = unpackU8(r.map.seen);
        delete r.map.packed;
      }
      return r;
    },
    clearRun() { del(K_RUN); },

    records() { return get(K_REC) || []; },
    addRecord(rec) {
      const L = S.records();
      L.push(rec);
      L.sort((a, b) => b.score - a.score);
      set(K_REC, L.slice(0, 15));
      return L.indexOf(rec);
    },
    wipeAll() { del(K_RUN); del(K_REC); del(K_OPT); opts = null; }
  };
  TP.Save = S;
})(window.TP);
