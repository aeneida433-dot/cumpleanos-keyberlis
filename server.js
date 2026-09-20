/**
 * Servidor Backend Principal (Express + Neon PostgreSQL + WhatsApp + Cron)
 * Proyecto: Invitación 15 Años Keyberlis
 */

process.env.PGSSLMODE = 'verify-full';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const compression = require('compression');

// Comparación segura en tiempo constante para mitigar timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Mejora 3: Hash criptográfico SHA-256 de la contraseña maestra del dashboard
// La contraseña en texto plano NUNCA se almacena en el código fuente ni en memoria
const ADMIN_DASHBOARD_KEY_HASH = process.env.ADMIN_DASHBOARD_KEY_HASH || 'fd1b62709e2d2b1dcd9ccdc31577cf30b2e5396674121041e5ba4ac523e081b7';

function verifyAdminPassword(candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string') return false;
  const candidateHash = crypto.createHash('sha256').update(candidatePassword.trim()).digest('hex');
  const bufCandidate = Buffer.from(candidateHash);
  const bufExpected = Buffer.from(ADMIN_DASHBOARD_KEY_HASH);
  if (bufCandidate.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufCandidate, bufExpected);
}

// Mejora 5: Secreto criptográfico para firma y verificación de JWT (15 min)
const JWT_SECRET = process.env.JWT_SECRET || 'keyberlis_secret_jwt_27102011_f92a';

// Mejora 4: Sanitización estricta anti-XSS de inputs de usuario
function sanitizeInput(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[<>&"']/g, (c) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]))
    .trim();
}

const isTestMode = process.env.NODE_ENV === 'test';
if (fs.existsSync('/etc/secrets/.env')) {
  require('dotenv').config({ path: '/etc/secrets/.env', override: true });
} else {
  require('dotenv').config({ override: !isTestMode });
}
if (isTestMode) {
  process.env.NODE_ENV = 'test';
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=verify-full');
} else if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=')) {
  process.env.DATABASE_URL += (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'sslmode=verify-full';
}

const { initDB, query } = require('./db');
const { normalizePhone } = require('./lib/phoneNormalizer');
const { initWhatsApp, enviarMensaje, isReady, isAuthenticated, getLatestQR, getLatestQRDataURL, getLoadingState, getRecentLogs, setSocketIO, refrescarQR } = require('./whatsapp');
const { initCron, ejecutarRecordatorios, buildReminderMessage } = require('./cron');
const { buildRSVPAlert, buildReconfirmationAlert } = require('./lib/alerts');

const BIRTHDAY_GIRL_PHONE = process.env.BIRTHDAY_GIRL_PHONE || '5491161034151';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Conectar Socket.IO con el módulo de WhatsApp
setSocketIO(io);

io.on('connection', (socket) => {
  if (isReady()) {
    socket.emit('whatsapp-ready', { ready: true });
  } else if (typeof isAuthenticated === 'function' && isAuthenticated()) {
    socket.emit('whatsapp-authenticated', { authenticated: true, message: 'Sesión iniciada en el celular. Conectando...' });
  } else if (getLatestQRDataURL()) {
    socket.emit('whatsapp-qr', { qrDataURL: getLatestQRDataURL() });
  }

  const loading = getLoadingState();
  if (loading) {
    socket.emit('whatsapp-loading', loading);
  }

  // Solicitud para forzar y refrescar el código QR desde el panel web
  socket.on('solicitar-nuevo-qr', async () => {
    console.log('⚡ [Socket] Solicitud de nuevo código QR recibida de cliente:', socket.id);
    if (typeof refrescarQR === 'function') {
      await refrescarQR();
    }
  });
});

const PORT = process.env.PORT || 3000;

// Protección contra caídas del proceso por excepciones asíncronas en Node.js
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ [Proceso Protegido] Unhandled Rejection prevenido:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Proceso Protegido] Uncaught Exception prevenida:', err);
});

// Middlewares
// 1. Compresión HTTP Gzip/Deflate para reducir en más de un 50% la transferencia de frontend
app.use(compression({
  threshold: 1024
}));

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Mejora 1: Rate Limiting estricto con express-rate-limit sobre POST /api/rsvp (máx 3 por minuto por IP)
const rsvpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // Máximo 3 confirmaciones por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
  handler: (req, res) => {
    console.warn(`⚠️ [Rate Limit] Bloqueada solicitud repetida a /api/rsvp desde IP: ${req.ip || 'desconocida'}`);
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests: Has excedido el límite de 3 confirmaciones por minuto. Por favor espera un momento.'
    });
  }
});

