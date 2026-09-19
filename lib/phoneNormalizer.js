/**
 * Módulo de Normalización de Números Telefónicos (Argentina +54 9)
 * Proyecto: Invitación 15 Años Keyberlis
 * 
 * Regla: La salida debe ser exactamente de 13 dígitos internacional E.164
 * para WhatsApp de Argentina: 54911xxxxxxxx (ej: 5491161034151).
 */

function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      valid: false,
      error: 'El número de teléfono es obligatorio y debe ser texto.'
    };
  }

  // 1. Eliminar todos los caracteres no numéricos
  let clean = rawPhone.replace(/\D/g, '');

  if (clean.length < 8) {
    return {
      valid: false,
      error: 'El número ingresado es demasiado corto. Ingrese su código de área y celular.'
    };
  }

  // 2. Extraer prefijo internacional si viene presente (+54 o +549)
  if (clean.startsWith('549')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('54')) {
    clean = clean.slice(2);
  }

  // 3. Quitar '0' inicial de larga distancia si viene presente
  while (clean.startsWith('0')) {
    clean = clean.slice(1);
  }

  // 4. Quitar prefijo de celular '15'
  // Caso A: Si el usuario ingresó solo 15 seguido de 8 dígitos (ej: 1561034151 -> longitud 10)
  if (clean.startsWith('15') && clean.length === 10) {
    clean = '11' + clean.slice(2);
  }
  // Caso B: Si tiene código de área 11 + 15 + 8 dígitos (ej: 111561034151 -> longitud 12)
  else if (clean.startsWith('11') && clean.length === 12 && clean.slice(2, 4) === '15') {
    clean = '11' + clean.slice(4);
  }
  // Caso C: Código de área de 3 dígitos + 15 + 7 dígitos (ej: 351 15 1234567 -> longitud 12)
  else if (clean.length === 12 && clean.slice(3, 5) === '15') {
    clean = clean.slice(0, 3) + clean.slice(5);
  }
  // Caso D: Código de área de 4 dígitos + 15 + 6 dígitos (ej: 2966 15 123456 -> longitud 12)
  else if (clean.length === 12 && clean.slice(4, 6) === '15') {
    clean = clean.slice(0, 4) + clean.slice(6);
  }

  // 5. Si tiene 8 dígitos, asumir código de área 11 (Buenos Aires / AMBA)
  if (clean.length === 8) {
    clean = '11' + clean;
  }

  // 6. Si ahora tiene exactamente 10 dígitos (código de área + número), agregar prefijo internacional de Argentina 549
  if (clean.length === 10) {
    clean = '549' + clean;
  }

  // 7. Validación estricta final: exactamente 13 dígitos y comenzar con 549
  if (/^549\d{10}$/.test(clean)) {
    return {
      valid: true,
      formatted: clean
    };
  }

  return {
    valid: false,
    error: `El número de teléfono "${rawPhone}" no es válido para Argentina. Debe contener código de área y número de celular (formato final esperado: 13 dígitos, ej: 5491161034151).`
  };
}

module.exports = {
  normalizePhone
};
