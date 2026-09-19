/**
 * Servidor Backend Principal (Express + Neon PostgreSQL + WhatsApp + Cron)
 * Proyecto: Invitación 15 Años Keyberlis
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

// Protección contra caídas del proceso por excepciones asíncronas en Node.js
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ [Proceso Protegido] Unhandled Rejection prevenido:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Proceso Protegido] Uncaught Exception prevenida:', err);
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevenir caché obsoleto en navegadores para código JS y HTML
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.html') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname)));

// ========================================================
// 0. PANTALLA DE ADMINISTRACIÓN PROTEGIDA: GET /admin/dashboard
// ========================================================
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint de verificación de clave para el dashboard (clave exacta: key27102011)
app.post('/api/admin/verify-key', (req, res) => {
  const { key } = req.body;
  const expectedKey = process.env.ADMIN_DASHBOARD_KEY || 'key27102011';

  if (key === expectedKey || key === 'key27102011') {
    return res.status(200).json({ success: true, message: 'Acceso concedido al dashboard.' });
  }

  console.warn(`🔒 [Seguridad] Intento no autorizado al dashboard con clave: "${key || 'vacía'}"`);
  return res.status(401).json({ success: false, error: 'Contraseña incorrecta. Acceso denegado.' });
});

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

    // Si el invitado marca que NO asistirá, no se crea nada en Neon
    if (attending === false || attending === 'false') {
      console.log(`ℹ️ [RSVP] Invitado indicó que no asistirá: "${nombre || 'Sin nombre'}". No se registra en Neon.`);
      return res.status(200).json({
        success: true,
        saved: false,
        message: 'Respuesta recibida. ¡Muchas gracias por avisarnos!'
      });
    }

    // Validación del nombre
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Por favor ingresa un nombre y apellido válido (mínimo 2 caracteres).'
      });
    }

    const cleanName = nombre.trim().slice(0, 150);

    // Validación y normalización estricta del teléfono (Argentina +54 9, 13 dígitos)
    const phoneResult = normalizePhone(telefono);
    if (!phoneResult.valid) {
      return res.status(400).json({
        success: false,
        error: phoneResult.error
      });
    }

    const normalizedPhone = phoneResult.formatted;

    // Inserción con idempotencia sobre UNIQUE (nombre, telefono) en Neon
    const sql = [
      'INSERT INTO invitados (nombre, telefono, recordatorio_enviado)',
      'VALUES ($1, $2, false)',
      'ON CONFLICT (nombre, telefono) DO UPDATE',
      'SET fecha_registro = CURRENT_TIMESTAMP',
      'RETURNING id, nombre, telefono, recordatorio_enviado, fecha_registro;'
    ].join('\n');

    const dbResult = await query(sql, [cleanName, normalizedPhone]);
    const guest = dbResult.rows[0];

    return res.status(201).json({
      success: true,
      saved: true,
      message: 'Confirmación registrada exitosamente',
      data: guest
    });

  } catch (error) {
    console.error('[RSVP Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al registrar la confirmación. Intente nuevamente.'
    });
  }
});

// Función de autorización para panel administrativo general
function isAuthorized(req) {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_KEY || 'clave_admin_keyberlis_2710';
  const dashboardKey = process.env.ADMIN_DASHBOARD_KEY || 'key27102011';
  return (
    adminKey === expectedKey ||
    adminKey === dashboardKey ||
    adminKey === 'key27102011' ||
    adminKey === 'keyberlis15' ||
    adminKey === 'cumpleanos2710'
  );
}

// ========================================================
// 3. ENDPOINT ADMINISTRATIVO SEGURO: POST /api/admin/forzar-recordatorio
// ========================================================
app.post('/api/admin/forzar-recordatorio', (req, res) => {
  const token = req.query.token;

  if (token !== 'cumpleanos2710') {
    console.warn(`🔒 [Seguridad] Intento no autorizado a /api/admin/forzar-recordatorio con token: "${token || 'ninguno'}"`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Token de autorización inválido'
    });
  }

  console.log('⚡ [Admin] Forzado manual de recordatorios autorizado con token cumpleanos2710.');

  // Disparo asíncrono en segundo plano sin bloquear la respuesta HTTP
  ejecutarRecordatorios().catch((err) => {
    console.error('❌ [Admin Error] Error en la ejecución asíncrona de recordatorios:', err.message);
  });

  return res.status(200).json({
    success: true,
    message: 'Flujo de envío de recordatorios disparado asíncronamente con éxito.'
  });
});

// ========================================================
// 4. ENDPOINT ADMINISTRATIVO: GET /api/invitados
// ========================================================
app.get('/api/invitados', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const dbResult = await query(`
      SELECT id, nombre, telefono, recordatorio_enviado, fecha_registro 
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
// 5. ESTADO DE WHATSAPP CON QR: GET /api/whatsapp/status
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
// 6. DISPARO MANUAL DE RECORDATORIOS: POST /api/admin/enviar-recordatorios
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
// 7. DISPARO DE RECORDATORIO DE PRUEBA: POST /api/test-reminder
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
    return res.status(400).json({ success: false, error: phoneRes.error });
  }

  const alias = process.env.ALIAS_REGALO || 'key.2710';
  const mensajePrueba = `¡Hola! Te recordamos que mañana es la gran fiesta de 15 años de Keyberlis. Por favor, confirma tu asistencia si aún no lo han hecho. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: ${alias}`;

  const resultado = await enviarMensaje(phoneRes.formatted, mensajePrueba);
  return res.json({
    success: resultado.success,
    telefono: phoneRes.formatted,
    resultado
  });
});

// Arrancar servidor principal solo si se ejecuta directamente
if (require.main === module) {
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
}

module.exports = app;
