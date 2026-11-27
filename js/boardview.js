// Render realista de la tarjeta PRACTICA-01 según la máquina:
//  aoi → imagen a color de cámara (máscara, cobre ENIG, soldadura, cuerpos de componentes con relieve)
//  spi → mapa de alturas de pasta (colores 3D como en un SPI real), sin componentes
//  axi → imagen de rayos X en escala de grises (más soldadura = más oscuro)
//  ict → vista CAD de fixture (contornos, pads, nodos y puntos de prueba)
// Todas las coordenadas en mm con Y hacia arriba (grupo invertido), igual que los Gerber.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let uid = 0;

// pseudoaleatorio estable por texto (alturas de pasta, ruido)
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };

function defs(id, style) {
  return `<defs>
  <linearGradient id="${id}mask" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b6b3c"/><stop offset=".55" stop-color="#125632"/><stop offset="1" stop-color="#0c4527"/></linearGradient>
  <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d88a"/><stop offset=".5" stop-color="#d4ac4c"/><stop offset="1" stop-color="#a8822e"/></linearGradient>
  <linearGradient id="${id}tin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".45" stop-color="#b9c0c7"/><stop offset="1" stop-color="#7d868f"/></linearGradient>
  <linearGradient id="${id}lead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf0"/><stop offset=".5" stop-color="#a7b0b8"/><stop offset="1" stop-color="#d7dce0"/></linearGradient>
  <linearGradient id="${id}blk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3d42"/><stop offset=".35" stop-color="#1c1e21"/><stop offset="1" stop-color="#0d0e10"/></linearGradient>
  <linearGradient id="${id}cer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8c39a"/><stop offset=".5" stop-color="#b89c6c"/><stop offset="1" stop-color="#8f764d"/></linearGradient>
  <radialGradient id="${id}can" cx=".38" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#cfd5da"/><stop offset=".8" stop-color="#8b949c"/><stop offset="1" stop-color="#5d656c"/></radialGradient>
  <radialGradient id="${id}ball" cx=".4" cy=".4" r=".65"><stop offset="0" stop-color="#202020"/><stop offset=".7" stop-color="#3a3a3a"/><stop offset="1" stop-color="#7a7a7a" stop-opacity=".6"/></radialGradient>
  <radialGradient id="${id}light" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
  <filter id="${id}sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx=".22" dy="-.22" stdDeviation=".18" flood-color="#000" flood-opacity=".65"/></filter>
  <filter id="${id}noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${style === 'axi' ? 3.2 : 2.2}" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 ${style === 'axi' ? .5 : .28} 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  </defs>`;
}

