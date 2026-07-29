"""Cifrado simetrico para secretos de integraciones (p. ej. password Renpho).

Usa Fernet (AES-128-CBC + HMAC). La clave vive solo en env: COACHFIT_FERNET_KEY
(url-safe base64 de 32 bytes). Sin ella, las integraciones no arrancan.
"""

from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

_ENV = "COACHFIT_FERNET_KEY"
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class SecretsCryptoError(RuntimeError):
    pass


def _load_env_file() -> None:
    """Misma regla que db._load_env_file: el entorno del proceso gana."""
    if not _ENV_PATH.exists():
        return
    for raw in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _fernet() -> Fernet:
    _load_env_file()
    raw = os.getenv(_ENV, "").strip()
    if not raw:
        raise SecretsCryptoError(
            f"Falta {_ENV}: genera una con "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
        )
    try:
        return Fernet(raw.encode() if isinstance(raw, str) else raw)
    except (ValueError, TypeError) as exc:
        raise SecretsCryptoError(f"{_ENV} invalida") from exc


def configured() -> bool:
    _load_env_file()
    return bool(os.getenv(_ENV, "").strip())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise SecretsCryptoError("No se pudo descifrar el secreto") from exc
