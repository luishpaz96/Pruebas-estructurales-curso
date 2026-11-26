// Prueba de humo: recorre pantallas, animaciones, un mantenimiento, "Crea tu programa", una práctica y un examen.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const mobile = process.argv[2] === 'mobile';
  const [w, h] = mobile ? [390, 844] : [1280, 800];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const shot = n => p.screenshot({ path: `/home/user/work/tests/shots/${w}-${n}.png` });
  const go = async (hash, name, wait = 1500) => { await p.goto('http://localhost:8080/index.html#' + hash); await p.waitForTimeout(wait); if (name) await shot(name); };
  await go('inicio', 'inicio', 2500);
  await go('mapa', 'mapa');
  await go('modulo-m1', 'modulo');
  await go('leccion-m1-l1', 'leccion', 2500);
  if (!mobile) for (const a of ['moire_fringes', 'xray_tomo', 'ict_bed_of_nails', 'solder_joint', 'calibration_target', 'conveyor_fiducial', 'spi_paste_volume', 'defect_gallery', 'process_flow', 'safety_radiation']) {
    await p.evaluate(a => { window.COURSE.modules[1].lessons[0].animation = a; location.hash = 'mapa'; }, a); await p.waitForTimeout(200);
    await p.evaluate(() => { location.hash = 'leccion-m1-l1'; }); await p.waitForTimeout(2200);
    await shot('anim-' + a);
  }
  await go('taller', 'taller', 2000);
  await go('mant-mt-ky-mensual', 'mant1', 1500);
  for (const c of await p.$$('[data-s]')) await c.check();
  await p.click('#go'); await p.waitForTimeout(500);
  const steps = await p.evaluate(() => window.COURSE.maintenance.find(x => x.id === 'mt-ky-mensual').steps);
  for (const s of steps) {
    await p.click('details summary'); await p.click(`[data-part="${s.part}"]`); await p.waitForTimeout(150);
    await p.click(`[data-act="${s.action}"]`); await p.waitForTimeout(300);
  }
  await p.waitForTimeout(800); await shot('mant-fin');
  await go('simulador', 'simulador');
  await go('crear-aoi', 'crear0');
  await p.click('#impDemo'); await p.waitForTimeout(400);
  await p.click('[data-tab="1"]'); await p.waitForTimeout(300);
  for (const [x, y] of [[3, 3], [57, 37]]) {
    await p.evaluate(([x, y]) => { const svg = document.querySelector('#swView svg'); const pt = svg.createSVGPoint(); pt.x = x; pt.y = 40 - y; const s = pt.matrixTransform(svg.getScreenCTM()); svg.dispatchEvent(new MouseEvent('click', { clientX: s.x, clientY: s.y, bubbles: true })); }, [x, y]);
    await p.waitForTimeout(200);
  }
  await shot('crear1');
  await p.click('[data-tab="2"]'); await p.waitForTimeout(300);
  const pk = await p.evaluate(() => window.COURSE.boards[0].packages);
  for (const sel of await p.$$('[data-pkg]')) { const k = await sel.getAttribute('data-pkg'); await sel.selectOption(pk[k].algo); }
  await p.click('#libChk'); await p.waitForTimeout(200);
  await shot('crear2');
  await p.click('[data-tab="3"]'); await p.waitForTimeout(300);
  const M = { off: 36, hgt: 38, pol: 62, vmin: 62, vmax: 150, dia: 77, void: 26, fill: 75, tol: 10, short: 12 };
  for (const r of await p.$$('[data-p]')) { const k = await r.getAttribute('data-p'); await r.fill(String(M[k])); }
  await p.waitForTimeout(300); await shot('crear3');
  await p.click('[data-tab="4"]'); await p.click('#run'); await p.waitForTimeout(2500);
  await shot('crear4');
  const mbtn = await p.$('#modal button'); if (mbtn) await mbtn.click();
  await go('practica-pr-ky-debug-tomb', 'practica');
  await go('examen-m1', 'examen0', 800);
  for (let i = 0; i < 10; i++) { const o = await p.$$('.opt'); await o[0].click(); await p.waitForTimeout(80); }
  await p.click('#end'); await p.waitForTimeout(300);
  const mb = await p.$('#modal .btn.pri'); if (mb) await mb.click();
  await p.waitForTimeout(800); await shot('examen-fin');
  await go('perfil', 'perfil'); await go('ajustes', 'ajustes');
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('academia-inspeccion-v1')));
  console.log('XP', st.xp, 'badges', Object.keys(st.badges).join(','), 'maint', JSON.stringify(st.maint), 'prac', JSON.stringify(st.prac), 'exams', JSON.stringify(st.exams));
  console.log('ERRORES:', errs.length); errs.slice(0, 30).forEach(e => console.log(e));
  await b.close();
})();
