// Animaciones 3D de las lecciones. Cada escena recibe el escenario (st) y devuelve una lista de pasos [segundo, texto]
// que se muestran como subtítulo. Para agregar una animación nueva: añade una función aquí y su id en tools/build_content.py.
import { THREE, box, cyl, at, mat, pcb } from './stage.js';
import { buildMachine, animateMachine, PART_NAMES, highlight } from './machines.js';

const lerp = (a, b, k) => a + (b - a) * k;
const cycle = (t, len) => (t % len) / len;

function fringeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 8; const x = c.getContext('2d');
  for (let i = 0; i < 256; i++) { const v = 128 + 127 * Math.sin(i / 256 * Math.PI * 2 * 8); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, 0, 1, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export const SCENES = {
  intro_line(st) {
    const names = ['Impresora de pasta', 'SPI', 'Pick & Place', 'Horno reflujo', 'AOI', 'AXI', 'ICT'];
    const cols = [0x6b7480, 0xa77bff, 0x6b7480, 0xd9480f, 0x3d8bff, 0xffb020, 0xff5a5f];
    const xs = names.map((_, i) => (i - 3) * 2.2);
    names.forEach((n, i) => {
      const m = at(box(1.5, 1.2, 1.4, mat(0xd0d6dc)), xs[i], .6, 0); m.add(at(box(1.52, .12, 1.42, mat(cols[i], { emissive: cols[i], emissiveIntensity: .4 })), 0, .2, 0));
      st.scene.add(m); st.label(m, n, [0, 1, 0]);
    });
    st.scene.add(at(box(16, .05, .6, mat(0x333a42)), 0, .5, 1.1));
    const boards = Array.from({ length: 5 }, (_, i) => { const b = pcb(.7, .45, 6, i + 2).g; st.scene.add(b); return b; });
    st.camera.position.set(0, 4.2, 9); st.controls.target.set(0, .6, 0);
    st.onFrame(t => boards.forEach((b, i) => { const k = cycle(t + i * 3.2, 16); b.position.set(lerp(-8, 8, k), .56, 1.1); }));
    return [[0, 'La tarjeta recorre la línea SMT de izquierda a derecha'], [3, 'SPI mide la pasta antes de colocar componentes'], [7, 'AOI revisa presencia, polaridad y soldadura visible'], [10, 'AXI ve juntas ocultas (BGA, QFN) con rayos X'], [13, 'ICT prueba eléctricamente con cama de agujas']];
  },

  moire_fringes(st) {
    const { g } = pcb(3, 2, 16, 4); st.scene.add(g);
    const tex = fringeTexture(); tex.repeat.set(3, 1);
    const plane = at(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })), 0, .14, 0);
    plane.rotation.x = -Math.PI / 2; st.scene.add(plane);
    const head = at(box(.6, .5, .6, mat(0x2a3138)), 0, 3, 0); st.scene.add(head); st.label(head, 'Cámara', [0, .4, 0]);
    const projs = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4; const p = at(box(.2, .3, .2, mat(0x3d8bff, { emissive: 0x3d8bff, emissiveIntensity: .8 })), Math.cos(a) * 1.5, 2.6, Math.sin(a) * 1.5); p.lookAt(0, 0, 0); st.scene.add(p); return p; });
    st.label(projs[0], 'Proyector de franjas', [0, .3, 0]);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.5, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0x3d8bff, transparent: true, opacity: .08, side: THREE.DoubleSide, depthWrite: false }));
    cone.rotation.y = Math.PI / 4; st.scene.add(at(cone, 0, 1.4, 0));
    // Mapa de alturas: columnas que crecen
    const bars = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { const h = Math.max(.02, Math.sin(i * .7) * Math.cos(j * .9) * .4 + .2); const b = at(box(.12, 1, .12, mat(new THREE.Color().setHSL(.66 - h * 1.2, .9, .5))), 3.2 + i * .14, 0, -0.5 + j * .14); b.userData.h = h; b.scale.y = .001; st.scene.add(b); bars.push(b); }
    st.label(bars[40], 'Mapa de alturas 3D', [0, .9, 0]);
    st.camera.position.set(5, 4.5, 6); st.controls.target.set(1.4, .4, 0);
    st.onFrame(t => {
      const k = Math.floor(t / 2) % 4; tex.offset.x = t * .25; plane.rotation.z = k * Math.PI / 2;
      projs.forEach((p, i) => p.material.emissiveIntensity = i === k ? 2 : .2);
      const grow = Math.min(1, (t % 12) / 8); bars.forEach(b => { b.scale.y = Math.max(.001, b.userData.h * grow); b.position.y = b.scale.y / 2; });
    });
    return [[0, 'Cada proyector lanza franjas sinusoidales sobre la tarjeta'], [3, 'La franja se desplaza (cambio de fase); la cámara capta la deformación'], [6, 'Varios proyectores eliminan sombras de componentes altos'], [8, 'La fase se convierte en altura: nace el mapa 3D']];
  },

  xray_tomo(st) {
    const src = at(cyl(.25, .25, .6, mat(0x7c858e, { metalness: .7 })), 0, .4, 0); st.scene.add(src); st.label(src, 'Tubo de rayos X', [0, -.5, 0]);
    const board = pcb(2.4, 1.6, 8, 9).g; board.position.y = 2; st.scene.add(board);
    const bga = at(box(.8, .08, .8, mat(0x22262b)), 0, 2.14, 0); st.scene.add(bga); st.label(bga, 'BGA', [0, .2, 0]);
    const balls = []; for (let i = 0; i < 36; i++) { const b = at(new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), mat(0xc0c6cc, { metalness: .9 })), (i % 6 - 2.5) * .12, 2.07, (Math.floor(i / 6) - 2.5) * .12); if (i === 14) b.material = mat(0xff5a5f, { emissive: 0x661111 }); st.scene.add(b); balls.push(b); }
    const det = at(box(1.6, .12, 1.6, mat(0x30363d)), 0, 4, 0); st.scene.add(det); st.label(det, 'Detector (gira)', [0, .3, 0]);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 3.5, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.x = Math.PI; st.scene.add(beam);
    const slices = [0, 1, 2].map(i => { const s = at(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: [0x4fd1ff, 0xffb020, 0x36d07f][i], transparent: true, opacity: 0, side: THREE.DoubleSide })), 3.2, 1.6 + i * .5, 0); s.rotation.x = -Math.PI / 2; st.scene.add(s); return s; });
    st.label(slices[1], 'Cortes de laminografía', [0, .3, 0]);
    st.camera.position.set(5, 4, 6); st.controls.target.set(.8, 2.2, 0);
    st.onFrame(t => {
      const a = t * .8; det.position.set(Math.cos(a) * 1.2, 4, Math.sin(a) * 1.2); det.lookAt(0, 8, 0);
      beam.position.set(det.position.x / 2, 2.2, det.position.z / 2); beam.lookAt(det.position); beam.rotateX(-Math.PI / 2);
      slices.forEach((s, i) => s.material.opacity = Math.max(0, Math.min(.6, (t % 12) / 3 - i)));
      balls[14].scale.setScalar(1 + .2 * Math.sin(t * 5));
    });
    return [[0, 'El tubo emite rayos X que atraviesan la tarjeta'], [3, 'El detector gira y toma imágenes desde varios ángulos'], [6, 'La laminografía reconstruye cortes a distintas alturas'], [9, 'En el corte de las bolas se ve el defecto: puente o voids en el BGA']];
  },

  ict_bed_of_nails(st) {
    const fx = at(box(3, .3, 2, mat(0x2a2a2a)), 0, .15, 0); st.scene.add(fx); st.label(fx, 'Fixture', [1.6, 0, 0]);
    const probes = []; for (let i = 0; i < 60; i++) { const p = at(cyl(.02, .02, .5, mat(0xd4af37, { metalness: .9 }), 6), (i % 10 - 4.5) * .25, .45, (Math.floor(i / 10) - 2.5) * .28); st.scene.add(p); probes.push(p); }
    st.label(probes[25], 'Agujas (probes)', [0, .4, 0]);
    const { g } = pcb(2.8, 1.8, 14, 11); st.scene.add(g); st.label(g, 'Tarjeta', [0, .3, 0]);
    const plate = at(box(3, .1, 2, mat(0x5b6670, { transparent: true, opacity: .6 })), 0, 2.8, 0); st.scene.add(plate); st.label(plate, 'Vacío / placa de presión', [0, .2, 0]);
    const sig = []; for (let i = 0; i < 6; i++) { const s = at(new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x36d07f })), 0, 0, 0); s.visible = false; st.scene.add(s); sig.push(s); }
    st.camera.position.set(4, 3.5, 4.5); st.controls.target.set(0, .8, 0);
    st.onFrame(t => {
      const k = cycle(t, 10);
      const down = k < .3 ? lerp(2.2, .72, k / .3) : k < .8 ? .72 : lerp(.72, 2.2, (k - .8) / .2);
      g.position.y = down; plate.position.y = down + .5;
      sig.forEach((s, i) => { s.visible = k > .35 && k < .8; const p = probes[(i * 11) % 60]; s.position.set(p.position.x, lerp(.2, down, (t * 2 + i * .3) % 1), p.position.z); s.material.color.setHex(i === 4 ? 0xff5a5f : 0x36d07f); });
    });
    return [[0, 'El vacío baja la tarjeta sobre la cama de agujas'], [3, 'Cada aguja toca un punto de prueba (nodo) de la tarjeta'], [5, 'Se miden resistencias, capacitores, diodos y cortos'], [8, 'Una medición fuera de límites (rojo) marca la falla y el nodo']];
  },

  solder_joint(st) {
    const kinds = [['Buena: menisco cóncavo', 1], ['Insuficiente', .35], ['Puente', 2], ['Levantada (lifted)', -1], ['Tombstone', -2]];
    kinds.forEach(([name, k], i) => {
      const x = (i - 2) * 2;
      const pad = at(box(1.4, .04, .8, mat(0xd9c07a, { metalness: .9, roughness: .25 })), x, .02, 0); st.scene.add(pad);
      const comp = at(box(.7, .35, .5, mat(0x6b6f75)), x, .25, 0); st.scene.add(comp);
      const sm = mat(0xc9ced4, { metalness: .9, roughness: .2 });
      if (k === 2) st.scene.add(at(box(1.3, .18, .3, sm), x, .12, 0));
      [-1, 1].forEach(sd => {
        if (k === -2 && sd === 1) { comp.rotation.z = 1.2; comp.position.set(x - .2, .45, 0); }
        const h = k === 1 ? .3 : k === .35 ? .1 : k === -1 && sd === 1 ? 0 : .25;
        if (h > 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(.35, h * 1.4, 4), sm); f.rotation.y = Math.PI / 4; f.position.set(x + sd * .5, h * .7, 0); f.scale.set(.6, 1, 1.2); st.scene.add(f); }
        if (k === -1 && sd === 1) { const lead = at(box(.25, .06, .4, mat(0xaab0b6, { metalness: .8 })), x + .5, .18, 0); st.scene.add(lead); }
      });
      st.label(pad, name, [0, -.25, .7]);
    });
    st.camera.position.set(0, 4, 7); st.controls.target.set(0, .2, 0); st.controls.autoRotate = false;
    st.onFrame(t => { st.camera.position.x = Math.sin(t * .3) * 3; });
    return [[0, 'Compara juntas: la buena moja el pad y la terminal con menisco cóncavo'], [4, 'Insuficiente: poco volumen, riesgo de junta abierta'], [7, 'Puente: soldadura une dos pads; corto eléctrico'], [10, 'Lifted y tombstone: la terminal no asienta en el pad']];
  },

  calibration_target(st) {
    const plate = at(box(3, .1, 2, mat(0xcfd6dd, { metalness: .8, roughness: .2 })), 0, .05, 0); st.scene.add(plate); st.label(plate, 'Placa de calibración', [0, .2, 1.1]);
    const dots = []; for (let i = 0; i < 35; i++) { const d = at(cyl(.08, .08, .02, 0x111111, 16), (i % 7 - 3) * .4, .11, (Math.floor(i / 7) - 2) * .4); st.scene.add(d); dots.push(d); }
    const steps = [.1, .3, .6]; steps.forEach((h, i) => { const s = at(box(.5, h, .5, mat(0xa9b2bb, { metalness: .7 })), 2.2, h / 2 + .1, (i - 1) * .7); st.scene.add(s); st.label(s, `Escalón ${Math.round(h * 1000)} µm`, [0, h / 2 + .15, 0]); });
    const head = at(box(.6, .5, .6, mat(0x2a3138)), 0, 2.5, 0); st.scene.add(head); st.label(head, 'Cabeza de imagen', [0, .4, 0]);
    const ray = at(cyl(.02, .02, 2.3, new THREE.MeshBasicMaterial({ color: 0x36d07f })), 0, 1.3, 0); st.scene.add(ray);
    st.camera.position.set(4, 4, 5); st.controls.target.set(.6, .4, 0);
    st.onFrame(t => {
      const i = Math.floor(t * 1.5) % 38; const tgt = i < 35 ? dots[i].position : new THREE.Vector3(2.2, .5, (i - 36) * .7);
      head.position.x = lerp(head.position.x, tgt.x, .15); head.position.z = lerp(head.position.z, tgt.z, .15);
      ray.position.set(head.position.x, 1.3, head.position.z);
      dots.forEach((d, j) => d.material.color.setHex(j < i ? 0x36d07f : 0x111111));
    });
    return [[0, 'La cámara visita cada punto de la placa: corrige escala y distorsión XY'], [8, 'Los escalones de altura conocida calibran la medición Z'], [14, 'Si la calibración se desvía, todas las mediciones 3D se desvían']];
  },

  conveyor_fiducial(st) {
    const railA = at(box(7, .12, .12, mat(0x9aa3ac, { metalness: .7 })), 0, .6, -.9); const railB = at(box(7, .12, .12, mat(0x9aa3ac, { metalness: .7 })), 0, .6, .9);
    st.scene.add(railA, railB); st.label(railB, 'Riel móvil (ancho)', [2.5, .2, 0]);
    const { g, comps } = pcb(2.4, 1.5, 12, 5); st.scene.add(g); const fids = comps.filter(c => c.userData.fid);
    st.label(fids[0], 'Fiducial 1', [0, .2, 0]); st.label(fids[1], 'Fiducial 2', [0, .2, 0]);
    const stopper = at(box(.1, .3, .3, mat(0xff5a5f)), .9, .75, 0); st.scene.add(stopper); st.label(stopper, 'Stopper', [0, .3, 0]);
    const cam = at(box(.4, .4, .4, mat(0x2a3138)), 0, 2.4, 0); st.scene.add(cam);
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(.12, .015, 8, 24), new THREE.MeshBasicMaterial({ color: 0x36d07f })), 0, .72, 0); ring.rotation.x = Math.PI / 2; st.scene.add(ring);
    st.camera.position.set(3, 4, 5); st.controls.target.set(0, .6, 0);
    st.onFrame(t => {
      const k = cycle(t, 12);
      const w = k < .15 ? lerp(1.4, .78, k / .15) : .78; railB.position.z = w; railA.position.z = -w;
      g.position.set(k < .15 ? -3.5 : k < .35 ? lerp(-3.5, -.3, (k - .15) / .2) : k < .85 ? -.3 : lerp(-.3, 3.5, (k - .85) / .15), .62, 0);
      stopper.position.y = k > .3 && k < .85 ? .75 : .45;
      const f = k < .55 ? fids[0] : fids[1]; const p = new THREE.Vector3(); f.getWorldPosition(p);
      ring.visible = k > .4 && k < .85; ring.position.set(p.x, .72, p.z); cam.position.x = lerp(cam.position.x, p.x, .1); cam.position.z = lerp(cam.position.z, p.z, .1);
    });
    return [[0, 'El riel ajusta su ancho al de la tarjeta (AWA / ajuste automático)'], [3, 'La tarjeta entra y el stopper la detiene; se sujeta'], [5, 'La cámara busca los fiduciales para corregir posición y rotación'], [10, 'Termina la inspección y la tarjeta sale']];
  },

  spi_paste_volume(st) {
    const board = at(box(4, .06, 2.6, mat(0x1f6b3a)), 0, .03, 0); st.scene.add(board);
    const deps = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) {
      const target = .14; let h = target * (.85 + Math.random() * .3); if (i === 3 && j === 2) h = target * .35; if (i === 7 && j === 4) h = target * 1.7;
      const d = at(box(.22, 1, .16, mat(0x9aa0a6, { metalness: .4 })), (i - 4.5) * .36, 0, (j - 2.5) * .38); d.userData.h = h; d.userData.r = h / target; d.scale.y = .001; st.scene.add(d); deps.push(d);
    }
    st.label(deps[3 * 6 + 2], 'Insuficiente (35%)', [0, .3, 0]); st.label(deps[7 * 6 + 4], 'Exceso (170%)', [0, .35, 0]);
    const sweep = at(box(.05, .5, 2.8, new THREE.MeshBasicMaterial({ color: 0xa77bff, transparent: true, opacity: .5 })), 0, .3, 0); st.scene.add(sweep);
    st.camera.position.set(3.5, 3.5, 4); st.controls.target.set(0, .1, 0);
    st.onFrame(t => {
      const k = cycle(t, 9); sweep.position.x = lerp(-2.1, 2.1, Math.min(1, k * 1.4));
      deps.forEach(d => { const show = d.position.x < sweep.position.x; d.scale.y = show ? d.userData.h : .001; d.position.y = .06 + d.scale.y / 2;
        const r = d.userData.r; d.material.color.setHex(!show ? 0x9aa0a6 : r < .6 ? 0xff5a5f : r > 1.4 ? 0xffb020 : 0x36d07f); });
    });
    return [[0, 'El SPI mide cada depósito de pasta: altura, área y volumen'], [3, 'El volumen se compara con la apertura del stencil (100%)'], [5, 'Verde dentro de tolerancia; rojo insuficiente; ámbar exceso'], [7, 'Los datos alimentan SPC y la retroalimentación a la impresora']];
  },

  defect_gallery(st) {
    const defs = [['Faltante', 0], ['Desplazado', 1], ['Polaridad invertida', 2], ['Tombstone', 3], ['Puente', 4], ['Billboard', 5], ['Volteado', 6], ['Cuerpo extraño', 7]];
    const ring = new THREE.Group(); st.scene.add(ring);
    defs.forEach(([n, k], i) => {
      const a = i / defs.length * Math.PI * 2, x = Math.cos(a) * 3.2, z = Math.sin(a) * 3.2;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.lookAt(0, 0, 0); ring.add(g);
      g.add(at(box(1.4, .06, 1, mat(0x1f6b3a)), 0, .5, 0));
      [-.4, .4].forEach(px => g.add(at(box(.3, .02, .4, mat(0xd9c07a, { metalness: .9 })), px, .54, 0)));
      const c = at(box(.7, .25, .35, mat(0x6b6f75)), 0, .67, 0);
      if (k === 0) c.visible = false; if (k === 1) c.position.x = .3; if (k === 1) c.rotation.y = .4;
      if (k === 2) { c.add(at(box(.08, .26, .36, mat(0xffffff)), .3, 0, 0)); }
      if (k === 3) { c.rotation.z = 1.2; c.position.set(-.25, .85, 0); }
      if (k === 4) g.add(at(box(.9, .1, .2, mat(0xc9ced4, { metalness: .9 })), 0, .6, .25));
      if (k === 5) { c.rotation.x = Math.PI / 2; c.position.y = .75; }
      if (k === 6) c.material = mat(0xeeeeee);
      if (k === 7) g.add(at(new THREE.Mesh(new THREE.TorusKnotGeometry(.08, .025, 32, 6), mat(0xffb020)), .5, .64, .3));
      g.add(c); g.add(at(cyl(.06, .06, .5, mat(0x30363d)), 0, .25, 0)); st.label(g, n, [0, 1.1, 0]);
    });
    st.camera.position.set(0, 3, 7.5); st.controls.target.set(0, .6, 0);
    st.onFrame(t => { ring.rotation.y = t * .25; });
    return [[0, 'Galería de defectos típicos que detecta el AOI'], [6, 'Compara la posición, rotación y altura con la plantilla del programa'], [12, 'Puentes y juntas ocultas se confirman con AXI']];
  },

  process_flow(st) {
    const steps = ['CAD / Gerber', 'Fiduciales', 'Librería', 'Umbrales', 'Primera corrida', 'Debug', 'Producción'];
    const nodes = steps.map((s, i) => { const a = i / steps.length * Math.PI * 2; const n = at(cyl(.45, .45, .3, mat(0x3a4652)), Math.cos(a) * 3, .15, Math.sin(a) * 3); st.scene.add(n); st.label(n, s, [0, .5, 0]); return n; });
    const token = at(new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), mat(0x36d07f, { emissive: 0x1a7a44 })), 0, .6, 0); st.scene.add(token);
    st.camera.position.set(0, 6, 6.5); st.controls.target.set(0, 0, 0);
    st.onFrame(t => { const f = (t * .5) % steps.length, i = Math.floor(f), k = f - i; const a = nodes[i].position, b = nodes[(i + 1) % steps.length].position;
      token.position.set(lerp(a.x, b.x, k), .6 + Math.sin(k * Math.PI) * .6, lerp(a.z, b.z, k)); nodes.forEach((n, j) => n.material.color.setHex(j === i ? 0x3d8bff : 0x3a4652)); });
    return [[0, 'Flujo de creación de un programa de inspección'], [4, 'Del CAD/Gerber a la librería y los umbrales'], [9, 'La primera corrida y el debug cierran el ciclo antes de producción']];
  },

  safety_radiation(st) {
    const cab = at(box(3, 2.4, 2.4, mat(0x8a929a, { metalness: .6, transparent: true, opacity: .35 })), 0, 1.2, 0); st.scene.add(cab); st.label(cab, 'Gabinete con blindaje de plomo', [0, 1.4, 0]);
    const src = at(cyl(.2, .2, .5, mat(0xffb020, { emissive: 0xffb020, emissiveIntensity: .5 })), 0, .5, 0); st.scene.add(src);
    const waves = [0, 1, 2].map(() => { const w = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: .2, wireframe: true })); w.position.copy(src.position); st.scene.add(w); return w; });
    const il = [[1.5, 2, 1.2], [-1.5, 2, 1.2]].map(p => { const s = at(box(.15, .15, .1, mat(0x36d07f, { emissive: 0x1a7a44 })), ...p); st.scene.add(s); return s; });
    st.label(il[0], 'Interlock', [0, .2, 0]);
    const zone = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.6, 48), new THREE.MeshBasicMaterial({ color: 0xffd43b, side: THREE.DoubleSide })); zone.rotation.x = -Math.PI / 2; zone.position.y = .01; st.scene.add(zone);
    const person = new THREE.Group(); person.add(at(cyl(.15, .2, .9, mat(0x3d8bff)), 0, .45, 0), at(new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8), mat(0xf1c27d)), 0, 1.05, 0)); person.position.set(3.4, 0, 0); st.scene.add(person); st.label(person, 'Operador con dosímetro', [0, 1.4, 0]);
    st.camera.position.set(5, 4, 6); st.controls.target.set(0, 1, 0);
    st.onFrame(t => {
      const open = (t % 10) > 6; il.forEach(s => { s.material.color.setHex(open ? 0xff5a5f : 0x36d07f); s.material.emissive.setHex(open ? 0x661111 : 0x1a7a44); });
      waves.forEach((w, i) => { const k = ((t * .8 + i / 3) % 1); w.visible = !open; w.scale.setScalar(.3 + k * 1.1); w.material.opacity = .3 * (1 - k); });
      src.material.emissiveIntensity = open ? 0 : .6;
    });
    return [[0, 'Los rayos X se quedan dentro del gabinete blindado'], [3, 'Interlocks en puertas: si se abren, el tubo se apaga al instante'], [6, 'Puerta abierta → interlock rojo → sin rayos X'], [8, 'Mide fugas periódicamente y respeta las zonas señalizadas']];
  },

  machine_tour(st, opts = {}) {
    const kind = opts.model || 'aoi';
    const m = buildMachine(kind, opts.color || '#3d8bff'); st.scene.add(m.group);
    const list = Object.keys(m.parts).filter(k => PART_NAMES[k]);
    // Recorre las piezas una por una: resalta la pieza y muestra sólo su etiqueta
    const lbls = list.map(k => { const l = st.label(m.parts[k], PART_NAMES[k], [0, .15, 0]); l.d.style.display = 'none'; return l; });
    let cur = -1;
    st.camera.position.set(4.8, 3.6, 5.6); st.controls.target.set(0, 1.3, 0); st.controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; st.controls.autoRotateSpeed = .6;
    st.onFrame(t => {
      animateMachine(m, t, kind);
      const k = Math.floor(t / 2.5) % list.length;
      if (k !== cur) { if (cur >= 0) highlight(m.parts[list[cur]], false); cur = k; highlight(m.parts[list[k]], true, 0xffb020); }
      lbls.forEach((l, j) => l.obj.visible && (l.d.style.visibility = j === cur ? 'visible' : 'hidden'));
      const cap = st.el.querySelector('.cap'); if (cap) cap.textContent = 'Pieza: ' + PART_NAMES[list[cur]];
    });
    return [];
  },
};

// Monta una animación en un contenedor .stage y conecta subtítulo y controles
export function mountScene(st, id, opts) {
  const f = SCENES[id] || SCENES.machine_tour;
  const caps = f(st, opts) || [];
  const cap = st.el.querySelector('.cap');
  if (cap && caps.length) {
    const total = (caps[caps.length - 1][0] + 4);
    st.onFrame(t => { const tt = t % total; let c = caps[0][1]; for (const [s, txt] of caps) if (tt >= s) c = txt; if (cap.textContent !== c) cap.textContent = c; });
  }
  return caps;
}
