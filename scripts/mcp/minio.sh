#!/usr/bin/env bash
# Launch MinIO MCP with host secrets.
# shellcheck source=scripts/mcp/_env.sh
source "$(dirname "$0")/_env.sh"
exec npx -y "minio-mcp-server@0.1.0"
