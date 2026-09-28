/* ============================================================
   ALKILO - Mapa de choferes cercanos (módulo independiente)
   ============================================================ */

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Configuración
  // ------------------------------------------------------------
  const REFRESH_INTERVALO_MS = 15000;

  // ------------------------------------------------------------
  // Estado interno
  // ------------------------------------------------------------
  const chm = {
    mapa: null,
    marcadores: {},
    marcadorYo: null,
    canalRealtime: null,
    tickRefresh: null,
    watchId: null,
    disponible: false,
    inicializado: false,
    pausado: false,
  };

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  function esc(txt) {
    if (txt == null) return "";
    return String(txt)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function estrellasVisuales(promedio) {
    const llenas = Math.round(Number(promedio) || 0);
    return "★".repeat(llenas) + "☆".repeat(Math.max(0, 5 - llenas));
  }

  function iconoChofer(esYo) {
    return L.divIcon({
      className: "",
      html: `<div class="chm-marcador ${esYo ? "mi-ubicacion" : ""}">${esYo ? "📍" : "🚗"}</div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22],
    });
  }

  // ------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------
  const el = {};

  function cachear() {
    [
      "pantalla-choferes-mapa",
      "chm-btn-volver",
      "chm-btn-refrescar",
      "chm-aviso",
      "chm-mapa",
      "chm-overlay",
      "chm-overlay-texto",
    ].forEach((id) => { el[id.replace(/-/g, "_")] = document.getElementById(id); });
  }

  function mostrarOverlay(texto) {
    if (!el.chm_overlay) return;
    el.chm_overlay.classList.remove("oculto");
    if (el.chm_overlay_texto) el.chm_overlay_texto.textContent = texto || "Cargando...";
  }

  function ocultarOverlay() {
    el.chm_overlay?.classList.add("oculto");
  }

  function setAviso(texto, vacio) {
    if (!el.chm_aviso) return;
    el.chm_aviso.textContent = texto || "";
    el.chm_aviso.classList.toggle("vacio", !!vacio);
  }

  // ------------------------------------------------------------
  // Mapa
  // ------------------------------------------------------------
  function inicializarMapa() {
    if (chm.mapa) return;
    const contenedor = el.chm_mapa;
    if (!contenedor) return;

    chm.mapa = L.map(contenedor, { zoomControl: true }).setView([10.4806, -66.9036], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(chm.mapa);

    setTimeout(() => chm.mapa?.invalidateSize(), 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!chm.mapa) return;
          const yo = [pos.coords.latitude, pos.coords.longitude];
          chm.mapa.setView(yo, 14);
          if (chm.marcadorYo) {
            chm.marcadorYo.setLatLng(yo);
          } else {
            chm.marcadorYo = L.marker(yo, { icon: iconoChofer(true) })
              .addTo(chm.mapa)
              .bindPopup("Tú estás aquí");
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }

  function crearPopupHTML(chofer) {
    const foto = chofer.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52'><rect width='52' height='52' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='24' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
    const promedio = Number(chofer.promedio || 0).toFixed(1);
    const total = Number(chofer.total || 0);
    const estrellas = estrellasVisuales(promedio);

    return `
      <div class="chm-popup">
        <div class="fila">
          <img src="${foto}" alt="Foto" />
          <div class="info">
            <div class="nombre">${esc(chofer.nombre || "Chofer")}</div>
            <div class="estrellas">
              ${estrellas}
              <span class="promedio">${promedio}</span>
              <span class="total">(${total})</span>
            </div>
          </div>
        </div>
        <div class="acciones">
          <button class="btn-perfil" data-perfil="${chofer.chofer_id}">👤 Perfil</button>
          <button class="btn-contactar" data-contactar="${chofer.chofer_id}">💬 Contactar</button>
        </div>
      </div>
    `;
  }

  function pintarChoferes(lista) {
    if (!chm.mapa) return;

    const idsActuales = new Set(lista.map((c) => c.chofer_id));
    Object.keys(chm.marcadores).forEach((id) => {
      if (!idsActuales.has(id)) {
        try { chm.mapa.removeLayer(chm.marcadores[id]); } catch {}
        delete chm.marcadores[id];
      }
    });

    lista.forEach((ch) => {
      if (ch.lat == null || ch.lng == null) return;
      const pos = [Number(ch.lat), Number(ch.lng)];
      const popup = crearPopupHTML(ch);

      if (chm.marcadores[ch.chofer_id]) {
        chm.marcadores[ch.chofer_id].setLatLng(pos).setPopupContent(popup);
      } else {
        const m = L.marker(pos, { icon: iconoChofer(false) })
          .addTo(chm.mapa)
          .bindPopup(popup);

        m.on("popupopen", (ev) => {
          const popupEl = ev.popup.getElement();
          if (!popupEl) return;
          popupEl.querySelector("[data-perfil]")?.addEventListener("click", () => {
            if (typeof window.abrirPerfilPublico === "function") {
              window.abrirPerfilPublico(ch.chofer_id);
            }
          });
          popupEl.querySelector("[data-contactar]")?.addEventListener("click", () => {
            contactarChofer(ch);
          });
        });

        chm.marcadores[ch.chofer_id] = m;
      }
    });

    if (lista.length === 0) {
      setAviso("No hay choferes disponibles cerca ahora mismo.", true);
    } else {
      setAviso(`🚗 ${lista.length} chofer${lista.length === 1 ? "" : "es"} disponible${lista.length === 1 ? "" : "s"} ahora`);
    }
  }

  function contactarChofer(ch) {
    const tel = (ch.telefono || "").replace(/[^0-9+]/g, "");
    if (!tel) {
      alert("Este chofer no tiene teléfono público. Pídele un viaje para que te contacte.");
      return;
    }
    const texto = encodeURIComponent(`Hola ${ch.nombre || ""}, te contacto desde ALKILO.`);
    window.open(`https://wa.me/${tel.replace(/^\+/, "")}?text=${texto}`, "_blank");
  }

  async function cargarChoferes() {
    if (!chm.mapa || chm.pausado) return;
    try {
      const { data, error } = await db.rpc("choferes_cercanos", { p_limite: 50 });
      if (error) {
        console.warn("[mapa-choferes] error rpc:", error);
        setAviso("No se pudo cargar la lista de choferes.", true);
        return;
      }
      pintarChoferes(data || []);
    } catch (err) {
      console.warn("[mapa-choferes] excepción:", err);
    }
  }

  // ------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------
  function suscribirRealtime() {
    if (chm.canalRealtime) return;
    chm.canalRealtime = db
      .channel("choferes-online-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "choferes_online" }, () => {
        cargarChoferes();
      })
      .subscribe((s) => console.log("[Realtime choferes_online]", s));
  }

  function detenerRealtime() {
    if (chm.canalRealtime) {
      try { db.removeChannel(chm.canalRealtime); } catch {}
      chm.canalRealtime = null;
    }
  }

  // ------------------------------------------------------------
  // Abrir / cerrar pantalla
  // ------------------------------------------------------------
  async function abrir() {
    if (!el.pantalla_choferes_mapa) {
      alert("Pantalla no encontrada. Revisa index.html.");
      return;
    }

    if (typeof window.mostrarPantalla === "function") {
      window.mostrarPantalla("pantalla-choferes-mapa");
    } else {
      document.querySelectorAll(".pantalla").forEach((p) => p.classList.remove("activa"));
      el.pantalla_choferes_mapa.classList.add("activa");
    }

    chm.pausado = false;
    mostrarOverlay("Cargando mapa...");

    setTimeout(async () => {
      inicializarMapa();
      suscribirRealtime();
      await cargarChoferes();
      ocultarOverlay();
      iniciarRefreshAuto();
    }, 200);
  }

  function cerrar() {
    chm.pausado = true;
    detenerRealtime();
    detenerRefreshAuto();

    if (typeof window.mostrarPantalla === "function") {
      window.mostrarPantalla("pantalla-perfil");
    } else {
      document.querySelectorAll(".pantalla").forEach((p) => p.classList.remove("activa"));
      document.getElementById("pantalla-perfil")?.classList.add("activa");
    }
  }

  function iniciarRefreshAuto() {
    detenerRefreshAuto();
    chm.tickRefresh = setInterval(cargarChoferes, REFRESH_INTERVALO_MS);
  }

  function detenerRefreshAuto() {
    if (chm.tickRefresh) {
      clearInterval(chm.tickRefresh);
      chm.tickRefresh = null;
    }
  }

  // ------------------------------------------------------------
  // Modo chofer: disponibilidad
  // ------------------------------------------------------------
  async function activarDisponibilidad() {
    const { data: userData } = await db.auth.getUser();
    if (!userData?.user) return false;

    // Verificar que el usuario sea chofer (defensa extra)
    const { data: perfil } = await db
      .from("perfiles")
      .select("rol")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (perfil?.rol !== "chofer") {
      alert("Solo los choferes pueden activar la disponibilidad.");
      return false;
    }

    const { error } = await db.from("choferes_online").upsert({
      chofer_id: userData.user.id,
      activo: true,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: "chofer_id" });

    if (error) {
      alert("No se pudo activar tu disponibilidad: " + error.message);
      return false;
    }

    iniciarEnvioUbicacion();
    chm.disponible = true;
    return true;
  }

  async function desactivarDisponibilidad() {
    const { data: userData } = await db.auth.getUser();
    if (!userData?.user) return;

    await db.from("choferes_online")
      .update({ activo: false, actualizado_en: new Date().toISOString() })
      .eq("chofer_id", userData.user.id);

    detenerEnvioUbicacion();
    chm.disponible = false;
  }

  function iniciarEnvioUbicacion() {
    if (chm.watchId != null) return;
    if (!navigator.geolocation) return;

    chm.watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { data: userData } = await db.auth.getUser();
        if (!userData?.user) return;
        await db.from("choferes_online").upsert({
          chofer_id: userData.user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          activo: true,
          actualizado_en: new Date().toISOString(),
        }, { onConflict: "chofer_id" });
      },
      (err) => console.warn("[mapa-choferes] GPS error:", err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  function detenerEnvioUbicacion() {
    if (chm.watchId != null) {
      navigator.geolocation.clearWatch(chm.watchId);
      chm.watchId = null;
    }
  }

  // ------------------------------------------------------------
  // Refrescar el switch
  // ------------------------------------------------------------
  async function refrescarEstadoSwitch() {
    const sw = document.getElementById("chm-switch-disponible");
    if (!sw) return;

    // Verificar que sea chofer
    const { data: userData } = await db.auth.getUser();
    if (!userData?.user) return;

    const { data: perfil } = await db
      .from("perfiles")
      .select("rol")
      .eq("id", userData.user.id)
      .maybeSingle();

    // Ocultar el switch si NO es chofer
    const cardSwitch = document.getElementById("chm-switch-wrapper");
    if (perfil?.rol !== "chofer") {
      cardSwitch?.classList.add("oculto");
      return;
    }
    cardSwitch?.classList.remove("oculto");

    const { data } = await db
      .from("choferes_online")
      .select("activo, actualizado_en")
      .eq("chofer_id", userData.user.id)
      .maybeSingle();

    let activo = !!(data?.activo);

    if (activo && data?.actualizado_en) {
      const diff = Date.now() - new Date(data.actualizado_en).getTime();
      if (diff > 10 * 60 * 1000) activo = false;
    }

    sw.checked = activo;
    chm.disponible = activo;

    if (activo && chm.watchId == null) {
      iniciarEnvioUbicacion();
    }
  }

  // ------------------------------------------------------------
  // Eventos
  // ------------------------------------------------------------
  function conectarEventos() {
    el.chm_btn_volver?.addEventListener("click", cerrar);
    el.chm_btn_refrescar?.addEventListener("click", async () => {
      mostrarOverlay("Actualizando...");
      await cargarChoferes();
      ocultarOverlay();
    });

    document.addEventListener("change", async (e) => {
      if (!e.target || e.target.id !== "chm-switch-disponible") return;
      const sw = e.target;
      sw.disabled = true;
      if (sw.checked) {
        const ok = await activarDisponibilidad();
        if (!ok) sw.checked = false;
        else console.log("[mapa-choferes] disponible = true");
      } else {
        await desactivarDisponibilidad();
        console.log("[mapa-choferes] disponible = false");
      }
      sw.disabled = false;
    });

    window.addEventListener("beforeunload", () => {
      if (chm.disponible && window.estado?.usuario?.id) {
        try {
          db.from("choferes_online")
            .update({ activo: false, actualizado_en: new Date().toISOString() })
            .eq("chofer_id", window.estado.usuario.id);
        } catch {}
      }
    });
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------
  function init() {
    if (chm.inicializado) return;
    chm.inicializado = true;
    cachear();
    conectarEventos();

    window.abrirMapaChoferes = abrir;
    window.refrescarEstadoSwitchChofer = refrescarEstadoSwitch;

    console.log("[mapa-choferes] módulo listo");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
