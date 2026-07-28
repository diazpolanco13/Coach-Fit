#!/usr/bin/env bash
# Coach Fit — reinicio limpio del desarrollo local (loopback).
#
#   ./scripts/start.sh           mata lo que haya en :8755/:5188 y levanta de nuevo
#   ./scripts/start.sh --stop    solo para backend + frontend
#
# UI:      http://127.0.0.1:5188
# API:     http://127.0.0.1:8755/api/health
# Dokploy: http://localhost:3000  (o DOKPLOY_URL en /etc/coachfit/mcp.env)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="127.0.0.1"
BACKEND_PORT=8755
FRONTEND_PORT=5188
MCP_ENV="${COACHFIT_MCP_ENV:-/etc/coachfit/mcp.env}"
DOKPLOY_URL="http://localhost:3000"
DOKPLOY_SERVICE="${DOKPLOY_SERVICE:-dokploy}"
LOG_DIR="$ROOT/.dev"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACK_PID=""
FRONT_PID=""

log() { printf '▶ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

pids_on_port() {
  local port="$1"
  ss -H -ltnp "sport = :${port}" 2>/dev/null \
    | grep -oP 'pid=\K[0-9]+' \
    | sort -u \
    || true
}

stop_port() {
  local port="$1"
  local pids
  pids="$(pids_on_port "$port")"
  [[ -z "$pids" ]] && return 0

  log "Parando puerto ${port} (pid: ${pids//$'\n'/ })"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pids="$(pids_on_port "$port")"
    [[ -z "$pids" ]] && return 0
    sleep 0.2
  done

  pids="$(pids_on_port "$port")"
  if [[ -n "$pids" ]]; then
    warn "Force kill puerto ${port}: ${pids//$'\n'/ }"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

stop_project_orphans() {
  # Workers de --reload / vite que a veces quedan sin el listener.
  pkill -f "${ROOT}/backend/.venv/bin/.*uvicorn app.main:app" 2>/dev/null || true
  pkill -f "${ROOT}/frontend/node_modules/.bin/vite" 2>/dev/null || true
  pkill -f "vite --host ${HOST} --port ${FRONTEND_PORT}" 2>/dev/null || true
}

stop_all() {
  stop_port "$BACKEND_PORT"
  stop_port "$FRONTEND_PORT"
  stop_project_orphans
  sleep 0.3
  stop_port "$BACKEND_PORT"
  stop_port "$FRONTEND_PORT"
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  log "Apagando desarrollo local..."
  [[ -n "${FRONT_PID}" ]] && kill "$FRONT_PID" 2>/dev/null || true
  [[ -n "${BACK_PID}" ]] && kill "$BACK_PID" 2>/dev/null || true
  stop_all
  exit "$code"
}

wait_http() {
  local url="$1" label="$2" tries="${3:-40}"
  local i
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS --connect-timeout 1 --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  die "${label} no respondió en ${url} (ver ${LOG_DIR}/)"
}

ensure_postgres() {
  if timeout 1 bash -c "echo >/dev/tcp/${HOST}/5432" 2>/dev/null; then
    return 0
  fi

  warn "Postgres no responde en ${HOST}:5432 — intento levantar coachfit-pg-dev-fwd"
  if sudo -n docker start coachfit-pg-dev-fwd >/dev/null 2>&1; then
    sleep 1
    if timeout 1 bash -c "echo >/dev/tcp/${HOST}/5432" 2>/dev/null; then
      log "Forward Postgres listo"
      return 0
    fi
  fi

  die "Sin Postgres en ${HOST}:5432. Necesitás coachfit-pg-dev-fwd o una instancia local (ver README)."
}

load_dokploy_url() {
  if [[ -r "$MCP_ENV" ]]; then
    local from_env
    from_env="$(grep -E '^DOKPLOY_URL=' "$MCP_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    [[ -n "$from_env" ]] && DOKPLOY_URL="$from_env"
  fi
}

ensure_dokploy() {
  load_dokploy_url

  if curl -fsS --connect-timeout 1 --max-time 2 "$DOKPLOY_URL" >/dev/null 2>&1; then
    log "Dokploy → ${DOKPLOY_URL}"
    return 0
  fi

  warn "Dokploy no responde en ${DOKPLOY_URL} — intento levantar servicio ${DOKPLOY_SERVICE}"
  if docker service scale "${DOKPLOY_SERVICE}=1" >/dev/null 2>&1; then
    local i
    for ((i = 1; i <= 40; i++)); do
      if curl -fsS --connect-timeout 1 --max-time 2 "$DOKPLOY_URL" >/dev/null 2>&1; then
        log "Dokploy → ${DOKPLOY_URL}"
        return 0
      fi
      sleep 0.25
    done
  fi

  warn "Dokploy sigue caído (${DOKPLOY_URL}) — el desarrollo local sigue igual"
}

ensure_deps() {
  [[ -f "$ROOT/backend/.env" ]] || die "Falta backend/.env con DATABASE_URL"
  grep -qE '^DATABASE_URL=' "$ROOT/backend/.env" || die "backend/.env no define DATABASE_URL"

  [[ -x "$ROOT/backend/.venv/bin/python" ]] || die "Falta backend/.venv — creá el venv e instalá requirements.txt"
  "$ROOT/backend/.venv/bin/python" -c "import uvicorn" 2>/dev/null \
    || die "backend/.venv sin uvicorn — pip install -r backend/requirements.txt"
  [[ -d "$ROOT/frontend/node_modules" ]] || {
    log "Instalando dependencias del frontend..."
    (cd "$ROOT/frontend" && npm install)
  }
}

start_backend() {
  log "Backend → http://${HOST}:${BACKEND_PORT}"
  (
    cd "$ROOT/backend"
    # Ruta absoluta: evita shebangs/VIRTUAL_ENV rotos si el venv se movió.
    exec "$ROOT/backend/.venv/bin/python" -m uvicorn app.main:app \
      --host "$HOST" \
      --port "$BACKEND_PORT" \
      --reload \
      --reload-dir app
  ) >"$BACKEND_LOG" 2>&1 &
  BACK_PID=$!
}

start_frontend() {
  log "Frontend → http://${HOST}:${FRONTEND_PORT}"
  (
    cd "$ROOT/frontend"
    # Override host del vite.config (0.0.0.0) para quedar solo en loopback.
    exec npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" --strictPort
  ) >"$FRONTEND_LOG" 2>&1 &
  FRONT_PID=$!
}

main() {
  mkdir -p "$LOG_DIR"

  if [[ "${1:-}" == "--stop" ]]; then
    stop_all
    log "Desarrollo local detenido"
    exit 0
  fi

  ensure_deps
  ensure_postgres
  ensure_dokploy

  log "Reinicio limpio..."
  stop_all

  trap cleanup EXIT INT TERM

  start_backend
  start_frontend

  wait_http "http://${HOST}:${BACKEND_PORT}/api/health" "Backend"
  wait_http "http://${HOST}:${FRONTEND_PORT}/" "Frontend"

  cat <<EOF

══════════════════════════════════════════════════
  Coach Fit — desarrollo local

  UI:      http://${HOST}:${FRONTEND_PORT}
  API:     http://${HOST}:${BACKEND_PORT}/api/health
  Dokploy: ${DOKPLOY_URL}

  Logs: ${BACKEND_LOG}
        ${FRONTEND_LOG}
  Stop: ./scripts/start.sh --stop   (o Ctrl+C)
══════════════════════════════════════════════════

EOF

  # Vigilar por puerto: con --reload / npm los PIDs de $! no son estables.
  while [[ -n "$(pids_on_port "$BACKEND_PORT")" && -n "$(pids_on_port "$FRONTEND_PORT")" ]]; do
    sleep 1
  done
  die "Un proceso de desarrollo se cayó — revisá los logs en ${LOG_DIR}/"
}

main "$@"
