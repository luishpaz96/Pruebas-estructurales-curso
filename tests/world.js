const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('[data-d="5"]'); await p.waitForTimeout(500);
  for (let i = 0; i < 14; i++) { const v = await p.$('#dlgN'); if (!v || !(await v.isVisible())) break; await v.click(); await p.waitForTimeout(100); }
  for (const s of ['spi', 'aoi', 'axi', 'ict', 'aoi2']) { await p.evaluate(s => window.__tp(s), s); await p.waitForTimeout(2500); await p.screenshot({ path: `shots/w-${s}.png` }); }
  console.log('errores', errs); await b.close();
})();
