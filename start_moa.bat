@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js 24 or newer is required.
    pause
    exit /b 1
)
node.exe "%~dp0scripts\start-moa.mjs"
if errorlevel 1 pause
