package com.finanzas.transacciones.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Outbox transaccional: guarda el evento en la misma transacción SQL que
 * la operación de negocio. Si el commit falla, el evento no existe; si la
 * aplicación se cae después del commit, el relay lo publica más tarde. Así
 * nunca se pierde un evento ni se publica uno que no ocurrió.
 */
@Entity
@Table(name = "eventos_outbox")
public class EventoOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 40)
    private String tipo;

    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn;

    @Column(nullable = false)
    private boolean publicado;

    @Column(nullable = false)
    private int intentos;

    public EventoOutbox() {}

    public EventoOutbox(String tipo, UUID usuarioId, String payload) {
        this.tipo = tipo;
        this.usuarioId = usuarioId;
        this.payload = payload;
        this.creadoEn = Instant.now();
        this.publicado = false;
        this.intentos = 0;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(UUID usuarioId) {
        this.usuarioId = usuarioId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public Instant getCreadoEn() {
        return creadoEn;
    }

    public void setCreadoEn(Instant creadoEn) {
        this.creadoEn = creadoEn;
    }

    public boolean isPublicado() {
        return publicado;
    }

    public void setPublicado(boolean publicado) {
        this.publicado = publicado;
    }

    public int getIntentos() {
        return intentos;
    }

    public void setIntentos(int intentos) {
        this.intentos = intentos;
    }
}
