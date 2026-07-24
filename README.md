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

Variables opcionales:

- `COACH_VLLM_BASE` (default `http://127.0.0.1:8007/v1`)
- `COACH_VLLM_MODEL` (default `google/gemma-4-12B-it`)
