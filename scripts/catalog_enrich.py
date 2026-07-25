"""Enriquece ejercicios del catálogo con anatomía fina, familias y dificultad.

Usado por `import_catalog.py` y por `enrich_catalog.py` (re-etiqueta el JSON
existente sin re-descargar el dataset).

Campos añadidos por ejercicio:
  target_region, stimulus, family_id, difficulty (1-3), load
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

# load por defecto según difficulty. Override puntual gana.
LOAD_BY_DIFFICULTY = {1: 0.6, 2: 1.0, 3: 1.3}

# --- Overrides curados (ids del catálogo) ---------------------------------
# family_id + difficulty + load + region mandan sobre la heurística.
# Empezamos por la familia rueda abdominal (caso del picker) y curados clave.

OVERRIDES: dict[str, dict[str, Any]] = {
    # Rueda abdominal — progresión clásica
    "0971": {
        "family_id": "wheel_rollerout",
        "difficulty": 1,
        "load": 0.6,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    "0857": {
        "family_id": "wheel_rollerout",
        "difficulty": 2,
        "load": 1.0,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    "0796": {
        "family_id": "wheel_rollerout",
        "difficulty": 3,
        "load": 1.3,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    # Variantes barra de la misma familia de patrón
    "0084": {
        "family_id": "wheel_rollerout",
        "difficulty": 2,
        "load": 1.0,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    "0103": {
        "family_id": "wheel_rollerout",
        "difficulty": 3,
        "load": 1.3,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    "0083": {
        "family_id": "wheel_rollerout",
        "difficulty": 2,
        "load": 1.0,
        "target_region": "anti_extension",
        "family_label_es": "Rueda abdominal",
    },
    # Dominadas
    "0970": {
        "family_id": "pull_up",
        "difficulty": 1,
        "load": 0.6,
        "family_label_es": "Dominadas",
    },
    "0652": {
        "family_id": "pull_up",
        "difficulty": 2,
        "load": 1.0,
        "family_label_es": "Dominadas",
    },
    "1326": {
        "family_id": "pull_up",
        "difficulty": 2,
        "load": 1.0,
        "family_label_es": "Dominadas",
    },
    # Flexiones
    "0662": {
        "family_id": "push_up",
        "difficulty": 2,
        "load": 1.0,
        "target_region": "mid",
        "family_label_es": "Flexiones",
    },
    "0283": {
        "family_id": "push_up",
        "difficulty": 3,
        "load": 1.2,
        "target_region": "mid",
        "family_label_es": "Flexiones",
    },
    # Plancha
    "0464": {
        "difficulty": 2,
        "load": 1.0,
        "target_region": "anti_extension",
    },
}

# Modificadores de progresión (no de énfasis regional). Se quitan para stem.
_PROGRESSION_RE = re.compile(
    r"\b("
    r"band[\s-]?assisted|assisted|band|resistance band|"
    r"kneeling|standing|seated|lying|hanging|"
    r"weighted|with chain|smith|leverage|"
    r"beginner|advanced|close[\s-]?grip|wide[\s-]?grip|"
    r"one[\s-]?arm|single[\s-]?arm|alternating|decline(?!\s+bench)|"
    r"from bench|on bench"
    r")\b",
    re.I,
)


def family_stem(name: str) -> str:
    n = name.lower()
    n = _PROGRESSION_RE.sub(" ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def infer_region(ex: dict[str, Any]) -> str | None:
    target = ex.get("target", "")
    name = f"{ex.get('name', '')} {ex.get('name_es', '')}".lower()
    secs = " ".join(ex.get("secondary_muscles") or []).lower()

    if target == "pectorals":
        if re.search(r"\binclin", name) or "upper" in name:
            return "upper"
        if re.search(r"\bdeclin", name) or re.search(r"\bdip|fondo", name):
            return "lower"
        return "mid"

    if target == "delts":
        if "rear" in secs or re.search(r"rear|posterior|reverse fly|face pull|bent.?over", name):
            return "posterior"
        if re.search(r"lateral|side raise|side delt", name):
            return "lateral"
        if re.search(r"front|anterior|military|overhead|press|arnold", name):
            return "anterior"
        return None

    if target == "abs":
        if "oblique" in secs or re.search(
            r"side|oblique|twist|russian|wood.?chop|flexion lateral|heel touch", name
        ):
            return "obliques"
        if re.search(
            r"wheel|rollerout|roll.?out|plank|dead.?bug|bird.?dog|hollow|ab wheel|rueda",
            name,
        ):
            return "anti_extension"
        if re.search(r"leg raise|knee raise|hanging|reverse crunch|lower", name):
            return "lower"
        if re.search(r"crunch|sit.?up|abdominales", name):
            return "upper"
        return None

    return None


def infer_difficulty(ex: dict[str, Any]) -> int:
    name = f"{ex.get('name', '')} {ex.get('name_es', '')}".lower()
    equip = (ex.get("equipment") or "").lower()

    if re.search(r"\b(assisted|band assisted|beginner)\b", name) or equip == "band" and "assist" in name:
        return 1
    if re.search(
        r"\b(standing|one[\s-]?arm|single[\s-]?arm|archer|weighted|handstand|diamond|diamante)\b",
        name,
    ):
        return 3
    if "kneeling" in name or "asistid" in name:
        return 1 if "asistid" in name else 2
    return 2


def secondary_weight(target: str, secondary: str) -> float:
    """Peso grueso: sinergistas cercanos 0.5, el resto 0.25."""
    s = secondary.lower()
    close = {
        "pectorals": {"triceps", "shoulders", "deltoids", "delts"},
        "delts": {"triceps", "traps", "trapezius", "chest", "pectorals"},
        "lats": {"biceps", "forearms", "rear deltoids", "rhomboids"},
        "upper back": {"biceps", "rear deltoids", "traps", "rhomboids"},
        "abs": {"obliques", "hip flexors", "lower back"},
        "quads": {"glutes", "hamstrings", "calves"},
        "glutes": {"hamstrings", "quadriceps", "quads"},
        "hamstrings": {"glutes", "lower back"},
        "triceps": {"shoulders", "deltoids", "chest"},
        "biceps": {"forearms", "brachialis"},
    }
    if s in close.get(target, set()):
        return 0.5
    return 0.25


def build_stimulus(ex: dict[str, Any], region: str | None) -> list[dict[str, Any]]:
    target = ex.get("target") or "other"
    out: list[dict[str, Any]] = [
        {
            "muscle": target,
            "region": region,
            "role": "primary",
            "weight": 1.0,
        }
    ]
    for sec in ex.get("secondary_muscles") or []:
        if not sec:
            continue
        # Evitar duplicar el primary con otro nombre.
        if sec.lower() in {target.lower(), "chest"} and target == "pectorals":
            continue
        out.append(
            {
                "muscle": sec,
                "region": None,
                "role": "secondary",
                "weight": secondary_weight(target, sec),
            }
        )
    return out


def enrich_exercise(ex: dict[str, Any]) -> dict[str, Any]:
    """Devuelve el ejercicio con campos de enriquecimiento (copia superficial)."""
    ov = OVERRIDES.get(ex["id"], {})
    region = ov.get("target_region", infer_region(ex))
    difficulty = int(ov.get("difficulty", infer_difficulty(ex)))
    difficulty = max(1, min(3, difficulty))
    load = float(ov.get("load", LOAD_BY_DIFFICULTY[difficulty]))
    family_id = ov.get("family_id")  # auto-cluster más abajo puede rellenar
    family_label_es = ov.get("family_label_es")

    enriched = dict(ex)
    enriched["target_region"] = region
    enriched["stimulus"] = build_stimulus(ex, region)
    enriched["difficulty"] = difficulty
    enriched["load"] = load
    enriched["family_id"] = family_id
    if family_label_es:
        enriched["family_label_es"] = family_label_es
    return enriched


def assign_families(exercises: list[dict[str, Any]]) -> None:
    """Agrupa por stem+target cuando no hay family_id curado. Mutates in place."""
    # Preservar familias de overrides
    by_key: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for ex in exercises:
        if ex.get("family_id"):
            continue
        stem = family_stem(ex.get("name", ""))
        if len(stem) < 8:
            continue
        by_key[(stem, ex.get("target", ""))].append(ex)

    for (stem, target), members in by_key.items():
        if len(members) < 2:
            continue
        # Evitar agrupar presses inclinados con planos: el stem ya no quita incline.
        fid = f"auto_{re.sub(r'[^a-z0-9]+', '_', stem)}_{re.sub(r'[^a-z0-9]+', '_', target)}"
        # Etiqueta: el miembro de difficulty 2, o el primero.
        label_src = sorted(members, key=lambda e: (abs(e.get("difficulty", 2) - 2), e["id"]))[0]
        label = label_src.get("name_es") or label_src.get("name")
        for ex in members:
            ex["family_id"] = fid
            ex.setdefault("family_label_es", label)


def enrich_catalog_exercises(exercises: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = [enrich_exercise(e) for e in exercises]
    assign_families(out)
    # Asegurar family_label_es en todas las familias
    labels: dict[str, str] = {}
    for ex in out:
        fid = ex.get("family_id")
        if not fid:
            continue
        if ex.get("family_label_es"):
            labels[fid] = ex["family_label_es"]
    for ex in out:
        fid = ex.get("family_id")
        if fid and not ex.get("family_label_es"):
            if fid in labels:
                ex["family_label_es"] = labels[fid]
            else:
                ex["family_label_es"] = ex.get("name_es") or ex.get("name")
    return out
