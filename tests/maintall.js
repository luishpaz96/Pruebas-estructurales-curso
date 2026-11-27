// Recorre todos los mantenimientos del taller con las respuestas correctas y reporta si alguno se traba.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8080/index.html#inicio'); await p.waitForTimeout(1000);
  const procs = await p.evaluate(() => window.COURSE.maintenance.map(m => ({ id: m.id, steps: m.steps.map(s => [s.part, s.action]) })));
  for (const pr of procs.slice(+(process.argv[2] || 0))) {
    await p.goto('http://localhost:8080/index.html#mant-' + pr.id); await p.waitForTimeout(1500);
    for (const c of await p.$$('#mxPanel [data-s]')) await c.check(); await p.click('#go'); await p.waitForTimeout(200);
    let k = 0, stuck = '';
    for (const [part, act] of pr.steps) {
      const lb = await p.$(`#mxPanel [data-part="${part}"]`); if (!lb) { stuck = `paso ${k + 1}: pieza ${part} no está en la lista`; break; }
      await p.evaluate(() => { const d = document.querySelector('#mxPanel details'); if (d) d.open = true; });
      await lb.click(); await p.waitForTimeout(80); await p.click(`#mxPanel [data-act="${act}"]`); await p.waitForTimeout(120); k++;
    }
    const fin = await p.$eval('#mxPanel', e => e.innerText.slice(0, 60).replace(/\n/g, ' '));
    console.log(pr.id, stuck || 'OK', '·', fin);
  }
  console.log('errores', errs); await b.close();
})();
