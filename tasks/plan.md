# Plan de Implementación: Sistema Backend de Invitación y Automatización WhatsApp

**Proyecto:** Invitación 15 Años Keyberlis  
**Stack:** Node.js, Express, Neon PostgreSQL (`pg`), WhatsApp Automation (`whatsapp-web.js` / Baileys), `node-cron`, `qrcode-terminal`, Render, UptimeRobot  
**Fecha Objetivo:** Sábado 07 de Noviembre (Recordatorio: Viernes 06 de Noviembre 12:00 PM)  

---

## 1. Visión General
Implementación modular e incremental del backend en Node.js que conecte la invitación digital web con una base de datos PostgreSQL Serverless en Neon, procese confirmaciones mediante `POST /api/rsvp` con normalización automática de teléfonos de Argentina (`+54 9`), mantenga el contenedor activo 24/7 en Render con `GET /ping` monitoreado por UptimeRobot, y ejecute un cron job el 6 de noviembre a las 12:00 PM para enviar recordatorios personalizados por WhatsApp con el alias `key.2710`.

---

## 2. Decisiones Arquitectónicas Clave
1. **Normalización Telefónica E.164 (Argentina):**  
   Los números se limpian de guiones, espacios y ceros. Si no tienen prefijo internacional, se antepone `549`. Se valida que tengan 10 u 11 dígitos locales (código de área + número) para garantizar que WhatsApp los acepte sin error.
2. **Idempotencia en Registro:**  
   Si un número ya existe en Neon, se actualiza el nombre del invitado y su timestamp en lugar de duplicar o fallar.
3. **Persistencia y Resiliencia en Render:**  
   Ruta `GET /ping` ligera (<20ms) para UptimeRobot cada 5 min.
4. **Despacho Controlado Anti-Spam:**  
   Pausa de 4 a 6 segundos aleatorios entre mensajes durante el cron del 6 de noviembre.

---

## 3. Desglose de Fases y Tareas

### Fase 1: Configuración de Base de Datos (Neon)
- **Tarea 1.1:** Definición del esquema DDL y script de conexión/migración a Neon (`db.js`, `schema.sql`).

### Fase 2: Entorno Local y Dependencias
- **Tarea 2.1:** Estructuración de `package.json`, variables de entorno `.env.example`, e instalación de dependencias (`express`, `pg`, `whatsapp-web.js` / `@whiskeysockets/baileys`, `node-cron`, `qrcode-terminal`, `cors`, `dotenv`).

### Fase 3: Servidor Express, Normalización y Endpoints
- **Tarea 3.1:** Implementación del servidor Express (`server.js`) y la ruta `GET /ping` para UptimeRobot.
- **Tarea 3.2:** Implementación del módulo de normalización de números de Argentina (`lib/phoneNormalizer.js`).
- **Tarea 3.3:** Implementación del endpoint `POST /api/rsvp` y conexión con la base de datos Neon.
- **Tarea 3.4:** Integración del formulario de `index.html` con el endpoint `POST /api/rsvp`.

### Checkpoint 1: Flujo de Registro y Ping Verificado
- Pruebas unitarias de normalización.
- Inserción y respuesta exitosa de `POST /api/rsvp`.
- Respuesta `200 OK` de `GET /ping`.

### Fase 4: Módulo WhatsApp y Programador de Recordatorios
- **Tarea 4.1:** Implementación del cliente de WhatsApp con visualización de QR en terminal (`whatsapp.js`).
- **Tarea 4.2:** Implementación del Cron Job programado para el 6 de noviembre a las 12:00 PM (`cron.js`).
- **Tarea 4.3:** Endpoint administrativo para disparo de prueba de recordatorio (`POST /api/test-reminder`).

### Checkpoint 2: Automatización WhatsApp y Cron Verificados
- Vinculación QR operativa.
- Despacho de mensaje de prueba con formato y alias `[key.2710]`.

### Fase 5: Despliegue en Render y UptimeRobot
- **Tarea 5.1:** Preparación de archivos de configuración de producción (`render.yaml`, scripts de arranque).
- **Tarea 5.2:** Guía paso a paso para despliegue en Render y configuración de monitoreo en UptimeRobot.
