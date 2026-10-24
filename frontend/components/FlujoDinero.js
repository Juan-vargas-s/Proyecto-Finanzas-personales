"use client";

import { formatear, useMoneda } from "../lib/dinero";

/**
 * Flujo de Dinero: Ingresos → Ahorro (metas) → Gastos → Libre.
 *
 * Es el detalle que hace clic mentalmente la relación entre el dinero que
 * entra, el que se aparta en metas y el que se gasta: sin esto, una meta es
 * un cubo aislado del resto del presupuesto.
 *
 * Se pinta como una barra de 3 segmentos (no un Sankey: Recharts no lo trae y
 * añadir una dependencia está descartado).
 */
export default function FlujoDinero({ ingresos, gastos, ahorro, disponible }) {
  const moneda = useMoneda();

  const total = Number(ingresos) || 0;
  const gasto = Number(gastos) || 0;
  const meta = Number(ahorro) || 0;
  const libre = Number(disponible) || 0;

  if (total <= 0) {
    return (
      <div className="flujo-dinero">
        <div className="flujo-cabecera">
          <span className="flujo-etiqueta">Flujo de dinero</span>
          <strong>{formatear(0, moneda)}</strong>
        </div>
        <p className="vacio">
          Sin ingresos registrados este mes: todavía no hay flujo que repartir.
        </p>
      </div>
    );
  }

  // Los tres segmentos reparten el 100% de los ingresos. Se normaliza para
  // que el redondeo no deje un hueco al final de la barra.
  const partes = [
    { clave: "gastos", etiqueta: "Gastos", valor: gasto, color: "gastos" },
    { clave: "ahorro", etiqueta: "Ahorro (metas)", valor: meta, color: "ahorro" },
    { clave: "libre", etiqueta: "Libre", valor: libre, color: "libre" },
  ];
  const suma = partes.reduce((acc, p) => acc + Math.max(0, p.valor), 0) || 1;
  const porcentajes = partes.map((p) => ({
    ...p,
    porcentaje: (Math.max(0, p.valor) / suma) * 100,
  }));

  return (
    <div className="flujo-dinero">
      <div className="flujo-cabecera">
        <span className="flujo-etiqueta">Flujo de dinero del mes</span>
        <strong>{formatear(total, moneda)}</strong>
      </div>

      <div
        className="flujo-barra"
        role="img"
        aria-label={`Ingresos ${formatear(total, moneda)}: gastos ${formatear(
          gasto,
          moneda
        )}, ahorro ${formatear(meta, moneda)}, libre ${formatear(libre, moneda)}`}
      >
        {porcentajes.map((p) => (
          <span
            key={p.clave}
            className={`flujo-segmento ${p.color}`}
            style={{ width: `${p.porcentaje}%` }}
          />
        ))}
      </div>

      <ul className="flujo-leyenda">
        {porcentajes.map((p) => (
          <li key={p.clave}>
            <span className={`punto ${p.color}`} aria-hidden="true" />
            <span className="flujo-leyenda-etiqueta">{p.etiqueta}</span>
            <strong>{formatear(p.valor, moneda)}</strong>
            <span className="flujo-leyenda-porcentaje">
              {Math.round(p.porcentaje)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
