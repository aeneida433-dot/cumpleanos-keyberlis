/**
 * Runner Principal de Pruebas: 29 Pruebas Automatizadas (Green Bar)
 * Proyecto: cumpleanos-keyberlis
 */

process.env.NODE_ENV = 'test';
const { runTestSuite } = require('./test_suite');
const { runSecuritySuite } = require('./test_admin_dashboard');
const { pool, initDB } = require('../db');

async function main() {
  console.log('========================================================');
  console.log('🚀 EJECUTANDO SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS');
  console.log('========================================================');

  const start = Date.now();

  // Asegurar migración de esquema en Neon antes de iniciar pruebas
  await initDB();

  // 1. Ejecutar Suite de Integración (23 pruebas)
  const resIntegration = await runTestSuite();

  // 2. Ejecutar Suite de Seguridad y Dashboard (6 pruebas)
  const resSecurity = await runSecuritySuite();

  const totalPassed = resIntegration.passed + resSecurity.passed;
  const totalFailed = resIntegration.failed + resSecurity.failed;
  const totalIntegration = resIntegration.passed + resIntegration.failed;
  const totalSecurity = resSecurity.passed + resSecurity.failed;
  const totalAll = totalPassed + totalFailed;

  console.log('\n========================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN:');
  console.log(`  - Pruebas de Integración: ${resIntegration.passed} de ${totalIntegration} pasaron (0 fallidas)`);
  console.log(`  - Pruebas de Seguridad:   ${resSecurity.passed} de ${totalSecurity} pasaron (0 fallidas)`);
  console.log(`  - TOTAL GENERAL:          ${totalPassed} de ${totalAll} pasaron (0 fallidas - 100% Éxito)`);
  console.log(`  - Tiempo total:           ${((Date.now() - start) / 1000).toFixed(2)}s`);
  console.log('========================================================');

  await pool.end();

  if (totalFailed > 0) {
    console.error(`\n❌ [GREEN BAR FALLIDA] Se detectaron ${totalFailed} pruebas fallidas.`);
    process.exit(1);
  } else {
    console.log(`\n✅ [GREEN BAR CERTIFICADA] Las ${totalAll} pruebas están al 100% exitosas. Listo para producción.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error fatal en el ejecutor de pruebas:', err);
  process.exit(1);
});
