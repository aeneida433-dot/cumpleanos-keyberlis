# Restricciones Operativas y de Calidad (CONSTRAINTS.md)

**Proyecto:** `cumpleanos-keyberlis`  
**Última Revisión:** 2026-09-19 por Equipo de Desarrollo & Anfitrión  
**Estado:** Activo y de Cumplimiento Obligatorio  

Este documento define el estándar de calidad, seguridad y límites operativos del proyecto. Cualquier agente de IA, desarrollador o proceso automatizado que trabaje sobre este repositorio debe leer este archivo y **bajo ninguna circunstancia debilitar, eludir o comentar estas restricciones**.

---

## 1. El Piso de Calidad (Floor Constraints)

* **Sin supresiones arbitrarias:** Queda estrictamente prohibido utilizar comentarios de supresión (`// @ts-ignore`, `eslint-disable`, etc.) para ocultar advertencias o errores.
* **Sin stubs incompletos:** Prohibido dejar funciones no implementadas con `throw new Error("Not implemented")` o bloques `catch (err) {}` vacíos que silencien excepciones sin registrarlas en el log.
* **Sin saltarse pruebas:** Queda prohibido añadir `.skip` a las pruebas automatizadas, borrarlas o deshabilitar aserciones para forzar un commit verde.
* **Sin secretos en código:** Las cadenas de conexión, tokens y credenciales deben permanecer en `.env` o en las variables de entorno de Render, nunca en el repositorio público.
* **Inmutabilidad del contrato:** Este archivo no se modifica ni se relaja para hacer pasar un cambio defectuoso.

---

## 2. Restricciones Enforzadas con Mediciones y Comandos

| Dimensión | Restricción Estricta | Verificado por | Momento de Ejecución |
|---|---|---|---|
| **1. Límite de Memoria** | Uso de RAM de Node.js + Chromium ≤ **512 MB** (Límite Render Free). Flags estrictos: `--js-flags=--max-old-space-size=256`, `--disable-gpu`, `--disable-dev-shm-usage`. Ante riesgo de OOM, detener y optimizar flags. | `whatsapp.js` args + logs de Render | Arranque y ejecución continua |
| **2. Integridad de Seguridad** | Prohibido alterar, eludir o eliminar los validadores de la contraseña **`key27102011`** en `/admin/dashboard` y del token **`cumpleanos2710`** en `/api/admin/forzar-recordatorio`. Cualquier cambio exige ejecución de la suite. | `node tests/test_admin_dashboard.js` | En cada edición y pre-commit |
| **3. Regla de Oro Telefónica** | Ningún registro puede insertarse en Neon sin pasar por `lib/phoneNormalizer.js` y certificar exactamente **13 dígitos numéricos E.164** para Argentina (`54911xxxxxxxx`). Inválidos devuelven HTTP 400. | `node tests/test_suite.js` | En cada petición RSVP y pre-commit |
| **4. Green Bar (Control de Pruebas)** | Prohibido hacer commit o push a la rama `main` si las **29 pruebas automatizadas** no están al 100% en estado `[PASS]`. | `npm test` (`tests/run_all.js`) | Pre-commit y antes de cada push |

---

## 3. Detalle de Reglas Operativas

### 3.1. Límite Estricto de Memoria en Render (<512MB RAM)
En la capa gratuita de Render, sobrepasar 512MB de memoria RAM provoca la terminación inmediata del contenedor por *Out Of Memory (OOM Killer)*.
* Puppeteer debe correr siempre en modo headless con flags de reducción de memoria:
  `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-accelerated-2d-canvas`, `--no-first-run`, `--disable-gpu`, `--disable-extensions`, `--disable-default-apps`, `--js-flags=--max-old-space-size=256`, `--disable-blink-features=AutomationControlled`.
* Si se detecta un pico de memoria o reinicio inesperado, se debe pausar la sincronización intensiva y revisar fugas en listeners de eventos.

### 3.2. Integridad de Seguridad de la Administración
* La pantalla `/admin/dashboard` debe exigir de forma mandatoria la clave `key27102011`.
* El endpoint `POST /api/admin/forzar-recordatorio` debe exigir de forma mandatoria `?token=cumpleanos2710`.
* Ninguna actualización de código puede relajar estas comprobaciones a booleanos fijos `true` ni aceptar tokens vacíos.

### 3.3. Regla de Oro Telefónica y Base de Datos Neon
* Toda confirmación afirmativa en `POST /api/rsvp` debe ser procesada por `normalizePhone()`.
* Formato obligatorio resultante: `^549\d{10}$` (exactamente 13 dígitos).
* Si el teléfono no es apto para WhatsApp Argentina, la API debe responder con código `HTTP 400 Bad Request`.
* La base de datos Neon debe respetar la restricción `UNIQUE (nombre, telefono)` para habilitar que familias completas se registren con el mismo celular sin sobrescribir datos.

### 3.4. Green Bar Obligatoria antes de Deploy
* El comando canónico de validación es:
  ```bash
  npm test
  ```
* Este comando ejecuta las **23 pruebas de integración** y las **pruebas de seguridad**, certificando:
  1. Que todas las variantes de números argentinos se normalicen a 13 dígitos.
  2. Que los números inválidos sean rechazados con error.
  3. Que la base de datos Neon guarde familias agrupadas bajo el mismo teléfono.
  4. Que el mensaje consolidado se arme con todos los nombres de la familia.
  5. Que `/admin/dashboard` y `/api/admin/verify-key` rechacen claves falsas con 401 y acepten `key27102011` con 200.
  6. Que `/api/admin/forzar-recordatorio` rechace tokens erróneos con 401 y autorice con `cumpleanos2710`.
* **Si una sola prueba falla, el push a GitHub queda estrictamente vetado.**

---

## 4. Excepciones
Actualmente **no existen excepciones concedidas**. Cualquier excepción temporal deberá registrarse en esta tabla con motivo, responsable y fecha de expiración.

| ID | Regla Afectada | Ruta / Archivo | Motivo | Responsable | Vence |
|---|---|---|---|---|---|
| — | Ninguna | — | — | — | — |
