// Vida en la planta: operadores con rutinas (cargar el ICT, surtir la línea, mover magazines), técnicos,
// visitantes, globos de diálogo y un tablero andon con los indicadores del turno.
import { THREE, box, at, mat, pcb } from '../stage.js';
import { character } from './world.js';

const OP = { coat: 0x36a3d6, hair: 0x1a1a1a };

function bubbleSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 144; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(3.6, 1.01, 1); s.position.y = 3.7; s.renderOrder = 7; s.visible = false;
  s.userData.set = text => {
    x.clearRect(0, 0, 512, 144); x.fillStyle = 'rgba(255,255,255,.96)'; x.beginPath(); x.roundRect(4, 4, 504, 112, 22); x.fill();
    x.beginPath(); x.moveTo(236, 114); x.lineTo(256, 140); x.lineTo(276, 114); x.fill();
    x.fillStyle = '#14202b'; x.font = '600 34px Barlow, Rajdhani, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = text.split(' '); const lines = ['']; for (const w of words) { const tr = (lines[lines.length - 1] + ' ' + w).trim(); if (x.measureText(tr).width > 470 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tr; }
    lines.slice(0, 2).forEach((l, i, a) => x.fillText(l, 256, 60 + (i - (a.length - 1) / 2) * 38));
    t.needsUpdate = true;
  };
  return s;
}

// NPC con un guion que se repite: pasos {go:[x,z]}, {wait:s}, {face:ang}, {fn}
function npc(S, look, pos, lines = [], script = null) {
  const c = character(look); c.g.position.set(pos[0], 0, pos[1]); S.add(c.g);
  const b = bubbleSprite(); c.g.add(b);
  const n = { c, lines, script, i: 0, wait: 0, speed: 2.2, talkT: 0, cool: Math.random() * 4, face: null, work: false };
  return n;
}
function step(n, dt) {
  const c = n.c; let moving = false;
  if (n.script && n.script.length) {
    const s = n.script[n.i % n.script.length];
    if (s.go) {
      const tg = typeof s.go === 'function' ? s.go(n) : s.go;
      const dx = tg[0] - c.g.position.x, dz = tg[1] - c.g.position.z, d = Math.hypot(dx, dz);
      if (d < .08) n.i++;
      else { const v = Math.min(d, n.speed * dt); c.g.position.x += dx / d * v; c.g.position.z += dz / d * v; c.g.rotation.y = Math.atan2(dx, dz); moving = true; }
    } else if (s.wait !== undefined) {
      if (n.wait <= 0) { n.wait = s.wait; if (s.face !== undefined) c.g.rotation.y = s.face; c.setWork(!!s.work); if (s.fn) s.fn(n); }
      n.wait -= dt; if (n.wait <= 0) { n.wait = 0; c.setWork(false); n.i++; }
    } else { if (s.fn) s.fn(n); n.i++; }
  } else if (n.work) c.setWork(true);
  c.walk(dt, moving);
}

const item = {
  board: () => { const g = pcb(1.0, .7, 6, 4).g; g.scale.setScalar(.75); return g; },
  magazine: () => { const g = new THREE.Group(); g.add(at(box(1.1, .9, .7, mat(0x8a939c, { metalness: .6, roughness: .4 })), 0, .1, 0)); for (let i = 0; i < 5; i++) g.add(at(box(1.0, .03, .66, mat(0x1f6b3a)), 0, -.25 + i * .15, 0)); return g; },
  reel: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .08, 20), mat(0x1d1d1d)); r.rotation.x = Math.PI / 2; r.position.set(0, .05 + i * .02, -.12 + i * .12); g.add(r); } return g; },
  toolbox: () => at(box(.7, .35, .3, mat(0xd62f2f)), 0, -.55, -.2),
  clipboard: () => at(box(.35, .45, .03, mat(0x8a6a4a)), 0, .1, 0),
};
const hold = (n, what) => { n.c.hold.clear(); if (what) n.c.hold.add(item[what]()); };

