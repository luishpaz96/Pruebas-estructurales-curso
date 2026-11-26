// Prueba del modo juego: menú, día 1 (recorrido, quiz, revisión), día 5 (secuencia) y reporte.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const mobile = process.argv[2] === 'mobile';
  const [w, h] = mobile ? [390, 844] : [1280, 800];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const shot = n => p.screenshot({ path: `/home/user/work/tests/shots/g${w}-${n}.png` });
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(3500); await shot('title');
  await p.click('[data-d="0"]'); await p.waitForTimeout(1500); await shot('day1-intro');
  const dlg = async () => { for (let i = 0; i < 12; i++) { const b = await p.$("#dlgN"); if (!b || !(await b.isVisible())) break; if (!(await p.evaluate(() => document.querySelector("#gOv").hidden))) { console.log("dlg under overlay", await p.evaluate(() => document.querySelector("#gOvT").textContent)); break; } await b.click(); await p.waitForTimeout(150); } };
  await dlg();
  await p.waitForTimeout(1500); await shot('day1-play');
  // Teletransporta al jugador cerca de cada estación del recorrido y presiona E
  const tp = async id => { console.log('tp', id, await p.evaluate(() => [document.querySelector('#gOv').hidden, document.querySelector('#gDlg').hidden, document.querySelector('#gOvT')?.textContent])); await p.evaluate(id => { window.__tp && window.__tp(id); }, id); await p.waitForTimeout(500); };
  for (const s of ['spi', 'aoi', 'axi', 'ict']) { await tp(s); await p.keyboard.press('e'); await p.waitForTimeout(400); if (s === 'axi') await shot('day1-axi'); await dlg(); }
  await tp('mentor'); await p.keyboard.press('e'); await p.waitForTimeout(400); await dlg();
  // Misión 2: quiz en AXI
  await tp('axi'); await p.keyboard.press('e'); await p.waitForTimeout(300); await dlg(); await p.waitForTimeout(400); await shot('day1-quiz');
  for (let i = 0; i < 6; i++) { const o = await p.$('#gOvB .opt:not([disabled])'); if (!o) break; await o.click(); await p.waitForTimeout(150); const n = await p.$('#qn'); if (n) await n.click(); await p.waitForTimeout(150); }
  await dlg();
  // Misión 3: revisión AOI
  await tp('aoi'); await p.keyboard.press('e'); await p.waitForTimeout(300); await dlg(); await p.waitForTimeout(400); await shot('day1-review');
  for (let i = 0; i < 8; i++) { const bt = await p.$('#bNG'); if (!bt) break; await bt.click(); await p.waitForTimeout(150); const n = await p.$('#rnx'); if (n) await n.click(); await p.waitForTimeout(200); }
  await dlg(); await p.waitForTimeout(1500); await shot('day1-report');
  // Día 5 directo: secuencia de cambio de fixtura
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1')); S.game.day = 7; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); });
  await p.goto('http://localhost:8080/index.html#inicio'); await p.waitForTimeout(500);
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2500);
  await p.click('[data-d="4"]'); await p.waitForTimeout(800); await dlg();
  await tp('aoi'); await p.keyboard.press('e'); await p.waitForTimeout(300); await dlg(); await p.waitForTimeout(300); await shot('day5-seq');
  await p.evaluate(() => window.__tp && window.__tp('aoi2')); await p.waitForTimeout(300);
  await p.evaluate(() => window.__inc && window.__inc()); await p.waitForTimeout(1500); await shot('day5-incident');
  // Abre NPI de AXI desde el día 4 para ver la interfaz realista
  await p.goto('http://localhost:8080/index.html#crear-axi'); await p.waitForTimeout(1200); await p.click('#impDemo'); await p.waitForTimeout(500); await shot('ui-axi');
  await p.goto('http://localhost:8080/index.html#crear-ict'); await p.waitForTimeout(1200); await p.click('#impDemo'); await p.waitForTimeout(500); await shot('ui-ict');
  await p.goto('http://localhost:8080/index.html#crear-spi'); await p.waitForTimeout(1200); await p.click('#impDemo'); await p.waitForTimeout(500); await shot('ui-spi');
  await p.goto('http://localhost:8080/index.html#crear-aoi'); await p.waitForTimeout(1200); await p.click('#impDemo'); await p.waitForTimeout(500); await shot('ui-aoi');
  await p.goto('http://localhost:8080/index.html#mant-mt-v8-semanal'); await p.waitForTimeout(2500); await shot('mant-v810');
  await p.goto('http://localhost:8080/index.html#mant-mt-ict-diario'); await p.waitForTimeout(2500); await shot('mant-ict');
  console.log('ERRORES:', errs.length); errs.slice(0, 30).forEach(e => console.log(e));
  await b.close();
})();
