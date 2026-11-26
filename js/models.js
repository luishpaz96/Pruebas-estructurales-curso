// Modelos 3D basados en las máquinas reales (proporciones de las fotos y fichas técnicas del material del curso).
// Escala: 1 unidad = 0.5 m. Transporte en el eje X (izquierda → derecha), frente de la máquina hacia +Z.
// Sin logotipos: sólo placas con texto genérico. Cada pieza lleva userData.part para el taller de mantenimiento.
import { THREE, box, cyl, at, mat, pcb } from './stage.js';

const tag = (o, part) => { o.traverse(c => { c.userData.part = part; }); return o; };
const M = {
  white: () => mat(0xeef0f2, { roughness: .35, metalness: .1 }),
  offwhite: () => mat(0xe2e2dc, { roughness: .4 }),
  lgrey: () => mat(0xc7ccd1, { roughness: .45, metalness: .2 }),
  grey: () => mat(0x8d949b, { roughness: .45, metalness: .3 }),
  charcoal: () => mat(0x2b2f33, { roughness: .5, metalness: .2 }),
  black: () => mat(0x111315, { roughness: .4 }),
  navy: () => mat(0x1f2f4f, { roughness: .45, metalness: .2 }),
  steel: () => mat(0xaab1b8, { roughness: .25, metalness: .85 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x0a0e12, roughness: .05, metalness: .3, transparent: true, opacity: .55 }),
};

function label(text, w = 1, h = .22, color = '#30363d', bg = null, font = 600) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.fillStyle = color; x.font = `${font} ${Math.round(c.height * .62)}px Rajdhani, Barlow, sans-serif`; x.textBaseline = 'middle'; x.fillText(text, c.height * .2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}
function screen(w, h, kind = 'aoi') {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d');
  x.fillStyle = '#dfe6ee'; x.fillRect(0, 0, 320, 200); x.fillStyle = '#3a6ea5'; x.fillRect(0, 0, 320, 14);
  x.fillStyle = kind === 'axi' ? '#1c1c1c' : '#14532d'; x.fillRect(8, 22, 200, 150);
  for (let i = 0; i < 40; i++) { x.fillStyle = kind === 'axi' ? '#9a9a9a' : ['#c9a74a', '#d0d0d0', '#222'][i % 3]; x.fillRect(16 + (i * 37) % 180, 30 + (i * 53) % 130, 8 + i % 3 * 6, 5 + i % 2 * 5); }
  x.fillStyle = '#fff'; x.fillRect(216, 22, 96, 150); x.fillStyle = '#999'; for (let i = 0; i < 10; i++) x.fillRect(222, 30 + i * 14, 80, 6);
  x.fillStyle = '#36d07f'; x.fillRect(222, 175, 40, 16); x.fillStyle = '#ff5a5f'; x.fillRect(266, 175, 40, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}
// Monitor con teclado en brazo
function workstation(kind, armLen = .9) {
  const g = new THREE.Group();
  const mon = new THREE.Group(); mon.add(box(1.05, .68, .06, M.black())); mon.add(at(screen(.98, .6, kind), 0, 0, .035));
  mon.add(at(box(.08, .4, .08, M.charcoal()), 0, -.5, -.05)); g.add(at(mon, 0, .95, 0));
  g.add(at(box(1.1, .04, .5, M.black()), 0, .25, .2)); // charola de teclado
  g.add(at(box(.85, .03, .28, M.charcoal()), -.08, .285, .2));
  g.add(at(box(.14, .04, .2, M.lgrey()), .42, .285, .2)); // trackball
  g.add(at(box(armLen, .06, .1, M.steel()), -armLen / 2 - .3, .3, 0));
  return g;
}
function towerLight(h = 1.0) {
  const g = new THREE.Group(); g.add(at(cyl(.03, .03, h, M.steel()), 0, h / 2, 0));
  const lamps = [0xff3b30, 0xffb020, 0x36d07f].map((c, i) => { const l = at(cyl(.075, .075, .16, mat(c, { emissive: c, emissiveIntensity: i === 2 ? 1 : .08, transparent: true, opacity: .92 })), 0, h + .12 + (2 - i) * .17, 0); g.add(l); return l; });
  g.add(at(cyl(.075, .075, .05, M.charcoal()), 0, h + .62, 0));
  return { g, lamps };
}
function estop() {
  const g = new THREE.Group(); g.add(box(.2, .2, .05, mat(0xffd43b)));
  const m = at(cyl(.075, .085, .08, mat(0xd62828, { emissive: 0x440000 })), 0, 0, .06); m.rotation.x = Math.PI / 2; g.add(m); g.userData.mush = m; return g;
}
function feet(g, W, D, y = 0, h = .25, r = .09) {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { g.add(at(cyl(.035, .035, h, M.steel()), sx * (W / 2 - .15), y + h / 2, sz * (D / 2 - .15))); g.add(at(cyl(r, r * 1.1, .05, M.black()), sx * (W / 2 - .15), y + .025, sz * (D / 2 - .15))); });
}

