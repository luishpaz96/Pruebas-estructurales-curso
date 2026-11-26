// Interiores de las máquinas para el taller: partes internas que se pueden ver, seleccionar y conocer.
// En el ICT las tarjetas del testhead se sacan una por una para inspeccionarlas.
import { THREE, box, cyl, at, mat } from './stage.js';
import { highlight } from './machines.js';

export const INNER = {
  ipc: { name: 'PC industrial', desc: 'Corre el software de inspección, guarda programas y resultados y controla el movimiento. Tiene tarjeta de captura de las cámaras.', check: 'Ventiladores girando, filtros limpios, espacio libre en disco y respaldo de programas.' },
  ups: { name: 'UPS', desc: 'Respaldo de energía: permite apagar la PC en orden si se va la luz y evita archivos corruptos.', check: 'Indicador de batería sin alarma; prueba de autodiagnóstico según el plan.' },
  servo: { name: 'Drivers de servomotores', desc: 'Amplificadores que mueven los ejes X y Y del gantry con precisión de micras.', check: 'Sin códigos de error en el display, conectores firmes, sin polvo.' },
  psu: { name: 'Fuentes de poder', desc: 'Convierten la alimentación de línea a 24 V y 5 V para sensores, iluminación y control.', check: 'Voltajes de salida en rango (medir con multímetro) y ventilador funcionando.' },
  frl: { name: 'Unidad de aire (filtro-regulador)', desc: 'Filtra y regula el aire comprimido para topes, clamps y ajustes neumáticos.', check: 'Presión en el valor del manual, vaso sin agua ni aceite; purgar si hay condensado.' },
  convmotor: { name: 'Motor del transportador', desc: 'Mueve las bandas que llevan la tarjeta a la posición de inspección.', check: 'Sin ruido anormal; bandas con tensión correcta y sin desgaste.' },
  stopper: { name: 'Tope y sensores de tarjeta', desc: 'Detienen la tarjeta en posición y detectan entrada, posición y salida.', check: 'Limpiar el lente de los sensores; verificar que el tope suba y baje sin trabarse.' },
  ballscrew: { name: 'Guías lineales y tornillo de bolas', desc: 'Dan el movimiento suave y preciso del cabezal sobre los ejes.', check: 'Limpiar y lubricar con la grasa indicada por el fabricante; sin juego ni ruido.' },
  cablechain: { name: 'Portacables (cadena)', desc: 'Protege los cables de cámara, luz y motores mientras el cabezal se mueve.', check: 'Sin cables pellizcados ni eslabones rotos.' },
  hvgen: { name: 'Generador de alto voltaje', desc: 'Alimenta el tubo de rayos X con decenas a cientos de kV.', check: 'Sólo personal autorizado. Nunca abrir con el sistema energizado; revisar el registro de arcos (arcing).' },
  xctrl: { name: 'Controlador de rayos X', desc: 'Controla kV, corriente y encendido del tubo; habilita sólo con interlocks cerrados.', check: 'Sin alarmas; horas de uso del tubo registradas.' },
  shield: { name: 'Blindaje de plomo', desc: 'Láminas de plomo en el gabinete que contienen la radiación. Las mirillas y compuertas también están blindadas.', check: 'Sin golpes, tornillos faltantes ni huecos. Prueba de fugas con el medidor cada periodo.' },
  chiller: { name: 'Enfriamiento del tubo', desc: 'Retira el calor del tubo y del detector para mantener estable la imagen.', check: 'Nivel de refrigerante y flujo de aire correctos; filtros limpios.' },
  stage: { name: 'Mesa de movimiento (stage)', desc: 'Mueve la tarjeta entre el tubo y el detector para formar las rebanadas de la tomografía.', check: 'Recorrido libre, sin obstrucciones; calibración de posición según el plan.' },
  ict_control: { name: 'Tarjeta de control del módulo', desc: 'Coordina el módulo: recibe órdenes del controlador del sistema y sincroniza las tarjetas de pines y la ASRU.', check: 'Sin daño en conectores. Tras reemplazarla, correr el diagnóstico del testhead.' },
  ict_asru: { name: 'Tarjeta ASRU', desc: 'Analog Stimulus and Response Unit: genera las fuentes de voltaje y corriente y mide la respuesta en pruebas analógicas (resistores, capacitores, diodos).', check: 'Si fallan muchas pruebas analógicas en un mismo módulo, sospecha de la ASRU y corre el diagnóstico.' },
  ict_pin: { name: 'Tarjeta de pines', desc: 'Tiene los drivers, receptores y relevadores que conectan cada clavo del fixture con los recursos de medición. Cada tarjeta atiende un grupo de canales.', check: 'Relevadores sin daño, conector sin pines doblados. Usa pulsera ESD y el sistema apagado para sacarla.' },
  ict_psu: { name: 'Fuentes del testhead', desc: 'Alimentan los módulos y las fuentes DUT que energizan la tarjeta en las pruebas con poder.', check: 'Voltajes en rango y ventiladores funcionando.' },
  ict_valve: { name: 'Válvulas de vacío', desc: 'Abren y cierran el vacío que jala la tarjeta contra las agujas del fixture.', check: 'Sin fugas (escuchar silbido); sellos del fixture en buen estado.' },
  ict_interface: { name: 'Interfaz con el fixture (pines del testhead)', desc: 'Los resortes que conectan las tarjetas de pines con la parte baja del fixture.', check: 'Limpios y sin pines hundidos; una mala conexión aquí causa fallas de contacto en muchos nodos.' },
};

