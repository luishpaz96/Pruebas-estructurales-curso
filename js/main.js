// Enrutador y pantallas de la app. Todo el contenido viene de window.COURSE (generado desde content/).
import { createStage, disposeAll } from './stage.js';
import { mountScene, SCENES } from './scenes.js';
import { esc, icon, dialog, sfx, toast } from './fx.js';
import { state, save, reset, level, addXP, onChange, modProgress, machineProgress, unlocked, passed, badgeList, dayStreak, course, modById, LEVELS } from './store.js';
import { runExam, quickQuestion } from './exams.js';
import { runMaintenance } from './maintenance.js';
import { createProgram, playPractice, MODES } from './simui.js';
import { gameScreen } from './game/game.js';

const C = course;
const view = document.getElementById('view');
const machine = id => C.machines.find(m => m.id === id) || { id, name: id, color: '#9aa7b8', model: 'generic' };
window.__settings = state().settings;

// ---------- HUD ----------
function hud() {
  const S = state(), L = level();
  document.getElementById('hud').innerHTML = `<span class="lv" title="${esc(L.name)}">Nv ${L.n}</span><span class="xpbar" title="${S.xp} XP"><i style="width:${Math.round(L.pct * 100)}%"></i></span><span>${S.xp} XP</span><span class="streak" title="Racha de aciertos">🔥 ${S.streak}</span>`;
}
onChange(hud);

// ---------- Router ----------
const routes = {
  juego: () => gameScreen(view), inicio: home, mapa: map, taller: workshop, simulador: simulator, examenes: exams, perfil: profile, ajustes: settings, repaso: review,
};
function route() {
  disposeAll(); window.__settings = state().settings;
  const h = (location.hash || '#inicio').slice(1);
  const [base, ...rest] = h.split('-'); const arg = rest.join('-');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + base));
  view.innerHTML = '';
  if (base === 'modulo') moduleView(arg);
  else if (base === 'leccion') lessonView(arg);
  else if (base === 'examen') examView(arg);
  else if (base === 'mant') maintView(arg);
  else if (base === 'practica') practiceView(arg);
  else if (base === 'crear') createView(arg || 'aoi');
  else (routes[base] || home)();
  hud(); view.focus({ preventScroll: true }); scrollTo(0, 0);
}
addEventListener('hashchange', route);
const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };

// ---------- Inicio ----------
function home() {
  const S = state(), L = level();
  const next = nextLesson();
  const nb = Object.keys(S.badges).length, nl = Object.keys(S.lessons).length, total = C.modules.reduce((a, m) => a + (m.lessons || []).length, 0);
  view.innerHTML = `<section class="hero">
    <div><h1>Sé el técnico de pruebas de la línea SMT</h1>
    <p>AOI 3D Koh Young y ViTrox, AXI V810, ICT HP3070 y SPI. Aprende con animaciones 3D, practica mantenimientos en la máquina virtual, crea y depura programas con Gerbers reales y certifícate con exámenes que se califican solos.</p>
    <div class="kpis"><div class="kpi"><b>Nv ${L.n}</b><span>${esc(L.name)}</span></div><div class="kpi"><b>${nl}/${total}</b><span>lecciones</span></div><div class="kpi"><b>${nb}</b><span>insignias</span></div></div>
    <div class="bar" title="Progreso al siguiente nivel"><i style="width:${Math.round(L.pct * 100)}%"></i></div><p class="mut" style="margin-top:6px">${S.xp} XP · siguiente nivel en ${Math.max(0, L.to - S.xp)} XP · ${dayStreak()} día(s) seguidos</p>
    <div class="row"><a class="btn pri" href="#juego" style="font-size:20px;min-height:52px;background:var(--warn);border-color:var(--warn)">▶ Jugar: Técnico de Pruebas</a>${next ? `<a class="btn" href="#leccion-${esc(next.l.id)}">Continuar lección</a>` : ''}<a class="btn" href="#mapa">Academia</a></div></div>
    <div class="stage" id="homeStage"><div class="cap"></div></div></section>
    <section class="band"><h2>Elige tu modo</h2><div class="grid">
      ${[['mapa', 'Mapa de mundos', 'Módulos por máquina con lecciones animadas en 3D y retos rápidos.', 'book'], ['taller', 'Taller de mantenimiento', 'Mantenimientos paso a paso sobre el modelo 3D de cada máquina.', 'wrench'], ['simulador', 'Simulador de software', 'Crea programas con Gerbers reales y resuelve casos de debug.', 'chip'], ['examenes', 'Exámenes', 'Exámenes por módulo y examen final con calificación automática.', 'check']]
        .map(([h, t, d, ic]) => `<a class="card click" href="#${h}" style="text-decoration:none"><div style="width:44px;color:var(--acc)">${icon(ic, 'currentColor')}</div><h3>${t}</h3><p class="mut">${d}</p></a>`).join('')}</div></section>
    ${C.modules.some(m => !(m.lessons || []).length) ? '' : ''}`;
  const st = createStage(view.querySelector('#homeStage'), { cam: [0, 6, 11] });
  mountScene(st, 'intro_line');
}
function nextLesson() {
  const S = state();
  for (const m of C.modules) for (const l of m.lessons || []) if (!S.lessons[l.id] && unlocked(m)) return { m, l };
  return null;
}

