package com.finanzas.transacciones.dto;

import java.math.BigDecimal;

public record ResumenMesResponse(
        BigDecimal totalIngresos,
        BigDecimal totalGastos,
        BigDecimal balance,
        String mes
) {}
