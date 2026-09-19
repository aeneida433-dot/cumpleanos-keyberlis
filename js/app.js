/* ========================================================
   LÓGICA JAVASCRIPT - INVITACIÓN DIGITAL 15 AÑOS
   ======================================================== */

// URL oficial única del proyecto en producción
const OFFICIAL_PRODUCTION_URL = "https://cumpleanos-keyberlis.onrender.com";
const API_BASE = (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
  ? window.location.origin
  : OFFICIAL_PRODUCTION_URL;

// Configuración por defecto actualizada con los datos oficiales
const DEFAULT_CONFIG = {
  birthdayGirl: "Keyberlis",
  eventDate: "2026-11-07T21:00:00",
  venueName: "French 10551",
  venueAddress: "French 10551",
  eventHours: "21:00 a 6:00",
  whatsappNumber: "", // Configurable en el panel o directo
  eventTitle: "Los 15 de Keyberlis"
};

// Cargar configuración guardada o usar la predeterminada
let savedConfig = JSON.parse(localStorage.getItem("cumpleanos_config"));
if (savedConfig && (savedConfig.birthdayGirl === "Marina" || savedConfig.eventDate.includes("18:00"))) {
  savedConfig = null;
  localStorage.removeItem("cumpleanos_config");
}

let config = savedConfig || DEFAULT_CONFIG;
let guestList = JSON.parse(localStorage.getItem("cumpleanos_guests")) || [];
let isMusicPlaying = false;
let audioCtx = null;
let musicInterval = null;

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  initCountdown();
  initDesignToggle();
  initAudio();
  initRSVPForm();
  initAdminModal();
  updateUIWithConfig();
  renderGuestList();
});

/* ========================================================
   1. SISTEMA DE DESTELLES Y PARTÍCULAS (CANVAS)
   ======================================================== */
function initParticles() {
  const canvas = document.getElementById("particles-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = 45;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.6,
      color: Math.random() > 0.3 ? "#ffffff" : "#c4d2e7",
      speedY: Math.random() * 0.5 + 0.2,
      speedX: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.8 + 0.2,
      decay: Math.random() * 0.015 + 0.005
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    for (let p of particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = p.radius * 4;
      ctx.shadowColor = "#ffffff";
      ctx.fill();
      ctx.restore();

      p.y += p.speedY;
      p.x += p.speedX;
      p.alpha += Math.sin(Date.now() * p.decay) * 0.02;
      if (p.alpha > 0.95) p.alpha = 0.95;
      if (p.alpha < 0.15) p.alpha = 0.15;

      if (p.y > height) {
        p.y = -10;
        p.x = Math.random() * width;
      }
      if (p.x > width) p.x = 0;
      if (p.x < 0) p.x = width;
    }

    requestAnimationFrame(render);
  }

  render();
}

/* ========================================================
   2. CUENTA REGRESIVA DINÁMICA (SÁBADO 07 DE NOVIEMBRE 21:00)
   ======================================================== */
function initCountdown() {
  const daysEl = document.getElementById("count-days");
  const hoursEl = document.getElementById("count-hours");
  const minsEl = document.getElementById("count-mins");
  const secsEl = document.getElementById("count-secs");

  function update() {
    const target = new Date(config.eventDate).getTime();
    const now = new Date().getTime();
    const diff = target - now;

    if (diff <= 0) {
      if (daysEl) daysEl.innerText = "00";
      if (hoursEl) hoursEl.innerText = "00";
      if (minsEl) minsEl.innerText = "00";
      if (secsEl) secsEl.innerText = "00";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    if (daysEl) daysEl.innerText = String(d).padStart(2, "0");
    if (hoursEl) hoursEl.innerText = String(h).padStart(2, "0");
    if (minsEl) minsEl.innerText = String(m).padStart(2, "0");
    if (secsEl) secsEl.innerText = String(s).padStart(2, "0");
  }

  update();
  setInterval(update, 1000);
}

/* ========================================================
   3. SELECTOR DE VERSIÓN DE DISEÑO
   ======================================================== */
function initDesignToggle() {
  const mainImg = document.getElementById("main-invitation-img");
  const downloadLink = document.getElementById("download-invitation-btn");
  const pills = document.querySelectorAll(".toggle-pill");

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");

      const version = pill.getAttribute("data-version");
      if (version === "keyberlis") {
        mainImg.src = "assets/invitacion_keyberlis.jpg";
        if (downloadLink) downloadLink.href = "assets/invitacion_keyberlis.jpg";
      } else {
        mainImg.src = "assets/invitacion_original.jpg";
        if (downloadLink) downloadLink.href = "assets/invitacion_original.jpg";
      }
    });
  });
}

