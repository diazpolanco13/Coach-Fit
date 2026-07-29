from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from renpho import RenphoClient

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("renpho-sync")

STATE_PATH = Path(os.getenv("SYNC_STATE_PATH", "/data/last_sync.json"))
DEFAULT_INTERVAL_SECONDS = 120
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


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def interval_seconds() -> int:
    raw = os.getenv("SYNC_INTERVAL_SECONDS", str(DEFAULT_INTERVAL_SECONDS)).strip()
    try:
        return max(30, int(raw))
    except ValueError:
        return DEFAULT_INTERVAL_SECONDS


def timezone() -> ZoneInfo:
    raw = os.getenv("COACHFIT_TIMEZONE", DEFAULT_TIMEZONE).strip() or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(raw)
    except ZoneInfoNotFoundError:
        log.warning("Unknown COACHFIT_TIMEZONE=%s; falling back to UTC", raw)
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


def measurement_datetime(raw: dict[str, Any], tz: ZoneInfo) -> tuple[datetime | None, int | None]:
    ts = timestamp_value(raw)
    local_dt = parse_local_created_at(raw.get("localCreatedAt") or raw.get("local_created_at"))
    if local_dt:
        if local_dt.tzinfo is not None:
            local_dt = local_dt.astimezone(tz).replace(tzinfo=None)
        return local_dt, ts
    if ts is None:
        return None, None
    return datetime.fromtimestamp(ts, tz).replace(tzinfo=None), ts


def normalize_measurement(raw: dict[str, Any], tz: ZoneInfo) -> tuple[dict[str, Any] | None, int | None]:
    measured_dt, ts = measurement_datetime(raw, tz)
    if measured_dt is None:
        return None, ts

    metric: dict[str, Any] = {
        "date": measured_dt.date().isoformat(),
        "measured_at": measured_dt.time().replace(microsecond=0).isoformat(),
    }
    for target, keys in FIELD_MAP.items():
        metric[target] = as_float(pick(raw, keys))
    for target, keys in TEXT_FIELD_MAP.items():
        value = pick(raw, keys)
        metric[target] = str(value).strip() if value not in (None, "") else None
    return metric, ts


def load_last_timestamp() -> int:
    try:
        data = json.loads(STATE_PATH.read_text())
        return int(data.get("last_timestamp") or 0)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return 0


def save_last_timestamp(ts: int) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = STATE_PATH.with_suffix(".tmp")
    tmp_path.write_text(json.dumps({"last_timestamp": ts}, indent=2))
    tmp_path.replace(STATE_PATH)


def fetch_measurements(email: str, password: str) -> list[dict[str, Any]]:
    client = RenphoClient(email, password, debug=os.getenv("RENPHO_DEBUG", "").lower() in {"1", "true", "yes"})
    client.login()
    # Requires renpho-api from GitHub (see requirements.txt). PyPI 0.1.0 skips
    # impedance-scale tables when the server reports count=0.
    if not hasattr(client, "get_body_composition_measurements"):
        raise RuntimeError(
            "renpho-api is missing get_body_composition_measurements; "
            "install from GitHub commit b259e499 (not PyPI 0.1.0)"
        )
    device_info = client.get_device_info()
    scales = device_info.get("scale") or []
    log.info(
        "Renpho device tables=%s",
        [
            {
                "table": scale.get("tableName"),
                "count": scale.get("count"),
                "users": len(scale.get("userIds") or []),
            }
            for scale in scales
        ],
    )
    return client.get_all_measurements()


def post_measurements(coachfit_url: str, sync_token: str, metrics: list[dict[str, Any]]) -> dict[str, Any]:
    response = requests.post(
        f"{coachfit_url.rstrip('/')}/api/metrics/body/renpho",
        headers={"X-Sync-Token": sync_token},
        json={"measurements": metrics},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def sync_once(email: str, password: str, coachfit_url: str, sync_token: str, tz: ZoneInfo) -> None:
    last_ts = load_last_timestamp()
    raw_measurements = fetch_measurements(email, password)
    metrics: list[dict[str, Any]] = []
    max_seen_ts = last_ts
    skipped_without_time = 0

    for raw in raw_measurements:
        metric, ts = normalize_measurement(raw, tz)
        if ts is not None:
            max_seen_ts = max(max_seen_ts, ts)
            if ts <= last_ts:
                continue
        if metric is None:
            skipped_without_time += 1
            continue
        metrics.append(metric)

    if not metrics:
        log.info(
            "No new Renpho measurements; fetched=%s skipped_without_time=%s",
            len(raw_measurements),
            skipped_without_time,
        )
        return

    metrics.sort(key=lambda m: (m["date"], m.get("measured_at") or ""))
    result = post_measurements(coachfit_url, sync_token, metrics)
    imported = result.get("imported", len(metrics))
    log.info(
        "Synced Renpho measurements; fetched=%s sent=%s imported=%s latest=%s",
        len(raw_measurements),
        len(metrics),
        imported,
        (result.get("latest") or {}).get("date"),
    )
    if max_seen_ts > last_ts:
        save_last_timestamp(max_seen_ts)


def main() -> None:
    email = required_env("RENPHO_EMAIL")
    password = required_env("RENPHO_PASSWORD")
    coachfit_url = required_env("COACHFIT_URL")
    sync_token = required_env("COACHFIT_SYNC_TOKEN")
    tz = timezone()
    interval = interval_seconds()

    log.info("Starting Renpho sync; interval=%ss coachfit_url=%s", interval, coachfit_url)
    while True:
        started = time.monotonic()
        try:
            sync_once(email, password, coachfit_url, sync_token, tz)
        except Exception:
            log.exception("Renpho sync failed")
        elapsed = time.monotonic() - started
        time.sleep(max(1, interval - elapsed))


if __name__ == "__main__":
    main()
