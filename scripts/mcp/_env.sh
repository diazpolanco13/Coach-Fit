# Shared loader for Coach Fit MCP launchers.
# Secrets live on the host (any agent user in group coachfit), not in the repo.
# shellcheck shell=bash
set -euo pipefail

ENV_FILE="${COACHFIT_MCP_ENV:-/etc/coachfit/mcp.env}"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "Coach Fit MCP: cannot read $ENV_FILE (need group coachfit)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export COACHFIT_ROOT="$ROOT"
