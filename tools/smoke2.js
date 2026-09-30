const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|fonts/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(() => { TP.Main.startRun('PRUEBA2'); TP.Screens.close(); TP.Main.onHorizonStart(); });
  await p.waitForTimeout(400);
  for (let i = 0; i < 12; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(40); }
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/05-game.png' });
  // hover a cell
  const pos = await p.evaluate(() => { const s = TP.R.cellToScreen(TP.G.p.x + 1, TP.G.p.y + 1); return s; });
  await p.mouse.move(pos.x, pos.y); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/06-hover.png' });
  // cargar bodega y teletransportar a la estación
  await p.evaluate(() => {
    const G = TP.G; G.cargo.copper = 5; G.cargo.iron = 4; G.rublos = 900;
    G.inv.push(TP.Items.random(3, new TP.RNG(5))); G.inv.push(TP.Items.make('aux', 4, 2, new TP.RNG(9)));
    const s = G.map.station; G.p.x = s.x; G.p.y = s.y - 1; TP.W.act(0, 1);
  });
  await p.waitForTimeout(3000);
  await p.keyboard.press('x'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/07-station.png' });
  // arrastrar cobre al plan
  const src = await p.$('[data-drag="ore:copper"]'); const dst = await p.$('[data-drop="quota"]');
  const a = await src.boundingBox(), c = await dst.boundingBox();
  await p.mouse.move(a.x + 10, a.y + 5); await p.mouse.down(); await p.mouse.move(a.x + 40, a.y + 30, { steps: 5 });
  await p.mouse.move(c.x + 60, c.y + 60, { steps: 10 }); await p.waitForTimeout(100);
  await p.screenshot({ path: OUT + '/08-drag.png' });
  await p.mouse.up(); await p.waitForTimeout(300);
  // arrastrar módulo del inventario a aux1
  const m = await p.$('[data-drop="inv"] [data-drag]');
  const s1 = await p.$('[data-drop="slot:aux1"]');
  if (m && s1) { const ma = await m.boundingBox(), sa = await s1.boundingBox(); await p.mouse.move(ma.x + 10, ma.y + 5); await p.mouse.down(); await p.mouse.move(sa.x + 50, sa.y + 5, { steps: 10 }); await p.mouse.up(); }
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/09-station2.png' });
  const q = await p.evaluate(() => ({ q: TP.G.quota, aux: TP.G.equip.aux1 && TP.G.equip.aux1.name, inv: TP.G.inv.length }));
  console.log(JSON.stringify(q));
  await p.click('[data-act="descend"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/10-verdict.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/11-descend.png' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/12-h2.png' });
  console.log(JSON.stringify(await p.evaluate(() => ({ h: TP.G.h, medals: TP.G.medals, scr: TP.Screens.cur && TP.Screens.cur.name }))));
  // muerte
  await p.evaluate(() => { TP.G.p.hull = 1; TP.G.p.heat = 120; TP.W.wait(); });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: OUT + '/13-over.png' });
  await p.evaluate(() => TP.Screens.show('help', { back: 'title' }));
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/14-help.png' });
  await p.keyboard.press('4'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/15-help4.png' });
  await p.evaluate(() => TP.Screens.show('records'));
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/16-rec.png' });
  console.log(errs.join('\n') || 'SIN ERRORES');
  await b.close();
})();
