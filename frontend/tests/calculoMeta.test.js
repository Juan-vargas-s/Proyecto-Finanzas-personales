import test from "node:test";
import assert from "node:assert/strict";

import {
  DIAS_POR_MES,
  ahorrado,
  diasRestantes,
  diferenciaRitmo,
  estadoMeta,
  etiquetaEstado,
  etiquetaPlazo,
  faltante,
  fechaLimite,
  mesesRestantes,
  mesesTranscurridos,
  objetivo,
  porcentaje,
  ritmoActual,
  ritmoRequerido,
} from "../lib/calculoMeta.js";

/** 22 de octubre de 2026 (hora local). */
const HOY = new Date(2026, 9, 22);

function meta(extra = {}) {
  return {
    id: "m1",
    nombre: "Viaje a Japón",
    montoObjetivo: 5000,
    montoActual: 1200,
    fechaLimite: "2026-12-06",
    creadaEn: "2026-08-01T12:00:00Z",
    ...extra,
  };
}

test("faltante: lo que falta para cumplir la meta", () => {
  assert.equal(faltante(meta()), 3800);
  assert.equal(faltante(meta({ montoActual: 5000 })), 0);
  assert.equal(faltante(meta({ montoActual: 9000 })), 0, "nunca es negativo");
  assert.equal(faltante(meta({ montoObjetivo: 0 })), 0);
  assert.equal(faltante(null), 0);
});

test("objetivo y ahorrado: toleran valores inválidos", () => {
  assert.equal(objetivo(meta()), 5000);
  assert.equal(ahorrado(meta()), 1200);
  assert.equal(objetivo({ montoObjetivo: "abc" }), 0);
  assert.equal(ahorrado({}), 0);
});

test("porcentaje: acotado a 100", () => {
  assert.equal(porcentaje(meta()), 24);
  assert.equal(porcentaje(meta({ montoActual: 7500 })), 100);
  assert.equal(porcentaje(meta({ montoObjetivo: 0 })), 0);
});

test("fechaLimite: parsea en hora local y rechaza fechas imposibles", () => {
  const limite = fechaLimite(meta());
  assert.equal(limite.getFullYear(), 2026);
  assert.equal(limite.getMonth(), 11, "diciembre");
  assert.equal(limite.getDate(), 6);
  assert.equal(fechaLimite({ fechaLimite: "" }), null);
  assert.equal(fechaLimite({ fechaLimite: "2026-13-01" }), null);
  assert.equal(fechaLimite({ fechaLimite: "2026-02-31" }), null, "31 de febrero no existe");
});

test("diasRestantes: cuenta hasta la fecha límite", () => {
  assert.equal(diasRestantes(meta(), HOY), 45);
  assert.equal(diasRestantes(meta({ fechaLimite: "2026-10-22" }), HOY), 0);
  assert.equal(diasRestantes(meta({ fechaLimite: "2026-10-23" }), HOY), 1);
  assert.equal(diasRestantes(meta({ fechaLimite: "2026-10-19" }), HOY), -3);
  assert.equal(diasRestantes(meta({ fechaLimite: "" }), HOY), null);
});

test("mesesRestantes: días convertidos a meses", () => {
  assert.equal(mesesRestantes(meta(), HOY), 45 / DIAS_POR_MES);
  assert.equal(mesesRestantes(meta({ fechaLimite: "" }), HOY), null);
});

test("mesesTranscurridos: desde la creación de la meta", () => {
  const meses = mesesTranscurridos(meta(), HOY);
  assert.ok(meses > 2.6 && meses < 2.7, `meses=${meses}`);
  assert.equal(mesesTranscurridos(meta({ creadaEn: "" }), HOY), null);
  assert.equal(
    mesesTranscurridos(meta({ creadaEn: "2026-10-22T09:00:00Z" }), HOY),
    null,
    "una meta creada hoy todavía no tiene ritmo medible"
  );
});

test("ritmoRequerido: cuánto hay que ahorrar por mes", () => {
  const ritmo = ritmoRequerido(meta(), HOY);
  assert.ok(Math.abs(ritmo - 3800 / (45 / DIAS_POR_MES)) < 0.01);
  assert.equal(ritmoRequerido(meta({ fechaLimite: "" }), HOY), null);
  assert.equal(
    ritmoRequerido(meta({ fechaLimite: "2026-10-01" }), HOY),
    null,
    "una meta vencida ya no tiene ritmo que exigir"
  );
});

test("ritmoActual: cuánto se está ahorrando por mes", () => {
  const ritmo = ritmoActual(meta(), HOY);
  assert.ok(ritmo > 440 && ritmo < 450, `ritmo=${ritmo}`);
  assert.equal(ritmoActual(meta({ creadaEn: "" }), HOY), null);
});

test("diferenciaRitmo: positiva = vas por detrás", () => {
  assert.ok(diferenciaRitmo(meta(), HOY) > 2000);
  assert.equal(diferenciaRitmo(meta({ fechaLimite: "" }), HOY), null);
});

test("estadoMeta: completada tiene prioridad sobre vencida", () => {
  assert.equal(
    estadoMeta(meta({ montoActual: 5000, fechaLimite: "2026-01-01" }), HOY),
    "completada",
    "una meta cumplida no está vencida aunque su fecha haya pasado"
  );
});

test("estadoMeta: vencida cuando se pasó la fecha sin cumplir", () => {
  assert.equal(estadoMeta(meta({ fechaLimite: "2026-10-19" }), HOY), "vencida");
});

test("estadoMeta: en riesgo cuando el ritmo requerido supera al real", () => {
  assert.equal(estadoMeta(meta(), HOY), "en_riesgo");
});

test("estadoMeta: en buen día cuando va al ritmo", () => {
  // Se ahorró de golpe: el ritmo real supera al requerido con holgura.
  assert.equal(
    estadoMeta(meta({ montoActual: 4800, fechaLimite: "2026-12-06" }), HOY),
    "en_buen_dia"
  );
});

test("estadoMeta: sin fecha límite no se puede medir el ritmo", () => {
  assert.equal(estadoMeta(meta({ fechaLimite: "" }), HOY), "en_buen_dia");
});

test("etiquetaEstado: texto legible", () => {
  assert.equal(etiquetaEstado("en_riesgo"), "En riesgo");
  assert.equal(etiquetaEstado("completada"), "Completada");
  assert.equal(etiquetaEstado("desconocido"), "En buen día");
});

test("etiquetaPlazo: countdown en días", () => {
  assert.equal(etiquetaPlazo(meta(), HOY), "vence en 45 días");
  assert.equal(etiquetaPlazo(meta({ fechaLimite: "2026-10-22" }), HOY), "vence hoy");
  assert.equal(etiquetaPlazo(meta({ fechaLimite: "2026-10-23" }), HOY), "vence mañana");
  assert.equal(etiquetaPlazo(meta({ fechaLimite: "2026-10-21" }), HOY), "venció hace 1 día");
  assert.equal(etiquetaPlazo(meta({ fechaLimite: "2026-10-19" }), HOY), "venció hace 3 días");
  assert.equal(etiquetaPlazo(meta({ fechaLimite: "" }), HOY), "");
});
