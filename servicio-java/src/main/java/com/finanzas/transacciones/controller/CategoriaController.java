package com.finanzas.transacciones.controller;

import com.finanzas.transacciones.dto.CategoriaResponse;
import com.finanzas.transacciones.service.CategoriaService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Catálogo de categorías. Es un dato global (no depende del usuario), por lo
 * que se puede pedir sin token: el frontend lo usa para pintar iconos y
 * validar el formulario antes de enviar nada.
 */
@RestController
@RequestMapping("/api/transacciones/categorias")
public class CategoriaController {

    private final CategoriaService service;

    public CategoriaController(CategoriaService service) {
        this.service = service;
    }

    @GetMapping({ "", "/" })
    public List<CategoriaResponse> listar() {
        return service.listar();
    }
}