// ---------- componentes (coordenadas locales, centro en 0,0, sin rotar) ----------
function compAOI(c, p, id) {
  const [w, h] = p.body; const k = c.pkg; const g = [];
  const rect = (x, y, W, H, f, extra = '') => `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${f}" ${extra}/>`;
  if (k === '0603' || k === '0805') {
    const t = w * .22, isR = /^R/.test(c.ref);
    g.push(rect(-w / 2 - .12, -h / 2 - .08, t + .2, h + .16, `url(#${id}tin)`, 'rx=".12"'), rect(w / 2 - t - .08, -h / 2 - .08, t + .2, h + .16, `url(#${id}tin)`, 'rx=".12"'));
    g.push(rect(-w / 2 + t, -h / 2, w - 2 * t, h, isR ? `url(#${id}blk)` : `url(#${id}cer)`, `filter="url(#${id}sh)"`));
    g.push(rect(-w / 2, -h / 2, t, h, `url(#${id}tin)`), rect(w / 2 - t, -h / 2, t, h, `url(#${id}tin)`));
  } else if (k === 'SOD-123') {
    g.push(rect(-w / 2 - .55, -.35, .7, .7, `url(#${id}lead)`), rect(w / 2 - .15, -.35, .7, .7, `url(#${id}lead)`));
    g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `rx=".15" filter="url(#${id}sh)"`), rect(-w / 2 + .25, -h / 2, .45, h, '#9aa0a6', 'opacity=".9"'));
  } else if (k === 'SOT-23') {
    [[-0.95, -h / 2 - .55], [0.95, -h / 2 - .55], [0, h / 2 - .05]].forEach(([x, y]) => g.push(rect(x - .22, y, .44, .6, `url(#${id}lead)`)));
    g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `rx=".1" filter="url(#${id}sh)"`));
  } else if (k === 'SOIC-8') {
    for (let i = 0; i < 4; i++) { const x = -1.905 + i * 1.27; g.push(rect(x - .22, -h / 2 - 1.0, .44, 1.05, `url(#${id}lead)`), rect(x - .22, h / 2 - .05, .44, 1.05, `url(#${id}lead)`)); }
    g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `rx=".15" filter="url(#${id}sh)"`), `<circle cx="${-w / 2 + .7}" cy="${-h / 2 + .7}" r=".35" fill="#2c2f33" stroke="#0a0a0a" stroke-width=".06"/>`);
    g.push(rect(-w / 2, -h / 2 + .15, w, .12, '#000', 'opacity=".35"'));
  } else if (k === 'QFP-32') {
    for (let i = 0; i < 8; i++) { const q = -2.8 + i * .8;
      g.push(rect(-w / 2 - 1.1, q - .17, 1.15, .34, `url(#${id}lead)`), rect(w / 2 - .05, q - .17, 1.15, .34, `url(#${id}lead)`), rect(q - .17, -h / 2 - 1.1, .34, 1.15, `url(#${id}lead)`), rect(q - .17, h / 2 - .05, .34, 1.15, `url(#${id}lead)`)); }
    g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `rx=".25" filter="url(#${id}sh)"`), rect(-w / 2 + .35, -h / 2 + .35, w - .7, h - .7, 'none', 'stroke="#000" stroke-opacity=".35" stroke-width=".12" rx=".2"'));
    g.push(`<circle cx="${-w / 2 + 1}" cy="${h / 2 - 1}" r=".45" fill="#25282c" stroke="#050505" stroke-width=".08"/>`);
  } else if (k === 'BGA-64') {
    g.push(rect(-w / 2, -h / 2, w, h, '#1f3a2a', `rx=".2" filter="url(#${id}sh)"`), rect(-w / 2 + .45, -h / 2 + .45, w - .9, h - .9, `url(#${id}blk)`, 'rx=".35"'));
    g.push(`<path d="M${-w / 2 + .1} ${h / 2 - .1} l1 0 l-1 -1z" fill="#d4ac4c"/>`);
  } else if (k === 'SMA-CAP') {
    g.push(rect(-w / 2 - .3, -.35, .6, .7, `url(#${id}lead)`), rect(w / 2 - .3, -.35, .6, .7, `url(#${id}lead)`));
    g.push(rect(-w / 2, -h / 2, w, h, '#16181a', `rx=".2" filter="url(#${id}sh)"`), `<path d="M${-w / 2} ${-h / 2 + .7} L${-w / 2 + .7} ${-h / 2} M${-w / 2} ${h / 2 - .7} L${-w / 2 + .7} ${h / 2}" stroke="#000" stroke-width=".12"/>`);
    const r = w * .46; g.push(`<circle r="${r}" fill="url(#${id}can)"/>`, `<path d="M${-r * .72} ${-r * .7} A${r} ${r} 0 0 0 ${-r * .72} ${r * .7} L${-r * .5} ${r * .86} A${r} ${r} 0 0 1 ${-r * .5} ${-r * .86}z" fill="#111" opacity=".9"/>`,
      `<path d="M${-r * .45} 0 H${r * .45} M0 ${-r * .45} V${r * .45}" stroke="#6b737b" stroke-width=".12"/>`);
  } else if (k === 'HDR-1x6') {
    g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `rx=".15" filter="url(#${id}sh)"`));
    for (let i = 0; i < 6; i++) { const y = -6.35 + i * 2.54; g.push(rect(-w / 2 + .1, y - 1.2, w - .2, .12, '#000', 'opacity=".5"'), rect(-.32, y - .32, .64, .64, `url(#${id}gold)`, 'stroke="#6d5418" stroke-width=".05"')); }
  } else if (w) g.push(rect(-w / 2, -h / 2, w, h, `url(#${id}blk)`, `filter="url(#${id}sh)"`));
  return g.join('');
}
const MARK = { U1: ['STM32', 'F030K6T6', 'GH235'], U2: ['FPGA-64', 'XC7-A12', 'Taiwan'], U3: ['LM358', 'TI 2K'], Q1: ['SS'], D1: ['T4'], CP1: ['47', '16V'] };

