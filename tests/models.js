// Capturas de los 5 modelos reales en el visor
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const pre = process.argv[2] || 'mdl'; const list = (process.argv[3] || 'zenith,ky8030,v510,v810,hp3070').split(','); const cam = process.argv[4] || '';
  for (const m of list) {
    const c = cam || ({ v810: '9,5.5,10', hp3070: '7,5,8' })[m] || '6,4.6,7.5';
    await p.goto(`http://localhost:8090/viewer.html?m=${m}&cam=${c}`); await p.waitForTimeout(3500);
    await p.screenshot({ path: `/home/user/work/tests/shots/${pre}-${m}.png` });
  }
  console.log('errores', errs.slice(0, 5)); await b.close();
})();
