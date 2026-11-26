// Efectos: sonidos WebAudio, notificaciones, confeti y diálogos propios (sin alert/confirm).
let ac = null;
const soundOn = () => { try { return (window.__settings?.sound) !== false; } catch (e) { return true; } };

export function sfx(kind) {
  if (!soundOn()) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const seq = { ok: [660, 880], bad: [220, 160], badge: [523, 659, 784, 1046], level: [392, 523, 659, 784, 1046], click: [500], step: [740] }[kind] || [440];
    seq.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.09;
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* audio no disponible */ }
}

export function toast(html, ms = 3200) {
  const box = document.getElementById('toasts'); if (!box) return;
  const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; box.appendChild(d);
  setTimeout(() => d.remove(), ms);
  while (box.children.length > 4) box.firstChild.remove();
}

export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Diálogo modal propio. buttons: [{label, value, pri}]
export function dialog(title, bodyHtml, buttons = [{ label: 'Aceptar', value: true, pri: true }]) {
  return new Promise(res => {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="card" role="dialog" aria-modal="true" aria-labelledby="dlgt"><h2 id="dlgt">${esc(title)}</h2><div>${bodyHtml}</div>
      <div class="row" style="margin-top:14px;justify-content:flex-end">${buttons.map((b, i) => `<button class="btn ${b.pri ? 'pri' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    m.hidden = false;
    const close = v => { m.hidden = true; m.innerHTML = ''; res(v); };
    m.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => close(buttons[+b.dataset.i].value));
    m.querySelector('.btn.pri, button')?.focus();
  });
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('confetti'); if (!cv) return;
  const x = cv.getContext('2d'); const W = cv.width = innerWidth, H = cv.height = innerHeight;
  const cols = ['#3d8bff', '#19c3a6', '#ffb020', '#ff5a5f', '#a77bff', '#36d07f'];
  const P = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * 200, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 3, c: cols[Math.random() * 6 | 0], a: Math.random() * 6 }));
  let t = 0;
  (function loop() {
    x.clearRect(0, 0, W, H);
    P.forEach(p => { p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.a += 0.2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); });
    if (++t < 150) requestAnimationFrame(loop); else x.clearRect(0, 0, W, H);
  })();
}

export function shuffle(a, seed) {
  a = a.slice(); let s = seed ?? Math.random() * 1e9;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Íconos SVG simples para insignias y tarjetas
export function icon(name, color = 'currentColor') {
  const p = {
    play: '<path d="M20 14l18 10-18 10z" fill="C"/>', book: '<path d="M12 12h11c3 0 5 2 5 5v19c0-2-2-4-5-4H12zM36 12H25c-3 0-5 2-5 5v19c0-2 2-4 5-4h11z" fill="none" stroke="C" stroke-width="3"/>',
    check: '<path d="M13 25l7 7 15-16" fill="none" stroke="C" stroke-width="4" stroke-linecap="round"/>', star: '<path d="M24 9l4.5 9.5 10.5 1.3-7.7 7.2 2 10.4-9.3-5.2-9.3 5.2 2-10.4-7.7-7.2 10.5-1.3z" fill="C"/>',
    medal: '<circle cx="24" cy="28" r="10" fill="none" stroke="C" stroke-width="3"/><path d="M17 8l7 11 7-11" fill="none" stroke="C" stroke-width="3"/>', fire: '<path d="M24 8c4 8 12 10 12 20a12 12 0 01-24 0c0-6 4-8 5-13 3 3 3 6 3 6s5-5 4-13z" fill="C"/>',
    wrench: '<path d="M31 9a8 8 0 00-9 11L10 32l4 4 12-12a8 8 0 0011-9l-5 5-4-1-1-4z" fill="C"/>', shield: '<path d="M24 8l13 5v9c0 9-6 15-13 18-7-3-13-9-13-18v-9z" fill="none" stroke="C" stroke-width="3"/><path d="M18 24l5 5 8-9" fill="none" stroke="C" stroke-width="3"/>',
    chip: '<rect x="14" y="14" width="20" height="20" rx="2" fill="none" stroke="C" stroke-width="3"/><path d="M19 8v6M24 8v6M29 8v6M19 34v6M24 34v6M29 34v6M8 19h6M8 24h6M8 29h6M34 19h6M34 24h6M34 29h6" stroke="C" stroke-width="2.5"/>',
    bug: '<ellipse cx="24" cy="27" rx="8" ry="11" fill="C"/><path d="M12 18l6 4M36 18l-6 4M10 28h6M32 28h6M12 38l6-4M36 38l-6-4M20 12l2 4M28 12l-2 4" stroke="C" stroke-width="2.5"/>',
    cal: '<rect x="10" y="12" width="28" height="26" rx="3" fill="none" stroke="C" stroke-width="3"/><path d="M10 20h28M17 8v8M31 8v8" stroke="C" stroke-width="3"/>',
    gear: '<circle cx="24" cy="24" r="6" fill="none" stroke="C" stroke-width="3"/><path d="M24 8v6M24 34v6M8 24h6M34 24h6M13 13l4 4M31 31l4 4M35 13l-4 4M17 31l-4 4" stroke="C" stroke-width="3.5" stroke-linecap="round"/>',
  }[name] || '';
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${p.replaceAll('C', color)}</svg>`;
}
