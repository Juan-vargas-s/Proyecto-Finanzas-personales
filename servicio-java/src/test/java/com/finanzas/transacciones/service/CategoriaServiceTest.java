package com.finanzas.transacciones.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.finanzas.transacciones.dto.CategoriaRequest;
import com.finanzas.transacciones.dto.CategoriaResponse;
import com.finanzas.transacciones.model.Categoria;
import com.finanzas.transacciones.model.Presupuesto;
import com.finanzas.transacciones.model.TipoCategoria;
import com.finanzas.transacciones.model.TipoTransaccion;
import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.repository.CategoriaRepository;
import com.finanzas.transacciones.repository.PresupuestoRepository;
import com.finanzas.transacciones.repository.TransaccionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@DataJpaTest
@Import(CategoriaService.class)
class CategoriaServiceTest {

    @Autowired
    private CategoriaRepository categorias;

    @Autowired
    private TransaccionRepository transacciones;

    @Autowired
    private PresupuestoRepository presupuestos;

    @Autowired
    private CategoriaService service;

    private final UUID usuarioId = UUID.randomUUID();

    private void sembrarPlantillas() {
        categorias.save(new Categoria("comida", TipoCategoria.GASTO, "•", "#f97316", 1));
        categorias.save(new Categoria("salario", TipoCategoria.INGRESO, "•", "#4ade80", 2));
        categorias.save(new Categoria("ahorro", TipoCategoria.AHORRO, "•", "#22d3ee", 3));
    }

    private Categoria categoriaPropia(String nombre, TipoCategoria tipo) {
        return categorias.save(new Categoria(
                usuarioId, nombre, tipo, "•", "#38bdf8", 1));
    }

    private Transaccion transaccion(String categoria) {
        Transaccion t = new Transaccion();
        t.setUsuarioId(usuarioId);
        t.setTipo(TipoTransaccion.GASTO);
        t.setMonto(new BigDecimal("100"));
        t.setCategoria(categoria);
        t.setFecha(LocalDate.of(2026, 10, 10));
        return transacciones.save(t);
    }

    private Presupuesto presupuesto(String categoria) {
        Presupuesto p = new Presupuesto();
        p.setUsuarioId(usuarioId);
        p.setCategoria(categoria);
        p.setLimiteMensual(new BigDecimal("500"));
        p.setMes("2026-10");
        return presupuestos.save(p);
    }

    @Test
    void clonaLasPlantillasGlobalesAlPrimerUso() {
        sembrarPlantillas();

        var lista = service.listar(usuarioId);

        assertThat(lista).extracting(CategoriaResponse::nombre)
                .containsExactly("comida", "salario", "ahorro");
        assertThat(lista).filteredOn(CategoriaResponse::reservada)
                .singleElement()
                .satisfies(c -> assertThat(c.nombre()).isEqualTo("ahorro"));
        assertThat(categorias.findByUsuarioIdOrderByOrdenAsc(usuarioId))
                .hasSize(3)
                .allMatch(c -> usuarioId.equals(c.getUsuarioId()));

        service.listar(usuarioId);
        assertThat(categorias.findByUsuarioIdOrderByOrdenAsc(usuarioId)).hasSize(3);
    }

    @Test
    void creaCategoriasPropiasSinAfectarAOtrosUsuarios() {
        sembrarPlantillas();
        service.listar(usuarioId);

        CategoriaResponse creada = service.crear(usuarioId,
                new CategoriaRequest(" Mascotas ", TipoCategoria.GASTO, "#22C55E"));

        assertThat(creada.nombre()).isEqualTo("mascotas");
        assertThat(creada.color()).isEqualTo("#22c55e");
        assertThat(creada.reservada()).isFalse();
        assertThat(service.listar(usuarioId)).extracting(CategoriaResponse::nombre)
                .contains("mascotas");

        UUID otroUsuario = UUID.randomUUID();
        assertThat(service.listar(otroUsuario)).extracting(CategoriaResponse::nombre)
                .doesNotContain("mascotas");
    }

    @Test
    void rechazaNombresDuplicadosEnElMismoUsuario() {
        sembrarPlantillas();
        service.listar(usuarioId);
        service.crear(usuarioId,
                new CategoriaRequest("mascotas", TipoCategoria.GASTO, "#22c55e"));

        assertThatThrownBy(() -> service.crear(usuarioId,
                new CategoriaRequest("MASCOTAS", TipoCategoria.GASTO, "#22c55e")))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getReason()).contains("mascotas");
                });
    }

    @Test
    void renombrarActualizaTransaccionesYPresupuestos() {
        Categoria categoria = categoriaPropia("comida", TipoCategoria.GASTO);
        Transaccion t = transaccion("comida");
        Presupuesto p = presupuesto("comida");

        service.actualizar(usuarioId, categoria.getId(),
                new CategoriaRequest("alimentos", TipoCategoria.GASTO, "#f97316"));

        assertThat(transacciones.findById(t.getId()).orElseThrow().getCategoria())
                .isEqualTo("alimentos");
        assertThat(presupuestos.findById(p.getId()).orElseThrow().getCategoria())
                .isEqualTo("alimentos");
    }

    @Test
    void noCambiaElTipoSiHayMovimientos() {
        Categoria categoria = categoriaPropia("comida", TipoCategoria.GASTO);
        transaccion("comida");

        assertThatThrownBy(() -> service.actualizar(usuarioId, categoria.getId(),
                new CategoriaRequest("comida", TipoCategoria.INGRESO, "#f97316")))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getReason()).contains("movimientos");
                });
    }

    @Test
    void laCategoriaAhorroEsReservada() {
        Categoria ahorro = categorias.save(new Categoria(
                usuarioId, "ahorro", TipoCategoria.AHORRO, "•", "#22d3ee", 1));

        assertThatThrownBy(() -> service.actualizar(usuarioId, ahorro.getId(),
                new CategoriaRequest("otros", TipoCategoria.AHORRO, "#22d3ee")))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex ->
                        assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }
}
