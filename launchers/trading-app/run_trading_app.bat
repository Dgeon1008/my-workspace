@echo off
setlocal

rem Install this file in the Trading_App root, beside backend and frontend.
rem It starts the existing web app, never startup_login.ahk or run_login.bat.
set "APP_ROOT=%~dp0"
set "APP_PYTHON=%APP_ROOT%backend\venv\Scripts\python.exe"

if not "%~1"=="" if /I not "%~1"=="--check" (
    echo [ERROR] Only --check is supported.
    exit /b 1
)
if not exist "%APP_ROOT%backend\main.py" (
    echo [ERROR] backend\main.py was not found.
    goto failed
)
if not exist "%APP_ROOT%frontend\package.json" (
    echo [ERROR] frontend\package.json was not found.
    goto failed
)
if not exist "%APP_PYTHON%" (
    echo [ERROR] backend\venv\Scripts\python.exe was not found.
    goto failed
)
if not exist "%APP_ROOT%frontend\node_modules\vite\bin\vite.js" (
    echo [ERROR] Frontend dependencies are missing. Install them before running.
    goto failed
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm.cmd was not found on PATH.
    goto failed
)
"%APP_PYTHON%" -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] uvicorn is not available in the backend virtual environment.
    goto failed
)

rem The current frontend is configured to call http://127.0.0.1:8000.
rem Reject occupied ports rather than opening an unrelated service or killing it.
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $busyPorts=@(Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue); if($busyPorts.Count -gt 0){Write-Output '[ERROR] Port 8000 or 5173 is already in use. Close the existing server first.'; exit 1}; exit 0"
if errorlevel 1 goto failed

if /I "%~1"=="--check" (
    echo [OK] TradingApp prerequisites and ports checked. No server was started.
    exit /b 0
)

echo Starting TradingApp API on http://127.0.0.1:8000
start "TradingApp API - close this window to stop" /D "%APP_ROOT%backend" "%ComSpec%" /k ""%APP_PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000"
if errorlevel 1 goto failed

echo Starting TradingApp UI on http://127.0.0.1:5173
start "TradingApp UI - close this window to stop" /D "%APP_ROOT%frontend" "%ComSpec%" /k "npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --open"
if errorlevel 1 goto failed

echo [OK] API and UI launch requests sent. The UI will open in your default browser.
echo If either server fails, read the error in its console window.
exit /b 0

:failed
echo [ERROR] TradingApp was not fully started. Existing programs were not stopped.
if /I not "%~1"=="--check" pause
exit /b 1
