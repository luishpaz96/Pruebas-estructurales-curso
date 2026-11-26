# Academia de Inspección en Unreal Engine 5 (C++)

Versión nativa de Windows del juego del curso. Todo está en C++: no hay mapas, Blueprints, mallas ni audios binarios en el repositorio. El juego arma la planta por código y lee el contenido del curso desde la carpeta `content/` del repo, así que para agregar material nuevo de AXI, AOI o ICT sólo se editan archivos JSON.

## Qué hay en el juego

- **Modo historia.** Eres un técnico de pruebas de nuevo ingreso. La Ing. Andrea Ramírez, ingeniera de pruebas, es tu mentora. Son 28 misiones en 6 capítulos, ordenadas de fácil a difícil, y cada una pide terminar la anterior:
  1. Primer día: seguridad ESD y recorrido por la línea.
  2. Capacitación: las bases de cada equipo (Koh Young, V510, V810, ICT y SPI) y un examen de proceso.
  3. El día a día: los primeros mantenimientos (avisas a manufactura, lo haces y liberas la máquina) y el primer falso llamado.
  4. Producción: escapes, pasta insuficiente, interlocks del AXI, fallas de contacto, SMEMA y calibración de luz.
  5. NPI y cambios de modelo: programas nuevos en AOI, SPI, AXI e ICT con los Gerber de PRACTICA-01, y cambio de fixture del ICT.
  6. Técnico de debug: cortos fantasma, open en BGA, mensuales, semestrales y la certificación final.
- **Línea SMT 3D a escala real** (1 unidad = 1 cm). La recorres caminando con WASD y el mouse, y con E usas la máquina que tienes enfrente. La línea va del cargador a la impresora, el SPI, dos colocadoras, el horno, el AOI Koh Young, el V510, el V810 y el descargador. El ICT está del otro lado del pasillo. Las medidas del V510 (1060 × 1353 × 2111 mm) y del V810 S2 (1520 × 1940 × 1890 mm) salen de los manuales del proyecto. Las demás están marcadas como aproximadas en `content/line.json`.
- **Software simulado de cada máquina.** Cada una tiene su propia interfaz: AOIGUI (Koh Young), Smart GUI (V510), Recipe/Production (V810), i3070 con BT-Basic (ICT) y CEditor (SPI). Los menús usan los nombres de los manuales. El flujo es importar los Gerber, enseñar fiduciales, asignar la librería, ajustar umbrales y correr un lote de 50 tarjetas. Al final ves los defectos detectados, los falsos llamados y los escapes.
- **Taller de mantenimiento sobre la máquina 3D.** Primero confirmas la lista de seguridad. Después haces clic en la pieza real del modelo y eliges la acción. Se califican los errores y las faltas de seguridad.
- **Lecciones, prácticas y exámenes autocalificados.** Son 22 exámenes de módulo más el final. Las opciones se barajan, puedes activar un temporizador, y al terminar ves la revisión con la explicación de cada respuesta. Las preguntas que fallas van a un banco de repaso.
- **Gamificación.** Tienes XP, 9 niveles (de Técnico de nuevo ingreso a Maestro de línea), insignias, rachas, confeti, música y efectos de sonido generados por código.

## Requisitos

- Windows 10 u 11 de 64 bits.
- Unreal Engine 5.4 o más nuevo, instalado con Epic Games Launcher.
- Visual Studio 2022 con las cargas de trabajo "Desarrollo para el escritorio con C++" y "Desarrollo de juegos con C++". También necesitas el SDK de Windows 10/11 y las herramientas MSVC v143.

## Compilar y abrir

1. Clona el repo completo. La carpeta `content/` de la raíz es la fuente del contenido.
2. Si tienes UE 5.5 o más nuevo, abre `unreal/AcademiaInspeccion/AcademiaInspeccion.uproject` con un editor de texto y cambia `"EngineAssociation": "5.4"` por tu versión.
3. Haz clic derecho en `AcademiaInspeccion.uproject` y elige **Generate Visual Studio project files**.
4. Abre `AcademiaInspeccion.sln`, elige la configuración **Development Editor | Win64** y compila (Ctrl+Shift+B).
   - Antes de cada compilación corre `Tools/SyncContent.ps1`, que copia `../../content` a `Content/CursoData`.
5. Abre el `.uproject` y presiona **Play**. El juego arranca en el mapa vacío del motor y construye la planta por código.

Desde la línea de comandos (ajusta la ruta del motor):

```bat
"C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\Build.bat" AcademiaInspeccionEditor Win64 Development -Project="%CD%\AcademiaInspeccion.uproject" -WaitMutex
```

## Empaquetar el .exe

En el editor ve a **Platforms > Windows > Package Project**. También puedes usar la línea de comandos:

