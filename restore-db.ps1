param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $BackupFile)) {
  throw "Fichier backup introuvable: $BackupFile"
}

Write-Host "Restauration de la base EMS_DB depuis $BackupFile"
Get-Content $BackupFile | docker compose exec -T db mysql -uextranet -pextranet EMS_DB

if ($LASTEXITCODE -ne 0) {
  throw "Echec de la restauration base de donnees"
}

Write-Host "Restauration terminee"
