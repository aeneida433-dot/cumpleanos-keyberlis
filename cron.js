/**
 * Módulo de Recordatorios Programados (Cron Job)
 * Proyecto: Invitación 15 Años Keyberlis
 */

const cron = require('node-cron');
const { query } = require('./db');
const { enviarMensaje, isReady } = require('./whatsapp');
require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
const ALIAS = process.env.ALIAS_REGALO || 'key.2710';

// Utilidad para retardo (pausa de seguridad anti-ban)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formatea una lista de nombres de invitados con comas y conjunción 'y'
 * Ejemplos:
 *  - ['Juan'] -> 'Juan'
 *  - ['Juan', 'María'] -> 'Juan y María'
 *  - ['Juan', 'María', 'Sofía'] -> 'Juan, María y Sofía'
 */
function formatNames(names) {
  if (!names || names.length === 0) return 'familia y amigos';
  const cleanNames = names.map(n => n.trim()).filter(Boolean);
  if (cleanNames.length === 1) return cleanNames[0];
  if (cleanNames.length === 2) return `${cleanNames[0]} y ${cleanNames[1]}`;
  return `${cleanNames.slice(0, -1).join(', ')} y ${cleanNames[cleanNames.length - 1]}`;
}

/**
 * Construye el mensaje cálido de recordatorio para un invitado individual o un grupo familiar
 * En modo oficial (6 de noviembre): incluye enlace personalizado de reconfirmación (Doble Check).
 * En modo prueba (antes del 6 de noviembre): no incluye enlace de reconfirmación para no generar la segunda confirmación prematura.
 */
function buildReminderMessage(names, alias = ALIAS, token = null, esPrueba = false) {
  const nombresFormatted = formatNames(names);
  const esGrupo = names && names.length > 1;

  // Si es prueba o no hay token, enlazamos a la página principal de la invitación sin generar la segunda confirmación
  const link = (token && !esPrueba)
    ? `https://cumpleanos-keyberlis.onrender.com/reconfirmar?token=${token}`
    : `https://cumpleanos-keyberlis.onrender.com/`;

  if (esGrupo) {
    if (esPrueba || !token) {
      return (
        `👑 *¡Cuenta regresiva final, ${nombresFormatted}!* ✨💖\n\n` +
        `¡Cada vez falta menos para el gran día! Keyberlis celebra sus hermosos 15 años y para ella y nuestra familia significa muchísimo compartir esta noche mágica con ustedes. 🌸🥂\n\n` +
        `🎁 *Presente / Lluvia de sobres:*\n` +
        `Si desean tener un detalle en efectivo con la quinceañera, les compartimos nuestro alias:\n` +
        `👉 *${alias}* 💌✨\n\n` +
        `💌 *Detalles del evento:*\n` +
        `Pueden consultar la ubicación y la invitación aquí:\n` +
        `🔗 ${link}\n\n` +
        `¡Gracias por acompañarnos y ser parte de este sueño! 💖🪩✨🎈`
      );
    }

    return (
      `👑 *¡Cuenta regresiva final, ${nombresFormatted}!* ✨💖\n\n` +
      `¡Mañana es el gran día! Keyberlis celebra sus hermosos 15 años y para ella y nuestra familia significa muchísimo compartir esta noche mágica con ustedes. 🌸🥂\n\n` +
      `🎁 *Presente / Lluvia de sobres:*\n` +
      `Si desean tener un detalle en efectivo con la quinceañera, les compartimos nuestro alias:\n` +
      `👉 *${alias}* 💌✨\n\n` +
      `✅ *Por favor validen su asistencia:*\n` +
      `Ingresen en este enlace para confirmar definitivamente sus lugares en la fiesta:\n` +
      `🔗 ${link}\n\n` +
      `¡Gracias por acompañarnos y ser parte de este sueño! 💖🪩✨🎈`
    );
  }

  // Invitado individual
  if (esPrueba || !token) {
    return (
      `👑 *¡Cuenta regresiva final, ${nombresFormatted}!* ✨💖\n\n` +
      `¡Cada vez falta menos para el gran día! Keyberlis celebra sus hermosos 15 años y para ella y nuestra familia significa muchísimo compartir esta noche mágica contigo. 🌸🥂\n\n` +
      `🎁 *Presente / Lluvia de sobres:*\n` +
      `Si deseas tener un detalle en efectivo con la quinceañera, te compartimos nuestro alias:\n` +
      `👉 *${alias}* 💌✨\n\n` +
      `💌 *Detalles del evento:*\n` +
      `Puedes consultar la ubicación y la invitación aquí:\n` +
      `🔗 ${link}\n\n` +
      `¡Gracias por acompañarnos y ser parte de este sueño! 💖🪩✨🎈`
    );
  }

  return (
    `👑 *¡Cuenta regresiva final, ${nombresFormatted}!* ✨💖\n\n` +
    `¡Mañana es el gran día! Keyberlis celebra sus hermosos 15 años y para ella y nuestra familia significa muchísimo compartir esta noche mágica contigo. 🌸🥂\n\n` +
    `🎁 *Presente / Lluvia de sobres:*\n` +
    `Si deseas tener un detalle en efectivo con la quinceañera, te compartimos nuestro alias:\n` +
    `👉 *${alias}* 💌✨\n\n` +
    `✅ *Por favor valida tu asistencia:*\n` +
    `Ingresa en este enlace para confirmar definitivamente tu lugar en la fiesta:\n` +
    `🔗 ${link}\n\n` +
    `¡Gracias por acompañarnos y ser parte de este sueño! 💖🪩✨🎈`
  );
}

