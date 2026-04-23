@echo off
setlocal

cd /d "%~dp0"

if not exist ".venv" (
    echo [DevOps Manager] Creation du venv Python...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERREUR] Python introuvable. Installez Python 3.10+ et reessayez.
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate.bat

echo [DevOps Manager] Installation des dependances...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo [ERREUR] pip install a echoue.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   EMS DevOps Manager
echo   http://127.0.0.1:9000
echo   Ctrl+C pour arreter
echo ============================================================
echo.

start "" http://127.0.0.1:9000

python app.py

endlocal
