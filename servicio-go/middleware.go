package main

import (
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// esTokenServicio indica si el JWT se emitió para una llamada entre
// microservicios. Esos tokens sirven para hablar con Java, nunca para
// autenticar a un usuario en las rutas públicas de este servicio.
func esTokenServicio(claims jwt.MapClaims) bool {
	svc, _ := claims["svc"].(bool)
	return svc
}

func claimsDeAutorizacion(c *gin.Context) (jwt.MapClaims, error) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, errors.New("encabezado Authorization ausente")
	}
	return claimsDeToken(strings.TrimPrefix(header, "Bearer "))
}

// claimsDeToken valida un token JWT suelto. Lo usa el endpoint SSE, donde
// el token llega en la query porque EventSource no puede mandar cabeceras.
func claimsDeToken(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			return nil, errors.New("JWT_SECRET no configurado")
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}

// uidDeToken devuelve el usuarioId de un token de usuario (no de servicio).
func uidDeToken(tokenStr string) (string, bool) {
	claims, err := claimsDeToken(tokenStr)
	if err != nil || esTokenServicio(claims) {
		return "", false
	}
	usuarioID, ok := claims["usuarioId"].(string)
	if !ok || usuarioID == "" {
		return "", false
	}
	return usuarioID, true
}

func authRequerido() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := claimsDeAutorizacion(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente"})
			return
		}
		if esTokenServicio(claims) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Un token de servicio no puede acceder a datos de usuario"})
			return
		}
		usuarioID, ok := claims["usuarioId"].(string)
		if !ok || usuarioID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token sin usuarioId"})
			return
		}
		c.Set("usuarioId", usuarioID)
		c.Next()
	}
}

// tokenServicio firma un JWT de corta duración para llamar a Java con
// ?usuarioId=... Java comprueba el claim "svc" y que el usuarioId coincida.
func tokenServicio(usuarioID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET no configurado")
	}
	ahora := time.Now()
	claims := jwt.MapClaims{
		"usuarioId": usuarioID,
		"svc":       true,
		"iat":       ahora.Unix(),
		"exp":       ahora.Add(60 * time.Second).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// requestID reutiliza el X-Request-Id entrante o genera uno nuevo y lo
// devuelve en la respuesta para poder seguir una petición entre servicios.
func requestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-Id")
		if id == "" || len(id) > 100 {
			id = uuid.NewString()
		}
		c.Set("requestId", id)
		c.Header("X-Request-Id", id)
		c.Next()
	}
}
