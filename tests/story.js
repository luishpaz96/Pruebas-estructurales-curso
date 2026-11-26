// Prueba del modo historia: juega días completos resolviendo cada tipo de misión de forma genérica.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mobile = process.argv[2] === 'mobile'; const days = (process.argv[3] || '0,5').split(',').map(Number);
  const [w, h] = mobile ? [390, 844] : [1280, 800];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const shot = n => p.screenshot({ path: `/home/user/work/tests/shots/s${w}-${n}.png` });
  const vis = s => p.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; }, s);
  const dlg = async () => { for (let i = 0; i < 20; i++) { if (!(await vis('#gDlg')) || !(await vis('#dlgN'))) break; await p.click('#dlgN'); await p.waitForTimeout(120); } };
  const tp = async id => { await p.evaluate(id => window.__tp(id), id); await p.waitForTimeout(300); await p.keyboard.press('e'); await p.waitForTimeout(400); await dlg(); await p.waitForTimeout(300); };
  // Resuelve lo que haya en la capa de minijuego, con clics genéricos
  const solve = async tag => {
    let shotDone = false;
    for (let k = 0; k < 120; k++) {
      if (!(await vis('#gOv'))) return;
      if (!shotDone) { await p.waitForTimeout(600); await shot(tag); shotDone = true; }
      const sel = ['#lsN:not([hidden])', '#lsE', '#nfE', '#qn', '#gOvB .opt:not([disabled])', '#bNG', '#rnx', '#gOvB [data-c]:not([disabled])', '#gOvB .seqc:not([disabled])', '#gOvB .btn.pri:not([disabled])'];
      let clicked = false;
      for (const s of sel) { const e = await p.$(s); if (e && await e.isVisible()) { await e.click().catch(() => {}); clicked = true; break; } }
      await p.waitForTimeout(clicked ? 160 : 400);
      if (!clicked && k > 10) { console.log('  atasco en', tag, '-> saliendo'); await p.click('#gOvX'); return; }
    }
  };
  await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('academia-inspeccion-v1') || '{}'); S.game = { day: 20, done: {}, grades: {} }; localStorage.setItem('academia-inspeccion-v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(3000); await shot('title');
  for (const d of days) {
    await p.click(`[data-d="${d}"]`); await p.waitForTimeout(800); await dlg();
    for (let n = 0; n < 12; n++) {
      const m = await p.evaluate(() => window.__m && window.__m()); if (!m) break;
      console.log(`día ${d} · misión ${m.mi} ${m.id} (${m.type} @ ${m.station})`);
      if (m.type === 'tour') { for (const s of m.stations) await tp(s); await tp(m.station); continue; }
      await tp(m.station); await solve(`d${d}-${m.id}`); await dlg();
      const m2 = await p.evaluate(() => window.__m && window.__m()); if (m2 && m2.id === m.id) { console.log('  la misión no avanzó'); break; }
    }
    // termina el turno adelantando el reloj
    await p.waitForTimeout(500); const rep = await vis('.grade'); console.log('  reporte visible:', rep);
    if (!rep) { await p.evaluate(() => { window.__end && window.__end(); }); await p.waitForTimeout(800); }
    await shot(`d${d}-report`);
    await p.evaluate(() => { const t = document.querySelector('#gtNext'); }); await p.goto('http://localhost:8080/index.html#inicio'); await p.waitForTimeout(300); await p.goto('http://localhost:8080/index.html#juego'); await p.waitForTimeout(2000);
  }
  console.log('ERRORES:', errs.length); errs.slice(0, 20).forEach(e => console.log(e)); await b.close();
})();
