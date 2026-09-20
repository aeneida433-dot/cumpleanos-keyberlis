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
 */
function buildReminderMessage(names, alias = ALIAS) {
  const nombresFormatted = formatNames(names);
  if (names && names.length > 1) {
    return `¡Hola ${nombresFormatted}! Les recordamos que mañana es la gran fiesta de 15 años de Keyberlis. Por favor, confirmen su asistencia si aún no lo han hecho. Si desean realizar un presente, pueden hacerlo en efectivo a nuestro alias: ${alias}`;
  }
  return `¡Hola ${nombresFormatted}! Te recordamos que mañana es la gran fiesta de 15 años de Keyberlis. Por favor, confirma tu asistencia si aún no lo has hecho. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: ${alias}`;
}

/**
 * Ejecuta el envío masivo de recordatorios agrupados por teléfono con protección Anti-Ban
 * @returns {Promise<{ totalInvitados: number, totalTelefonos: number, enviados: number, fallidos: number }>}
 */
async function ejecutarRecordatorios() {
  console.log('\n========================================================');
  console.log('⏰ [Cron Job] INICIANDO ENVÍO DE RECORDATORIOS (15 AÑOS KEYBERLIS)');
  console.log('========================================================');

  if (!isReady()) {
    console.error('❌ [Cron Error] No se puede enviar: WhatsApp no está conectado.');
    return {
      totalInvitados: 0,
      totalTelefonos: 0,
      enviados: 0,
      fallidos: 0,
      error: 'WhatsApp no está conectado'
    };
  }

  try {
    const dbResult = await query(
      'SELECT id, nombre, telefono FROM invitados WHERE recordatorio_enviado = false ORDER BY id ASC'
    );
    const invitados = dbResult.rows;

    if (invitados.length === 0) {
      console.log('ℹ️ [Cron] No hay invitados pendientes de recordatorio en Neon.');
      return { totalInvitados: 0, totalTelefonos: 0, enviados: 0, fallidos: 0 };
    }

    // Regla de Agrupación Familiar: Agrupar invitados por número de teléfono
    const phoneGroups = new Map();
    for (const inv of invitados) {
      if (!phoneGroups.has(inv.telefono)) {
        phoneGroups.set(inv.telefono, {
          ids: [],
          names: []
        });
      }
      const group = phoneGroups.get(inv.telefono);
      group.ids.push(inv.id);
      group.names.push(inv.nombre);
    }

    const groups = Array.from(phoneGroups.entries());
    console.log(`📋 [Cron] Se encontraron ${invitados.length} invitados pendientes agrupados en ${groups.length} teléfonos.`);

    let totalEnviados = 0;
    let totalFallidos = 0;

    for (let i = 0; i < groups.length; i++) {
      const [telefono, data] = groups[i];
      const mensaje = buildReminderMessage(data.names, ALIAS);

      console.log(`\n📨 [${i + 1}/${groups.length}] Enviando recordatorio consolidado a ${telefono} (${data.names.join(', ')})...`);

      const resultado = await enviarMensaje(telefono, mensaje);

      if (resultado.success) {
        totalEnviados += data.ids.length;
        // Persistencia inmediata: marcar a todos los integrantes como recordatorio_enviado = true
        await query(
          'UPDATE invitados SET recordatorio_enviado = true WHERE id = ANY($1::int[])',
          [data.ids]
        );
        console.log(`✅ [Cron] Entregado con éxito y registrado en Neon para IDs: [${data.ids.join(', ')}]`);

        // Mejora 16: Tabla de Auditoría de Envíos en Neon
        try {
          const nombresAgrupados = data.names.join(', ');
          await query(
            'INSERT INTO logs_envio (telefono, nombres_agrupados, mensaje_enviado, fecha_envio) VALUES ($1, $2, $3, NOW())',
            [telefono, nombresAgrupados, mensaje]
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
        const jitter = Math.floor(Math.random() * 4000) + 4000; // 4000ms a 8000ms
        console.log(`⏳ [Anti-Ban] Esperando ${(jitter / 1000).toFixed(1)} segundos antes del próximo envío...`);
        await sleep(jitter);
      }
    }

    console.log('\n========================================================');
    console.log(`🏁 [Cron Job Finalizado] Total invitados: ${invitados.length} | Familias/Teléfonos: ${groups.length} | Enviados: ${totalEnviados} | Fallidos: ${totalFallidos}`);
    console.log('========================================================\n');

    return {
      totalInvitados: invitados.length,
      totalTelefonos: groups.length,
      enviados: totalEnviados,
      fallidos: totalFallidos
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
    await ejecutarRecordatorios();
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
