[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$src = Join-Path $root "installer_src.cs"
$ico = Join-Path $root "ems-icon.ico"
$out = Join-Path $root "Installer EMS Server.exe"

if (-not (Test-Path $csc)) { throw "csc introuvable: $csc" }
if (-not (Test-Path $src)) { throw "Source introuvable: $src" }
if (-not (Test-Path $ico)) { throw "Icone introuvable: $ico" }

# /target:exe = fenetre console visible (indispensable pour voir l'avancement)
& $csc /nologo /target:exe /win32icon:"$ico" /out:"$out" "$src"
if ($LASTEXITCODE -ne 0) { throw "Compilation echouee (code: $LASTEXITCODE)" }

Get-Item $out | Select-Object FullName, Length, LastWriteTime | Format-List
