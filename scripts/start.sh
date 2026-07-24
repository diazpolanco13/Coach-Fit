#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8755" 2>/dev/null || true

cd "$ROOT/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8755 --reload &
BACK_PID=$!

cd "$ROOT/frontend"
npm run dev &
FRONT_PID=$!

echo "Backend PID $BACK_PID  → http://127.0.0.1:8755"
echo "Frontend PID $FRONT_PID → http://127.0.0.1:5175"
wait
