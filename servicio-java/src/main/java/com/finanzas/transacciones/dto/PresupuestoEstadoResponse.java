package com.finanzas.transacciones.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Estado del presupuesto: límite definido + gasto acumulado real.
 * Es el payload que consume el servicio de Go (metas) para generar alertas.
 */
public record PresupuestoEstadoResponse(
        UUID id,
        String categoria,
        BigDecimal limiteMensual,
        BigDecimal gastoAcumulado,
        BigDecimal restante,
        double porcentajeUsado,
        String mes
) {}
