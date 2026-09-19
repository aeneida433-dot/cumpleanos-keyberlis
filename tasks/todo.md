# Lista de Tareas Atómicas (TODO)

## Fase 1: Base de Datos en Neon
- [x] **Tarea 1.1: Esquema DDL y Módulo de Conexión a Neon PostgreSQL**
  - **Descripción:** Crear el script SQL `schema.sql` para la tabla `invitados` (con `id`, `nombre`, `telefono`, `verificado`, `fecha_registro`) y el módulo `db.js` utilizando la librería `pg` con conexión SSL requerida por Neon.
  - **Criterios de aceptación:**
    - Script SQL con tabla e índices únicos sobre `telefono`.
    - `db.js` exporta un pool de conexión que lee `DATABASE_URL` desde `.env`.
    - Script de inicialización que crea la tabla si no existe.
  - **Verificación:** Ejecutar script de prueba de conexión contra Neon o validación sintáctica con `node -c db.js`.
  - **Dependencias:** Ninguna.
  - **Archivos:** `db.js`, `schema.sql`.
  - **Alcance:** S (2 archivos).

---

## Fase 2: Entorno Local y Dependencias
- [x] **Tarea 2.1: Inicialización de `package.json` e Instalación de Dependencias**
  - **Descripción:** Crear `package.json` con dependencias: `express`, `pg`, `whatsapp-web.js`, `qrcode-terminal`, `node-cron`, `dotenv`, `cors`, y configurar `.env.example`.
  - **Criterios de aceptación:**
    - `package.json` configurado con `"type": "module"` o CommonJS, y script `"start": "node server.js"`.
    - Archivo `.env.example` documentando `PORT`, `DATABASE_URL`, `TIMEZONE`, `ADMIN_KEY`.
  - **Verificación:** Ejecutar `npm install` o verificar que todas las dependencias estén declaradas y listas.
  - **Dependencias:** Tarea 1.1.
  - **Archivos:** `package.json`, `.env.example`.
  - **Alcance:** S (2 archivos).

---

## Fase 3: Servidor Express, Normalización y Endpoints
- [x] **Tarea 3.1: Servidor Base Express y Endpoint `GET /ping` (UptimeRobot)**
  - **Descripción:** Implementar `server.js` con Express, middlewares para parseo de JSON, CORS, serving de archivos estáticos (la carpeta actual con `index.html`) y la ruta `GET /ping` para UptimeRobot.
  - **Criterios de aceptación:**
    - `GET /ping` responde en HTTP 200 con `{ "status": "ok", "uptime": ... }`.
    - Los archivos estáticos (`index.html`, `css/`, `assets/`, `js/`) se sirven correctamente desde la raíz.
  - **Verificación:** Iniciar servidor y probar `curl http://localhost:3000/ping`.
  - **Dependencias:** Tarea 2.1.
  - **Archivos:** `server.js`.
  - **Alcance:** S (1 archivo).

- [x] **Tarea 3.2: Módulo de Normalización de Números de Argentina (+54 9)**
  - **Descripción:** Crear `lib/phoneNormalizer.js` para limpiar números ingresados (quitar guiones, paréntesis, espacios, ceros iniciales) y agregar automáticamente el prefijo `549` si falta, validando que el número final tenga formato válido para WhatsApp (`54911...` o `549...`).
  - **Criterios de aceptación:**
    - Transforma `11 2345-6789` en `5491123456789`.
    - Transforma `011-2345-6789` en `5491123456789`.
    - Transforma `+54 9 11 2345 6789` en `5491123456789`.
    - Rechaza strings con menos de 8 dígitos o caracteres inválidos.
  - **Verificación:** Ejecutar suite de pruebas unitarias sobre casos borde de números telefónicos.
  - **Dependencias:** Ninguna.
  - **Archivos:** `lib/phoneNormalizer.js`.
  - **Alcance:** XS (1 archivo).

- [x] **Tarea 3.3: Endpoint `POST /api/rsvp` con Guardado en Neon**
  - **Descripción:** Desarrollar el endpoint `POST /api/rsvp` que recibe `nombre` y `telefono`, aplica la normalización, e inserta o actualiza el registro en Neon PostgreSQL (`ON CONFLICT (telefono) DO UPDATE`).
  - **Criterios de aceptación:**
    - Respuesta HTTP 201 en nuevo registro.
    - Respuesta HTTP 200 en registro existente (idempotente).
    - Respuesta HTTP 422 si falta nombre o teléfono inválido.
  - **Verificación:** Probar envío con `curl` o script de prueba y verificar el registro en Neon.
  - **Dependencias:** Tareas 1.1, 3.1, 3.2.
  - **Archivos:** `routes/rsvp.js`, `server.js`.
  - **Alcance:** S (2 archivos).

