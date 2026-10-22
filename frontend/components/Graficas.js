"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatear, formatearCorto, useMoneda } from "../lib/dinero";

const TOKENS_SERIE = [
  "--acento",
  "--rosa",
  "--exito",
  "--alerta",
  "--violeta",
  "--naranja",
  "--teal",
  "--error",
  "--azul",
  "--purpura",
];

// Respaldo para el render en servidor: los mismos valores de tokens.css.
const RESPALDO = {
  colores: [
    "#38bdf8",
    "#f472b6",
    "#4ade80",
    "#facc15",
    "#a78bfa",
    "#fb923c",
    "#2dd4bf",
    "#f87171",
    "#60a5fa",
    "#c084fc",
  ],
  acento: "#38bdf8",
  exito: "#4ade80",
  error: "#f87171",
  borde: "#22304d",
  texto: "#e6edf7",
  texto2: "#93a4c0",
  panel: "#111a2e",
  fondo: "#0b1220",
};

/** Lee los colores del tema desde los tokens CSS (con respaldo para SSR). */
function leerTema() {
  if (typeof window === "undefined") return RESPALDO;
  const estilos = getComputedStyle(document.documentElement);
  const leer = (token, respaldo) =>
    estilos.getPropertyValue(token).trim() || respaldo;
  return {
    colores: TOKENS_SERIE.map((token, i) => leer(token, RESPALDO.colores[i])),
    acento: leer("--acento", RESPALDO.acento),
    exito: leer("--exito", RESPALDO.exito),
    error: leer("--error", RESPALDO.error),
    borde: leer("--borde", RESPALDO.borde),
    texto: leer("--texto", RESPALDO.texto),
    texto2: leer("--texto-2", RESPALDO.texto2),
    panel: leer("--panel", RESPALDO.panel),
    fondo: leer("--fondo", RESPALDO.fondo),
  };
}

export function useTema() {
  const [tema, setTema] = useState(RESPALDO);
  useEffect(() => {
    setTema(leerTema());
  }, []);
  return tema;
}

// El tooltip y la leyenda usan la moneda preferida del usuario.
export function GraficaPastel({ categorias }) {
  const moneda = useMoneda();
  const tema = useTema();
  const dinero = (v) => formatear(v, moneda);
  const estiloTooltip = {
    backgroundColor: tema.panel,
    border: `1px solid ${tema.borde}`,
    borderRadius: 8,
    color: tema.texto,
  };

  if (!categorias || categorias.length === 0) {
    return <p className="vacio">Sin gastos registrados este mes</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 340, height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categorias}
              dataKey="total"
              nameKey="categoria"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              stroke={tema.fondo}
            >
              {categorias.map((entrada, i) => (
                <Cell
                  key={entrada.categoria}
                  fill={tema.colores[i % tema.colores.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => dinero(v)}
              contentStyle={estiloTooltip}
              labelStyle={{ color: tema.texto }}
              itemStyle={{ color: tema.texto }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul style={{ flex: 1, minWidth: 200, listStyle: "none", margin: 0, padding: 0 }}>
        {categorias.map((c, i) => (
          <li
            key={c.categoria}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.3rem 0",
              fontSize: "0.9rem",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: tema.colores[i % tema.colores.length],
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, textTransform: "capitalize" }}>{c.categoria}</span>
            <strong>{dinero(c.total)}</strong>
            <span style={{ color: tema.texto2, fontSize: "0.8rem" }}>
              {c.porcentaje}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficaTendencia({ meses }) {
  const moneda = useMoneda();
  const tema = useTema();
  const dinero = (v) => formatear(v, moneda);
  const dineroCorto = (v) => formatearCorto(v, moneda);
  const estiloTooltip = {
    backgroundColor: tema.panel,
    border: `1px solid ${tema.borde}`,
    borderRadius: 8,
    color: tema.texto,
  };

  if (!meses || meses.length === 0) {
    return <p className="vacio">Sin datos de tendencia</p>;
  }

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={meses} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={tema.borde} />
          <XAxis dataKey="mes" stroke={tema.texto2} fontSize={12} />
          <YAxis stroke={tema.texto2} fontSize={12} tickFormatter={dineroCorto} />
          <Tooltip
            formatter={(v, nombre) => [dinero(v), nombre]}
            contentStyle={estiloTooltip}
            labelStyle={{ color: tema.texto }}
            itemStyle={{ color: tema.texto }}
          />
          <Legend wrapperStyle={{ color: tema.texto2 }} />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke={tema.acento}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="totalIngresos"
            name="Ingresos"
            stroke={tema.exito}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="totalGastos"
            name="Gastos"
            stroke={tema.error}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
