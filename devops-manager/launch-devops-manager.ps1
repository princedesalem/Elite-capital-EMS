$ErrorActionPreference = "Stop"

$DevOpsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = Join-Path $DevOpsDir ".venv\Scripts\python.exe"
$TargetUrl = "http://192.168.3.186:9000"

function Test-DevOpsUp {
    try {
        $resp = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
        return $resp.StatusCode -ge 200
    } catch {
        return $false
    }
}

if (-not (Test-DevOpsUp)) {
    if (-not (Test-Path $PythonExe)) {
        & python -m venv (Join-Path $DevOpsDir ".venv")
        if ($LASTEXITCODE -ne 0) {
            throw "Creation du venv echouee. Python 3.10+ requis."
        }
    }

    & $PythonExe -m pip install -q -r (Join-Path $DevOpsDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "Installation des dependances DevOps Manager echouee."
    }

    Start-Process -FilePath $PythonExe -ArgumentList "app.py" -WorkingDirectory $DevOpsDir -WindowStyle Minimized

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 750
        if (Test-DevOpsUp) { break }
    }
}

Start-Process $TargetUrl