/**
 * Ejecuta el envío de recordatorios agrupados por teléfono con protección Anti-Ban.
 * En modo prueba (esPrueba = true o antes del 06 de noviembre):
 *   - No genera el enlace de reconfirmación (no genera la 2da confirmación).
 *   - NO actualiza recordatorio_enviado = true, preservando a los invitados para el 6 de noviembre.
 * En modo oficial (esPrueba = false):
 *   - Incluye enlace de reconfirmación exclusivo (token UUID).
 *   - Marca recordatorio_enviado = true en Neon PostgreSQL.
 * @param {Object} options
 * @param {boolean} [options.esPrueba]
 * @returns {Promise<{ totalInvitados: number, totalTelefonos: number, enviados: number, fallidos: number, esPrueba: boolean }>}
 */
async function ejecutarRecordatorios(options = {}) {
  let esPrueba = options.esPrueba;
  if (esPrueba === undefined) {
    const ahora = new Date();
    const fechaOficial = new Date('2026-11-06T12:00:00-03:00');
    esPrueba = ahora < fechaOficial;
  }

  const modoTexto = esPrueba
    ? '🧪 MODO PRUEBA ANTICIPADA (Sin segunda confirmación - Preserva pendientes para el 6 de Noviembre)'
    : '👑 ENVÍO OFICIAL DEFINITIVO (6 de Noviembre - Con segunda confirmación)';

  console.log('\n========================================================');
  console.log(`⏰ [Cron Job] INICIANDO ENVÍO DE RECORDATORIOS: ${modoTexto}`);
  console.log('========================================================');

  if (!isReady()) {
    console.error('❌ [Cron Error] No se puede enviar: WhatsApp no está conectado.');
    return {
      totalInvitados: 0,
      totalTelefonos: 0,
      enviados: 0,
      fallidos: 0,
      esPrueba,
      error: 'WhatsApp no está conectado'
    };
  }

  try {
    // Si es prueba: seleccionamos a los confirmados que no hayan reconfirmado aún
    // Si es oficial: seleccionamos a todos los que asisten y no hayan sido notificados o reconfirmados
    const querySql = esPrueba
      ? 'SELECT id, nombre, telefono, token_reconfirmacion FROM invitados WHERE asiste IS NOT FALSE AND (reconfirmado = false OR reconfirmado IS NULL) ORDER BY id ASC'
      : 'SELECT id, nombre, telefono, token_reconfirmacion FROM invitados WHERE asiste IS NOT FALSE AND (recordatorio_enviado = false OR reconfirmado = false OR reconfirmado IS NULL) ORDER BY id ASC';

    const dbResult = await query(querySql);
    const invitados = dbResult.rows;

    if (invitados.length === 0) {
      console.log(`ℹ️ [Cron] No hay invitados pendientes para ${esPrueba ? 'prueba anticipada' : 'envío oficial'} en Neon.`);
      return { totalInvitados: 0, totalTelefonos: 0, enviados: 0, fallidos: 0, esPrueba };
    }

    // Regla de Agrupación Familiar: Agrupar invitados por número de teléfono
    const phoneGroups = new Map();
    for (const inv of invitados) {
      if (!phoneGroups.has(inv.telefono)) {
        phoneGroups.set(inv.telefono, {
          ids: [],
          names: [],
          tokens: []
        });
      }
      const group = phoneGroups.get(inv.telefono);
      group.ids.push(inv.id);
      group.names.push(inv.nombre);
      if (inv.token_reconfirmacion) {
        group.tokens.push(inv.token_reconfirmacion);
      }
    }

    const groups = Array.from(phoneGroups.entries());
    console.log(`📋 [Cron] Se encontraron ${invitados.length} invitados (${esPrueba ? 'prueba' : 'oficial'}) agrupados en ${groups.length} teléfonos.`);

    let totalEnviados = 0;
    let totalFallidos = 0;

    for (let i = 0; i < groups.length; i++) {
      const [telefono, data] = groups[i];
      // En modo prueba, NO enviamos token para no generar la segunda confirmación prematuramente
      const token = esPrueba ? null : ((data.tokens && data.tokens.length > 0) ? data.tokens[0] : null);
      const mensaje = buildReminderMessage(data.names, ALIAS, token, esPrueba);

      console.log(`\n📨 [${i + 1}/${groups.length}] Enviando recordatorio (${esPrueba ? 'PRUEBA' : 'OFICIAL'}) a ${telefono} (${data.names.join(', ')})...`);

      const resultado = await enviarMensaje(telefono, mensaje);

      if (resultado.success) {
        totalEnviados += data.ids.length;

        if (!esPrueba) {
          // Solo en el envío oficial del 6 de noviembre se marca como consumido en Neon
          await query(
            'UPDATE invitados SET recordatorio_enviado = true WHERE id = ANY($1::int[])',
            [data.ids]
          );
          console.log(`✅ [Cron Oficial] Entregado con éxito y registrado como NOTIFICADO en Neon para IDs: [${data.ids.join(', ')}]`);
        } else {
          console.log(`🧪 [Prueba Anticipada] Entregado con éxito a ${telefono}. Invitado preservado como pendiente para el 6 de noviembre.`);
        }

        // Registro de Auditoría en logs_envio
        try {
          const nombresAgrupados = data.names.join(', ');
          const auditMsg = esPrueba ? `[PRUEBA ANTICIPADA] ${mensaje}` : mensaje;
          await query(
            'INSERT INTO logs_envio (telefono, nombres_agrupados, mensaje_enviado, fecha_envio) VALUES ($1, $2, $3, NOW())',
            [telefono, nombresAgrupados, auditMsg]
          );
          console.log(`📋 [Auditoría] Registro de envío guardado en logs_envio para ${telefono}`);
        } catch (auditErr) {
          console.error(`⚠️ [Auditoría Warning] Error registrando en logs_envio: ${auditErr.message}`);
        }
      } else {
        totalFallidos += data.ids.length;
        console.error(`❌ [Cron Error] Falló el envío a ${telefono}: ${resultado.error}`);
      }

      // Cola secuencial Anti-Ban: pausa aleatoria entre 4 y 8 segundos entre envíos
      if (i < groups.length - 1) {
        const jitter = Math.floor(Math.random() * 4000) + 4000;
        console.log(`⏳ [Anti-Ban] Esperando ${(jitter / 1000).toFixed(1)} segundos antes del próximo envío...`);
        await sleep(jitter);
      }
    }

    console.log('\n========================================================');
    console.log(`🏁 [Cron Job Finalizado] Modo: ${esPrueba ? 'PRUEBA' : 'OFICIAL'} | Total invitados: ${invitados.length} | Familias: ${groups.length} | Enviados: ${totalEnviados} | Fallidos: ${totalFallidos}`);
    console.log('========================================================\n');

    return {
      totalInvitados: invitados.length,
      totalTelefonos: groups.length,
      enviados: totalEnviados,
      fallidos: totalFallidos,
      esPrueba
    };

  } catch (error) {
    console.error('❌ [Cron Error Fatal]:', error.message);
    throw error;
  }
}

