package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// maxAntiguedadEvento es la ventana de recuperación del consumidor: los
// eventos más viejos se descartan (se confirman sin procesar) para no
// recorrer el historial completo del stream en cada arranque.
const maxAntiguedadEvento = 2 * time.Hour

// minIdleColgados es el tiempo que un evento puede quedar pendiente (PEL)
// antes de que el consumidor lo reclame con XAUTOCLAIM.
const minIdleColgados = 60 * time.Second

// vueltasReaper es cada cuántas lecturas del stream se intenta recuperar
// los eventos que quedaron pendientes (cada vuelta dura ~5 s).
const vueltasReaper = 12

// ConsumidorEventos escucha el stream de Redis y reevalúa los presupuestos
// del usuario cada vez que Java informa de un movimiento o de un cambio en
// un presupuesto. Así la alerta aparece sola, sin que el usuario tenga que
// pulsar "Verificar presupuestos".
type ConsumidorEventos struct {
	rdb        *redis.Client
	store      *RedisStore
	eventos    *PublicadorEventos
	hub        *HubSSE
	stream     string
	grupo      string
	consumidor string
}

func NewConsumidorEventos(rdb *redis.Client, store *RedisStore, eventos *PublicadorEventos, hub *HubSSE) *ConsumidorEventos {
	grupo := os.Getenv("EVENTOS_GROUP_GO")
	if grupo == "" {
		grupo = "go"
	}
	consumidor := os.Getenv("EVENTOS_CONSUMER_GO")
	if consumidor == "" {
		consumidor = "go-1"
	}
	return &ConsumidorEventos{
		rdb:        rdb,
		store:      store,
		eventos:    eventos,
		hub:        hub,
		stream:     nombreStreamEventos(),
		grupo:      grupo,
		consumidor: consumidor,
	}
}

// Iniciar arranca el consumo en segundo plano.
func (c *ConsumidorEventos) Iniciar(ctx context.Context) {
	go c.bucle(ctx)
}

func (c *ConsumidorEventos) bucle(ctx context.Context) {
	if err := c.rdb.XGroupCreateMkStream(ctx, c.stream, c.grupo, "0").Err(); err != nil && !esGrupoExistente(err) {
		log.Printf("aviso: no se pudo crear el grupo de consumidores %s: %v", c.grupo, err)
	}
	log.Printf("consumidor de eventos activo: grupo %s sobre %s", c.grupo, c.stream)

	vueltas := 0
	for {
		if ctx.Err() != nil {
			return
		}
		vueltas++
		if vueltas%vueltasReaper == 0 {
			c.recuperarColgados(ctx)
		}
		streams, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    c.grupo,
			Consumer: c.consumidor,
			Streams:  []string{c.stream, ">"},
			Count:    20,
			Block:    5 * time.Second,
		}).Result()
		if err != nil {
			if err == redis.Nil || ctx.Err() != nil {
				continue
			}
			log.Printf("consumidor: error leyendo el stream: %v", err)
			time.Sleep(time.Second)
			continue
		}
		for _, s := range streams {
			for _, msg := range s.Messages {
				c.procesar(ctx, msg)
			}
		}
	}
}

// procesar atiende un evento del stream. Los eventos que no son de
// finanzas (por ejemplo "meta.aporte.registrado") se confirman y se ignoran.
func (c *ConsumidorEventos) procesar(ctx context.Context, msg redis.XMessage) {
	tipo := valorCampo(msg, "tipo")
	switch tipo {
	case "transaccion.registrada", "transaccion.actualizada", "transaccion.eliminada",
		"presupuesto.actualizado":
	default:
		c.confirmar(ctx, msg)
		return
	}

	usuarioID := valorCampo(msg, "usuarioId")
	if usuarioID == "" {
		c.confirmar(ctx, msg)
		return
	}
	mes := c.mesDelEvento(msg)
	if mes == "" || c.esAntiguo(msg.ID) {
		c.confirmar(ctx, msg)
		return
	}

	creadas, err := c.evaluarPresupuestos(ctx, usuarioID, mes)
	if err != nil {
		// Sin XACK: el evento se queda en la PEL y el reaper (XAUTOCLAIM)
		// lo reprocesará cuando el servicio de finanzas vuelva a responder.
		log.Printf("consumidor: no se pudo reevaluar los presupuestos de %s (%s): %v",
			usuarioID, mes, err)
		return
	}
	if creadas > 0 {
		log.Printf("consumidor: %d alerta(s) de presupuesto para %s (%s)", creadas, usuarioID, mes)
	}
	c.confirmar(ctx, msg)
}

