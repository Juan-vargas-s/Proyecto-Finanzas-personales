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
 * Catálogo de categorías. Las filas con usuarioId NULL son las plantillas
 * globales; al primer uso, cada usuario recibe una copia editable de ellas.
 */
@Entity
@Table(
        name = "categorias",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_categorias_usuario_nombre",
                columnNames = {"usuario_id", "nombre"}))
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "usuario_id")
    private UUID usuarioId;

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
        this(null, nombre, tipo, icono, color, orden);
    }

    public Categoria(UUID usuarioId, String nombre, TipoCategoria tipo,
                     String icono, String color, Integer orden) {
        this.usuarioId = usuarioId;
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

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(UUID usuarioId) {
        this.usuarioId = usuarioId;
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
