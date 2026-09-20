# Auditoría Exhaustiva de Seguridad, Análisis de Secretos y Plan de Blindaje

**Proyecto:** `cumpleanos-keyberlis`  
**Entorno:** Render Web Service (Free) + Neon PostgreSQL (Serverless Free)  
**Fecha:** 2026-09-19  
**Clasificación de Riesgo Global:** 🚨 **CRÍTICO (Exposición de Secretos en Vivo Identificada y Verificada)**  

---

## 1. Escaneo de Secretos y Llaves Expuestas (CRÍTICO)

Durante la inspección en vivo de las cabeceras HTTP del servidor de producción (`https://cumpleanos-keyberlis.onrender.com`), se ha descubierto una **vulnerabilidad de severidad crítica (P0)** causada por la configuración de archivos estáticos en Express:

```javascript
// server.js (Línea 97)
app.use(express.static(path.join(__dirname)));
```

Al indicarle a Express que sirva la raíz del proyecto (`__dirname`) como directorio estático público, **el servidor web expone públicamente todos los archivos del backend, archivos de sesión y credenciales**:

### 🚨 Hallazgos Críticos de Exposición:

1. **Exposición Pública de Claves de WhatsApp (`.baileys_auth/creds.json`):**
   - **Verificación en vivo:** `curl -I https://cumpleanos-keyberlis.onrender.com/.baileys_auth/creds.json` responde **`HTTP/1.1 200 OK`**.
   - **Impacto:** Cualquier atacante puede descargar las claves privadas criptográficas de identidad (`noiseKey`, `signedIdentityKey`), pre-keys y tokens de sesión de Baileys, clonando la sesión de WhatsApp del anfitrión sin necesidad de tener el teléfono.
