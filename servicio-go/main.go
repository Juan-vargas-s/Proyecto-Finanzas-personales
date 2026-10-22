package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func main() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		panic("REDIS_URL inválida: " + err.Error())
	}
	rdb := redis.NewClient(opts)
	store := NewRedisStore(rdb)
	eventos := NewPublicadorEventos(rdb)
	hub := NuevoHubSSE()

	// El consumidor automático reevalúa los presupuestos cuando Java publica
	// un movimiento o un cambio de presupuesto, y empuja la alerta al
	// navegador por SSE (sin que el usuario pulse "Verificar presupuestos").
	//
	// Usa un cliente Redis DEDICADO: XReadGroup bloquea el socket durante
	// segundos y, si compartiera el pool con el path HTTP, lo agotaría.
	rdbConsumo := redis.NewClient(opts)
	consumidor := NewConsumidorEventos(rdbConsumo, store, eventos, hub)
	consumidor.Iniciar(context.Background())

	// El grupo de consumidores de Java se crea desde el productor: así el
	// consumidor puede arrancar en cualquier momento y leer los eventos
	// pendientes desde el principio del stream.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := eventos.AsegurarGrupo(ctx, nombreGrupoConsumidorJava()); err != nil {
		log.Printf("aviso: no se pudo crear el grupo de consumidores: %v", err)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Use(requestID())

	// CORS: el frontend (Next.js) llama a este servicio vía el API Gateway
	// desde otro origen (puerto 3000), por lo que hay que responder los
	// preflights OPTIONS y enviar las cabeceras de acceso.
	r.Use(func(c *gin.Context) {
		origen := c.GetHeader("Origin")
		if origen == "" {
			origen = "*"
		}
		c.Header("Access-Control-Allow-Origin", origen)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
		c.Header("Access-Control-Expose-Headers", "X-Request-Id")
		c.Header("Access-Control-Max-Age", "600")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		if err := rdb.Ping(ctx).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":   "error",
				"service":  "metas",
				"database": "disconnected",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"service":  "metas",
			"database": "connected",
		})
	})

	registrarRutas(r, store, eventos, hub)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}
	if err := r.Run(":" + port); err != nil {
		panic(err)
	}
}
