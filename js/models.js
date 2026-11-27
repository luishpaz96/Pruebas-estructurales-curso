// Modelos 3D basados en las máquinas reales: proporciones y distribución tomadas de los manuales del curso
// (KY8030-3 Operation Manual, C-Platform/Zenith Operation Manual, ViTrox V510i brochure, V810 Overview,
// Hardware Testhead Training ICT) y de las fichas técnicas:
//   Zenith ≈ 1000 × 1310 × 1620 mm · KY8030-3 ≈ 1000 × 1215 × 1500 mm · V510i 1060 × 1353 × 2111 mm (con torre)
//   V810 S2 1520 × 1940 × 1890 mm · i3070 Series 5: cabeza de prueba al centro, gabinete de aire/vacío a la izquierda
//   y controlador a la derecha.
// Escala: 1 unidad = 0.5 m. Transporte en el eje X (izquierda → derecha), frente de la máquina hacia +Z.
// Cada pieza lleva userData.part para el taller de mantenimiento.
import { THREE, box as sbox, rbox, cyl, at, mat, pcb } from './stage.js';
// Las piezas grandes llevan aristas redondeadas, como las cubiertas reales
const box = (w, h, d, m, o) => Math.min(w, h, d) >= .18 ? rbox(w, h, d, m, Math.min(.06, Math.min(w, h, d) * .2), o) : sbox(w, h, d, m, o);
const tag = (o, part) => { o.traverse(c => { c.userData.part = part; }); return o; };

// ---------- Texturas procedurales (pintura electrostática, acero cepillado, rejillas) ----------
const TX = {};
function canvasTex(key, w, h, draw, repeat = [1, 1], srgb = false) {
  if (TX[key]) return TX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (TX[key] = t);
}
// Normal map de "cáscara de naranja" de la pintura en polvo
const peel = () => canvasTex('peel', 256, 256, (x, w, h) => {
  const hgt = new Float32Array(w * h); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 900; k++) { const cx = r() * w, cy = r() * h, rad = 3 + r() * 9, a = (r() - .5) * .9; for (let y = -rad; y <= rad; y++) for (let xx = -rad; xx <= rad; xx++) { const d = Math.hypot(xx, y) / rad; if (d > 1) continue; const px = ((cx + xx) | 0 + w) % w, py = ((cy + y) | 0 + h) % h; hgt[py * w + px] += a * (1 - d * d); } }
  const img = x.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const i = y * w + xx; const dx = hgt[y * w + (xx + 1) % w] - hgt[y * w + (xx + w - 1) % w], dy = hgt[((y + 1) % h) * w + xx] - hgt[((y + h - 1) % h) * w + xx];
    img.data[i * 4] = 128 + dx * 60; img.data[i * 4 + 1] = 128 + dy * 60; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
}, [5, 5]);
// Rugosidad de acero cepillado
const brushed = () => canvasTex('brush', 512, 64, (x, w, h) => { x.fillStyle = '#6a6a6a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 70 + Math.random() * 90 | 0; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 200, 1); } }, [2, 8]);
// Lámina perforada (rejillas de ventilación)
const perf = () => canvasTex('perf', 128, 128, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#000'; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 4.2, 0, 7); x.fill(); } }, [6, 3]);

// ---------- Materiales PBR (compartidos) ----------
const MC = {};
const once = (k, f) => MC[k] || (MC[k] = f());
const paint = (color, rough = .42, coat = .35) => once('p' + color + rough + coat, () => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: coat, clearcoatRoughness: .4, normalMap: peel(), normalScale: new THREE.Vector2(.12, .12) }));
const M = {
  white: () => paint(0xeff0f0, .38),
  offwhite: () => paint(0xe6e4dc, .42),
  cream: () => paint(0xe9e6dc, .45),
  lgrey: () => paint(0xc8ccd0, .45),
  grey: () => paint(0x8f969d, .45),
  dgrey: () => paint(0x5b6168, .45),
  charcoal: () => paint(0x2c3034, .5, .2),
  black: () => paint(0x121416, .5, .25),
  navy: () => paint(0x1f2f4f, .45),
  steel: () => once('steel', () => new THREE.MeshPhysicalMaterial({ color: 0xc3c8cd, metalness: 1, roughness: .34, roughnessMap: brushed(), anisotropy: .6 })),
  chrome: () => once('chrome', () => new THREE.MeshPhysicalMaterial({ color: 0xe8ecef, metalness: 1, roughness: .08 })),
  alu: () => once('alu', () => new THREE.MeshPhysicalMaterial({ color: 0xb8bec4, metalness: .9, roughness: .42, roughnessMap: brushed() })),
  plastic: () => once('plastic', () => new THREE.MeshPhysicalMaterial({ color: 0x17191b, roughness: .55, clearcoat: .15 })),
  rubber: () => once('rubber', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: .95 })),
  glass: () => once('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0f1a22, roughness: .03, metalness: 0, transparent: true, opacity: .5, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2, specularIntensity: 1, depthWrite: false })),
  smoke: () => once('smoke', () => new THREE.MeshPhysicalMaterial({ color: 0x060809, roughness: .04, transparent: true, opacity: .78, clearcoat: 1, envMapIntensity: 2, depthWrite: false })),
  vent: () => once('vent', () => new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: .6, metalness: .3, alphaMap: perf(), alphaTest: .5, side: THREE.DoubleSide })),
};

// Texto impreso/serigrafiado sobre las cubiertas (iluminado por la escena, no "pegado" encima)
function label(text, w = 1, h = .22, color = '#30363d', bg = null, font = 600, opts = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(32, Math.round(1024 * h / w)); const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; if (x.roundRect) { x.beginPath(); x.roundRect(0, 0, c.width, c.height, c.height * .12); x.fill(); } else x.fillRect(0, 0, c.width, c.height); }
  x.fillStyle = color; x.font = `${opts.italic ? 'italic ' : ''}${font} ${Math.round(c.height * (opts.size || .62))}px ${opts.family || 'Arial, Helvetica, sans-serif'}`; x.textBaseline = 'middle';
  x.textAlign = opts.align || 'left'; x.fillText(text, opts.align === 'center' ? c.width / 2 : c.height * .2, c.height / 2);
  if (opts.sub) { x.font = `500 ${Math.round(c.height * .2)}px Arial, sans-serif`; x.fillText(opts.sub, c.height * .2, c.height * .88); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 }));
  return m;
}
// Etiquetas de seguridad tipo ISO 7010 (triángulo amarillo con símbolo)
function warnTag(sym = '⚡', s = .14) {
  const key = 'w' + sym; const t = canvasTex(key, 256, 256, (x) => {
    x.fillStyle = '#ffd200'; x.strokeStyle = '#111'; x.lineWidth = 16; x.lineJoin = 'round'; x.beginPath(); x.moveTo(128, 18); x.lineTo(242, 222); x.lineTo(14, 222); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#111';
    if (sym === '☢') { x.beginPath(); x.arc(128, 150, 12, 0, 7); x.fill(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; x.beginPath(); x.moveTo(128, 150); x.arc(128, 150, 56, a - .52, a + .52); x.closePath(); x.fill(); } x.fillStyle = '#ffd200'; x.beginPath(); x.arc(128, 150, 20, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(128, 150, 12, 0, 7); x.fill(); }
    else if (sym === '✋') { x.font = '700 92px Arial'; x.textAlign = 'center'; x.fillText('✋', 128, 175); }
    else { x.beginPath(); x.moveTo(140, 70); x.lineTo(98, 155); x.lineTo(128, 152); x.lineTo(112, 205); x.lineTo(160, 120); x.lineTo(130, 123); x.closePath(); x.fill(); }
  }, [1, 1], true);
  return new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2 }));
}
function nameplate(text, w = .5) { const p = label(text, w, w * .22, '#d8dee4', '#2b3137'); return p; }

