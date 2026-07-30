"""Dominio de los espacios de entrenamiento («gimnasios virtuales»).

Un espacio es cualquier lugar donde el usuario entrena: casa, un gimnasio
comercial, un parque, un hotel, la oficina. Cada uno tiene su propio inventario
de equipo y su propia biblioteca curada de ejercicios.

Vive aparte de `db.py` (que es solo persistencia) y de `catalog.py` (que es el
catalogo global). Importa `catalog` pero nunca `db`, para que `db` pueda
importarlo sin ciclos — mismo criterio que plans.py.
"""

from __future__ import annotations

from typing import Any

from . import catalog

# Tipos de espacio. Deliberadamente NO son un CHECK de la base: sin sistema de
# migraciones un enumerado en el esquema no se puede ampliar nunca, y esta lista
# va a crecer (garaje, playa, casa de un amigo...).
GYM_KINDS = ("hogar", "comercial", "outdoor", "temporal", "oficina")
DEFAULT_KIND = "hogar"

MAX_GYM_NAME = 40
MAX_GYM_NOTES = 400
MAX_ICON = 8          # un emoji compuesto cabe de sobra
MAX_COLOR = 32
MAX_BULK_MARKS = 500

# Estados de un ejercicio dentro de un espacio.
#
# `disponible` es el estado por defecto de todo lo que el inventario permite y
# NUNCA se guarda: es la ausencia de fila. Con 1324 ejercicios por espacio,
# materializarlo serian miles de filas repitiendo el valor por defecto.
STATE_FAVORITE = "favorito"
STATE_AVAILABLE = "disponible"
STATE_HIDDEN = "oculto"
PREF_STATES = (STATE_FAVORITE, STATE_AVAILABLE, STATE_HIDDEN)
STORED_STATES = (STATE_FAVORITE, STATE_HIDDEN)

DEFAULT_GYM_NAME = "Casa"
DEFAULT_GYM_ICON = "🏠"

COMMERCIAL_GYM_NAME = "Gimnasio"
COMMERCIAL_GYM_ICON = "🏋️"

# Inventario tipico por tipo de espacio (tipos, sin kilos). Espejo de
# frontend/src/lib/gymPresets.ts — el seed de usuarios nuevos lo aplica para
# que los planes de ejemplo cuadren con la biblioteca desde el primer login.
GYM_PRESETS: dict[str, list[tuple[str, str]]] = {
    "hogar": [
        ("Mancuernas", "dumbbell"),
        ("Bandas elásticas", "band"),
        ("Barra de dominadas", "pull_up_bar"),
        ("Banco", "bench"),
    ],
    "comercial": [
        ("Mancuernas", "dumbbell"),
        ("Barras", "barbell"),
        ("Banco", "bench"),
        ("Poleas", "cable"),
        ("Máquinas", "machine"),
        ("Barra de dominadas", "pull_up_bar"),
        ("Kettlebells", "kettlebell"),
        ("Bandas elásticas", "band"),
        ("Máquinas de cardio", "cardio_machine"),
        ("Balón medicinal", "medicine_ball"),
        ("Cuerda", "rope"),
        ("Fitball", "stability_ball"),
    ],
    "outdoor": [
        ("Barra de dominadas", "pull_up_bar"),
        ("Bandas elásticas", "band"),
    ],
    "temporal": [
        ("Bandas elásticas", "band"),
    ],
    "oficina": [
        ("Bandas elásticas", "band"),
        ("Fitball", "stability_ball"),
    ],
}


def normalize_kind(raw: Any) -> str:
    kind = str(raw or "").strip().lower()
    return kind if kind in GYM_KINDS else DEFAULT_KIND


def normalize_state(raw: Any) -> str:
    """Un estado desconocido cae a `disponible`, que es el neutro: recortar en
    vez de rechazar, igual que plans._clamp."""
    state = str(raw or "").strip().lower()
    return state if state in PREF_STATES else STATE_AVAILABLE


def _text(raw: Any, limit: int) -> str | None:
    value = str(raw).strip()[:limit] if raw not in (None, "") else ""
    return value or None


