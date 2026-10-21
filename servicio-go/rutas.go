package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func registrarRutas(r *gin.Engine, store *RedisStore) {
	api := r.Group("/api/metas")
	{
		api.POST("", authRequerido(), func(c *gin.Context) {
			var req CrearMetaRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
				return
			}
			if !nombreValido(req.Nombre) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre inválido"})
				return
			}
			uid, _ := c.Get("usuarioId")
			usuarioID := uid.(string)
			m := Meta{
				ID:            uuid.NewString(),
				Nombre:        req.Nombre,
				MontoObjetivo: req.MontoObjetivo,
				MontoActual:   0,
				FechaLimite:   req.FechaLimite,
				CreadaEn:      time.Now().UTC().Format(time.RFC3339),
			}
			if err := store.CrearMeta(c.Request.Context(), usuarioID, m); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo guardar la meta"})
				return
			}
			c.JSON(http.StatusCreated, aMetaResponse(m))
		})

		api.GET("", func(c *gin.Context) {
			uid, ok := uidOPcional(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente (o envía usuarioId en query)"})
				return
			}
			metas, err := store.ListarMetas(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al listar metas"})
				return
			}
			resp := make([]MetaResponse, 0, len(metas))
			for _, m := range metas {
				resp = append(resp, aMetaResponse(m))
			}
			c.JSON(http.StatusOK, resp)
		})

		api.PUT("/:id/aportar", authRequerido(), func(c *gin.Context) {
			var req AportarRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
				return
			}
			id := c.Param("id")
			uid, _ := c.Get("usuarioId")
			usuarioID := uid.(string)
			m, err := store.ObtenerMeta(c.Request.Context(), usuarioID, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener meta"})
				return
			}
			if m == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Meta no encontrada"})
				return
			}
			m.MontoActual += req.Monto
			if err := store.GuardarMeta(c.Request.Context(), usuarioID, *m); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar meta"})
				return
			}
			if m.MontoObjetivo > 0 && m.MontoActual >= m.MontoObjetivo {
				n := Notificacion{
					ID:       uuid.NewString(),
					Mensaje:  fmt.Sprintf("¡Meta cumplida! %s", m.Nombre),
					Tipo:     "META",
					Leida:    false,
					CreadaEn: time.Now().UTC().Format(time.RFC3339),
				}
				_ = store.CrearNotificacion(c.Request.Context(), usuarioID, n)
			}
			c.JSON(http.StatusOK, aMetaResponse(*m))
		})

		api.DELETE("/:id", authRequerido(), func(c *gin.Context) {
			id := c.Param("id")
			uid, _ := c.Get("usuarioId")
			usuarioID := uid.(string)
			if err := store.EliminarMeta(c.Request.Context(), usuarioID, id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar meta"})
				return
			}
			c.Status(http.StatusNoContent)
		})

		api.POST("/verificar", func(c *gin.Context) {
			uid, ok := uidOPcional(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente (o envía usuarioId en query)"})
				return
			}
			// Inyectar UID si viene por body vacío
			var body map[string]string
			if c.Request.ContentLength > 0 {
				c.ShouldBind(&body)
			}
			_ = body
			c.Set("usuarioId", uid)
			// Reutilizar lógica: pasar por handler
			verificarPresupuestosHandler(c, store, uid)
		})

		api.GET("/notificaciones/:usuarioId", func(c *gin.Context) {
			usuarioID := c.Param("usuarioId")
			if usuarioID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "usuarioId requerido"})
				return
			}
			list, err := store.ListarNotificaciones(c.Request.Context(), usuarioID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al listar notificaciones"})
				return
			}
			c.JSON(http.StatusOK, list)
		})

		api.PUT("/notificaciones/:id/leer", func(c *gin.Context) {
			id := c.Param("id")
			usuarioID := c.Query("usuarioId")
			if usuarioID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "usuarioId requerido en query"})
				return
			}
			n, err := store.MarcarLeida(c.Request.Context(), usuarioID, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al marcar como leída"})
				return
			}
			if n == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Notificación no encontrada"})
				return
			}
			c.JSON(http.StatusOK, n)
		})
	}
}

func verificarPresupuestosHandler(c *gin.Context, store *RedisStore, usuarioID string) {
	mes := c.Query("mes")
	if mes == "" {
		mes = time.Now().Format("2006-01")
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Una sola llamada trae el estado (gasto acumulado) de TODOS los presupuestos
	// del mes: se elimina el N+1 de preguntar categoría por categoría.
	urlEstado := fmt.Sprintf("%s/api/transacciones/presupuestos/estado?usuarioId=%s&mes=%s", urlJava(), usuarioID, mes)
	var estados []PresupuestoEstado
	if err := getJSON(ctx, urlEstado, &estados); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	creadas := 0
	for _, est := range estados {
		if est.LimiteMensual <= 0 || est.PorcentajeUsado < 80 {
			continue
		}
		if store.YaAlertado(ctx, usuarioID, mes, est.Categoria) {
			continue
		}
		n := Notificacion{
			ID:       uuid.NewString(),
			Mensaje:  fmt.Sprintf("Llegaste al %.1f%% de tu presupuesto de %s", est.PorcentajeUsado, est.Categoria),
			Tipo:     "PRESUPUESTO",
			Leida:    false,
			CreadaEn: time.Now().UTC().Format(time.RFC3339),
		}
		if err := store.CrearNotificacion(ctx, usuarioID, n); err == nil {
			store.MarcarAlertado(ctx, usuarioID, mes, est.Categoria)
			creadas++
		}
	}
	c.JSON(http.StatusOK, gin.H{"usuarioId": usuarioID, "mes": mes, "alertasGeneradas": creadas})
}
