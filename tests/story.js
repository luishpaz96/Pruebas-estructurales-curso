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
  const solve = async (tag, proc) => {
    let shotDone = false;
    for (let k = 0; k < 120; k++) {
      if (!(await vis('#gOv'))) return;
      if (proc && await p.$('#gOvB #mxPanel #go')) { // mantenimiento: seguridad y pasos correctos desde la lista
        for (const c of await p.$$('#mxPanel .check input')) await c.check();
        await p.click('#mxPanel #go'); await p.waitForTimeout(150);
        const steps = await p.evaluate(id => COURSE.maintenance.find(m => m.id === id).steps.map(s => [s.part, s.action]), proc);
        for (const [part, act] of steps) {
          await p.evaluate(() => { const d = document.querySelector('#mxPanel details'); if (d) d.open = true; });
          await p.click(`#mxPanel [data-part="${part}"]`); await p.waitForTimeout(60);
          await p.click(`#mxPanel [data-act="${act}"]`); await p.waitForTimeout(80);
        }
        await p.waitForTimeout(400); const out = await p.$('#mxPanel #out'); if (out) await out.click(); await p.waitForTimeout(300); continue;
      }
      if (await p.$('#gOvB #impDemo')) { // NPI: crear programa completo
        if (!shotDone) { await p.waitForTimeout(600); await shot(tag); shotDone = true; }
        await p.click('#impDemo'); await p.waitForTimeout(300);
        await p.click('[data-tab="1"]'); await p.waitForTimeout(300);
        for (const [x, y] of [[3, 3], [57, 37]]) {
          const pt = await p.evaluate(([x, y]) => { const s = document.querySelector('#swView svg'); s.scrollIntoView({ block: 'center' }); const H = +document.querySelector('#swStatus').textContent.match(/× ([\d.]+) mm/)[1];
            const q = s.createSVGPoint(); q.x = x; q.y = H - y; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
          await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(250);
        }
        console.log('  fid:', (await p.$eval('#swLog', e => e.innerText.split('\n').slice(-3).join(' | '))).slice(0,300));
        await p.click('[data-tab="2"]'); await p.waitForTimeout(300);
        await p.evaluate(() => { const pk = COURSE.boards[0].packages; document.querySelectorAll('#swProps [data-pkg]').forEach(s => { const want = pk[s.dataset.pkg]?.algo || 'CR'; const o = [...s.options].find(o => o.value === want) || s.options[1]; s.value = o.value; s.dispatchEvent(new Event('change')); }); });
        await p.click('#libChk'); await p.waitForTimeout(200);
        await p.click('[data-tab="3"]'); await p.waitForTimeout(300);
        await p.evaluate(async () => { const { MODES } = await import('/js/simui.js'); const m = Object.values(MODES).find(m => m.params.every(q => document.querySelector('[data-p="' + q.k + '"]'))); m.params.forEach(q => { const i = document.querySelector('[data-p="' + q.k + '"]'); i.value = Math.round((q.tmin + q.tmax) / 2); i.dispatchEvent(new Event('input')); }); });
        await p.click('[data-tab="4"]'); await p.waitForTimeout(300);
        await p.click('#run'); await p.waitForTimeout(4000);
        console.log('  npi:', (await p.$eval('#swLog', e => e.innerText.split('\n').slice(-3).join(' | ')).catch(() => '')).slice(0, 300));
        if (await p.$('#modal:not([hidden]) button[data-i]')) await p.click('#modal button[data-i]'); await p.waitForTimeout(500); await dlg(); continue;
      }
      if (await vis('#pOk')) { // ajuste de parámetros: barrido por cada control hasta 0 falsos y 0 escapes
        await p.evaluate(() => { const tot = () => +document.querySelector('#pF').textContent + +document.querySelector('#pE').textContent;
          document.querySelectorAll('#swProps input[data-k]').forEach(inp => { let best = null; const lo = +inp.min, hi = +inp.max;
            for (let s = 0; s <= 100; s++) { inp.value = lo + (hi - lo) * s / 100; inp.dispatchEvent(new Event('input')); const t = tot(); if (!best || t < best[0] || (t === best[0] && Math.abs(s - 50) < Math.abs(best[2] - 50))) best = [t, inp.value, s]; }
            inp.value = best[1]; inp.dispatchEvent(new Event('input')); }); });
        await p.click('#pOk'); await p.waitForTimeout(300); continue;
      }
      if (!shotDone) { await p.waitForTimeout(600); await shot(tag); shotDone = true; }
      const sel = ['#lsN:not([hidden])', '#lsE', '#nfE', '#qn', '#gOvB .opt:not([disabled]):not(.wrong)', '#bNG:not([disabled])', '#rnx', '#gOvB [data-c]:not([disabled])', '#gOvB .seqc:not([disabled])', '#gOvB .btn.pri:not([disabled])'];
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
      await tp(m.station); await solve(`d${d}-${m.id}`, m.proc); await dlg();
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
