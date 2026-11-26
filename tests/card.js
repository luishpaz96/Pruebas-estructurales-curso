const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.argv[2]||1280), height: 860 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/index.html#mant-mt-ict-diario'); await p.waitForTimeout(2500); await p.click('#mxExp'); await p.waitForTimeout(500);
  const bb = await (await p.$('#mxStage')).boundingBox(); let found = '';
  for (let y = .5; y <= .8 && !found; y += .03) for (let x = .35; x <= .7 && !found; x += .03) { await p.mouse.click(bb.x + bb.width * x, bb.y + bb.height * y); await p.waitForTimeout(50); const t = await p.$eval('#mxInfo', e => e.hidden ? '' : e.querySelector('b')?.textContent || ''); if (/Tarjeta|ASRU|Control/.test(t)) found = t; }
  await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/in-ict-card.png' }); console.log(found, errs); await b.close();
})();
