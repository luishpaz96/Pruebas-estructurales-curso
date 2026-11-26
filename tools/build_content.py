#!/usr/bin/env python3
"""Une todo el contenido de content/ en js/data/content.js (window.COURSE).

Uso:  python3 tools/build_content.py
Se ejecuta cada vez que agregas o cambias un archivo dentro de content/.
Valida el contenido y avisa de errores (ids repetidos, animaciones o piezas
desconocidas, respuestas fuera de rango). No necesita librerías externas.
"""
import json, os, glob, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
C = os.path.join(ROOT, 'content')
OUT = os.path.join(ROOT, 'js', 'data', 'content.js')

ANIMS = {'intro_line', 'moire_fringes', 'xray_tomo', 'ict_bed_of_nails', 'solder_joint', 'calibration_target',
         'conveyor_fiducial', 'spi_paste_volume', 'defect_gallery', 'process_flow', 'safety_radiation', 'machine_tour'}
PARTS = {'door', 'emergency_stop', 'conveyor', 'belt', 'rail_width', 'pcb', 'camera', 'projector', 'light_ring',
         'xray_source', 'detector', 'interlock', 'fixture', 'probes', 'vacuum', 'pneumatic', 'filter', 'fan',
         'calibration_target', 'pc_ups', 'tower_light', 'gantry'}
ACTIONS = {'inspect', 'clean', 'lubricate', 'replace', 'calibrate', 'toggle', 'measure'}
BRAND_MACHINE = {'ky': 'aoi_ky', 'v5': 'aoi_v510', 'v8': 'axi_v810', 'ks': 'ict', 'spi': 'spi', 'gen': 'general'}

errors, warns = [], []

def load(p):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        errors.append(f'{os.path.relpath(p, ROOT)}: JSON inválido ({e})')
        return None

def many(pattern):
    """Cada archivo puede tener un objeto o una lista de objetos."""
    out = []
    for p in sorted(glob.glob(os.path.join(C, pattern))):
        d = load(p)
        if d is None: continue
        for x in (d if isinstance(d, list) else [d]):
            x['_file'] = os.path.relpath(p, C)
            out.append(x)
    return out

def check_q(where, q):
    t = q.get('type')
    if t == 'tf':
        if not isinstance(q.get('answer'), bool): errors.append(f'{where}: tf sin answer true/false')
    elif t in ('mc', 'case'):
        o = q.get('options') or []
        if len(o) < 2: errors.append(f'{where}: menos de 2 opciones')
        if not isinstance(q.get('correct', 0), int) or not 0 <= q.get('correct', 0) < len(o):
            errors.append(f'{where}: correct fuera de rango')
    else:
        errors.append(f'{where}: tipo de pregunta desconocido {t!r}')

machines = (load(os.path.join(C, 'machines.json')) or {}).get('machines', [])
mids = {m['id'] for m in machines}

modules = many('modules/*.json')
modules.sort(key=lambda m: (m.get('order', 999), m.get('id', '')))
seen = set()
for m in modules:
    w = m['_file']
    if m.get('id') in seen: errors.append(f'{w}: id de módulo repetido {m.get("id")}')
    seen.add(m.get('id'))
    if not m.get('machine'): m['machine'] = BRAND_MACHINE.get(m.get('brand'), 'general')
    if m['machine'] not in mids: errors.append(f'{w}: machine {m["machine"]!r} no está en machines.json')
    if not m.get('lessons'): warns.append(f'{w}: sin lecciones')
    for l in m.get('lessons', []):
        if l.get('animation') not in ANIMS:
            warns.append(f'{w}/{l.get("id")}: animación {l.get("animation")!r} desconocida -> machine_tour')
            l['animation'] = 'machine_tour'
    for i, q in enumerate(m.get('exam', []), 1): check_q(f'{w} examen #{i}', q)

final = load(os.path.join(C, 'final_exam.json')) or {'questions': []}
for i, q in enumerate(final.get('questions', []), 1): check_q(f'final_exam #{i}', q)

maint = many('maintenance/*.json')
for p in maint:
    w = f'{p["_file"]}/{p.get("id")}'
    if p.get('machine') not in mids: errors.append(f'{w}: machine desconocida')
    for s in p.get('steps', []):
        if s.get('part') not in PARTS: errors.append(f'{w}: pieza {s.get("part")!r} desconocida')
        if s.get('action') not in ACTIONS: errors.append(f'{w}: acción {s.get("action")!r} desconocida')

