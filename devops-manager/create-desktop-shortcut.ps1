$ErrorActionPreference = "Stop"

$DevOpsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconPath  = Join-Path $DevOpsDir "static\devops-manager.ico"
$Launcher  = Join-Path $DevOpsDir "launch-devops-manager.ps1"
$Desktop   = [Environment]::GetFolderPath("Desktop")
$LnkPath   = Join-Path $Desktop "EMS DevOps Manager.lnk"
$UrlPath   = Join-Path $Desktop "EMS DevOps Manager.url"
$TargetUrl = "http://192.168.3.186:9000"

if (-not (Test-Path $Launcher)) {
    throw "Fichier introuvable: $Launcher"
}

if (-not (Test-Path $IconPath)) {
    $generator = Join-Path (Split-Path -Parent $DevOpsDir) "generate-devops-icon.ps1"
    if (Test-Path $generator) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $generator
    }
}

if (Test-Path $LnkPath) {
    Remove-Item -Path $LnkPath -Force -ErrorAction SilentlyContinue
}

if (Test-Path $UrlPath) {
    Remove-Item -Path $UrlPath -Force -ErrorAction SilentlyContinue
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($LnkPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Launcher)
$shortcut.WorkingDirectory = $DevOpsDir
$shortcut.WindowStyle = 1
$shortcut.Description = "Lancer EMS DevOps Manager"
if (Test-Path $IconPath) {
    $shortcut.IconLocation = "$IconPath,0"
}
$shortcut.Save()

Write-Host "OK: raccourci lanceur cree -> $LnkPath" -ForegroundColor Green
Write-Host "OK: URL ouverte par le lanceur -> $TargetUrl" -ForegroundColor Green
if (Test-Path $IconPath) {
    Write-Host "OK: icone utilisee -> $IconPath" -ForegroundColor Green
} else {
    Write-Host "WARN: icone absente, raccourci cree avec icone par defaut" -ForegroundColor Yellow
}
