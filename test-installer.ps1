[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root "Installer EMS Server.exe"
$src = Join-Path $root "installer_src.cs"
$ico = Join-Path $root "ems-icon.ico"
$launcherLog = Join-Path $root "Installer-EMS-launcher.log"

if (-not (Test-Path $src)) { throw "Source manquante: $src" }
if (-not (Test-Path $ico)) { throw "Icone manquante: $ico" }
if (-not (Test-Path $exe)) { throw "Exe manquant: $exe" }

$srcContent = Get-Content $src -Raw
if ($srcContent -notmatch "EMSInstaller")  { throw "La classe EMSInstaller est absente de la source." }
if ($srcContent -notmatch "Phase_Compose") { throw "La logique d installation est absente de la source." }

$fi = Get-Item $exe
if ($fi.Length -lt 10000) { throw "Exe trop petit ($($fi.Length) bytes), build probablement incomplet." }

if (Test-Path $launcherLog) {
    Remove-Item $launcherLog -Force -ErrorAction SilentlyContinue
}

$proc = Start-Process -FilePath $exe -ArgumentList "--self-test" -Wait -PassThru
if ($proc.ExitCode -ne 0) { throw "Self-test echoue (exit code: $($proc.ExitCode))." }

if (-not (Test-Path $launcherLog)) { throw "Log lanceur introuvable: $launcherLog" }
$log = Get-Content $launcherLog -Raw
if ($log -notmatch "Self-test: start") { throw "Trace self-test absente du log lanceur." }
if ($log -notmatch "Self-test: script present") { throw "Trace de presence script absente du log lanceur." }

Write-Host "OK - Build et self-test valides" -ForegroundColor Green
Write-Host "Exe: $exe"
Write-Host "Taille: $($fi.Length) bytes"
