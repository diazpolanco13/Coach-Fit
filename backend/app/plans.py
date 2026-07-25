"""Dominio del plan de entrenamiento: forma del documento, normalizacion y
enriquecido con el catalogo.

Vive aparte de `db.py` (que es solo persistencia) y de `catalog.py` (que es el
catalogo de ejercicios). Importa `catalog` pero nunca `db`, para que `db` pueda
importarlo sin ciclos.
"""

from __future__ import annotations

from typing import Any

from . import catalog

# Version del documento. Se sella en cada escritura, pero la normalizacion se
# guia por la FORMA del payload y no por este numero: un plan v1 guardado en
# produccion, o uno a medio migrar, se arregla igual. Sirve para diagnostico y
# para un futuro v3.
PLAN_VERSION = 3

# Valores por defecto. Espejan los del frontend a proposito, para que un plan
# migrado se comporte exactamente igual que antes de existir este modulo:
#   frontend/src/lib/training.ts:3   -> DEFAULT_SETS = 3
#   frontend/src/lib/settings.ts:2   -> restSeconds = 90
#   frontend/src/lib/settings.ts:18  -> volumen 10-20 series por musculo
DEFAULT_SETS = 3
DEFAULT_REP_MIN = 8
DEFAULT_REP_MAX = 12
DEFAULT_REST_SECONDS = 90
DEFAULT_VOLUME_MIN = 10
DEFAULT_VOLUME_MAX = 20

MAX_EXERCISES_PER_DAY = 20
MAX_OVERRIDES = 30
MAX_NAME = 60
MAX_OBJECTIVE = 40

# Cuanto cuenta una serie para un musculo secundario. Vive en el plan y no como
# constante global para que un plan de fuerza pueda contar el trabajo indirecto
# distinto que uno de carrera. Espeja INDIRECT_WEIGHT en
# frontend/src/lib/volume.ts, que es donde se aplica.
DEFAULT_INDIRECT_WEIGHT = 0.5

WEEKDAY_LABELS = (
    "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo",
)

DEFAULT_PLAN_NAME = "Mi rutina"


def _clamp(n: Any, lo: int, hi: int, default: int) -> int:
    """Recorta en vez de rechazar. El normalizador tambien corre sobre payloads
    ya guardados, y ahi un error de validacion dejaria al usuario sin plan."""
    try:
        v = int(n)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _normalize_gym_id(raw: Any) -> int | None:
    """Solo forma: entero positivo o None.

    Aqui NO se comprueba que el espacio exista, por dos motivos: plans.py no
    puede importar db sin crear un ciclo, y el normalizador corre tambien al
    LEER — un espacio borrado no puede invalidar un plan ya guardado. La
    resolucion y el marcado de huerfano viven en el borde HTTP, igual que
    `exercise: null` en enrich_plan().
    """
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _clamp_float(n: Any, lo: float, hi: float, default: float) -> float:
    try:
        value = float(n)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, value))


def _normalize_item(raw: Any) -> dict[str, Any] | None:
    # Compat v1: la lista del dia venia como ids sueltos.
    if isinstance(raw, str):
        raw = {"exercise_id": raw}
    if not isinstance(raw, dict):
        return None
    eid = str(raw.get("exercise_id") or "").strip()
    if not eid:
        return None
    rep_min = _clamp(raw.get("rep_min"), 1, 100, DEFAULT_REP_MIN)
    rep_max = _clamp(raw.get("rep_max"), 1, 100, DEFAULT_REP_MAX)
    rest = raw.get("rest_seconds")
    notes = raw.get("notes")
    return {
        "exercise_id": eid,
        "sets": _clamp(raw.get("sets"), 1, 10, DEFAULT_SETS),
        "rep_min": rep_min,
        # Si el rango viene cruzado cede el maximo, nunca al reves.
        "rep_max": max(rep_min, rep_max),
        "rest_seconds": None if rest in (None, "") else _clamp(rest, 10, 600, DEFAULT_REST_SECONDS),
        "notes": str(notes)[:200] if notes else None,
    }


