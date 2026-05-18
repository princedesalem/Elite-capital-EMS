# EMS Post-Installation Validation Test Suite
# Exécuter en tant qu'administrateur après installation

param(
    [string]$TestType = "all"  # all, quick, backend, database, services
)

$EMS_ROOT = "C:\EMS\extranet"
$PASSED = 0
$FAILED = 0

function Test-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Test-Pass {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
    $script:PASSED++
}

function Test-Fail {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
    $script:FAILED++
}

function Test-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor Gray
}

# ================================================================
#  TEST 1: Files & Directories
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "quick") {
    Test-Header "TEST 1: Structure des fichiers"
    
    @{
        "$EMS_ROOT\.env" = "Frontend .env"
        "$EMS_ROOT\backend\.env" = "Backend .env"
        "$EMS_ROOT\docker-compose.yml" = "Docker Compose config"
        "$EMS_ROOT\manage-ems.ps1" = "Management script"
        "$EMS_ROOT\backup-db-auto.ps1" = "Backup script"
    }.GetEnumerator() | ForEach-Object {
        if (Test-Path $_.Key) {\n            Test-Pass $_.Value
        } else {
            Test-Fail $_.Value
        }
    }
}

# ================================================================
#  TEST 2: Docker & Services Status
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "quick") {
    Test-Header "TEST 2: Services Docker"
    
    Set-Location $EMS_ROOT
    
    # Check Docker running
    $dockerInfo = docker info 2>&1
    if ($dockerInfo -match "Server Version") {
        Test-Pass "Docker Desktop en cours d'exécution"
    } else {
        Test-Fail "Docker Desktop NOT running"
    }
    
    # Check containers
    $ps = docker compose ps 2>&1
    $containers = @("backend", "frontend", "db")
    
    $containers | ForEach-Object {
        if ($ps -match $_) {
            if ($ps -match "$_.*Up") {
                Test-Pass "Container $_  is UP"
            } else {
                Test-Fail "Container $_ not running"
            }
        }
    }
}

# ================================================================
#  TEST 3: Backend API Health
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "backend") {
    Test-Header "TEST 3: Backend FastAPI Health"
    
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 3 -ErrorAction Stop
        Test-Pass "Backend /health endpoint reachable"
        
        if ($health.status -eq "ok") {
            Test-Pass "Backend status: OK"
        }
        
        if ($health.service) {
            Test-Info "Backend service: $($health.service)"
        }
        
        if ($health.version) {
            Test-Info "EMS version: $($health.version)"
        }
        
    } catch {
        Test-Fail "Backend /health not responding: $_"
    }
}

# ================================================================
#  TEST 4: Frontend Vite Server
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "backend") {
    Test-Header "TEST 4: Frontend Vite Server"
    
    try {
        $fe = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 3 -ErrorAction Stop
        if ($fe.StatusCode -eq 200) {
            Test-Pass "Frontend server responding (HTTP 200)"
        }
    } catch {
        Test-Fail "Frontend not responding: $_"
    }
}

# ================================================================
#  TEST 5: Database Connection
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "database") {
    Test-Header "TEST 5: MySQL Database"
    
    try {
        Set-Location $EMS_ROOT
        $dbTest = docker compose exec -T db mysql -u extranet -pextranet -e "SELECT 1" 2>&1
        
        if ($dbTest -match "1") {
            Test-Pass "MySQL database connection successful"
        } else {
            Test-Fail "MySQL query failed"
        }
        
        # Check tables exist
        $tables = docker compose exec -T db mysql -u extranet -pextranet -e "USE EMS_DB; SHOW TABLES;" 2>&1 | Measure-Object -Line
        if ($tables.Lines -gt 2) {
            Test-Pass "Database schema initialized ($($tables.Lines) tables)"
        } else {
            Test-Fail "Database schema may not be initialized"
        }
        
    } catch {
        Test-Fail "Database connection error: $_"
    }
}

