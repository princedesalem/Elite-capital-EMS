Add-Type -AssemblyName System.Drawing

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutIco  = Join-Path $RootDir "devops-manager\static\devops-manager.ico"

$outDir = Split-Path -Parent $OutIco
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$sizes = @(256, 64, 48, 32, 16)
$bitmaps = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $g.Clear([System.Drawing.Color]::Transparent)

    $navy = [System.Drawing.Color]::FromArgb(255, 2, 22, 46)
    $red  = [System.Drawing.Color]::FromArgb(255, 208, 32, 43)

    $radius = [Math]::Max(4, [int]($sz * 0.2))
    $d = $radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($sz - $d, 0, $d, $d, 270, 90)
    $path.AddArc($sz - $d, $sz - $d, $d, $d, 0, 90)
    $path.AddArc(0, $sz - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $g.FillPath((New-Object System.Drawing.SolidBrush($navy)), $path)

    $barH = [Math]::Max(2, [int]($sz * 0.12))
    $g.SetClip($path)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($red)), 0, $sz - $barH, $sz, $barH)
    $g.ResetClip()

    $fontFamily = "Segoe UI"
    $fontSize = [float]($sz * 0.34)
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textAreaH = [float]($sz - $barH)
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, [float]$sz, $textAreaH)
    $g.DrawString("DO", $font, [System.Drawing.Brushes]::White, $rect, $sf)

    $font.Dispose()
    $g.Dispose()
    $bitmaps += $bmp
}

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

Write-LE16 $bw 0
Write-LE16 $bw 1
Write-LE16 $bw $count

$pngList = @()
foreach ($bmp in $bitmaps) {
    $pms = New-Object System.IO.MemoryStream
    $bmp.Save($pms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngList += ,($pms.ToArray())
    $pms.Dispose()
    $bmp.Dispose()
}

$offset = 6 + $count * 16
for ($i = 0; $i -lt $count; $i++) {
    $sz2 = $sizes[$i]
    $data = $pngList[$i]
    $w2 = if ($sz2 -ge 256) { 0 } else { $sz2 }
    $h2 = if ($sz2 -ge 256) { 0 } else { $sz2 }
    $bw.Write([byte]$w2)
    $bw.Write([byte]$h2)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    Write-LE16 $bw 1
    Write-LE16 $bw 32
    Write-LE32 $bw $data.Length
    Write-LE32 $bw $offset
    $offset += $data.Length
}

foreach ($data in $pngList) { $bw.Write($data) }
$bw.Flush()

[System.IO.File]::WriteAllBytes($OutIco, $ms.ToArray())
$ms.Dispose()
$bw.Dispose()

Write-Host "OK: $OutIco ($((Get-Item $OutIco).Length) bytes)" -ForegroundColor Green
