# Smoke test for deployed Maple Events instance (PowerShell).
# Usage: .\scripts\smoke-test.ps1 https://staging.your-domain.com
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$BaseUrl = $BaseUrl.TrimEnd('/')
$pass = 0
$fail = 0

function Test-Endpoint {
    param([string]$Name, [string]$Url, [string]$Expected = "")
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
        if ($Expected -and $response.Content -notmatch [regex]::Escape($Expected)) {
            Write-Host "FAIL $Name - unexpected response" -ForegroundColor Red
            $script:fail++
        } else {
            Write-Host "OK   $Name" -ForegroundColor Green
            $script:pass++
        }
    } catch {
        Write-Host "FAIL $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "=== Smoke Test: $BaseUrl ===" -ForegroundColor Cyan
Write-Host ""

Test-Endpoint -Name "Health endpoint" -Url "$BaseUrl/api/health" -Expected '"status":"ok"'
Test-Endpoint -Name "Client SPA" -Url "$BaseUrl/" -Expected "<!DOCTYPE html>"

Write-Host ""
Write-Host "--- Results: $pass passed, $fail failed ---"

if ($fail -gt 0) { exit 1 }
Write-Host "All smoke tests passed." -ForegroundColor Green