// Prevenir caché obsoleto en navegadores para código JS y HTML
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.html') || req.url === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Redirección de protección: evitar acceso directo sin bloqueo a admin.html
app.get('/admin.html', (req, res) => {
  res.redirect('/admin/dashboard');
});

// Servir ÚNICAMENTE los directorios públicos del frontend (CSS, JS cliente, Assets)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Servir la página principal en la raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Bloqueo explícito de seguridad para cualquier intento de acceso a archivos sensibles o de backend
app.use((req, res, next) => {
  const sensitivePatterns = [
    /^\/\.baileys_auth/i,
    /^\/\.wwebjs/i,
    /^\/\.env/i,
    /^\/lib\//i,
    /^\/tests\//i,
    /^\/docs\//i,
    /^\/scratch\//i,
    /\.sql$/i,
    /\.json$/i,
    /\.md$/i,
    /\.lock$/i,
    /^\/[^/]+\.js$/i // Cualquier script JS en la raíz (server.js, db.js, whatsapp.js, cron.js)
  ];

  if (sensitivePatterns.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  next();
});

// ========================================================
// 0. PANTALLA DE ADMINISTRACIÓN PROTEGIDA: GET /admin/dashboard
// ========================================================
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint de verificación de clave para el dashboard (Mejora 3: Hasheo SHA-256 / Mejora 5: JWT)
app.post('/api/admin/verify-key', (req, res) => {
  const { key } = req.body;

  if (verifyAdminPassword(key)) {
    const token = jwt.sign(
      { role: 'admin', authorizedAt: Date.now() },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.status(200).json({
      success: true,
      message: 'Acceso concedido al dashboard.',
      token: token
    });
  }

  console.warn(`🔒 [Seguridad] Intento no autorizado al dashboard con clave no válida`);
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
// 2. ENDPOINT DE REGISTRO: POST /api/rsvp (Mejora 1: Rate Limiter / Mejora 4: Anti-XSS)
// ========================================================
app.post('/api/rsvp', rsvpRateLimiter, async (req, res) => {
  try {
    const { nombre, telefono, attending, b_website } = req.body;

    // Protección Honeypot: Si un bot llenó el campo trampa, responder éxito simulado y descartar
    if (b_website && typeof b_website === 'string' && b_website.trim() !== '') {
      console.warn(`🤖 [Honeypot Triggered] Solicitud de bot detectada y neutralizada desde IP: ${req.ip || 'desconocida'}`);
      return res.status(200).json({
        success: true,
        saved: true,
        message: 'Confirmación registrada exitosamente'
      });
    }

    // Si el invitado marca que NO asistirá, se guarda de forma silenciosa en Neon (sin enviar alerta por WhatsApp)
    if (attending === false || attending === 'false') {
      console.log(`ℹ️ [RSVP] Invitado indicó que no asistirá: "${nombre || 'Sin nombre'}".`);
      if (nombre && typeof nombre === 'string' && nombre.trim().length >= 2 && telefono) {
        const phoneResult = normalizePhone(telefono);
        if (phoneResult.valid) {
          const cleanName = sanitizeInput(nombre).slice(0, 100);
          const silentSql = `
            INSERT INTO invitados (nombre, telefono, asiste, recordatorio_enviado)
            VALUES ($1, $2, false, false)
            ON CONFLICT (nombre, telefono) DO UPDATE
            SET asiste = false, fecha_registro = CURRENT_TIMESTAMP
            RETURNING id, nombre, telefono, asiste, fecha_registro;
          `;
          try {
            await query(silentSql, [cleanName, phoneResult.formatted]);
            console.log(`💾 [RSVP] Guardado silencioso de no asistencia en Neon: "${cleanName}" (${phoneResult.formatted})`);
          } catch (dbErr) {
            console.warn(`⚠️ [RSVP DB]: Error al registrar no asistencia:`, dbErr.message);
          }
        }
      }
      return res.status(200).json({
        success: true,
        saved: true,
        attending: false,
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

    // Mejora 4: Sanitización estricta anti-XSS de inputs (nombre y apellido)
    const cleanName = sanitizeInput(nombre).slice(0, 100);

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
      'INSERT INTO invitados (nombre, telefono, asiste, recordatorio_enviado)',
      'VALUES ($1, $2, true, false)',
      'ON CONFLICT (nombre, telefono) DO UPDATE',
      'SET asiste = true, fecha_registro = CURRENT_TIMESTAMP',
      'RETURNING id, nombre, telefono, asiste, recordatorio_enviado, reconfirmado, fecha_reconfirmacion, token_reconfirmacion, fecha_registro;'
    ].join('\n');

    const dbResult = await query(sql, [cleanName, normalizedPhone]);
    const guest = dbResult.rows[0];

    // Consultar el conteo total acumulado de invitados confirmados que asisten
    let totalConfirmados = 1;
    try {
      const countRes = await query('SELECT COUNT(*)::int as total FROM invitados WHERE asiste IS NOT FALSE;');
      totalConfirmados = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 1;
    } catch (countErr) {
      console.warn('⚠️ [RSVP] Error al consultar total confirmados:', countErr.message);
    }

    // Despachar alerta automática en tiempo real a la cumpleañera (Opción C) en segundo plano
    const rsvpAlertMsg = buildRSVPAlert(cleanName, totalConfirmados);
    enviarMensaje(BIRTHDAY_GIRL_PHONE, rsvpAlertMsg).catch((waErr) => {
      console.warn(`⚠️ [WhatsApp Alerta RSVP] No se pudo enviar alerta a ${BIRTHDAY_GIRL_PHONE}:`, waErr.message);
    });

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

// ========================================================
// 2.1 PÁGINA Y ENDPOINTS DE RECONFIRMACIÓN (DOBLE CHECK)
// ========================================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vista web del Pase de Acceso Definitivo
app.get('/reconfirmar', (req, res) => {
  res.sendFile(path.join(__dirname, 'reconfirmar.html'));
});

// Validar y ejecutar el Doble Check de Asistencia
app.post('/api/reconfirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || !UUID_REGEX.test(token)) {
      return res.status(400).json({
        success: false,
        error: 'El formato del enlace de reconfirmación no es válido.'
      });
    }

    const checkSql = `
      SELECT id, nombre, telefono, recordatorio_enviado, reconfirmado, fecha_reconfirmacion, fecha_registro
      FROM invitados
      WHERE token_reconfirmacion = $1
    `;
    const checkResult = await query(checkSql, [token]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitación no encontrada o enlace no válido.'
      });
    }

    const guest = checkResult.rows[0];

    // Si aún no estaba reconfirmado, marcar en Neon y registrar timestamp
    if (!guest.reconfirmado) {
      const updateSql = `
        UPDATE invitados
        SET reconfirmado = TRUE, fecha_reconfirmacion = CURRENT_TIMESTAMP
        WHERE token_reconfirmacion = $1
        RETURNING id, nombre, telefono, recordatorio_enviado, reconfirmado, fecha_reconfirmacion, fecha_registro
      `;
      const updateResult = await query(updateSql, [token]);
      const updatedGuest = updateResult.rows[0];

      console.log(`🎉 [Doble Check] Invitado reconfirmado con éxito: "${updatedGuest.nombre}" (${updatedGuest.telefono})`);

      // Consultar conteo total acumulado de confirmados
      let totalConfirmados = 1;
      try {
        const countRes = await query('SELECT COUNT(*)::int as total FROM invitados WHERE asiste IS NOT FALSE;');
        totalConfirmados = (countRes.rows[0] && countRes.rows[0].total) ? countRes.rows[0].total : 1;
      } catch (countErr) {
        console.warn('⚠️ [Reconfirmación] Error al consultar total confirmados:', countErr.message);
      }

      // Despachar alerta de reconfirmación formal a la cumpleañera (Opción C) en segundo plano
      const reconfirmAlertMsg = buildReconfirmationAlert(updatedGuest.nombre, totalConfirmados);
      enviarMensaje(BIRTHDAY_GIRL_PHONE, reconfirmAlertMsg).catch((waErr) => {
        console.warn(`⚠️ [WhatsApp Alerta Reconfirmación] No se pudo enviar alerta a ${BIRTHDAY_GIRL_PHONE}:`, waErr.message);
      });

      if (io) {
        io.emit('invitado-reconfirmado', {
          id: updatedGuest.id,
          nombre: updatedGuest.nombre,
          telefono: updatedGuest.telefono,
          fecha: updatedGuest.fecha_reconfirmacion
        });
      }

      return res.status(200).json({
        success: true,
        reconfirmedNow: true,
        message: '¡Asistencia reconfirmada con éxito! Tu Pase Definitivo está listo.',
        data: updatedGuest
      });
    }

    return res.status(200).json({
      success: true,
      reconfirmedNow: false,
      message: 'Tu asistencia ya se encontraba formalmente reconfirmada.',
      data: guest
    });

  } catch (error) {
    console.error('[Reconfirmar Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la reconfirmación.'
    });
  }
});

// Consulta de estado de reconfirmación (lectura)
app.get('/api/reconfirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || !UUID_REGEX.test(token)) {
      return res.status(400).json({ success: false, error: 'Token inválido' });
    }

    const checkResult = await query(
      'SELECT id, nombre, telefono, recordatorio_enviado, reconfirmado, fecha_reconfirmacion FROM invitados WHERE token_reconfirmacion = $1',
      [token]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invitado no encontrado' });
    }

    return res.status(200).json({ success: true, data: checkResult.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Middleware de autenticación para panel administrativo (Mejora 5: Sesiones JWT / Hash SHA-256)
function authenticateAdmin(req, res, next) {
  // 1. Verificación preferente por JWT en cabecera Authorization
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.adminUser = decoded;
      return next();
    } catch (jwtErr) {
      console.warn(`🔒 [JWT] Token inválido o expirado: ${jwtErr.message}`);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Token de sesión JWT inválido o expirado'
      });
    }
  }

  // 2. Compatibilidad con clave administrativa directa hasheada
  const legacyKey = req.headers['x-admin-key'] || req.query.key;
  if (legacyKey && typeof legacyKey === 'string' && verifyAdminPassword(legacyKey)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Se requiere token JWT válido en cabecera Authorization: Bearer <token>'
  });
}

