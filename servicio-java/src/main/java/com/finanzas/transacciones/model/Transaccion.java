package com.finanzas.transacciones.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "transacciones")
public class Transaccion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoTransaccion tipo;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false)
    private String categoria;

    @Column(nullable = false)
    private LocalDate fecha;

    private String descripcion;

    /**
     * Meta de ahorro a la que pertenece el movimiento. Nullable porque el
     * resto de transacciones no están ligadas a ninguna meta. Sin FK: las
     * metas viven en Redis, no en PostgreSQL.
     */
    private UUID metaId;

    /**
     * Identificador del aporte que originó el movimiento. Es la clave de
     * idempotencia del consumidor de eventos: al reprocesar un aporte ya
     * aplicado no se crea una transacción duplicada.
     */
    @Column(unique = true)
    private UUID aporteId;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(UUID usuarioId) {
        this.usuarioId = usuarioId;
    }

    public TipoTransaccion getTipo() {
        return tipo;
    }

    public void setTipo(TipoTransaccion tipo) {
        this.tipo = tipo;
    }

    public BigDecimal getMonto() {
        return monto;
    }

    public void setMonto(BigDecimal monto) {
        this.monto = monto;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public LocalDate getFecha() {
        return fecha;
    }

    public void setFecha(LocalDate fecha) {
        this.fecha = fecha;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public UUID getMetaId() {
        return metaId;
    }

    public void setMetaId(UUID metaId) {
        this.metaId = metaId;
    }

    public UUID getAporteId() {
        return aporteId;
    }

    public void setAporteId(UUID aporteId) {
        this.aporteId = aporteId;
    }
}
