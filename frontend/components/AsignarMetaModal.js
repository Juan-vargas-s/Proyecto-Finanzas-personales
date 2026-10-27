"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { formatear, useMoneda } from "../lib/dinero";
import { faltante } from "../lib/calculoMeta";
import { IconoBalanza, IconoMetas } from "./Iconos";

function dosDecimales(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Reparte un ingreso entre las metas de ahorro.
 *
 * Cada reparto se materializa como un aporte a la meta, que a su vez publica
 * un evento que Java convierte en una transacción AHORRO: el ingreso del mes
 * deja de ser un cubo aislado y alimenta el ahorro.
 */
export default function AsignarMetaModal({
  visible,
  total,
  metas,
  guardando,
  onCerrar,
  onAsignar,
}) {
  const moneda = useMoneda();
  const [montos, setMontos] = useState({});

  useEffect(() => {
    if (visible) setMontos({});
  }, [visible]);

  const asignado = Object.values(montos).reduce(
    (acc, valor) => acc + (Number(valor) || 0),
    0
  );
  const restante = (Number(total) || 0) - asignado;
  const excedido = restante < 0;

  /** Reparte lo que queda entre todas las metas por partes iguales. */
  function repartirEquitativo() {
    if (metas.length === 0 || restante <= 0) return;
    const parte = dosDecimales(restante / metas.length);
    const nuevos = {};
    let acumulado = 0;
    metas.forEach((m, i) => {
      const valor =
        i === metas.length - 1
          ? dosDecimales(restante - acumulado)
          : parte;
      nuevos[m.id] = valor;
      acumulado += valor;
    });
    setMontos(nuevos);
  }

  return (
    <Modal
      visible={visible}
      titulo="Asignar ingreso a metas"
      icono={<IconoMetas size={24} />}
      tipo="info"
      ancho="580px"
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            disabled={guardando || excedido || asignado <= 0}
            onClick={() =>
              onAsignar(
                Object.entries(montos)
                  .map(([id, monto]) => ({ id, monto: Number(monto) || 0 }))
                  .filter((m) => m.monto > 0)
              )
            }
          >
            {guardando ? "Asignando…" : "Registrar y asignar"}
          </button>
        </>
      }
    >
      <div className="asignar-resumen">
        <span>
          Ingreso a repartir <strong>{formatear(total, moneda)}</strong>
        </span>
        <span className={excedido ? "negativo" : "ahorro"}>
          {excedido
            ? `Te pasaste por ${formatear(-restante, moneda)}`
            : `Quedan ${formatear(restante, moneda)} sin repartir`}
        </span>
      </div>

      {metas.length === 0 ? (
        <p className="vacio">
          Todavía no tienes metas. Crea una en la sección Metas para poder
          repartir ingresos.
        </p>
      ) : (
        <>
          <ul className="asignar-lista">
            {metas.map((m) => (
              <li key={m.id}>
                <div className="asignar-meta">
                  <strong>{m.nombre}</strong>
                  <span className="asignar-meta-dato">
                    le faltan {formatear(faltante(m), moneda)}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  aria-label={`Monto a asignar a ${m.nombre}`}
                  value={montos[m.id] ?? ""}
                  onChange={(e) =>
                    setMontos({ ...montos, [m.id]: e.target.value })
                  }
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-secundario btn-mini"
            onClick={repartirEquitativo}
            disabled={restante <= 0}
          >
            <IconoBalanza size={15} /> Repartir el resto por partes iguales
          </button>
        </>
      )}
    </Modal>
  );
}
