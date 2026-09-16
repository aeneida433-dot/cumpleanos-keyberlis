# Especificación Técnica Definitiva: Sistema de Invitación Digital y Automatización 15 Años (Keyberlis)

**Document ID:** SPEC-KEYBERLIS-15  
**Version:** 1.0.0  
**Stack:** Node.js (v20+ LTS), Express, Neon PostgreSQL, @whiskeysockets/baileys, node-cron, Render, UptimeRobot  
**Status:** DRAFT FOR APPROVAL  

---

## 1. Resumen Ejecutivo y Objetivos

El sistema tiene como objetivo centralizar la confirmación de asistencia (RSVP) para la fiesta de 15 años de **Keyberlis** (Sábado 07 de Noviembre de 2026, 21:00 a 06:00 en French 10551), almacenar los registros en una base de datos PostgreSQL Serverless en **Neon**, mantener el servicio activo 24/7 en el tier gratuito de **Render** mediante **UptimeRobot**, y proveer un motor automatizado de **WhatsApp** para recordatorios programados el **6 de Noviembre a las 12:00 PM** con alias de regalo (`key.2710`).

---

## 2. Mapa de Capacidades y Dependencias (Capability Map)

```mermaid
graph TD
    A[Frontend Web: index.html] -->|POST /api/rsvp| B[API Server: Express.js]
    Uptime[UptimeRobot Monitor] -->|GET /ping| B
    B -->|Conexión Pooling| C[(Neon PostgreSQL: tabla 'invitados')]
    B -->|Gestión de Sesión & QR| D[Módulo WhatsApp: Baileys]
    E[Cron Scheduler: node-cron] -->|Disparo 06-Nov 12:00 PM| C
    E -->|Envío de Recordatorios en Cola| D
    D -->|Mensajería WhatsApp| Guests[Teléfonos de Invitados]
```

| Módulo ID | Responsabilidad | Dependencias |
|---|---|---|
| `db-neon` | Esquema DDL, conexión segura SSL, queries de inserción y consulta | Neon Postgres |
| `api-server` | Endpoints REST (`/api/rsvp`, `/ping`), validación Zod, middleware CORS | `db-neon` |
| `whatsapp-engine` | Autenticación multi-device QR, socket keepalive, despacho de mensajes con delay | Sistema de archivos local / multi-auth |
| `reminder-cron` | Temporizador programado para el 06-Nov 12:00 PM, cola de despacho secuencial | `db-neon`, `whatsapp-engine` |

---

## 3. Decisiones de Arquitectura y Supuestos

### 3.1. Elección de Motor WhatsApp: Baileys vs Puppeteer
> [!IMPORTANT]
> **Decisión Crítica para Render Free Tier:**
> En el plan gratuito de Render, el límite de memoria RAM es de **512 MB**. Las librerías basadas en navegador headless (como `whatsapp-web.js` con Puppeteer/Chromium) consumen entre 400 MB y 700 MB, provocando caídas por *Out Of Memory (OOM)*.
> Por ello, se especifica `@whiskeysockets/baileys`, el cual se comunica directamente mediante WebSockets sin navegador, consumiendo apenas **~45 MB de RAM**, garantizando estabilidad continua en Render.

### 3.2. Zona Horaria y Precisión
- Zona horaria de referencia: `America/Argentina/Buenos_Aires` (o timezone local del evento `-03:00`).
- Disparo del recordatorio: `2026-11-06 12:00:00 UTC-3`.

---

## 4. Especificación de Base de Datos (Neon PostgreSQL)

### 4.1. Esquema DDL de la Tabla `invitados`
```sql
CREATE TABLE IF NOT EXISTS invitados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    verificado BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_invitados_telefono UNIQUE (telefono)
);

CREATE INDEX IF NOT EXISTS idx_invitados_telefono ON invitados(telefono);
CREATE INDEX IF NOT EXISTS idx_invitados_verificado ON invitados(verificado);
```

### 4.2. Contrato de Datos (`Invitado`)
| Campo | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `INTEGER` (Serial) | No | Auto | Clave primaria |
| `nombre` | `VARCHAR(120)` | No | - | Nombre y apellido del invitado |
| `telefono` | `VARCHAR(30)` | No | - | Número normalizado en formato E.164 (ej: `54911xxxxxxxx`) |
| `verificado`| `BOOLEAN` | No | `false` | Indica si confirmó formalmente |
| `fecha_registro` | `TIMESTAMPTZ` | No | `NOW()` | Timestamp con zona horaria de creación |

---

## 5. Especificación de Interfaz de API (REST API)

### 5.1. Endpoint: Registrar Asistencia
- **Ruta:** `POST /api/rsvp`
- **Headers:** `Content-Type: application/json`
- **Contrato de Solicitud (Zod Schema):**
```typescript
interface RSVPRequest {
  nombre: string;     // min 2 caracteres, max 120
  telefono: string;   // solo dígitos, min 8, max 20 caracteres (normalizado)
}
```
- **Ejemplo Payload:**
```json
{
  "nombre": "Carlos Gómez",
  "telefono": "5491123456789"
}
```

