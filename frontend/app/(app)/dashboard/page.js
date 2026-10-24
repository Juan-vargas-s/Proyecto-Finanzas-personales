"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";
import { formatear, useMoneda } from "../../../lib/dinero";
import { GraficaPastel, GraficaTendencia } from "../../../components/Graficas";
import { EsqueletoGrafica } from "../../../components/Esqueleto";
import { SelectorMes, mesBonito } from "../../../components/Fechas";
import { useRecuadro } from "../../../components/Modal";

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [mes, setMes] = useState(mesActual());
  const [resumen, setResumen] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [tendencia, setTendencia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { recuadro, fallo } = useRecuadro();
  const moneda = useMoneda();

  const dinero = (v) => formatear(v, moneda);

  const uid = usuarioId();

  const cargar = useCallback(
    async (mesSeleccionado) => {
      if (!uid) return;
      setCargando(true);
      try {
        const [r, c, t] = await Promise.all([
          api(`/api/reportes/resumen/${uid}?mes=${mesSeleccionado}`),
          api(`/api/reportes/categorias/${uid}?mes=${mesSeleccionado}`),
          api(`/api/reportes/tendencia/${uid}`),
        ]);
        setResumen(r);
        setCategorias(c.categorias || []);
        setTendencia(t.meses || []);
      } catch (err) {
        fallo("No se pudo cargar el reporte", err.message);
      } finally {
        setCargando(false);
      }
    },
    [uid]
  );

  useEffect(() => {
    cargar(mes);
  }, [mes, cargar]);

  return (
    <>
      <div className="pagina-titulo">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen de tu mes, gastos por categoría y tendencia</p>
        </div>
        <div className="control-mes">
          <span>Mes</span>
          <SelectorMes valor={mes} onChange={setMes} />
        </div>
      </div>

      {recuadro}

      <div className="tarjetas">
        <div className="tarjeta tarjeta-exito">
          <div className="cabecera">
            <span className="etiqueta">Ingresos</span>
            <span className="icono" aria-hidden="true">
              💰
            </span>
          </div>
          <div className="valor positivo">
            {dinero(resumen ? resumen.totalIngresos : 0)}
          </div>
          <div className="pie-tarjeta">Entradas registradas en el mes</div>
        </div>
        <div className="tarjeta tarjeta-error">
          <div className="cabecera">
            <span className="etiqueta">Gastos</span>
            <span className="icono" aria-hidden="true">
              💸
            </span>
          </div>
          <div className="valor negativo">
            {dinero(resumen ? resumen.totalGastos : 0)}
          </div>
          <div className="pie-tarjeta">Salidas registradas en el mes</div>
        </div>
        <div className="tarjeta">
          <div className="cabecera">
            <span className="etiqueta">Balance</span>
            <span className="icono" aria-hidden="true">
              ⚖️
            </span>
          </div>
          <div
            className={`valor ${
              resumen && resumen.balance >= 0 ? "positivo" : "negativo"
            }`}
          >
            {dinero(resumen ? resumen.balance : 0)}
          </div>
          <div className="pie-tarjeta">
            {resumen && resumen.balance >= 0
              ? "Mes en positivo: sobrante disponible"
              : "Mes en negativo: revisa tus gastos"}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Gastos por categoría · {mesBonito(mes)}</h2>
          {cargando && !resumen ? (
            <EsqueletoGrafica />
          ) : (
            <GraficaPastel categorias={categorias} />
          )}
        </section>

        <section className="panel">
          <h2>Tendencia de los últimos 6 meses</h2>
          {cargando && tendencia.length === 0 ? (
            <EsqueletoGrafica />
          ) : (
            <GraficaTendencia meses={tendencia} />
          )}
        </section>
      </div>
    </>
  );
}