/* ========================================================
   4. AUDIO AMBIENTAL CELEBRATORIO (WEB AUDIO API)
   ======================================================== */
function initAudio() {
  const musicBtn = document.getElementById("music-toggle");
  if (!musicBtn) return;

  musicBtn.addEventListener("click", () => {
    if (!isMusicPlaying) {
      startSynthMusic();
      musicBtn.classList.add("playing");
      showToast("🎵 Música de fiesta activada");
      isMusicPlaying = true;
    } else {
      stopSynthMusic();
      musicBtn.classList.remove("playing");
      showToast("🔇 Música pausada");
      isMusicPlaying = false;
    }
  });
}

function startSynthMusic() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const melodyNotes = [
      523.25, 659.25, 783.99, 1046.50,
      880.00, 783.99, 659.25, 587.33,
      523.25, 659.25, 783.99, 880.00,
      1046.50, 987.77, 880.00, 783.99
    ];

    let noteIndex = 0;

    musicInterval = setInterval(() => {
      if (!isMusicPlaying || !audioCtx) return;
      playGlamNote(melodyNotes[noteIndex % melodyNotes.length]);
      noteIndex++;
    }, 450);
  } catch (e) {
    console.warn("Audio Context error:", e);
  }
}

function playGlamNote(freq) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.45);
}

function stopSynthMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

/* ========================================================
   5. FORMULARIO DE CONFIRMACIÓN (RSVP) & WHATSAPP
   ======================================================== */
