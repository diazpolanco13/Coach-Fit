from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "coach.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS body_metrics (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,
              weight_kg REAL,
              body_fat_pct REAL,
              notes TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,
              distance_km REAL NOT NULL,
              duration_min REAL,
              pace_min_per_km REAL,
              rpe INTEGER,
              notes TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL UNIQUE,
              focus TEXT,
              completed INTEGER NOT NULL DEFAULT 0,
              session_rpe INTEGER,
              notes TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS session_sets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
              exercise_id TEXT NOT NULL,
              set_index INTEGER NOT NULL,
              reps INTEGER,
              weight_kg REAL,
              rpe INTEGER,
              done INTEGER NOT NULL DEFAULT 1,
              notes TEXT
            );

            CREATE TABLE IF NOT EXISTS week_plan (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS coach_notes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              week_start TEXT NOT NULL,
              prompt_summary TEXT,
              advice TEXT NOT NULL,
              source TEXT NOT NULL
            );
            """
        )


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def upsert_session(
    day: str,
    *,
    focus: str | None = None,
    completed: bool | None = None,
    session_rpe: int | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE date = ?", (day,)).fetchone()
        ts = now_iso()
        if row is None:
            conn.execute(
                """
                INSERT INTO sessions (date, focus, completed, session_rpe, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    day,
                    focus,
                    1 if completed else 0,
                    session_rpe,
                    notes,
                    ts,
                    ts,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE sessions
                SET focus = COALESCE(?, focus),
                    completed = COALESCE(?, completed),
                    session_rpe = COALESCE(?, session_rpe),
                    notes = COALESCE(?, notes),
                    updated_at = ?
                WHERE date = ?
                """,
                (
                    focus,
                    None if completed is None else (1 if completed else 0),
                    session_rpe,
                    notes,
                    ts,
                    day,
                ),
            )
        return dict(conn.execute("SELECT * FROM sessions WHERE date = ?", (day,)).fetchone())


def replace_session_sets(session_id: int, sets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    with get_db() as conn:
        conn.execute("DELETE FROM session_sets WHERE session_id = ?", (session_id,))
        for s in sets:
            conn.execute(
                """
                INSERT INTO session_sets
                (session_id, exercise_id, set_index, reps, weight_kg, rpe, done, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    s["exercise_id"],
                    s["set_index"],
                    s.get("reps"),
                    s.get("weight_kg"),
                    s.get("rpe"),
                    1 if s.get("done", True) else 0,
                    s.get("notes"),
                ),
            )
        rows = conn.execute(
            "SELECT * FROM session_sets WHERE session_id = ? ORDER BY exercise_id, set_index",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_session(day: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE date = ?", (day,)).fetchone()
        if not row:
            return None
        sets = conn.execute(
            "SELECT * FROM session_sets WHERE session_id = ? ORDER BY exercise_id, set_index",
            (row["id"],),
        ).fetchall()
        out = dict(row)
        out["completed"] = bool(out["completed"])
        out["sets"] = [dict(s) | {"done": bool(s["done"])} for s in sets]
        return out


def list_sessions(start: str, end: str) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT s.*,
              COALESCE(SUM(ss.reps * COALESCE(ss.weight_kg, 0)), 0) AS volume_kg,
              COUNT(ss.id) AS set_count,
              AVG(ss.rpe) AS avg_set_rpe
            FROM sessions s
            LEFT JOIN session_sets ss ON ss.session_id = s.id AND ss.done = 1
            WHERE s.date BETWEEN ? AND ?
            GROUP BY s.id
            ORDER BY s.date
            """,
            (start, end),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["completed"] = bool(d["completed"])
            out.append(d)
        return out


def add_body_metric(
    day: str,
    weight_kg: float | None,
    body_fat_pct: float | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO body_metrics (date, weight_kg, body_fat_pct, notes, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (day, weight_kg, body_fat_pct, notes, now_iso()),
        )
        row = conn.execute("SELECT * FROM body_metrics WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_body_metrics(limit: int = 60) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM body_metrics ORDER BY date DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def add_run(
    day: str,
    distance_km: float,
    duration_min: float | None = None,
    pace_min_per_km: float | None = None,
    rpe: int | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    if pace_min_per_km is None and duration_min and distance_km:
        pace_min_per_km = duration_min / distance_km
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO runs (date, distance_km, duration_min, pace_min_per_km, rpe, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (day, distance_km, duration_min, pace_min_per_km, rpe, notes, now_iso()),
        )
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_runs(limit: int = 60) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM runs ORDER BY date DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def save_week_plan(payload: dict[str, Any]) -> dict[str, Any]:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO week_plan (id, payload, updated_at) VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            """,
            (json.dumps(payload, ensure_ascii=False), now_iso()),
        )
        return payload


def load_week_plan() -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT payload FROM week_plan WHERE id = 1").fetchone()
        if not row:
            return None
        return json.loads(row["payload"])


def save_coach_note(week_start: str, advice: str, source: str, prompt_summary: str = "") -> dict[str, Any]:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO coach_notes (created_at, week_start, prompt_summary, advice, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            (now_iso(), week_start, prompt_summary, advice, source),
        )
        row = conn.execute("SELECT * FROM coach_notes WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def latest_coach_note() -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM coach_notes ORDER BY id DESC LIMIT 1").fetchone()
        return dict(row) if row else None


def week_bounds(ref: date | None = None) -> tuple[str, str]:
    d = ref or date.today()
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return start.isoformat(), end.isoformat()


def compute_weekly_load(start: str, end: str) -> dict[str, Any]:
    sessions = list_sessions(start, end)
    with get_db() as conn:
        runs = conn.execute(
            "SELECT * FROM runs WHERE date BETWEEN ? AND ? ORDER BY date",
            (start, end),
        ).fetchall()
        weights = conn.execute(
            "SELECT * FROM body_metrics WHERE date BETWEEN ? AND ? ORDER BY date",
            (start, end),
        ).fetchall()

    completed = [s for s in sessions if s["completed"]]
    volume = sum(float(s["volume_kg"] or 0) for s in completed)
    set_count = sum(int(s["set_count"] or 0) for s in completed)
    rpes = [s["session_rpe"] for s in completed if s.get("session_rpe")]
    set_rpes = [s["avg_set_rpe"] for s in completed if s.get("avg_set_rpe")]
    run_km = sum(float(r["distance_km"] or 0) for r in runs)
    avg_session_rpe = sum(rpes) / len(rpes) if rpes else None
    avg_set_rpe = sum(set_rpes) / len(set_rpes) if set_rpes else None

    # Simple strain index: volume tonnage + run load + RPE factor
    rpe_factor = (avg_session_rpe or avg_set_rpe or 5) / 10
    strain = round((volume / 1000) + (run_km * 2) + (len(completed) * 3 * rpe_factor), 1)

    return {
        "week_start": start,
        "week_end": end,
        "training_days": len(completed),
        "planned_or_logged_days": len(sessions),
        "total_volume_kg": round(volume, 1),
        "total_sets": set_count,
        "avg_session_rpe": round(avg_session_rpe, 1) if avg_session_rpe else None,
        "avg_set_rpe": round(avg_set_rpe, 1) if avg_set_rpe else None,
        "run_distance_km": round(run_km, 2),
        "run_count": len(runs),
        "strain_index": strain,
        "body_weights": [dict(w) for w in weights],
        "sessions": sessions,
        "runs": [dict(r) for r in runs],
    }
