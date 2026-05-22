# Script d'initialisation MySQL + installation service (doit tourner en ADMIN)
$LogFile = "C:\EMS\deploy\mysql_init_log.txt"
function Log($msg) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $msg" | Tee-Object -Append -FilePath $LogFile }

Log "=== INIT MYSQL ==="

# Ajouter MySQL au PATH système
$machinePath = [System.Environment]::GetEnvironmentVariable("Path","Machine")
if ($machinePath -notmatch "C:\\mysql\\bin") {
    [System.Environment]::SetEnvironmentVariable("Path", $machinePath + ";C:\mysql\bin", "Machine")
    Log "MySQL ajouté au PATH système"
}
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")

# Initialiser la base de données (sans mot de passe root = --initialize-insecure)
if ((Get-ChildItem "C:\mysql\data" -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
    Log "Initialisation MySQL (création des tables système)..."
    $proc = Start-Process -FilePath "C:\mysql\bin\mysqld.exe" `
        -ArgumentList "--initialize-insecure", "--user=root", "--basedir=C:\mysql", "--datadir=C:\mysql\data", "--console" `
        -Wait -PassThru -NoNewWindow -RedirectStandardError "C:\mysql\logs\init.log"
    Log "Init terminée (exit: $($proc.ExitCode))"
    Get-Content "C:\mysql\logs\init.log" -ErrorAction SilentlyContinue | Select-Object -Last 5 | ForEach-Object { Log $_ }
} else {
    Log "Data dir non vide - init ignorée"
}

# Supprimer l'ancien service si existant
$existing = Get-Service -Name "MySQL8" -ErrorAction SilentlyContinue
if ($existing) {
    Log "Suppression ancien service MySQL8..."
    Stop-Service "MySQL8" -Force -ErrorAction SilentlyContinue
    & "C:\mysql\bin\mysqld.exe" --remove MySQL8 2>&1 | Out-File -Append $LogFile
}

# Installer comme service Windows
Log "Installation service MySQL8..."
& "C:\mysql\bin\mysqld.exe" --install MySQL8 --defaults-file="C:\mysql\my.ini" 2>&1 | Out-File -Append $LogFile

# Démarrer le service
Log "Démarrage du service MySQL8..."
Start-Service "MySQL8" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
$svc = Get-Service -Name "MySQL8" -ErrorAction SilentlyContinue
Log "Statut MySQL8: $($svc.Status)"

Log "=== FIN INIT MYSQL ==="
"DONE" | Add-Content $LogFile
