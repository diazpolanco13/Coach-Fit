"""Politica de autenticacion y criptografia. Hermano de gyms.py y plans.py.

CERO SQL: todo el acceso a datos sigue en db.py, como manda AGENTS.md. Aqui solo
vive lo que decide (roles, expiraciones, flags de cookie) y lo que calcula
(hashes, tokens).
"""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta

import bcrypt

ROLE_ADMIN = "admin"
ROLE_ENTRENADOR = "entrenador"
ROLE_USUARIO = "usuario"
ROLES = (ROLE_ADMIN, ROLE_ENTRENADOR, ROLE_USUARIO)

COOKIE_NAME = "cf_session"
SESSION_TTL_DAYS = 30  # deslizante
SESSION_ABSOLUTE_DAYS = 90  # tope duro desde created_at, no se renueva
# La app es habladora: el dashboard dispara ~8 llamadas por pantalla. Sin este
# umbral seria una escritura por request; con el, ~1 por hora y usuario.
RENEW_AFTER_SECONDS = 3600

_ROUNDS = 12
# bcrypt trunca en 72 BYTES (no caracteres). Se rechaza en vez de truncar: una
# contrasena truncada en silencio es mas debil de lo que su dueno cree.
PASSWORD_MAX_BYTES = 72
PASSWORD_MIN_CHARS = 10

# Hash senuelo calculado una vez al importar. Se verifica contra el cuando el
# email no existe, para que el login tarde lo mismo y no filtre que correos
# estan dados de alta.
_DUMMY_HASH = bcrypt.hashpw(b"contrasena-senuelo", bcrypt.gensalt(_ROUNDS))


def normalize_role(value: str | None) -> str:
    role = (value or "").strip().lower()
    return role if role in ROLES else ROLE_USUARIO


def is_privileged(role: str | None) -> bool:
    return normalize_role(role) in (ROLE_ADMIN, ROLE_ENTRENADOR)


# --- Contrasenas -----------------------------------------------------------


class PasswordError(ValueError):
    """Contrasena que no cumple la politica. El mensaje va al cliente tal cual."""


def validate_password(plain: str) -> str:
    if len(plain) < PASSWORD_MIN_CHARS:
        raise PasswordError(
            f"La contrasena debe tener al menos {PASSWORD_MIN_CHARS} caracteres."
        )
    if len(plain.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise PasswordError(
            f"La contrasena no puede superar {PASSWORD_MAX_BYTES} bytes."
        )
    return plain


def hash_password(plain: str) -> str:
    validate_password(plain)
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(_ROUNDS)).decode("ascii")


def verify_password(plain: str, hashed: str | None) -> bool:
    """Constante en tiempo, y tambien cuando el usuario NO existe: en ese caso se
    verifica contra el senuelo para gastar los mismos milisegundos."""
    raw = plain.encode("utf-8")[:PASSWORD_MAX_BYTES]
    if not hashed:
        bcrypt.checkpw(raw, _DUMMY_HASH)
        return False
    try:
        return bcrypt.checkpw(raw, hashed.encode("ascii"))
    except ValueError:
        # Hash corrupto o de otro formato. No es motivo para un 500.
        return False


def temporary_password() -> str:
    """Contrasena inicial que el creador pasa por WhatsApp. Se muestra una sola
    vez y `must_change_password` obliga a rotarla en el primer login."""
    return secrets.token_urlsafe(9)


# --- Tokens de sesion ------------------------------------------------------


def new_token() -> str:
    return secrets.token_urlsafe(32)  # 256 bits


def token_hash(token: str) -> str:
    """Lo unico que se guarda. La validacion es un lookup por clave primaria, asi
    que no hay ninguna comparacion de strings en Python que temporizar."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry(now: datetime | None = None) -> str:
    base = now or datetime.now()
    return (base + timedelta(days=SESSION_TTL_DAYS)).isoformat(timespec="seconds")


def absolute_cutoff(now: datetime | None = None) -> str:
    """Ninguna sesion creada antes de este instante puede renovarse."""
    base = now or datetime.now()
    return (base - timedelta(days=SESSION_ABSOLUTE_DAYS)).isoformat(timespec="seconds")


# --- Configuracion de entorno ----------------------------------------------


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


def cookie_secure() -> bool:
    """Por defecto True; en desarrollo se apaga con COACHFIT_COOKIE_SECURE=0.

    NO se autodetecta con request.url.scheme: detras de Traefik uvicorn ve http
    salvo que arranque con --proxy-headers. Variable explicita, sin magia.

    Si el flag queda mal en desarrollo el sintoma es mudo: el login responde 200
    con Set-Cookie pero el navegador descarta la cookie sobre http://127.0.0.1 y
    /api/auth/me entra en bucle de 401 sin ningun error visible.
    """
    return _flag("COACHFIT_COOKIE_SECURE", "1")


def enforce() -> bool:
    """Interruptor de la puerta. Con COACHFIT_AUTH_ENFORCE=0 el middleware
    resuelve la cookie pero deja pasar a todo el mundo: es el modo auditoria con
    el que se despliega la primera fase sin romper nada."""
    return _flag("COACHFIT_AUTH_ENFORCE", "1")


def cookie_kwargs(max_age: int | None = None) -> dict[str, object]:
    kwargs: dict[str, object] = {
        "httponly": True,
        "samesite": "lax",
        "secure": cookie_secure(),
        "path": "/",
    }
    if max_age is not None:
        kwargs["max_age"] = max_age
    return kwargs


# --- Rate limiting del login -----------------------------------------------

LOGIN_WINDOW_MINUTES = 15
LOGIN_MAX_PER_EMAIL = 5
LOGIN_MAX_PER_IP = 20
LOGIN_LOCK_THRESHOLD = 10
LOGIN_LOCK_MINUTES = 30


def lock_until(now: datetime | None = None) -> str:
    base = now or datetime.now()
    return (base + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat(timespec="seconds")


def attempt_window_start(now: datetime | None = None) -> str:
    base = now or datetime.now()
    return (base - timedelta(minutes=LOGIN_WINDOW_MINUTES)).isoformat(timespec="seconds")


# --- Proyeccion de usuario hacia la API ------------------------------------

# Lo unico que sale de la API. Explicito y no una lista negra: password_hash no
# puede colarse aunque alguien anada columnas a la tabla.
PUBLIC_USER_FIELDS = (
    "id",
    "email",
    "full_name",
    "role",
    "trainer_id",
    "must_change_password",
    "is_active",
)


def public_user(row: dict | None) -> dict | None:
    if row is None:
        return None
    out = {k: row.get(k) for k in PUBLIC_USER_FIELDS}
    out["must_change_password"] = bool(row.get("must_change_password"))
    out["is_active"] = bool(row.get("is_active"))
    return out
