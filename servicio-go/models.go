package main

import (
	"regexp"
	"strings"
	"time"
)

type Meta struct {
	ID            string  `json:"id"`
	Nombre        string  `json:"nombre"`
	MontoObjetivo float64 `json:"montoObjetivo"`
	MontoActual   float64 `json:"montoActual"`
	FechaLimite   string  `json:"fechaLimite"`
	CreadaEn      string  `json:"creadaEn"`
	// Categoria opcional para pintar el icono/color (Fase 3) sin romper
	// el contrato actual.
	Categoria string `json:"categoria,omitempty"`
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
	Categoria     string  `json:"categoria"`
}

type ActualizarMetaRequest struct {
	Nombre        *string  `json:"nombre"`
	MontoObjetivo *float64 `json:"montoObjetivo"`
	FechaLimite   *string  `json:"fechaLimite"`
	Categoria     *string  `json:"categoria"`
}

// PresupuestoEstado es el estado de un presupuesto tal como lo devuelve Java:
// límite definido, gasto acumulado real, restante y porcentaje usado.
type PresupuestoEstado struct {
	ID              string  `json:"id"`
	Categoria       string  `json:"categoria"`
	LimiteMensual   float64 `json:"limiteMensual"`
	GastoAcumulado  float64 `json:"gastoAcumulado"`
	Restante        float64 `json:"restante"`
	PorcentajeUsado float64 `json:"porcentajeUsado"`
	Mes             string  `json:"mes"`
}

type AportarRequest struct {
	Monto float64 `json:"monto" binding:"required,gt=0"`
}

type RetirarRequest struct {
	Monto float64 `json:"monto" binding:"required,gt=0"`
}

type Aporte struct {
	ID       string  `json:"id"`
	Monto    float64 `json:"monto"`
	Tipo     string  `json:"tipo"`
	CreadaEn string  `json:"creadaEn"`
}

type MetaResumen struct {
	TotalAhorrado   float64 `json:"totalAhorrado"`
	ObjetivoTotal   float64 `json:"objetivoTotal"`
	Metas           int     `json:"metas"`
	Completadas     int     `json:"completadas"`
	EnRiesgo        int     `json:"enRiesgo"`
	RitmoPromedio   float64 `json:"ritmoPromedio"`
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

// fechaValida comprueba que la fecha límite tenga el formato YYYY-MM-DD.
func fechaValida(fecha string) bool {
	_, err := time.Parse("2006-01-02", fecha)
	return err == nil
}
