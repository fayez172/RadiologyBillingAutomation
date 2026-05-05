@echo off
REM TeleRad Billing Agent — Windows Service Uninstaller
REM Run as Administrator.

SET SERVICE_NAME=TeleRadBillingAgent
SET INSTALL_DIR=C:\Program Files\TeleRadBillingAgent

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Run as Administrator.
    pause
    exit /b 1
)

echo Stopping and removing TeleRad Billing Agent service...
"%INSTALL_DIR%\nssm.exe" stop   %SERVICE_NAME% >nul 2>&1
"%INSTALL_DIR%\nssm.exe" remove %SERVICE_NAME% confirm

echo Done. Logs preserved at: %INSTALL_DIR%\logs\
pause
