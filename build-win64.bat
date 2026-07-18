@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Installing build dependencies...
echo.
call npm install
if errorlevel 1 goto error

echo.
echo Building Windows 64-bit installer...
echo.
call npm run dist:win64
if errorlevel 1 goto error

echo.
echo Done.
echo Installer file will be in the dist folder:
echo dist\AIDA-Inventory-Setup-1.0.0-x64.exe
echo.
pause
exit /b 0

:error
echo.
echo Build failed.
echo Make sure Node.js is installed and internet is available.
echo.
pause
exit /b 1
