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

## Probar desde el teléfono (misma WiFi)

La forma más simple: un solo servidor. Compila el frontend una vez y el
backend sirve la app completa (UI + API + imágenes) en un puerto:

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

3. Averigua la IP local de tu PC:
   - **Windows:** `ipconfig` → "Dirección IPv4" (ej. `192.168.1.34`)
   - **macOS:** `ipconfig getifaddr en0`
   - **Linux:** `hostname -I`

4. En el teléfono (conectado a la **misma WiFi**) abre:
   `http://<IP-de-tu-PC>:8755` — ej. `http://192.168.1.34:8755`

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

Variables opcionales:

- `COACH_VLLM_BASE` (default `http://127.0.0.1:8007/v1`)
- `COACH_VLLM_MODEL` (default `google/gemma-4-12B-it`)
