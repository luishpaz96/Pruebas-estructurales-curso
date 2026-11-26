const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('[data-d="' + (process.argv[2] || 0) + '"]'); await p.waitForTimeout(500);
  for (let i = 0; i < 12; i++) { const v = await p.$('#dlgN'); if (!v || !(await v.isVisible())) break; await v.click(); await p.waitForTimeout(100); }
  const at = async (id, n, wait = 3000) => { await p.evaluate(id => window.__tp(id), id); await p.waitForTimeout(wait); await p.screenshot({ path: `/home/user/work/tests/shots/life-${n}.png` }); };
  await at('ict', 'ict1', 4000); await at('ict', 'ict2', 6000); await at('spi', 'spi'); await at('prod', 'prod'); await at('mentor', 'mentor'); await at('quality', 'quality');
  console.log('errores', errs); await b.close();
})();
