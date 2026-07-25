# Coach Fit — imagen unica: uvicorn sirve el SPA, la API y la media.
# main.py monta frontend/dist en "/" si existe, asi que un solo proceso basta.

# --- Etapa 1: build del frontend -----------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build

# Se copian solo los manifiestos primero para que npm ci quede cacheado
# mientras no cambien las dependencias.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# public/media es un symlink al backend que solo tiene sentido en desarrollo:
# apunta fuera del contexto y Vite fallaria al copiar public/. En produccion
# /media lo sirve FastAPI desde el volumen.
RUN rm -rf public/media
RUN npm run build

# --- Etapa 2: runtime ----------------------------------------------------
FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# psycopg[binary] trae libpq incluida, asi que no hace falta nada de apt.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
COPY --from=frontend /build/dist frontend/dist

# main.py monta /media solo si backend/static existe, y StaticFiles revienta si
# el subdirectorio falta. El volumen se monta encima de media/ en runtime.
RUN mkdir -p backend/static/media/images backend/static/media/videos

EXPOSE 8755

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8755/api/health', timeout=4).status == 200 else 1)"

# --app-dir pone backend/ en sys.path, de modo que app.main resuelve a
# /app/backend/app/main.py y las rutas relativas del codigo siguen valiendo.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8755", "--app-dir", "backend"]