function compAXI(c, p, id) {
  const [w, h] = p.body; const k = c.pkg; const g = []; const d = (x, y, W, H, o = .75, extra = '') => `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#111" fill-opacity="${o}" ${extra}/>`;
  g.push(`<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#000" fill-opacity="${k === 'SMA-CAP' ? .28 : .1}" rx=".2"/>`);
  if (k === '0603' || k === '0805') { const t = w * .26; g.push(d(-w / 2 - .1, -h / 2 - .05, t + .15, h + .1, .7, 'rx=".15"'), d(w / 2 - t - .05, -h / 2 - .05, t + .15, h + .1, .7, 'rx=".15"')); }
  else if (k === 'SOD-123' || k === 'SMA-CAP') { g.push(d(-w / 2 - .5, -.35, .8, .7, .72, 'rx=".15"'), d(w / 2 - .3, -.35, .8, .7, .72, 'rx=".15"')); if (k === 'SOD-123') g.push(d(-.6, -.25, 1.2, .5, .25)); }
  else if (k === 'SOT-23') [[-0.95, -h / 2 - .55], [0.95, -h / 2 - .55], [0, h / 2 - .05]].forEach(([x, y]) => g.push(d(x - .25, y, .5, .62, .7)));
  else if (k === 'SOIC-8') { for (let i = 0; i < 4; i++) { const x = -1.905 + i * 1.27; g.push(d(x - .22, -h / 2 - 1, .44, 1.1, .72), d(x - .22, h / 2 - .1, .44, 1.1, .72)); } g.push(d(-1.4, -.9, 2.8, 1.8, .2)); }
  else if (k === 'QFP-32') { for (let i = 0; i < 8; i++) { const q = -2.8 + i * .8; g.push(d(-w / 2 - 1.1, q - .17, 1.2, .34, .75), d(w / 2 - .1, q - .17, 1.2, .34, .75), d(q - .17, -h / 2 - 1.1, .34, 1.2, .75), d(q - .17, h / 2 - .1, .34, 1.2, .75)); }
    g.push(d(-2.2, -2.2, 4.4, 4.4, .22), `<g stroke="#000" stroke-opacity=".25" stroke-width=".05">${[...Array(8)].map((_, i) => `<line x1="${-2.8 + i * .8}" y1="-2.2" x2="${-1.5 + i * .4}" y2="-1.4"/>`).join('')}</g>`); }
  else if (k === 'BGA-64') { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = -2.8 + i * .8, y = -2.8 + j * .8; const v = c.ref === 'U2' && i === 5 && j === 2;
      g.push(`<circle cx="${x}" cy="${y}" r=".25" fill="url(#${id}ball)"/>`); if (v) g.push(`<circle cx="${x + .05}" cy="${y + .04}" r=".08" fill="#d8d8d8" opacity=".8"/>`); }
    g.push(d(-1.6, -1.6, 3.2, 3.2, .12)); }
  else if (k === 'HDR-1x6') for (let i = 0; i < 6; i++) { const y = -6.35 + i * 2.54; g.push(`<circle cx="0" cy="${y}" r=".95" fill="#111" fill-opacity=".85"/><rect x="-.32" y="${y - .32}" width=".64" height=".64" fill="#000"/>`); }
  return g.join('');
}

function compICT(c, p) {
  const [w, h] = p.body; if (!w) return '';
  const pin1 = /^(U|Q|D|CP)/.test(c.ref) ? `<circle cx="${-w / 2 + .5}" cy="${h / 2 - .5}" r=".25" fill="#ffe14d"/>` : '';
  return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="none" stroke="#e6e6e6" stroke-width=".1" stroke-dasharray="${c.pkg === 'BGA-64' ? '.4 .2' : ''}"/>${pin1}`;
}

// ---------- capas de cobre ----------
function flashes(g, fill, extra = '') {
  return g.flashes.map(p => p.t === 'C' ? `<circle cx="${p.x}" cy="${p.y}" r="${p.w / 2}" fill="${fill}" ${extra}/>` : `<rect x="${p.x - p.w / 2}" y="${p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx="${p.t === 'O' ? Math.min(p.w, p.h) / 2 : .05}" fill="${fill}" ${extra}/>`).join('');
}
const lines = (g, stroke, op = 1, wmul = 1) => `<g fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-linecap="round">${g.lines.map(s => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke-width="${s.w * wmul}"/>`).join('')}</g>`;
const regions = (g, fill) => g.regions.map(p => `<polygon points="${p.map(a => a.join(',')).join(' ')}" fill="${fill}"/>`).join('');

// color de altura para SPI (azul bajo → verde → amarillo → rojo alto)
function heatColor(t) {
  const stops = [[0, [30, 60, 200]], [.35, [20, 190, 120]], [.6, [235, 225, 40]], [.8, [250, 140, 20]], [1, [230, 40, 30]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const k = (t - a) / (b - a); return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`; }
  return 'rgb(230,40,30)';
}

