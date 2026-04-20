# Copie les polices Century Gothic depuis Windows vers backend/app/fonts/
# A executer une seule fois depuis le dossier extranet/
$dest = Join-Path $PSScriptRoot "backend\app\fonts"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$copied = 0
foreach ($ttf in @('GOTHIC.TTF', 'GOTHICB.TTF', 'GOTHICI.TTF')) {
    $src = Join-Path $env:WINDIR "Fonts\$ttf"
    if (Test-Path $src) {
        Copy-Item $src "$dest\" -Force
        Write-Host "Copié : $ttf"
        $copied++
    } else {
        Write-Warning "Introuvable : $src"
    }
}
Write-Host ""
if ($copied -gt 0) {
    Write-Host "✔  $copied police(s) copiée(s) dans $dest" -ForegroundColor Green
    Write-Host "   Redémarrez le backend pour activer Century Gothic dans les PDF."
} else {
    Write-Host "✘  Aucune police copiée. Century Gothic non disponible." -ForegroundColor Red
}