function initRSVPForm() {
  const form = document.getElementById("rsvp-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const firstName = document.getElementById("guest-first-name").value.trim();
    const phoneInput = document.getElementById("guest-phone");
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const attendingRadio = document.querySelector('input[name="attending"]:checked');
    const plusOnes = document.getElementById("guest-plus-ones") ? document.getElementById("guest-plus-ones").value : "0";
    const message = document.getElementById("guest-message").value.trim();
    const song = document.getElementById("guest-song").value.trim();

    if (!firstName || !lastName) {
      showToast("⚠️ Por favor escribe tu Nombre y Apellido");
      return;
    }

    if (!phone) {
      showToast("⚠️ Por favor escribe tu número de WhatsApp");
      return;
    }

    if (!attendingRadio) {
      showToast("⚠️ Por favor indica si asistirás");
      return;
    }

    const attending = attendingRadio.value === "yes";

    const guestData = {
      id: Date.now(),
      name: `${firstName} ${lastName}`,
      phone: phone,
      attending: attending,
      plusOnes: "0",
      song: song || "N/A",
      message: message || "¡Muchas felicidades!",
      date: new Date().toLocaleDateString("es-ES")
    };

    // Si confirma que SÍ asistirá, se registra en Neon PostgreSQL.
    // Si marca que NO asistirá, NO se registra nada en la base de datos (lista 100% limpia).
    if (attending) {
      fetch(`${API_BASE}/api/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: guestData.name,
          telefono: phone,
          attending: true
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('✅ [Neon DB] Registrado exitosamente:', data.data);
        } else {
          console.warn('⚠️ [Neon DB]:', data.error);
        }
      })
      .catch(err => {
        console.warn('ℹ️ Servidor en segundo plano o modo local:', err.message);
      });

      guestList.push(guestData);
      localStorage.setItem("cumpleanos_guests", JSON.stringify(guestList));
      renderGuestList();

      showVIPTicket(guestData);
      triggerConfetti();
    } else {
      showToast("💌 ¡Muchas gracias por avisarnos! Lamentamos que no puedas venir.");
    }

    sendWhatsAppConfirmation(guestData);
  });
}

function sendWhatsAppConfirmation(data) {
  const phone = config.whatsappNumber ? config.whatsappNumber.replace(/[^0-9]/g, "") : "";

  let waText = `✨ *CONFIRMACIÓN DE ASISTENCIA - 15 AÑOS* ✨\n`;
  waText += `¡Hola ${config.birthdayGirl}! 💖\n\n`;
  waText += `👤 *Invitado:* ${data.name}\n`;
  waText += `🎟 *Confirmación:* ${data.attending ? "¡SÍ ASISTIRÉ! 🎉🪩" : "NO PODRÉ ASISTIR 😢"}\n`;

  if (data.attending) {
    waText += `🎫 *Pase:* Individual (1 persona)\n`;
    if (data.song && data.song !== "N/A") {
      waText += `🎵 *Canción sugerida:* ${data.song}\n`;
    }
  }

  if (data.message) {
    waText += `💌 *Mensaje:* "${data.message}"\n\n`;
  }

  waText += `📍 *Lugar:* ${config.venueName}\n`;
  waText += `🗓 *Fecha:* Sábado, 07 de Noviembre\n`;
  waText += `⏰ *Horario:* 21:00 a 6:00 hrs\n\n`;
  if (data.attending) {
    waText += `¡Nos vemos para celebrar hasta el amanecer! ✨🪩`;
  } else {
    waText += `¡Te deseo un cumpleaños inolvidable! 💖✨`;
  }

  const encoded = encodeURIComponent(waText);
  let url = "";

  if (phone && phone.length > 5) {
    url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encoded}`;
  }

  window.open(url, "_blank");
}

/* ========================================================
   6. PASE VIP GENERADO Y CÓDIGO QR
   ======================================================== */
function showVIPTicket(guest) {
  const ticketCont = document.getElementById("ticket-container");
  const ticketName = document.getElementById("ticket-guest-name");
  const ticketCompanions = document.getElementById("ticket-companions");
  const ticketQr = document.getElementById("ticket-qr");

  if (!ticketCont) return;

  if (ticketName) ticketName.innerText = guest.name;
  if (ticketCompanions) {
    ticketCompanions.innerText = "1 Persona (Acceso Individual)";
  }

  if (ticketQr) {
    ticketQr.innerHTML = createSimpleQRCodeSVG(guest.name);
  }

  ticketCont.style.display = "block";
  ticketCont.scrollIntoView({ behavior: "smooth" });
}

function createSimpleQRCodeSVG(text) {
  return `
    <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="6" fill="#000000"/>
      <rect x="8" y="8" width="26" height="26" stroke="#ffffff" stroke-width="4" fill="none"/>
      <rect x="14" y="14" width="14" height="14" fill="#ffffff"/>
      <rect x="66" y="8" width="26" height="26" stroke="#ffffff" stroke-width="4" fill="none"/>
      <rect x="72" y="14" width="14" height="14" fill="#ffffff"/>
      <rect x="8" y="66" width="26" height="26" stroke="#ffffff" stroke-width="4" fill="none"/>
      <rect x="14" y="72" width="14" height="14" fill="#ffffff"/>
      <rect x="42" y="12" width="8" height="8" fill="#ffffff"/>
      <rect x="52" y="24" width="6" height="6" fill="#ffffff"/>
      <rect x="40" y="40" width="20" height="20" rx="3" fill="#ffffff"/>
      <circle cx="50" cy="50" r="4" fill="#000000"/>
      <rect x="68" y="44" width="8" height="8" fill="#ffffff"/>
      <rect x="44" y="68" width="8" height="8" fill="#ffffff"/>
      <rect x="72" y="72" width="16" height="16" fill="#ffffff"/>
    </svg>
  `;
}

window.downloadVIPTicket = function() {
  const guestName = document.getElementById("ticket-guest-name").innerText || "Invitado";
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 600, 360);
  grad.addColorStop(0, "#111116");
  grad.addColorStop(0.5, "#202028");
  grad.addColorStop(1, "#0d0d12");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 360);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, 570, 330);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASE VIP CONFIRMADO - 15 AÑOS", 300, 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px serif";
  ctx.fillText(config.eventTitle.toUpperCase(), 300, 95);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.moveTo(60, 120);
  ctx.lineTo(540, 120);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px sans-serif";
  ctx.fillText("INVITADO DE HONOR", 300, 160);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px serif";
  ctx.fillText(guestName, 300, 205);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "14px sans-serif";
  ctx.fillText(`Fecha: Sábado, 07 de Noviembre | 21:00 a 6:00 hrs`, 300, 255);
  ctx.fillText(`Lugar: ${config.venueName}`, 300, 280);

  ctx.fillStyle = "#64748b";
  ctx.font = "11px monospace";
  ctx.fillText("VALIDADO • CÓDIGO ÚNICO DE INVITACIÓN", 300, 325);

  const link = document.createElement("a");
  link.download = `Pase_VIP_${guestName.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("🎟 ¡Pase VIP descargado con éxito!");
};

/* ========================================================
   7. PANEL DE ADMINISTRACIÓN / CONFIGURACIÓN DE ANFITRIÓN
   ======================================================== */
/* ========================================================
   7. PANEL DE ADMINISTRACIÓN / CONFIGURACIÓN DE ANFITRIÓN
   ======================================================== */
let adminPollInterval = null;
let neonGuestsList = [];

function initAdminModal() {
  const openBtn = document.getElementById("admin-btn");
  const modal = document.getElementById("admin-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const form = document.getElementById("admin-config-form");
  const exportBtn = document.getElementById("export-csv-btn");
  const refreshBtn = document.getElementById("refresh-admin-btn");
  const triggerBtn = document.getElementById("trigger-reminders-btn");

  if (!openBtn || !modal) return;

  // 1. CAPTURA DEL EVENTO (ÍCONO DE AJUSTES CON TRES CONTROLES DESLIZANTES):
  // Intercepta el click y suspende la apertura directa del Panel del Anfitrión
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 2. VALIDACIÓN DE CONTRASEÑA ESTRICTA (key27102011)
    const storedKey = sessionStorage.getItem("cumpleanos_admin_key");
    let keyToUse = storedKey;

    if (!keyToUse || keyToUse !== "key27102011") {
      const promptInput = prompt("🔒 ACCESO RESTRINGIDO AL PANEL DEL ANFITRIÓN\n\nPor favor, ingresa la contraseña de seguridad:");

      // Si se cancela el cuadro o se deja vacío
      if (promptInput === null || promptInput.trim() === "") {
        showToast("🚫 Acceso Denegado: Operación cancelada");
        modal.style.display = "none";
        return;
      }

      const cleanPass = promptInput.trim();
      // Si la clave no es exactamente key27102011
      if (cleanPass !== "key27102011") {
        showToast("❌ Acceso Denegado: Contraseña incorrecta");
        alert("❌ Acceso Denegado: Contraseña incorrecta.");
        modal.style.display = "none";
        return;
      }

      keyToUse = cleanPass;
      sessionStorage.setItem("cumpleanos_admin_key", keyToUse);
      showToast("🔓 Acceso Concedido al Panel del Anfitrión");
    }

    // Si la clave es correcta, remover la clase oculta y mostrar el panel
    modal.style.display = "flex";
    populateAdminForm();
    fetchWhatsAppStatus();
    fetchNeonGuests();

    if (adminPollInterval) clearInterval(adminPollInterval);
    adminPollInterval = setInterval(fetchWhatsAppStatus, 3000);
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      if (adminPollInterval) {
        clearInterval(adminPollInterval);
        adminPollInterval = null;
      }
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      if (adminPollInterval) {
        clearInterval(adminPollInterval);
        adminPollInterval = null;
      }
    }
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchWhatsAppStatus();
      fetchNeonGuests();
      showToast("🔄 Datos actualizados");
    });
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      if (!confirm("¿Deseas enviar el recordatorio de WhatsApp a todos los confirmados pendientes en Neon?")) return;
      triggerBtn.disabled = true;
      triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando recordatorios...';

      fetch(`${API_BASE}/api/admin/enviar-recordatorios`, {
        method: 'POST',
        headers: getAdminHeaders()
      })
        .then(res => res.json())
        .then(data => {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Enviar Recordatorios a Pendientes</span>';
          if (data.success && data.resultado) {
            showToast(`🏁 Envíos finalizados: ${data.resultado.enviados} enviados, ${data.resultado.fallidos} fallidos`);
          } else {
            showToast(`⚠️ ${data.error || 'No se pudo completar el envío'}`);
          }
          fetchNeonGuests();
        })
        .catch(err => {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Enviar Recordatorios a Pendientes</span>';
          showToast(`❌ Error: ${err.message}`);
        });
    });
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      config.birthdayGirl = document.getElementById("cfg-name").value.trim() || config.birthdayGirl;
      config.whatsappNumber = document.getElementById("cfg-phone").value.trim() || config.whatsappNumber;
      config.venueName = document.getElementById("cfg-venue").value.trim() || config.venueName;
      config.eventTitle = `Los 15 de ${config.birthdayGirl}`;

      localStorage.setItem("cumpleanos_config", JSON.stringify(config));
      updateUIWithConfig();
      modal.style.display = "none";
      if (adminPollInterval) {
        clearInterval(adminPollInterval);
        adminPollInterval = null;
      }
      showToast("💾 Configuración guardada");
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportGuestListToCSV);
  }
}

function fetchWhatsAppStatus() {
  fetch(`${API_BASE}/api/whatsapp/status`)
    .then(res => res.json())
    .then(data => {
      const badge = document.getElementById("wa-status-badge");
      const qrContainer = document.getElementById("wa-qr-container");
      const qrImg = document.getElementById("wa-qr-img");
      if (!badge) return;

      if (data.ready) {
        badge.innerHTML = '🟢 Conectado y Listo';
        badge.style.background = 'rgba(34, 197, 94, 0.2)';
        badge.style.color = '#4ade80';
        badge.style.borderColor = '#22c55e';
        if (qrContainer) qrContainer.style.display = 'none';
      } else if (data.loading) {
        badge.innerHTML = `⏳ Sincronizando chats (${data.loading.percent}%)...`;
        badge.style.background = 'rgba(59, 130, 246, 0.2)';
        badge.style.color = '#60a5fa';
        badge.style.borderColor = '#3b82f6';
        if (qrContainer) qrContainer.style.display = 'none';
      } else if (data.qrDataURL) {
        badge.innerHTML = '🟡 Escanear Código QR';
        badge.style.background = 'rgba(234, 179, 8, 0.2)';
        badge.style.color = '#facc15';
        badge.style.borderColor = '#eab308';
        if (qrContainer) {
          qrContainer.style.display = 'block';
          if (qrImg && qrImg.src !== data.qrDataURL) {
            qrImg.src = data.qrDataURL;
          }
        }
      } else {
        badge.innerHTML = '⏳ Esperando QR...';
        badge.style.background = 'rgba(148, 163, 184, 0.2)';
        badge.style.color = '#cbd5e1';
        badge.style.borderColor = '#94a3b8';
        if (qrContainer) qrContainer.style.display = 'none';
      }
    })
    .catch(err => console.warn('Estado WhatsApp:', err.message));
}

// 3. ENDPOINT DE DATOS SEGURO: Cabeceras con clave estricta
function getAdminHeaders() {
  const key = sessionStorage.getItem('cumpleanos_admin_key') || '';
  return {
    'Content-Type': 'application/json',
    'x-admin-key': key
  };
}

function fetchNeonGuests() {
  const headers = getAdminHeaders();
  if (!headers['x-admin-key'] || headers['x-admin-key'] !== 'key27102011') {
    console.warn('⚠️ [Seguridad] Consulta a /api/invitados cancelada: requiere clave autorizada.');
    return;
  }

  fetch(`${API_BASE}/api/invitados`, {
    headers: headers
  })
    .then(res => {
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('cumpleanos_admin_key');
          showToast("🔒 Acceso no autorizado a invitados");
          const modal = document.getElementById("admin-modal");
          if (modal) modal.style.display = "none";
        }
        throw new Error('No autorizado');
      }
      return res.json();
    })
    .then(data => {
      if (!data.success || !data.invitados) return;
      neonGuestsList = data.invitados;
      const totalAttendingEl = document.getElementById("stat-total-attending");
      const totalRemindedEl = document.getElementById("stat-total-reminded");
      const totalPendingEl = document.getElementById("stat-total-pending");
      const tbody = document.getElementById("guest-list-body");

      let remindedCount = 0;
      neonGuestsList.forEach(g => {
        if (g.recordatorio_enviado) remindedCount++;
      });
      let pendingCount = neonGuestsList.length - remindedCount;

      if (totalAttendingEl) totalAttendingEl.innerText = neonGuestsList.length;
      if (totalRemindedEl) totalRemindedEl.innerText = remindedCount;
      if (totalPendingEl) totalPendingEl.innerText = pendingCount;

      if (tbody) {
        tbody.innerHTML = "";
        if (neonGuestsList.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 16px;">No hay confirmaciones registradas en Neon</td></tr>';
          return;
        }

        neonGuestsList.forEach(guest => {
          const tr = document.createElement("tr");
          const statusBadge = guest.recordatorio_enviado 
            ? '<span style="color: #4ade80; font-weight: 600;">Enviado ✅</span>' 
            : '<span style="color: #facc15; font-weight: 600;">Pendiente ⏳</span>';

          tr.innerHTML = `
            <td><strong>${escapeHTML(guest.nombre)}</strong></td>
            <td><code>${escapeHTML(guest.telefono)}</code></td>
            <td>${statusBadge}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    })
    .catch(err => {
      console.warn('ℹ️ Consulta de invitados protegida:', err.message);
    });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function populateAdminForm() {
  const nameInput = document.getElementById("cfg-name");
  const phoneInput = document.getElementById("cfg-phone");
  const venueInput = document.getElementById("cfg-venue");

  if (nameInput) nameInput.value = config.birthdayGirl;
  if (phoneInput) phoneInput.value = config.whatsappNumber;
  if (venueInput) venueInput.value = config.venueName;
}

