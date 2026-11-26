const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.click('[data-d="0"]'); await p.waitForTimeout(500);
  const st = async l => console.log(l, await p.evaluate(() => ({ ov: document.querySelector('#gOv').hidden, dlg: document.querySelector('#gDlg').hidden, t: document.querySelector('#gOvT').textContent, opts: document.querySelectorAll('#gOvB .opt').length, txt: document.querySelector('#gDlg p')?.textContent })));
  const dlg = async () => { for (let i = 0; i < 12; i++) { const v = await p.evaluate(() => !document.querySelector('#gDlg').hidden); if (!v) break; await p.click('#dlgN'); await p.waitForTimeout(100); } };
  await dlg();
  await p.evaluate(() => { for (const s of ['spi','aoi','axi','ict']) {} });
  for (const s of ['spi', 'aoi', 'axi', 'ict', 'mentor']) { await p.evaluate(s => window.__tp(s), s); await p.waitForTimeout(200); await p.keyboard.press('e'); await p.waitForTimeout(200); await dlg(); }
  await p.evaluate(() => window.__tp('axi')); await p.waitForTimeout(200); await p.keyboard.press('e'); await p.waitForTimeout(200); await st('after E'); await dlg(); await st('after brief');
  for (let i = 0; i < 6; i++) { const o = await p.$('#gOvB .opt:not([disabled])'); if (!o) break; await o.click(); await p.waitForTimeout(100); await st('q' + i); const n = await p.$('#qn'); if (n) await n.click(); await p.waitForTimeout(100); }
  await st('end');
  await b.close();
})();
