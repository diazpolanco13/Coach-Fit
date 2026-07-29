"""Cifrado simetrico para secretos de integraciones (p. ej. password Renpho).

Usa Fernet (AES-128-CBC + HMAC). La clave vive solo en env: COACHFIT_FERNET_KEY
(url-safe base64 de 32 bytes). Sin ella, las integraciones no arrancan.
"""

from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken

_ENV = "COACHFIT_FERNET_KEY"


class SecretsCryptoError(RuntimeError):
    pass


def _fernet() -> Fernet:
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
    return bool(os.getenv(_ENV, "").strip())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise SecretsCryptoError("No se pudo descifrar el secreto") from exc
