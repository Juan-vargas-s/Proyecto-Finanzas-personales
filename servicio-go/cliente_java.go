package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
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
// Devuelve un error si Java no responde o si la respuesta no es JSON válido.
func getJSON(ctx context.Context, url string, destino any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("no se pudo construir la petición: %w", err)
	}
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