// ========================================================
// 3. ENDPOINT ADMINISTRATIVO SEGURO: POST /api/admin/forzar-recordatorio (Mejora 7: process.env.ADMIN_TOKEN)
// ========================================================
app.post('/api/admin/forzar-recordatorio', (req, res) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!token || !expectedToken || !safeCompare(token, expectedToken)) {
    console.warn(`🔒 [Seguridad] Intento no autorizado a /api/admin/forzar-recordatorio con token: "${token || 'ninguno'}"`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Token de autorización inválido'
    });
  }

  const ahora = new Date();
  const fechaOficial = new Date('2026-11-06T12:00:00-03:00');
  const esPrueba = req.query.modo === 'oficial' ? false : (ahora < fechaOficial);

  console.log(`⚡ [Admin] Forzado manual de recordatorios (${esPrueba ? 'MODO PRUEBA ANTICIPADA' : 'OFICIAL'}) autorizado con token administrativo seguro.`);

  // Disparo asíncrono en segundo plano sin bloquear la respuesta HTTP (Fire & Forget)
  ejecutarRecordatorios({ esPrueba }).catch((err) => {
    console.error('❌ [Admin Error] Error en la ejecución asíncrona de recordatorios:', err.message);
  });

  return res.status(200).json({
    success: true,
    esPrueba,
    message: 'Envío masivo iniciado en segundo plano de forma segura.',
    info: esPrueba
      ? 'Envío de prueba iniciado. Los invitados se mantendrán pendientes para el 6 de noviembre sin generar la segunda confirmación.'
      : 'Envío masivo oficial definitivo.'
  });
});

