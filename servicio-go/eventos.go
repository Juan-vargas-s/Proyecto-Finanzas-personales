package main

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// maxStreamEvents recorta el stream para que no crezca indefinidamente.
const maxStreamEvents = 10000

// nombreStreamEventos es el canal de eventos entre microservicios (Redis
// Streams). En la Fase 1 lo usa Go para publicar los aportes a meta y Java
// para consumirlos y materializarlos como transacciones AHORRO. Se puede
// sobrescribir con REDIS_EVENTOS_STREAM (el mismo valor que lee Java).
func nombreStreamEventos() string {
	if s := os.Getenv("REDIS_EVENTOS_STREAM"); s != "" {
		return s
	}
	return "eventos:finanzas"
}

// PublicadorEventos escribe eventos en el stream de Redis.
type PublicadorEventos struct {
	rdb    *redis.Client
	stream string
}

func NewPublicadorEventos(rdb *redis.Client) *PublicadorEventos {
	return &PublicadorEventos{rdb: rdb, stream: nombreStreamEventos()}
}

// Publicar añade un evento al stream. Los campos se serializan como texto
// porque Redis Streams solo admite strings.
func (p *PublicadorEventos) Publicar(ctx context.Context, tipo string, campos map[string]string) error {
	values := make([]any, 0, (len(campos)+1)*2)
	for k, v := range campos {
		values = append(values, k, v)
	}
	values = append(values, "tipo", tipo)
	return p.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: p.stream,
		Values: values,
		MaxLen: maxStreamEvents,
		Approx: true,
	}).Err()
}

// AsegurarGrupo crea el grupo de consumidores si no existe. Lo hace el
// productor (Go) al arrancar, para que el consumidor (Java) pueda leer
// desde el principio del stream sin perder eventos.
func (p *PublicadorEventos) AsegurarGrupo(ctx context.Context, grupo string) error {
	err := p.rdb.XGroupCreateMkStream(ctx, p.stream, grupo, "0").Err()
	if err != nil && !esGrupoExistente(err) {
		return err
	}
	return nil
}

func esGrupoExistente(err error) bool {
	return err != nil && strings.Contains(err.Error(), "BUSYGROUP")
}

// PublicarAporte publica un aporte (o retiro) de una meta. El aporteId es la
// clave de idempotencia: si el mismo evento se procesa dos veces, Java no
// crea la transacción dos veces (UNIQUE en transacciones.aporte_id).
func (p *PublicadorEventos) PublicarAporte(ctx context.Context, tipo string, aporteID, usuarioID, metaID, nombre string, monto float64) error {
	return p.Publicar(ctx, tipo, map[string]string{
		"aporteId":  aporteID,
		"usuarioId": usuarioID,
		"metaId":    metaID,
		"nombre":    nombre,
		"monto":     formatMonto(monto),
		"fecha":     time.Now().UTC().Format("2006-01-02"),
	})
}

// formatMonto formatea un monto sin decimales superfluos ("200", "150.5").
func formatMonto(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// nombreGrupoConsumidorJava es el grupo de consumidores que usa Java para
// leer los eventos de aportes.
func nombreGrupoConsumidorJava() string {
	if g := os.Getenv("EVENTOS_GROUP_JAVA"); g != "" {
		return g
	}
	return "java"
}
