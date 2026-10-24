package com.finanzas.transacciones.dto;

import java.util.UUID;

/**
 * Categoría del catálogo, tal como la consume el frontend: nombre, tipo,
 * icono y color para pintar cada movimiento sin un mapa duplicado.
 */
public record CategoriaResponse(
        UUID id,
        String nombre,
        String tipo,
        String icono,
        String color,
        Integer orden
) {}
