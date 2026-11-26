// Exámenes interactivos con calificación automática, revisión y banco de repaso.
import { esc, sfx, shuffle, confetti, dialog } from './fx.js';
import { state, save, addXP, answer, checkBadges } from './store.js';

// Normaliza una pregunta a {q, opts:[{t, ok}], explain, section, id}
export function prep(q, id, seed) {
  if (q.type === 'tf') return { id, q: q.q, type: 'tf', opts: [{ t: 'Verdadero', ok: q.answer === true }, { t: 'Falso', ok: q.answer === false }], explain: q.explain, section: q.section };
  const opts = q.options.map((t, i) => ({ t, ok: i === (q.correct ?? 0) }));
  return { id, q: q.q, type: q.type, opts: shuffle(opts, seed), explain: q.explain, section: q.section };
}

export function runExam(root, { id, title, questions, pass = 70, onExit, timer }) {
  const Q = questions.map((q, i) => prep(q, `${id}#${i}`, Math.random() * 1e9));
  const ans = new Array(Q.length).fill(null); let cur = 0; let t0 = Date.now(); let tick = null;
  const limit = timer ? Q.length * 60 : 0;
  function view() {
    const q = Q[cur];
    root.innerHTML = `<div class="row"><button class="btn ghost" id="exBack">← Salir</button><span class="sp"></span><span class="tag" id="exTime"></span></div>
      <h1 style="margin-top:10px">${esc(title)}</h1>
      <div class="qnav" aria-label="Preguntas">${Q.map((_, i) => `<button data-i="${i}" class="${ans[i] !== null ? 'ans' : ''} ${i === cur ? 'cur' : ''}" aria-label="Pregunta ${i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="bar" style="margin-bottom:14px"><i style="width:${ans.filter(a => a !== null).length / Q.length * 100}%"></i></div>
      <div class="card q"><div class="row"><span class="tag">${q.type === 'tf' ? 'Verdadero o falso' : q.type === 'case' ? 'Caso práctico' : 'Opción múltiple'}</span><span class="mut">Pregunta ${cur + 1} de ${Q.length}</span></div>
      <h3 style="margin-top:10px">${esc(q.q)}</h3>
      <div class="opts">${q.opts.map((o, k) => `<button class="opt ${ans[cur] === k ? 'sel' : ''}" data-k="${k}"><span class="k">${'ABCD'[k] || k + 1}</span><span>${esc(o.t)}</span></button>`).join('')}</div></div>
      <div class="row"><button class="btn" id="prev" ${cur === 0 ? 'disabled' : ''}>Anterior</button><span class="sp"></span>
      ${cur < Q.length - 1 ? '<button class="btn pri" id="next">Siguiente</button>' : ''}<button class="btn ${cur === Q.length - 1 ? 'pri' : ''}" id="end">Terminar y calificar</button></div>`;
    root.querySelector('#exBack').onclick = async () => { if (await dialog('¿Salir del examen?', '<p>Perderás las respuestas de este intento.</p>', [{ label: 'Seguir', value: false }, { label: 'Salir', value: true, pri: true }])) { clearInterval(tick); onExit(); } };
    root.querySelectorAll('.qnav button').forEach(b => b.onclick = () => { cur = +b.dataset.i; view(); });
    root.querySelectorAll('.opt').forEach(b => b.onclick = () => { ans[cur] = +b.dataset.k; sfx('click'); if (cur < Q.length - 1) { cur++; } view(); });
    root.querySelector('#prev').onclick = () => { cur--; view(); };
    root.querySelector('#next')?.addEventListener('click', () => { cur++; view(); });
    root.querySelector('#end').onclick = async () => {
      const left = ans.filter(a => a === null).length;
      if (left && !(await dialog('Hay preguntas sin responder', `<p>Te faltan ${left}. Las que no contestes cuentan como incorrectas.</p>`, [{ label: 'Volver', value: false }, { label: 'Calificar así', value: true, pri: true }]))) return;
      grade();
    };
    showTime();
  }
  function showTime() {
    const el = root.querySelector('#exTime'); if (!el) return;
    const s = Math.round((Date.now() - t0) / 1000); const rem = limit ? Math.max(0, limit - s) : s;
    el.textContent = (limit ? 'Restante ' : 'Tiempo ') + `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;
    if (limit && rem === 0) grade();
  }
  tick = setInterval(showTime, 1000);

  function grade() {
    clearInterval(tick);
    let ok = 0; Q.forEach((q, i) => { const good = ans[i] !== null && q.opts[ans[i]].ok; if (good) ok++; answer(good, q.id); });
    const pct = Math.round(ok / Q.length * 100), S = state(), prev = S.exams[id]?.best ?? -1;
    S.exams[id] = { best: Math.max(prev, pct), last: pct, tries: (S.exams[id]?.tries || 0) + 1, at: Date.now() }; save();
    const passed = pct >= pass;
    sfx(passed ? 'level' : 'bad'); if (passed) confetti();
    const xp = ok * 10 + (passed && prev < pass ? 150 : 0) + (pct === 100 && prev < 100 ? 100 : 0);
    addXP(prev >= 0 && pct <= prev ? Math.round(xp / 4) : xp, passed ? 'por aprobar el examen' : 'por el intento');
    checkBadges();
    const mins = Math.round((Date.now() - t0) / 60000);
    root.innerHTML = `<div class="row"><button class="btn ghost" id="exBack">← Volver</button></div>
      <div class="card" style="margin:14px 0;text-align:center"><div class="score ${passed ? 'pass' : 'fail'}">${pct}%</div>
      <h2>${passed ? 'Aprobado' : 'No aprobado'}: ${ok} de ${Q.length} correctas</h2><p class="mut">Mínimo para aprobar: ${pass}% · Tiempo: ${mins} min · Mejor nota: ${S.exams[id].best}%</p>
      <div class="row" style="justify-content:center"><button class="btn pri" id="retry">Repetir examen</button></div></div>
      <h2>Revisión</h2>${Q.map((q, i) => { const a = ans[i], good = a !== null && q.opts[a].ok, right = q.opts.find(o => o.ok);
        return `<div class="card q"><div class="row"><b>${i + 1}.</b><span class="tag" style="color:${good ? 'var(--ok)' : 'var(--bad)'}">${good ? 'Correcta' : 'Incorrecta'}</span>${q.section ? `<span class="mut">Sección ${esc(q.section)}</span>` : ''}</div>
        <h3 style="margin-top:8px">${esc(q.q)}</h3>${a !== null && !good ? `<div class="opt wrong" style="cursor:default">Tu respuesta: ${esc(q.opts[a].t)}</div>` : a === null ? '<div class="opt wrong" style="cursor:default">Sin responder</div>' : ''}
        <div class="opt good" style="cursor:default;margin-top:6px">Correcta: ${esc(right.t)}</div>${q.explain ? `<div class="fb">${esc(q.explain)}</div>` : ''}</div>`; }).join('')}`;
    root.querySelector('#exBack').onclick = onExit;
    root.querySelector('#retry').onclick = () => runExam(root, { id, title, questions, pass, onExit, timer });
    scrollTo(0, 0);
  }
  view();
}

// Pregunta rápida (al final de cada lección)
export function quickQuestion(el, q, qid, onOk) {
  const p = prep(q, qid);
  el.innerHTML = `<div class="card"><span class="tag">Reto rápido · +20 XP</span><h3 style="margin-top:8px">${esc(p.q)}</h3><div class="opts">${p.opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="k">${'ABCD'[k]}</span><span>${esc(o.t)}</span></button>`).join('')}</div><div id="qfb"></div></div>`;
  el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const ok = p.opts[+b.dataset.k].ok; answer(ok, qid); sfx(ok ? 'ok' : 'bad');
    el.querySelectorAll('.opt').forEach((x, k) => { x.disabled = true; if (p.opts[k].ok) x.classList.add('good'); });
    if (!ok) b.classList.add('wrong');
    el.querySelector('#qfb').innerHTML = `<div class="fb ${ok ? 'good' : 'wrong'}">${ok ? '¡Correcto! ' : 'Casi. '}${esc(p.explain || '')}</div>`;
    if (ok) onOk && onOk();
  });
}
