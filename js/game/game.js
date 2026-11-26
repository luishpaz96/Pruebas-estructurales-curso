// Modo juego "Técnico de pruebas": caminas por la planta, atiendes misiones del ingeniero, incidentes y la cola de NG.
import { createStage, THREE } from '../stage.js';
import { esc, confetti } from '../fx.js';
import { state, save, addXP, course } from '../store.js';
import { buildWorld, boardFlow, character, LAYOUT } from './world.js';
import { buildLife } from './life.js';
import { initAudio, startMusic, stopMusic, setMusic, setSfx, setIntensity, sfx, audioState } from './audio.js';
import * as MG from './minigames.js';
import { createProgram, playPractice } from '../simui.js';
import { runMaintenance } from '../maintenance.js';

const G = course.game || { career: { days: [] }, incidents: [] };
const MENTOR = G.career.mentor || { name: 'Ingeniero', role: '' };
const STN_NAMES = { aoi: 'AOI 3D (línea 1)', aoi2: 'AOI línea 2', axi: 'AXI 3D', ict: 'ICT', spi: 'SPI', mentor: 'Oficina del ingeniero', line: 'Línea', prod: 'Supervisora de manufactura', quality: 'Ingeniería de calidad' };

export const MENTOR_SVG = `<svg viewBox="0 0 80 80" aria-hidden="true"><rect width="80" height="80" rx="14" fill="#22303e"/><path d="M14 80c2-16 12-22 26-22s24 6 26 22z" fill="#f2f4f6"/><path d="M36 58l4 10 4-10z" fill="#3d8bff"/><rect x="26" y="20" width="28" height="32" rx="12" fill="#d9a77c"/><path d="M24 26c0-10 8-14 16-14s16 4 16 14c-4-4-10-6-16-6s-12 2-16 6z" fill="#3b3b3b"/><g fill="none" stroke="#111" stroke-width="2.2"><rect x="28" y="31" width="10" height="7" rx="2"/><rect x="42" y="31" width="10" height="7" rx="2"/><path d="M38 34h4"/></g><path d="M34 45q6 4 12 0" stroke="#7a4a32" stroke-width="2" fill="none"/><rect x="50" y="62" width="9" height="11" rx="1.5" fill="#fff" stroke="#3d8bff"/></svg>`;

const portrait = (coat, hair, glasses, skin = '#d9a77c') => `<svg viewBox="0 0 80 80" aria-hidden="true"><rect width="80" height="80" rx="14" fill="#22303e"/><path d="M14 80c2-16 12-22 26-22s24 6 26 22z" fill="${coat}"/><rect x="26" y="20" width="28" height="32" rx="12" fill="${skin}"/><path d="M22 34c0-14 8-20 18-20s18 6 18 20c-3-8-10-11-18-11s-15 3-18 11z" fill="${hair}"/>${glasses ? '<g fill="none" stroke="#111" stroke-width="2.2"><rect x="28" y="31" width="10" height="7" rx="2"/><rect x="42" y="31" width="10" height="7" rx="2"/><path d="M38 34h4"/></g>' : '<g fill="#111"><circle cx="33" cy="35" r="2"/><circle cx="47" cy="35" r="2"/></g>'}<path d="M34 45q6 4 12 0" stroke="#7a4a32" stroke-width="2" fill="none"/></svg>`;
const CAST = Object.assign({ mentor: { name: MENTOR.name, role: MENTOR.role } }, G.career.cast || {});
CAST.mentor.svg = MENTOR_SVG;
if (CAST.prod) CAST.prod.svg = portrait('#ff7a45', '#5a3220', false);
if (CAST.quality) CAST.quality.svg = portrait('#36d07f', '#1a1a1a', true, '#c98f66');
const who = id => CAST[id] || CAST.mentor;

function gstate() { const S = state(); S.game = S.game || { day: 0, done: {}, grades: {}, best: 0 }; return S.game; }

