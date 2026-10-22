# Sistema de Finanzas Personales - Microservicios

**Desarrollado por:** Miguel Maestre, Juan Vargas, Emilio Chinchilla y Mauricio Maestre  
**Asignatura:** Lenguaje de Programación  
**Fecha:** Octubre 2026

---

## Descripción General

Este proyecto es un **sistema completo de finanzas personales** implementado utilizando una arquitectura de microservicios con cuatro lenguajes de programación distintos. El sistema permite a los usuarios registrar ingresos y gastos, establecer presupuestos, crear metas de ahorro y visualizar reportes financieros con gráficas y tendencias.

### Características Principales

- **Arquitectura de microservicios** con 4 servicios independientes
- **Integración SQL + NoSQL** (PostgreSQL + Redis)
- **API Gateway** con Nginx como punto de entrada único
- **Autenticación JWT** descentralizada
- **Notificaciones en tiempo real** mediante Server-Sent Events (SSE)
- **Caché estratégico** con Redis para reportes
- **Comunicación asíncrona** mediante Redis Streams

---

## Diagrama de Arquitectura


![alt text](<Diagrama de Arquitectura Finanzas.png>)

### Patrones de Comunicación

1. **HTTP Síncrono**: Frontend → servicios → Java ↔ Go (reportes y presupuestos)
2. **Redis Streams**: Eventos asíncronos (`meta.aporte.registrado`, `meta.aporte.retirado`)
3. **SSE (Server-Sent Events)**: Notificaciones en tiempo real desde Go
4. **Outbox Pattern**: Java escribe eventos en tabla SQL, relay cada 2 segundos a Redis

---

## 🔌 Endpoints API

### Auth Service (Node.js - Puerto 3001)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/registro` | Registrar usuario (nombre, email, contraseña hasheada con bcrypt). Envía código de verificación por SMTP. |
| `POST` | `/api/auth/login` | Iniciar sesión, devuelve JWT. Requiere correo verificado. |
| `GET` | `/api/auth/perfil` | Obtener perfil (requiere JWT). |
| `PUT` | `/api/auth/perfil` | Actualizar perfil (requiere JWT). |
| `PUT` | `/api/auth/cambiar-password` | Cambiar contraseña (requiere JWT). |
| `POST` | `/api/auth/verificar-email` | Verificar email con código de 6 dígitos. |
| `POST` | `/api/auth/reenviar-código` | Reenviar código de verificación. |

### Transacciones Service (Java - Puerto 8080)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/transacciones/` | Crear ingreso o gasto. Valida categoría contra catálogo. |
| `GET` | `/api/transacciones/` | Listar por usuario, mes, tipo o categoría. Filtros opcionales. |
| `GET` | `/api/transacciones/{id}` | Obtener una transacción por ID. |
| `PUT` | `/api/transacciones/{id}` | Actualizar transacción. |
| `DELETE` | `/api/transacciones/{id}` | Eliminar transacción. |
| `POST` | `/api/transacciones/presupuestos` | Definir presupuesto mensual por categoría. |
| `GET` | `/api/transacciones/presupuestos` | Listar presupuestos del mes por usuario. |
| `GET` | `/api/transacciones/presupuestos/estado?mes=YYYY-MM` | **Estado de todos los presupuestos en una sola llamada** (gasto acumulado, límite, restante, %). |
| `GET` | `/api/transacciones/presupuestos/{categoria}?usuarioId=X&mes=YYYY-MM` | Gasto acumulado vs límite (usado por Go para alertas ≥80%). |
| `GET` | `/api/transacciones/tendencia?meses=2026-05,2026-06,...` | Serie temporal para tendencia de 6 meses. |
| `GET` | `/api/transacciones/categorias` | Catálogo global de categorías (iconos, colores). Sin requerir auth. |

### Reportes Service (Python - Puerto 8000)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/reportes/resumen/{usuarioId}?mes=YYYY-MM` | Totales ingresos, gastos, balance, totalAhorro, disponible. Usa caché Redis TTL 30s. |
| `GET` | `/api/reportes/categorias/{usuarioId}?mes=YYYY-MM` | Gastos agrupados por categoría (para gráfica pastel). |
| `GET` | `/api/reportes/tendencia/{usuarioId}` | Balance de los últimos 6 meses. |

### Metas Service (Go - Puerto 3002)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/metas/` | Crear meta de ahorro (nombre, monto objetivo, fecha límite). Opcional categoría. |
| `GET` | `/api/metas/` | Listar metas con % de avance calculado. |
| `GET` | `/api/metas/resumen` | KPIs: total ahorrado, objetivo total, nº metas, completadas, en riesgo, ritmo promedio. |
| `PUT` | `/api/metas/{id}/aportar` | Registrar aporte a la meta. Atómico con HINCRBYFLOAT. Publica evento `meta.aporte.registrado` a Redis Streams. |
| `POST` | `/api/metas/{id}/retirar` | Deshacer un aporte (negativo). Publica evento `meta.aporte.retirado`. |
| `DELETE` | `/api/metas/{id}` | Eliminar meta (devuelve 404 si no existe). |
| `POST` | `/api/metas/verificar` | Verificar presupuestos del usuario → genera alertas en Redis si ≥80%. |
| `GET` | `/api/metas/notificaciones/{usuarioId}` | Listar alertas no leídas. |
| `PUT` | `/api/metas/notificaciones/{id}/leer` | Marcar alerta como leída. |
| `GET` | `/api/metas/stream?token=<jwt>` | **SSE** Server-Sent Events para notificaciones en tiempo real. Valida JWT por query string. |
| `GET` | `/api/metas/{id}/aportes` | Historial de aportes/retiros de una meta. |

