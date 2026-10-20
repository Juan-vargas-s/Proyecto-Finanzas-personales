"use client";

import { useCallback, useEffect, useState } from "react";
import { api, usuarioId } from "../../../lib/api";
import { GraficaPastel, GraficaTendencia } from "../../../components/Graficas";

function mesActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

const dinero = (v) =>
  `$${Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardPage() {
  const [mes, setMes] = useState(mesActual());
  const [resumen, setResumen] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [tendencia, setTendencia] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const uid = usuarioId();

  const cargar = useCallback(
    async (mesSeleccionado) => {
      if (!uid) return;
      setCargando(true);
      setError("");
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
        setError(err.message);
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
        <label className="control-mes">
          Mes
          <input
            type="month"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
          />
        </label>
      </div>

      {error && <div className="alerta alerta-error">{error}</div>}

      <div className="tarjetas">
        <div className="tarjeta">
          <div className="etiqueta">Ingresos</div>
          <div className="valor positivo">
            {dinero(resumen ? resumen.totalIngresos : 0)}
          </div>
        </div>
        <div className="tarjeta">
          <div className="etiqueta">Gastos</div>
          <div className="valor negativo">
            {dinero(resumen ? resumen.totalGastos : 0)}
          </div>
        </div>
        <div className="tarjeta">
          <div className="etiqueta">Balance</div>
          <div
            className={`valor ${
              resumen && resumen.balance >= 0 ? "positivo" : "negativo"
            }`}
          >
            {dinero(resumen ? resumen.balance : 0)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Gastos por categoría ({mes})</h2>
          {cargando && !resumen ? (
            <p className="vacio">Cargando…</p>
          ) : (
            <GraficaPastel categorias={categorias} />
          )}
        </section>

        <section className="panel">
          <h2>Tendencia de los últimos 6 meses</h2>
          {cargando && tendencia.length === 0 ? (
            <p className="vacio">Cargando…</p>
          ) : (
            <GraficaTendencia meses={tendencia} />
          )}
        </section>
      </div>
    </>
  );
}
