package com.finanzas.transacciones.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.finanzas.transacciones.model.TipoTransaccion;
import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.repository.TransaccionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;

/**
 * Fase 1.1: el ahorro no es gasto. Un aporte a una meta se registra como
 * transaccion AHORRO, por lo que no debe consumir presupuesto (los agregados
 * de gasto filtran tipo = GASTO exacto) y debe ser idempotente por aporteId.
 */
@DataJpaTest
@Import(TransaccionService.class)
class TransaccionServiceAhorroTest {

    private static final LocalDate INICIO = LocalDate.of(2026, 10, 1);
    private static final LocalDate FIN = LocalDate.of(2026, 10, 31);

    @Autowired
    private TransaccionRepository repository;

    @Autowired
    private TransaccionService service;

    @MockBean
    private CategoriaService categoriaService;

    @MockBean
    private OutboxService outboxService;

    private final UUID usuarioId = UUID.randomUUID();

    private Transaccion transaccion(TipoTransaccion tipo, String categoria, String monto) {
        Transaccion t = new Transaccion();
        t.setUsuarioId(usuarioId);
        t.setTipo(tipo);
        t.setCategoria(categoria);
        t.setMonto(new BigDecimal(monto));
        t.setFecha(LocalDate.of(2026, 10, 10));
        return t;
    }

    @Test
    void unAporteNoConsumePresupuesto() {
        repository.save(transaccion(TipoTransaccion.GASTO, "comida", "50"));
        repository.save(transaccion(TipoTransaccion.AHORRO, "ahorro", "200"));

        assertThat(repository.sumGastosPorCategoria(usuarioId, "comida", INICIO, FIN))
                .isEqualByComparingTo("50");
        assertThat(repository.sumGastosPorUsuario(usuarioId, INICIO, FIN))
                .isEqualByComparingTo("50");
        assertThat(repository.sumAhorrosPorUsuario(usuarioId, INICIO, FIN))
                .isEqualByComparingTo("200");
    }

    @Test
    void elAporteEsIdempotentePorAporteId() {
        UUID aporteId = UUID.randomUUID();

        service.aplicarAporte(usuarioId, UUID.randomUUID(), aporteId,
                new BigDecimal("200"), LocalDate.of(2026, 10, 10), "ahorro");
        service.aplicarAporte(usuarioId, UUID.randomUUID(), aporteId,
                new BigDecimal("200"), LocalDate.of(2026, 10, 10), "ahorro");

        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.existsByAporteId(aporteId)).isTrue();
    }

    @Test
    void elRetiroSeRegistraComoAhorroNegativo() {
        service.aplicarRetiro(usuarioId, UUID.randomUUID(), UUID.randomUUID(),
                new BigDecimal("200"), LocalDate.of(2026, 10, 10), "ahorro");

        assertThat(repository.findAll()).singleElement().satisfies(t -> {
            assertThat(t.getTipo()).isEqualTo(TipoTransaccion.AHORRO);
            assertThat(t.getMonto()).isEqualByComparingTo("-200");
        });
    }

    @Test
    void elResumenNoMezclaAhorroConGastos() {
        repository.save(transaccion(TipoTransaccion.INGRESO, "sueldo", "1000"));
        repository.save(transaccion(TipoTransaccion.GASTO, "comida", "100"));
        repository.save(transaccion(TipoTransaccion.AHORRO, "ahorro", "300"));

        var resumen = service.resumen(usuarioId, java.time.YearMonth.of(2026, 10));

        assertThat(resumen.balance()).isEqualByComparingTo("900");
        assertThat(resumen.totalAhorro()).isEqualByComparingTo("300");
        assertThat(resumen.disponible()).isEqualByComparingTo("600");
    }
}
