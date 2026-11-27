// Visita todas las pantallas de la app y reporta errores de JS por ruta.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.argv[2] || 1280), height: 800 } }); let errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8080/index.html#inicio'); await p.waitForTimeout(1200);
  const C = await p.evaluate(() => ({ mods: COURSE.modules.map(m => m.id), les: COURSE.modules.flatMap(m => (m.lessons || []).map(l => l.id)), mt: COURSE.maintenance.map(m => m.id), pr: COURSE.practices.map(m => m.id) }));
  const routes = ['inicio', 'mapa', 'taller', 'simulador', 'examenes', 'perfil', 'ajustes', 'repaso', ...C.mods.map(m => 'modulo-' + m), ...C.les.map(l => 'leccion-' + l), ...C.mods.map(m => 'examen-' + m), 'examen-final', ...C.mt.map(m => 'mant-' + m), ...C.pr.map(m => 'practica-' + m), 'crear-aoi', 'crear-spi', 'crear-axi', 'crear-ict'];
  let bad = 0;
  for (const r of routes) {
    errs = []; await p.evaluate(r => { location.hash = r; }, r); await p.waitForTimeout(r.startsWith('leccion') || r.startsWith('mant') ? 700 : 350);
    const empty = await p.evaluate(() => (document.querySelector('main')?.innerText || '').trim().length < 20);
    if (errs.length || empty) { bad++; console.log('✗', r, empty ? '(pantalla vacía)' : '', errs.slice(0, 3).join(' | ')); }
  }
  console.log(`rutas: ${routes.length}, con problemas: ${bad}`); await b.close();
})();
