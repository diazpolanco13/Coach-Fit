from __future__ import annotations

import hmac
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, field_validator

from . import auth, catalog, coach, db, gyms, photo_store, plans, renpho, secrets_crypto
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
MAX_BODY_PHOTOS = 3
MAX_BODY_PHOTO_BYTES = 8 * 1024 * 1024
IMAGE_EXTENSIONS = {
    ".avif",
    ".gif",
    ".heic",
    ".heif",
    ".jpeg",
    ".jpg",
    ".png",
    ".webp",
}

# El .env se lee normalmente al abrir el pool, que ocurre despues de importar
# este modulo. La bandera de abajo se necesita ANTES, al construir la app, asi
# que hay que forzar la lectura aqui. Es idempotente y usa setdefault, o sea que
# lo que inyecte Dokploy sigue ganando.
db._load_env_file()

# /docs, /redoc y /openapi.json NO empiezan por /api/, asi que la puerta de
# autenticacion los deja pasar: publicarian las ~50 rutas con sus esquemas a
# cualquiera que pregunte, sin sesion. Se apagan salvo que se pidan a proposito,
# que es lo que hace desarrollo (backend/.env define COACHFIT_DOCS=1).
_DOCS = os.getenv("COACHFIT_DOCS", "").strip().lower() in ("1", "true", "yes")

app = FastAPI(
    title="Coach Fit",
    version="0.1.0",
    openapi_url="/openapi.json" if _DOCS else None,
    docs_url="/docs" if _DOCS else None,
    redoc_url="/redoc" if _DOCS else None,
)
# El listado del catalogo son ~900 KB de JSON muy repetitivo; comprimido baja a
# ~100 KB, que importa bastante cuando la app se usa desde el movil.
app.add_middleware(GZipMiddleware, minimum_size=1024)
# allow_origins=["*"] junto a allow_credentials=True es invalido segun la spec
# de CORS: el navegador rechaza la respuesta si el origen es un comodin y se
# piden credenciales. Funcionaba de casualidad porque la app nunca manda
# cookies ni cabecera Authorization desde el frontend (el SPA se sirve del
# mismo origen que la API, asi que CORS ni siquiera entra en juego).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.exists():
    app.mount("/media", StaticFiles(directory=STATIC_DIR / "media"), name="media")


# --- La puerta -------------------------------------------------------------
#
# Deny-by-default. Todo lo que cuelga de /api/ exige sesion salvo lo que este
# explicitamente en PUBLIC_PATHS.
#
# La alternativa —poner Depends(current_user) endpoint por endpoint— falla
# ABIERTO: el endpoint numero 65 que alguien anada dentro de seis meses queda
# publico y, sin tests, nada lo detecta. Este middleware falla CERRADO: para
# dejar algo abierto hay que escribirlo aqui a proposito.
#
# /media queda fuera a proposito: es el catalogo de ejercicios, contenido de
# terceros sin datos de nadie. Las fotos personales van por
# /api/metrics/body/photos/{id}, que si pasa por aqui.

# logout es publico a proposito: sin token no hace nada, y con uno solo borra esa
# sesion concreta. Exigir sesion para cerrarla haria que un token ya caducado
# devolviera 401 al cerrar sesion, que es ruido justo cuando el frontend hace la
# llamada best-effort.
PUBLIC_PATHS = frozenset({"/api/health", "/api/auth/login", "/api/auth/logout"})
SYNC_TOKEN_PATHS = frozenset({"/api/metrics/body/renpho"})

# Con must_change_password=1 lo unico alcanzable es esto. Sin esta lista, alguien
# con una contrasena temporal usaria la app entera sin rotarla nunca.
PASSWORD_CHANGE_PATHS = frozenset(
    {"/api/auth/me", "/api/auth/change-password", "/api/auth/logout"}
)


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/"):
        return await call_next(request)  # SPA y /media, sin coste
    if path in PUBLIC_PATHS:
        return await call_next(request)
    if path in SYNC_TOKEN_PATHS and _sync_token_ok(request):
        request.state.user = None
        return await call_next(request)

    token = request.cookies.get(auth.COOKIE_NAME)
    user = None
    if token:
        # psycopg es SINCRONO: llamarlo directo desde un middleware async
        # bloquearia el event loop. Los 64 endpoints son `def` y ya corren en el
        # threadpool; esto los iguala.
        user = await run_in_threadpool(db.auth_session_user, auth.token_hash(token))

    if user is None:
        if not auth.enforce():
            # Modo auditoria (COACHFIT_AUTH_ENFORCE=0): se resuelve la cookie
            # pero no se bloquea. Es como se despliega la primera fase.
            request.state.user = None
            return await call_next(request)
        return JSONResponse({"detail": "No autenticado"}, status_code=401)

    if user["must_change_password"] and path not in PASSWORD_CHANGE_PATHS:
        return JSONResponse(
            {"detail": "Debes cambiar la contrasena", "code": "must_change_password"},
            status_code=403,
        )

    request.state.user = user
    if token:
        await run_in_threadpool(_maybe_renew_session, token, user)
    return await call_next(request)


def _maybe_renew_session(token: str, user: dict[str, Any]) -> None:
    """TTL deslizante con umbral horario: sin el seria una escritura por request."""
    last_seen = user.get("session_last_seen_at")
    if last_seen:
        try:
            age = (datetime.now() - datetime.fromisoformat(last_seen)).total_seconds()
        except ValueError:
            age = auth.RENEW_AFTER_SECONDS + 1
        if age < auth.RENEW_AFTER_SECONDS:
            return
    db.renew_auth_session(
        auth.token_hash(token), auth.session_expiry(), auth.absolute_cutoff()
    )


def get_current_user(request: Request) -> dict[str, Any]:
    user = getattr(request.state, "user", None)
    if user is None:
        # Solo puede pasar si alguien metio el path en PUBLIC_PATHS por error, o
        # si la puerta esta en modo auditoria y aun no hay sesion.
        raise HTTPException(401, "No autenticado")
    return user


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def _sync_token_ok(request: Request) -> bool:
    expected = os.getenv("COACHFIT_SYNC_TOKEN", "").strip()
    provided = request.headers.get("x-sync-token", "").strip()
    return bool(expected and provided) and hmac.compare_digest(provided, expected)


def require_sync_token(request: Request) -> None:
    if not _sync_token_ok(request):
        raise HTTPException(status_code=401, detail="Token de sincronizacion invalido")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    db.purge_expired_auth()
    # Crea el admin a partir de user_profile id=1 la primera vez. Idempotente:
    # en cuanto existe un usuario no vuelve a hacer nada.
    db.ensure_bootstrap_admin()
    # El orden importa: seed_default_equipment siembra la tabla legada, y
    # bootstrap_gyms copia de ahi. Si se invirtiera, una base nueva crearia el
    # espacio «Casa» vacio y ya nunca volveria a sembrarlo.
    db.seed_default_equipment()
    db.bootstrap_gyms()
    # Copia el singleton week_plan al modelo multi-plan la primera vez y deja
    # siempre un plan activo. Sustituye al viejo
    # `if db.load_week_plan() is None: db.save_week_plan(catalog.default_week())`.
    db.bootstrap_plans()


class BodyMetricIn(BaseModel):
    date: str = Field(default_factory=lambda: db.today_local().isoformat())
    measured_at: str | None = None
    weight_kg: float | None = None
    bmi: float | None = None
    body_fat_pct: float | None = None
    fat_mass_kg: float | None = None
    muscle_pct: float | None = None
    muscle_mass_kg: float | None = None
    skeletal_muscle_pct: float | None = None
    skeletal_muscle_kg: float | None = None
    bone_pct: float | None = None
    bone_mass_kg: float | None = None
    protein_pct: float | None = None
    protein_mass_kg: float | None = None
    water_pct: float | None = None
    water_mass_kg: float | None = None
    lean_body_mass_kg: float | None = None
    subcutaneous_fat_pct: float | None = None
    visceral_fat: float | None = None
    bmr_kcal: float | None = None
    metabolic_age: float | None = None
    whr: float | None = None
    optimal_weight_kg: float | None = None
    weight_level: str | None = None
    body_type: str | None = None
    notes: str | None = None


class BodyMetricPatchIn(BaseModel):
    """PATCH: solo lo que venga. Lo demas se conserva."""

    date: str | None = None
    measured_at: str | None = None
    weight_kg: float | None = None
    bmi: float | None = None
    body_fat_pct: float | None = None
    fat_mass_kg: float | None = None
    muscle_pct: float | None = None
    muscle_mass_kg: float | None = None
    skeletal_muscle_pct: float | None = None
    skeletal_muscle_kg: float | None = None
    bone_pct: float | None = None
    bone_mass_kg: float | None = None
    protein_pct: float | None = None
    protein_mass_kg: float | None = None
    water_pct: float | None = None
    water_mass_kg: float | None = None
    lean_body_mass_kg: float | None = None
    subcutaneous_fat_pct: float | None = None
    visceral_fat: float | None = None
    bmr_kcal: float | None = None
    metabolic_age: float | None = None
    whr: float | None = None
    optimal_weight_kg: float | None = None
    weight_level: str | None = None
    body_type: str | None = None
    notes: str | None = None


