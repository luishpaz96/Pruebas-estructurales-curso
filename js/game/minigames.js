// Minijuegos del modo carrera. Cada uno recibe un contenedor y llama done({score: 0..100, ...}) al terminar.
import { esc, shuffle } from '../fx.js';
import { prep } from '../exams.js';
import { course, answer } from '../store.js';
import { sfx } from './audio.js';
import { drawCase } from './defects.js';

// ---------------- Revisión de NG (AOI / AXI) ----------------
const AOI_CASES = [
  { call: 'Componente faltante', real: true, draw: 'missing', why: 'Los pads tienen pasta pero no hay componente: defecto real.' },
  { call: 'Desplazamiento', real: true, draw: 'shift', why: 'La terminal quedó fuera del pad más del 50%: defecto real según IPC-A-610.' },
  { call: 'Tombstone', real: true, draw: 'tomb', why: 'El chip está parado sobre un extremo: un lado quedó abierto.' },
  { call: 'Puente', real: true, draw: 'bridge', why: 'Soldadura une dos terminales vecinas del QFP: corto.' },
  { call: 'Polaridad invertida', real: true, draw: 'polbad', why: 'La banda del diodo está del lado contrario a la marca de serigrafía.' },
  { call: 'Soldadura insuficiente', real: true, draw: 'insuf', why: 'El filete casi no sube por la terminal: junta débil.' },
  { call: 'Desplazamiento', real: false, draw: 'shiftok', why: 'El desplazamiento es pequeño y la terminal sigue sobre el pad: falso llamado por tolerancia muy cerrada.' },
  { call: 'Componente faltante', real: false, draw: 'glare', why: 'El componente está; un reflejo brillante confundió al algoritmo.' },
  { call: 'Puente', real: false, draw: 'silk', why: 'Es una línea de serigrafía entre pads, no soldadura.' },
  { call: 'Polaridad invertida', real: false, draw: 'polok', why: 'La banda coincide con la marca. Falso llamado: el proveedor del diodo cambió el color de la marca.' },
  { call: 'Tombstone', real: false, draw: 'shadow', why: 'La sombra de un capacitor alto vecino afectó la medición de altura.' },
];
const AXI_CASES = [
  { call: 'Puente en BGA', real: true, draw: 'xbridge', why: 'Dos bolas unidas en el corte de la junta: corto real.' },
  { call: 'Void excesivo', real: true, draw: 'xvoidbig', why: 'El void ocupa más del 25% del área de la bola: rechazo.' },
  { call: 'Bola faltante', real: true, draw: 'xmissing', why: 'Falta una bola en la matriz.' },
  { call: 'Abierto / head-in-pillow', real: true, draw: 'xhip', why: 'La bola es más pequeña y clara que sus vecinas: no se fundió con la pasta.' },
  { call: 'Void excesivo', real: false, draw: 'xvoidsmall', why: 'Voids pequeños dentro de tolerancia: falso llamado.' },
  { call: 'Puente en BGA', real: false, draw: 'xshadow', why: 'Es la sombra de un componente del lado inferior en otro plano; el corte correcto está limpio.' },
  { call: 'Abierto', real: false, draw: 'xvia', why: 'El punto claro es una vía bajo la bola: requiere subtipo aparte.' },
];

