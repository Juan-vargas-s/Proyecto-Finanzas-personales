"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/hooks";
import { IconoCheck, IconoChevronAbajo } from "./Iconos";

/**
 * Lista desplegable con el diseño del frontend (reemplaza al <select>
 * nativo cuyo menú pertenece al sistema operativo).
 *
 * El menú se pinta en un portal con position:fixed (ver usePopover): así
 * puede flotar sobre cualquier tarjeta y, si no cabe hacia abajo, se abre
 * hacia arriba en vez de quedar cortado por el borde de la pantalla.
 *
 * opciones: [{ valor, etiqueta, color }]
 *  - color: color del punto que se pinta antes de la etiqueta.
 */
export default function Selector({
  valor,
  onChange,
  opciones = [],
  id,
  placeholder = "Seleccionar",
  className = "",
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  const { refBoton, refMenu, estilo } = usePopover(abierto, cerrar);

  const actual = opciones.find((o) => String(o.valor) === String(valor));
  const idMenu = id ? `${id}-menu` : undefined;

  return (
    <div className={`selector-contenedor ${className}`} ref={refBoton}>
      <button
        type="button"
        id={id}
        className={`selector${abierto ? " abierto" : ""}${actual ? "" : " vacio"}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="selector-texto">
          {actual?.color && (
            <span
              className="selector-punto"
              style={{ background: actual.color }}
              aria-hidden="true"
            />
          )}
          <span>{actual ? actual.etiqueta : placeholder}</span>
        </span>
        <IconoChevronAbajo size={16} className="selector-flecha" />
      </button>

      {abierto &&
        estilo &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={refMenu}
            id={idMenu}
            className="selector-menu"
            style={estilo}
            role="listbox"
          >
            {opciones.map((o) => (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={String(o.valor) === String(valor)}
                  className={`selector-opcion${
                    String(o.valor) === String(valor) ? " activa" : ""
                  }`}
                  onClick={() => {
                    onChange(o.valor);
                    cerrar();
                  }}
                >
                  <span>
                    {o.color && (
                      <span
                        className="selector-punto"
                        style={{ background: o.color }}
                        aria-hidden="true"
                      />
                    )}
                    {o.etiqueta}
                  </span>
                  {String(o.valor) === String(valor) && <IconoCheck size={16} />}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
