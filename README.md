# Coach Fit

App personal de entrenamiento en casa (mancuernas, banco, dominadas, ligas, rueda abdominal).

## Qué incluye

- Catálogo curado (~41 ejercicios) con GIF/imagen y guía paso a paso
- Rutina semanal PPL + core
- Registro de sesión (series, peso, reps, RPE) y marcado de días
- Métricas de peso corporal y carreras
- Carga semanal (volumen, RPE, km, strain)
- Coach IA vía vLLM local (`:8007`, Gemma 4) con fallback por reglas

## Arranque

Los datos viven en Postgres, así que el backend necesita `DATABASE_URL` antes
de arrancar. Sin ella falla con un `RuntimeError` explícito. Se puede exportar
en el entorno o dejarla en `backend/.env` (no se versiona):

```bash
# backend/.env
DATABASE_URL=postgresql://usuario:clave@127.0.0.1:5432/coachfit
```

Para levantar una Postgres local rápida:

```bash
docker run -d --name coachfit-pg -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=coachfit -e POSTGRES_PASSWORD=coachfit -e POSTGRES_DB=coachfit \
  postgres:18
```

El esquema se crea solo al arrancar (`init_db()`), junto con el equipo por
defecto y el plan semanal.

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8755 --reload

# Frontend (otra terminal)
cd frontend
npm run dev
```

- UI: http://127.0.0.1:5188
- API: http://127.0.0.1:8755/api/health

## Despliegue

Hay un `Dockerfile` multi-stage: compila el frontend con Vite y la imagen
final sirve el SPA, la API y la media desde un solo uvicorn. La media del
catálogo (~137 MB) no va en la imagen — se monta como volumen y se puebla una
vez con `python scripts/import_catalog.py` dentro del contenedor.

```bash
docker build -t coachfit .
docker run -d -p 8755:8755 -e DATABASE_URL=... coachfit
```

## Probar desde el teléfono (misma WiFi)

Un solo comando — compila el frontend, prepara el backend y sirve la app
completa (UI + API + imágenes) en un puerto, imprimiendo la URL para el
móvil con tu IP ya resuelta:

```bash
./run.sh
```

```
══════════════════════════════════════════════════
  Coach Fit listo 💪

  En este equipo:   http://127.0.0.1:8755
  Desde el móvil:   http://192.168.1.34:8755
══════════════════════════════════════════════════
```

Abre esa URL en el teléfono (conectado a la **misma WiFi**). Variantes:
`PORT=9000 ./run.sh` cambia el puerto; `SKIP_BUILD=1 ./run.sh` salta el
build si no tocaste el frontend. En Windows úsalo desde WSL o Git Bash.

<details>
<summary>Pasos manuales (equivalen al script)</summary>

```bash
# 1. Compilar el frontend (solo tras cambiar código del frontend)
cd frontend
npm install        # solo la primera vez
npm run build

# 2. Levantar todo en un puerto
cd ../backend
python -m venv .venv && source .venv/bin/activate   # solo la primera vez
pip install -r requirements.txt                      # solo la primera vez
uvicorn app.main:app --host 0.0.0.0 --port 8755
```

Averigua la IP local de tu PC y abre `http://<IP>:8755` en el móvil:

- **Windows:** `ipconfig` → "Dirección IPv4" (ej. `192.168.1.34`)
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I`

</details>

Notas:
- Si Windows pregunta por el firewall al arrancar uvicorn, acepta
  "Permitir acceso" en redes privadas. Si no carga desde el móvil, el
  firewall es el sospechoso número uno.
- En el móvil puedes usar "Añadir a pantalla de inicio" para tenerla
  como una app.
- Para desarrollo con recarga en vivo sigue valiendo el modo de dos
  terminales de arriba: el teléfono entra por `http://<IP>:5188`.

### Fuera de casa (opcional)

Con [cloudflared](https://developers.cloudflare.com/cloudflare-tunnel/)
puedes exponerla temporalmente sin abrir puertos:

```bash
cloudflared tunnel --url http://127.0.0.1:8755
```

Te da una URL `https://….trycloudflare.com` accesible desde cualquier
red. Es pública mientras el túnel esté abierto: úsala puntualmente.

Variables:

- `DATABASE_URL` — **requerida**, cadena de conexión a Postgres
- `COACH_VLLM_BASE` (default `http://127.0.0.1:8007/v1`)
- `COACH_VLLM_MODEL` (default `google/gemma-4-12B-it`)
