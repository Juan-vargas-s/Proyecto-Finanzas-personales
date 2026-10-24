"""Autenticación JWT del servicio de reportes (Python).

- Las peticiones del frontend llegan con el JWT del usuario (Authorization:
  Bearer ...). Se valida la firma y se comprueba que el usuario del token sea
  el mismo de la ruta; así no se puede leer el reporte de otro usuario (IDOR).
- Las llamadas internas a Java usan un JWT de servicio ("svc": true) con el
  usuarioId que se va a consultar y una caducidad de 60 segundos.
"""

import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from fastapi import Header, HTTPException


def _secreto() -> str:
    secreto = os.getenv("JWT_SECRET")
    if not secreto:
        raise HTTPException(status_code=500, detail="JWT_SECRET no configurado")
    return secreto


def usuario_autenticado(
    usuario_id: UUID,
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token JWT inválido o ausente")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token JWT inválido o ausente")

    try:
        datos = jwt.decode(
            token,
            _secreto(),
            algorithms=["HS256"],
            options={"require": ["exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token JWT expirado") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Token JWT inválido") from exc

    if datos.get("svc") is True:
        raise HTTPException(
            status_code=403,
            detail="Un token de servicio no puede consultar reportes de usuario",
        )

    uid = datos.get("usuarioId")
    if not uid:
        raise HTTPException(status_code=401, detail="Token sin usuarioId")
    if uid != str(usuario_id):
        raise HTTPException(status_code=403, detail="No puedes consultar datos de otro usuario")
    return uid


def token_servicio(usuario_id: str) -> str:
    ahora = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "usuarioId": usuario_id,
            "svc": True,
            "iat": ahora,
            "exp": ahora + timedelta(seconds=60),
        },
        _secreto(),
        algorithm="HS256",
    )
