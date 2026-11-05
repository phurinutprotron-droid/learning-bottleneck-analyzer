$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
Push-Location backend
try {
    $pytestRun = Join-Path $projectRoot ('.cache\pytest-' + [guid]::NewGuid().ToString('N'))
    ..\.venv\Scripts\python.exe -m pytest -q --basetemp $pytestRun
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
    ..\.venv\Scripts\python.exe -m alembic check
    if ($LASTEXITCODE -ne 0) { throw 'Migration drift check failed' }
} finally { Pop-Location }
Push-Location frontend
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
