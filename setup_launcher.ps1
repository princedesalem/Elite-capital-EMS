# ============================================================================
#  EMS Server Launcher — Création d'icône ronde + raccourci bureau
#  Elite Capital Group S.A.
#  Couleurs : Navy #0d1b2e | Rouge #e63329 | Blanc #ffffff
# ============================================================================

$EMS_ROOT  = "C:\EMS"
$ICON_OUT  = "$EMS_ROOT\ems-launcher.ico"
$LAUNCHER  = "$EMS_ROOT\ems_launcher.pyw"
$DESKTOP   = [Environment]::GetFolderPath("Desktop")
$SHORTCUT  = "$DESKTOP\EMS Server Launcher.lnk"

Write-Host ""
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host "  |   EMS Server Launcher - Setup            |" -ForegroundColor Cyan
Write-Host "  |   Elite Capital Group S.A.               |" -ForegroundColor Cyan
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host ""

# ── Étape 1 : Générer l'icône ronde ──────────────────────────────────────────
Write-Host "[1/3]  Génération de l'icône ronde EMS..." -ForegroundColor Yellow

Add-Type -AssemblyName System.Drawing

function New-RoundEmsIcon {
    param([string]$OutPath)

    $SIZE = 256

    # Créer bitmap avec transparence
    $bmp = New-Object System.Drawing.Bitmap($SIZE, $SIZE,
           [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode       = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint   = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode   = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # 1. Fond transparent
    $g.Clear([System.Drawing.Color]::Transparent)

    # 2. Ombre portée (cercle sombre légèrement décalé)
    $shadowBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(80, 0, 0, 0))
    $g.FillEllipse($shadowBrush, 10, 12, $SIZE - 18, $SIZE - 18)

    # 3. Cercle de fond — Navy foncé
    $navyBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 13, 27, 46))
    $g.FillEllipse($navyBrush, 4, 4, $SIZE - 8, $SIZE - 8)

    # 4. Anneau extérieur rouge
    $redPen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(255, 230, 51, 41), 10)
    $redPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Inset
    $g.DrawEllipse($redPen, 7, 7, $SIZE - 14, $SIZE - 14)

    # 5. Cercle intérieur légèrement plus clair (effet de profondeur)
    $innerBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 22, 36, 56))
    $g.FillEllipse($innerBrush, 28, 28, $SIZE - 56, $SIZE - 56)

    # 6. Ligne décorative horizontale (thin separator)
    $linePen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(120, 230, 51, 41), 2)
    $g.DrawLine($linePen, 55, 160, $SIZE - 55, 160)

    # 7. Texte "EMS" — blanc, grand, gras
    $fontBig = New-Object System.Drawing.Font("Segoe UI", 68,
               [System.Drawing.FontStyle]::Bold,
               [System.Drawing.GraphicsUnit]::Pixel)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rectTop = New-Object System.Drawing.RectangleF(0, 50, $SIZE, 100)
    $g.DrawString("EMS", $fontBig, $whiteBrush, $rectTop, $sf)

    # 8. Texte "LAUNCHER" — rouge, petit
    $fontSub = New-Object System.Drawing.Font("Segoe UI", 20,
               [System.Drawing.FontStyle]::Bold,
               [System.Drawing.GraphicsUnit]::Pixel)
    $redBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 230, 51, 41))
    $rectBot = New-Object System.Drawing.RectangleF(0, 162, $SIZE, 36)
    $g.DrawString("LAUNCHER", $fontSub, $redBrush, $rectBot, $sf)

    # 9. Petits cercles décoratifs (gauche/droite)
    $dotBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(180, 230, 51, 41))
    $g.FillEllipse($dotBrush, 36, 118, 8, 8)
    $g.FillEllipse($dotBrush, $SIZE - 44, 118, 8, 8)

    $g.Dispose()

    # ── Sauvegarder comme ICO (format PNG-in-ICO, supporté depuis Vista) ──────
    # Créer plusieurs tailles pour une icône de qualité
    $sizes = @(256, 64, 48, 32, 16)
    $pngDataList = @()

    foreach ($sz in $sizes) {
        $resized = New-Object System.Drawing.Bitmap($sz, $sz)
        $gr = [System.Drawing.Graphics]::FromImage($resized)
        $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gr.DrawImage($bmp, 0, 0, $sz, $sz)
        $gr.Dispose()

        $ms = New-Object System.IO.MemoryStream
        $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngDataList += , $ms.ToArray()
        $ms.Dispose()
        $resized.Dispose()
    }

    $bmp.Dispose()

    # Écrire le fichier ICO
    $fs = New-Object System.IO.FileStream($OutPath, [System.IO.FileMode]::Create)
    $bw = New-Object System.IO.BinaryWriter($fs)

    # ICONDIR header
    $bw.Write([uint16]0)                     # Reserved
    $bw.Write([uint16]1)                     # Type: ICO
    $bw.Write([uint16]$sizes.Count)          # Number of images

    # Offset du premier ICONDIRENTRY = 6 + N*16
    $offset = 6 + $sizes.Count * 16
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $sz   = $sizes[$i]
        $data = $pngDataList[$i]
        $w    = if ($sz -eq 256) { 0 } else { [byte]$sz }
        $h    = if ($sz -eq 256) { 0 } else { [byte]$sz }

        $bw.Write([byte]$w)              # Width  (0=256)
        $bw.Write([byte]$h)              # Height (0=256)
        $bw.Write([byte]0)              # ColorCount
        $bw.Write([byte]0)              # Reserved
        $bw.Write([uint16]1)            # Planes
        $bw.Write([uint16]32)           # BitCount
        $bw.Write([uint32]$data.Length) # BytesInRes
        $bw.Write([uint32]$offset)      # ImageOffset
        $offset += $data.Length
    }

    # Image data
    foreach ($data in $pngDataList) {
        $bw.Write($data)
    }

    $bw.Flush()
    $bw.Close()
    $fs.Close()
}

