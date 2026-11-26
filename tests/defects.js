const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 1400 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/index.html#inicio'); await p.waitForTimeout(1000);
  const kinds = process.argv[2].split(',');
  await p.evaluate(async kinds => {
    const { drawCase } = await import('./js/game/defects.js');
    document.body.innerHTML = '<div id="g" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#000"></div>';
    for (const k of kinds) { const c = document.createElement('canvas'); c.width = 780; c.height = 400; c.style.width = '780px'; document.getElementById('g').appendChild(c); drawCase(c, k); }
  }, kinds);
  await p.waitForTimeout(300); await p.screenshot({ path: `shots/def-${process.argv[3]}.png`, fullPage: true }); console.log(errs); await b.close();
})();
