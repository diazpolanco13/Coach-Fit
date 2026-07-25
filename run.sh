#!/usr/bin/env bash
# Coach Fit — arranque en un comando.
# Compila el frontend, prepara el backend y sirve todo en un puerto,
# imprimiendo la URL para abrir desde el teléfono (misma WiFi).
#
#   ./run.sh              build + servidor en :8755
#   PORT=9000 ./run.sh    otro puerto
#   SKIP_BUILD=1 ./run.sh salta el build del frontend (más rápido)

set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8755}"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "▶ Compilando frontend..."
  (
    cd frontend
    [ -d node_modules ] || npm install
    npm run build
  )
fi

if [ ! -d backend/static/media/images ] || [ -z "$(ls -A backend/static/media/images 2>/dev/null)" ]; then
  echo "▶ Falta la media del catálogo, importándola (~130 MB, solo la primera vez)..."
  python3 scripts/import_catalog.py || echo "  aviso: falló la importación; la app funciona pero sin imágenes"
fi

echo "▶ Preparando backend..."
cd backend
if [ ! -d .venv ]; then
  python3 -m venv .venv 2>/dev/null || echo "  aviso: no se pudo crear venv, uso el Python del sistema"
fi
if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
python3 -m pip install -q -r requirements.txt

IP="$(python3 - <<'PY'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8", 80))
    print(s.getsockname()[0])
except OSError:
    print("127.0.0.1")
finally:
    s.close()
PY
)"

echo
echo "══════════════════════════════════════════════════"
echo "  Coach Fit listo 💪"
echo
echo "  En este equipo:   http://127.0.0.1:${PORT}"
echo "  Desde el móvil:   http://${IP}:${PORT}"
echo "                    (misma WiFi; permite el firewall si pregunta)"
echo "══════════════════════════════════════════════════"
echo

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
