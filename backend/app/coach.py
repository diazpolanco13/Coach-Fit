from __future__ import annotations

import os
from typing import Any

import httpx

from . import catalog, db

VLLM_BASE = os.getenv("COACH_VLLM_BASE", "http://127.0.0.1:8007/v1")
VLLM_MODEL = os.getenv("COACH_VLLM_MODEL", "google/gemma-4-12B-it")


SYSTEM = """Eres un coach de fuerza y acondicionamiento personal.
El usuario entrena en casa con: 3 mancuernas, banco, barra de dominadas, ligas de resistencia y rueda abdominal.
Responde SIEMPRE en español, claro y accionable.
Usa las métricas (volumen, RPE, días entrenados, peso corporal, carreras) para proponer la semana.
No inventes ejercicios fuera del catálogo disponible.
Incluye: (1) foco de la semana, (2) plan día a día, (3) carga/esfuerzo objetivo, (4) señales de bajada de intensidad.
Sé concreto con series/reps/RPE cuando puedas."""


def _rule_based_advice(load: dict[str, Any], today_focus: str | None) -> str:
    days = load["training_days"]
    strain = load["strain_index"]
    rpe = load["avg_session_rpe"] or load["avg_set_rpe"]
    volume = load["total_volume_kg"]
    runs = load["run_distance_km"]

    lines = [
        "## Propuesta del coach (modo local)",
        "",
        f"**Carga semanal actual:** {days} días · {volume:.0f} kg volumen · "
        f"RPE medio {rpe if rpe is not None else '—'} · "
        f"{runs:.1f} km carrera · índice de strain {strain}.",
        "",
    ]

    if days == 0:
        lines += [
            "### Foco",
            "Arranca la semana con consistencia, no con volumen alto.",
            "",
            "### Plan sugerido",
            "- **Lunes:** Empuje (press banca mancuernas, hombro, fondos, tríceps) 3×8–12 @ RPE 6–7",
            "- **Martes:** Tirón (dominadas o asistidas, remo, curls) 3×6–10 @ RPE 6–7",
            "- **Jueves:** Piernas (goblet squat, zancadas, RDL, puentes) 3×8–12 @ RPE 6–7",
            "- **Viernes:** Full + core (flexiones, remo invertido, rueda abdominal)",
            "- **Miércoles/Domingo:** descanso o trote suave 20–30 min",
            "",
            "### Esfuerzo",
            "Mantén RPE de sesión ≤ 7 esta primera semana. Termina con 1–2 reps en reserva.",
        ]
    elif strain >= 25 or (rpe is not None and rpe >= 8.5):
        lines += [
            "### Foco",
            "Tu strain/RPE está alto. Prioriza recuperación activa y técnica.",
            "",
            "### Ajustes",
            "- Baja un 20–30% el volumen (quita 1 serie por ejercicio).",
            "- Sustituye dominadas estrictas por asistidas con liga si el tirón falla.",
            "- Core: rueda asistida o plancha en vez de rollerout de pie.",
            "- Carrera: máximo 1 rodaje fácil; no intervals.",
            "",
            "### Objetivo de esfuerzo",
            "RPE de sesión 5–6. Si duermes mal o el peso corporal sube por inflamación, toma un día off extra.",
        ]
    elif days <= 2:
        lines += [
            "### Foco",
            "Poca frecuencia esta semana: recupera el ritmo con sesiones cortas y completas.",
            "",
            "### Plan",
            "- Haz al menos 3 estímulos: Empuje / Tirón / Piernas.",
            "- Si solo tienes 2 días: Full-body A (empuje+pierna) y Full-body B (tirón+core).",
            "- Marca el día entrenado aunque sea sesión corta (30–40 min).",
            "",
            "### Carga",
            "Sube peso solo si completas todas las series con RPE ≤ 7.",
        ]
    else:
        lines += [
            "### Foco",
            "Buen ritmo. Progresión lineal suave en los básicos.",
            "",
            "### Progresión",
            "- Press banca / goblet squat / remo: +1–2 reps o +1–2.5 kg si RPE ≤ 7.",
            "- Dominadas: suma 1 rep total o baja asistencia de liga.",
            "- Rueda abdominal: 2–3×6–10 controladas; para si la lumbar toma protagonismo.",
            "",
            "### Esfuerzo objetivo",
            f"Mantén RPE de sesión entre 6 y 8. Strain actual {strain}: "
            + ("puedes empujar un poco más en el día fuerte." if strain < 18 else "no acumules otro día duro."),
        ]

    if today_focus:
        lines += ["", f"### Hoy", f"Enfoque del día: **{today_focus}**. Calienta 5 min + 1 serie suave del primer ejercicio."]

    weights = load.get("body_weights") or []
    if len(weights) >= 2:
        try:
            delta = float(weights[-1]["weight_kg"]) - float(weights[0]["weight_kg"])
            lines += [
                "",
                "### Peso corporal",
                f"Cambio en la ventana: {delta:+.1f} kg. "
                + ("Si buscas perder grasa, prioriza déficit y no subas volume agresivo." if delta > 0.3
                   else "Tendencia estable/bajando: puedes progresar fuerza con normalidad."),
            ]
        except (TypeError, ValueError, KeyError):
            pass

    lines += [
        "",
        "_Modelo LLM no disponible o en reinicio; esta guía usa reglas sobre tus métricas._",
    ]
    return "\n".join(lines)


