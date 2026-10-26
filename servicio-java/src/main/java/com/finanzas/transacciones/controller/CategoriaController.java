package com.finanzas.transacciones.controller;

import com.finanzas.transacciones.config.UsuarioResolver;
import com.finanzas.transacciones.dto.CategoriaRequest;
import com.finanzas.transacciones.dto.CategoriaResponse;
import com.finanzas.transacciones.service.CategoriaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Catálogo de categorías del usuario. Se copia de las plantillas globales en
 * el primer GET y a partir de ahí cada usuario puede crear y editar las suyas.
 */
@RestController
@RequestMapping("/api/transacciones/categorias")
public class CategoriaController {

    private final CategoriaService service;
    private final UsuarioResolver usuarioResolver;

    public CategoriaController(CategoriaService service, UsuarioResolver usuarioResolver) {
        this.service = service;
        this.usuarioResolver = usuarioResolver;
    }

    @GetMapping({ "", "/" })
    public List<CategoriaResponse> listar(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId) {
        return service.listar(usuarioResolver.resolver(request, usuarioId));
    }

    @PostMapping({ "", "/" })
    public ResponseEntity<CategoriaResponse> crear(
            HttpServletRequest request,
            @Valid @RequestBody CategoriaRequest req) {
        CategoriaResponse creada = service.crear(usuarioResolver.requerido(request), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(creada);
    }

    @PutMapping("/{id}")
    public CategoriaResponse actualizar(
            HttpServletRequest request,
            @PathVariable UUID id,
            @Valid @RequestBody CategoriaRequest req) {
        return service.actualizar(usuarioResolver.requerido(request), id, req);
    }
}
