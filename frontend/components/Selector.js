"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "../lib/hooks";

/**
 * Lista desplegable con el diseño del frontend (reemplaza al <select>
 * nativo cuyo menú pertenece al sistema operativo).
 *
 * El menú se pinta en un portal con position:fixed (ver usePopover): así
 * puede flotar sobre cualquier tarjeta y, si no cabe hacia abajo, se abre
 * hacia arriba en vez de quedar cortado por el borde de la pantalla.
 *
 * opciones: [{ valor, etiqueta, icono, color }]
 *  - icono: emoji que se pinta antes de la etiqueta.
 *  - color: color del icono (el de la categoría).
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
          {actual?.icono && (
            <span
              className="selector-icono"
              style={actual.color ? { color: actual.color } : undefined}
              aria-hidden="true"
            >
              {actual.icono}
            </span>
          )}
          <span>{actual ? actual.etiqueta : placeholder}</span>
        </span>
        <span className="selector-flecha" aria-hidden="true">
          ▾
        </span>
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
                    {o.icono && (
                      <span
                        className="selector-icono"
                        style={o.color ? { color: o.color } : undefined}
                        aria-hidden="true"
                      >
                        {o.icono}
                      </span>
                    )}
                    {o.etiqueta}
                  </span>
                  {String(o.valor) === String(valor) && (
                    <span aria-hidden="true">✓</span>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
