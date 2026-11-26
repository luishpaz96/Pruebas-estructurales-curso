#!/usr/bin/env python3
"""Genera la tarjeta de práctica PRACTICA-01 con archivos de manufactura REALES:
Gerber RS-274X (cobre, máscara, pasta, serigrafía, contorno), barrenos Excellon,
centroides pick & place (CSV), BOM (CSV) y netlist de prueba IPC-D-356 para ICT.
Los archivos abren en cualquier visor Gerber (gerbv, KiCad GerbView, Ucamco Reference Viewer).

Uso: python3 tools/gen_board.py   -> content/boards/practica01/
"""
import os, math, json

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'content', 'boards', 'practica01')
os.makedirs(OUT, exist_ok=True)
BW, BH = 60.0, 40.0  # mm

# Huellas: lista de pads (x, y, w, h, forma) relativos al centro, en mm, con rotación 0
def chip(l, pw, ph, gap):
    return [(-gap / 2 - pw / 2, 0, pw, ph, 'R', '1'), (gap / 2 + pw / 2, 0, pw, ph, 'R', '2')]
def soic(n, pitch=1.27, span=5.4, pw=0.6, ph=1.55):
    k = n // 2; p = []
    for i in range(k):
        y = (k - 1) / 2 * pitch - i * pitch
        p.append((-span / 2, y, ph, pw, 'R', str(i + 1)))
    for i in range(k):
        y = -(k - 1) / 2 * pitch + i * pitch
        p.append((span / 2, y, ph, pw, 'R', str(k + i + 1)))
    return p
def qfp(n, pitch=0.8, span=8.4, pw=0.45, ph=1.5):
    k = n // 4; p = []; num = 1
    for side in range(4):
        for i in range(k):
            o = (k - 1) / 2 * pitch - i * pitch
            if side == 0: p.append((-span / 2, o, ph, pw, 'R', str(num)))
            if side == 1: p.append((-o, -span / 2, pw, ph, 'R', str(num)))
            if side == 2: p.append((span / 2, -o, ph, pw, 'R', str(num)))
            if side == 3: p.append((o, span / 2, pw, ph, 'R', str(num)))
            num += 1
    return p
def bga(rows, pitch=0.8, d=0.4):
    p = []; L = 'ABCDEFGHJK'
    for r in range(rows):
        for c in range(rows):
            p.append(((c - (rows - 1) / 2) * pitch, ((rows - 1) / 2 - r) * pitch, d, d, 'C', f'{L[r]}{c + 1}'))
    return p
def sot23():
    return [(-0.95, -1.1, 0.6, 0.9, 'R', '1'), (0.95, -1.1, 0.6, 0.9, 'R', '2'), (0, 1.1, 0.6, 0.9, 'R', '3')]
def header(n, pitch=2.54):
    return [(0, (n - 1) / 2 * pitch - i * pitch, 1.7, 1.7, 'R' if i == 0 else 'C', str(i + 1)) for i in range(n)]

PKG = {
    '0603': dict(pads=chip(1, 0.9, 0.95, 0.8), body=(1.6, 0.8), h=0.45, algo='CR'),
    '0805': dict(pads=chip(1, 1.0, 1.35, 1.0), body=(2.0, 1.25), h=0.6, algo='CR'),
    'SOD-123': dict(pads=chip(1, 0.9, 1.2, 2.3), body=(2.7, 1.6), h=1.1, algo='POL'),
    'SMA-CAP': dict(pads=chip(1, 1.6, 1.4, 2.2), body=(3.3, 3.3), h=4.5, algo='POL'),
    'SOT-23': dict(pads=sot23(), body=(2.9, 1.3), h=1.0, algo='GW'),
    'SOIC-8': dict(pads=soic(8), body=(4.9, 3.9), h=1.5, algo='GW'),
    'QFP-32': dict(pads=qfp(32), body=(7.0, 7.0), h=1.4, algo='GW'),
    'BGA-64': dict(pads=bga(8), body=(7.0, 7.0), h=1.2, algo='BGA'),
    'HDR-1x6': dict(pads=header(6), body=(2.5, 15.2), h=8.5, algo='PTH', pth=1.0),
    'FID': dict(pads=[(0, 0, 1.0, 1.0, 'C', '1')], body=(0, 0), h=0, algo='FID'),
    'TP': dict(pads=[(0, 0, 1.2, 1.2, 'C', '1')], body=(0, 0), h=0, algo='TP'),
}

