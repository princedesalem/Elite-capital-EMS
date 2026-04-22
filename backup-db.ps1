[CmdletBinding()]
param(
  [string]$OutputDir = ".\backups",
  [int]$KeepLast = 30,
  [switch]$Compress
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$ts] [$Level] $Message"
  Write-Host $line
  Add-Content -Path (Join-Path $OutputDir 'backup.log') -Value $line -ErrorAction SilentlyContinue
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $OutputDir "ems-db-$timestamp.sql"

Write-Log "Debut backup MySQL -> $backupFile"
try {
  docker compose exec -T db mysqldump `
    --single-transaction --quick --lock-tables=false `
    --default-character-set=utf8mb4 `
    -uextranet -pextranet EMS_DB > $backupFile

  if ($LASTEXITCODE -ne 0) {
    Write-Log "mysqldump a renvoye exit code $LASTEXITCODE" 'ERROR'
    throw "Echec du backup base de donnees (exit $LASTEXITCODE)"
  }

  $sizeMB = [Math]::Round((Get-Item $backupFile).Length / 1MB, 2)
  Write-Log "Dump OK ($sizeMB MB)"

  if ($Compress) {
    $zipFile = "$backupFile.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    Remove-Item $backupFile -Force
    $backupFile = $zipFile
    $sizeMB = [Math]::Round((Get-Item $backupFile).Length / 1MB, 2)
    Write-Log "Compresse -> $backupFile ($sizeMB MB)"
  }
}
catch {
  Write-Log "Exception: $($_.Exception.Message)" 'ERROR'
  if (Test-Path $backupFile) { Remove-Item $backupFile -Force -ErrorAction SilentlyContinue }
  exit 1
}

# Rotation : garder les N plus recents (.sql et .sql.zip confondus)
try {
  $patterns = @('ems-db-*.sql', 'ems-db-*.sql.zip')
  $all = foreach ($p in $patterns) {
    Get-ChildItem -Path $OutputDir -Filter $p -ErrorAction SilentlyContinue
  }
  $sorted = $all | Sort-Object LastWriteTime -Descending
  if ($sorted.Count -gt $KeepLast) {
    $toDelete = $sorted | Select-Object -Skip $KeepLast
    foreach ($f in $toDelete) {
      Remove-Item $f.FullName -Force
      Write-Log "Rotation : supprime $($f.Name)"
    }
  }
  Write-Log "Rotation terminee (KeepLast=$KeepLast, total=$($sorted.Count))"
}
catch {
  Write-Log "Rotation en erreur (non-bloquant) : $($_.Exception.Message)" 'WARN'
}

Write-Log "Backup termine avec succes"
exit 0

Write-Host "Backup termine: $backupFile"
