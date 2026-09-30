const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errs = [];
  for (const vp of [{ width: 1600, height: 900, n: 'd' }, { width: 390, height: 844, n: 'm', touch: true }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
    await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await p.waitForTimeout(400);
    await p.evaluate(() => { TP.Main.startRun('FINAL'); TP.Screens.close(); TP.W.loadHorizon(9); TP.Main.onHorizonStart(); });
    await p.waitForTimeout(500);
    for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50); }
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/20-h10-' + vp.n + '.png' });
    await p.evaluate(() => { const G = TP.G, s = G.map.station; G.p.x = s.x; G.p.y = s.y - 1; for (let y = s.y - 1; y > s.y - 6; y--) G.map.seen.fill(1); TP.W.updateVision(); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/21-chamber-' + vp.n + '.png' });
    await p.evaluate(() => TP.W.act(0, 1));
    await p.waitForTimeout(1700);
    for (let i = 0; i < 8; i++) { await p.mouse.click(10, 10); await p.waitForTimeout(80); }
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/22-victory-' + vp.n + '.png' });
    await ctx.close();
  }
  console.log(errs.join('\n') || 'SIN ERRORES');
  await b.close();
})();
