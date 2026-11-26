const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8080/index.html#mant-mt-ict-diario'); await p.waitForTimeout(2500);
  await p.click('#mxExp'); await p.waitForTimeout(300);
  const bb = await (await p.$('#mxStage')).boundingBox();
  await p.click('#mxPedal'); await p.waitForTimeout(300); await p.screenshot({ path: 'shots/pd-check.png' });
  for (const c of await p.$$('[data-pc]')) await c.check();
  await p.click('#mxGo'); await p.waitForTimeout(1500); await p.screenshot({ path: 'shots/pd-moving.png' });
  await p.waitForTimeout(3500); await p.screenshot({ path: 'shots/pd-service.png' });
  let found = '';
  for (let y = .3; y <= .8 && !found; y += .03) for (let x = .3; x <= .75 && !found; x += .03) {
    await p.mouse.click(bb.x + bb.width * x, bb.y + bb.height * y); await p.waitForTimeout(40);
    const t = await p.$eval('#mxInfo', e => e.hidden ? '' : (e.querySelector('img') ? e.querySelector('b')?.textContent : ''));
    if (t) found = t;
  }
  await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/pd-card.png' });
  console.log('carta:', found, errs); await b.close();
})();
