"""Cliente HTTP del servicio de transacciones (Java).

El cliente se crea una sola vez (en el lifespan de FastAPI) y se reutiliza en
todas las peticiones. Antes se abría y cerraba una conexión TCP nueva en cada
llamada, lo que multiplicaba el coste de pedir datos a Java.
"""

import os

import httpx
from fastapi import HTTPException

JAVA_SERVICE_URL = os.getenv("JAVA_SERVICE_URL", "http://servicio-java:8080").rstrip("/")

TIMEOUT = httpx.Timeout(5.0, connect=3.0)

_cliente: httpx.AsyncClient | None = None


def configurar_cliente(cliente: httpx.AsyncClient) -> None:
    global _cliente
    _cliente = cliente


async def _get(path: str, params: dict) -> dict | list:
    if _cliente is None:
        raise HTTPException(
            status_code=503,
            detail="El cliente HTTP no está inicializado",
        )
    try:
        respuesta = await _cliente.get(f"{JAVA_SERVICE_URL}{path}", params=params)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503,
            detail="El servicio de transacciones (Java) no responde a tiempo",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="El servicio de transacciones (Java) no está disponible",
        ) from exc

    if respuesta.status_code >= 500:
        raise HTTPException(
            status_code=502,
            detail="El servicio de transacciones (Java) devolvió un error interno",
        )
    if respuesta.status_code >= 400:
        raise HTTPException(
            status_code=respuesta.status_code,
            detail=f"El servicio de transacciones (Java) rechazó la petición ({respuesta.status_code})",
        )

    try:
        return respuesta.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Respuesta inválida del servicio de transacciones (Java)",
        ) from exc


async def obtener_resumen(usuario_id: str, mes: str) -> dict:
    return await _get("/api/transacciones/resumen", {"usuarioId": usuario_id, "mes": mes})


async def obtener_transacciones(usuario_id: str, mes: str, tipo: str | None = None) -> list:
    params = {"usuarioId": usuario_id, "mes": mes}
    if tipo:
        params["tipo"] = tipo
    return await _get("/api/transacciones", params)


async def obtener_tendencia(usuario_id: str, meses: list[str]) -> list:
    """Serie mensual completa en una sola llamada a Java."""
    return await _get(
        "/api/transacciones/tendencia",
        {"usuarioId": usuario_id, "meses": ",".join(meses)},
    )
