$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$env:UV_CACHE_DIR = Join-Path $projectRoot '.cache\uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $projectRoot '.python'
$env:npm_config_cache = Join-Path $projectRoot '.cache\npm'
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        uv python install 3.12 --no-registry --no-bin
        if ($LASTEXITCODE -ne 0) { throw 'Python installation failed' }
        uv venv --python 3.12 .venv
    } else {
        py -3.12 -m venv .venv
    }
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed' }
}
if (Get-Command uv -ErrorAction SilentlyContinue) {
    uv pip sync --python .venv\Scripts\python.exe backend\requirements.lock
} else {
    .\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock
}
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed' }
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
Push-Location backend
try {
    ..\.venv\Scripts\python.exe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
} finally { Pop-Location }
Push-Location frontend
try {
    npm ci --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
} finally { Pop-Location }
Write-Output 'Setup complete. See README.md for server commands and staff provisioning.'
