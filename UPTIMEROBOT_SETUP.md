# 🤖 Guía de Configuración de UptimeRobot (Keep-Alive 24/7)

Esta guía explica paso a paso cómo configurar **UptimeRobot** de forma **100% gratuita** para evitar que Render duerma tu servidor, asegurando que la invitación web y el bot de WhatsApp para los 15 de **Keyberlis** funcionen ininterrumpidamente las 24 horas del día.

---

## 🎯 ¿Por qué es necesario este paso?

- **Comportamiento del plan gratuito de Render:** Render suspende (pone a "dormir") cualquier servicio web que no reciba visitas durante **15 minutos**. Si se duerme:
  1. El próximo invitado que entre tardará entre 30 y 50 segundos en cargar la página (arranque en frío).
  2. Los procesos en segundo plano (como el cron job y la conexión persistente de WhatsApp) pueden reiniciarse o interrumpirse.
- **La solución con UptimeRobot:**
  Configuramos un monitor automático que envía una solicitud HTTP a nuestra ruta `GET /ping` **cada 5 minutos**. Como 5 minutos es mucho menor que los 15 minutos de inactividad, **Render nunca dormirá el contenedor** y permanecerá activo 24/7.

---

## 📋 Pasos de Configuración

### 1. Crear cuenta gratuita en UptimeRobot
1. Ingresa a [https://uptimerobot.com](https://uptimerobot.com).
2. Haz clic en **"Register for FREE"** o **"Sign Up"**.
3. Completa tu nombre, correo electrónico y contraseña.
4. Verifica tu cuenta a través del correo de confirmación que te enviarán.

---

### 2. Crear el Monitor para tu Aplicación
1. Inicia sesión en el panel de control ([Dashboard de UptimeRobot](https://dashboard.uptimerobot.com)).
2. En la esquina superior izquierda o centro, haz clic en el botón azul **"+ Add New Monitor"**.
3. Completa el formulario con los siguientes datos exactos:

| Campo | Valor a Seleccionar / Escribir | Explicación |
|---|---|---|
| **Monitor Type** | `HTTP(s)` | Tipo estándar para peticiones web |
| **Friendly Name** | `Invitación Keyberlis 15 - Render` | Nombre descriptivo para identificarlo |
| **URL (or IP)** | `https://TU-APP.onrender.com/ping` | Reemplaza `TU-APP` por el nombre de tu servicio en Render |
| **Monitoring Interval** | `Every 5 minutes` | Intervalo ideal para evitar que Render se duerma |
| **Monitor Timeout** | `30 seconds` | Tiempo máximo de espera de respuesta |
| **HTTP Method** | `HEAD` o `GET` | Cualquiera funciona (`GET` es el predeterminado) |
| **Select "Alert Contacts To Notify"** | Marca la casilla de tu correo electrónico | Te avisará si ocurre alguna desconexión |

> [!IMPORTANT]
> Asegúrate de incluir `/ping` al final de la URL (por ejemplo: `https://invitacion-keyberlis-15.onrender.com/ping`). Esta ruta está optimizada para responder al instante con código `200 OK` y mínimo consumo de memoria y CPU.

4. Haz clic en el botón verde **"Create Monitor"** en la parte inferior.

---

### 3. Verificar que el Monitor esté Funcionando

1. En tu panel de UptimeRobot, verás el monitor recién creado. Inicialmente puede aparecer en estado *Paused* o *Checking*.
2. En 2 a 5 minutos, el indicador pasará a color verde con el estado **"Up (100%)"**.
3. **Comprobar en los Logs de Render:**
   - Abre el dashboard de Render y dirígete a tu servicio web.
   - Ve a la pestaña **"Logs"**.
   - Verás solicitudes periódicas como esta cada 5 minutos:
     ```text
     GET /ping 200 - - 2.152 ms
     ```
   - Esto confirma que el monitor está manteniendo el contenedor activo y despierto en todo momento.

---

### 4. Probar la Respuesta del Endpoint Manualmente

Puedes abrir en una pestaña de tu navegador la URL de tu monitor:
`https://TU-APP.onrender.com/ping`

Deberías ver una respuesta JSON similar a esta:
```json
{
  "status": "healthy",
  "service": "cumpleanos-keyberlis",
  "whatsappReady": true,
  "uptime": 3420,
  "timestamp": "2026-11-01T15:30:00.000Z"
}
```

- `"status": "healthy"`: El servidor Express está funcionando sin fallas.
- `"whatsappReady": true`: El cliente de WhatsApp está autenticado y listo para despachar mensajes.
- `"uptime"`: Segundos continuos que lleva el servidor encendido.

---

## 📱 Opcional: App Móvil de UptimeRobot
Si deseas recibir alertas inmediatas en tu teléfono móvil si el servidor llega a caerse:
- Descarga la aplicación gratuita **UptimeRobot** en Google Play Store (Android) o App Store (iPhone).
- Inicia sesión con la misma cuenta.
- Recibirás notificaciones push al instante si hay algún corte o mantenimiento programado.

---

## ✅ Resumen de Beneficios
- 💸 **Costo:** $0 USD / mes (100% gratuito de por vida).
- ⚡ **Velocidad:** Carga inmediata de la invitación para los invitados sin retrasos de arranque en frío.
- ⏰ **Confiabilidad:** Garantiza que el Cron Job programado para el **6 de noviembre a las 12:00 PM** se dispare puntualmente y envíe todos los recordatorios con el alias `key.2710`.
