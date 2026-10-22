package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const maxNotifs = 50
const maxAportes = 100

// ttlRedis es la vigencia de las claves auxiliares (notificaciones y alertas).
// Sin TTL estas claves crecerían para siempre en Redis.
const ttlRedis = 90 * 24 * time.Hour

type RedisStore struct {
	rdb *redis.Client
}

func NewRedisStore(rdb *redis.Client) *RedisStore {
	return &RedisStore{rdb: rdb}
}

func (s *RedisStore) claveMeta(usuarioID string) string {
	return fmt.Sprintf("metas:%s", usuarioID)
}

// claveMetaMontos guarda el monto ahorrado de cada meta por separado del
// resto de metadatos. Separarlos permite actualizar el saldo con un único
// HINCRBYFLOAT atómico, sin read-modify-write (que con dos aportes
// simultáneos perdía dinero).
func (s *RedisStore) claveMetaMontos(usuarioID string) string {
	return fmt.Sprintf("metas-montos:%s", usuarioID)
}

// claveAportes es el historial de movimientos (aportes/retiros) de una meta.
func (s *RedisStore) claveAportes(usuarioID, metaID string) string {
	return fmt.Sprintf("aportes:%s:%s", usuarioID, metaID)
}

// claveMetaOK marca las metas ya notificadas como cumplidas, para no
// repetir el aviso "¡Meta cumplida!" en cada aporte posterior.
func (s *RedisStore) claveMetaOK(usuarioID, metaID string) string {
	return fmt.Sprintf("meta-ok:%s:%s", usuarioID, metaID)
}

func (s *RedisStore) claveNotifs(usuarioID string) string {
	return fmt.Sprintf("notifs:%s", usuarioID)
}

func (s *RedisStore) claveAlertas(usuarioID, mes string) string {
	return fmt.Sprintf("alertas:%s:%s", usuarioID, mes)
}

// YaAlertado indica si ya se avisó al usuario por esa categoría en ese mes
// (evita duplicar la misma alerta en cada verificación).
func (s *RedisStore) YaAlertado(ctx context.Context, usuarioID, mes, categoria string) bool {
	usuario, err := s.rdb.SIsMember(ctx, s.claveAlertas(usuarioID, mes), categoria).Result()
	return err == nil && usuario
}

func (s *RedisStore) MarcarAlertado(ctx context.Context, usuarioID, mes, categoria string) {
	clave := s.claveAlertas(usuarioID, mes)
	pipe := s.rdb.Pipeline()
	pipe.SAdd(ctx, clave, categoria)
	pipe.Expire(ctx, clave, ttlRedis)
	_, _ = pipe.Exec(ctx)
}

// YaNotificadaMeta indica si ya se avisó que esa meta se cumplió.
func (s *RedisStore) YaNotificadaMeta(ctx context.Context, usuarioID, metaID string) bool {
	ok, err := s.rdb.SIsMember(ctx, s.claveMetaOK(usuarioID, metaID), "1").Result()
	return err == nil && ok
}

// MarcarMetaNotificada registra que la meta ya generó el aviso de cumplimiento.
func (s *RedisStore) MarcarMetaNotificada(ctx context.Context, usuarioID, metaID string) {
	clave := s.claveMetaOK(usuarioID, metaID)
	pipe := s.rdb.Pipeline()
	pipe.SAdd(ctx, clave, "1")
	pipe.Expire(ctx, clave, ttlRedis)
	_, _ = pipe.Exec(ctx)
}

func (s *RedisStore) CrearMeta(ctx context.Context, usuarioID string, m Meta) error {
	b, _ := json.Marshal(m)
	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, s.claveMeta(usuarioID), m.ID, b)
	pipe.HSetNX(ctx, s.claveMetaMontos(usuarioID), m.ID, 0)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *RedisStore) ListarMetas(ctx context.Context, usuarioID string) ([]Meta, error) {
	res, err := s.rdb.HGetAll(ctx, s.claveMeta(usuarioID)).Result()
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(res))
	for id := range res {
		ids = append(ids, id)
	}
	// Sin metas no hay nada que leer: HMGet sin campos es un error en Redis.
	if len(ids) == 0 {
		return []Meta{}, nil
	}
	// Los montos viven aparte: una sola consulta para todas las metas.
	montos, err := s.rdb.HMGet(ctx, s.claveMetaMontos(usuarioID), ids...).Result()
	if err != nil {
		return nil, err
	}
	metas := make([]Meta, 0, len(res))
	for i, id := range ids {
		var m Meta
		if json.Unmarshal([]byte(res[id]), &m) != nil {
			continue
		}
		if i < len(montos) && montos[i] != nil {
			if v, err := strconv.ParseFloat(fmt.Sprintf("%v", montos[i]), 64); err == nil {
				m.MontoActual = v
			}
		}
		metas = append(metas, m)
	}
	return metas, nil
}

