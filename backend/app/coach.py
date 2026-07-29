from __future__ import annotations

import os
from typing import Any

import httpx

from . import catalog, db, gyms, plans

VLLM_BASE = os.getenv("COACH_VLLM_BASE", "http://127.0.0.1:8007/v1")
VLLM_MODEL = os.getenv("COACH_VLLM_MODEL", "google/gemma-4-12B-it")


# El espacio y su material se inyectan en cada peticion. Antes estaban clavados
# aqui («entrena en casa con 3 mancuernas...»), lo que con varios espacios es
# falso la mitad de las veces y ademas contradice el inventario que le llega al
# modelo en el prompt de usuario.
SYSTEM_TMPL = """Eres un coach de fuerza y acondicionamiento personal.
Hoy el usuario entrena en «{gym_name}» ({gym_kind}), con este material: {gym_equipment}.
No prescribas nada que necesite material fuera de esa lista.
Responde SIEMPRE en español, claro y accionable.
Usa las métricas (volumen, RPE, días entrenados, peso corporal, carreras) para proponer la semana.
No inventes ejercicios fuera del catálogo disponible.
Incluye: (1) foco de la semana, (2) plan día a día, (3) carga/esfuerzo objetivo, (4) señales de bajada de intensidad.
Sé concreto con series/reps/RPE cuando puedas.
Respeta las series y el rango de reps ya programados en el plan; si propones cambiarlos, dilo explícitamente."""


def _plan_lines(plan: dict[str, Any]) -> str:
    """Una linea por dia con series x rango de reps, para que el modelo no tenga
    que inventarse el volumen programado."""
    out = []
    for d in plan["days"]:
        if not d["items"]:
            out.append(f"- {d['label']}: descanso")
            continue
        ejercicios = ", ".join(
            f"{(i['exercise'] or {}).get('name_es') or i['exercise_id']} "
            f"{i['sets']}x{i['rep_min']}-{i['rep_max']}"
            for i in d["items"]
        )
        out.append(f"- {d['label']}: {ejercicios}")
    return "\n".join(out)


def _goal_line(goals: dict[str, Any]) -> str:
    base = goals["base"]
    prio = ", ".join(f"{o['muscle']} {o['min']}-{o['max']}" for o in goals["overrides"])
    return (
        f"Objetivo de volumen semanal: {base['min']}-{base['max']} series por músculo"
        + (f". Músculos priorizados: {prio}." if prio else ".")
    )


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


