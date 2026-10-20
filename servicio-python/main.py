import asyncio
import re
from datetime import date
from uuid import UUID

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cliente_java import obtener_resumen, obtener_transacciones

load_dotenv()

app = FastAPI(title="Servicio de Reportes", version="1.0.0")

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
    datos = await obtener_resumen(str(usuario_id), mes)
    return ResumenMensual(
        usuarioId=str(usuario_id),
        mes=mes,
        totalIngresos=float(datos["totalIngresos"]),
        totalGastos=float(datos["totalGastos"]),
        balance=float(datos["balance"]),
    )


@app.get("/api/reportes/categorias/{usuario_id}", response_model=ReporteCategorias)
async def reporte_categorias(usuario_id: UUID, mes: str):
    _validar_mes(mes)
    transacciones = await obtener_transacciones(str(usuario_id), mes, tipo="GASTO")

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
    return ReporteCategorias(
        usuarioId=str(usuario_id),
        mes=mes,
        totalGastos=round(total, 2),
        categorias=categorias,
    )


@app.get("/api/reportes/tendencia/{usuario_id}", response_model=ReporteTendencia)
async def reporte_tendencia(usuario_id: UUID):
    meses = _ultimos_meses(6)
    resultados = await asyncio.gather(
        *(obtener_resumen(str(usuario_id), m) for m in meses)
    )
    puntos = [
        PuntoTendencia(
            mes=mes,
            totalIngresos=float(datos["totalIngresos"]),
            totalGastos=float(datos["totalGastos"]),
            balance=float(datos["balance"]),
        )
        for mes, datos in zip(meses, resultados)
    ]
    return ReporteTendencia(usuarioId=str(usuario_id), meses=puntos)