```bat
"C:\Program Files\Epic Games\UE_5.4\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="%CD%\AcademiaInspeccion.uproject" -platform=Win64 -clientconfig=Shipping -build -cook -stage -pak -archive -archivedirectory="%CD%\Packaged"
```

El contenido se copia como archivos sueltos a `Packaged/Windows/AcademiaInspeccion/Content/CursoData/`. Si cambias un JSON en esa carpeta y reinicias el juego, el cambio aparece sin recompilar.

## Agregar contenido sin tocar código

Todo vive en `content/`, en la raíz del repo. Es el mismo contenido que usa la versión web.

| Qué | Dónde |
|---|---|
| Máquinas (nombre, marca, color) | `content/machines.json` |
| Módulos, lecciones y examen | `content/modules/mNN.json` |
| Examen final | `content/final_exam.json` |
| Mantenimientos | `content/maintenance/*.json` |
| Prácticas de creación y debug | `content/practices/*.json` |
| Tarjeta de práctica (Gerber, Excellon, centroides, IPC-356) | `content/boards/<id>/board.json` + archivos |
| **Línea SMT a escala real** | `content/line.json` |
| **Modo historia (misiones y mentora)** | `content/career/*.json` |
| Gerber propios para importar en el simulador | `CursoData/import/` |

### Agregar una misión a la historia

Agrega un objeto a `missions` en `content/career/historia.json`, o crea otro archivo en `content/career/`. Si quieres que la misión siga a otra, ponle `requires` con el id de la anterior y un `order` mayor.

```json
{
  "id": "h29-voids-qfn", "order": 29, "requires": ["h28-certificacion"],
  "rewardTitle": "Capítulo 7 · Especialista", "type": "debug", "machine": "axi_v810",
  "title": "Voids en QFN", "brief": "Una frase que explica la situación.",
  "mentorIntro": ["Lo que dice la mentora al empezar."],
  "tasks": [
    {"kind": "goto", "machine": "axi_v810"},
    {"kind": "talk", "text": "Explicación.\nCada renglón es una pantalla del diálogo."},
    {"kind": "lesson", "ref": "m22-l1"},
    {"kind": "practice", "ref": "pr-v8-debug-void"},
    {"kind": "maintenance", "ref": "mt-v8-semanal"},
    {"kind": "program", "mode": "axi", "machine": "axi_v810"},
    {"kind": "quiz", "q": "Pregunta", "options": ["Correcta", "Incorrecta"], "correct": 0, "explain": "Por qué"},
    {"kind": "exam", "ref": "m22"}
  ],
  "mentorOutro": ["Lo que dice al terminar."], "xp": 300
}
```

Si una misión apunta a una lección, práctica o examen que no existe, el juego no se cae. Lo reporta en **Ajustes > Contenido**.

### Agregar o mover una máquina de la línea

Agrega una estación a `content/line.json` con su `width`, `depth` y `height` en mm y una `template`. Las plantillas son `loader`, `printer`, `spi`, `pnp`, `reflow`, `aoi`, `axi`, `ict` y `unloader`. Si la estación tiene `machine`, debe ser un id de `machines.json`; así queda conectada a su software, sus módulos y su mantenimiento.

## Controles

| Tecla | Acción |
|---|---|
| WASD + mouse | Caminar y mirar |
| Shift | Correr |
| E | Usar la máquina de enfrente o avanzar el diálogo; cerca de la mentora abre el modo historia |
| Tab / Esc | Menú o regresar |
| Clic | En mantenimiento: elegir la pieza de la máquina |

## Estructura del código (`Source/AcademiaInspeccion/`)

| Archivo | Qué hace |
|---|---|
| `CourseContent.*` | Lee todos los JSON de `content/` en tiempo de ejecución y valida referencias |
| `AcademiaGerber.*`, `SBoardView.*` | Lector de Gerber RS-274X, Excellon, centroides e IPC-D-356, y vista 2D de la tarjeta |
| `AcademiaGameInstance.*`, `AcademiaSaveGame.h` | Progreso, XP, niveles, insignias, misiones y guardado |
| `AcademiaGameMode.*` | Arma la planta: piso, luces, línea a escala, sala de capacitación y jugador |
| `InspectionMachine.*` | Cada máquina hecha con primitivas, con piezas seleccionables y animaciones |
| `MentorActor.*` | La mentora, que camina a la máquina de la misión y habla |
| `AcademiaPlayerController.*` | Controles, cámara de enfoque para mantenimiento y selección de piezas con el mouse |
| `SAcademiaShell.*` | Interfaz principal: menú, modo historia, máquinas, diálogos, avisos y ajustes |
| `SLessonView`, `SExamView`, `SPracticeView`, `SMaintenanceView`, `SMachineSoftware` | Las vistas de cada actividad |
| `AcademiaAudio.*` | Música y efectos sintetizados en C++ |
| `AcademiaStyle.*` | Colores, fuentes y botones comunes (Slate) |
