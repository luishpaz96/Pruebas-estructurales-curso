// Estado del alumno y reglas de gamificación (XP, niveles, insignias, rachas).
import { toast, sfx, confetti } from './fx.js';

const KEY = 'academia-inspeccion-v1';
const C = window.COURSE || { machines: [], modules: [], maintenance: [], practices: [], finalExam: { questions: [] } };

export const LEVELS = [
  { xp: 0, name: 'Aprendiz' },
  { xp: 300, name: 'Operador' },
  { xp: 800, name: 'Técnico' },
  { xp: 1600, name: 'Programador' },
  { xp: 2800, name: 'Técnico de debug' },
  { xp: 4500, name: 'Ingeniero de pruebas' },
  { xp: 7000, name: 'Especialista en inspección' },
  { xp: 10000, name: 'Experto en inspección' },
  { xp: 15000, name: 'Maestro de línea' },
];

const fresh = () => ({ xp: 0, lessons: {}, quick: {}, exams: {}, maint: {}, prac: {}, badges: {}, streak: 0, bestStreak: 0,
  days: [], wrong: {}, settings: { sound: true, free: false, timer: false } });

let S = fresh();
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* sin almacenamiento */ }
S.settings = Object.assign(fresh().settings, S.settings || {});

export const state = () => S;
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ } listeners.forEach(f => f()); }
const listeners = [];
export const onChange = f => listeners.push(f);
export function reset() { S = fresh(); save(); }

export function level(xp = S.xp) {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { n: i + 1, name: cur.name, from: cur.xp, to: nxt ? nxt.xp : cur.xp, pct: nxt ? (xp - cur.xp) / (nxt.xp - cur.xp) : 1 };
}

export function addXP(n, why) {
  if (!n) return;
  const before = level().n;
  S.xp += Math.round(n);
  markDay();
  toast(`<b>+${Math.round(n)} XP</b> ${why || ''}`);
  const after = level();
  if (after.n > before) { sfx('level'); confetti(); toast(`<b>¡Subiste a nivel ${after.n}!</b> Ahora eres ${after.name}.`); }
  checkBadges(); save();
}

function markDay() {
  const d = new Date().toISOString().slice(0, 10);
  if (!S.days.includes(d)) { S.days.push(d); if (S.days.length > 400) S.days.shift(); }
}
export function dayStreak() {
  let n = 0; const set = new Set(S.days); const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Racha de respuestas correctas seguidas
export function answer(ok, qid) {
  if (ok) { S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); if (qid) delete S.wrong[qid]; }
  else { S.streak = 0; if (qid) S.wrong[qid] = (S.wrong[qid] || 0) + 1; }
  checkBadges(); save();
}

// Progreso
export const modById = id => C.modules.find(m => m.id === id);
export function modProgress(m) {
  const total = (m.lessons || []).length + 1;
  const done = (m.lessons || []).filter(l => S.lessons[l.id]).length + (passed(m.id) ? 1 : 0);
  return total ? done / total : 0;
}
export const passed = id => (S.exams[id]?.best ?? 0) >= 70;
export function machineProgress(mid) {
  const ms = C.modules.filter(m => m.machine === mid);
  return ms.length ? ms.reduce((a, m) => a + modProgress(m), 0) / ms.length : 0;
}
// Un módulo se desbloquea cuando el anterior de la misma máquina tiene examen aprobado o todas sus lecciones vistas
export function unlocked(m) {
  if (S.settings.free) return true;
  const ms = C.modules.filter(x => x.machine === m.machine);
  const i = ms.indexOf(m);
  if (i <= 0) return true;
  const prev = ms[i - 1];
  return passed(prev.id) || (prev.lessons || []).every(l => S.lessons[l.id]);
}

// Insignias: las de máquina se generan a partir de machines.json (escalable)
export function badgeList() {
  const base = [
    { id: 'first-lesson', name: 'Primer arranque', desc: 'Completa tu primera lección', ico: 'play', test: () => Object.keys(S.lessons).length >= 1 },
    { id: 'ten-lessons', name: 'Lector de manuales', desc: 'Completa 10 lecciones', ico: 'book', test: () => Object.keys(S.lessons).length >= 10 },
    { id: 'all-lessons', name: 'Enciclopedia SMT', desc: 'Completa todas las lecciones', ico: 'book', test: () => C.modules.every(m => (m.lessons || []).every(l => S.lessons[l.id])) },
    { id: 'first-exam', name: 'Primera aprobación', desc: 'Aprueba un examen de módulo', ico: 'check', test: () => Object.values(S.exams).some(e => e.best >= 70) },
    { id: 'perfect', name: 'Cero escapes', desc: 'Saca 100% en un examen', ico: 'star', test: () => Object.values(S.exams).some(e => e.best === 100) },
    { id: 'final', name: 'Certificado', desc: 'Aprueba el examen final', ico: 'medal', test: () => (S.exams.final?.best ?? 0) >= 70 },
    { id: 'streak5', name: 'En la zona', desc: '5 respuestas correctas seguidas', ico: 'fire', test: () => S.bestStreak >= 5 },
    { id: 'streak15', name: 'Imparable', desc: '15 respuestas correctas seguidas', ico: 'fire', test: () => S.bestStreak >= 15 },
    { id: 'maint1', name: 'Llave inglesa', desc: 'Termina un mantenimiento', ico: 'wrench', test: () => Object.keys(S.maint).length >= 1 },
    { id: 'maintpro', name: 'Mantenimiento perfecto', desc: 'Un mantenimiento sin errores', ico: 'shield', test: () => Object.values(S.maint).some(r => r.best === 100) },
    { id: 'safety', name: 'Seguridad primero', desc: '3 mantenimientos sin faltas de seguridad', ico: 'shield', test: () => Object.values(S.maint).filter(r => r.safe).length >= 3 },
    { id: 'prac1', name: 'Hola, programa', desc: 'Termina una práctica', ico: 'chip', test: () => Object.keys(S.prac).length >= 1 },
    { id: 'hunter', name: 'Cazador de falsos llamados', desc: 'Termina 3 prácticas de debug', ico: 'bug', test: () => Object.keys(S.prac).filter(k => (C.practices.find(p => p.id === k) || {}).kind === 'debug').length >= 3 },
    { id: 'creator', name: 'Creador de programas', desc: 'Corre tu propio programa sin escapes', ico: 'chip', test: () => !!S.prac['crea-tu-programa'] },
    { id: 'days3', name: 'Constancia', desc: 'Estudia 3 días seguidos', ico: 'cal', test: () => dayStreak() >= 3 },
    { id: 'lv5', name: 'Nivel 5', desc: 'Llega a Técnico de debug', ico: 'star', test: () => level().n >= 5 },
  ];
  const mach = C.machines.filter(m => C.modules.some(x => x.machine === m.id)).map(m => ({
    id: 'mach-' + m.id, name: 'Dominio: ' + m.name, desc: 'Completa todos los módulos de ' + m.name, ico: 'gear', color: m.color,
    test: () => machineProgress(m.id) >= 0.999,
  }));
  return base.concat(mach);
}
export function checkBadges() {
  for (const b of badgeList()) {
    if (!S.badges[b.id] && b.test()) {
      S.badges[b.id] = Date.now();
      sfx('badge');
      toast(`<b>Insignia nueva:</b> ${b.name}`);
    }
  }
}
export const course = C;
