# Sécuriser MySQL et créer la base EMS (doit tourner en ADMIN)
$LogFile = "C:\EMS\deploy\mysql_setup_log.txt"
function Log($msg) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $msg" | Tee-Object -Append -FilePath $LogFile }

# Lire les credentials
$creds = Get-Content "C:\EMS\deploy\creds.tmp.txt" | ForEach-Object {
    $k,$v = $_ -split "=",2; @{$k=$v}
} | ForEach-Object { $_ }
$rootPwd = ($creds | Where-Object { $_.ContainsKey("MYSQL_ROOT_PWD") })["MYSQL_ROOT_PWD"]
$emsPwd  = ($creds | Where-Object { $_.ContainsKey("MYSQL_EMS_PWD") })["MYSQL_EMS_PWD"]

$env:Path += ";C:\mysql\bin"

Log "=== SETUP MYSQL ==="
Log "Attente que MySQL soit prêt..."
Start-Sleep -Seconds 3

# SQL: sécuriser root, créer DB et user EMS
$sql = @"
-- Changer le mot de passe root
ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPwd';

-- Créer la base de données EMS
CREATE DATABASE IF NOT EXISTS ems_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Créer l'utilisateur EMS dédié
DROP USER IF EXISTS 'ems_user'@'localhost';
CREATE USER 'ems_user'@'localhost' IDENTIFIED BY '$emsPwd';

-- Donner les droits sur la base EMS uniquement
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES ON ems_prod.* TO 'ems_user'@'localhost';

FLUSH PRIVILEGES;
"@

$sql | Set-Content "C:\EMS\deploy\setup.sql"

Log "Exécution du script SQL..."
$result = & "C:\mysql\bin\mysql.exe" -u root --connect-expired-password -e $sql 2>&1
Log "Résultat: $result"

# Tester la connexion ems_user
$test = & "C:\mysql\bin\mysql.exe" -u ems_user -p"$emsPwd" -e "SHOW DATABASES;" 2>&1
Log "Test connexion ems_user: $test"

Log "=== SETUP TERMINÉ ==="
"DONE" | Add-Content $LogFile
