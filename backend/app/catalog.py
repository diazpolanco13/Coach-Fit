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


# Las guias son ~70% del peso del catalogo (2 MB con 1324 ejercicios) y solo
# hacen falta al abrir la ficha de un ejercicio, asi que los listados van sin
# ellas y el detalle se pide a /api/exercises/{id}.
SLIM_FIELDS = (
    "id", "name", "name_es", "role", "body_part",
    "target", "equipment", "secondary_muscles", "image", "gif",
    "target_region", "stimulus", "family_id", "family_label_es",
    "difficulty", "load",
)


def slim(ex: dict[str, Any]) -> dict[str, Any]:
    return {k: ex[k] for k in SLIM_FIELDS if k in ex}


@lru_cache(maxsize=1)
def slim_exercises() -> list[dict[str, Any]]:
    return [slim(e) for e in exercises()]


def default_week() -> dict[str, Any]:
    """Fallback de plan cuando no hay activo (coach, week vacío…).

    Prefiere la plantilla starter por defecto; si no está, el `default_week`
    legado dentro de catalog.json.
    """
    from . import starter_plans

    for tmpl in starter_plans.starter_templates():
        if tmpl["payload"].get("name") == starter_plans.DEFAULT_ACTIVE_PLAN:
            return dict(tmpl["payload"])
    return load_catalog()["default_week"]


# Maps a user equipment_type to the catalog `equipment` strings it unlocks.
# Los valores de la derecha son los 28 que trae el dataset completo; se
# obtuvieron ejecutando scripts/import_catalog.py, que los lista al importar.
EQUIPMENT_UNLOCKS = {
    "dumbbell": ["dumbbell"],
    "barbell": ["barbell", "ez barbell", "olympic barbell", "trap bar"],
    "band": ["band", "resistance band"],
    "kettlebell": ["kettlebell"],
    "cable": ["cable"],
    "machine": ["leverage machine", "smith machine", "sled machine"],
    "wheel": ["wheel roller", "roller"],
    "pull_up_bar": ["assisted", "weighted"],  # hanging work needs the bar
    "stability_ball": ["stability ball", "bosu ball"],
    "medicine_ball": ["medicine ball"],
    "rope": ["rope"],
    "cardio_machine": [
        "stationary bike", "elliptical machine", "skierg machine",
        "stepmill machine", "upper body ergometer",
    ],
    # El banco no filtra nada: el dataset no lo usa como `equipment` (un press
    # banca con mancuernas viene como "dumbbell"), asi que va aqui solo para que
    # el usuario pueda registrarlo.
    "bench": [],
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
