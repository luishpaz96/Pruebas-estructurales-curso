const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const [id, n] of [['mt-ict-diario', 'ict'], ['mt-v8-semanal', 'v810'], ['mt-ky-mensual', 'zenith']]) {
    await p.goto('http://localhost:8080/index.html#mant-' + id); await p.waitForTimeout(2500);
    await p.click('#mxExp'); await p.waitForTimeout(800); await p.screenshot({ path: `shots/in-${n}-ghost.png` });
    const st = await p.$('#mxStage'); const bb = await st.boundingBox(); let found = '';
    for (let y = .35; y <= .75 && !found; y += .05) for (let x = .3; x <= .7 && !found; x += .04) { await p.mouse.click(bb.x + bb.width * x, bb.y + bb.height * y); await p.waitForTimeout(60); const t = await p.$eval('#mxInfo', e => e.hidden ? '' : e.querySelector('b')?.textContent || ''); if (t && t !== 'Modo exploración') found = t; }
    await p.waitForTimeout(900); await p.screenshot({ path: `shots/in-${n}-pick.png` }); console.log(n, '->', found);
  }
  console.log('errores', errs); await b.close();
})();
