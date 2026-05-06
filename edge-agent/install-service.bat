@echo off
REM TeleRad Billing Agent — Windows Service Installer
REM Run as Administrator.

SET INSTALL_DIR=C:\Program Files\TeleRadBillingAgent
SET SERVICE_NAME=TeleRadBillingAgent
SET SCRIPT_DIR=%~dp0

echo ============================================================
echo  TeleRad Billing Agent — Service Installer
echo ============================================================
echo.

REM Check Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    pause
    exit /b 1
)

REM Gather configuration
echo.
echo --- Configuration Required ---
if "%AGENT_INSTANCE_ID%"=="" set /p AGENT_INSTANCE_ID="Enter Agent Instance ID: "
if "%AGENT_API_KEY%"==""     set /p AGENT_API_KEY="Enter Agent API Key: "
if "%AGENT_API_ENDPOINT%"=="" set /p AGENT_API_ENDPOINT="Enter API Endpoint (e.g. https://billing.example.com): "

echo.
echo --- MSSQL Configuration ---
if "%MSSQL_HOST%"==""     set /p MSSQL_HOST="Enter MSSQL Host (e.g. localhost): "
if "%MSSQL_USER%"==""     set /p MSSQL_USER="Enter MSSQL User: "
if "%MSSQL_PASSWORD%"=="" set /p MSSQL_PASSWORD="Enter MSSQL Password: "

REM Create install directory
echo.
echo Creating install directory: %INSTALL_DIR%
mkdir "%INSTALL_DIR%" 2>nul
mkdir "%INSTALL_DIR%\logs" 2>nul
mkdir "%INSTALL_DIR%\sql" 2>nul

REM Copy files
echo Copying agent files...
copy /Y "%SCRIPT_DIR%TeleRadAgent.exe" "%INSTALL_DIR%\" >nul
copy /Y "%SCRIPT_DIR%nssm.exe"         "%INSTALL_DIR%\" >nul
copy /Y "%SCRIPT_DIR%config.yaml"      "%INSTALL_DIR%\" >nul
copy /Y "%SCRIPT_DIR%sql\enable_cdc.sql" "%INSTALL_DIR%\sql\" >nul

REM Remove old service if exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Removing existing service...
    "%INSTALL_DIR%\nssm.exe" stop %SERVICE_NAME% >nul 2>&1
    "%INSTALL_DIR%\nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1
)

REM Install service
echo.
echo Installing Windows Service...
"%INSTALL_DIR%\nssm.exe" install %SERVICE_NAME% "%INSTALL_DIR%\TeleRadAgent.exe"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppParameters "run --dir \"%INSTALL_DIR%\""
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% DisplayName "TeleRad Billing Agent"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% Description "Syncs radiology studies to TeleRad Billing system via CDC. Do not stop unless instructed."

REM Set Environment Variables in Service
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppEnvironmentExtra ^
AGENT_INSTANCE_ID=%AGENT_INSTANCE_ID% ^
AGENT_API_KEY=%AGENT_API_KEY% ^
AGENT_API_ENDPOINT=%AGENT_API_ENDPOINT% ^
MSSQL_HOST=%MSSQL_HOST% ^
MSSQL_USER=%MSSQL_USER% ^
MSSQL_PASSWORD=%MSSQL_PASSWORD%
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppStdout "%INSTALL_DIR%\logs\agent.log"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppStderr "%INSTALL_DIR%\logs\agent_err.log"
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateFiles 1
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRotateBytes 5242880
"%INSTALL_DIR%\nssm.exe" set %SERVICE_NAME% AppRestartDelay 5000

REM Start service
echo Starting service...
net start %SERVICE_NAME%

echo.
echo ============================================================
if %errorLevel% equ 0 (
    echo  SUCCESS: TeleRad Billing Agent is running.
) else (
    echo  WARNING: Service installed but may not have started.
    echo  Check: services.msc or Event Viewer.
)
echo.
echo  Install dir : %INSTALL_DIR%
echo  Logs        : %INSTALL_DIR%\logs\agent.log
echo  Manage      : services.msc ^> TeleRad Billing Agent
echo ============================================================
echo.
pause
