# ============================================================
#  MyDream Inventory — Start Backend (LAN accessible)
#  Run this script instead of "manage.py runserver"
#  It binds to 0.0.0.0 so your phone can reach it on Wi-Fi.
# ============================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path $scriptDir "backend\project"
$python     = Join-Path $scriptDir "backend\env\Scripts\python.exe"
$daphne     = Join-Path $scriptDir "backend\env\Scripts\daphne.exe"

# Show your current Wi-Fi IP so you know what to type in the app
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  MyDream Inventory Backend Launcher" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$wifiIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.' } |
    Select-Object -First 1).IPAddress

if ($wifiIp) {
    Write-Host "  Your PC's IP address  : " -NoNewline
    Write-Host $wifiIp -ForegroundColor Yellow
    Write-Host "  Use this in the app   : " -NoNewline
    Write-Host "$wifiIp" -ForegroundColor Green
} else {
    Write-Host "  WARNING: No Wi-Fi IP found. Connect to Wi-Fi first!" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Server will start at  : http://0.0.0.0:8000" -ForegroundColor White
Write-Host "  (accessible from your phone as http://${wifiIp}:8000)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $projectDir

# Prefer daphne (ASGI) if available — handles Django Channels/WebSockets
if (Test-Path $daphne) {
    Write-Host "Starting with Daphne (ASGI)..." -ForegroundColor Green
    & $daphne -b 0.0.0.0 -p 8000 project.asgi:application
} elseif (Test-Path $python) {
    Write-Host "Starting with manage.py runserver..." -ForegroundColor Green
    & $python manage.py runserver 0.0.0.0:8000
} else {
    Write-Host "ERROR: Python/Daphne not found in backend\env\Scripts\" -ForegroundColor Red
    Write-Host "Make sure you have set up the virtual environment." -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