// recuperarColgados rescata los eventos que quedaron pendientes: si el
// consumidor se cae a mitad del procesamiento, el mensaje no se pierde.
func (c *ConsumidorEventos) recuperarColgados(ctx context.Context) {
	mensajes, _, err := c.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   c.stream,
		Group:    c.grupo,
		Consumer: c.consumidor,
		MinIdle:  minIdleColgados,
		Start:    "0-0",
		Count:    10,
	}).Result()
	if err != nil {
		if err != redis.Nil {
			log.Printf("consumidor: no se pudieron recuperar los eventos pendientes: %v", err)
		}
		return
	}
	for _, msg := range mensajes {
		c.procesar(ctx, msg)
	}
}
// valorCampo lee un campo del mensaje del stream como texto.
func valorCampo(msg redis.XMessage, clave string) string {
	v, ok := msg.Values[clave]
	if !ok || v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

// mesDelEvento deduce el mes al que pertenece el evento: el mes del
// presupuesto o el mes de la fecha de la transacción.
func (c *ConsumidorEventos) mesDelEvento(msg redis.XMessage) string {
	if mes := valorCampo(msg, "mes"); esMesValido(mes) {
		return mes
	}
	if fecha := valorCampo(msg, "fecha"); len(fecha) >= 7 {
		mes := fecha[:7]
		if esMesValido(mes) {
			return mes
		}
	}
	return time.Now().Format("2006-01")
}

// esAntiguo indica si la entrada del stream es más vieja que la ventana de
// recuperación (evita reprocesar el historial completo al arrancar).
func (c *ConsumidorEventos) esAntiguo(id string) bool {
	parte := strings.SplitN(id, "-", 2)
	if len(parte) == 0 {
		return false
	}
	ms, err := strconv.ParseInt(parte[0], 10, 64)
	if err != nil {
		return false
	}
	return time.Since(time.UnixMilli(ms)) > maxAntiguedadEvento
}

// evaluarPresupuestos consulta a Java el estado de los presupuestos del mes
// y genera las alertas que falten (>= 80% y, aparte, al exceder el límite).
func (c *ConsumidorEventos) evaluarPresupuestos(ctx context.Context, usuarioID, mes string) (int, error) {
	return evaluarPresupuestosYAlertar(ctx, c.store, c.hub, c.eventos, usuarioID, mes)
}

// evaluarPresupuestosYAlertar es la lógica compartida entre el consumidor
// automático y el endpoint manual de verificación.
func evaluarPresupuestosYAlertar(ctx context.Context, store *RedisStore, hub *HubSSE,
	eventos *PublicadorEventos, usuarioID, mes string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	url := fmt.Sprintf("%s/api/transacciones/presupuestos/estado?usuarioId=%s&mes=%s",
		urlJava(), usuarioID, mes)
	var estados []PresupuestoEstado
	if err := getJSON(ctx, url, usuarioID, &estados); err != nil {
		log.Printf("consumidor: no se pudo consultar el estado de presupuestos: %v", err)
		return 0, err
	}

	creadas := 0
	for _, est := range estados {
		if est.LimiteMensual <= 0 || est.PorcentajeUsado < 80 {
			continue
		}
		clave := claveAlerta(est)
		if store.YaAlertado(ctx, usuarioID, mes, clave) {
			continue
		}
		n := Notificacion{
			ID:       uuid.NewString(),
			Mensaje:  mensajeAlerta(est),
			Tipo:     "PRESUPUESTO",
			Leida:    false,
			CreadaEn: time.Now().UTC().Format(time.RFC3339),
		}
		if err := store.CrearNotificacion(ctx, usuarioID, n); err != nil {
			log.Printf("consumidor: no se pudo guardar la notificación: %v", err)
			continue
		}
		store.MarcarAlertado(ctx, usuarioID, mes, clave)
		creadas++

		// Se publica el evento para los demás consumidores (Node: email).
		if eventos != nil {
			_ = eventos.Publicar(ctx, "alerta.creada", map[string]string{
				"alertaId":        n.ID,
				"usuarioId":       usuarioID,
				"categoria":       est.Categoria,
				"mensaje":         n.Mensaje,
				"porcentajeUsado": fmt.Sprintf("%.1f", est.PorcentajeUsado),
				"mes":             mes,
			})
		}
		// Y se empuja al navegador por SSE, sin que tenga que preguntar.
		if hub != nil {
			hub.Publicar(usuarioID, n)
		}
	}
	return creadas, nil
}

// claveAlerta distingue la alerta de aviso (>=80%) de la de excedido
// (>=100%): son dos avisos distintos y el usuario recibe ambos.
func claveAlerta(est PresupuestoEstado) string {
	if est.PorcentajeUsado >= 100 {
		return "excedido:" + est.Categoria
	}
	return est.Categoria
}

// mensajeAlerta redacta el texto según la zona: aviso o límite excedido.
func mensajeAlerta(est PresupuestoEstado) string {
	if est.PorcentajeUsado >= 100 {
		return fmt.Sprintf("Te pasaste por $%.2f del presupuesto de %s", -est.Restante, est.Categoria)
	}
	return fmt.Sprintf("Llegaste al %.1f%% de tu presupuesto de %s", est.PorcentajeUsado, est.Categoria)
}

func (c *ConsumidorEventos) confirmar(ctx context.Context, msg redis.XMessage) {
	if err := c.rdb.XAck(ctx, c.stream, c.grupo, msg.ID).Err(); err != nil {
		log.Printf("consumidor: no se pudo confirmar el evento %s: %v", msg.ID, err)
	}
}