def _normalize_day(raw: Any, weekday: int) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    # Compat v1: el dia solo tenia `exercise_ids`. Se convierte con los valores
    # por defecto y a partir de ahi el plan vive en v2.
    source = raw.get("items")
    if source is None:
        source = raw.get("exercise_ids") or []
    if not isinstance(source, list):
        source = []

    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in source:
        item = _normalize_item(entry)
        # Sin repetidos dentro del dia, igual que hacia ya el editor. Permitir
        # el mismo ejercicio dos veces exigiria un id de hueco propagado por
        # toda la cadena de registro de sesiones.
        if not item or item["exercise_id"] in seen:
            continue
        seen.add(item["exercise_id"])
        items.append(item)
        if len(items) >= MAX_EXERCISES_PER_DAY:
            break

    return {
        "weekday": weekday,
        "label": str(raw.get("label") or WEEKDAY_LABELS[weekday])[:80],
        "focus": str(raw.get("focus") or ("full" if items else "rest"))[:30],
        "items": items,
    }


def _normalize_days(raw_days: Any) -> list[dict[str, Any]]:
    """Siempre 7 dias ordenados de 0 a 6.

    El plan se indexa por dia de la semana: `GET /api/week` hace
    `start + timedelta(days=weekday)`, asi que un weekday fuera de 0-6 daria una
    fecha de otra semana.
    """
    by_wd: dict[int, Any] = {}
    for raw in raw_days or []:
        if not isinstance(raw, dict):
            continue
        try:
            wd = int(raw.get("weekday"))
        except (TypeError, ValueError):
            continue
        if 0 <= wd <= 6:
            by_wd[wd] = raw  # si se repite el weekday, gana el ultimo
    return [_normalize_day(by_wd.get(wd), wd) for wd in range(7)]


def _normalize_range(raw: Any, dmin: int, dmax: int) -> dict[str, int]:
    raw = raw if isinstance(raw, dict) else {}
    lo = _clamp(raw.get("min"), 1, 60, dmin)
    hi = _clamp(raw.get("max"), 1, 60, dmax)
    # Mismo criterio que frontend/src/lib/settings.ts:32: si se cruzan cede el
    # minimo, porque un maximo por debajo pintaria todos los musculos en rojo.
    return {"min": max(1, hi - 1) if lo >= hi else lo, "max": hi}


def _normalize_goals(raw: Any) -> dict[str, Any]:
    """Objetivo base de series semanales por musculo, mas las prioridades.

    La clave de musculo es la etiqueta canonica en espanol que produce
    `muscleES()` en el frontend (frontend/src/lib/muscle.ts). Aqui es OPACA a
    proposito: no se valida contra ningun diccionario ni se traduce, para no
    duplicar MUSCLE_ES en Python. El motivo de usar la etiqueta y no la clave
    del catalogo es que `weeklyVolume()` ya agrupa por ahi a proposito: `quads`
    (target) y `quadriceps` (secundario) deben ser un solo musculo.
    """
    raw = raw if isinstance(raw, dict) else {}
    base = _normalize_range(raw.get("base"), DEFAULT_VOLUME_MIN, DEFAULT_VOLUME_MAX)

    overrides: list[dict[str, Any]] = []
    seen: set[str] = set()
    raw_overrides = raw.get("overrides")
    if not isinstance(raw_overrides, list):
        raw_overrides = []
    for o in raw_overrides[:MAX_OVERRIDES]:
        if not isinstance(o, dict):
            continue
        muscle = str(o.get("muscle") or "").strip()[:40]
        if not muscle or muscle.casefold() in seen:
            continue
        seen.add(muscle.casefold())
        overrides.append({"muscle": muscle, **_normalize_range(o, base["min"], base["max"])})

    return {"base": base, "overrides": overrides}


