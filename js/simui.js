// Software de inspección simulado + práctica "Crea tu programa" con archivos Gerber reales + reproductor de prácticas.
import { parseGerber, parseExcellon, parseCentroid, parseIPC356, gerberSVG, padsByComponent } from './gerber.js';
import { esc, sfx, toast, shuffle, dialog, confetti } from './fx.js';
import { state, save, addXP, answer, course } from './store.js';

const MODES = {
  aoi: { name: 'AOI 3D', machine: 'aoi_ky', color: '#3d8bff', layers: ['copper', 'silk', 'comps'],
    algos: { CR: 'Chip (R/C)', POL: 'Polarizado', GW: 'Gullwing (QFP/SOIC/SOT)', BGA: 'Cuerpo BGA (sólo presencia)', PTH: 'PTH / conector', FID: 'Fiducial' },
    params: [{ k: 'off', name: 'Tolerancia de desplazamiento', unit: '%', min: 5, max: 80, v: 15, tmin: 30, tmax: 42 }, { k: 'hgt', name: 'Umbral de altura / tombstone', unit: '%', min: 5, max: 80, v: 70, tmin: 30, tmax: 45 }, { k: 'pol', name: 'Score mínimo de polaridad', unit: '', min: 10, max: 95, v: 30, tmin: 55, tmax: 70, inv: true }],
    defects: [['Faltante', 'hgt', null], ['Desplazado', 'off', null], ['Polaridad invertida', 'pol', 'POL'], ['Tombstone', 'hgt', 'CR'], ['Puente', 'off', 'GW'], ['Terminal levantada', 'hgt', 'GW']] },
  spi: { name: 'SPI 3D', machine: 'spi', color: '#a77bff', layers: ['paste', 'copper'],
    algos: { CR: 'Depósito chip', POL: 'Depósito chip', GW: 'Depósito fino (pitch fino)', BGA: 'Depósito BGA (círculo)', PTH: 'Sin pasta', FID: 'Fiducial' },
    params: [{ k: 'vmin', name: 'Volumen mínimo', unit: '%', min: 20, max: 95, v: 85, tmin: 55, tmax: 70, inv: true }, { k: 'vmax', name: 'Volumen máximo', unit: '%', min: 110, max: 250, v: 220, tmin: 140, tmax: 165 }, { k: 'off', name: 'Desplazamiento máximo', unit: '%', min: 5, max: 80, v: 12, tmin: 25, tmax: 40 }],
    defects: [['Pasta insuficiente', 'vmin', null], ['Exceso de pasta', 'vmax', null], ['Puente de pasta', 'vmax', 'GW'], ['Depósito desplazado', 'off', null]] },
  axi: { name: 'AXI 3D', machine: 'axi_v810', color: '#ffb020', layers: ['copper', 'comps'],
    algos: { CR: 'Chip (filete)', POL: 'Chip polarizado', GW: 'Gullwing (talón)', BGA: 'Grid array (corte de bola)', PTH: 'PTH (llenado de barril)', FID: 'Fiducial' },
    params: [{ k: 'dia', name: 'Diámetro mínimo de bola', unit: '%', min: 40, max: 98, v: 95, tmin: 72, tmax: 82, inv: true }, { k: 'void', name: 'Void máximo', unit: '%', min: 5, max: 60, v: 55, tmin: 22, tmax: 30 }, { k: 'fill', name: 'Llenado mínimo de barril PTH', unit: '%', min: 20, max: 100, v: 30, tmin: 70, tmax: 80, inv: true }],
    defects: [['Puente en BGA', 'dia', 'BGA'], ['Void excesivo', 'void', 'BGA'], ['Head-in-pillow', 'dia', 'BGA'], ['Barril PTH incompleto', 'fill', 'PTH'], ['Talón insuficiente', 'dia', 'GW']] },
  ict: { name: 'ICT', machine: 'ict', color: '#ff5a5f', layers: ['copper', 'silk', 'tp'],
    algos: { CR: 'Resistor / capacitor', POL: 'Diodo / cap. polarizado', GW: 'Pines / TestJet', BGA: 'Boundary scan', PTH: 'Contacto / continuidad', FID: 'Sin prueba' },
    params: [{ k: 'tol', name: 'Tolerancia de medición', unit: '%', min: 1, max: 40, v: 2, tmin: 8, tmax: 12 }, { k: 'short', name: 'Umbral de cortos', unit: 'Ω', min: 1, max: 60, v: 55, tmin: 8, tmax: 15 }],
    defects: [['Valor incorrecto', 'tol', 'CR'], ['Abierto', 'tol', null], ['Corto entre nodos', 'short', null], ['Diodo invertido', 'tol', 'POL']] },
};
const ALGO_OF = pkg => (course.boards[0]?.packages?.[pkg]?.algo) || 'CR';

// Generador pseudoaleatorio con semilla
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());