- **Respuestas:**
  - `201 Created`:
  ```json
  {
    "success": true,
    "message": "Registro completado con éxito",
    "data": {
      "id": 14,
      "nombre": "Carlos Gómez",
      "telefono": "5491123456789",
      "verificado": false,
      "fecha_registro": "2026-09-16T15:30:00.000Z"
    }
  }
  ```
  - `409 Conflict` (Teléfono ya registrado previamente - Idempotencia):
  ```json
  {
    "success": true,
    "message": "El invitado ya se encuentra registrado",
    "data": { "id": 14, "nombre": "Carlos Gómez", "telefono": "5491123456789" }
  }
  ```
  - `422 Unprocessable Entity` (Error de validación):
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Datos inválidos",
      "details": [
        { "field": "telefono", "issue": "El formato del teléfono es inválido" }
      ]
    }
  }
  ```

### 5.2. Endpoint: Ping / Keep-Alive (UptimeRobot)
- **Ruta:** `GET /ping`
- **Propósito:** Responder inmediatamente con status HTTP 200 cada 5 o 10 minutos para evitar que Render congele el contenedor.
- **Respuesta `200 OK`:**
```json
{
  "status": "healthy",
  "service": "keyberlis-15-backend",
  "uptime": 86400,
  "timestamp": "2026-09-16T15:30:00.000Z"
}
```

### 5.3. Endpoints Administrativos de WhatsApp
- `GET /api/whatsapp/qr`: Genera y sirve el código QR de vinculación en pantalla o imagen PNG para sincronizar el WhatsApp de la quinceañera.
- `GET /api/whatsapp/status`: Devuelve `{ "connected": true, "user": "..." }` o `{ "connected": false }`.
- `POST /api/whatsapp/test-reminder`: Permite al anfitrión probar el envío con un único número de control antes de la fecha oficial.

---

## 6. Módulo de Automatización de WhatsApp

1. **Persistencia de Sesión (`useMultiFileAuthState`):**
   - Las credenciales de sesión se guardan de manera segura en un directorio local (`./auth_info_baileys/`).
   - El socket reconecta automáticamente ante caídas de red o reinicios de contenedor.
2. **Generación de QR en Vivo:**
   - Si no existe sesión activa, se captura el evento `connection.update` con el parámetro `qr` y se expone en la web administrativa para escanear desde la app de WhatsApp.
3. **Mecanismo Anti-Ban / Rate Limiting:**
   - Pausa aleatoria controlada de **3 a 7 segundos** entre cada mensaje enviado durante la campaña de recordatorios para evitar bloqueos por spam masivo.

---

## 7. Programador de Recordatorios (Cron Job)

### 7.1. Especificación del Trigger
- **Expresión Cron:** `0 12 6 11 *` (Minuto 0, Hora 12, Día 6, Mes 11).
- **Timezone:** `America/Argentina/Buenos_Aires`.
- **Timestamp ISO:** `2026-11-06T12:00:00-03:00`.

### 7.2. Lógica de Ejecución
1. Conectar a Neon PostgreSQL y ejecutar:
   ```sql
   SELECT id, nombre, telefono FROM invitados ORDER BY id ASC;
   ```
2. Iterar la lista en cola secuencial con rate limiting.
3. Formatear y despachar el mensaje:
   ```text
   ¡Hola! Te recordamos que mañana es la gran fiesta de 15 años. Por favor, confirma tu asistencia. Si deseas realizar un presente, puedes hacerlo en efectivo a nuestro alias: [key.2710]
   ```
4. Registrar log del estado de entrega (`SENT`, `FAILED`).

---

## 8. Despliegue en Render y Configuración de UptimeRobot

### 8.1. Variables de Entorno (`.env`)
```bash
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxxx.neon.tech/neondb?sslmode=require
TIMEZONE=America/Argentina/Buenos_Aires
ADMIN_TOKEN=secret_token_keyberlis
```

### 8.2. Comandos de Render
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

### 8.3. Configuración de UptimeRobot
- **Tipo de Monitor:** `HTTP(s)`
- **URL:** `https://tu-app-en-render.onrender.com/ping`
- **Intervalo de Monitoreo:** Cada `5 minutos` (evita los 15 minutos de inactividad de Render).

---

## 9. Criterios de Aceptación y Éxito (Success Criteria)

1. **Persistencia Neon:** Un envío desde el formulario web almacena nombre, teléfono, `verificado = false` y timestamp en Neon.
2. **Uptime 24/7:** La ruta `/ping` responde en `< 50ms` manteniendo el servicio despierto en Render.
3. **Escaneo QR de WhatsApp:** El anfitrión puede escanear el QR desde su teléfono y la sesión se mantiene activa.
4. **Despacho del 6 de Noviembre:** Al simular o alcanzar el 6 de noviembre a las 12:00 PM, el script consulta todos los invitados de Neon y envía el mensaje con el alias `key.2710`.
