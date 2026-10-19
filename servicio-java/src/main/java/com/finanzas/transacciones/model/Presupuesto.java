package com.finanzas.transacciones.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "presupuestos", uniqueConstraints = @UniqueConstraint(columnNames = {"usuarioId", "categoria", "mes"}))
public class Presupuesto {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID usuarioId;

    @Column(nullable = false)
    private String categoria;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal limiteMensual;

    @Column(nullable = false)
    private String mes;

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

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public BigDecimal getLimiteMensual() {
        return limiteMensual;
    }

    public void setLimiteMensual(BigDecimal limiteMensual) {
        this.limiteMensual = limiteMensual;
    }

    public String getMes() {
        return mes;
    }

    public void setMes(String mes) {
        this.mes = mes;
    }
}
