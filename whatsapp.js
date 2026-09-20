/**
 * Módulo de Automatización de WhatsApp (Baileys)
 * Proyecto: Invitación 15 Años Keyberlis
 * Ultra-optimizado para Render Free Tier (<50MB RAM, sin Chromium)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const PGStore = require('./lib/pgStore');

const AUTH_DIR = path.resolve(__dirname, '.baileys_auth');
const pgStore = new PGStore({ dataPath: AUTH_DIR });

let ioInstance = null;
let sock = null;
let isClientReady = false;
let isClientAuthenticated = false;
let latestQR = null;
let latestQRDataURL = null;
let loadingPercent = 0;
let loadingMessage = '';
const recentLogs = [];

let saveDebounceTimer = null;

function debouncedSaveSession() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    try {
      await pgStore.saveFolder(AUTH_DIR, 'baileys_session');
    } catch (err) {
      logEvent('⚠️ [WhatsApp] Error al respaldar sesión diferida en Neon: ' + err.message);
    }
  }, 1000);
}

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

let isInitializing = false;

async function initWhatsApp() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    // 1. Restaurar sesión desde Neon si existe y no está en disco
    if (!fs.existsSync(AUTH_DIR) || fs.readdirSync(AUTH_DIR).length === 0) {
      if (await pgStore.sessionExists('baileys_session')) {
        logEvent('📥 [WhatsApp] Restaurando sesión de Baileys desde Neon PostgreSQL...');
        await pgStore.extractFolder(AUTH_DIR, 'baileys_session');
      }
    }

    await fs.promises.mkdir(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    logEvent('🤖 [WhatsApp] Inicializando socket liviano de Baileys (sin Chromium)...');

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQR = qr;
        try {
          latestQRDataURL = await qrcode.toDataURL(qr, { margin: 3, scale: 8 });
        } catch (err) {
          logEvent('Error al generar QR DataURL: ' + err.message);
        }

        logEvent('📲 [WhatsApp QR] Nuevo código QR de Baileys generado y listo para escanear.');
        if (ioInstance && latestQRDataURL) {
          ioInstance.emit('whatsapp-qr', {
            qrDataURL: latestQRDataURL,
            qr: qr
          });
        }
      }

      if (connection === 'close') {
        isClientReady = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        logEvent(`⚠️ [WhatsApp] Conexión cerrada (Código: ${statusCode || 'desconocido'}). Reconectando: ${shouldReconnect}`);

        if (shouldReconnect) {
          isInitializing = false;
          setTimeout(() => initWhatsApp(), 4000);
        } else {
          logEvent('🚪 [WhatsApp] Sesión cerrada por el usuario o desvinculada. Limpiando credenciales...');
          isClientAuthenticated = false;
          if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = null;
          }
          await pgStore.delete('baileys_session');
          try {
            await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
          } catch {}
          isInitializing = false;
          setTimeout(() => initWhatsApp(), 2000);
        }
      } else if (connection === 'open') {
        isClientReady = true;
        isClientAuthenticated = true;
        latestQR = null;
        latestQRDataURL = null;
        loadingPercent = 0;
        logEvent('✅ [WhatsApp] ¡Cliente Baileys conectado 100% y listo para enviar mensajes!');

        // Cancelar timer de debounce si hubiese uno pendiente y respaldar inmediatamente
        if (saveDebounceTimer) {
          clearTimeout(saveDebounceTimer);
          saveDebounceTimer = null;
        }
        await pgStore.saveFolder(AUTH_DIR, 'baileys_session');

        if (ioInstance) {
          ioInstance.emit('whatsapp-ready', { ready: true });
          ioInstance.emit('whatsapp-authenticated', {
            authenticated: true,
            message: 'Sesión vinculada exitosamente.'
          });
        }
      }
    });

    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err) {
        logEvent('⚠️ [WhatsApp] Error en saveCreds: ' + err.message);
      }
      debouncedSaveSession();
    });

  } catch (err) {
    logEvent('❌ [WhatsApp Error - initWhatsApp]: ' + err.message);
  } finally {
    isInitializing = false;
  }
}

async function enviarMensaje(telefono, mensaje) {
  if (!isClientReady || !sock) {
    logEvent(`❌ [WhatsApp Error] No se pudo enviar a ${telefono}: Cliente no conectado.`);
    return {
      success: false,
      error: 'WhatsApp no está conectado'
    };
  }

  try {
    const cleanPhone = telefono.replace(/\D/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text: mensaje });
    logEvent(`📤 [WhatsApp] Mensaje enviado a ${cleanPhone} (JID: ${jid})`);
    return {
      success: true,
      result
    };
  } catch (err) {
    logEvent(`❌ [WhatsApp Error - enviarMensaje]: ${err.message}`);
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
  return isClientAuthenticated || isClientReady;
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

async function refrescarQR() {
  if (isClientReady) {
    if (ioInstance) ioInstance.emit('whatsapp-ready', { ready: true });
    return;
  }

  logEvent('🔄 [WhatsApp] Solicitud de nuevo código QR recibida. Reiniciando Baileys...');
  try {
    if (sock) {
      try { sock.end(); } catch {}
      sock = null;
    }
  } catch (err) {
    logEvent('⚠️ [WhatsApp] Error al reiniciar socket: ' + err.message);
  }
  isInitializing = false;
  await initWhatsApp();
}

module.exports = {
  client: { pupPage: null }, // Mock para compatibilidad
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
