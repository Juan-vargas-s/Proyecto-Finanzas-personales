package com.finanzas.transacciones.dto;

import java.math.BigDecimal;

public record ResumenMesResponse(
        BigDecimal totalIngresos,
        BigDecimal totalGastos,
        BigDecimal balance,
        BigDecimal totalAhorro,
        BigDecimal disponible,
        String mes
) {}
