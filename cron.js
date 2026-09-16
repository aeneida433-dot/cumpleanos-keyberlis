/**
 * Modulo de Recordatorios Programados (Cron Job)
 * Proyecto: Invitacion 15 Anos Keyberlis
 */

const cron = require('node-cron');
const { query } = require('./db');
const { enviarMensaje, isReady } = require('./whatsapp');
require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
const ALIAS = process.env.ALIAS_REGALO || 'key.2710';

// Utilidad para retardo (pausa de seguridad anti-spam)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ejecuta el envio masivo de recordatorios a todos los invitados registrados en Neon
 * @returns {Promise<{ total: number, enviados: number, fallidos: number }>}
 */
async function ejecutarRecordatorios() {
  console.log('\n========================================================');
  console.log('⏰ [Cron Job] INICIANDO ENVIO DE RECORDATORIOS (15 ANOS)');
  console.log('========================================================');

  if (!isReady()) {
    console.error('❌ [Cron Error] No se puede enviar: WhatsApp no esta conectado.');
    return { total: 0, enviados: 0, fallidos: 0, error: 'WhatsApp desconectado' };
  }

  try {
    const dbResult = await query('SELECT id, nombre, telefono, verificado FROM invitados ORDER BY id ASC');
    const invitados = dbResult.rows;

    console.log(`📋 [Cron] Se encontraron ${invitados.length} invitados registrados para notificar.`);

    let enviados = 0;
    let fallidos = 0;

    for (let i = 0; i < invitados.length; i++) {
      const inv = invitados[i];
      const mensaje = `¡Hola ${inv.nombre}! Te recordamos que mañana es la gran fiesta de 15 años. Por favor, confirma tu asistencia. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: [${ALIAS}]`;

      console.log(`\n📨 [${i + 1}/${invitados.length}] Enviando recordatorio a ${inv.nombre} (${inv.telefono})...`);
      
      const resultado = await enviarMensaje(inv.telefono, mensaje);

      if (resultado.success) {
        enviados++;
        console.log(`✅ Entregado a ${inv.nombre}`);
      } else {
        fallidos++;
        console.error(`❌ Fallo el envio a ${inv.nombre}: ${resultado.error}`);
      }

      // Pausa aleatoria controlada entre 4 y 6 segundos entre envios (Anti-Ban)
      if (i < invitados.length - 1) {
        const pausa = Math.floor(Math.random() * 2000) + 4000;
        console.log(`⏳ Esperando ${(pausa / 1000).toFixed(1)} segundos antes del proximo envio...`);
        await sleep(pausa);
      }
    }

    console.log('\n========================================================');
    console.log(`🏁 [Cron Job Finalizado] Total: ${invitados.length} | Enviados: ${enviados} | Fallidos: ${fallidos}`);
    console.log('========================================================\n');

    return { total: invitados.length, enviados, fallidos };

  } catch (error) {
    console.error('❌ [Cron Error Fatal]:', error.message);
    throw error;
  }
}

/**
 * Inicializa el Cron Job programado exactamente para el 6 de Noviembre a las 12:00 PM
 */
function initCron() {
  // Expresion cron: 0 12 6 11 * (Minuto 0, Hora 12, Dia 6, Mes 11 - Noviembre)
  const cronExpression = '0 12 6 11 *';

  console.log(`📅 [Cron Scheduler] Programado para el 6 de Noviembre a las 12:00 PM (${TIMEZONE})`);

  cron.schedule(cronExpression, async () => {
    console.log('🔔 [Cron Trigger] ¡Se ha alcanzado la fecha programada (6 de Noviembre 12:00 PM)!');
    await ejecutarRecordatorios();
  }, {
    scheduled: true,
    timezone: TIMEZONE
  });
}

module.exports = {
  initCron,
  ejecutarRecordatorios
};
