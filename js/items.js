/* ==========================================================
   items.js — módulos procedurales del Topolev y estadísticas derivadas
   ========================================================== */
'use strict';
(function (TP) {
  const R1 = n => Math.round(n * 10) / 10;
  const R05 = n => Math.round(n * 2) / 2;
  let uid = 0;
  const newId = () => 'm' + Date.now().toString(36) + (uid++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  function rollRarity(h, rng, luck) {
    luck = luck || 0;
    const r = rng.next() - luck;
    const pExp = 0.015 + h * 0.012, pHero = 0.06 + h * 0.025, pRef = 0.25 + h * 0.03;
    if (r < pExp) return 3;
    if (r < pExp + pHero) return 2;
    if (r < pExp + pHero + pRef) return 1;
    return 0;
  }

  function nameFor(type, rarity, rng, auxKey) {
    const mt = TP.MOD_TYPES[type];
    const model = mt.code + '-' + rng.int(1 + rarity * 2, 9 + rarity * 5);
    const ep = rng.pick(TP.EPITHETS);
    if (type === 'aux') return { name: TP.AUX[auxKey].name, model, ep };
    const mat = rng.pick(TP.MATERIALS[type].slice(0, 3 + rarity));
    return { name: mt.name + ' ' + mat, model, ep };
  }

  /* crea un módulo. h = horizonte (0..9), rarity 0..3 */
  function make(type, h, rarity, rng) {
    const m = { id: newId(), type, rarity, h, s: {} };
    const k = TP.RARITY[rarity].mult, x = rng.next(), y = rng.next();
    if (type === 'broca') {
      let power = 1 + Math.floor(h * 0.32 + rarity * 0.55 + x * 1.1);
      power = TP.clamp(power, 1, 6);
      let tier = 1;
      const pt2 = 0.1 + h * 0.13 + rarity * 0.15, pt3 = h >= 4 ? (h - 3) * 0.08 + rarity * 0.1 : 0;
      if (y < pt3) tier = 3; else if (y < pt2 + pt3) tier = 2;
      const heatMult = TP.clamp(R1(1.15 + power * 0.07 + (tier - 1) * 0.08 - rarity * 0.12 - rng.next() * 0.25), 0.45, 1.6);
      m.s = { power, tier, heatMult };
    } else if (type === 'motor') {
      const fuelMult = TP.clamp(R1(1.0 - h * 0.035 - rarity * 0.07 - x * 0.15), 0.4, 1.1);
      const fuelMax = Math.round((190 + h * 14 * k + rarity * 25 + y * 40) / 5) * 5;
      m.s = { fuelMult, fuelMax };
    } else if (type === 'refri') {
      const cooling = R05(TP.clamp(2 + h * 0.3 * k + rarity * 0.5 + x * 1.0, 2, 9));
      m.s = { cooling };
    } else if (type === 'blindaje') {
      const hull = Math.round((95 + h * 11 * k + rarity * 18 + x * 25) / 5) * 5;
      const dr = R1(TP.clamp(0.02 * h + rarity * 0.05 + y * 0.08, 0, 0.45) * 100) / 100;
      m.s = { hull, dr };
    } else if (type === 'aux') {
      const key = rng.pick(TP.AUX_KEYS);
      const lv = TP.clamp(1 + (rarity >= 2 ? 1 : 0) + (rarity >= 3 || (h >= 5 && x < 0.35) ? 1 : 0), 1, 3);
      m.s = { aux: key, lv };
    }
    const nm = nameFor(type, rarity, rng, m.s.aux);
    m.name = nm.name; m.model = nm.model; m.ep = nm.ep;
    m.price = priceOf(m);
    return m;
  }

  function priceOf(m) {
    const base = { broca: 70, motor: 55, refri: 55, blindaje: 60, aux: 65 }[m.type];
    let p = base * (1 + m.h * 0.3) * (1 + m.rarity * 0.7);
    if (m.type === 'broca') p *= 0.6 + m.s.power * 0.25 + (m.s.tier - 1) * 0.5;
    if (m.type === 'aux') p *= 0.7 + m.s.lv * 0.35;
    return Math.round(p / 5) * 5;
  }

  function random(h, rng, luck) {
    const type = rng.weighted([['broca', 3], ['motor', 2], ['refri', 2.2], ['blindaje', 2], ['aux', 3.2]]);
    return make(type, h, rollRarity(h, rng, luck), rng);
  }

  function starter() {
    const mk = (type, name, model, s) => {
      const m = { id: newId(), type, rarity: 0, h: 0, s, name, model, ep: 'Estándar' };
      m.price = priceOf(m); return m;
    };
    return {
      broca: mk('broca', 'Broca de acero', 'БР-1', { power: 1, tier: 1, heatMult: 1.0 }),
      motor: mk('motor', 'Motor diésel', 'МТ-1', { fuelMult: 1.0, fuelMax: 200 }),
      refri: mk('refri', 'Refrigerador de glicol', 'ОХ-1', { cooling: 2 }),
      blindaje: mk('blindaje', 'Blindaje de acero', 'БН-1', { hull: 100, dr: 0 }),
      aux1: null, aux2: null
    };
  }

  // nombre completo
  const fullName = m => m.name + ' ' + m.model + ' «' + m.ep + '»';

  // compatibilidad módulo ↔ ranura
  const fits = (m, slot) => m && (slot === 'aux1' || slot === 'aux2' ? m.type === 'aux' : m.type === slot);
  const slotFor = m => (m.type === 'aux' ? 'aux1' : m.type);

  /* líneas de descripción: [{k:etiqueta, v:valor, c:clase, cmp:+1/-1}] */
  function statLines(m) {
    const s = m.s, L = [];
    if (m.type === 'broca') {
      L.push({ k: 'Potencia', v: s.power, n: s.power, better: 1 });
      L.push({ k: 'Nivel', v: s.tier + (s.tier >= 3 ? ' (obsidiana)' : s.tier >= 2 ? ' (basalto)' : ''), n: s.tier, better: 1 });
      L.push({ k: 'Calor/golpe', v: '×' + s.heatMult.toFixed(2), n: s.heatMult, better: -1 });
    } else if (m.type === 'motor') {
      L.push({ k: 'Consumo', v: '×' + s.fuelMult.toFixed(2), n: s.fuelMult, better: -1 });
      L.push({ k: 'Depósito', v: s.fuelMax, n: s.fuelMax, better: 1 });
    } else if (m.type === 'refri') {
      L.push({ k: 'Refrigeración', v: s.cooling + '/turno', n: s.cooling, better: 1 });
    } else if (m.type === 'blindaje') {
      L.push({ k: 'Casco', v: s.hull, n: s.hull, better: 1 });
      L.push({ k: 'Absorción', v: Math.round(s.dr * 100) + '%', n: s.dr, better: 1 });
    } else if (m.type === 'aux') {
      L.push({ k: 'Nivel', v: 'I'.repeat(s.lv), n: s.lv, better: 1 });
      L.push({ k: '', v: TP.AUX[s.aux].desc(s.lv), n: null });
    }
    return L;
  }

  /* estadísticas derivadas de la partida */
  function derive(run) {
    const e = run.equip;
    const s = {
      power: 1, tier: 1, heatMult: 1, fuelMult: 1, fuelMax: 200, cooling: 2, hullMax: 100, dr: 0,
      vision: 6, sonarR: 10, sonarCost: 8, cargo: 12, magnet: 0, thermo: 0, lead: 0, gasTh: 50,
      repairEvery: 0, shock: 0, dynR: 1, dynBonus: 0, asbest: 0, ambRed: 0, silent: 0, sellMult: 1,
      drillFuel: 1, leadSell: 1, starDyn: 0
    };
    if (e.broca) { s.power = e.broca.s.power; s.tier = e.broca.s.tier; s.heatMult = e.broca.s.heatMult; }
    if (e.motor) { s.fuelMult = e.motor.s.fuelMult; s.fuelMax = e.motor.s.fuelMax; }
    if (e.refri) s.cooling = e.refri.s.cooling;
    if (e.blindaje) { s.hullMax = e.blindaje.s.hull; s.dr = e.blindaje.s.dr; }
    for (const slot of ['aux1', 'aux2']) {
      const m = e[slot]; if (!m) continue;
      const l = m.s.lv;
      switch (m.s.aux) {
        case 'sonar': s.sonarR += 3 * l; s.sonarCost *= 1 - [0.25, 0.4, 0.6][l - 1]; break;
        case 'lights': s.vision += l; break;
        case 'magnet': s.magnet = Math.min(0.95, s.magnet + [0.3, 0.5, 0.75][l - 1]); break;
        case 'hold': s.cargo += [4, 7, 10][l - 1]; break;
        case 'thermo': s.thermo += l; break;
        case 'lead': s.lead = Math.max(s.lead, l); break;
        case 'gas': s.gasTh = Math.max(s.gasTh, 50 + 15 * l); break;
        case 'repair': s.repairEvery = s.repairEvery ? Math.max(1, Math.min(s.repairEvery, [6, 4, 2][l - 1]) - 1) : [6, 4, 2][l - 1]; break;
        case 'shock': s.shock = Math.min(0.9, s.shock + [0.4, 0.6, 0.8][l - 1]); break;
        case 'charge': s.dynR += l >= 2 ? 1 : 0; s.dynBonus += l; break;
        case 'asbest': s.asbest = Math.min(0.9, s.asbest + [0.35, 0.55, 0.75][l - 1]); s.ambRed += 4 * l; break;
        case 'silent': s.silent = Math.min(0.9, s.silent + [0.35, 0.55, 0.75][l - 1]); break;
      }
    }
    for (const md of run.medals) {
      switch (md) {
        case 'lenin': s.hullMax += 20; break;
        case 'hero': s.cooling += 1; break;
        case 'star': s.starDyn += 2; break;
        case 'banner': s.fuelMax += 40; break;
        case 'october': s.power += 1; break;
        case 'valor': s.dr = Math.min(0.7, s.dr + 0.15); break;
        case 'glory': s.vision += 1; break;
        case 'friend': s.sellMult += 0.2; break;
        case 'stakh': s.drillFuel *= 0.8; break;
      }
    }
    if (s.lead >= 3) s.leadSell = 1.2;
    s.sonarCost = Math.max(2, Math.round(s.sonarCost));
    return s;
  }

  TP.Items = { make, random, starter, rollRarity, priceOf, fullName, fits, slotFor, statLines, derive };
})(window.TP);
