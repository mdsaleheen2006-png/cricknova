@echo off
title Winbuzz Production Server
color 0A
echo ====================================================
echo Starting Winbuzz Betting Exchange & Casino Server...
echo ====================================================
cd /d "%~dp0"

python -m uvicorn app:app --host 0.0.0.0 --port 8000
pause
