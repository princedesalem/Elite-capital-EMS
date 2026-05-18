# EMS Server Management - Démarrage/Arrêt/Status
# Usage: .\manage-ems.ps1 [start|stop|status|logs|restart]

param(
    [Parameter(Position = 0)]
    [string]$Action = "status"
)

$EMS_ROOT = "C:\EMS\extranet"

function Start-EMS {
    Write-Host "Demarrage de l'application EMS..." -ForegroundColor Yellow
    Set-Location $EMS_ROOT
    docker compose up -d
    Start-Sleep -Seconds 5
    Write-Host "Application demarree. Acces: http://localhost:5173" -ForegroundColor Green
}

function Stop-EMS {
    Write-Host "Arrêt de l'application EMS..." -ForegroundColor Yellow
    Set-Location $EMS_ROOT
    docker compose down
    Write-Host "Application arretee." -ForegroundColor Green
}

function Get-EMSStatus {
    Set-Location $EMS_ROOT
    $status = docker compose ps 2>&1 | Out-String
    Write-Host $status
}

function Get-EMSLogs {
    Set-Location $EMS_ROOT
    Write-Host "Logs en temps reel (Ctrl+C pour quitter)..." -ForegroundColor Cyan
    docker compose logs -f
}

function Restart-EMS {
    Write-Host "Redemarrage de l'application EMS..." -ForegroundColor Yellow
    Set-Location $EMS_ROOT
    docker compose restart
    Write-Host "Application redemarree." -ForegroundColor Green
}

switch ($Action.ToLower()) {
    "start"   { Start-EMS   }
    "stop"    { Stop-EMS    }
    "status"  { Get-EMSStatus }
    "logs"    { Get-EMSLogs }
    "restart" { Restart-EMS }
    default   {
        Write-Host "Usage: .\manage-ems.ps1 [start|stop|status|logs|restart]" -ForegroundColor Yellow
        Get-EMSStatus
    }
}
