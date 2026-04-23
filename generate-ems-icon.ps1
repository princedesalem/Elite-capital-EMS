Add-Type -AssemblyName System.Drawing

$AppDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconPath = Join-Path $AppDir "ems-icon.ico"

$sizes = @(256, 64, 48, 32, 16)
$bitmaps = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Fond transparent d'abord
    $g.Clear([System.Drawing.Color]::Transparent)

    # Fond navy #02162e avec coins arrondis
    $navy  = [System.Drawing.Color]::FromArgb(255, 2, 22, 46)
    $brushNavy = New-Object System.Drawing.SolidBrush($navy)
    $radius = [Math]::Max(4, [int]($sz * 0.18))
    $path2d = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path2d.AddArc(0, 0, $d, $d, 180, 90)
    $path2d.AddArc($sz - $d, 0, $d, $d, 270, 90)
    $path2d.AddArc($sz - $d, $sz - $d, $d, $d, 0, 90)
    $path2d.AddArc(0, $sz - $d, $d, $d, 90, 90)
    $path2d.CloseFigure()
    $g.FillPath($brushNavy, $path2d)

    # Barre rouge en bas (#d0202b) — clippee dans les coins arrondis
    $barH = [Math]::Max(2, [int]($sz * 0.12))
    $barY = $sz - $barH
    $brushRed = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 208, 32, 43))
    $g.SetClip($path2d)
    $g.FillRectangle($brushRed, 0, $barY, $sz, $barH)
    $g.ResetClip()

    # Texte "EMS" en Century Gothic Bold blanc
    $fontSize = [float]($sz * 0.30)
    $fontFamily = "Century Gothic"
    $available = [System.Drawing.FontFamily]::Families | Select-Object -ExpandProperty Name
    if ($available -notcontains "Century Gothic") {
        $fontFamily = "Segoe UI"
    }
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf   = New-Object System.Drawing.StringFormat
    $sf.Alignment     = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    # Zone de texte centree (hors barre rouge)
    $textAreaH = [float]($sz - $barH)
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, [float]$sz, $textAreaH)
    $g.DrawString("EMS", $font, [System.Drawing.Brushes]::White, $rect, $sf)

    $font.Dispose()
    $g.Dispose()
    $bitmaps += $bmp
}

# Construire le fichier .ico manuellement (format ICO standard)
function Write-LE16([System.IO.BinaryWriter]$w, [int]$v) {
    $w.Write([byte]($v -band 0xFF))
    $w.Write([byte](($v -shr 8) -band 0xFF))
}
function Write-LE32([System.IO.BinaryWriter]$w, [int]$v) {
    $w.Write([byte]($v -band 0xFF))
    $w.Write([byte](($v -shr 8) -band 0xFF))
    $w.Write([byte](($v -shr 16) -band 0xFF))
    $w.Write([byte](($v -shr 24) -band 0xFF))
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

$count = $sizes.Count

# ICO header: reserved=0, type=1 (icon), count
Write-LE16 $bw 0
Write-LE16 $bw 1
Write-LE16 $bw $count

# Sauvegarder chaque bitmap en PNG en memoire
$pngList = @()
foreach ($bmp in $bitmaps) {
    $pms = New-Object System.IO.MemoryStream
    $bmp.Save($pms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngList += ,($pms.ToArray())
    $pms.Dispose()
    $bmp.Dispose()
}

# Offset debut des donnees = 6 (header) + count * 16 (directory entries)
$offset = 6 + $count * 16

# Directory entries
for ($i = 0; $i -lt $count; $i++) {
    $sz2  = $sizes[$i]
    $data = $pngList[$i]
    $w2   = if ($sz2 -ge 256) { 0 } else { $sz2 }
    $h2   = if ($sz2 -ge 256) { 0 } else { $sz2 }
    $bw.Write([byte]$w2)
    $bw.Write([byte]$h2)
    $bw.Write([byte]0)   # color count (0=use bit depth)
    $bw.Write([byte]0)   # reserved
    Write-LE16 $bw 1     # color planes
    Write-LE16 $bw 32    # bits per pixel
    Write-LE32 $bw $data.Length
    Write-LE32 $bw $offset
    $offset += $data.Length
}

# Data images
foreach ($data in $pngList) { $bw.Write($data) }
$bw.Flush()

[System.IO.File]::WriteAllBytes($IconPath, $ms.ToArray())
$ms.Dispose()
$bw.Dispose()

Write-Host "OK: $IconPath ($((Get-Item $IconPath).Length) bytes)" -ForegroundColor Green