const tagI = (o, id) => { o.traverse(c => { c.userData.part = id; c.userData.inner = true; }); return o; };

// Textura de tarjeta electrónica (pin card, ASRU, control)
function cardTex(kind, n) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const x = c.getContext('2d');
  x.fillStyle = kind === 'ict_control' ? '#1d3f7a' : kind === 'ict_asru' ? '#6b1f2a' : '#1f6b3a'; x.fillRect(0, 0, 512, 384);
  x.fillStyle = '#c9a74a'; x.fillRect(0, 352, 512, 32); for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? '#e6c35a' : '#b18c32'; x.fillRect(4 + i * 8, 354, 5, 28); } // conector de borde
  let s = n * 97 + 13; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  if (kind === 'ict_pin') { for (let i = 0; i < 48; i++) { const cx = 20 + (i % 12) * 40, cy = 30 + Math.floor(i / 12) * 60; x.fillStyle = '#e8e8e8'; x.fillRect(cx, cy, 28, 40); x.fillStyle = '#9aa'; x.fillRect(cx + 4, cy + 4, 20, 6); } x.fillStyle = '#111'; for (let i = 0; i < 6; i++) x.fillRect(30 + i * 78, 280, 54, 40); }
  else { for (let i = 0; i < 10; i++) { x.fillStyle = '#111'; x.fillRect(30 + r() * 400, 30 + r() * 260, 40 + r() * 60, 30 + r() * 40); } for (let i = 0; i < 30; i++) { x.fillStyle = ['#d0d0d0', '#2a2a2a', '#c27a2c'][i % 3]; x.fillRect(r() * 480, r() * 320, 14, 8); } }
  if (kind === 'ict_asru') { x.fillStyle = '#c0c4c8'; x.fillRect(300, 40, 170, 120); x.fillStyle = '#444'; x.font = '700 22px sans-serif'; x.fillText('SHIELD', 340, 108); }
  x.fillStyle = '#fff'; x.font = '700 26px Rajdhani, sans-serif'; x.fillText(kind === 'ict_pin' ? `PIN ${n}` : kind === 'ict_asru' ? 'ASRU' : 'CONTROL', 14, 340);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData = { url: () => c.toDataURL() }; return t;
}

function electronics(G, x, y, z, w = .5, h = .6, d = .6, id = 'ipc', color = 0x2b2f33) {
  const g = new THREE.Group(); g.add(box(w, h, d, mat(color, { roughness: .5, metalness: .4 })));
  for (let i = 0; i < 4; i++) g.add(at(box(w * .8, .015, .02, mat(0x111)), 0, -h / 2 + .1 + i * .06, d / 2 + .005));
  g.add(at(cyl(.02, .02, .01, mat(0x36d07f, { emissive: 0x36d07f, emissiveIntensity: 1 })).rotateX(Math.PI / 2), w / 2 - .06, h / 2 - .06, d / 2 + .01));
  g.position.set(x, y, z); G.add(tagI(g, id)); return g;
}

