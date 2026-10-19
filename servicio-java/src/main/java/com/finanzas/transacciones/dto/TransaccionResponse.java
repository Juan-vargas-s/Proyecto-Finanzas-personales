package com.finanzas.transacciones.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransaccionResponse(
        UUID id,
        UUID usuarioId,
        String tipo,
        BigDecimal monto,
        String categoria,
        LocalDate fecha,
        String descripcion
) {}
