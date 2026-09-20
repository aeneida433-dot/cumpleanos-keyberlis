/**
 * Módulo de Generación de Alertas de WhatsApp en Tiempo Real
 * Destinatario: Cumpleañera Keyberlis (5491161034151)
 * Reglas de Negocio: Formato Oficial Opción C
 */

/**
 * Genera el mensaje de alerta para el Registro Inicial (Check 1)
 * @param {string} guestName - Nombre y apellido del invitado confirmado
 * @param {number} totalCount - Total acumulado de confirmados que asisten
 * @returns {string} Mensaje formateado para WhatsApp
 */
function buildRSVPAlert(guestName, totalCount) {
  const cleanName = guestName ? guestName.trim() : 'Invitado';
  const count = typeof totalCount === 'number' ? totalCount : 0;
  return `🌸 ¡Nuevo Registro! *${cleanName}* asistirá a tu fiesta. 📊 Total confirmados actual: *${count}* invitados.`;
}

/**
 * Genera el mensaje de alerta para la Reconfirmación Formal (Check 2)
 * @param {string} guestName - Nombre y apellido del invitado reconfirmado
 * @param {number} totalCount - Total acumulado de confirmados que asisten
 * @returns {string} Mensaje formateado para WhatsApp
 */
function buildReconfirmationAlert(guestName, totalCount) {
  const cleanName = guestName ? guestName.trim() : 'Invitado';
  const count = typeof totalCount === 'number' ? totalCount : 0;
  return `🚀 ¡Reconfirmación Formal! *${cleanName}* validó su asistencia para mañana. 📊 Total confirmados actual: *${count}* invitados.`;
}

module.exports = {
  buildRSVPAlert,
  buildReconfirmationAlert
};