// Interior de AOI / SPI (mismas bases: gabinete inferior con electrónica, aire y transportador)
function aoiInterior(G, dims) {
  const { W, D } = dims, conv = 1.8;
  electronics(G, -W / 2 + .45, .75, .1, .42, .7, .8, 'ipc');
  electronics(G, .25, .55, -D / 2 + .55, .45, .4, .6, 'ups', 0x1d1f22);
  for (let i = 0; i < 3; i++) electronics(G, -.1 + i * .22, 1.25, -D / 2 + .25, .16, .45, .3, 'servo', 0x3a4149);
  electronics(G, .55, 1.25, -D / 2 + .25, .4, .3, .3, 'psu', 0x8d949b);
  const frl = new THREE.Group(); frl.add(box(.18, .18, .18, mat(0x3d8bff))); frl.add(at(cyl(.06, .05, .22, new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: .6, roughness: .1 })), 0, -.2, 0)); frl.add(at(cyl(.07, .07, .03, mat(0xffffff)), 0, .05, .1).rotateX(Math.PI / 2));
  frl.position.set(W / 2 - .3, 1.1, -D / 2 + .35); G.add(tagI(frl, 'frl'));
  const mot = new THREE.Group(); mot.add(cyl(.08, .08, .25, mat(0x2b2f33), 16).rotateZ(Math.PI / 2)); mot.add(at(box(.12, .12, .12, mat(0x555)), .18, 0, 0)); mot.position.set(-W / 2 + .4, conv - .25, -.45); G.add(tagI(mot, 'convmotor'));
  const stp = new THREE.Group(); stp.add(box(.08, .2, .08, mat(0xffb020))); stp.add(at(box(.05, .05, .05, mat(0x111)), .15, .1, 0)); stp.position.set(.4, conv - .05, -.3); G.add(tagI(stp, 'stopper'));
  const bs = new THREE.Group(); [-1, 1].forEach(s => { bs.add(at(box(.05, .05, D - .7, mat(0xaab1b8, { metalness: .9, roughness: .2 })), s * (W / 2 - .25), conv + 1.08, 0)); }); bs.add(at(cyl(.025, .025, W - .5, mat(0xd8d8d8, { metalness: .9, roughness: .15 }), 10).rotateZ(Math.PI / 2), 0, conv + 1.15, -.15)); G.add(tagI(bs, 'ballscrew'));
  const ch = new THREE.Group(); for (let i = 0; i < 14; i++) ch.add(at(box(.1, .05, .08, mat(0x1a1a1a)), -W / 2 + .3 + i * .1, conv + 1.32, -D / 2 + .4)); G.add(tagI(ch, 'cablechain'));
}

function axiInterior(G, dims) {
  const { W, D } = dims, ped = .9;
  electronics(G, -W / 2 + .7, ped + .55, -D / 2 + .7, .6, .8, .6, 'hvgen', 0x3b4f6b);
  electronics(G, W / 2 - .7, ped + .45, -D / 2 + .6, .5, .5, .45, 'xctrl', 0x2b2f33);
  electronics(G, W / 2 - .7, ped + .45, D / 2 - .9, .5, .6, .5, 'chiller', 0x5d6a74);
  electronics(G, -W / 2 + .7, ped + .3, D / 2 - .9, .5, .4, .5, 'psu', 0x8d949b);
  const sh = new THREE.Group(); const lead = new THREE.MeshStandardMaterial({ color: 0x6a7a8c, roughness: .6, metalness: .6, transparent: true, opacity: .28, depthWrite: false });
  [[-1, 0], [1, 0]].forEach(([s]) => sh.add(at(box(.03, 2.3, D - .3, lead), s * (W / 2 - .12), ped + 1.3, 0))); sh.add(at(box(W - .3, 2.3, .03, lead), 0, ped + 1.3, -D / 2 + .12));
  G.add(tagI(sh, 'shield'));
  const stg = new THREE.Group(); stg.add(box(1.6, .06, 1.2, mat(0x8d949b, { metalness: .6 }))); stg.add(at(box(1.6, .05, .05, mat(0xaab1b8, { metalness: .9 })), 0, .05, -.5), at(box(1.6, .05, .05, mat(0xaab1b8, { metalness: .9 })), 0, .05, .5)); stg.position.set(0, 1.45, 0); G.add(tagI(stg, 'stage'));
}

