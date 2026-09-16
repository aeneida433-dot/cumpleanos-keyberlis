/**
 * Modulo de Normalizacion de Numeros Telefonicos (Argentina +54 9)
 * Proyecto: Invitacion 15 Anos Keyberlis
 */

function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, error: 'El numero de telefono es obligatorio y debe ser texto.' };
  }

  // 1. Eliminar todos los caracteres no numericos
  var clean = rawPhone.replace(/\D/g, '');

  if (clean.length < 8) {
    return { valid: false, error: 'El numero ingresado es demasiado corto (minimo 8 digitos).' };
  }

  // 2. Si ya empieza con 549 (formato WhatsApp Argentina)
  if (clean.startsWith('549')) {
    if (clean.length >= 12 && clean.length <= 14) {
      return { valid: true, formatted: clean };
    }
  }

  // 3. Si empieza con 54 pero sin el 9
  if (clean.startsWith('54') && !clean.startsWith('549')) {
    var withoutCountry = clean.slice(2);
    if (withoutCountry.startsWith('0')) {
      withoutCountry = withoutCountry.slice(1);
    }
    // Quitar '15' si esta en la posicion local (ej. 54 11 15 xxxxxxxx)
    if (withoutCountry.length === 12 && withoutCountry.slice(2, 4) === '15') {
      withoutCountry = withoutCountry.slice(0, 2) + withoutCountry.slice(4);
    }
    clean = '549' + withoutCountry;
    return { valid: true, formatted: clean };
  }

  // 4. Si empieza con 0 (larga distancia nacional)
  if (clean.startsWith('0')) {
    clean = clean.slice(1);
  }

  // 5. Quitar '15' de celular local si esta presente (ej: 11 15 2345 6789 -> longitud 12)
  if (clean.startsWith('11') && clean.length === 12 && clean.slice(2, 4) === '15') {
    clean = '11' + clean.slice(4);
  } else if (clean.length === 12 && clean.slice(3, 5) === '15') {
    // Para codigos de area de 3 digitos (ej: 351 15 1234567)
    clean = clean.slice(0, 3) + clean.slice(5);
  }

  // 6. Numero local de 10 digitos (ej. 11 2345 6789 o 351 123 4567)
  if (clean.length === 10) {
    clean = '549' + clean;
    return { valid: true, formatted: clean };
  }

  // 7. Si tiene 8 digitos (asumir codigo de area 11 de Buenos Aires)
  if (clean.length === 8) {
    clean = '54911' + clean;
    return { valid: true, formatted: clean };
  }

  // 8. Numero internacional ya completo (ej: +52, +55, etc.)
  if (clean.length >= 11 && clean.length <= 15) {
    return { valid: true, formatted: clean };
  }

  return {
    valid: false,
    error: 'Formato de numero no reconocido: ' + rawPhone + '. Ingrese codigo de area y celular.'
  };
}

module.exports = {
  normalizePhone: normalizePhone
};
