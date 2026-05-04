# ============================================================
#  install-ems-server.ps1
#  Installation automatique du serveur EMS — Elite Capital Group
#  Exécuter en tant qu'Administrateur
# ============================================================
#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off

# ── Chemins ──────────────────────────────────────────────────
$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$EMS_ROOT    = "C:\EMS\extranet"
$RUNNER_DIR  = "C:\actions-runner"
$STATE_FILE  = "C:\ems-install-state.txt"
$LOG_FILE    = "C:\ems-install-log.txt"
$ICON_PATH   = Join-Path $SCRIPT_DIR "ems-icon.ico"
$SHORTCUT    = [System.IO.Path]::Combine(
                   [Environment]::GetFolderPath('Desktop'),
                   "Installer EMS Server.lnk")

$GITHUB_REPO = "https://github.com/princedesalem/Elite-capital-EMS"

# ─────────────────────────────────────────────────────────────
# FONCTIONS UTILITAIRES
# ─────────────────────────────────────────────────────────────
function Write-Log($msg, $color = "Cyan") {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] $msg" -ForegroundColor $color
    Add-Content $LOG_FILE "[$ts] $msg" -ErrorAction SilentlyContinue
}
function Write-OK($msg)   { Write-Log "[OK] $msg" "Green" }
function Write-Err($msg)  { Write-Log "[ERREUR] $msg" "Red"; Read-Host "Entree pour quitter"; exit 1 }
function Write-Step($msg) { Write-Host ""; Write-Host "  >>> $msg" -ForegroundColor Yellow; Write-Log $msg }

function Get-State {
    if (Test-Path $STATE_FILE) { return (Get-Content $STATE_FILE -Raw).Trim() }
    return "START"
}
function Set-State($s) { Set-Content $STATE_FILE $s -Force }

function Reboot-Continue($next, $why) {
    Set-State $next
    $self = $MyInvocation.ScriptName
    if (-not $self) { $self = $PSCommandPath }
    if (-not $self) { $self = Join-Path $SCRIPT_DIR "install-ems-server.ps1" }
    Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce" `
        "EMS-AutoInstall" `
        "powershell.exe -ExecutionPolicy Bypass -WindowStyle Normal -File `"$self`""
    Write-Log "Redemarrage necessaire : $why"
    Write-Host ""
    Write-Host "  Le script reprendra automatiquement apres le redemarrage." -ForegroundColor Yellow
    Read-Host "  Appuyez sur Entree pour redemarrer"
    Restart-Computer -Force
}

# ─────────────────────────────────────────────────────────────
# ICONE EMS EMBARQUEE (Base64 → ems-icon.ico)
# ─────────────────────────────────────────────────────────────
$EMS_ICON_B64 = @'
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
'@

function New-EmsIcon {
    if (Test-Path $ICON_PATH) { return }
    Write-Log "Extraction de l icone EMS embarquee..."
    try {
        $bytes = [Convert]::FromBase64String($EMS_ICON_B64.Trim())
        [System.IO.File]::WriteAllBytes($ICON_PATH, $bytes)
        Write-OK "Icone EMS extraite : $ICON_PATH"
    }
    catch {
        Write-Log "Icone non extraite (non bloquant) : $_" "Gray"
    }
}

# ─────────────────────────────────────────────────────────────
# CREATION DU RACCOURCI SUR LE BUREAU
# ─────────────────────────────────────────────────────────────
function New-DesktopShortcut {
    if (Test-Path $SHORTCUT) { return }
    try {
        $self = $MyInvocation.ScriptName
        if (-not $self) { $self = $PSCommandPath }
        if (-not $self) { $self = Join-Path $SCRIPT_DIR "install-ems-server.ps1" }

        $wsh  = New-Object -ComObject WScript.Shell
        $lnk  = $wsh.CreateShortcut($SHORTCUT)
        $lnk.TargetPath       = "powershell.exe"
        $lnk.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Normal -File `"$self`""
        $lnk.WorkingDirectory = $SCRIPT_DIR
        $lnk.Description      = "Installation automatique du serveur EMS"
        if (Test-Path $ICON_PATH) { $lnk.IconLocation = $ICON_PATH }
        $lnk.Save()
        Write-OK "Raccourci cree sur le bureau."
    }
    catch {
        Write-Log "Raccourci non cree (non bloquant) : $_" "Gray"
    }
}