try {
    New-RoundEmsIcon -OutPath $ICON_OUT
    Write-Host "  ✓ Icône créée : $ICON_OUT" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Erreur icône : $_" -ForegroundColor Red
    Write-Host "  → Utilisation de l'icône existante..." -ForegroundColor Yellow
    $ICON_OUT = "$EMS_ROOT\ems-icon.ico"
}

# ── Étape 2 : Localiser Python ───────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3]  Recherche de Python..." -ForegroundColor Yellow

$pythonw = $null
$candidates = @(
    "pythonw.exe",
    "C:\Python313\pythonw.exe",
    "C:\Python312\pythonw.exe",
    "C:\Python311\pythonw.exe",
    "C:\Python310\pythonw.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\pythonw.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\pythonw.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python311\pythonw.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python310\pythonw.exe"
)

foreach ($c in $candidates) {
    try {
        $found = & where.exe $c 2>$null
        if ($found -or (Test-Path $c)) {
            $pythonw = if (Test-Path $c) { $c } else { $found }
            break
        }
    } catch {}
}

if (-not $pythonw) {
    # Fallback: python.exe with -c "import tkinter"
    $pythonw = "pythonw.exe"
    Write-Host "  ⚠ pythonw.exe introuvable, utilisation de python.exe" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Python trouvé : $pythonw" -ForegroundColor Green
}

# ── Étape 3 : Créer le raccourci bureau ─────────────────────────────────────
Write-Host ""
Write-Host "[3/3]  Création du raccourci bureau..." -ForegroundColor Yellow

$WshShell  = New-Object -ComObject WScript.Shell
$sc        = $WshShell.CreateShortcut($SHORTCUT)
$sc.TargetPath       = $pythonw
$sc.Arguments        = "`"$LAUNCHER`""
$sc.WorkingDirectory = $EMS_ROOT
$sc.IconLocation     = "$ICON_OUT,0"
$sc.Description      = "EMS Server Launcher - Elite Capital Group S.A."
$sc.WindowStyle      = 1
$sc.Save()

if (Test-Path $SHORTCUT) {
    Write-Host "  ✓ Raccourci créé : $SHORTCUT" -ForegroundColor Green
} else {
    Write-Host "  ✗ Échec de la création du raccourci" -ForegroundColor Red
}

# ── Résumé ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host "  |   INSTALLATION TERMINEE                 |" -ForegroundColor Green
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host "  Icone    : $ICON_OUT" -ForegroundColor White
Write-Host "  Launcher : $LAUNCHER" -ForegroundColor White
Write-Host "  Raccourci: Bureau -> EMS Server Launcher" -ForegroundColor White
Write-Host "  +==========================================+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Double-cliquez sur [EMS Server Launcher] sur votre bureau." -ForegroundColor Yellow
Write-Host ""