# Componentes: (ref, paquete, valor, x, y, rot)
COMPS = [
    ('FID1', 'FID', 'Fiducial', 3.0, 3.0, 0), ('FID2', 'FID', 'Fiducial', 57.0, 37.0, 0), ('FID3', 'FID', 'Fiducial', 57.0, 3.0, 0),
    ('U1', 'QFP-32', 'STM32F030K6', 17.0, 22.0, 0), ('U2', 'BGA-64', 'FPGA-64', 38.0, 22.0, 0), ('U3', 'SOIC-8', 'LM358', 17.0, 8.0, 0),
    ('Q1', 'SOT-23', 'BSS138', 27.0, 8.0, 0), ('D1', 'SOD-123', '1N4148W', 27.0, 33.5, 0), ('CP1', 'SMA-CAP', '47uF 16V', 8.0, 33.0, 90),
    ('J1', 'HDR-1x6', 'Conector 6P', 53.0, 20.0, 0),
    ('R1', '0603', '10k', 8.0, 15.0, 0), ('R2', '0603', '4.7k', 8.0, 12.0, 0), ('R3', '0603', '1k', 8.0, 25.0, 90), ('R4', '0603', '100R', 27.0, 15.0, 90),
    ('R5', '0805', '0R', 47.0, 8.0, 0), ('R6', '0603', '220R', 47.0, 33.0, 0),
    ('C1', '0603', '100nF', 11.0, 25.0, 90), ('C2', '0603', '100nF', 30.0, 15.0, 90), ('C3', '0805', '10uF', 47.0, 12.0, 0), ('C4', '0603', '1nF', 33.0, 33.5, 0),
    ('C5', '0603', '100nF', 38.0, 32.0, 0), ('C6', '0805', '22uF', 22.0, 33.5, 0),
    ('TP1', 'TP', 'VCC', 44.0, 4.0, 0), ('TP2', 'TP', 'GND', 47.0, 4.0, 0), ('TP3', 'TP', '3V3', 50.0, 4.0, 0), ('TP4', 'TP', 'OUT', 44.0, 37.0, 0),
    ('TP5', 'TP', 'SWDIO', 13.0, 37.0, 0), ('TP6', 'TP', 'SWCLK', 16.0, 37.0, 0),
]

def rot(x, y, r):
    a = math.radians(r); return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)

pads = []  # (x, y, w, h, shape, ref, pin, pth)
for ref, pk, val, cx, cy, r in COMPS:
    P = PKG[pk]
    for (px, py, w, h, sh, pin) in P['pads']:
        dx, dy = rot(px, py, r)
        if r % 180 == 90: w, h = h, w
        pads.append((cx + dx, cy + dy, w, h, sh, ref, pin, P.get('pth', 0)))

# Redes simples para el netlist IPC-D-356 y las pistas
NETS = {
    'VCC': [('J1', '1'), ('TP1', '1'), ('R5', '1'), ('C3', '1'), ('CP1', '1')],
    'GND': [('J1', '2'), ('TP2', '1'), ('C1', '2'), ('C2', '2'), ('C3', '2'), ('C5', '2'), ('CP1', '2'), ('U3', '4'), ('Q1', '2')],
    '3V3': [('TP3', '1'), ('R5', '2'), ('U1', '1'), ('C1', '1'), ('C2', '1'), ('C5', '1'), ('U2', 'A1')],
    'OUT': [('TP4', '1'), ('R6', '2'), ('U3', '1'), ('D1', '1')],
    'SWDIO': [('TP5', '1'), ('U1', '23'), ('J1', '3')],
    'SWCLK': [('TP6', '1'), ('U1', '24'), ('J1', '4')],
    'VREF': [('R1', '2'), ('R2', '1'), ('U3', '3')],
}
padmap = {(p[5], p[6]): p for p in pads}

def f(v): return str(int(round(v * 1e6)))  # formato 4.6 en mm