func (s *RedisStore) ObtenerMeta(ctx context.Context, usuarioID, id string) (*Meta, error) {
	v, err := s.rdb.HGet(ctx, s.claveMeta(usuarioID), id).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var m Meta
	if err := json.Unmarshal([]byte(v), &m); err != nil {
		return nil, err
	}
	monto, err := s.rdb.HGet(ctx, s.claveMetaMontos(usuarioID), id).Result()
	if err == nil {
		if f, err := strconv.ParseFloat(monto, 64); err == nil {
			m.MontoActual = f
		}
	}
	return &m, nil
}

// GuardarMeta actualiza los metadatos y el monto de la meta. Se usa en las
// operaciones que cambian ambos a la vez (crear, editar, aportar).
func (s *RedisStore) GuardarMeta(ctx context.Context, usuarioID string, m Meta) error {
	b, _ := json.Marshal(m)
	pipe := s.rdb.TxPipeline()
	pipe.HSet(ctx, s.claveMeta(usuarioID), m.ID, b)
	pipe.HSet(ctx, s.claveMetaMontos(usuarioID), m.ID, m.MontoActual)
	_, err := pipe.Exec(ctx)
	return err
}

// GuardarMetaDatos actualiza solo los metadatos (nombre, objetivo, fecha),
// sin tocar el monto ahorrado.
func (s *RedisStore) GuardarMetaDatos(ctx context.Context, usuarioID string, m Meta) error {
	b, _ := json.Marshal(m)
	return s.rdb.HSet(ctx, s.claveMeta(usuarioID), m.ID, b).Err()
}

// SumarAporte suma (o resta, si el monto es negativo) al saldo de la meta de
// forma atómica con HINCRBYFLOAT y devuelve el saldo resultante. Con esto dos
// aportes simultáneos no pueden pisarse entre sí.
func (s *RedisStore) SumarAporte(ctx context.Context, usuarioID, metaID string, monto float64) (float64, error) {
	return s.rdb.HIncrByFloat(ctx, s.claveMetaMontos(usuarioID), metaID, monto).Result()
}

func (s *RedisStore) EliminarMeta(ctx context.Context, usuarioID, id string) error {
	pipe := s.rdb.TxPipeline()
	pipe.HDel(ctx, s.claveMeta(usuarioID), id)
	pipe.HDel(ctx, s.claveMetaMontos(usuarioID), id)
	pipe.SRem(ctx, s.claveMetaOK(usuarioID, id), "1")
	pipe.Del(ctx, s.claveAportes(usuarioID, id))
	_, err := pipe.Exec(ctx)
	return err
}

// RegistrarAporte guarda el movimiento en el historial de la meta.
func (s *RedisStore) RegistrarAporte(ctx context.Context, usuarioID, metaID string, a Aporte) error {
	b, _ := json.Marshal(a)
	clave := s.claveAportes(usuarioID, metaID)
	pipe := s.rdb.TxPipeline()
	pipe.LPush(ctx, clave, b)
	pipe.LTrim(ctx, clave, 0, maxAportes-1)
	pipe.Expire(ctx, clave, ttlRedis)
	_, err := pipe.Exec(ctx)
	return err
}

// ListarAportes devuelve el historial de movimientos de la meta (más reciente primero).
func (s *RedisStore) ListarAportes(ctx context.Context, usuarioID, metaID string) ([]Aporte, error) {
	res, err := s.rdb.LRange(ctx, s.claveAportes(usuarioID, metaID), 0, maxAportes-1).Result()
	if err != nil {
		return nil, err
	}
	list := make([]Aporte, 0, len(res))
	for _, v := range res {
		var a Aporte
		if json.Unmarshal([]byte(v), &a) == nil {
			list = append(list, a)
		}
	}
	return list, nil
}

func (s *RedisStore) CrearNotificacion(ctx context.Context, usuarioID string, n Notificacion) error {
	b, _ := json.Marshal(n)
	clave := s.claveNotifs(usuarioID)
	pipe := s.rdb.Pipeline()
	pipe.LPush(ctx, clave, b)
	pipe.LTrim(ctx, clave, 0, maxNotifs-1)
	pipe.Expire(ctx, clave, ttlRedis)
	_, err := pipe.Exec(ctx)
	return err
}

func (s *RedisStore) ListarNotificaciones(ctx context.Context, usuarioID string) ([]Notificacion, error) {
	res, err := s.rdb.LRange(ctx, s.claveNotifs(usuarioID), 0, maxNotifs-1).Result()
	if err != nil {
		return nil, err
	}
	var list []Notificacion
	for _, v := range res {
		var n Notificacion
		if json.Unmarshal([]byte(v), &n) == nil {
			list = append(list, n)
		}
	}
	return list, nil
}

func (s *RedisStore) MarcarLeida(ctx context.Context, usuarioID, id string) (*Notificacion, error) {
	list, err := s.ListarNotificaciones(ctx, usuarioID)
	if err != nil {
		return nil, err
	}
	for i, n := range list {
		if n.ID == id {
			if !n.Leida {
				n.Leida = true
				b, _ := json.Marshal(n)
				if err := s.rdb.LSet(ctx, s.claveNotifs(usuarioID), int64(i), b).Err(); err != nil {
					return nil, err
				}
			}
			return &n, nil
		}
	}
	return nil, nil
}

func generarID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), time.Now().UnixMicro())
}
