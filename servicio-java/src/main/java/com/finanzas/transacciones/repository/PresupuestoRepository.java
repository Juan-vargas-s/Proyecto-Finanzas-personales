package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.Presupuesto;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PresupuestoRepository extends JpaRepository<Presupuesto, UUID> {

    Optional<Presupuesto> findByUsuarioIdAndCategoriaAndMes(UUID usuarioId, String categoria, String mes);

    Optional<Presupuesto> findByIdAndUsuarioId(UUID id, UUID usuarioId);

    List<Presupuesto> findByUsuarioIdAndMes(UUID usuarioId, String mes);

    void deleteByIdAndUsuarioId(UUID id, UUID usuarioId);

    boolean existsByUsuarioIdAndCategoria(UUID usuarioId, String categoria);

    @Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Presupuesto p SET p.categoria = :nuevo
            WHERE p.usuarioId = :usuarioId AND p.categoria = :anterior
            """)
    int renombrarCategoria(@Param("usuarioId") UUID usuarioId,
                           @Param("anterior") String anterior,
                           @Param("nuevo") String nuevo);
}
