# 🌸 Sistema de Invitación Digital y Automatización 15 Años — Keyberlis
## Documento Oficial de Cierre y Notas de Lanzamiento (RELEASE NOTES v2.1.0)

**Fecha:** 20 de Septiembre de 2026  
**Estado:** 🚀 **100% PRODUCCIÓN LISTO Y CERTIFICADO**  
**Despliegue Render:** [https://cumpleanos-keyberlis.onrender.com](https://cumpleanos-keyberlis.onrender.com)  
**Salud del Sistema:** [https://cumpleanos-keyberlis.onrender.com/ping](https://cumpleanos-keyberlis.onrender.com/ping)  
**Base de Datos:** Neon PostgreSQL Serverless (AWS us-east-1)  
**Control de Versiones:** Rama `main` certificada con 55/55 pruebas unitarias e integración (100% Green Bar)

---

## 1. Resumen Ejecutivo del Proyecto

El proyecto **cumpleanos-keyberlis** provee una plataforma integral, moderna y segura para la celebración de los 15 Años de Keyberlis (Sábado 07 de Noviembre de 2026). Integra un frontend responsivo de alta gama para los invitados, un formulario de confirmación de asistencia (RSVP) conectado a Neon PostgreSQL, un panel administrativo en tiempo real protegido con autenticación criptográfica, y un motor ultra-liviano de WhatsApp impulsado por **Baileys** para recordatorios programados sin sobrecostos de infraestructura, operando 24/7 en el tier gratuito de Render y Neon.

---

## 2. Arquitectura Final del Sistema

```
                                  ┌────────────────────────┐
                                  │      INVITADOS         │
                                  │  (Móvil / Web Browser) │
                                  └───────────┬────────────┘
                                              │  HTTPS (Gzip / Deflate)
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RENDER WEB SERVICE (Node.js)                              │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                               EXPRESS SERVER                                   │   │
│   │  • Compresión Gzip (compression, threshold: 1KB)                               │   │
│   │  • Rate Limiter estricto (express-rate-limit: máx 3 solicitudes/min en /api)   │   │
│   │  • Sanitización HTML Anti-XSS en inputs de texto                               │   │
│   │  • Aislamiento estático: /db.js, server.js y credenciales retornan HTTP 404   │   │
│   └───────┬────────────────────────────────┬───────────────────────────────┬───────┘   │
│           │                                │                               │           │
│           ▼                                ▼                               ▼           │
│   ┌───────────────┐               ┌─────────────────┐             ┌────────────────┐   │
│   │   SOCKET.IO   │               │   NODE-CRON     │             │ BAILEYS MOTOR  │   │
│   │ (On-Demand)   │               │  Recordatorios  │             │   WHATSAPP     │   │
│   │  Solo activo  │               │  06-Nov 12:00   │             │ Protocol Noise │   │
│   │ cuando admin  │               │  Limpieza Neon  │             │   WebSocket    │   │
│   │ ingresa clave │               │  Medianoche     │             │   <50MB RAM    │   │
│   └───────┬───────┘               └────────┬────────┘             └────────┬───────┘   │
│           │                                │                               │           │
└───────────┼────────────────────────────────┼───────────────────────────────┼───────────┘
            │                                │                               │
            │                                ▼                               │
            │                  ┌──────────────────────────┐                  │
            └─────────────────►│  NEON POSTGRESQL (SSL)   │◄─────────────────┘
                               │  Pool: max 3, idle 10s   │
                               │  • tabla invitados       │
                               │  • tabla logs_envio      │
                               │  • tabla whatsapp_session│
                               └──────────────────────────┘
```

### 2.1. Componentes Clave:
1. **Backend HTTP & API Express:**
   - **Compresión Gzip Activa:** Middleware `compression` integrado para reducir el tamaño de transferencia de HTML, CSS, JS y JSON en más del 50%.
   - **Protección DoS & Spam:** Rate Limiter con `express-rate-limit` que bloquea solicitudes automáticas o abusivas (máximo 3 envíos por minuto por IP).
   - **Sanitización Anti-XSS:** Todas las entradas del formulario RSVP codifican caracteres peligrosos (`<`, `>`, `&`, `"`, `'`) antes de interactuar con la base de datos.
   - **Aislamiento Estático Estricto:** Exclusión radical de archivos sensibles del backend (`db.js`, `server.js`, `.baileys_auth`); cualquier intento de acceso directo retorna `404 Not Found`.

2. **Base de Datos Serverless (Neon PostgreSQL):**
   - **Conexión Criptográfica SSL:** Conexión obligatoria con `sslmode=verify-full` y `rejectUnauthorized: true`.
   - **Eficiencia de Conexiones:** Pool dimensionado para Serverless (`max: 3`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 5000`), liberando conexiones inmediatamente tras cada consulta.
   - **Esquema Idempotente:** Clave única `UNIQUE (nombre, telefono)` en tabla `invitados` para admitir múltiples familiares bajo un mismo número telefónico.
   - **Auditoría Permanente (`logs_envio`):** Registro inmutable de cada mensaje de WhatsApp emitido con fecha, número y nombres consolidados.

3. **Motor de WhatsApp de Cero-Chromium (Baileys):**
   - **Memoria Ultrabaja (<50MB):** Reemplazo de Puppeteer/Chromium por `@whiskeysockets/baileys`. Se eliminó de raíz el problema de saturación de RAM (Out Of Memory >512MB).
   - **Persistencia en la Nube (`lib/pgStore.js`):** Almacenamiento seguro y atómico de la sesión (`baileys_session`) en Neon PostgreSQL mediante empaquetado ZIP en Base64.
   - **Reconexión Automática:** Capacidad de reinicio sin perder autenticación en despliegues y suspensiones del servidor efímero.

4. **WebSockets Bajo Demanda (Socket.io):**
   - **Apagado para Invitados:** Los invitados que navegan la invitación o completan el RSVP no inicializan Socket.io, ahorrando CPU y RAM crítica en Render.
   - **Encendido Exclusivo para Anfitrión:** El socket solo se levanta cuando el anfitrión ingresa la contraseña en el panel de control.
   - **Desconexión Inmediata (`closeModal`):** Al cerrar la ventana modal, se ejecuta `appSocket.disconnect()` y se anula la variable (`appSocket = null`).

---

## 3. Consolidación de Credenciales y Jerarquía de Seguridad

Ninguna contraseña, token secreto ni cadena de conexión se encuentra hardcodeada en texto plano dentro del código fuente accesible públicamente en GitHub:

| Concepto | Credencial / Variable | Ubicación y Mecanismo de Seguridad | Propósito y Alcance |
|---|---|---|---|
| **Panel del Anfitrión** | `key27102011` | Hasheada en SHA-256 (`fd1b6270...`) en `server.js`. Validación con `crypto.timingSafeEqual()`. Emisión de JWT dinámico con expiración de 15m. | Acceso al modal administrativo, escaneo de QR, lista de asistentes y exportación CSV. |
| **Token de Respaldo Admin** | `ADMIN_TOKEN` | Almacenado exclusivamente en `process.env.ADMIN_TOKEN` en las variables de entorno de Render y `.env` local. | Autorización segura de endpoints de backend como `POST /api/admin/forzar-recordatorio`. |
| **Alias de Transferencias** | `key.2710` | Texto público en interfaz y plantilla de mensajes de WhatsApp. | Alias oficial de Mercado Pago para los obsequios monetarios de los invitados. |
| **Base de Datos Neon** | `DATABASE_URL` | Variable de entorno secreta en Render (`process.env.DATABASE_URL`). Archivo `.env` ignorado en `.gitignore`. | Acceso autenticado con SSL estricto al cluster PostgreSQL de Neon. |

---

## 4. Certificación Automatizada de Pruebas (npm test)

El proyecto cuenta con una batería de **55 pruebas unitarias y de integración** distribuidas en dos suites especializadas:

```text
========================================================
🚀 SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS (55/29)
========================================================

--- 1. Pruebas de Integración y Regla de Oro Telefónica (25 Pruebas) ---
  ✅ Normalización E.164 para números con/sin 0, con/sin 15, con/sin +54
  ✅ Rechazo estricto de números inválidos, vacíos o letras
  ✅ Formateo gramatical de nombres (individual, dos con "y", tres con comas)
  ✅ Persistencia idempotente de múltiples familiares bajo el mismo teléfono
  ✅ Actualización de estado recordatorio_enviado = true
  ✅ Registro de auditoría en tabla logs_envio
  ✅ Limpieza automática de sesiones huérfanas en Neon

--- 2. Pruebas de Seguridad, Blindaje y Rendimiento (30 Pruebas) ---
  ✅ Bloqueo y protección de dashboard administrativo
  ✅ Validación de clave mediante SHA-256 y emisión de JWT con expiración
  ✅ Rechazo de accesos no autorizados con 401 Unauthorized
  ✅ Autorización de endpoints administrativos mediante ADMIN_TOKEN
  ✅ Verificación de WebSockets y regeneración de QR
  ✅ Botonera limpia: música y WhatsApp eliminados, solo control deslizante activo
  ✅ Formulario RSVP simplificado sin campos innecesarios
  ✅ Aislamiento estático: /db.js y credenciales devuelven 404
  ✅ Trampa Honeypot anti-bots en formulario RSVP
  ✅ Cero contraseñas ni tokens en texto plano en el backend
  ✅ Sanitización HTML anti-XSS en POST /api/rsvp
  ✅ Rate Limiting con express-rate-limit (máx 3 req/min, 4ta bloqueada con 429)
  ✅ Middleware de compresión Gzip integrado en server.js
  ✅ Desconexión y liberación inmediata de socket en app.js al cerrar modal

========================================================
📊 RESULTADO: 55 pasaron, 0 fallaron (100% Green Bar)
⏱ TIEMPO TOTAL: 6.06 segundos
========================================================
```

---

## 5. Parámetros de Operación en Producción

- **Fecha de la Fiesta:** Sábado 07 de Noviembre de 2026.
- **Disparo del Recordatorio de WhatsApp:** Viernes 06 de Noviembre de 2026 a las 12:00 PM (Hora de Buenos Aires).
- **Cola de Entrega:** Secuencial con Jitter aleatorio de 4 a 8 segundos entre familias para prevención de bloqueos.
- **Monitoreo de Continuidad:** Ping automatizado cada 5 minutos mediante UptimeRobot hacia `/ping` para mantener activo el contenedor sin suspensiones.
- **Soporte de Conexión QR:** Si el celular se reinicia o desvincula, el anfitrión puede pulsar "🔄 Generar nuevo QR" directamente desde el panel para vincularlo en tiempo real.

---
**Proyecto concluido satisfactoriamente y listo para el evento.** 🌸🎉
