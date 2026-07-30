"""Cliente Renpho on-demand: login, fetch y mapeo a body_metrics."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from renpho import RenphoAPIError, RenphoClient

from . import db

log = logging.getLogger("renpho")

DEFAULT_TIMEZONE = "America/Caracas"

FIELD_MAP = {
    "weight_kg": ("weight",),
    "bmi": ("bmi",),
    "body_fat_pct": ("bodyfat", "bodyFat", "body_fat"),
    "fat_mass_kg": ("fatMass", "fat_mass"),
    "muscle_pct": ("muscle",),
    "muscle_mass_kg": ("muscleMass", "muscle_mass"),
    "skeletal_muscle_pct": ("skeletalMuscle", "skeletal_muscle"),
    "skeletal_muscle_kg": ("skeletalMuscleMass", "skeletal_muscle_mass"),
    "bone_pct": ("bone",),
    "bone_mass_kg": ("boneMass", "bone_mass"),
    "protein_pct": ("protein",),
    "protein_mass_kg": ("proteinMass", "protein_mass"),
    "water_pct": ("water",),
    "water_mass_kg": ("waterMass", "water_mass"),
    "lean_body_mass_kg": ("sinew", "fatFreeWeight", "fat_free_weight"),
    "subcutaneous_fat_pct": ("subfat", "subFat", "subcutaneousFat"),
    "visceral_fat": ("visfat", "visFat", "visceralFat"),
    "bmr_kcal": ("bmr",),
    "metabolic_age": ("bodyage", "bodyAge", "metabolicAge"),
    "whr": ("whr",),
    "optimal_weight_kg": ("optimalWeight", "optimal_weight"),
}

TEXT_FIELD_MAP = {
    "weight_level": ("weightLevel", "weight_level"),
    "body_type": ("bodyShape", "bodyType", "body_type"),
}


class RenphoError(RuntimeError):
    pass


def timezone() -> ZoneInfo:
    try:
        return db.user_timezone()
    except Exception:
        pass
    raw = os.getenv("COACHFIT_TIMEZONE", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(raw)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def pick(raw: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = raw.get(key)
        if value not in (None, ""):
            return value
    return None


def as_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def timestamp_value(raw: dict[str, Any]) -> int | None:
    value = raw.get("timeStamp") or raw.get("time_stamp") or raw.get("timestamp")
    if value in (None, ""):
        return None
    try:
        ts = int(float(value))
    except (TypeError, ValueError):
        return None
    return ts // 1000 if ts > 1_000_000_000_000 else ts


def parse_local_created_at(value: Any) -> datetime | None:
    if not value:
        return None
    raw = str(value).strip().replace("/", "-")
    if not raw:
        return None
    for candidate in (raw, raw.replace(" ", "T", 1)):
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue
    return None


def measurement_datetime(
    raw: dict[str, Any], tz: ZoneInfo
) -> tuple[datetime | None, int | None]:
    ts = timestamp_value(raw)
    local_dt = parse_local_created_at(
        raw.get("localCreatedAt") or raw.get("local_created_at")
    )
    if local_dt:
        if local_dt.tzinfo is not None:
            local_dt = local_dt.astimezone(tz).replace(tzinfo=None)
        return local_dt, ts
    if ts is None:
        return None, None
    return datetime.fromtimestamp(ts, tz).replace(tzinfo=None), ts


def normalize_measurement(
    raw: dict[str, Any], tz: ZoneInfo
) -> dict[str, Any] | None:
    measured_dt, _ts = measurement_datetime(raw, tz)
    if measured_dt is None:
        return None

    metric: dict[str, Any] = {
        "date": measured_dt.date().isoformat(),
        "measured_at": measured_dt.time().replace(microsecond=0).isoformat(),
    }
    for target, keys in FIELD_MAP.items():
        metric[target] = as_float(pick(raw, keys))
    for target, keys in TEXT_FIELD_MAP.items():
        value = pick(raw, keys)
        metric[target] = str(value).strip() if value not in (None, "") else None
    return metric


def _client(email: str, password: str) -> RenphoClient:
    client = RenphoClient(
        email,
        password,
        debug=os.getenv("RENPHO_DEBUG", "").lower() in {"1", "true", "yes"},
    )
    if not hasattr(client, "get_body_composition_measurements"):
        raise RenphoError(
            "renpho-api sin body composition; pinnea el commit GitHub b259e499"
        )
    return client


def verify_credentials(email: str, password: str) -> None:
    """Login Renpho; lanza RenphoError si las credenciales no sirven."""
    try:
        _client(email, password).login()
    except RenphoAPIError as exc:
        raise RenphoError(f"Renpho rechazo el login: {exc.msg or exc}") from exc
    except Exception as exc:
        raise RenphoError(f"No se pudo contactar Renpho: {exc}") from exc


def fetch_measurements(email: str, password: str) -> list[dict[str, Any]]:
    client = _client(email, password)
    try:
        client.login()
        return client.get_all_measurements()
    except RenphoAPIError as exc:
        raise RenphoError(f"Renpho API: {exc.msg or exc}") from exc
    except Exception as exc:
        raise RenphoError(f"Error al leer mediciones Renpho: {exc}") from exc


def sync_measurements(email: str, password: str) -> dict[str, Any]:
    """Fetch completo, upsert y borrado de huérfanas (Renpho manda)."""
    tz = timezone()
    raw_measurements = fetch_measurements(email, password)
    metrics: list[dict[str, Any]] = []
    for raw in raw_measurements:
        metric = normalize_measurement(raw, tz)
        if metric is not None:
            metrics.append(metric)
    metrics.sort(key=lambda m: (m["date"], m.get("measured_at") or ""))
    live_keys = {(m["date"], m.get("measured_at") or "") for m in metrics}
    result = db.import_renpho_measurements(metrics)
    deleted = db.delete_renpho_metrics_not_in(live_keys)
    result["fetched"] = len(raw_measurements)
    result["deleted"] = deleted
    log.info(
        "Renpho sync: fetched=%s imported=%s created=%s deleted=%s latest=%s",
        result["fetched"],
        result.get("imported"),
        result.get("created"),
        deleted,
        (result.get("latest") or {}).get("date"),
    )
    return result
