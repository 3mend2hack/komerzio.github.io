/* ============================================================
   ALKILO - Módulo de Choferes Cercanos
   - Pantalla con mapa de choferes disponibles (para clientes Premium)
   - Switch "Estar disponible" para choferes
   - Seguimiento de ubicación de choferes disponibles
   ============================================================ */

// ------------------------------------------------------------
// Estado interno del módulo
// ------------------------------------------------------------
const chmEstado = {
  mapa: null,
  capaMarcadores: null,
  marcadorYo: null,
  radioKm: 25,
  watchId: null,
  ticker: null,
  iniciado: false,
};

// ------------------------------------------------------------
// 1) Inicialización general (una sola vez)
// ------------------------------------------------------------
function inicializarMapaChoferes() {
  if (chmEstado.iniciado) return;
  chmEstado.iniciado = true;

  // Botón "Volver" en la pantalla del mapa
  document.getElementById("chm-btn-volver")?.addEventListener("click", cerrarMapaChoferes);
  // Botón "Refrescar" en la pantalla del mapa
  document.getElementById("chm-btn-refrescar")?.addEventListener("click", () => {
    cargarChoferesCercanos();
  });

  // Chips de radio (5, 10, 25, 50, 100, Todo)
  document.querySelectorAll("#chm-radio-chips .chm-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#chm-radio-chips .chm-chip").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      chmEstado.radioKm = Number(chip.getAttribute("data-radio")) || 25;
      cargarChoferesCercanos();
    });
  });

  // Switch "Estar disponible" en el perfil
  document.getElementById("chm-switch-disponible")?.addEventListener("change", (e) => {
    toggleDisponibilidadChofer(e.target.checked);
  });

  // Refrescar cada 30s mientras la pantalla está abierta
  chmEstado.ticker = setInterval(() => {
    if (document.querySelector(".pantalla.activa")?.id === "pantalla-choferes-mapa") {
      cargarChoferesCercanos();
    }
  }, 30000);
}

// ------------------------------------------------------------
// 2) Abrir la pantalla del mapa (llamada desde app.js)
// ------------------------------------------------------------
async function abrirMapaChoferes() {
  if (!estado.usuario) return;

  // Solo clientes Premium pueden acceder (la validación también está en app.js)
  if (estado.perfil?.rol === "cliente" && !estado.esPremium) {
    alert("⭐ El mapa de choferes cercanos es exclusivo del Plan Premium.\n\nActívalo por $10/mes desde tu perfil.");
    return;
  }

  // Mostrar la pantalla
  if (typeof window.mostrarPantalla === "function") {
    window.mostrarPantalla("pantalla-choferes-mapa");
  }

  // Mostrar overlay mientras carga
  mostrarOverlay("📍 Cargando choferes cercanos...");

  // Crear el mapa (o limpiar el anterior)
  setTimeout(async () => {
    await inicializarMapaLeaflet();
    await cargarChoferesCercanos();
  }, 150);
}

