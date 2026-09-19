# Spec: Código QR de WhatsApp en Tiempo Real con WebSockets (Socket.io)

## 1. Objective
Permitir que el anfitrión de la fiesta de 15 años de Keyberlis vincule su WhatsApp directamente desde la interfaz web de la aplicación sin tener que consultar la consola de logs de Render. Al generar el código QR, el servidor lo convierte a formato imagen Data URL y lo emite en tiempo real vía WebSockets (`socket.io`). Al completarse la vinculación, el servidor emite el evento `'whatsapp-ready'` para transicionar el indicador de estado a "✅ Conectado".

## 2. Tech Stack
- **Backend:** Node.js (v18+), Express v4.21.2, Socket.io v4.8.1, whatsapp-web.js v1.26.0, qrcode v1.5.4, Neon PostgreSQL (`pg` v8.13.1).
- **Frontend:** Vanilla JavaScript, HTML5, CSS3, Socket.io Client.
- **Hosting:** Render Free Tier (<512MB RAM), dominio oficial: `https://cumpleanos-keyberlis.onrender.com`.

## 3. Commands
- **Install Dependencies:** `npm install socket.io`
- **Run Tests:** `npm test`
- **Start Dev:** `npm run dev`
- **Production Start:** `npm start`

## 4. Project Structure
- `server.js` → Servidor HTTP Express con Socket.io montado sobre el mismo puerto.
- `whatsapp.js` → Cliente de WhatsApp, generación de QR Data URL y emisión de eventos.
- `index.html` → Interfaz de la invitación y modal del anfitrión con `#codigo-qr-whatsapp`.
- `js/app.js` → Lógica de frontend, validación de contraseña `key27102011` y listeners de sockets.
- `CONSTRAINTS.md` → Restricciones de memoria (<512MB) y Green Bar (29 tests PASS).

## 5. Code Style & Architecture
```javascript
// Servidor
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// whatsapp.js (Emisión en tiempo real sin terminal)
client.on('qr', async (qr) => {
  latestQRDataURL = await qrcode.toDataURL(qr, { margin: 3, scale: 8 });
  if (ioInstance) ioInstance.emit('whatsapp-qr', { qrDataURL: latestQRDataURL });
});

// js/app.js (Solo si se validó la clave key27102011)
socket.on('whatsapp-qr', (data) => {
  if (sessionStorage.getItem('cumpleanos_admin_key') === 'key27102011') {
    qrImg.src = data.qrDataURL;
    qrContainer.style.display = 'block';
  }
});
```

## 6. Testing Strategy
- Suite unificada en `tests/run_all.js` (23 pruebas de integración + 6 de seguridad = 29 pruebas).
- Ejecución obligatoria con `npm test`.

## 7. Boundaries
- **Always do:** Validar `key27102011` antes de renderizar QR o desbloquear controles; mantener flags de memoria de Puppeteer.
- **Ask first:** Modificaciones estructurales en esquemas de BD o endpoints de recordatorios.
- **Never do:** Imprimir el QR en la consola de logs de Render; eliminar validaciones de seguridad o silenciar pruebas.

## 8. Success Criteria
1. El QR ya no se imprime en los logs de la consola de Render.
2. Al abrir el panel con `key27102011`, el socket recibe `'whatsapp-qr'` e inserta la imagen en `#codigo-qr-whatsapp`.
3. Al vincularse exitosamente, el socket recibe `'whatsapp-ready'` y muestra `"✅ Conectado"`.
4. Todas las 29 pruebas automatizadas pasan al 100% (`npm test`).