// ---------- Mapa ----------
function map() {
  view.innerHTML = `<h1>Mapa de mundos</h1><p class="mut">Cada mundo es una máquina. Termina las lecciones o aprueba el examen de un módulo para abrir el siguiente${state().settings.free ? ' (modo libre activo: todo abierto)' : ''}.</p>` +
    C.machines.map(mc => {
      const mods = C.modules.filter(m => m.machine === mc.id); if (!mods.length) return '';
      return `<section class="card world" style="--wc:${mc.color}"><div class="row"><h2 style="margin:0">${esc(mc.name)}</h2><span class="sp"></span><span class="mut">${Math.round(machineProgress(mc.id) * 100)}%</span></div><p class="mut">${esc(mc.description || '')}</p>
        <div class="nodes">${mods.map(m => { const u = unlocked(m), p = modProgress(m);
          return `<button class="node" data-m="${esc(m.id)}" ${u ? '' : 'disabled'}><span class="n">${passed(m.id) ? '★ ' : u ? '' : '🔒 '}${esc(m.id.toUpperCase())}</span><span class="t">${esc(m.title.replace(/^Módulo \d+\.\s*/, ''))}</span><div class="bar"><i style="width:${p * 100}%"></i></div></button>`; }).join('')}</div></section>`;
    }).join('');
  view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => go('modulo-' + b.dataset.m));
}

// ---------- Módulo ----------
function moduleView(id) {
  const m = modById(id); if (!m) return home();
  const mc = machine(m.machine), S = state();
  view.innerHTML = `<a class="btn ghost" href="#mapa">← Mapa</a><div style="--acc:${mc.color}"><span class="tag" style="margin-top:12px">${esc(mc.name)}</span><h1 style="margin-top:8px">${esc(m.title)}</h1><p>${esc(m.summary || '')}</p>
    <div class="split"><div class="grid" style="grid-template-columns:minmax(0,1fr)">${(m.lessons || []).map((l, i) => `<a class="card click" href="#leccion-${esc(l.id)}" style="text-decoration:none"><div class="row"><b>${S.lessons[l.id] ? '✓' : i + 1}</b><h3 style="margin:0">${esc(l.title)}</h3><span class="sp"></span><span class="mut">+50 XP</span></div></a>`).join('') || '<div class="empty">Este módulo todavía no tiene lecciones. Agrega archivos en content/modules.</div>'}</div>
    <div class="card"><h3>Examen del módulo</h3><p class="mut">${(m.exam || []).length} preguntas · aprueba con 70%.</p><p>Mejor nota: <b>${S.exams[m.id] ? S.exams[m.id].best + '%' : '—'}</b></p>${(m.exam || []).length ? `<a class="btn pri" href="#examen-${esc(m.id)}">Presentar examen</a>` : ''}
      <hr style="border-color:var(--line);margin:16px 0"><h3>Practica lo aprendido</h3>${C.maintenance.filter(p => p.machine === m.machine).slice(0, 2).map(p => `<a class="btn" style="margin:4px 4px 0 0" href="#mant-${esc(p.id)}">🔧 ${esc(p.title)}</a>`).join('')}${C.practices.filter(p => p.machine === m.machine).slice(0, 2).map(p => `<a class="btn" style="margin:4px 4px 0 0" href="#practica-${esc(p.id)}">💻 ${esc(p.title)}</a>`).join('')}</div></div></div>`;
}