// Pantalla de software realista (ventana del programa con la tarjeta)
function screenTex(kind) {
  return canvasTex('scr' + kind, 640, 400, (x, W, H) => {
    const th = { aoi: ['#2b527c', '#e6ebf0', '#000'], ky: ['#2b527c', '#e6ebf0', '#000'], spi: ['#183450', '#132030', '#03070b'], v510: ['#0c0d0f', '#1b1e22', '#050505'], axi: ['#0a246a', '#d4d0c8', '#000'], ict: ['#1a1a1a', '#2b2b2b', '#05070a'] }[kind] || ['#2b527c', '#e6ebf0', '#000'];
    x.fillStyle = '#0b2a4a'; x.fillRect(0, 0, W, H);
    x.fillStyle = th[1]; x.fillRect(0, 0, W, H - 22);
    x.fillStyle = th[0]; x.fillRect(0, 0, W, 20); x.fillStyle = '#fff'; x.font = '12px Arial'; x.fillText({ axi: 'AXI System v810', ict: 'BT-BASIC', spi: 'KY SPI · CEditor', v510: 'Smart GUI', ky: 'AOIGUI', aoi: 'AOIGUI' }[kind] || 'AOI', 8, 14);
    x.fillStyle = 'rgba(128,128,128,.35)'; for (let i = 0; i < 14; i++) x.fillRect(8 + i * 22, 26, 16, 14);
    const vx = 120, vy = 48, vw = 360, vh = H - 120;
    x.fillStyle = th[2]; x.fillRect(vx, vy, vw, vh);
    // tarjeta
    const bx = vx + 20, by = vy + 18, bw = vw - 40, bh = vh - 36;
    if (kind === 'axi') { const g = x.createRadialGradient(bx + bw / 2, by + bh / 2, 10, bx + bw / 2, by + bh / 2, bw * .7); g.addColorStop(0, '#d6d6d6'); g.addColorStop(1, '#8a8a8a'); x.fillStyle = g; x.fillRect(bx, by, bw, bh); x.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.beginPath(); x.arc(bx + bw * .55 + i * 9, by + bh * .3 + j * 9, 3, 0, 7); x.fill(); } for (let i = 0; i < 40; i++) x.fillRect(bx + (i * 53) % (bw - 20), by + (i * 31) % (bh - 10), 8, 4); }
    else if (kind === 'ict') { x.strokeStyle = '#ffd400'; x.lineWidth = 2; x.strokeRect(bx, by, bw, bh); x.strokeStyle = '#38c8ff'; x.lineWidth = 1; for (let i = 0; i < 30; i++) x.strokeRect(bx + 10 + (i * 47) % (bw - 30), by + 10 + (i * 29) % (bh - 20), 14, 8); x.fillStyle = '#ff3b6b'; for (let i = 0; i < 50; i++) { x.beginPath(); x.arc(bx + 6 + (i * 37) % (bw - 12), by + 6 + (i * 23) % (bh - 12), 2.4, 0, 7); x.fill(); } }
    else { x.fillStyle = kind === 'spi' ? '#0f3b24' : '#14572f'; x.fillRect(bx, by, bw, bh); x.strokeStyle = 'rgba(62,160,99,.6)'; x.lineWidth = 2; for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(bx + (i * 41) % bw, by + 6); x.lineTo(bx + (i * 41) % bw, by + bh - 6); x.stroke(); }
      for (let i = 0; i < 46; i++) { const px = bx + 8 + (i * 53) % (bw - 30), py = by + 8 + (i * 37) % (bh - 20); if (kind === 'spi') { x.fillStyle = ['#14be78', '#ebe128', '#fa8c14', '#1e3cc8'][i % 4]; x.fillRect(px, py, 7, 5); } else { x.fillStyle = '#d4ac4c'; x.fillRect(px, py, 10, 6); x.fillStyle = i % 5 ? '#b9a07a' : '#141414'; x.fillRect(px + 2, py, 6, 6); } }
      if (kind !== 'spi') { x.fillStyle = '#121212'; x.fillRect(bx + bw * .25, by + bh * .3, 50, 50); x.fillRect(bx + bw * .6, by + bh * .32, 46, 46); } }
    x.strokeStyle = '#ff4d4d'; x.lineWidth = 2; x.strokeRect(bx + bw * .58, by + bh * .3, 54, 52);
    // árbol y propiedades
    x.fillStyle = 'rgba(128,128,128,.5)'; for (let i = 0; i < 16; i++) x.fillRect(8, 52 + i * 15, 70 + (i * 13) % 30, 7);
    for (let i = 0; i < 12; i++) x.fillRect(vx + vw + 10, 52 + i * 18, 120, 8);
    x.fillStyle = '#2ecc55'; x.fillRect(vx + vw + 10, vy + vh - 40, 60, 26); x.fillStyle = '#ff4d4d'; x.fillRect(vx + vw + 80, vy + vh - 40, 60, 26);
    x.fillStyle = '#000'; x.fillRect(0, H - 70, W, 48); x.fillStyle = '#3cd070'; x.font = '11px monospace'; for (let i = 0; i < 3; i++) x.fillText(`[08:1${i}:2${i}] Board PR01-0${240150 + i} ... PASS`, 8, H - 54 + i * 14);
    x.fillStyle = '#0b2a4a'; x.fillRect(0, H - 22, W, 22); x.fillStyle = '#fff'; x.fillRect(4, H - 18, 60, 14);
  }, [1, 1], true);
}
function screen(w, h, kind = 'aoi') {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: screenTex(kind), toneMapped: false, color: 0xd8d8d8 }));
}
// Monitor plano de 24" con marco delgado
function monitor(kind, w = 1.08) {
  const g = new THREE.Group(); const h = w * .6;
  g.add(rbox(w, h, .05, M.plastic(), .015));
  g.add(at(screen(w - .04, h - .06, kind), 0, .01, .026));
  g.add(at(rbox(w * .4, h * .5, .05, M.plastic(), .02), 0, 0, -.045)); // tapa trasera / VESA
  return g;
}
// Teclado con teclas y trackball / mouse
function keyboard(w = .9) {
  const g = new THREE.Group(); const t = canvasTex('kbd', 512, 160, (x, W, H) => { x.fillStyle = '#1a1b1d'; x.fillRect(0, 0, W, H); x.fillStyle = '#2c2e31'; for (let r = 0; r < 5; r++) for (let k = 0; k < 18; k++) { if (r === 4 && k > 3 && k < 12) continue; x.fillRect(8 + k * 27.5 + (r % 2) * 4, 10 + r * 29, 23, 24); } x.fillRect(8 + 4 * 27.5, 10 + 4 * 29, 8 * 27.5 - 4, 24); }, [1, 1], true);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(w, .03, w * .32), [M.plastic(), M.plastic(), new THREE.MeshStandardMaterial({ map: t, roughness: .7 }), M.plastic(), M.plastic(), M.plastic()]); g.add(kb);
  const ms = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 10), M.plastic()); ms.scale.set(1, .45, 1.5); g.add(at(ms, w / 2 + .14, .01, 0));
  return g;
}
// Brazo con monitor y charola de teclado (estación del operador)
function workstation(kind, armLen = .9) {
  const g = new THREE.Group();
  const mon = monitor(kind); g.add(at(mon, 0, .95, 0));
  g.add(at(cyl(.04, .04, .55, M.alu(), 16), 0, .55, -.08)); // poste del monitor
  g.add(at(box(.18, .06, .14, M.alu()), 0, .28, -.08));
  g.add(at(rbox(1.15, .04, .5, M.charcoal(), .015), 0, .25, .2)); // charola
  g.add(at(keyboard(.85), -.08, .285, .2));
  const arm = at(box(armLen, .07, .1, M.alu()), -armLen / 2 - .3, .3, 0); g.add(arm);
  g.add(at(cyl(.05, .05, .12, M.alu(), 16), -.3, .3, 0), at(cyl(.05, .05, .12, M.alu(), 16), -armLen - .3, .3, 0));
  return g;
}

