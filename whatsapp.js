/**
 * Modulo de Cliente de WhatsApp (whatsapp-web.js)
 * Proyecto: Invitacion 15 Anos Keyberlis
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let isClientReady = false;
let latestQR = null;

// Configuracion optimizada de Puppeteer para Render y servidores Linux
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--single-process'
    ]
  }
});

// Evento: Generacion de Codigo QR para vincular sesion
client.on('qr', (qr) => {
  latestQR = qr;
  console.log('\n========================================================');
  console.log('📲 ESCANEA ESTE CODIGO QR CON TU WHATSAPP PARA VINCULAR:');
  console.log('========================================================\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👉 Abre WhatsApp en tu celular > Dispositivos vinculados > Vincular un dispositivo.\n');
});

// Evento: Autenticacion exitosa
client.on('authenticated', () => {
  console.log('🔐 [WhatsApp] Sesion autenticada correctamente.');
  latestQR = null;
});

// Evento: Fallo de autenticacion
client.on('auth_failure', (msg) => {
  console.error('❌ [WhatsApp] Fallo de autenticacion:', msg);
  isClientReady = false;
});

// Evento: Cliente listo para enviar mensajes
client.on('ready', () => {
  isClientReady = true;
  latestQR = null;
  console.log('✅ [WhatsApp] ¡Cliente listo y conectado 100% para enviar mensajes!');
});

// Evento: Desconexion
client.on('disconnected', (reason) => {
  isClientReady = false;
  console.warn('⚠️ [WhatsApp] Cliente desconectado. Motivo:', reason);
});

/**
 * Inicializa el cliente de WhatsApp
 */
function initWhatsApp() {
  console.log('🤖 [WhatsApp] Iniciando cliente de automatizacion...');
  client.initialize().catch((err) => {
    console.error('❌ [WhatsApp Error]:', err.message);
  });
}

/**
 * Envia un mensaje a un numero telefonico normalizado (E.164)
 * @param {string} phone - Numero normalizado (ej: 54911xxxxxxxx)
 * @param {string} message - Texto del mensaje
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function enviarMensaje(phone, message) {
  if (!isClientReady) {
    return {
      success: false,
      error: 'El cliente de WhatsApp no esta conectado aun. Escanee el codigo QR.'
    };
  }

  try {
    const chatId = phone + '@c.us';
    const resp = await client.sendMessage(chatId, message);
    return {
      success: true,
      messageId: resp.id._serialized
    };
  } catch (err) {
    console.error('[WhatsApp Send Error]:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

function isReady() {
  return isClientReady;
}

function getLatestQR() {
  return latestQR;
}

module.exports = {
  client,
  initWhatsApp,
  enviarMensaje,
  isReady,
  getLatestQR
};
