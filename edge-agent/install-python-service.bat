@echo off
SET SERVICE_NAME=TeleRadBillingAgent
SET INSTALL_DIR=C:\RadiologyBillingAutomation\edge-agent
SET PYTHON_EXE=C:\Python313\python.exe
SET NSSM_EXE=%INSTALL_DIR%\nssm.exe

echo ============================================================
echo  Installing TeleRad Billing Agent as Python Service
echo ============================================================

REM Check Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    pause
    exit /b 1
)

echo.
echo [1/3] Ensuring global dependencies are installed...
REM We use --ignore-installed to force them into the global site-packages even if they exist in user AppData
"%PYTHON_EXE%" -m pip install --ignore-installed pyodbc==5.3.0 httpx==0.27.0 PyYAML==6.0.1 APScheduler==3.10.4 click==8.1.7

if %errorLevel% neq 0 (
    echo ERROR: Failed to install dependencies globally. 
    echo Please ensure you are running this as Administrator and have internet access.
    pause
    exit /b 1
)

echo.
echo [2/3] Registering Windows Service...

REM Remove old service if exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Stopping and removing existing service...
    "%NSSM_EXE%" stop %SERVICE_NAME% >nul 2>&1
    "%NSSM_EXE%" remove %SERVICE_NAME% confirm >nul 2>&1
)

"%NSSM_EXE%" install %SERVICE_NAME% "%PYTHON_EXE%"
"%NSSM_EXE%" set %SERVICE_NAME% AppParameters "-m agent.main --dir \"%INSTALL_DIR%\" run"
"%NSSM_EXE%" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
"%NSSM_EXE%" set %SERVICE_NAME% DisplayName "TeleRad Billing Agent (Python)"
"%NSSM_EXE%" set %SERVICE_NAME% Description "Syncs radiology studies to TeleRad Billing system via CDC (Python Service)."
"%NSSM_EXE%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_EXE%" set %SERVICE_NAME% AppStdout "%INSTALL_DIR%\logs\agent.log"
"%NSSM_EXE%" set %SERVICE_NAME% AppStderr "%INSTALL_DIR%\logs\agent_err.log"
"%NSSM_EXE%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM_EXE%" set %SERVICE_NAME% AppRestartDelay 5000

echo.
echo [3/3] Starting service...
net start %SERVICE_NAME%

echo.
echo ============================================================
echo  SUCCESS: TeleRad Billing Agent is running as a service.
echo ============================================================
pause
