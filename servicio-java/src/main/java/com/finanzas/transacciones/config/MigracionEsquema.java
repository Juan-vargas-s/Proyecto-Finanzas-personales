package com.finanzas.transacciones.config;

import jakarta.persistence.EntityManagerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * Migraciones de esquema que Hibernate no puede resolver solo.
 *
 * Al agregar un valor al enum {@code TipoTransaccion} (AHORRO) el CHECK
 * constraint que PostgreSQL crea sobre la columna {@code tipo} sigue
 * permitiendo solo INGRESO y GASTO en las bases de datos ya existentes, y
 * las inserciones de aportes fallan. Hibernate no altera CHECK constraints
 * con ddl-auto=update, por eso se rehacen aqui.
 *
 * Es idempotente: si el constraint no existe o ya permite AHORRO, no hace
 * nada. Se ejecuta al construir el bean, cuando la EntityManagerFactory ya
 * garanteizo el esquema (inyectarla fuerza ese orden).
 */
@Component
public class MigracionEsquema {

    private static final Logger log = LoggerFactory.getLogger(MigracionEsquema.class);

    private static final String CONSTRAINT = "transacciones_tipo_check";

    private final JdbcTemplate jdbc;

    public MigracionEsquema(EntityManagerFactory entityManagerFactory, JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void migrar() {
        try {
            Integer pendientes = jdbc.queryForObject(
                    "SELECT count(*) FROM pg_constraint "
                            + "WHERE conname = ? AND conrelid = to_regclass('transacciones') "
                            + "AND pg_get_constraintdef(oid) NOT LIKE '%AHORRO%'",
                    Integer.class, CONSTRAINT);
            if (pendientes == null || pendientes == 0) {
                return;
            }
            jdbc.execute("ALTER TABLE transacciones DROP CONSTRAINT " + CONSTRAINT);
            jdbc.execute("ALTER TABLE transacciones ADD CONSTRAINT " + CONSTRAINT
                    + " CHECK (tipo::text = ANY (ARRAY['INGRESO', 'GASTO', 'AHORRO']::text[]))");
            log.info("Migracion aplicada: el constraint '{}' admite AHORRO", CONSTRAINT);
        } catch (Exception ex) {
            log.warn("No se pudo migrar el constraint '{}': {}", CONSTRAINT, ex.getMessage());
        }
    }
}
