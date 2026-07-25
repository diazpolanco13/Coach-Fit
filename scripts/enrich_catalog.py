#!/usr/bin/env python3
"""Re-etiqueta backend/data/catalog.json con anatomía, familias y dificultad.

No descarga el dataset: opera sobre el JSON ya importado.

    python scripts/enrich_catalog.py
    python scripts/enrich_catalog.py --dry-run
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "backend" / "data" / "catalog.json"

# Permite `python scripts/enrich_catalog.py` sin instalar el paquete.
sys.path.insert(0, str(ROOT / "scripts"))
from catalog_enrich import enrich_catalog_exercises  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    before = len(catalog["exercises"])
    catalog["exercises"] = enrich_catalog_exercises(catalog["exercises"])

    ex = catalog["exercises"]
    regions = collections.Counter(e.get("target_region") or "—" for e in ex)
    diffs = collections.Counter(e.get("difficulty") for e in ex)
    families = {e["family_id"] for e in ex if e.get("family_id")}
    multi = collections.Counter(e["family_id"] for e in ex if e.get("family_id"))
    multi_n = sum(1 for f, n in multi.items() if n >= 2)

    print(f"ejercicios: {before}")
    print(f"con región: {sum(1 for e in ex if e.get('target_region'))}")
    print(f"dificultad: {dict(sorted(diffs.items()))}")
    print(f"familias (≥2 miembros): {multi_n} / {len(families)} ids")
    print("regiones top:", regions.most_common(12))

    wheel = [e for e in ex if e.get("family_id") == "wheel_rollerout"]
    print("\nfamilia wheel_rollerout:")
    for e in sorted(wheel, key=lambda x: (x.get("difficulty", 2), x["id"])):
        print(
            f"  {e['id']} d={e['difficulty']} load={e['load']} "
            f"region={e.get('target_region')}  {e['name_es']}"
        )

    if args.dry_run:
        print("\n--dry-run: no se escribió nada")
        return 0

    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(f"\nescrito {CATALOG_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
