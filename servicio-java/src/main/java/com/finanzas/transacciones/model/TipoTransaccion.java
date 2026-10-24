package com.finanzas.transacciones.model;

public enum TipoTransaccion {
    INGRESO,
    GASTO,
    /**
     * Dinero apartado hacia una meta de ahorro. No es ingreso ni gasto: no
     * engorda el balance del mes, pero sí aparece en el historial y alimenta
     * el total ahorrado.
     */
    AHORRO
}