// ========================================================
// 4. ENDPOINT ADMINISTRATIVO: GET /api/invitados (Mejora 5: Autenticación JWT)
// ========================================================
app.get('/api/invitados', authenticateAdmin, async (req, res) => {
  try {
    const dbResult = await query(`
      SELECT id, nombre, telefono, recordatorio_enviado, reconfirmado, fecha_reconfirmacion, fecha_registro, token_reconfirmacion 
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
// 4.1 ENDPOINT ADMINISTRATIVO: DELETE /api/invitados/:id
// ========================================================
app.delete('/api/invitados/:id', authenticateAdmin, async (req, res) => {
  try {
    const guestId = parseInt(req.params.id, 10);
    if (!guestId || isNaN(guestId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de invitado inválido.'
      });
    }

    const deleteSql = 'DELETE FROM invitados WHERE id = $1 RETURNING id, nombre, telefono;';
    const deleteResult = await query(deleteSql, [guestId]);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitado no encontrado en la base de datos.'
      });
    }

    const deletedGuest = deleteResult.rows[0];
    console.log(`🗑️ [Admin] Invitado eliminado permanentemente: ID ${deletedGuest.id} - "${deletedGuest.nombre}"`);

    if (io) {
      io.emit('invitado-eliminado', { id: deletedGuest.id });
    }

    return res.status(200).json({
      success: true,
      message: `Invitado "${deletedGuest.nombre}" eliminado exitosamente.`,
      id: deletedGuest.id
    });
  } catch (error) {
    console.error('[Delete Guest Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al eliminar el invitado.'
    });
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
// 6. DISPARO MANUAL DE RECORDATORIOS: POST /api/admin/enviar-recordatorios (Fire & Forget)
// ========================================================
app.post('/api/admin/enviar-recordatorios', authenticateAdmin, (req, res) => {
  const ahora = new Date();
  const fechaOficial = new Date('2026-11-06T12:00:00-03:00');
  const esPrueba = req.query.modo === 'oficial' ? false : (ahora < fechaOficial);

  console.log(`⚡ [Admin] Envío manual de recordatorios (${esPrueba ? 'MODO PRUEBA ANTICIPADA' : 'OFICIAL'}) iniciado desde el panel web.`);

  // Disparo asíncrono en segundo plano (Fire & Forget) para no congelar la UI ni la conexión HTTP
  ejecutarRecordatorios({ esPrueba }).catch((err) => {
    console.error('❌ [Admin Error] Error en la ejecución asíncrona de recordatorios:', err.message);
  });

  return res.status(200).json({
    success: true,
    esPrueba,
    message: esPrueba
      ? 'Envío de prueba iniciado en segundo plano. Los invitados se mantendrán pendientes para el 6 de noviembre sin generar segunda confirmación.'
      : 'Envío masivo oficial iniciado en segundo plano de forma segura.'
  });
});

// ========================================================
// 7. DISPARO DE RECORDATORIO DE PRUEBA: POST /api/test-reminder
// ========================================================
app.post('/api/test-reminder', authenticateAdmin, async (req, res) => {
  const { telefono } = req.body;
  if (!telefono) {
    return res.status(400).json({ success: false, error: 'Debe especificar el campo telefono para la prueba' });
  }

  const phoneRes = normalizePhone(telefono);
  if (!phoneRes.valid) {
    return res.status(400).json({ success: false, error: phoneRes.error });
  }

  const alias = process.env.ALIAS_REGALO || 'key.2710';
  const mensajePrueba = buildReminderMessage(['Invitado de Prueba'], alias);

  const resultado = await enviarMensaje(phoneRes.formatted, mensajePrueba);
  return res.json({
    success: resultado.success,
    telefono: phoneRes.formatted,
    resultado
  });
});

// Arrancar servidor principal con soporte de WebSockets solo si se ejecuta directamente
if (require.main === module) {
  server.listen(PORT, async () => {
    console.log(`\n[+] [Servidor] Activo y escuchando en el puerto ${PORT}`);
    console.log(`[+] [URL Producción Oficial] https://cumpleanos-keyberlis.onrender.com`);
    console.log(`[+] [URL Local] http://localhost:${PORT}`);
    console.log(`[+] [Uptime Endpoint] https://cumpleanos-keyberlis.onrender.com/ping`);
    console.log(`[+] [WebSockets] Socket.io listo para comunicación en tiempo real`);
    
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

app.server = server;
app.io = io;
app.verifyAdminPassword = verifyAdminPassword;
app.sanitizeInput = sanitizeInput;
app.JWT_SECRET = JWT_SECRET;
app.BIRTHDAY_GIRL_PHONE = BIRTHDAY_GIRL_PHONE;
app.buildRSVPAlert = buildRSVPAlert;
app.buildReconfirmationAlert = buildReconfirmationAlert;
module.exports = app;
