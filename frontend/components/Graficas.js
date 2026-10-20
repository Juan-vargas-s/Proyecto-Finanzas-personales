"use client";

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

const COLORES = [
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
];

const estiloTooltip = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#e6edf7",
};

const dinero = (v) => `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`;

export function GraficaPastel({ categorias }) {
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
              stroke="#0b1220"
            >
              {categorias.map((entrada, i) => (
                <Cell
                  key={entrada.categoria}
                  fill={COLORES[i % COLORES.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v) => dinero(v)} contentStyle={estiloTooltip} />
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
                background: COLORES[i % COLORES.length],
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, textTransform: "capitalize" }}>{c.categoria}</span>
            <strong>{dinero(c.total)}</strong>
            <span style={{ color: "#93a4c0", fontSize: "0.8rem" }}>{c.porcentaje}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GraficaTendencia({ meses }) {
  if (!meses || meses.length === 0) {
    return <p className="vacio">Sin datos de tendencia</p>;
  }

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={meses} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="mes" stroke="#93a4c0" fontSize={12} />
          <YAxis stroke="#93a4c0" fontSize={12} />
          <Tooltip
            formatter={(v, nombre) => [dinero(v), nombre]}
            contentStyle={estiloTooltip}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="totalIngresos"
            name="Ingresos"
            stroke="#4ade80"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="totalGastos"
            name="Gastos"
            stroke="#f87171"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
