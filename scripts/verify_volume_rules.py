#!/usr/bin/env python3
"""Verifica reglas de volumen fractional tras enrich.

Uso: python3 scripts/verify_volume_rules.py

Recomputa lun+mar (counts reales Postgres ago 2026) y exige Hombros/Tríceps
en 15–18 series efectivas (tope plan 24).
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "backend" / "data" / "catalog.json"

MUSCLE_ES = {
    "pectorals": "Pecho",
    "chest": "Pecho",
    "delts": "Hombros",
    "deltoids": "Hombros",
    "shoulders": "Hombros",
    "rhomboids": "Romboides",
    "triceps": "Tríceps",
    "biceps": "Bíceps",
    "forearms": "Antebrazos",
    "lats": "Dorsales",
    "upper back": "Espalda alta",
    "lower back": "Lumbar",
    "traps": "Trapecios",
    "trapezius": "Trapecios",
    "glutes": "Glúteos",
    "quads": "Cuádriceps",
    "quadriceps": "Cuádriceps",
    "hamstrings": "Isquios",
    "calves": "Gemelos",
    "abs": "Abdomen",
    "core": "Core",
    "cardiovascular system": "Cardio",
    "levator scapulae": "Elevador escapular",
    "sternocleidomastoid": "Esternocleidomastoideo",
    "rear deltoids": "Deltoides posterior",
}

MON = {
    "0025": 3,
    "0047": 3,
    "0169": 4,
    "0227": 3,
    "0289": 3,
    "0309": 3,
    "0314": 3,
    "0643": 3,
    "0669": 3,
    "1403": 3,
    "1585": 3,
    "1722": 4,
    "1728": 4,
    "2142": 3,
    "2466": 3,
    "3220": 3,
}
TUE = {
    "0153": 3,
    "0198": 4,
    "0208": 4,
    "0297": 3,
    "0298": 3,
    "0643": 3,
    "0669": 3,
    "1320": 4,
    "1403": 3,
    "1585": 3,
    "2142": 3,
    "2466": 3,
    "3220": 3,
    "3697": 4,
}

# Baseline app antes del fix (reconstrucción audit 2026-08-04).
BASELINE = {
    "Hombros": {"direct": 13.0, "indirect": 21.45, "total": 34.45},
    "Tríceps": {"direct": 20.0, "indirect": 11.45, "total": 31.45},
}

WARMUP_IDS = {"0643", "0669", "1403", "1585"}
INDIRECT = 0.5
GOAL_MAX = 24
# Banda realista post-fix (plan: ~15–18; 14.5 aceptable si presses planos van a 0.3).
TARGET_LO, TARGET_HI = 14.5, 18.5
FAIL_HARD = 20.0


def muscle_es(m: str) -> str:
    return MUSCLE_ES.get(m, m)


def is_cardio_axis(key: str) -> bool:
    return key == "Cardio"


def weekly_volume_new(exs: dict, counts: dict[str, int]) -> dict[str, dict[str, float]]:
    """Espejo de weeklyVolume post-fix (warmup skip + stretch/metcon)."""
    acc: dict[str, dict[str, float]] = defaultdict(lambda: {"direct": 0.0, "indirect": 0.0})
    for eid, sets in counts.items():
        if eid in WARMUP_IDS:
            continue
        e = exs[eid]
        if e.get("counts_as_hypertrophy") is False:
            # Solo Cardio si el stimulus lo trae.
            stim = e.get("stimulus") or []
            load = e.get("load") if isinstance(e.get("load"), (int, float)) and e["load"] > 0 else 1.0
            for s in stim:
                key = muscle_es(s["muscle"])
                if not is_cardio_axis(key):
                    continue
                amt = sets * load * s["weight"]
                if s["role"] == "primary":
                    acc[key]["direct"] += amt
                else:
                    acc[key]["indirect"] += amt
            continue
        name = f"{e.get('name', '')} {e.get('name_es', '')}".lower()
        if "stretch" in name or "estiramiento" in name:
            continue
        load = e.get("load") if isinstance(e.get("load"), (int, float)) and e["load"] > 0 else 1.0
        sets_eff = sets * load
        stim = e.get("stimulus") or []
        if stim:
            for s in stim:
                key = muscle_es(s["muscle"])
                amt = sets_eff * s["weight"]
                if s["role"] == "primary":
                    acc[key]["direct"] += amt
                else:
                    if e.get("target") and key == muscle_es(e["target"]):
                        continue
                    acc[key]["indirect"] += amt * (INDIRECT / 0.5)
        else:
            if e.get("target"):
                acc[muscle_es(e["target"])]["direct"] += sets_eff
            for sec in e.get("secondary_muscles") or []:
                key = muscle_es(sec)
                if e.get("target") and key == muscle_es(e["target"]):
                    continue
                acc[key]["indirect"] += sets_eff * INDIRECT
    out = {}
    for m, v in acc.items():
        out[m] = {
            "direct": round(v["direct"], 2),
            "indirect": round(v["indirect"], 2),
            "total": round(v["direct"] + v["indirect"], 2),
        }
    return out


def main() -> int:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    exs = {e["id"]: e for e in cat["exercises"]}
    errors: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            errors.append(msg)

    # --- Catálogo ----------------------------------------------------------
    for eid in ("0643", "0669", "1403", "1585"):
        e = exs[eid]
        check(e.get("stimulus") == [], f"{eid}: stimulus debe ser []")
        check(e.get("counts_as_hypertrophy") is False, f"{eid}: counts_as_hypertrophy=false")

    ski = exs["2142"]
    ski_muscles = {s["muscle"] for s in ski.get("stimulus") or []}
    check("cardiovascular system" in ski_muscles, "2142: falta primary cardio")
    check("triceps" not in ski_muscles and "shoulders" not in ski_muscles, "2142: sin triceps/shoulders")

    fly = exs["0227"]
    fly_secs = {s["muscle"] for s in fly.get("stimulus") or [] if s["role"] == "secondary"}
    check("triceps" not in fly_secs, "0227: sin triceps")

    for eid in ("2466", "3220"):
        e = exs[eid]
        check(e.get("counts_as_hypertrophy") is False, f"{eid}: counts_as_hypertrophy=false")
        muscles = {s["muscle"] for s in e.get("stimulus") or []}
        check(muscles <= {"cardiovascular system"}, f"{eid}: solo Cardio, got {muscles}")

    # Press plano hombros 0.3
    flat = exs["0025"]
    sh = next(
        (s["weight"] for s in flat["stimulus"] if s["muscle"] in ("shoulders", "deltoids", "delts")),
        None,
    )
    check(sh == 0.3, f"0025 press plano → hombros debe ser 0.3, got {sh}")

    incline = exs["0047"]
    sh_i = next(
        (s["weight"] for s in incline["stimulus"] if s["muscle"] in ("shoulders", "deltoids", "delts")),
        None,
    )
    check(sh_i == 0.5, f"0047 incline → hombros debe ser 0.5, got {sh_i}")

    # --- Recomputo semana --------------------------------------------------
    week = {**MON}
    for k, n in TUE.items():
        week[k] = week.get(k, 0) + n

    after = weekly_volume_new(exs, week)

    print("=== Baseline (antes del fix) ===")
    for m in ("Hombros", "Tríceps"):
        b = BASELINE[m]
        print(f"  {m}: primary={b['direct']} indirect={b['indirect']} total={b['total']}")

    print("\n=== Después (catálogo + reglas) ===")
    for m in ("Hombros", "Tríceps", "Pecho", "Bíceps", "Dorsales", "Espalda alta", "Cardio"):
        v = after.get(m, {"direct": 0, "indirect": 0, "total": 0})
        print(f"  {m}: primary={v['direct']} indirect={v['indirect']} total={v['total']}")

    for m in ("Hombros", "Tríceps"):
        total = after.get(m, {}).get("total", 0)
        check(total < GOAL_MAX, f"{m} total {total} debe ser < tope {GOAL_MAX}")
        check(
            total <= FAIL_HARD,
            f"{m} total {total} > {FAIL_HARD} (regresión)",
        )
        check(
            TARGET_LO <= total <= TARGET_HI,
            f"{m} total {total} fuera del objetivo realista {TARGET_LO}–{TARGET_HI}",
        )
        check(total < BASELINE[m]["total"] - 5, f"{m}: no bajó lo suficiente vs baseline")

    if errors:
        print("\nFAIL:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nOK: reglas de volumen verificadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
