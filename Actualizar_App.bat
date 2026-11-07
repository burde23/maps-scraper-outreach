@echo off
title Actualizador - Maps Scraper ^& WhatsApp Outreach
color 0B

cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm"

echo ======================================================================
echo    ACTUALIZANDO MAPS SCRAPER ^& WHATSAPP OUTREACH DESDE GITHUB
echo    (Tus secciones, contactos y Excels se conservan intactos)
echo ======================================================================
echo.

echo [1/4] Cerrando instancia abierta si existe...
taskkill /F /IM MapsScraperOutreach.exe >nul 2>nul

echo [2/4] Descargando ultima version desde GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/burde23/maps-scraper-outreach/archive/refs/heads/main.zip' -OutFile '_update.zip'; Expand-Archive -Path '_update.zip' -DestinationPath '_update_tmp' -Force; Copy-Item -Path '_update_tmp\maps-scraper-outreach-main\*' -Destination '.' -Recurse -Force; Remove-Item '_update.zip' -Force; Remove-Item '_update_tmp' -Recurse -Force"

echo [3/4] Recompilando interfaz y actualizando icono del Escritorio...
call npm.cmd run build --prefix frontend
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desktop 'Maps Scraper & WhatsApp.lnk')); $s.TargetPath = (Join-Path '%~dp0' 'MapsScraperOutreach.exe'); $s.WorkingDirectory = '%~dp0'; $s.IconLocation = (Join-Path '%~dp0' 'maps-scraper.ico'); $s.Description = 'Buscador de Google Maps y WhatsApp Outreach Local'; $s.Save(); ie4uinit.exe -show" >nul 2>nul

echo [4/4] Abriendo aplicacion actualizada...
start "" "MapsScraperOutreach.exe"
echo.
echo ======================================================================
echo   ACTUALIZACION COMPLETADA CON EXITO!
echo ======================================================================
pause
