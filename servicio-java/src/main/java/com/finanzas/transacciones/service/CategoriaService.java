package com.finanzas.transacciones.service;

import com.finanzas.transacciones.dto.CategoriaResponse;
import com.finanzas.transacciones.model.Categoria;
import com.finanzas.transacciones.repository.CategoriaRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Catálogo de categorías: lo lee el frontend (GET) y lo valida el backend
 * al crear o editar movimientos y presupuestos.
 */
@Service
public class CategoriaService {

    private final CategoriaRepository repository;

    public CategoriaService(CategoriaRepository repository) {
        this.repository = repository;
    }

    public List<CategoriaResponse> listar() {
        return repository.findAllByOrderByOrdenAsc().stream()
                .map(CategoriaService::aRespuesta)
                .toList();
    }

    /** Normaliza igual que el resto del código: minúsculas y sin espacios. */
    public static String normalizar(String nombre) {
        return nombre == null ? "" : nombre.trim().toLowerCase(Locale.ROOT);
    }

    /** Indica si la categoría existe en el catálogo. */
    public boolean existe(String nombre) {
        String n = normalizar(nombre);
        if (n.isEmpty()) {
            return false;
        }
        return repository.existsByNombreIgnoreCase(n);
    }

    public static CategoriaResponse aRespuesta(Categoria c) {
        return new CategoriaResponse(
                c.getId(),
                c.getNombre(),
                c.getTipo().name(),
                c.getIcono(),
                c.getColor(),
                c.getOrden());
    }
}
