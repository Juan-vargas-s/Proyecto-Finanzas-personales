package com.finanzas.transacciones.eventos;

import com.finanzas.transacciones.model.EventoOutbox;
import com.finanzas.transacciones.service.OutboxService;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Relay de la outbox: publica los eventos pendientes en el stream de Redis
 * para que los demás microservicios los consuman. Corre cada 2 segundos.
 */
@Component
public class RelayOutbox {

    private static final Logger log = LoggerFactory.getLogger(RelayOutbox.class);

    private final OutboxService outboxService;
    private final RedisTemplate<String, String> redisTemplate;

    @Value("${eventos.stream.nombre:eventos:finanzas}")
    private String streamNombre;

    public RelayOutbox(OutboxService outboxService, RedisTemplate<String, String> redisTemplate) {
        this.outboxService = outboxService;
        this.redisTemplate = redisTemplate;
    }

    @Scheduled(fixedDelay = 2000, initialDelay = 3000)
    public void publicarPendientes() {
        for (EventoOutbox evento : outboxService.pendientes()) {
            try {
                Map<String, String> campos = outboxService.campos(evento);
                if (campos.isEmpty()) {
                    log.warn("Evento {} sin payload válido, se descarta", evento.getId());
                    outboxService.marcarPublicado(evento);
                    continue;
                }
                redisTemplate.opsForStream().add(streamNombre, campos);
                outboxService.marcarPublicado(evento);
                log.debug("Evento {} publicado en {}", evento.getTipo(), streamNombre);
            } catch (Exception e) {
                outboxService.marcarIntentoFallido(evento);
                log.warn("No se pudo publicar el evento {}: {}", evento.getTipo(), e.getMessage());
            }
        }
    }
}