export function buildLife(st, W, LAYOUT) {
  const S = st.scene; const N = []; const extras = {};
  const add = (...a) => { const n = npc(S, ...a); N.push(n); return n; };

  // ---- Estantes de WIP y de tarjetas probadas junto al ICT ----
  const rack = (x, z, label, col) => { const g = new THREE.Group(); g.add(at(box(1.4, .08, .8, mat(0x6b7480)), 0, 1.0, 0), at(box(1.4, .08, .8, mat(0x6b7480)), 0, 1.7, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(at(box(.05, 1.8, .05, mat(0xaab1b8)), a * .67, .9, b * .37)));
    for (let i = 0; i < 3; i++) g.add(at(box(1.1, .7, .6, mat(col, { roughness: .6 })), 0, 1.4 + (i % 2) * 0, 0)); g.position.set(x, 0, z); S.add(g); W.colliders.push({ x0: x - .8, x1: x + .8, z0: z - .5, z1: z + .5 });
    const tag = at(box(1.2, .25, .02, mat(col, { emissive: col, emissiveIntensity: .3 })), 0, 2.05, .41); g.add(tag); return g; };
  const ict = W.stations.ict, ictM = ict.obj, F = ict.pos.z + 1.1, F2 = F - 1.3;
  rack(-0.6, F, 'WIP ICT', 0x3d8bff); rack(8.6, F, 'PASA', 0x36d07f);
  rack(-46.5, 6.8, 'Material', 0x9aa7b8);

  // ---- Operadora del ICT: carga la tarjeta, cierra la tapa, prueba y la clasifica ----
  if (ictM.parts.pcb) ictM.parts.pcb.visible = false;
  const ictS = { testing: false, res: 'pass' };
  const ictOp = add({ ...OP, cap: 0x2f6fd6 }, [4, F], ['Esta fixtura ya lleva muchos ciclos, ojalá revisen las puntas pronto.', '¿Viste el log? La R12 sale marginal a veces.', 'Si sale falla la mando a reparación con su ticket.', 'Ya casi acabo el WIP de este lote.']);
  const R = (n, ok, bad) => ictS.res === 'pass' ? ok : bad;
  ictOp.script = [
    { go: [0.6, F] }, { wait: 1, face: -Math.PI / 2, work: true, fn: n => hold(n, 'board') },
    { go: [4, F] }, { wait: .8, face: 0, work: true, fn: n => { hold(n, null); if (ictM.parts.pcb) ictM.parts.pcb.visible = true; } },
    { wait: 5.5, face: 0, fn: () => { ictS.testing = true; ictS.res = Math.random() < .8 ? 'pass' : 'fail'; } },
    { wait: 1, face: 0, fn: n => { ictS.testing = false; n.c.g.userData.say = ictS.res === 'pass' ? 'PASS. Va a empaque.' : 'FAIL. La mando a reparación.'; } },
    { wait: .5, face: 0, work: true, fn: n => { if (ictM.parts.pcb) ictM.parts.pcb.visible = false; hold(n, 'board'); } },
    { go: n => R(n, [7.4, F], [7.4, F2]) }, { go: n => R(n, [7.4, F], [11.8, F2]) }, { go: n => R(n, [7.4, F], [11.8, 12.4]) },
    { wait: .8, work: true, fn: n => { n.c.g.rotation.y = R(n, Math.PI / 2, 0); hold(n, null); } },
    { go: n => R(n, [7.4, F], [11.8, F2]) }, { go: n => R(n, [7.4, F], [4, F2]) }, { go: [4, F] },
  ];

  // ---- Operador del loader: trae magazines vacíos/llenos del estante de material ----
  add({ ...OP }, [-44, 4.5], ['Se están acabando los magazines, avísale a almacén.', 'La impresora pidió limpieza de stencil hace rato.', '¿Tú eres el nuevo de pruebas? ¡Bienvenido!'],
    [{ go: [-46.5, 5.9] }, { wait: 1.2, face: Math.PI, work: true, fn: n => hold(n, 'magazine') }, { go: [-44, 4.5] }, { go: [-41, 2.9] }, { wait: 2, face: Math.PI, work: true, fn: n => hold(n, null) }, { go: [-44, 4.5] }]);

  // ---- Surtidor de material con carretes para las colocadoras ----
  const feeder = add({ coat: 0x5c6b7a, hair: 0x3b2a1a, vest: 0xffd43b }, [-44, 5.4], ['Feeder 23 de la NXT con material nuevo.', 'Verifica el lote del carrete antes de montarlo.', 'Ya hice el cambio de modelo en las colocadoras.'],
    [{ go: [-44, 5.4] }, { wait: 1.5, fn: n => hold(n, 'reel') }, { go: [-27.5, 5.4] }, { go: [-27.5, 3.2] }, { wait: 3, face: Math.PI, work: true }, { go: [-23.5, 3.2] }, { wait: 3, face: Math.PI, work: true, fn: n => hold(n, null) }, { go: [-23.5, 5.4] }, { go: [-44, 5.4] }]);
  feeder.speed = 1.8;

  // ---- Operador del unloader: lleva magazines al WIP del ICT ----
  add({ ...OP, cap: 0x36d07f }, [8.2, 3.2], ['Otro magazine para ICT.', 'El AXI anda lento hoy, ¿no?', 'Ya van 40 tarjetas del lote.'],
    [{ go: [7.4, 3.0] }, { wait: 2, face: Math.PI, work: true, fn: n => hold(n, 'magazine') }, { go: [7.4, 6] }, { go: [-1.8, 8] }, { go: [-1.8, F] }, { wait: 1, face: Math.PI / 2, work: true, fn: n => hold(n, null) }, { go: [-1.8, 8] }, { go: [7.4, 6] }]);

  // ---- Técnico de mantenimiento en ronda, con casco y caja de herramientas ----
  const mt = add({ coat: 0x40484f, hair: 0x222222, helmet: true, vest: 0xff7a45 }, [18, 5.2], ['Ronda de mantenimiento: presión de aire en 0.5 MPa, todo bien.', 'Si ves fuga de aire en el AOI, repórtalo.', 'Revisé los ventiladores del horno.'],
    [{ go: [18, 5.2] }, { go: [18, -7] }, { wait: 2.5, face: -Math.PI / 2, work: true }, { go: [-45, -7] }, { go: [-45, 5.2] }, { wait: 2, face: Math.PI, work: true }, { go: [18, 5.2] }]);
  hold(mt, 'toolbox'); mt.speed = 1.6;

  // ---- Puestos fijos: inspectores, retrabajo, AOI de la línea 2 y un par platicando ----
  const fixed = [
    [{ ...OP }, [-36.5, 3.2], Math.PI, ['Revisando la impresión, a veces sale con poca pasta.']],
    [{ ...OP }, [-25.5, 3.2], Math.PI, ['La colocadora 1 marcó error de vacío, ya quedó.']],
    [{ ...OP }, [-14.5, 3.2], Math.PI, ['El perfil del horno está estable hoy.']],
    [{ ...OP, cap: 0xffb020 }, [3.6, 3.0], Math.PI, ['Reviso los NG del AXI: los voids del BGA siguen bajos.']],
    [{ coat: 0x36d07f, hair: 0x5a3220 }, [10.6, 12.4], 0, ['Retrabajo: cambio la R12 y la regreso a ICT.', 'Pásame las fallas con su ticket, porfa.']],
    [{ ...OP }, [-4.8, -12.6], 0, ['En la línea 2 corremos el modelo B esta semana.']],
    [{ coat: 0xf2f4f6, hair: 0x3b3b3b, glasses: true }, [21, 10], -Math.PI / 2, ['Ingeniería de proceso: ¿viste el SPC del SPI?']],
    [{ coat: 0x5c6b7a, hair: 0x1a1a1a }, [19.6, 10], Math.PI / 2, ['Producción quiere subir el takt time.']],
  ];
  for (const [look, p, rot, lines] of fixed) { const n = add(look, p, lines); n.c.g.rotation.y = rot; n.work = !/platic/.test(lines[0]) && p[0] < 19; W.colliders.push({ x0: p[0] - .5, x1: p[0] + .5, z0: p[1] - .5, z1: p[1] + .5 }); }

  // ---- Personajes extra según el capítulo o el día ----
  const mkExtra = (id) => {
    if (id === 'trainees') { // otros dos de nuevo ingreso en la capacitación
      return [add({ coat: 0x2f6fd6, hair: 0x5a3220 }, [-8.6, 12.2], ['También soy nuevo, ¿en qué estación te tocó?']), add({ coat: 0x2f6fd6, hair: 0x111111, glasses: true }, [-15.4, 12.2], ['El ingeniero dice que primero seguridad, luego máquinas.'])].map(n => { n.c.g.rotation.y = 0; return n; });
    }
    if (id === 'auditor') { const a = add({ coat: 0x2b2f36, hair: 0x6b6b6b, glasses: true }, [16, 4.6], ['Auditoría del cliente: ¿dónde está el registro del último mantenimiento?', 'Muéstrame cómo validan un programa nuevo.']); hold(a, 'clipboard'); a.speed = 1.3;
      a.script = [{ go: [16, 4.6] }, { go: [-6.5, 4.6] }, { wait: 4, face: Math.PI }, { go: [1.5, 4.6] }, { wait: 4, face: Math.PI }, { go: [4, 9.8] }, { wait: 4, face: 0 }, { go: [16, 4.6] }]; return [a]; }
    if (id === 'maintcrew') { const a = add({ coat: 0x40484f, hair: 0x111111, helmet: true, vest: 0xff7a45 }, [-8.2, 3.4], ['Te ayudo con el mantenimiento del AOI, yo traigo la aspiradora ESD.']); a.c.g.rotation.y = Math.PI; a.work = true; hold(a, 'toolbox'); return [a]; }
    if (id === 'customer') { const a = add({ coat: 0x1b2a4a, hair: 0x2b1d14 }, [14, 8], ['Vengo por el reporte del escape. ¿Ya tienen la causa raíz?']); a.c.g.rotation.y = -Math.PI / 2; return [a]; }
    return [];
  };
  const setExtras = list => {
    for (const [id, ns] of Object.entries(extras)) if (!list.includes(id)) { ns.forEach(n => { S.remove(n.c.g); N.splice(N.indexOf(n), 1); }); delete extras[id]; }
    for (const id of list) if (!extras[id]) extras[id] = mkExtra(id);
  };

  // ---- Tablero andon colgado sobre la línea ----
  const ac = document.createElement('canvas'); ac.width = 1024; ac.height = 256; const ax = ac.getContext('2d');
  const atex = new THREE.CanvasTexture(ac); atex.colorSpace = THREE.SRGBColorSpace;
  const andon = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: atex }));
  andon.position.set(-19, 7.2, -1.6); S.add(andon); S.add(at(box(8.3, 2.3, .1, mat(0x111)), -19, 7.2, -1.68));
  S.add(at(box(.05, 3, .05, mat(0x888)), -22.5, 9.7, -1.65), at(box(.05, 3, .05, mat(0x888)), -15.5, 9.7, -1.65));
  let andonT = 0;
  const drawAndon = k => {
    ax.fillStyle = '#05080b'; ax.fillRect(0, 0, 1024, 256);
    const run = k.state === 'run';
    ax.fillStyle = run ? '#1fae4b' : '#ff3b30'; ax.fillRect(0, 0, 1024, 54);
    ax.fillStyle = '#04150a'; ax.font = '800 40px Rajdhani, sans-serif'; ax.textBaseline = 'middle'; ax.fillText(`LÍNEA 1 · ${run ? 'CORRIENDO' : 'PARADA'}${k.reason ? ' · ' + k.reason : ''}`, 20, 29);
    ax.font = '700 34px Rajdhani, sans-serif'; ax.fillStyle = '#9fb0bf';
    const cells = [['META', k.goal], ['REAL', k.produced], ['FPY', k.fpy + '%'], ['NG AOI', k.aoi], ['NG AXI', k.axi], ['HORA', k.clock]];
    cells.forEach(([l, v], i) => { const x = 20 + i * 168; ax.fillStyle = '#9fb0bf'; ax.fillText(l, x, 92); ax.fillStyle = l === 'FPY' && parseInt(v) < 95 ? '#ffb020' : '#e8f0f8'; ax.font = '800 72px Rajdhani, sans-serif'; ax.fillText(String(v), x, 170); ax.font = '700 34px Rajdhani, sans-serif'; });
    atex.needsUpdate = true;
  };
  drawAndon({ state: 'run', goal: 0, produced: 0, fpy: 100, aoi: 0, axi: 0, clock: '06:00' });

  // ---- Actualización por cuadro ----
  const update = (t, dt, ctx = {}) => {
    for (const n of N) {
      step(n, dt);
      const b = n.c.g.children.find(o => o.isSprite && o.userData.set);
      // globo: cuando el jugador se acerca, o cuando el guion pide decir algo
      n.cool -= dt;
      const p = ctx.player; const near = p && Math.hypot(p.x - n.c.g.position.x, p.z - n.c.g.position.z) < 3;
      if (n.c.g.userData.say) { b.userData.set(n.c.g.userData.say); n.c.g.userData.say = null; n.talkT = 2.5; }
      else if (near && n.cool <= 0 && n.lines.length) { b.userData.set(n.lines[Math.floor(Math.random() * n.lines.length)]); n.talkT = 3.6; n.cool = 9; if (p) n.c.head.rotation.y = 0; }
      if (n.talkT > 0) { n.talkT -= dt; b.visible = true; } else b.visible = false;
      if (n.talkT <= 0 && !n.script) n.c.head.rotation.y = Math.sin(t * .6 + n.c.g.position.x) * .4;
    }
    // tapa del ICT y torre de luces durante la prueba
    const lidT = ictS.testing ? 0 : -1.1; if (ictM.parts.door) ictM.parts.door.rotation.x += (lidT - ictM.parts.door.rotation.x) * Math.min(1, dt * 4);
    if (ictM.parts.probes) ictM.parts.probes.position.y = ictS.testing ? Math.sin(t * 30) * .004 : 0;
    andonT -= dt; if (andonT <= 0 && ctx.andon) { andonT = 1; drawAndon(ctx.andon); }
  };
  return { update, setExtras, npcs: N };
}
