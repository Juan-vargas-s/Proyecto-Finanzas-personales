package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

// clienteJava es el cliente HTTP compartido para hablar con el servicio de
// transacciones. Antes se usaba http.DefaultClient, que no tiene timeout:
// si Java no respondía, la petición se quedaba colgada indefinidamente.
var clienteJava = &http.Client{Timeout: 5 * time.Second}

// urlJava devuelve la base del servicio de transacciones.
func urlJava() string {
	base := os.Getenv("JAVA_SERVICE_URL")
	if base == "" {
		base = "http://servicio-java:8080"
	}
	return base
}

// getJSON hace un GET y decodifica la respuesta JSON en destino.
// Viaja con un JWT de servicio para que Java acepte ?usuarioId=... sin
// permitir que un cliente externo consulte a otro usuario (IDOR).
// Devuelve un error si Java no responde o si la respuesta no es JSON válido.
func getJSON(ctx context.Context, url, usuarioID string, destino any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("no se pudo construir la petición: %w", err)
	}
	token, err := tokenServicio(usuarioID)
	if err != nil {
		return fmt.Errorf("no se pudo firmar el token de servicio: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Request-Id", uuid.NewString())

	resp, err := clienteJava.Do(req)
	if err != nil {
		return fmt.Errorf("no se pudo contactar a servicio Java: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("servicio Java devolvió %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(destino); err != nil {
		return fmt.Errorf("respuesta inválida de servicio Java: %w", err)
	}
	return nil
}
