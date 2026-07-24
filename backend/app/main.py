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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/catalog")
def get_catalog() -> dict[str, Any]:
    return {
        "equipment_profile": catalog.equipment_profile(),
        "exercises": catalog.exercises(),
    }


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: str) -> dict[str, Any]:
    ex = catalog.exercise_map().get(exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    return ex


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
