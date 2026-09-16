/* ========================================================
   LÓGICA JAVASCRIPT - INVITACIÓN DIGITAL 15 AÑOS
   ======================================================== */

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
    const plusOnes = document.getElementById("guest-plus-ones").value;
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
      plusOnes: attending ? plusOnes : "0",
      song: song || "N/A",
      message: message || "¡Muchas felicidades!",
      date: new Date().toLocaleDateString("es-ES")
    };

    // Registrar en backend Neon PostgreSQL
    fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: guestData.name,
        telefono: phone
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

    sendWhatsAppConfirmation(guestData);

    if (attending) {
      showVIPTicket(guestData);
      triggerConfetti();
    } else {
      showToast("💌 ¡Gracias por responder!");
    }
  });
}

function sendWhatsAppConfirmation(data) {
  const phone = config.whatsappNumber ? config.whatsappNumber.replace(/[^0-9]/g, "") : "";

  let waText = `✨ *CONFIRMACIÓN DE ASISTENCIA - 15 AÑOS* ✨\n`;
  waText += `¡Hola ${config.birthdayGirl}! 💖\n\n`;
  waText += `👤 *Invitado:* ${data.name}\n`;
  waText += `🎟 *Confirmación:* ${data.attending ? "¡SÍ ASISTIRÉ! 🎉🪩" : "NO PODRÉ ASISTIR 😢"}\n`;

  if (data.attending) {
    waText += `👥 *Acompañantes:* ${data.plusOnes}\n`;
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
  waText += `¡Nos vemos para celebrar hasta el amanecer! ✨🪩`;

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
    const p = parseInt(guest.plusOnes) || 0;
    ticketCompanions.innerText = p === 0 ? "1 Persona (Individual)" : `${p + 1} Personas (Titular + ${p})`;
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
function initAdminModal() {
  const openBtn = document.getElementById("admin-btn");
  const modal = document.getElementById("admin-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const form = document.getElementById("admin-config-form");
  const exportBtn = document.getElementById("export-csv-btn");
  const clearBtn = document.getElementById("clear-guests-btn");

  if (!openBtn || !modal) return;

  openBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    populateAdminForm();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

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
      showToast("💾 Configuración guardada");
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", exportGuestListToCSV);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("¿Estás seguro de que deseas borrar todos los registros de confirmación?")) {
        guestList = [];
        localStorage.removeItem("cumpleanos_guests");
        renderGuestList();
        showToast("🗑 Lista de invitados reiniciada");
      }
    });
  }
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
  const tbody = document.getElementById("guest-list-body");
  const totalAttendingEl = document.getElementById("stat-total-attending");
  const totalCompanionsEl = document.getElementById("stat-total-companions");
  const totalDeclinedEl = document.getElementById("stat-total-declined");

  let attendingCount = 0;
  let companionsCount = 0;
  let declinedCount = 0;

  if (tbody) tbody.innerHTML = "";

  guestList.forEach((g) => {
    if (g.attending) {
      attendingCount++;
      companionsCount += parseInt(g.plusOnes) || 0;
    } else {
      declinedCount++;
    }

    if (tbody) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${g.name}</strong></td>
        <td>
          <span class="${g.attending ? "badge-attending" : "badge-declined"}">
            ${g.attending ? "Sí Asiste" : "No Asiste"}
          </span>
        </td>
        <td>${g.attending ? (g.plusOnes > 0 ? "+" + g.plusOnes : "Solo") : "-"}</td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (totalAttendingEl) totalAttendingEl.innerText = attendingCount;
  if (totalCompanionsEl) totalCompanionsEl.innerText = companionsCount;
  if (totalDeclinedEl) totalDeclinedEl.innerText = declinedCount;
}

function exportGuestListToCSV() {
  if (guestList.length === 0) {
    showToast("⚠️ No hay invitados confirmados aún");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Nombre Completo,Estado Asistencia,Acompanantes,Cancion,Mensaje,Fecha Registro\r\n";

  guestList.forEach((g) => {
    const row = [
      `"${g.name}"`,
      g.attending ? "Asiste" : "No Asiste",
      g.plusOnes,
      `"${(g.song || "").replace(/"/g, '""')}"`,
      `"${(g.message || "").replace(/"/g, '""')}"`,
      g.date
    ];
    csvContent += row.join(",") + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Confirmaciones_${config.birthdayGirl}_15.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📊 Lista descargada en CSV / Excel");
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
