/**
 * Validaciones y mapeo de errores para transacciones.
 */

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function validarTransaccion(form, fechaReferencia = hoyISO()) {
  const errores = {};
  if (!form.tipo) {
    errores.tipo = "Selecciona un tipo";
  }
  if (form.monto === "" || form.monto === null || form.monto === undefined) {
    errores.monto = "Ingresa un monto";
  } else {
    const monto = Number(form.monto);
    if (Number.isNaN(monto) || monto <= 0) {
      errores.monto = "El monto debe ser mayor a 0";
    }
  }
  if (!form.categoria || !form.categoria.trim()) {
    errores.categoria = "Selecciona una categoría";
  }
  if (!form.fecha) {
    errores.fecha = "Selecciona una fecha";
  } else if (form.fecha > fechaReferencia) {
    errores.fecha = "La fecha no puede ser futura";
  }
  return errores;
}

export function mensajeAmigableTransaccion(err) {
  if (!err) return "No se pudo procesar la transacción";
  const msg = err.message || String(err);
  const low = msg.toLowerCase();
  if (low.includes("categoría") && (low.includes("obligat") || low.includes("requerid"))) {
    return "Selecciona una categoría";
  }
  if (low.includes("categoría") && low.includes("existe")) {
    return "La categoría seleccionada no es válida para este tipo";
  }
  if (low.includes("monto")) return "El monto ingresado no es válido";
  if (low.includes("fecha")) return "La fecha seleccionada no es válida";
  if (low.includes("tipo")) return "El tipo de movimiento no es válido";
  if (low.includes("500") || low.includes("internal")) return "Error en el servidor al procesar el movimiento";
  if (low.includes("failed to fetch") || low.includes("network")) return "Error de conexión con el servidor";
  return msg;
}