export function boardSVG(b, layers, ex = '', style = 'aoi') {
  const id = 'bv' + (++uid) + '_'; const W = b.width, H = b.height; const L = [], T = [];
  const comps = (b.comps || []).filter(c => !/^(FID|TP)/.test(c.ref));
  const place = (c, inner) => `<g transform="translate(${c.x} ${c.y}) rotate(${c.rot || 0})">${inner}</g>`;
  const tx = (x, y, s, size, fill, rot = 0, extra = '') => T.push(`<text x="${x}" y="${-y}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle" ${rot ? `transform="rotate(${-rot} ${x} ${-y})"` : ''} ${extra}>${esc(s)}</text>`);

  if (style === 'ict') {
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#05070a" stroke="#ffd400" stroke-width=".18"/>`);
    // rejilla de 2.54 mm como en el editor de fixture
    L.push(`<g stroke="#1b2633" stroke-width=".05">${[...Array(Math.floor(W / 2.54))].map((_, i) => `<line x1="${(i + 1) * 2.54}" y1="0" x2="${(i + 1) * 2.54}" y2="${H}"/>`).join('')}${[...Array(Math.floor(H / 2.54))].map((_, i) => `<line x1="0" y1="${(i + 1) * 2.54}" x2="${W}" y2="${(i + 1) * 2.54}"/>`).join('')}</g>`);
    if (layers.copper && b.cu) L.push(lines(b.cu, '#1f6fb3', .55, .7), `<g fill="none" stroke="#38c8ff" stroke-width=".08">${flashes(b.cu, 'none', 'stroke="#38c8ff" stroke-width=".08"')}</g>`);
    if (layers.drill && b.holes) L.push(b.holes.map(h => `<circle cx="${h.x}" cy="${h.y}" r="${h.d / 2}" fill="none" stroke="#ff9f1a" stroke-width=".1"/><path d="M${h.x - .3} ${h.y}h.6M${h.x} ${h.y - .3}v.6" stroke="#ff9f1a" stroke-width=".06"/>`).join(''));
    if (layers.comps !== false) { L.push(comps.map(c => { const p = b.packages?.[c.pkg]; return p ? place(c, compICT(c, p)) : ''; }).join('')); comps.forEach(c => tx(c.x, c.y, c.ref, 1.1, '#e6e6e6', 0, 'font-family="Consolas,monospace"')); }
    if (layers.tp !== false && b.ipc) {
      const seen = new Set(); b.ipc.forEach(t => { const k = t.x + ',' + t.y; if (seen.has(k)) return; seen.add(k); const isTP = /^TP/.test(t.ref);
        L.push(`<circle cx="${t.x}" cy="${t.y}" r="${isTP ? .7 : .35}" fill="${isTP ? '#ff3b6b' : '#ff3b6b'}" fill-opacity="${isTP ? .9 : .55}" stroke="#ffd1dc" stroke-width=".06"/>`);
        if (isTP) tx(t.x, t.y - 1.3, `${t.ref} ${t.net}`, .9, '#ff9fb6', 0, 'font-family="Consolas,monospace"'); });
    }
  } else if (style === 'axi') {
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#c9c9c9"/>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}light)"/>`);
    if (layers.copper && b.cu) L.push(lines(b.cu, '#000', .16), `<g>${flashes(b.cu, '#000', 'fill-opacity=".22"')}</g>`);
    if (b.holes) L.push(b.holes.map(h => `<circle cx="${h.x}" cy="${h.y}" r="${h.d / 2}" fill="#f2f2f2"/><circle cx="${h.x}" cy="${h.y}" r="${h.d / 2 + .25}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".25"/>`).join(''));
    if (layers.comps !== false) L.push(comps.map(c => { const p = b.packages?.[c.pkg]; return p ? place(c, compAXI(c, p, id)) : ''; }).join(''));
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" filter="url(#${id}noise)" fill="#fff"/>`);
  } else if (style === 'spi') {
    L.push(`<rect x="-.2" y="-.2" width="${W + .4}" height="${H + .4}" rx="1" fill="#b39a62"/>`, `<rect x="0" y="0" width="${W}" height="${H}" rx=".8" fill="#0f3b24"/>`);
    if (layers.copper && b.cu) L.push(lines(b.cu, '#2f7a4c', .7), regions(b.cu, '#6c6440'), flashes(b.cu, '#8c7a42'));
    if (b.holes) L.push(b.holes.map(h => `<circle cx="${h.x}" cy="${h.y}" r="${h.d / 2}" fill="#050505"/>`).join(''));
    if (layers.paste !== false && b.paste) L.push(b.paste.flashes.map((p, i) => { const t = .35 + hash(i + ':' + p.x) * .4; const c = heatColor(t);
      return p.t === 'C' ? `<circle cx="${p.x}" cy="${p.y}" r="${p.w / 2 * .92}" fill="${c}"/><circle cx="${p.x - p.w * .12}" cy="${p.y + p.w * .12}" r="${p.w * .18}" fill="#fff" opacity=".35"/>`
        : `<rect x="${p.x - p.w * .46}" y="${p.y - p.h * .46}" width="${p.w * .92}" height="${p.h * .92}" rx="${Math.min(p.w, p.h) * .15}" fill="${c}"/><rect x="${p.x - p.w * .3}" y="${p.y - p.h * .3}" width="${p.w * .6}" height="${p.h * .6}" rx="${Math.min(p.w, p.h) * .2}" fill="#fff" opacity=".18"/>`; }).join(''));
    if (layers.silk && b.silk) L.push(lines(b.silk, '#e9e9e2', .55));
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}light)"/>`);
  } else { // aoi
    L.push(`<rect x="-.25" y="-.25" width="${W + .5}" height="${H + .5}" rx="1.1" fill="#bba46a"/>`);
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" rx=".9" fill="${layers.mask === false ? '#c8b27a' : `url(#${id}mask)`}"/>`);
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" rx=".9" filter="url(#${id}noise)" fill="#fff"/>`);
    if (layers.copper && b.cu) {
      L.push(lines(b.cu, layers.mask === false ? '#d9b25a' : '#3ea063', layers.mask === false ? 1 : .55));
      L.push((b.comps || []).filter(c => /^FID/.test(c.ref)).map(c => `<circle cx="${c.x}" cy="${c.y}" r="1.5" fill="#0d3b22"/>`).join(''));
      L.push(regions(b.cu, `url(#${id}gold)`), flashes(b.cu, `url(#${id}gold)`));
    }
    if (layers.paste && b.paste) L.push(flashes(b.paste, '#b7bcc1', 'opacity=".95"'));
    if (layers.drill && b.holes) L.push(b.holes.map(h => `<circle cx="${h.x}" cy="${h.y}" r="${h.d / 2 + (h.d > 2 ? .9 : .45)}" fill="url(#${id}gold)"/><circle cx="${h.x}" cy="${h.y}" r="${h.d / 2}" fill="#050505" stroke="#6d5418" stroke-width=".1"/>`).join(''));
    if (layers.silk && b.silk) L.push(lines(b.silk, '#f4f4ee', .95));
    if (layers.comps) {
      L.push(comps.map(c => { const p = b.packages?.[c.pkg]; return p ? place(c, compAOI(c, p, id)) : ''; }).join(''));
      comps.forEach(c => { const m = MARK[c.ref]; if (!m) return; const big = /^U/.test(c.ref); const s = big ? .85 : .5;
        m.forEach((t, i) => tx(c.x, c.y + (m.length - 1) * s * .6 - i * s * 1.2, t, s, '#c9ccd0', c.rot, 'font-family="Arial" opacity=".75"')); });
    }
    L.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${id}light)"/>`);
  }
  if (layers.tp && style === 'aoi' && b.ipc) L.push(b.ipc.filter(t => /^TP/.test(t.ref)).map(t => `<circle cx="${t.x}" cy="${t.y}" r=".9" fill="none" stroke="#ff5a5f" stroke-width=".25"/>`).join(''));
  if (layers.ref && b.comps) b.comps.forEach(c => tx(c.x, c.y + 2.2, c.ref, 1.2, style === 'axi' ? '#0a3d91' : '#fff8b0', 0, 'font-family="Consolas,monospace" font-weight="700" paint-order="stroke" stroke="#000" stroke-width=".25"'));
  return `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" preserveAspectRatio="xMidYMid meet" class="bv bv-${style}">${defs(id, style)}<g transform="translate(0 ${H}) scale(1 -1)">${L.join('')}${ex}</g><g transform="translate(0 ${H})">${T.join('')}</g></svg>`
    + (style === 'spi' && layers.paste !== false ? `<div class="bvleg"><span>Altura</span><i></i><small>0 µm</small><small>150 µm</small></div>` : '');
}

