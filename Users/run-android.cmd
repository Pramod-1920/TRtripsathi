@echo off
setlocal
cd /d "%~dp0"

set "TRIPSATHI_PORT=8081"
set "TRIPSATHI_BACKEND=http://localhost:8080"

netstat -ano | findstr /R /C:":%TRIPSATHI_PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Port %TRIPSATHI_PORT% is already in use.
  echo Stop the existing Flutter process or open http://localhost:%TRIPSATHI_PORT%
  exit /b 1
)

echo Starting TripSathi at http://localhost:%TRIPSATHI_PORT%
echo Keep this window open. Press Ctrl+C to stop Flutter.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command ^
  "Start-Sleep -Seconds 8; Start-Process 'http://localhost:%TRIPSATHI_PORT%'"

flutter run -d web-server --web-port %TRIPSATHI_PORT% --dart-define=BACKEND_URL=%TRIPSATHI_BACKEND%
exit /b %errorlevel%
