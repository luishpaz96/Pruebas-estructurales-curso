// Capturas de las interfaces de software de cada máquina
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const w = +(process.argv[3] || 1280);
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const pre = process.argv[2] || 'ui';
  const list = process.argv[4] ? process.argv[4].split(',').map(x => [x, /^crear/.test(x) ? 1 : 0]) : [['crear-aoi', 1], ['crear-spi', 1], ['crear-axi', 1], ['crear-ict', 1], ['practica-pr-v5-create', 0], ['practica-pr-v8-create-bga', 0], ['practica-pr-ict-create', 0], ['practica-pr-ky-debug-tomb', 0]];
  for (const [r, imp] of list) {
    await p.goto('http://localhost:8080/index.html#' + r); await p.waitForTimeout(1200);
    if (imp) { await p.click('#impDemo'); await p.waitForTimeout(500); }
    const el = await p.$('.sw'); if (el) await el.screenshot({ path: `/home/user/work/tests/shots/${pre}-${r}.png` });
    else console.log('sin .sw', r);
  }
  console.log('errores', errs); await b.close();
})();
