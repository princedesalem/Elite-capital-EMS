# Installation du backend EMS comme service Windows via NSSM (doit tourner en ADMIN)
$LogFile = "C:\EMS\deploy\nssm_setup_log.txt"
function Log($msg) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $msg" | Tee-Object -Append -FilePath $LogFile }

$ServiceName = "EMS-Backend"
$Python      = "C:\EMS\backend\venv\Scripts\python.exe"
$UvicornArgs = "-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"
$WorkDir     = "C:\EMS\backend"
$Nssm        = "C:\tools\nssm.exe"

Log "=== INSTALLATION SERVICE EMS-Backend ==="

# Supprimer l'ancien service si existant
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Log "Arrêt et suppression de l'ancien service..."
    Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
    & $Nssm remove $ServiceName confirm
}

# Installer le service
Log "Installation via NSSM..."
& $Nssm install $ServiceName $Python $UvicornArgs
& $Nssm set $ServiceName AppDirectory $WorkDir
& $Nssm set $ServiceName DisplayName "EMS Elite Capital - Backend API"
& $Nssm set $ServiceName Description "FastAPI backend pour EMS Elite Capital - port 8000"
& $Nssm set $ServiceName Start SERVICE_AUTO_START

# Logs du service
New-Item -ItemType Directory -Force "C:\EMS\logs" | Out-Null
& $Nssm set $ServiceName AppStdout "C:\EMS\logs\backend_stdout.log"
& $Nssm set $ServiceName AppStderr "C:\EMS\logs\backend_stderr.log"
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateBytes 10485760  # 10 MB

# Variables d'environnement pour le service
& $Nssm set $ServiceName AppEnvironmentExtra "PYTHONPATH=C:\EMS\backend"

# Dépendance sur MySQL
& $Nssm set $ServiceName DependOnService MySQL8

# Démarrer le service
Log "Démarrage du service EMS-Backend..."
Start-Sleep -Seconds 2
Start-Service $ServiceName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 8

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
Log "Statut EMS-Backend: $($svc.Status)"

Log "=== FIN INSTALLATION SERVICE ==="
"DONE" | Add-Content $LogFile
