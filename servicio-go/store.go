package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const maxNotifs = 50

type RedisStore struct {
	rdb *redis.Client
}

func NewRedisStore(rdb *redis.Client) *RedisStore {
	return &RedisStore{rdb: rdb}
}

func (s *RedisStore) claveMeta(usuarioID string) string {
	return fmt.Sprintf("metas:%s", usuarioID)
}

func (s *RedisStore) claveNotifs(usuarioID string) string {
	return fmt.Sprintf("notifs:%s", usuarioID)
}

func (s *RedisStore) CrearMeta(ctx context.Context, usuarioID string, m Meta) error {
	b, _ := json.Marshal(m)
	_, err := s.rdb.HSet(ctx, s.claveMeta(usuarioID), m.ID, b).Result()
	return err
}

func (s *RedisStore) ListarMetas(ctx context.Context, usuarioID string) ([]Meta, error) {
	res, err := s.rdb.HGetAll(ctx, s.claveMeta(usuarioID)).Result()
	if err != nil {
		return nil, err
	}
	var metas []Meta
	for _, v := range res {
		var m Meta
		if json.Unmarshal([]byte(v), &m) == nil {
			metas = append(metas, m)
		}
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
	return &m, nil
}

func (s *RedisStore) GuardarMeta(ctx context.Context, usuarioID string, m Meta) error {
	b, _ := json.Marshal(m)
	return s.rdb.HSet(ctx, s.claveMeta(usuarioID), m.ID, b).Err()
}

func (s *RedisStore) EliminarMeta(ctx context.Context, usuarioID, id string) error {
	return s.rdb.HDel(ctx, s.claveMeta(usuarioID), id).Err()
}

func (s *RedisStore) CrearNotificacion(ctx context.Context, usuarioID string, n Notificacion) error {
	b, _ := json.Marshal(n)
	_, err := s.rdb.LPush(ctx, s.claveNotifs(usuarioID), b).Result()
	if err == nil {
		_ = s.rdb.LTrim(ctx, s.claveNotifs(usuarioID), 0, maxNotifs-1).Err()
	}
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
