# Academia de Inspección: curso gamificado 3D de AOI, AXI, ICT y SPI

App web interactiva para el curso de pruebas estructurales: AOI 3D Koh Young Zenith, AOI 3D ViTrox V510, AXI ViTrox V810, ICT Keysight HP3070 y SPI 3D Koh Young. Todo el contenido está en español.

## Qué incluye

- **Gamificación**: XP, 9 niveles (de Aprendiz a Maestro de línea), insignias (más una de dominio por cada máquina), racha de aciertos, días seguidos, confeti y sonidos.
- **Mapa de mundos**: un mundo por máquina; cada módulo se desbloquea al aprobar el anterior o terminar sus lecciones. En Ajustes hay un modo libre para instructores.
- **Lecciones con animación 3D** (Three.js): 12 animaciones procedurales: línea SMT, franjas moiré/PSP, laminografía de rayos X, cama de agujas ICT, tipos de junta, calibración, fiduciales y transportador, volumen de pasta SPI, galería de defectos, flujo de programación, seguridad radiológica y recorrido por la máquina. Cada lección cierra con un reto rápido.
- **Taller de mantenimiento**: modelo 3D de cada máquina con piezas que se pueden seleccionar. Primero confirmas la lista de seguridad (LOTO, paro de emergencia) y luego haces clic en la pieza correcta y eliges la acción (inspeccionar, limpiar, lubricar, reemplazar, calibrar, accionar o medir). Al final se califica.
- **Simulador de software**: interfaz genérica de inspección con árbol de programa, vista de la tarjeta, panel de parámetros, log y barra de estado.
  - **Crea tu programa** en modo AOI, SPI, AXI o ICT con **archivos de manufactura reales** de la tarjeta PRACTICA-01: Gerber RS-274X, barrenos Excellon, centroides y netlist IPC-D-356. También acepta tus propios archivos. Los pasos son: importar, alinear con fiduciales, asignar la librería, ajustar umbrales y correr un lote de 50 tarjetas que trae defectos mezclados. El resultado muestra cuántos defectos se detectaron, cuántos falsos llamados hubo y cuántos escapes.
  - **Prácticas de creación y debug** por máquina, con decisiones paso a paso y ajuste de parámetros en vivo.
- **Exámenes autocalificados**: 22 exámenes de módulo y un examen final. Las opciones se barajan, hay temporizador opcional y una revisión con la respuesta correcta, su explicación y la sección del curso. También hay un banco de repaso con las preguntas falladas.

## Cómo abrirla

Sirve la carpeta con cualquier servidor estático (los módulos ES no cargan desde `file://`):

```bash
npx http-server . -p 8080      # o: python3 -m http.server 8080
```

Después abre http://localhost:8080. También funciona en GitHub Pages: Settings > Pages > Deploy from branch > `main` / root.

El progreso se guarda en el navegador (localStorage). En Ajustes puedes copiarlo y pegarlo para pasarlo a otro equipo.

## Estructura (pensada para crecer)

```
index.html            Página principal
css/app.css           Estilos
js/                   Código (main, store, fx, stage, scenes, machines, maintenance, simui, gerber, exams)
js/data/content.js    GENERADO: todo el contenido unido. No se edita a mano
vendor/               Three.js 0.170 (local, sin CDN)
content/              ← AQUÍ VA TODO EL CONTENIDO
  machines.json       Máquinas (nombre, marca, color, plantilla 3D)
  modules/mNN.json    Un archivo por módulo: lecciones + examen
  final_exam.json     Examen final
  maintenance/*.json  Procedimientos de mantenimiento
  practices/*.json    Prácticas de creación y debug
  boards/<id>/        Tarjetas de práctica: board.json + Gerber/Excellon/CSV/IPC
tools/build_content.py  Valida content/ y genera js/data/content.js
tools/gen_board.py      Genera la tarjeta PRACTICA-01
tests/smoke.js          Prueba automática con Playwright
```

**Para agregar o cambiar contenido** se editan o agregan archivos JSON en `content/` y después se corre:

```bash
python3 tools/build_content.py
```

El script valida todo: ids repetidos, animaciones o piezas desconocidas, respuestas fuera de rango y archivos que falten. Si encuentra un error no genera nada y te dice qué archivo corregir. No necesita instalar librerías.

### Agregar un módulo nuevo (por ejemplo, de un documento nuevo de AXI)

Crea `content/modules/m22.json`:

