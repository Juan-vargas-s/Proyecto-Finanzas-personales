package com.finanzas.transacciones.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resuelve a qué usuario pertenece una petición y bloquea el IDOR.
 *
 * - Sin ?usuarioId=...: se usa el usuarioId del JWT (401 si no hay).
 * - Con ?usuarioId=...: debe coincidir con el JWT (403 si es de otro usuario).
 *   Los servicios internos mandan un JWT de servicio que también lleva el
 *   usuarioId que van a consultar, así que la comprobación es la misma.
 * - Las escrituras (POST/PUT/DELETE) no aceptan tokens de servicio: solo el
 *   usuario dueño de la sesión puede crear, editar o borrar.
 */
@Component
public class UsuarioResolver {

    public UUID resolver(HttpServletRequest request, UUID usuarioIdSolicitado) {
        UUID usuarioId = usuarioDeSesion(request);
        if (usuarioIdSolicitado != null) {
            if (!usuarioIdSolicitado.equals(usuarioId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No puedes consultar datos de otro usuario");
            }
            return usuarioIdSolicitado;
        }
        return usuarioId;
    }

    public UUID requerido(HttpServletRequest request) {
        if (esServicio(request)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El token de servicio no puede modificar datos");
        }
        return usuarioDeSesion(request);
    }

    private UUID usuarioDeSesion(HttpServletRequest request) {
        Object attr = request.getAttribute("usuarioId");
        if (attr == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Token JWT inválido o ausente");
        }
        return (UUID) attr;
    }

    private boolean esServicio(HttpServletRequest request) {
        return Boolean.TRUE.equals(request.getAttribute("tokenServicio"));
    }
}
