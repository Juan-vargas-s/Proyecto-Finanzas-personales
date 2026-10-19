package com.finanzas.transacciones.service;

import com.finanzas.transacciones.dto.PresupuestoEstadoResponse;
import com.finanzas.transacciones.dto.PresupuestoRequest;
import com.finanzas.transacciones.dto.ResumenMesResponse;
import com.finanzas.transacciones.dto.TransaccionRequest;
import com.finanzas.transacciones.dto.TransaccionResponse;
import com.finanzas.transacciones.model.Presupuesto;
import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.repository.PresupuestoRepository;
import com.finanzas.transacciones.repository.TransaccionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransaccionService {

    private final TransaccionRepository transaccionRepository;
    private final PresupuestoRepository presupuestoRepository;

    public TransaccionService(TransaccionRepository transaccionRepository,
                              PresupuestoRepository presupuestoRepository) {
        this.transaccionRepository = transaccionRepository;
        this.presupuestoRepository = presupuestoRepository;
    }

    // ---------- Transacciones ----------

    public Transaccion crear(UUID usuarioId, TransaccionRequest req) {
        Transaccion t = new Transaccion();
        t.setUsuarioId(usuarioId);
        t.setTipo(req.tipo());
        t.setMonto(req.monto());
        t.setCategoria(req.categoria().trim().toLowerCase());
        t.setFecha(req.fecha());
        t.setDescripcion(req.descripcion());
        return transaccionRepository.save(t);
    }

    public List<Transaccion> listar(UUID usuarioId, YearMonth mes) {
        if (mes != null) {
            return transaccionRepository.findByUsuarioIdAndFechaBetweenOrderByFechaDesc(
                    usuarioId, mes.atDay(1), mes.atEndOfMonth());
        }
        return transaccionRepository.findByUsuarioIdOrderByFechaDesc(usuarioId);
    }

    public Optional<Transaccion> obtener(UUID usuarioId, UUID id) {
        return transaccionRepository.findByIdAndUsuarioId(id, usuarioId);
    }

    public Optional<Transaccion> actualizar(UUID usuarioId, UUID id, TransaccionRequest req) {
        return transaccionRepository.findByIdAndUsuarioId(id, usuarioId).map(t -> {
            t.setTipo(req.tipo());
            t.setMonto(req.monto());
            t.setCategoria(req.categoria().trim().toLowerCase());
            t.setFecha(req.fecha());
            t.setDescripcion(req.descripcion());
            return transaccionRepository.save(t);
        });
    }

    @Transactional
    public boolean eliminar(UUID usuarioId, UUID id) {
        Optional<Transaccion> existe = transaccionRepository.findByIdAndUsuarioId(id, usuarioId);
        if (existe.isEmpty()) {
            return false;
        }
        transaccionRepository.deleteByIdAndUsuarioId(id, usuarioId);
        return true;
    }

    // ---------- Presupuestos ----------

    public Presupuesto guardarPresupuesto(UUID usuarioId, PresupuestoRequest req) {
        String categoria = req.categoria().trim().toLowerCase();
        Presupuesto p = presupuestoRepository
                .findByUsuarioIdAndCategoriaAndMes(usuarioId, categoria, req.mes())
                .orElseGet(Presupuesto::new);
        p.setUsuarioId(usuarioId);
        p.setCategoria(categoria);
        p.setLimiteMensual(req.limiteMensual());
        p.setMes(req.mes());
        return presupuestoRepository.save(p);
    }

    public Optional<PresupuestoEstadoResponse> estadoPresupuesto(UUID usuarioId, String categoria, YearMonth mes) {
        String cat = categoria.trim().toLowerCase();
        return presupuestoRepository
                .findByUsuarioIdAndCategoriaAndMes(usuarioId, cat, mes.toString())
                .map(p -> {
                    BigDecimal gasto = transaccionRepository.sumGastosPorCategoria(
                            usuarioId, cat, mes.atDay(1), mes.atEndOfMonth());
                    BigDecimal restante = p.getLimiteMensual().subtract(gasto);
                    double porcentaje = p.getLimiteMensual().compareTo(BigDecimal.ZERO) > 0
                            ? gasto.multiply(BigDecimal.valueOf(100))
                                    .divide(p.getLimiteMensual(), 1, RoundingMode.HALF_UP)
                                    .doubleValue()
                            : 0.0;
                    return new PresupuestoEstadoResponse(
                            p.getId(), p.getCategoria(), p.getLimiteMensual(),
                            gasto, restante, porcentaje, p.getMes());
                });
    }

    public List<Presupuesto> listarPresupuestos(UUID usuarioId, YearMonth mes) {
        return presupuestoRepository.findByUsuarioIdAndMes(usuarioId, mes.toString());
    }

    // ---------- Reporte mensual (consumido por Python) ----------

    public ResumenMesResponse resumen(UUID usuarioId, YearMonth mes) {
        BigDecimal ingresos = transaccionRepository.sumIngresosPorUsuario(
                usuarioId, mes.atDay(1), mes.atEndOfMonth());
        BigDecimal gastos = transaccionRepository.sumGastosPorUsuario(
                usuarioId, mes.atDay(1), mes.atEndOfMonth());
        return new ResumenMesResponse(ingresos, gastos, ingresos.subtract(gastos), mes.toString());
    }
}
