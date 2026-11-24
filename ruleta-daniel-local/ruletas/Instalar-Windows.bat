@echo off
chcp 65001 >nul
echo Creando acceso directo "Ruletas Daniel" en el Escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
echo.
pause
