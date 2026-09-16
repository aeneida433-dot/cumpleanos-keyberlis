/**
 * Módulo de Conexión a Base de Datos Neon PostgreSQL
 * Proyecto: Invitación 15 Años Keyberlis
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión con SSL para Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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
      nombre VARCHAR(120) NOT NULL,
      telefono VARCHAR(30) NOT NULL UNIQUE,
      verificado BOOLEAN DEFAULT FALSE,
      fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_invitados_telefono ON invitados(telefono);
    CREATE INDEX IF NOT EXISTS idx_invitados_verificado ON invitados(verificado);
  `;

  try {
    await query(ddl);
    console.log('✅ [DB] Tabla "invitados" e índices verificados/inicializados en Neon con éxito.');
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