function boardSVG(b, layers, ex = '') {
  const vb = `${-2} ${-2} ${b.width + 4} ${b.height + 4}`;
  const L = [];
  L.push(`<rect x="0" y="0" width="${b.width}" height="${b.height}" fill="#14532d" stroke="#d9c07a" stroke-width=".25"/>`);
  if (layers.copper && b.cu) L.push(gerberSVG(b.cu, '#c9a74a', .9));
  if (layers.mask && b.mask) L.push(gerberSVG(b.mask, '#7ad67a', .25));
  if (layers.paste && b.paste) L.push(gerberSVG(b.paste, '#c0c6cc', .95));
  if (layers.silk && b.silk) L.push(gerberSVG(b.silk, '#f2f2f2', .9));
  if (layers.drill && b.holes) L.push(b.holes.map(h => `<circle cx="${h.x}" cy="${h.y}" r="${h.d / 2}" fill="#0b0f13" stroke="#888" stroke-width=".1"/>`).join(''));
  if (layers.comps && b.comps) L.push(b.comps.filter(c => !/^FID|^TP/.test(c.ref)).map(c => { const p = b.packages?.[c.pkg]; if (!p || !p.body[0]) return ''; let [w, h] = p.body; if (c.rot % 180 === 90) [w, h] = [h, w];
    return `<rect data-ref="${esc(c.ref)}" x="${c.x - w / 2}" y="${c.y - h / 2}" width="${w}" height="${h}" rx=".2" fill="${p.algo === 'BGA' || p.algo === 'GW' ? '#23272c' : '#7a6a55'}" opacity=".9"/>`; }).join(''));
  if (layers.tp && b.ipc) L.push(b.ipc.filter(t => /^TP/.test(t.ref)).map(t => `<circle cx="${t.x}" cy="${t.y}" r=".9" fill="none" stroke="#ff5a5f" stroke-width=".25"/>`).join(''));
  // Etiquetas (no invertidas)
  const labels = layers.ref && b.comps ? b.comps.map(c => `<text x="${c.x}" y="${-c.y - 1.6}" font-size="1.5" fill="#e8eef4" text-anchor="middle" font-family="Barlow">${esc(c.ref)}</text>`).join('') : '';
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g transform="translate(0 ${b.height}) scale(1 -1)">${L.join('')}${ex}</g><g transform="translate(0 ${b.height})">${labels}</g></svg>`;
}

export function loadBoard(src) {
  const d = src.data || {};
  const b = { id: src.id, name: src.name, width: src.width, height: src.height, packages: src.packages || {} };
  if (d.copper) b.cu = parseGerber(d.copper);
  if (d.mask) b.mask = parseGerber(d.mask);
  if (d.paste) b.paste = parseGerber(d.paste);
  if (d.silk) b.silk = parseGerber(d.silk);
  if (d.drill) b.holes = parseExcellon(d.drill);
  if (d.centroid) b.comps = parseCentroid(d.centroid);
  if (d.netlist) b.ipc = parseIPC356(d.netlist);
  if (!b.width && b.cu?.bbox) { b.width = b.cu.bbox.x1; b.height = b.cu.bbox.y1; }
  return b;
}

// Apariencia de cada software real (referencia: capturas del curso). Sólo cambia el "cromo" de la ventana;
// el flujo de trabajo (importar, alinear, librería, umbrales, inspeccionar) es el mismo para todas.
export const SKINS = {
  aoigui: { title: 'AOIGUI · Koh Young Zenith', menu: ['File', 'View', 'Job', 'Tools', 'Option', 'Help'], tabs: ['Production', 'Programming', 'Teaching'], on: 1,
    info: () => `<table class="skstat"><tr><th>Pass Rate</th><th>Produced Qty</th><th>Good</th><th>False Call</th><th>NG</th></tr><tr><td id="skPR">—</td><td id="skQ">0</td><td id="skG">0</td><td id="skF">0</td><td id="skN">0</td></tr></table><div class="sklot"><span>Lot: <b>LOT-0001</b></span><span>Operator: <b>TEC</b></span><span>Lane 1 ● Lane 2 ○</span></div>`,
    foot: j => `<span>Job: ${esc(j)}</span><span>Lane1: Ready</span><span>Lane2: —</span><span class="sp"></span><span class="skidle">Idle</span>` },
  smartgui: { title: 'Smart GUI · ViTrox V510', menu: ['Program', 'Edit', 'View', 'Library', 'System', 'Help'], tabs: ['TRAINER', 'EDITOR'], on: 1,
    info: () => `<div class="skready">READY</div><div class="sktools">${['INSPECT', 'VISIT ALL', 'NEXT', 'PLANE', 'MASK', 'SKIP', 'MODIFY', 'SAVE'].map(t => `<button data-skt="${t}">${t}</button>`).join('')}</div><div class="sklist">${['Locator', 'Body', 'Warpage', 'Joint', 'Polarity', 'OCV'].map(t => `<span>${t}</span>`).join('')}</div>`,
    foot: j => `<span>${esc(j)}</span><span>Geometry · Location</span><span class="sp"></span><span>Online</span>` },
  v810: { title: 'AXI System v810', menu: ['File', 'Edit', 'View', 'Tools', 'Window', 'Help'], side: ['Main', 'Recipes', 'Production', 'Options', 'Services', 'Virtual Live'], sideOn: 1,
    info: () => `<div class="sklot"><span>System: <b>v810 S2</b></span><span>X-ray: <b>OFF</b></span><span>Interlocks: <b>OK</b></span><span>Panel: <b>—</b></span></div>`,
    foot: j => `<span>Recipe: ${esc(j)}</span><span>Mode: Development</span><span class="sp"></span><span>Status: Ready</span>` },
  btbasic: { title: 'BT-BASIC · /var/hp3070/boards/practica01', menu: ['File', 'Edit', 'Run', 'Debug', 'Board', 'Window', 'Help'], term: true,
    info: () => `<div class="sklot"><span>Board: <b>practica01</b></span><span>Fixture: <b>FX-PR01</b></span><span>Vacuum: <b>off</b></span><span>Testhead: <b>1</b></span></div>`,
    foot: j => `<span>testplan: ${esc(j)}</span><span>Module 0-3</span><span class="sp"></span><span>BT-BASIC ready</span>` },
  kyspi: { title: 'Koh Young SPI · CEditor', menu: ['File', 'Edit', 'View', 'Pad', 'Tools', 'Help'], tabs: ['CEditor', 'ePM-SPI', '3D Inspector'], on: 0,
    info: () => `<table class="skstat"><tr><th>Volume</th><th>Area</th><th>Height</th><th>Offset</th><th>Bridge</th></tr><tr><td>70–150 %</td><td>70–150 %</td><td>60–150 µm</td><td>±50 µm</td><td>On</td></tr></table>`,
    foot: j => `<span>Job: ${esc(j)}</span><span>Lane 1</span><span class="sp"></span><span class="skidle">Idle</span>` }
};
export const skinFor = (mode, machine) => machine === 'aoi_v510' ? 'smartgui' : ({ aoi: 'aoigui', axi: 'v810', ict: 'btbasic', spi: 'kyspi' })[mode] || 'aoigui';
function swShell(title, mode, tbButtons, skin = skinFor(mode)) {
  const K = SKINS[skin];
  return `<div class="sw sk-${skin}" style="--acc:${MODES[mode].color}">
  <div class="sktitle"><span class="skico"></span><span>${esc(K.title)} — ${esc(title)}</span><span class="sp"></span><span class="skwin">▁ ▢ ✕</span></div>
  <div class="mb">${K.menu.map(m => `<span>${m}</span>`).join('')}</div>
  ${K.tabs ? `<div class="sktabs">${K.tabs.map((t, i) => `<span class="${i === K.on ? 'on' : ''}">${t}</span>`).join('')}</div>` : ''}
  <div class="skinfo">${K.info()}</div>
  <div class="tb">${tbButtons}</div>
  <div class="body${K.side ? ' hasside' : ''}">${K.side ? `<div class="skside">${K.side.map((t, i) => `<span class="${i === K.sideOn ? 'on' : ''}">${t}</span>`).join('')}</div>` : ''}<div class="tree" id="swTree"></div><div class="view" id="swView"></div><div class="props" id="swProps"></div></div>
  <div class="log${K.term ? ' term' : ''}" id="swLog" aria-live="polite">${K.term ? '<div>BT-BASIC Rev 09.xx  (c) — simulador del curso</div>' : ''}</div>
  <div class="status" id="swStatus"><span>Listo</span></div><div class="skfoot">${K.foot(title)}</div></div>`;
}
function logger(el) { return (msg, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`; el.appendChild(d); el.scrollTop = el.scrollHeight; }; }