def normalize_gym_fields(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Campos de un espacio ya recortados y con el tipo saneado."""
    raw = raw if isinstance(raw, dict) else {}
    name = str(raw.get("name") or "").strip()[:MAX_GYM_NAME] or DEFAULT_GYM_NAME
    return {
        "name": name,
        "kind": normalize_kind(raw.get("kind")),
        "icon": _text(raw.get("icon"), MAX_ICON),
        "color": _text(raw.get("color"), MAX_COLOR),
        "notes": _text(raw.get("notes"), MAX_GYM_NOTES),
    }


def gym_out(row: dict[str, Any]) -> dict[str, Any]:
    """Fila de `gyms` tal y como la ve la API. Los contadores solo estan si la
    consulta los pidio (list_gyms los trae, get_gym no)."""
    out = {
        "id": row["id"],
        "name": row["name"],
        "kind": row["kind"],
        "icon": row.get("icon"),
        "color": row.get("color"),
        "notes": row.get("notes"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    for key in ("equipment_count", "favorite_count", "hidden_count", "plan_count"):
        if key in row:
            out[key] = row[key]
    return out


def allowed_equipment(inventory: list[dict[str, Any]]) -> list[str]:
    """Valores de `equipment` del catalogo que este espacio permite.

    Reusa EQUIPMENT_UNLOCKS para no duplicar el mapeo, y el peso corporal entra
    siempre: un parque sin absolutamente nada sigue siendo un espacio valido.
    """
    allowed = {"body weight"}
    for eq in inventory:
        allowed.update(catalog.EQUIPMENT_UNLOCKS.get(eq["equipment_type"], []))
    return sorted(allowed)


def effective_state(ex: dict[str, Any], allowed: set[str], prefs: dict[str, str]) -> str | None:
    """Estado de un ejercicio en un espacio, o None si el inventario no lo
    permite.

    El orden importa: `oculto` gana siempre, y `favorito` solo ordena DENTRO de
    lo que el inventario permite — marcar como favorito no desbloquea material
    que no tienes.
    """
    state = prefs.get(ex["id"])
    if state == STATE_HIDDEN:
        return STATE_HIDDEN
    if ex["equipment"] not in allowed:
        return None
    return STATE_FAVORITE if state == STATE_FAVORITE else STATE_AVAILABLE


def curated_library(
    gym_id: int,
    inventory: list[dict[str, Any]],
    prefs: dict[str, str],
) -> dict[str, Any]:
    """Vista curada de un espacio SIN mandar el catalogo.

    No devuelve ejercicios hidratados: el cliente ya tiene los 1324 de
    /api/catalog (una sola vez, comprimido) y sabe cruzarlos con el equipo
    permitido. Repetir aqui los ~700 que el inventario habilita serian cientos
    de KB por espacio y por peticion sin aportar un dato nuevo.

    Se mandan solo las marcas esparcidas y el conjunto de equipo permitido; el
    estado efectivo lo compone el cliente con la misma regla de
    effective_state(): oculto -> favorito -> disponible -> no disponible.
    """
    allowed = allowed_equipment(inventory)
    allowed_set = set(allowed)

    favorites = sorted(k for k, v in prefs.items() if v == STATE_FAVORITE)
    hidden = sorted(k for k, v in prefs.items() if v == STATE_HIDDEN)

    emap = catalog.exercise_map()
    # Favoritos cuyo equipo ya no permite el inventario: se conservan (quitar el
    # material no deberia borrar tus preferencias) pero se sacan aparte para que
    # la UI los limpie, en vez de quedar como marcas fantasma. Mismo patron que
    # orphanGoals() en el frontend.
    orphans = [
        eid for eid in favorites
        if eid in emap and emap[eid]["equipment"] not in allowed_set
    ]

    allowed_count = sum(1 for ex in catalog.exercises() if ex["equipment"] in allowed_set)

    return {
        "gym_id": gym_id,
        "equipment_types": sorted({eq["equipment_type"] for eq in inventory}),
        "allowed_equipment": allowed,
        "favorites": favorites,
        "hidden": hidden,
        "orphan_favorites": orphans,
        "counts": {
            "catalog": len(catalog.exercises()),
            "allowed": allowed_count,
            "favorites": len(favorites),
            "hidden": len(hidden),
        },
    }
