from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app import db  # noqa: E402


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "RENPHO Health-Carlos.csv"
    db.init_db()
    result = db.import_renpho_csv(path.read_text(encoding="utf-8-sig"))
    print(f"Importadas {result['imported']} mediciones desde {path.name}")


if __name__ == "__main__":
    main()
