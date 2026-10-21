"use client";

import { useCallback, useRef, useState } from "react";
import { useClicFuera } from "../lib/hooks";

/**
 * Lista desplegable con el diseño del frontend (reemplaza al <select>
 * nativo cuyo menú pertenece al sistema operativo).
 *
 * opciones: [{ valor, etiqueta }]
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
  const ref = useRef(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useClicFuera(ref, abierto, cerrar);

  const actual = opciones.find((o) => String(o.valor) === String(valor));

  return (
    <div className={`selector-contenedor ${className}`} ref={ref}>
      <button
        type="button"
        id={id}
        className={`selector${abierto ? " abierto" : ""}${actual ? "" : " vacio"}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="selector-texto">{actual ? actual.etiqueta : placeholder}</span>
        <span className="selector-flecha" aria-hidden="true">
          ▾
        </span>
      </button>

      {abierto && (
        <ul className="selector-menu" role="listbox">
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
                <span>{o.etiqueta}</span>
                {String(o.valor) === String(valor) && (
                  <span aria-hidden="true">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
