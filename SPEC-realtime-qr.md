# Spec: Código QR de WhatsApp en Tiempo Real con WebSockets (Socket.io) y Blindaje de Seguridad UI

## 1. Objective
Permitir que el anfitrión de la fiesta de 15 años de Keyberlis vincule su WhatsApp directamente desde la interfaz web de la aplicación sin consultar la consola de logs de Render. Al generar el código QR, el servidor lo convierte a formato imagen Data URL y lo emite en tiempo real vía WebSockets (`socket.io`). Al completarse la vinculación, el servidor emite el evento `'whatsapp-ready'` para transicionar el indicador de estado a "✅ Conectado". Asimismo, provee un botón de refresco directo (`#btn-refrescar-qr`) sin recargar la página y blinda la interfaz eliminando toda persistencia automática de la clave de anfitrión.

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
- `server.js` → Servidor HTTP Express con Socket.io montado, redirección de `/admin.html` y protección estricta de `/api/invitados` (401).
- `whatsapp.js` → Cliente de WhatsApp, generación de QR Data URL, silenciado de logs en terminal y función `refrescarQR()`.
- `index.html` → Interfaz de la invitación, `#admin-modal` con `display: none !important;` y botón `#btn-refrescar-qr`.
- `js/app.js` → Lógica de frontend sin almacenamiento persistente (prompt en cada clic de `#admin-btn`), control de socket y toggle seguro.
- `CONSTRAINTS.md` → Restricciones de memoria (<512MB) y Green Bar obligatoria para commits.

## 5. Security & Access Control Rules
1. **Cero Memoria Automática:** Queda prohibido el almacenamiento de la contraseña en `sessionStorage` o `localStorage`. Cada clic en `#admin-btn` dispara obligatoriamente el prompt del navegador.
2. **Visibilidad Blindada:** `#admin-modal` tiene por defecto `display: none !important;`. Solo si el usuario introduce exactamente `'key27102011'`, cambia a `display: flex`. Si cancela o erra, se bloquea la UI en `display: none`.
3. **Endpoint Blindado:** `GET /api/invitados` exige la cabecera `x-admin-key: key27102011`. Si falta o es incorrecta, devuelve inmediatamente HTTP 401 Unauthorized.
4. **Refresco Dinámico:** Al hacer clic en `#btn-refrescar-qr`, el frontend emite `'solicitar-nuevo-qr'` y muestra estado de carga. El backend invoca `refrescarQR()` recargando la sesión de Puppeteer y emitiendo el nuevo QR vía socket.

## 6. Testing Strategy
- Suite unificada en `tests/run_all.js` (23 pruebas de integración + 16 de seguridad = 39 pruebas totales).
- Ejecución obligatoria con `npm test`.

## 7. Boundaries
- **Always do:** Solicitar clave con prompt en cada apertura; validar cabeceras en endpoints protegidos; mantener flags de memoria de Puppeteer.
- **Ask first:** Modificaciones estructurales en esquemas de BD o endpoints de recordatorios.
- **Never do:** Guardar la contraseña en almacenamiento persistente del cliente; imprimir el QR en la consola de logs de Render; eliminar validaciones de seguridad.

## 8. Success Criteria
1. El QR no se imprime en los logs de la consola de Render.
2. El botón `#btn-refrescar-qr` emite `'solicitar-nuevo-qr'` y muestra "Cargando...".
3. Al hacer clic en `#admin-btn`, siempre se solicita la contraseña mediante prompt.
4. Con clave vacía o errónea, `#admin-modal` permanece en `display: none`.
5. Con `'key27102011'`, `#admin-modal` cambia a `display: flex` y carga métricas y QR.
6. `GET /api/invitados` responde 401 sin clave autorizada.
7. Todas las pruebas pasan al 100% (`npm test`).