// Interior común de un AOI/SPI: rieles, bandas, gantry y cabezal
function inspectionInterior(P, W, D, convY, headType = 'aoi', color = 0x3d8bff) {
  const g = new THREE.Group();
  const rails = new THREE.Group();
  rails.add(at(box(W + .9, .08, .06, M.steel()), 0, convY, -.42), at(box(W + .9, .08, .06, M.steel()), 0, convY, .42));
  const belts = new THREE.Group(); belts.add(at(box(W + .9, .02, .04, M.black()), 0, convY + .05, -.4), at(box(W + .9, .02, .04, M.black()), 0, convY + .05, .4));
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

// ---------- AOI Koh Young Zenith ----------
function zenith(P, color) {
  const G = new THREE.Group(); const W = 2.0, D = 2.8, H = 3.24, conv = 1.8; // Zenith ≈ 1000 × 1400 × 1620 mm
  feet(G, W, D);
  // Cuerpo lateral y trasero en carbón
  G.add(at(box(W, H - .25, D - .1, M.charcoal()), 0, .25 + (H - .25) / 2, -.05));
  // Frente inferior blanco con placa
  const lower = at(box(W - .35, 1.5, .06, M.white()), .12, 1.0, D / 2); G.add(tag(lower, 'pc_ups')); P.pc_ups = lower;
  const plate = label('3D AOI', .9, .16, '#2b2f33'); plate.position.set(.12, 1.55, D / 2 + .035); G.add(plate);
  // Banda gris izquierda con controles
  G.add(at(box(.3, H - .3, .1, M.grey()), -W / 2 + .15, .25 + (H - .3) / 2, D / 2));
  const es = estop(); es.position.set(-W / 2 + .15, 2.55, D / 2 + .06); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  [[2.3, 0x36d07f], [2.3, 0xff3b30], [2.0, 0x36d07f], [2.0, 0xff3b30]].forEach(([y, c], i) => G.add(at(cyl(.035, .035, .04, mat(c, { emissive: c, emissiveIntensity: .5 })), -W / 2 + .1 + (i % 2) * .1, y, D / 2 + .06).rotateX(Math.PI / 2)));
  const es2 = at(estop(), -W / 2 + .15, 1.75, D / 2 + .06); G.add(es2);
  // Ventana superior (puerta abatible)
  const door = new THREE.Group(); door.position.set(.12, H - .05, D / 2 + .02);
  door.add(at(box(W - .4, .95, .04, M.glass()), 0, -.5, 0)); door.add(at(box(W - .4, .14, .06, M.white()), 0, -.03, 0));
  const zl = label('INSPECCIÓN 3D', .7, .1, '#555'); zl.position.set(-.35, -.03, .035); door.add(zl);
  G.add(tag(door, 'door')); P.door = door;
  G.add(at(box(W - .35, .1, .08, M.lgrey()), .12, 1.85, D / 2 + .02)); // rejilla
  // Aberturas laterales del transportador
  [-1, 1].forEach(s => G.add(at(box(.04, .3, 1.0, M.black()), s * (W / 2 + .001), conv, 0)));
  const il = at(box(.1, .1, .06, mat(0xffd43b)), W / 2 - .3, H - .2, D / 2 + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  G.add(inspectionInterior(P, W, D, conv, 'ky', color));
  // Monitor al frente derecho
  const ws = workstation('aoi', .5); ws.position.set(.55, 2.05, D / 2 + .55); G.add(ws);
  const tl = towerLight(.9); tl.g.position.set(W / 2 - .25, H, -D / 2 + .35); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D);
  return { G, W, D, H };
}
// Filtros y ventiladores traseros (comunes)
function back(G, P, W, D, y = .9) {
  const fl = at(box(.5, .5, .04, mat(0x9fb0c0, { roughness: .9 })), -W / 4, y, -D / 2 - .03); G.add(tag(fl, 'filter')); P.filter = fl;
  const fan = new THREE.Group(); fan.add(new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 8, 24), M.charcoal()));
  const blades = new THREE.Group(); for (let i = 0; i < 5; i++) { const h = new THREE.Group(); h.add(at(box(.05, .17, .01, M.grey()), 0, .09, 0)); h.rotation.z = i * Math.PI * 2 / 5; blades.add(h); }
  fan.add(blades); fan.position.set(W / 4, y, -D / 2 - .03); G.add(tag(fan, 'fan')); P.fan = fan; P.blades = blades;
  const pn = new THREE.Group(); pn.add(cyl(.07, .07, .28, M.steel())); pn.add(at(cyl(.08, .08, .03, mat(0xffffff)), 0, .05, .08).rotateX(Math.PI / 2));
  pn.position.set(-W / 2 - .08, .9, -D / 4); G.add(tag(pn, 'pneumatic')); P.pneumatic = pn;
}

