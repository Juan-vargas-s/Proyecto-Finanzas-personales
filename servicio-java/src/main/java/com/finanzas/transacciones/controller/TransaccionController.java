package com.finanzas.transacciones.controller;

import com.finanzas.transacciones.dto.TendenciaMesResponse;
import com.finanzas.transacciones.dto.TransaccionRequest;
import com.finanzas.transacciones.dto.TransaccionResponse;
import com.finanzas.transacciones.model.TipoTransaccion;
import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.service.TransaccionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/transacciones")
public class TransaccionController {

    private final TransaccionService service;

    public TransaccionController(TransaccionService service) {
        this.service = service;
    }

    @PostMapping({ "", "/" })
    public ResponseEntity<TransaccionResponse> crear(
            HttpServletRequest request,
            @Valid @RequestBody TransaccionRequest req) {
        Transaccion t = service.crear(usuarioIdRequerido(request), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(t));
    }

    /**
     * Listado con filtros opcionales (mes=YYYY-MM). Los servicios de Python y
     * Go lo llaman internamente pasando usuarioId en query; el frontend lo
     * llama con JWT (el usuarioId viene del token).
     */
    @GetMapping({ "", "/" })
    public List<TransaccionResponse> listar(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam(required = false) String mes,
            @RequestParam(required = false) TipoTransaccion tipo,
            @RequestParam(required = false) String categoria) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.listar(uid, parseMes(mes), tipo, categoria).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Serie mensual en una sola llamada: meses=2026-05,2026-06,...
     * El servicio de Python la usa para la gráfica de tendencia del dashboard
     * y así evita pedir un resumen por cada mes.
     */
    @GetMapping("/tendencia")
    public List<TendenciaMesResponse> tendencia(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam String meses) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        List<YearMonth> lista = Arrays.stream(meses.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(this::parseMesObligatorio)
                .toList();
        return service.tendencia(uid, lista);
    }

    @GetMapping("/{id}")
    public TransaccionResponse obtener(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @PathVariable UUID id) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.obtener(uid, id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Transacción no encontrada"));
    }

    @PutMapping("/{id}")
    public TransaccionResponse actualizar(
            HttpServletRequest request,
            @PathVariable UUID id,
            @Valid @RequestBody TransaccionRequest req) {
        return service.actualizar(usuarioIdRequerido(request), id, req)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Transacción no encontrada"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            HttpServletRequest request,
            @PathVariable UUID id) {
        if (!service.eliminar(usuarioIdRequerido(request), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transacción no encontrada");
        }
        return ResponseEntity.noContent().build();
    }

    private UUID usuarioIdRequerido(HttpServletRequest request) {
        Object attr = request.getAttribute("usuarioId");
        if (attr == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Token JWT inválido o ausente");
        }
        return (UUID) attr;
    }

    private TransaccionResponse toResponse(Transaccion t) {
        return new TransaccionResponse(
                t.getId(), t.getUsuarioId(), t.getTipo().name(),
                t.getMonto(), t.getCategoria(), t.getFecha(), t.getDescripcion(),
                t.getMetaId(), t.getAporteId());
    }

    private YearMonth parseMes(String mes) {
        if (mes == null || mes.isBlank()) {
            return null;
        }
        try {
            return YearMonth.parse(mes);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de mes inválido (usa YYYY-MM)");
        }
    }

    private YearMonth parseMesObligatorio(String mes) {
        YearMonth valor = parseMes(mes);
        if (valor == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Formato de mes inválido (usa YYYY-MM)");
        }
        return valor;
    }
}
