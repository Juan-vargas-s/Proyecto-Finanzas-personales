package com.finanzas.transacciones.dto;

import com.finanzas.transacciones.model.TipoCategoria;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CategoriaRequest(
        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 40, message = "El nombre no puede superar 40 caracteres")
        String nombre,

        @NotNull(message = "El tipo es obligatorio")
        TipoCategoria tipo,

        @NotBlank(message = "El color es obligatorio")
        @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "El color debe tener formato #rrggbb")
        String color
) {}
