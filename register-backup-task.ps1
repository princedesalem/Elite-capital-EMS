# Enregistre / désenregistre une tâche planifiée Windows pour exécuter le
# backup MySQL du projet EMS quotidiennement.
#
# Usage :
#   .\register-backup-task.ps1                   # enregistre (défaut 02:00)
#   .\register-backup-task.ps1 -At '01:30'       # change l'heure
#   .\register-backup-task.ps1 -KeepLast 60      # change la rétention
#   .\register-backup-task.ps1 -Unregister       # supprime la tâche
#
# Nécessite des droits Administrateur pour créer/supprimer la tâche.

[CmdletBinding()]
param(
  [string]$TaskName = 'EMS-DB-Backup-Daily',
  [string]$At = '02:00',
  [int]$KeepLast = 30,
  [switch]$Compress,
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object System.Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  Write-Error "Ce script doit etre execute en tant qu'Administrateur."
  exit 1
}

if ($Unregister) {
  try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
    Write-Host "Tache '$TaskName' supprimee."
  }
  catch {
    Write-Warning "Tache '$TaskName' introuvable ou deja supprimee."
  }
  exit 0
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupScript = Join-Path $scriptRoot 'backup-db.ps1'
if (-not (Test-Path $backupScript)) {
  Write-Error "backup-db.ps1 introuvable dans $scriptRoot"
  exit 1
}

$args = "-ExecutionPolicy Bypass -NoProfile -File `"$backupScript`" -KeepLast $KeepLast"
if ($Compress) { $args += ' -Compress' }

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument $args `
  -WorkingDirectory $scriptRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $At

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -WakeToRun `
  -RunOnlyIfNetworkAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$principal = New-ScheduledTaskPrincipal `
  -UserId (whoami) `
  -LogonType S4U `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Backup quotidien de la base EMS_DB (EMS Extranet) - $At, KeepLast=$KeepLast" `
  -Force | Out-Null

Write-Host "Tache '$TaskName' enregistree :"
Write-Host "  Heure       : $At (quotidien)"
Write-Host "  Retention   : $KeepLast fichiers"
Write-Host "  Compression : $Compress"
Write-Host "  Script      : $backupScript"
Write-Host ""
Write-Host "Verifier : Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Demarrer : Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Desinstaller : .\register-backup-task.ps1 -Unregister"
