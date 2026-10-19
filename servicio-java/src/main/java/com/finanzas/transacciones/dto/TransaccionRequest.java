package com.finanzas.transacciones.dto;

import com.finanzas.transacciones.model.TipoTransaccion;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TransaccionRequest(
        @NotNull(message = "El tipo es obligatorio (INGRESO o GASTO)")
        TipoTransaccion tipo,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
        BigDecimal monto,

        @NotBlank(message = "La categoría es obligatoria")
        String categoria,

        @NotNull(message = "La fecha es obligatoria")
        @PastOrPresent(message = "La fecha no puede ser futura")
        LocalDate fecha,

        String descripcion
) {}
