// Imágenes de revisión de NG: dibujo detallado de la tarjeta buena (referencia) junto a la tarjeta llamada.
// AOI: vista superior a color con máscara, pads ENIG, soldadura brillante, serigrafía y ventana de inspección.
// AXI: corte de rayos X en escala de grises con ruido, densidad de las bolas y voids.

let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- primitivas AOI ----------
function mask(x, w, h) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1c5a33'); g.addColorStop(1, '#14462a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalAlpha = .06; x.strokeStyle = '#9fe0b8'; x.lineWidth = 1; // tejido de fibra de vidrio bajo la máscara
  for (let i = -h; i < w; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); }
  x.globalAlpha = 1; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${rnd() * .04})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
}
function trace(x, x0, y0, x1, y1, w = 10) { x.strokeStyle = '#1f6b3d'; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = 'rgba(160,230,180,.12)'; x.lineWidth = w * .4; x.stroke(); }
function pad(x, px, py, w, h) { const g = x.createLinearGradient(px, py, px + w, py + h); g.addColorStop(0, '#f1d27a'); g.addColorStop(.5, '#d9b356'); g.addColorStop(1, '#b8902f'); x.fillStyle = g; x.fillRect(px, py, w, h); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.5; x.strokeRect(px + .5, py + .5, w - 1, h - 1); }
function paste(x, px, py, w, h) { x.fillStyle = '#8e959c'; x.fillRect(px + 4, py + 4, w - 8, h - 8); for (let i = 0; i < w * h / 14; i++) { x.fillStyle = rnd() > .5 ? 'rgba(220,225,230,.55)' : 'rgba(60,64,70,.45)'; x.beginPath(); x.arc(px + 5 + rnd() * (w - 10), py + 5 + rnd() * (h - 10), 1.3, 0, 7); x.fill(); } }
// Filete de soldadura: menisco brillante (blanco cerca de la terminal, gris hacia el borde del pad)
function fillet(x, px, py, w, h, dir = 1, k = 1) {
  const fw = w * k; const sx = dir > 0 ? px + w - fw : px; const g = x.createLinearGradient(dir > 0 ? px + w : px, 0, dir > 0 ? px + w - fw : px + fw, 0);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#d5dadf'); g.addColorStop(1, '#7d858d'); x.fillStyle = g; x.beginPath(); x.roundRect(sx, py + 2, fw, h - 4, 6); x.fill();
  x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(dir > 0 ? px + w - 5 : px + 1, py + 6, 4, h - 12);
}
function chip(x, cx, cy, w, h, body = '#3b3530', mark = '') {
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cx - w / 2 + 5, cy - h / 2 + 6, w, h); // sombra
  x.fillStyle = body; x.fillRect(cx - w / 2, cy - h / 2, w, h);
  const cap = w * .2; for (const s of [-1, 1]) { const g = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, '#f4f6f8'); g.addColorStop(.5, '#b9c0c7'); g.addColorStop(1, '#e8ecef'); x.fillStyle = g; x.fillRect(s < 0 ? cx - w / 2 : cx + w / 2 - cap, cy - h / 2, cap, h); }
  if (mark) { x.fillStyle = '#e8e2d0'; x.font = `600 ${h * .38}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(mark, cx, cy + 1); x.textAlign = 'left'; }
}
function silkText(x, t, px, py, s = 16) { x.fillStyle = '#f0f0e8'; x.font = `700 ${s}px sans-serif`; x.fillText(t, px, py); }
function roi(x, px, py, w, h, col = '#ff3b30') { x.save(); x.strokeStyle = col; x.lineWidth = 3; x.setLineDash([8, 5]); x.strokeRect(px, py, w, h); x.restore(); }

// ---------- escenas AOI ----------
function aoiChip(x, W, H, kind, golden) {
  const cx = W / 2, cy = H / 2 + 8; const pw = 64, ph = 78, gap = 170;
  trace(x, 0, cy, cx - gap / 2 - pw, cy, 12); trace(x, cx + gap / 2 + pw, cy, W, cy, 12);
  x.strokeStyle = '#f0f0e8'; x.lineWidth = 3; x.strokeRect(cx - 130, cy - 62, 260, 124); silkText(x, 'C4', cx - 12, cy - 74, 20);
  const L = [cx - gap / 2 - pw + 20, cy - ph / 2], R = [cx + gap / 2 - 20, cy - ph / 2];
  pad(x, L[0], L[1], pw, ph); pad(x, R[0], R[1], pw, ph);
  const k = golden ? 'ok' : kind;
  if (k === 'missing') { paste(x, L[0], L[1], pw, ph); paste(x, R[0], R[1], pw, ph); return () => roi(x, L[0] - 10, L[1] - 10, R[0] + pw - L[0] + 20, ph + 20); }
  if (k === 'tomb') {
    fillet(x, L[0], L[1], pw, ph, 1, .5); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(L[0] + 10, L[1] + 10, 20, ph - 20); // pad izquierdo con soldadura pero sin terminal
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(R[0] - 60, R[1] + 4, 70, ph - 8); // sombra larga del chip parado
    const g = x.createLinearGradient(0, R[1], 0, R[1] + ph); g.addColorStop(0, '#f4f6f8'); g.addColorStop(1, '#aab2ba'); x.fillStyle = g; x.fillRect(R[0] + 8, R[1] + 10, 44, ph - 20); x.fillStyle = '#3b3530'; x.fillRect(R[0] + 14, R[1] + 16, 32, ph - 32);
    fillet(x, R[0], R[1], pw, ph, -1, .25); return () => roi(x, L[0] - 10, L[1] - 10, R[0] + pw - L[0] + 20, ph + 20);
  }
  const dy = k === 'shift' ? 58 : k === 'shiftok' ? 12 : 0;
  const kk = k === 'insuf' ? .22 : 1;
  if (k === 'insuf') { paste(x, L[0], L[1], pw * .35, ph); paste(x, R[0] + pw * .65, R[1], pw * .35, ph); }
  fillet(x, L[0], L[1] + Math.min(dy, ph * .6), pw - 18, ph - Math.min(dy, ph * .6), 1, kk); fillet(x, R[0] + 18, R[1] + Math.min(dy, ph * .6), pw - 18, ph - Math.min(dy, ph * .6), -1, kk);
  chip(x, cx, cy + dy, gap + 30, ph - 14, '#3b3530', '');
  if (kind === 'shadow') { // capacitor electrolítico alto al lado (también está en la tarjeta buena); su sombra sólo con esta iluminación
    if (!golden) { x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.moveTo(W - 110, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(cx + 30, H); x.lineTo(cx + 30, cy - 40); x.closePath(); x.fill(); }
    const g = x.createRadialGradient(W - 40, 40, 10, W - 40, 40, 80); g.addColorStop(0, '#dfe4e8'); g.addColorStop(1, '#7d8790'); x.fillStyle = g; x.beginPath(); x.arc(W - 40, 40, 70, 0, 7); x.fill(); x.strokeStyle = '#444'; x.lineWidth = 3; x.beginPath(); x.moveTo(W - 80, 40); x.lineTo(W, 40); x.moveTo(W - 40, 0); x.lineTo(W - 40, 80); x.stroke(); }
  if (k === 'glare' && !golden) { const g = x.createRadialGradient(cx + 10, cy - 5, 4, cx + 10, cy - 5, 120); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  return () => roi(x, L[0] - 10, L[1] - 10 + (k === 'shift' ? 20 : 0), R[0] + pw - L[0] + 20, ph + 20 + (k === 'shift' ? 40 : 0));
}
function aoiQFP(x, W, H, kind, golden) {
  const cx = W / 2, top = 40; x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(cx - 170 + 8, top + 8, 340, 120);
  const g = x.createLinearGradient(0, top, 0, top + 120); g.addColorStop(0, '#2a2d31'); g.addColorStop(1, '#17191c'); x.fillStyle = g; x.fillRect(cx - 170, top, 340, 120);
  x.fillStyle = '#4a4e53'; x.beginPath(); x.arc(cx - 140, top + 26, 9, 0, 7); x.fill(); x.fillStyle = '#9aa0a6'; x.font = '600 18px monospace'; x.fillText('STM32F0', cx - 60, top + 70);
  const n = 8, pitch = 40, x0 = cx - (n - 1) * pitch / 2;
  for (let i = 0; i < n; i++) {
    const px = x0 + i * pitch; pad(x, px - 11, top + 150, 22, 80); trace(x, px, top + 230, px + (i - 3.5) * 6, H, 8);
    const lg = x.createLinearGradient(px - 7, 0, px + 7, 0); lg.addColorStop(0, '#9aa2aa'); lg.addColorStop(.5, '#f4f6f8'); lg.addColorStop(1, '#8b939b'); x.fillStyle = lg; x.fillRect(px - 7, top + 118, 14, 80); // terminal gull-wing
    const fg = x.createLinearGradient(0, top + 190, 0, top + 228); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#7d858d'); x.fillStyle = fg; x.beginPath(); x.roundRect(px - 10, top + 186, 20, 40, 5); x.fill();
  }
  x.strokeStyle = '#f0f0e8'; x.lineWidth = 3; x.strokeRect(cx - 185, top - 15, 370, 150); silkText(x, 'U1', cx + 190, top + 10, 20);
  const bx = x0 + 3 * pitch;
  if (kind === 'bridge' && !golden) { const bg = x.createLinearGradient(0, top + 180, 0, top + 230); bg.addColorStop(0, '#ffffff'); bg.addColorStop(.5, '#c9ced4'); bg.addColorStop(1, '#7d858d'); x.fillStyle = bg; x.beginPath(); x.ellipse(bx + pitch / 2, top + 205, 30, 18, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(bx + pitch / 2 - 6, top + 198, 10, 5, 0, 0, 7); x.fill(); }
  if (kind === 'silk') { x.fillStyle = '#ecece2'; x.fillRect(bx + pitch / 2 - 2, top + 145, 4, 90); silkText(x, '+', bx + pitch / 2 + 6, top + 250, 18); } // serigrafía: mate, recta y presente también en la buena
  return () => roi(x, bx - 22, top + 140, pitch + 44, 100);
}
function aoiDiode(x, W, H, kind, golden) {
  const cx = W / 2, cy = H / 2 + 6; trace(x, 0, cy, cx - 120, cy, 12); trace(x, cx + 120, cy, W, cy, 12);
  pad(x, cx - 150, cy - 34, 62, 68); pad(x, cx + 88, cy - 34, 62, 68);
  x.strokeStyle = '#f0f0e8'; x.lineWidth = 3; x.strokeRect(cx - 170, cy - 56, 340, 112); x.fillStyle = '#f0f0e8'; x.fillRect(cx - 186, cy - 56, 10, 112); silkText(x, 'D1', cx - 14, cy - 66, 20); silkText(x, 'K', cx - 205, cy + 6, 18);
  fillet(x, cx - 150, cy - 34, 46, 68, 1); fillet(x, cx + 104, cy - 34, 46, 68, -1);
  x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(cx - 104 + 6, cy - 34 + 6, 208, 68);
  const g = x.createLinearGradient(0, cy - 34, 0, cy + 34); g.addColorStop(0, '#2c2f33'); g.addColorStop(1, '#141618'); x.fillStyle = g; x.fillRect(cx - 104, cy - 34, 208, 68);
  const bandLeft = golden || kind === 'polok'; const bandCol = golden ? '#d9dcdf' : kind === 'polok' ? '#7d8288' : '#d9dcdf';
  x.fillStyle = bandCol; x.fillRect(bandLeft ? cx - 92 : cx + 66, cy - 34, 26, 68);
  return () => roi(x, cx - 112, cy - 42, 224, 84);
}

// ---------- escenas AXI ----------
function axiScene(x, W, H, kind, golden) {
  x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, W, H);
  const v = x.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * .75); v.addColorStop(0, 'rgba(255,255,255,.12)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  // pistas internas tenues de otras capas
  x.strokeStyle = 'rgba(80,80,80,.18)'; x.lineWidth = 6; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(0, 30 + i * 62); x.lineTo(W, 50 + i * 55); x.stroke(); }
  const n = 6, p = 52, ox = W / 2 - p * 2.5, oy = H / 2 - p * 2.5; let box = null;
  const k = golden ? 'ok' : kind;
  if (kind === 'xshadow') { const sg = x.createLinearGradient(ox + 1.2 * p, 0, ox + 3.6 * p, 0); sg.addColorStop(0, 'rgba(40,40,40,0)'); sg.addColorStop(.5, 'rgba(40,40,40,.32)'); sg.addColorStop(1, 'rgba(40,40,40,0)'); x.fillStyle = sg; x.fillRect(ox + 1.2 * p, oy + 3.2 * p, 2.4 * p, 34); if (!golden) box = [ox + 1.2 * p, oy + 3.0 * p, 2.4 * p, 50]; }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = ox + i * p, cy = oy + j * p; let r = 17, dark = 30;
    if (k === 'xmissing' && i === 3 && j === 2) { x.strokeStyle = 'rgba(70,70,70,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 15, 0, 7); x.stroke(); box = [cx - 26, cy - 26, 52, 52]; continue; }
    if (k === 'xhip' && i === 2 && j === 3) { r = 12; dark = 85; box = [cx - 26, cy - 26, 52, 52]; }
    const g = x.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, r); g.addColorStop(0, `rgb(${dark},${dark},${dark})`); g.addColorStop(.8, `rgb(${dark + 25},${dark + 25},${dark + 25})`); g.addColorStop(1, `rgba(${dark + 60},${dark + 60},${dark + 60},.6)`);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    if (k === 'xhip' && i === 2 && j === 3) { x.strokeStyle = 'rgba(150,150,150,.8)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 15, 0, 7); x.stroke(); }
    if (k === 'xvoidbig' && i === 1 && j === 1) { const vg = x.createRadialGradient(cx + 3, cy - 2, 1, cx + 3, cy - 2, 10); vg.addColorStop(0, '#c8c8c8'); vg.addColorStop(1, '#7a7a7a'); x.fillStyle = vg; x.beginPath(); x.arc(cx + 3, cy - 2, 10.5, 0, 7); x.fill(); box = [cx - 26, cy - 26, 52, 52]; }
    if ((k === 'xvoidsmall') && (i * 7 + j) % 5 === 2) { x.fillStyle = '#9a9a9a'; x.beginPath(); x.arc(cx + 4, cy - 2, 3, 0, 7); x.fill(); if (!box) box = [cx - 26, cy - 26, 52, 52]; }
    if (kind === 'xvia' && i === 4 && j === 4) { x.fillStyle = '#e0e0e0'; x.beginPath(); x.arc(cx, cy, 4.5, 0, 7); x.fill(); x.strokeStyle = '#8a8a8a'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, 6.5, 0, 7); x.stroke(); if (!golden) box = [cx - 26, cy - 26, 52, 52]; }
  }
  if (k === 'xbridge') { const cy = oy + 4 * p; const bg = x.createLinearGradient(0, cy - 9, 0, cy + 9); bg.addColorStop(0, '#5a5a5a'); bg.addColorStop(.5, '#2e2e2e'); bg.addColorStop(1, '#5a5a5a'); x.fillStyle = bg; x.beginPath(); x.roundRect(ox + 2 * p, cy - 9, p, 18, 8); x.fill(); box = [ox + 2 * p - 24, cy - 26, p + 48, 52]; }
  for (let i = 0; i < 2500; i++) { const c = 120 + rnd() * 100 | 0; x.fillStyle = `rgba(${c},${c},${c},.12)`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }
  return () => box && roi(x, ...box);
}

// ---------- composición: referencia | tarjeta actual ----------
export function drawCase(cv, kind) {
  const x = cv.getContext('2d'); const W = cv.width, H = cv.height; const PW = (W - 30) / 2, PH = H - 64;
  x.fillStyle = '#0c1014'; x.fillRect(0, 0, W, H);
  const axi = kind.startsWith('x');
  const scene = axi ? axiScene : ['bridge', 'silk'].includes(kind) ? aoiQFP : ['polbad', 'polok'].includes(kind) ? aoiDiode : aoiChip;
  [[true, 10, 'Referencia (tarjeta buena)'], [false, 20 + PW, 'Esta tarjeta · llamado de la máquina']].forEach(([golden, ox, title]) => {
    seed = 7; x.save(); x.translate(ox, 40); x.beginPath(); x.rect(0, 0, PW, PH); x.clip();
    if (!axi) mask(x, PW, PH);
    const after = scene(x, PW, PH, kind, golden); if (!golden && after) after();
    x.restore();
    x.strokeStyle = golden ? '#36d07f' : '#ffb020'; x.lineWidth = 2; x.strokeRect(ox, 40, PW, PH);
    x.fillStyle = golden ? '#36d07f' : '#ffb020'; x.font = '600 20px Barlow, sans-serif'; x.fillText(title, ox + 2, 28);
  });
  x.fillStyle = '#8a99a8'; x.font = '15px Barlow, sans-serif'; x.fillText(axi ? 'Rayos X: más oscuro = más soldadura. Compara cada bola contra la referencia.' : 'Vista superior a color. Recuadro rojo = zona que marcó la máquina.', 12, H - 6);
}
