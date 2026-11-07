@echo off
title Maps Scraper ^& WhatsApp Outreach
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm"

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
