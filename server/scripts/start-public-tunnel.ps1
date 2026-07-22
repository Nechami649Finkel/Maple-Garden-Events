# Exposes local server (port 5000) via Cloudflare Tunnel (free, no signup).
# Run from server folder: npm run tunnel

$ErrorActionPreference = "Stop"
$Port = if ($env:PORT) { $env:PORT } else { 5000 }
$LogFile = Join-Path $env:TEMP "maple-cloudflared.log"

Write-Host ""
Write-Host "Maple - starting public tunnel to http://localhost:$Port"
Write-Host "First run may download cloudflared (about 1 minute)."
Write-Host ""

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host "ERROR: Server is not listening on port $Port."
  Write-Host "Start it first: cd server; npm run dev"
  Write-Host "Also set SERVE_CLIENT=true in server/.env"
  exit 1
}

Remove-Item $LogFile -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList @(
  "/c", "npx --yes cloudflared tunnel --url http://localhost:$Port > `"$LogFile`" 2>&1"
) -PassThru -WindowStyle Hidden

$publicUrl = $null
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $LogFile) {
    $log = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
    if ($log -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
      $publicUrl = $Matches[1]
      break
    }
  }
}

if (-not $publicUrl) {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Write-Host "Could not get public URL. See log: $LogFile"
  exit 1
}

Write-Host "Public URL:"
Write-Host "  $publicUrl"
Write-Host ""
Write-Host "Add to server/.env:"
Write-Host "  CLIENT_URL=$publicUrl"
Write-Host "  SERVE_CLIENT=true"
Write-Host ""
Write-Host "Restart the server (Ctrl+C then npm run dev), then resend feedback emails."
Write-Host ""
Write-Host "Tunnel PID: $($proc.Id)  (stop: Stop-Process -Id $($proc.Id))"
Write-Host "Example feedback link: $publicUrl/feedback/YOUR-TOKEN"
Write-Host ""

$publicUrl | Set-Content (Join-Path $PSScriptRoot "last-public-url.txt")
