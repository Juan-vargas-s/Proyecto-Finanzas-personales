package com.finanzas.transacciones.repository;

import com.finanzas.transacciones.model.EventoOutbox;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventoOutboxRepository extends JpaRepository<EventoOutbox, UUID> {

    List<EventoOutbox> findTop50ByPublicadoFalseOrderByCreadoEnAsc();
}
