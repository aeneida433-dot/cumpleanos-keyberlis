/**
 * Suite de Pruebas de Seguridad y Dashboard (6 Pruebas)
 * Protección con clave key27102011 y token cumpleanos2710
 */

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

        // 3. POST /api/admin/verify-key valida clave exacta key27102011
        const verifyOk = await request('POST', '/api/admin/verify-key', { key: 'key27102011' });
        assert(verifyOk.status === 200 && verifyOk.body.success === true, 'POST /api/admin/verify-key valida key27102011 con 200 OK');

        // 4. GET /api/invitados con cabecera x-admin-key: key27102011
        const invAuth = await request('GET', '/api/invitados', null, { 'x-admin-key': 'key27102011' });
        assert(invAuth.status === 200 && Array.isArray(invAuth.body.invitados), 'GET /api/invitados autoriza acceso con clave key27102011');

        // 5. POST /api/admin/forzar-recordatorio rechaza token incorrecto (401)
        const forceFail = await request('POST', '/api/admin/forzar-recordatorio?token=token_invalido');
        assert(forceFail.status === 401, 'POST /api/admin/forzar-recordatorio rechaza token incorrecto con 401');

        // 6. POST /api/admin/forzar-recordatorio autoriza con token correcto cumpleanos2710 (200)
        const forceOk = await request('POST', '/api/admin/forzar-recordatorio?token=cumpleanos2710');
        assert(forceOk.status === 200 && forceOk.body.success === true, 'POST /api/admin/forzar-recordatorio autoriza token cumpleanos2710 con 200 OK');

        // 7. Verificación de Socket.io montado y exportado en tiempo real
        const { setSocketIO } = require(path.join(projectRoot, 'whatsapp'));
        assert(Boolean(app.io) && typeof setSocketIO === 'function', 'Socket.io está montado en el servidor HTTP y whatsapp.js exporta setSocketIO');

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