// ------------------------------------------------------------
// 3) Inicializar el mapa Leaflet
// ------------------------------------------------------------
async function inicializarMapaLeaflet() {
  const contenedor = document.getElementById("chm-mapa");
  if (!contenedor || typeof L === "undefined") return;

  // Si ya existe, lo destruimos para recrearlo limpio
  if (chmEstado.mapa) {
    chmEstado.mapa.remove();
    chmEstado.mapa = null;
  }

  // Centro inicial: ubicación del usuario (o La Habana por defecto)
  let centro = [23.1136, -82.3666]; // La Habana
  if (estado.ubicacionActual) {
    centro = [estado.ubicacionActual.lat, estado.ubicacionActual.lng];
  } else {
    // Intentar obtener ubicación actual
    const ubi = await obtenerUbicacion();
    if (ubi) centro = [ubi.lat, ubi.lng];
  }

  chmEstado.mapa = L.map(contenedor, { zoomControl: true, attributionControl: false })
    .setView(centro, 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(chmEstado.mapa);

  // Capa para los marcadores de choferes
  chmEstado.capaMarcadores = L.layerGroup().addTo(chmEstado.mapa);

  // Marcador de "mi ubicación" (azul)
  const iconoYo = L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  chmEstado.marcadorYo = L.marker(centro, { icon: iconoYo }).addTo(chmEstado.mapa);

  // Ajustar tamaño después de que el contenedor se vea
  setTimeout(() => chmEstado.mapa?.invalidateSize(), 250);
}

// ------------------------------------------------------------
// 4) Cargar choferes cercanos según el radio
// ------------------------------------------------------------
async function cargarChoferesCercanos() {
  if (!estado.usuario || !chmEstado.mapa) return;

  // Necesitamos ubicación
  const ubi = estado.ubicacionActual || await obtenerUbicacion();
  if (!ubi) {
    mostrarOverlay("⚠️ No pudimos obtener tu ubicación.\nActiva el GPS y vuelve a intentar.");
    ocultarOverlayAuto(3000);
    return;
  }

  // Actualizar mi marcador
  if (chmEstado.marcadorYo) {
    chmEstado.marcadorYo.setLatLng([ubi.lat, ubi.lng]);
  }

  // Limpiar marcadores anteriores
  chmEstado.capaMarcadores?.clearLayers();

  // Llamar a la RPC que trae los choferes cercanos
  const { data, error } = await db.rpc("choferes_cercanos", {
    p_lat: ubi.lat,
    p_lng: ubi.lng,
    p_radio_km: chmEstado.radioKm,
    p_limite: 50,
  });

  if (error) {
    console.warn("[mapa-choferes] error RPC:", error);
    mostrarOverlay("❌ No se pudieron cargar los choferes.\n" + error.message);
    ocultarOverlayAuto(3000);
    return;
  }

  const lista = data || [];
  const aviso = document.getElementById("chm-aviso");

  if (aviso) {
    aviso.textContent = lista.length === 0
      ? "🔍 No hay choferes disponibles en este radio."
      : `🟢 ${lista.length} chofer${lista.length === 1 ? "" : "es"} disponible${lista.length === 1 ? "" : "s"}`;
  }

  // Colocar marcadores
  lista.forEach((ch) => {
    if (ch.lat == null || ch.lng == null) return;

    const icono = L.divIcon({
      className: "",
      html: `<div style="width:36px;height:36px;border-radius:50%;background:#4f46e5;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:1.05rem;color:#fff;box-shadow:0 2px 8px rgba(15,23,42,0.3)">🚗</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marcador = L.marker([Number(ch.lat), Number(ch.lng)], { icon: icono });
    const nombre = ch.nombre || "Chofer";
    const vehiculo = ch.tipo_vehiculo ? ` · ${ch.tipo_vehiculo}` : "";
    const prom = ch.promedio != null ? Number(ch.promedio).toFixed(1) : "—";
    const estrellas = ch.promedio != null ? "★".repeat(Math.round(ch.promedio)) : "";

    marcador.bindPopup(`
      <div class="chm-popup">
        <div class="nombre">${escapar(nombre)}</div>
        <div class="vehiculo">${escapar(vehiculo.replace(/^ · /, ""))}</div>
        ${estrellas ? `<div class="estrellas">${estrellas}</div>` : ""}
        <div class="promedio">${prom} promedio</div>
      </div>
    `);

    marcador.addTo(chmEstado.capaMarcadores);
  });

  // Ajustar la vista
  if (lista.length > 0 && chmEstado.mapa) {
    const puntos = [[ubi.lat, ubi.lng]];
    lista.forEach((ch) => {
      if (ch.lat != null && ch.lng != null) puntos.push([Number(ch.lat), Number(ch.lng)]);
    });
    try {
      chmEstado.mapa.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 15 });
    } catch { /* ignore */ }
  }

  ocultarOverlay();
}

// ------------------------------------------------------------
// 5) Cerrar la pantalla del mapa
// ------------------------------------------------------------
function cerrarMapaChoferes() {
  if (chmEstado.mapa) {
    chmEstado.mapa.remove();
    chmEstado.mapa = null;
    chmEstado.capaMarcadores = null;
    chmEstado.marcadorYo = null;
  }
  if (typeof window.mostrarPantalla === "function") {
    window.mostrarPantalla("pantalla-perfil");
  }
}

// ------------------------------------------------------------
// 6) Switch "Estar disponible" para choferes
// ------------------------------------------------------------
async function toggleDisponibilidadChofer(disponible) {
  if (!estado.usuario || estado.perfil?.rol !== "chofer") return;

  const switchEl = document.getElementById("chm-switch-disponible");

  // Si intenta activar, comprobar suscripción
  if (disponible && !estado.suscripcion) {
    alert("⚠️ Necesitas una suscripción activa para estar disponible.");
    if (switchEl) switchEl.checked = false;
    return;
  }

  // Obtener ubicación si va a activarse
  let ubi = null;
  if (disponible) {
    ubi = estado.ubicacionActual || await obtenerUbicacion();
    if (!ubi) {
      alert("⚠️ Activa el GPS para estar disponible.");
      if (switchEl) switchEl.checked = false;
      return;
    }
  }

  if (switchEl) switchEl.disabled = true;

  try {
    if (disponible) {
      // Insertar o actualizar fila en choferes_online
      const { error } = await db.from("choferes_online").upsert(
        {
          chofer_id: estado.usuario.id,
          lat: ubi.lat,
          lng: ubi.lng,
          activo: true,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "chofer_id" }
      );
      if (error) throw error;

      // Empezar a rastrear ubicación mientras esté disponible
      iniciarRastreoDisponible();
    } else {
      // Desactivar
      const { error } = await db.from("choferes_online")
        .update({ activo: false, actualizado_en: new Date().toISOString() })
        .eq("chofer_id", estado.usuario.id);
      if (error) throw error;

      detenerRastreoDisponible();
    }
  } catch (err) {
    console.error("[mapa-choferes] toggle error:", err);
    alert("No se pudo cambiar la disponibilidad:\n" + (err?.message || err));
    if (switchEl) switchEl.checked = !disponible;
  } finally {
    if (switchEl) switchEl.disabled = false;
  }
}

// ------------------------------------------------------------
// 7) Rastreo de ubicación mientras el chofer está disponible
// ------------------------------------------------------------
function iniciarRastreoDisponible() {
  if (chmEstado.watchId !== null) return; // ya activo
  if (!navigator.geolocation) return;

  chmEstado.watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      estado.ubicacionActual = { lat: latitude, lng: longitude };
      // Actualizar en BD (silencioso)
      try {
        await db.from("choferes_online")
          .update({
            lat: latitude,
            lng: longitude,
            actualizado_en: new Date().toISOString(),
          })
          .eq("chofer_id", estado.usuario.id);
      } catch { /* ignore */ }
    },
    (err) => console.warn("[mapa-choferes] watch error:", err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}

function detenerRastreoDisponible() {
  if (chmEstado.watchId !== null) {
    navigator.geolocation.clearWatch(chmEstado.watchId);
    chmEstado.watchId = null;
  }
}

// ------------------------------------------------------------
// 8) Refrescar estado visual del switch (llamado desde app.js)
// ------------------------------------------------------------
async function refrescarEstadoSwitchChofer() {
  if (!estado.usuario || estado.perfil?.rol !== "chofer") return;

  const switchEl = document.getElementById("chm-switch-disponible");
  if (!switchEl) return;

  const { data } = await db.from("choferes_online")
    .select("activo")
    .eq("chofer_id", estado.usuario.id)
    .maybeSingle();

  switchEl.checked = !!data?.activo;

  // Si está activo, retomar el rastreo de ubicación
  if (data?.activo) iniciarRastreoDisponible();
}

// ------------------------------------------------------------
// 9) Helpers: overlay + ubicación
// ------------------------------------------------------------
function mostrarOverlay(texto) {
  const ov = document.getElementById("chm-overlay");
  const tx = document.getElementById("chm-overlay-texto");
  if (tx) tx.textContent = texto;
  if (ov) ov.classList.add("activo");
}

function ocultarOverlay() {
  document.getElementById("chm-overlay")?.classList.remove("activo");
}

function ocultarOverlayAuto(ms = 3000) {
  setTimeout(ocultarOverlay, ms);
}

function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const u = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        estado.ubicacionActual = u;
        resolve(u);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  });
}

// ------------------------------------------------------------
// 10) Exponer funciones globales para que app.js las use
// ------------------------------------------------------------
window.abrirMapaChoferes = abrirMapaChoferes;
window.refrescarEstadoSwitchChofer = refrescarEstadoSwitchChofer;

// ------------------------------------------------------------
// 11) Inicialización al cargar el DOM
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", inicializarMapaChoferes);