// ---------------------- Práctica guiada: Crea tu programa ----------------------
export function createProgram(root, mode = 'aoi', opts = {}) {
  const M = MODES[mode];
  const src = course.boards[0];
  const tabs = ['Importar', 'Alinear', 'Librería', 'Umbrales', 'Inspeccionar'];
  root.innerHTML = `<div class="row" style="margin-bottom:10px"><h2 style="margin:0">Crea tu programa · ${esc(M.name)}</h2><span class="sp"></span>
    <label class="mut">Máquina <select id="cpMode" class="btn">${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${k === mode ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></div>
    <p class="mut">Tarjeta ${esc(src?.name || '')}. Usa los archivos Gerber, Excellon, centroides e IPC-D-356 incluidos o carga los tuyos en Importar.</p>
    ${swShell('PRACTICA01_' + mode.toUpperCase(), mode, tabs.map((t, i) => `<button data-tab="${i}">${i + 1}. ${t}</button>`).join(''))}`;
  root.querySelector('#cpMode').onchange = e => createProgram(root, e.target.value, opts);
  if (opts.lockMode) root.querySelector('#cpMode').disabled = true;
  const tree = root.querySelector('#swTree'), view = root.querySelector('#swView'), props = root.querySelector('#swProps'), status = root.querySelector('#swStatus');
  const log = logger(root.querySelector('#swLog'));
  root.querySelectorAll('[data-skt]').forEach(b => b.onclick = () => log(`${b.dataset.skt}: usa los pasos numerados de abajo para esta práctica.`, 'w'));
  const P = { b: null, fids: [], lib: {}, params: Object.fromEntries(M.params.map(p => [p.k, p.v])), tab: 0, done: new Set(), layers: Object.fromEntries(M.layers.map(l => [l, true])) };
  P.layers.ref = false;

  const setTab = i => { P.tab = i; root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', +b.dataset.tab === i)); render(); };
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    const i = +b.dataset.tab;
    if (i > 0 && !P.b) return log('Primero importa los archivos de la tarjeta.', 'e');
    if (i > 1 && P.fids.length < 2) return log('Registra al menos 2 fiduciales en Alinear.', 'e');
    setTab(i);
  });
  const draw = (ex = '') => { if (P.b) view.innerHTML = boardSVG(P.b, P.layers, ex); else view.innerHTML = '<div class="empty" style="margin:30px">Sin tarjeta cargada</div>'; };
  const pkgs = () => [...new Set((P.b?.comps || []).map(c => c.pkg))];
  const treeRender = (ng = {}) => {
    if (!P.b) { tree.innerHTML = '<div class="mut">Programa vacío</div>'; return; }
    tree.innerHTML = `<div>▾ Board ${esc(P.b.name || '')}</div><div>&nbsp;▾ Fiduciales (${P.fids.length})</div>${P.fids.map(f => `<div class="okc">&nbsp;&nbsp;◎ ${esc(f)}</div>`).join('')}
      <div>&nbsp;▾ Componentes (${P.b.comps.length})</div>${P.b.comps.filter(c => !/^FID/.test(c.ref)).map(c => `<div data-ref="${esc(c.ref)}" class="${ng[c.ref] ? 'ng' : P.lib[c.pkg] ? 'okc' : ''}">&nbsp;&nbsp;${esc(c.ref)} · ${esc(c.pkg)}${ng[c.ref] ? ' ✕' + ng[c.ref] : ''}</div>`).join('')}`;
    tree.querySelectorAll('[data-ref]').forEach(d => d.onclick = () => { const c = P.b.comps.find(x => x.ref === d.dataset.ref); if (!c) return;
      draw(`<circle cx="${c.x}" cy="${c.y}" r="3.2" fill="none" stroke="${M.color}" stroke-width=".4"/>`);
      log(`${c.ref}: ${c.value} · ${c.pkg} · X ${c.x} Y ${c.y} · rot ${c.rot}° · algoritmo ${P.lib[c.pkg] ? M.algos[P.lib[c.pkg]] : 'sin asignar'}`); });
  };
  const layerToggles = () => `<div><b>Capas</b>${['copper', 'mask', 'paste', 'silk', 'drill', 'comps', 'tp', 'ref'].map(l => `<label class="toggle" style="min-height:30px"><input type="checkbox" data-l="${l}" ${P.layers[l] ? 'checked' : ''}> ${({ copper: 'Cobre', mask: 'Máscara', paste: 'Pasta', silk: 'Serigrafía', drill: 'Barrenos', comps: 'Componentes', tp: 'Test points', ref: 'Referencias' })[l]}</label>`).join('')}</div>`;
  const bindLayers = () => props.querySelectorAll('[data-l]').forEach(i => i.onchange = () => { P.layers[i.dataset.l] = i.checked; draw(); });

  function render() {
    const t = P.tab; treeRender();
    if (t === 0) {
      draw();
      props.innerHTML = `<b>1. Importar datos de CAD</b><p class="mut">Archivos incluidos: ${Object.values(src?.files || {}).map(esc).join(', ')}</p>
        <button class="btn pri" id="impDemo">Importar PRACTICA-01</button>
        <label>O carga tus archivos (Gerber, .drl, centroides .csv, .ipc)<input type="file" id="impFile" multiple></label>${P.b ? layerToggles() : ''}`;
      props.querySelector('#impDemo').onclick = () => importData(src.data, src);
      props.querySelector('#impFile').onchange = e => importFiles(e.target.files);
      bindLayers();
    } else if (t === 1) {
      draw(P.fids.map(r => { const c = P.b.comps.find(x => x.ref === r); return c ? `<circle cx="${c.x}" cy="${c.y}" r="1.4" fill="none" stroke="#36d07f" stroke-width=".35"/>` : ''; }).join(''));
      props.innerHTML = `<b>2. Alinear con fiduciales</b><p class="mut">Haz clic sobre los fiduciales de la tarjeta (marcas redondas de cobre en las esquinas). Usa dos en diagonal para corregir posición, rotación y escala.</p><div>Registrados: ${P.fids.length}/2+</div>${layerToggles()}`;
      bindLayers();
      view.querySelector('svg').onclick = ev => {
        const pt = svgPoint(view.querySelector('svg'), ev, P.b.height);
        const c = P.b.comps.map(c => ({ c, d: Math.hypot(c.x - pt.x, c.y - pt.y) })).sort((a, b) => a.d - b.d)[0];
        if (!c || c.d > 3) return log('No hay nada ahí. Busca las marcas redondas sin pasta.', 'w');
        if (!/^FID/.test(c.c.ref)) { sfx('bad'); return log(`${c.c.ref} no es un fiducial: un componente puede moverse y no sirve de referencia.`, 'e'); }
        if (!P.fids.includes(c.c.ref)) { P.fids.push(c.c.ref); sfx('ok'); log(`Fiducial ${c.c.ref} registrado en X ${c.c.x} Y ${c.c.y}. Calificación 0.97`, 'o'); }
        if (P.fids.length >= 2) { const [a, b] = P.fids.map(r => P.b.comps.find(x => x.ref === r)); const diag = Math.abs(a.x - b.x) > 20 && Math.abs(a.y - b.y) > 20;
          log(diag ? 'Alineación correcta: fiduciales en diagonal.' : 'Aviso: los fiduciales no están en diagonal, la corrección de rotación es pobre. Agrega el tercero.', diag ? 'o' : 'w'); P.done.add(1); }
        render();
      };
    } else if (t === 2) {
      draw();
      props.innerHTML = `<b>3. Librería</b><p class="mut">Asigna a cada tipo de encapsulado el ${mode === 'ict' ? 'tipo de prueba' : 'algoritmo/paquete'} correcto.</p>
        ${pkgs().filter(p => p !== 'FID' && (mode !== 'spi' || p !== 'TP')).map(p => `<label>${esc(p)} <small>(${P.b.comps.filter(c => c.pkg === p).map(c => c.ref).slice(0, 4).join(', ')}…)</small>
        <select data-pkg="${esc(p)}"><option value="">— elegir —</option>${Object.entries(M.algos).map(([k, v]) => `<option value="${k}" ${P.lib[p] === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}
        <button class="btn" id="libChk">Verificar librería</button>`;
      props.querySelectorAll('[data-pkg]').forEach(s => s.onchange = () => { P.lib[s.dataset.pkg] = s.value; treeRender(); });
      props.querySelector('#libChk').onclick = () => {
        let ok = 0, n = 0; pkgs().filter(p => p !== 'FID').forEach(p => { if (p === 'TP') { P.lib[p] = P.lib[p] || 'PTH'; return; } n++; const good = P.lib[p] === ALGO_OF(p) || (mode === 'spi' && M.algos[P.lib[p]] === M.algos[ALGO_OF(p)]); if (good) ok++; else log(`${p}: ${P.lib[p] ? 'algoritmo no adecuado' : 'sin asignar'}.`, 'w'); });
        log(`Librería: ${ok}/${n} encapsulados con el algoritmo adecuado.`, ok === n ? 'o' : 'w'); if (ok === n) { P.done.add(2); sfx('ok'); }
      };
    } else if (t === 3) {
      draw();
      props.innerHTML = `<b>4. Umbrales</b><p class="mut">Muy estricto produce falsos llamados; muy laxo deja escapar defectos.</p>${M.params.map(p => `<label>${esc(p.name)}: <b id="pv-${p.k}">${P.params[p.k]}${p.unit}</b><input type="range" min="${p.min}" max="${p.max}" value="${P.params[p.k]}" data-p="${p.k}"></label>`).join('')}
        <div class="meter"><div>Falsos estimados<b id="estF">–</b></div><div>Escapes estimados<b id="estE">–</b></div></div><p class="mut" style="font-size:13px">Estimado con 20 tarjetas de prueba (golden + defectuosas).</p>`;
      const upd = () => { const r = simulate(20, 7); props.querySelector('#estF').textContent = r.falses; props.querySelector('#estE').textContent = r.escapes; };
      props.querySelectorAll('[data-p]').forEach(i => i.oninput = () => { P.params[i.dataset.p] = +i.value; const p = M.params.find(x => x.k === i.dataset.p); props.querySelector('#pv-' + p.k).textContent = i.value + p.unit; upd(); });
      upd(); P.done.add(3);
    } else if (t === 4) {
      draw();
      props.innerHTML = `<b>5. Inspeccionar lote</b><p class="mut">Corre el programa sobre 50 tarjetas de producción con defectos reales mezclados.</p><button class="btn pri" id="run">▶ Correr 50 tarjetas</button><div class="meter" id="res"></div>`;
      props.querySelector('#run').onclick = run;
    }
    status.innerHTML = `<span>Paso ${t + 1}/5</span><span>Unidades: mm</span><span>Tarjeta: ${P.b ? P.b.width + ' × ' + P.b.height + ' mm' : '—'}</span><span>Fiduciales: ${P.fids.length}</span>`;
  }

  function importData(data, meta) {
    const b = loadBoard({ ...meta, data });
    if (!b.comps?.length) return log('No se encontraron centroides: carga también el archivo CSV de pick & place.', 'e');
    P.b = b; P.fids = []; P.done.add(0);
    log(`Gerber cobre: ${b.cu?.flashes.length || 0} pads, ${b.cu?.lines.length || 0} pistas (unidades ${b.cu?.units || '?'})`, 'o');
    if (b.paste) log(`Gerber pasta: ${b.paste.flashes.length} aperturas de stencil`, 'o');
    if (b.holes) log(`Excellon: ${b.holes.length} barrenos`, 'o');
    log(`Centroides: ${b.comps.length} componentes, ${new Set(b.comps.map(c => c.pkg)).size} encapsulados`, 'o');
    if (b.ipc) log(`IPC-D-356: ${b.ipc.length} puntos de red, ${new Set(b.ipc.map(t => t.net)).size} redes`, 'o');
    if (b.paste && b.comps) { const m = padsByComponent(b.paste, b.comps); const sin = Object.entries(m).filter(([r, v]) => !v.length && !/^(FID|TP|J)/.test(r)); log(sin.length ? `Aviso: ${sin.length} componentes sin pads de pasta asociados` : 'Pads de pasta asociados a todos los componentes SMD', sin.length ? 'w' : 'o'); }
    sfx('ok'); render();
  }
  async function importFiles(files) {
    const data = {}; let w = 0, h = 0;
    for (const f of files) {
      const t = await f.text(); const n = f.name.toLowerCase();
      if (/\.(csv|txt)$/.test(n) && /designator|ref/i.test(t.slice(0, 300))) data.centroid = t;
      else if (/\.(drl|xln|exc)$/.test(n) || t.startsWith('M48')) data.drill = t;
      else if (/\.ipc$/.test(n) || /^317/m.test(t)) data.netlist = t;
      else if (/paste|\.gtp$|\.gbp$/.test(n)) data.paste = t;
      else if (/silk|\.gto$/.test(n)) data.silk = t;
      else if (/mask|\.gts$/.test(n)) data.mask = t;
      else if (/edge|outline|\.gm1$|\.gko$/.test(n)) { const g = parseGerber(t); if (g.bbox) { w = g.bbox.x1 - g.bbox.x0; h = g.bbox.y1 - g.bbox.y0; } }
      else if (/%FS|G04|D0[123]/.test(t)) data.copper = t;
      log(`Leído ${f.name} (${Math.round(t.length / 1024)} KB)`);
    }
    importData(data, { id: 'user', name: 'Tarjeta del usuario', width: w, height: h, packages: src.packages });
  }

  // Simulación de lote: cada componente mide un valor normalizado; NG si cruza el umbral del parámetro correspondiente
  function simulate(n, seed) {
    const r = rng(seed * 7919 + 1); let falses = 0, escapes = 0, caught = 0; const ng = {}; const rows = [];
    const comps = P.b.comps.filter(c => !/^(FID|TP)/.test(c.ref));
    const tnorm = p => { const v = P.params[p.k]; const k = (v - p.min) / (p.max - p.min), lo = (p.tmin - p.min) / (p.max - p.min), hi = (p.tmax - p.min) / (p.max - p.min); return { k: p.inv ? 1 - k : k, lo: p.inv ? 1 - hi : lo, hi: p.inv ? 1 - lo : hi }; };
    for (let i = 0; i < n; i++) {
      const defective = r() < .3; const dcs = comps.filter(c => M.defects.some(d => !d[2] || d[2] === ALGO_OF(c.pkg))); const dc = defective && dcs.length ? dcs[Math.floor(r() * dcs.length)] : null;
      const algoOK = c => !!P.lib[c.pkg] && (P.lib[c.pkg] === ALGO_OF(c.pkg) || (mode === 'spi' && M.algos[P.lib[c.pkg]] === M.algos[ALGO_OF(c.pkg)]));
      let defect = null;
      if (dc) { const opts = M.defects.filter(d => !d[2] || d[2] === ALGO_OF(dc.pkg)); defect = opts[Math.floor(r() * opts.length)]; }
      let boardNG = false, realDefectCaught = false;
      for (const c of comps) {
        for (const p of M.params) {
          const t = tnorm(p); // t.k = umbral normalizado. Ruido de piezas buenas ~ por debajo de t.lo; defectos ~ por encima de t.hi
          const noise = Math.abs(gauss(r)) * t.lo / 4 * (algoOK(c) ? 1 : 3);
          if (noise > t.k && !(c === dc && defect?.[1] === p.k)) { falses++; boardNG = true; ng[c.ref] = 'falso'; }
        }
        if (c === dc) {
          const p = M.params.find(x => x.k === defect[1]); const t = tnorm(p);
          const sev = t.hi + (1 - t.hi) * r() * .9 + .02;
          const typeOK = !defect[2] || algoOK(c);
          if (sev > t.k && typeOK) { realDefectCaught = true; caught++; ng[c.ref] = defect[0]; } else { escapes++; rows.push(`Tarjeta ${i + 1}: ESCAPE ${defect[0]} en ${c.ref}`); }
        }
      }
      if (realDefectCaught) rows.push(`Tarjeta ${i + 1}: NG real ${defect[0]} en ${dc.ref}`);
    }
    return { falses, escapes, caught, ng, rows };
  }

  async function run() {
    const res = props.querySelector('#res'); const r = simulate(50, Date.now() % 1000);
    let k = 0; const step = () => { k = Math.min(50, k + 5); res.innerHTML = `<div>Tarjetas<b>${k}/50</b></div><div>NG reales<b class="pass">${Math.round(r.caught * k / 50)}</b></div><div>Falsos llamados<b style="color:var(--warn)">${Math.round(r.falses * k / 50)}</b></div><div>Escapes<b class="fail">${Math.round(r.escapes * k / 50)}</b></div>`; if (k < 50) setTimeout(step, 120); else finish(); };
    const finish = () => {
      treeRender(r.ng); r.rows.slice(0, 30).forEach(x => log(x, x.includes('ESCAPE') ? 'e' : 'o'));
      draw(Object.keys(r.ng).map(ref => { const c = P.b.comps.find(x => x.ref === ref); return c ? `<circle cx="${c.x}" cy="${c.y}" r="2.8" fill="none" stroke="${r.ng[ref] === 'falso' ? '#ffb020' : '#ff5a5f'}" stroke-width=".45"/>` : ''; }).join(''));
      const good = r.escapes === 0 && r.falses <= 3;
      log(`Resultado: ${r.caught} defectos detectados, ${r.falses} falsos llamados, ${r.escapes} escapes.`, good ? 'o' : 'w');
      const sk = id => root.querySelector(id); if (sk('#skQ')) { const ng = r.caught + r.falses; sk('#skQ').textContent = 50; sk('#skG').textContent = 50 - ng; sk('#skF').textContent = r.falses; sk('#skN').textContent = r.caught; sk('#skPR').textContent = Math.round((50 - ng) / 50 * 1000) / 10 + ' %'; }
      const S = state(); const id = 'crea-tu-programa' + (mode === 'aoi' ? '' : '-' + mode);
      if (good) {
        sfx('badge'); confetti();
        if (!S.prac[id]) { S.prac[id] = { best: 100, at: Date.now() }; if (mode !== 'aoi') S.prac['crea-tu-programa'] = S.prac['crea-tu-programa'] || { best: 100 }; addXP(250, 'por un programa sin escapes'); }
        dialog('Programa liberado a producción', `<p>Cero escapes y ${r.falses} falsos llamados. Tu programa ${esc(M.name)} está listo.</p>`).then(() => opts.onResult && opts.onResult({ good: true, falses: r.falses, escapes: r.escapes }));
      } else {
        sfx('bad');
        const tips = []; if (r.escapes) tips.push('Hay escapes: revisa que cada encapsulado tenga el algoritmo correcto y afloja menos los umbrales.'); if (r.falses > 3) tips.push('Demasiados falsos llamados: el umbral está muy estricto o el algoritmo no corresponde.');
        dialog('Todavía no', `<p>${tips.map(esc).join('<br>')}</p>`);
        opts.onAttempt && opts.onAttempt({ good: false, falses: r.falses, escapes: r.escapes });
      }
    };
    step();
  }
  setTab(0);
}

function svgPoint(svg, ev, H) {
  const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse()); return { x: q.x, y: H - q.y };
}