```json
{
  "id": "m22", "order": 22, "brand": "v8", "machine": "axi_v810",
  "title": "Módulo 22. Inspección de voids en QFN",
  "summary": "Una o dos frases.",
  "lessons": [{
    "id": "m22-l1", "title": "Qué es un void", "animation": "xray_tomo",
    "blocks": [
      {"kind": "text", "text": "Párrafo."},
      {"kind": "bullets", "items": ["punto 1", "punto 2"]},
      {"kind": "tip", "text": "Consejo práctico."},
      {"kind": "warning", "text": "Advertencia de seguridad o de proceso."}
    ],
    "keyPoints": ["Idea clave 1", "Idea clave 2"]
  }],
  "exam": [
    {"type": "mc", "q": "Pregunta", "options": ["Correcta", "Incorrecta", "Incorrecta"], "correct": 0, "explain": "Por qué", "section": "22.1"},
    {"type": "tf", "q": "Afirmación", "answer": true, "explain": "Por qué"}
  ]
}
```

- `machine`: un id de `content/machines.json`. Para una máquina nueva, agrégala ahí con su `model` (`aoi`, `axi`, `ict`, `spi` o `generic`) y su color. Aparece sola en el mapa, el taller, el simulador y las insignias.
- `animation`: `intro_line`, `moire_fringes`, `xray_tomo`, `ict_bed_of_nails`, `solder_joint`, `calibration_target`, `conveyor_fiducial`, `spi_paste_volume`, `defect_gallery`, `process_flow`, `safety_radiation` o `machine_tour`. Para crear una animación nueva, se agrega una función en `js/scenes.js` y su id en `tools/build_content.py`.
- En las preguntas `mc` y `case`, `correct` es el índice de la opción correcta. La app baraja las opciones al mostrarlas.

### Agregar un mantenimiento

`content/maintenance/<máquina>.json` (un objeto o una lista):

```json
{"id": "mt-v8-anual", "machine": "axi_v810", "title": "...", "frequency": "anual",
 "safety": ["LOTO aplicado", "..."],
 "steps": [{"part": "interlock", "action": "inspect", "text": "Instrucción concreta"}]}
```

Piezas (`part`): door, emergency_stop, conveyor, belt, rail_width, pcb, camera, projector, light_ring, xray_source, detector, interlock, fixture, probes, vacuum, pneumatic, filter, fan, calibration_target, pc_ups, tower_light, gantry.
Acciones (`action`): inspect, clean, lubricate, replace, calibrate, toggle, measure.

### Agregar una práctica

`content/practices/<máquina>.json`:

```json
{"id": "pr-...", "machine": "ict", "kind": "debug", "title": "...", "scenario": "Síntoma o caso",
 "steps": [{"prompt": "¿Qué haces?", "options": ["Correcta", "Mala", "Mala"], "correct": 0, "feedback": "Por qué"}],
 "params": [{"name": "Tolerancia", "unit": "%", "min": 0, "max": 30, "start": 1, "targetMin": 4, "targetMax": 6,
             "hint": "...", "lowEffect": "false"}]}
```

`params` es opcional. Por debajo del rango objetivo el parámetro produce falsos llamados (`"lowEffect": "false"`, el valor por defecto) o escapes (`"lowEffect": "escape"`). Por encima produce el efecto contrario.

### Agregar una tarjeta con Gerbers

Crea `content/boards/<id>/` con tus archivos y un `board.json` como el de `practica01` (medidas, la lista `files` y los `packages` con su algoritmo `CR`, `POL`, `GW`, `BGA`, `PTH`, `FID` o `TP`). El simulador lee Gerber RS-274X (apertures C, R y O, pistas y regiones, en mm o pulgadas), Excellon, CSV de centroides (columnas Designator, Mid X, Mid Y, Rotation y Package) e IPC-D-356.

## Pruebas

```bash
npx http-server . -p 8080 &
NODE_PATH=$(npm root -g) node tests/smoke.js          # escritorio 1280x800
NODE_PATH=$(npm root -g) node tests/smoke.js mobile   # móvil 390x844
```

## Fuentes

El contenido se basa en el curso `Curso_Tecnico_Pruebas_Estructurales` y en los manuales del proyecto (ViTrox V510/V810, Koh Young AOI/SPI, Keysight HP3070). La tarjeta PRACTICA-01 es un diseño de práctica generado por `tools/gen_board.py`; sus archivos abren en cualquier visor Gerber.
