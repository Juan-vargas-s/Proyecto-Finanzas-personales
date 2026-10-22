package com.finanzas.transacciones.controller;

import com.finanzas.transacciones.dto.PresupuestoEstadoResponse;
import com.finanzas.transacciones.dto.PresupuestoRequest;
import com.finanzas.transacciones.dto.ResumenMesResponse;
import com.finanzas.transacciones.model.Presupuesto;
import com.finanzas.transacciones.service.TransaccionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
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
public class PresupuestoController {

    private final TransaccionService service;

    public PresupuestoController(TransaccionService service) {
        this.service = service;
    }

    @PostMapping("/presupuestos")
    public ResponseEntity<PresupuestoResponse> guardarPresupuesto(
            HttpServletRequest request,
            @Valid @RequestBody PresupuestoRequest req) {
        Presupuesto p = service.guardarPresupuesto(usuarioIdRequerido(request), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(p));
    }

    @GetMapping("/presupuestos")
    public List<PresupuestoResponse> listarPresupuestos(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam String mes) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.listarPresupuestos(uid, parseMes(mes)).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Estado de todos los presupuestos del mes en una sola llamada.
     * Reemplaza al N+1 de pedir /presupuestos/{categoria} por cada categoría.
     */
    @GetMapping("/presupuestos/estado")
    public List<PresupuestoEstadoResponse> estadosPresupuestos(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam String mes) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.estadosPresupuestos(uid, parseMes(mes));
    }

    /**
     * Estado del presupuesto: límite + gasto acumulado real.
     * Lo consume el servicio de Go (metas) para generar alertas ≥80%.
     */
    @GetMapping("/presupuestos/{categoria}")
    public PresupuestoEstadoResponse estadoPresupuesto(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @PathVariable String categoria,
            @RequestParam String mes) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.estadoPresupuesto(uid, categoria, parseMes(mes))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No existe presupuesto para esa categoría y mes"));
    }

    /** Edita un presupuesto: cambia el límite, la categoría o el mes. */
    @PutMapping("/presupuestos/{id}")
    public PresupuestoResponse actualizarPresupuesto(
            HttpServletRequest request,
            @PathVariable UUID id,
            @Valid @RequestBody PresupuestoRequest req) {
        return service.actualizarPresupuesto(usuarioIdRequerido(request), id, req)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Presupuesto no encontrado"));
    }

    /** Elimina un presupuesto del mes. */
    @DeleteMapping("/presupuestos/{id}")
    public ResponseEntity<Void> eliminarPresupuesto(
            HttpServletRequest request,
            @PathVariable UUID id) {
        if (!service.eliminarPresupuesto(usuarioIdRequerido(request), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Presupuesto no encontrado");
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/resumen")
    public ResumenMesResponse resumen(
            HttpServletRequest request,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam String mes) {
        UUID uid = usuarioId != null ? usuarioId : usuarioIdRequerido(request);
        return service.resumen(uid, parseMes(mes));
    }

    private UUID usuarioIdRequerido(HttpServletRequest request) {
        Object attr = request.getAttribute("usuarioId");
        if (attr == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Token JWT inválido o ausente");
        }
        return (UUID) attr;
    }

    private PresupuestoResponse toResponse(Presupuesto p) {
        return new PresupuestoResponse(p.getId(), p.getCategoria(), p.getLimiteMensual(), p.getMes());
    }

    private YearMonth parseMes(String mes) {
        try {
            return YearMonth.parse(mes);
        } catch (DateTimeParseException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parámetro 'mes' requerido con formato YYYY-MM");
        }
    }

    record PresupuestoResponse(UUID id, String categoria, BigDecimal limiteMensual, String mes) {}
}