/**
 * Mejora 19: Limpieza de Sesiones Huérfanas de Baileys en Neon PostgreSQL
 * Elimina registros antiguos donde updated_at sea mayor a 7 días, protegiendo la sesión activa
 */
async function limpiarSesionesHuerfanas() {
  try {
    console.log('🧹 [Limpieza Neon] Ejecutando depuración de sesiones huérfanas en whatsapp_session...');
    const res = await query(`
      DELETE FROM whatsapp_session 
      WHERE updated_at < NOW() - INTERVAL '7 days' 
        AND session_id != 'baileys_session'
    `);
    console.log(`🧹 [Limpieza Neon] Sesiones depuradas: ${res.rowCount} registros eliminados.`);
    return res.rowCount;
  } catch (err) {
    console.error('⚠️ [Limpieza Neon Warning] Error limpiando sesiones huérfanas:', err.message);
    return 0;
  }
}

/**
 * Inicializa el Cron Job programado exactamente para el 6 de Noviembre a las 12:00 PM
 * y la limpieza periódica de sesiones huérfanas a medianoche
 */
function initCron() {
  // Expresión cron: 0 12 6 11 * (Minuto 0, Hora 12, Día 6, Mes 11 - Noviembre)
  const cronExpression = '0 12 6 11 *';

  console.log(`📅 [Cron Scheduler] Programado para el 6 de Noviembre a las 12:00 PM (${TIMEZONE})`);

  cron.schedule(cronExpression, async () => {
    console.log('🔔 [Cron Trigger] ¡Se ha alcanzado la fecha programada (6 de Noviembre 12:00 PM)!');
    await ejecutarRecordatorios({ esPrueba: false });
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });

  // Limpieza periódica a medianoche (00:00 cada día)
  cron.schedule('0 0 * * *', async () => {
    await limpiarSesionesHuerfanas();
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });
}

module.exports = {
  initCron,
  ejecutarRecordatorios,
  limpiarSesionesHuerfanas,
  formatNames,
  buildReminderMessage
};
