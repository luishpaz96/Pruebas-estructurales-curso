// Taller de mantenimiento: modelo 3D de la máquina, checklist de seguridad y pasos guiados (clic en pieza + acción).
import { createStage, THREE } from './stage.js';
import { buildMachine, animateMachine, highlight, pick, PART_NAMES, ACTION_NAMES } from './machines.js';
import { esc, sfx, toast, dialog, confetti, shuffle } from './fx.js';
import { state, save, addXP, course } from './store.js';

const SAFE_FIRST = new Set(['emergency_stop', 'interlock']);

export function runMaintenance(root, proc, onExit) {
  const mach = course.machines.find(m => m.id === proc.machine) || { model: 'aoi', color: '#3d8bff', name: '' };
  root.innerHTML = `<div class="row"><button class="btn ghost" id="mxBack">← Taller</button><span class="tag" style="color:${mach.color}">${esc(mach.name)}</span><span class="tag">${esc(proc.frequency || '')}</span></div>
  <h1 style="margin-top:10px">${esc(proc.title)}</h1>
  <div class="split"><div><div class="stage" id="mxStage"><div class="cap" id="mxCap"></div><div class="ctrl"><button class="btn" id="mxReset">Centrar vista</button></div></div>
  <p class="mut" style="margin-top:8px">Gira con un dedo o el mouse, acerca con dos dedos o la rueda. Pasa el cursor para ver el nombre de cada pieza.</p></div>
  <div class="card" id="mxPanel"></div></div>`;
  root.querySelector('#mxBack').onclick = onExit;
  const st = createStage(root.querySelector('#mxStage'), { cam: [4.4, 3.4, 5.2], target: [0, 1.3, 0] });
  const m = buildMachine(mach.model || 'aoi', mach.color); st.scene.add(m.group);
  st.onFrame(t => animateMachine(m, t, mach.model));
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
    if (h) { const r = canvas.getBoundingClientRect(); tip.style.display = ''; tip.textContent = PART_NAMES[h.part] || h.part; tip.style.left = (ev.clientX - r.left) + 'px'; tip.style.top = (ev.clientY - r.top) + 'px'; } else tip.style.display = 'none';
  });
  let down = null;
  canvas.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
  canvas.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return; // fue un arrastre
    const h = pick(st, ev, m.group); if (!h || i < 0 || i >= steps.length) return;
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
    panel.querySelector('#again').onclick = () => runMaintenance(root, proc, onExit);
    panel.querySelector('#out').onclick = onExit;
  }

  safety();
  return st;
}