# ─────────────────────────────────────────────────────────────
# DETECTION IP DU SERVEUR
# ─────────────────────────────────────────────────────────────
function Get-ServerIP {
    $ips = Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object {
               $_.InterfaceAlias -notmatch "Loopback|vEthernet|Bluetooth" -and
               $_.IPAddress -notmatch "^127\." -and
               $_.IPAddress -notmatch "^169\.254\."
           } | Sort-Object PrefixLength -Descending |
           Select-Object -ExpandProperty IPAddress
    if ($ips) { return $ips | Select-Object -First 1 }
    return "127.0.0.1"
}

# ─────────────────────────────────────────────────────────────
# CREATION DU FICHIER .env FRONTEND
# ─────────────────────────────────────────────────────────────
function New-FrontendEnv($serverIP) {
    $envPath = Join-Path $EMS_ROOT "frontend\.env"
    # VITE_API_URL pointe vers localhost:8000 car Vite proxy
    # tourne sur le serveur — les clients LAN passent par le proxy Vite
    $content = @"
# Configuration generee automatiquement par install-ems-server.ps1
# Date : $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Serveur IP : $serverIP

# URL du backend (proxy Vite — ne pas changer)
VITE_API_URL=http://localhost:8000
"@
    Set-Content -Path $envPath -Value $content -Encoding UTF8 -Force
    Write-OK "frontend/.env configure (VITE_API_URL=http://localhost:8000)"
    Write-Log "  -> Acces LAN via http://${serverIP}:5173  (proxy Vite gere les appels API)" "Gray"
}

# ─────────────────────────────────────────────────────────────
# ATTENDRE QUE DOCKER SOIT PRET
# ─────────────────────────────────────────────────────────────
function Wait-Docker {
    $timeout = 180; $elapsed = 0
    Write-Log "Attente que Docker soit pret (max 3 min)..."
    do {
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) { Write-OK "Docker est pret."; return }
        Start-Sleep -Seconds 5; $elapsed += 5
    } while ($elapsed -lt $timeout)
    Write-Err "Docker ne repond pas apres 3 minutes. Ouvrez Docker Desktop et relancez."
}

# ─────────────────────────────────────────────────────────────
# BANNIERE
# ─────────────────────────────────────────────────────────────
function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ████████╗███╗   ███╗███████╗" -ForegroundColor Blue
    Write-Host "  ██╔════╝████╗ ████║██╔════╝" -ForegroundColor Blue
    Write-Host "  █████╗  ██╔████╔██║███████╗" -ForegroundColor Blue
    Write-Host "  ██╔══╝  ██║╚██╔╝██║╚════██║" -ForegroundColor Blue
    Write-Host "  ███████╗██║ ╚═╝ ██║███████║" -ForegroundColor Blue
    Write-Host "  ╚══════╝╚═╝     ╚═╝╚══════╝" -ForegroundColor Blue
    Write-Host ""
    Write-Host "  INSTALLATION SERVEUR — Elite Capital Group" -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
}

# ═════════════════════════════════════════════════════════════
# POINT D'ENTREE
# ═════════════════════════════════════════════════════════════

