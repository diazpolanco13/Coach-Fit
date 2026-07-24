from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import catalog, coach, db

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="Coach Fit", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/media", StaticFiles(directory=STATIC_DIR / "media"), name="media")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    db.seed_default_equipment()
    if db.load_week_plan() is None:
        db.save_week_plan(catalog.default_week())


class BodyMetricIn(BaseModel):
    date: str = Field(default_factory=lambda: date.today().isoformat())
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    notes: str | None = None


class RunIn(BaseModel):
    date: str = Field(default_factory=lambda: date.today().isoformat())
    distance_km: float
    duration_min: float | None = None
    pace_min_per_km: float | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None


class SetIn(BaseModel):
    exercise_id: str
    set_index: int = 1
    reps: int | None = None
    weight_kg: float | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    done: bool = True
    notes: str | None = None


class SessionIn(BaseModel):
    date: str = Field(default_factory=lambda: date.today().isoformat())
    focus: str | None = None
    completed: bool = True
    session_rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    sets: list[SetIn] = Field(default_factory=list)


class WeekPlanIn(BaseModel):
    name: str
    days: list[dict[str, Any]]


class CoachIn(BaseModel):
    notes: str | None = None


class UserEquipmentIn(BaseModel):
    name: str
    equipment_type: str
    weight_kg: float | None = None
    quantity: int = 1


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/catalog")
def get_catalog() -> dict[str, Any]:
    return {
        "equipment_profile": catalog.equipment_profile(),
        "exercises": catalog.exercises(),
    }


