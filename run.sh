#!/bin/bash
# Winbuzz Production Server Startup Script
echo "===================================================="
echo "Starting Winbuzz Betting Exchange & Casino Server..."
echo "===================================================="
cd "$(dirname "$0")"

pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
