# Spec: Limpieza Visual de Botonera y Formulario RSVP

## Objective
Simplificar y limpiar la interfaz de usuario en `index.html` y la lógica asociada en `js/app.js`:
1. Remover de la botonera superior de acciones los botones de música (disco de vinilo) y compartir por WhatsApp.
2. Mantener únicamente el botón de ajustes/configuración del anfitrión (`#admin-btn`) con su control de acceso protegido por la clave `key27102011`.
3. Eliminar del formulario RSVP los campos opcionales de "Canción que no puede faltar en la fiesta" y "Mensaje especial para Keyberlis".
4. Mantener exclusivamente los campos obligatorios: Nombre, Apellido, Teléfono WhatsApp y el selector de asistencia (Sí/No).
5. Certificar que `server.js` y `npm test` operen al 100% en verde (Green Bar).

## Tech Stack
- Frontend: HTML5, CSS3, Vanilla JavaScript ES6+
- Backend: Node.js, Express, Neon PostgreSQL
- Testing: Node assert / HTTP test suite (29 tests)

## Commands
- Ejecutar pruebas: `npm test`
- Control de versiones:
  ```bash
  git add .
  git commit -m "style(ui): remover iconos de musica/whatsapp y limpiar campos opcionales del formulario RSVP"
  git push origin main --force
  ```

## Boundaries
- **Siempre:** Preservar intacto el botón `#admin-btn` y su validación estricta de clave `key27102011`.
- **Siempre:** Preservar la validación y normalización telefónica obligatoria (E.164 Argentina +54 9, 13 dígitos).
- **Nunca:** Romper el flujo de emisión del Pase VIP ni la inserción en Neon de los asistentes confirmados.
- **Nunca:** Introducir errores de ejecución JS por referencias a elementos DOM eliminados (`null.value`).

## Success Criteria
1. En `index.html`, la sección `.top-actions` solo contiene `#admin-btn` (tres controles deslizantes).
2. En `index.html`, `#guest-song` y `#guest-message` han sido removidos del formulario `#rsvp-form`.
3. En `js/app.js`, la recolección de datos del formulario no arroja error al buscar los elementos eliminados y no envía campos obsoletos.
4. `npm test` pasa al 100% (Green Bar certificada).
5. Cambios committeados y subidos a `main` con `--force`.
