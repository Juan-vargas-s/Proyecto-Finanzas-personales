package com.finanzas.transacciones.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    private final SecretKey key;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Datos útiles del JWT: el usuario y si el token es de servicio. */
    public record TokenJwt(UUID usuarioId, boolean servicio) {}

    /**
     * Verifica la firma del JWT y extrae sus datos.
     * Node firma con el claim personalizado "usuarioId" (no "sub").
     * Los servicios internos (Python/Go) añaden "svc": true para poder
     * consultar a Java con ?usuarioId=... sin hacerse pasar por un usuario.
     * Lanza una excepción si el token es inválido o está expirado.
     */
    public TokenJwt extraer(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        UUID usuarioId = UUID.fromString(claims.get("usuarioId", String.class));
        Object svc = claims.get("svc");
        boolean servicio = Boolean.TRUE.equals(svc) || "true".equals(String.valueOf(svc));
        return new TokenJwt(usuarioId, servicio);
    }

    public UUID extraerUsuarioId(String token) {
        return extraer(token).usuarioId();
    }
}
