$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonCandidates = @(
    (Join-Path $projectRoot "venv\Scripts\python.exe"),
    (Join-Path $projectRoot ".venv\Scripts\python.exe")
)

foreach ($pythonPath in $pythonCandidates) {
    if (-not (Test-Path $pythonPath)) {
        continue
    }

    Write-Host "Intentando iniciar backend con $pythonPath" -ForegroundColor Cyan
    & $pythonPath (Join-Path $projectRoot "run.py")

    if ($LASTEXITCODE -eq 0) {
        exit 0
    }

    Write-Host "No se pudo iniciar con $pythonPath. Probando el siguiente entorno..." -ForegroundColor Yellow
}

Write-Host "No se pudo iniciar el backend con '.venv' ni con 'venv'." -ForegroundColor Red
Write-Host "Revisa que el entorno elegido tenga Flask y Supabase instalados." -ForegroundColor Yellow
Write-Host "Ejemplo:" -ForegroundColor Yellow
Write-Host "  .\.venv\Scripts\pip.exe install -r requirements.txt"
exit 1