- [x] **Tarea 3.4: Conexión del Formulario Web (`index.html`) con `POST /api/rsvp`**
  - **Descripción:** Modificar el manejador de envío de `js/app.js` para que, además de generar el mensaje de WhatsApp, envíe la confirmación a `POST /api/rsvp` vía `fetch()`.
  - **Criterios de aceptación:**
    - El formulario envía la petición al backend en segundo plano.
    - Si el backend responde éxito, procede a abrir WhatsApp.
    - Manejo de fallback si el usuario está offline o el servidor tarda.
  - **Verificación:** Probar envío desde el navegador y constatar que el teléfono y nombre se guarden en Neon.
  - **Dependencias:** Tarea 3.3.
  - **Archivos:** `js/app.js`.
  - **Alcance:** XS (1 archivo).

---

### 🛑 Checkpoint 1: Base de Datos, API y Formulario Operativos
- [x] `GET /ping` responde HTTP 200 OK.
- [x] La normalización de teléfonos argentinos convierte correctamente variantes locales.
- [x] `POST /api/rsvp` almacena los invitados en Neon con `verificado = false`.
- [x] El formulario web envía los datos a Neon y abre WhatsApp.

---

## Fase 4: Módulo de WhatsApp y Recordatorio Programado
- [x] **Tarea 4.1: Cliente de WhatsApp y Generación de Código QR en Terminal (`whatsapp.js`)**
  - **Descripción:** Inicializar el cliente de automatización con persistencia de sesión local (`LocalAuth`), capturando el evento `qr` con `qrcode-terminal` para escanear en consola y emitiendo evento `ready`.
  - **Criterios de aceptación:**
    - Se imprime el QR en la terminal cuando se requiere inicio de sesión.
    - La sesión se guarda en `./.wwebjs_auth` o `./auth_info` para persistir sin re-escanear en reinicios.
    - Exporta función `enviarMensaje(telefono, mensaje)`.
  - **Verificación:** Iniciar el servicio y verificar el renderizado del código QR.
  - **Dependencias:** Tarea 2.1.
  - **Archivos:** `whatsapp.js`.
  - **Alcance:** S (1 archivo).

- [x] **Tarea 4.2: Cron Job Programado para el 6 de Noviembre a las 12:00 PM (`cron.js`)**
  - **Descripción:** Configurar un temporizador con `node-cron` para la fecha y hora exacta (`0 12 6 11 *` en zona horaria de Argentina `America/Argentina/Buenos_Aires`). Al dispararse, consulta todos los invitados de Neon y envía el mensaje con el alias `[key.2710]` con rate-limiting (4 a 6 segundos entre mensajes).
  - **Criterios de aceptación:**
    - Cron configurado para `0 12 6 11 *`.
    - Mensaje exacto: `"¡Hola! Te recordamos que mañana es la gran fiesta de 15 años. Por favor, confirma tu asistencia. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: [key.2710]"`.
    - Cola con retardo de 4-6 segundos entre envíos para prevenir bloqueos por spam.
  - **Verificación:** Probar la función de despacho en modo dry-run con una fecha inmediata o función de prueba.
  - **Dependencias:** Tareas 1.1, 4.1.
  - **Archivos:** `cron.js`.
  - **Alcance:** S (1 archivo).

- [x] **Tarea 4.3: Endpoint de Prueba para Disparo Controlado (`POST /api/test-reminder`)**
  - **Descripción:** Crear una ruta protegida con `ADMIN_KEY` para que el anfitrión pueda enviar un recordatorio de prueba a su propio número antes del 6 de noviembre sin esperar la fecha programada.
  - **Criterios de aceptación:**
    - Requiere cabecera `x-admin-key`.
    - Envía el mensaje exacto al número solicitado y responde con status del envío.
  - **Verificación:** Probar con `curl` hacia el número del anfitrión.
  - **Dependencias:** Tareas 4.1, 4.2.
  - **Archivos:** `routes/admin.js`, `server.js`.
  - **Alcance:** XS (2 archivos).

---

### 🛑 Checkpoint 2: Automatización de WhatsApp y Recordatorio Listos
- [x] El cliente WhatsApp muestra el QR y conecta exitosamente.
- [x] La función de envío despacha mensajes con formato correcto y alias `key.2710`.
- [x] El cron job queda armado y validado para el 6 de noviembre a las 12:00 PM.

---

## Fase 5: Despliegue en Render y UptimeRobot
- [x] **Tarea 5.1: Preparación para Despliegue en Render**
  - **Descripción:** Crear script de arranque de producción, archivo `render.yaml` (opcional) o especificación de Build Command (`npm install`) y Start Command (`node server.js`), asegurando compatibilidad con las variables de entorno de Render.
  - **Criterios de aceptación:**
    - Servidor escucha dinámicamente en `process.env.PORT || 3000`.
    - Variables de entorno documentadas listas para pegar en el panel de Render.
  - **Verificación:** Ejecutar en modo producción local `NODE_ENV=production node server.js`.
  - **Dependencias:** Checkpoint 2.
  - **Archivos:** `server.js`, `render.yaml`, `README_DEPLOY.md`.
  - **Alcance:** S (2 archivos).

