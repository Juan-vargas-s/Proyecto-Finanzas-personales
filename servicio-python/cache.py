"""Caché Redis de corta duración para los reportes.

El dashboard pide resumen + categorías + tendencia en cada render. Sin caché
eso significa 8+ llamadas al servicio de Java (6 solo por la tendencia, que
antes era un resumen por mes). Con un TTL corto de 30s los datos siguen siendo
prácticamente en tiempo real, pero Java deja de ser martilleado.

Si Redis no está disponible el caché degrada solo: el reporte se calcula
igual, sin caché.
"""

import json
import logging
import os
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# TTL corto a propósito: en la UI los datos se refrescan cada 30s, así que
# una entrada más larga solo serviría para mostrar información rancia.
TTL_SEGUNDOS = 30

_cliente: redis.Redis | None = None


def configurar(cliente: redis.Redis | None) -> None:
    global _cliente
    _cliente = cliente


async def cerrar() -> None:
    global _cliente
    if _cliente is not None:
        await _cliente.aclose()
        _cliente = None


def _clave(usuario_id: str, tipo: str, mes: str | None = None) -> str:
    sufijo = f":{mes}" if mes else ""
    return f"cache:reportes:{usuario_id}:{tipo}{sufijo}"


async def obtener(usuario_id: str, tipo: str, mes: str | None = None) -> Any | None:
    """Devuelve el valor cacheado, o None si no hay o si Redis falla."""
    if _cliente is None:
        return None
    try:
        crudo = await _cliente.get(_clave(usuario_id, tipo, mes))
    except Exception as exc:
        logger.warning("No se pudo leer de la caché de Redis: %s", exc)
        return None
    if not crudo:
        return None
    try:
        return json.loads(crudo)
    except ValueError as exc:
        logger.warning("Entrada de caché corrupta (%s): %s", _clave(usuario_id, tipo, mes), exc)
        return None


async def guardar(usuario_id: str, tipo: str, valor: Any, mes: str | None = None) -> None:
    if _cliente is None:
        return
    try:
        await _cliente.set(_clave(usuario_id, tipo, mes), json.dumps(valor), ex=TTL_SEGUNDOS)
    except Exception as exc:
        logger.warning("No se pudo escribir en la caché de Redis: %s", exc)