export function review(el, { machine = 'aoi', count = 6 }, done) {
  const pool = machine === 'axi' ? AXI_CASES : machine === 'mix' ? AOI_CASES.concat(AXI_CASES) : AOI_CASES;
  const items = shuffle(Array.from({ length: count }, (_, i) => pool[(i * 5 + Math.floor(Math.random() * pool.length)) % pool.length]));
  let i = 0, ok = 0, escapes = 0, scrap = 0, t0 = 0, raf = 0; const LIM = 10;
  const res = [];
  function show() {
    if (i >= items.length) return end();
    const c = items[i];
    el.innerHTML = `<div class="mg-review"><div class="row"><span class="tag">${c.draw.startsWith('x') ? 'AXI · corte de bolas' : 'AOI · imagen 2D/3D'}</span><span class="mut">Tarjeta ${i + 1} de ${items.length}</span><span class="sp"></span><b>${ok} ✓</b></div>
      <h3 style="margin:10px 0">Llamado de la máquina: <span style="color:var(--warn)">${esc(c.call)}</span></h3>
      <canvas id="rv" width="780" height="400" style="width:100%;max-width:900px;border-radius:10px;display:block;margin:0 auto;image-rendering:auto"></canvas>
      <div class="bar" style="margin:10px 0"><i id="tbar" style="width:100%;background:var(--warn)"></i></div>
      <div class="row" style="justify-content:center"><button class="btn" id="bOK" style="border-color:var(--ok);min-width:150px">✓ Falso llamado (pasa)</button><button class="btn" id="bNG" style="border-color:var(--bad);min-width:150px">✕ Defecto real (NG)</button></div>
      <p class="mut" style="text-align:center;margin-top:6px">Teclas: A = falso llamado · D = defecto real</p><div id="rfb"></div></div>`;
    drawCase(el.querySelector('#rv'), c.draw);
    t0 = performance.now();
    const tick = () => { const k = 1 - (performance.now() - t0) / (LIM * 1000); const b = el.querySelector('#tbar'); if (b) b.style.width = Math.max(0, k * 100) + '%'; if (k <= 0) decide(null); else raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    el.querySelector('#bOK').onclick = () => decide(false); el.querySelector('#bNG').onclick = () => decide(true);
  }
  function decide(saysReal) {
    cancelAnimationFrame(raf); const c = items[i]; if (!c) return;
    const right = saysReal === c.real; if (right) ok++; else if (c.real) escapes++; else scrap++;
    answer(right); sfx(right ? 'ok' : 'bad'); res.push(right);
    el.querySelector('#bOK').disabled = el.querySelector('#bNG').disabled = true;
    el.querySelector('#rfb').innerHTML = `<div class="fb ${right ? 'good' : 'wrong'}">${saysReal === null ? '⏱ Se acabó el tiempo. ' : right ? '¡Bien! ' : c.real ? 'ESCAPE: era defecto real. ' : 'Era falso llamado: mandaste a reparar una tarjeta buena. '}${esc(c.why)}</div><button class="btn pri" id="rnx" style="margin-top:8px">Siguiente</button>`;
    el.querySelector('#rnx').onclick = () => { i++; show(); }; el.querySelector('#rnx').focus();
  }
  function end() { const score = Math.round(ok / items.length * 100); done({ score, ok, total: items.length, escapes, scrap }); }
  const key = e => { if (!el.isConnected) return removeEventListener('keydown', key); const b = e.key.toLowerCase() === 'a' ? '#bOK' : e.key.toLowerCase() === 'd' ? '#bNG' : null; if (b) el.querySelector(b)?.click(); };
  addEventListener('keydown', key);
  show();
}

// ---------------- Alarma / diagnóstico ----------------
export function alarm(el, inc, done) {
  const order = shuffle(inc.options.map((_, k) => k)); let tries = 0;
  el.innerHTML = `<div class="card" style="border-color:var(--bad)"><div class="row"><span class="tag" style="color:var(--bad)">⚠ Alarma</span><b>${esc(inc.title)}</b></div><p style="margin-top:8px">${esc(inc.alarm)}</p></div>
    <h3 style="margin-top:14px">${esc(inc.prompt)}</h3><div class="opts">${order.map(k => `<button class="opt" data-k="${k}">${esc(inc.options[k])}</button>`).join('')}</div><div id="afb"></div>`;
  el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === (inc.correct ?? 0); tries++; answer(ok); sfx(ok ? 'ok' : 'bad');
    b.classList.add(ok ? 'good' : 'wrong'); b.disabled = true;
    if (ok) { el.querySelectorAll('.opt').forEach(x => x.disabled = true); el.querySelector('#afb').innerHTML = `<div class="fb good">${esc(inc.feedback)}</div><button class="btn pri" id="ac" style="margin-top:8px">Restablecer máquina</button>`; el.querySelector('#ac').onclick = () => done({ score: tries === 1 ? 100 : tries === 2 ? 60 : 30 }); }
    else el.querySelector('#afb').innerHTML = `<div class="fb wrong">No es eso. La máquina sigue parada: piensa en lo más simple primero.</div>`;
  });
}

