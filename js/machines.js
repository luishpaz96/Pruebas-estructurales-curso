// Modelos 3D procedurales de las máquinas. Cada pieza lleva userData.part = PART_ID para poder hacer clic en ella.
import { THREE, box, cyl, at, mat, pcb } from './stage.js';

export const PART_NAMES = {
  door: 'Puerta / cubierta frontal', emergency_stop: 'Paro de emergencia', conveyor: 'Transportador', belt: 'Bandas del transportador',
  rail_width: 'Ajuste de ancho de riel', pcb: 'Tarjeta (PCB)', camera: 'Cámara / cabeza de imagen', projector: 'Proyectores',
  light_ring: 'Iluminación (anillo RGB)', xray_source: 'Tubo de rayos X', detector: 'Detector de rayos X', interlock: 'Interlocks de seguridad',
  fixture: 'Fixture (cama de agujas)', probes: 'Agujas / probes', vacuum: 'Sistema de vacío', pneumatic: 'Neumática (aire)',
  filter: 'Filtros', fan: 'Ventiladores', calibration_target: 'Placa / jig de calibración', pc_ups: 'PC y UPS', tower_light: 'Torre de luces', gantry: 'Gantry / mesa XY',
};
export const ACTION_NAMES = { inspect: 'Inspeccionar', clean: 'Limpiar', lubricate: 'Lubricar', replace: 'Reemplazar', calibrate: 'Calibrar', toggle: 'Accionar / bloquear', measure: 'Medir' };

function tag(o, part) { o.traverse(c => { c.userData.part = part; }); o.userData.part = part; return o; }

