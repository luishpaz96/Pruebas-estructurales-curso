const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const shot = n => p.screenshot({ path: `/home/user/work/tests/shots/cam-${n}.png` });
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('[data-d="5"]'); await p.waitForTimeout(500);
  for (let i = 0; i < 12; i++) { const v = await p.$('#dlgN'); if (!v || !(await v.isVisible())) break; await v.click(); await p.waitForTimeout(100); }
  await p.evaluate(() => window.__tp('aoi')); await p.waitForTimeout(2500); await shot('follow');
  // arrastrar para girar
  await p.mouse.move(640, 450); await p.mouse.down(); await p.mouse.move(400, 420, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(1500); await shot('rotated');
  await p.mouse.wheel(0, -600); await p.waitForTimeout(1500); await shot('zoom');
  await p.keyboard.press('c'); await p.waitForTimeout(800); await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w'); await p.waitForTimeout(800); await shot('free');
  await p.keyboard.press('c'); await p.evaluate(() => window.__inc()); await p.waitForTimeout(2500); await shot('alert');
  await p.keyboard.press('c'); await p.waitForTimeout(300); await p.keyboard.press('f'); await p.waitForTimeout(1500); await shot('peek');
  await p.evaluate(() => window.__tp('ict')); await p.keyboard.press('h'); await p.waitForTimeout(2500); await shot('ict');
  await p.goto('http://localhost:8080/index.html#mant-mt-v8-semanal'); await p.waitForTimeout(3000); await shot('m-v810');
  await p.goto('http://localhost:8080/index.html#mant-mt-ky-mensual'); await p.waitForTimeout(3000); await shot('m-zenith');
  console.log('errores', errs); await b.close();
})();
