"use client";

import { useCallback, useRef, useState } from "react";
import AnilloProgreso from "./AnilloProgreso";
import { formatear, useMoneda } from "../lib/dinero";
import { useClicFuera } from "../lib/hooks";
import { IconoDeshacer, IconoEditar, IconoEliminar } from "./Iconos";
import {
  ahorrado,
  estadoMeta,
  etiquetaPlazo,
  faltante,
  objetivo,
  porcentaje,
  ritmoActual,
  ritmoRequerido,
} from "../lib/calculoMeta";

function dosDecimales(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Tarjeta de una meta de ahorro.
 *
 * Muestra lo que hace clara una meta: cuánto falta, cuánto hay que aportar
 * por mes para llegar a tiempo y cuánto llevas ahorrado.
 */
export default function TarjetaMeta({
  meta,
  onAportar,
  onEditar,
  onRetirar,
  onEliminar,
}) {
  const moneda = useMoneda();
  const [monto, setMonto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);
  useClicFuera(menuRef, menuAbierto, cerrarMenu);

  const estado = estadoMeta(meta);
  const falta = faltante(meta);
  const avance = porcentaje(meta);
  const plazo = etiquetaPlazo(meta);
  const requerido = ritmoRequerido(meta);
  const actual = ritmoActual(meta);

  // Montos sugeridos: un cuarto, la mitad y un importe redondo. Solo se
  // ofrecen los que caben en lo que falta.
  const sugeridos = [
    { etiqueta: "+25%", monto: dosDecimales(falta * 0.25) },
    { etiqueta: "+50%", monto: dosDecimales(falta * 0.5) },
    { etiqueta: formatear(500, moneda), monto: 500 },
  ].filter((c) => c.monto > 0 && c.monto <= falta);

  function textoRitmo() {
    if (estado === "completada") {
      return plazo ? `¡Meta cumplida! · ${plazo}` : "¡Meta cumplida!";
    }
    if (requerido === null) {
      return "Sin fecha límite: define un plazo para ver tu ritmo";
    }
    const partes = [`Necesitas ${formatear(requerido, moneda)}/mes`];
    if (actual !== null) {
      const diferencia = requerido - actual;
      if (diferencia > 0) {
        partes.push(`vas ${formatear(diferencia, moneda)}/mes por debajo`);
      } else if (diferencia < 0) {
        partes.push(`vas ${formatear(-diferencia, moneda)}/mes por delante`);
      } else {
        partes.push("vas justo a tiempo");
      }
    }
    return partes.join(" · ");
  }

  async function aportar() {
    const valor = parseFloat(monto);
    if (!valor || valor <= 0) return;
    setGuardando(true);
    try {
      await onAportar(valor);
      setMonto("");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="meta-card">
      <header>
        <div className="meta-cabecera">
          <strong className="meta-nombre">{meta.nombre}</strong>
          <span className={`meta-badge ${estado}`}>
            {estado === "completada" ? "¡cumplida!" : plazo || "sin fecha límite"}
          </span>
        </div>

        <div className="meta-menu" ref={menuRef}>
          <button
            type="button"
            className="meta-menu-boton"
            aria-label={`Opciones de ${meta.nombre}`}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            ⋮
          </button>
          {menuAbierto && (
            <ul className="meta-menu-lista" role="menu">
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    cerrarMenu();
                    onEditar(meta);
                  }}
                >
                  <IconoEditar size={15} /> Editar meta
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  disabled={ahorrado(meta) <= 0}
                  onClick={() => {
                    cerrarMenu();
                    onRetirar(meta);
                  }}
                >
                  <IconoDeshacer size={15} /> Deshacer aporte
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="peligro"
                  onClick={() => {
                    cerrarMenu();
                    onEliminar(meta);
                  }}
                >
                  <IconoEliminar size={15} /> Eliminar meta
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>

      <div className="meta-cuerpo">
        <AnilloProgreso porcentaje={avance} estado={estado} tamano={92} />
        <div className="meta-datos">
          <div className="meta-titular">
            {estado === "completada"
              ? "¡Meta cumplida!"
              : `Faltan ${formatear(falta, moneda)}`}
          </div>
          <div className="meta-sub">
            de {formatear(objetivo(meta), moneda)} · llevas{" "}
            {formatear(ahorrado(meta), moneda)}
          </div>
        </div>
      </div>

      <p className={`meta-ritmo ${estado}`}>{textoRitmo()}</p>

      <div className="meta-aportes">
        {sugeridos.length > 0 && (
          <div className="meta-chips">
            {sugeridos.map((c) => (
              <button
                key={c.etiqueta}
                type="button"
                className="chip"
                onClick={() => setMonto(String(c.monto))}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>
        )}
        <div className="aportar-fila">
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Otro monto"
            aria-label={`Monto a aportar a ${meta.nombre}`}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aportar();
              }
            }}
          />
          <button
            className="btn btn-exito"
            onClick={aportar}
            disabled={guardando || !parseFloat(monto)}
          >
            {guardando ? "Aportando…" : "Aportar"}
          </button>
        </div>
      </div>
    </article>
  );
}