def gerber(name, func, items, extra=None):
    """items: lista de (tipo, ...) -> 'pad' (x,y,w,h,shape) o 'line' (x1,y1,x2,y2,width)"""
    ap = {}; out = []
    def code(key):
        if key not in ap: ap[key] = 10 + len(ap)
        return ap[key]
    body = []
    cur = None
    for it in items:
        if it[0] == 'pad':
            _, x, y, w, h, sh = it
            key = ('C', round(w, 4)) if sh == 'C' else ('O', round(w, 4), round(h, 4)) if sh == 'O' else ('R', round(w, 4), round(h, 4))
            c = code(key)
            if c != cur: body.append(f'D{c}*'); cur = c
            body.append(f'X{f(x)}Y{f(y)}D03*')
        else:
            _, x1, y1, x2, y2, wd = it
            c = code(('C', round(wd, 4)))
            if c != cur: body.append(f'D{c}*'); cur = c
            body.append(f'X{f(x1)}Y{f(y1)}D02*'); body.append(f'X{f(x2)}Y{f(y2)}D01*')
    out += ['G04 PRACTICA-01 - Academia de Inspeccion · archivo de practica*', '%TF.GenerationSoftware,Academia,gen_board.py,1.0*%',
            f'%TF.FileFunction,{func}*%', '%FSLAX46Y46*%', '%MOMM*%', '%LPD*%']
    for key, c in ap.items():
        if key[0] == 'C': out.append(f'%ADD{c}C,{key[1]:.4f}*%')
        else: out.append(f'%ADD{c}{key[0]},{key[1]:.4f}X{key[2]:.4f}*%')
    out += ['G01*'] + body + ['M02*']
    with open(os.path.join(OUT, name), 'w', newline='\n') as fh: fh.write('\n'.join(out) + '\n')

# Cobre superior: pads + pistas entre pads de cada red (ruteo en L)
cu = [('pad', p[0], p[1], p[2], p[3], p[4]) for p in pads]
for net, pins in NETS.items():
    pts = [padmap[k] for k in pins if k in padmap]
    for a, b in zip(pts, pts[1:]):
        w = 0.5 if net in ('VCC', 'GND', '3V3') else 0.25
        cu.append(('line', a[0], a[1], b[0], a[1], w)); cu.append(('line', b[0], a[1], b[0], b[1], w))
gerber('PRACTICA01-F_Cu.gtl', 'Copper,L1,Top', cu)
# Máscara: pads + 0.1 mm por lado
gerber('PRACTICA01-F_Mask.gts', 'Soldermask,Top', [('pad', p[0], p[1], p[2] + .2, p[3] + .2, p[4]) for p in pads])
# Pasta: sólo SMD (no fiduciales, test points ni PTH); apertura al 90 % (reducción típica del stencil)
paste = [p for p in pads if not p[7] and not p[5].startswith(('FID', 'TP'))]
gerber('PRACTICA01-F_Paste.gtp', 'Paste,Top', [('pad', p[0], p[1], p[2] * .9, p[3] * .9, p[4]) for p in paste])
# Serigrafía: contorno de cuerpos + marca de pin 1 / polaridad
silk = []
for ref, pk, val, cx, cy, r in COMPS:
    bw, bh = PKG[pk]['body']
    if not bw: continue
    if r % 180 == 90: bw, bh = bh, bw
    x0, y0, x1, y1 = cx - bw / 2 - .25, cy - bh / 2 - .25, cx + bw / 2 + .25, cy + bh / 2 + .25
    silk += [('line', x0, y0, x1, y0, .15), ('line', x1, y0, x1, y1, .15), ('line', x1, y1, x0, y1, .15), ('line', x0, y1, x0, y0, .15)]
    if PKG[pk]['algo'] in ('GW', 'BGA', 'POL'):
        silk.append(('pad', x0 - .35, y1 + .35 if PKG[pk]['algo'] != 'POL' else cy, .5, .5, 'C'))
gerber('PRACTICA01-F_Silkscreen.gto', 'Legend,Top', silk)
gerber('PRACTICA01-Edge_Cuts.gm1', 'Profile,NP', [('line', 0, 0, BW, 0, .1), ('line', BW, 0, BW, BH, .1), ('line', BW, BH, 0, BH, .1), ('line', 0, BH, 0, 0, .1)])

