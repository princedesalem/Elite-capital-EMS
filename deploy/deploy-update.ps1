# =============================================================
# EMS — DEPLOIEMENT D'UNE MISE A JOUR EN PRODUCTION
# Windows Server natif (sans Docker)
# Executer en PowerShell ADMINISTRATEUR sur le serveur de prod
#
# Usage :
#   .\deploy\deploy-update.ps1                   # pull main + restart backend
#   .\deploy\deploy-update.ps1 -Frontend         # + rebuild frontend
#   .\deploy\deploy-update.ps1 -Backfill         # + backfill sessions
#   .\deploy\deploy-update.ps1 -Frontend -Backfill -InstallDeps
# =============================================================

#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [switch]$Frontend,        # rebuild dist React
    [switch]$Backfill,        # rejoue backfill_sessions_from_audit.py
    [switch]$InstallDeps,     # pip install -r requirements.txt + npm ci
    [switch]$NoRestart,       # skip restart EMS-Backend
    [string]$RepoDir = "C:\EMS\extranet",
    [string]$Branch  = "main"
)

$ErrorActionPreference = "Stop"

function Write-Step { param($m) Write-Host "`n==[ $m ]==" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Fail { param($m) Write-Host "  [ERREUR] $m" -ForegroundColor Red; exit 1 }

$BackendDir  = Join-Path $RepoDir "backend"
$FrontendDir = Join-Path $RepoDir "frontend"
$Python      = Join-Path $BackendDir ".venv\Scripts\python.exe"
$Pip         = Join-Path $BackendDir ".venv\Scripts\pip.exe"

if (-not (Test-Path $RepoDir))  { Write-Fail "Repo introuvable: $RepoDir" }
if (-not (Test-Path $Python))   { Write-Fail "venv introuvable: $Python" }

# ---------------------------------------------------------------------------
# 1) Git pull
# ---------------------------------------------------------------------------
Write-Step "1/5 Pull du code ($Branch)"
Push-Location $RepoDir
try {
    $current = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($current -ne $Branch) {
        Write-Warn "Branche actuelle '$current', bascule sur '$Branch'..."
        git fetch origin $Branch
        git checkout $Branch
    }
    $before = (git rev-parse HEAD).Trim()
    git fetch origin $Branch
    git reset --hard "origin/$Branch"
    $after = (git rev-parse HEAD).Trim()
    if ($before -eq $after) {
        Write-OK "Deja a jour ($after)"
    } else {
        Write-OK "Mise a jour $before -> $after"
        git --no-pager log --oneline "$before..$after"
    }
}
finally { Pop-Location }

# ---------------------------------------------------------------------------
# 2) Dependances (optionnel)
# ---------------------------------------------------------------------------
if ($InstallDeps) {
    Write-Step "2/5 Installation des dependances Python"
    & $Pip install -q -r (Join-Path $BackendDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) { Write-Fail "pip install a echoue" }
    Write-OK "Dependances backend installees"

    if ($Frontend) {
        Write-Step "2bis/5 Installation des dependances Node"
        Push-Location $FrontendDir
        try {
            npm ci
            if ($LASTEXITCODE -ne 0) { Write-Fail "npm ci a echoue" }
            Write-OK "Dependances frontend installees"
        }
        finally { Pop-Location }
    }
} else {
    Write-OK "2/5 Skip installation des dependances (utiliser -InstallDeps si requirements modifies)"
}

# ---------------------------------------------------------------------------
# 3) Build frontend (optionnel)
# ---------------------------------------------------------------------------
if ($Frontend) {
    Write-Step "3/5 Build du frontend (npm run build)"
    Push-Location $FrontendDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build a echoue" }
        Write-OK "Frontend rebuild (dist/ regenere)"
    }
    finally { Pop-Location }
} else {
    Write-OK "3/5 Skip build frontend (utiliser -Frontend si UI modifiee)"
}

# ---------------------------------------------------------------------------
# 4) Restart service backend
# ---------------------------------------------------------------------------
if ($NoRestart) {
    Write-Warn "4/5 Restart backend SKIP (-NoRestart)"
} else {
    Write-Step "4/5 Redemarrage du service EMS-Backend"
    $svc = Get-Service EMS-Backend -ErrorAction SilentlyContinue
    if (-not $svc) { Write-Fail "Service EMS-Backend introuvable" }
    Restart-Service EMS-Backend -Force
    Start-Sleep -Seconds 4
    $svc.Refresh()
    if ($svc.Status -ne 'Running') {
        Write-Fail "Le service n'est pas Running (status=$($svc.Status)) — voir C:\EMS\logs\backend_stderr.log"
    }
    Write-OK "Service EMS-Backend Running"

    # Healthcheck rapide
    try {
        $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
        Write-OK "Healthcheck OK: $($h | ConvertTo-Json -Compress)"
    } catch {
        Write-Warn "Healthcheck KO: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
# 5) Backfill sessions (optionnel)
# ---------------------------------------------------------------------------
if ($Backfill) {
    Write-Step "5/5 Backfill SESSION_UTILISATION depuis audit_logs"
    $script = Join-Path $BackendDir "backfill_sessions_from_audit.py"
    if (-not (Test-Path $script)) { Write-Fail "Script introuvable: $script" }
    Push-Location $BackendDir
    try {
        $env:PYTHONPATH = $BackendDir
        & $Python $script
        if ($LASTEXITCODE -ne 0) { Write-Fail "Backfill a echoue" }
        Write-OK "Backfill termine"
    }
    finally { Pop-Location }
} else {
    Write-OK "5/5 Skip backfill (utiliser -Backfill pour reconstruire les sessions manquantes)"
}

Write-Host "`n==================================================" -ForegroundColor Magenta
Write-Host "  DEPLOIEMENT TERMINE AVEC SUCCES" -ForegroundColor Magenta
Write-Host "==================================================`n" -ForegroundColor Magenta
