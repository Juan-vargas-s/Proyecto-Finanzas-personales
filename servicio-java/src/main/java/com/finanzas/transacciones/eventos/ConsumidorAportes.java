package com.finanzas.transacciones.eventos;

import com.finanzas.transacciones.service.TransaccionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.PendingMessage;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@DependsOn("migracionEsquema")
@SuppressWarnings("unchecked")
public class ConsumidorAportes {

    private static final Logger log = LoggerFactory.getLogger(ConsumidorAportes.class);

    private final RedisTemplate<String, String> redisTemplate;
    private final TransaccionService transaccionService;
    private final ObjectMapper objectMapper;

    @Value("${eventos.stream.nombre:eventos:finanzas}")
    private String streamNombre;

    @Value("${eventos.group.java:java}")
    private String groupJava;

    @Value("${eventos.consumer.java:java-1}")
    private String consumerJava;

    public ConsumidorAportes(RedisTemplate<String, String> redisTemplate,
                             TransaccionService transaccionService,
                             ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.transaccionService = transaccionService;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void inicializarGrupo() {
        try {
            redisTemplate.opsForStream().createGroup(streamNombre, ReadOffset.from("0-0"), groupJava);
            log.info("Grupo de consumidores creado: {} en {}", groupJava, streamNombre);
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            if (msg.contains("busgroup") || msg.contains("busygroup")) {
                log.debug("El grupo {} ya existe en {}", groupJava, streamNombre);
                return;
            }
            log.warn("No se pudo crear el grupo {} en {}: {}", groupJava, streamNombre, e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 1000)
    public void consumir() {
        try {
            var records = redisTemplate.opsForStream().read(
                    Consumer.from(groupJava, consumerJava),
                    StreamOffset.create(streamNombre, ReadOffset.lastConsumed())
            );
            if (records != null && !records.isEmpty()) {
                for (MapRecord<String, Object, Object> record : records) {
                    procesarConControl(record);
                }
            }
            recuperarPendientes();
        } catch (Exception ex) {
            log.debug("Consumidor de aportes inactivo o sin eventos: {}", ex.getMessage());
        }
    }

    /**
     * Recupera los eventos que quedaron sin confirmar (PEL) por un fallo
     * anterior, para que no se pierdan. Es seguro reprocesarlos: la
     * idempotencia la garantiza el indice UNIQUE de transacciones.aporte_id.
     */
    private void recuperarPendientes() {
        var pendientes = redisTemplate.opsForStream().pending(
                streamNombre, groupJava, Range.unbounded(), 20);
        if (pendientes == null) {
            return;
        }
        for (PendingMessage pendiente : pendientes) {
            Duration inactivo = pendiente.getElapsedTimeSinceLastDelivery();
            if (inactivo != null && inactivo.toSeconds() < 60) {
                continue;
            }
            var reclamados = redisTemplate.opsForStream().claim(
                    streamNombre, groupJava, consumerJava, Duration.ofSeconds(60), pendiente.getId());
            if (reclamados == null) {
                continue;
            }
            for (MapRecord<String, Object, Object> record : reclamados) {
                procesarConControl(record);
            }
        }
    }

    /**
     * Procesa un evento aislando el error: un evento inválido no debe
     * impedir que se procesen los siguientes.
     */
    private void procesarConControl(MapRecord<String, Object, Object> record) {
        try {
            procesar(record);
        } catch (Exception ex) {
            log.error("Error procesando evento {}: {}", record.getId(), ex.getMessage());
        }
    }

    private void procesar(MapRecord<String, Object, Object> record) {
        Map<String, String> campos = new HashMap<>();
        record.getValue().forEach((k, v) ->
                campos.put(String.valueOf(k), v == null ? null : String.valueOf(v)));

        // El stream es compartido por varios servicios: se mira el tipo antes
        // de deserializar. Asi los eventos ajenos se confirman sin intentar
        // convertirlos (sus campos no encajan en MetaAporteEvento).
        String tipo = campos.get("tipo");
        boolean retiro = "meta.aporte.retirado".equals(tipo);
        if (!retiro && !"meta.aporte.registrado".equals(tipo)) {
            confirmar(record);
            return;
        }

        MetaAporteEvento evento = objectMapper.convertValue(campos, MetaAporteEvento.class);
        if (evento.usuarioId() == null || evento.usuarioId().isBlank()) {
            confirmar(record);
            return;
        }
        UUID usuarioId;
        UUID metaId;
        UUID aporteId;
        try {
            usuarioId = UUID.fromString(evento.usuarioId());
            metaId = vacio(evento.metaId()) ? null : UUID.fromString(evento.metaId());
            aporteId = vacio(evento.aporteId()) ? null : UUID.fromString(evento.aporteId());
        } catch (IllegalArgumentException ex) {
            // Un evento con UUID invalido no se puede reprocesar nunca: se
            // confirma para que no bloquee el PEL del grupo.
            log.warn("Evento {} descartado por UUID invalido: {}", record.getId(), ex.getMessage());
            confirmar(record);
            return;
        }
        BigDecimal monto = evento.monto() == null ? BigDecimal.ZERO : evento.monto();
        LocalDate fecha = vacio(evento.fecha()) ? LocalDate.now() : LocalDate.parse(evento.fecha());

        if (retiro) {
            transaccionService.aplicarRetiro(usuarioId, metaId, aporteId, monto, fecha, "ahorro");
        } else {
            transaccionService.aplicarAporte(usuarioId, metaId, aporteId, monto, fecha, "ahorro");
        }
        confirmar(record);
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    /**
     * Confirma (XACK) el evento solo si se procesó bien. Si falla, el evento
     * sigue pendiente y el recuperador lo reintenta más tarde.
     */
    private void confirmar(MapRecord<String, Object, Object> record) {
        try {
            redisTemplate.opsForStream().acknowledge(streamNombre, groupJava, record.getId().getValue());
        } catch (Exception ex) {
            log.warn("No se pudo confirmar el evento {}: {}", record.getId(), ex.getMessage());
        }
    }
}