// ---- Detalles que hacen que una cubierta se vea "de fábrica" ----
// Rejilla de ventilación de lámina perforada con marco
function louvers(w, h) { const g = new THREE.Group(); g.add(sbox(w + .03, h + .03, .01, M.charcoal())); const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.vent()); v.position.z = .008; g.add(v); g.add(at(sbox(w, h, .005, M.black()), 0, 0, -.002)); return g; }
// Línea de unión entre paneles (sombra de la junta)
const seam = (len, vertical = true) => sbox(vertical ? .01 : len, vertical ? len : .01, .012, M.black());
// Tornillos de cabeza hexagonal en las esquinas
function screws(w, h) { const g = new THREE.Group(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const s = cyl(.016, .016, .012, M.steel(), 6); s.rotation.x = Math.PI / 2; g.add(at(s, a * (w / 2 - .05), b * (h / 2 - .05), 0)); }); return g; }
// Manija de barra (tipo "D") negra
function handle(len = .3, vertical = true) {
  const g = new THREE.Group(); const bar = cyl(.018, .018, len, M.plastic(), 12); if (!vertical) bar.rotation.z = Math.PI / 2; bar.position.z = .06; g.add(bar);
  [-1, 1].forEach(s => { const p = cyl(.016, .016, .06, M.plastic(), 10); p.rotation.x = Math.PI / 2; p.position.set(vertical ? 0 : s * len / 2, vertical ? s * len / 2 : 0, .03); g.add(p); });
  return g;
}
// Ventanilla lateral del transportador: placa con cepillos y conector SMEMA
function convPort(side, y, D) {
  const g = new THREE.Group(); g.add(sbox(.03, .5, 1.25, M.lgrey()));
  g.add(at(sbox(.035, .26, 1.0, M.black()), 0, 0, 0)); for (let i = 0; i < 24; i++) g.add(at(sbox(.02, .24, .035, M.rubber()), side * .02, 0, -.46 + i * .04));
  const smema = at(sbox(.04, .08, .12, M.charcoal()), side * .02, -.32, .5); g.add(smema);
  g.position.set(0, y, 0); return g;
}
// Costados del gabinete: juntas, rejillas y tornillos
function dressCabinet(G, W, H, D, y0 = .25, opts = {}) {
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + .004);
    for (const f of [-.33, .33]) { const sm = seam(H - y0 - .2); sm.rotation.y = Math.PI / 2; G.add(at(sm, x, y0 + (H - y0) / 2, f * D)); }
    const lv = louvers(D * .3, .26); lv.rotation.y = s * Math.PI / 2; G.add(at(lv, x + s * .006, y0 + .45, -D * .22));
    const sc = screws(D * .9, H - y0 - .1); sc.rotation.y = s * Math.PI / 2; G.add(at(sc, x + s * .005, y0 + (H - y0) / 2, 0));
  }
  if (opts.plinth !== false) G.add(at(sbox(W - .04, .12, D - .04, M.black()), 0, y0 + .06, 0));
}
// Lo que se ve por la ventana: interior iluminado con rieles, tarjeta y cabezal
function windowView(w, h, kind = 'aoi') {
  const t = canvasTex('win' + kind + w.toFixed(2), 512, Math.round(512 * h / w), (x, W, H) => {
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#c9d6e2'); gr.addColorStop(.45, '#6f7b86'); gr.addColorStop(1, '#1e2328'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 4; i++) x.fillRect(30 + i * 120, 6, 80, 5); // lámparas interiores
    x.fillStyle = '#4d555d'; x.fillRect(0, H * .14, W, H * .07); x.fillStyle = '#2c3237'; x.fillRect(0, H * .2, W, H * .02); // viga del gantry
    x.fillStyle = '#1f2327'; x.fillRect(205, H * .2, 92, H * .3); x.fillStyle = '#9aa3ab'; x.fillRect(212, H * .22, 78, 6); x.fillStyle = '#0c0d0e'; x.fillRect(226, H * .48, 50, H * .1);
    x.strokeStyle = kind === 'spi' ? '#c4a4ff' : '#d9f0ff'; x.lineWidth = 7; x.shadowColor = x.strokeStyle; x.shadowBlur = 14; x.beginPath(); x.ellipse(251, H * .6, 52, 10, 0, 0, 7); x.stroke(); x.shadowBlur = 0;
    x.fillStyle = '#a7b0b8'; x.fillRect(0, H * .74, W, 9); x.fillRect(0, H * .87, W, 9); x.fillStyle = '#111'; x.fillRect(0, H * .755, W, 4); x.fillRect(0, H * .885, W, 4);
    x.fillStyle = '#1b6a3a'; x.fillRect(110, H * .73, 250, H * .15); x.fillStyle = '#d4ac4c'; for (let i = 0; i < 24; i++) x.fillRect(120 + (i * 37) % 230, H * .745 + (i * 13) % (H * .11), 9, 5);
    x.fillStyle = '#161616'; x.fillRect(180, H * .77, 30, 22); x.fillRect(270, H * .765, 26, 26);
  }, [1, 1], true);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0xb0b0b0 }));
}
function interiorGlow(G, w, d, y, color = 0xdff2ff) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 })); p.rotation.x = Math.PI / 2; p.position.y = y; G.add(p); return p; }

// Torre de luces (rojo / ámbar / verde) con lentes estriadas
function towerLight(h = 1.0) {
  const g = new THREE.Group(); g.add(at(cyl(.028, .028, h, M.alu()), 0, h / 2, 0)); g.add(at(cyl(.07, .08, .05, M.plastic(), 20), 0, .025, 0));
  const lamps = [0xff2a1f, 0xffa31a, 0x2bd45a].map((c, i) => { const l = at(cyl(.07, .07, .16, new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: i === 2 ? 1 : .08, transparent: true, opacity: .9, roughness: .25, clearcoat: 1, transmission: 0 }), 24), 0, h + .12 + (2 - i) * .175, 0); g.add(l);
    g.add(at(cyl(.074, .074, .014, M.lgrey(), 24), 0, h + .12 + (2 - i) * .175 - .087, 0)); return l; });
  g.add(at(cyl(.06, .07, .08, M.plastic(), 20), 0, h + .02, 0));
  g.add(at(cyl(.074, .06, .06, M.plastic(), 24), 0, h + .64, 0));
  return { g, lamps };
}
// Paro de emergencia: placa amarilla y hongo rojo (el hongo se hunde al presionar)
function estop(s = 1) {
  const g = new THREE.Group(); const plate = cyl(.11, .11, .02, paint(0xffd200, .35), 32); plate.rotation.x = Math.PI / 2; g.add(at(plate, 0, 0, .01));
  const coll = cyl(.05, .055, .05, M.plastic(), 24); coll.rotation.x = Math.PI / 2; g.add(at(coll, 0, 0, .04));
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(.075, 0), new THREE.Vector2(.082, .015), new THREE.Vector2(.075, .035), new THREE.Vector2(.04, .048), new THREE.Vector2(0, .05)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshPhysicalMaterial({ color: 0xd01c1c, roughness: .3, clearcoat: .8, emissive: 0x330000 })); m.rotation.x = Math.PI / 2; m.position.z = .07; g.add(m); g.userData.mush = m;
  g.scale.setScalar(s); return g;
}
// Botón iluminado con bisel cromado
function pushButton(color, r = .032) { const g = new THREE.Group(); const b = cyl(r * 1.25, r * 1.25, .015, M.chrome(), 24); b.rotation.x = Math.PI / 2; g.add(b); const l = cyl(r, r, .02, new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: .35, roughness: .2, clearcoat: 1 }), 24); l.rotation.x = Math.PI / 2; l.position.z = .012; g.add(l); return g; }
// Selector de llave
function keySwitch() { const g = new THREE.Group(); const b = cyl(.035, .035, .02, M.chrome(), 24); b.rotation.x = Math.PI / 2; g.add(b); g.add(at(sbox(.012, .04, .01, M.black()), 0, 0, .012)); return g; }
// Interruptor principal rotativo (placa amarilla, manija roja)
function mainSwitch() { const g = new THREE.Group(); g.add(sbox(.2, .2, .02, paint(0xffd200, .35))); const k = cyl(.06, .06, .04, paint(0xc81e1e, .35), 24); k.rotation.x = Math.PI / 2; g.add(at(k, 0, 0, .03)); g.add(at(sbox(.035, .16, .04, paint(0xc81e1e, .35)), 0, 0, .05)); return g; }
// Pata niveladora (vástago roscado, tuerca y base de hule) — como en las fotos de los manuales
function levelFoot(h = .25, r = .1) {
  const g = new THREE.Group(); g.add(at(cyl(.028, .028, h, M.steel(), 12), 0, h / 2, 0)); g.add(at(cyl(.05, .05, .04, M.steel(), 6), 0, h * .55, 0));
  g.add(at(cyl(r * .55, r, .05, M.steel(), 24), 0, .055, 0)); g.add(at(cyl(r, r, .03, M.rubber(), 24), 0, .015, 0)); return g;
}
function caster() { const g = new THREE.Group(); g.add(at(sbox(.08, .08, .1, M.steel()), 0, .13, 0)); const w = cyl(.06, .06, .04, M.rubber(), 18); w.rotation.z = Math.PI / 2; g.add(at(w, 0, .06, .02)); return g; }
function feet(g, W, D, y = 0, h = .25, r = .1) {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { g.add(at(levelFoot(h, r), sx * (W / 2 - .16), y, sz * (D / 2 - .16))); g.add(at(caster(), sx * (W / 2 - .42), y, sz * (D / 2 - .2))); });
}
// Perfil de marco con hueco (para ventanas con bisel)
function rrShape(w, h, r, hole = false) {
  const s = hole ? new THREE.Path() : new THREE.Shape(); const x = w / 2, y = h / 2; r = Math.min(r, x, y);
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s;
}
function frame(w, h, t, r, depth, material, bevel = .03) {
  const s = rrShape(w, h, r); s.holes.push(rrShape(w - 2 * t, h - 2 * t, Math.max(.01, r - t * .5), true));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 10 });
  const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; return m;
}
// Panel con bordes redondeados en el plano XY (puertas, tapas)
function panel(w, h, d, material, r = .05) { const g = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -d / 2); const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; return m; }

