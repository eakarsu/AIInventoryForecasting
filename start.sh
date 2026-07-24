#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$PROJECT_DIR/.env" ]] || { echo "Create .env from .env.example." >&2; exit 1; }
set -a
# shellcheck disable=SC1091
source "$PROJECT_DIR/.env"
set +a
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
JWT_SECRET_VALUE="${JWT_SECRET:-}"
VITE_API_TARGET="${VITE_API_TARGET:-http://127.0.0.1:$BACKEND_PORT}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://127.0.0.1:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT}"
export BACKEND_PORT FRONTEND_PORT VITE_API_TARGET ALLOWED_ORIGINS

if [[ ! -d "$PROJECT_DIR/backend/node_modules" || ! -d "$PROJECT_DIR/frontend/node_modules" ]]; then
  echo "Dependencies are absent. Run ./scripts/bootstrap.sh explicitly." >&2
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" && ( -z "${POSTGRES_HOST:-}" || -z "${POSTGRES_DB:-}" || -z "${POSTGRES_USER:-}" || -z "${POSTGRES_PASSWORD:-}" ) ]]; then
  echo "Set DATABASE_URL or POSTGRES_HOST/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD." >&2
  exit 1
fi
if [[ "${#JWT_SECRET_VALUE}" -lt 32 ]]; then
  echo "JWT_SECRET must contain at least 32 characters." >&2
  exit 1
fi
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is occupied; no process was terminated." >&2
    exit 1
  fi
done

if [[ "${ALLOW_SCHEMA_MIGRATION:-false}" == "true" ]]; then
  : "${DATABASE_URL:?DATABASE_URL is required for migrations}"
  for migration in "$PROJECT_DIR"/backend/src/db/migrations/*.sql; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  done
  node "$PROJECT_DIR/backend/create-admin.js"
fi

(cd "$PROJECT_DIR/backend" && BACKEND_PORT="$BACKEND_PORT" npm start) &
backend_pid=$!
(cd "$PROJECT_DIR/frontend" && npm run dev -- --host "${HOST:-127.0.0.1}" --port "$FRONTEND_PORT" --strictPort) &
frontend_pid=$!
cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
