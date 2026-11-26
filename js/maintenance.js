// Taller de mantenimiento: modelo 3D de la máquina, checklist de seguridad y pasos guiados (clic en pieza + acción).
import { createStage, THREE } from './stage.js';
import { buildMachine, animateMachine, highlight, pick, PART_NAMES, ACTION_NAMES } from './machines.js';
import { buildReal } from './models.js';
import { addInterior, INNER } from './interior.js';
import { esc, sfx, toast, dialog, confetti, shuffle } from './fx.js';
import { state, save, addXP, course } from './store.js';

const SAFE_FIRST = new Set(['emergency_stop', 'interlock']);

export function runMaintenance(root, proc, onExit, onResult) {
  const mach = course.machines.find(m => m.id === proc.machine) || { model: 'aoi', color: '#3d8bff', name: '' };
  root.innerHTML = `<div class="row"><button class="btn ghost" id="mxBack">← Taller</button><span class="tag" style="color:${mach.color}">${esc(mach.name)}</span><span class="tag">${esc(proc.frequency || '')}</span></div>
  <h1 style="margin-top:10px">${esc(proc.title)}</h1>
  <div class="split"><div><div class="stage" id="mxStage"><div class="cap" id="mxCap"></div><div class="ctrl"><button class="btn" id="mxReset">Centrar vista</button><button class="btn" id="mxGhost" hidden>👁 Ver por dentro</button><button class="btn" id="mxExp" hidden>🔍 Explorar piezas</button><button class="btn" id="mxPedal" hidden>🦶 Pedal (vacío)</button><button class="btn" id="mxFix" hidden>Retirar fixture</button><button class="btn" id="mxRot" hidden>🔄 Botón de giro (atrás)</button></div><div class="mxinfo" id="mxInfo" hidden></div></div>
  <p class="mut" style="margin-top:8px">Gira con un dedo o el mouse, acerca con dos dedos o la rueda. Pasa el cursor para ver el nombre de cada pieza.</p></div>
  <div class="card" id="mxPanel"></div></div>`;
  root.querySelector('#mxBack').onclick = onExit;
  const st = createStage(root.querySelector('#mxStage'), { cam: [4.4, 3.4, 5.2], target: [0, 1.3, 0] });
  const m = mach.model3d ? buildReal(mach.model3d, mach.color) : buildMachine(mach.model || 'aoi', mach.color); st.scene.add(m.group);
  st.onFrame(t => animateMachine(m, t, mach.model));
  // Interior: cubiertas transparentes, piezas internas y (en el ICT) tarjetas que se sacan
  const inner = mach.model3d ? addInterior(mach.model3d, m) : null;
  const nameOf = (part, obj) => obj?.userData?.card?.userData.info.label || PART_NAMES[part] || INNER[part]?.name || part;
  let exploring = false;
  const info = root.querySelector('#mxInfo'), gB = root.querySelector('#mxGhost'), eB = root.querySelector('#mxExp');
  if (inner) {
    gB.hidden = eB.hidden = false; st.onFrame((t, dt) => inner.update(dt));
    const setG = on => { inner.setGhost(on); gB.textContent = on ? '🧱 Poner cubiertas' : '👁 Ver por dentro'; gB.classList.toggle('pri', on);
    };
    gB.onclick = () => { sfx('click'); setG(!inner.isGhost()); };
    eB.onclick = () => { exploring = !exploring; eB.classList.toggle('pri', exploring); sfx('click'); if (exploring && !inner.isGhost()) setG(true);
      info.hidden = !exploring; info.innerHTML = exploring ? `<b>Modo exploración</b><p>Haz clic en cualquier pieza interna para ver qué es y qué se revisa en el mantenimiento.${inner.cards.length ? ' En el ICT, haz clic en una tarjeta del testhead para sacarla e inspeccionarla.' : ''}</p>` : ''; };
  }
  // ICT: el pedal enclava/desenclava el fixture con vacío; el botón trasero gira la cabeza a posición de servicio
  const pB = root.querySelector('#mxPedal'), fB = root.querySelector('#mxFix'), rB = root.querySelector('#mxRot');
  const ICT = { fx: 'locked' };
  const say = (t, html, bad) => { info.hidden = false; info.innerHTML = `<div class="row"><b>${esc(t)}</b><span class="sp"></span><button class="btn ghost" id="mxIx">✕</button></div>${html}`; info.querySelector('#mxIx').onclick = () => { info.hidden = true; }; sfx(bad ? 'bad' : 'step'); };
  const fxParts = ['fixture', 'door', 'pcb', 'probes'].map(k => m.parts[k]).filter(Boolean);
  const fxHome = m.parts.fixture ? m.parts.fixture.position.y : 0;
  function ictUI() {
    const rs = inner.rotState();
    pB.textContent = ICT.fx === 'locked' ? '🦶 Pedal: desenclavar fixture' : '🦶 Pedal: enclavar fixture';
    fB.textContent = ICT.fx === 'removed' ? 'Instalar fixture' : 'Retirar fixture';
    rB.textContent = rs === 'service' ? '🔄 Botón trasero: regresar cabeza' : '🔄 Botón trasero: girar cabeza';
    fxParts.forEach(o => { o.visible = ICT.fx !== 'removed'; }); if (m.parts.fixture) m.parts.fixture.position.y = fxHome + (ICT.fx === 'unlocked' ? .04 : 0);
  }
  function pedal() {
    if (inner.rotState() !== 'test') return say('Pedal', '<p>El pedal maneja el vacío que enclava el fixture. Sólo sirve con la cabeza horizontal (posición de prueba).</p>', true);
    if (ICT.fx === 'removed') return say('Pedal', '<p>No hay fixture instalado. Instálalo primero y luego enclávalo con el pedal.</p>', true);
    ICT.fx = ICT.fx === 'locked' ? 'unlocked' : 'locked'; ictUI();
    say(ICT.fx === 'locked' ? 'Fixture enclavado' : 'Fixture desenclavado', ICT.fx === 'locked' ? '<p>El vacío sujeta el fixture contra la cabeza. Ya se puede probar.</p>' : '<p>El fixture quedó libre. Ya lo puedes retirar con cuidado (es pesado: entre dos personas o con el carro).</p>');
  }
  function fixture() {
    if (inner.rotState() !== 'test') return say('Fixture', '<p>Regresa primero la cabeza a posición horizontal con el botón trasero.</p>', true);
    if (ICT.fx === 'locked') return say('Fixture', '<p>Está enclavado con vacío. Pisa el pedal para desenclavarlo antes de retirarlo.</p>', true);
    ICT.fx = ICT.fx === 'removed' ? 'unlocked' : 'removed'; ictUI();
    say(ICT.fx === 'removed' ? 'Fixture retirado' : 'Fixture instalado', ICT.fx === 'removed' ? '<p>La cabeza quedó libre: ya puedes ver los pines de interfaz y girarla con el botón trasero.</p>' : '<p>Alinea el fixture con los pernos guía y enclávalo con el pedal.</p>');
  }
  function rotateHead() {
    const rs = inner.rotState(); if (rs === 'moving') return;
    if (rs === 'service') {
      const out = inner.cards.filter(c => c.userData.out);
      if (out.length) { say('Faltan tarjetas', `<p>Hay ${out.length} tarjeta(s) fuera de su ranura. Métela(s) antes de regresar la cabeza.</p><button class="btn pri" id="mxAll">Meter todas las tarjetas</button>`, true); info.querySelector('#mxAll').onclick = () => { out.forEach(c => inner.toggleCard(c)); rotateHead(); }; return; }
      inner.rotate(0); setTimeout(ictUI, 50); rB.textContent = '🔄 Botón trasero: girar cabeza';
      return say('Regresando la cabeza', '<p>Mantén el botón hasta que la cabeza quede horizontal. Después instala el fixture, enclávalo con el pedal, enciende la cabeza (testhead power on) y corre el diagnóstico si cambiaste alguna tarjeta.</p>');
    }
    if (ICT.fx !== 'removed') return say('Botón de giro', '<p>Con el fixture puesto la cabeza no se gira. Desenclava el fixture con el pedal y retíralo primero.</p>', true);
    const items = ['Cabeza apagada (testhead power off)', 'Pulsera antiestática conectada', 'Nadie con las manos cerca de la cabeza'];
    say('Antes de girar la cabeza', `${items.map((t, k) => `<label class="check"><input type="checkbox" data-pc="${k}"> <span>${esc(t)}</span></label>`).join('')}<button class="btn pri" id="mxGo" disabled>Presionar el botón trasero</button>`);
    const bx = [...info.querySelectorAll('[data-pc]')], go = info.querySelector('#mxGo'); bx.forEach(b => b.onchange = () => { go.disabled = !bx.every(x => x.checked); });
    go.onclick = () => { if (!inner.isGhost()) gB.click(); inner.rotate(1); rB.textContent = '🔄 Botón trasero: regresar cabeza';
      say('Girando la cabeza', '<p>La cabeza queda vertical con las tarjetas hacia ti. Haz clic en una tarjeta para sacarla y otra vez para meterla. En cada módulo: ASRU en la ranura 1, control card en la 6 y pin cards en las demás.</p>'); };
  }
  if (inner?.head) { [pB, fB, rB].forEach(b => b.hidden = false); pB.onclick = pedal; fB.onclick = fixture; rB.onclick = rotateHead; ictUI(); }
  function explore(h) {
    if (h.part === 'pedal') return pedal();
    if (h.part === 'rot_button') return rotateHead();
    const id = h.part, card = h.obj?.userData?.card || (h.obj && (() => { let o = h.obj; while (o && !o.userData.card) o = o.parent; return o?.userData.card; })());
    const d = INNER[id] || { name: PART_NAMES[id] || id, desc: 'Pieza de mantenimiento: búscala en los pasos del procedimiento.', check: '' };
    let extra = '';
    if (card && inner.head && inner.rotState() !== 'service') { sfx('bad'); info.hidden = false; info.innerHTML = `<b>${esc(card.userData.info.label)}</b><p>Para sacar tarjetas: desenclava el fixture con el pedal, retíralo y gira la cabeza con el botón trasero (🔄).</p><p>${esc(d.desc)}</p>`; return; }
    if (card) { const out = inner.toggleCard(card); sfx(out ? 'open' : 'click'); const ci = card.userData.info;
      extra = out ? `<div class="mxcard"><img alt="${ci.label}" src="${ci.tex.userData.url()}"></div><p class="mut">Módulo ${ci.module}, ranura ${ci.slot}. Vuelve a hacer clic en la tarjeta para meterla.</p>` : '<p class="mut">Tarjeta instalada de nuevo en su ranura.</p>'; }
    else { sfx('click'); if (h.obj) { highlight(h.obj, true, 0xffb020); setTimeout(() => highlight(h.obj, false), 900); } }
    info.hidden = false; info.innerHTML = `<div class="row"><b>${esc(card ? card.userData.info.label : d.name)}</b><span class="sp"></span><button class="btn ghost" id="mxIx">✕</button></div><p>${esc(d.desc)}</p>${d.check ? `<p><b>En el mantenimiento:</b> ${esc(d.check)}</p>` : ''}${extra}`;
    info.querySelector('#mxIx').onclick = () => { info.hidden = true; };
  }
  root.querySelector('#mxReset').onclick = () => { st.camera.position.set(4.4, 3.4, 5.2); st.controls.target.set(0, 1.3, 0); };
  const cap = root.querySelector('#mxCap'), panel = root.querySelector('#mxPanel');
  const steps = proc.steps || [];
  let i = -1, errors = 0, safetyFault = false, chosen = null, hover = null, estopDone = false;

  // Animaciones de acciones
  const anims = [];
  st.onFrame((t, dt) => { for (const a of anims) a.k = Math.min(1, a.k + dt * 1.5); anims.forEach(a => a.f(a.k)); });
  function play(part, action) {
    const o = m.parts[part];
    if (part === 'door') { const from = m.parts.door.rotation.x, to = from < -0.5 ? 0 : -1.25; anims.push({ k: 0, f: k => m.parts.door.rotation.x = from + (to - from) * k }); }
    else if (part === 'emergency_stop') { anims.push({ k: 0, f: k => m.parts.mush.position.z = .07 - .04 * k }); m.frozen = true; m.parts.lamps?.forEach((l, j) => l.material.emissiveIntensity = j === 0 ? 1.2 : .1); }
    else if (o) {
      const col = { clean: 0x4fd1ff, lubricate: 0xffd43b, replace: 0x36d07f, calibrate: 0xa77bff, measure: 0xffffff, inspect: 0x3d8bff, toggle: 0xff5a5f }[action] || 0x36d07f;
      highlight(o, true, col); anims.push({ k: 0, f: k => { o.scale.setScalar(1 + Math.sin(k * Math.PI) * .08); if (k >= 1) highlight(o, false); } });
    }
  }

  // Hover y clic sobre piezas
  const canvas = st.renderer.domElement;
  const tip = document.createElement('div'); tip.className = 'lbl'; tip.style.display = 'none'; root.querySelector('#mxStage .labels').appendChild(tip);
  canvas.addEventListener('pointermove', ev => {
    const h = pick(st, ev, m.group);
    const obj = h ? m.parts[h.part] : null;
    if (hover !== obj) { if (hover && hover !== chosenObj()) highlight(hover, false); hover = obj; if (hover) highlight(hover, true, 0x3d8bff); }
    if (h) { const r = canvas.getBoundingClientRect(); tip.style.display = ''; tip.textContent = nameOf(h.part, h.obj); tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top) + 'px'; } else tip.style.display = 'none';
  });
  let down = null;
  canvas.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
  canvas.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return; // fue un arrastre
    const h = pick(st, ev, m.group); if (h && (exploring || (inner?.head && (h.obj?.userData?.card || ['pedal', 'rot_button'].includes(h.part) || (() => { let o = h.obj; while (o && !o.userData.card) o = o.parent; return !!o; })())))) return explore(h);
    if (!h || i < 0 || i >= steps.length) return;
    selectPart(h.part);
  });
  const chosenObj = () => chosen ? m.parts[chosen] : null;

  function selectPart(part) {
    if (chosen && m.parts[chosen]) highlight(m.parts[chosen], false);
    chosen = part; if (m.parts[part]) highlight(m.parts[part], true, 0xffb020);
    sfx('click'); renderStep();
  }

  function safety() {
    const items = proc.safety?.length ? proc.safety : ['Avisa al supervisor y a producción antes de detener la máquina.', 'Usa el equipo de protección indicado (pulsera antiestática, lentes).'];
    panel.innerHTML = `<h3>Antes de empezar: seguridad</h3><p class="mut">Confirma cada punto. Es parte de la calificación.</p>
      ${items.map((s, k) => `<label class="check"><input type="checkbox" data-s="${k}"> <span>${esc(s)}</span></label>`).join('')}
      <button class="btn pri" id="go" disabled>Comenzar procedimiento</button>`;
    const boxes = [...panel.querySelectorAll('[data-s]')]; const go = panel.querySelector('#go');
    boxes.forEach(b => b.onchange = () => { go.disabled = !boxes.every(x => x.checked); });
    go.onclick = () => { i = 0; sfx('step'); renderStep(); };
    cap.textContent = 'Lista de seguridad';
  }

  function renderStep() {
    if (i >= steps.length) return finish();
    const s = steps[i];
    cap.textContent = `Paso ${i + 1}/${steps.length}: ${PART_NAMES[s.part] ? 'ubica la pieza en el modelo' : ''}`;
    const actions = shuffle(Object.keys(ACTION_NAMES), i + 3);
    panel.innerHTML = `<h3>Paso ${i + 1} de ${steps.length}</h3><p>${esc(s.text)}</p>
      <p><b>1.</b> Haz clic en la pieza del modelo 3D. ${chosen ? `Seleccionada: <span class="tag" style="color:var(--warn)">${esc(PART_NAMES[chosen] || chosen)}</span>` : '<span class="mut">Sin seleccionar</span>'}</p>
      <details><summary class="mut" style="cursor:pointer;min-height:32px">No la encuentro: elegir de la lista</summary><div class="actions" style="margin-top:6px">${Object.keys(m.parts).filter(k => PART_NAMES[k]).map(k => `<button class="btn" data-part="${k}">${esc(PART_NAMES[k])}</button>`).join('')}</div></details>
      <p style="margin-top:10px"><b>2.</b> Elige la acción:</p><div class="actions">${actions.map(a => `<button class="btn" data-act="${a}" ${chosen ? '' : 'disabled'}>${esc(ACTION_NAMES[a])}</button>`).join('')}</div>
      <ol class="steps" style="margin-top:14px">${steps.map((x, k) => `<li class="${k < i ? 'done' : k === i ? 'cur' : ''}">${k <= i ? esc(x.text.slice(0, 70)) + (x.text.length > 70 ? '…' : '') : 'Paso ' + (k + 1)}</li>`).join('')}</ol>
      <p class="mut">Errores: ${errors}${safetyFault ? ' · falta de seguridad registrada' : ''}</p>`;
    panel.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { errors += .5; selectPart(b.dataset.part); });
    panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act));
  }

  function act(action) {
    const s = steps[i];
    // Regla de seguridad: tocar piezas internas antes de accionar el paro/interlock cuando el procedimiento lo pide
    const needsSafe = steps.some(x => SAFE_FIRST.has(x.part)) && !estopDone && !SAFE_FIRST.has(s.part) && steps.findIndex(x => SAFE_FIRST.has(x.part)) < i;
    if (chosen === s.part && action === s.action) {
      if (SAFE_FIRST.has(s.part)) estopDone = true;
      play(s.part, action); sfx('ok'); toast(`<b>✓</b> ${esc(ACTION_NAMES[action])}: ${esc(PART_NAMES[s.part] || s.part)}`, 1800);
      if (m.parts[chosen]) highlight(m.parts[chosen], false); chosen = null; i++; renderStep();
    } else {
      errors++; sfx('bad');
      const why = chosen !== s.part ? `Esa no es la pieza. Busca: ${PART_NAMES[s.part] || s.part}.` : `La pieza es correcta, pero la acción no. Lee de nuevo el paso.`;
      if (needsSafe) safetyFault = true;
      toast(why, 3000);
      renderStep();
    }
  }

  async function finish() {
    const pct = Math.max(0, Math.round(100 - errors * 8 - (safetyFault ? 20 : 0)));
    const S = state(); const prev = S.maint[proc.id]?.best || 0;
    S.maint[proc.id] = { best: Math.max(prev, pct), safe: !safetyFault || S.maint[proc.id]?.safe, at: Date.now() }; save();
    cap.textContent = 'Procedimiento terminado';
    if (pct >= 70) confetti();
    addXP(prev ? (pct > prev ? 25 : 5) : 60 + pct, 'por el mantenimiento');
    panel.innerHTML = `<h3>Procedimiento terminado</h3><div class="score ${pct >= 70 ? 'pass' : 'fail'}">${pct}</div><p>${errors} errores${safetyFault ? ' y una falta de seguridad' : ''}. ${pct === 100 ? 'Impecable.' : 'Repite para subir tu marca.'}</p>
      <div class="row"><button class="btn pri" id="again">Repetir</button><button class="btn" id="out">Volver al taller</button></div>`;
    panel.querySelector('#again').onclick = () => { st.dispose(); runMaintenance(root, proc, onExit, onResult); };
    onResult && onResult(pct, safetyFault);
    panel.querySelector('#out').onclick = onExit;
  }

  safety();
  return st;
}
