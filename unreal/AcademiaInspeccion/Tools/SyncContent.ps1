# Copia el contenido del curso (carpeta content/ en la raíz del repo) a Content/CursoData
# antes de cada compilación. Así el juego empaquetado lleva los JSON como archivos sueltos.
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$src = Join-Path $project "..\..\content"
$dst = Join-Path $project "Content\CursoData"
if (-not (Test-Path $src)) { Write-Host "SyncContent: no encontré $src, se queda el contenido actual."; exit 0 }
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item -Recurse -Force (Join-Path $src "*") $dst
Write-Host "SyncContent: contenido copiado a $dst"
