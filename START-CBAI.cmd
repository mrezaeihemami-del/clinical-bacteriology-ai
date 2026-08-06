@echo off
setlocal
cd /d "%~dp0"

for %%I in (.) do set "PROJECT_ROOT=%%~fI"

echo.
echo Clinical Bacteriology AI Assistant
echo Docker-only startup
echo Project folder: %PROJECT_ROOT%
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass ^
  -File "%PROJECT_ROOT%\Start-Docker.ps1" ^
  -ProjectRoot "%PROJECT_ROOT%"

set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Startup failed. Review the red error above.
  echo Diagnostic logs, when available, are inside:
  echo   %PROJECT_ROOT%\logs
) else (
  echo Startup completed successfully.
)
echo.
pause
exit /b %EXIT_CODE%
