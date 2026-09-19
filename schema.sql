-- ========================================================
-- ESQUEMA DDL DEFINITIVO: BASE DE DATOS NEON POSTGRESQL
-- PROYECTO: Invitación 15 Años Keyberlis
-- ========================================================

-- Crear tabla 'invitados' con esquema actualizado
CREATE TABLE IF NOT EXISTS invitados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    recordatorio_enviado BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migración segura de restricciones previas para permitir múltiples invitados por teléfono (agrupación familiar)
ALTER TABLE invitados DROP CONSTRAINT IF EXISTS invitados_telefono_key;
ALTER TABLE invitados DROP CONSTRAINT IF EXISTS uq_invitados_telefono;
ALTER TABLE invitados DROP CONSTRAINT IF EXISTS unique_nombre_telefono;
ALTER TABLE invitados ADD CONSTRAINT unique_nombre_telefono UNIQUE (nombre, telefono);

-- Índices para optimizar consultas rápidas
CREATE INDEX IF NOT EXISTS idx_invitados_telefono ON invitados(telefono);
CREATE INDEX IF NOT EXISTS idx_invitados_recordatorio ON invitados(recordatorio_enviado);

-- Tabla para persistencia de sesión de WhatsApp (RemoteAuth en Neon)
CREATE TABLE IF NOT EXISTS whatsapp_session (
    id VARCHAR(100) PRIMARY KEY,
    data BYTEA NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