export function buildMachine(kind = 'aoi', color = '#3d8bff') {
  const G = new THREE.Group(); const P = {};
  const acc = new THREE.Color(color);
  const shell = mat(0xd9dee4, { roughness: .45, metalness: .3 });
  const dark = mat(0x2a3138, { roughness: .6 });
  const isICT = kind === 'ict';
  const W = isICT ? 3.2 : 3.6, H = isICT ? 1.6 : 2.2, D = 2.4, base = 0.9;

  // Base y gabinete
  G.add(at(box(W, base, D, dark), 0, base / 2, 0));
  const stripe = at(box(W + .01, .08, D + .01, mat(acc, { emissive: acc, emissiveIntensity: .35 })), 0, base - .05, 0); G.add(stripe);
  // Paredes laterales y techo (abiertas al frente para ver el interior)
  G.add(at(box(.08, H, D, shell), -W / 2 + .04, base + H / 2, 0));
  G.add(at(box(.08, H, D, shell), W / 2 - .04, base + H / 2, 0));
  G.add(at(box(W, H, .08, shell), 0, base + H / 2, -D / 2 + .04));
  G.add(at(box(W, .1, D, shell), 0, base + H, 0));
  if (kind === 'axi') { // blindaje de plomo más grueso
    G.add(at(box(W + .1, .14, D + .1, mat(0x8a929a, { metalness: .6 })), 0, base + H + .05, 0));
  }

  // Puerta frontal (pivote arriba)
  const doorPivot = new THREE.Group(); doorPivot.position.set(0, base + H, D / 2);
  const glass = new THREE.MeshStandardMaterial({ color: kind === 'axi' ? 0xffcc66 : 0x9fc6ff, transparent: true, opacity: kind === 'axi' ? .35 : .22, roughness: .1, metalness: .1 });
  const door = at(box(W - .1, H - .1, .05, glass), 0, -(H - .1) / 2, 0); doorPivot.add(door);
  doorPivot.add(at(box(W - .1, .08, .07, shell), 0, -.04, 0));
  doorPivot.add(at(box(.6, .06, .1, dark), 0, -H + .25, .05));
  G.add(tag(doorPivot, 'door')); P.door = doorPivot;
  // Interlock (sensor de puerta)
  const il = at(box(.12, .12, .08, mat(0xffd43b)), W / 2 - .2, base + H - .2, D / 2 - .05); G.add(tag(il, 'interlock')); P.interlock = il;

  // Transportador
  const conv = new THREE.Group();
  const railL = at(box(W + 1.2, .08, .08, mat(0x9aa3ac, { metalness: .7 })), 0, 0, -.45);
  const railR = at(box(W + 1.2, .08, .08, mat(0x9aa3ac, { metalness: .7 })), 0, 0, .45);
  conv.add(railL, railR);
  const belts = new THREE.Group();
  belts.add(at(box(W + 1.2, .02, .05, mat(0x111111)), 0, .05, -.42), at(box(W + 1.2, .02, .05, mat(0x111111)), 0, .05, .42));
  conv.add(tag(belts, 'belt')); P.belt = belts;
  conv.position.set(0, base + .25, 0); G.add(tag(conv, 'conveyor')); P.conveyor = conv; tag(belts, 'belt');
  const rw = at(box(.18, .25, .18, mat(0x4b5560)), W / 2 + .45, base + .3, .7); rw.add(at(cyl(.06, .06, .1, acc), 0, .17, 0)); G.add(tag(rw, 'rail_width')); P.rail_width = rw;
  const board = pcb(1.5, .85, 10, 7).g; board.position.set(-W / 2 - .3, base + .31, 0); G.add(tag(board, 'pcb')); P.pcb = board;

  // Gantry / cabeza según tipo
  if (kind === 'aoi' || kind === 'spi' || kind === 'generic') {
    const gan = new THREE.Group();
    gan.add(at(box(W - .3, .12, .16, mat(0x59636e, { metalness: .6 })), 0, 0, 0));
    G.add(tag(at(gan, 0, base + H - .45, 0), 'gantry')); P.gantry = gan;
    const head = new THREE.Group();
    head.add(at(box(.42, .5, .42, dark), 0, -.3, 0));
    const cam = at(cyl(.1, .1, .2, 0x101418), 0, -.62, 0); head.add(tag(cam, 'camera'));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 10, 32), mat(0xffffff, { emissive: 0x88ccff, emissiveIntensity: .8 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -.72; head.add(tag(ring, 'light_ring'));
    const projs = new THREE.Group();
    const nP = kind === 'spi' ? 2 : 4;
    for (let i = 0; i < nP; i++) {
      const a = i / nP * Math.PI * 2 + Math.PI / 4;
      const p = at(box(.12, .22, .12, mat(0x3b4650)), Math.cos(a) * .36, -.5, Math.sin(a) * .36);
      p.lookAt(0, -2, 0); p.add(at(cyl(.04, .04, .03, mat(acc, { emissive: acc, emissiveIntensity: 1 })), 0, 0, .07));
      projs.add(p);
    }
    head.add(tag(projs, 'projector'));
    gan.add(tag(head, 'camera')); tag(cam, 'camera'); tag(ring, 'light_ring'); tag(projs, 'projector');
    P.camera = head; P.light_ring = ring; P.projector = projs; P.head = head;
  }
  if (kind === 'axi') {
    const src = new THREE.Group();
    src.add(at(cyl(.2, .2, .7, mat(0x7c858e, { metalness: .7 })), 0, 0, 0));
    src.add(at(cyl(.12, .05, .2, mat(0xffb020, { emissive: 0xffb020, emissiveIntensity: .8 })), 0, .45, 0));
    src.add(at(box(.5, .12, .5, mat(0xffd43b)), 0, -.38, 0)); // símbolo de radiación (placa)
    G.add(tag(at(src, 0, base - .15, 0), 'xray_source')); P.xray_source = src;
    const det = new THREE.Group();
    det.add(at(box(1.1, .14, 1.1, mat(0x30363d, { metalness: .4 })), 0, 0, 0));
    det.add(at(box(.9, .02, .9, mat(0x4fd1ff, { emissive: 0x2a8fbf, emissiveIntensity: .6 })), 0, -.08, 0));
    G.add(tag(at(det, 0, base + H - .5, 0), 'detector')); P.detector = det;
  }
  if (isICT) {
    const fx = new THREE.Group();
    fx.add(at(box(2.2, .18, 1.5, mat(0x2a2a2a)), 0, 0, 0));
    fx.add(at(box(2, .04, 1.3, mat(0xe6dcc0)), 0, .11, 0));
    const probes = new THREE.Group();
    for (let i = 0; i < 90; i++) { const p = at(cyl(.012, .012, .22, mat(0xd4af37, { metalness: .9, roughness: .2 }), 6), (i % 15 - 7) * .12, .22, (Math.floor(i / 15) - 2.5) * .18); probes.add(p); }
    fx.add(tag(probes, 'probes'));
    G.add(tag(at(fx, 0, base + .1, 0), 'fixture')); P.fixture = fx; P.probes = probes; tag(probes, 'probes');
    board.position.set(0, base + .65, 0);
    const vac = at(cyl(.18, .18, .4, mat(0x5b6670)), W / 2 - .45, base + .3, -.7); vac.add(at(cyl(.05, .05, .3, 0x222), .2, 0, 0)); G.add(tag(vac, 'vacuum')); P.vacuum = vac;
  }
  // Neumática (regulador de aire con manómetro)
  const pn = new THREE.Group(); pn.add(at(cyl(.08, .08, .3, mat(0x9aa3ac, { metalness: .7 })), 0, 0, 0)); pn.add(at(cyl(.09, .09, .03, mat(0xffffff)), 0, .05, .09).rotateX(Math.PI / 2));
  G.add(tag(at(pn, -W / 2 - .12, base - .3, .6), 'pneumatic')); P.pneumatic = pn;
  // Filtros y ventiladores (parte trasera / lateral)
  const fl = at(box(.05, .5, .7, mat(0x8fa3b5, { roughness: .9 })), W / 2 + .03, base / 2, -.4); G.add(tag(fl, 'filter')); P.filter = fl;
  const fan = new THREE.Group(); fan.add(new THREE.Mesh(new THREE.TorusGeometry(.18, .03, 8, 24), mat(0x30363d)));
  const blades = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = box(.04, .15, .01, mat(0x6b7480)); b.position.y = .08; const h = new THREE.Group(); h.add(b); h.rotation.z = i * Math.PI * 2 / 5; blades.add(h); }
  fan.add(blades); fan.rotation.y = Math.PI / 2; G.add(tag(at(fan, W / 2 + .03, base / 2, .5), 'fan')); P.fan = fan; P.blades = blades;
  // Paro de emergencia
  const es = new THREE.Group(); es.add(at(box(.22, .22, .08, mat(0xffd43b)), 0, 0, 0));
  const mush = at(cyl(.08, .09, .08, mat(0xe03131, { emissive: 0x550000 })), 0, 0, .07); mush.rotation.x = Math.PI / 2; es.add(mush);
  G.add(tag(at(es, -W / 2 + .3, base - .2, D / 2 + .05), 'emergency_stop')); P.emergency_stop = es; P.mush = mush;
  // Torre de luces
  const tw = new THREE.Group(); tw.add(at(cyl(.03, .03, .4, mat(0x888888)), 0, .2, 0));
  const lamps = [0xff3b30, 0xffb020, 0x36d07f].map((c, i) => { const l = at(cyl(.08, .08, .14, mat(c, { emissive: c, emissiveIntensity: i === 2 ? 1 : .1, transparent: true, opacity: .9 })), 0, .45 + (2 - i) * .15, 0); tw.add(l); return l; });
  G.add(tag(at(tw, W / 2 - .3, base + H + .05, -D / 2 + .3), 'tower_light')); P.tower_light = tw; P.lamps = lamps;
  // PC / UPS y monitor
  const pc = new THREE.Group(); pc.add(at(box(.6, .7, .5, mat(0x1d2228)), 0, .35, 0)); pc.add(at(box(.5, .3, .45, mat(0x3a3f46)), 0, .85, 0));
  G.add(tag(at(pc, -W / 2 - .8, 0, -.6), 'pc_ups')); P.pc_ups = pc;
  const mon = new THREE.Group(); mon.add(at(box(.9, .55, .05, mat(0x0d0f12)), 0, 0, 0));
  const scr = at(new THREE.Mesh(new THREE.PlaneGeometry(.84, .49), new THREE.MeshBasicMaterial({ color: acc.clone().multiplyScalar(.5) })), 0, 0, .03); mon.add(scr);
  mon.add(at(box(.06, .5, .06, mat(0x444)), 0, -.5, -.05));
  G.add(at(mon, W / 2 + .2, base + H * .55 + .3, D / 2 + .25)); mon.rotation.y = -.5;
  // Placa de calibración (dentro, sobre el transportador)
  const cal = new THREE.Group(); cal.add(box(.5, .03, .4, mat(0xcfd6dd, { metalness: .8, roughness: .2 })));
  for (let i = 0; i < 9; i++) cal.add(at(cyl(.025, .025, .01, 0x111111, 12), (i % 3 - 1) * .14, .02, (Math.floor(i / 3) - 1) * .11));
  G.add(tag(at(cal, W / 2 - .7, base + .3, 0), 'calibration_target')); P.calibration_target = cal;

  // Ajuste: piezas con userData.part tienen prioridad al hacer clic (el padre más cercano con part)
  return { group: G, parts: P, dims: { W, H, D, base } };
}

