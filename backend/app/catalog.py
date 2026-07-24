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


def filter_exercises_by_equipment(available_equipment: list[str]) -> list[dict[str, Any]]:
    """Filter exercises available with the given equipment types."""
    all_ex = exercises()
    equipment_map = {
        "dumbbell": ["dumbbell"],
        "band": ["band"],
        "body_weight": ["body weight"],
        "wheel": ["wheel roller"],
        "bench": ["dumbbell", "body weight"],  # bench is a modifier for other equipment
        "pull_up_bar": ["body weight"],  # pull-ups use body weight + bar
    }

    available_set = set()
    for eq in available_equipment:
        available_set.update(equipment_map.get(eq, []))

    return [ex for ex in all_ex if ex["equipment"] in available_set]


def get_exercise_muscle_groups(exercise: dict[str, Any]) -> dict[str, list[str]]:
    """Extract primary and secondary muscles from exercise."""
    return {
        "primary": [exercise.get("target", "")],
        "secondary": exercise.get("secondary_muscles", []),
    }