// ---------- Lección ----------
function lessonView(lid) {
  let m, l, idx;
  for (const mm of C.modules) { const k = (mm.lessons || []).findIndex(x => x.id === lid); if (k >= 0) { m = mm; l = mm.lessons[k]; idx = k; break; } }
  if (!l) return home();
  const mc = machine(m.machine), S = state();
  const blocks = (l.blocks || []).map(b => b.kind === 'bullets' ? `<ul>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : b.kind === 'tip' ? `<div class="tip"><b>Tip:</b> ${esc(b.text)}</div>` : b.kind === 'warning' ? `<div class="warning"><b>Atención:</b> ${esc(b.text)}</div>` : `<p>${esc(b.text)}</p>`).join('');
  const prev = m.lessons[idx - 1], next = m.lessons[idx + 1];
  view.innerHTML = `<div style="--acc:${mc.color}"><div class="row"><a class="btn ghost" href="#modulo-${esc(m.id)}">← ${esc(m.id.toUpperCase())}</a><span class="tag">${esc(mc.name)}</span><span class="mut">Lección ${idx + 1} de ${m.lessons.length}</span></div>
    <h1 style="margin-top:12px">${esc(l.title)}</h1>
    <div class="split"><div><div class="stage" id="lsStage"><div class="cap"></div><div class="ctrl"><button class="btn" id="pp">⏸ Pausa</button><button class="btn" id="sp">Velocidad 1×</button><button class="btn" id="rs">↺ Reiniciar</button></div></div>
      <p class="mut" style="margin-top:6px">Animación: ${esc(l.animation.replace(/_/g, ' '))}. Arrastra para girar, pellizca o usa la rueda para acercar.</p></div>
    <div class="blocks">${blocks}${(l.keyPoints || []).length ? `<div class="keyp"><b>Puntos clave</b><ul>${l.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}</div></div>
    <div id="qq" style="margin-top:20px"></div>
    <div class="row" style="margin-top:16px">${prev ? `<a class="btn" href="#leccion-${esc(prev.id)}">← ${esc(prev.title)}</a>` : ''}<span class="sp"></span><button class="btn pri" id="done">${S.lessons[l.id] ? 'Lección completada ✓' : 'Marcar como completada +50 XP'}</button>${next ? `<a class="btn" href="#leccion-${esc(next.id)}">${esc(next.title)} →</a>` : `<a class="btn" href="#examen-${esc(m.id)}">Ir al examen →</a>`}</div></div>`;
  const st = createStage(view.querySelector('#lsStage'));
  mountScene(st, l.animation, { model: mc.model, model3d: mc.model3d, color: mc.color });
  const pp = view.querySelector('#pp'); pp.onclick = () => { st.playing = !st.playing; pp.textContent = st.playing ? '⏸ Pausa' : '▶ Reproducir'; };
  const spb = view.querySelector('#sp'); spb.onclick = () => { st.speed = st.speed === 1 ? 2 : st.speed === 2 ? .5 : 1; spb.textContent = `Velocidad ${st.speed}×`; };
  view.querySelector('#rs').onclick = () => { st.t = 0; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { st.playing = false; pp.textContent = '▶ Reproducir'; }
  // Reto rápido: una pregunta del examen del módulo (rota por lección)
  const ex = m.exam || [];
  if (ex.length) { const qi = idx % ex.length, qid = `${m.id}#${qi}`;
    quickQuestion(view.querySelector('#qq'), ex[qi], qid, () => { const S2 = state(); if (!S2.quick[l.id]) { S2.quick[l.id] = 1; addXP(20, 'por el reto rápido'); } }); }
  view.querySelector('#done').onclick = () => {
    const S2 = state(); if (S2.lessons[l.id]) return next ? go('leccion-' + next.id) : go('modulo-' + m.id);
    S2.lessons[l.id] = Date.now(); addXP(50, 'por completar la lección'); sfx('ok');
    view.querySelector('#done').textContent = 'Lección completada ✓';
  };
}

// ---------- Exámenes ----------
function exams() {
  const S = state();
  view.innerHTML = `<h1>Exámenes</h1><p class="mut">Se califican al terminar. Ves tu nota, la respuesta correcta y la explicación de cada pregunta. Aprueba con 70%.</p>
    <div class="card" style="margin-bottom:16px;border-color:var(--warn)"><div class="row"><div><h2 style="margin:0">${esc(C.finalExam.title || 'Examen final')}</h2><p class="mut" style="margin:0">${(C.finalExam.questions || []).length} preguntas de todas las máquinas · mejor nota ${S.exams.final ? S.exams.final.best + '%' : '—'}</p></div><span class="sp"></span><a class="btn pri" href="#examen-final">Presentar</a></div></div>
    <div class="row" style="margin-bottom:12px"><a class="btn" href="#repaso">Banco de repaso (${Object.keys(S.wrong).length} falladas)</a>
    <label class="toggle"><input type="checkbox" id="tmr" ${S.settings.timer ? 'checked' : ''}> Temporizador (1 min por pregunta)</label></div>
    <div class="grid">${C.modules.filter(m => (m.exam || []).length).map(m => { const mc = machine(m.machine), e = S.exams[m.id];
      return `<a class="card click" href="#examen-${esc(m.id)}" style="text-decoration:none;border-left:4px solid ${mc.color}"><span class="mut">${esc(mc.name)}</span><h3>${esc(m.title)}</h3><div class="row"><span class="mut">${m.exam.length} preguntas</span><span class="sp"></span><b class="${e ? (e.best >= 70 ? 'pass' : 'fail') : ''}">${e ? e.best + '%' : '—'}</b></div></a>`; }).join('')}</div>`;
  view.querySelector('#tmr').onchange = e => { state().settings.timer = e.target.checked; save(); };
}
function examView(id) {
  const back = () => go('examenes');
  if (id === 'final') return runExam(view, { id: 'final', title: C.finalExam.title || 'Examen final', questions: C.finalExam.questions, pass: C.finalExam.passScore || 70, onExit: back, timer: state().settings.timer });
  const m = modById(id); if (!m) return exams();
  runExam(view, { id: m.id, title: 'Examen · ' + m.title, questions: m.exam, onExit: () => go('modulo-' + m.id), timer: state().settings.timer });
}
function review() {
  const S = state(); const qs = [];
  for (const k of Object.keys(S.wrong)) { const [mid, i] = k.split('#'); const src = mid === 'final' ? C.finalExam.questions : modById(mid)?.exam; if (src?.[+i]) qs.push(src[+i]); }
  if (!qs.length) { view.innerHTML = `<h1>Banco de repaso</h1><div class="empty">No tienes preguntas falladas. Presenta un examen y las que falles aparecerán aquí.</div><p><a class="btn" href="#examenes">← Exámenes</a></p>`; return; }
  runExam(view, { id: 'repaso', title: 'Repaso de preguntas falladas', questions: qs.slice(0, 20), onExit: () => go('examenes') });
}

// ---------- Taller ----------
function workshop() {
  const S = state();
  view.innerHTML = `<h1>Taller de mantenimiento</h1><p class="mut">Elige un procedimiento. Primero confirmas la seguridad; luego haces clic en la pieza correcta del modelo 3D y eliges la acción. Los errores y las faltas de seguridad bajan tu calificación.</p>
    <div class="split"><div class="stage small" id="wsStage"><div class="cap"></div></div><div id="wsList"></div></div>`;
  const st = createStage(view.querySelector('#wsStage'));
  const ms = C.machines.filter(m => m.model !== 'generic');
  let cur = ms[0];
  const show = mc => { cur = mc; st.scene.children.filter(o => o.userData.isM).forEach(o => st.scene.remove(o)); st.updaters.length = 0; st.clearLabels(); const caps = mountScene(st, 'machine_tour', { model: mc.model, model3d: mc.model3d, color: mc.color }); st.scene.children.at(-1).userData.isM = true; list(); };
  const list = () => {
    const procs = C.maintenance.filter(p => p.machine === cur.id);
    view.querySelector('#wsList').innerHTML = `<div class="row" style="margin-bottom:10px">${ms.map(m => `<button class="btn ${m === cur ? 'pri' : ''}" data-mc="${esc(m.id)}" style="${m === cur ? `background:${m.color};border-color:${m.color}` : ''}">${esc(m.name.replace(/^(AOI 3D|AXI|ICT|SPI 3D) /, '$1 '))}</button>`).join('')}</div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr)">${procs.map(p => `<a class="card click" href="#mant-${esc(p.id)}" style="text-decoration:none"><div class="row"><h3 style="margin:0">${esc(p.title)}</h3><span class="sp"></span><span class="tag">${esc(p.frequency || '')}</span></div><p class="mut" style="margin:6px 0 0">${(p.steps || []).length} pasos · mejor ${S.maint[p.id] ? S.maint[p.id].best : '—'}</p></a>`).join('') || '<div class="empty">Sin procedimientos para esta máquina todavía. Agrega archivos en content/maintenance.</div>'}</div>`;
    view.querySelectorAll('[data-mc]').forEach(b => b.onclick = () => show(ms.find(m => m.id === b.dataset.mc)));
  };
  show(cur);
}
function maintView(id) { const p = C.maintenance.find(x => x.id === id); if (!p) return workshop(); runMaintenance(view, p, () => go('taller')); }

// ---------- Simulador ----------
function simulator() {
  const S = state();
  view.innerHTML = `<h1>Simulador de software</h1><p class="mut">Programa con datos reales de manufactura: Gerber RS-274X, barrenos Excellon, centroides de pick & place y netlist IPC-D-356. Después resuelve casos de creación y debug por máquina.</p>
    <div class="card" style="margin-bottom:18px"><h2>Crea tu programa desde los Gerbers</h2><p>Importa la tarjeta PRACTICA-01, registra fiduciales, asigna la librería, ajusta umbrales y corre un lote de 50 tarjetas con defectos reales.</p>
      <div class="row">${Object.entries(MODES).map(([k, v]) => `<a class="btn ${k === 'aoi' ? 'pri' : ''}" href="#crear-${k}" style="${k === 'aoi' ? '' : `border-color:${v.color}`}">${esc(v.name)} ${S.prac['crea-tu-programa' + (k === 'aoi' ? '' : '-' + k)] ? '✓' : ''}</a>`).join('')}</div>
      <p class="mut" style="margin-top:8px">Los archivos están en content/boards/practica01 y abren en cualquier visor Gerber.</p></div>
    ${C.machines.map(mc => { const ps = C.practices.filter(p => p.machine === mc.id); if (!ps.length) return '';
      return `<h2 style="color:${mc.color}">${esc(mc.name)}</h2><div class="grid" style="margin-bottom:18px">${ps.map(p => `<a class="card click" href="#practica-${esc(p.id)}" style="text-decoration:none;border-left:4px solid ${mc.color}"><span class="tag">${p.kind === 'debug' ? 'Debug' : 'Creación'}</span><h3 style="margin-top:8px">${esc(p.title)}</h3><p class="mut">${esc((p.scenario || '').slice(0, 110))}${(p.scenario || '').length > 110 ? '…' : ''}</p><b>${S.prac[p.id] ? S.prac[p.id].best + '%' : ''}</b></a>`).join('')}</div>`; }).join('')}`;
}
function createView(mode) { view.innerHTML = '<a class="btn ghost" href="#simulador">← Simulador</a><div id="cp" style="margin-top:12px"></div>'; createProgram(view.querySelector('#cp'), MODES[mode] ? mode : 'aoi'); }
function practiceView(id) { const p = C.practices.find(x => x.id === id); if (!p) return simulator(); view.innerHTML = '<a class="btn ghost" href="#simulador">← Simulador</a><div id="pr" style="margin-top:12px"></div>'; playPractice(view.querySelector('#pr'), p, () => go('simulador')); }

// ---------- Perfil ----------
function profile() {
  const S = state(), L = level();
  view.innerHTML = `<h1>Perfil e insignias</h1><div class="kpis"><div class="kpi"><b>${S.xp}</b><span>XP total</span></div><div class="kpi"><b>Nv ${L.n}</b><span>${esc(L.name)}</span></div><div class="kpi"><b>${S.bestStreak}</b><span>mejor racha de aciertos</span></div></div>
    <h2>Progreso por máquina</h2>${C.machines.filter(m => C.modules.some(x => x.machine === m.id)).map(m => `<div style="margin-bottom:10px"><div class="row"><span>${esc(m.name)}</span><span class="sp"></span><b>${Math.round(machineProgress(m.id) * 100)}%</b></div><div class="bar"><i style="width:${machineProgress(m.id) * 100}%;background:${m.color}"></i></div></div>`).join('')}
    <h2 style="margin-top:24px">Insignias (${Object.keys(S.badges).length}/${badgeList().length})</h2><div class="badges">${badgeList().map(b => `<div class="badge ${S.badges[b.id] ? '' : 'off'}">${icon(b.ico, b.color || (S.badges[b.id] ? '#ffb020' : '#93a1b0'))}<b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div>
    <h2 style="margin-top:24px">Niveles</h2><div class="grid">${LEVELS.map((l, i) => `<div class="card" style="${i + 1 === L.n ? 'border-color:var(--acc)' : ''}"><b>Nivel ${i + 1}</b> · ${esc(l.name)}<br><span class="mut">${l.xp} XP</span></div>`).join('')}</div>`;
}

// ---------- Ajustes ----------
function settings() {
  const S = state();
  view.innerHTML = `<h1>Ajustes</h1><div class="card" style="max-width:640px">
    <label class="toggle"><input type="checkbox" id="snd" ${S.settings.sound ? 'checked' : ''}> Sonidos</label>
    <label class="toggle"><input type="checkbox" id="free" ${S.settings.free ? 'checked' : ''}> Modo libre (todos los módulos abiertos, para instructores)</label>
    <label class="toggle"><input type="checkbox" id="tmr" ${S.settings.timer ? 'checked' : ''}> Temporizador en exámenes</label>
    <p class="mut">Tu progreso se guarda en este navegador. Si lo borras o cambias de equipo empiezas de cero.</p>
    <div class="row"><button class="btn" id="exp">Copiar mi progreso</button><button class="btn" id="imp">Pegar progreso</button><span class="sp"></span><button class="btn" id="rst" style="border-color:var(--bad)">Reiniciar progreso</button></div>
    <textarea id="ta" hidden style="width:100%;min-height:120px;margin-top:10px;background:var(--bg2);color:var(--ink);border:1px solid var(--line);border-radius:8px;font:14px monospace"></textarea></div>
    <div class="card" style="max-width:640px;margin-top:16px"><h3>Contenido cargado</h3><p class="mut">${C.machines.length} máquinas · ${C.modules.length} módulos · ${C.modules.reduce((a, m) => a + (m.lessons || []).length, 0)} lecciones · ${C.modules.reduce((a, m) => a + (m.exam || []).length, 0) + (C.finalExam.questions || []).length} preguntas · ${C.maintenance.length} mantenimientos · ${C.practices.length} prácticas · ${(C.boards || []).length} tarjeta(s) Gerber</p></div>`;
  const sv = () => { window.__settings = S.settings; save(); };
  view.querySelector('#snd').onchange = e => { S.settings.sound = e.target.checked; sv(); };
  view.querySelector('#free').onchange = e => { S.settings.free = e.target.checked; sv(); };
  view.querySelector('#tmr').onchange = e => { S.settings.timer = e.target.checked; sv(); };
  const ta = view.querySelector('#ta');
  view.querySelector('#exp').onclick = async () => { ta.hidden = false; ta.value = JSON.stringify(state()); try { await navigator.clipboard.writeText(ta.value); toast('Progreso copiado'); } catch (e) { ta.select(); toast('Copia el texto del cuadro'); } };
  view.querySelector('#imp').onclick = () => { if (ta.hidden) { ta.hidden = false; ta.value = ''; ta.placeholder = 'Pega aquí tu progreso y vuelve a pulsar "Pegar progreso"'; return; }
    try { const d = JSON.parse(ta.value); Object.assign(state(), d); save(); toast('Progreso restaurado'); route(); } catch (e) { toast('El texto no es un progreso válido'); } };
  view.querySelector('#rst').onclick = async () => { if (await dialog('¿Reiniciar todo?', '<p>Se borran XP, insignias, notas y lecciones completadas.</p>', [{ label: 'Cancelar', value: false }, { label: 'Reiniciar', value: true, pri: true }])) { reset(); route(); } };
}

route();
