"""Consumidor del bus de eventos: invalida la caché de reportes.

Go publica `meta.aporte.registrado` / `meta.aporte.retirado` cuando el usuario
mueve dinero a una meta. Java materializa la transacción AHORRO y este servicio
borra las entradas de caché del usuario para que el dashboard no muestre el
"disponible" anterior durante los 30 s del TTL.

Mismo patrón que los demás consumidores: grupo propio (`python`), XACK solo si
la invalidación no lanzó excepción y XAUTOCLAIM para rescatar mensajes de la
PEL si el proceso se cayó a mitad.
"""

import asyncio
import logging
import os

import redis.asyncio as redis

import cache

logger = logging.getLogger(__name__)

STREAM = os.getenv("REDIS_EVENTOS_STREAM", "eventos:finanzas")
GRUPO = os.getenv("EVENTOS_GROUP_PYTHON", "python")
CONSUMIDOR = "python-1"
LOTE = 10
BLOQUEO_MS = 5000
MIN_IDLE_MS = 60_000
VUELTAS_REAPER = 12


def _es_aporte(tipo: str) -> bool:
    return tipo in ("meta.aporte.registrado", "meta.aporte.retirado")


async def _procesar(cliente: redis.Redis, id_mensaje: str, campos: dict) -> None:
    tipo = campos.get("tipo", "")
    if not _es_aporte(tipo):
        await cliente.xack(STREAM, GRUPO, id_mensaje)
        return

    usuario_id = campos.get("usuarioId", "")
    if not usuario_id:
        await cliente.xack(STREAM, GRUPO, id_mensaje)
        return

    try:
        await cache.invalidar_usuario(usuario_id)
    except Exception as exc:  # sin XACK: queda en la PEL para reintentar
        logger.warning("Evento %s no aplicado (cache): %s", id_mensaje, exc)
        return

    await cliente.xack(STREAM, GRUPO, id_mensaje)


async def _recuperar_colgados(cliente: redis.Redis) -> None:
    try:
        _, mensajes, _ = await cliente.xautoclaim(
            STREAM, GRUPO, CONSUMIDOR, min_idle_time=MIN_IDLE_MS, start_id="0-0", count=LOTE
        )
    except Exception as exc:
        logger.warning("XAUTOCLAIM falló: %s", exc)
        return
    for id_mensaje, campos in mensajes:
        await _procesar(cliente, id_mensaje, campos)


async def _bucle(cliente: redis.Redis) -> None:
    try:
        await cliente.xgroup_create(STREAM, GRUPO, id="$", mkstream=True)
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise

    logger.info("Consumidor de aportes activo: grupo %s sobre %s", GRUPO, STREAM)
    vueltas = 0
    while True:
        try:
            respuesta = await cliente.xreadgroup(
                GRUPO, CONSUMIDOR, {STREAM: ">"}, count=LOTE, block=BLOQUEO_MS
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("XREADGROUP falló: %s", exc)
            await asyncio.sleep(2)
            continue

        for _, mensajes in respuesta or []:
            for id_mensaje, campos in mensajes:
                await _procesar(cliente, id_mensaje, campos)

        vueltas += 1
        if vueltas % VUELTAS_REAPER == 0:
            await _recuperar_colgados(cliente)


def arrancar(cliente: redis.Redis) -> asyncio.Task:
    """Lanza el consumidor como tarea de fondo y devuelve la tarea."""
    return asyncio.create_task(_bucle(cliente), name="consumidor-eventos")


async def detener(tarea: asyncio.Task | None) -> None:
    if tarea is None:
        return
    tarea.cancel()
    try:
        await tarea
    except (asyncio.CancelledError, Exception):
        pass
