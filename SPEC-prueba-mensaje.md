# Spec: Prueba de Envío Individual de WhatsApp con Baileys

## Objective
Certificar de forma concluyente que el motor de automatización de WhatsApp migrado a Baileys (`@whiskeysockets/baileys`) es capaz de conectarse utilizando las credenciales persistidas en Neon PostgreSQL (`whatsapp_session`) y despachar mensajes reales a números de WhatsApp.
El destinatario de la prueba es el número de la quinceañera (`5491161034151`).

## Tech Stack
- **Runtime:** Node.js (v18+)
- **Librería WhatsApp:** `@whiskeysockets/baileys` (v7.0.0-rc14)
- **Base de Datos:** Neon PostgreSQL con `pgStore.js`
- **Protocolo:** WebSockets / Noise protocol (sin Chromium/Puppeteer)

## Commands
- **Ejecutar prueba:** `node scratch/enviar_prueba.js`

## Project Structure
- `scratch/enviar_prueba.js` → Script temporal de un solo uso para ejecución en CLI
- `whatsapp.js` → Módulo central de Baileys
- `lib/pgStore.js` → Recuperador de credenciales desde Neon PostgreSQL
- `.baileys_auth/` → Carpeta local temporal para montaje de credenciales

## Code Style
```javascript
require('dotenv').config();
const { initWhatsApp, enviarMensaje, isReady } = require('../whatsapp');
```

## Boundaries
- **Siempre:** Validar que el socket esté en estado `isReady()` antes de intentar enviar el mensaje.
- **Siempre:** Registrar detalladamente la respuesta del servidor de WhatsApp (ID de mensaje, timestamp, ACK).
- **Nunca:** Modificar las credenciales en Neon ni sobrescribir datos de invitados durante la prueba.
- **Nunca:** Hacer commit de archivos temporales de prueba o credenciales locales.

## Success Criteria
1. El script `scratch/enviar_prueba.js` restaura las credenciales de `baileys_session` desde Neon si no están en disco local.
2. El socket de Baileys se conecta a WhatsApp (`connection === 'open'`).
3. Se despacha el mensaje exacto:
   `"¡Hola! 🌸 Este es un mensaje de prueba oficial desde el servidor de Render de tus 15 Años. El motor de Baileys y la base de datos de Neon están funcionando al 100%. ¡Todo listo para el 6 de noviembre! 🎉"` al número `5491161034151`.
4. La respuesta devuelta por WhatsApp incluye confirmación de entrega exitosa (`key.id` presente).
