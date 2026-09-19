/**
 * Módulo de Cliente de WhatsApp (whatsapp-web.js)
 * Optimizado estrictamente para Render Free Tier (<512MB RAM) y Neon PostgreSQL
 * Proyecto: Invitación 15 Años Keyberlis
 */

const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const PGStore = require('./lib/pgStore');

let ioInstance = null;
let isClientReady = false;
let isClientAuthenticated = false;
let latestQR = null;
let latestQRDataURL = null;
let loadingPercent = 0;
let loadingMessage = '';
const recentLogs = [];

function setSocketIO(io) {
  ioInstance = io;
}

function logEvent(msg) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${msg}`;
  recentLogs.push(entry);
  if (recentLogs.length > 50) recentLogs.shift();
  console.log(msg);
}

// Ubicar ejecutable de Chrome en cache local de Puppeteer si existe (Render / Linux)
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

// Configuración de almacenamiento remoto de sesión en Neon PostgreSQL
const store = new PGStore({
  dataPath: path.join(__dirname, '.wwebjs_auth')
});

// Configuración optimizada de Puppeteer para Render (<512MB RAM)
const client = new Client({
  authStrategy: new RemoteAuth({
    store: store,
    dataPath: path.join(__dirname, '.wwebjs_auth'),
    backupSyncIntervalMs: 120000 // Respaldo a Neon cada 2 minutos
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1047947458-alpha.html'
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
      '--disable-gpu',
      '--disable-extensions',
      '--disable-default-apps',
      '--js-flags=--max-old-space-size=256',
      '--disable-blink-features=AutomationControlled'
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

  logEvent('📲 [WhatsApp QR] Nuevo código QR generado y listo para escanear en el panel web.');

  // Emitir de inmediato por Socket.IO al panel web
  if (ioInstance && latestQRDataURL) {
    ioInstance.emit('whatsapp-qr', {
      qrDataURL: latestQRDataURL,
      qr: qr
    });
  }
});

// Evento: Autenticación exitosa
client.on('authenticated', () => {
  isClientAuthenticated = true;
  logEvent('🔐 [WhatsApp] ¡Sesión autenticada correctamente!');
  latestQR = null;
  latestQRDataURL = null;

  if (ioInstance) {
    ioInstance.emit('whatsapp-authenticated', {
      authenticated: true,
      message: 'Sesión iniciada en el celular. Conectando...'
    });
  }
});

// Evento: Fallo de autenticación
client.on('auth_failure', (msg) => {
  logEvent('❌ [WhatsApp] Fallo de autenticación: ' + JSON.stringify(msg));
  isClientReady = false;
  isClientAuthenticated = false;
  latestQRDataURL = null;

  if (ioInstance) {
    ioInstance.emit('whatsapp-auth-failure', {
      message: 'Fallo de autenticación. Por favor genera un nuevo código QR.'
    });
  }
});

// Evento: Cliente listo para enviar mensajes
client.on('ready', () => {
  isClientReady = true;
  latestQR = null;
  latestQRDataURL = null;
  loadingPercent = 0;
  logEvent('✅ [WhatsApp] ¡Cliente listo y conectado 100% para enviar mensajes!');

  // Emitir evento 'whatsapp-ready' por Socket.IO al panel web
  if (ioInstance) {
    ioInstance.emit('whatsapp-ready', { ready: true });
  }
});

// Evento: Cargando chats / sincronización progresiva
client.on('loading_screen', (percent, message) => {
  loadingPercent = percent;
  loadingMessage = message;
  logEvent(`⏳ [WhatsApp] Sincronizando chats: ${percent}% - ${message}`);

  if (ioInstance) {
    ioInstance.emit('whatsapp-loading', { percent, message });
  }
});

// Evento: Sesión remota respaldada en Neon PostgreSQL
client.on('remote_session_saved', () => {
  logEvent('🎉 [WhatsApp] ¡Sesión remota respaldada exitosamente en Neon PostgreSQL!');
});

// Evento: Desconexión
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
  console.log('🤖 [WhatsApp] Iniciando cliente de automatización con RemoteAuth en Neon...');
  client.initialize().catch((err) => {
    console.error('❌ [WhatsApp Error]:', err.message);
  });
}

/**
 * Envía un mensaje a un número telefónico normalizado (E.164 Argentina)
 * @param {string} phone - Número normalizado (ej: 54911xxxxxxxx)
 * @param {string} message - Texto del mensaje
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function enviarMensaje(phone, message) {
  if (!isClientReady) {
    return {
      success: false,
      error: 'El cliente de WhatsApp no está conectado aún. Escanee el código QR.'
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

function isAuthenticated() {
  return isClientAuthenticated;
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

/**
 * Fuerza al cliente a refrescar el código QR o reiniciar el flujo de autenticación
 */
async function refrescarQR() {
  if (isClientReady) {
    if (ioInstance) ioInstance.emit('whatsapp-ready', { ready: true });
    return;
  }

  logEvent('🔄 [WhatsApp] Solicitud de nuevo código QR recibida. Reiniciando flujo de autenticación...');
  
  try {
    if (client.pupPage && !client.pupPage.isClosed()) {
      await client.pupPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    } else {
      await client.initialize().catch(() => {});
    }
  } catch (err) {
    logEvent('⚠️ [WhatsApp] Error al refrescar sesión de WhatsApp: ' + err.message);
  }
}

module.exports = {
  client,
  initWhatsApp,
  enviarMensaje,
  isReady,
  isAuthenticated,
  getLatestQR,
  getLatestQRDataURL,
  getLoadingState,
  getRecentLogs,
  setSocketIO,
  refrescarQR
};
