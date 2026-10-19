package main

import (
	"regexp"
	"strings"
)

type Meta struct {
	ID            string  `json:"id"`
	Nombre        string  `json:"nombre"`
	MontoObjetivo float64 `json:"montoObjetivo"`
	MontoActual   float64 `json:"montoActual"`
	FechaLimite   string  `json:"fechaLimite"`
	CreadaEn      string  `json:"creadaEn"`
}

type MetaResponse struct {
	Meta
	Porcentaje float64 `json:"porcentaje"`
	Completada bool    `json:"completada"`
}

type Notificacion struct {
	ID       string `json:"id"`
	Mensaje  string `json:"mensaje"`
	Tipo     string `json:"tipo"`
	Leida    bool   `json:"leida"`
	CreadaEn string `json:"creadaEn"`
}

type CrearMetaRequest struct {
	Nombre        string  `json:"nombre" binding:"required"`
	MontoObjetivo float64 `json:"montoObjetivo" binding:"required,gt=0"`
	FechaLimite   string  `json:"fechaLimite" binding:"required,datetime=2006-01-02"`
}

type AportarRequest struct {
	Monto float64 `json:"monto" binding:"required,gt=0"`
}

type VerificarRequest struct {
	UsuarioID string `json:"usuarioId"`
	Mes       string `json:"mes"`
}

var patronMes = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

func esMesValido(mes string) bool {
	return patronMes.MatchString(mes)
}

func aMetaResponse(m Meta) MetaResponse {
	porcentaje := 0.0
	if m.MontoObjetivo > 0 {
		porcentaje = float64(int(m.MontoActual/m.MontoObjetivo*1000)) / 10
	}
	return MetaResponse{
		Meta:       m,
		Porcentaje: porcentaje,
		Completada: m.MontoObjetivo > 0 && m.MontoActual >= m.MontoObjetivo,
	}
}

func nombreValido(nombre string) bool {
	return strings.TrimSpace(nombre) != ""
}
