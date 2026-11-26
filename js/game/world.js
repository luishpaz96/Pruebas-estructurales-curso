// Mundo 3D del juego: nave industrial con la línea SMT completa, área de pruebas, personajes y tarjetas en movimiento.
import { THREE, box, rbox, cyl, at, mat, pcb } from '../stage.js';
import { buildReal, lineMachine } from '../models.js';
import { animateMachine } from '../machines.js';

// Posiciones (1 u = 0.5 m). Línea 1 en z = 0, frente de máquinas hacia +z.
export const LAYOUT = {
  line1: [
    { id: 'loader', type: 'loader', x: -41 }, { id: 'printer', type: 'printer', x: -36.5 }, { id: 'spi', real: 'ky8030', x: -32, station: true, name: 'SPI 3D', color: '#a77bff' },
    { id: 'mounter1', type: 'mounter', x: -27.5 }, { id: 'mounter2', type: 'mounter', x: -23.5 }, { id: 'reflow', type: 'reflow', x: -14.5 },
    { id: 'aoi', real: 'zenith', x: -6.5, station: true, name: 'AOI 3D', color: '#3d8bff' }, { id: 'buffer', type: 'buffer', x: -3.5 },
    { id: 'axi', real: 'v810', x: 1.5, station: true, name: 'AXI 3D', color: '#ffb020' }, { id: 'unloader', type: 'unloader', x: 6.5 },
  ],
  aoi2: { x: -6.5, z: -15, real: 'v510', name: 'AOI línea 2', color: '#19c3a6' },
  ict: { x: 4, z: 14, real: 'hp3070', name: 'ICT', color: '#ff5a5f' },
  rework: { x: 11, z: 14 },
  mentor: { x: -12, z: 13 },
  prod: { x: -30, z: 7 },
  quality: { x: 16, z: 6 },
};

function signSprite(text, color = '#3d8bff', w = 3) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = 'rgba(12,16,20,.88)'; x.beginPath(); x.roundRect(6, 6, 500, 148, 24); x.fill();
  x.strokeStyle = color; x.lineWidth = 8; x.stroke();
  x.fillStyle = '#fff'; x.font = '700 84px Rajdhani, Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(w, w * 160 / 512, 1); s.renderOrder = 5; return s;
}

