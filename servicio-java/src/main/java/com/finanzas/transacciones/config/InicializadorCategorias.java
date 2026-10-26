package com.finanzas.transacciones.config;

import com.finanzas.transacciones.model.Categoria;
import com.finanzas.transacciones.model.TipoCategoria;
import com.finanzas.transacciones.repository.CategoriaRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Siembra el catálogo de categorías al arrancar. Es idempotente: solo
 * inserta las que faltan, así una categoría agregada a mano en la base no
 * se pierde al reiniciar el servicio.
 */
@Component
@Order(10)
public class InicializadorCategorias implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InicializadorCategorias.class);

    private final CategoriaRepository repository;

    public InicializadorCategorias(CategoriaRepository repository) {
        this.repository = repository;
    }

    private static final List<Categoria> CATALOGO = List.of(
            new Categoria("comida", TipoCategoria.GASTO, "🍔", "#f97316", 1),
            new Categoria("transporte", TipoCategoria.GASTO, "🚗", "#38bdf8", 2),
            new Categoria("entretenimiento", TipoCategoria.GASTO, "🎬", "#a78bfa", 3),
            new Categoria("vivienda", TipoCategoria.GASTO, "🏠", "#34d399", 4),
            new Categoria("servicios", TipoCategoria.GASTO, "💡", "#facc15", 5),
            new Categoria("salud", TipoCategoria.GASTO, "🩺", "#f472b6", 6),
            new Categoria("educacion", TipoCategoria.GASTO, "📚", "#60a5fa", 7),
            new Categoria("ropa", TipoCategoria.GASTO, "👕", "#c084fc", 8),
            new Categoria("otros", TipoCategoria.GASTO, "📦", "#94a3b8", 9),
            new Categoria("salario", TipoCategoria.INGRESO, "💼", "#4ade80", 10),
            new Categoria("freelance", TipoCategoria.INGRESO, "💻", "#2dd4bf", 11),
            // Categoría interna: la usan los aportes a metas de ahorro.
            new Categoria("ahorro", TipoCategoria.AHORRO, "🏦", "#22d3ee", 12));

    @Override
    public void run(ApplicationArguments args) {
        int insertadas = 0;
        for (Categoria c : CATALOGO) {
            if (!repository.existsByUsuarioIdIsNullAndNombreIgnoreCase(c.getNombre())) {
                repository.save(c);
                insertadas++;
            }
        }
        if (insertadas > 0) {
            log.info("Catálogo de categorías inicializado: {} categoría(s) nuevas", insertadas);
        }
    }
}
