Set-Location 'c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet'
$running = docker compose ps --services --filter status=running 2>$null
if ($running -notmatch "frontend") {
    Write-Host "Demarrage..." -ForegroundColor Yellow
    docker compose up -d db backend frontend
    for ($i=0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 3
        try { $r=Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -EA Stop; if ($r.StatusCode -eq 200){break} } catch {}
    }
}
Start-Process "http://localhost:5173"
