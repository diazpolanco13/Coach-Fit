"""Plantillas de plan que se siembran a usuarios nuevos.

Viven fuera de catalog.json para que `import_catalog.py` no las pise al
reimportar el dataset. Cada entrada lleva `gym_kind` (metadato de seed); el
`gym_id` real se resuelve en `bootstrap_plans()`.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

STARTER_PLANS_PATH = Path(__file__).resolve().parent.parent / "data" / "starter_plans.json"

# Nombre del plan que queda activo tras el seed.
DEFAULT_ACTIVE_PLAN = "Casa — Torso"


@lru_cache(maxsize=1)
def load_starter_templates() -> list[dict[str, Any]]:
    raw = json.loads(STARTER_PLANS_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("starter_plans.json debe ser una lista")
    return raw


def starter_templates() -> list[dict[str, Any]]:
    """Copia mutable de cada plantilla (payload + gym_kind)."""
    out: list[dict[str, Any]] = []
    for entry in load_starter_templates():
        gym_kind = str(entry.get("gym_kind") or "hogar").strip().lower()
        payload = {k: v for k, v in entry.items() if k != "gym_kind"}
        out.append({"gym_kind": gym_kind, "payload": payload})
    return out
