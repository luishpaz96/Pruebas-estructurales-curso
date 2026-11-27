// Prueba directa de "Crea tu programa" en cada máquina: importar, fiduciales, librería, umbrales ideales y lote.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const mode of (process.argv[2] || 'aoi,spi,axi,ict').split(',')) {
    await p.goto('http://localhost:8080/index.html#crear-' + mode); await p.waitForTimeout(1500);
    await p.click('#impDemo'); await p.waitForTimeout(300);
    await p.click('[data-tab="1"]'); await p.waitForTimeout(300);
    for (const [x, y] of [[3, 3], [57, 37]]) {
      const pt = await p.evaluate(([x, y]) => { const s = document.querySelector('#swView svg'); s.scrollIntoView({ block: 'center' }); const H = +document.querySelector('#swStatus').textContent.match(/× ([\d.]+) mm/)[1];
        const q = s.createSVGPoint(); q.x = x; q.y = H - y; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
      await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(200);
    }
    await p.click('[data-tab="2"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const pk = COURSE.boards[0].packages; document.querySelectorAll('#swProps [data-pkg]').forEach(s => { const want = pk[s.dataset.pkg]?.algo || 'CR'; const o = [...s.options].find(o => o.value === want) || s.options[1]; s.value = o.value; s.dispatchEvent(new Event('change')); }); });
    await p.click('#libChk'); await p.waitForTimeout(200);
    await p.click('[data-tab="3"]'); await p.waitForTimeout(300);
    const set = await p.evaluate(async () => { const { MODES } = await import('/js/simui.js'); const m = Object.values(MODES).find(m => m.params.every(q => document.querySelector('[data-p="' + q.k + '"]'))); return m.params.map(q => { const i = document.querySelector('[data-p="' + q.k + '"]'); i.value = Math.round((q.tmin + q.tmax) / 2); i.dispatchEvent(new Event('input')); return q.k + '=' + i.value; }); });
    const est = await p.evaluate(() => document.querySelector('#estF').textContent + ' falsos / ' + document.querySelector('#estE').textContent + ' escapes');
    await p.click('[data-tab="4"]'); await p.waitForTimeout(300);
    await p.click('#run'); await p.waitForTimeout(2500);
    const log = await p.$eval('#swLog', e => e.innerText.split('\n').filter(l => /Librería|Resultado/.test(l)).join(' | '));
    console.log(mode, set.join(','), 'estimado', est, '\n  ', log);
    await p.screenshot({ path: `/home/user/work/tests/shots/npi-${mode}.png` });
    const md = await p.$('#modal:not([hidden]) button[data-i]'); if (md) await md.click();
  }
  console.log('errores', errs); await b.close();
})();