export function gameScreen(view) {
  view.innerHTML = `<div class="game" id="game"><div class="stage gstage" id="gStage"><div class="cap" style="display:none"></div></div>
    <div class="ghud" id="gHud"></div><div class="gtasks" id="gTasks"></div><canvas class="gmap" id="gMap" width="220" height="120"></canvas>
    <div class="gprompt" id="gPrompt" hidden></div><div class="gdlg" id="gDlg" hidden></div>
    <div class="gmob" id="gMob"><button class="btn" id="gAct">Acción</button></div>
    <div class="gov" id="gOv" hidden><div class="gov-in"><div class="row gov-h"><span id="gOvT"></span><span class="sp"></span><button class="btn ghost" id="gOvX">Salir de la tarea</button></div><div id="gOvB"></div></div></div>
    <div class="gtitle" id="gTitle"></div></div>`;
  const $ = s => view.querySelector(s);
  const st = createStage($('#gStage'), { cam: [0, 14, 16], target: [0, 0, 0], fov: 50 });
  st.controls.enabled = false; st.renderer.shadowMap.enabled = true;
  const W = buildWorld(st); W.updaters.forEach(f => st.onFrame(f));
  const life = buildLife(st, W, LAYOUT);
  const player = character({ coat: 0x2f6fd6, hair: 0x2b1d14 }); player.g.position.set(-12, 0, 9); st.scene.add(player.g);
  const flow = boardFlow(st.scene);
  // Balizas de misión / incidente sobre las estaciones
  const beacons = {};
  for (const [id, s] of Object.entries(W.stations)) {
    const b = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }));
    col.position.y = 4.5; b.add(col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.2, 32), new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; b.add(ring);
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#ffb020'; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '900 88px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(1.2, 1.2, 1); sp.position.y = 6.2; sp.renderOrder = 6; b.add(sp);
    b.position.copy(s.pos); b.visible = false; st.scene.add(b); beacons[id] = { g: b, col, ring, sp, ctx: x, tex: sp.material.map };
  }
  const setBeacon = (id, kind) => { const b = beacons[id]; if (!b) return; b.g.visible = !!kind; if (!kind) return;
    const c = kind === 'incident' ? 0xff3b30 : kind === 'queue' ? 0x3d8bff : 0xffb020; b.col.material.color.setHex(c); b.ring.material.color.setHex(c);
    b.ctx.clearRect(0, 0, 128, 128); b.ctx.fillStyle = '#' + c.toString(16).padStart(6, '0'); b.ctx.beginPath(); b.ctx.arc(64, 64, 56, 0, 7); b.ctx.fill(); b.ctx.fillStyle = '#111'; b.ctx.fillText(kind === 'incident' ? '⚠' : kind === 'queue' ? 'NG' : '!', 64, 70); b.tex.needsUpdate = true; };

  // ---------------- Estado de la partida ----------------
  const R = { day: null, mi: 0, mission: null, toured: new Set(), t: 0, shift: 300, running: false, paused: true, kpi: null, incidents: [], incTimes: [], queue: { aoi: 0, axi: 0 }, spawnT: 0, lineStop: false, stopReason: '', freeplay: false, xpDay: 0 };
  const freshKPI = () => ({ produced: 0, good: 0, ng: 0, escapes: 0, falseCalls: 0, scrap: 0, downtime: 0, reviewOK: 0, reviewTotal: 0, missions: [] });

  // ---------------- Entrada (teclado, clic/toque) ----------------
  const keys = {}; let target = null;
  const kd = e => { if (!$('#game')) return cleanup(); if (e.target.closest?.('input,select,textarea')) return; keys[e.key.toLowerCase()] = true; if (['e', 'enter', ' '].includes(e.key.toLowerCase()) && !R.paused) { e.preventDefault(); interact(); } };
  const ku = e => { keys[e.key.toLowerCase()] = false; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  function cleanup() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); stopMusic(); }
  addEventListener('hashchange', cleanup, { once: true });
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  // ---------------- Cámara: seguir (con giro y zoom), libre y alertas ----------------
  const CAM = { mode: 'follow', yaw: 0, pitch: .74, dist: 17.5, peek: 0, look: new THREE.Vector3(), free: false };
  const CAM_NAMES = { follow: '🎥 Seguir', free: '🕊 Libre', alert: '🚨 Alertas' };
  const dom = st.renderer.domElement; dom.style.touchAction = 'none';
  const pts = new Map(); let drag = null, pinch0 = 0;
  const toFloor = ev => { const r = dom.getBoundingClientRect(); v2.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, st.camera); return ray.intersectObject(W.floor)[0]; };
  dom.addEventListener('pointerdown', ev => { pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); drag = { x: ev.clientX, y: ev.clientY, moved: 0, btn: ev.button, t: performance.now() }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  dom.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) return; const prev = pts.get(ev.pointerId); const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y; pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (drag) drag.moved += Math.abs(dx) + Math.abs(dy);
    if (CAM.mode === 'free') return; // OrbitControls se encarga
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) CAM.dist = Math.min(34, Math.max(6, CAM.dist * pinch0 / d)); pinch0 = d; return; }
    if (drag && drag.moved > 6) { CAM.yaw -= dx * .006; CAM.pitch = Math.min(1.35, Math.max(.25, CAM.pitch + dy * .004)); }
  });
  const up = ev => { const was = drag; pts.delete(ev.pointerId); if (pts.size < 2) pinch0 = 0; drag = null;
    if (!was || was.moved > 6 || was.btn !== 0 || R.paused || pts.size) return;
    const h = toFloor(ev); if (!h) return; target = h.point.clone();
    for (const s of Object.values(W.stations)) if (h.point.distanceTo(s.pos) < 3.5) target = s.pos.clone(); };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', ev => { pts.delete(ev.pointerId); drag = null; });
  dom.addEventListener('contextmenu', ev => ev.preventDefault());
  $('#gAct').onclick = () => interact();
  dom.addEventListener('wheel', ev => { if (CAM.mode === 'free') return; CAM.dist = Math.min(34, Math.max(6, CAM.dist * (ev.deltaY > 0 ? 1.1 : .9))); ev.preventDefault(); }, { passive: false });
  // Punto que requiere atención: alarma > misión > cola de NG
  function attention() {
    const inc = R.incidents[0]; if (inc && W.stations[inc.station]) return { pos: W.stations[inc.station].pos, why: inc.title };
    const ms = missionStations(); if (ms.length) { const p = player.g.position; const s = ms.map(id => W.stations[id]).filter(Boolean).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p))[0]; if (s) return { pos: s.pos, why: R.mission?.title || '' }; }
    for (const id of ['aoi', 'axi']) if (R.queue[id] >= 3) return { pos: W.stations[id].pos, why: `Cola de NG en ${id.toUpperCase()}` };
    return null;
  }
  function setCam(mode) {
    CAM.mode = mode; const c = st.controls; c.enabled = mode === 'free';
    if (mode === 'free') { c.target.copy(CAM.look); c.minDistance = 4; c.maxDistance = 60; c.maxPolarAngle = Math.PI * .47; c.enablePan = true; c.screenSpacePanning = false; }
    const b = $('#gCamM'); if (b) b.textContent = CAM_NAMES[mode];
    radio(mode === 'follow' ? 'Cámara: sigue a tu personaje. Arrastra para girar, rueda o pellizco para acercar.' : mode === 'free' ? 'Cámara libre: arrastra para girar, clic derecho o dos dedos para mover, WASD para desplazarte. C cambia de modo.' : 'Cámara de alertas: encuadra lo que necesita tu atención.');
  }
  const camBar = document.createElement('div'); camBar.className = 'gcam';
  camBar.innerHTML = `<button class="btn" id="gCamM" title="Cambiar modo de cámara (C)">${CAM_NAMES.follow}</button><button class="btn ghost" id="gCamL" title="Girar a la izquierda (Q)">⟲</button><button class="btn ghost" id="gCamR" title="Girar a la derecha (R)">⟳</button><button class="btn ghost" id="gCamF" title="Ver lo que requiere atención (F)">👁</button><button class="btn ghost" id="gCamH" title="Volver a tu personaje (H)">⌂</button>`;
  $('#game').appendChild(camBar);
  const cycle = () => setCam({ follow: 'free', free: 'alert', alert: 'follow' }[CAM.mode]);
  const peek = () => { const a = attention(); if (!a) return radio('Nada pendiente por ahora.'); CAM.peek = 3.2; CAM.peekPos = a.pos.clone(); radio('Mira: ' + a.why); };
  const home = () => { if (CAM.mode === 'free') setCam('follow'); CAM.yaw = 0; CAM.pitch = .74; CAM.dist = 17.5; CAM.peek = 0; };
  $('#gCamM').onclick = cycle; $('#gCamL').onclick = () => CAM.yaw += Math.PI / 4; $('#gCamR').onclick = () => CAM.yaw -= Math.PI / 4; $('#gCamF').onclick = peek; $('#gCamH').onclick = home;
  addEventListener('keydown', ev => { if (!$('#game') || R.paused || ev.target.closest?.('input,select,textarea')) return; const k = ev.key.toLowerCase();
    if (k === 'c') cycle(); else if (k === 'f') peek(); else if (k === 'h') home(); else if (k === 'q') CAM.yaw += Math.PI / 8; else if (k === 'r') CAM.yaw -= Math.PI / 8; });
  // Clic en el minimapa: mira ese punto (en modo libre mueve la cámara ahí)
  $('#gMap').addEventListener('click', ev => { const c = ev.currentTarget, r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width * 104 - 50, z = (ev.clientY - r.top) / r.height * 52 - 24;
    if (CAM.mode !== 'free') setCam('free'); const d = new THREE.Vector3(x, 0, z).sub(st.controls.target); st.controls.target.add(d); st.camera.position.add(d); });
  function updateCam(dt) {
    const p = player.g.position, c = st.controls;
    if (CAM.mode === 'free') {
      // WASD desplaza la cámara en el plano del piso
      let mx = 0, mz = 0; if (keys.w || keys.arrowup) mz -= 1; if (keys.s || keys.arrowdown) mz += 1; if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
      if (mx || mz) { const f = new THREE.Vector3(); st.camera.getWorldDirection(f); f.y = 0; f.normalize(); const rgt = new THREE.Vector3(-f.z, 0, f.x); const mv = f.multiplyScalar(-mz).add(rgt.multiplyScalar(mx)).multiplyScalar((keys.shift ? 30 : 16) * dt); c.target.add(mv); st.camera.position.add(mv); }
      CAM.look.copy(c.target); return;
    }
    let look = new THREE.Vector3(p.x, 1.5, p.z), dist = CAM.dist;
    if (CAM.peek > 0) { CAM.peek -= dt; look = CAM.peekPos.clone().setY(1.5); }
    else if (CAM.mode === 'alert') { const a = attention(); if (a) { const gap = a.pos.distanceTo(p); look.lerp(a.pos.clone().setY(1.5), .5); dist = Math.max(CAM.dist, gap * 1.05 + 8); } }
    CAM.look.lerp(look, Math.min(1, dt * 4));
    const off = new THREE.Vector3(Math.sin(CAM.yaw) * Math.cos(CAM.pitch), Math.sin(CAM.pitch), Math.cos(CAM.yaw) * Math.cos(CAM.pitch)).multiplyScalar(dist);
    st.camera.position.lerp(CAM.look.clone().add(off), Math.min(1, dt * 5)); c.target.copy(CAM.look);
  }

  // ---------------- Movimiento y cámara ----------------
  let stepT = 0;
  st.onFrame((t, dt) => {
    const p = player.g.position; let mx = 0, mz = 0;
    if (!R.paused) {
      if (CAM.mode !== 'free') { let ix = 0, iz = 0; if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1; if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
        const yw = CAM.yaw; mx = ix * Math.cos(yw) + iz * Math.sin(yw); mz = -ix * Math.sin(yw) + iz * Math.cos(yw); }
      if (mx || mz) target = null;
      if (target) { const d = target.clone().sub(p); d.y = 0; if (d.length() < .3) target = null; else { mx = d.x; mz = d.z; } }
    }
    const len = Math.hypot(mx, mz), moving = len > 0;
    if (moving) {
      const sp = (keys.shift ? 11 : 7.5) * dt; const nx = p.x + mx / len * sp, nz = p.z + mz / len * sp;
      const blocked = (x, z) => x < -52 || x > 52 || z < -25 || z > 27 || W.colliders.some(c => x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1);
      if (!blocked(nx, p.z)) p.x = nx; else target = null; if (!blocked(p.x, nz)) p.z = nz; else target = null;
      player.g.rotation.y = Math.atan2(mx, mz);
      stepT += dt; if (stepT > .32) { stepT = 0; sfx('step'); }
    }
    player.walk(dt, moving);
    life.update(t, dt, { player: p, andon: R.kpi && { state: R.lineStop ? 'stop' : 'run', reason: R.stopReason, goal: Math.round(R.t / 4.5), produced: R.kpi.produced, fpy: fpy(), aoi: R.queue.aoi, axi: R.queue.axi, clock: fmtClock() } });
    // Cámara en tercera persona
    updateCam(dt);
    // Balizas animadas
    for (const b of Object.values(beacons)) if (b.g.visible) { b.sp.position.y = 6.2 + Math.sin(t * 3) * .3; b.ring.scale.setScalar(1 + (t * .8 % 1) * .4); }
    if (!R.running || R.paused) return;
    tickShift(dt);
    proximity();
    drawMap();
  });

  // ---------------- Simulación del turno ----------------
  function tickShift(dt) {
    R.t += dt;
    const stopped = R.lineStop;
    if (stopped) R.kpi.downtime += dt;
    R.spawnT -= dt; if (!stopped && R.spawnT <= 0) { flow.spawn(); R.spawnT = 4.5; }
    flow.update(dt, !stopped, (k, b) => {
      const ng = R.day?.ngRate ?? .08;
      if (k === 'aoi' && Math.random() < ng * 1.4) { flow.markNG(b); R.queue.aoi++; sfx('board'); }
      if (k === 'axi' && Math.random() < ng * .8) { flow.markNG(b); R.queue.axi++; sfx('xray'); }
      if (k === 'out') { R.kpi.produced++; if (!b.userData.ng) R.kpi.good++; else R.kpi.ng++; }
    });
    // Incidentes programados
    while (R.incTimes.length && R.t >= R.incTimes[0]) { R.incTimes.shift(); spawnIncident(); }
    // La cola de NG llena detiene la línea
    const full = R.queue.aoi >= 10 ? 'aoi' : R.queue.axi >= 10 ? 'axi' : null;
    const incStop = R.incidents.find(i => W.stations[i.station]?.inline);
    const was = R.lineStop;
    R.lineStop = !!(full || incStop);
    R.stopReason = incStop ? `Alarma en ${STN_NAMES[incStop.station]}` : full ? `Cola de NG llena en ${full.toUpperCase()}` : '';
    if (R.lineStop && !was) { sfx('alarm'); radio(`¡Se paró la línea! ${R.stopReason}. Cada minuto parado cuenta.`); }
    setIntensity(Math.min(1, R.incidents.length * .45 + (R.lineStop ? .4 : 0) + Math.max(R.queue.aoi, R.queue.axi) / 20));
    // Torres de luces
    for (const m of W.machines) { const lamps = m.obj.parts?.lamps; if (!lamps) continue; const inc = R.incidents.some(i => i.station === m.id);
      lamps.forEach((l, j) => l.material.emissiveIntensity = j === 0 ? (inc ? (Math.sin(R.t * 8) > 0 ? 1.5 : .1) : .08) : j === 1 ? (R.lineStop && !inc ? 1 : .08) : (!inc && !R.lineStop ? 1 : .08)); }
    // Balizas
    for (const id of Object.keys(beacons)) {
      const inc = R.incidents.some(i => i.station === id); const mis = missionStations().includes(id); const q = (id === 'aoi' && R.queue.aoi >= 3) || (id === 'axi' && R.queue.axi >= 3);
      setBeacon(id, inc ? 'incident' : mis ? 'mission' : q ? 'queue' : null);
    }
    hud();
    if (!R.freeplay && R.mi >= R.day.missions.length && !R.incidents.length) endDay();
    if (R.freeplay && R.t >= R.shift) endDay();
  }
  function spawnIncident() {
    const pool = G.incidents.filter(i => !R.incidents.some(x => x.station === i.station) && W.stations[i.station]);
    if (!pool.length) return; const inc = pool[Math.floor(Math.random() * pool.length)];
    R.incidents.push({ ...inc, at: R.t }); sfx('alarm'); radio(`Alarma: ${inc.title}. Ve a la estación.`);
  }
  const missionStations = () => { const m = R.mission; if (!m) return []; if (m.type === 'tour') return m.stations.filter(s => !R.toured.has(s)); return [m.station]; };

  // ---------------- Interacción ----------------
  let near = null;
  function proximity() {
    const p = player.g.position; near = null; let best = 3.2;
    for (const s of Object.values(W.stations)) { const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z); if (d < best) { best = d; near = s; } }
    const pr = $('#gPrompt');
    if (near) { const acts = actionsAt(near.id); pr.hidden = false; pr.innerHTML = `<b>${esc(STN_NAMES[near.id] || near.name)}</b> · ${acts.length ? esc(acts[0].label) : 'Sin tareas aquí'} <kbd>E</kbd>`; }
    else pr.hidden = true;
  }
  function actionsAt(id) {
    const a = [];
    const inc = R.incidents.find(i => i.station === id); if (inc) a.push({ label: 'Atender alarma', run: () => runIncident(inc) });
    const m = R.mission;
    if (m && m.type === 'tour' && m.stations.includes(id) && !R.toured.has(id)) a.push({ label: 'Escuchar al ingeniero', run: () => tourStop(id) });
    else if (m && m.station === id && m.type !== 'tour') a.push({ label: 'Misión: ' + m.title, run: () => runMission(m) });
    if (m && m.type === 'tour' && id === 'mentor' && m.stations.every(s => R.toured.has(s))) a.push({ label: 'Terminar recorrido', run: () => completeMission(100) });
    if ((id === 'aoi' || id === 'axi') && R.queue[id] > 0) a.push({ label: `Revisar NG (${R.queue[id]} en cola)`, run: () => runQueue(id) });
    if ((id === 'prod' || id === 'quality') && !a.length) a.push({ label: 'Saludar', run: () => say([{ who: id, text: id === 'prod' ? 'Aquí ando con el plan de producción. Avísame antes de parar cualquier máquina.' : 'Si ves algo raro en la calidad, avísame. Prefiero un paro que un escape.' }]) });
    if (id === 'mentor' && !a.length) a.push({ label: 'Hablar con el ingeniero', run: () => talkMentor() });
    return a;
  }
  function interact() { if (!near || R.paused) return; const a = actionsAt(near.id)[0]; if (a) { sfx('open'); a.run(); } }

  // ---------------- Diálogos del mentor ----------------
  function say(lines, then, title = MENTOR.name) {
    const L = [].concat(lines).filter(Boolean); let i = 0; const box = $('#gDlg'); R.paused = true;
    const show = () => { if (i >= L.length) { box.hidden = true; R.paused = false; then && then(); return; }
      const ln = typeof L[i] === 'string' ? { who: 'mentor', text: L[i] } : L[i]; const P = who(ln.who);
      box.hidden = false; box.innerHTML = `<div class="gdlg-p">${P.svg}</div><div class="gdlg-t"><b>${esc(ln.who && ln.who !== 'mentor' ? P.name : title)}</b><span class="mut"> · ${esc(P.role || '')}</span><p>${esc(ln.text)}</p><button class="btn pri" id="dlgN">${i < L.length - 1 ? 'Siguiente ▸' : 'Entendido'}</button></div>`;
      sfx('radio'); const b = box.querySelector('#dlgN'); b.onclick = () => { i++; show(); }; b.focus(); };
    show();
  }
  let radioT = null;
  function radio(text) { const p = $('#gPrompt'); const d = document.createElement('div'); d.className = 'gradio'; d.innerHTML = `<span class="gr-ic">${MENTOR_SVG}</span><span>${esc(text)}</span>`; $('#game').appendChild(d); sfx('radio'); setTimeout(() => d.remove(), 5200); }
  function talkMentor() {
    const tips = ['Recuerda: un escape es peor que un falso llamado, pero los dos cuestan.', 'Si falla todo a la vez, es la máquina. Si falla un componente, es el programa o el proceso.', 'Antes de meter las manos: LOTO y paro de emergencia.', 'Documenta: síntoma, causa, acción y verificación.', 'Nunca abras tolerancias para esconder una máquina descalibrada.'];
    say([R.mission ? `Tu tarea ahora: ${R.mission.title}. Ve a ${STN_NAMES[R.mission.station] || 'la estación marcada'}.` : 'Todo en orden por ahora. Vigila las colas de NG.', tips[Math.floor(Math.random() * tips.length)]]);
  }

  // ---------------- Capa de minijuegos ----------------
  function overlay(title, build) {
    R.paused = true; const ov = $('#gOv'); ov.hidden = false; $('#gOvT').innerHTML = `<span class="gdlg-mini">${MENTOR_SVG}</span><b>${esc(title)}</b>`;
    const body = $('#gOvB'); body.innerHTML = ''; ov.scrollTop = 0;
    const close = () => { ov.hidden = true; body.innerHTML = ''; R.paused = false; };
    $('#gOvX').onclick = () => { close(); radio('Tarea pendiente. Vuelve cuando estés listo.'); };
    build(body, close);
  }
  function runIncident(inc) {
    overlay(inc.title, (body, close) => MG.alarm(body, inc, r => { close(); R.incidents = R.incidents.filter(x => x !== inc); gain(Math.round(40 * r.score / 100) + 20, 'alarma resuelta'); sfx('great'); radio('Máquina restablecida. Buen trabajo.'); }));
  }
  function runQueue(id) {
    const n = Math.min(R.queue[id], 5);
    overlay(`Revisión de NG · ${id.toUpperCase()}`, (body, close) => MG.review(body, { machine: id, count: n }, r => { close(); R.queue[id] -= n; reviewKPI(r); gain(r.ok * 8, 'revisión de NG'); }));
  }
  function reviewKPI(r) { R.kpi.reviewOK += r.ok; R.kpi.reviewTotal += r.total; R.kpi.escapes += r.escapes; R.kpi.scrap += r.scrap; R.kpi.falseCalls += r.total - (r.total - r.ok) ; if (r.escapes) radio(`Calidad reporta ${r.escapes} escape(s). Revisa con calma.`); }
  function tourStop(id) { R.toured.add(id); sfx('ok'); say([R.mission.notes?.[id] || ''], () => { if (R.mission.stations.every(s => R.toured.has(s))) radio('Recorrido completo. Regresa con el ingeniero.'); }); }

  function runMission(m) {
    const brief = m.briefing || [];
    say(brief.length ? brief : [`Misión: ${m.title}.`], () => {
      const fin = (score, extra) => { completeMission(score, extra); };
      if (m.type === 'review') overlay(m.title, (b, close) => MG.review(b, { machine: m.machine, count: m.count }, r => { close(); reviewKPI(r); fin(r.score); }));
      else if (m.type === 'alarm') { const inc = G.incidents.find(i => i.id === m.incident); overlay(m.title, (b, close) => MG.alarm(b, inc, r => { close(); fin(r.score); })); }
      else if (m.type === 'quiz') overlay(m.title, (b, close) => MG.quiz(b, m, r => { close(); fin(r.score); }));
      else if (m.type === 'sequence') overlay(m.title, (b, close) => MG.sequence(b, m, r => { close(); fin(r.score); }));
      else if (m.type === 'npi') overlay(m.title, (b, close) => createProgram(b, m.mode, { lockMode: true, onResult: r => { close(); fin(100 - Math.min(40, r.falses * 5)); } }));
      else if (m.type === 'maint') { const p = course.maintenance.find(x => x.id === m.proc); overlay(m.title, (b, close) => { let sc = null; runMaintenance(b, p, () => { close(); if (sc !== null) fin(sc); }, (pct) => { sc = pct; }); }); }
      else if (m.type === 'practice') { const p = course.practices.find(x => x.id === m.practice); overlay(m.title, (b, close) => playPractice(b, p, pct => { close(); fin(pct ?? 80); }, 'Regresar a la planta')); }
      else if (m.type === 'lesson') overlay(m.title, (b, close) => MG.lesson(b, m, r => { close(); fin(r.score); }));
      else if (m.type === 'notify') overlay(m.title, (b, close) => MG.notify(b, m, r => { close(); fin(r.score); }, who(m.who || m.station)));
      else if (m.type === 'talk') fin(100);
    });
  }
  function gain(xp, why) { R.xpDay += xp; addXP(xp, why); }
  function completeMission(score) {
    const m = R.mission; if (!m) return;
    const xp = Math.round((m.xp || 100) * (0.4 + .6 * score / 100));
    R.kpi.missions.push({ id: m.id, title: m.title, score }); gstate().done[m.id] = Math.max(gstate().done[m.id] || 0, score); save();
    gain(xp, `misión: ${m.title}`); sfx(score >= 70 ? 'great' : 'ok'); if (score >= 90) confetti();
    R.mi++; R.mission = R.day.missions[R.mi] || null; R.toured = new Set();
    const msg = [].concat(m.debrief || (score >= 90 ? 'Excelente trabajo. Así se hace.' : score >= 70 ? 'Bien hecho. Hay detalles que pulir, pero vas bien.' : 'Lo terminaste, pero hay que repasar. Revisa la lección de este tema en la Academia.'));
    if (R.mission) msg.push(`Siguiente: ${R.mission.title}. Te marqué la estación en el mapa.`);
    say(msg);
  }

  // ---------------- HUD y mapa ----------------
  const fmtClock = () => { const h = 6 + Math.floor(R.t / R.shift * 8), mi = Math.floor((R.t / R.shift * 8 % 1) * 60); return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
  function fpy() { return R.kpi.produced ? Math.round(R.kpi.good / R.kpi.produced * 100) : 100; }
  function hud() {
    const k = R.kpi; const a = audioState();
    $('#gHud').innerHTML = `<div class="gh-l"><b>${esc(R.freeplay ? 'Turno libre' : R.day.title)}</b><span>🕒 ${fmtClock()}${R.t > R.shift ? ' · tiempo extra' : ''}</span></div>
      <div class="gh-k"><span title="Tarjetas producidas">📦 ${k.produced}</span><span title="Rendimiento a la primera">FPY ${fpy()}%</span><span title="Cola de NG en AOI" class="${R.queue.aoi >= 7 ? 'hot' : ''}">AOI NG ${R.queue.aoi}/10</span><span title="Cola de NG en AXI" class="${R.queue.axi >= 7 ? 'hot' : ''}">AXI NG ${R.queue.axi}/10</span><span title="Escapes" class="${k.escapes ? 'hot' : ''}">Escapes ${k.escapes}</span><span title="Línea parada">⏸ ${Math.round(k.downtime)} s</span><span>+${R.xpDay} XP</span></div>
      <div class="gh-r"><button class="btn ghost" id="gMus" title="Música">${a.musicOn ? '♫' : '♫̸'}</button><button class="btn ghost" id="gSfx" title="Efectos">${a.sfxOn ? '🔊' : '🔈'}</button><button class="btn ghost" id="gPause">Menú</button></div>
      ${R.lineStop ? `<div class="gh-stop">LÍNEA PARADA · ${esc(R.stopReason)}</div>` : ''}`;
    $('#gMus').onclick = () => setMusic(!audioState().musicOn); $('#gSfx').onclick = () => setSfx(!audioState().sfxOn); $('#gPause').onclick = () => titleScreen(true);
    const m = R.mission;
    $('#gTasks').innerHTML = R.freeplay ? `<b>Turno libre</b><p>Mantén la línea corriendo: atiende alarmas y colas de NG.</p>` :
      `<b>Tareas del día</b><ol>${R.day.missions.map((x, i) => `<li class="${i < R.mi ? 'done' : i === R.mi ? 'cur' : ''}">${esc(x.title)}${i === R.mi ? `<small>${esc(STN_NAMES[x.station] || '')}${x.type === 'tour' ? ` · ${R.toured.size}/${x.stations.length}` : ''}</small>` : ''}</li>`).join('')}</ol>${R.incidents.map(i => `<div class="ginc">⚠ ${esc(i.title)}</div>`).join('')}`;
  }
  function drawMap() {
    const c = $('#gMap'); if (!c) return; const x = c.getContext('2d'); const sx = v => (v + 50) / 104 * c.width, sz = v => (v + 24) / 52 * c.height;
    x.fillStyle = 'rgba(10,14,18,.85)'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#3a4652'; W.colliders.forEach(r => x.fillRect(sx(r.x0), sz(r.z0), Math.max(2, sx(r.x1) - sx(r.x0)), Math.max(2, sz(r.z1) - sz(r.z0))));
    for (const [id, s] of Object.entries(W.stations)) { const b = beacons[id]; if (b?.g.visible) { x.fillStyle = '#' + b.ring.material.color.getHexString(); x.beginPath(); x.arc(sx(s.pos.x), sz(s.pos.z), 5 + Math.sin(R.t * 6) * 1.5, 0, 7); x.fill(); } }
    const p = player.g.position; x.fillStyle = '#fff'; x.beginPath(); x.arc(sx(p.x), sz(p.z), 4, 0, 7); x.fill();
  }

  // ---------------- Inicio / fin de día ----------------
  function startDay(idx, free = false) {
    initAudio(); startMusic();
    R.freeplay = free; R.day = free ? { title: 'Turno libre', missions: [], shift: 420, ngRate: .1, incidents: 4 } : G.career.days[idx]; R.dayIdx = idx;
    R.mi = 0; R.mission = R.day.missions[0] || null; R.t = 0; R.shift = R.day.shift || 360; R.kpi = freshKPI(); R.incidents = []; R.queue = { aoi: 0, axi: 0 }; R.xpDay = 0; R.toured = new Set();
    const n = R.day.incidents || 0; R.incTimes = Array.from({ length: n }, (_, i) => R.shift * (.2 + .7 * (i + Math.random() * .6) / Math.max(1, n))).sort((a, b) => a - b);
    life.setExtras(free ? ['maintcrew'] : (R.day.extras || (R.day.chapter === 'c1' ? ['trainees'] : [])));
    player.g.position.set(-12, 0, 9); R.running = true; $('#gTitle').hidden = true;
    say(free ? ['Turno libre: hoy la línea es tuya. Atiende alarmas y no dejes que se llenen las colas de NG.'] : (idx === 0 ? [MENTOR.greeting] : []).concat(R.day.intro || []));
  }
  function endDay() {
    R.running = false; R.paused = true; $('#gDlg').hidden = true; stopMusic(); sfx('levelup');
    const k = R.kpi, f = fpy(), avg = k.missions.length ? k.missions.reduce((a, m) => a + m.score, 0) / k.missions.length : 80;
    const rev = k.reviewTotal ? k.reviewOK / k.reviewTotal * 100 : 100;
    const score = Math.round(avg * .5 + rev * .25 + Math.max(0, 100 - k.escapes * 15 - k.downtime / 3) * .25);
    const grade = score >= 93 ? 'S' : score >= 85 ? 'A' : score >= 72 ? 'B' : score >= 60 ? 'C' : 'D';
    const gs = gstate(); const key = R.freeplay ? 'free' : R.day.id;
    const order = 'DCBAS'; if (!gs.grades[key] || order.indexOf(grade) > order.indexOf(gs.grades[key])) gs.grades[key] = grade;
    if (!R.freeplay && grade !== 'D') gs.day = Math.max(gs.day, R.dayIdx + 1);
    save(); gain(grade === 'S' ? 300 : grade === 'A' ? 200 : grade === 'B' ? 120 : 60, `reporte de turno (${grade})`); if ('SA'.includes(grade)) confetti();
    const t = $('#gTitle'); t.hidden = false;
    t.innerHTML = `<div class="gt-card"><div class="row">${MENTOR_SVG.replace('<svg', '<svg width="64" height="64"')}<div><h2 style="margin:0">Reporte de turno</h2><span class="mut">${esc(R.freeplay ? 'Turno libre' : R.day.title)}</span></div><span class="sp"></span><div class="grade g${grade}">${grade}</div></div>
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))"><div class="kpi"><b>${k.produced}</b><span>tarjetas</span></div><div class="kpi"><b>${f}%</b><span>FPY</span></div><div class="kpi"><b>${k.escapes}</b><span>escapes</span></div><div class="kpi"><b>${Math.round(k.downtime)} s</b><span>línea parada</span></div><div class="kpi"><b>${Math.round(rev)}%</b><span>precisión en revisión</span></div><div class="kpi"><b>+${R.xpDay}</b><span>XP</span></div></div>
      ${k.missions.length ? `<ul>${k.missions.map(m => `<li>${esc(m.title)}: <b>${m.score}</b></li>`).join('')}</ul>` : ''}
      <p><b>${esc(MENTOR.name)}:</b> ${grade === 'S' ? 'Turno impecable. Así se cuida una línea.' : grade === 'A' ? 'Muy buen turno. Estás listo para más responsabilidad.' : grade === 'B' ? 'Buen turno. Repasa los puntos débiles y mañana sale mejor.' : 'Fue un turno difícil. Repite el día y repasa las lecciones; así se aprende.'}</p>
      <div class="row"><button class="btn pri" id="gtNext">${!R.freeplay && R.dayIdx + 1 < G.career.days.length && grade !== 'D' ? 'Siguiente día ▸' : 'Menú del juego'}</button><button class="btn" id="gtAgain">Repetir</button><a class="btn ghost" href="#mapa">Ir a la Academia</a></div></div>`;
    t.querySelector('#gtNext').onclick = () => (!R.freeplay && R.dayIdx + 1 < G.career.days.length && grade !== 'D') ? startDay(R.dayIdx + 1) : titleScreen();
    t.querySelector('#gtAgain').onclick = () => startDay(R.dayIdx, R.freeplay);
  }
  function titleScreen(paused = false) {
    const chapters = (G.career.chapters || []).concat([{ id: '_', title: 'Otros días' }]);
    R.paused = true; const t = $('#gTitle'); t.hidden = false; const gs = gstate();
    t.innerHTML = `<div class="gt-card"><span class="tag">Modo historia</span><h1 style="margin:8px 0 4px">Línea SMT: Técnico de Pruebas</h1>
      <p>Acabas de entrar como técnico de pruebas. ${esc(MENTOR.name)}, el ingeniero de pruebas, te capacita en SPI, AOI, AXI e ICT y después te acompaña en el día a día: mantenimientos que hay que coordinar con manufactura, NPIs, cambios de modelo y de fixtura, alarmas, debug y escapes. Cada capítulo es más difícil que el anterior.</p>
      <div class="gprog"><div style="width:${Math.round(Math.min(gs.day, G.career.days.length) / Math.max(1, G.career.days.length) * 100)}%"></div></div>
      ${chapters.map(ch => { const ds = G.career.days.map((d, i) => [d, i]).filter(([d]) => (d.chapter || '_') === ch.id); if (!ds.length) return '';
        const doneN = ds.filter(([d]) => gs.grades[d.id] && gs.grades[d.id] !== 'D').length;
        return `<div class="gchap"><div class="row"><h3 style="margin:0">${esc(ch.title)}</h3><span class="sp"></span><span class="mut">${doneN}/${ds.length}</span></div>${ch.summary ? `<p class="mut" style="margin:2px 0 8px">${esc(ch.summary)}</p>` : ''}<div class="gdays">${ds.map(([d, i]) => `<button class="gday" data-d="${i}" ${i > gs.day ? 'disabled' : ''}><b>${esc(d.title)}</b><span>${d.missions.length} misiones${gs.grades[d.id] ? ` · nota ${gs.grades[d.id]}` : ''}</span>${i > gs.day ? '<em>🔒</em>' : ''}</button>`).join('')}</div></div>`; }).join('')}
      <div class="gdays" style="margin-top:10px"><button class="gday" data-free="1"><b>Turno libre</b><span>Alarmas y colas de NG sin guion${gs.grades.free ? ` · nota ${gs.grades.free}` : ''}</span></button></div>
      <p class="mut">Controles: WASD o flechas para caminar (Shift corre), clic o toque en el piso para ir a un punto, E o Espacio para interactuar, rueda para acercar. Los audífonos ayudan.</p>
      <div class="row">${paused && R.running ? '<button class="btn pri" id="gtRes">Continuar turno</button>' : ''}<a class="btn ghost" href="#inicio">Salir</a></div></div>`;
    t.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { sfx('click'); startDay(+b.dataset.d); });
    t.querySelector('[data-free]').onclick = () => startDay(0, true);
    t.querySelector('#gtRes')?.addEventListener('click', () => { t.hidden = true; R.paused = false; initAudio(); startMusic(); });
  }
  // Cámara inicial cinematográfica mientras está el menú
  st.onFrame(t => { if (!R.running && $('#gTitle') && !$('#gTitle').hidden) { player.g.position.x = -12 + Math.sin(t * .1) * 20; } });
  // Ganchos para pruebas automáticas
  window.__tp = id => { const s = W.stations[id]; if (s) { player.g.position.set(s.pos.x, 0, s.pos.z); target = null; proximity(); } };
  window.__inc = () => spawnIncident();
  window.__end = () => endDay();
  window.__m = () => R.mission && { id: R.mission.id, station: R.mission.station, type: R.mission.type, stations: R.mission.stations, toured: [...R.toured], mi: R.mi };
  titleScreen();
  return st;
}
