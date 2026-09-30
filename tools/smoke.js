// Prueba de humo: arranca el juego en Chromium, juega unos turnos y hace capturas.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, '..', 'shots');
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/01-title.png' });
  await p.evaluate(() => TP.Main.startRun('PRUEBA'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/02-brief.png' });
  await p.keyboard.press('x'); await p.waitForTimeout(100); await p.keyboard.press('x');
  await p.waitForTimeout(800);
  for (let i = 0; i < 25; i++) { await p.keyboard.press(i % 7 === 3 ? 'ArrowLeft' : 'ArrowDown'); await p.waitForTimeout(60); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/03-game.png' });
  await p.keyboard.press('q'); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '/04-sonar.png' });
  const st = await p.evaluate(() => ({ turn: TP.G.turn, p: TP.G.p, log: TP.G.log.slice(-5).map(l => l.m) }));
  console.log(JSON.stringify(st));
  console.log(errs.join('\n') || 'SIN ERRORES');
  await b.close();
})();