function ictInterior(G, dims, cards) {
  const { W, D } = dims;
  electronics(G, -.8, .5, -.4, .7, .35, .7, 'ict_psu', 0x8d949b); electronics(G, .1, .5, -.4, .7, .35, .7, 'ict_psu', 0x8d949b);
  const v = new THREE.Group(); for (let i = 0; i < 3; i++) { v.add(at(box(.12, .12, .12, mat(0x3d8bff)), i * .18, 0, 0)); v.add(at(cyl(.025, .025, .2, mat(0xaab1b8, { metalness: .9 }), 8), i * .18, .15, 0)); } v.position.set(.9, .55, .3); G.add(tagI(v, 'ict_valve'));
  const ifc = new THREE.Group(); const pinM = mat(0xd4af37, { metalness: .9, roughness: .2 }); for (let i = 0; i < 44; i++) ifc.add(at(cyl(.008, .008, .06, pinM, 5), -1.2 + (i % 44) * (2.4 / 43), 0, 0)); [-0.25, .25].forEach(z => { const r = ifc.clone(); r.position.z = z; ifc.add(r); }); ifc.position.set(0, 1.9, .05); G.add(tagI(ifc, 'ict_interface'));
  // Jaula de tarjetas: 4 módulos × (control, ASRU, 9 tarjetas de pines), se sacan hacia arriba
  const cage = new THREE.Group(); cage.add(at(box(2.5, .05, 1.3, mat(0x555c63, { metalness: .6 })), 0, .72, 0));
  for (let m = 0; m < 4; m++) {
    const mx = -1.2 + m * .6 + .03;
    cage.add(at(box(.02, .95, 1.3, mat(0x777f87, { metalness: .6 })), mx - .03, 1.2, 0));
    for (let k = 0; k < 11; k++) {
      const kind = k === 0 ? 'ict_control' : k === 1 ? 'ict_asru' : 'ict_pin';
      const tex = cardTex(kind, m * 11 + k);
      const card = new THREE.Mesh(new THREE.BoxGeometry(.018, .85, 1.2), [mat(0x1f6b3a), mat(0x1f6b3a), mat(0x222), mat(0x222), new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex })]);
      card.material[0] = card.material[1] = new THREE.MeshStandardMaterial({ map: tex }); card.material[4] = card.material[5] = mat(0x111);
      const g = new THREE.Group(); g.add(card); g.add(at(box(.03, .08, .12, mat(0xd62828)), 0, .46, .5)); // jaladera
      g.position.set(mx + .02 + k * .05, 1.2, 0); g.userData.home = 1.2; g.userData.out = false;
      g.userData.info = { kind, module: m, slot: k, tex, label: kind === 'ict_control' ? `Control · módulo ${m}` : kind === 'ict_asru' ? `ASRU · módulo ${m}` : `Tarjeta de pines ${k - 1} · módulo ${m}` };
      tagI(g, kind); g.traverse(c => { c.userData.card = g; }); cage.add(g); cards.push(g);
    }
  }
  G.add(cage);
}

// Agrega el interior al modelo real. Devuelve un controlador para la vista "por dentro" y la exploración.
export function addInterior(kind, m) {
  const cards = [];
  if (kind === 'zenith' || kind === 'v510' || kind === 'ky8030') aoiInterior(m.group, m.dims);
  else if (kind === 'v810') axiInterior(m.group, m.dims);
  else if (kind === 'hp3070') ictInterior(m.group, m.dims, cards);
  m.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  // Cubiertas: todo lo que no es pieza interna ni pieza de mantenimiento (y las puertas/paneles)
  const shells = []; m.group.traverse(o => { if (!o.isMesh || o.userData.inner) return; const p = o.userData.part; if (!p || p === 'door' || p === 'pc_ups') shells.push(o); });
  let ghost = false;
  const setGhost = on => {
    ghost = on;
    for (const o of shells) {
      if (on) { if (!o.userData._m) { o.userData._m = o.material; o.material = [].concat(o.material).map(x => { const c = x.clone(); c.transparent = true; c.opacity = Math.min(x.opacity ?? 1, .12); c.depthWrite = false; return c; }); if (!Array.isArray(o.userData._m)) o.material = o.material[0]; } o.userData.ghost = true; o.castShadow = false; }
      else if (o.userData._m) { o.material = o.userData._m; o.userData._m = null; o.userData.ghost = false; o.castShadow = true; }
    }
  };
  // Sacar / meter una tarjeta del ICT (animado)
  const moving = [];
  const toggleCard = g => { g.userData.out = !g.userData.out; moving.push(g); highlight(g, g.userData.out, 0xffb020); return g.userData.out; };
  const update = dt => { for (let i = moving.length - 1; i >= 0; i--) { const g = moving[i]; const to = g.userData.home + (g.userData.out ? 1.15 : 0); g.position.y += (to - g.position.y) * Math.min(1, dt * 6); if (Math.abs(to - g.position.y) < .002) { g.position.y = to; moving.splice(i, 1); } } };
  return { setGhost, isGhost: () => ghost, cards, toggleCard, update, hasInterior: shells.length > 0 };
}
