package com.finanzas.transacciones.dto;

import java.util.UUID;

/**
 * Categoría del catálogo del usuario: nombre, tipo y color para pintar cada
 * movimiento. "reservada" marca la categoría interna de ahorro.
 */
public record CategoriaResponse(
        UUID id,
        String nombre,
        String tipo,
        String icono,
        String color,
        Integer orden,
        boolean reservada
) {}
