#!/usr/bin/env bash
# Launch official GitHub MCP (Docker) with host secrets.
# shellcheck source=scripts/mcp/_env.sh
source "$(dirname "$0")/_env.sh"
if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "Coach Fit MCP: GITHUB_PERSONAL_ACCESS_TOKEN missing in $ENV_FILE" >&2
  exit 1
fi
exec docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN \
  ghcr.io/github/github-mcp-server
