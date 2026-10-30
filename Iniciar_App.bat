@echo off
chcp 65001 >nul
title Maps Scraper & WhatsApp Outreach
cd /d "%~dp0"

if exist "MapsScraperOutreach.exe" (
    start "" "MapsScraperOutreach.exe"
    exit /b 0
)

echo ======================================================
echo    INICIANDO MAPS SCRAPER ^& WHATSAPP OUTREACH
echo ======================================================
echo.
echo Abriendo aplicacion en http://localhost:3005 ...
start http://localhost:3005
call npm.cmd start
pause
