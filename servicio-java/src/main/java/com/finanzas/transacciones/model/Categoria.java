package com.finanzas.transacciones.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;

/**
 * Catálogo de categorías de finanzas. Es global (no depende del usuario):
 * todos comparten el mismo catálogo, con icono y color para pintarlo en la
 * interfaz sin tener que duplicar el mapeo en el frontend.
 */
@Entity
@Table(
        name = "categorias",
        uniqueConstraints = @UniqueConstraint(name = "uk_categorias_nombre", columnNames = "nombre"))
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 40)
    private String nombre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TipoCategoria tipo;

    @Column(nullable = false, length = 8)
    private String icono;

    @Column(nullable = false, length = 9)
    private String color;

    @Column(nullable = false)
    private Integer orden;

    public Categoria() {}

    public Categoria(String nombre, TipoCategoria tipo, String icono, String color, Integer orden) {
        this.nombre = nombre;
        this.tipo = tipo;
        this.icono = icono;
        this.color = color;
        this.orden = orden;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public TipoCategoria getTipo() {
        return tipo;
    }

    public void setTipo(TipoCategoria tipo) {
        this.tipo = tipo;
    }

    public String getIcono() {
        return icono;
    }

    public void setIcono(String icono) {
        this.icono = icono;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Integer getOrden() {
        return orden;
    }

    public void setOrden(Integer orden) {
        this.orden = orden;
    }
}
