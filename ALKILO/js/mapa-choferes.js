/* ============================================================
   ALKILO - Mapa de choferes cercanos (módulo independiente)
   ============================================================ */
(function () {
  "use strict";

  const REFRESH_INTERVALO_MS = 15000;

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
    radioKm: 25,
    miLat: null,
    miLng: null,
  };

  function esc(txt) {
    if (txt == null) return "";
    return String(txt).replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  function estrellasVisuales(promedio) {
    const llenas = Math.round(Number(promedio) || 0);
    return "★".repeat(llenas) + "☆".repeat(Math.max(0, 5 - llenas));
  }

  function formatoKm(km) {
    if (km == null) return "";
    const n = Number(km);
    if (n < 1) return Math.round(n * 1000) + " m";
    return n.toFixed(1) + " km";
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

  const el = {};
  function cachear() {
    [
      "pantalla-choferes-mapa","chm-btn-volver","chm-btn-refrescar",
      "chm-aviso","chm-mapa","chm-overlay","chm-overlay-texto",
      "chm-radio-chips",
    ].forEach((id) => { el[id.replace(/-/g,"_")] = document.getElementById(id); });
  }

  function mostrarOverlay(t) {
    if (!el.chm_overlay) return;
    el.chm_overlay.classList.remove("oculto");
    if (el.chm_overlay_texto) el.chm_overlay_texto.textContent = t || "Cargando...";
  }
  function ocultarOverlay() { el.chm_overlay?.classList.add("oculto"); }

  function setAviso(t, vacio) {
    if (!el.chm_aviso) return;
    el.chm_aviso.textContent = t || "";
    el.chm_aviso.classList.toggle("vacio", !!vacio);
  }

  function inicializarMapa() {
    if (chm.mapa) return;
    const c = el.chm_mapa;
    if (!c) return;

    chm.mapa = L.map(c, { zoomControl: true }).setView([10.4806, -66.9036], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(chm.mapa);

    setTimeout(() => chm.mapa?.invalidateSize(), 250);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!chm.mapa) return;
          const yo = [pos.coords.latitude, pos.coords.longitude];
          chm.miLat = pos.coords.latitude;
          chm.miLng = pos.coords.longitude;
          chm.mapa.setView(yo, 13);
          if (chm.marcadorYo) chm.marcadorYo.setLatLng(yo);
          else chm.marcadorYo = L.marker(yo, { icon: iconoChofer(true) })
            .addTo(chm.mapa).bindPopup("Tú estás aquí");
          cargarChoferes();
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }

  function crearPopupHTML(ch) {
    const foto = ch.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52'><rect width='52' height='52' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='24' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
    const promedio = Number(ch.promedio || 0).toFixed(1);
    const total = Number(ch.total || 0);
    const estrellas = estrellasVisuales(promedio);
    const dist = ch.distancia_km != null ? formatoKm(ch.distancia_km) : "";

    window.__chmChoferes = window.__chmChoferes || {};
    window.__chmChoferes[ch.chofer_id] = ch;

    return `
      <div class="chm-popup">
        <div class="fila">
          <img src="${foto}" alt="Foto" />
          <div class="info">
            <div class="nombre">${esc(ch.nombre || "Chofer")}</div>
            <div class="estrellas">
              ${estrellas}
              <span class="promedio">${promedio}</span>
              <span class="total">(${total})</span>
            </div>
            ${dist ? `<div class="distancia">📏 ${dist} de ti</div>` : ""}
          </div>
        </div>
        <div class="acciones">
          <button class="btn-perfil" type="button" onclick="window.__chmVerPerfil('${ch.chofer_id}'); return false;">👤 Perfil</button>
          <button class="btn-contactar" type="button" onclick="window.__chmContactar('${ch.chofer_id}'); return false;">💬 Contactar</button>
        </div>
      </div>
    `;
  }

  function pintarChoferes(lista) {
    if (!chm.mapa) return;

    const idsAct = new Set(lista.map((c) => c.chofer_id));
    Object.keys(chm.marcadores).forEach((id) => {
      if (!idsAct.has(id)) {
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
          .addTo(chm.mapa).bindPopup(popup);
        m.on("popupopen", (ev) => {
          const popupEl = ev.popup.getElement();
          if (!popupEl) return;
          if (window.L?.DomEvent) {
            L.DomEvent.disableClickPropagation(popupEl);
            L.DomEvent.disableScrollPropagation(popupEl);
          }
        });
        chm.marcadores[ch.chofer_id] = m;
      }
    });

    const radioTxt = chm.radioKm > 0 ? `en ${chm.radioKm} km` : "en cualquier distancia";
    if (lista.length === 0) setAviso(`No hay choferes disponibles ${radioTxt}.`, true);
    else setAviso(`🚗 ${lista.length} chofer${lista.length === 1 ? "" : "es"} disponible${lista.length === 1 ? "" : "s"} ${radioTxt}`);
  }

  function contactarChofer(ch) {
    const tel = (ch.telefono || "").replace(/[^0-9+]/g, "");
    if (!tel) return alert("Este chofer no tiene teléfono público.");
    const texto = encodeURIComponent(`Hola ${ch.nombre || ""}, te contacto desde ALKILO.`);
    window.open(`https://wa.me/${tel.replace(/^\+/, "")}?text=${texto}`, "_blank");
  }

  async function cargarChoferes() {
    if (!chm.mapa || chm.pausado) return;
    try {
      const params = {
        p_limite: 100,
        p_radio_km: chm.radioKm > 0 ? chm.radioKm : 0,
      };
      if (chm.miLat != null && chm.miLng != null) {
        params.p_lat = chm.miLat;
        params.p_lng = chm.miLng;
      }
      const { data, error } = await db.rpc("choferes_cercanos", params);
      if (error) { console.warn("[chm] rpc error:", error); setAviso("No se pudo cargar la lista.", true); return; }
      pintarChoferes(data || []);
    } catch (err) { console.warn("[chm] excepción:", err); }
  }

  function suscribirRealtime() {
    if (chm.canalRealtime) return;
    chm.canalRealtime = db.channel("choferes-online-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "choferes_online" }, () => cargarChoferes())
      .subscribe((s) => console.log("[Realtime choferes_online]", s));
  }

  function detenerRealtime() {
    if (chm.canalRealtime) {
      try { db.removeChannel(chm.canalRealtime); } catch {}
      chm.canalRealtime = null;
    }
  }

  async function abrir() {
    if (!el.pantalla_choferes_mapa) return alert("Pantalla no encontrada.");
    if (typeof window.mostrarPantalla === "function") window.mostrarPantalla("pantalla-choferes-mapa");
    else {
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
    if (typeof window.mostrarPantalla === "function") window.mostrarPantalla("pantalla-perfil");
    else {
      document.querySelectorAll(".pantalla").forEach((p) => p.classList.remove("activa"));
      document.getElementById("pantalla-perfil")?.classList.add("activa");
    }
  }

  function iniciarRefreshAuto() {
    detenerRefreshAuto();
    chm.tickRefresh = setInterval(cargarChoferes, REFRESH_INTERVALO_MS);
  }
  function detenerRefreshAuto() {
    if (chm.tickRefresh) { clearInterval(chm.tickRefresh); chm.tickRefresh = null; }
  }

  async function tieneServicioActivo() {
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return false;
    const { data, error } = await db.from("solicitudes").select("id")
      .eq("chofer_id", u.user.id)
      .in("estado", ["aceptado","en_camino","llego","en_curso"]).limit(1);
    if (error) { console.warn("[chm] error servicio:", error); return false; }
    return !!(data && data.length > 0);
  }

  async function activarDisponibilidad() {
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return false;
    const { data: p } = await db.from("perfiles").select("rol").eq("id", u.user.id).maybeSingle();
    if (p?.rol !== "chofer") { alert("Solo los choferes pueden activar la disponibilidad."); return false; }
    if (await tieneServicioActivo()) {
      alert("Tienes un servicio activo. Finalízalo o cancélalo antes de ponerte disponible.");
      return false;
    }
    const { error } = await db.from("choferes_online").upsert({
      chofer_id: u.user.id, activo: true, actualizado_en: new Date().toISOString(),
    }, { onConflict: "chofer_id" });
    if (error) { alert("No se pudo activar: " + error.message); return false; }
    iniciarEnvioUbicacion();
    chm.disponible = true;
    return true;
  }

  async function desactivarDisponibilidad() {
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return;
    await db.from("choferes_online")
      .update({ activo: false, actualizado_en: new Date().toISOString() })
      .eq("chofer_id", u.user.id);
    detenerEnvioUbicacion();
    chm.disponible = false;
  }

  function iniciarEnvioUbicacion() {
    if (chm.watchId != null) return;
    if (!navigator.geolocation) return;
    chm.watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { data: u } = await db.auth.getUser();
        if (!u?.user) return;
        await db.from("choferes_online").upsert({
          chofer_id: u.user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          activo: true,
          actualizado_en: new Date().toISOString(),
        }, { onConflict: "chofer_id" });
      },
      (err) => console.warn("[chm] GPS error:", err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  function detenerEnvioUbicacion() {
    if (chm.watchId != null) {
      navigator.geolocation.clearWatch(chm.watchId);
      chm.watchId = null;
    }
  }

  async function refrescarEstadoSwitch() {
    const sw = document.getElementById("chm-switch-disponible");
    const card = document.getElementById("chm-switch-wrapper");
    const sub = card?.querySelector(".chm-switch-sub");
    const titulo = card?.querySelector(".chm-switch-titulo");
    if (!sw) return;

    const { data: u } = await db.auth.getUser();
    if (!u?.user) return;

    const { data: p } = await db.from("perfiles").select("rol").eq("id", u.user.id).maybeSingle();
    if (p?.rol !== "chofer") { card?.classList.add("oculto"); return; }
    card?.classList.remove("oculto");

    const activo = await tieneServicioActivo();
    if (activo) {
      sw.checked = false; sw.disabled = true;
      if (titulo) titulo.textContent = "🔴 Ocupado con servicio";
      if (sub) sub.textContent = "Termina el servicio actual para estar disponible";
      await db.from("choferes_online")
        .update({ activo: false, actualizado_en: new Date().toISOString() })
        .eq("chofer_id", u.user.id);
      detenerEnvioUbicacion();
      chm.disponible = false;
      return;
    }

    sw.disabled = false;
    if (titulo) titulo.textContent = "🟢 Estar disponible";
    if (sub) sub.textContent = "Aparecerás en el mapa de clientes";

    const { data } = await db.from("choferes_online")
      .select("activo, actualizado_en").eq("chofer_id", u.user.id).maybeSingle();

    let act = !!(data?.activo);
    if (act && data?.actualizado_en) {
      const d = Date.now() - new Date(data.actualizado_en).getTime();
      if (d > 10 * 60 * 1000) act = false;
    }
    sw.checked = act;
    chm.disponible = act;
    if (act && chm.watchId == null) iniciarEnvioUbicacion();
  }

  function conectarEventos() {
    el.chm_btn_volver?.addEventListener("click", cerrar);
    el.chm_btn_refrescar?.addEventListener("click", async () => {
      mostrarOverlay("Actualizando...");
      await cargarChoferes();
      ocultarOverlay();
    });

    // Chips de radio
    el.chm_radio_chips?.querySelectorAll(".chm-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        el.chm_radio_chips.querySelectorAll(".chm-chip").forEach((c) => c.classList.remove("activo"));
        chip.classList.add("activo");
        chm.radioKm = Number(chip.getAttribute("data-radio")) || 0;
        cargarChoferes();
      });
    });

    document.addEventListener("change", async (e) => {
      if (!e.target || e.target.id !== "chm-switch-disponible") return;
      const sw = e.target;
      sw.disabled = true;
      if (sw.checked) {
        const ok = await activarDisponibilidad();
        if (!ok) sw.checked = false;
      } else {
        await desactivarDisponibilidad();
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

  function init() {
    if (chm.inicializado) return;
    chm.inicializado = true;
    cachear();
    conectarEventos();

    window.abrirMapaChoferes = abrir;
    window.refrescarEstadoSwitchChofer = refrescarEstadoSwitch;

    window.__chmVerPerfil = (id) => {
      if (typeof window.abrirPerfilPublico === "function") window.abrirPerfilPublico(id);
      else alert("No se pudo abrir el perfil.");
    };
    window.__chmContactar = (id) => {
      const ch = window.__chmChoferes?.[id];
      if (ch) contactarChofer(ch);
    };

    console.log("[mapa-choferes] módulo listo");
  }

  document.addEventListener("DOMContentLoaded", init);
})();