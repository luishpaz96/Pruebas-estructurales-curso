const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const m of ['aoi', 'axi', 'ict', 'spi']) { await p.goto('http://localhost:8080/index.html#crear-' + m); await p.waitForTimeout(900); await p.click('#impDemo'); await p.waitForTimeout(400); await p.screenshot({ path: `shots/ui-${m}.png`, fullPage: false }); }
  const pr = await p.evaluate(() => (window.COURSE.practices.find(x => x.machine === 'aoi_v510') || {}).id);
  if (pr) { await p.goto('http://localhost:8080/index.html#practica-' + pr); await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/ui-v510.png' }); }
  console.log('practica v510', pr, 'errores', errs); await b.close();
})();