# Vérifier droits administrateur
if (-not ([Security.Principal.WindowsPrincipal]
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERREUR : Relancez ce script en tant qu Administrateur." -ForegroundColor Red
    Write-Host "(Clic droit sur le script → Executer en tant qu administrateur)" -ForegroundColor Gray
    Read-Host "Entree pour quitter"
    exit 1
}

Show-Banner

# Générer l'icône et le raccourci bureau
New-EmsIcon
New-DesktopShortcut

$state = Get-State
Write-Log "Phase courante : $state"

# ─────────────────────────────────────────────────────────────
# PHASE 1 — WSL 2
# ─────────────────────────────────────────────────────────────
if ($state -eq "START") {
    Write-Step "PHASE 1/7 — Activation de WSL 2"

    $wslOut = & wsl --status 2>&1 | Out-String
    if ($wslOut -match "WSL 2" -or ($LASTEXITCODE -eq 0 -and $wslOut -match "2")) {
        Write-OK "WSL 2 deja active."
        Set-State "DOCKER"
    } else {
        Write-Log "Installation de WSL 2..."
        & wsl --install --no-distribution 2>&1 | Tee-Object -Append -FilePath $LOG_FILE
        Reboot-Continue "DOCKER" "WSL 2 vient d etre installe"
    }
    $state = Get-State
}

# ─────────────────────────────────────────────────────────────
# PHASE 2 — Docker Desktop
# ─────────────────────────────────────────────────────────────
if ($state -eq "DOCKER") {
    Write-Step "PHASE 2/7 — Installation de Docker Desktop"

    $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerExe) {
        Write-OK "Docker Desktop deja installe."
    } else {
        Write-Log "Telechargement de Docker Desktop (~500 Mo) — patience..."
        $installer = "$env:TEMP\DockerDesktopInstaller.exe"
        Invoke-WebRequest `
            -Uri "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" `
            -OutFile $installer -UseBasicParsing
        Write-Log "Installation silencieuse de Docker Desktop..."
        Start-Process -FilePath $installer `
            -ArgumentList "install --quiet --accept-license" -Wait
        Write-OK "Docker Desktop installe."
        Reboot-Continue "GIT" "Docker Desktop installe"
    }
    Set-State "GIT"; $state = "GIT"
}

# ─────────────────────────────────────────────────────────────
# PHASE 3 — Git
# ─────────────────────────────────────────────────────────────
if ($state -eq "GIT") {
    Write-Step "PHASE 3/7 — Installation de Git"

    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        Write-OK "Git deja installe : $(git --version)"
    } else {
        $gitVer = "2.44.0"
        $gitInst = "$env:TEMP\Git-Setup.exe"
        Write-Log "Telechargement de Git..."
        Invoke-WebRequest `
            -Uri "https://github.com/git-for-windows/git/releases/download/v${gitVer}.windows.1/Git-${gitVer}-64-bit.exe" `
            -OutFile $gitInst -UseBasicParsing
        Write-Log "Installation de Git..."
        Start-Process -FilePath $gitInst `
            -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /COMPONENTS=`"icons,ext\reg\shellhere,assoc,assoc_sh`"" `
            -Wait
        # Recharger PATH
        $env:PATH = [Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                    [Environment]::GetEnvironmentVariable("PATH","User")
        Write-OK "Git installe."
    }
    Set-State "CLONE"; $state = "CLONE"
}

# ─────────────────────────────────────────────────────────────
# PHASE 4 — Cloner le repository
# ─────────────────────────────────────────────────────────────
if ($state -eq "CLONE") {
    Write-Step "PHASE 4/7 — Telechargement du code depuis GitHub"

    New-Item -ItemType Directory -Path "C:\EMS" -Force | Out-Null

    if (Test-Path (Join-Path $EMS_ROOT ".git")) {
        Write-OK "Repository deja present. Mise a jour (git pull)..."
        Set-Location $EMS_ROOT
        git pull origin main 2>&1 | Tee-Object -Append -FilePath $LOG_FILE
    } else {
        Write-Log "Clonage depuis $GITHUB_REPO..."
        git clone $GITHUB_REPO $EMS_ROOT 2>&1 | Tee-Object -Append -FilePath $LOG_FILE
        if (-not (Test-Path (Join-Path $EMS_ROOT ".git"))) {
            Write-Err "Le clonage a echoue. Verifiez votre connexion internet et vos acces GitHub."
        }
        Write-OK "Code telecharge dans $EMS_ROOT"
    }
    Set-State "ENV"; $state = "ENV"
}

# ─────────────────────────────────────────────────────────────
# PHASE 5 — Configuration IP et fichier .env
# ─────────────────────────────────────────────────────────────
if ($state -eq "ENV") {
    Write-Step "PHASE 5/7 — Configuration reseau et fichier .env"

    $serverIP = Get-ServerIP
    Write-Log "IP detectee du serveur : $serverIP"
    New-FrontendEnv $serverIP

    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor DarkCyan
    Write-Host "  │  Acces a l application apres installation    │" -ForegroundColor DarkCyan
    Write-Host "  │                                              │" -ForegroundColor DarkCyan
    Write-Host "  │  Sur ce serveur :  http://localhost:5173     │" -ForegroundColor Cyan
    Write-Host "  │  Reseau local   :  http://${serverIP}:5173" -ForegroundColor Cyan
    Write-Host "  │                                              │" -ForegroundColor DarkCyan
    Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor DarkCyan
    Write-Host ""

    Set-State "COMPOSE"; $state = "COMPOSE"
}

# ─────────────────────────────────────────────────────────────
# PHASE 6 — Docker Compose (build + démarrage)
# ─────────────────────────────────────────────────────────────
if ($state -eq "COMPOSE") {
    Write-Step "PHASE 6/7 — Demarrage de l application"
    Write-Host "  (Premier build : 10-20 minutes — telechargement Python, Node, MySQL)" -ForegroundColor Gray
    Write-Host ""

    # Démarrer Docker Desktop si pas lancé
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Lancement de Docker Desktop..."
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        Start-Sleep -Seconds 10
        Wait-Docker
    }

    Set-Location $EMS_ROOT
    Write-Log "docker compose up --build -d ..."
    docker compose up --build -d 2>&1 | Tee-Object -Append -FilePath $LOG_FILE

    Write-Log "Attente que les services demarrent (30s)..."
    Start-Sleep -Seconds 30

    $ps = docker compose ps 2>&1 | Out-String
    Write-Host $ps

    if ($ps -match "Up") {
        Write-OK "Application demarree avec succes !"
    } else {
        Write-Log "ATTENTION : Certains containers ne semblent pas Up. Verifiez avec : docker compose ps" "Yellow"
        Write-Log "Continuer quand meme..." "Yellow"
    }

    Set-State "FIREWALL"; $state = "FIREWALL"
}

# ─────────────────────────────────────────────────────────────
# PHASE 6.5 — Pare-feu
# ─────────────────────────────────────────────────────────────
if ($state -eq "FIREWALL") {
    Write-Step "Ouverture des ports dans le Pare-feu Windows"

    foreach ($port in @(8000, 5173)) {
        $name = if ($port -eq 8000) { "EMS Backend" } else { "EMS Frontend" }
        $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName $name -Direction Inbound `
                -Protocol TCP -LocalPort $port -Action Allow | Out-Null
            Write-OK "Port $port ouvert."
        } else {
            Write-OK "Port $port deja ouvert."
        }
    }

    Set-State "RUNNER"; $state = "RUNNER"
}

