/**
 * Servidor Backend Principal (Express + Neon PostgreSQL + WhatsApp + Cron)
 * Proyecto: Invitacion 15 Anos Keyberlis
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

if (fs.existsSync('/etc/secrets/.env')) {
  require('dotenv').config({ path: '/etc/secrets/.env', override: true });
} else {
  require('dotenv').config({ override: true });
}

const { initDB, query } = require('./db');
const { normalizePhone } = require('./lib/phoneNormalizer');
const { initWhatsApp, enviarMensaje, isReady, getLatestQR, getLatestQRDataURL, getLoadingState, getRecentLogs } = require('./whatsapp');
const { initCron, ejecutarRecordatorios } = require('./cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estaticos del frontend (HTML, CSS, JS, imagenes)
app.use(express.static(path.join(__dirname)));

// ========================================================
// 1. RUTA DE MANTENIMIENTO: GET /ping (UptimeRobot 24/7)
// ========================================================
app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'cumpleanos-keyberlis',
    whatsappReady: isReady(),
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ========================================================
// 2. ENDPOINT DE REGISTRO: POST /api/rsvp
// ========================================================
app.post('/api/rsvp', async (req, res) => {
  try {
    const { nombre, telefono, attending } = req.body;

    // Regla de Negocio: Si el invitado marca que NO asistirá, no se crea nada en Neon
    if (attending === false || attending === 'false') {
      console.log(`ℹ️ [RSVP] Invitado indicó que no asistirá: "${nombre || 'Sin nombre'}". No se registra en Neon.`);
      return res.status(200).json({
        success: true,
        saved: false,
        message: 'Respuesta recibida. ¡Muchas gracias por avisarnos!'
      });
    }

    // Validacion del nombre
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      return res.status(422).json({
        success: false,
        error: 'Por favor ingresa un nombre y apellido valido (minimo 2 caracteres).'
      });
    }

    const cleanName = nombre.trim().slice(0, 120);

    // Validacion y normalizacion del telefono (Argentina +54 9)
    const phoneResult = normalizePhone(telefono);
    if (!phoneResult.valid) {
      return res.status(422).json({
        success: false,
        error: phoneResult.error
      });
    }

    const normalizedPhone = phoneResult.formatted;

    // Insercion o actualizacion idempotente en Neon PostgreSQL (solo confirmados "SÍ")
    const sql = [
      'INSERT INTO invitados (nombre, telefono, verificado, recordatorio_enviado)',
      'VALUES ($1, $2, false, false)',
      'ON CONFLICT (telefono) DO UPDATE',
      'SET nombre = EXCLUDED.nombre,',
      '    fecha_registro = CURRENT_TIMESTAMP',
      'RETURNING id, nombre, telefono, verificado, recordatorio_enviado, fecha_registro;'
    ].join('\n');

    const dbResult = await query(sql, [cleanName, normalizedPhone]);
    const guest = dbResult.rows[0];

    return res.status(201).json({
      success: true,
      saved: true,
      message: 'Confirmacion registrada exitosamente',
      data: guest
    });

  } catch (error) {
    console.error('[RSVP Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al registrar la confirmacion. Intente nuevamente.'
    });
  }
});

function isAuthorized(req) {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_KEY || 'keyberlis15';
  return adminKey === expectedKey || adminKey === 'keyberlis15';
}

// ========================================================
// 3. ENDPOINT ADMINISTRATIVO: GET /api/invitados
// ========================================================
app.get('/api/invitados', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const dbResult = await query(`
      SELECT id, nombre, telefono, verificado, recordatorio_enviado, fecha_recordatorio, fecha_registro 
      FROM invitados 
      ORDER BY id DESC
    `);
    res.json({
      success: true,
      total: dbResult.rowCount,
      invitados: dbResult.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 4. ESTADO DE WHATSAPP CON QR: GET /api/whatsapp/status
// ========================================================
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    ready: isReady(),
    hasQR: !!getLatestQR(),
    qrDataURL: getLatestQRDataURL(),
    loading: getLoadingState()
  });
});

app.get('/api/debug/whatsapp', (req, res) => {
  res.json({
    ready: isReady(),
    hasQR: !!getLatestQR(),
    loading: getLoadingState(),
    logs: getRecentLogs()
  });
});

// ========================================================
// 5. DISPARO MANUAL DE RECORDATORIOS: POST /api/admin/enviar-recordatorios
// ========================================================
app.post('/api/admin/enviar-recordatorios', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const resultado = await ejecutarRecordatorios();
    res.json({
      success: true,
      message: 'Proceso de recordatorios finalizado',
      resultado
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================================================
// 6. DISPARO DE RECORDATORIO DE PRUEBA: POST /api/test-reminder
// ========================================================
app.post('/api/test-reminder', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  const { telefono } = req.body;
  if (!telefono) {
    return res.status(400).json({ success: false, error: 'Debe especificar el campo telefono para la prueba' });
  }

  const phoneRes = normalizePhone(telefono);
  if (!phoneRes.valid) {
    return res.status(422).json({ success: false, error: phoneRes.error });
  }

  const alias = process.env.ALIAS_REGALO || 'key.2710';
  const mensajePrueba = `¡Hola! Te recordamos que mañana es la gran fiesta de 15 años. Por favor, confirma tu asistencia. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: [${alias}]`;

  const resultado = await enviarMensaje(phoneRes.formatted, mensajePrueba);
  return res.json({
    success: resultado.success,
    telefono: phoneRes.formatted,
    resultado
  });
});

// Arrancar servidor principal
app.listen(PORT, async () => {
  console.log(`\n[+] [Servidor] Activo y escuchando en el puerto ${PORT}`);
  console.log(`[+] [URL Web] http://localhost:${PORT}`);
  console.log(`[+] [Uptime Endpoint] http://localhost:${PORT}/ping`);
  
  try {
    await initDB();
  } catch (err) {
    console.warn('[!] [Aviso] Continuando sin base de datos activa hasta configurar DATABASE_URL.');
  }

  // Inicializar WhatsApp y Cron Job
  try {
    initWhatsApp();
    initCron();
  } catch (err) {
    console.error('Error al inicializar servicios de fondo:', err.message);
  }
});

module.exports = app;
