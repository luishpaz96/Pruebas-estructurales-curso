const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const w = +(process.argv[2] || 1280); const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('[data-d="9"]'); await p.waitForTimeout(500);
  for (let i = 0; i < 12; i++) { const v = await p.$('#dlgN'); if (!v || !(await v.isVisible())) break; await v.click(); await p.waitForTimeout(100); }
  await p.evaluate(() => window.__tp('mentor')); await p.evaluate(() => { window.__inc(); window.__inc(); }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/alert-${w}.png` });
  await p.click('[data-go]'); await p.waitForTimeout(9000); await p.screenshot({ path: `shots/alert-go-${w}.png` });
  const acts = await p.$$eval('.gpa', a => a.map(x => x.textContent)); console.log('acciones', acts);
  const v = (await p.$$('.gpa'))[acts.findIndex(t => /Ver el equipo/.test(t))]; if (v) { await v.click(); await p.waitForTimeout(2500); await p.screenshot({ path: `shots/minfo-${w}.png` }); console.log('ficha', (await p.$eval('#gOv', e => e.innerText)).slice(0, 400)); }
  console.log('errores', errs); await b.close();
})();