// ---------------- Preguntas del ingeniero (banco de exámenes del curso) ----------------
export function quiz(el, ms, done) {
  let qs = [];
  if (ms.final) qs = (course.finalExam.questions || []).map((q, i) => [q, `final#${i}`]);
  else course.modules.filter(m => (ms.machines || []).includes(m.machine)).forEach(m => (m.exam || []).forEach((q, i) => qs.push([q, `${m.id}#${i}`])));
  if (ms.focus) { const re = new RegExp(ms.focus, 'i'); const f = qs.filter(([q]) => re.test(q.q + ' ' + (q.options || []).join(' '))); if (f.length >= (ms.count || 4)) qs = f; }
  qs = shuffle(qs).slice(0, ms.count || 5);
  let i = 0, ok = 0;
  const show = () => {
    if (i >= qs.length) return done({ score: Math.round(ok / qs.length * 100), ok, total: qs.length });
    const [raw, id] = qs[i]; const q = prep(raw, id);
    el.innerHTML = `<div class="row"><span class="tag">Pregunta ${i + 1} de ${qs.length}</span><span class="sp"></span><b>${ok} ✓</b></div><h3 style="margin-top:10px">${esc(q.q)}</h3>
      <div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div><div id="qfb"></div>`;
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const good = q.opts[+b.dataset.k].ok; if (good) ok++; answer(good, id); sfx(good ? 'ok' : 'bad');
      el.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (q.opts[k].ok) x.classList.add('good'); }); if (!good) b.classList.add('wrong');
      el.querySelector('#qfb').innerHTML = `<div class="fb ${good ? 'good' : 'wrong'}">${esc(q.explain || '')}</div><button class="btn pri" id="qn" style="margin-top:8px">Siguiente</button>`;
      el.querySelector('#qn').onclick = () => { i++; show(); };
    });
  };
  show();
}

// ---------------- Secuencia (cambio de modelo, cambio de fixtura) ----------------
export function sequence(el, ms, done) {
  const steps = ms.steps || [], cards = shuffle(steps.map((t, i) => ({ t, i })).concat((ms.distractors || []).map(t => ({ t, i: -1 }))));
  let next = 0, errors = 0;
  const render = () => {
    el.innerHTML = `<p>Toca los pasos en el orden correcto. Ojo: hay pasos que <b>no</b> se deben hacer.</p>
      <ol class="steps" style="margin-bottom:14px">${steps.slice(0, next).map(s => `<li class="done">${esc(s)}</li>`).join('')}${next < steps.length ? `<li class="cur">Paso ${next + 1}…</li>` : ''}</ol>
      <div class="opts">${cards.map((c, k) => c.used ? '' : `<button class="opt" data-k="${k}">${esc(c.t)}</button>`).join('')}</div><p class="mut">Errores: ${errors}</p><div id="sfb"></div>`;
    el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      const c = cards[+b.dataset.k];
      if (c.i === next) { c.used = true; next++; sfx('ok'); answer(true); if (next === steps.length) { sfx('great'); done({ score: Math.max(0, 100 - errors * 12), errors }); return; } render(); }
      else { errors++; sfx('bad'); answer(false); b.classList.add('wrong'); el.querySelector('#sfb').innerHTML = `<div class="fb wrong">${c.i === -1 ? 'Ese paso no se debe hacer nunca en un cambio.' : 'Todavía no: hay algo que va antes.'}</div>`; }
    });
  };
  render();
}

