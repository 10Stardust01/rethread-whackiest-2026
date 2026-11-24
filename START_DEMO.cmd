@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or later is required. You can also open ReThread-investigation.html directly.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8791"
node server.mjs
pause
