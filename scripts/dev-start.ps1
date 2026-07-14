# Maple Garden Events — start server + client (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Maple Garden Events — Dev Startup ===" -ForegroundColor Cyan

# --- .env files ---
if (-not (Test-Path "$Root\server\.env")) {
    Copy-Item "$Root\server\.env.example" "$Root\server\.env"
    Write-Host "Created server\.env from example — fill in DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID" -ForegroundColor Yellow
}
if (-not (Test-Path "$Root\client\.env")) {
    Copy-Item "$Root\client\.env.example" "$Root\client\.env"
    Write-Host "Created client\.env from example" -ForegroundColor Yellow
}

# --- dependencies ---
if (-not (Test-Path "$Root\server\node_modules")) {
    Write-Host "Installing server dependencies..." -ForegroundColor Yellow
    Push-Location "$Root\server"; npm install; npx prisma generate; Pop-Location
}
if (-not (Test-Path "$Root\client\node_modules")) {
    Write-Host "Installing client dependencies..." -ForegroundColor Yellow
    Push-Location "$Root\client"; npm install; Pop-Location
}
if (-not (Test-Path "$Root\node_modules\concurrently")) {
    Write-Host "Installing root dev tools..." -ForegroundColor Yellow
    Push-Location $Root; npm install; Pop-Location
}

# --- start both ---
Write-Host ""
Write-Host "Starting server (port 5000) + client (port 5173)..." -ForegroundColor Green
Write-Host "Open: http://localhost:5173" -ForegroundColor Green
Write-Host "Health: http://localhost:5173/api/health" -ForegroundColor Green
Write-Host "Press Ctrl+C in each window to stop." -ForegroundColor DarkGray
Write-Host ""

Start-Process cmd -ArgumentList '/k', "cd /d `"$Root\server`" && npm run dev"
Start-Sleep -Seconds 2
Start-Process cmd -ArgumentList '/k', "cd /d `"$Root\client`" && npm run dev"
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
