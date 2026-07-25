Ver [AGENTS.md](AGENTS.md) — el contexto del proyecto vive ahí, en un solo
archivo, para que sirva a cualquier asistente y no se desincronice.

El contexto de la infraestructura donde esto corre (Dokploy, Postgres, MinIO,
backups, credenciales) **no está en este repo**: es público. Vive en
`~/.claude/CLAUDE.md` de la máquina de despliegue.
