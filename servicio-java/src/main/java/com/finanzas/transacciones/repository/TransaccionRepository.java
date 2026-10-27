package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.TipoTransaccion;
import com.finanzas.transacciones.model.Transaccion;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransaccionRepository extends JpaRepository<Transaccion, UUID>,
        JpaSpecificationExecutor<Transaccion> {

    Optional<Transaccion> findByIdAndUsuarioId(UUID id, UUID usuarioId);

    void deleteByIdAndUsuarioId(UUID id, UUID usuarioId);

    boolean existsByUsuarioIdAndCategoria(UUID usuarioId, String categoria);

    @Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Transaccion t SET t.categoria = :nuevo
            WHERE t.usuarioId = :usuarioId AND t.categoria = :anterior
            """)
    int renombrarCategoria(@Param("usuarioId") UUID usuarioId,
                           @Param("anterior") String anterior,
                           @Param("nuevo") String nuevo);

    /**
     * Filtros opcionales (tipo, categoria, rango de fechas). Solo se agregan
     * predicados cuando hay valor, evitando el error de PostgreSQL con
     * parámetros NULL implícitos en JPQL dinámico.
     */
    static Specification<Transaccion> conFiltros(UUID usuarioId, TipoTransaccion tipo,
                                                 String categoria, LocalDate inicio, LocalDate fin) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("usuarioId"), usuarioId));
            if (tipo != null) {
                predicates.add(cb.equal(root.get("tipo"), tipo));
            }
            if (categoria != null) {
                predicates.add(cb.equal(root.get("categoria"), categoria));
            }
            if (inicio != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("fecha"), inicio));
            }
            if (fin != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("fecha"), fin));
            }
            query.orderBy(cb.desc(root.get("fecha")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

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

    /**
     * Gasto acumulado agrupado por categoría en un rango. Resuelve de una sola
     * consulta el gasto de todos los presupuestos del mes, evitando el N+1 de
     * consultar categoría por categoría.
     */
    @Query("""
            SELECT t.categoria, COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.GASTO
              AND t.fecha BETWEEN :inicio AND :fin
            GROUP BY t.categoria
            """)
    List<Object[]> sumGastosPorCategoriaEnRango(@Param("usuarioId") UUID usuarioId,
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

    /**
     * Dinero apartado en metas dentro del rango. Es el espejo de
     * sumIngresosPorUsuario: el total ahorrado del mes. Los aportes son
     * positivos y los retiros negativos, así que el SUM ya netsa.
     */
    @Query("""
            SELECT COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.AHORRO
              AND t.fecha BETWEEN :inicio AND :fin
            """)
    BigDecimal sumAhorrosPorUsuario(@Param("usuarioId") UUID usuarioId,
                                   @Param("inicio") LocalDate inicio,
                                   @Param("fin") LocalDate fin);

    /**
     * Idempotencia del consumidor de eventos: si el aporte ya se materializó
     * como transacción, no se vuelve a aplicar.
     */
    boolean existsByAporteId(UUID aporteId);

    /**
     * Ingresos agrupados por mes en un rango. Una sola consulta cubre toda la
     * serie de tendencia, en lugar de una consulta por mes.
     */
    @Query("""
            SELECT YEAR(t.fecha), MONTH(t.fecha), COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.INGRESO
              AND t.fecha BETWEEN :inicio AND :fin
            GROUP BY YEAR(t.fecha), MONTH(t.fecha)
            """)
    List<Object[]> sumIngresosPorMes(@Param("usuarioId") UUID usuarioId,
                                    @Param("inicio") LocalDate inicio,
                                    @Param("fin") LocalDate fin);

    /**
     * Gastos agrupados por mes en un rango (espejo de sumIngresosPorMes).
     */
    @Query("""
            SELECT YEAR(t.fecha), MONTH(t.fecha), COALESCE(SUM(t.monto), 0) FROM Transaccion t
            WHERE t.usuarioId = :usuarioId
              AND t.tipo = com.finanzas.transacciones.model.TipoTransaccion.GASTO
              AND t.fecha BETWEEN :inicio AND :fin
            GROUP BY YEAR(t.fecha), MONTH(t.fecha)
            """)
    List<Object[]> sumGastosPorMes(@Param("usuarioId") UUID usuarioId,
                                   @Param("inicio") LocalDate inicio,
                                   @Param("fin") LocalDate fin);
}
