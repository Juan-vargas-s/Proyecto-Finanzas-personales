package com.finanzas.transacciones.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Añade un X-Request-Id a cada petición (reutiliza el que venga de Python,
 * Go o el frontend) y lo pone en el MDC para que aparezca en los logs.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String CABECERA = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String id = request.getHeader(CABECERA);
        if (id == null || id.isBlank() || id.length() > 100) {
            id = UUID.randomUUID().toString();
        }
        MDC.put("requestId", id);
        response.setHeader(CABECERA, id);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
        }
    }
}
