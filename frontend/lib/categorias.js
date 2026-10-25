"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Catálogo de categorías. Ahora lo manda el backend (tabla `categorias`),
 * así el frontend no mantiene una lista paralela que se desincroniza.
 */
export function useCategorias(tipo = null) {
  const [todas, setTodas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const datos = await api("/api/transacciones/categorias");
        if (vivo) setTodas(Array.isArray(datos) ? datos : []);
      } catch {
        if (vivo) setTodas([]);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const categorias = tipo ? todas.filter((c) => c.tipo === tipo) : todas;
  return { categorias, todas, cargando };
}

/** Convierte el catálogo en opciones del Selector (con punto de color). */
export function aOpciones(categorias) {
  return categorias.map((c) => ({
    valor: c.nombre,
    etiqueta: c.nombre,
    color: c.color,
  }));
}

/** Color de una categoría por nombre (para pintar su punto en la tabla). */
export function estiloCategoria(categorias, nombre) {
  const c = categorias.find((x) => x.nombre === nombre);
  return { color: c?.color };
}
