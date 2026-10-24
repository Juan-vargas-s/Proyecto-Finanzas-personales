package com.finanzas.transacciones.service;

import com.finanzas.transacciones.model.EventoOutbox;
import com.finanzas.transacciones.repository.EventoOutboxRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Escribe eventos en la outbox. Se invoca desde dentro de la transacción de
 * negocio: el evento se confirma con el commit, nunca antes.
 */
@Service
public class OutboxService {

    private final EventoOutboxRepository repository;
    private final ObjectMapper objectMapper;

    public OutboxService(EventoOutboxRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * Registra un evento pendiente de publicar. Los campos se guardan como
     * JSON plano (mismo formato que usa el stream de Redis) para que el
     * relay solo tenga que desempaquetarlos.
     */
    public void registrar(String tipo, UUID usuarioId, Map<String, String> campos) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("tipo", tipo);
        if (usuarioId != null) {
            payload.put("usuarioId", usuarioId.toString());
        }
        if (campos != null) {
            payload.putAll(campos);
        }
        try {
            repository.save(new EventoOutbox(tipo, usuarioId, objectMapper.writeValueAsString(payload)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo registrar el evento en la outbox", e);
        }
    }

    public List<EventoOutbox> pendientes() {
        return repository.findTop50ByPublicadoFalseOrderByCreadoEnAsc();
    }

    public Map<String, String> campos(EventoOutbox evento) {
        try {
            return objectMapper.readValue(evento.getPayload(), new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    public void marcarPublicado(EventoOutbox evento) {
        evento.setPublicado(true);
        repository.save(evento);
    }

    public void marcarIntentoFallido(EventoOutbox evento) {
        evento.setIntentos(evento.getIntentos() + 1);
        repository.save(evento);
    }
}