// Interior común de un AOI/SPI: rieles, bandas, gantry y cabezal
function inspectionInterior(P, W, D, convY, headType = 'aoi', color = 0x3d8bff) {
  const g = new THREE.Group();
  const rails = new THREE.Group();
  rails.add(at(box(W + .16, .08, .06, M.steel()), 0, convY, -.42), at(box(W + .16, .08, .06, M.steel()), 0, convY, .42));
  const belts = new THREE.Group(); belts.add(at(box(W + .16, .02, .04, M.black()), 0, convY + .05, -.4), at(box(W + .16, .02, .04, M.black()), 0, convY + .05, .4));
  g.add(tag(rails, 'conveyor')); g.add(tag(belts, 'belt')); P.conveyor = rails; P.belt = belts;
  const awa = at(box(.16, .22, .16, M.charcoal()), W / 2 - .2, convY - .25, .62); awa.add(at(cyl(.05, .05, .06, mat(color)), 0, .14, 0)); g.add(tag(awa, 'rail_width')); P.rail_width = awa;
  const brd = pcb(1.2, .8, 10, 4).g; brd.position.set(-.1, convY + .07, 0); g.add(tag(brd, 'pcb')); P.pcb = brd;
  const cal = new THREE.Group(); cal.add(box(.4, .03, .3, M.steel())); for (let i = 0; i < 9; i++) cal.add(at(cyl(.02, .02, .01, M.black(), 10), (i % 3 - 1) * .1, .02, (Math.floor(i / 3) - 1) * .08));
  g.add(tag(at(cal, W / 2 - .45, convY - .1, -.75), 'calibration_target')); P.calibration_target = cal;
  // Gantry XY
  const gy = convY + 1.0;
  const gan = new THREE.Group(); gan.add(box(W - .3, .1, .14, M.grey())); gan.add(at(box(.1, .1, D - .6, M.grey()), -(W / 2 - .2), 0, 0), at(box(.1, .1, D - .6, M.grey()), W / 2 - .2, 0, 0));
  g.add(tag(at(gan, 0, gy, 0), 'gantry')); P.gantry = gan;
  const head = new THREE.Group();
  head.add(at(box(.38, .55, .38, M.charcoal()), 0, -.3, 0));
  const cam = at(cyl(.09, .09, .18, M.black()), 0, -.66, 0); head.add(tag(cam, 'camera'));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.17, .03, 10, 32), mat(0xffffff, { emissive: 0x88ccff, emissiveIntensity: .9 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.76; head.add(tag(ring, 'light_ring'));
  const pr = new THREE.Group(); const n = headType === 'spi' ? 2 : headType === 'ky' ? 8 : 4;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const p = at(box(.09, .2, .09, M.grey()), Math.cos(a) * .3, -.5, Math.sin(a) * .3); p.lookAt(0, -2, 0); p.add(at(cyl(.03, .03, .03, mat(color, { emissive: color, emissiveIntensity: 1 })), 0, 0, .05)); pr.add(p); }
  head.add(tag(pr, 'projector'));
  gan.add(head); tag(head.children[0], 'camera');
  P.camera = head; P.head = head; P.light_ring = ring; P.projector = pr;
  return g;
}


// ---------- AOI Koh Young Zenith (C-Platform) ----------
// Según el manual de operación: postes de esquina, módulo superior con ventana y monitor a la derecha,
// banda de rejilla bajo la ventana, puerta inferior lisa, placas laterales del transportador y torre atrás.
function zenith(P, color) {
  const G = new THREE.Group(); const W = 2.0, D = 2.62, H = 3.24, conv = 1.8, y0 = .28, F = D / 2;
  feet(G, W, D, 0, y0);
  G.add(at(box(W - .08, H - y0, D - .08, M.white()), 0, y0 + (H - y0) / 2, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => G.add(at(rbox(.13, H - y0, .13, M.lgrey(), .045), sx * (W / 2 - .065), y0 + (H - y0) / 2, sz * (D / 2 - .065))));
  G.add(at(rbox(W + .02, .09, D + .02, M.lgrey(), .035), 0, H + .02, 0));
  G.add(at(rbox(W + .02, .06, D + .02, M.black(), .02), 0, y0 + .03, 0));
  // Módulo superior: marco carbón con la ventana (puerta abatible hacia arriba)
  G.add(at(box(W - .22, 1.12, .05, M.charcoal()), 0, 2.6, F - .02));
  G.add(at(windowView(W - .5, .86), 0, 2.6, F + .006));
  const door = new THREE.Group(); door.position.set(0, 3.14, F + .03);
  door.add(at(frame(W - .3, 1.0, .1, .06, .03, M.charcoal(), .015), 0, -.52, -.015));
  door.add(at(sbox(W - .48, .82, .012, M.glass()), 0, -.52, 0));
  door.add(at(handle(.5, false), 0, -.98, .0));
  G.add(tag(door, 'door')); P.door = door;
  // Banda de rejilla y charola
  G.add(at(louvers(W - .3, .12), 0, 1.98, F + .005));
  // Columna de mando (frente izquierdo): paro, arranque, alto y llave
  const es = estop(.9); es.position.set(-W / 2 + .14, 2.38, F + .02); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  G.add(at(pushButton(0x2bd45a), -W / 2 + .14, 2.12, F + .01), at(pushButton(0xff2a1f), -W / 2 + .14, 1.98, F + .01), at(keySwitch(), -W / 2 + .14, 1.84, F + .01));
  // Puerta inferior (acceso a PC y UPS)
  const lower = at(panel(W - .3, 1.42, .04, M.white(), .03), 0, 1.14, F + .02); G.add(tag(lower, 'pc_ups')); P.pc_ups = lower;
  G.add(at(handle(.4, false), 0, 1.72, F + .02), at(screws(W - .32, 1.4), 0, 1.14, F + .045), at(louvers(.9, .22), 0, .58, F + .045));
  { const nm = label('Zenith', .5, .14, '#5d666f', null, 600, { family: 'Arial, sans-serif', italic: true }); nm.position.set(-.45, 1.52, F + .045); G.add(nm);
    const sub = label('3D AOI · KOH YOUNG', .6, .07, '#7a838b', null, 600); sub.position.set(-.4, 1.42, F + .045); G.add(sub);
    const w1 = warnTag('⚡', .12); w1.position.set(.7, 1.6, F + .046); G.add(w1); const w2 = warnTag('✋', .12); w2.position.set(.55, 3.02, F + .04); G.add(w2); }
  const il = at(sbox(.1, .07, .05, paint(0xffd200, .35)), W / 2 - .28, 3.08, F + .02); G.add(tag(il, 'interlock')); P.interlock = il;
  // Costados: placa del transportador y entrada de aire redonda
  [-1, 1].forEach(sd => G.add(at(convPort(sd, conv, D), sd * (W / 2 + .02), conv, 0)));
  { const r = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 10, 28), M.charcoal()); r.rotation.y = Math.PI / 2; G.add(at(r, -W / 2 - .01, 1.15, .1)); }
  G.add(inspectionInterior(P, W, D, conv, 'ky', color));
  dressCabinet(G, W, H, D, y0, { plinth: false });
  const ws = workstation('ky', .2); ws.position.set(W / 2 + .35, 1.95, F + .35); ws.rotation.y = -.35; G.add(ws);
  const tl = towerLight(.9); tl.g.position.set(-W / 2 + .3, H + .06, -D / 2 + .35); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D);
  return { G, W, D, H };
}
// Filtros y ventiladores traseros (comunes)
function back(G, P, W, D, y = .9) {
  const fl = at(box(.5, .5, .04, mat(0x9fb0c0, { roughness: .9 })), -W / 4, y, -D / 2 - .03); G.add(tag(fl, 'filter')); P.filter = fl;
  fl.add(at(louvers(.46, .46), 0, 0, -.025).rotateY(Math.PI));
  const fan = new THREE.Group(); fan.add(new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 8, 24), M.charcoal()));
  const blades = new THREE.Group(); for (let i = 0; i < 5; i++) { const h = new THREE.Group(); h.add(at(box(.05, .17, .01, M.grey()), 0, .09, 0)); h.rotation.z = i * Math.PI * 2 / 5; blades.add(h); }
  fan.add(blades); const guard = new THREE.Mesh(new THREE.TorusGeometry(.13, .006, 6, 24), M.steel()); fan.add(at(guard, 0, 0, -.02)); fan.position.set(W / 4, y, -D / 2 - .03); G.add(tag(fan, 'fan')); P.fan = fan; P.blades = blades;
  const pn = new THREE.Group(); pn.add(cyl(.07, .07, .28, M.steel())); pn.add(at(cyl(.08, .08, .03, mat(0xffffff)), 0, .05, .08).rotateX(Math.PI / 2)); pn.add(at(cyl(.03, .03, .1, paint(0x2a6fd6, .4)), 0, -.2, 0));
  pn.position.set(-W / 2 - .08, .9, -D / 4); G.add(tag(pn, 'pneumatic')); P.pneumatic = pn;
}

