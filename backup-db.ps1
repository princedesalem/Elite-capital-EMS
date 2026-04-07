param(
  [string]$OutputDir = ".\backups"
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $OutputDir "ems-db-$timestamp.sql"

Write-Host "Creation du backup MySQL dans $backupFile"
docker compose exec -T db mysqldump -uextranet -pextranet EMS_DB > $backupFile

if ($LASTEXITCODE -ne 0) {
  throw "Echec du backup base de donnees"
}

Write-Host "Backup termine: $backupFile"