# ─────────────────────────────────────────────────────────────
# PHASE 7 — GitHub Actions Runner (CI/CD)
# ─────────────────────────────────────────────────────────────
if ($state -eq "RUNNER") {
    Write-Step "PHASE 7/7 — Installation du GitHub Actions Runner (CI/CD automatique)"

    # Vérifier si le runner tourne déjà
    $svc = Get-Service -Name "actions.runner.*" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-OK "GitHub Actions Runner deja installe et en cours d execution."
        Set-State "DONE"; $state = "DONE"
    } else {
        Write-Host ""
        Write-Host "  ┌──────────────────────────────────────────────────────┐" -ForegroundColor Yellow
        Write-Host "  │  ACTION REQUISE : recuperer le token GitHub           │" -ForegroundColor Yellow
        Write-Host "  │                                                        │" -ForegroundColor Yellow
        Write-Host "  │  1. Ouvrez ce lien dans votre navigateur :            │" -ForegroundColor White
        Write-Host "  │  https://github.com/princedesalem/Elite-capital-EMS  │" -ForegroundColor Cyan
        Write-Host "  │     /settings/actions/runners/new?runnerOs=win        │" -ForegroundColor Cyan
        Write-Host "  │                                                        │" -ForegroundColor White
        Write-Host "  │  2. Cliquez sur 'Windows'                             │" -ForegroundColor White
        Write-Host "  │  3. Cherchez la ligne avec '--token'                  │" -ForegroundColor White
        Write-Host "  │  4. Copiez la valeur du token (letters apres --token) │" -ForegroundColor White
        Write-Host "  └──────────────────────────────────────────────────────┘" -ForegroundColor Yellow
        Write-Host ""

        $token = Read-Host "  Collez le token ici et appuyez sur Entree"
        $token = $token.Trim()

        if ($token.Length -lt 20) {
            Write-Log "Token trop court. Relancez le script et entrez le token complet." "Red"
            Set-State "RUNNER"
            Read-Host "Entree pour quitter"
            exit 1
        }

        New-Item -ItemType Directory -Path $RUNNER_DIR -Force | Out-Null
        Set-Location $RUNNER_DIR

        if (-not (Test-Path "$RUNNER_DIR\config.cmd")) {
            Write-Log "Telechargement du runner GitHub Actions..."
            Invoke-WebRequest `
                -Uri "https://github.com/actions/runner/releases/download/v2.316.0/actions-runner-win-x64-2.316.0.zip" `
                -OutFile "runner.zip" -UseBasicParsing
            Expand-Archive "runner.zip" -DestinationPath "." -Force
            Write-OK "Runner telecharge."
        }

        Write-Log "Configuration du runner..."
        & .\config.cmd --url $GITHUB_REPO --token $token `
            --name "EMS-Server" --work "_work" --unattended 2>&1 |
            Tee-Object -Append -FilePath $LOG_FILE

        Write-Log "Installation comme service Windows..."
        & .\svc.cmd install 2>&1 | Tee-Object -Append -FilePath $LOG_FILE
        & .\svc.cmd start   2>&1 | Tee-Object -Append -FilePath $LOG_FILE

        Write-OK "GitHub Actions Runner installe et demarre."
        Set-State "RUNNER_CI"; $state = "RUNNER_CI"
    }
}

# ─────────────────────────────────────────────────────────────
# PHASE 7.5 — Mise à jour ci.yml pour le deploy automatique
# ─────────────────────────────────────────────────────────────
if ($state -eq "RUNNER_CI") {
    Write-Step "Ajout du job deploy dans .github/workflows/ci.yml"

    $ciPath = Join-Path $EMS_ROOT ".github\workflows\ci.yml"
    if (Test-Path $ciPath) {
        $ciContent = Get-Content $ciPath -Raw

        # Vérifier si le job deploy existe déjà
        if ($ciContent -notmatch "runs-on: self-hosted") {
            $deployJob = @'


  deploy:
    name: Deploy to local server (self-hosted)
    needs: [backend-tests, frontend-tests, backend-lint]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: self-hosted
    steps:
      - name: Pull latest code
        run: git -C C:\EMS\extranet pull origin main

      - name: Rebuild and restart containers
        working-directory: C:\EMS\extranet
        run: docker compose up --build -d

      - name: Health check backend
        run: |
          $ok = $false
          for ($i = 0; $i -lt 12; $i++) {
            Start-Sleep -Seconds 5
            try {
              $r = Invoke-RestMethod http://localhost:8000/health -TimeoutSec 3
              $ok = $true; break
            } catch {}
          }
          if (-not $ok) { Write-Error "Backend health check failed"; exit 1 }
          Write-Host "Backend OK"
'@
            $ciContent + $deployJob | Set-Content $ciPath -Encoding UTF8 -Force
            Write-OK "Job 'deploy' ajoute dans ci.yml."

            # Commit et push
            Set-Location $EMS_ROOT
            git config user.email "deploy@elitecapital.com" 2>&1 | Out-Null
            git config user.name "EMS Deploy Bot" 2>&1 | Out-Null
            git add ".github/workflows/ci.yml" 2>&1 | Out-Null
            git commit -m "ci: add self-hosted deploy job for local server" 2>&1 |
                Tee-Object -Append -FilePath $LOG_FILE
            git push origin main 2>&1 | Tee-Object -Append -FilePath $LOG_FILE
            Write-OK "ci.yml mis a jour et pousse sur GitHub."
        } else {
            Write-OK "Job deploy deja present dans ci.yml."
        }
    } else {
        Write-Log "ci.yml introuvable — ajout manuel necessaire." "Yellow"
    }

    Set-State "DONE"; $state = "DONE"
}

# ─────────────────────────────────────────────────────────────
# TERMINÉ
# ─────────────────────────────────────────────────────────────
if ($state -eq "DONE") {
    Remove-Item $STATE_FILE -ErrorAction SilentlyContinue

    $serverIP = Get-ServerIP

    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║                                                  ║" -ForegroundColor Green
    Write-Host "  ║   INSTALLATION TERMINEE AVEC SUCCES !           ║" -ForegroundColor Green
    Write-Host "  ║   EMS — Elite Capital Group                     ║" -ForegroundColor Green
    Write-Host "  ║                                                  ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  APPLICATION ACCESSIBLE :" -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  Sur ce serveur   :  http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Reseau local     :  http://${serverIP}:5173" -ForegroundColor Cyan
    Write-Host "  API Backend      :  http://localhost:8000/docs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  CI/CD AUTOMATIQUE :" -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  Chaque git push origin main depuis votre PC dev  " -ForegroundColor White
    Write-Host "  → Tests GitHub Actions (pytest + vitest)         " -ForegroundColor White
    Write-Host "  → Si tests OK : redeploiement automatique ici    " -ForegroundColor White
    Write-Host ""
    Write-Host "  COMMANDES UTILES (dans PowerShell depuis C:\EMS\extranet) :" -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  docker compose ps              → voir les services" -ForegroundColor Gray
    Write-Host "  docker compose logs -f backend → voir les logs    " -ForegroundColor Gray
    Write-Host "  docker compose restart backend → redemarrer API   " -ForegroundColor Gray
    Write-Host "  docker compose down            → arreter tout      " -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Log d installation : $LOG_FILE" -ForegroundColor DarkGray
    Write-Host ""
    Read-Host "  Appuyez sur Entree pour fermer"
}
