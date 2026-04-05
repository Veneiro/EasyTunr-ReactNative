$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceRoot = Join-Path $repoRoot 'ds2_dense'
$outputRoot = Join-Path $repoRoot 'datasets\deepscores_yolo'
$converter = Join-Path $repoRoot 'tools\convert_deepscores_to_yolo.py'

if (-not (Test-Path $sourceRoot)) {
    throw "No existe la carpeta ds2_dense en: $sourceRoot"
}
if (-not (Test-Path $converter)) {
    throw "No existe el conversor en: $converter"
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

if (Test-Path '.\.venv\Scripts\python.exe') {
    $pythonExe = '.\.venv\Scripts\python.exe'
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = 'py'
} else {
    $pythonExe = 'python'
}

if ($pythonExe -eq 'py') {
    & py -3 "$converter" --source-root "$sourceRoot" --output-root "$outputRoot"
} else {
    & $pythonExe "$converter" --source-root "$sourceRoot" --output-root "$outputRoot"
}

Write-Host ''
Write-Host 'Listo. Dataset YOLO generado en:' -ForegroundColor Green
Write-Host $outputRoot -ForegroundColor Green
Write-Host ''
Write-Host 'Sube a Colab esta carpeta:' -ForegroundColor Yellow
Write-Host (Join-Path $repoRoot 'datasets\deepscores_yolo') -ForegroundColor Yellow
