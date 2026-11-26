// Banda sonora procedural y efectos de sonido del modo juego (WebAudio, sin archivos externos).
// La música tiene dos capas: "calma" (pad + bajo + hi-hat) y "alerta" (lead y percusión extra) que entra con incidentes.
let ac = null, master, musicBus, sfxBus, ambBus, timer = null, step = 0, nextT = 0, intensity = 0, musicOn = true, sfxOn = true;
const BPM = 104, SPB = 60 / BPM / 4; // semicorcheas

export function initAudio() {
  if (ac) { ac.resume?.(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = .8; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = .5; musicBus.connect(comp);
  sfxBus = ac.createGain(); sfxBus.gain.value = .9; sfxBus.connect(comp);
  ambBus = ac.createGain(); ambBus.gain.value = .25; ambBus.connect(comp);
  ambience();
}
export function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? .5 : 0, ac.currentTime, .2); }
export function setSfx(on) { sfxOn = on; if (sfxBus) { sfxBus.gain.value = on ? .9 : 0; ambBus.gain.value = on ? .25 : 0; } }
export function setIntensity(v) { intensity = v; }
export const audioState = () => ({ musicOn, sfxOn });

function noiseBuffer(sec = 1) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}
// Zumbido de fábrica: ruido filtrado + 60 Hz suave
function ambience() {
  const n = ac.createBufferSource(); n.buffer = noiseBuffer(2); n.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = ac.createGain(); g.gain.value = .35; n.connect(f).connect(g).connect(ambBus); n.start();
  const o = ac.createOscillator(); o.frequency.value = 60; const og = ac.createGain(); og.gain.value = .05; o.connect(og).connect(ambBus); o.start();
}

// --- Música ---
const SCALE = [0, 3, 5, 7, 10]; // pentatónica menor
const ROOTS = [45, 45, 41, 43]; // A, A, F, G (MIDI)
const mtof = m => 440 * 2 ** ((m - 69) / 12);
function tone(t, freq, dur, type = 'sawtooth', vol = .1, cutoff = 1800, bus = musicBus) {
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + dur + .05);
}
function hat(t, vol = .05, dur = .04) {
  const s = ac.createBufferSource(); s.buffer = noiseBuffer(.1); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + dur + .02);
}
function kick(t, vol = .5) {
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .25); o.connect(g).connect(musicBus); o.start(t); o.stop(t + .3);
}
function snare(t, vol = .18) {
  const s = ac.createBufferSource(); s.buffer = noiseBuffer(.2); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .15); s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + .2);
}
function schedule() {
  while (nextT < ac.currentTime + .15) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, root = ROOTS[bar], t = nextT;
    // Bajo pulsante
    if (s % 2 === 0) tone(t, mtof(root - 12 + (s === 6 || s === 14 ? 7 : 0)), SPB * 1.8, 'sawtooth', .09, 420 + intensity * 600);
    // Arpegio
    const note = root + 12 + SCALE[(s * 3 + bar) % 5] + (s > 11 ? 12 : 0);
    if (s % 2 === 1 || intensity > .5) tone(t, mtof(note), SPB * 1.2, 'square', .025 + intensity * .02, 1200 + intensity * 2000);
    // Pad al inicio de compás
    if (s === 0) [0, 3, 7].forEach(iv => tone(t, mtof(root + 12 + iv), SPB * 15, 'triangle', .03, 900));
    // Percusión
    if (s % 4 === 0) kick(t, .35 + intensity * .2);
    if (intensity > .3 && (s === 4 || s === 12)) snare(t);
    hat(t, s % 4 === 2 ? .05 : .02);
    // Lead de alerta
    if (intensity > .6 && s % 4 === 0) tone(t, mtof(root + 24 + SCALE[(bar + s / 4) % 5]), SPB * 3, 'sawtooth', .03, 2600);
    nextT += SPB; step++;
  }
}
export function startMusic() { if (!ac) initAudio(); if (timer) return; nextT = ac.currentTime + .05; timer = setInterval(schedule, 40); }
export function stopMusic() { clearInterval(timer); timer = null; }

// --- Efectos ---
export function sfx(name) {
  if (!ac || !sfxOn) return; const t = ac.currentTime;
  const T = (f, d, type = 'triangle', v = .15, delay = 0, cut = 4000) => tone(t + delay, f, d, type, v, cut, sfxBus);
  switch (name) {
    case 'step': { const s = ac.createBufferSource(); s.buffer = noiseBuffer(.08); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = ac.createGain(); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .07); s.connect(f).connect(g).connect(sfxBus); s.start(t); break; }
    case 'alarm': [0, .22, .44].forEach(d => { T(880, .18, 'square', .08, d, 3000); T(660, .18, 'square', .08, d + .11, 3000); }); break;
    case 'radio': T(1400, .05, 'square', .06); T(1800, .05, 'square', .06, .07); break;
    case 'ok': T(660, .12); T(990, .2, 'triangle', .15, .08); break;
    case 'great': [523, 659, 784, 1046].forEach((f, i) => T(f, .25, 'triangle', .14, i * .08)); break;
    case 'bad': T(180, .3, 'sawtooth', .12, 0, 900); T(120, .35, 'sawtooth', .12, .12, 700); break;
    case 'click': T(1200, .04, 'square', .05); break;
    case 'open': T(400, .08, 'triangle', .1); T(800, .12, 'triangle', .1, .06); break;
    case 'board': T(2200, .03, 'sine', .03); break;
    case 'xray': { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(260, t + .6); const g = ac.createGain(); g.gain.setValueAtTime(.05, t); g.gain.linearRampToValueAtTime(.0001, t + .7); o.connect(g).connect(sfxBus); o.start(t); o.stop(t + .8); break; }
    case 'tick': T(1000, .03, 'sine', .05); break;
    case 'whoosh': { const s = ac.createBufferSource(); s.buffer = noiseBuffer(.5); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + .4); const g = ac.createGain(); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.0001, t + .45); s.connect(f).connect(g).connect(sfxBus); s.start(t); break; }
    case 'levelup': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => T(f, .3, 'square', .07, i * .07, 3000)); break;
  }
}
