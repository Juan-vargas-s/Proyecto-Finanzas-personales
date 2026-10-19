package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PresupuestoEstado struct {
	Categoria      string  `json:"categoria"`
	LimiteMensual  float64 `json:"limiteMensual"`
	GastoAcumulado float64 `json:"gastoAcumulado"`
	Restante       float64 `json:"restante"`
	PorcentajeUsado float64 `json:"porcentajeUsado"`
}

func verificarPresupuestos(c *gin.Context, store *RedisStore) {
	usuarioID := c.Param("usuarioID")
	if usuarioID == "" && c.Request.Method == http.MethodPost {
		// puede venir en body
	}
	if usuarioID == "" {
		// leer query
		usuarioID, _ = uidOPcional(c)
	}
	mes := c.Query("mes")
	if mes == "" {
		hoy := time.Now()
		mes = fmt.Sprintf("%04d-%02d", hoy.Year(), hoy.Month())
	}

	javasrv := os.Getenv("JAVA_SERVICE_URL")
	if javasrv == "" {
		javasrv = "http://servicio-java:8080"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// 1) obtener presupuestos del usuario para ese mes

	// Java no expone listar estados de todos los presupuestos â€” obtenemos por categorÃ­a?
	// Alternativa: listar presupuestos del usuario en Java
	urlPres := fmt.Sprintf("%s/api/transacciones/presupuestos?usuarioId=%s&mes=%s", javasrv, usuarioID, mes)
	req, _ := http.NewRequestWithContext(ctx, "GET", urlPres, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "No se pudo contactar a servicio Java (presupuestos)"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Servicio Java devolviÃ³ error al listar presupuestos"})
		return
	}
	var presupuestos []struct {
		Categoria     string  `json:"categoria"`
		LimiteMensual float64 `json:"limiteMensual"`
		Mes           string  `json:"mes"`
	}
	if json.NewDecoder(resp.Body).Decode(&presupuestos) != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Respuesta invÃ¡lida de servicio Java"})
		return
	}

	creadas := 0
	for _, p := range presupuestos {
		urlE := fmt.Sprintf("%s/api/transacciones/presupuestos/%s?usuarioId=%s&mes=%s", javasrv, p.Categoria, usuarioID, mes)
		req2, _ := http.NewRequestWithContext(ctx, "GET", urlE, nil)
		resp2, err2 := http.DefaultClient.Do(req2)
		if err2 != nil {
			continue
		}
		if resp2.StatusCode != http.StatusOK {
			resp2.Body.Close()
			continue
		}
		var est PresupuestoEstado
		if json.NewDecoder(resp2.Body).Decode(&est) == nil && est.LimiteMensual > 0 {
			porc := est.GastoAcumulado / est.LimiteMensual * 100
			if porc >= 80 {
				// evitar duplicado por (usuario,categoria,mes,tipo)
				n := Notificacion{
					ID:       uuid.NewString(),
					Mensaje:  fmt.Sprintf("Llegaste al %.1f%% de tu presupuesto de %s", porc, est.Categoria),
					Tipo:     "PRESUPUESTO",
					Leida:    false,
					CreadaEn: time.Now().UTC().Format(time.RFC3339),
				}
				_ = store.CrearNotificacion(ctx, usuarioID, n)
				creadas++
			}
		}
		resp2.Body.Close()
	}

	c.JSON(http.StatusOK, gin.H{"usuarioId": usuarioID, "mes": mes, "alertasGeneradas": creadas})
}