// Personaje estilizado: bata ESD, lentes, gafete. Devuelve grupo y función de animación de caminata.
export function character({ coat = 0x2f6fd6, skin = 0xd9a77c, hair = 0x2b1d14, glasses = false, helmet = false, vest = 0, cap = 0 } = {}) {
  const g = new THREE.Group(); const M = c => mat(c, { roughness: .7 });
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  for (const L of [legL, legR]) { L.add(at(rbox(.28, 1.2, .3, M(0x1d2733), .1), 0, -.6, 0)); L.add(at(rbox(.32, .16, .5, M(0x161616), .06), 0, -1.2, .08)); }
  legL.position.set(-.18, 1.3, 0); legR.position.set(.18, 1.3, 0); g.add(legL, legR);
  const torso = at(rbox(.8, 1.1, .46, M(coat), .16), 0, 1.85, 0); g.add(torso);
  g.add(at(rbox(.84, .55, .48, M(coat), .12), 0, 1.22, 0)); // faldón de la bata
  g.add(at(rbox(.42, .14, .48, M(0xffffff), .06), 0, 2.36, 0)); // cuello de la camisa
  g.add(at(box(.05, .9, .02, M(0xdfe6ec)), 0, 1.6, .235)); // botonadura
  for (let i = 0; i < 4; i++) g.add(at(cyl(.025, .025, .02, M(0x999999), 8).rotateX(Math.PI / 2), .04, 2.15 - i * .22, .24));
  g.add(at(box(.17, .22, .02, M(0xffffff)), .22, 2.02, .24)); g.add(at(box(.13, .05, .022, M(0x3d8bff)), .22, 2.09, .245)); // gafete
  for (const [A, sx] of [[armL, -1], [armR, 1]]) { A.add(at(rbox(.22, 1.0, .25, M(coat), .09), 0, -.5, 0)); A.add(at(rbox(.23, .1, .26, M(0x2a2a2a), .04), 0, -.98, 0)); // puño ESD
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), M(skin)); hand.scale.set(1, 1.15, .9); A.add(at(hand, 0, -1.12, 0)); }
  armL.position.set(-.52, 2.3, 0); armR.position.set(.52, 2.3, 0); g.add(armL, armR);
  g.add(at(cyl(.12, .14, .16, M(skin), 12), 0, 2.45, 0)); // cuello
  const head = at(rbox(.5, .56, .5, M(skin), .18), 0, 2.74, 0); g.add(head);
  head.add(at(rbox(.53, .12, .53, M(hair), .05), 0, .26, -.01), at(rbox(.53, .34, .1, M(hair), .04), 0, .08, -.22), at(rbox(.53, .1, .1, M(hair), .04), 0, .2, .22));
  head.add(at(new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M(skin)), 0, -.04, .27)); // nariz
  [-1, 1].forEach(sx => head.add(at(new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), M(skin)), sx * .26, 0, 0))); // orejas
  head.add(at(box(.07, .08, .02, M(0x111111)), -.12, .05, .255), at(box(.07, .08, .02, M(0x111111)), .12, .05, .255));
  head.add(at(box(.14, .025, .02, M(0x7a4a32)), 0, -.15, .255)); // boca
  if (glasses) { const gm = mat(0x222222); head.add(at(box(.18, .12, .02, gm), -.12, .04, .27), at(box(.18, .12, .02, gm), .12, .04, .27), at(box(.08, .03, .02, gm), 0, .06, .27)); }
  if (helmet) head.add(at(cyl(.32, .34, .2, mat(0xffd43b), 16), 0, .32, 0));
  if (vest) { g.add(at(box(.84, .7, .5, M(vest)), 0, 2.0, 0)); g.add(at(box(.86, .06, .52, M(0xdfe6ec)), 0, 1.86, 0)); }
  if (cap) head.add(at(box(.54, .14, .54, M(cap)), 0, .3, 0), at(box(.4, .04, .22, M(cap)), 0, .24, .34));
  // Lo que carga en las manos (tarjeta, magazín, caja de herramientas)
  const hold = new THREE.Group(); hold.position.set(0, 1.75, .55); g.add(hold);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  let ph = 0;
  const walk = (dt, moving) => {
    ph += dt * (moving ? 9 : 0);
    const a = moving ? Math.sin(ph) * .6 : 0;
    legL.rotation.x = a; legR.rotation.x = -a; armL.rotation.x = -a * .8; armR.rotation.x = a * .8;
    torso.position.y = 1.85 + (moving ? Math.abs(Math.sin(ph)) * .05 : 0);
    if (!moving) { armL.rotation.x *= .8; }
    if (hold.children.length) { armL.rotation.x = armR.rotation.x = -1.1; }
    else if (work) { const w = Math.sin(ph2 += dt * 7); armL.rotation.x = -1 + w * .15; armR.rotation.x = -1 - w * .15; }
  };
  let ph2 = 0, work = false;
  return { g, walk, head, hold, armL, armR, setWork: v => { work = v; } };
}