// Animaciones de estado de la máquina
export function animateMachine(m, t, kind) {
  const P = m.parts;
  if (P.blades) P.blades.rotation.z = t * 8;
  if (P.head && !m.frozen) { P.head.position.x = Math.sin(t * .6) * (m.dims.W / 2 - .6); P.head.position.z = Math.cos(t * .9) * .3; }
  if (P.lamps && !m.frozen) P.lamps.forEach((l, i) => l.material.emissiveIntensity = i === 2 ? (.6 + .4 * Math.sin(t * 3)) : .08);
}

// Resaltado de pieza (emisivo)
export function highlight(obj, on, color = 0x3d8bff) {
  obj?.traverse(c => {
    if (!c.material || c.material.isMeshBasicMaterial) return;
    if (on) { if (c.userData._em === undefined) { c.userData._em = c.material.emissive?.getHex() ?? 0; c.userData._ei = c.material.emissiveIntensity; c.material = c.material.clone(); } c.material.emissive?.setHex(color); c.material.emissiveIntensity = .6; }
    else if (c.userData._em !== undefined) { c.material.emissive?.setHex(c.userData._em); c.material.emissiveIntensity = c.userData._ei; }
  });
}

// Busca la pieza clicada subiendo por la jerarquía
export function pick(st, ev, root) {
  const r = st.renderer.domElement.getBoundingClientRect();
  const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(v, st.camera);
  const hits = rc.intersectObject(root, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.part) o = o.parent; if (o) return { part: o.userData.part, obj: o }; }
  return null;
}
