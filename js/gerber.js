// Lector de archivos de manufactura: Gerber RS-274X (subconjunto), Excellon, CSV de centroides e IPC-D-356.
// Soporta apertures C, R, O (y macros/poligonos de forma aproximada), D01/D02/D03, regiones G36/G37, mm y pulgadas.

export function parseGerber(text) {
  const out = { flashes: [], lines: [], regions: [], units: 'mm', bbox: null, apertures: {}, errors: [] };
  let fmt = { xi: 2, xd: 4, yi: 2, yd: 4 }, scale = 1, ap = null, x = 0, y = 0, region = null, interp = 'G01';
  const toNum = (s, dec) => { if (s.includes('.')) return parseFloat(s) * scale; return parseInt(s, 10) / 10 ** dec * scale; };
  // Separa bloques extendidos %...% y comandos terminados en *
  const tokens = text.replace(/\r/g, '').split(/(%[^%]*%)/);
  for (const tk of tokens) {
    if (tk.startsWith('%')) {
      for (const cmd of tk.slice(1, -1).split('*').map(s => s.trim()).filter(Boolean)) {
        if (cmd.startsWith('FS')) { const m = cmd.match(/X(\d)(\d)Y(\d)(\d)/); if (m) fmt = { xi: +m[1], xd: +m[2], yi: +m[3], yd: +m[4] }; }
        else if (cmd.startsWith('MO')) { out.units = cmd.includes('IN') ? 'in' : 'mm'; scale = out.units === 'in' ? 25.4 : 1; }
        else if (cmd.startsWith('AD')) {
          const m = cmd.match(/^ADD(\d+)([A-Za-z_0-9.]+?),?([\d.X]*)$/);
          if (m) { const p = m[3] ? m[3].split('X').map(v => parseFloat(v) * scale) : [0.2 * scale]; out.apertures[m[1]] = { t: m[2], p }; }
        }
      }
      continue;
    }
    for (let cmd of tk.replace(/\n/g, '').split('*')) {
      cmd = cmd.trim(); if (!cmd || cmd.startsWith('G04')) continue;
      if (cmd === 'G36') { region = []; continue; }
      if (cmd === 'G37') { if (region && region.length > 2) out.regions.push(region); region = null; continue; }
      const g = cmd.match(/^G0?([123])/); if (g) interp = 'G0' + g[1];
      const dsel = cmd.match(/^(?:G54)?D(\d+)$/); if (dsel && +dsel[1] >= 10) { ap = out.apertures[dsel[1]]; continue; }
      const m = cmd.match(/(?:X([+-]?[\d.]+))?(?:Y([+-]?[\d.]+))?(?:I[+-]?[\d.]+)?(?:J[+-]?[\d.]+)?D0?([123])$/);
      if (!m) continue;
      const nx = m[1] !== undefined ? toNum(m[1], fmt.xd) : x, ny = m[2] !== undefined ? toNum(m[2], fmt.yd) : y, d = m[3];
      if (d === '1') { if (region) { if (!region.length) region.push([x, y]); region.push([nx, ny]); } else out.lines.push({ x1: x, y1: y, x2: nx, y2: ny, w: ap?.p?.[0] ?? .15 }); }
      else if (d === '2') { if (region) { if (region.length > 2) out.regions.push(region); region = []; } }
      else if (d === '3' && ap) out.flashes.push({ x: nx, y: ny, t: ap.t, w: ap.p[0], h: ap.p[1] ?? ap.p[0] });
      x = nx; y = ny;
    }
  }
  const xs = [], ys = [];
  out.flashes.forEach(f => { xs.push(f.x - f.w / 2, f.x + f.w / 2); ys.push(f.y - f.h / 2, f.y + f.h / 2); });
  out.lines.forEach(l => { xs.push(l.x1, l.x2); ys.push(l.y1, l.y2); });
  out.regions.forEach(r => r.forEach(([a, b]) => { xs.push(a); ys.push(b); }));
  if (xs.length) out.bbox = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  return out;
}

export function parseExcellon(text) {
  const tools = {}, holes = []; let cur = null, metric = true;
  for (const ln of text.replace(/\r/g, '').split('\n')) {
    const s = ln.trim();
    if (/^INCH/.test(s)) metric = false; if (/^METRIC/.test(s)) metric = true;
    let m = s.match(/^T(\d+)C([\d.]+)/); if (m) { tools[m[1]] = parseFloat(m[1] && m[2]) * (metric ? 1 : 25.4); continue; }
    m = s.match(/^T(\d+)$/); if (m) { cur = m[1]; continue; }
    m = s.match(/^X([+-]?[\d.]+)Y([+-]?[\d.]+)/); if (m && cur) { const k = metric ? 1 : 25.4; holes.push({ x: parseFloat(m[1]) * k, y: parseFloat(m[2]) * k, d: tools[cur] || .8 }); }
  }
  return holes;
}

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(v => v !== '')) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// Centroides: detecta columnas comunes (Designator/Ref, Mid X/PosX, Rotation/Rot, Package/Footprint)
export function parseCentroid(text) {
  return parseCSV(text).map(r => {
    const k = n => Object.keys(r).find(h => n.test(h));
    return { ref: r[k(/^(designator|ref)/i)], value: r[k(/^(value|val|comment)/i)] || '', pkg: r[k(/^(package|footprint)/i)] || '',
      x: parseFloat(r[k(/(mid ?x|posx|^x)/i)]), y: parseFloat(r[k(/(mid ?y|posy|^y)/i)]), rot: parseFloat(r[k(/^rot/i)] || 0), layer: r[k(/^(layer|side)/i)] || 'Top' };
  }).filter(c => c.ref && !isNaN(c.x));
}

export function parseIPC356(text) {
  const pts = [];
  for (const ln of text.split('\n')) {
    if (!ln.startsWith('317')) continue;
    const net = ln.slice(3, 17).trim(), ref = ln.slice(20, 26).trim(), pin = ln.slice(27, 31).trim();
    const m = ln.match(/X([+-]\d+)Y([+-]\d+)/); if (!m) continue;
    pts.push({ net, ref, pin, x: parseInt(m[1]) / 1000, y: parseInt(m[2]) / 1000, pth: /D\d{4}P/.test(ln) });
  }
  return pts;
}

// Dibuja un Gerber a SVG (coordenadas en mm, Y hacia arriba -> se invierte con transform)
export function gerberSVG(g, color, opacity = 1) {
  const f = g.flashes.map(p => p.t === 'C' ? `<circle cx="${p.x}" cy="${p.y}" r="${p.w / 2}"/>` : `<rect x="${p.x - p.w / 2}" y="${p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx="${p.t === 'O' ? Math.min(p.w, p.h) / 2 : 0}"/>`).join('');
  const l = g.lines.map(s => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke-width="${s.w}"/>`).join('');
  const r = g.regions.map(p => `<polygon points="${p.map(a => a.join(',')).join(' ')}"/>`).join('');
  return `<g fill="${color}" stroke="${color}" stroke-linecap="round" opacity="${opacity}">${r}${f}<g fill="none">${l}</g></g>`;
}

// Asocia cada pad de pasta/cobre al componente más cercano según centroides
export function padsByComponent(paste, comps, maxDist = 6) {
  const map = Object.fromEntries(comps.map(c => [c.ref, []]));
  for (const p of paste.flashes) {
    let best = null, bd = 1e9;
    for (const c of comps) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = c; } }
    if (best && bd < maxDist) map[best.ref].push(p);
  }
  return map;
}
