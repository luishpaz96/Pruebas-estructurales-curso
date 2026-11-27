const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const w = +(process.argv[2] || 1280); const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(2500);
  await p.click('[data-d="9"]'); await p.waitForTimeout(500);
  for (let i = 0; i < 12; i++) { const v = await p.$('#dlgN'); if (!v || !(await v.isVisible())) break; await v.click(); await p.waitForTimeout(100); }
  const MG = await p.evaluate(async () => { const m = await import('/js/game/minigames.js'); const ov = document.createElement('div'); ov.id = 'tst'; ov.style.cssText = 'position:fixed;inset:0;z-index:99;background:#0c1014;overflow:auto;padding:20px'; document.body.appendChild(ov); window.__rv = m.review; return 1; });
  for (const mc of ['aoi', 'axi']) {
    await p.evaluate(mc => { const ov = document.getElementById('tst'); window.__rv(ov, { machine: mc, count: 3 }, r => { ov.dataset.done = JSON.stringify(r); }); }, mc);
    await p.waitForTimeout(600); await p.screenshot({ path: `/home/user/work/tests/shots/rv-${mc}-${w}.png` });
    await p.click('#bNG'); await p.waitForTimeout(300); await p.screenshot({ path: `/home/user/work/tests/shots/rv2-${mc}-${w}.png` });
  }
  console.log('errores', errs); await b.close();
})();