# Excellon: barrenos del conector y 4 barrenos de montaje / tooling del fixture ICT
holes = [(p[0], p[1], p[7]) for p in pads if p[7]] + [(2.0, 20.0, 3.2), (58.0, 20.0, 3.2), (30.0, 2.0, 3.2), (30.0, 38.0, 3.2)]
tools = sorted({h[2] for h in holes})
drl = ['M48', '; PRACTICA-01 barrenos', 'FMAT,2', 'METRIC,TZ']
drl += [f'T{i + 1}C{t:.3f}' for i, t in enumerate(tools)] + ['%', 'G90', 'G05']
for i, t in enumerate(tools):
    drl.append(f'T{i + 1}')
    drl += [f'X{x:.3f}Y{y:.3f}' for x, y, d in holes if d == t]
drl.append('M30')
open(os.path.join(OUT, 'PRACTICA01.drl'), 'w', newline='\n').write('\n'.join(drl) + '\n')

# Centroides (pick & place) y BOM
with open(os.path.join(OUT, 'PRACTICA01-pos.csv'), 'w', newline='\n') as fh:
    fh.write('Designator,Value,Package,Mid X(mm),Mid Y(mm),Rotation,Layer\n')
    for ref, pk, val, cx, cy, r in COMPS:
        if pk == 'TP': continue
        fh.write(f'{ref},{val},{pk},{cx:.3f},{cy:.3f},{r},Top\n')
bom = {}
for ref, pk, val, *_ in COMPS:
    if pk in ('FID', 'TP'): continue
    bom.setdefault((val, pk), []).append(ref)
with open(os.path.join(OUT, 'PRACTICA01-BOM.csv'), 'w', newline='\n') as fh:
    fh.write('Item,Qty,Value,Package,Designators\n')
    for i, ((val, pk), refs) in enumerate(sorted(bom.items(), key=lambda x: x[1][0]), 1):
        fh.write(f'{i},{len(refs)},"{val}",{pk},"{" ".join(refs)}"\n')

# IPC-D-356 (netlist de prueba): registros 317 para cada pin de red, con acceso desde arriba (A01)
ipc = ['C  PRACTICA-01 netlist de prueba para ICT', 'C  Generado por gen_board.py', 'P  JOB   PRACTICA-01', 'P  UNITS CUST 1', 'P  DIM   N']
for net, pins in NETS.items():
    for ref, pin in pins:
        p = padmap.get((ref, pin))
        if not p: continue
        x, y = int(round(p[0] * 1000)), int(round(p[1] * 1000))
        hole = f'D{int(p[7] * 1000):04d}P' if p[7] else '      '
        rec = f'317{net:<14.14} {ref:<6.6}-{pin:<4.4} {hole}A01X{x:+07d}Y{y:+07d}X{int(p[2] * 1000):04d}Y{int(p[3] * 1000):04d}R000 S0'
        ipc.append(rec)
ipc.append('999')
open(os.path.join(OUT, 'PRACTICA01.ipc'), 'w', newline='\n').write('\n'.join(ipc) + '\n')

meta = {
    'id': 'practica01', 'name': 'PRACTICA-01 (MCU + FPGA BGA)', 'width': BW, 'height': BH, 'thickness': 1.6,
    'description': 'Tarjeta de práctica de 60 × 40 mm con QFP-32, BGA-64, SOIC-8, SOT-23, chips 0603/0805, diodo y capacitor polarizados, conector PTH y 6 test points.',
    'files': {
        'copper': 'PRACTICA01-F_Cu.gtl', 'mask': 'PRACTICA01-F_Mask.gts', 'paste': 'PRACTICA01-F_Paste.gtp', 'silk': 'PRACTICA01-F_Silkscreen.gto',
        'outline': 'PRACTICA01-Edge_Cuts.gm1', 'drill': 'PRACTICA01.drl', 'centroid': 'PRACTICA01-pos.csv', 'bom': 'PRACTICA01-BOM.csv', 'netlist': 'PRACTICA01.ipc',
    },
    'packages': {k: {'algo': v['algo'], 'height': v['h'], 'body': v['body']} for k, v in PKG.items()},
}
json.dump(meta, open(os.path.join(OUT, 'board.json'), 'w'), ensure_ascii=False, indent=1)
print('Tarjeta generada en', OUT, '·', len(pads), 'pads,', len(COMPS), 'componentes')