// ---------------------- Reproductor de prácticas definidas en content/practices ----------------------
export function playPractice(root, pr, onDone, backLabel = 'Volver al simulador') {
  const machine = course.machines.find(m => m.id === pr.machine) || { color: '#3d8bff', name: '' };
  const mode = { aoi_ky: 'aoi', aoi_v510: 'aoi', spi: 'spi', axi_v810: 'axi', ict: 'ict' }[pr.machine] || 'aoi';
  root.innerHTML = `<div class="row"><span class="tag" style="color:${machine.color}">${esc(machine.name)}</span><span class="tag">${pr.kind === 'debug' ? 'Debug' : 'Creación'}</span></div>
    <h2 style="margin:8px 0">${esc(pr.title)}</h2><p>${esc(pr.scenario)}</p>
    ${swShell(pr.title, mode, '<button class="on">Programa</button><button>Resultados</button><button>Historial</button>', skinFor(mode, pr.machine))}`;
  root.querySelector('.sw').style.setProperty('--acc', machine.color);
  const tree = root.querySelector('#swTree'), view = root.querySelector('#swView'), props = root.querySelector('#swProps'), log = logger(root.querySelector('#swLog'));
  const b = course.boards[0] ? loadBoard(course.boards[0]) : null;
  const layers = { copper: true, silk: true, comps: mode !== 'spi', paste: mode === 'spi', tp: mode === 'ict' };
  const steps = pr.steps || []; let i = 0, score = 0, mistakes = 0;
  const params = (pr.params || []).map(p => ({ ...p, v: p.start ?? p.min }));
  const hotRef = b?.comps?.[(pr.id || '').length % b.comps.length]?.ref;
  const mark = hotRef && b ? (() => { const c = b.comps.find(x => x.ref === hotRef); return `<circle cx="${c.x}" cy="${c.y}" r="3" fill="none" stroke="#ff5a5f" stroke-width=".45"/>`; })() : '';
  if (b) view.innerHTML = boardSVG(b, layers, pr.kind === 'debug' ? mark : '');
  tree.innerHTML = b ? `<div>▾ ${esc(b.name)}</div>${b.comps.filter(c => !/^FID/.test(c.ref)).slice(0, 26).map(c => `<div class="${pr.kind === 'debug' && c.ref === hotRef ? 'ng' : ''}">&nbsp;${esc(c.ref)} · ${esc(c.pkg)}</div>`).join('')}` : '';
  log(pr.kind === 'debug' ? `Alarma: ${pr.scenario}` : 'Programa nuevo abierto.', pr.kind === 'debug' ? 'e' : '');

  function paramsHTML() {
    if (!params.length) return '';
    return `<b>Ajuste de parámetros</b>${params.map((p, k) => `<label>${esc(p.name)}: <b id="ppv${k}">${p.v} ${esc(p.unit || '')}</b><input type="range" min="${p.min}" max="${p.max}" step="${(p.max - p.min) / 100}" value="${p.v}" data-k="${k}"></label><small class="mut">${esc(p.hint || '')}</small>`).join('')}
      <div class="meter"><div>Falsos llamados<b id="pF">–</b></div><div>Escapes<b id="pE">–</b></div></div><button class="btn" id="pOk">Aplicar y correr 50 tarjetas</button>`;
  }
  const evalParams = () => {
    let F = 0, E = 0;
    params.forEach(p => { const span = p.max - p.min || 1; const low = p.lowEffect === 'escape' ? 'E' : 'F';
      if (p.v < p.targetMin) { const n = Math.round(Math.min(1, (p.targetMin - p.v) / span * 3) * 18 + 1); low === 'F' ? F += n : E += Math.ceil(n / 3); }
      if (p.v > p.targetMax) { const n = Math.round(Math.min(1, (p.v - p.targetMax) / span * 3) * 18 + 1); low === 'F' ? E += Math.ceil(n / 3) : F += n; } });
    return { F, E };
  };
  function renderStep() {
    if (i < steps.length) {
      const s = steps[i]; const order = shuffle(s.options.map((o, k) => k));
      props.innerHTML = `<b>Paso ${i + 1} de ${steps.length}</b><p>${esc(s.prompt)}</p><div class="opts">${order.map(k => `<button class="opt" data-k="${k}">${esc(s.options[k])}</button>`).join('')}</div><div id="sfb"></div>`;
      props.querySelectorAll('.opt').forEach(btn => btn.onclick = () => {
        const k = +btn.dataset.k, ok = k === (s.correct ?? 0);
        answer(ok); sfx(ok ? 'ok' : 'bad'); btn.classList.add(ok ? 'good' : 'wrong');
        if (ok) { score++; log('✔ ' + s.options[k], 'o'); props.querySelectorAll('.opt').forEach(b => b.disabled = true);
          props.querySelector('#sfb').innerHTML = `<div class="fb good">${esc(s.feedback || 'Correcto.')}</div><button class="btn pri" id="nx" style="margin-top:8px">Continuar</button>`;
          props.querySelector('#nx').onclick = () => { i++; renderStep(); }; }
        else { mistakes++; btn.disabled = true; log('✘ ' + s.options[k], 'e'); props.querySelector('#sfb').innerHTML = `<div class="fb wrong">No es lo mejor. ${esc(s.feedback || '')}</div>`; }
      });
    } else if (params.length && !props.dataset.pdone) {
      props.innerHTML = paramsHTML();
      const upd = () => { const r = evalParams(); props.querySelector('#pF').textContent = r.F; props.querySelector('#pE').textContent = r.E; };
      props.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => { const p = params[+inp.dataset.k]; p.v = +(+inp.value).toFixed(2); props.querySelector('#ppv' + inp.dataset.k).textContent = p.v + ' ' + (p.unit || ''); upd(); });
      upd();
      props.querySelector('#pOk').onclick = () => { const r = evalParams(); log(`Lote de 50: ${r.F} falsos llamados, ${r.E} escapes`, r.F + r.E ? 'w' : 'o');
        if (r.F + r.E === 0) { props.dataset.pdone = 1; sfx('ok'); renderStep(); } else { mistakes++; sfx('bad'); toast('Ajusta hasta tener 0 falsos llamados y 0 escapes'); } };
    } else finish();
  }
  function finish() {
    const pct = Math.max(0, Math.round(100 * score / Math.max(1, score + mistakes)));
    const S = state(); const prev = S.prac[pr.id]?.best || 0;
    S.prac[pr.id] = { best: Math.max(prev, pct), at: Date.now() }; save();
    if (!prev) addXP(80 + Math.round(pct), 'por completar la práctica'); else if (pct > prev) addXP(20, 'por mejorar tu marca');
    if (pct === 100) confetti();
    props.innerHTML = `<b>Práctica terminada</b><div class="score ${pct >= 70 ? 'pass' : 'fail'}">${pct}%</div><p>${mistakes} errores.</p><button class="btn pri" id="back">${esc(backLabel)}</button>`;
    props.querySelector('#back').onclick = () => onDone && onDone(pct);
    log('Programa validado y guardado.', 'o');
  }
  renderStep();
}
export { MODES };
