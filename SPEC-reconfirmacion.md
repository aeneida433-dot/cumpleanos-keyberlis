# Especificación Técnica: Doble Check de Asistencia, Enlace UUID de Reconfirmación y Borrado de Invitados

**Módulo ID:** `reconfirmation-flow`  
**Proyecto:** `cumpleanos-keyberlis`  
**Estado:** PENDING APPROVAL  
**Versión:** 1.0.0  

---

## 1. Objetivo y Alcance

Implementar un flujo de confirmación en dos etapas (Doble Check) y gestión de asistentes:
1. **Check 1 (RSVP Inicial):** Registro inicial en la web con asignación de un identificador criptográfico opaco (`token_reconfirmacion UUID v4`).
2. **Mensaje Cron Job WhatsApp (06 de Noviembre):** Despacho automatizado vía Baileys incluyendo el enlace personalizado inviolable `https://cumpleanos-keyberlis.onrender.com/reconfirmar?token=UUID`.
3. **Check 2 (Reconfirmación y Pase Definitivo):** Al acceder al link, el invitado reconfirma asistencia, se actualiza Neon PostgreSQL (`reconfirmado = TRUE`) y se le presenta en pantalla su **Pase de Acceso Definitivo VIP** con código QR.
4. **Gestión en Panel del Anfitrión:** Visualización del estado del doble check y acción de borrado físico permanente con diálogo previo de confirmación (`DELETE FROM invitados WHERE id = $1`).

---

## 2. Cambios en Base de Datos (Neon PostgreSQL)

```sql
-- Columnas para soporte de Doble Check
ALTER TABLE invitados ADD COLUMN IF NOT EXISTS token_reconfirmacion UUID DEFAULT gen_random_uuid();
ALTER TABLE invitados ADD COLUMN IF NOT EXISTS reconfirmado BOOLEAN DEFAULT FALSE;
ALTER TABLE invitados ADD COLUMN IF NOT EXISTS fecha_reconfirmacion TIMESTAMP;

-- Índice único para búsqueda instantánea por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitados_token ON invitados(token_reconfirmacion);
```

---

## 3. Endpoints del Backend

### 3.1. `GET /reconfirmar`
- Sirve la vista `reconfirmar.html`.

### 3.2. `POST /api/reconfirmar/:token`
- **Entrada:** Parámetro `token` en formato UUID v4.
- **Acción:**
  ```sql
  UPDATE invitados 
  SET reconfirmado = TRUE, fecha_reconfirmacion = CURRENT_TIMESTAMP 
  WHERE token_reconfirmacion = $1 
  RETURNING id, nombre, telefono, reconfirmado, fecha_reconfirmacion;
  ```
- **Respuesta 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "id": 110,
      "nombre": "Giovanni Restrepo",
      "telefono": "5491166496150",
      "reconfirmado": true,
      "fecha_reconfirmacion": "2026-11-06T15:30:00Z"
    }
  }
  ```
- **Respuesta 404:** Token no válido o no encontrado.

### 3.3. `DELETE /api/invitados/:id`
- **Seguridad:** Requiere cabecera `Authorization: Bearer <JWT_ADMIN>` o `x-admin-key: key27102011`.
- **Acción:** `DELETE FROM invitados WHERE id = $1 RETURNING id, nombre`.
- **Respuesta 200 OK:** `{"success": true, "message": "Invitado eliminado exitosamente", "id": 110}`.
- **Respuesta 401 Unauthorized:** Si no se suministra token o la clave es incorrecta.

---

## 4. Frontend y Experiencia de Usuario

### 4.1. Vista `reconfirmar.html` (Pase de Acceso Definitivo)
- Extrae el token de los parámetros de la URL (`window.location.search`).
- Ejecuta `POST /api/reconfirmar/${token}`.
- Al confirmar con éxito:
  - Muestra animación de confeti.
  - Genera la tarjeta holográfica VIP con el título **PASE DE ACCESO DEFINITIVO - ASISTENCIA RECONFIRMADA**.
  - Muestra el nombre del invitado, fecha de la fiesta (Sábado 07 de Noviembre de 2026), horario y lugar (French 10351 Libertador).
  - Genera el código QR de acreditación.
  - Ofrece botón para guardar/descargar la tarjeta.

### 4.2. Panel del Anfitrión (`index.html`, `admin.html`, `js/app.js`)
- En la tabla de invitados:
  - Nueva columna con botón de papelera (`<button class="btn-delete-guest" data-id="...">🗑️</button>`).
  - Badge dinámico de doble check:
    - Si `reconfirmado = true`: `✅ Reconfirmado`
    - Si `recordatorio_enviado = true` y `!reconfirmado`: `⏳ Recordatorio Enviado`
    - Si `!recordatorio_enviado`: `⚪ Registrado (Pendiente WhatsApp)`
- Confirmación previa al borrar:
  ```javascript
  if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${guest.nombre}?`)) {
    // Llamada protegida DELETE /api/invitados/:id
  }
  ```

---

## 5. Criterios de Aceptación y Pruebas

- [ ] Todas las inserciones en `invitados` generan un `token_reconfirmacion UUID` único.
- [ ] La consulta por token es instantánea y a prueba de manipulaciones o adivinación de IDs.
- [ ] Acceder al enlace de reconfirmación actualiza en Neon `reconfirmado = true` de forma idempotente.
- [ ] El endpoint `DELETE /api/invitados/:id` rechaza solicitudes no autorizadas con 401 y elimina el registro en Neon cuando está autorizado.
- [ ] La suite de pruebas de `npm test` pasa al 100% con las nuevas validaciones.