### Catálogo (Java - Mismo servicio de transacciones)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/transacciones/categorias` | Lista global de categorías con iconos y colores. Sin auth requerida. |

---

## Modelo Entidad-Relación (ER)


![alt text](<Modelo Entidad-Relacion.png>)
### auth_db (PostgreSQL) - Tabla `Usuario`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK, default uuidv4 |
| `nombre` | String | Nombre completo |
| `email` | String | Único, para login |
| `passwordHash` | String | Bcrypt hash, nunca texto plano |
| `monedaPreferida` | String | default "MXN", USD, EUR, etc. |
| `emailVerificado` | Boolean | default false |
| `createdAt` | DateTime | default now() |

### finanzas_db (PostgreSQL) - Entidades JPA

#### Entidad Transacción

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `usuarioId` | UUID | Del JWT |
| `tipo` | Enum | `INGRESO`, `GASTO`, `AHORRO` |
| `monto` | Decimal | Positivo |
| `categoria` | String | Ej. comida, transporte, salario |
| `fecha` | Date |
| `descripcion` | String | Opcional |
| `metaId` | UUID | Nullable - enlaza con meta |
| `aporteId` | UUID | Nullable, UNIQUE - idempotencia |

#### Entidad Presupuesto

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `usuarioId` | UUID | Dueño |
| `categoria` | String | Categoría |
| `limiteMensual` | Decimal | Límite máximo |
| `mes` | String | Formato `YYYY-MM` |

#### Entidad Categoría (catálogo global)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `nombre` | String | Ej. comida, transporte |
| `tipo` | Enum | `INGRESO` / `GASTO` |
| `icono` | String | Emoji o nombre de archivo |
| `color` | String | Código hex |
| `orden` | Integer |

### Redis (NoSQL) - Estructuras Clave

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `metas:{uid}` | Hash | Metadatos de cada meta (id → JSON blob) |
| `metas-montos:{uid}` | Hash | Montos actuales (id → float). `HINCRBYFLOAT` atómico. |
| `aportes:{uid}:{metaId}` | LIST | Historial de aportes/retiros |
| `notifs:{uid}` | LIST (LTRIM 50) | Notificaciones del usuario |
| `alertas:{uid}:{mes}` | SET | Dedup de alertas de presupuesto (categoría) |
| `eventos:finanzas` | STREAM | Bus de eventos entre microservicios |
| `cache:reportes:{uid}:{tipo}:{mes}` | STRING | Caché TTL 30s |

---

## Despliegue con Docker

### Requisitos Previos

- Docker y Docker Compose instalados

### Levantar el Proyecto

```bash
docker compose up --build
```

### Servicios Incluidos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| nginx | 80 | API Gateway reverse proxy |
| frontend | 3000 | Next.js application |
| servicio-node | 3001 | Auth (Registro/Login) |
| servicio-go | 3002 | Metas de ahorro |
| servicio-python | 8000 | Reportes financieros |
| servicio-java | 8080 | Transacciones y presupuestos |
| postgres | 5432 | PostgreSQL (auth_db + finanzas_db) |
| redis | 6379 | Redis (streams, caché, notificaciones) |

### Variables de Entorno Críticas

Ver  `.env.example` 

### Puntos Críticos de Configuración

1. **Nginx SSE**: El bloque `location = /api/metas/stream` **debe** tener `proxy_buffering off` para que SSE funcione
2. **JWT en query string**: EventSource no soporta cabeceras, por eso el token viene en `?token=<jwt>`
3. **Caché Redis TTL 30s**: Los reportes se calculan desde caché, si Redis cae, se recalculan con warning
4. **SMTP obligatorio**: Sin `SMTP_HOST` y `EMAIL_FROM`, el registro de cuentas está deshabilitado

---

## Tecnologías Utilizadas

### Frontend

- **Next.js 14** con App Router
- React 18 + Recharts para gráficas
- TypeScript
- API consumption through Nginx gateway

### Microservicios (4 lenguajes)

| Servicio | Lenguaje/Framework | Base de Datos |
|----------|-------------------|---------------|
| Auth | Node.js + Express + Prisma | PostgreSQL (`auth_db`) |
| Transacciones | Java + Spring Boot + JPA | PostgreSQL (`finanzas_db`) |
| Reportes | Python + FastAPI | Obtiene datos vía HTTP |
| Metas | Go + Gin | Redis |

### Infraestructura

- **Docker + docker-compose**: Orquestación completa
- **Nginx 1.27**: API Gateway reverse proxy
- **PostgreSQL 16**: Dos bases de datos
- **Redis 7**: NoSQL, streams, hashes, lists

---