export function buildWorld(st) {
  const S = st.scene; const updaters = []; const colliders = []; const stations = {};
  st.floor.visible = false; st.grid.visible = false;
  S.fog = new THREE.Fog(0x141a20, 55, 120);
  if (st.sun) { st.sun.position.set(-8, 60, 14); st.sun.intensity = 1.9; st.sun.shadow.mapSize.set(2048, 2048); Object.assign(st.sun.shadow.camera, { left: -55, right: 55, top: 35, bottom: -35, near: 1, far: 120 }); st.sun.shadow.camera.updateProjectionMatrix(); st.sun.shadow.bias = -.0008; st.sun.shadow.normalBias = .05; }
  st.scene.environmentIntensity = .75;
  // Piso epóxico, pasillos amarillos y zona ESD
  const ft = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.fillStyle = '#6b7872'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const v = 100 + Math.random() * 30 | 0; x.fillStyle = `rgba(${v},${v + 12},${v + 6},.18)`; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    x.strokeStyle = 'rgba(30,36,34,.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(110 / 8, 60 / 8); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(110, 60), new THREE.MeshPhysicalMaterial({ map: ft, roughness: .45, metalness: .0, clearcoat: .6, clearcoatRoughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; S.add(floor);
  const lane = (x1, z1, x2, z2) => { const w = Math.abs(x2 - x1) || .15, d = Math.abs(z2 - z1) || .15; S.add(at(new THREE.Mesh(new THREE.BoxGeometry(w, .01, d), new THREE.MeshBasicMaterial({ color: 0xf2c200 })), (x1 + x2) / 2, .006, (z1 + z2) / 2)); };
  lane(-46, 4.2, 12, 4.2); lane(-46, -4.2, 12, -4.2); lane(-46, 9.5, 18, 9.5); lane(-12, -10.5, 2, -10.5);
  const esd = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), mat(0x2b6f8a, { roughness: .9 })); esd.rotation.x = -Math.PI / 2; esd.position.set(0, .004, 14.5); S.add(esd);
  // Paredes y columnas
  const wallM = mat(0xc9cfd4, { roughness: .9 });
  S.add(at(box(110, 10, .5, wallM), 0, 5, -27)); S.add(at(box(.5, 10, 60, wallM), -55, 5, 0)); S.add(at(box(.5, 10, 60, wallM), 55, 5, 0));
  for (let x = -40; x <= 40; x += 20) for (const z of [-9, 9.5]) { if (z > 0 && x > -15 && x < 15) continue; const c = at(box(.8, 10, .8, mat(0x8d949b)), x, 5, z === 9.5 ? 20 : -21); S.add(c); }
  // Paneles de pared, ventanas altas y armaduras del techo
  for (let x = -54; x <= 54; x += 6) S.add(at(box(.08, 10, .06, mat(0x9aa2a8)), x, 5, -26.7));
  S.add(at(box(108, 1.6, .05, new THREE.MeshBasicMaterial({ color: 0xbfd6f2 })), 0, 9.2, -26.7));
  S.add(at(box(110, .6, .3, mat(0xf2c200)), 0, .3, -26.6)); // guardapolvo amarillo
  for (let x = -50; x <= 50; x += 10) { S.add(at(box(.4, .6, 60, mat(0x59626b, { metalness: .6, roughness: .4 })), x, 18, 0)); }
  for (const z of [-20, 0, 20]) S.add(at(box(110, .3, .3, mat(0x59626b, { metalness: .6, roughness: .4 })), 0, 17.6, z));
  // Ductos de aire y extracción del horno
  S.add(at(cyl(.6, .6, 60, mat(0xb8bec4, { metalness: .8, roughness: .3 }), 20).rotateX(Math.PI / 2), 30, 15.5, 0));
  [-17, -12].forEach(x => S.add(at(cyl(.3, .3, 12, mat(0xb8bec4, { metalness: .8, roughness: .3 }), 16), x, 9, 0)));
  S.children.forEach(o => { if (o.position.y > 7 || Math.abs(o.position.z) > 26 || Math.abs(o.position.x) > 53) o.castShadow = false; });
  const banner = signSprite('Área de pruebas · AOI · AXI · ICT', '#ffb020', 12); banner.position.set(0, 8.5, -26.5); S.add(banner);
  // Lámparas de techo
  for (let x = -40; x <= 20; x += 10) for (const z of [0, 14, -15]) { const l = at(box(4, .1, .6, new THREE.MeshBasicMaterial({ color: 0xf4f7ff })), x, 17, z); S.add(l); }
  S.children.forEach(o => { if (o.position.y > 7) o.castShadow = false; });

  // Riel continuo de la línea 1
  S.add(at(box(52, .05, .05, mat(0xaab1b8, { metalness: .8 })), -17.5, 1.78, -.42), at(box(52, .05, .05, mat(0xaab1b8, { metalness: .8 })), -17.5, 1.78, .42));
  const machines = [];
  for (const m of LAYOUT.line1) {
    let obj;
    if (m.real) { obj = buildReal(m.real, m.color); obj.anim = [t => animateMachine(obj, t)]; obj.W = obj.dims.W; obj.D = obj.dims.D; }
    else { obj = lineMachine(m.type); }
    obj.group.position.set(m.x, 0, 0); S.add(obj.group); machines.push({ ...m, obj });
    colliders.push({ x0: m.x - obj.W / 2 - .2, x1: m.x + obj.W / 2 + .2, z0: -obj.D / 2 - .4, z1: obj.D / 2 + .4 });
    if (m.station) { stations[m.id] = { id: m.id, name: m.name, color: m.color, pos: new THREE.Vector3(m.x, 0, obj.D / 2 + 1.8), obj, inline: true }; }
    const sign = signSprite(m.name || { loader: 'Loader', printer: 'Impresora', mounter: 'Pick & Place', reflow: 'Horno', buffer: 'Buffer', unloader: 'Unloader' }[m.type] || '', m.color || '#9aa7b8', m.station ? 3.2 : 2.4);
    sign.position.set(m.x, (obj.H || 3) + 1.6, 0); S.add(sign);
  }
  // Línea 2 con el AOI V510
  { const L = LAYOUT.aoi2; const obj = buildReal(L.real, L.color); obj.anim = [t => animateMachine(obj, t)]; obj.group.position.set(L.x, 0, L.z); S.add(obj.group);
    S.add(at(box(14, .05, .9, mat(0x444b52)), L.x, 1.78, L.z));
    colliders.push({ x0: L.x - obj.dims.W / 2 - .2, x1: L.x + obj.dims.W / 2 + .2, z0: L.z - obj.dims.D / 2 - .4, z1: L.z + obj.dims.D / 2 + .4 });
    stations.aoi2 = { id: 'aoi2', name: L.name, color: L.color, pos: new THREE.Vector3(L.x, 0, L.z + obj.dims.D / 2 + 1.8), obj, inline: false };
    const s = signSprite('AOI · Línea 2', L.color, 3.2); s.position.set(L.x, 4.6, L.z); S.add(s); machines.push({ id: 'aoi2', obj }); }
  // ICT HP3070 fuera de línea, frente hacia la línea (-z)
  { const L = LAYOUT.ict; const obj = buildReal(L.real, L.color); obj.anim = [t => animateMachine(obj, t)]; obj.group.position.set(L.x, 0, L.z); obj.group.rotation.y = Math.PI; S.add(obj.group);
    colliders.push({ x0: L.x - obj.dims.W / 2 - .6, x1: L.x + obj.dims.W / 2 + .9, z0: L.z - obj.dims.D / 2 - .4, z1: L.z + obj.dims.D / 2 + .4 });
    stations.ict = { id: 'ict', name: 'ICT', color: L.color, pos: new THREE.Vector3(L.x, 0, L.z - obj.dims.D / 2 - 1.8), obj, inline: false };
    const s = signSprite('ICT · HP3070', L.color, 3.2); s.position.set(L.x, 4.6, L.z); S.add(s); machines.push({ id: 'ict', obj });
    // Carro de fixturas
    const cart = new THREE.Group(); cart.add(at(box(2, .1, 1.2, mat(0x6b7480)), 0, .6, 0), at(box(2, .1, 1.2, mat(0x6b7480)), 0, 1.4, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cart.add(at(box(.06, 1.5, .06, mat(0xaab1b8)), a * .95, .75, b * .55)));
    cart.add(at(box(1.6, .3, 1, mat(0x2a2a2a)), 0, .8, 0), at(box(1.6, .3, 1, mat(0x2a2a2a)), 0, 1.6, 0)); cart.position.set(L.x - 4.5, 0, L.z); S.add(cart);
    colliders.push({ x0: L.x - 5.7, x1: L.x - 3.3, z0: L.z - .8, z1: L.z + .8 });
    const cs = signSprite('Fixturas', '#9aa7b8', 1.8); cs.position.set(L.x - 4.5, 2.6, L.z); S.add(cs); }
  // Banco de reparación
  { const L = LAYOUT.rework; const obj = lineMachine('rework'); obj.group.position.set(L.x, 0, L.z); obj.group.rotation.y = Math.PI; S.add(obj.group); colliders.push({ x0: L.x - 1.7, x1: L.x + 1.7, z0: L.z - 1, z1: L.z + 1 });
    const s = signSprite('Reparación', '#36d07f', 2.4); s.position.set(L.x, 3.2, L.z); S.add(s); }
  // Oficina del ingeniero: escritorio, monitor y pizarrón
  { const L = LAYOUT.mentor; const desk = new THREE.Group(); desk.add(at(box(3, .1, 1.4, mat(0x8a6a4a)), 0, 1.5, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => desk.add(at(box(.08, 1.5, .08, mat(0x333)), a * 1.4, .75, b * .6)));
    desk.add(at(box(1, .6, .05, mat(0x111)), 0, 2.0, -.4)); desk.position.set(L.x, 0, L.z + 1.5); S.add(desk);
    const board = at(box(5, 2.6, .1, mat(0xf4f6f8)), L.x, 3, L.z + 4.5); S.add(board);
    const s = signSprite('Ing. de pruebas', '#ffb020', 3); s.position.set(L.x, 5, L.z + 2); S.add(s);
    colliders.push({ x0: L.x - 1.7, x1: L.x + 1.7, z0: L.z + .7, z1: L.z + 2.3 });
    stations.mentor = { id: 'mentor', name: 'Ingeniero de pruebas', color: '#ffb020', pos: new THREE.Vector3(L.x, 0, L.z - 1.2), inline: false }; }
  // Supervisora de manufactura (chaleco naranja, con su pizarrón de producción) y la ingeniera de calidad
  const npcs = {};
  for (const [id, o] of Object.entries({ prod: { coat: 0xff7a45, hair: 0x5a3220, label: 'Manufactura', col: '#ff7a45' }, quality: { coat: 0x36d07f, hair: 0x1a1a1a, glasses: true, label: 'Calidad', col: '#36d07f' } })) {
    const L = LAYOUT[id]; const c = character({ coat: o.coat, hair: o.hair, glasses: o.glasses }); c.g.position.set(L.x, 0, L.z); c.g.rotation.y = Math.PI; S.add(c.g); npcs[id] = c;
    const pod = at(box(1.2, 1.6, .8, mat(0x2a3440)), L.x + 1.4, .8, L.z + .6); S.add(pod); const scr = at(box(1.6, 1.1, .06, mat(0x0c1a26, { emissive: 0x0d3a5a })), L.x + 1.4, 2.4, L.z + 1); S.add(scr);
    const s = signSprite(o.label, o.col, 2.6); s.position.set(L.x, 4, L.z); S.add(s);
    colliders.push({ x0: L.x - .6, x1: L.x + 2.1, z0: L.z - .6, z1: L.z + 1.1 });
    stations[id] = { id, name: o.label, color: o.col, pos: new THREE.Vector3(L.x, 0, L.z - 1.6), inline: false };
  }
  updaters.push(t => Object.values(npcs).forEach((c, i) => { c.head.rotation.y = Math.sin(t * .6 + i * 2) * .45; }));
  // Mentor (NPC) y operadores
  const mentor = character({ coat: 0xf2f4f6, glasses: true, hair: 0x3b3b3b }); mentor.g.position.set(LAYOUT.mentor.x, 0, LAYOUT.mentor.z); mentor.g.rotation.y = Math.PI; S.add(mentor.g);
  updaters.push((t, dt) => { mentor.head.rotation.y = Math.sin(t * .7) * .4; });
  const ops = [[-36.5, 3.2], [-25.5, 3.2], [-14.5, 3.2]].map(([x, z]) => { const c = character({ coat: 0x36a3d6, hair: 0x1a1a1a }); c.g.position.set(x, 0, z); c.g.rotation.y = Math.PI; S.add(c.g); colliders.push({ x0: x - .6, x1: x + .6, z0: z - .6, z1: z + .6 }); return c; });
  updaters.push(t => ops.forEach((o, i) => { o.head.rotation.y = Math.sin(t * .5 + i) * .5; }));
  colliders.push({ x0: LAYOUT.mentor.x - .6, x1: LAYOUT.mentor.x + .6, z0: LAYOUT.mentor.z - .6, z1: LAYOUT.mentor.z + .6 });
  // Animaciones de las máquinas de línea
  updaters.push((t, dt) => machines.forEach(m => (m.obj.anim || []).forEach(f => f(t, dt))));
  return { updaters, colliders, stations, machines, mentor, floor };
}

// Tarjetas que viajan por la línea 1
export function boardFlow(S) {
  const pool = []; const geo = new THREE.BoxGeometry(1.1, .05, .75);
  const mGood = mat(0x1f6b3a), mNG = mat(0xff5a5f, { emissive: 0x661111 });
  return {
    spawn() { const m = new THREE.Mesh(geo, mGood); m.castShadow = true; m.position.set(-42, 1.86, 0); m.userData = { aoi: false, axi: false, ng: false }; S.add(m); pool.push(m); return m; },
    update(dt, running, onPass) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const b = pool[i]; if (!running) continue;
        const prev = b.position.x; b.position.x += dt * 2.2;
        for (const [k, x] of [['spi', -32], ['aoi', -6.5], ['axi', 1.5]]) if (prev < x && b.position.x >= x) onPass(k, b);
        if (b.position.x > 8) { onPass('out', b); S.remove(b); pool.splice(i, 1); }
      }
    },
    markNG(b) { b.material = mNG; b.userData.ng = true; },
    count: () => pool.length,
  };
}
