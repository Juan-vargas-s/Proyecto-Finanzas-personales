"use client";

import { useEffect, useRef } from "react";

/**
 * Cierra un panel (menú, calendario, modal) cuando el usuario hace clic
 * fuera de él o presiona la tecla Escape.
 */
export function useClicFuera(ref, abierto, alCerrar) {
  const guardado = useRef(alCerrar);
  guardado.current = alCerrar;

  useEffect(() => {
    if (!abierto) return;

    function clicFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) guardado.current();
    }

    function tecla(e) {
      if (e.key === "Escape") guardado.current();
    }

    document.addEventListener("mousedown", clicFuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clicFuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [ref, abierto]);
}
