<#
.SYNOPSIS
    Enregistre (ou supprime) la tâche planifiée Windows pour la sauvegarde automatique de la BDD EMS.

.PARAMETER Unregister
    Si ce switch est spécifié, supprime la tâche planifiée au lieu de la créer.

.EXAMPLE
    .\register-backup-task.ps1
    .\register-backup-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
    [switch]$Unregister
)

$TaskName    = 'EMS-BackupDB'
$ScriptPath  = Join-Path $PSScriptRoot 'backup-db-auto.ps1'
$LogPath     = Join-Path $PSScriptRoot 'backups\backup.log'

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Tâche '$TaskName' supprimée."
    } else {
        Write-Host "Tâche '$TaskName' introuvable, rien à supprimer."
    }
    exit 0
}

# -- Action : lancer le script PowerShell de backup --
$Action  = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$ScriptPath`""

# -- Trigger : tous les jours à 02h00 (-At) --
$Trigger = New-ScheduledTaskTrigger -Daily -At '02:00'

# -- Principal : SYSTEM (pas de session interactive requise) --
$Principal = New-ScheduledTaskPrincipal `
    -UserId 'SYSTEM' `
    -LogonType ServiceAccount `
    -RunLevel Highest

# -- Paramètres --
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

# -- Enregistrement --
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Ancienne tâche '$TaskName' supprimée."
}

Register-ScheduledTask `
    -TaskName  $TaskName `
    -Action    $Action `
    -Trigger   $Trigger `
    -Principal $Principal `
    -Settings  $Settings `
    -Description 'Sauvegarde automatique quotidienne de la base de données EMS.' | Out-Null

Write-Host "Tâche '$TaskName' enregistrée avec succès (déclenchement quotidien à 02h00)."
