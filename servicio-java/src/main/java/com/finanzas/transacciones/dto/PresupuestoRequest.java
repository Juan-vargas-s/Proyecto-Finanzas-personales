package com.finanzas.transacciones.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record PresupuestoRequest(
        @NotBlank(message = "La categoría es obligatoria")
        String categoria,

        @NotNull(message = "El límite mensual es obligatorio")
        @DecimalMin(value = "0.01", message = "El límite debe ser mayor a 0")
        BigDecimal limiteMensual,

        @NotBlank(message = "El mes es obligatorio")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "El mes debe tener formato YYYY-MM")
        String mes
) {}
