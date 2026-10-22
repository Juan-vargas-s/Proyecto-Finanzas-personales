package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func registrarRutas(r *gin.Engine, store *RedisStore, eventos *PublicadorEventos, hub *HubSSE) {
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
				Categoria:     req.Categoria,
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

		// Editar una meta (nombre, objetivo, fecha). Antes era imposible.
		api.PUT("/:id", authRequerido(), func(c *gin.Context) {
			var req ActualizarMetaRequest
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
			if req.Nombre != nil {
				if !nombreValido(*req.Nombre) {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre inválido"})
					return
				}
				m.Nombre = strings.TrimSpace(*req.Nombre)
			}
			if req.MontoObjetivo != nil {
				if *req.MontoObjetivo <= 0 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "El monto objetivo debe ser mayor a 0"})
					return
				}
				m.MontoObjetivo = *req.MontoObjetivo
			}
			if req.FechaLimite != nil {
				if !fechaValida(*req.FechaLimite) {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Fecha límite inválida (usa YYYY-MM-DD)"})
					return
				}
				m.FechaLimite = *req.FechaLimite
			}
			if req.Categoria != nil {
				m.Categoria = *req.Categoria
			}
			if err := store.GuardarMetaDatos(c.Request.Context(), usuarioID, *m); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar meta"})
				return
			}
			c.JSON(http.StatusOK, aMetaResponse(*m))
		})

		// Aportar a una meta. El saldo se actualiza con un único HINCRBYFLOAT
		// (atómico) y el movimiento se publica como evento para que Java lo
		// materialice como transacción AHORRO.
		api.PUT("/:id/aportar", authRequerido(), func(c *gin.Context) {
			var req AportarRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
				return
			}
			id := c.Param("id")
			uid, _ := c.Get("usuarioId")
			usuarioID := uid.(string)
			ctx := c.Request.Context()
			m, err := store.ObtenerMeta(ctx, usuarioID, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener meta"})
				return
			}
			if m == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Meta no encontrada"})
				return
			}
			aporteID := uuid.NewString()
			saldo, err := store.SumarAporte(ctx, usuarioID, id, req.Monto)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al registrar el aporte"})
				return
			}
			m.MontoActual = saldo
			store.RegistrarAporte(ctx, usuarioID, id, Aporte{
				ID:       aporteID,
				Monto:    req.Monto,
				Tipo:     "APORTE",
				CreadaEn: time.Now().UTC().Format(time.RFC3339),
			})
			if err := eventos.PublicarAporte(ctx, "meta.aporte.registrado", aporteID, usuarioID, id, m.Nombre, req.Monto); err != nil {
				// El saldo ya está aplicado en Redis: se avisa del fallo del
				// bus, pero no se revierte el aporte del usuario.
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Aporte registrado, pero no se pudo publicar el evento"})
				return
			}
			if m.MontoObjetivo > 0 && saldo >= m.MontoObjetivo && !store.YaNotificadaMeta(ctx, usuarioID, id) {
				n := Notificacion{
					ID:       uuid.NewString(),
					Mensaje:  fmt.Sprintf("¡Meta cumplida! %s", m.Nombre),
					Tipo:     "META",
					Leida:    false,
					CreadaEn: time.Now().UTC().Format(time.RFC3339),
				}
				if err := store.CrearNotificacion(ctx, usuarioID, n); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear la notificación"})
					return
				}
				store.MarcarMetaNotificada(ctx, usuarioID, id)
			}
			c.JSON(http.StatusOK, aMetaResponse(*m))
		})

		// Retirar dinero de una meta (deshacer un aporte).
		api.POST("/:id/retirar", authRequerido(), func(c *gin.Context) {
			var req RetirarRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
				return
			}
			id := c.Param("id")
			uid, _ := c.Get("usuarioId")
			usuarioID := uid.(string)
			ctx := c.Request.Context()
			m, err := store.ObtenerMeta(ctx, usuarioID, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener meta"})
				return
			}
			if m == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Meta no encontrada"})
				return
			}
			if req.Monto > m.MontoActual {
				c.JSON(http.StatusBadRequest, gin.H{"error": "El retiro es mayor que lo ahorrado en la meta"})
				return
			}
			aporteID := uuid.NewString()
			saldo, err := store.SumarAporte(ctx, usuarioID, id, -req.Monto)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al registrar el retiro"})
				return
			}
			m.MontoActual = saldo
			store.RegistrarAporte(ctx, usuarioID, id, Aporte{
				ID:       aporteID,
				Monto:    -req.Monto,
				Tipo:     "RETIRO",
				CreadaEn: time.Now().UTC().Format(time.RFC3339),
			})
			if err := eventos.PublicarAporte(ctx, "meta.aporte.retirado", aporteID, usuarioID, id, m.Nombre, req.Monto); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Retiro registrado, pero no se pudo publicar el evento"})
				return
			}
			c.JSON(http.StatusOK, aMetaResponse(*m))
		})

		// Historial de aportes y retiros de una meta.
		api.GET("/:id/aportes", func(c *gin.Context) {
			id := c.Param("id")
			uid, ok := uidOPcional(c)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente (o envía usuarioId en query)"})
				return
			}
			aportes, err := store.ListarAportes(c.Request.Context(), uid, id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al listar aportes"})
				return
			}
			c.JSON(http.StatusOK, aportes)
		})

		// Resumen de ahorro: totales, metas completadas y ritmo.
		api.GET("/resumen", func(c *gin.Context) {
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
			c.JSON(http.StatusOK, calcularResumenMetas(metas))
		})

		api.DELETE("/:id", authRequerido(), func(c *gin.Context) {
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
			verificarPresupuestosHandler(c, store, hub, eventos, uid)
		})

		// Flujo de alertas en vivo (Server-Sent Events). El token llega en la
		// query porque EventSource no permite mandar cabeceras.
		api.GET("/stream", func(c *gin.Context) {
			token := c.Query("token")
			if token == "" {
				header := c.GetHeader("Authorization")
				if strings.HasPrefix(header, "Bearer ") {
					token = strings.TrimPrefix(header, "Bearer ")
				}
			}
			usuarioID, ok := uidDeToken(token)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Token JWT inválido o ausente"})
				return
			}
			canal, cerrar := hub.Suscribir(usuarioID)
			defer cerrar()

			c.Writer.Header().Set("Content-Type", "text/event-stream")
			c.Writer.Header().Set("Cache-Control", "no-cache")
			c.Writer.Header().Set("Connection", "keep-alive")
			// Evita que nginx acumule la respuesta en su búfer.
			c.Writer.Header().Set("X-Accel-Buffering", "no")
			c.Writer.WriteHeader(http.StatusOK)
			c.Writer.Flush()

			// Saludo inicial: el navegador confirma que la conexión está viva.
			fmt.Fprintf(c.Writer, "event: conectado\ndata: {\"usuarioId\":\"%s\"}\n\n", usuarioID)
			c.Writer.Flush()

			latido := time.NewTicker(25 * time.Second)
			defer latido.Stop()

			for {
				select {
				case <-c.Request.Context().Done():
					return
				case n, ok := <-canal:
					if !ok {
						return
					}
					payload, err := json.Marshal(n)
					if err != nil {
						continue
					}
					fmt.Fprintf(c.Writer, "event: notificacion\ndata: %s\n\n", payload)
					c.Writer.Flush()
				case <-latido.C:
					// Comentario SSE: mantiene viva la conexión.
					fmt.Fprint(c.Writer, ": latido\n\n")
					c.Writer.Flush()
				}
			}
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

func verificarPresupuestosHandler(c *gin.Context, store *RedisStore, hub *HubSSE,
	eventos *PublicadorEventos, usuarioID string) {
	mes := c.Query("mes")
	if mes == "" {
		mes = time.Now().Format("2006-01")
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Una sola llamada trae el estado (gasto acumulado) de TODOS los presupuestos
	// del mes: se elimina el N+1 de preguntar categoría por categoría.
	creadas, err := evaluarPresupuestosYAlertar(ctx, store, hub, eventos, usuarioID, mes)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"usuarioId": usuarioID,
			"mes":       mes,
			"error":     "no se pudo consultar el estado de los presupuestos",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"usuarioId": usuarioID, "mes": mes, "alertasGeneradas": creadas})
}