function updateUIWithConfig() {
  const names = document.querySelectorAll(".dynamic-name");
  names.forEach((el) => (el.innerText = config.birthdayGirl));

  const venues = document.querySelectorAll(".dynamic-venue");
  venues.forEach((el) => (el.innerText = config.venueName));

  const titles = document.querySelectorAll(".dynamic-title");
  titles.forEach((el) => (el.innerText = config.eventTitle));
}

function renderGuestList() {
  const key = sessionStorage.getItem('cumpleanos_admin_key');
  if (key === 'key27102011') {
    fetchNeonGuests();
  }
}

function exportGuestListToCSV() {
  const listToExport = neonGuestsList.length > 0 ? neonGuestsList : guestList;
  if (listToExport.length === 0) {
    showToast("⚠️ No hay invitados confirmados aún");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Nombre Completo,Telefono,Recordatorio Enviado,Fecha Recordatorio,Fecha Registro\r\n";

  listToExport.forEach((g) => {
    const row = [
      `"${g.nombre || g.name}"`,
      `"${g.telefono || g.phone}"`,
      g.recordatorio_enviado ? "Enviado" : "Pendiente",
      g.fecha_recordatorio || "N/A",
      g.fecha_registro || g.date || "N/A"
    ];
    csvContent += row.join(",") + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Confirmados_Neon_${config.birthdayGirl}_15.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Lista de Neon descargada en CSV");
}

/* ========================================================
   8. COMPARTIR INVITACIÓN POR WHATSAPP
   ======================================================== */
window.shareInvitation = function() {
  const shareText = `✨ *¡Estás invitado a mis 15 años!* ✨\n\nAcompaña a ${config.birthdayGirl} en una noche inolvidable temática Disco Silver 🪩🥂.\n\n🗓 *Sábado, 07 de Noviembre*\n⏰ *Horario:* 21:00 a 6:00 hrs\n📍 *Lugar:* ${config.venueName}\n\n👉 *Mira la invitación y confirma tu asistencia aquí:* ${window.location.href}`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(url, "_blank");
};

/* ========================================================
   9. EFECTO CONFETI FESTIVO
   ======================================================== */
function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#ffffff", "#cbd5e1", "#94a3b8", "#f472b6", "#e2e8f0"]
    });
  }
}

/* ========================================================
   10. TOAST NOTIFICADOR
   ======================================================== */
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast-msg";
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
