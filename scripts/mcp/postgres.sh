#!/usr/bin/env bash
# Launch read-only Postgres MCP with host secrets.
# shellcheck source=scripts/mcp/_env.sh
source "$(dirname "$0")/_env.sh"
if [[ -z "${COACHFIT_DATABASE_URL:-}" ]]; then
  echo "Coach Fit MCP: COACHFIT_DATABASE_URL missing in env file" >&2
  exit 1
fi
exec npx -y pg-ro-mcp --database-url "$COACHFIT_DATABASE_URL"
