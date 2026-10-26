package com.finanzas.transacciones.service;

import com.finanzas.transacciones.dto.PresupuestoEstadoResponse;
import com.finanzas.transacciones.dto.PresupuestoRequest;
import com.finanzas.transacciones.dto.ResumenMesResponse;
import com.finanzas.transacciones.dto.TendenciaMesResponse;
import com.finanzas.transacciones.dto.TransaccionRequest;
import com.finanzas.transacciones.model.Presupuesto;
import com.finanzas.transacciones.model.TipoCategoria;
import com.finanzas.transacciones.model.TipoTransaccion;
import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.repository.PresupuestoRepository;
import com.finanzas.transacciones.repository.TransaccionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransaccionService {

    private final TransaccionRepository transaccionRepository;
    private final PresupuestoRepository presupuestoRepository;
    private final CategoriaService categoriaService;
    private final OutboxService outboxService;

    public TransaccionService(TransaccionRepository transaccionRepository,
                              PresupuestoRepository presupuestoRepository,
                              CategoriaService categoriaService,
                              OutboxService outboxService) {
        this.transaccionRepository = transaccionRepository;
        this.presupuestoRepository = presupuestoRepository;
        this.categoriaService = categoriaService;
        this.outboxService = outboxService;
    }

    // ---------- Transacciones ----------

    @Transactional
    public Transaccion crear(UUID usuarioId, TransaccionRequest req) {
        String categoria = validarCategoria(usuarioId, req.categoria(), req.tipo());
        Transaccion t = new Transaccion();
        t.setUsuarioId(usuarioId);
        t.setTipo(req.tipo());
        t.setMonto(req.monto());
        t.setCategoria(categoria);
        t.setFecha(req.fecha());
        t.setDescripcion(req.descripcion());
        Transaccion guardada = transaccionRepository.save(t);
        outboxService.registrar("transaccion.registrada", usuarioId, camposTransaccion(guardada));
        return guardada;
    }

    /**
     * Crea una transacción AHORRO a partir de un evento de aporte. Es
     * idempotente: si ya existe una transacción con ese aporteId, no hace
     * nada. El monto puede ser negativo (retiro).
     */
    @Transactional
    public void aplicarAporte(UUID usuarioId, UUID metaId, UUID aporteId,
                              BigDecimal monto, LocalDate fecha, String categoria) {
        if (aporteId != null && transaccionRepository.existsByAporteId(aporteId)) {
            return;
        }
        Transaccion t = new Transaccion();
        t.setUsuarioId(usuarioId);
        t.setTipo(TipoTransaccion.AHORRO);
        t.setMonto(monto);
        t.setCategoria(categoria == null || categoria.isBlank() ? "ahorro" : categoria.trim().toLowerCase());
        t.setFecha(fecha == null ? LocalDate.now() : fecha);
        t.setDescripcion("Aporte a meta");
        t.setMetaId(metaId);
        t.setAporteId(aporteId);
        try {
            transaccionRepository.save(t);
        } catch (Exception ex) {
            // Condición de carrera: otro hilo ya insertó con el mismo aporteId (UNIQUE).
            // La idempotencia se garantiza por el índice único; ignorar el fallo.
        }
    }

    @Transactional
    public void aplicarRetiro(UUID usuarioId, UUID metaId, UUID aporteId,
                              BigDecimal monto, LocalDate fecha, String categoria) {
        aplicarAporte(usuarioId, metaId, aporteId, monto.negate(), fecha, categoria);
    }

    public List<Transaccion> listar(UUID usuarioId, YearMonth mes,
                                    TipoTransaccion tipo, String categoria) {
        LocalDate inicio = mes != null ? mes.atDay(1) : null;
        LocalDate fin = mes != null ? mes.atEndOfMonth() : null;
        String cat = categoria != null && !categoria.isBlank()
                ? categoria.trim().toLowerCase()
                : null;
        return transaccionRepository.findAll(
                TransaccionRepository.conFiltros(usuarioId, tipo, cat, inicio, fin));
    }

    public Optional<Transaccion> obtener(UUID usuarioId, UUID id) {
        return transaccionRepository.findByIdAndUsuarioId(id, usuarioId);
    }

    @Transactional
    public Optional<Transaccion> actualizar(UUID usuarioId, UUID id, TransaccionRequest req) {
        String categoria = validarCategoria(usuarioId, req.categoria(), req.tipo());
        return transaccionRepository.findByIdAndUsuarioId(id, usuarioId).map(t -> {
            t.setTipo(req.tipo());
            t.setMonto(req.monto());
            t.setCategoria(categoria);
            t.setFecha(req.fecha());
            t.setDescripcion(req.descripcion());
            Transaccion guardada = transaccionRepository.save(t);
            outboxService.registrar("transaccion.actualizada", usuarioId, camposTransaccion(guardada));
            return guardada;
        });
    }

    @Transactional
    public boolean eliminar(UUID usuarioId, UUID id) {
        Optional<Transaccion> existe = transaccionRepository.findByIdAndUsuarioId(id, usuarioId);
        if (existe.isEmpty()) {
            return false;
        }
        Transaccion t = existe.get();
        transaccionRepository.deleteByIdAndUsuarioId(id, usuarioId);
        outboxService.registrar("transaccion.eliminada", usuarioId, camposTransaccion(t));
        return true;
    }

    /**
     * Valida que la categoría exista en el catálogo. Los movimientos internos
     * de tipo AHORRO (aportes a metas) usan la categoría reservada "ahorro",
     * por eso se saltan la comprobación.
     */
    private String validarCategoria(UUID usuarioId, String categoria, TipoTransaccion tipo) {
        String cat = CategoriaService.normalizar(categoria);
        if (cat.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La categoría es obligatoria");
        }
        if (tipo == TipoTransaccion.AHORRO) {
            return cat;
        }
        TipoCategoria esperado = tipo == TipoTransaccion.INGRESO
                ? TipoCategoria.INGRESO
                : TipoCategoria.GASTO;
        if (!categoriaService.existe(usuarioId, cat, esperado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La categoría '" + cat + "' no existe o no es de tipo " + esperado);
        }
        return cat;
    }

    private Map<String, String> camposTransaccion(Transaccion t) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("transaccionId", t.getId().toString());
        campos.put("tipoTransaccion", t.getTipo().name());
        campos.put("monto", t.getMonto().toPlainString());
        campos.put("categoria", t.getCategoria());
        campos.put("fecha", t.getFecha().toString());
        return campos;
    }

    // ---------- Presupuestos ----------

    @Transactional
    public Presupuesto guardarPresupuesto(UUID usuarioId, PresupuestoRequest req) {
        String categoria = validarCategoriaPresupuesto(usuarioId, req.categoria());
        Presupuesto p = presupuestoRepository
                .findByUsuarioIdAndCategoriaAndMes(usuarioId, categoria, req.mes())
                .orElseGet(Presupuesto::new);
        p.setUsuarioId(usuarioId);
        p.setCategoria(categoria);
        p.setLimiteMensual(req.limiteMensual());
        p.setMes(req.mes());
        Presupuesto guardado = presupuestoRepository.save(p);
        outboxService.registrar("presupuesto.actualizado", usuarioId, camposPresupuesto(guardado, "creado"));
        return guardado;
    }

    /** Edita un presupuesto existente (límite, categoría o mes). */
    @Transactional
    public Optional<Presupuesto> actualizarPresupuesto(UUID usuarioId, UUID id, PresupuestoRequest req) {
        String categoria = validarCategoriaPresupuesto(usuarioId, req.categoria());
        Optional<Presupuesto> actual = presupuestoRepository.findByIdAndUsuarioId(id, usuarioId);
        if (actual.isEmpty()) {
            return Optional.empty();
        }
        // La categoría y el mes son únicos por usuario: no puede chocar con otro.
        Optional<Presupuesto> choque = presupuestoRepository
                .findByUsuarioIdAndCategoriaAndMes(usuarioId, categoria, req.mes());
        if (choque.isPresent() && !choque.get().getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un presupuesto para esa categoría en ese mes");
        }
        Presupuesto p = actual.get();
        p.setCategoria(categoria);
        p.setLimiteMensual(req.limiteMensual());
        p.setMes(req.mes());
        Presupuesto guardado = presupuestoRepository.save(p);
        outboxService.registrar("presupuesto.actualizado", usuarioId, camposPresupuesto(guardado, "editado"));
        return Optional.of(guardado);
    }

    @Transactional
    public boolean eliminarPresupuesto(UUID usuarioId, UUID id) {
        Optional<Presupuesto> existe = presupuestoRepository.findByIdAndUsuarioId(id, usuarioId);
        if (existe.isEmpty()) {
            return false;
        }
        Presupuesto p = existe.get();
        presupuestoRepository.deleteByIdAndUsuarioId(id, usuarioId);
        outboxService.registrar("presupuesto.actualizado", usuarioId, camposPresupuesto(p, "eliminado"));
        return true;
    }

    private String validarCategoriaPresupuesto(UUID usuarioId, String categoria) {
        String cat = CategoriaService.normalizar(categoria);
        if (cat.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La categoría es obligatoria");
        }
        if (!categoriaService.existe(usuarioId, cat, TipoCategoria.GASTO)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La categoría '" + cat + "' no existe o no es de tipo GASTO");
        }
        return cat;
    }

    private Map<String, String> camposPresupuesto(Presupuesto p, String accion) {
        Map<String, String> campos = new LinkedHashMap<>();
        campos.put("presupuestoId", p.getId().toString());
        campos.put("categoria", p.getCategoria());
        campos.put("limiteMensual", p.getLimiteMensual().toPlainString());
        campos.put("mes", p.getMes());
        campos.put("accion", accion);
        return campos;
    }

    public Optional<PresupuestoEstadoResponse> estadoPresupuesto(UUID usuarioId, String categoria, YearMonth mes) {
        String cat = categoria.trim().toLowerCase();
        return presupuestoRepository
                .findByUsuarioIdAndCategoriaAndMes(usuarioId, cat, mes.toString())
                .map(p -> {
                    BigDecimal gasto = transaccionRepository.sumGastosPorCategoria(
                            usuarioId, cat, mes.atDay(1), mes.atEndOfMonth());
                    return calcularEstado(p, gasto);
                });
    }

    /**
     * Estado de TODOS los presupuestos del mes en 2 consultas (presupuestos +
     * gasto agrupado por categoría), en lugar de 2 consultas por presupuesto.
     */
    public List<PresupuestoEstadoResponse> estadosPresupuestos(UUID usuarioId, YearMonth mes) {
        List<Presupuesto> presupuestos = presupuestoRepository
                .findByUsuarioIdAndMes(usuarioId, mes.toString());
        if (presupuestos.isEmpty()) {
            return List.of();
        }
        Map<String, BigDecimal> gastoPorCategoria = new HashMap<>();
        for (Object[] fila : transaccionRepository.sumGastosPorCategoriaEnRango(
                usuarioId, mes.atDay(1), mes.atEndOfMonth())) {
            gastoPorCategoria.put((String) fila[0], (BigDecimal) fila[1]);
        }
        return presupuestos.stream()
                .map(p -> calcularEstado(p, gastoPorCategoria.getOrDefault(p.getCategoria(), BigDecimal.ZERO)))
                .toList();
    }

    private PresupuestoEstadoResponse calcularEstado(Presupuesto p, BigDecimal gasto) {
        BigDecimal restante = p.getLimiteMensual().subtract(gasto);
        double porcentaje = p.getLimiteMensual().compareTo(BigDecimal.ZERO) > 0
                ? gasto.multiply(BigDecimal.valueOf(100))
                        .divide(p.getLimiteMensual(), 1, RoundingMode.HALF_UP)
                        .doubleValue()
                : 0.0;
        return new PresupuestoEstadoResponse(
                p.getId(), p.getCategoria(), p.getLimiteMensual(),
                gasto, restante, porcentaje, p.getMes());
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
        BigDecimal totalAhorro = transaccionRepository.sumAhorrosPorUsuario(
                usuarioId, mes.atDay(1), mes.atEndOfMonth());
        BigDecimal balance = ingresos.subtract(gastos);
        // El balance no cambia: ingresos - gastos. "disponible" = lo que queda
        // sin estar comprometido en metas (balance - lo apartado en metas).
        BigDecimal disponible = balance.subtract(totalAhorro);
        return new ResumenMesResponse(ingresos, gastos, balance, totalAhorro, disponible, mes.toString());
    }

    /**
     * Serie mensual de ingresos/gastos para los meses indicados.
     * Se resuelve con 2 consultas agregadas (una por tipo) en lugar de una
     * consulta por mes: el servicio de Python deja de hacer 6 round-trips.
     */
    public List<TendenciaMesResponse> tendencia(UUID usuarioId, List<YearMonth> meses) {
        if (meses.isEmpty()) {
            return List.of();
        }
        YearMonth desde = meses.stream().min(Comparator.naturalOrder()).orElseThrow();
        YearMonth hasta = meses.stream().max(Comparator.naturalOrder()).orElseThrow();

        Map<YearMonth, BigDecimal> ingresos = agruparPorMes(
                transaccionRepository.sumIngresosPorMes(usuarioId, desde.atDay(1), hasta.atEndOfMonth()));
        Map<YearMonth, BigDecimal> gastos = agruparPorMes(
                transaccionRepository.sumGastosPorMes(usuarioId, desde.atDay(1), hasta.atEndOfMonth()));

        return meses.stream().map(mes -> {
            BigDecimal ing = ingresos.getOrDefault(mes, BigDecimal.ZERO);
            BigDecimal gas = gastos.getOrDefault(mes, BigDecimal.ZERO);
            return new TendenciaMesResponse(mes.toString(), ing, gas, ing.subtract(gas));
        }).toList();
    }

    private Map<YearMonth, BigDecimal> agruparPorMes(List<Object[]> filas) {
        Map<YearMonth, BigDecimal> mapa = new HashMap<>();
        for (Object[] fila : filas) {
            int anio = ((Number) fila[0]).intValue();
            int mes = ((Number) fila[1]).intValue();
            mapa.put(YearMonth.of(anio, mes), (BigDecimal) fila[2]);
        }
        return mapa;
    }
}
