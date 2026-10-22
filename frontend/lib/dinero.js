"use client";

import { createContext, useContext } from "react";
import { getUsuario } from "./api";

/** Locale por moneda: define el símbolo y los separadores de miles/decimales. */
const LOCALES = {
  MXN: "es-MX",
  USD: "en-US",
  EUR: "es-ES",
  COP: "es-CO",
  ARS: "es-AR",
  PEN: "es-PE",
  CLP: "es-CL",
};

/**
 * Contexto de la moneda preferida. Lo provee el layout de la app, así el
 * cambio de moneda redibuja las páginas que ya están montadas (antes solo se
 * reflejaba al navegar de nuevo).
 */
const MonedaContexto = createContext("MXN");

export function MonedaProvider({ moneda, children }) {
  return (
    <MonedaContexto.Provider value={moneda || "MXN"}>
      {children}
    </MonedaContexto.Provider>
  );
}

/**
 * Moneda preferida del usuario, reactiva. Úsala dentro de componentes para
 * que el importe se repinte solo cuando el usuario cambia la moneda.
 */
export function useMoneda() {
  return useContext(MonedaContexto);
}

/** Moneda preferida del usuario (la guarda el servicio de auth en su perfil). */
export function monedaPreferida() {
  const usuario = getUsuario();
  return (usuario && usuario.monedaPreferida) || "MXN";
}

/** Monto con el símbolo de la moneda del usuario: 1,234.56 USD */
export function formatear(valor, moneda = monedaPreferida()) {
  const numero = Number(valor || 0);
  const locale = LOCALES[moneda] || "es-MX";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numero);
  } catch {
    return `${moneda} ${numero.toFixed(2)}`;
  }
}

/** Versión corta para ejes de gráficas y espacios estrechos: 1.2K */
export function formatearCorto(valor, moneda = monedaPreferida()) {
  const numero = Number(valor || 0);
  const locale = LOCALES[moneda] || "es-MX";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(numero);
  } catch {
    return `${moneda} ${Math.round(numero)}`;
  }
}

/** Solo el número, sin símbolo: útil dentro de textos ("quedan 3,800 pesos"). */
export function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
}
