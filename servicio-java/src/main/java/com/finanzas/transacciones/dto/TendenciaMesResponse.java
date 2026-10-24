package com.finanzas.transacciones.dto;

import java.math.BigDecimal;

/**
 * Un punto de la serie de tendencia mensual. Java lo calcula en una sola
 * consulta agrupada por mes, para que el servicio de Python no tenga que
 * pedir un resumen por cada mes (6 round-trips) en cada render.
 */
public record TendenciaMesResponse(
        String mes,
        BigDecimal totalIngresos,
        BigDecimal totalGastos,
        BigDecimal balance
) {}
