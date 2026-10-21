import re
from contextlib import asynccontextmanager
from datetime import date
from uuid import UUID

import httpx
import redis.asyncio as redis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import cache
from cliente_java import (
    TIMEOUT,
    configurar_cliente,
    obtener_resumen,
    obtener_tendencia,
    obtener_transacciones,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cliente HTTP de Java y cliente de Redis compartidos por toda la app."""
    cliente = httpx.AsyncClient(timeout=TIMEOUT)
    configurar_cliente(cliente)
    try:
        cache.configurar(redis.from_url(cache.REDIS_URL, decode_responses=True))
    except Exception:
        # Sin Redis el servicio sigue funcionando, solo que sin caché.
        cache.configurar(None)
    try:
        yield
    finally:
        await cliente.aclose()
        await cache.cerrar()


app = FastAPI(title="Servicio de Reportes", version="1.0.0", lifespan=lifespan)

# El frontend (Next.js) consume este servicio a través del API Gateway (Nginx),
# así que hay que permitir peticiones cross-origin desde el navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PATRON_MES = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class ResumenMensual(BaseModel):
    usuarioId: str
    mes: str
    totalIngresos: float
    totalGastos: float
    balance: float


class GastoCategoria(BaseModel):
    categoria: str
    total: float
    porcentaje: float


class ReporteCategorias(BaseModel):
    usuarioId: str
    mes: str
    totalGastos: float
    categorias: list[GastoCategoria]


class PuntoTendencia(BaseModel):
    mes: str
    totalIngresos: float
    totalGastos: float
    balance: float


class ReporteTendencia(BaseModel):
    usuarioId: str
    meses: list[PuntoTendencia]


def _validar_mes(mes: str) -> str:
    if not PATRON_MES.fullmatch(mes):
        raise HTTPException(status_code=400, detail="Formato de mes inválido (usa YYYY-MM)")
    return mes


def _ultimos_meses(cantidad: int) -> list[str]:
    hoy = date.today()
    anio, mes = hoy.year, hoy.month
    meses = []
    for _ in range(cantidad):
        meses.append(f"{anio:04d}-{mes:02d}")
        mes -= 1
        if mes == 0:
            mes = 12
            anio -= 1
    return list(reversed(meses))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reportes"}


@app.get("/api/reportes/resumen/{usuario_id}", response_model=ResumenMensual)
async def reporte_resumen(usuario_id: UUID, mes: str):
    _validar_mes(mes)
    uid = str(usuario_id)

    en_cache = await cache.obtener(uid, "resumen", mes)
    if en_cache is not None:
        return ResumenMensual(**en_cache)

    datos = await obtener_resumen(uid, mes)
    respuesta = ResumenMensual(
        usuarioId=uid,
        mes=mes,
        totalIngresos=float(datos["totalIngresos"]),
        totalGastos=float(datos["totalGastos"]),
        balance=float(datos["balance"]),
    )
    await cache.guardar(uid, "resumen", respuesta.model_dump(), mes)
    return respuesta


@app.get("/api/reportes/categorias/{usuario_id}", response_model=ReporteCategorias)
async def reporte_categorias(usuario_id: UUID, mes: str):
    _validar_mes(mes)
    uid = str(usuario_id)

    en_cache = await cache.obtener(uid, "categorias", mes)
    if en_cache is not None:
        return ReporteCategorias(**en_cache)

    transacciones = await obtener_transacciones(uid, mes, tipo="GASTO")

    totales: dict[str, float] = {}
    for t in transacciones:
        cat = t["categoria"]
        totales[cat] = totales.get(cat, 0.0) + float(t["monto"])

    total = sum(totales.values())
    categorias = [
        GastoCategoria(
            categoria=cat,
            total=round(valor, 2),
            porcentaje=round(valor * 100 / total, 1) if total > 0 else 0.0,
        )
        for cat, valor in sorted(totales.items(), key=lambda par: par[1], reverse=True)
    ]
    respuesta = ReporteCategorias(
        usuarioId=uid,
        mes=mes,
        totalGastos=round(total, 2),
        categorias=categorias,
    )
    await cache.guardar(uid, "categorias", respuesta.model_dump(), mes)
    return respuesta


@app.get("/api/reportes/tendencia/{usuario_id}", response_model=ReporteTendencia)
async def reporte_tendencia(usuario_id: UUID):
    uid = str(usuario_id)
    meses = _ultimos_meses(6)

    en_cache = await cache.obtener(uid, "tendencia")
    if en_cache is not None:
        return ReporteTendencia(**en_cache)

    # Una sola llamada a Java por toda la serie (antes eran 6, una por mes).
    datos = await obtener_tendencia(uid, meses)
    puntos = [
        PuntoTendencia(
            mes=punto["mes"],
            totalIngresos=float(punto["totalIngresos"]),
            totalGastos=float(punto["totalGastos"]),
            balance=float(punto["balance"]),
        )
        for punto in datos
    ]
    respuesta = ReporteTendencia(usuarioId=uid, meses=puntos)
    await cache.guardar(uid, "tendencia", respuesta.model_dump())
    return respuesta
