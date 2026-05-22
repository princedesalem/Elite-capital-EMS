# EMS Elite Capital - Script d'installation des outils (doit tourner en ADMIN)
$LogFile = "C:\EMS\deploy\install_log.txt"
function Log($msg) { $ts = Get-Date -Format "HH:mm:ss"; "$ts $msg" | Tee-Object -Append -FilePath $LogFile }

Log "=== DEBUT INSTALLATION EMS TOOLS ==="

# 1. Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Log "Installation Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Log "Chocolatey installe OK"
} else {
    Log "Chocolatey deja present"
}

# 2. MySQL 8
if (-not (Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue)) {
    Log "Installation MySQL 8..."
    choco install mysql -y --version=8.0.42 2>&1 | Out-File -Append $LogFile
    Log "MySQL installe"
} else {
    Log "MySQL deja present"
}

# 3. NSSM
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Log "Installation NSSM..."
    choco install nssm -y 2>&1 | Out-File -Append $LogFile
    Log "NSSM installe"
} else {
    Log "NSSM deja present"
}

# 4. Nginx
if (-not (Test-Path "C:\nginx\nginx.exe")) {
    Log "Installation Nginx..."
    choco install nginx -y 2>&1 | Out-File -Append $LogFile
    Log "Nginx installe"
} else {
    Log "Nginx deja present"
}

# Rafraichir PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifications finales
Log "--- Verifications ---"
Log "MySQL service: $((Get-Service -Name 'MySQL*' -ErrorAction SilentlyContinue | Select-Object -First 1).Status)"
Log "NSSM: $(Get-Command nssm -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)"
Log "Nginx: $(if(Test-Path 'C:\nginx\nginx.exe'){'OK'}else{'NON TROUVE'})"
Log "=== INSTALLATION TERMINEE ==="
"DONE" | Add-Content $LogFile
