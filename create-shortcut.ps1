# create-shortcut.ps1
# Execute une seule fois pour creer le raccourci bureau EMS
Add-Type -AssemblyName System.Drawing
$AppDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconPath = Join-Path $AppDir "ems-icon.ico"

$size = 64
$bmp  = New-Object System.Drawing.Bitmap($size, $size)
$g    = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(37,99,235))), 0, 0, 63, 63)
$font = New-Object System.Drawing.Font("Segoe UI", 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$sf = New-Object System.Drawing.StringFormat; $sf.Alignment = [System.Drawing.StringAlignment]::Center; $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("E", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0,0,64,64)), $sf)
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::OpenWrite($IconPath); $icon.Save($fs); $fs.Close(); $icon.Dispose(); $bmp.Dispose()

$launchPath = Join-Path $AppDir "__launch-ems.ps1"
[System.IO.File]::WriteAllLines($launchPath, @(
    "Set-Location `"$AppDir`"",
    '$running = docker compose ps --services --filter status=running 2>$null',
    'if ($running -notmatch "frontend") {',
    '    docker compose up -d db backend frontend',
    '    for ($i=0; $i -lt 20; $i++) { Start-Sleep -Seconds 3; try { if ((Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing -EA Stop).StatusCode -eq 200) { break } } catch {} }',
    '}',
    'Start-Process "http://localhost:5173"'
), [System.Text.Encoding]::UTF8)

$shell = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $shell.SpecialFolders("Desktop") "EMS Extranet.lnk"
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath       = "powershell.exe"
$lnk.Arguments        = "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launchPath`""
$lnk.WorkingDirectory = $AppDir
$lnk.IconLocation     = $IconPath
$lnk.Description      = "EMS Extranet"
$lnk.WindowStyle      = 7
$lnk.Save()
Write-Host "Raccourci cree sur le bureau" -ForegroundColor Green