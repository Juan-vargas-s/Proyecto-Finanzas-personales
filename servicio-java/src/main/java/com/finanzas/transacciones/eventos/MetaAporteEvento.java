package com.finanzas.transacciones.eventos;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MetaAporteEvento(
        String tipo,
        String aporteId,
        String usuarioId,
        String metaId,
        java.math.BigDecimal monto,
        String fecha
) {
}