def normalize_plan_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Unico sitio donde se decide la forma de un plan.

    Se llama al LEER y al ESCRIBIR: por eso un payload v1 guardado en produccion
    se sirve como v2 sin tocar la fila, y nada de lo que se escriba puede quedar
    deforme.

    Reconstruye el documento campo a campo, asi que descarta cualquier clave
    ajena. Eso incluye a proposito `date`, `completed`, `session_rpe` y
    `volume_kg`, que GET /api/week calcula al vuelo para la semana en curso (ver
    el comentario en frontend/src/lib/api.ts:30-33): persistirlos dejaria los
    datos de una semana concreta congelados dentro de la rutina.
    """
    raw = raw if isinstance(raw, dict) else {}
    name = (str(raw.get("name") or DEFAULT_PLAN_NAME).strip() or DEFAULT_PLAN_NAME)[:MAX_NAME]
    return {
        "version": PLAN_VERSION,
        "name": name,
        # Espacio al que pertenece el plan. None = sin anclar: lo resuelve
        # db.resolve_gym_id() al primer espacio, para que los planes que ya
        # existian sigan funcionando sin reescribir ninguna fila al arrancar.
        "gym_id": _normalize_gym_id(raw.get("gym_id")),
        # Intencion del plan («Hipertrofia», «Carrera 10k»...). Texto libre y
        # opaco, mismo criterio que `focus` en los dias y que la etiqueta de
        # musculo en goals.overrides: la lista de objetivos y el preset de
        # volumen que siembra viven en el frontend, junto a MUSCLE_ES, que es
        # donde se pueden verificar las etiquetas en tiempo de compilacion.
        "objective": (str(raw.get("objective") or "").strip()[:MAX_OBJECTIVE] or None),
        "rest_seconds": _clamp(raw.get("rest_seconds"), 10, 600, DEFAULT_REST_SECONDS),
        "indirect_weight": _clamp_float(
            raw.get("indirect_weight"), 0.0, 1.0, DEFAULT_INDIRECT_WEIGHT
        ),
        "goals": _normalize_goals(raw.get("goals")),
        "days": _normalize_days(raw.get("days")),
    }


def blank_plan(
    name: str, gym_id: int | None = None, objective: str | None = None
) -> dict[str, Any]:
    """Semana en blanco: 7 dias de descanso con las etiquetas por defecto."""
    return normalize_plan_payload(
        {"name": name, "gym_id": gym_id, "objective": objective, "days": []}
    )


def enrich_plan(payload: dict[str, Any]) -> dict[str, Any]:
    """Hidrata cada item con su ejercicio del catalogo, en version slim.

    `exercise` puede venir a null si el id ya no esta en el catalogo. El item se
    conserva igual, para no perder la rutina en una reimportacion del dataset;
    el `enrich_week` anterior lo descartaba en silencio.
    """
    emap = catalog.exercise_map()
    days = []
    for day in payload["days"]:
        items = []
        for it in day["items"]:
            ex = emap.get(it["exercise_id"])
            items.append({**it, "exercise": catalog.slim(ex) if ex else None})
        days.append({
            **day,
            "items": items,
            # TODO(compat): proyecciones para el frontend anterior a la pestana
            # Plan. Borrar en el commit que deje de leerlas.
            "exercise_ids": [it["exercise_id"] for it in items],
            "exercises": [it["exercise"] for it in items if it["exercise"]],
        })
    return {**payload, "days": days}


def plan_v1_projection(payload: dict[str, Any]) -> dict[str, Any]:
    """Forma vieja (name + days con exercise_ids) para seguir espejando el plan
    activo en week_plan durante una release. Si hay que revertir el despliegue,
    el codigo anterior encuentra su fila con datos al dia.

    TODO: borrar junto con el espejo de db.py.
    """
    return {
        "name": payload["name"],
        "days": [
            {
                "weekday": d["weekday"],
                "label": d["label"],
                "focus": d["focus"],
                "exercise_ids": [i["exercise_id"] for i in d["items"]],
            }
            for d in payload["days"]
        ],
    }


def plan_summary(row: dict[str, Any]) -> dict[str, Any]:
    """Fila de plan sin el detalle de ejercicios, para el selector de planes."""
    payload = row["payload"]
    days = payload["days"]
    return {
        "id": row["id"],
        "name": payload["name"],
        "gym_id": payload["gym_id"],
        "objective": payload["objective"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "training_days": sum(1 for d in days if d["items"]),
        "exercise_count": sum(len(d["items"]) for d in days),
        "total_sets": sum(i["sets"] for d in days for i in d["items"]),
        "goals": payload["goals"],
    }