// ---------------- Clase en el juego (lección del curso con animación 3D) ----------------
import { createStage } from '../stage.js';
import { mountScene } from '../scenes.js';
import { state, save } from '../store.js';
export function findLesson(lid) {
  for (const m of course.modules) { const k = (m.lessons || []).findIndex(l => l.id === lid); if (k >= 0) return { m, l: m.lessons[k], idx: k }; }
  const mid = String(lid).split('-')[0]; const m = course.modules.find(x => x.id === mid); return m ? { m, l: null, idx: 0 } : null;
}
export function lesson(el, ms, done) {
  const f = findLesson(ms.lesson); if (!f) return done({ score: 100 });
  const { m, l, idx } = f; const mc = course.machines.find(x => x.id === m.machine) || {};
  const blocks = l ? (l.blocks || []) : [{ kind: 'text', text: m.summary || m.description || m.title }];
  const keyp = l ? (l.keyPoints || []) : [];
  // Las lecciones se muestran por partes, como una clase: bloque a bloque
  const parts = blocks.map(b => b.kind === 'bullets' ? `<ul>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : b.kind === 'tip' ? `<div class="tip"><b>Tip:</b> ${esc(b.text)}</div>` : b.kind === 'warning' ? `<div class="warning"><b>Atención:</b> ${esc(b.text)}</div>` : `<p>${esc(b.text)}</p>`);
  if (keyp.length) parts.push(`<div class="keyp"><b>Puntos clave</b><ul>${keyp.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>`);
  el.innerHTML = `<div class="row"><span class="tag">Clase · ${esc(m.id.toUpperCase())}</span><b>${esc(l ? l.title : m.title)}</b><span class="sp"></span><span class="mut" id="lsP"></span></div>
    <div class="split" style="margin-top:10px"><div><div class="stage" id="lsSt" style="min-height:300px"><div class="cap"></div></div></div><div class="blocks" id="lsB"></div></div>
    <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="lsN">Siguiente ▸</button></div><div id="lsQ"></div>`;
  const st = createStage(el.querySelector('#lsSt'));
  mountScene(st, l?.animation || 'machine_tour', { model: mc.model, model3d: mc.model3d, color: mc.color });
  let i = 0; const B = el.querySelector('#lsB'), N = el.querySelector('#lsN');
  const finish = score => { st.dispose(); if (l) { const S = state(); if (!S.lessons[l.id]) { S.lessons[l.id] = Date.now(); save(); } } done({ score }); };
  const step = () => {
    if (i < parts.length) { B.insertAdjacentHTML('beforeend', parts[i]); B.lastElementChild.scrollIntoView?.({ block: 'nearest' }); i++; sfx('tick'); el.querySelector('#lsP').textContent = `${i}/${parts.length}`; if (i === parts.length) N.textContent = (m.exam || []).length ? 'Pregunta de comprobación ▸' : 'Terminar clase ✓'; return; }
    const ex = m.exam || []; if (!ex.length) return finish(100);
    N.hidden = true; const raw = ex[idx % ex.length], id = `${m.id}#${idx % ex.length}`, q = prep(raw, id); const Q = el.querySelector('#lsQ');
    Q.innerHTML = `<div class="card" style="margin-top:12px"><span class="tag">Comprobación</span><h3 style="margin-top:8px">${esc(q.q)}</h3><div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div><div id="lsF"></div></div>`;
    Q.querySelectorAll('.opt').forEach(b => b.onclick = () => { const good = q.opts[+b.dataset.k].ok; answer(good, id); sfx(good ? 'great' : 'bad');
      Q.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (q.opts[k].ok) x.classList.add('good'); }); if (!good) b.classList.add('wrong');
      Q.querySelector('#lsF').innerHTML = `<div class="fb ${good ? 'good' : 'wrong'}">${esc(q.explain || '')}</div><button class="btn pri" id="lsE" style="margin-top:8px">Terminar clase ✓</button>`;
      Q.querySelector('#lsE').onclick = () => finish(good ? 100 : 70); });
  };
  N.onclick = step; step();
}

// ---------------- Avisar / coordinar con otra área (manufactura, calidad) ----------------
export function notify(el, ms, done, person) {
  const opts = shuffle((ms.options || []).map((t, k) => ({ t, ok: k === (ms.correct || 0) })));
  let tries = 0;
  el.innerHTML = `<div class="row"><span style="width:72px;height:72px;flex:none;display:block">${person.svg}</span><div><b>${esc(person.name)}</b><div class="mut">${esc(person.role)}</div></div></div>
    <h3 style="margin-top:12px">${esc(ms.prompt || '¿Qué le dices?')}</h3><div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div><div id="nfF"></div>`;
  el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const o = opts[+b.dataset.k]; tries++; sfx(o.ok ? 'great' : 'bad');
    if (!o.ok) { b.classList.add('wrong'); b.disabled = true; el.querySelector('#nfF').innerHTML = `<div class="fb wrong">${esc(person.name.split(' ')[0])} no está de acuerdo. Piensa en el impacto para producción y para el cliente.</div>`; return; }
    el.querySelectorAll('.opt').forEach(x => x.disabled = true); b.classList.add('good');
    el.querySelector('#nfF').innerHTML = `<div class="fb good">${esc(ms.feedback || 'De acuerdo.')}</div><button class="btn pri" id="nfE" style="margin-top:8px">Continuar</button>`;
    el.querySelector('#nfE').onclick = () => done({ score: Math.max(40, 100 - (tries - 1) * 30) });
  });
}
