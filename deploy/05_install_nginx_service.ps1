# Installation Nginx comme service Windows (doit tourner en ADMIN)
$LogFile = "C:\EMS\deploy\nginx_setup_log.txt"
function Log($msg) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $msg" | Tee-Object -Append -FilePath $LogFile }

$Nssm    = "C:\tools\nssm.exe"
$Nginx   = "C:\nginx\nginx.exe"

Log "=== INSTALLATION SERVICE NGINX ==="

# Tester la configuration Nginx
Log "Test configuration Nginx..."
$test = & $Nginx -t -p "C:\nginx" 2>&1
Log "Test: $test"

# Supprimer l'ancien service nginx si existant
$svcNames = @("nginx", "EMS-Nginx")
foreach ($sn in $svcNames) {
    $existing = Get-Service -Name $sn -ErrorAction SilentlyContinue
    if ($existing) {
        Log "Suppression ancien service $sn..."
        Stop-Service $sn -Force -ErrorAction SilentlyContinue
        & $Nssm remove $sn confirm 2>&1 | Out-Null
    }
}

# Installer Nginx comme service
Log "Installation service EMS-Nginx..."
& $Nssm install EMS-Nginx $Nginx "-p C:\nginx"
& $Nssm set EMS-Nginx AppDirectory "C:\nginx"
& $Nssm set EMS-Nginx DisplayName "EMS Elite Capital - Nginx (port 80)"
& $Nssm set EMS-Nginx Description "Nginx reverse proxy pour EMS Elite Capital"
& $Nssm set EMS-Nginx Start SERVICE_AUTO_START
& $Nssm set EMS-Nginx AppStdout "C:\EMS\logs\nginx_stdout.log"
& $Nssm set EMS-Nginx AppStderr "C:\EMS\logs\nginx_stderr.log"
& $Nssm set EMS-Nginx DependOnService EMS-Backend

# Règles de firewall
Log "Ouverture des ports firewall..."
netsh advfirewall firewall delete rule name="EMS HTTP 80" 2>&1 | Out-Null
netsh advfirewall firewall delete rule name="EMS Backend 8000" 2>&1 | Out-Null
netsh advfirewall firewall add rule name="EMS HTTP 80"      dir=in action=allow protocol=TCP localport=80   profile=any
netsh advfirewall firewall add rule name="EMS Backend 8000" dir=in action=allow protocol=TCP localport=8000 profile=any

Log "Ports 80 et 8000 ouverts"

# Démarrer Nginx
Log "Démarrage du service EMS-Nginx..."
Start-Service EMS-Nginx -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
$svc = Get-Service -Name "EMS-Nginx" -ErrorAction SilentlyContinue
Log "Statut EMS-Nginx: $($svc.Status)"

Log "=== FIN INSTALLATION NGINX ==="
"DONE" | Add-Content $LogFile