// ---------- AOI ViTrox V510 Optimus 3D ----------
function v510(P, color) {
  const G = new THREE.Group(); const W = 2.12, D = 2.7, H = 3.1, conv = 1.8; // V510: 1060 × 1353 × 2111 mm (con torre)
  feet(G, W, D);
  const body = at(box(W, H - .25, D, M.white()), 0, .25 + (H - .25) / 2, 0); G.add(body);
  G.add(at(box(W - .02, .08, D - .02, M.offwhite()), 0, H + .0, 0)); // techo redondeado (aprox.)
  G.add(at(box(.36, H - .3, .06, M.black()), -W / 2 + .18, .25 + (H - .3) / 2, D / 2 + .01)); // franja negra vertical
  const pl = label('3D AOI', .7, .16, '#e8eef4'); pl.rotation.z = Math.PI / 2; pl.position.set(-W / 2 + .18, 1.1, D / 2 + .05); G.add(pl);
  // Panel de control superior
  const cp = at(box(.9, .14, .05, M.charcoal()), .1, 2.65, D / 2 + .03); G.add(cp);
  [0x111, 0x111, 0x111, 0x19c3a6, 0xffffff, 0x3d8bff, 0x3d8bff].forEach((c, i) => cp.add(at(cyl(.025, .025, .03, mat(c, { emissive: c, emissiveIntensity: .3 })), -.36 + i * .12, 0, .03).rotateX(Math.PI / 2)));
  const es = estop(); es.position.set(W / 2 - .3, 2.65, D / 2 + .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  const door = new THREE.Group(); door.position.set(.15, 2.45, D / 2 + .03);
  door.add(at(box(1.3, .85, .04, M.glass()), 0, -.45, 0)); door.add(at(box(1.45, .06, .05, M.lgrey()), 0, -.92, 0));
  G.add(tag(door, 'door')); P.door = door;
  const pcbay = at(box(1.45, 1.2, .04, M.offwhite()), .15, .85, D / 2 + .02); G.add(tag(pcbay, 'pc_ups')); P.pc_ups = pcbay;
  [-1, 1].forEach(s => G.add(at(box(.04, .28, .9, M.black()), s * (W / 2 + .001), conv, 0)));
  const il = at(box(.1, .1, .06, mat(0xffd43b)), W / 2 - .3, 2.4, D / 2 + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  G.add(inspectionInterior(P, W, D, conv, 'aoi', color));
  const ws = workstation('aoi', .9); ws.position.set(-W / 2 - .5, 1.75, D / 2 + .1); ws.rotation.y = .25; G.add(ws);
  const tl = towerLight(1.4); tl.g.position.set(-.3, H, -D / 2 + .3); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D);
  return { G, W, D, H };
}

// ---------- AXI ViTrox V810 S2 ----------
function v810(P, color) {
  const G = new THREE.Group(); const W = 3.04, D = 3.88, H = 3.5, ped = .9, conv = 1.8; // V810 S2: 1520 × 1940 × 1890 mm
  // Pedestal negro con patas
  G.add(at(box(W - 1.0, ped, D - .8, M.black()), 0, ped / 2, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { G.add(at(box(.25, ped, .25, M.black()), sx * (W / 2 - .45), ped / 2, sz * (D / 2 - .45))); G.add(at(cyl(.14, .16, .07, M.charcoal()), sx * (W / 2 - .45), .035, sz * (D / 2 - .45))); });
  // Gabinete blindado
  G.add(at(box(W, H - ped, D, M.offwhite()), 0, ped + (H - ped) / 2, 0));
  G.add(at(box(W + .04, .18, D + .04, M.offwhite()), 0, ped + .09, 0)); // faldón
  // Puertas frontales dobles con manijas
  const door = new THREE.Group(); door.position.set(-.2, ped + .35, D / 2 + .01);
  const dl = at(box(1.15, 1.7, .05, M.offwhite()), -.62, .85, 0), dr = at(box(1.2, 1.7, .05, M.offwhite()), .62, .85, 0);
  [dl, dr].forEach((d, i) => { d.add(at(box(.05, .35, .06, M.black()), i ? -.48 : .48, .1, .05)); d.add(at(box(.01, 1.7, .06, M.lgrey()), i ? -.6 : .6, 0, 0)); });
  door.add(dl, dr); G.add(tag(door, 'door')); P.door = door;
  const pl = label('3D AXI', .9, .22, '#30363d'); pl.position.set(.55, ped + 1.75, D / 2 + .07); G.add(pl);
  const rad = label('☢', .16, .16, '#111', '#ffd43b', 700); rad.position.set(-.45, ped + 1.95, D / 2 + .07); G.add(rad);
  // Compuertas laterales (shutters) y ventanilla
  [-1, 1].forEach(s => { const sh = at(box(.08, .35, 1.2, M.lgrey()), s * (W / 2 + .03), conv, 0); G.add(sh); sh.add(at(box(.02, .12, .7, M.black()), s * .04, 0, 0)); });
  const il = at(box(.12, .12, .06, mat(0xffd43b)), W / 2 - .4, H - .3, D / 2 + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  const es = estop(); es.position.set(W / 2 - .4, ped + .25, D / 2 + .05); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
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
  // Estación de trabajo a la izquierda (monitor en poste)
  const ws = workstation('axi', .2); ws.position.set(-W / 2 - .5, 1.6, D / 2 - .2); G.add(ws);
  G.add(at(cyl(.05, .05, 1.6, M.charcoal()), -W / 2 - .5, .8, D / 2 - .3));
  const pc = at(box(.6, .8, .6, M.black()), -W / 2 + .8, ped / 2, 0); G.add(tag(pc, 'pc_ups')); P.pc_ups = pc;
  const tl = towerLight(.6); tl.g.position.set(W / 2 - .4, H, -D / 2 + .4); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  back(G, P, W, D, ped + .6);
  return { G, W, D, H };
}

// ---------- ICT Keysight/HP 3070 Serie 3 ----------
function hp3070(P, color) {
  const G = new THREE.Group(); const W = 2.9, D = 2.0, H = 2.3; // testhead HP3070 S3 (aprox.)
  // Base con ruedas
  G.add(at(box(W, .12, D, M.charcoal()), 0, .2, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => G.add(at(cyl(.07, .07, .1, M.black()), sx * (W / 2 - .15), .07, sz * (D / 2 - .15))));
  // Cuerpo azul marino con paneles laterales blancos inclinados
  G.add(at(box(W - .2, 1.6, D - .3, M.navy()), 0, 1.06, -.05));
  [-1, 1].forEach(s => { const p = at(box(.45, 1.65, D - .25, M.offwhite()), s * (W / 2 - .3), 1.08, 0); G.add(p); });
  G.add(at(box(W - .8, .35, .05, M.navy()), 0, .45, D / 2 - .15));
  const pl = label('IN-CIRCUIT TEST', .9, .14, '#e8eef4'); pl.position.set(.5, 1.45, D / 2 - .19); G.add(pl);
  // Cubierta superior gris y zona del fixture inclinada
  const top = at(box(W - .1, .12, D, M.lgrey()), 0, 1.92, 0); G.add(top);
  const fx = new THREE.Group(); fx.position.set(0, 2.05, .05);
  fx.add(box(1.6, .14, 1.2, M.charcoal())); fx.add(at(box(1.45, .03, 1.05, mat(0xe6dcc0)), 0, .085, 0));
  const probes = new THREE.Group(); for (let i = 0; i < 70; i++) probes.add(at(cyl(.01, .01, .14, mat(0xd4af37, { metalness: .9, roughness: .2 }), 6), (i % 14 - 6.5) * .095, .15, (Math.floor(i / 14) - 2) * .18));
  fx.add(tag(probes, 'probes')); G.add(tag(fx, 'fixture')); tag(probes, 'probes'); P.fixture = fx; P.probes = probes;
  const brd = pcb(1.3, .9, 12, 11).g; brd.position.set(0, 2.32, .05); G.add(tag(brd, 'pcb')); P.pcb = brd;
  // Tapa de presión (lid) abierta con bisagra atrás → hace de "puerta"
  const lid = new THREE.Group(); lid.position.set(0, 2.15, -.6);
  const frame = at(box(1.6, .06, 1.25, M.steel()), 0, 0, .62); lid.add(frame); for (let i = 0; i < 6; i++) lid.add(at(box(.03, .05, 1.2, M.charcoal()), -.7 + i * .28, .03, .62));
  lid.rotation.x = -1.1; G.add(tag(lid, 'door')); P.door = lid;
  const vac = at(cyl(.15, .15, .4, M.grey()), W / 2 - .35, .5, -.6); G.add(tag(vac, 'vacuum')); P.vacuum = vac;
  const es = estop(); es.position.set(-.9, 1.7, D / 2 - .1); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  const il = at(box(.1, .1, .06, mat(0xffd43b)), .9, 1.98, D / 2 - .05); G.add(tag(il, 'interlock')); P.interlock = il;
  // Impresora a la izquierda y brazo con monitor y teclado a la derecha
  G.add(at(box(.6, .35, .55, M.offwhite()), -W / 2 - .15, 1.0, .35));
  const arm = new THREE.Group(); arm.add(at(box(.08, 1.2, .08, M.steel()), 0, .6, 0)); arm.add(at(box(1.0, .06, .08, M.steel()), .5, 1.2, 0));
  const mon = new THREE.Group(); mon.add(box(.7, .55, .45, M.offwhite())); mon.add(at(screen(.56, .42, 'ict'), 0, 0, .23)); mon.position.set(-.5, 1.6, 0); arm.add(mon);
  arm.add(at(box(.9, .04, .35, M.charcoal()), 1.1, 1.15, .3));
  arm.position.set(W / 2 - .3, 1.95, -.3); G.add(arm);
  const pc = at(box(.5, .6, .5, M.black()), -W / 2 + .5, .6, -D / 2 + .4); G.add(tag(pc, 'pc_ups')); P.pc_ups = pc;
  const tl = towerLight(.5); tl.g.position.set(-W / 2 + .3, 1.98, -D / 2 + .3); G.add(tag(tl.g, 'tower_light')); P.tower_light = tl.g; P.lamps = tl.lamps;
  const cal = at(box(.35, .04, .25, M.steel()), W / 2 - .5, 1.98, .7); G.add(tag(cal, 'calibration_target')); P.calibration_target = cal;
  back(G, P, W, D, .9);
  const pn = P.pneumatic; pn.position.set(-W / 2 - .05, .9, -.3);
  return { G, W, D, H };
}

// ---------- SPI Koh Young KY8030 ----------
function ky8030(P, color) {
  const G = new THREE.Group(); const W = 2.0, D = 2.43, H = 3.0, conv = 1.8; // KY8030 ≈ 1000 × 1215 × 1500 mm
  feet(G, W, D);
  G.add(at(box(W, H - .25, D, M.offwhite()), 0, .25 + (H - .25) / 2, 0));
  G.add(at(box(W - .5, 1.6, .05, M.lgrey()), .12, 1.05, D / 2 + .01)); // panel inferior gris
  const pcbay = at(box(W - .55, 1.5, .02, M.lgrey()), .12, 1.05, D / 2 + .04); G.add(tag(pcbay, 'pc_ups')); P.pc_ups = pcbay;
  // Columna izquierda blanca con botones
  G.add(at(box(.3, H - .35, .08, M.white()), -W / 2 + .15, .25 + (H - .35) / 2, D / 2 + .02));
  const es = estop(); es.position.set(-W / 2 + .15, 2.55, D / 2 + .07); G.add(tag(es, 'emergency_stop')); P.emergency_stop = es; P.mush = es.userData.mush;
  [[2.35, 0x36d07f], [2.22, 0xd62828], [2.0, 0x777777]].forEach(([y, c]) => G.add(at(cyl(.04, .04, .04, mat(c, { emissive: c, emissiveIntensity: .4 })), -W / 2 + .15, y, D / 2 + .08).rotateX(Math.PI / 2)));
  G.add(at(box(.18, .22, .06, mat(0xd62828)), -W / 2 + .15, 1.7, D / 2 + .07)); // interruptor principal
  const door = new THREE.Group(); door.position.set(.12, 2.85, D / 2 + .03);
  door.add(at(box(1.35, .85, .04, M.black()), 0, -.45, 0)); const sl = label('3D SPI', .45, .12, '#cfd6dd'); sl.position.set(-.35, -.18, .03); door.add(sl);
  G.add(tag(door, 'door')); P.door = door;
  G.add(at(box(W - .45, .04, .06, M.steel()), .12, 1.88, D / 2 + .03));
  [-1, 1].forEach(s => G.add(at(box(.04, .28, .9, M.black()), s * (W / 2 + .001), conv, 0)));
  const il = at(box(.1, .1, .06, mat(0xffd43b)), W / 2 - .3, 2.85, D / 2 + .03); G.add(tag(il, 'interlock')); P.interlock = il;
  G.add(inspectionInterior(P, W, D, conv, 'spi', color));
  const ws = workstation('spi', .3); ws.position.set(W / 2 + .45, 1.95, D / 2 - .1); ws.rotation.y = -.1; G.add(ws);
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