// calcularResumenMetas deriva los KPIs de ahorro a partir de las metas del
// usuario: total ahorrado, objetivo total, metas completadas, metas en riesgo
// (las que no van al ritmo necesario para llegar a su fecha) y el ritmo medio
// mensual de ahorro.
func calcularResumenMetas(metas []Meta) MetaResumen {
	r := MetaResumen{}
	ahora := time.Now().UTC()
	var sumaCreacion time.Time
	for _, m := range metas {
		r.TotalAhorrado += m.MontoActual
		r.ObjetivoTotal += m.MontoObjetivo
		if m.MontoObjetivo > 0 && m.MontoActual >= m.MontoObjetivo {
			r.Completadas++
		}
		if metaEnRiesgo(m, ahora) {
			r.EnRiesgo++
		}
		if t, err := time.Parse(time.RFC3339, m.CreadaEn); err == nil {
			if sumaCreacion.IsZero() || t.Before(sumaCreacion) {
				sumaCreacion = t
			}
		}
	}
	r.Metas = len(metas)
	if r.TotalAhorrado > 0 && !sumaCreacion.IsZero() {
		meses := ahora.Sub(sumaCreacion).Hours() / 24 / 30.44
		if meses > 0 {
			r.RitmoPromedio = r.TotalAhorrado / meses
		}
	}
	return r
}

// metaEnRiesgo indica que la meta no va al ritmo necesario: hay que aportar
// más por mes de los que se ha ahorrado hasta ahora.
func metaEnRiesgo(m Meta, ahora time.Time) bool {
	if m.MontoObjetivo <= 0 || m.FechaLimite == "" {
		return false
	}
	fin, err := time.Parse("2006-01-02", m.FechaLimite)
	if err != nil {
		return false
	}
	diasRestantes := fin.Sub(ahora).Hours() / 24
	if diasRestantes <= 0 {
		return false
	}
	faltante := m.MontoObjetivo - m.MontoActual
	if faltante <= 0 {
		return false
	}
	// Ritmo necesario (por mes) frente al ritmo real (por mes).
	ritmoNecesario := faltante / (diasRestantes / 30.44)
	mesesTranscurridos := 0.0
	if creada, err := time.Parse(time.RFC3339, m.CreadaEn); err == nil {
		mesesTranscurridos = ahora.Sub(creada).Hours() / 24 / 30.44
	}
	if mesesTranscurridos <= 0 {
		return false
	}
	ritmoReal := m.MontoActual / mesesTranscurridos
	return ritmoNecesario > ritmoReal
}