class RenphoBodyMetricImportIn(BaseModel):
    measurements: list[BodyMetricIn] = Field(default_factory=list)


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]+$")
# E.164: prefijo internacional y hasta 15 digitos. Guardar el numero en formato
# local obligaria a adivinar el pais el dia que se mande el primer mensaje.
WHATSAPP_RE = re.compile(r"^\+[1-9]\d{7,14}$")
TELEGRAM_USER_RE = re.compile(r"^[A-Za-z0-9_]{5,32}$")
TELEGRAM_CHAT_RE = re.compile(r"^-?\d{1,20}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

SEX_VALUES = {"masculino", "femenino", "otro"}
CHANNEL_VALUES = {"whatsapp", "telegram", "ninguno"}
ACTIVITY_VALUES = {"sedentario", "ligero", "moderado", "alto", "atleta"}


class RenphoConnectIn(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_RE.match(cleaned):
            raise ValueError("Email invalido")
        return cleaned


class UserProfileIn(BaseModel):
    """PATCH del perfil. Todo opcional: el formulario manda solo lo que toca.

    Una cadena vacia no es un error, es un borrado — asi el formulario vacia un
    campo sin necesitar un endpoint aparte."""

    full_name: str | None = None
    birth_date: str | None = None
    sex: str | None = None
    height_cm: float | None = None
    email: str | None = None
    whatsapp_e164: str | None = None
    telegram_username: str | None = None
    telegram_chat_id: str | None = None
    timezone: str | None = None
    reminder_time: str | None = None
    reminder_channel: str | None = None
    goal: str | None = None
    activity_level: str | None = None
    health_notes: str | None = None

    @field_validator(
        "full_name",
        "birth_date",
        "sex",
        "email",
        "whatsapp_e164",
        "telegram_username",
        "telegram_chat_id",
        "timezone",
        "reminder_time",
        "reminder_channel",
        "goal",
        "activity_level",
        "health_notes",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @field_validator("birth_date")
    @classmethod
    def _check_birth_date(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            born = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Fecha de nacimiento invalida (formato AAAA-MM-DD)") from exc
        if born > db.today_local():
            raise ValueError("La fecha de nacimiento no puede estar en el futuro")
        if born.year < 1900:
            raise ValueError("Fecha de nacimiento demasiado antigua")
        return born.isoformat()

    @field_validator("height_cm")
    @classmethod
    def _check_height(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if not 50 <= value <= 250:
            raise ValueError("La altura debe estar entre 50 y 250 cm")
        return value

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not EMAIL_RE.match(value):
            raise ValueError("Correo invalido")
        return value

    @field_validator("whatsapp_e164")
    @classmethod
    def _check_whatsapp(cls, value: str | None) -> str | None:
        if value is None:
            return None
        compact = re.sub(r"[\s\-()]", "", value)
        if not WHATSAPP_RE.match(compact):
            raise ValueError("WhatsApp debe ir en formato internacional, p. ej. +584121234567")
        return compact

    @field_validator("telegram_username")
    @classmethod
    def _check_telegram_user(cls, value: str | None) -> str | None:
        if value is None:
            return None
        handle = value.lstrip("@")
        if not TELEGRAM_USER_RE.match(handle):
            raise ValueError("Usuario de Telegram invalido (5-32 letras, numeros o guion bajo)")
        return handle

    @field_validator("telegram_chat_id")
    @classmethod
    def _check_telegram_chat(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not TELEGRAM_CHAT_RE.match(value):
            raise ValueError("El chat_id de Telegram es numerico")
        return value

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Zona horaria desconocida") from exc
        return value

    @field_validator("reminder_time")
    @classmethod
    def _check_reminder_time(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not TIME_RE.match(value):
            raise ValueError("La hora del recordatorio va en formato HH:MM")
        return value

    @field_validator("sex")
    @classmethod
    def _check_sex(cls, value: str | None) -> str | None:
        if value is None:
            return None
        lowered = value.lower()
        if lowered not in SEX_VALUES:
            raise ValueError(f"Sexo invalido: {', '.join(sorted(SEX_VALUES))}")
        return lowered

    @field_validator("reminder_channel")
    @classmethod
    def _check_channel(cls, value: str | None) -> str | None:
        if value is None:
            return None
        lowered = value.lower()
        if lowered not in CHANNEL_VALUES:
            raise ValueError(f"Canal invalido: {', '.join(sorted(CHANNEL_VALUES))}")
        return lowered

    @field_validator("activity_level")
    @classmethod
    def _check_activity(cls, value: str | None) -> str | None:
        if value is None:
            return None
        lowered = value.lower()
        if lowered not in ACTIVITY_VALUES:
            raise ValueError(f"Nivel de actividad invalido: {', '.join(sorted(ACTIVITY_VALUES))}")
        return lowered


def _body_metric_from_payload(body: BodyMetricIn) -> dict[str, Any]:
    payload = body.model_dump()
    return db.add_body_metric(
        payload.pop("date"),
        payload.pop("weight_kg"),
        payload.pop("body_fat_pct"),
        payload.pop("notes"),
        **payload,
    )


def _photo_extension(filename: str | None, content_type: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return suffix
    if content_type == "image/jpeg":
        return ".jpg"
    if content_type == "image/png":
        return ".png"
    if content_type == "image/webp":
        return ".webp"
    if content_type == "image/gif":
        return ".gif"
    if content_type == "image/avif":
        return ".avif"
    return ".jpg"


async def _read_photo_upload(upload: UploadFile) -> dict[str, Any]:
    content_type = upload.content_type or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se admiten archivos de imagen")
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="La foto está vacía")
    if len(data) > MAX_BODY_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Cada foto debe pesar 8 MB o menos")
    return {
        "data": data,
        "content_type": content_type,
        "original_name": upload.filename,
        "extension": _photo_extension(upload.filename, content_type),
    }


class RunIn(BaseModel):
    date: str = Field(default_factory=lambda: db.today_local().isoformat())
    distance_km: float
    duration_min: float | None = None
    pace_min_per_km: float | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None


class SetIn(BaseModel):
    exercise_id: str
    set_index: int = 1
    reps: int | None = None
    weight_kg: float | None = None
    rpe: int | None = Field(default=None, ge=1, le=10)
    done: bool = True
    notes: str | None = None


class SessionIn(BaseModel):
    date: str = Field(default_factory=lambda: db.today_local().isoformat())
    focus: str | None = None
    completed: bool = True
    session_rpe: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    mood: str | None = Field(default=None, max_length=32)
    health: str | None = Field(default=None, max_length=32)
    energy: str | None = Field(default=None, max_length=32)
    # Mapa ejercicio → {zona: sore|pain}. Vacío = sin novedades.
    exercise_feedback: dict[str, dict[str, str]] | None = None
    sets: list[SetIn] = Field(default_factory=list)
    # Que hacer con lo que YA estaba registrado ese dia y no viene en `sets`:
    #   replace -> desaparece. El cliente declara la sesion entera.
    #   merge   -> sobrevive. El cliente solo declara los ejercicios que manda.
    # Por defecto replace, que es lo que hacia el endpoint antes de existir este
    # campo: un SPA cacheado en el movil sigue comportandose igual.
    mode: Literal["replace", "merge"] = "replace"


class WeekPlanIn(BaseModel):
    name: str
    days: list[dict[str, Any]]


# Los modelos de plan validan la forma obvia; los cruces (rep_max < rep_min,
# min >= max) los recorta plans.normalize_plan_payload, que es un solo sitio y
# ademas protege los payloads ya guardados.
class PlanItemIn(BaseModel):
    exercise_id: str = Field(min_length=1, max_length=32)
    sets: int = Field(default=plans.DEFAULT_SETS, ge=1, le=10)
    rep_min: int = Field(default=plans.DEFAULT_REP_MIN, ge=1, le=100)
    rep_max: int = Field(default=plans.DEFAULT_REP_MAX, ge=1, le=100)
    rest_seconds: int | None = Field(default=None, ge=10, le=600)
    notes: str | None = Field(default=None, max_length=200)


class PlanDayIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    label: str = Field(default="", max_length=80)
    focus: str = Field(default="", max_length=30)
    items: list[PlanItemIn] = Field(default_factory=list, max_length=plans.MAX_EXERCISES_PER_DAY)
    # Compat v1: si el cliente viejo manda solo ids, el normalizador los
    # convierte con los valores por defecto. `items` gana si vienen los dos.
    exercise_ids: list[str] | None = None


class VolumeRangeIn(BaseModel):
    min: int = Field(ge=1, le=60)
    max: int = Field(ge=1, le=60)


class MuscleGoalIn(VolumeRangeIn):
    """`muscle` es la etiqueta canonica en espanol que produce muscleES()."""

    muscle: str = Field(min_length=1, max_length=40)


class PlanGoalsIn(BaseModel):
    base: VolumeRangeIn
    overrides: list[MuscleGoalIn] = Field(default_factory=list, max_length=plans.MAX_OVERRIDES)


class PlanCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=plans.MAX_NAME)
    days: list[PlanDayIn] | None = None  # None = semana en blanco
    goals: PlanGoalsIn | None = None
    rest_seconds: int | None = Field(default=None, ge=10, le=600)
    indirect_weight: float | None = Field(default=None, ge=0, le=1)
    gym_id: int | None = Field(default=None, ge=1)
    objective: str | None = Field(default=None, max_length=plans.MAX_OBJECTIVE)
    activate: bool = False


class PlanUpdateIn(BaseModel):
    """PUT: reemplazo completo del plan."""

    name: str = Field(min_length=1, max_length=plans.MAX_NAME)
    days: list[PlanDayIn]
    goals: PlanGoalsIn | None = None
    rest_seconds: int | None = Field(default=None, ge=10, le=600)
    indirect_weight: float | None = Field(default=None, ge=0, le=1)
    gym_id: int | None = Field(default=None, ge=1)
    objective: str | None = Field(default=None, max_length=plans.MAX_OBJECTIVE)


class PlanPatchIn(BaseModel):
    """PATCH: solo lo que venga. Lo demas se conserva."""

    name: str | None = Field(default=None, min_length=1, max_length=plans.MAX_NAME)
    days: list[PlanDayIn] | None = None
    goals: PlanGoalsIn | None = None
    rest_seconds: int | None = Field(default=None, ge=10, le=600)
    indirect_weight: float | None = Field(default=None, ge=0, le=1)
    gym_id: int | None = Field(default=None, ge=1)
    objective: str | None = Field(default=None, max_length=plans.MAX_OBJECTIVE)


class PlanDuplicateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=plans.MAX_NAME)


class GymIn(BaseModel):
    name: str = Field(min_length=1, max_length=gyms.MAX_GYM_NAME)
    kind: str = Field(default=gyms.DEFAULT_KIND, max_length=20)
    icon: str | None = Field(default=None, max_length=gyms.MAX_ICON)
    color: str | None = Field(default=None, max_length=gyms.MAX_COLOR)
    notes: str | None = Field(default=None, max_length=gyms.MAX_GYM_NOTES)


class GymPatchIn(BaseModel):
    """PATCH: solo lo que venga. Lo demas se conserva."""

    name: str | None = Field(default=None, min_length=1, max_length=gyms.MAX_GYM_NAME)
    kind: str | None = Field(default=None, max_length=20)
    icon: str | None = Field(default=None, max_length=gyms.MAX_ICON)
    color: str | None = Field(default=None, max_length=gyms.MAX_COLOR)
    notes: str | None = Field(default=None, max_length=gyms.MAX_GYM_NOTES)


class GymDuplicateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=gyms.MAX_GYM_NAME)


class GymEquipmentIn(BaseModel):
    """Igual que UserEquipmentIn salvo por una cosa: aqui equipment_type SI se
    valida. Un tipo con typo no desbloquea nada en EQUIPMENT_UNLOCKS y el
    usuario ve un ejercicio menos sin ningun error — fallo invisible."""

    name: str = Field(min_length=1, max_length=80)
    equipment_type: str = Field(min_length=1, max_length=40)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    quantity: int = Field(default=1, ge=1, le=99)

    @field_validator("equipment_type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        if v not in catalog.EQUIPMENT_UNLOCKS:
            raise ValueError(f"Tipo de equipo desconocido: {v}")
        return v


_STATE_PATTERN = "^(favorito|disponible|oculto)$"


class ExercisePrefIn(BaseModel):
    state: str = Field(pattern=_STATE_PATTERN)


class ExerciseMarkIn(BaseModel):
    exercise_id: str = Field(min_length=1, max_length=32)
    state: str = Field(pattern=_STATE_PATTERN)


class LibraryBulkIn(BaseModel):
    """Marcado masivo mixto: «estos 20 a favorito y estos 3 de vuelta a
    disponible» en una sola peticion, que es como se usa el editor."""

    marks: list[ExerciseMarkIn] = Field(min_length=1, max_length=gyms.MAX_BULK_MARKS)


class CoachIn(BaseModel):
    notes: str | None = None
    gym_id: int | None = Field(default=None, ge=1)


class UserEquipmentIn(BaseModel):
    name: str
    equipment_type: str
    weight_kg: float | None = None
    quantity: int = 1


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Autenticacion ---------------------------------------------------------


class LoginIn(BaseModel):
    email: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


# Un unico mensaje para email inexistente, contrasena mala y cuenta desactivada.
# Decir cual de los tres es confirmar que un correo esta dado de alta.
_BAD_CREDENTIALS = "Credenciales invalidas"


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@app.post("/api/auth/login")
def login(payload: LoginIn, request: Request, response: Response) -> dict[str, Any]:
    email = payload.email.strip()
    ip = _client_ip(request)
    if not email or not payload.password:
        raise HTTPException(401, _BAD_CREDENTIALS)

    since = auth.attempt_window_start()
    by_email, by_ip = db.failed_login_counts(email, ip, since)
    if by_email >= auth.LOGIN_MAX_PER_EMAIL or by_ip >= auth.LOGIN_MAX_PER_IP:
        raise HTTPException(
            429,
            "Demasiados intentos. Espera unos minutos.",
            headers={"Retry-After": str(auth.LOGIN_WINDOW_MINUTES * 60)},
        )

    user = db.get_user_by_email(email)
    locked = bool(user and user.get("locked_until") and user["locked_until"] > db.now_iso())
    # verify_password se llama SIEMPRE, tambien sin usuario: contra el hash
    # senuelo. Es lo que iguala los tiempos y evita enumerar correos.
    ok = auth.verify_password(payload.password, user["password_hash"] if user else None)

    if not user or not ok or locked or not user["is_active"]:
        db.record_login_attempt(email, ip, False)
        if user and not locked:
            fails, _ = db.failed_login_counts(email, ip, since)
            if fails >= auth.LOGIN_LOCK_THRESHOLD:
                db.lock_user_until(user["id"], auth.lock_until())
        raise HTTPException(401, _BAD_CREDENTIALS)

    db.record_login_attempt(email, ip, True)
    db.purge_expired_auth()
    db.touch_user_login(user["id"])

    token = auth.new_token()
    db.create_auth_session(
        user["id"],
        auth.token_hash(token),
        auth.session_expiry(),
        user_agent=request.headers.get("user-agent"),
        ip=ip,
    )
    response.set_cookie(
        auth.COOKIE_NAME,
        token,
        **auth.cookie_kwargs(max_age=auth.SESSION_TTL_DAYS * 86400),
    )
    return {"user": auth.public_user(db.get_user(user["id"]))}


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request) -> Response:
    """Idempotente: sin cookie tambien devuelve 204."""
    token = request.cookies.get(auth.COOKIE_NAME)
    if token:
        db.delete_auth_session(auth.token_hash(token))
    out = Response(status_code=204)
    # El path tiene que coincidir con el del set_cookie o el navegador no la
    # borra: una cookie se identifica por (nombre, dominio, path).
    out.delete_cookie(auth.COOKIE_NAME, path="/")
    return out


@app.get("/api/auth/me")
def auth_me(user: CurrentUser) -> dict[str, Any]:
    return {"user": auth.public_user(user)}


@app.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordIn, user: CurrentUser, request: Request, response: Response
) -> dict[str, Any]:
    # La actual se verifica INCLUSO con must_change_password=1: la temporal es la
    # contrasena actual.
    if not auth.verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(400, "La contrasena actual no es correcta.")
    if payload.new_password == payload.current_password:
        raise HTTPException(400, "La contrasena nueva debe ser distinta de la actual.")
    try:
        new_hash = auth.hash_password(payload.new_password)
    except auth.PasswordError as exc:
        raise HTTPException(400, str(exc)) from exc

    db.set_user_password(user["id"], new_hash, must_change=False)
    # Rotacion: se matan TODAS las sesiones (incluida la actual) y se emite un
    # token nuevo. Mata sesiones robadas y evita fijacion de sesion.
    db.delete_user_auth_sessions(user["id"])
    token = auth.new_token()
    db.create_auth_session(
        user["id"],
        auth.token_hash(token),
        auth.session_expiry(),
        user_agent=request.headers.get("user-agent"),
        ip=_client_ip(request),
    )
    response.set_cookie(
        auth.COOKIE_NAME,
        token,
        **auth.cookie_kwargs(max_age=auth.SESSION_TTL_DAYS * 86400),
    )
    return {"user": auth.public_user(db.get_user(user["id"]))}


@app.post("/api/auth/logout-all", status_code=204)
def logout_all(user: CurrentUser) -> Response:
    """Cierra la sesion en todos los dispositivos."""
    db.delete_user_auth_sessions(user["id"])
    out = Response(status_code=204)
    out.delete_cookie(auth.COOKIE_NAME, path="/")
    return out


@app.get("/api/catalog")
def get_catalog() -> dict[str, Any]:
    return {
        # Se expone el mapeo para que el filtro "solo con mi equipo" del
        # frontend no tenga que duplicarlo.
        "equipment_unlocks": catalog.EQUIPMENT_UNLOCKS,
        "exercises": catalog.slim_exercises(),
    }


# NOTE: must be registered before /api/exercises/{exercise_id} or FastAPI
# matches "suggestions" as an exercise_id.
@app.get("/api/exercises/suggestions")
def suggest_exercises(
    muscle_group: str | None = None, gym_id: int | None = None
) -> dict[str, Any]:
    """Sugerencias del espacio: lo que permite su inventario, sin los ejercicios
    ocultos y con los favoritos delante."""
    gid = db.resolve_gym_id(gym_id)
    equipment = db.list_gym_equipment(gid) if gid else []
    prefs = db.list_exercise_prefs(gid) if gid else {}
    equipment_types = {e["equipment_type"] for e in equipment}

    filtered = catalog.filter_exercises_by_equipment(list(equipment_types))
    filtered = [e for e in filtered if prefs.get(e["id"]) != gyms.STATE_HIDDEN]

    if muscle_group:
        filtered = [
            e for e in filtered
            if e.get("target") == muscle_group or muscle_group in e.get("secondary_muscles", [])
        ]

    # Los favoritos primero; dentro de cada grupo se respeta el orden del catalogo.
    filtered.sort(key=lambda e: prefs.get(e["id"]) != gyms.STATE_FAVORITE)

    return {
        "gym_id": gid,
        "equipment_available": sorted(equipment_types),
        "total_exercises": len(filtered),
        "exercises": [catalog.slim(e) for e in filtered],
    }


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: str) -> dict[str, Any]:
    ex = catalog.exercise_map().get(exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    return ex


# DEPRECADO: el equipamiento pertenece ahora a un espacio. Estas tres rutas
# siguen aqui, redirigidas al espacio en efecto, para que un SPA cacheado en el
# movil no empiece a dar 404 a mitad de despliegue.
# TODO: borrar en la release siguiente; lo nuevo usa /api/gyms/{id}/equipment.
def _default_gym_or_409() -> int:
    gid = db.resolve_gym_id(None)
    if gid is None:
        raise HTTPException(409, "No hay ningún espacio configurado")
    return gid


@app.get("/api/equipment")
def get_equipment() -> list[dict[str, Any]]:
    return db.list_gym_equipment(_default_gym_or_409())


@app.post("/api/equipment")
def post_equipment(body: UserEquipmentIn) -> dict[str, Any]:
    return db.add_gym_equipment(
        _default_gym_or_409(), body.name, body.equipment_type, body.weight_kg, body.quantity
    )


@app.delete("/api/equipment/{equipment_id}")
def delete_equipment(equipment_id: int) -> dict[str, str]:
    db.delete_gym_equipment(_default_gym_or_409(), equipment_id)
    return {"status": "deleted"}


class ProgressionSuggestionIn(BaseModel):
    exercise_id: str
    reps: int
    weight_kg: float
    session_rpe: int
    # Espacio donde se esta entrenando AHORA, que no tiene por que ser el del
    # plan: en el gimnasio comercial la escalera de mancuernas sube de 2.5 en
    # 2.5, en casa es 7.5/12.5/20.
    gym_id: int | None = Field(default=None, ge=1)


def _estimate_reps_at(weight: float, ref_weight: float, ref_reps: int) -> int:
    """Estimate reps achievable at `weight` given a reference set (Epley 1RM)."""
    if weight <= 0 or ref_weight <= 0 or ref_reps <= 0:
        return ref_reps
    one_rm = ref_weight * (1 + ref_reps / 30)
    reps = int(30 * (one_rm / weight - 1))
    return max(3, min(reps, 30))


@app.post("/api/progression-suggest")
def suggest_progression(body: ProgressionSuggestionIn) -> dict[str, Any]:
    """Suggest the next progression step based on RPE and the user's real equipment.

    For dumbbell work the next weight snaps to the discrete dumbbells the user
    owns (e.g. 7.5 → 12.5 → 20 kg) instead of a theoretical +2.5 kg that
    doesn't exist in their home gym.
    """
    ex = catalog.exercise_map().get(body.exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")

    weight = body.weight_kg
    reps = body.reps
    rpe = body.session_rpe

    is_dumbbell = ex.get("equipment") == "dumbbell"
    available = db.list_dumbbell_weights(body.gym_id) if is_dumbbell else []
    # Sin mancuernas en este espacio no hay escalera que seguir, asi que se trata
    # como material generico. Antes se caia en la rama de «ya estas en la mas
    # pesada», que con el inventario vacio es mentira: no tienes ninguna.
    if is_dumbbell and not available:
        is_dumbbell = False
    heavier = [w for w in available if w > weight]
    lighter = [w for w in available if w < weight]

    next_weight = weight
    next_reps = reps
    recommendation = ""

    wants_increase = rpe <= 6
    wants_deload = rpe >= 9
    bodyweight_move = weight <= 0

    if bodyweight_move:
        if wants_deload:
            recommendation = "Muy exigente. Reduce 2-3 reps por serie o usa una variante asistida."
            next_reps = max(3, reps - 3)
        elif wants_increase:
            recommendation = "Te quedó fácil. Suma 2 reps por serie o pasa a una variante más difícil."
            next_reps = reps + 2
        else:
            recommendation = "Buen rango de esfuerzo. Suma 1 rep por serie hasta dominar el movimiento."
            next_reps = reps + 1
    elif wants_deload:
        if lighter:
            next_weight = max(lighter)
            next_reps = _estimate_reps_at(next_weight, weight, reps)
            recommendation = (
                f"Muy difícil (RPE {rpe}). Baja a tu mancuerna de {next_weight:g} kg "
                "en la próxima sesión y recupera técnica."
            )
        else:
            next_reps = max(3, reps - 2)
            recommendation = f"Muy difícil (RPE {rpe}). Mantén {weight:g} kg pero recorta 2 reps por serie."
    elif is_dumbbell and heavier and reps >= 15 and rpe <= 7:
        # 15+ clean reps: more reps stops building strength — time to jump
        # to the next dumbbell even if the % jump is big, and rebuild reps.
        next_weight = min(heavier)
        next_reps = max(_estimate_reps_at(next_weight, weight, reps), 5)
        recommendation = (
            f"Con {reps} reps limpias (RPE {rpe}) toca cambiar de estímulo: pasa a tu "
            f"mancuerna de {next_weight:g} kg y reconstruye desde ~{next_reps}-{next_reps + 3} reps."
        )
    elif wants_increase and is_dumbbell:
        if heavier:
            target = min(heavier)
            est = _estimate_reps_at(target, weight, reps)
            if est >= 6:
                next_weight = target
                next_reps = est
                recommendation = (
                    f"Te quedó fácil (RPE {rpe}). Pasa a tu mancuerna de {target:g} kg (~{est} reps)."
                )
            else:
                # The jump to the next dumbbell is still too big — keep building reps first.
                next_reps = reps + 2
                recommendation = (
                    f"Te quedó fácil (RPE {rpe}), pero el salto a {target:g} kg aún es grande "
                    f"(hoy rondarías ~{est} reps). Sigue con {weight:g} kg sumando reps "
                    f"(objetivo {next_reps}+) y prueba {target:g} kg cuando el RPE siga bajo."
                )
        else:
            next_reps = reps + 2
            recommendation = (
                f"Ya estás en tu mancuerna más pesada ({weight:g} kg). "
                "Progresa con más reps, tempo lento (3s bajada) o pausas."
            )
    elif wants_increase:
        next_weight = weight + 2.5
        recommendation = f"Te quedó fácil (RPE {rpe}). Sube a {next_weight:g} kg si tu material lo permite."
    elif rpe <= 8:
        next_reps = reps + 1
        recommendation = f"Esfuerzo ideal (RPE {rpe}). Mantén {weight:g} kg y busca +1 rep por serie."
    else:  # rpe == 8.5-ish edge, treated as hard but manageable
        next_reps = reps
        recommendation = f"Esfuerzo alto (RPE {rpe}). Repite {weight:g} kg × {reps} hasta que baje el RPE."

    return {
        "exercise_id": body.exercise_id,
        "exercise_name": ex.get("name_es"),
        "current": {"reps": reps, "weight_kg": weight, "rpe": rpe},
        "recommendation": recommendation,
        "next_weight_kg": next_weight,
        "next_reps": next_reps,
        "available_weights": available,
    }


def _plan_out(
    row: dict[str, Any], gyms_by_id: dict[int, dict[str, Any]] | None = None
) -> dict[str, Any]:
    """`gyms_by_id` se pasa desde los listados para no hacer N+1."""
    if gyms_by_id is None:
        gyms_by_id = {g["id"]: g for g in db.list_gyms()}
    gid = row["payload"].get("gym_id")
    gym = gyms_by_id.get(gid) if gid is not None else None
    return {
        "id": row["id"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        # `gym` a null significa «sin anclar» o «el espacio ya no existe»; el
        # plan se conserva igual, mismo criterio que `exercise: null` en
        # enrich_plan(). `gym_missing` distingue los dos casos para que la UI
        # pueda ofrecer re-anclar en vez de fallar en silencio.
        "gym": gyms.gym_out(gym) if gym else None,
        "gym_missing": gid is not None and gym is None,
        "effective_gym_id": gym["id"] if gym else db.resolve_gym_id(None),
        **plans.enrich_plan(row["payload"]),
    }


def _plan_or_404(plan_id: int) -> dict[str, Any]:
    row = db.get_plan(plan_id)
    if row is None:
        raise HTTPException(404, "Plan no encontrado")
    return row


def _check_name_free(name: str, exclude_id: int | None = None) -> None:
    if db.name_taken(name, exclude_id=exclude_id):
        raise HTTPException(409, f"Ya tienes un plan llamado «{name.strip()}»")


def _check_room_for_one_more() -> None:
    if db.count_plans() >= db.MAX_PLANS:
        raise HTTPException(409, f"Máximo {db.MAX_PLANS} planes guardados")


def _plan_list() -> dict[str, Any]:
    rows = db.list_plans()
    active = next((r["id"] for r in rows if r["is_active"]), None)
    return {
        "plans": [plans.plan_summary(r) for r in rows],
        "active_id": active,
        "max_plans": db.MAX_PLANS,
    }


# --- Espacios de entrenamiento ----------------------------------------------


def _gym_or_404(gym_id: int) -> dict[str, Any]:
    row = db.get_gym(gym_id)
    if row is None:
        raise HTTPException(404, "Espacio no encontrado")
    return row


def _check_gym_name_free(name: str, exclude_id: int | None = None) -> None:
    if db.gym_name_taken(name, exclude_id=exclude_id):
        raise HTTPException(409, f"Ya tienes un espacio llamado «{name.strip()}»")


def _check_room_for_one_more_gym() -> None:
    if db.count_gyms() >= db.MAX_GYMS:
        raise HTTPException(409, f"Máximo {db.MAX_GYMS} espacios guardados")


def _gym_full(row: dict[str, Any]) -> dict[str, Any]:
    """Espacio con su inventario y su curacion en linea.

    El filtro de ejercicios necesita el inventario del espacio activo en TODAS
    las pantallas: mandarlo de una vez evita una peticion por cambio de espacio
    y quita un estado de carga del selector de la cabecera. La curacion es
    esparcida, asi que son unos pocos KB de ids cortos aunque se oculten cientos
    de ejercicios.
    """
    inventory = db.list_gym_equipment(row["id"])
    prefs = db.list_exercise_prefs(row["id"])
    return {
        **gyms.gym_out(row),
        "equipment": inventory,
        "curation": {
            "favorites": sorted(k for k, v in prefs.items() if v == gyms.STATE_FAVORITE),
            "hidden": sorted(k for k, v in prefs.items() if v == gyms.STATE_HIDDEN),
        },
    }


def _gym_list() -> dict[str, Any]:
    rows = db.list_gyms()
    return {
        "gyms": [_gym_full(r) for r in rows],
        "effective_gym_id": db.resolve_gym_id(None),
        "max_gyms": db.MAX_GYMS,
    }


@app.get("/api/gyms")
def get_gyms() -> dict[str, Any]:
    return _gym_list()


@app.post("/api/gyms", status_code=201)
def create_gym(body: GymIn) -> dict[str, Any]:
    _check_room_for_one_more_gym()
    _check_gym_name_free(body.name)
    return _gym_full(db.create_gym(body.model_dump()))


@app.get("/api/gyms/{gym_id}")
def get_gym(gym_id: int) -> dict[str, Any]:
    return _gym_full(_gym_or_404(gym_id))


@app.patch("/api/gyms/{gym_id}")
def patch_gym(gym_id: int, body: GymPatchIn) -> dict[str, Any]:
    current = _gym_or_404(gym_id)
    if body.name:
        _check_gym_name_free(body.name, exclude_id=gym_id)
    updated = db.update_gym(gym_id, body.model_dump(exclude_none=True))
    return _gym_full(updated or current)


@app.post("/api/gyms/{gym_id}/duplicate", status_code=201)
def duplicate_gym(gym_id: int, body: GymDuplicateIn) -> dict[str, Any]:
    _gym_or_404(gym_id)
    _check_room_for_one_more_gym()
    if body.name:
        _check_gym_name_free(body.name)
    copy = db.duplicate_gym(gym_id, body.name)
    if copy is None:
        raise HTTPException(404, "Espacio no encontrado")
    return _gym_full(copy)


@app.delete("/api/gyms/{gym_id}")
def delete_gym(gym_id: int, reassign_to: int | None = None) -> dict[str, Any]:
    """Borrar un espacio NO toca los planes anclados a el por defecto: devuelve
    `plans_orphaned` para que la UI ofrezca re-anclarlos. Dejar el ancla
    colgando y avisar es reversible; reasignar en silencio no lo es.

    Con `?reassign_to=N` si los reescribe, de forma explicita.
    """
    _gym_or_404(gym_id)
    if db.count_gyms() <= 1:
        # Sin espacios no hay inventario y resolve_gym_id() devolveria None.
        raise HTTPException(409, "No puedes borrar tu único espacio")
    if reassign_to is not None:
        if reassign_to == gym_id:
            raise HTTPException(409, "El espacio de destino no puede ser el que borras")
        _gym_or_404(reassign_to)

    anchored = [r for r in db.list_plans() if r["payload"].get("gym_id") == gym_id]
    reassigned: list[int] = []
    for row in anchored:
        if reassign_to is not None:
            db.update_plan(row["id"], payload={**row["payload"], "gym_id": reassign_to})
            reassigned.append(row["id"])

    db.delete_gym(gym_id)
    return {
        "deleted": gym_id,
        "plans_reassigned": reassigned,
        "plans_orphaned": [] if reassign_to is not None else [r["id"] for r in anchored],
        **_gym_list(),
    }


@app.get("/api/gyms/{gym_id}/equipment")
def get_gym_equipment(gym_id: int) -> list[dict[str, Any]]:
    _gym_or_404(gym_id)
    return db.list_gym_equipment(gym_id)


@app.post("/api/gyms/{gym_id}/equipment", status_code=201)
def add_gym_equipment(gym_id: int, body: GymEquipmentIn) -> dict[str, Any]:
    _gym_or_404(gym_id)
    if db.count_gym_equipment(gym_id) >= db.MAX_EQUIPMENT_PER_GYM:
        raise HTTPException(409, f"Máximo {db.MAX_EQUIPMENT_PER_GYM} equipos por espacio")
    return db.add_gym_equipment(
        gym_id, body.name, body.equipment_type, body.weight_kg, body.quantity
    )


@app.delete("/api/gyms/{gym_id}/equipment/{equipment_id}")
def delete_gym_equipment(gym_id: int, equipment_id: int) -> dict[str, str]:
    _gym_or_404(gym_id)
    if not db.delete_gym_equipment(gym_id, equipment_id):
        raise HTTPException(404, "Equipo no encontrado en este espacio")
    return {"status": "deleted"}


def _library(gym_id: int) -> dict[str, Any]:
    return gyms.curated_library(
        gym_id, db.list_gym_equipment(gym_id), db.list_exercise_prefs(gym_id)
    )


@app.get("/api/gyms/{gym_id}/library")
def get_gym_library(gym_id: int) -> dict[str, Any]:
    _gym_or_404(gym_id)
    return _library(gym_id)


# Ojo al orden: /library/bulk se registra ANTES que /library/{exercise_id}, o la
# ruta con parametro se traga «bulk» como si fuera un id.
@app.post("/api/gyms/{gym_id}/library/bulk")
def bulk_mark_library(gym_id: int, body: LibraryBulkIn) -> dict[str, Any]:
    _gym_or_404(gym_id)
    emap = catalog.exercise_map()
    known = [(m.exercise_id, m.state) for m in body.marks if m.exercise_id in emap]
    ignored = [m.exercise_id for m in body.marks if m.exercise_id not in emap]
    # Los ids desconocidos se ignoran y se reportan en vez de tumbar el lote
    # entero: misma filosofia de recortar-en-vez-de-rechazar que plans._clamp.
    db.set_exercise_prefs(gym_id, known)
    return {**_library(gym_id), "ignored": ignored}


@app.put("/api/gyms/{gym_id}/library/{exercise_id}")
def mark_library_exercise(gym_id: int, exercise_id: str, body: ExercisePrefIn) -> dict[str, Any]:
    _gym_or_404(gym_id)
    if exercise_id not in catalog.exercise_map():
        raise HTTPException(404, "Ejercicio no encontrado")
    state = db.set_exercise_pref(gym_id, exercise_id, body.state)
    return {"exercise_id": exercise_id, "state": state, **_library(gym_id)}


def _payload_from(body: Any, base: dict[str, Any] | None = None) -> dict[str, Any]:
    """Arma el payload a guardar a partir del cuerpo de la peticion, conservando
    lo que el cliente no haya mandado.

    Cada campo nuevo del payload TIENE que aparecer aqui. Si se anade al
    normalizador y se olvida en esta funcion, el PUT (que llama sin `base`) lo
    borra en silencio en cada guardado y ningun test lo pilla.
    """
    doc = dict(base or {})
    if getattr(body, "days", None) is not None:
        doc["days"] = [d.model_dump() for d in body.days]
    if getattr(body, "goals", None) is not None:
        doc["goals"] = body.goals.model_dump()
    if getattr(body, "rest_seconds", None) is not None:
        doc["rest_seconds"] = body.rest_seconds
    if getattr(body, "indirect_weight", None) is not None:
        doc["indirect_weight"] = body.indirect_weight
    if getattr(body, "gym_id", None) is not None:
        doc["gym_id"] = body.gym_id
    if getattr(body, "objective", None) is not None:
        doc["objective"] = body.objective
    return doc


@app.get("/api/plans")
def get_plans() -> dict[str, Any]:
    return _plan_list()


@app.post("/api/plans", status_code=201)
def create_plan(body: PlanCreateIn) -> dict[str, Any]:
    _check_room_for_one_more()
    _check_name_free(body.name)
    row = db.create_plan(body.name, _payload_from(body), activate=body.activate)
    return _plan_out(row)


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: int) -> dict[str, Any]:
    return _plan_out(_plan_or_404(plan_id))


@app.put("/api/plans/{plan_id}")
def put_plan(plan_id: int, body: PlanUpdateIn) -> dict[str, Any]:
    current = _plan_or_404(plan_id)
    _check_name_free(body.name, exclude_id=plan_id)
    # Reemplazo completo: lo que no venga vuelve a su valor por defecto, salvo
    # el nombre. Por eso el cliente manda siempre el documento entero.
    updated = db.update_plan(plan_id, name=body.name, payload=_payload_from(body))
    return _plan_out(updated or current)


@app.patch("/api/plans/{plan_id}")
def patch_plan(plan_id: int, body: PlanPatchIn) -> dict[str, Any]:
    current = _plan_or_404(plan_id)
    if body.name:
        _check_name_free(body.name, exclude_id=plan_id)
    updated = db.update_plan(
        plan_id, name=body.name, payload=_payload_from(body, current["payload"])
    )
    return _plan_out(updated or current)


@app.post("/api/plans/{plan_id}/duplicate", status_code=201)
def duplicate_plan(plan_id: int, body: PlanDuplicateIn) -> dict[str, Any]:
    _plan_or_404(plan_id)
    _check_room_for_one_more()
    if body.name:
        _check_name_free(body.name)
    row = db.duplicate_plan(plan_id, body.name)
    if row is None:
        raise HTTPException(404, "Plan no encontrado")
    return _plan_out(row)


@app.post("/api/plans/{plan_id}/activate")
def activate_plan(plan_id: int) -> dict[str, Any]:
    _plan_or_404(plan_id)
    db.activate_plan(plan_id)
    return _plan_list()


@app.delete("/api/plans/{plan_id}")
def delete_plan(plan_id: int) -> dict[str, Any]:
    _plan_or_404(plan_id)
    if db.count_plans() <= 1:
        raise HTTPException(409, "No puedes borrar tu único plan")
    # Borrar el activo si esta permitido: delete_plan activa el siguiente. En una
    # app de un solo usuario, bloquearlo obliga a un baile de dos pasos sin ganar
    # nada.
    result = db.delete_plan(plan_id)
    return {**result, **_plan_list()}


@app.get("/api/week")
def get_week() -> dict[str, Any]:
    """Plan activo mas la semana en curso.

    `date`, `completed`, `session_rpe` y `volume_kg` se calculan aqui a partir de
    la tabla sessions y nunca se guardan dentro del plan (ver el comentario en
    frontend/src/lib/api.ts:30-33).

    Incluye tambien el listado de planes para que el arranque del SPA no necesite
    una peticion extra.
    """
    row = db.get_active_plan()
    payload = row["payload"] if row else plans.normalize_plan_payload(catalog.default_week())
    start, end = db.week_bounds()
    load = db.compute_weekly_load(start, end)
    enriched = plans.enrich_plan(payload)
    by_date = {s["date"]: s for s in load["sessions"]}

    from datetime import datetime, timedelta

    start_d = datetime.fromisoformat(start).date()
    today = db.today_local()
    days_out = []
    for day in enriched["days"]:
        d = (start_d + timedelta(days=day["weekday"])).isoformat()
        day_date = datetime.fromisoformat(d).date()
        sess = by_date.get(d)
        sess_completed = bool(sess["completed"]) if sess else False
        planned_sets = sum(max(0, int(item.get("sets") or 0)) for item in day.get("items", []))
        done_sets = int(sess.get("set_count") or 0) if sess else 0
        completion_pct = round(min(done_sets / planned_sets, 1) * 100) if planned_sets else 0
        # Descanso = día del plan sin series. No forzar «future» en esos
        # días: el cliente debe poder distinguir pendiente vs descanso.
        if day_date > today:
            status = "future" if planned_sets > 0 else "rest"
        elif planned_sets > 0:
            if done_sets >= planned_sets:
                status = "completed"
            elif done_sets > 0:
                status = "partial"
            else:
                status = "missed"
        elif sess_completed:
            status = "bonus"
        else:
            status = "rest"
        days_out.append(
            {
                **day,
                "date": d,
                "completed": sess_completed,
                "session_rpe": sess.get("session_rpe") if sess else None,
                "volume_kg": sess.get("volume_kg") if sess else 0,
                "planned_sets": planned_sets,
                "done_sets": done_sets,
                "completion_pct": completion_pct,
                "status": status,
            }
        )
    listing = _plan_list()
    # Los campos derivados del espacio (`gym`, `gym_missing`, `effective_gym_id`)
    # salen de _plan_out para que /api/week y /api/plans/{id} devuelvan la misma
    # forma y el cliente no tenga dos caminos.
    base = (
        _plan_out(row)
        if row
        else {"gym": None, "gym_missing": False, "effective_gym_id": db.resolve_gym_id(None)}
    )
    return {
        "plan": {
            **base,
            **enriched,
            "gym": base["gym"],
            "gym_missing": base["gym_missing"],
            "effective_gym_id": base["effective_gym_id"],
            "days": days_out,
            "id": row["id"] if row else None,
        },
        "load": load,
        "plans": listing["plans"],
        "active_id": listing["active_id"],
    }


@app.put("/api/week")
def put_week(body: WeekPlanIn) -> dict[str, Any]:
    """DEPRECADO: escribe sobre el plan activo. Sigue aqui para que un cliente
    anterior a la pestana Plan funcione durante la transicion; lo nuevo usa
    PUT /api/plans/{id}.

    Acepta dias v1 (exercise_ids) y v2 (items) indistintamente, y conserva los
    objetivos del plan porque el cliente viejo no los manda.
    """
    row = db.get_active_plan()
    if row is None:
        raise HTTPException(409, "No hay ningún plan activo")
    if body.name.strip().casefold() != row["payload"]["name"].casefold():
        _check_name_free(body.name, exclude_id=row["id"])
    updated = db.update_plan(
        row["id"], name=body.name, payload={**row["payload"], "days": body.days}
    )
    return _plan_out(updated or row)


@app.get("/api/sessions")
def list_sessions_range(
    start: str = Query(..., description="Fecha ISO inclusive"),
    end: str = Query(..., description="Fecha ISO inclusive"),
) -> dict[str, Any]:
    """Resumen por dia de un rango, sin las series.

    Es lo que necesita el navegador de fechas de Registrar para pintar la tira
    de la semana: si un dia tiene sesion, si esta completada y cuanto volumen
    lleva. Bajar las series de siete dias para eso seria desproporcionado, y
    /api/load trae ademas carreras y pesajes que aqui no pintan nada.
    """
    try:
        start_d, end_d = date.fromisoformat(start), date.fromisoformat(end)
    except ValueError:
        raise HTTPException(422, "Fechas en formato YYYY-MM-DD") from None
    if end_d < start_d:
        raise HTTPException(422, "`end` es anterior a `start`")
    # Un rango abierto barreria la tabla entera. Dos meses cubre de sobra
    # cualquier vista de calendario que el cliente quiera pintar de una vez.
    if (end_d - start_d).days > 62:
        raise HTTPException(422, "El rango no puede pasar de 62 dias")
    return {"start": start, "end": end, "sessions": db.list_sessions(start, end)}


@app.get("/api/sessions/{day}")
def get_session(day: str) -> dict[str, Any]:
    sess = db.get_session(day)
    if not sess:
        return {"date": day, "completed": False, "sets": []}
    return sess


@app.post("/api/sessions")
def post_session(body: SessionIn) -> dict[str, Any]:
    """Registra la sesion de un dia. Ver `SessionIn.mode` para que pasa con lo
    que ya estaba registrado y no viene en el payload."""
    # Solo Registrar manda mood/health/energy/feedback. TrainingMode y otros
    # callers no los tocan: si los pusiéramos a NULL en cada save, borrarían
    # el check-in al terminar un entrenamiento.
    has_checkin = any(
        name in body.model_fields_set
        for name in ("mood", "health", "energy", "exercise_feedback")
    )
    sess = db.upsert_session(
        body.date,
        focus=body.focus,
        completed=body.completed,
        session_rpe=body.session_rpe,
        notes=body.notes,
        mood=body.mood,
        health=body.health,
        energy=body.energy,
        exercise_feedback=body.exercise_feedback,
        clear_checkin=has_checkin,
    )
    write = db.merge_session_sets if body.mode == "merge" else db.replace_session_sets
    sets = write(sess["id"], [s.model_dump() for s in body.sets])
    out = db.get_session(body.date)
    assert out
    out["sets"] = sets
    return out


@app.post("/api/sessions/{day}/toggle")
def toggle_day(day: str, completed: bool = True) -> dict[str, Any]:
    return db.upsert_session(day, completed=completed)


@app.get("/api/metrics/body")
def get_body_metrics(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    items = db.list_body_metrics(limit=limit, offset=offset)
    total = db.count_body_metrics()
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(items) < total,
    }


@app.get("/api/metrics/body/series")
def get_body_metric_series() -> dict[str, Any]:
    items = db.list_body_metric_series()
    return {"items": items, "total": len(items), "fields": list(db.BODY_SERIES_COLUMNS)}


@app.post("/api/metrics/body")
def post_body_metric(body: BodyMetricIn) -> dict[str, Any]:
    return _body_metric_from_payload(body)


@app.patch("/api/metrics/body/{metric_id}")
def patch_body_metric(metric_id: int, body: BodyMetricPatchIn) -> dict[str, Any]:
    if db.get_body_metric(metric_id) is None:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    updated = db.update_body_metric(metric_id, body.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return updated


@app.post("/api/metrics/body/with-photos")
async def post_body_metric_with_photos(
    payload: str = Form(...),
    photos: list[UploadFile] | None = File(default=None),
) -> dict[str, Any]:
    uploads = photos or []
    if len(uploads) > MAX_BODY_PHOTOS:
        raise HTTPException(status_code=400, detail="Puedes adjuntar hasta 3 fotos por medición")
    try:
        body = BodyMetricIn.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    try:
        photo_store.ensure_ready()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    prepared = [await _read_photo_upload(upload) for upload in uploads]
    metric = _body_metric_from_payload(body)
    saved_photos = []
    uploaded_keys = []
    try:
        for index, photo in enumerate(prepared):
            object_key = f"body-metrics/{metric['id']}/{uuid4().hex}{photo['extension']}"
            photo_store.put_photo(object_key, photo["data"], photo["content_type"])
            uploaded_keys.append(object_key)
            saved_photos.append(
                db.add_body_metric_photo(
                    metric["id"],
                    object_key,
                    photo["original_name"],
                    photo["content_type"],
                    len(photo["data"]),
                    index,
                )
            )
    except Exception as exc:
        for key in uploaded_keys:
            try:
                photo_store.delete_photo(key)
            except Exception:
                pass
        raise HTTPException(status_code=502, detail="No se pudieron guardar las fotos") from exc

    metric["photos"] = saved_photos
    return metric


@app.get("/api/metrics/body/photos/{photo_id}")
def get_body_metric_photo(photo_id: int) -> Response:
    photo = db.get_body_metric_photo(photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    try:
        data = photo_store.get_photo(photo["object_key"])
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Foto no encontrada") from exc
    return Response(
        content=data,
        media_type=photo["content_type"],
        headers={"Cache-Control": "private, max-age=3600"},
    )


@app.put("/api/metrics/body/photos/{photo_id}")
async def replace_body_metric_photo(
    photo_id: int,
    photo: UploadFile = File(...),
) -> dict[str, Any]:
    current = db.get_body_metric_photo(photo_id)
    if not current:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    try:
        photo_store.ensure_ready()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    prepared = await _read_photo_upload(photo)
    metric_id = current["body_metric_id"]
    object_key = f"body-metrics/{metric_id}/{uuid4().hex}{prepared['extension']}"
    try:
        photo_store.put_photo(object_key, prepared["data"], prepared["content_type"])
        db.replace_body_metric_photo(
            photo_id,
            object_key,
            prepared["original_name"],
            prepared["content_type"],
            len(prepared["data"]),
        )
    except Exception as exc:
        try:
            photo_store.delete_photo(object_key)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="No se pudo reemplazar la foto") from exc

    old_key = current.get("object_key")
    if old_key and old_key != object_key:
        try:
            photo_store.delete_photo(old_key)
        except Exception:
            pass

    refreshed = db.get_body_metric(metric_id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return refreshed


@app.delete("/api/metrics/body/photos/{photo_id}")
def delete_body_metric_photo(photo_id: int) -> dict[str, Any]:
    current = db.get_body_metric_photo(photo_id)
    if not current:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    deleted = db.delete_body_metric_photo(photo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    old_key = deleted.get("object_key")
    if old_key:
        try:
            photo_store.delete_photo(old_key)
        except Exception:
            pass

    refreshed = db.get_body_metric(deleted["body_metric_id"])
    if not refreshed:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return refreshed


@app.post("/api/metrics/body/{metric_id}/photos")
async def add_photos_to_body_metric(
    metric_id: int,
    photos: list[UploadFile] | None = File(default=None),
) -> dict[str, Any]:
    metric = db.get_body_metric(metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Medición no encontrada")

    uploads = photos or []
    if not uploads:
        raise HTTPException(status_code=400, detail="Adjunta al menos una foto")

    existing = db.body_metric_photo_count(metric_id)
    if existing + len(uploads) > MAX_BODY_PHOTOS:
        remaining = max(0, MAX_BODY_PHOTOS - existing)
        raise HTTPException(
            status_code=400,
            detail=f"Esta medición ya tiene {existing}/3 fotos. Puedes añadir {remaining} más.",
        )

    try:
        photo_store.ensure_ready()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    prepared = [await _read_photo_upload(upload) for upload in uploads]
    sort_order = db.next_body_metric_photo_sort(metric_id)
    uploaded_keys = []
    try:
        for offset, photo in enumerate(prepared):
            object_key = f"body-metrics/{metric_id}/{uuid4().hex}{photo['extension']}"
            photo_store.put_photo(object_key, photo["data"], photo["content_type"])
            uploaded_keys.append(object_key)
            db.add_body_metric_photo(
                metric_id,
                object_key,
                photo["original_name"],
                photo["content_type"],
                len(photo["data"]),
                sort_order + offset,
            )
    except Exception as exc:
        for key in uploaded_keys:
            try:
                photo_store.delete_photo(key)
            except Exception:
                pass
        raise HTTPException(status_code=502, detail="No se pudieron guardar las fotos") from exc

    refreshed = db.get_body_metric(metric_id)
    if not refreshed:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return refreshed


@app.post("/api/metrics/body/import")
def import_body_metrics(csv_text: str = Body(media_type="text/plain")) -> dict[str, Any]:
    return db.import_renpho_csv(csv_text)


@app.post("/api/metrics/body/renpho")
def import_renpho_body_metrics(
    body: RenphoBodyMetricImportIn,
    request: Request,
) -> dict[str, Any]:
    require_sync_token(request)
    metrics = [metric.model_dump() for metric in body.measurements]
    return db.import_renpho_measurements(metrics)


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "***"
    visible = local[:2] if len(local) >= 2 else local[:1]
    return f"{visible}***@{domain}"


def _require_fernet() -> None:
    if not secrets_crypto.configured():
        raise HTTPException(
            status_code=503,
            detail="Integraciones no configuradas (falta COACHFIT_FERNET_KEY)",
        )


def _renpho_public_status(row: dict[str, Any] | None) -> dict[str, Any]:
    if not row:
        return {
            "connected": False,
            "email_masked": None,
            "last_sync_at": None,
            "last_sync_status": None,
            "last_sync_detail": None,
        }
    return {
        "connected": True,
        "email_masked": _mask_email(row["email"]),
        "last_sync_at": row.get("last_sync_at"),
        "last_sync_status": row.get("last_sync_status"),
        "last_sync_detail": row.get("last_sync_detail"),
    }


@app.get("/api/integrations/renpho")
def get_renpho_integration(_user: CurrentUser) -> dict[str, Any]:
    _require_fernet()
    return _renpho_public_status(db.get_integration(db.RENPHO_PROVIDER))


@app.put("/api/integrations/renpho")
def connect_renpho(body: RenphoConnectIn, _user: CurrentUser) -> dict[str, Any]:
    _require_fernet()
    try:
        renpho.verify_credentials(body.email, body.password)
        encrypted = secrets_crypto.encrypt(body.password)
    except renpho.RenphoError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except secrets_crypto.SecretsCryptoError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    row = db.upsert_integration_credentials(
        db.RENPHO_PROVIDER, body.email, encrypted
    )
    return _renpho_public_status(row)


@app.delete("/api/integrations/renpho")
def disconnect_renpho(_user: CurrentUser) -> dict[str, Any]:
    _require_fernet()
    db.clear_integration(db.RENPHO_PROVIDER)
    return _renpho_public_status(None)


@app.post("/api/integrations/renpho/sync")
def sync_renpho(_user: CurrentUser) -> dict[str, Any]:
    _require_fernet()
    row = db.get_integration(db.RENPHO_PROVIDER)
    if not row:
        raise HTTPException(status_code=400, detail="Renpho no esta conectado")
    try:
        password = secrets_crypto.decrypt(row["password_encrypted"])
        result = renpho.sync_measurements(row["email"], password)
    except secrets_crypto.SecretsCryptoError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except renpho.RenphoError as exc:
        db.touch_integration_sync(
            db.RENPHO_PROVIDER, status="error", detail=str(exc)[:500]
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        db.touch_integration_sync(
            db.RENPHO_PROVIDER, status="error", detail=str(exc)[:500]
        )
        raise HTTPException(status_code=500, detail=f"Sync fallido: {exc}") from exc

    imported = int(result.get("imported") or 0)
    fetched = int(result.get("fetched") or 0)
    detail = f"imported={imported} fetched={fetched}"
    status_row = db.touch_integration_sync(
        db.RENPHO_PROVIDER, status="ok", detail=detail
    )
    return {
        **result,
        "integration": _renpho_public_status(status_row),
    }


def _public_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Lo que sale hacia el cliente. `photo_object_key` se queda dentro: el
    navegador solo necesita `photo_url`, y la ruta del bucket no le sirve."""
    public = {
        "has_photo": profile["has_photo"],
        "photo_url": profile["photo_url"],
        "photo_content_type": profile["photo_content_type"],
        "photo_original_name": profile["photo_original_name"],
        "photo_size_bytes": profile["photo_size_bytes"],
        "updated_at": profile["updated_at"],
        "age": profile.get("age"),
    }
    for field in db.USER_PROFILE_EDITABLE_FIELDS:
        public[field] = profile.get(field)
    return public


@app.get("/api/profile")
def get_profile() -> dict[str, Any]:
    return _public_profile(db.get_user_profile())


@app.patch("/api/profile")
def patch_profile(body: UserProfileIn) -> dict[str, Any]:
    return _public_profile(db.update_user_profile(body.model_dump(exclude_unset=True)))


@app.get("/api/profile/photo")
def get_profile_photo() -> Response:
    profile = db.get_user_profile()
    if not profile["has_photo"] or not profile["photo_object_key"]:
        raise HTTPException(status_code=404, detail="Sin foto de perfil")
    try:
        data = photo_store.get_photo(profile["photo_object_key"])
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Sin foto de perfil") from exc
    return Response(
        content=data,
        media_type=profile["photo_content_type"] or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@app.put("/api/profile/photo")
async def put_profile_photo(photo: UploadFile = File(...)) -> dict[str, Any]:
    try:
        photo_store.ensure_ready()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    prepared = await _read_photo_upload(photo)
    previous = db.get_user_profile()
    object_key = f"profile/avatar-{uuid4().hex}{prepared['extension']}"
    try:
        photo_store.put_photo(object_key, prepared["data"], prepared["content_type"])
        profile = db.set_user_profile_photo(
            object_key,
            prepared["content_type"],
            prepared["original_name"],
            len(prepared["data"]),
        )
    except Exception as exc:
        try:
            photo_store.delete_photo(object_key)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="No se pudo guardar la foto de perfil") from exc

    old_key = previous.get("photo_object_key")
    if old_key and old_key != object_key:
        try:
            photo_store.delete_photo(old_key)
        except Exception:
            pass

    return _public_profile(profile)


@app.delete("/api/profile/photo")
def delete_profile_photo() -> dict[str, Any]:
    previous = db.get_user_profile()
    profile = db.clear_user_profile_photo()
    old_key = previous.get("photo_object_key")
    if old_key:
        try:
            photo_store.delete_photo(old_key)
        except Exception:
            pass
    return _public_profile(profile)


@app.get("/api/profile/summary")
def get_profile_summary(days: int = 28) -> dict[str, Any]:
    return db.profile_summary(days)


@app.get("/api/metrics/runs")
def get_runs() -> list[dict[str, Any]]:
    return db.list_runs()


@app.post("/api/metrics/runs")
def post_run(body: RunIn) -> dict[str, Any]:
    return db.add_run(
        body.date,
        body.distance_km,
        body.duration_min,
        body.pace_min_per_km,
        body.rpe,
        body.notes,
    )


@app.get("/api/load")
def get_load(week_start: str | None = None) -> dict[str, Any]:
    if week_start:
        from datetime import datetime, timedelta

        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        return db.compute_weekly_load(week_start, end)
    start, end = db.week_bounds()
    return db.compute_weekly_load(start, end)


@app.get("/api/coach/latest")
def coach_latest() -> dict[str, Any]:
    note = db.latest_coach_note()
    return note or {"advice": None}


@app.get("/api/dashboard/volume-by-muscle")
def dashboard_volume_by_muscle(week_start: str | None = None) -> dict[str, float]:
    """Get volume per muscle group for the week."""
    if week_start:
        from datetime import datetime, timedelta

        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        return db.get_volume_by_muscle(week_start, end)
    start, end = db.week_bounds()
    return db.get_volume_by_muscle(start, end)


@app.get("/api/dashboard/weekly-sets")
def dashboard_weekly_sets(week_start: str | None = None) -> dict[str, Any]:
    """Series hechas por ejercicio en la semana, para contrastar con lo que el
    plan prescribe. El cliente las agrupa por musculo con la misma funcion que
    usa para el plan (weeklyVolume), asi que ambas cifras son comparables."""
    if week_start:
        from datetime import datetime, timedelta

        start = datetime.fromisoformat(week_start).date()
        start_s, end_s = start.isoformat(), (start + timedelta(days=6)).isoformat()
    else:
        start_s, end_s = db.week_bounds()
    counts = db.get_exercise_set_counts(start_s, end_s)
    return {
        "week_start": start_s,
        "week_end": end_s,
        "sets": counts,
        "total_sets": sum(counts.values()),
    }


@app.get("/api/dashboard/exercise-frequency")
def dashboard_exercise_frequency(week_start: str | None = None) -> dict[str, Any]:
    """Exercise frequency over the last 4 weeks (or a specific week if given).

    A single week reads "1x" for everything; a 4-week window is what
    actually distinguishes staples from one-offs.
    """
    from datetime import date, datetime, timedelta

    if week_start:
        start_d = datetime.fromisoformat(week_start).date()
        end = (start_d + timedelta(days=6)).isoformat()
        freq = db.get_exercise_frequency(week_start, end)
    else:
        today = db.today_local()
        start = (today - timedelta(days=27)).isoformat()
        freq = db.get_exercise_frequency(start, today.isoformat())

    emap = catalog.exercise_map()
    return {
        "frequency": freq,
        "exercises": {eid: {"name": emap.get(eid, {}).get("name_es", eid)} for eid in freq.keys()},
    }


@app.get("/api/dashboard/exercise-history/{exercise_id}")
def dashboard_exercise_history(exercise_id: str) -> dict[str, Any]:
    """Get weight progression history for an exercise."""
    ex = catalog.exercise_map().get(exercise_id)
    if not ex:
        raise HTTPException(404, "Ejercicio no encontrado")
    history = db.get_exercise_history(exercise_id)
    max_weight = db.get_exercise_max_weight(exercise_id)
    return {
        "exercise_id": exercise_id,
        "exercise_name": ex.get("name_es"),
        "max_weight": max_weight,
        "history": history,
    }


@app.get("/api/dashboard/muscle-coverage")
def muscle_coverage(days: int = 14) -> dict[str, Any]:
    """14-day (or custom window) per-muscle training coverage, for the Hoy tab."""
    from datetime import timedelta

    end = db.today_local()
    start = end - timedelta(days=days)
    stats = db.get_muscle_stats(start.isoformat(), end.isoformat())
    groups = [
        {
            "muscle": m,
            "sessions": s["sessions"],
            "volume_kg": round(s["volume_kg"], 1),
            "days_since_last": (end - date.fromisoformat(s["last_date"])).days if s["last_date"] else None,
            "pct": db.coverage_pct(s["sessions"], days),
        }
        for m, s in stats.items()
    ]
    return {"window_days": days, "groups": groups}


@app.get("/api/dashboard/muscle-trends")
def muscle_trends(days: int = 28) -> dict[str, Any]:
    """Per-muscle sessions/volume/trend% comparing this window to the prior
    one of equal length, plus a stale-group count ("grupos atrasados")."""
    from datetime import timedelta

    end = db.today_local()
    start = end - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    curr = db.get_muscle_stats(start.isoformat(), end.isoformat())
    prev = db.get_muscle_stats(prev_start.isoformat(), start.isoformat())
    groups = []
    for m, s in curr.items():
        p = prev.get(m, {"volume_kg": 0})
        trend: float | None = None
        if p["volume_kg"] > 0:
            trend = round((s["volume_kg"] - p["volume_kg"]) / p["volume_kg"] * 100, 1)
        elif s["volume_kg"] > 0:
            trend = 100.0
        groups.append(
            {
                "muscle": m,
                "sessions": s["sessions"],
                "volume_kg": round(s["volume_kg"], 1),
                "days_since_last": (end - date.fromisoformat(s["last_date"])).days if s["last_date"] else None,
                "trend_pct": trend,
            }
        )
    return {"window_days": days, "groups": groups, "stale_count": sum(1 for g in groups if g["sessions"] == 0)}


@app.get("/api/dashboard/strength")
def strength_dashboard(days: int = 28) -> dict[str, Any]:
    """Actionable strength overview for the selected rolling window."""
    from datetime import timedelta

    window_days = max(7, min(days, 180))
    end = db.today_local()
    start = end - timedelta(days=window_days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=window_days - 1)

    curr = db.get_muscle_stats(start.isoformat(), end.isoformat())
    prev = db.get_muscle_stats(prev_start.isoformat(), prev_end.isoformat())
    curr_summary = db.get_strength_window_summary(start.isoformat(), end.isoformat())
    prev_summary = db.get_strength_window_summary(prev_start.isoformat(), prev_end.isoformat())

    def percentage_change(current: float, previous: float) -> float | None:
        if previous > 0:
            return round((current - previous) / previous * 100, 1)
        return 100.0 if current > 0 else None

    groups = []
    for muscle, stats in curr.items():
        previous_volume = float(prev.get(muscle, {}).get("volume_kg", 0))
        groups.append(
            {
                "muscle": muscle,
                "sessions": stats["sessions"],
                "volume_kg": round(stats["volume_kg"], 1),
                "days_since_last": (
                    (end - date.fromisoformat(stats["last_date"])).days
                    if stats["last_date"]
                    else None
                ),
                "trend_pct": percentage_change(stats["volume_kg"], previous_volume),
                "coverage_pct": db.coverage_pct(stats["sessions"], window_days),
            }
        )

    exercise_map = catalog.exercise_map()
    exercises = []
    for item in db.get_strength_exercises(start.isoformat(), end.isoformat()):
        exercise = exercise_map.get(item["exercise_id"], {})
        exercises.append(
            {
                **item,
                "name": exercise.get("name_es", item["exercise_id"]),
                "muscle": exercise.get("target", "other"),
            }
        )

    all_prs = db.get_strength_prs(start.isoformat(), end.isoformat(), limit=1000)
    prs = [
        {
            **item,
            "name": exercise_map.get(item["exercise_id"], {}).get("name_es", item["exercise_id"]),
            "improvement_kg": (
                round(item["weight_kg"] - item["previous_weight_kg"], 1)
                if item["previous_weight_kg"] is not None
                else None
            ),
        }
        for item in all_prs[:8]
    ]
    stale_count = sum(1 for group in groups if group["sessions"] == 0)
    weekly_rows = db.get_strength_weekly_volume(start.isoformat(), end.isoformat())
    weekly_by_start = {row["week_start"]: row for row in weekly_rows}
    weekly_volume = []
    week_cursor = start - timedelta(days=start.weekday())
    final_week = end - timedelta(days=end.weekday())
    while week_cursor <= final_week:
        key = week_cursor.isoformat()
        weekly_volume.append(
            weekly_by_start.get(key, {"week_start": key, "sessions": 0, "volume_kg": 0.0})
        )
        week_cursor += timedelta(days=7)

    return {
        "window_days": window_days,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "summary": {
            "volume_kg": round(curr_summary["volume_kg"], 1),
            "volume_change_pct": percentage_change(
                curr_summary["volume_kg"], prev_summary["volume_kg"]
            ),
            "sessions": curr_summary["sessions"],
            "sessions_change": curr_summary["sessions"] - prev_summary["sessions"],
            "pr_count": len(all_prs),
            "active_groups": len(groups) - stale_count,
            "total_groups": len(groups),
            "stale_groups": stale_count,
        },
        "muscle_groups": groups,
        "weekly_volume": weekly_volume,
        "prs": prs,
        "exercises": exercises,
    }


@app.get("/api/dashboard/prs")
def prs_this_month(month: str | None = None) -> dict[str, Any]:
    """Count of exercises that hit a new all-time-high weight this month."""
    from datetime import timedelta

    ref = date.fromisoformat(f"{month}-01") if month else db.today_local().replace(day=1)
    next_month = (ref.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_end = (next_month - timedelta(days=1)).isoformat()
    count = db.count_prs_this_month(ref.isoformat(), month_end)
    return {"month": ref.strftime("%Y-%m"), "pr_count": count}


@app.post("/api/coach/advise")
async def coach_advise(body: CoachIn | None = None) -> dict[str, Any]:
    notes = body.notes if body else None
    result = await coach.generate_advice(notes, body.gym_id if body else None)
    # don't dump full catalog in response
    ctx = result["context"]
    return {
        "advice": result["advice"],
        "source": result["source"],
        "load": ctx["week_load"],
        "today": ctx["today"],
        "saved": result["saved"],
    }


# Serve the built frontend (frontend/dist) so a single uvicorn process is the
# whole app — handy for opening it from a phone on the same network.
# Mounted last so it never shadows the /api routes above.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="spa")
