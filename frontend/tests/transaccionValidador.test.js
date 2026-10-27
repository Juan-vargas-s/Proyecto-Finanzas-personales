import test from "node:test";
import assert from "node:assert/strict";

import {
  validarTransaccion,
  mensajeAmigableTransaccion,
} from "../lib/transaccionValidador.js";

const HOY = "2026-10-27";

function formValido(extra = {}) {
  return {
    tipo: "GASTO",
    monto: "150.50",
    categoria: "Comida",
    fecha: "2026-10-25",
    descripcion: "Almuerzo",
    ...extra,
  };
}

test("validarTransaccion: formulario válido no devuelve errores", () => {
  const errores = validarTransaccion(formValido(), HOY);
  assert.deepEqual(errores, {});
});

test("validarTransaccion: detecta monto inválido (vacío, no numérico, cero o negativo)", () => {
  assert.equal(
    validarTransaccion(formValido({ monto: "" }), HOY).monto,
    "Ingresa un monto"
  );
  assert.equal(
    validarTransaccion(formValido({ monto: "abc" }), HOY).monto,
    "El monto debe ser mayor a 0"
  );
  assert.equal(
    validarTransaccion(formValido({ monto: "0" }), HOY).monto,
    "El monto debe ser mayor a 0"
  );
  assert.equal(
    validarTransaccion(formValido({ monto: -50 }), HOY).monto,
    "El monto debe ser mayor a 0"
  );
});

test("validarTransaccion: detecta categoría vacía o faltante", () => {
  assert.equal(
    validarTransaccion(formValido({ categoria: "" }), HOY).categoria,
    "Selecciona una categoría"
  );
  assert.equal(
    validarTransaccion(formValido({ categoria: "   " }), HOY).categoria,
    "Selecciona una categoría"
  );
});

test("validarTransaccion: detecta fecha faltante o fecha futura", () => {
  assert.equal(
    validarTransaccion(formValido({ fecha: "" }), HOY).fecha,
    "Selecciona una fecha"
  );
  assert.equal(
    validarTransaccion(formValido({ fecha: "2026-10-28" }), HOY).fecha,
    "La fecha no puede ser futura"
  );
  // Fecha igual a hoy es válida
  assert.equal(
    validarTransaccion(formValido({ fecha: "2026-10-27" }), HOY).fecha,
    undefined
  );
});

test("validarTransaccion: detecta tipo no especificado", () => {
  assert.equal(
    validarTransaccion(formValido({ tipo: "" }), HOY).tipo,
    "Selecciona un tipo"
  );
});

test("mensajeAmigableTransaccion: mapea errores de backend comprensibles", () => {
  assert.equal(
    mensajeAmigableTransaccion(new Error("La categoría es obligatoria")),
    "Selecciona una categoría"
  );
  assert.equal(
    mensajeAmigableTransaccion(new Error("La categoría no existe para este tipo")),
    "La categoría seleccionada no es válida para este tipo"
  );
  assert.equal(
    mensajeAmigableTransaccion(new Error("El monto no es válido")),
    "El monto ingresado no es válido"
  );
  assert.equal(
    mensajeAmigableTransaccion(new Error("500 Internal Server Error")),
    "Error en el servidor al procesar el movimiento"
  );
  assert.equal(
    mensajeAmigableTransaccion(new Error("Failed to fetch")),
    "Error de conexión con el servidor"
  );
});
