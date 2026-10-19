package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.Transaccion;
import com.finanzas.transacciones.model.TipoTransaccion;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransaccionRepository extends JpaRepository<Transaccion, UUID> {

    List<Transaccion> findByUsuarioIdOrderByFechaDesc(UUID usuarioId);

    Optional<Transaccion> findByIdAndUsuarioId(UUID id, UUID usuarioId);

    void deleteByIdAndUsuarioId(UUID id, UUID usuarioId);

    List<Transaccion> findByUsuarioIdAndFechaBetweenOrderByFechaDesc(UUID usuarioId, LocalDate inicio, LocalDate fin);

    @Query("""
            SELECT COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.GASTO
              AND t.categoria = :categoria
              AND t.fecha BETWEEN :inicio AND :fin
            """)
    BigDecimal sumGastosPorCategoria(@Param("usuarioId") UUID usuarioId,
                                     @Param("categoria") String categoria,
                                     @Param("inicio") LocalDate inicio,
                                     @Param("fin") LocalDate fin);

    @Query("""
            SELECT COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.GASTO
              AND t.fecha BETWEEN :inicio AND :fin
            """)
    BigDecimal sumGastosPorUsuario(@Param("usuarioId") UUID usuarioId,
                                   @Param("inicio") LocalDate inicio,
                                   @Param("fin") LocalDate fin);

    @Query("""
            SELECT COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.INGRESO
              AND t.fecha BETWEEN :inicio AND :fin
            """)
    BigDecimal sumIngresosPorUsuario(@Param("usuarioId") UUID usuarioId,
                                     @Param("inicio") LocalDate inicio,
                                     @Param("fin") LocalDate fin);
}
