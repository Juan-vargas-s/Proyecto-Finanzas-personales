package com.finanzas.transacciones.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Valida el JWT (header Authorization: Bearer ...) y guarda en la petición el
 * usuarioId y si el token es de servicio ("svc": true).
 *
 * Si llega un token inválido se responde 401 de inmediato: antes se ignoraba
 * y un GET con ?usuarioId=... podía leer datos ajenos (IDOR). Si no llega
 * token, la petición sigue y cada endpoint decide si lo exige.
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
        if (header != null) {
            if (!header.startsWith("Bearer ") || header.length() <= 7) {
                noAutorizado(response, "Formato de Authorization inválido");
                return;
            }
            try {
                JwtService.TokenJwt token = jwtService.extraer(header.substring(7));
                request.setAttribute("usuarioId", token.usuarioId());
                request.setAttribute("tokenServicio", token.servicio());
            } catch (Exception ex) {
                noAutorizado(response, "Token JWT inválido o expirado");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private void noAutorizado(HttpServletResponse response, String mensaje) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + mensaje + "\"}");
    }
}
