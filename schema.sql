-- ========================================================
-- ESQUEMA DDL: BASE DE DATOS NEON POSTGRESQL
-- PROYECTO: Invitación 15 Años Keyberlis
-- ========================================================

-- Crear tabla 'invitados' si no existe
CREATE TABLE IF NOT EXISTS invitados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30) NOT NULL UNIQUE,
    verificado BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas rápidas
CREATE INDEX IF NOT EXISTS idx_invitados_telefono ON invitados(telefono);
CREATE INDEX IF NOT EXISTS idx_invitados_verificado ON invitados(verificado);