// ---------- AOI ViTrox V510i Optimus 3D ----------
// Del brochure: cuerpo de cubiertas curvas, ventana grande con marco biselado, panel de botones arriba,
// monitor en brazo articulado del lado izquierdo y torre en el techo.
function v510(P, color) {
  const G = new THREE.Group(); const W = 2.12, D = 2.7, H = 3.15, conv = 1.8, y0 = .28, F = D / 2;
  feet(G, W, D, 0, y0);
  G.add(at(rbox(W, 1.1, D, M.lgrey(), .14), 0, y0 + .55, 0)); // zócalo gris
  [.62, .92].forEach(y => G.add(at(sbox(W + .005, .018, D + .005, M.dgrey()), 0, y, 0))); // ranuras horizontales
  G.add(at(rbox(W, H - y0 - 1.1, D, M.white(), .22), 0, y0 + 1.1 + (H - y0 - 1.1) / 2, 0)); // cuerpo superior blanco
  G.add(at(rbox(W - .3, .16, D - .4, M.white(), .08), 0, H + .02, -.05)); // tapa superior abombada
  G.add(at(rbox(W - .7, .06, D - .9, M.lgrey(), .03), 0, H + .11, -.05));
  // Panel de botones sobre la ventana
  const cp = at(rbox(1.5, .2, .1, M.charcoal(), .05), 0, 2.86, F - .01); G.add(cp);
  [-.6, -.45, -.3].forEach((x, i) => cp.add(at(pushButton([0x2bd45a, 0xffa31a, 0xff2a1f][i], .028), x, 0, .055)));
  [-.05, .05, .15].forEach((x, i) => cp.add(at(cyl(.012, .012, .01, mat([0x19c3a6, 0xffffff, 0x3d8bff][i], { emissive: [0x19c3a6, 0xffffff, 0x3d8bff][i], emissiveIntensity: .8 })).rotateX(Math.PI / 2), x, 0, .055)));
  cp.add(at(keySwitch(), .35, 0, .055));
  const es = estop(.85); es.position.set(.6, 2.86, F + .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  // Ventana con marco biselado (puerta)
  G.add(at(windowView(1.32, .82), 0, 2.15, F + .012));
  const door = new THREE.Group(); door.position.set(0, 2.68, F + .04);
  door.add(at(frame(1.62, 1.08, .14, .14, .04, M.dgrey(), .02), 0, -.53, -.02));
  door.add(at(sbox(1.36, .82, .012, M.glass()), 0, -.53, 0));
  G.add(tag(door, 'door')); P.door = door;
  { const vl = label('ViTrox', .5, .12, '#2a2f35', null, 700, { italic: true }); vl.position.set(-.55, 2.86, F + .045); vl.position.x = -.25; vl.position.y = 3.02; G.add(vl); }
  const il = at(sbox(.1, .07, .05, paint(0xffd200, .35)), .74, 2.65, F + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  // Frente inferior: puerta de PC y placa
  const pcbay = at(panel(1.55, 1.0, .04, M.lgrey(), .05), 0, .85, F + .02); G.add(tag(pcbay, 'pc_ups')); P.pc_ups = pcbay;
  G.add(at(handle(.5, false), 0, 1.28, F + .03), at(louvers(1.0, .2), 0, .5, F + .045));
  { const nm = label('V510i Optimus 3D', .75, .11, '#4d555d', null, 600); nm.position.set(-.3, 1.12, F + .045); G.add(nm); const w1 = warnTag('⚡', .11); w1.position.set(.62, 1.12, F + .046); G.add(w1); }
  [-1, 1].forEach(sd => G.add(at(convPort(sd, conv, D), sd * (W / 2 + .02), conv, 0)));
  G.add(inspectionInterior(P, W, D, conv, 'aoi', color));
  dressCabinet(G, W, H, D, y0, { plinth: false });
  // Brazo articulado del monitor (lado izquierdo)
  { const arm = new THREE.Group(); arm.add(at(rbox(.12, .5, .12, M.alu(), .03), 0, 0, 0)); const a2 = at(box(.7, .08, .1, M.alu()), -.35, .22, .1); a2.rotation.y = -.5; arm.add(a2); arm.position.set(-W / 2 - .06, 2.0, F - .4); G.add(arm); }
  const ws = workstation('v510', .25); ws.position.set(-W / 2 - .55, 1.75, F + .15); ws.rotation.y = .3; G.add(ws);
  const tl = towerLight(1.0); tl.g.position.set(-.2, H + .14, -D / 2 + .5); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D);
  return { G, W, D, H };
}

// ---------- AXI ViTrox V810 S2 ----------
// De la foto del Overview: gabinete blindado crema sobre bastidor negro con patas niveladoras grandes,
// dos puertas al frente con manijas negras, módulo del transportador a la derecha, estación a la izquierda.
function v810(P, color) {
  const G = new THREE.Group(); const W = 3.04, D = 3.88, H = 3.1, ped = .9, conv = 1.8, F = D / 2;
  // Bastidor negro
  [-1, 1].forEach(s => G.add(at(box(.95, ped - .2, D - .7, M.black()), s * .82, .2 + (ped - .2) / 2, 0)));
  G.add(at(box(W - .2, .1, D - .3, M.black()), 0, ped - .05, 0));
  G.add(at(box(.7, .5, D - 1.2, M.charcoal()), 0, .45, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => G.add(at(levelFoot(.22, .17), sx * (W / 2 - .35), 0, sz * (F - .4))));
  // Gabinete blindado
  G.add(at(rbox(W, H - ped, D, M.cream(), .06), 0, ped + (H - ped) / 2, 0));
  G.add(at(rbox(W + .03, .14, D + .03, paint(0xd6d2c6, .45), .03), 0, ped + .07, 0)); // faldón
  G.add(at(rbox(W + .01, .05, D + .01, paint(0xd6d2c6, .45), .02), 0, H - .02, 0));
  // Puertas dobles con manijas negras y bisagras
  const door = new THREE.Group(); door.position.set(-.38, ped + .28, F + .01);
  const dl = at(panel(1.08, 1.75, .05, M.cream(), .03), -.56, .88, .02), dr = at(panel(1.08, 1.75, .05, M.cream(), .03), .56, .88, .02);
  dl.add(at(handle(.4), .42, .1, .02)); dr.add(at(handle(.4), -.42, .1, .02));
  [-.7, .7].forEach(y => { dl.add(at(sbox(.05, .14, .04, M.chrome()), -.55, y, .02)); dr.add(at(sbox(.05, .14, .04, M.chrome()), .55, y, .02)); });
  door.add(dl, dr); G.add(tag(door, 'door')); P.door = door;
  { const vl = label('ViTrox', 1.0, .24, '#2b2f33', null, 700, { family: 'Georgia, serif' }); vl.position.set(-.75, ped + 1.85, F + .065); G.add(vl);
    const md = label('V810', .8, .3, '#2b2f33', null, 700, { italic: true, family: 'Georgia, serif' }); md.position.set(.12, ped + 1.85, F + .065); G.add(md);
    const s2 = label('S2', .4, .3, '#e0b01a', null, 700, { italic: true }); s2.position.set(.5, ped + 1.85, F + .065); G.add(s2);
    const sub = label('Advanced 3D X-Ray Inspection', .9, .07, '#2b2f33', null, 600); sub.position.set(.2, ped + 1.64, F + .065); G.add(sub);
    const rd = warnTag('☢', .15); rd.position.set(-.38, ped + 1.6, F + .07); G.add(rd); }
  // Panel fijo derecho con seguros
  G.add(at(panel(.85, 1.75, .04, M.cream(), .03), W / 2 - .5, ped + 1.16, F + .02));
  [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]].forEach(([a, b]) => G.add(at(cyl(.022, .022, .03, M.chrome(), 16).rotateX(Math.PI / 2), W / 2 - .5 + a * .34, ped + 1.16 + b * .75, F + .05)));
  const es = estop(.9); es.position.set(W / 2 - .5, ped + .6, F + .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  { const lcd = new THREE.Group(); lcd.add(rbox(.5, .3, .04, M.plastic(), .015)); const sc = new THREE.Mesh(new THREE.PlaneGeometry(.44, .24), new THREE.MeshBasicMaterial({ color: 0x0b2a40 })); sc.position.z = .022; lcd.add(sc);
    lcd.add(at(label('X-RAY OFF', .4, .08, '#7fe3ff'), 0, .04, .025)); lcd.add(at(label('READY', .4, .08, '#36d07f'), 0, -.05, .025)); G.add(at(lcd, W / 2 - .5, ped + 1.5, F + .05)); }
  G.add(at(sbox(W - .1, .03, .02, M.black()), 0, ped + .2, F + .02));
  // Módulos laterales del transportador (con ventanilla oscura y palanca roja)
  [-1, 1].forEach(s => { const m = new THREE.Group(); m.add(rbox(.45, .9, 1.7, M.cream(), .04)); m.add(at(sbox(.02, .2, .8, M.smoke()), s * .23, -.1, .1)); m.add(at(sbox(.02, .26, .9, M.charcoal()), s * .225, -.1, .1));
    const lev = at(sbox(.04, .06, .25, paint(0xc81e1e, .35)), s * .25, .3, -.4); m.add(lev); m.position.set(s * (W / 2 + .22), conv + .05, .35); G.add(m); });
  const il = at(sbox(.12, .08, .06, paint(0xffd200, .35)), W / 2 - .4, H - .3, F + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  // Interior: tubo abajo, detector arriba, transportador
  const src = new THREE.Group(); src.add(cyl(.22, .22, .7, M.steel())); src.add(at(cyl(.12, .05, .2, mat(0xffb020, { emissive: 0xffb020, emissiveIntensity: .8 })), 0, .45, 0));
  G.add(tag(at(src, 0, ped + .5, 0), 'xray_source')); P.xray_source = src;
  const det = new THREE.Group(); det.add(box(1.2, .14, 1.2, M.charcoal())); det.add(at(box(1, .02, 1, mat(0x4fd1ff, { emissive: 0x2a8fbf, emissiveIntensity: .6 })), 0, -.08, 0));
  G.add(tag(at(det, 0, H - .45, 0), 'detector')); P.detector = det;
  const rails = new THREE.Group(); rails.add(at(box(W + .6, .08, .06, M.steel()), 0, conv, -.42), at(box(W + .6, .08, .06, M.steel()), 0, conv, .42));
  const belts = new THREE.Group(); belts.add(at(box(W + .6, .02, .04, M.black()), 0, conv + .05, -.4), at(box(W + .6, .02, .04, M.black()), 0, conv + .05, .4));
  G.add(tag(rails, 'conveyor'), tag(belts, 'belt')); P.conveyor = rails; P.belt = belts;
  const brd = pcb(1.2, .8, 10, 9).g; brd.position.set(-.2, conv + .07, 0); G.add(tag(brd, 'pcb')); P.pcb = brd;
  const gan = at(box(W - .6, .1, .14, M.grey()), 0, conv - .3, 0); G.add(tag(gan, 'gantry')); P.gantry = gan;
  const cal = at(box(.4, .03, .3, M.steel()), W / 2 - .7, conv - .1, -.8); G.add(tag(cal, 'calibration_target')); P.calibration_target = cal;
  const aw = at(box(.16, .2, .16, M.charcoal()), W / 2 - .3, conv - .3, .7); G.add(tag(aw, 'rail_width')); P.rail_width = aw;
  dressCabinet(G, W, H, D, ped, { plinth: false });
  const xl = at(cyl(.06, .06, .1, new THREE.MeshPhysicalMaterial({ color: 0xffb020, emissive: 0xffb020, emissiveIntensity: .25, transparent: true, opacity: .9 })), -.2, H + .05, F - .3); G.add(xl); P.xrayLamp = xl;
  // Estación de trabajo a la izquierda: monitor en poste, consola de llaves y charola
  { const st = new THREE.Group(); st.add(at(cyl(.05, .05, 2.3, M.alu(), 16), 0, 1.15, 0)); st.add(at(cyl(.22, .25, .05, M.black(), 24), 0, .03, 0));
    st.add(at(monitor('axi', 1.08), 0, 2.55, .08));
    const con = at(rbox(.6, .14, .3, M.lgrey(), .03), 0, 1.98, .2); st.add(con); [[-.18, 0x2bd45a], [-.06, 0xff2a1f], [.06, 0xffa31a]].forEach(([x, c]) => con.add(at(pushButton(c, .02), x, .075, 0).rotateX(-Math.PI / 2))); con.add(at(keySwitch(), .2, .075, 0).rotateX(-Math.PI / 2));
    st.add(at(rbox(1.15, .04, .55, M.black(), .015), .05, 1.78, .35)); st.add(at(keyboard(.8), -.05, 1.81, .35));
    st.position.set(-W / 2 - .65, 0, F - .5); G.add(st); }
  const pc = at(box(.6, .5, .6, M.black()), 0, .5, -.8); G.add(tag(pc, 'pc_ups')); P.pc_ups = pc;
  const tl = towerLight(.6); tl.g.position.set(W / 2 - .45, H, -F + .5); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D, ped + .6);
  return { G, W, D, H };
}

// ---------- ICT Keysight (HP) Medalist i3070 Series 5 ----------
// De "Anatomía ICT" del entrenamiento: gabinete de aire y vacío a la izquierda, cabeza de prueba al centro
// (base gris claro, banda negra con la marca, fixture arriba) y controlador negro con monitor a la derecha.
function hp3070(P, color) {
  const G = new THREE.Group(); const W = 2.9, D = 2.0, H = 2.3, F = D / 2;
  const stay = o => { o.userData.stay = true; return o; };
  // Bastidor fijo con ruedas
  G.add(stay(at(box(W + .1, .14, D, M.black()), 0, .2, 0)));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => G.add(stay(at(caster(), sx * (W / 2 - .15), 0, sz * (D / 2 - .15)))));
  // Pedal de piso: vacío para enclavar / desenclavar el fixture
  { const pd = new THREE.Group(); pd.add(rbox(.5, .08, .6, M.charcoal(), .02)); const tp = at(box(.42, .04, .45, paint(0xffd200, .4)), 0, .07, .03); tp.rotation.x = -.12; pd.add(tp); pd.add(at(cyl(.015, .015, 1.2, M.rubber(), 6).rotateX(Math.PI / 2), -.15, .02, -.9)); pd.position.set(.9, .04, F + .7); G.add(stay(tag(pd, 'pedal'))); P.pedal = pd; P.pedalTop = tp; }
  // Botón de giro de la cabeza, en la parte trasera
  { const bp = new THREE.Group(); bp.add(at(box(.08, 1.0, .08, M.charcoal()), 0, .5, 0)); bp.add(at(rbox(.3, .3, .12, paint(0xffd200, .4), .03), 0, 1.1, 0)); bp.add(at(pushButton(0x2bd45a, .05).rotateY(Math.PI), 0, 1.12, -.07)); bp.position.set(W / 2 - .5, 0, -F - .35); G.add(stay(tag(bp, 'rot_button'))); P.rot_button = bp; }
  // Cabeza de prueba: base gris claro, banda negra superior, cubierta superior oscura
  G.add(at(box(W - .08, .98, D - .2, paint(0xd3d6d9, .42)), 0, .3 + .49, -.02));
  [-.7, .7].forEach(x => G.add(at(seam(.9), x, .79, F - .11)));
  G.add(at(louvers(1.6, .22), 0, .5, F - .11));
  G.add(at(box(W - .02, .64, D - .12, M.black()), 0, 1.6, 0));
  G.add(at(box(W + .02, .1, D, paint(0x24272a, .5)), 0, 1.96, 0));
  { const kl = label('KEYSIGHT', .62, .12, '#f2f2f2', null, 800); kl.position.set(-.95, 1.78, F - .055); G.add(kl);
    const ml = label('Medalist i3070 Series 5', .75, .07, '#d0d4d8', null, 600); ml.position.set(-.9, 1.66, F - .055); G.add(ml);
    const wv = new THREE.Mesh(new THREE.PlaneGeometry(.1, .1), new THREE.MeshStandardMaterial({ color: 0xe11b22, roughness: .4 })); wv.position.set(-1.3, 1.78, F - .054); G.add(wv);
    G.add(at(warnTag('⚡', .1), .25, 1.72, F - .054)); }
  // Fixture (cama de agujas) con su placa, puntas y tapa de presión
  const fx = new THREE.Group(); fx.position.set(0, 2.05, .05);
  fx.add(rbox(1.6, .14, 1.2, M.charcoal(), .02)); fx.add(at(box(1.45, .03, 1.05, mat(0xe6dcc0)), 0, .085, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => fx.add(at(cyl(.03, .03, .12, M.steel(), 12), a * .7, .12, b * .5))); // pernos guía
  const probes = new THREE.Group(); for (let i = 0; i < 70; i++) probes.add(at(cyl(.01, .01, .14, mat(0xd4af37, { metalness: .9, roughness: .2 }), 6), (i % 14 - 6.5) * .095, .15, (Math.floor(i / 14) - 2) * .18));
  fx.add(tag(probes, 'probes')); G.add(tag(fx, 'fixture')); tag(probes, 'probes'); P.fixture = fx; P.probes = probes;
  const brd = pcb(1.3, .9, 12, 11).g; brd.position.set(0, 2.32, .05); G.add(tag(brd, 'pcb')); P.pcb = brd;
  const lid = new THREE.Group(); lid.position.set(0, 2.15, -.6);
  const fr = at(frame(1.6, 1.25, .12, .05, .04, M.alu(), .01), 0, 0, .62); fr.rotation.x = -Math.PI / 2; lid.add(fr); for (let i = 0; i < 6; i++) lid.add(at(box(.03, .05, 1.2, M.charcoal()), -.7 + i * .28, .03, .62));
  lid.add(at(handle(.5, false).rotateX(-Math.PI / 2), 0, .04, 1.2));
  lid.rotation.x = -1.1; G.add(tag(lid, 'door')); P.door = lid;
  { const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.02), (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 184; const x = c.getContext('2d'); x.fillStyle = '#e6dcc0'; x.fillRect(0, 0, 256, 184); x.fillStyle = '#8a7a50'; for (let i = 0; i < 260; i++) { x.beginPath(); x.arc(8 + (i * 37) % 240, 8 + (i * 53) % 168, 1.6, 0, 7); x.fill(); } x.strokeStyle = '#6b5a35'; x.lineWidth = 3; x.strokeRect(20, 16, 216, 152); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: .7 }); })());
    plate.rotation.x = -Math.PI / 2; plate.position.y = .102; P.fixture.add(plate);
    [-1, 1].forEach(sd => { const cy = new THREE.Group(); cy.add(cyl(.05, .05, .5, M.steel(), 14)); cy.add(at(cyl(.02, .02, .4, M.chrome(), 8), 0, .4, 0)); cy.rotation.x = -.5; G.add(at(cy, sd * .85, 2.2, -.55)); }); }
  const es = estop(.9); es.position.set(1.1, 1.66, F - .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  const il = at(sbox(.1, .07, .05, paint(0xffd200, .35)), .9, 1.99, F - .02); G.add(tag(il, 'interlock')); P.interlock = il;
  const cal = at(box(.35, .04, .25, M.steel()), W / 2 - .5, 2.0, .7); G.add(tag(cal, 'calibration_target')); P.calibration_target = cal;
  // Gabinete de aire, vacío y alimentación (izquierda, fijo)
  { const L = new THREE.Group(); L.add(at(rbox(1.15, 2.8, 1.75, M.cream(), .04), 0, 1.5, 0)); L.add(at(rbox(1.17, .1, 1.77, M.black(), .02), 0, .14, 0));
    L.add(at(seam(2.4), 0, 1.5, .88)); L.add(at(handle(.4), .45, 1.7, .88)); L.add(at(louvers(.8, .5), 0, .55, .885)); L.add(at(screws(1.1, 2.7), 0, 1.5, .885));
    const nm = label('Air / Vacuum · PDU', .6, .07, '#6b7178'); nm.position.set(-.2, 2.6, .886); L.add(nm);
    const vac = at(cyl(.15, .15, .4, M.grey()), 0, .6, -.3); L.add(vac); tag(vac, 'vacuum'); P.vacuum = vac;
    const tl = towerLight(.4); tl.g.position.set(.3, 2.9, -.5); L.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
    // Impresora de etiquetas en repisa
    L.add(at(box(.5, .04, .5, M.alu()), .8, 2.05, .4)); const pr = at(rbox(.42, .3, .42, M.white(), .05), .8, 2.22, .4); L.add(pr); L.add(at(sbox(.3, .01, .1, M.black()), .8, 2.3, .62));
    L.position.set(-W / 2 - .66, 0, -.05); G.add(stay(L)); }
  // Controlador (derecha, fijo): gabinete negro con rejilla, monitor en poste y charola del teclado
  { const R = new THREE.Group(); const pc = at(rbox(1.0, 1.75, 1.5, M.black(), .04), 0, .95, 0); R.add(tag(pc, 'pc_ups')); P.pc_ups = pc;
    R.add(at(louvers(.8, .45), 0, .4, .755)); R.add(at(pushButton(0x2bd45a, .025), .3, 1.6, .755)); R.add(at(cyl(.06, .08, .02, M.plastic(), 16).rotateX(Math.PI / 2), -.25, 1.55, .755));
    R.add(at(cyl(.045, .045, .9, M.alu(), 16), .1, 2.25, -.2)); R.add(at(monitor('ict', 1.0), .1, 2.75, -.12));
    R.add(at(rbox(1.0, .04, .5, M.charcoal(), .015), -.35, 1.95, .55)); R.add(at(keyboard(.8), -.4, 1.98, .55));
    R.position.set(W / 2 + .58, 0, -.15); G.add(stay(R)); }
  back(G, P, W, D, .9);
  const pn = P.pneumatic; pn.position.set(-W / 2 + .2, .9, -.3);
  return { G, W, D, H };
}

