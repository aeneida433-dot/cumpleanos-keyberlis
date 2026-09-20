/**
 * Suite de Pruebas de Integración (23 Pruebas)
 * Normalización Telefónica, Agrupación Familiar y Base de Datos Neon
 */

const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
const { normalizePhone } = require(path.join(projectRoot, 'lib/phoneNormalizer'));
const { formatNames, buildReminderMessage } = require(path.join(projectRoot, 'cron'));
const { pool, query } = require(path.join(projectRoot, 'db'));

async function runTestSuite() {
  console.log('\n--- 1. Pruebas de Integración y Regla de Oro Telefónica (23 Pruebas) ---');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Normalización Telefónica E.164 (Argentina 13 dígitos)
  const validInputs = [
    { in: '1161034151', expected: '5491161034151' },
    { in: '01161034151', expected: '5491161034151' },
    { in: '011 15 6103 4151', expected: '5491161034151' },
    { in: '+54 9 11 6103-4151', expected: '5491161034151' },
    { in: '541161034151', expected: '5491161034151' },
    { in: '+54 9 11 15 6103 4151', expected: '5491161034151' },
    { in: '1561034151', expected: '5491161034151' },
    { in: '61034151', expected: '5491161034151' },
    { in: '351 15 1234567', expected: '5493511234567' }
  ];

  for (const item of validInputs) {
    const res = normalizePhone(item.in);
    assert(res.valid && res.formatted === item.expected && res.formatted.length === 13, `"${item.in}" normaliza a 13 dígitos "${item.expected}"`);
  }

  const invalidInputs = ['', '123', 'abc', '00000', '1234567890123456789'];
  for (const item of invalidInputs) {
    const res = normalizePhone(item);
    assert(!res.valid && !!res.error, `Inválido "${item}" es rechazado correctamente`);
  }

  // 2. Formato de Mensajes y Agrupación Familiar
  assert(formatNames(['Juan']) === 'Juan', 'Nombre único formateado');
  assert(formatNames(['Juan', 'María']) === 'Juan y María', 'Dos nombres con conjunción "y"');
  assert(formatNames(['Juan', 'María', 'Sofía']) === 'Juan, María y Sofía', 'Tres nombres con coma y "y"');

  const msgMultiple = buildReminderMessage(['Juan', 'María', 'Sofía'], 'key.2710');
  assert(
    msgMultiple.includes('¡Hola Juan, María y Sofía! Les recordamos que mañana es la gran fiesta de 15 años de Keyberlis.') &&
    msgMultiple.includes('key.2710'),
    'Mensaje consolidado para múltiples personas incluye texto y alias exacto'
  );

  const msgSingle = buildReminderMessage(['Juan'], 'key.2710');
  assert(
    msgSingle.includes('¡Hola Juan! Te recordamos que mañana es la gran fiesta de 15 años de Keyberlis.') &&
    msgSingle.includes('key.2710'),
    'Mensaje individual incluye texto singular y alias exacto'
  );

  // 3. Base de Datos Neon (Familia con mismo teléfono)
  const testPhone = '5491199990001';
  try {
    await query('DELETE FROM invitados WHERE telefono = $1', [testPhone]);

    const insertSQL = `
      INSERT INTO invitados (nombre, telefono, recordatorio_enviado)
      VALUES ($1, $2, false)
      ON CONFLICT (nombre, telefono) DO UPDATE
      SET fecha_registro = CURRENT_TIMESTAMP
      RETURNING id, nombre, telefono, recordatorio_enviado;
    `;

    const r1 = await query(insertSQL, ['Juan Test', testPhone]);
    const r2 = await query(insertSQL, ['María Test', testPhone]);
    const r3 = await query(insertSQL, ['Sofía Test', testPhone]);

    assert(r1.rows.length === 1 && r2.rows.length === 1 && r3.rows.length === 1, 'Se insertaron 3 invitados con el mismo teléfono exitosamente');

    const checkRes = await query('SELECT id, nombre, telefono FROM invitados WHERE telefono = $1 ORDER BY id ASC', [testPhone]);
    assert(checkRes.rows.length === 3, 'Los 3 registros coexisten en Neon bajo UNIQUE (nombre, telefono)');

    const phoneGroups = new Map();
    for (const inv of checkRes.rows) {
      if (!phoneGroups.has(inv.telefono)) {
        phoneGroups.set(inv.telefono, { ids: [], names: [] });
      }
      const g = phoneGroups.get(inv.telefono);
      g.ids.push(inv.id);
      g.names.push(inv.nombre);
    }

    const group = phoneGroups.get(testPhone);
    const generatedMsg = buildReminderMessage(group.names, 'key.2710');
    assert(
      generatedMsg.includes('¡Hola Juan Test, María Test y Sofía Test! Les recordamos'),
      'La agrupación consolidó los 3 nombres de la familia en un solo mensaje'
    );

    await query('UPDATE invitados SET recordatorio_enviado = true WHERE id = ANY($1::int[])', [group.ids]);
    const updatedRes = await query('SELECT recordatorio_enviado FROM invitados WHERE telefono = $1', [testPhone]);
    const allMarked = updatedRes.rows.every(r => r.recordatorio_enviado === true);
    assert(allMarked, 'Todos los integrantes de la familia marcados con recordatorio_enviado = true');

    await query('DELETE FROM invitados WHERE telefono = $1', [testPhone]);

    // 4. Prueba de Auditoría en logs_envio (Mejora 16)
    await query('DELETE FROM logs_envio WHERE telefono = $1', [testPhone]);
    await query(
      'INSERT INTO logs_envio (telefono, nombres_agrupados, mensaje_enviado) VALUES ($1, $2, $3)',
      [testPhone, 'Juan Test, María Test y Sofía Test', 'Mensaje de prueba de auditoría']
    );
    const auditCheck = await query('SELECT id, telefono, nombres_agrupados FROM logs_envio WHERE telefono = $1', [testPhone]);
    assert(auditCheck.rowCount === 1, 'Registro de auditoría insertado exitosamente en la tabla logs_envio');
    await query('DELETE FROM logs_envio WHERE telefono = $1', [testPhone]);

    // 5. Prueba de Limpieza de Sesiones Huérfanas (Mejora 19)
    const { limpiarSesionesHuerfanas } = require(path.join(projectRoot, 'cron'));
    const cleanCount = await limpiarSesionesHuerfanas();
    assert(typeof cleanCount === 'number', 'Función de limpieza de sesiones huérfanas en Neon se ejecuta correctamente');

  } catch (err) {
    console.error('Error durante prueba de base de datos:', err);
    failed++;
  }

  return { passed, failed };
}

module.exports = { runTestSuite };

if (require.main === module) {
  runTestSuite().then(({ passed, failed }) => {
    console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron.`);
    pool.end();
    process.exit(failed > 0 ? 1 : 0);
  });
}
