// Escenario Three.js reutilizable: renderer, cámara, luces, controles, etiquetas y ciclo que se pausa fuera de vista.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export { THREE };
let active = [];
export function disposeAll() { active.forEach(s => s.dispose()); active = []; }

export function createStage(el, { cam = [6, 5, 8], target = [0, 0.6, 0], fov = 45, bg = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  if (bg) scene.background = new THREE.Color(bg);
  try { scene.environment = envMap(renderer); scene.environmentIntensity = .95; } catch (e) { /* sin reflejos */ }
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 200);
  camera.position.set(...cam);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 1.5; controls.maxDistance = 30;
  scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x20262c, .55));
  const sun = new THREE.DirectionalLight(0xfff3e4, 2.1); sun.position.set(5, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 3; sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  const fill = new THREE.DirectionalLight(0xcfe0ff, .55); fill.position.set(-6, 4, 3); scene.add(fill); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshStandardMaterial({ color: 0x262d34, roughness: .7, metalness: .05 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(32, 32, 0x2c3742, 0x222a33); grid.position.y = 0.002; scene.add(grid);

  let labelBox = el.querySelector('.labels');
  if (!labelBox) { labelBox = document.createElement('div'); labelBox.className = 'labels'; el.appendChild(labelBox); }
  const labels = [];
  const st = {
    THREE, scene, camera, renderer, controls, el, sun, playing: true, speed: 1, t: 0, updaters: [], floor, grid,
    onFrame(f) { this.updaters.push(f); },
    label(obj, text, offset = [0, 0.3, 0]) {
      const d = document.createElement('div'); d.className = 'lbl'; d.textContent = text; labelBox.appendChild(d);
      const l = { obj, d, off: new THREE.Vector3(...offset) }; labels.push(l); return l;
    },
    clearLabels() { labels.forEach(l => l.d.remove()); labels.length = 0; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
      renderer.dispose(); renderer.domElement.remove(); labelBox.innerHTML = '';
    },
  };
  const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(size); ro.observe(el); size();
  let visible = true;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(el);
  const clock = new THREE.Clock(); const v = new THREE.Vector3();
  let raf;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    if (st.playing) { st.t += dt * st.speed; st.updaters.forEach(f => f(st.t, dt * st.speed)); }
    controls.update(); renderer.render(scene, camera);
    const w = el.clientWidth, h = el.clientHeight;
    for (const l of labels) {
      l.obj.getWorldPosition(v); v.add(l.off); v.project(camera);
      const hide = v.z > 1 || !l.obj.visible;
      l.d.style.display = hide ? 'none' : '';
      l.d.style.left = ((v.x + 1) / 2 * w) + 'px'; l.d.style.top = ((1 - v.y) / 2 * h) + 'px';
    }
  };
  loop();
  active.push(st);
  return st;
}

// Utilidades de geometría
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .2 }, o));
export function box(w, h, d, color, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color?.isMaterial ? color : mat(color, o)); m.castShadow = m.receiveShadow = true; return m; }
// Caja con aristas redondeadas (las cubiertas reales de las máquinas no tienen filos)
const RB = new Map();
export function rgeo(w, h, d, r) {
  r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001); const k = [w, h, d, r].map(v => v.toFixed(3)).join(); if (RB.has(k)) return RB.get(k);
  const sh = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
  sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); sh.lineTo(w / 2, y); sh.quadraticCurveTo(w / 2, h / 2, x, h / 2); sh.lineTo(-x, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); sh.lineTo(-w / 2, -y); sh.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: 0, bevelSegments: 3, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); RB.set(k, g); return g;
}
export function rbox(w, h, d, color, r = .05, o) { const m = new THREE.Mesh(rgeo(w, h, d, r), color?.isMaterial ? color : mat(color, o)); m.castShadow = m.receiveShadow = true; return m; }
// Entorno de reflejos para materiales metálicos y brillantes (una nave con lámparas, generado aquí mismo)
let ENV = null;
export function envMap(renderer) {
  if (ENV) return ENV;
  // Estudio de fotografía: paredes gris medio, cajas de luz arriba y a los lados, piso gris
  const sc = new THREE.Scene(); const room = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x5a636c, side: THREE.BackSide })); sc.add(room);
  const lamp = c => new THREE.MeshBasicMaterial({ color: c });
  for (let x = -9; x <= 9; x += 6) for (const z of [-6, 0, 6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(3.5, .1, 1.2), lamp(0xffffff)); l.position.set(x, 6.9, z); sc.add(l); }
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), lamp(0xf4f6ff)); sb.position.set(0, 3, 14.9); sb.rotation.y = Math.PI; sc.add(sb);
  const sb2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), lamp(0xc9d6e6)); sb2.position.set(-14.9, 2, 0); sb2.rotation.y = Math.PI / 2; sc.add(sb2);
  const sb3 = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), lamp(0x8a96a2)); sb3.position.set(14.9, 2, 0); sb3.rotation.y = -Math.PI / 2; sc.add(sb3);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), lamp(0x3d4349)); fl.rotation.x = -Math.PI / 2; fl.position.y = -6.9; sc.add(fl);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), lamp(0xbcd4ff)); win.position.set(0, 2, -14.9); sc.add(win);
  const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(sc, .02).texture; pm.dispose(); return ENV;
}
export function cyl(rt, rb, h, color, seg = 24, o) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color?.isMaterial ? color : mat(color, o)); m.castShadow = true; return m; }
export function at(o, x, y, z) { o.position.set(x, y, z); return o; }

// Tarjeta PCB con componentes simples; devuelve grupo y lista de componentes
export function pcb(w = 3, d = 2, n = 14, seed = 3) {
  const g = new THREE.Group();
  g.add(at(box(w, 0.06, d, 0x1f6b3a, { roughness: .7 }), 0, 0.03, 0));
  let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const comps = [];
  for (let i = 0; i < n; i++) {
    const big = r() > 0.75;
    const cw = big ? 0.35 + r() * 0.2 : 0.12 + r() * 0.1, cd = big ? cw : cw * 0.55, ch = big ? 0.08 : 0.05;
    const c = at(box(cw, ch, cd, big ? 0x22262b : (r() > .5 ? 0xb58a5a : 0x6b6f75)), (r() - .5) * (w - .6), 0.06 + ch / 2, (r() - .5) * (d - .5));
    g.add(c); comps.push(c);
  }
  // fiduciales
  [[-w / 2 + .15, -d / 2 + .15], [w / 2 - .15, d / 2 - .15]].forEach(([x, z]) => { const f = at(cyl(.05, .05, .01, 0xd9c07a, 20, { metalness: .9, roughness: .2 }), x, .065, z); f.userData.fid = true; g.add(f); comps.push(f); });
  return { g, comps };
}