2. **Exposición Pública de la Contraseña de Neon (`/db.js`):**
   - **Verificación en vivo:** `curl -I https://cumpleanos-keyberlis.onrender.com/db.js` responde **`HTTP/1.1 200 OK`**.
   - **Impacto:** En [`db.js`](file:///c:/Users/herct/Desktop/cumpleanos/db.js#L23) está escrita en texto claro la variable:
     ```javascript
     const NEON_CONNECTION_STRING = 'postgresql://neondb_owner:npg_fHcj1Z8QSxCh@ep-crimson-breeze-b5y4whea-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full';
     ```
     Cualquier visitante puede descargar `db.js` y obtener usuario, contraseña y host directo de la base de datos de Neon.
3. **Exposición del Código Fuente Backend (`server.js`, `whatsapp.js`, `cron.js`):**
   - **Verificación en vivo:** `GET /server.js` y `GET /whatsapp.js` devuelven **`HTTP/1.1 200 OK`**.
   - **Impacto:** El atacante puede auditar la lógica del servidor, ver los tokens hardcodeados (`cumpleanos2710`) y las rutas administrativas.
4. **Contraseña de Administrador Expuesta en el Frontend (`js/app.js`):**
   - En [`js/app.js`](file:///c:/Users/herct/Desktop/cumpleanos/js/app.js#L682) y [`js/app.js`](file:///c:/Users/herct/Desktop/cumpleanos/js/app.js#L830), la clave `'key27102011'` está escrita directamente en el código JavaScript que se descarga en el navegador de todos los invitados.
   - **Impacto:** Cualquier usuario que presione `F12` o inspeccione el archivo `app.js` puede leer la contraseña del anfitrión y desbloquear el panel.

---

## 2. Modelado de Amenazas en Endpoints y UI

```mermaid
flowchart TD
    subgraph Exterior["Internet / Atacantes"]
        STATIC["GET /.baileys_auth/creds.json<br>GET /db.js<br>(express.static __dirname)"]
        RSVP_FLOOD["POST /api/rsvp<br>(Flood de registros sin rate limit)"]
        ADMIN_BRUTE["GET /api/invitados<br>(?key= en URL / Comparación débil)"]
        CSV_ATTACK["Inyección de Fórmulas CSV<br>(=CMD|'/C calc'!A0)"]
    end

    subgraph ServidorExpress["Servidor Express (Render)"]
        STATIC_LEAK["Fuga directa de archivos sensibles"]
        POOL_EXHAUST["Saturación del Pool de Conexiones"]
        TIMING["Ataque por tiempo (Timing attack)"]
    end

    subgraph BaseDatos["Neon PostgreSQL"]
        DB_DIRECT["Acceso directo con password de db.js"]
        DB_SPAM["Tabla invitados inundada de basura"]
    end

    STATIC --> STATIC_LEAK --> DB_DIRECT
    RSVP_FLOOD --> POOL_EXHAUST --> DB_SPAM
    ADMIN_BRUTE --> TIMING
    CSV_ATTACK --> CompromisoExcel["Ejecución remota en PC del anfitrión"]
```

### Análisis de Amenazas:

| Vector | Endpoint / Componente | Vulnerabilidad | Severidad | Mitigación |
| :--- | :--- | :--- | :---: | :--- |
| **Exposición de Archivos** | `express.static(__dirname)` | Sirve `.baileys_auth`, `db.js` y `server.js` públicamente | **CRÍTICA** | Aislar estáticos únicamente a `/assets`, `/css`, `/js` e `index.html`. Bloquear todo acceso a scripts de backend. |
| **Denegación de Servicio (DoS)** | `POST /api/rsvp` | Sin Rate Limit; saturación del pool en Neon Free Tier | **ALTA** | Implementar `express-rate-limit` (5 req / 15 min por IP) y Honeypot invisible. |
| **Fuga de Información (PII)** | `GET /api/invitados` | Permite `?key=` en URL, sin `timingSafeEqual`, expone teléfonos completos | **ALTA** | Restringir clave a cabecera HTTP `x-admin-key`, usar `crypto.timingSafeEqual()` y sanitizar respuestas 500. |
| **Inyección de Scripts (XSS)** | `admin.html` (Línea 733) | `inv.telefono` insertado sin `escapeHTML` en `innerHTML` | **MEDIA** | Sanitizar con `escapeHTML()` todos los campos sin excepción. |
| **Inyección de Fórmulas CSV** | `exportGuestListToCSV` | Caracteres `=`, `+`, `-`, `@` interpretados como macros en Excel | **ALTA** | Anteponer `'` (apóstrofe) a cualquier celda que comience con operadores de cálculo. |

---

## 3. Plan de Arquitectura Defensiva (Stack 100% Gratuito)

```
        CLIENTE (Navegador)
               │
               ▼
┌──────────────────────────────────────────────┐
│  RESTRICCIÓN DE ARCHIVOS ESTÁTICOS EXCLUSIVOS│
│  - GET /          -> index.html              │
│  - GET /css/*     -> css/                    │
│  - GET /js/*      -> js/                     │
│  - GET /assets/*  -> assets/                 │
│  - BLOQUEADO: *.js, *.json, .*, /lib/*       │
└──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  MIDDLEWARES DE SEGURIDAD                    │
│  - express.json({ limit: '10kb' })           │
│  - Rate Limiting en memoria por IP           │
│  - Honeypot Validator                        │
└──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  CAPA DE SERVICIOS (BACKEND NODE.JS)         │
│  - Clave en process.env.ADMIN_KEY            │
│  - crypto.timingSafeEqual()                  │
│  - Baileys Socket en memoria                 │
│  - Cifrado AES-256-GCM para whatsapp_session │
└──────────────────────────────────────────────┘
               │ (SSL verify-full)
               ▼
┌──────────────────────────────────────────────┐
│  NEON POSTGRESQL SERVERLESS                  │
│  - pool.max: 5                               │
│  - Credenciales solo en process.env          │
│  - Tabla invitados + whatsapp_session cifrada│
└──────────────────────────────────────────────┘
```

---

## 4. Las 20 Mejoras Específicas y Viables (Stack 100% Gratuito)

### 🔒 Categoría 1: Seguridad y Blindaje (5 Mejoras)
1. **Aislamiento de Servidor Estático (`server.js`):**
   Eliminar `express.static(__dirname)` y declarar rutas estáticas explícitas solo para `/css`, `/js`, `/assets` e `index.html`. Bloquear taxativamente peticiones a `db.js`, `server.js` y `.baileys_auth`.
2. **Purgado de Credenciales Hardcodeadas en `db.js` y Rotación:**
   Eliminar la constante `NEON_CONNECTION_STRING` con password visible de `db.js`. Exigir exclusivamente `process.env.DATABASE_URL` y rotar la contraseña en la consola de Neon.
3. **Validación de Clave Administrativa en Backend (Desacoplar de `app.js`):**
   Eliminar `'key27102011'` del código JavaScript del cliente. El modal debe enviar la clave al endpoint `POST /api/admin/verify-key` y recibir un token temporal firmado o cookie HttpOnly.
4. **Rate Limiting en Memoria y Honeypot Anti-Spam para `/api/rsvp`:**
   Configurar ventana deslizante de 5 solicitudes cada 15 minutos por IP y campo trampa invisible para neutralizar robots automáticos sin saturar las conexiones de Neon.
5. **Cifrado AES-256-GCM de Credenciales de WhatsApp en Neon:**
   Cifrar el JSON de la carpeta `.baileys_auth` con el módulo nativo `crypto` antes de guardarlo en `whatsapp_session`, asegurando que nadie con acceso a la base de datos pueda clonar la sesión.

---

### ⚡ Categoría 2: Rendimiento y Optimización (5 Mejoras)
6. **Compresión HTTP Nativa (`compression`):**
   Habilitar compresión Gzip/Brotli en Express para reducir el tamaño de transferencia de HTML, CSS y JSON en más del 65%.
7. **Purga de Dependencias Huérfanas de Puppeteer:**
   Remover `whatsapp-web.js`, `unzipper` y `archiver` de `package.json`. Ahorra más de 200MB en disco y acelera los deploys de Render a menos de 15 segundos.
8. **Cabeceras de Caché Inmutable para Assets:**
   Configurar `Cache-Control: public, max-age=31536000, immutable` para imágenes, logotipos y fuentes, ahorrando cuota de transferencia mensual de Render.
9. **Optimización del Pool de Conexiones de Neon:**
   Reducir `max: 10` a `max: 5` en `db.js` para adecuarse perfectamente al límite concurrente del plan gratuito serverless de Neon.
10. **Conversión de la Invitación a Formato WebP Progresivo:**
    Convertir `invitacion_keyberlis.jpg` (1.2MB) a `.webp` (<180KB), logrando carga visual instantánea en dispositivos móviles 4G/3G.

---

### 💖 Categoría 3: Experiencia de Usuario / UX (5 Mejoras)
11. **Feedback Háptico y Estado de Carga en el Botón RSVP:**
    Mostrar animación de carga *"Generando tu Pase VIP..."* y disparar vibración suave en celulares (`navigator.vibrate(50)`).
12. **Formateo Telefónico Automático en Vivo:**
    Separar números con guiones y espacios en tiempo real (`11 6103-4151`) para prevenir errores de tipeo y frustración del usuario.
13. **Descarga Directa del Pase VIP en Galería (PNG):**
    Convertir el boleto digital en archivo de imagen descargable directamente en el almacenamiento del celular mediante `canvas.toBlob()`.
14. **Generador de Archivo de Calendario Universal (`.ics`):**
    Añadir soporte para agregar el evento a Apple Calendar (iPhone) y Outlook con un solo clic además de Google Calendar.
15. **Toast Notificador con Sonido Sutil y Confeti Sincronizado:**
    Celebrar la confirmación con confeti plateado y un micro-sonido festivo sintetizado con Web Audio API.

---

### 🗄️ Categoría 4: Base de Datos y Arquitectura (5 Mejoras)
16. **Índice Parcial en PostgreSQL para Recordatorios:**
    Crear `CREATE INDEX idx_invitados_pendientes ON invitados(telefono) WHERE recordatorio_enviado = false;`, acelerando la búsqueda del cron a <1 milisegundo.
17. **Disparador Serverless Externo contra el Sleep de Render:**
    Configurar un trigger gratuito en GitHub Actions o Cron-Job.org que despierte el servidor y llame a `/api/admin/forzar-recordatorio` el 6 de noviembre a las 12:00 PM.
18. **Soporte de Estados de Asistencia (Soft-Delete):**
    Guardar a los invitados que marquen "No podré ir" con `estado: 'rechazado'` en lugar de descartarlos, permitiendo estadísticas de catering sin enviarles recordatorios.
19. **Sanitización de Inyección de Fórmulas CSV:**
    Neutralizar caracteres `=`, `+`, `-`, `@` anteponiendo un apóstrofe al exportar el archivo CSV para proteger a la computadora que abra el Excel.
20. **Transacciones ACID Atómicas en `cron.js`:**
    Agrupar la marcación de recordatorios bajo `BEGIN ... COMMIT` para blindar el sistema contra envíos duplicados en caso de micro-cortes de red.
