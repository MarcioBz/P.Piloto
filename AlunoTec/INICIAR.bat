@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 servidor-local.py
  pause
  exit /b
)
where python >nul 2>nul
if not errorlevel 1 (
  python servidor-local.py
  pause
  exit /b
)
echo Python 3 nao encontrado. Abra index.html com o Live Server no VS Code.
pause
