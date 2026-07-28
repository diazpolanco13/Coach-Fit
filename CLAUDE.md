Ver [AGENTS.md](AGENTS.md) — el contexto del proyecto vive ahí, en un solo
archivo, para que sirva a cualquier asistente y no se desincronice.

Infra del host (Dokploy, Postgres, MinIO, secrets MCP): **no está en el repo**.
Vive en `/etc/coachfit/` (grupo `coachfit`). Los MCP se cargan desde
`.cursor/mcp.json` / `.mcp.json` + `scripts/mcp/`, sin atarse a una home de IA.
