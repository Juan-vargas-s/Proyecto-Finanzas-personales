package main

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func claimsDeAutorizacion(c *gin.Context) (jwt.MapClaims, error) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, errors.New("encabezado Authorization ausente")
	}
	tokenStr := strings.TrimPrefix(header, "Bearer ")
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

func authRequerido() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := claimsDeAutorizacion(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente"})
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

func uidOPcional(c *gin.Context) (string, bool) {
	if uid := c.Query("usuarioId"); uid != "" {
		return uid, true
	}
	if claims, err := claimsDeAutorizacion(c); err == nil {
		if uid, ok := claims["usuarioId"].(string); ok && uid != "" {
			return uid, true
		}
	}
	return "", false
}
