/**
 * Consumidor de alertas de presupuesto (última milla del bus de eventos).
 *
 * Java publica `transaccion.*` y `presupuesto.actualizado`; Go los consume,
 * re-evalúa los presupuestos y publica `alerta.creada`. Este consumidor toma
 * ese evento y envía el correo con el SMTP que ya usa el registro.
 *
 * Detalles del patrón:
 * - Grupo de consumidores propio (`node`): cada servicio lee todos los
 *   eventos exactamente una vez, sin robarle mensajes a los demás.
 * - Se confirma (XACK) solo cuando el envío terminó bien; si SMTP falla el
 *   mensaje queda en la PEL y `XAUTOCLAIM` lo reintenta más tarde.
 * - Dedup por id de evento (SET NX con TTL): un mensaje reclamado no vuelve
 *   a mandar el mismo correo.
 */
const IORedis = require('ioredis');

const STREAM = process.env.REDIS_EVENTOS_STREAM || 'eventos:finanzas';
const GRUPO = process.env.EVENTOS_GROUP_NODE || 'node';
const CONSUMIDOR = 'node-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const LOTE = 10;
const BLOQUEO_MS = 5000;
const MIN_IDLE_MS = 60000;
const VUELTAS_REAPER = 12;

function fieldsAObjeto(fields) {
  const objeto = {};
  for (let i = 0; i < fields.length; i += 2) {
    objeto[fields[i]] = fields[i + 1];
  }
  return objeto;
}

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function enviarCorreoAlerta({ transporter, emailFrom, usuario, evento }) {
  const mensaje = evento.mensaje || 'Tu presupuesto necesita atención';
  const categoria = evento.categoria ? evento.categoria : 'tu presupuesto';
  const porcentaje = evento.porcentajeUsado ? `${evento.porcentajeUsado}%` : '';

  await transporter.sendMail({
    from: emailFrom,
    to: usuario.email,
    subject: `⚠️ Alerta de presupuesto — ${categoria}`,
    text:
      `Hola ${usuario.nombre},\n\n` +
      `${mensaje}\n\n` +
      `Categoría: ${categoria}${porcentaje ? `\nUso del límite: ${porcentaje}` : ''}\n` +
      `Mes: ${evento.mes || 'actual'}\n\n` +
      `Entra a Finanzas Personales para revisar tus presupuestos.\n`,
    html: `
      <p>Hola <strong>${escaparHtml(usuario.nombre)}</strong>,</p>
      <p style="font-size:16px">${escaparHtml(mensaje)}</p>
      <ul style="padding-left:18px;color:#475569">
        <li><strong>Categoría:</strong> ${escaparHtml(categoria)}</li>
        ${porcentaje ? `<li><strong>Uso del límite:</strong> ${escaparHtml(porcentaje)}</li>` : ''}
        <li><strong>Mes:</strong> ${escaparHtml(evento.mes || 'actual')}</li>
      </ul>
      <p>Entra a <strong>Finanzas Personales</strong> para revisar tus presupuestos.</p>
    `,
  });
}

/**
 * Arranca el consumidor en segundo plano. Devuelve una función para detenerlo.
 * Recibe las dependencias ya construidas para no duplicar SMTP/Prisma.
 */
function arrancarConsumidorAlertas({ prisma, transporter, smtpHabilitado, emailFrom }) {
  const rdb = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
  });
  rdb.on('error', (err) => console.error('[eventos] error de Redis:', err.message));

  let detenido = false;

  async function asegurarGrupo() {
    try {
      await rdb.xgroup('CREATE', STREAM, GRUPO, '$', 'MKSTREAM');
    } catch (err) {
      if (!String(err.message).includes('BUSYGROUP')) throw err;
    }
  }

  async function procesar(id, fields) {
    const evento = fieldsAObjeto(fields);
    const tipo = evento.tipo || '';

    // Otros eventos del stream no son de este consumidor.
    if (tipo !== 'alerta.creada') {
      await rdb.xack(STREAM, GRUPO, id);
      return;
    }

    if (!smtpHabilitado || !transporter) {
      console.warn('[eventos] alerta creada sin SMTP configurado; se descarta', id);
      await rdb.xack(STREAM, GRUPO, id);
      return;
    }

    const primeraVez = await rdb.set(`email-alerta:${id}`, '1', 'EX', 86400, 'NX');
    if (!primeraVez) {
      await rdb.xack(STREAM, GRUPO, id);
      return;
    }

    try {
      const usuario = evento.usuarioId
        ? await prisma.usuario.findUnique({ where: { id: evento.usuarioId } })
        : null;
      if (!usuario) {
        console.warn(`[eventos] alerta ${id} sin usuario destino; se descarta`);
        await rdb.xack(STREAM, GRUPO, id);
        return;
      }
      await enviarCorreoAlerta({ transporter, emailFrom, usuario, evento });
      await rdb.xack(STREAM, GRUPO, id);
      console.log(`[eventos] correo de alerta enviado (${id}) a ${usuario.email}`);
    } catch (err) {
      // Sin XACK: el mensaje queda en la PEL y el reaper lo reintenta.
      await rdb.del(`email-alerta:${id}`);
      console.error(`[eventos] no se pudo enviar la alerta ${id}:`, err.message);
    }
  }

  async function recuperarColgados() {
    try {
      const [, mensajes] = await rdb.xautoclaim(
        STREAM,
        GRUPO,
        CONSUMIDOR,
        MIN_IDLE_MS,
        '0-0',
        'COUNT',
        LOTE
      );
      for (const [id, fields] of mensajes || []) {
        await procesar(id, fields);
      }
    } catch (err) {
      console.error('[eventos] XAUTOCLAIM falló:', err.message);
    }
  }

  async function bucle() {
    await asegurarGrupo();
    console.log(`[eventos] consumidor de alertas activo: grupo ${GRUPO} sobre ${STREAM}`);
    let vueltas = 0;

    while (!detenido) {
      try {
        const lote = await rdb.xreadgroup(
          'GROUP', GRUPO, CONSUMIDOR,
          'COUNT', LOTE,
          'BLOCK', BLOQUEO_MS,
          'STREAMS', STREAM, '>'
        );
        for (const [, mensajes] of lote || []) {
          for (const [id, fields] of mensajes) {
            await procesar(id, fields);
          }
        }
      } catch (err) {
        if (detenido) break;
        console.error('[eventos] XREADGROUP falló:', err.message);
        await new Promise((r) => setTimeout(r, 2000));
      }
      vueltas += 1;
      if (vueltas % VUELTAS_REAPER === 0) await recuperarColgados();
    }
  }

  bucle().catch((err) => console.error('[eventos] consumidor detenido:', err));

  return async function detener() {
    detenido = true;
    try {
      await rdb.quit();
    } catch {
      // el proceso está saliendo: no hay nada que hacer
    }
  };
}

module.exports = { arrancarConsumidorAlertas };
