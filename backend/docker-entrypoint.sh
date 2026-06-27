#!/bin/sh
set -e

PORT="${PORT:-8080}"

echo "[entrypoint] Initializing database and storage..."
python scripts/init_db.py

echo "[entrypoint] Starting uvicorn on 0.0.0.0:${PORT}"
exec python -m uvicorn src.main:app --host 0.0.0.0 --port "${PORT}"
