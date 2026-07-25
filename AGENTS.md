# Coach Fit — contexto para agentes

App personal de entrenamiento en casa. Un solo usuario, sin multi-tenancy.

## Grafo de conocimiento

Este proyecto tiene un grafo de graphify en `graphify-out/`.

- Antes de responder preguntas de arquitectura o de "quién llama a qué", leé
  `graphify-out/GRAPH_REPORT.md` (god nodes y comunidades) o consultá el
  servidor MCP `graphify-coachfit` si está disponible.
- Después de modificar código, corré `graphify update .` para mantenerlo al
  día. Es extracción AST pura: sin LLM y sin coste de API, tarda ~4 segundos.
- `graphify-out/` está gitignoreado a propósito: es artefacto generado.

## Arquitectura

```
backend/app/main.py      FastAPI: ~30 endpoints /api/*, monta /media y el SPA
backend/app/db.py        TODO el acceso a datos (psycopg3 + pool). Único punto
                         de contacto con la base.
backend/app/catalog.py   Catálogo de ejercicios (JSON, cacheado con @lru_cache)
backend/app/coach.py     Coach IA vía vLLM, con fallback por reglas
frontend/src/            React 19 + Vite + Tailwind 4
scripts/import_catalog.py  Descarga catálogo y media de terceros (~137 MB)
```

`db.py` es la abstracción que aísla la persistencia: `main.py` solo hace
`from . import db`. **Si vas a tocar la base, se toca ahí y en ningún otro lado.**

## Arranque

Los datos viven en **Postgres**. `DATABASE_URL` es obligatoria — sin ella el
backend falla al arrancar con un `RuntimeError` explícito. Se lee del entorno
o de `backend/.env` (gitignoreado); el entorno tiene prioridad.

Ver el README para el `docker run` de una Postgres local. El esquema se crea
solo al arrancar (`init_db()`), junto con el equipo por defecto y el plan semanal.

## Trampas conocidas de Postgres

Estas ya están resueltas en `db.py`. **No las reintroduzcas** al escribir
consultas nuevas:

- **`AVG()` sobre una columna entera devuelve `Decimal`**, no `float`. Mezclarlo
  con floats lanza `TypeError`. Por eso las agregaciones llevan
  `CAST(... AS DOUBLE PRECISION)`. `SUM()` no tiene el problema porque las
  columnas de peso son `DOUBLE PRECISION`.
- **Postgres no admite alias del `SELECT` dentro de `HAVING`** (sqlite sí). En
  `count_prs_this_month` la condición repite la expresión agregada completa.
- Los `COALESCE` con parámetros que pueden ser `NULL` llevan cast explícito
  (`%s::text`, `%s::integer`) para que Postgres pueda inferir el tipo.
- Los `INSERT` usan `RETURNING *`; no hay `lastrowid` en psycopg.

## Esquema y migraciones

**No hay sistema de migraciones.** `init_db()` usa `CREATE TABLE IF NOT EXISTS`:
crea tablas nuevas pero **no altera las existentes**. Si agregás una columna, el
despliegue va a pasar en verde y la app va a fallar en runtime. Cuando haga
falta, hay que introducir Alembic o un `ALTER` manual deliberado.

## Despliegue

`Dockerfile` multi-stage: Vite compila el frontend y la imagen final sirve SPA,
API y media desde un solo uvicorn. La media del catálogo **no va en la imagen**
— es contenido estático de terceros que se monta como volumen y se puebla una
vez con `python scripts/import_catalog.py` dentro del contenedor.

El despliegue es push-to-deploy: un push a `main` dispara build y reemplazo del
servicio.

## Seguridad — estado actual

**La aplicación no tiene autenticación propia.** Ningún endpoint `/api/*` la
pide, incluidos los `POST`, `PUT` y `DELETE`. En producción está cubierta por
Basic Auth en el reverse proxy, no por la app.

Si alguna vez se expone sin esa capa, cualquiera puede leer y borrar datos.
Antes de agregar usuarios reales o exponerla más ampliamente, esto hay que
resolverlo en la aplicación.

El CORS está en `allow_origins=["*"]` con `allow_credentials=False`. Esa
combinación es válida; la anterior (`credentials=True` con comodín) violaba la
spec y el navegador la rechazaba.
