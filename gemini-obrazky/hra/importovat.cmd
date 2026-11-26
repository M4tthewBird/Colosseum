@echo off
cd /d "%~dp0..\.."
call npm run art:import
echo.
pause
