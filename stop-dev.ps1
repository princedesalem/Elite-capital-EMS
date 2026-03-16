# Stop and remove containers created by docker compose
# Usage: .\stop-dev.ps1

try {
    docker --version > $null 2>&1
} catch {
    Write-Error "Docker is not available in PATH."
    exit 1
}

Write-Host "Stopping and removing services (containers)..."
docker compose down
Write-Host "If you want to remove volumes (DB reset), run: docker compose down -v"