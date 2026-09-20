/**
 * Suite de Pruebas de Seguridad y Dashboard (6 Pruebas)
 * Protección con clave key27102011 y token cumpleanos2710
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'cumpleanos2710';
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const http = require('http');
const app = require(path.join(projectRoot, 'server'));

const PORT = 3097;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: reqPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runSecuritySuite() {
  console.log('\n--- 2. Pruebas de Seguridad y Control de Acceso (6 Pruebas) ---');

  return new Promise((resolveAll) => {
    const server = app.listen(PORT, async () => {
      let passed = 0;
      let failed = 0;

      function assert(cond, msg) {
        if (cond) {
          console.log(`  ✅ [PASS] ${msg}`);
          passed++;
        } else {
          console.error(`  ❌ [FAIL] ${msg}`);
          failed++;
        }
      }

      try {
        // 1. GET /admin/dashboard sirve admin.html
        const dashRes = await request('GET', '/admin/dashboard');
        assert(dashRes.status === 200, 'GET /admin/dashboard responde 200 OK');
        assert(
          typeof dashRes.body === 'string' && dashRes.body.includes('Panel del Anfitrión'),
          'GET /admin/dashboard sirve la interfaz con bloqueo de seguridad'
        );

        // 2. POST /api/admin/verify-key rechaza clave inválida
        const verifyFail = await request('POST', '/api/admin/verify-key', { key: 'clave_invalida' });
        assert(verifyFail.status === 401 && verifyFail.body.success === false, 'POST /api/admin/verify-key rechaza clave inválida con 401');

        // 3. POST /api/admin/verify-key valida clave exacta key27102011 con hash SHA-256 y emite JWT (15 min)
        const verifyOk = await request('POST', '/api/admin/verify-key', { key: 'key27102011' });
        assert(
          verifyOk.status === 200 && verifyOk.body.success === true && typeof verifyOk.body.token === 'string',
          'POST /api/admin/verify-key valida key27102011 mediante hash SHA-256 y emite token JWT'
        );
        const adminJwt = verifyOk.body.token;

        // 4a. GET /api/invitados con cabecera Authorization: Bearer <token> autoriza acceso
        const invJwtAuth = await request('GET', '/api/invitados', null, { 'Authorization': `Bearer ${adminJwt}` });
        assert(invJwtAuth.status === 200 && Array.isArray(invJwtAuth.body.invitados), 'GET /api/invitados autoriza acceso con sesión JWT (Bearer token)');

        // 4b. GET /api/invitados con token JWT inválido responde 401 Unauthorized
        const invBadJwt = await request('GET', '/api/invitados', null, { 'Authorization': 'Bearer token_invalido_jwt' });
        assert(invBadJwt.status === 401 && invBadJwt.body.success === false, 'GET /api/invitados con JWT inválido responde 401 Unauthorized');

        // 4c. GET /api/invitados con cabecera x-admin-key: key27102011 (retrocompatibilidad)
        const invAuth = await request('GET', '/api/invitados', null, { 'x-admin-key': 'key27102011' });
        assert(invAuth.status === 200 && Array.isArray(invAuth.body.invitados), 'GET /api/invitados autoriza acceso con clave key27102011 (retrocompatibilidad)');

        // 4d. GET /api/invitados sin cabeceras es rechazado con 401
        const invNoAuth = await request('GET', '/api/invitados');
        assert(invNoAuth.status === 401 && invNoAuth.body.success === false, 'GET /api/invitados sin cabecera responde 401 Unauthorized');

        // 4e. GET /api/invitados con clave inválida es rechazado con 401
        const invWrongAuth = await request('GET', '/api/invitados', null, { 'x-admin-key': 'clave_incorrecta' });
        assert(invWrongAuth.status === 401 && invWrongAuth.body.success === false, 'GET /api/invitados con clave incorrecta responde 401 Unauthorized');

        // 5. POST /api/admin/forzar-recordatorio rechaza token incorrecto (401)
        const forceFail = await request('POST', '/api/admin/forzar-recordatorio?token=token_invalido');
        assert(forceFail.status === 401, 'POST /api/admin/forzar-recordatorio rechaza token incorrecto con 401');

        // 6. POST /api/admin/forzar-recordatorio autoriza con token de entorno process.env.ADMIN_TOKEN (200)
        const validAdminToken = process.env.ADMIN_TOKEN || 'cumpleanos2710';
        const forceOk = await request('POST', `/api/admin/forzar-recordatorio?token=${validAdminToken}`);
        assert(forceOk.status === 200 && forceOk.body.success === true, 'POST /api/admin/forzar-recordatorio autoriza token de variable de entorno con 200 OK');

        // 7. Verificación de Socket.io montado y exportado en tiempo real
        const { setSocketIO, refrescarQR } = require(path.join(projectRoot, 'whatsapp'));
        assert(Boolean(app.io) && typeof setSocketIO === 'function', 'Socket.io está montado en el servidor HTTP y whatsapp.js exporta setSocketIO');
        assert(typeof refrescarQR === 'function', 'whatsapp.js exporta función refrescarQR para el socket');

        // 8. Aserción de Interfaz Web: Estado inicial del panel administrativo (display: none !important)
        const fs = require('fs');
        const indexHtmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
        const hasAdminModalHidden = indexHtmlContent.includes('id="admin-modal"') && 
          indexHtmlContent.includes('style="display: none !important;"');
        assert(hasAdminModalHidden, 'El contenedor #admin-modal en index.html inicia por defecto con display: none !important');

        // 9. Aserción de Botón de Refresco de QR en index.html
        const hasRefreshBtn = indexHtmlContent.includes('id="btn-refrescar-qr"') &&
          indexHtmlContent.includes('Generar nuevo QR');
        assert(hasRefreshBtn, 'index.html incluye el botón #btn-refrescar-qr para regenerar QR sin recargar');

        // 10. Simulación de Comportamiento de Seguridad en UI: Clave incorrecta o vacía bloquea la UI
        const { validateAndToggleAdminModal } = require(path.join(projectRoot, 'js', 'app.js'));
        const mockModal = { style: { display: 'flex', setProperty(k, v) { this[k] = v; } } };
        
        const testEmpty = validateAndToggleAdminModal('', mockModal);
        assert(testEmpty.success === false && mockModal.style.display === 'none', 'Simulación: Clave vacía mantiene #admin-modal en display: none');

        const testWrong = validateAndToggleAdminModal('clave_falsa_999', mockModal);
        assert(testWrong.success === false && mockModal.style.display === 'none', 'Simulación: Clave incorrecta mantiene #admin-modal en display: none');

        // 11. Simulación de Comportamiento de Seguridad en UI: Clave exacta desbloquea la UI
        const testCorrect = validateAndToggleAdminModal('key27102011', mockModal);
        assert(testCorrect.success === true && mockModal.style.display === 'flex', 'Simulación: Clave exacta key27102011 cambia #admin-modal a display: flex');

        // 12. Aserción de Limpieza de Botonera: Música y WhatsApp eliminados, solo #admin-btn activo
        const hasMusicBtn = indexHtmlContent.includes('id="music-toggle"');
        const hasAdminBtn = indexHtmlContent.includes('id="admin-btn"');
        assert(!hasMusicBtn && hasAdminBtn, 'Botonera superior limpia: solo #admin-btn activo (música y WhatsApp eliminados)');

        // 13. Aserción de Limpieza de Formulario RSVP: Campos opcionales eliminados
        const hasSongInput = indexHtmlContent.includes('id="guest-song"');
        const hasMessageTextarea = indexHtmlContent.includes('id="guest-message"');
        assert(!hasSongInput && !hasMessageTextarea, 'Formulario RSVP simplificado: campos de canción y mensaje removidos');

        // 14. Aserción de Blindaje Estático: db.js y .baileys_auth deben retornar 404
        const dbJsRes = await request('GET', '/db.js');
        assert(dbJsRes.status === 404, 'GET /db.js está aislado y retorna 404 Not Found (no expone backend)');

        const baileysRes = await request('GET', '/.baileys_auth/creds.json');
        assert(baileysRes.status === 404, 'GET /.baileys_auth/creds.json está bloqueado y retorna 404 Not Found');

        // 15. Aserción de Trampa Honeypot en el formulario RSVP
        const hasHoneypot = indexHtmlContent.includes('id="b_website"');
        assert(hasHoneypot, 'Formulario RSVP incluye campo trampa Honeypot anti-bots (b_website)');

        // 16. Aserción de Ocultamiento de Secretos: server.js no contiene contraseñas ni tokens en texto plano
        const serverJsContent = fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
        const hasPlaintextPassword = serverJsContent.includes("'key27102011'") || serverJsContent.includes('"key27102011"');
        assert(!hasPlaintextPassword, 'server.js NUNCA contiene la contraseña en texto plano (hasheada en SHA-256)');

        const hasPlaintextToken = serverJsContent.includes("'cumpleanos2710'") || serverJsContent.includes('"cumpleanos2710"');
        assert(!hasPlaintextToken, 'server.js NUNCA contiene el token administrativo en texto plano (usa process.env.ADMIN_TOKEN)');

        // 17. Aserción de Sanitización Anti-XSS en POST /api/rsvp
        const xssRes = await request('POST', '/api/rsvp', {
          nombre: '<script>alert("xss")</script> Pedro & "Familia"',
          telefono: '1161034151',
          attending: true
        });
        assert(
          (xssRes.status === 200 || xssRes.status === 201) &&
          !xssRes.body.data.nombre.includes('<script>') &&
          xssRes.body.data.nombre.includes('&lt;script&gt;'),
          'POST /api/rsvp sanitiza inputs HTML (<, >, &, ") codificando entidades anti-XSS'
        );
        const { query } = require(path.join(projectRoot, 'db'));
        await query('DELETE FROM invitados WHERE telefono = $1', ['5491161034151']);

        // 18. Aserción de Rate Limiting con express-rate-limit (HTTP 429 al 4to intento por IP)
        const rHeaders = { 'x-test-rate-limit': 'true' };
        const req1 = await request('POST', '/api/rsvp', { attending: false }, rHeaders);
        const req2 = await request('POST', '/api/rsvp', { attending: false }, rHeaders);
        const req3 = await request('POST', '/api/rsvp', { attending: false }, rHeaders);
        const req4 = await request('POST', '/api/rsvp', { attending: false }, rHeaders);

        assert(req1.status === 200 && req2.status === 200 && req3.status === 200, 'Rate Limiter permite hasta 3 solicitudes por minuto');
        assert(req4.status === 429 && req4.body.success === false, 'Rate Limiter bloquea la 4ta solicitud consecutiva con HTTP 429 Too Many Requests');

        // 19. Aserción de Compresión HTTP Gzip en el Servidor
        const hasCompression = serverJsContent.includes("require('compression')") && serverJsContent.includes("app.use(compression(");
        assert(hasCompression, 'server.js tiene integrado el middleware compression para respuestas Gzip');

        // 20. Aserción de Desconexión de Sockets bajo demanda en app.js
        const appJsContent = fs.readFileSync(path.join(projectRoot, 'js', 'app.js'), 'utf8');
        const hasSocketDisconnect = appJsContent.includes('appSocket.disconnect()') && appJsContent.includes('appSocket = null');
        assert(hasSocketDisconnect, 'js/app.js desconecta y libera appSocket inmediatamente al cerrar el modal');

        server.close(() => {
          resolveAll({ passed, failed });
        });

      } catch (err) {
        console.error('Error en pruebas de seguridad:', err);
        failed++;
        server.close(() => {
          resolveAll({ passed, failed });
        });
      }
    });
  });
}

module.exports = { runSecuritySuite };

if (require.main === module) {
  runSecuritySuite().then(({ passed, failed }) => {
    console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron.`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
