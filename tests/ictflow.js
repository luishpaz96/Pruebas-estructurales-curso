// Flujo completo del ICT en el taller: pedal, fixture, giro, tarjetas, regreso.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const info = () => p.$eval('#mxInfo', e => e.hidden ? '(oculto)' : e.innerText.split('\n')[0]);
  const btn = async (id, wait = 300) => { await p.click(id); await p.waitForTimeout(wait); const t = await info(); console.log(id, '->', t); return t; };
  await p.goto('http://localhost:8080/index.html#mant-mt-ict-diario'); await p.waitForTimeout(2500);
  await btn('#mxRot'); await btn('#mxFix'); await btn('#mxPedal'); await btn('#mxFix');
  await btn('#mxRot'); for (const c of await p.$$('[data-pc]')) await c.check(); await btn('#mxGo', 5500);
  await p.screenshot({ path: 'shots/ict-service.png' });
  // saca una tarjeta sin modo explorar
  const bb = await (await p.$('#mxStage')).boundingBox(); let found = '';
  for (let y = .3; y <= .8 && !found; y += .03) for (let x = .3; x <= .75 && !found; x += .03) { await p.mouse.click(bb.x + bb.width * x, bb.y + bb.height * y); await p.waitForTimeout(40); const t = await p.$eval('#mxInfo', e => e.hidden ? '' : (e.querySelector('img') ? e.querySelector('b')?.textContent : '')); if (t) found = t; }
  console.log('tarjeta fuera:', found);
  await btn('#mxRot'); const all = await p.$('#mxAll'); if (all) { await all.click(); await p.waitForTimeout(300); console.log('meter todas ->', await info()); }
  await p.waitForTimeout(5500); await p.screenshot({ path: 'shots/ict-back.png' });
  await btn('#mxFix'); await btn('#mxPedal');
  console.log('botones:', await p.$$eval('#mxStage .ctrl button:not([hidden])', bs => bs.map(b => b.textContent).join(' | ')));
  // vuelve a girar dos veces seguidas para buscar trabas
  await btn('#mxPedal'); await btn('#mxFix'); await btn('#mxRot'); for (const c of await p.$$('[data-pc]')) await c.check(); await btn('#mxGo', 5500); await btn('#mxRot', 5500); await btn('#mxRot');
  console.log('errores', errs); await b.close();
})();
