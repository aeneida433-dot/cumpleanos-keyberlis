/**
 * Runner Principal de Pruebas: 29 Pruebas Automatizadas (Green Bar)
 * Proyecto: cumpleanos-keyberlis
 */

const { runTestSuite } = require('./test_suite');
const { runSecuritySuite } = require('./test_admin_dashboard');
const { pool } = require('../db');

async function main() {
  console.log('========================================================');
  console.log('🚀 EJECUTANDO SUITE COMPLETA DE PRUEBAS (29 PRUEBAS)');
  console.log('========================================================');

  const start = Date.now();

  // 1. Ejecutar Suite de Integración (23 pruebas)
  const resIntegration = await runTestSuite();

  // 2. Ejecutar Suite de Seguridad y Dashboard (6 pruebas)
  const resSecurity = await runSecuritySuite();

  const totalPassed = resIntegration.passed + resSecurity.passed;
  const totalFailed = resIntegration.failed + resSecurity.failed;
  const totalExpected = 29;

  console.log('\n========================================================');
  console.log('📊 RESUMEN DE EJECUCIÓN:');
  console.log(`  - Pruebas de Integración: ${resIntegration.passed}/23 pasaron`);
  console.log(`  - Pruebas de Seguridad:   ${resSecurity.passed}/6 pasaron`);
  console.log(`  - TOTAL GENERAL:          ${totalPassed}/${totalExpected} pasaron (${totalFailed} fallidas)`);
  console.log(`  - Tiempo total:           ${((Date.now() - start) / 1000).toFixed(2)}s`);
  console.log('========================================================');

  await pool.end();

  if (totalFailed > 0 || totalPassed < totalExpected) {
    console.error(`\n❌ [GREEN BAR FALLIDA] Se detectaron ${totalFailed} pruebas fallidas o incompletas.`);
    process.exit(1);
  } else {
    console.log('\n✅ [GREEN BAR CERTIFICADA] Las 29 pruebas están al 100% exitosas. Listo para producción.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error fatal en el ejecutor de pruebas:', err);
  process.exit(1);
});