pracs = many('practices/*.json')
for p in pracs:
    w = f'{p["_file"]}/{p.get("id")}'
    if p.get('machine') not in mids: errors.append(f'{w}: machine desconocida')
    for i, s in enumerate(p.get('steps', []), 1):
        if not 0 <= s.get('correct', 0) < len(s.get('options', [])): errors.append(f'{w} paso {i}: correct fuera de rango')

# Tarjetas de práctica: content/boards/<id>/board.json + sus archivos Gerber/Excellon/CSV/IPC (se incrustan como texto)
boards = []
for bj in sorted(glob.glob(os.path.join(C, 'boards', '*', 'board.json'))):
    b = load(bj)
    if not b: continue
    b['data'] = {}
    for k, fn in b.get('files', {}).items():
        fp = os.path.join(os.path.dirname(bj), fn)
        if os.path.exists(fp): b['data'][k] = open(fp, encoding='utf-8', errors='replace').read()
        else: errors.append(f'boards/{b.get("id")}: falta el archivo {fn}')
    boards.append(b)

# Modo juego: carrera (días y misiones) e incidentes aleatorios
career = load(os.path.join(C, 'game', 'career.json')) or {'days': []}
incidents = load(os.path.join(C, 'game', 'incidents.json')) or []
STATIONS = {'aoi', 'aoi2', 'axi', 'ict', 'spi', 'line', 'mentor', 'prod', 'quality'}
TYPES = {'talk', 'lesson', 'notify', 'tour', 'review', 'alarm', 'npi', 'maint', 'practice', 'quiz', 'sequence'}
LESSONS = {l['id'] for m in modules for l in m.get('lessons', [])}
inc_ids = {i['id'] for i in incidents}
mids_all = set()
for d in career.get('days', []):
    for ms in d.get('missions', []):
        w = f'game/career.json/{ms.get("id")}'
        if ms.get('id') in mids_all: errors.append(f'{w}: id de misión repetido')
        mids_all.add(ms.get('id'))
        if ms.get('type') not in TYPES: errors.append(f'{w}: tipo {ms.get("type")!r} desconocido')
        if ms.get('station') not in STATIONS: errors.append(f'{w}: estación {ms.get("station")!r} desconocida')
        if ms.get('type') == 'maint' and not any(p.get('id') == ms.get('proc') for p in maint): errors.append(f'{w}: no existe el mantenimiento {ms.get("proc")}')
        if ms.get('type') == 'practice' and not any(p.get('id') == ms.get('practice') for p in pracs): errors.append(f'{w}: no existe la práctica {ms.get("practice")}')
        if ms.get('type') == 'lesson' and ms.get('lesson') not in LESSONS: warns.append(f'{w}: la lección {ms.get("lesson")} todavía no existe (se mostrará el resumen del módulo)')
        if ms.get('type') == 'alarm' and ms.get('incident') not in inc_ids: errors.append(f'{w}: no existe el incidente {ms.get("incident")}')
for i in incidents:
    if i.get('station') not in STATIONS: errors.append(f'game/incidents.json/{i.get("id")}: estación desconocida')

for w in warns: print('AVISO:', w)
if errors:
    for e in errors: print('ERROR:', e)
    sys.exit('No se generó content.js: corrige los errores de arriba.')

course = {'machines': machines, 'modules': modules, 'finalExam': final, 'maintenance': maint, 'practices': pracs, 'boards': boards, 'game': {'career': career, 'incidents': incidents}}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
s = json.dumps(course, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('/* Generado por tools/build_content.py. No editar a mano: edita content/ */\nwindow.COURSE=' + s + ';\n')
nl = sum(len(m.get('lessons', [])) for m in modules)
nq = sum(len(m.get('exam', [])) for m in modules) + len(final.get('questions', []))
print(f'OK: {len(machines)} máquinas, {len(modules)} módulos, {nl} lecciones, {nq} preguntas, '
      f'{len(maint)} mantenimientos, {len(pracs)} prácticas, {len(boards)} tarjetas, {len(career.get("days", []))} días de carrera, {len(incidents)} incidentes -> {os.path.relpath(OUT, ROOT)} ({len(s)//1024} KB)')
