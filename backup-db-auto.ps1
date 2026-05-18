# EMS Database Backup - Exécution quotidienne programmée
# Ce script est appelé automatiquement par le Planificateur de tâches Windows tous les jours à minuit

$EMS_ROOT = "C:\EMS\extranet"
$BACKUP_DIR = "C:\EMS\backups"
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd-HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\ems-db-$TIMESTAMP.sql"

if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
}

Set-Location $EMS_ROOT

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Debut du backup de la base de donnees..." -ForegroundColor Yellow

# Dump MySQL
docker compose exec -T db mysqldump -u extranet -pextranet EMS_DB > $BACKUP_FILE 2>&1

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Backup reussi : $BACKUP_FILE ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    
    # Supprimer les backups plus vieux que 30 jours
    Get-ChildItem $BACKUP_DIR -Filter "ems-db-*.sql" -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Nettoyage des backups anciens effectue." -ForegroundColor Gray
} else {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERREUR lors du backup !" -ForegroundColor Red
    exit 1
}
