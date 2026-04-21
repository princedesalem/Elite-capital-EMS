# health-check.ps1 — Verifie que les services du site extranet tournent
# Compatible PowerShell 5.1+

$FRONTEND = if ($env:FRONTEND_URL) { $env:FRONTEND_URL } else { "http://localhost:5173" }
$BACKEND  = if ($env:BACKEND_URL)  { $env:BACKEND_URL  } else { "http://localhost:8000" }
$passed = 0
$failed = 0

Write-Host ""
Write-Host "Health checks — site running" -ForegroundColor Cyan
Write-Host "  Frontend : $FRONTEND"
Write-Host "  Backend  : $BACKEND"
Write-Host ""

# --- Check 1: Frontend HTTP 200 ---
Write-Host -NoNewline "  Frontend repond HTTP 200 ... "
try {
    $r = Invoke-WebRequest -Uri $FRONTEND -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    if ($r.StatusCode -eq 200) {
        Write-Host "PASS" -ForegroundColor Green; $passed++
    } else {
        Write-Host "FAIL — HTTP $($r.StatusCode)" -ForegroundColor Red; $failed++
    }
} catch {
    Write-Host "FAIL — $($_.Exception.Message)" -ForegroundColor Red; $failed++
}

# --- Check 2: Frontend retourne du HTML ---
Write-Host -NoNewline "  Frontend retourne du HTML ... "
try {
    $r = Invoke-WebRequest -Uri $FRONTEND -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    if ($r.Content -match "<") {
        Write-Host "PASS" -ForegroundColor Green; $passed++
    } else {
        Write-Host "FAIL — pas de HTML dans la reponse" -ForegroundColor Red; $failed++
    }
} catch {
    Write-Host "FAIL — $($_.Exception.Message)" -ForegroundColor Red; $failed++
}

# --- Check 3: Backend GET / ---
Write-Host -NoNewline "  Backend GET / -> 'Backend running' ... "
try {
    $r = Invoke-WebRequest -Uri "$BACKEND/" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    $json = $r.Content | ConvertFrom-Json
    if ($r.StatusCode -eq 200 -and $json.message -eq "Backend running") {
        Write-Host "PASS" -ForegroundColor Green; $passed++
    } else {
        Write-Host "FAIL — HTTP $($r.StatusCode) message='$($json.message)'" -ForegroundColor Red; $failed++
    }
} catch {
    Write-Host "FAIL — $($_.Exception.Message)" -ForegroundColor Red; $failed++
}

# --- Check 4: Backend GET /health ---
Write-Host -NoNewline "  Backend GET /health -> status ok ... "
try {
    $r = Invoke-WebRequest -Uri "$BACKEND/health" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    $json = $r.Content | ConvertFrom-Json
    if ($r.StatusCode -eq 200 -and $json.status -eq "ok") {
        Write-Host "PASS" -ForegroundColor Green; $passed++
    } else {
        Write-Host "FAIL — HTTP $($r.StatusCode) status='$($json.status)'" -ForegroundColor Red; $failed++
    }
} catch {
    Write-Host "FAIL — $($_.Exception.Message)" -ForegroundColor Red; $failed++
}

# --- Check 5: Backend POST /auth/login ---
Write-Host -NoNewline "  Backend POST /auth/login accessible (200/401/422) ... "
$loginCode = 0
try {
    $headers = @{ "Content-Type" = "application/json" }
    $r = Invoke-WebRequest -Uri "$BACKEND/auth/login" -Method POST -Body "{}" `
         -Headers $headers -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
    $loginCode = $r.StatusCode
} catch [System.Net.WebException] {
    if ($_.Exception.Response) { $loginCode = [int]$_.Exception.Response.StatusCode }
} catch {
    $loginCode = 0
}
if ($loginCode -in @(200, 401, 422)) {
    Write-Host "PASS" -ForegroundColor Green; $passed++
} else {
    Write-Host "FAIL — HTTP $loginCode inattendu" -ForegroundColor Red; $failed++
}

# --- Resume ---
$total = $passed + $failed
Write-Host ""
if ($failed -eq 0) {
    Write-Host "$passed/$total checks PASSES — site operationnel !" -ForegroundColor Green
} else {
    Write-Host "$passed/$total checks passes, $failed echec(s)" -ForegroundColor Yellow
    exit 1
}