# ================================================================
#  TEST 6: Environment Files
# ================================================================
if ($TestType -eq "all") {
    Test-Header "TEST 6: Configuration .env Files"
    
    # Frontend .env
    $feEnv = Get-Content "$EMS_ROOT\frontend\.env" -ErrorAction SilentlyContinue
    if ($feEnv -match "VITE_API_URL") {
        Test-Pass "Frontend .env contains VITE_API_URL"
    } else {
        Test-Fail "Frontend .env missing VITE_API_URL"
    }
    
    # Backend .env
    $beEnv = Get-Content "$EMS_ROOT\backend\.env" -ErrorAction SilentlyContinue
    @{
        "DATABASE_URL" = "Database connection string"
        "SECRET_KEY" = "JWT secret key"
        "ACCESS_TOKEN_EXPIRE_MINUTES" = "Token expiration"
    }.GetEnumerator() | ForEach-Object {
        if ($beEnv -match $_.Key) {
            Test-Pass "Backend .env contains $($_.Key)"
        } else {
            Test-Fail "Backend .env missing $($_.Key)"
        }
    }
}

# ================================================================
#  TEST 7: Windows Services
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "services") {
    Test-Header "TEST 7: Windows Services Configuration"
    
    # Check backup task
    $backupTask = schtasks /query /tn "\EMS\EMS-Daily-Backup" /v 2>&1
    if ($backupTask -match "Enabled" -or $backupTask -match "Ready") {
        Test-Pass "Backup task EMS-Daily-Backup scheduled"
    } else {
        Test-Fail "Backup task not found or not enabled"
    }
    
    # Check auto-start registry
    $autoStart = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "EMS-AutoStart" -ErrorAction SilentlyContinue
    if ($autoStart -ne $null) {
        Test-Pass "Auto-start registered in RunOnce"
    } else {
        Test-Fail "Auto-start not found in registry"
    }
    
    # Check backup directory
    if (Test-Path "C:\EMS\backups") {
        $backups = Get-ChildItem "C:\EMS\backups" -Filter "*.sql" -ErrorAction SilentlyContinue
        if ($backups) {
            Test-Info "$($backups.Count) backup files found"
            Test-Pass "Backup directory exists and contains backups"
        } else {
            Test-Info "No backups yet (first backup at midnight)"
        }
    }
}

# ================================================================
#  TEST 8: GitHub Actions Runner
# ================================================================
if ($TestType -eq "all" -or $TestType -eq "services") {
    Test-Header "TEST 8: GitHub Actions Self-Hosted Runner"
    
    $runnerDir = "C:\actions-runner"
    if (Test-Path $runnerDir) {
        Test-Pass "GitHub Actions runner directory found"
        
        $diagDir = "$runnerDir\_diag"
        if (Test-Path $diagDir) {
            $logs = @(Get-ChildItem $diagDir -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
            if ($logs) {
                Test-Info "Latest runner log: $($logs[0].Name)"
            }
        }
    } else {
        Test-Fail "GitHub Actions runner not installed"
    }
}

# ================================================================
#  SUMMARY
# ================================================================
Write-Host ""
Test-Header "RÉSUMÉ DES TESTS"

$Total = $PASSED + $FAILED
$PercentPass = [math]::Round(($PASSED / $Total) * 100, 1)

Write-Host "  Réussis   : $PASSED ✅"
Write-Host "  Échoués   : $FAILED ❌"
Write-Host "  Total     : $Total"
Write-Host "  Score     : $PercentPass%"
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "🎉 TOUS LES TESTS RÉUSSIS ! L'installation est valide." -ForegroundColor Green
} elseif ($FAILED -le 3) {
    Write-Host "⚠️  Quelques tests ont échoué. Vérifiez les erreurs ci-dessus." -ForegroundColor Yellow
} else {
    Write-Host "❌ Plusieurs problèmes détectés. Installation incomplete ?" -ForegroundColor Red
}

Write-Host ""
exit (If ($FAILED -gt 0) { 1 } else { 0 })
