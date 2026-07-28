#!/usr/bin/env bash
# Launch Dokploy MCP with host secrets.
# shellcheck source=scripts/mcp/_env.sh
source "$(dirname "$0")/_env.sh"
exec npx -y "@dokploy/mcp@0.29.3"
