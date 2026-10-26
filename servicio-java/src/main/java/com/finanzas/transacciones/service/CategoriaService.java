package com.finanzas.transacciones.service;

import com.finanzas.transacciones.dto.CategoriaRequest;
import com.finanzas.transacciones.dto.CategoriaResponse;
import com.finanzas.transacciones.model.Categoria;
import com.finanzas.transacciones.model.TipoCategoria;
import com.finanzas.transacciones.repository.CategoriaRepository;
import com.finanzas.transacciones.repository.PresupuestoRepository;
import com.finanzas.transacciones.repository.TransaccionRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Catálogo de categorías por usuario. Las plantillas globales viven con
 * usuarioId NULL y se copian a cada usuario la primera vez que las necesita.
 */
@Service
public class CategoriaService {

    private static final String RESERVADA = "ahorro";
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final CategoriaRepository repository;
    private final TransaccionRepository transaccionRepository;
    private final PresupuestoRepository presupuestoRepository;

    public CategoriaService(CategoriaRepository repository,
                            TransaccionRepository transaccionRepository,
                            PresupuestoRepository presupuestoRepository) {
        this.repository = repository;
        this.transaccionRepository = transaccionRepository;
        this.presupuestoRepository = presupuestoRepository;
    }

    @Transactional
    public List<CategoriaResponse> listar(UUID usuarioId) {
        return asegurarCategorias(usuarioId).stream()
                .map(CategoriaService::aRespuesta)
                .toList();
    }

    @Transactional
    public CategoriaResponse crear(UUID usuarioId, CategoriaRequest req) {
        List<Categoria> actuales = asegurarCategorias(usuarioId);
        String nombre = normalizar(req.nombre());
        validarNueva(nombre, req.tipo(), req.color());
        if (repository.existsByUsuarioIdAndNombreIgnoreCase(usuarioId, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya tienes una categoría llamada '" + nombre + "'");
        }
        int orden = actuales.stream()
                .map(Categoria::getOrden)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
        Categoria nueva = new Categoria(
                usuarioId, nombre, req.tipo(), "•", req.color().toLowerCase(Locale.ROOT), orden);
        return aRespuesta(repository.save(nueva));
    }

    @Transactional
    public CategoriaResponse actualizar(UUID usuarioId, UUID id, CategoriaRequest req) {
        Categoria categoria = repository.findByIdAndUsuarioId(id, usuarioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        String nombre = normalizar(req.nombre());
        validarColor(req.color());

        if (esReservada(categoria)) {
            if (!RESERVADA.equals(nombre) || req.tipo() != TipoCategoria.AHORRO) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "La categoría 'ahorro' es reservada y no se puede renombrar ni cambiar de tipo");
            }
            categoria.setColor(req.color().toLowerCase(Locale.ROOT));
            return aRespuesta(repository.save(categoria));
        }

        validarNueva(nombre, req.tipo(), req.color());
        boolean cambiaNombre = !nombre.equals(categoria.getNombre());
        boolean cambiaTipo = req.tipo() != categoria.getTipo();

        if (cambiaNombre
                && repository.existsByUsuarioIdAndNombreIgnoreCase(usuarioId, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya tienes una categoría llamada '" + nombre + "'");
        }
        if (cambiaTipo) {
            if (transaccionRepository.existsByUsuarioIdAndCategoria(usuarioId, categoria.getNombre())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No puedes cambiar el tipo de una categoría con movimientos registrados");
            }
            if (presupuestoRepository.existsByUsuarioIdAndCategoria(usuarioId, categoria.getNombre())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No puedes cambiar el tipo de una categoría con presupuestos registrados");
            }
        }

        if (cambiaNombre) {
            transaccionRepository.renombrarCategoria(usuarioId, categoria.getNombre(), nombre);
            presupuestoRepository.renombrarCategoria(usuarioId, categoria.getNombre(), nombre);
        }
        categoria.setNombre(nombre);
        categoria.setTipo(req.tipo());
        categoria.setColor(req.color().toLowerCase(Locale.ROOT));
        return aRespuesta(repository.save(categoria));
    }

    @Transactional
    public boolean existe(UUID usuarioId, String nombre, TipoCategoria tipo) {
        String cat = normalizar(nombre);
        if (cat.isEmpty() || tipo == null) {
            return false;
        }
        asegurarCategorias(usuarioId);
        return repository.existsByUsuarioIdAndNombreIgnoreCaseAndTipo(usuarioId, cat, tipo);
    }

    /** Normaliza igual que el resto del código: minúsculas y sin espacios. */
    public static String normalizar(String nombre) {
        return nombre == null ? "" : nombre.trim().toLowerCase(Locale.ROOT);
    }

    private List<Categoria> asegurarCategorias(UUID usuarioId) {
        List<Categoria> propias = repository.findByUsuarioIdOrderByOrdenAsc(usuarioId);
        if (!propias.isEmpty()) {
            return propias;
        }
        List<Categoria> plantillas = repository.findByUsuarioIdIsNullOrderByOrdenAsc();
        if (plantillas.isEmpty()) {
            return List.of();
        }
        List<Categoria> nuevas = plantillas.stream()
                .map(p -> new Categoria(usuarioId, p.getNombre(), p.getTipo(),
                        p.getIcono(), p.getColor(), p.getOrden()))
                .toList();
        return repository.saveAll(nuevas).stream()
                .sorted(Comparator.comparing(Categoria::getOrden))
                .toList();
    }

    private void validarNueva(String nombre, TipoCategoria tipo, String color) {
        if (nombre.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre es obligatorio");
        }
        if (RESERVADA.equals(nombre)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La categoría 'ahorro' está reservada para los aportes a metas");
        }
        if (tipo == null || tipo == TipoCategoria.AHORRO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El tipo debe ser INGRESO o GASTO");
        }
        validarColor(color);
    }

    private void validarColor(String color) {
        if (color == null || !COLOR.matcher(color).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El color debe tener formato #rrggbb");
        }
    }

    private static boolean esReservada(Categoria categoria) {
        return categoria.getTipo() == TipoCategoria.AHORRO
                || RESERVADA.equals(categoria.getNombre());
    }

    public static CategoriaResponse aRespuesta(Categoria c) {
        return new CategoriaResponse(
                c.getId(),
                c.getNombre(),
                c.getTipo().name(),
                c.getIcono(),
                c.getColor(),
                c.getOrden(),
                esReservada(c));
    }
}