// Zoom con rueda, arrastre para mover (botón medio o derecho) y lectura de coordenadas como en el software real
export function enhanceView(host, getH) {
  if (host._enh) return; host._enh = true;
  const vw = host.querySelector('.vc'); const coord = host.querySelector('.vcoord'); let vb = null;
  const svg = () => vw.querySelector('svg');
  const apply = () => { const s = svg(); if (!s) return; if (!s._base) s._base = s.getAttribute('viewBox').split(' ').map(Number); if (vb) s.setAttribute('viewBox', vb.join(' ')); const z = host.querySelector('.vzoom'); if (z) z.textContent = Math.round((vb ? s._base[2] / vb[2] : 1) * 100) + ' %'; };
  new MutationObserver(apply).observe(vw, { childList: true });
  const zoom = (f, cx, cy) => { const s = svg(); if (!s) return; const base = s._base || s.getAttribute('viewBox').split(' ').map(Number); const cur = vb || base.slice();
    const nw = Math.min(base[2], Math.max(base[2] / 12, cur[2] * f)), nh = nw * base[3] / base[2];
    const px = cx ?? cur[0] + cur[2] / 2, py = cy ?? cur[1] + cur[3] / 2; const kx = (px - cur[0]) / cur[2], ky = (py - cur[1]) / cur[3];
    vb = [px - nw * kx, py - nh * ky, nw, nh]; if (nw >= base[2]) vb = null; apply(); };
  const toSvg = ev => { const s = svg(); const p = s.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(s.getScreenCTM().inverse()); };
  vw.addEventListener('wheel', ev => { if (!svg()) return; ev.preventDefault(); const q = toSvg(ev); zoom(ev.deltaY > 0 ? 1.25 : .8, q.x, q.y); }, { passive: false });
  let drag = null;
  vw.addEventListener('pointerdown', ev => { if (ev.button === 1 || ev.button === 2 || ev.shiftKey) { drag = { x: ev.clientX, y: ev.clientY, vb: vb && vb.slice() }; ev.preventDefault(); } });
  vw.addEventListener('contextmenu', ev => ev.preventDefault());
  addEventListener('pointermove', ev => {
    if (drag && vb && svg()) { const s = svg(); const r = s.getBoundingClientRect(); const k = vb[2] / r.width; vb = [drag.vb[0] - (ev.clientX - drag.x) * k, drag.vb[1] - (ev.clientY - drag.y) * k, vb[2], vb[3]]; apply(); }
    if (coord && svg() && vw.contains(ev.target)) { const q = toSvg(ev); const H = getH(); if (H) coord.textContent = `X ${q.x.toFixed(2)}  Y ${(H - q.y).toFixed(2)} mm`; }
  });
  addEventListener('pointerup', () => drag = null);
  (host.closest('.sw') || host).querySelectorAll('[data-z]').forEach(bn => bn.onclick = () => { const z = bn.dataset.z; if (z === 'fit') { vb = null; const s = svg(); if (s && s._base) s.setAttribute('viewBox', s._base.join(' ')); apply(); } else zoom(z === 'in' ? .7 : 1.4); });
}
