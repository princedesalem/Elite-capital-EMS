# Run development environment using Docker Compose
# Usage: Open PowerShell as Administrator and run: .\run-dev.ps1

# Check Docker availability
try {
    docker --version > $null 2>&1
} catch {
    Write-Error "Docker is not available in PATH. Please install Docker Desktop and ensure 'docker' is in PATH."
    exit 1
}

Write-Host "Building Docker images..."
docker compose build

Write-Host "Starting services in background..."
docker compose up -d

Write-Host "Waiting for backend to become available (http://localhost:8000)..."
$max = 60
$count = 0
while ($count -lt $max) {
    try {
        $r = Invoke-WebRequest -Uri http://localhost:8000 -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) {
            Write-Host "Backend is responding."
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        $count++
    }
}
if ($count -ge $max) {
    Write-Warning "Backend did not respond within expected time. Check 'docker compose logs -f backend' for details."
}

Write-Host "Initializing database (creating roles and admin)..."
# Pass INIT_ADMIN_PW env if you want a custom initial admin password
docker compose exec backend python init_db.py
if ($LASTEXITCODE -ne 0) { Write-Warning "init_db.py returned non-zero exit code" }

Write-Host "Done. Frontend: http://localhost:5173    Backend docs: http://localhost:8000/docs"
Write-Host "To follow backend logs: docker compose logs -f backend"
Write-Host "To stop and remove containers: .\stop-dev.ps1"