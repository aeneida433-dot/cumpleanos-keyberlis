/**
 * Módulo de Conexión a Base de Datos Neon PostgreSQL
 * Proyecto: Invitación 15 Años Keyberlis
 */

const { Pool } = require('pg');
const fs = require('fs');

process.env.PGSSLMODE = 'verify-full';

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

const rawConnectionString = (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')
  ? process.env.DATABASE_URL.trim()
  : null;

if (!rawConnectionString) {
  console.error('❌ [DB Error Fatal] La variable de entorno DATABASE_URL no está configurada.');
  throw new Error('DATABASE_URL environment variable is required.');
}

// Ajuste automático de SSL para Neon: reemplaza sslmode=require o agrega sslmode=verify-full
// para eliminar de raíz el warning de pg y forzar verificación estricta de certificados en producción
let connectionString = rawConnectionString;
if (connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
} else if (connectionString.includes('sslmode=prefer')) {
  connectionString = connectionString.replace('sslmode=prefer', 'sslmode=verify-full');
} else if (connectionString.includes('sslmode=verify-ca')) {
  connectionString = connectionString.replace('sslmode=verify-ca', 'sslmode=verify-full');
} else if (!connectionString.includes('sslmode=')) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'sslmode=verify-full';
}

// Configuración de conexión con SSL estricto para Neon
const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: true },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// Listener para errores imprevistos en clientes inactivos del pool
pool.on('error', (err) => {
  console.error('⚠️ Error inesperado en el pool de conexión a Neon:', err.message);
});

/**
 * Ejecuta una consulta SQL en la base de datos
 * @param {string} text - Query SQL
 * @param {Array} params - Parámetros de la consulta
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Consulta ejecutada en ${duration}ms: ${text.slice(0, 60)}...`);
    }
    return res;
  } catch (error) {
    console.error(`[DB Error] Fallo al ejecutar: "${text.slice(0, 60)}..."`, error.message);
    throw error;
  }
}

/**
 * Inicializa la tabla 'invitados' e índices en Neon automáticamente al arrancar
 */
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ [DB Warning] DATABASE_URL no está definida. La base de datos no se inicializará.');
    return;
  }

  const ddl = `
    CREATE TABLE IF NOT EXISTS invitados (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      telefono VARCHAR(20) NOT NULL,
      recordatorio_enviado BOOLEAN DEFAULT FALSE,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Ajuste de columnas existentes si la tabla ya existía
    ALTER TABLE invitados ALTER COLUMN nombre TYPE VARCHAR(150);
    ALTER TABLE invitados ALTER COLUMN telefono TYPE VARCHAR(20);
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN DEFAULT FALSE;
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    -- Migraciones de restricciones seguras para permitir múltiples invitados por teléfono
    ALTER TABLE invitados DROP CONSTRAINT IF EXISTS invitados_telefono_key;
    ALTER TABLE invitados DROP CONSTRAINT IF EXISTS uq_invitados_telefono;
    ALTER TABLE invitados DROP CONSTRAINT IF EXISTS unique_nombre_telefono;
    ALTER TABLE invitados ADD CONSTRAINT unique_nombre_telefono UNIQUE (nombre, telefono);

    CREATE INDEX IF NOT EXISTS idx_invitados_telefono ON invitados(telefono);
    CREATE INDEX IF NOT EXISTS idx_invitados_recordatorio ON invitados(recordatorio_enviado);

    -- Columnas e índices para el flujo de Doble Check de Asistencia y Asistencia Inicial
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS token_reconfirmacion UUID DEFAULT gen_random_uuid();
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS reconfirmado BOOLEAN DEFAULT FALSE;
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS fecha_reconfirmacion TIMESTAMP;
    ALTER TABLE invitados ADD COLUMN IF NOT EXISTS asiste BOOLEAN DEFAULT TRUE;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_invitados_token ON invitados(token_reconfirmacion);
    CREATE INDEX IF NOT EXISTS idx_invitados_reconfirmado ON invitados(reconfirmado);
    CREATE INDEX IF NOT EXISTS idx_invitados_asiste ON invitados(asiste);

    -- Tabla para persistencia de sesión de WhatsApp (RemoteAuth en Neon)
    CREATE TABLE IF NOT EXISTS whatsapp_session (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(100) NOT NULL UNIQUE,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    GRANT ALL PRIVILEGES ON TABLE whatsapp_session TO PUBLIC;
  `;

  try {
    await query(ddl);
    console.log('✅ [DB] Esquema e índices verificados/migrados en Neon con éxito (UNIQUE nombre + telefono).');
  } catch (err) {
    console.error('❌ [DB Error] Error al inicializar el esquema en Neon:', err.message);
    throw err;
  }
}

module.exports = {
  pool,
  query,
  initDB,
};
