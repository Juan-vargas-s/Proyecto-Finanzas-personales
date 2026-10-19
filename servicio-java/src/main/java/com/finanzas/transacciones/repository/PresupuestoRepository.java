package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.Presupuesto;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PresupuestoRepository extends JpaRepository<Presupuesto, UUID> {

    Optional<Presupuesto> findByUsuarioIdAndCategoriaAndMes(UUID usuarioId, String categoria, String mes);

    List<Presupuesto> findByUsuarioIdAndMes(UUID usuarioId, String mes);

    void deleteByIdAndUsuarioId(UUID id, UUID usuarioId);
}