// ---------- SPI Koh Young KY8030-3 ----------
// De la portada del manual: columna blanca izquierda con paro, botones, llave e interruptor principal;
// módulo superior gris oscuro con ventana negra, moldura cromada, puerta inferior gris con manija curva
// y monitor en brazo a la derecha con torre de luces.
function ky8030(P, color) {
  const G = new THREE.Group(); const W = 2.0, D = 2.43, H = 3.0, conv = 1.8, y0 = .3, F = D / 2;
  feet(G, W, D, 0, y0, .12);
  G.add(at(box(W - .04, H - y0, D - .04, paint(0xd9dcdf, .42)), 0, y0 + (H - y0) / 2, 0));
  // Columnas blancas
  G.add(at(rbox(.36, H - y0, .1, M.white(), .03), -W / 2 + .18, y0 + (H - y0) / 2, F));
  G.add(at(rbox(.22, H - y0, .1, M.white(), .03), W / 2 - .11, y0 + (H - y0) / 2, F));
  const es = estop(.9); es.position.set(-W / 2 + .18, 2.62, F + .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  G.add(at(pushButton(0x2bd45a), -W / 2 + .18, 2.4, F + .05), at(pushButton(0xff2a1f), -W / 2 + .18, 2.28, F + .05), at(keySwitch(), -W / 2 + .18, 2.08, F + .05));
  G.add(at(mainSwitch(), -W / 2 + .18, 1.75, F + .06));
  G.add(at(warnTag('⚡', .12), -W / 2 + .18, 1.48, F + .051));
  // Módulo superior gris oscuro con ventana negra (puerta)
  G.add(at(box(W - .56, 1.1, .06, M.dgrey()), .07, 2.47, F - .01));
  G.add(at(windowView(1.28, .78, 'spi'), .07, 2.5, F + .025));
  const door = new THREE.Group(); door.position.set(.07, 2.95, F + .04);
  door.add(at(sbox(1.32, .86, .012, M.smoke()), 0, -.45, 0));
  { const kl = label('KY-8030', .4, .08, '#e4e8ec', null, 700); kl.position.set(-.38, -.13, .01); door.add(kl); const lg = new THREE.Mesh(new THREE.PlaneGeometry(.08, .08), new THREE.MeshStandardMaterial({ color: 0x5bb543, roughness: .4 })); lg.position.set(-.6, -.13, .01); door.add(lg); }
  G.add(tag(door, 'door')); P.door = door;
  G.add(at(sbox(W - .5, .04, .07, M.chrome()), .07, 1.9, F + .02)); // moldura cromada
  // Puerta inferior gris con manija curva a la derecha
  const pcbay = at(panel(W - .58, 1.5, .04, paint(0xbcc0c4, .42), .03), .07, 1.12, F + .02); G.add(tag(pcbay, 'pc_ups')); P.pc_ups = pcbay;
  { const hd = new THREE.Mesh(new THREE.TorusGeometry(.4, .02, 10, 32, Math.PI * .7), M.chrome()); hd.rotation.set(0, Math.PI / 2, Math.PI * .65); G.add(at(hd, W / 2 - .3, 1.3, F + .03)); }
  G.add(at(screws(W - .6, 1.48), .07, 1.12, F + .045));
  const il = at(sbox(.1, .07, .05, paint(0xffd200, .35)), W / 2 - .35, 2.95, F + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  [-1, 1].forEach(sd => G.add(at(convPort(sd, conv, D), sd * (W / 2 + .02), conv, 0)));
  G.add(inspectionInterior(P, W, D, conv, 'spi', color));
  dressCabinet(G, W, H, D, y0, { plinth: true });
  // Brazo del monitor con charola (derecha)
  G.add(at(rbox(.14, .3, .14, M.plastic(), .03), W / 2 + .08, 2.15, F - .2));
  const ws = workstation('spi', .4); ws.position.set(W / 2 + .85, 1.92, F - .25); ws.rotation.y = -.05; G.add(ws);
  const tl = towerLight(.9); tl.g.position.set(W / 2 - .3, H, -.2); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D);
  return { G, W, D, H };
}

const BUILDERS = { zenith, v510, v810, hp3070, ky8030 };
export const REAL_MODELS = Object.keys(BUILDERS);

export function buildReal(kind, color = '#3d8bff') {
  const P = {};
  const r = (BUILDERS[kind] || zenith)(P, new THREE.Color(color).getHex());
  r.G.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Las cubiertas exteriores no deben robar el clic a las piezas interiores marcadas
  return { group: r.G, parts: P, dims: { W: r.W, H: r.H, D: r.D, base: 0 } };
}

// ---------- Máquinas de la línea SMT (genéricas, proporciones reales) ----------
export function lineMachine(type) {
  const G = new THREE.Group(); const anim = [];
  const shell = (W, D, H, color = M.offwhite()) => { feet(G, W, D); G.add(at(box(W, H - .25, D, color), 0, .25 + (H - .25) / 2, 0)); };
  const win = (w, h, y, D) => G.add(at(box(w, h, .04, M.glass()), 0, y, D / 2 + .02));
  const conv = (W) => { G.add(at(box(W + .6, .06, .06, M.steel()), 0, 1.8, -.42), at(box(W + .6, .06, .06, M.steel()), 0, 1.8, .42)); };
  let W = 2, D = 2.6, H = 3;
  if (type === 'printer') { // Impresora de pasta estilo DEK Horizon: base gris, cubierta clara redondeada, tapa ahumada, franja roja
    W = 2.7; D = 3.4; H = 3.0; feet(G, W, D); // Horizon 03iX ≈ 1340 × 1700 × 1500 mm
    G.add(at(box(W, 1.45, D, M.grey()), 0, .25 + .72, 0));
    G.add(at(box(W + .02, .1, D + .02, mat(0xa4161a)), 0, 1.72, 0)); // franja roja
    G.add(at(box(W, .9, D, M.white()), 0, 2.22, 0));
    const lid = at(box(W - .3, .12, D - .5, mat(0x23272b, { roughness: .2, metalness: .3, transparent: true, opacity: .85 })), 0, 2.72, 0); G.add(lid);
    [-1, 1].forEach(s => G.add(at(cyl(.45, .45, D, M.white(), 24), s * (W / 2 - .3), 2.3, 0).rotateX(Math.PI / 2)));
    const es = estop(); es.position.set(-W / 2 + .4, 1.6, D / 2 + .05); G.add(es);
    G.add(at(box(.1, .1, .05, mat(0xffd43b)), W / 2 - .5, 1.3, D / 2 + .03));
    const ws = workstation('spi', .4); ws.position.set(-W / 2 + .3, 1.65, D / 2 + .5); ws.scale.setScalar(.8); G.add(ws);
    const tl = towerLight(1.0); tl.g.position.set(W / 2 - .5, 2.8, -D / 2 + .5); G.add(tl.g);
    const sq = at(box(.08, .2, 1.6, M.steel()), 0, 2.45, 0); G.add(sq); anim.push(t => { sq.position.x = Math.sin(t * 1.1) * .8; });
    G.add(at(box(1.5, .02, 1.8, M.steel()), 0, 2.35, 0)); // stencil
    G.add(at(box(.04, .3, .9, M.black()), -W / 2 - .001, 1.8, 0), at(box(.04, .3, .9, M.black()), W / 2 + .001, 1.8, 0));
    conv(W);
    const pl = label('Impresora de pasta', 1.1, .14, '#30363d'); pl.position.set(.3, 2.0, D / 2 + .02); G.add(pl); }
  if (type === 'mounter') { // Pick & place modular (tipo NXT): base común y 4 módulos con bancos de feeders al frente y atrás
    W = 3.2; D = 3.6; H = 3.0; feet(G, W, D);
    G.add(at(box(W, 1.05, D - .9, M.offwhite()), 0, .25 + .52, 0));
    const heads = [];
    for (let i = 0; i < 4; i++) {
      const x = -W / 2 + .4 + i * .8;
      G.add(at(box(.76, 1.2, D - .9, M.white()), x, 1.9, 0));
      G.add(at(box(.6, .5, .03, M.glass()), x, 2.15, (D - .9) / 2 + .01));
      G.add(at(box(.62, .06, .05, mat(0x1d6fd6)), x, 2.45, (D - .9) / 2 + .02));
      const scr = screen(.3, .2, 'aoi'); scr.position.set(x + .18, 1.65, (D - .9) / 2 + .02); G.add(scr);
      const tl = towerLight(.25); tl.g.scale.setScalar(.6); tl.g.position.set(x + .25, 2.5, 0); G.add(tl.g);
      for (const s of [-1, 1]) { const bank = at(box(.74, .85, .45, M.charcoal()), x, 1.35, s * ((D - .9) / 2 + .23)); G.add(bank);
        for (let k = 0; k < 5; k++) bank.add(at(cyl(.11, .11, .04, mat([0xf5f5f5, 0x3d8bff, 0xffb020, 0x111111][k % 4]), 16), -.28 + k * .14, .5, s * -.05).rotateZ(Math.PI / 2)); }
      const h = at(box(.22, .25, .22, M.charcoal()), x, 2.15, 0); G.add(h); heads.push(h);
    }
    anim.push(t => heads.forEach((h, i) => { h.position.z = Math.sin(t * 3 + i) * .7; h.position.y = 2.15 + Math.max(0, Math.sin(t * 6 + i)) * .08; }));
    conv(W);
    const pl = label('Pick & Place modular', 1.2, .14, '#30363d'); pl.position.set(0, 1.0, (D - .9) / 2 + .01); G.add(pl); }
  if (type === 'reflow') { // Horno de convección forzada tipo Heller: cuerpo gris claro largo, cubierta superior abatible, chimeneas
    W = 10.5; D = 2.8; H = 2.7; feet(G, W, D); // 1913 MK5 ≈ 5.3 m de largo
    G.add(at(box(W, 1.45, D, M.lgrey()), 0, .25 + .72, 0));
    G.add(at(box(W - .4, .9, D - .1, M.offwhite()), 0, 2.15, 0));
    G.add(at(box(W - .4, .04, D, M.grey()), 0, 1.72, 0)); // línea de apertura de la cubierta
    for (let i = 0; i < 10; i++) {
      const x = -W / 2 + .7 + i * .86;
      const z = at(box(.8, .04, D - .5, mat(0xd9480f, { emissive: 0xd9480f, emissiveIntensity: .15 + i * .06 })), x, 1.74, 0); G.add(z);
      G.add(at(box(.6, .5, .03, M.lgrey()), x, .9, D / 2 + .01));
      const n = label(String(i + 1), .16, .16, '#555'); n.position.set(x, 2.45, D / 2 - .04); G.add(n);
    }
    [-3, 0, 3].forEach(x => G.add(at(cyl(.16, .16, .7, M.steel()), x, 2.95, -.3)));
    const pnl = at(box(.7, .5, .05, M.black()), W / 2 - .7, 2.0, D / 2 + .03); pnl.add(at(screen(.62, .42, 'aoi'), 0, 0, .03)); G.add(pnl);
    const es = estop(); es.position.set(W / 2 - 1.3, 1.6, D / 2 + .05); G.add(es);
    const tl = towerLight(.6); tl.g.position.set(W / 2 - .4, 2.6, -D / 2 + .4); G.add(tl.g);
    conv(W);
    const pl = label('Horno de reflujo · 10 zonas', 1.6, .16, '#30363d'); pl.position.set(-W / 2 + 1.4, 2.25, D / 2 - .04); G.add(pl); }
  if (type === 'loader' || type === 'unloader') { // Cargador / descargador de magazines
    W = 2.4; D = 2.2; H = 2.8; feet(G, W, D);
    G.add(at(box(W, .9, D, M.lgrey()), 0, .25 + .45, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => G.add(at(box(.07, 1.9, .07, M.steel()), a * (W / 2 - .1), 1.9, b * (D / 2 - .1))));
    const mag = at(box(1.3, 1.1, 1.0, M.charcoal()), 0, 1.75, 0); G.add(mag);
    for (let i = 0; i < 12; i++) mag.add(at(box(1.2, .015, .95, mat(0x1f6b3a)), 0, -.48 + i * .085, 0));
    anim.push(t => { mag.position.y = 1.75 + Math.sin(t * .3) * .12; });
    const ctl = at(box(.35, .3, .1, M.charcoal()), W / 2 - .3, 1.3, D / 2 + .05); ctl.add(at(cyl(.04, .04, .03, mat(0x36d07f, { emissive: 0x36d07f, emissiveIntensity: .6 })), 0, 0, .06).rotateX(Math.PI / 2)); G.add(ctl);
    conv(W); }
  if (type === 'buffer') { W = 1.6; D = 1.8; H = 2.4; G.add(at(box(W, 1.6, D, M.lgrey()), 0, .8, 0)); conv(W); }
  if (type === 'rework') { W = 3; D = 1.5; H = 1.9; G.add(at(box(W, .08, D, mat(0x2b5a8a)), 0, 1.6, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => G.add(at(box(.08, 1.6, .08, M.steel()), a * (W / 2 - .1), .8, b * (D / 2 - .1))));
    G.add(at(box(.6, .25, .4, M.charcoal()), -.8, 1.77, 0)); G.add(at(cyl(.15, .15, .35, M.offwhite()), .4, 1.8, -.2)); G.add(at(box(.5, .3, .05, M.black()), .9, 2.0, -.5)); const m = at(box(W, .02, D, mat(0x3a6ea5)), 0, 1.65, 0); G.add(m); }
  G.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: G, anim, W, D, H };
}
