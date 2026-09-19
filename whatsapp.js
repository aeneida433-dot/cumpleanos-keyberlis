/**
 * Modulo de Cliente de WhatsApp (whatsapp-web.js)
 * Proyecto: Invitacion 15 Anos Keyberlis
 */

const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const PGStore = require('./lib/pgStore');

let isClientReady = false;
let latestQR = null;
let latestQRDataURL = null;
let loadingPercent = 0;
let loadingMessage = '';
const recentLogs = [];

function logEvent(msg) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${msg}`;
  recentLogs.push(entry);
  if (recentLogs.length > 50) recentLogs.shift();
  console.log(msg);
}

// Ubicar ejecutable de Chrome en cache local de Puppeteer si existe
function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const localCache = path.join(__dirname, '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(localCache)) {
    const versions = fs.readdirSync(localCache);
    for (const v of versions) {
      const p = path.join(localCache, v, 'chrome-linux64', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// Configuración de almacenamiento remoto en Neon PostgreSQL
const store = new PGStore({
  dataPath: path.join(__dirname, '.wwebjs_auth')
});

// Configuración optimizada de Puppeteer para Render y servidores Linux
const client = new Client({
  authStrategy: new RemoteAuth({
    store: store,
    dataPath: path.join(__dirname, '.wwebjs_auth'),
    backupSyncIntervalMs: 120000 // Respaldo a Neon cada 2 minutos
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047687307-alpha.html'
  },
  puppeteer: {
    headless: true,
    executablePath: getChromeExecutablePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu'
    ]
  }
});

// Evento: Generación de Código QR para vincular sesión
client.on('qr', async (qr) => {
  latestQR = qr;
  try {
    latestQRDataURL = await qrcode.toDataURL(qr, { margin: 3, scale: 8 });
  } catch (err) {
    logEvent('Error al generar QR DataURL: ' + err.message);
  }

  logEvent('📲 [WhatsApp QR] Nuevo código QR generado y listo para escanear.');
  qrcodeTerminal.generate(qr, { small: true });
});

// Evento: Autenticacion exitosa
client.on('authenticated', () => {
  logEvent('🔐 [WhatsApp] ¡Sesión autenticada correctamente!');
  latestQR = null;
  latestQRDataURL = null;
});

// Evento: Fallo de autenticacion
client.on('auth_failure', (msg) => {
  logEvent('❌ [WhatsApp] Fallo de autenticación: ' + JSON.stringify(msg));
  isClientReady = false;
  latestQRDataURL = null;
});

// Evento: Cliente listo para enviar mensajes
client.on('ready', () => {
  isClientReady = true;
  latestQR = null;
  latestQRDataURL = null;
  loadingPercent = 0;
  logEvent('✅ [WhatsApp] ¡Cliente listo y conectado 100% para enviar mensajes!');
});

// Evento: Cargando chats / sincronización
client.on('loading_screen', (percent, message) => {
  loadingPercent = percent;
  loadingMessage = message;
  logEvent(`⏳ [WhatsApp] Sincronizando chats: ${percent}% - ${message}`);
});

// Evento: Sesión remota respaldada en Neon
client.on('remote_session_saved', () => {
  logEvent('🎉 [WhatsApp] ¡Sesión remota respaldada exitosamente en Neon PostgreSQL!');
});

// Evento: Desconexion
client.on('disconnected', (reason) => {
  isClientReady = false;
  latestQRDataURL = null;
  loadingPercent = 0;
  logEvent('⚠️ [WhatsApp] Cliente desconectado. Motivo: ' + reason);
});

/**
 * Inicializa el cliente de WhatsApp
 */
function initWhatsApp() {
  console.log('🤖 [WhatsApp] Iniciando cliente de automatizacion con RemoteAuth en Neon...');
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

function getLatestQRDataURL() {
  return latestQRDataURL;
}

function getLoadingState() {
  if (isClientReady || latestQR) return null;
  if (loadingPercent > 0) {
    return { percent: loadingPercent, message: loadingMessage };
  }
  return null;
}

function getRecentLogs() {
  return recentLogs;
}

module.exports = {
  client,
  initWhatsApp,
  enviarMensaje,
  isReady,
  getLatestQR,
  getLatestQRDataURL,
  getLoadingState,
  getRecentLogs
};