# NOTE: must be registered before /api/exercises/{exercise_id} or FastAPI
# matches "suggestions" as an exercise_id.
@app.get("/api/exercises/suggestions")
def suggest_exercises(muscle_group: str | None = None) -> dict[str, Any]:
    """Get exercise suggestions based on available equipment and optional muscle group."""
    equipment = db.list_user_equipment()
    equipment_types = {e["equipment_type"] for e in equipment}

    filtered = catalog.filter_exercises_by_equipment(list(equipment_types))

    if muscle_group:
        filtered = [
            e for e in filtered
            if e.get("target") == muscle_group or muscle_group in e.get("secondary_muscles", [])
        ]

    return {
        "equipment_available": sorted(equipment_types),
        "total_exercises": len(filtered),
        "exercises": filtered,
    }


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: str) -> dict[str, Any]:
    ex = catalog.exercise_map().get(exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    return ex


@app.get("/api/equipment")
def get_equipment() -> list[dict[str, Any]]:
    return db.list_user_equipment()


@app.post("/api/equipment")
def post_equipment(body: UserEquipmentIn) -> dict[str, Any]:
    return db.add_user_equipment(body.name, body.equipment_type, body.weight_kg, body.quantity)


@app.delete("/api/equipment/{equipment_id}")
def delete_equipment(equipment_id: int) -> dict[str, str]:
    db.delete_user_equipment(equipment_id)
    return {"status": "deleted"}


class ProgressionSuggestionIn(BaseModel):
    exercise_id: str
    reps: int
    weight_kg: float
    session_rpe: int


def _estimate_reps_at(weight: float, ref_weight: float, ref_reps: int) -> int:
    """Estimate reps achievable at `weight` given a reference set (Epley 1RM)."""
    if weight <= 0 or ref_weight <= 0 or ref_reps <= 0:
        return ref_reps
    one_rm = ref_weight * (1 + ref_reps / 30)
    reps = int(30 * (one_rm / weight - 1))
    return max(3, min(reps, 30))


@app.post("/api/progression-suggest")
def suggest_progression(body: ProgressionSuggestionIn) -> dict[str, Any]:
    """Suggest the next progression step based on RPE and the user's real equipment.

    For dumbbell work the next weight snaps to the discrete dumbbells the user
    owns (e.g. 7.5 → 12.5 → 20 kg) instead of a theoretical +2.5 kg that
    doesn't exist in their home gym.
    """
    ex = catalog.exercise_map().get(body.exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")

    weight = body.weight_kg
    reps = body.reps
    rpe = body.session_rpe

    is_dumbbell = ex.get("equipment") == "dumbbell"
    available = db.list_dumbbell_weights() if is_dumbbell else []
    heavier = [w for w in available if w > weight]
    lighter = [w for w in available if w < weight]

    next_weight = weight
    next_reps = reps
    recommendation = ""

    wants_increase = rpe <= 6
    wants_deload = rpe >= 9
    bodyweight_move = weight <= 0

    if bodyweight_move:
        if wants_deload:
            recommendation = "Muy exigente. Reduce 2-3 reps por serie o usa una variante asistida."
            next_reps = max(3, reps - 3)
        elif wants_increase:
            recommendation = "Te quedó fácil. Suma 2 reps por serie o pasa a una variante más difícil."
            next_reps = reps + 2
        else:
            recommendation = "Buen rango de esfuerzo. Suma 1 rep por serie hasta dominar el movimiento."
            next_reps = reps + 1
    elif wants_deload:
        if lighter:
            next_weight = max(lighter)
            next_reps = _estimate_reps_at(next_weight, weight, reps)
            recommendation = (
                f"Muy difícil (RPE {rpe}). Baja a tu mancuerna de {next_weight:g} kg "
                "en la próxima sesión y recupera técnica."
            )
        else:
            next_reps = max(3, reps - 2)
            recommendation = f"Muy difícil (RPE {rpe}). Mantén {weight:g} kg pero recorta 2 reps por serie."
    elif is_dumbbell and heavier and reps >= 15 and rpe <= 7:
        # 15+ clean reps: more reps stops building strength — time to jump
        # to the next dumbbell even if the % jump is big, and rebuild reps.
        next_weight = min(heavier)
        next_reps = max(_estimate_reps_at(next_weight, weight, reps), 5)
        recommendation = (
            f"Con {reps} reps limpias (RPE {rpe}) toca cambiar de estímulo: pasa a tu "
            f"mancuerna de {next_weight:g} kg y reconstruye desde ~{next_reps}-{next_reps + 3} reps."
        )
    elif wants_increase and is_dumbbell:
        if heavier:
            target = min(heavier)
            est = _estimate_reps_at(target, weight, reps)
            if est >= 6:
                next_weight = target
                next_reps = est
                recommendation = (
                    f"Te quedó fácil (RPE {rpe}). Pasa a tu mancuerna de {target:g} kg (~{est} reps)."
                )
            else:
                # The jump to the next dumbbell is still too big — keep building reps first.
                next_reps = reps + 2
                recommendation = (
                    f"Te quedó fácil (RPE {rpe}), pero el salto a {target:g} kg aún es grande "
                    f"(hoy rondarías ~{est} reps). Sigue con {weight:g} kg sumando reps "
                    f"(objetivo {next_reps}+) y prueba {target:g} kg cuando el RPE siga bajo."
                )
        else:
            next_reps = reps + 2
            recommendation = (
                f"Ya estás en tu mancuerna más pesada ({weight:g} kg). "
                "Progresa con más reps, tempo lento (3s bajada) o pausas."
            )
    elif wants_increase:
        next_weight = weight + 2.5
        recommendation = f"Te quedó fácil (RPE {rpe}). Sube a {next_weight:g} kg si tu material lo permite."
    elif rpe <= 8:
        next_reps = reps + 1
        recommendation = f"Esfuerzo ideal (RPE {rpe}). Mantén {weight:g} kg y busca +1 rep por serie."
    else:  # rpe == 8.5-ish edge, treated as hard but manageable
        next_reps = reps
        recommendation = f"Esfuerzo alto (RPE {rpe}). Repite {weight:g} kg × {reps} hasta que baje el RPE."

    return {
        "exercise_id": body.exercise_id,
        "exercise_name": ex.get("name_es"),
        "current": {"reps": reps, "weight_kg": weight, "rpe": rpe},
        "recommendation": recommendation,
        "next_weight_kg": next_weight,
        "next_reps": next_reps,
        "available_weights": available,
    }


@app.get("/api/week")
def get_week() -> dict[str, Any]:
    plan = db.load_week_plan() or catalog.default_week()
    start, end = db.week_bounds()
    load = db.compute_weekly_load(start, end)
    enriched = catalog.enrich_week(plan)
    # attach completion flags
    by_date = {s["date"]: s for s in load["sessions"]}
    # map weekday -> date for current week
    from datetime import datetime, timedelta

    start_d = datetime.fromisoformat(start).date()
    days_out = []
    for day in enriched["days"]:
        d = (start_d + timedelta(days=day["weekday"])).isoformat()
        sess = by_date.get(d)
        days_out.append(
            {
                **day,
                "date": d,
                "completed": bool(sess["completed"]) if sess else False,
                "session_rpe": sess.get("session_rpe") if sess else None,
                "volume_kg": sess.get("volume_kg") if sess else 0,
            }
        )
    return {"plan": {**enriched, "days": days_out}, "load": load}


@app.put("/api/week")
def put_week(body: WeekPlanIn) -> dict[str, Any]:
    saved = db.save_week_plan(body.model_dump())
    return catalog.enrich_week(saved)


@app.get("/api/sessions/{day}")
def get_session(day: str) -> dict[str, Any]:
    sess = db.get_session(day)
    if not sess:
        return {"date": day, "completed": False, "sets": []}
    return sess


@app.post("/api/sessions")
def post_session(body: SessionIn) -> dict[str, Any]:
    sess = db.upsert_session(
        body.date,
        focus=body.focus,
        completed=body.completed,
        session_rpe=body.session_rpe,
        notes=body.notes,
    )
    sets = db.replace_session_sets(sess["id"], [s.model_dump() for s in body.sets])
    out = db.get_session(body.date)
    assert out
    out["sets"] = sets
    return out


@app.post("/api/sessions/{day}/toggle")
def toggle_day(day: str, completed: bool = True) -> dict[str, Any]:
    return db.upsert_session(day, completed=completed)


@app.get("/api/metrics/body")
def get_body_metrics() -> list[dict[str, Any]]:
    return db.list_body_metrics()


@app.post("/api/metrics/body")
def post_body_metric(body: BodyMetricIn) -> dict[str, Any]:
    return db.add_body_metric(body.date, body.weight_kg, body.body_fat_pct, body.notes)


@app.get("/api/metrics/runs")
def get_runs() -> list[dict[str, Any]]:
    return db.list_runs()


@app.post("/api/metrics/runs")
def post_run(body: RunIn) -> dict[str, Any]:
    return db.add_run(
        body.date,
        body.distance_km,
        body.duration_min,
        body.pace_min_per_km,
        body.rpe,
        body.notes,
    )


@app.get("/api/load")
def get_load(week_start: str | None = None) -> dict[str, Any]:
    if week_start:
        from datetime import datetime, timedelta

        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        return db.compute_weekly_load(week_start, end)
    start, end = db.week_bounds()
    return db.compute_weekly_load(start, end)


@app.get("/api/coach/latest")
def coach_latest() -> dict[str, Any]:
    note = db.latest_coach_note()
    return note or {"advice": None}


@app.get("/api/dashboard/volume-by-muscle")
def dashboard_volume_by_muscle(week_start: str | None = None) -> dict[str, float]:
    """Get volume per muscle group for the week."""
    if week_start:
        from datetime import datetime, timedelta

        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        return db.get_volume_by_muscle(week_start, end)
    start, end = db.week_bounds()
    return db.get_volume_by_muscle(start, end)


@app.get("/api/dashboard/exercise-frequency")
def dashboard_exercise_frequency(week_start: str | None = None) -> dict[str, Any]:
    """Exercise frequency over the last 4 weeks (or a specific week if given).

    A single week reads "1x" for everything; a 4-week window is what
    actually distinguishes staples from one-offs.
    """
    from datetime import date, datetime, timedelta

    if week_start:
        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        freq = db.get_exercise_frequency(week_start, end)
    else:
        today = date.today()
        start = (today - timedelta(days=27)).isoformat()
        freq = db.get_exercise_frequency(start, today.isoformat())

    emap = catalog.exercise_map()
    return {
        "frequency": freq,
        "exercises": {eid: {"name": emap.get(eid, {}).get("name_es", eid)} for eid in freq.keys()},
    }


@app.get("/api/dashboard/exercise-history/{exercise_id}")
def dashboard_exercise_history(exercise_id: str) -> dict[str, Any]:
    """Get weight progression history for an exercise."""
    ex = catalog.exercise_map().get(exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    history = db.get_exercise_history(exercise_id)
    max_weight = db.get_exercise_max_weight(exercise_id)
    return {
        "exercise_id": exercise_id,
        "exercise_name": ex.get("name_es"),
        "max_weight": max_weight,
        "history": history,
    }


@app.get("/api/dashboard/muscle-coverage")
def muscle_coverage(days: int = 14) -> dict[str, Any]:
    """14-day (or custom window) per-muscle training coverage, for the Hoy tab."""
    from datetime import timedelta

    end = date.today()
    start = end - timedelta(days=days)
    stats = db.get_muscle_stats(start.isoformat(), end.isoformat())
    groups = [
        {
            "muscle": m,
            "sessions": s["sessions"],
            "volume_kg": round(s["volume_kg"], 1),
            "days_since_last": (end - date.fromisoformat(s["last_date"])).days if s["last_date"] else None,
            "pct": db.coverage_pct(s["sessions"], days),
        }
        for m, s in stats.items()
    ]
    return {"window_days": days, "groups": groups}


@app.get("/api/dashboard/muscle-trends")
def muscle_trends(days: int = 28) -> dict[str, Any]:
    """Per-muscle sessions/volume/trend% comparing this window to the prior
    one of equal length, plus a stale-group count ("grupos atrasados")."""
    from datetime import timedelta

    end = date.today()
    start = end - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    curr = db.get_muscle_stats(start.isoformat(), end.isoformat())
    prev = db.get_muscle_stats(prev_start.isoformat(), start.isoformat())
    groups = []
    for m, s in curr.items():
        p = prev.get(m, {"volume_kg": 0})
        trend: float | None = None
        if p["volume_kg"] > 0:
            trend = round((s["volume_kg"] - p["volume_kg"]) / p["volume_kg"] * 100, 1)
        elif s["volume_kg"] > 0:
            trend = 100.0
        groups.append(
            {
                "muscle": m,
                "sessions": s["sessions"],
                "volume_kg": round(s["volume_kg"], 1),
                "days_since_last": (end - date.fromisoformat(s["last_date"])).days if s["last_date"] else None,
                "trend_pct": trend,
            }
        )
    return {"window_days": days, "groups": groups, "stale_count": sum(1 for g in groups if g["sessions"] == 0)}


@app.get("/api/dashboard/prs")
def prs_this_month(month: str | None = None) -> dict[str, Any]:
    """Count of exercises that hit a new all-time-high weight this month."""
    from datetime import timedelta

    ref = date.fromisoformat(f"{month}-01") if month else date.today().replace(day=1)
    next_month = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_end = (next_month - timedelta(days=1)).isoformat()
    count = db.count_prs_this_month(ref.isoformat(), month_end)
    return {"month": ref.strftime("%Y-%m"), "pr_count": count}


@app.post("/api/coach/advise")
async def coach_advise(body: CoachIn | None = None) -> dict[str, Any]:
    notes = body.notes if body else None
    result = await coach.generate_advice(notes)
    # don't dump full catalog in response
    ctx = result["context"]
    return {
        "advice": result["advice"],
        "source": result["source"],
        "load": ctx["week_load"],
        "today": ctx["today"],
        "saved": result["saved"],
    }


# Serve the built frontend (frontend/dist) so a single uvicorn process is the
# whole app — handy for opening it from a phone on the same network.
# Mounted last so it never shadows the /api routes above.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="spa")
