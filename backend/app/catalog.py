from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalog.json"


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def exercises() -> list[dict[str, Any]]:
    return load_catalog()["exercises"]


def exercise_map() -> dict[str, dict[str, Any]]:
    return {e["id"]: e for e in exercises()}


def default_week() -> dict[str, Any]:
    return load_catalog()["default_week"]


def equipment_profile() -> dict[str, Any]:
    return load_catalog()["equipment_profile"]


def enrich_week(plan: dict[str, Any]) -> dict[str, Any]:
    emap = exercise_map()
    days = []
    for day in plan.get("days", []):
        items = []
        for eid in day.get("exercise_ids", []):
            ex = emap.get(eid)
            if ex:
                items.append(ex)
        days.append({**day, "exercises": items})
    return {**plan, "days": days}


# Maps a user equipment_type to the catalog `equipment` strings it unlocks.
EQUIPMENT_UNLOCKS = {
    "dumbbell": ["dumbbell"],
    "band": ["band"],
    "wheel": ["wheel roller"],
    "pull_up_bar": ["assisted"],  # hanging work needs the bar
}


def filter_exercises_by_equipment(available_equipment: list[str]) -> list[dict[str, Any]]:
    """Filter exercises doable with the given equipment types.

    Body-weight moves are always available (it's a home-training app).
    """
    available_set = {"body weight"}
    for eq in available_equipment:
        available_set.update(EQUIPMENT_UNLOCKS.get(eq, []))

    return [ex for ex in exercises() if ex["equipment"] in available_set]


def get_exercise_muscle_groups(exercise: dict[str, Any]) -> dict[str, list[str]]:
    """Extract primary and secondary muscles from exercise."""
    return {
        "primary": [exercise.get("target", "")],
        "secondary": exercise.get("secondary_muscles", []),
    }
