const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const url = 'http://localhost:8765/index.html';
  await p.goto(url); await p.waitForTimeout(300);
  await p.evaluate(() => { TP.Main.startRun('GUARDA'); TP.Screens.close(); TP.Main.onHorizonStart(); });
  for (let i = 0; i < 10; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(30); }
  const before = await p.evaluate(() => ({ t: TP.G.turn, x: TP.G.p.x, y: TP.G.p.y, f: TP.G.p.fuel }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('[data-act="save"]'); await p.waitForTimeout(200);
  await p.reload(); await p.waitForTimeout(500);
  await p.click('[data-act="continue"]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ t: TP.G.turn, x: TP.G.p.x, y: TP.G.p.y, f: TP.G.p.fuel }));
  console.log(JSON.stringify(before), JSON.stringify(after), errs.join('|') || 'SIN ERRORES');
  await b.close();
})();
