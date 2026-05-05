@echo off
REM Build TeleRadAgent.exe using PyInstaller
REM Run from the edge-agent directory.

echo Installing dependencies...
pip install -r requirements.txt pyinstaller

echo.
echo Building TeleRadAgent.exe...
pyinstaller --clean build.spec

echo.
if exist dist\TeleRadAgent.exe (
    echo BUILD SUCCESS: dist\TeleRadAgent.exe
    for %%A in (dist\TeleRadAgent.exe) do echo File size: %%~zA bytes
) else (
    echo BUILD FAILED — check output above.
    exit /b 1
)
