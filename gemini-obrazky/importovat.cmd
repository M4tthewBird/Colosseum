@echo off
cd /d "%~dp0.."
call npm run images:import
echo.
pause