async def ask_llm(user_prompt: str, system: str) -> str | None:
    payload = {
        "model": VLLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
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


def build_context(gym_id: int | None = None) -> dict[str, Any]:
    start, end = db.week_bounds()
    load = db.compute_weekly_load(start, end)
    prev_start, prev_end = db.week_bounds()
    # previous week
    from datetime import timedelta

    today = db.today_local()
    prev_ref = today - timedelta(days=7)
    pstart, pend = db.week_bounds(prev_ref)
    prev_load = db.compute_weekly_load(pstart, pend)

    payload = db.load_active_plan() or plans.normalize_plan_payload(catalog.default_week())
    enriched = plans.enrich_plan(payload)
    today_wd = today.weekday()
    today_day = next((d for d in enriched["days"] if d["weekday"] == today_wd), None)

    recent_metrics = db.list_body_metrics(10)
    recent_runs = db.list_runs(10)

    # El espacio manda sobre el plan: si hoy entrenas en el parque, el coach no
    # puede prescribir polea aunque el plan sea de gimnasio.
    gid = db.resolve_gym_id(gym_id if gym_id is not None else payload.get("gym_id"))
    gym = db.get_gym(gid) if gid else None
    equipment = db.list_gym_equipment(gid) if gid else []
    prefs = db.list_exercise_prefs(gid) if gid else {}
    allowed = set(gyms.allowed_equipment(equipment))

    # El catalogo que se le pasa al modelo se filtra por espacio. Mandarle los
    # 1324 ejercicios enteros no solo es caro en tokens: es lo que le permite
    # proponer un jalon en polea a alguien que entrena en un parque.
    allowed_exercises = [
        e for e in catalog.exercises()
        if e["equipment"] in allowed and prefs.get(e["id"]) != gyms.STATE_HIDDEN
    ]
    favorites = [e["name_es"] for e in allowed_exercises if prefs.get(e["id"]) == gyms.STATE_FAVORITE]

    return {
        "week_load": load,
        "prev_week_load": prev_load,
        "plan": enriched,
        "today": today_day,
        "recent_body_metrics": recent_metrics,
        "recent_runs": recent_runs,
        "gym": gym,
        "equipment": equipment,
        "favorites": favorites,
        "catalog_names": [
            {"id": e["id"], "name_es": e["name_es"], "role": e["role"]}
            for e in allowed_exercises
        ],
    }


async def generate_advice(
    extra_notes: str | None = None, gym_id: int | None = None
) -> dict[str, Any]:
    ctx = build_context(gym_id)
    load = ctx["week_load"]
    today = ctx["today"]
    today_focus = today["label"] if today else None

    equip_summary = [
        {"nombre": e["name"], "tipo": e["equipment_type"], "kg": e["weight_kg"]}
        for e in ctx["equipment"]
    ]
    gym = ctx["gym"]
    system = SYSTEM_TMPL.format(
        gym_name=gym["name"] if gym else "sin espacio definido",
        gym_kind=gym["kind"] if gym else "—",
        gym_equipment=", ".join(e["nombre"] for e in equip_summary) or "solo peso corporal",
    )

    prompt = f"""Métricas semana actual ({load['week_start']} → {load['week_end']}):
- Días entrenados: {load['training_days']}
- Volumen total: {load['total_volume_kg']} kg
- Series: {load['total_sets']}
- RPE sesión medio: {load['avg_session_rpe']}
- RPE series medio: {load['avg_set_rpe']}
- Km carrera: {load['run_distance_km']} ({load['run_count']} tiradas)
- Strain index: {load['strain_index']}
- Sesiones: {[{'date': s['date'], 'focus': s.get('focus'), 'completed': s['completed'], 'rpe': s.get('session_rpe'), 'volume': s.get('volume_kg'), 'mood': s.get('mood'), 'health': s.get('health'), 'energy': s.get('energy'), 'pain': s.get('exercise_feedback') or {}} for s in load['sessions']]}

Semana previa strain={ctx['prev_week_load']['strain_index']}, días={ctx['prev_week_load']['training_days']}, volumen={ctx['prev_week_load']['total_volume_kg']}

Peso corporal reciente: {ctx['recent_body_metrics'][:5]}
Carreras recientes: {ctx['recent_runs'][:5]}

Equipamiento del espacio (usa SOLO estos pesos al prescribir cargas): {equip_summary}
Ejercicios favoritos de este espacio (priorízalos): {', '.join(ctx['favorites']) or 'ninguno marcado'}

Plan activo «{ctx['plan']['name']}» (series x reps por ejercicio):
{_plan_lines(ctx['plan'])}
{_goal_line(ctx['plan']['goals'])}
Objetivo del plan: {ctx['plan'].get('objective') or 'sin objetivo definido'}
Hoy: {today_focus}

Catálogo permitido en este espacio (id — nombre): {ctx['catalog_names']}

Notas del usuario: {extra_notes or 'ninguna'}

Dame la recomendación de qué hacer hoy y cómo ajustar el resto de la semana.
Si hay `pain` (sore/pain por zona en un ejercicio) o health=injured/pain, prioriza evitar o sustituir esos movimientos y bajar volumen en esas zonas."""

    llm = await ask_llm(prompt, system)
    if llm:
        note = db.save_coach_note(load["week_start"], llm, source="vllm", prompt_summary=extra_notes or "")
        return {"advice": llm, "source": "vllm", "context": ctx, "saved": note}

    advice = _rule_based_advice(load, today_focus)
    note = db.save_coach_note(load["week_start"], advice, source="rules", prompt_summary=extra_notes or "")
    return {"advice": advice, "source": "rules", "context": ctx, "saved": note}
