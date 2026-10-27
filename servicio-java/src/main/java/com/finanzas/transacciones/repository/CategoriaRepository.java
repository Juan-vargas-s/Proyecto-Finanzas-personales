package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.Categoria;
import com.finanzas.transacciones.model.TipoCategoria;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoriaRepository extends JpaRepository<Categoria, UUID> {

    List<Categoria> findByUsuarioIdOrderByOrdenAsc(UUID usuarioId);

    List<Categoria> findByUsuarioIdIsNullOrderByOrdenAsc();

    Optional<Categoria> findByIdAndUsuarioId(UUID id, UUID usuarioId);

    boolean existsByUsuarioIdIsNullAndNombreIgnoreCase(String nombre);

    boolean existsByUsuarioIdAndNombreIgnoreCase(UUID usuarioId, String nombre);

    boolean existsByUsuarioIdAndNombreIgnoreCaseAndTipo(
            UUID usuarioId, String nombre, TipoCategoria tipo);
}
