@echo off
chcp 65001 >nul
title Instalador Automático - Maps Scraper & WhatsApp Outreach
color 0B

cd /d "%~dp0"

echo ======================================================================
echo    INSTALADOR AUTOMATICO - MAPS SCRAPER ^& WHATSAPP OUTREACH (LOCAL)
echo ======================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado en esta computadora.
    echo Por favor descarga e instala Node.js LTS desde: https://nodejs.org
    echo Luego vuelve a abrir este instalador.
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias del servidor local...
call npm.cmd install
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion del servidor.
    pause
    exit /b 1
)

echo.
echo [2/4] Instalando dependencias de la interfaz grafica...
call npm.cmd install --prefix frontend
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la instalacion del frontend.
    pause
    exit /b 1
)

echo.
echo [3/4] Compilando interfaz de usuario...
call npm.cmd run build --prefix frontend
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion del frontend.
    pause
    exit /b 1
)

echo.
echo [4/4] Verificando ejecutable MapsScraperOutreach.exe y creando Acceso Directo...
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /out:"MapsScraperOutreach.exe" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll "Launcher.cs" >nul 2>nul
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desktop 'Maps Scraper & WhatsApp.lnk')); $s.TargetPath = (Join-Path '%~dp0' 'MapsScraperOutreach.exe'); $s.WorkingDirectory = '%~dp0'; $s.Description = 'Buscador de Google Maps y WhatsApp Outreach Local'; $s.Save()" >nul 2>nul

echo.
echo ======================================================================
echo   ¡INSTALACION COMPLETADA CON EXITO!
echo   - Ejecutable listo: MapsScraperOutreach.exe
echo   - Se creo el acceso directo en tu Escritorio: "Maps Scraper & WhatsApp"
echo ======================================================================
echo.
pause
