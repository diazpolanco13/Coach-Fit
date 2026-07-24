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