- [x] **Tarea 5.2: Guía de Configuración de UptimeRobot**
  - **Descripción:** Crear guía paso a paso `UPTIMEROBOT_SETUP.md` para configurar el monitor gratuito en UptimeRobot hacia la URL de Render (`https://tu-app.onrender.com/ping`) cada 5 minutos, garantizando que el servicio permanezca despierto 24/7.
  - **Criterios de aceptación:**
    - Instrucciones ilustradas con tipo de monitor HTTP(s), intervalo de 5 minutos y verificación de respuesta 200 OK.
  - **Verificación:** Documento completo y validado.
  - **Dependencias:** Tarea 5.1.
  - **Archivos:** `UPTIMEROBOT_SETUP.md`.
  - **Alcance:** XS (1 archivo).

---

### 🛑 Checkpoint 3: Despliegue en Producción y Keep-Alive Configurados
- [x] Blueprint de infraestructura `render.yaml` con build command, start command y variables de entorno listo.
- [x] Guía de despliegue paso a paso `README_DEPLOY.md` detallada para Render y Neon.
- [x] Guía de monitorización continua `UPTIMEROBOT_SETUP.md` con ping de 5 minutos hacia `/ping` para mantener el contenedor activo 24/7 de forma 100% gratuita.

---

## Fase 6: Reglas de Negocio Definitivas (Spec-Driven Development)
- [x] **Tarea 6.1: Migración DDL en Neon para Agrupación Familiar**
  - Eliminar restricciones de teléfono único (`invitados_telefono_key`, `uq_invitados_telefono`).
  - Agregar restricción `UNIQUE (nombre, telefono)` permitiendo múltiples personas con el mismo número telefónico.
- [x] **Tarea 6.2: Normalización Telefónica E.164 Estricta (13 dígitos)**
  - Limpieza de `0` inicial, `15` intermedio/inicial y caracteres especiales.
  - Generación de formato E.164 `54911xxxxxxxx` (exactamente 13 dígitos) y respuesta HTTP 400 ante números inválidos.
- [x] **Tarea 6.3: Agrupación Familiar y Cola Anti-Ban con Jitter en Cron Job**
  - Agrupación en memoria de múltiples invitados bajo un mismo teléfono.
  - Generación de mensaje cálido y personalizado: `"¡Hola Juan, María y Sofía! Les recordamos que mañana es la gran fiesta de 15 años de Keyberlis. Por favor, confirmen su asistencia si aún no lo han hecho. Si desean realizar un presente, pueden hacerlo en efectivo a nuestro alias: cumpleanos2710"`.
  - Cola secuencial con pausa aleatoria de 4 a 8 segundos (`4000 + Math.random() * 4000`).
  - Actualización atómica de `recordatorio_enviado = true` para todos los integrantes agrupados inmediatamente después del envío.
- [x] **Tarea 6.4: Endpoint Administrativo de Forzado Seguro**
  - `POST /api/admin/forzar-recordatorio?token=cumpleanos2710`: valida token, responde HTTP 401 si es incorrecto, y dispara asíncronamente el flujo de recordatorios con HTTP 200 si es correcto.
- [x] **Tarea 6.5: Optimización de Rendimiento en Render Free Tier**
  - Configuración de flags de Puppeteer (`--js-flags=--max-old-space-size=256`, `--disable-extensions`, etc.) para mantener Chromium por debajo del límite de 512MB RAM.
  - Endpoint `GET /ping` para UptimeRobot 24/7.

---

## Fase 7: Código QR en Tiempo Real con Socket.io en Panel Web
- [x] **Tarea 7.1: Instalación de `socket.io` y Montaje de WebSockets en `server.js`**
  - Instalar `socket.io` e integrar `http.createServer(app)` y `new Server(server, { cors: ... })`.
  - Conectar instancia de socket con `whatsapp.js`.
- [x] **Tarea 7.2: Emisión de Eventos y Silenciado de QR en Terminal en `whatsapp.js`**
  - Eliminar `qrcodeTerminal.generate` para no ensuciar los logs de Render.
  - Generar Data URL Base64 del código QR y emitir `'whatsapp-qr'`.
  - Emitir `'whatsapp-ready'` al conectar para cambiar estado a "✅ Conectado".
- [x] **Tarea 7.3: Renderizado Dinámico en Interfaz Web (`index.html` y `js/app.js`)**
  - Cargar cliente Socket.io en `index.html`.
  - Escuchar eventos únicamente si se validó la clave `key27102011`.
  - Insertar código QR en `#codigo-qr-whatsapp` y actualizar texto a "✅ Conectado".
- [x] **Tarea 7.4: Verificación Green Bar (`npm test`) y Despliegue en `main`**
  - Asegurar 100% de éxito en las 29 pruebas y realizar commit y push a `origin main`.

