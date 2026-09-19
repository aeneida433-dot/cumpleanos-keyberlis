# 🚀 Guía de Despliegue en Producción: Render + Neon + WhatsApp

Esta guía detalla los pasos exactos para poner en línea el sistema completo de invitación de 15 años de **Keyberlis** de forma **100% gratuita**.

---

## Paso 1: Crear la Base de Datos en Neon (Gratis)

1. Ingresa a [https://console.neon.tech](https://console.neon.tech) e inicia sesión (puedes usar GitHub o Google).
2. Haz clic en **"Create Project"**:
   - Project Name: `cumpleanos-keyberlis`
   - Postgres version: `16` o `17`
   - Region: Elige la más cercana (ej: `US East (Ohio)` o similar).
3. Una vez creado el proyecto, verás la sección **"Connection Details"**:
   - Selecciona **"Node.js"** o **"Parameters Only"**.
   - Copia la URL de conexión completa (`DATABASE_URL`). Tendrá un formato como este:
     ```bash
     postgresql://neondb_owner:TU_CONTRASEÑA@ep-nombre-endpoint.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - *Nota:* No necesitas crear las tablas manualmente. El servidor creará la tabla `invitados` e índices automáticamente al arrancar.

---

## Paso 2: Subir el Proyecto a GitHub

1. En tu computadora, dentro de la carpeta `cumpleanos`, inicializa git (si no lo has hecho):
   ```bash
   git init
   git add .
   git commit -m "feat: backend completo invitacion 15 anos Keyberlis"
   ```
2. Crea un nuevo repositorio en tu cuenta de [GitHub](https://github.com/new) (puede ser público o privado).
3. Vincula y sube el código:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/cumpleanos-keyberlis.git
   git branch -M main
   git push -u origin main
   ```

---

## Paso 3: Crear el Web Service en Render (Gratis)

1. Ingresa a [https://dashboard.render.com](https://dashboard.render.com).
2. Haz clic en **"New +"** y selecciona **"Web Service"**.
3. Selecciona **"Build and deploy from a Git repository"** y elige tu repositorio `cumpleanos-keyberlis`.
4. Configura los parámetros básicos:
    - **Name:** `cumpleanos-keyberlis` (nombre de tu servicio en Render).
   - **Region:** Elige la misma región de Neon si es posible (ej: `Ohio (US East)`).
   - **Branch:** `main`.
   - **Runtime:** `Node`.
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** `Free` (512 MB RAM, 0.1 CPU).
5. Despliega hacia abajo hasta la sección **"Environment Variables"** y agrega las siguientes:
   | Key | Value | Descripción |
   |---|---|---|
   | `NODE_ENV` | `production` | Modo producción |
   | `DATABASE_URL` | `postgresql://...` *(la URL copiada de Neon en el Paso 1)* | Conexión segura a Neon |
   | `TIMEZONE` | `America/Argentina/Buenos_Aires` | Zona horaria del evento |
   | `ALIAS_REGALO` | `key.2710` | Alias para transferencias |
   | `ADMIN_KEY` | `admin_keyberlis_2026` *(o tu clave elegida)* | Clave para rutas administrativas |
6. Haz clic en **"Create Web Service"**.

---

## Paso 4: Vinculación de WhatsApp (Escanear QR)

1. En el panel de Render, entra a tu servicio y haz clic en la pestaña **"Logs"**.
2. Espera a que termine la instalación (`npm install`) y arranque el servidor (`node server.js`).
3. En los logs verás aparecer el mensaje:
   ```text
   ========================================================
   📲 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP PARA VINCULAR:
   ========================================================
   [CÓDIGO QR VISUAL]
   ```
4. Abre la aplicación de **WhatsApp** en el teléfono de la quinceañera (o del organizador):
   - Ve a **Ajustes / Configuración** > **Dispositivos vinculados**.
   - Presiona **"Vincular un dispositivo"**.
   - Apunta la cámara de tu celular a la pantalla de tu computadora y escanea el código QR que se muestra en los logs de Render.
5. Verás en los logs: `✅ [WhatsApp] ¡Cliente listo y conectado 100%!`.
6. ¡Listo! La sesión queda vinculada y activa para el despacho del recordatorio el 6 de noviembre a las 12:00 PM.

---

## Paso 5: Verificación de la Web y Endpoint de Salud

1. En la parte superior de tu panel de Render verás la URL pública asignada: `https://cumpleanos-keyberlis.onrender.com`.
2. Abre la URL en tu navegador o celular:
   - Verás la invitación web completa, la música, la cuenta regresiva y el formulario de confirmación.
3. Abre la ruta de verificación:
   - `https://cumpleanos-keyberlis.onrender.com/ping`
   - Debe responder:
     ```json
     {
       "status": "healthy",
       "service": "cumpleanos-keyberlis",
       "whatsappReady": true,
       "uptime": 120,
       "timestamp": "..."
     }
     ```

---

## Paso 6: Mantener el Servidor Despierto 24/7 (UptimeRobot)

Sigue la guía detallada en [UPTIMEROBOT_SETUP.md](file:///c:/Users/herct/Desktop/cumpleanos/UPTIMEROBOT_SETUP.md) para activar el monitor gratuito de 5 minutos y evitar que Render duerma el contenedor.
