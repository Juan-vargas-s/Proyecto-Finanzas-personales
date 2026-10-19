package com.finanzas.transacciones.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Extrae el usuarioId del JWT (header Authorization: Bearer ...) y lo guarda
 * como atributo de la petición. No bloquea: los controladores deciden si es
 * obligatorio (POST/PUT/DELETE) o no (GET con usuarioId en query, usado por
 * los servicios de Python y Go).
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                UUID usuarioId = jwtService.extraerUsuarioId(header.substring(7));
                request.setAttribute("usuarioId", usuarioId);
            } catch (Exception ignored) {
                // Token inválido: no se atribuye usuarioId; los endpoints
                // protegidos responderán 401 si no encuentran el atributo.
            }
        }
        filterChain.doFilter(request, response);
    }
}
