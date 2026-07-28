#!/usr/bin/env bash
# Serve this project's graphify knowledge graph over MCP.
# shellcheck source=scripts/mcp/_env.sh
source "$(dirname "$0")/_env.sh"
GRAPH="${COACHFIT_ROOT}/graphify-out/graph.json"
if [[ ! -f "$GRAPH" ]]; then
  echo "Coach Fit MCP: missing $GRAPH — run: graphify update ." >&2
  exit 1
fi
exec graphify-mcp "$GRAPH"
