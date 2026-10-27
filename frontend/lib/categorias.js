"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Catálogo de categorías del usuario. El backend copia las plantillas
 * globales en el primer GET y desde ahí cada usuario administra las suyas.
 */
export function useCategorias(tipo = null) {
  const [todas, setTodas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api("/api/transacciones/categorias");
      setTodas(Array.isArray(datos) ? datos : []);
    } catch {
      setTodas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const categorias = tipo ? todas.filter((c) => c.tipo === tipo) : todas;
  return { categorias, todas, cargando, recargar };
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

export function crearCategoria(datos) {
  return api("/api/transacciones/categorias", { method: "POST", body: datos });
}

export function actualizarCategoria(id, datos) {
  return api(`/api/transacciones/categorias/${id}`, { method: "PUT", body: datos });
}