async def ask_llm(user_prompt: str) -> str | None:
    payload = {
        "model": VLLM_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 1400,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(f"{VLLM_BASE}/chat/completions", json=payload)
            if r.status_code >= 400:
                return None
            data = r.json()
            return data["choices"][0]["message"]["content"]
    except Exception:
        return None


def build_context() -> dict[str, Any]:
    start, end = db.week_bounds()
    load = db.compute_weekly_load(start, end)
    prev_start, prev_end = db.week_bounds()
    # previous week
    from datetime import date, timedelta

    today = date.today()
    prev_ref = today - timedelta(days=7)
    pstart, pend = db.week_bounds(prev_ref)
    prev_load = db.compute_weekly_load(pstart, pend)

    plan = db.load_week_plan() or catalog.default_week()
    enriched = catalog.enrich_week(plan)
    today_wd = today.weekday()
    today_day = next((d for d in enriched["days"] if d["weekday"] == today_wd), None)

    recent_metrics = db.list_body_metrics(10)
    recent_runs = db.list_runs(10)
    return {
        "week_load": load,
        "prev_week_load": prev_load,
        "plan": enriched,
        "today": today_day,
        "recent_body_metrics": recent_metrics,
        "recent_runs": recent_runs,
        "equipment": catalog.equipment_profile(),
        "catalog_names": [
            {"id": e["id"], "name_es": e["name_es"], "role": e["role"]}
            for e in catalog.exercises()
        ],
    }


async def generate_advice(extra_notes: str | None = None) -> dict[str, Any]:
    ctx = build_context()
    load = ctx["week_load"]
    today = ctx["today"]
    today_focus = today["label"] if today else None

    prompt = f"""Métricas semana actual ({load['week_start']} → {load['week_end']}):
- Días entrenados: {load['training_days']}
- Volumen total: {load['total_volume_kg']} kg
- Series: {load['total_sets']}
- RPE sesión medio: {load['avg_session_rpe']}
- RPE series medio: {load['avg_set_rpe']}
- Km carrera: {load['run_distance_km']} ({load['run_count']} tiradas)
- Strain index: {load['strain_index']}
- Sesiones: {[{'date': s['date'], 'focus': s.get('focus'), 'completed': s['completed'], 'rpe': s.get('session_rpe'), 'volume': s.get('volume_kg')} for s in load['sessions']]}

Semana previa strain={ctx['prev_week_load']['strain_index']}, días={ctx['prev_week_load']['training_days']}, volumen={ctx['prev_week_load']['total_volume_kg']}

Peso corporal reciente: {ctx['recent_body_metrics'][:5]}
Carreras recientes: {ctx['recent_runs'][:5]}

Plan semanal actual: {[{'label': d['label'], 'ids': d.get('exercise_ids')} for d in ctx['plan']['days']]}
Hoy: {today_focus}

Catálogo permitido (id — nombre): {ctx['catalog_names']}

Notas del usuario: {extra_notes or 'ninguna'}

Dame la recomendación de qué hacer hoy y cómo ajustar el resto de la semana."""

    llm = await ask_llm(prompt)
    if llm:
        note = db.save_coach_note(load["week_start"], llm, source="vllm", prompt_summary=extra_notes or "")
        return {"advice": llm, "source": "vllm", "context": ctx, "saved": note}

    advice = _rule_based_advice(load, today_focus)
    note = db.save_coach_note(load["week_start"], advice, source="rules", prompt_summary=extra_notes or "")
    return {"advice": advice, "source": "rules", "context": ctx, "saved": note}
