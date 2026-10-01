/* ============================================================
   ALKILO - Módulo Terminal (viajes programados interprovinciales)
   Se carga DESPUÉS de app.js. Usa variables globales:
   db, estado, el, mostrarPantalla, escapar, formatearFecha,
   setMensaje, setBotonCargando, traducirError, LISTA_PROVINCIAS,
   obtenerMunicipios
   ============================================================ */

// ------------------------------------------------------------
// 1) Constantes del módulo
// ------------------------------------------------------------
const TERM_PRECIO_PUBLICACION = 50;
const TERM_PRECIO_RESERVA = 20;
const TERM_MAX_FAMILIAR = 3;   // máximo de asientos por reserva (1 + 2 familiares)
const TERM_MAX_RESERVAS_ACTIVAS = 3;

// ------------------------------------------------------------
// 2) Añadir pantallas al array global PANTALLAS
//    (mutación del array const existente, sin reasignarlo)
// ------------------------------------------------------------
const TERM_PANTALLAS = [
  "pantalla-terminal",
  "pantalla-terminal-publicar",
  "pantalla-terminal-mapa-punto",
  "pantalla-terminal-mi-viaje",
  "pantalla-terminal-escanear",
  "pantalla-terminal-buscar",
  "pantalla-terminal-detalle",
  "pantalla-terminal-reservar",
  "pantalla-terminal-mis-reservas",
  "pantalla-terminal-ver-qr",
];

if (typeof PANTALLAS !== "undefined" && Array.isArray(PANTALLAS)) {
  TERM_PANTALLAS.forEach((p) => {
    if (!PANTALLAS.includes(p)) PANTALLAS.push(p);
  });
}

// ------------------------------------------------------------
// 3) Estado local del módulo
// ------------------------------------------------------------
const termEstado = {
  // Mapa del selector de punto de encuentro
  mapaPunto: null,
  marcadorPunto: null,
  puntoLat: null,
  puntoLng: null,

  // Mapa del detalle de viaje (mini)
  mapaDetalle: null,

  // Viaje que el chofer tiene activo (o null)
  viajeActivo: null,

  // Reservas del chofer (para validar QR offline)
  reservasDelViaje: [],

  // Viaje que el cliente está viendo en detalle
  viajeDetalle: null,

  // QR actualmente mostrado
  qrActual: null,

  // Cantidad de pasajeros en el form de reserva
  cantidadPasajeros: 1,

  // Scanner activo
  scanner: null,

  // Watch de ubicación del chofer (para viaje en_curso)
  watchUbicacion: null,
  canalUbicacion: null,
};

// ------------------------------------------------------------
// 4) Inicialización de listeners
// ------------------------------------------------------------
function inicializarTerminal() {
  // Botón Terminal en el perfil
  document.getElementById("btn-ir-terminal")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal");
    cargarMenuTerminal();
  });

  document.getElementById("btn-refrescar-terminal")?.addEventListener("click", cargarMenuTerminal);

  // ---- CHOFER: publicar ----
  document.getElementById("btn-publicar-viaje")?.addEventListener("click", () => {
    abrirPublicarViaje();
  });
  document.getElementById("btn-volver-terminal-publicar")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal");
    cargarMenuTerminal();
  });
  document.getElementById("form-terminal-publicar")?.addEventListener("submit", publicarViaje);

  // ---- CHOFER: mapa punto de encuentro ----
  document.getElementById("term-btn-marcar-punto")?.addEventListener("click", abrirMapaPunto);
  document.getElementById("btn-cancelar-mapa-punto")?.addEventListener("click", cerrarMapaPunto);
  document.getElementById("btn-confirmar-punto-terminal")?.addEventListener("click", confirmarPunto);

  // ---- CHOFER: mi viaje activo ----
  document.getElementById("btn-ver-mi-viaje")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-mi-viaje");
    cargarMiViajeActivo();
  });
  document.getElementById("btn-refrescar-mi-viaje")?.addEventListener("click", cargarMiViajeActivo);
  document.getElementById("btn-term-cerrar-viaje")?.addEventListener("click", cerrarViaje);
  document.getElementById("btn-term-iniciar-viaje")?.addEventListener("click", iniciarViaje);
  document.getElementById("btn-term-finalizar-viaje")?.addEventListener("click", finalizarViaje);
  document.getElementById("btn-term-cancelar-viaje")?.addEventListener("click", cancelarViajeChofer);

  // ---- CHOFER: escanear QR ----
  document.getElementById("btn-escanear-qr")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-escanear");
    iniciarScanner();
  });
  document.getElementById("btn-term-escanear-manual")?.addEventListener("click", escanearManual);

  // ---- CLIENTE: buscar ----
  document.getElementById("btn-buscar-viajes")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-buscar");
    prepararFiltrosTerminal();
    buscarViajes();
  });
  document.getElementById("btn-aplicar-filtros-terminal")?.addEventListener("click", buscarViajes);
  document.getElementById("btn-refrescar-buscar-viajes")?.addEventListener("click", buscarViajes);

  // ---- CLIENTE: detalle ----
  document.getElementById("btn-volver-detalle-viaje")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-buscar");
    buscarViajes();
  });
  document.getElementById("btn-term-reservar")?.addEventListener("click", abrirReservar);

  // ---- CLIENTE: reservar ----
  document.getElementById("btn-volver-reservar")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-detalle");
  });
  document.getElementById("form-terminal-reservar")?.addEventListener("submit", confirmarReserva);
  document.getElementById("term-es-familiar")?.addEventListener("change", toggleFamiliar);
  document.getElementById("btn-term-añadir-pasajero")?.addEventListener("click", anadirPasajero);

  // ---- CLIENTE: mis reservas ----
  document.getElementById("btn-mis-reservas")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-mis-reservas");
    cargarMisReservas();
  });
  document.getElementById("btn-refrescar-mis-reservas")?.addEventListener("click", cargarMisReservas);

  // ---- CLIENTE: ver QR ----
  document.getElementById("btn-volver-ver-qr")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-terminal-mis-reservas");
    cargarMisReservas();
  });
  document.getElementById("btn-term-descargar-qr")?.addEventListener("click", descargarQR);

  // Volver a pantalla-terminal desde otras secciones cuando se termine
  document.querySelectorAll("#pantalla-terminal-mi-viaje [data-volver], #pantalla-terminal-mis-reservas [data-volver]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        // Los data-volver ya se manejan en app.js (mostrarPantalla).
      });
    });

  // Cargar selects de provincias del formulario publicar
  llenarProvinciasTerminal();
}

// ------------------------------------------------------------
// 5) Llenar selects de provincias del módulo
// ------------------------------------------------------------
function llenarProvinciasTerminal() {
  const poblar = (idSelect) => {
    const sel = document.getElementById(idSelect);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Elige provincia —</option>';
    if (typeof LISTA_PROVINCIAS === "undefined") return;
    LISTA_PROVINCIAS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      sel.appendChild(opt);
    });
  };

  poblar("term-origen-provincia");
  poblar("term-destino-provincia");
  poblar("term-filtro-origen");
  poblar("term-filtro-destino");

  // Eventos: cambio de provincia → llenar municipios (form publicar)
  document.getElementById("term-origen-provincia")?.addEventListener("change", (e) => {
    const sel = document.getElementById("term-origen-municipio");
    if (!sel) return;
    if (!e.target.value) {
      sel.innerHTML = '<option value="">— Cualquier municipio —</option>';
      sel.disabled = true;
      return;
    }
    const muns = (typeof obtenerMunicipios === "function") ? obtenerMunicipios(e.target.value) : [];
    sel.innerHTML = '<option value="">— Cualquier municipio —</option>';
    muns.forEach((m) => {
      const o = document.createElement("option");
      o.value = m; o.textContent = m;
      sel.appendChild(o);
    });
    sel.disabled = false;
  });

  document.getElementById("term-destino-provincia")?.addEventListener("change", (e) => {
    const sel = document.getElementById("term-destino-municipio");
    if (!sel) return;
    if (!e.target.value) {
      sel.innerHTML = '<option value="">— Cualquier municipio —</option>';
      sel.disabled = true;
      return;
    }
    const muns = (typeof obtenerMunicipios === "function") ? obtenerMunicipios(e.target.value) : [];
    sel.innerHTML = '<option value="">— Cualquier municipio —</option>';
    muns.forEach((m) => {
      const o = document.createElement("option");
      o.value = m; o.textContent = m;
      sel.appendChild(o);
    });
    sel.disabled = false;
  });
}

// ------------------------------------------------------------
// 6) Menú principal de Terminal (dinámico según rol)
// ------------------------------------------------------------
async function cargarMenuTerminal() {
  if (!estado.usuario || !estado.perfil) return;

  const menuChofer  = document.getElementById("terminal-menu-chofer");
  const menuCliente = document.getElementById("terminal-menu-cliente");
  if (!menuChofer || !menuCliente) return;

  if (estado.perfil.rol === "chofer") {
    menuChofer.classList.remove("oculto");
    menuCliente.classList.add("oculto");

    // Ver si tiene viaje activo
    const { data, error } = await db.rpc("obtener_mi_viaje_activo");
    termEstado.viajeActivo = error ? null : data;

    const sinViaje = document.getElementById("terminal-sin-viaje");
    const conViaje = document.getElementById("terminal-con-viaje");

    if (termEstado.viajeActivo) {
      sinViaje?.classList.add("oculto");
      conViaje?.classList.remove("oculto");
    } else {
      sinViaje?.classList.remove("oculto");
      conViaje?.classList.add("oculto");
    }
  } else if (estado.perfil.rol === "cliente") {
    menuChofer.classList.add("oculto");
    menuCliente.classList.remove("oculto");

    // Actualizar badge de reservas activas
    await actualizarBadgeReservas();
  } else {
    menuChofer.classList.add("oculto");
    menuCliente.classList.add("oculto");
  }
}

async function actualizarBadgeReservas() {
  if (!estado.usuario) return;
  const { count } = await db.from("reservas_viaje")
    .select("*", { count: "exact", head: true })
    .eq("cliente_id", estado.usuario.id)
    .in("estado", ["activa", "validada"]);

  const badge = document.getElementById("badge-mis-reservas");
  if (badge) {
    const n = Number(count || 0);
    badge.textContent = n;
    badge.classList.toggle("oculto", n === 0);
  }
}

// ------------------------------------------------------------
// 7) PUBLICAR VIAJE (chofer)
// ------------------------------------------------------------
function abrirPublicarViaje() {
  const form = document.getElementById("form-terminal-publicar");
  form?.reset();

  // Resetear selects municipios
  const om = document.getElementById("term-origen-municipio");
  const dm = document.getElementById("term-destino-municipio");
  if (om) { om.innerHTML = '<option value="">— Cualquier municipio —</option>'; om.disabled = true; }
  if (dm) { dm.innerHTML = '<option value="">— Cualquier municipio —</option>'; dm.disabled = true; }

  // Resetear punto
  termEstado.puntoLat = null;
  termEstado.puntoLng = null;
  setMensaje("term-estado-punto", "Sin punto marcado. Toca el botón de arriba para elegirlo en el mapa.");

  // Resetear fecha/hora (fecha de hoy por defecto)
  const hoy = new Date().toISOString().slice(0, 10);
  const fEl = document.getElementById("term-fecha");
  if (fEl) fEl.value = hoy;

  setMensaje("term-publicar-error", "");
  setMensaje("term-publicar-exito", "");

  mostrarPantalla("pantalla-terminal-publicar");
}

async function publicarViaje(e) {
  e.preventDefault();
  setMensaje("term-publicar-error", "");
  setMensaje("term-publicar-exito", "");

  const origenProv  = document.getElementById("term-origen-provincia")?.value?.trim();
  const origenMun   = document.getElementById("term-origen-municipio")?.value?.trim() || null;
  const destinoProv = document.getElementById("term-destino-provincia")?.value?.trim();
  const destinoMun  = document.getElementById("term-destino-municipio")?.value?.trim() || null;
  const puntoTexto  = document.getElementById("term-punto-texto")?.value?.trim();
  const fecha       = document.getElementById("term-fecha")?.value;
  const hora        = document.getElementById("term-hora")?.value;
  const capacidad   = Number(document.getElementById("term-capacidad")?.value || 0);
  const precio      = Number(document.getElementById("term-precio")?.value || 0);
  const notas       = document.getElementById("term-notas")?.value?.trim() || null;

  if (!origenProv) return setMensaje("term-publicar-error", "Selecciona la provincia de origen.");
  if (!destinoProv) return setMensaje("term-publicar-error", "Selecciona la provincia de destino.");
  if (termEstado.puntoLat == null || termEstado.puntoLng == null)
    return setMensaje("term-publicar-error", "Debes marcar el punto de encuentro en el mapa.");
  if (!puntoTexto || puntoTexto.length < 3)
    return setMensaje("term-publicar-error", "Escribe una referencia del punto de encuentro.");
  if (!fecha || !hora) return setMensaje("term-publicar-error", "Elige fecha y hora de salida.");
  if (capacidad < 1 || capacidad > 50)
    return setMensaje("term-publicar-error", "La capacidad debe estar entre 1 y 50.");
  if (isNaN(precio) || precio < 0)
    return setMensaje("term-publicar-error", "Precio del pasaje inválido.");

  const btn = e.target.querySelector("button[type=submit]");
  setBotonCargando(btn, true, "Publicando…");

  const { data, error } = await db.rpc("publicar_viaje_programado", {
    p_origen_provincia: origenProv,
    p_origen_municipio: origenMun,
    p_destino_provincia: destinoProv,
    p_destino_municipio: destinoMun,
    p_punto_encuentro_lat: termEstado.puntoLat,
    p_punto_encuentro_lng: termEstado.puntoLng,
    p_punto_encuentro_texto: puntoTexto,
    p_fecha_salida: fecha,
    p_hora_salida: hora,
    p_capacidad_maxima: capacidad,
    p_precio_pasaje: precio,
    p_notas: notas,
  });

  setBotonCargando(btn, false, "🚐 Publicar viaje ($50)");

  if (error) {
    return setMensaje("term-publicar-error", traducirError(error.message));
  }

  setMensaje("term-publicar-exito", "✅ Viaje publicado. Se te descontaron $50.");

  // Refrescar saldo del perfil
  if (typeof window.cargarSaldo === "function") await window.cargarSaldo();

  setTimeout(() => {
    mostrarPantalla("pantalla-terminal-mi-viaje");
    cargarMiViajeActivo();
  }, 1200);
}

// ------------------------------------------------------------
// 8) MAPA PUNTO DE ENCUENTRO
// ------------------------------------------------------------
function abrirMapaPunto() {
  mostrarPantalla("pantalla-terminal-mapa-punto");
  setMensaje("info-punto-terminal", "Toca el mapa para marcar el punto de encuentro.");

  setTimeout(() => {
    const contenedor = document.getElementById("mapa-punto-terminal");
    if (!contenedor || typeof L === "undefined") return;

    if (termEstado.mapaPunto) {
      termEstado.mapaPunto.remove();
      termEstado.mapaPunto = null;
    }
    termEstado.mapaPunto = L.map(contenedor).setView([23.1136, -82.3666], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 19,
    }).addTo(termEstado.mapaPunto);
    setTimeout(() => termEstado.mapaPunto?.invalidateSize(), 250);

    if (termEstado.puntoLat != null && termEstado.puntoLng != null) {
      colocarMarcadorPunto(termEstado.puntoLat, termEstado.puntoLng);
      termEstado.mapaPunto.setView([termEstado.puntoLat, termEstado.puntoLng], 16);
      const btn = document.getElementById("btn-confirmar-punto-terminal");
      if (btn) btn.disabled = false;
    } else {
      // Intentar centrar en la ubicación actual
      navigator.geolocation?.getCurrentPosition(
        (pos) => termEstado.mapaPunto?.setView([pos.coords.latitude, pos.coords.longitude], 15),
        () => {}
      );
    }

    termEstado.mapaPunto.on("click", (ev) => {
      colocarMarcadorPunto(ev.latlng.lat, ev.latlng.lng);
      const btn = document.getElementById("btn-confirmar-punto-terminal");
      if (btn) btn.disabled = false;
      setMensaje("info-punto-terminal", `Punto: ${ev.latlng.lat.toFixed(5)}, ${ev.latlng.lng.toFixed(5)}`);
    });
  }, 150);
}

function colocarMarcadorPunto(lat, lng) {
  if (!termEstado.mapaPunto) return;
  const pos = [lat, lng];
  if (termEstado.marcadorPunto) {
    termEstado.marcadorPunto.setLatLng(pos);
  } else {
    const icono = L.divIcon({
      className: "",
      html: `<div class="marcador-recogida">🏁</div>`,
      iconSize: [36, 36], iconAnchor: [18, 18],
    });
    termEstado.marcadorPunto = L.marker(pos, { icon: icono }).addTo(termEstado.mapaPunto);
  }
  termEstado.puntoLat = lat;
  termEstado.puntoLng = lng;
}

function confirmarPunto() {
  if (termEstado.puntoLat == null || termEstado.puntoLng == null) return;
  setMensaje("term-estado-punto",
    `✅ Punto marcado: ${termEstado.puntoLat.toFixed(5)}, ${termEstado.puntoLng.toFixed(5)}`);
  cerrarMapaPunto();
}

function cerrarMapaPunto() {
  if (termEstado.mapaPunto) {
    termEstado.mapaPunto.remove();
    termEstado.mapaPunto = null;
    termEstado.marcadorPunto = null;
  }
  mostrarPantalla("pantalla-terminal-publicar");
}

// ------------------------------------------------------------
// 9) MI VIAJE ACTIVO (chofer)
// ------------------------------------------------------------
async function cargarMiViajeActivo() {
  if (!estado.usuario) return;

  const info = document.getElementById("term-mi-viaje-info");
  const acciones = document.getElementById("term-mi-viaje-acciones");
  const listaPasajeros = document.getElementById("term-lista-pasajeros");

  if (info) info.innerHTML = '<p class="vacio">Cargando...</p>';
  if (listaPasajeros) listaPasajeros.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.rpc("obtener_mi_viaje_activo");

  if (error) {
    if (info) info.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }

  if (!data) {
    if (info) {
      info.innerHTML = `
        <div class="term-titulo">Sin viaje activo</div>
        <p class="texto-ayuda" style="text-align:left">
          No tienes ningún viaje programado activo. Vuelve al menú de Terminal para crear uno.
        </p>
      `;
    }
    acciones?.classList.add("oculto");
    if (listaPasajeros) listaPasajeros.innerHTML = '<p class="vacio">—</p>';
    return;
  }

  termEstado.viajeActivo = data;
  termEstado.reservasDelViaje = data.pasajeros || [];

  // Pintar info del viaje
  const origenTxt  = [data.origen_municipio, data.origen_provincia].filter(Boolean).join(", ");
  const destinoTxt = [data.destino_municipio, data.destino_provincia].filter(Boolean).join(", ");
  const fecha = data.fecha_salida;
  const hora = (data.hora_salida || "").slice(0, 5);

  const estadoLbl = {
    programado: "Programado",
    completo: "Completo",
    en_curso: "En curso",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  }[data.estado] || data.estado;

  info.innerHTML = `
    <div class="term-titulo">
      <span>🚐 ${escapar(origenTxt)} → ${escapar(destinoTxt)}</span>
      <span class="term-badge-estado ${data.estado}">${escapar(estadoLbl)}</span>
    </div>
    <div class="term-linea">
      <span class="label">Salida:</span>
      <span class="valor">${escapar(fecha)} a las ${escapar(hora)}</span>
    </div>
    <div class="term-linea">
      <span class="label">Punto:</span>
      <span class="valor">${escapar(data.punto_encuentro_texto)}</span>
    </div>
    <div class="term-linea">
      <span class="label">Asientos:</span>
      <span class="valor">${data.asientos_ocupados} / ${data.capacidad_maxima}</span>
    </div>
    <div class="term-linea">
      <span class="label">Pasaje:</span>
      <span class="valor">$${Number(data.precio_pasaje || 0).toFixed(2)}</span>
    </div>
  `;

  // Botones según estado
  if (acciones) {
    acciones.classList.remove("oculto");
    const btnCerrar    = document.getElementById("btn-term-cerrar-viaje");
    const btnIniciar   = document.getElementById("btn-term-iniciar-viaje");
    const btnFinalizar = document.getElementById("btn-term-finalizar-viaje");
    const btnCancelar  = document.getElementById("btn-term-cancelar-viaje");

    [btnCerrar, btnIniciar, btnFinalizar, btnCancelar].forEach((b) => b?.classList.add("oculto"));

    if (data.estado === "programado") {
      btnCerrar?.classList.remove("oculto");
      btnCancelar?.classList.remove("oculto");
    } else if (data.estado === "completo") {
      btnIniciar?.classList.remove("oculto");
      btnCancelar?.classList.remove("oculto");
    } else if (data.estado === "en_curso") {
      btnFinalizar?.classList.remove("oculto");
    }
  }

  // Lista de pasajeros
  pintarPasajerosDelViaje();
}

function pintarPasajerosDelViaje() {
  const cont = document.getElementById("term-lista-pasajeros");
  if (!cont) return;

  const pasajeros = termEstado.reservasDelViaje || [];
  if (pasajeros.length === 0) {
    cont.innerHTML = '<p class="vacio">Aún no hay pasajeros reservados.</p>';
    return;
  }

  cont.innerHTML = "";
  pasajeros.forEach((p) => {
    const div = document.createElement("div");
    div.className = "tarjeta-solicitud";
    const foto = p.foto_cliente || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='20' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
    div.innerHTML = `
      <div class="fila-superior" style="display:flex;align-items:center;gap:10px">
        <img src="${foto}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" />
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:0.95rem">${escapar(p.nombre_pasajero || "Pasajero")}</div>
          <div class="texto-ayuda" style="text-align:left">${escapar(p.nombre_cliente || "")} · 📞 ${escapar(p.telefono_cliente || "—")}</div>
        </div>
        <span class="badge-tipo delivery">Asiento #${p.numero_asiento}</span>
      </div>
      <div class="meta">
        <span>Estado: ${escapar(p.estado)}</span>
      </div>
    `;
    cont.appendChild(div);
  });
}

async function cerrarViaje() {
  if (!termEstado.viajeActivo) return;
  if (!confirm("¿Cerrar el viaje? Ya no se aceptarán más reservas ni cancelaciones.")) return;

  const { error } = await db.rpc("cerrar_viaje_programado", { p_viaje_id: termEstado.viajeActivo.id });
  if (error) return alert("Error: " + error.message);
  alert("✅ Viaje cerrado.");
  cargarMiViajeActivo();
}

async function iniciarViaje() {
  if (!termEstado.viajeActivo) return;
  if (!confirm("¿Iniciar el viaje? Se compartirá tu ubicación en vivo con los pasajeros.")) return;

  const { error } = await db.rpc("iniciar_viaje_programado", { p_viaje_id: termEstado.viajeActivo.id });
  if (error) return alert("Error: " + error.message);
  alert("🚗 Viaje iniciado.");
  cargarMiViajeActivo();
  // Arrancar el envío de ubicación
  if (estado.perfil?.rol === "chofer") iniciarUbicacionViaje(termEstado.viajeActivo.id);
}

async function finalizarViaje() {
  if (!termEstado.viajeActivo) return;
  if (!confirm("¿Marcar el viaje como finalizado?")) return;

  const { error } = await db.rpc("finalizar_viaje_programado", { p_viaje_id: termEstado.viajeActivo.id });
  if (error) return alert("Error: " + error.message);
  alert("🏁 Viaje finalizado.");
  detenerUbicacionViaje();
  cargarMiViajeActivo();
}

async function cancelarViajeChofer() {
  if (!termEstado.viajeActivo) return;
  if (!confirm(
    "¿Cancelar el viaje? Se reembolsará $20 a cada pasajero reservado.\n" +
    "Perderás los $50 de publicación.")) return;

  const { error } = await db.rpc("cancelar_viaje_programado", { p_viaje_id: termEstado.viajeActivo.id });
  if (error) return alert("Error: " + error.message);
  alert("Viaje cancelado.");
  detenerUbicacionViaje();
  cargarMiViajeActivo();
}

// ------------------------------------------------------------
// 10) ESCANEAR QR (chofer)
// ------------------------------------------------------------
function iniciarScanner() {
  const contenedor = document.getElementById("term-reader-qr");
  if (!contenedor) return;

  // Limpiar resultado previo
  const res = document.getElementById("term-resultado-escaneo");
  if (res) { res.classList.add("oculto"); res.innerHTML = ""; }

  // Si ya hay un scanner activo, detenerlo
  if (termEstado.scanner) {
    termEstado.scanner.stop().then(() => {
      termEstado.scanner.clear();
      termEstado.scanner = null;
      arrancarScanner();
    }).catch(() => {
      termEstado.scanner = null;
      arrancarScanner();
    });
    return;
  }

  arrancarScanner();

  function arrancarScanner() {
    if (typeof Html5Qrcode === "undefined") {
      alert("La librería de escaneo no está cargada. Revisa la conexión.");
      return;
    }

    termEstado.scanner = new Html5Qrcode("term-reader-qr");

    termEstado.scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (textoQR) => {
        // Se detectó un QR → detener y procesar
        termEstado.scanner.stop().then(() => {
          termEstado.scanner.clear();
          termEstado.scanner = null;
        }).catch(() => {});
        procesarQR(textoQR);
      },
      (errMsg) => { /* ignorar errores de frame */ }
    ).catch((err) => {
      console.error("[scanner] error al arrancar:", err);
      alert("No se pudo abrir la cámara:\n" + (err?.message || err));
    });
  }
}

async function procesarQR(textoQR) {
  const cont = document.getElementById("term-resultado-escaneo");
  if (!cont) return;

  cont.classList.remove("oculto", "ok", "error");

  // Llamar a la RPC validar_qr_reserva
  const { data, error } = await db.rpc("validar_qr_reserva", { p_qr: textoQR });

  if (error) {
    cont.classList.add("error");
    cont.innerHTML = `
      <div class="icono-resultado">❌</div>
      <div class="titulo-resultado">QR no válido</div>
      <p class="texto-ayuda" style="text-align:center">${escapar(error.message)}</p>
    `;
    return;
  }

  cont.classList.add("ok");
  cont.innerHTML = `
    <div class="icono-resultado">✅</div>
    <div class="titulo-resultado">Pasajero validado</div>
    <div class="detalle-pasajero">
      <div class="fila"><span class="lbl">Pasajero:</span><span class="val">${escapar(data.nombre_pasajero || "—")}</span></div>
      <div class="fila"><span class="lbl">Cliente:</span><span class="val">${escapar(data.nombre_cliente || "—")}</span></div>
      <div class="fila"><span class="lbl">Asiento:</span><span class="val">#${data.numero_asiento}</span></div>
      <div class="fila"><span class="lbl">Teléfono:</span><span class="val">${escapar(data.telefono_cliente || "—")}</span></div>
    </div>
    <button type="button" class="btn-secundario" style="margin-top:14px" onclick="document.getElementById('term-resultado-escaneo').classList.add('oculto'); document.getElementById('term-resultado-escaneo').innerHTML='';">Escanear otro</button>
  `;
}

function escanearManual() {
  const codigo = prompt("Pega o escribe el código del QR (empieza con ALKILO|):");
  if (!codigo) return;
  procesarQR(codigo.trim());
}

// ------------------------------------------------------------
// 11) BUSCAR VIAJES (cliente)
// ------------------------------------------------------------
function prepararFiltrosTerminal() {
  // Nada adicional por ahora (ya se llenan en llenarProvinciasTerminal)
}

async function buscarViajes() {
  const cont = document.getElementById("term-lista-viajes");
  if (!cont) return;
  cont.innerHTML = '<p class="vacio">Buscando…</p>';

  const origenProv = document.getElementById("term-filtro-origen")?.value || null;
  const destinoProv = document.getElementById("term-filtro-destino")?.value || null;
  const fecha = document.getElementById("term-filtro-fecha")?.value || null;

  const { data, error } = await db.rpc("listar_viajes_disponibles", {
    p_origen_provincia: origenProv,
    p_origen_municipio: null,
    p_destino_provincia: destinoProv,
    p_destino_municipio: null,
    p_fecha: fecha,
    p_limite: 50,
  });

  if (error) {
    cont.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="vacio">No hay viajes disponibles con esos filtros.</p>';
    return;
  }

  cont.innerHTML = "";
  data.forEach((v) => cont.appendChild(renderTarjetaViaje(v)));
}

function renderTarjetaViaje(v) {
  const card = document.createElement("div");
  card.className = "term-viaje-card";

  const origenTxt  = v.origen_municipio ? `${v.origen_municipio}, ${v.origen_provincia}` : v.origen_provincia;
  const destinoTxt = v.destino_municipio ? `${v.destino_municipio}, ${v.destino_provincia}` : v.destino_provincia;

  const asientosDisponibles = v.asientos_disponibles;
  const badgeClase = asientosDisponibles <= 3 ? "pocos" : "disponible";

  const foto = v.chofer_foto || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='14' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";

  card.innerHTML = `
    <div class="ruta">
      <span>${escapar(origenTxt)}</span>
      <span class="flecha">→</span>
      <span>${escapar(destinoTxt)}</span>
    </div>
    <div class="fecha-hora">
      📅 ${escapar(v.fecha_salida)} · ${escapar((v.hora_salida || "").slice(0, 5))}
    </div>
    <div class="info-inferior">
      <div class="chofer-info">
        <img src="${foto}" alt="Chofer" />
        <div>
          <div style="font-weight:800;color:var(--gray-900);font-size:0.85rem">${escapar(v.chofer_nombre || "Chofer")}</div>
          <div style="font-size:0.72rem">⭐ ${Number(v.chofer_promedio || 0).toFixed(1)} (${v.chofer_total_resenas})</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="precio">$${Number(v.precio_pasaje || 0).toFixed(2)}</div>
        <span class="asientos-badge ${badgeClase}">${asientosDisponibles} asiento${asientosDisponibles === 1 ? "" : "s"}</span>
      </div>
    </div>
  `;

  card.addEventListener("click", () => abrirDetalleViaje(v.id));
  return card;
}

// ------------------------------------------------------------
// 12) DETALLE DEL VIAJE (cliente)
// ------------------------------------------------------------
async function abrirDetalleViaje(viajeId) {
  mostrarPantalla("pantalla-terminal-detalle");

  const info = document.getElementById("term-detalle-info");
  const miniMapa = document.getElementById("term-detalle-mapa-punto");

  if (info) info.innerHTML = '<p class="vacio">Cargando…</p>';

  // Buscar el viaje en el último resultado
  // Como no lo tenemos persistido, lo traemos puntualmente:
  const { data, error } = await db.from("viajes_programados")
    .select(`
      *,
      chofer:chofer_id ( id, nombre, foto_url, telefono )
    `)
    .eq("id", viajeId)
    .maybeSingle();

  if (error || !data) {
    if (info) info.innerHTML = `<p class="vacio">Error: ${escapar(error?.message || "Viaje no encontrado")}</p>`;
    return;
  }

  termEstado.viajeDetalle = data;

  const origenTxt  = data.origen_municipio ? `${data.origen_municipio}, ${data.origen_provincia}` : data.origen_provincia;
  const destinoTxt = data.destino_municipio ? `${data.destino_municipio}, ${data.destino_provincia}` : data.destino_provincia;
  const asientosDisponibles = data.capacidad_maxima - data.asientos_ocupados;

  // Promedio de calificaciones
  let promedio = 0, total = 0;
  const { data: cal } = await db.from("calificaciones")
    .select("estrellas").eq("receptor_id", data.chofer_id);
  if (cal && cal.length > 0) {
    total = cal.length;
    promedio = cal.reduce((a, c) => a + c.estrellas, 0) / cal.length;
  }

  info.innerHTML = `
    <div class="term-titulo">
      <span>🚐 ${escapar(origenTxt)} → ${escapar(destinoTxt)}</span>
    </div>
    <div class="term-linea">
      <span class="label">Salida:</span>
      <span class="valor">${escapar(data.fecha_salida)} a las ${escapar((data.hora_salida || "").slice(0, 5))}</span>
    </div>
    <div class="term-linea">
      <span class="label">Punto:</span>
      <span class="valor">${escapar(data.punto_encuentro_texto)}</span>
    </div>
    <div class="term-linea">
      <span class="label">Asientos disponibles:</span>
      <span class="valor">${asientosDisponibles} / ${data.capacidad_maxima}</span>
    </div>
    <div class="term-linea">
      <span class="label">Precio del pasaje:</span>
      <span class="valor">$${Number(data.precio_pasaje || 0).toFixed(2)} (efectivo al subir)</span>
    </div>
    <div class="term-linea">
      <span class="label">Costo de reserva:</span>
      <span class="valor">$20.00 (saldo)</span>
    </div>
    <div class="term-linea" style="margin-top:6px;padding-top:10px;border-top:1px dashed #e5e7eb">
      <span class="label">Chofer:</span>
      <span class="valor">${escapar(data.chofer?.nombre || "—")} · ⭐ ${promedio.toFixed(1)} (${total})</span>
    </div>
    ${data.notas ? `<div class="term-linea"><span class="label">Notas:</span><span class="valor">${escapar(data.notas)}</span></div>` : ""}
  `;

  // Mini mapa del punto de encuentro
  if (miniMapa) {
    if (termEstado.mapaDetalle) {
      termEstado.mapaDetalle.remove();
      termEstado.mapaDetalle = null;
    }
    setTimeout(() => {
      try {
        termEstado.mapaDetalle = L.map(miniMapa, { zoomControl: false, attributionControl: false })
          .setView([Number(data.punto_encuentro_lat), Number(data.punto_encuentro_lng)], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(termEstado.mapaDetalle);
        const icono = L.divIcon({
          className: "",
          html: `<div class="marcador-recogida" style="width:30px;height:30px;font-size:0.9rem">🏁</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        L.marker([Number(data.punto_encuentro_lat), Number(data.punto_encuentro_lng)], { icon: icono })
          .addTo(termEstado.mapaDetalle)
          .bindPopup(escapar(data.punto_encuentro_texto));
        setTimeout(() => termEstado.mapaDetalle?.invalidateSize(), 250);
      } catch (e) {
        console.warn("[terminal] error mini mapa:", e);
      }
    }, 200);
  }

  setMensaje("term-detalle-error", "");
  setMensaje("term-detalle-exito", "");
}

// ------------------------------------------------------------
// 13) RESERVAR (cliente)
// ------------------------------------------------------------
function abrirReservar() {
  if (!termEstado.viajeDetalle) return;
  const v = termEstado.viajeDetalle;

  const asientosDisponibles = v.capacidad_maxima - v.asientos_ocupados;
  if (asientosDisponibles <= 0) {
    return alert("No quedan asientos disponibles en este viaje.");
  }

  // Cargar saldo actual
  db.from("saldos").select("monto").eq("usuario_id", estado.usuario.id).maybeSingle().then(({ data }) => {
    const saldo = Number(data?.monto || 0);
    const elSaldo = document.getElementById("term-mi-saldo");
    if (elSaldo) elSaldo.textContent = "$" + saldo.toFixed(2);
  });

  // Resumen
  const origenTxt  = v.origen_municipio ? `${v.origen_municipio}, ${v.origen_provincia}` : v.origen_provincia;
  const destinoTxt = v.destino_municipio ? `${v.destino_municipio}, ${v.destino_provincia}` : v.destino_provincia;

  const resumen = document.getElementById("term-reservar-resumen");
  if (resumen) {
    resumen.innerHTML = `
      <p class="ruta"><span class="etiqueta">Ruta:</span> ${escapar(origenTxt)} → ${escapar(destinoTxt)}</p>
      <p class="ruta"><span class="etiqueta">Salida:</span> ${escapar(v.fecha_salida)} a las ${escapar((v.hora_salida || "").slice(0, 5))}</p>
      <p class="ruta"><span class="etiqueta">Pasaje:</span> $${Number(v.precio_pasaje || 0).toFixed(2)} (efectivo al chofer)</p>
    `;
  }

  // Reset del form
  const form = document.getElementById("form-terminal-reservar");
  form?.reset();
  termEstado.cantidadPasajeros = 1;
  resetPasajerosForm();

  actualizarTotalReserva();
  setMensaje("term-reservar-error", "");
  setMensaje("term-reservar-exito", "");

  mostrarPantalla("pantalla-terminal-reservar");
}

function resetPasajerosForm() {
  const bloque = document.getElementById("term-pasajeros-bloque");
  if (!bloque) return;
  bloque.innerHTML = `
    <div class="term-pasajero-row" data-index="0">
      <label>Pasajero 1 *</label>
      <input type="text" class="term-pasajero-nombre" data-index="0" required placeholder="Nombre completo" />
    </div>
  `;
  const btnAdd = document.getElementById("btn-term-añadir-pasajero");
  btnAdd?.classList.add("oculto");
}

function toggleFamiliar() {
  const chk = document.getElementById("term-es-familiar");
  const btnAdd = document.getElementById("btn-term-añadir-pasajero");
  if (!chk || !btnAdd) return;
  if (chk.checked) {
    btnAdd.classList.remove("oculto");
  } else {
    // Si desmarca y hay más de 1 pasajero, resetear a 1
    termEstado.cantidadPasajeros = 1;
    resetPasajerosForm();
    btnAdd.classList.add("oculto");
  }
  actualizarTotalReserva();
}

function anadirPasajero() {
  if (termEstado.cantidadPasajeros >= TERM_MAX_FAMILIAR) {
    alert(`Máximo ${TERM_MAX_FAMILIAR} asientos por reserva.`);
    return;
  }
  termEstado.cantidadPasajeros++;
  const bloque = document.getElementById("term-pasajeros-bloque");
  if (!bloque) return;
  const idx = termEstado.cantidadPasajeros - 1;
  const div = document.createElement("div");
  div.className = "term-pasajero-row";
  div.dataset.index = String(idx);
  div.innerHTML = `
    <label>Pasajero ${idx + 1} *</label>
    <input type="text" class="term-pasajero-nombre" data-index="${idx}" required placeholder="Nombre completo" />
    <button type="button" class="term-pasajero-quitar" data-quitar="${idx}">Quitar</button>
  `;
  bloque.appendChild(div);
  div.querySelector("[data-quitar]")?.addEventListener("click", () => {
    div.remove();
    termEstado.cantidadPasajeros--;
    if (termEstado.cantidadPasajeros <= TERM_MAX_FAMILIAR) {
      // Si bajamos por debajo del máximo, ocultar botón add hasta que lleguemos al máx otra vez
    }
    actualizarTotalReserva();
  });

  if (termEstado.cantidadPasajeros >= TERM_MAX_FAMILIAR) {
    document.getElementById("btn-term-añadir-pasajero")?.classList.add("oculto");
  }

  actualizarTotalReserva();
}

function actualizarTotalReserva() {
  const total = termEstado.cantidadPasajeros * TERM_PRECIO_RESERVA;
  const elT = document.getElementById("term-total-pagar");
  if (elT) elT.textContent = `$${total.toFixed(2)}`;
}

async function confirmarReserva(e) {
  e.preventDefault();
  setMensaje("term-reservar-error", "");
  setMensaje("term-reservar-exito", "");

  if (!termEstado.viajeDetalle) return setMensaje("term-reservar-error", "No hay viaje seleccionado.");

  const nombres = Array.from(document.querySelectorAll(".term-pasajero-nombre"))
    .map((inp) => inp.value.trim())
    .filter((n) => n.length > 0);

  if (nombres.length === 0) {
    return setMensaje("term-reservar-error", "Debes escribir al menos un nombre.");
  }

  const pasajeros = nombres.map((nombre) => ({ nombre, cedula: null }));

  const btn = e.target.querySelector("button[type=submit]");
  setBotonCargando(btn, true, "Reservando…");

  const { data, error } = await db.rpc("reservar_asiento", {
    p_viaje_id: termEstado.viajeDetalle.id,
    p_pasajeros: pasajeros,
  });

  setBotonCargando(btn, false, "✅ Confirmar reserva");

  if (error) {
    return setMensaje("term-reservar-error", traducirError(error.message));
  }

  setMensaje("term-reservar-exito",
    `✅ Reserva confirmada. Pagaste $${Number(data.total_comision).toFixed(2)} de saldo.`);

  // Refrescar saldo del perfil
  if (typeof window.cargarSaldo === "function") await window.cargarSaldo();

  setTimeout(() => {
    mostrarPantalla("pantalla-terminal-mis-reservas");
    cargarMisReservas();
  }, 1200);
}

// ------------------------------------------------------------
// 14) MIS RESERVAS (cliente)
// ------------------------------------------------------------
async function cargarMisReservas() {
  const cont = document.getElementById("term-lista-mis-reservas");
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.rpc("obtener_mis_reservas");

  if (error) {
    cont.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="vacio">No tienes reservas aún.</p>';
    return;
  }

  // Agrupar por grupo_id
  const grupos = {};
  data.forEach((r) => {
    if (!grupos[r.grupo_id]) grupos[r.grupo_id] = [];
    grupos[r.grupo_id].push(r);
  });

  cont.innerHTML = "";
  Object.values(grupos).forEach((reservas) => {
    reservas.sort((a, b) => a.numero_asiento - b.numero_asiento);
    cont.appendChild(renderReservaGrupo(reservas));
  });
}

function renderReservaGrupo(reservas) {
  const r0 = reservas[0];
  const card = document.createElement("div");
  card.className = "term-viaje-card";

  const origenTxt  = r0.origen_municipio ? `${r0.origen_municipio}, ${r0.origen_provincia}` : r0.origen_provincia;
  const destinoTxt = r0.destino_municipio ? `${r0.destino_municipio}, ${r0.destino_provincia}` : r0.destino_provincia;

  const badgeEstado = r0.estado === "activa" ? "programado"
    : r0.estado === "validada" ? "completo"
    : r0.estado === "cancelada" || r0.estado === "reembolsada" ? "cancelado"
    : "programado";

  card.innerHTML = `
    <div class="ruta">
      <span>${escapar(origenTxt)}</span>
      <span class="flecha">→</span>
      <span>${escapar(destinoTxt)}</span>
    </div>
    <div class="fecha-hora">
      📅 ${escapar(r0.fecha_salida)} · ${escapar((r0.hora_salida || "").slice(0, 5))}
    </div>
    <div class="info-inferior">
      <div>
        <div style="font-weight:800;color:var(--gray-900);font-size:0.85rem">
          ${reservas.length} asiento${reservas.length === 1 ? "" : "s"}
        </div>
        <div style="font-size:0.72rem">Asiento${reservas.length === 1 ? "" : "s"}: #${reservas.map((r) => r.numero_asiento).join(", #")}</div>
      </div>
      <span class="term-badge-estado ${badgeEstado}">${escapar(r0.estado)}</span>
    </div>
  `;

  // Click → ver QR (usa el primer asiento)
  card.addEventListener("click", () => abrirVerQR(reservas[0].reserva_id));
  return card;
}

// ------------------------------------------------------------
// 15) VER QR (cliente)
// ------------------------------------------------------------
async function abrirVerQR(reservaId) {
  mostrarPantalla("pantalla-terminal-ver-qr");

  const info = document.getElementById("term-qr-info");
  if (info) info.innerHTML = '<p class="vacio">Cargando…</p>';

  const { data, error } = await db.from("reservas_viaje")
    .select(`
      *,
      viaje:viaje_id (
        origen_provincia, origen_municipio,
        destino_provincia, destino_municipio,
        fecha_salida, hora_salida,
        chofer:chofer_id ( nombre, telefono )
      )
    `)
    .eq("id", reservaId)
    .maybeSingle();

  if (error || !data) {
    if (info) info.innerHTML = `<p class="vacio">Error: ${escapar(error?.message || "Reserva no encontrada")}</p>`;
    return;
  }

  termEstado.qrActual = data;

  const viaje = data.viaje || {};
  const origenTxt  = viaje.origen_municipio ? `${viaje.origen_municipio}, ${viaje.origen_provincia}` : (viaje.origen_provincia || "—");
  const destinoTxt = viaje.destino_municipio ? `${viaje.destino_municipio}, ${viaje.destino_provincia}` : (viaje.destino_provincia || "—");

  info.innerHTML = `
    <div class="term-titulo">🎫 Pasaje programado</div>
    <div class="term-linea"><span class="label">Pasajero:</span><span class="valor">${escapar(data.nombre_pasajero || "—")}</span></div>
    <div class="term-linea"><span class="label">Asiento:</span><span class="valor">#${data.numero_asiento}</span></div>
    <div class="term-linea"><span class="label">Ruta:</span><span class="valor">${escapar(origenTxt)} → ${escapar(destinoTxt)}</span></div>
    <div class="term-linea"><span class="label">Salida:</span><span class="valor">${escapar(viaje.fecha_salida || "—")} a las ${escapar((viaje.hora_salida || "").slice(0, 5) || "—")}</span></div>
    <div class="term-linea"><span class="label">Chofer:</span><span class="valor">${escapar(viaje.chofer?.nombre || "—")} · 📞 ${escapar(viaje.chofer?.telefono || "—")}</span></div>
  `;

  // Generar QR en el canvas
  const canvas = document.getElementById("term-qr-canvas");
  if (!canvas) return;

  try {
    if (typeof QRCode === "undefined") {
      alert("La librería de QR no está cargada.");
      return;
    }
    await QRCode.toCanvas(canvas, data.qr_data, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("[qr] error:", err);
    alert("No se pudo generar el QR: " + (err?.message || err));
  }
}

async function descargarQR() {
  const canvas = document.getElementById("term-qr-canvas");
  if (!canvas || !termEstado.qrActual) return;

  try {
    // Crear un canvas temporal con fondo blanco + el QR + texto debajo
    const tmp = document.createElement("canvas");
    const qrSize = canvas.width;
    tmp.width = qrSize;
    tmp.height = qrSize + 80;

    const ctx = tmp.getContext("2d");
    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tmp.width, tmp.height);

    // Dibujar QR
    ctx.drawImage(canvas, 0, 0);

    // Texto debajo
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    const viaje = termEstado.qrActual.viaje || {};
    const origenTxt  = viaje.origen_municipio ? `${viaje.origen_municipio}, ${viaje.origen_provincia}` : (viaje.origen_provincia || "");
    const destinoTxt = viaje.destino_municipio ? `${viaje.destino_municipio}, ${viaje.destino_provincia}` : (viaje.destino_provincia || "");
    ctx.fillText(`${origenTxt} → ${destinoTxt}`, qrSize / 2, qrSize + 30);
    ctx.font = "14px sans-serif";
    ctx.fillText(`Asiento #${termEstado.qrActual.numero_asiento} · ${termEstado.qrActual.nombre_pasajero}`, qrSize / 2, qrSize + 55);

    // Descargar
    tmp.toBlob((blob) => {
      if (!blob) return alert("No se pudo generar la imagen.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alkilo-pasaje-${termEstado.qrActual.numero_asiento}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("✅ Pasaje guardado en tu galería.");
    }, "image/png");
  } catch (err) {
    console.error("[descargar qr] error:", err);
    alert("No se pudo descargar: " + (err?.message || err));
  }
}

// ------------------------------------------------------------
// 16) COMPARTIR UBICACIÓN EN VIVO (chofer con viaje en_curso)
// ------------------------------------------------------------
function iniciarUbicacionViaje(viajeId) {
  detenerUbicacionViaje();
  if (!navigator.geolocation) return;

  // Crear canal Realtime Broadcast
  termEstado.canalUbicacion = db.channel(`terminal-ubicacion-${viajeId}`);
  termEstado.canalUbicacion.subscribe();

  // Watch de GPS
  let ultimoEnvio = 0;
  termEstado.watchUbicacion = navigator.geolocation.watchPosition(
    (pos) => {
      const ahora = Date.now();
      if (ahora - ultimoEnvio < 8000) return; // cada 8 segundos
      ultimoEnvio = ahora;

      const { latitude, longitude } = pos.coords;
      termEstado.canalUbicacion?.send({
        type: "broadcast",
        event: "posicion",
        payload: {
          lat: latitude,
          lng: longitude,
          ts: ahora,
          chofer: estado.perfil?.nombre || "Chofer",
        },
      });

      // Persistir en BD cada 30 segundos (best effort)
      db.from("viajes_programados")
        .update({ actualizado_en: new Date().toISOString() })
        .eq("id", viajeId).then(() => {});
    },
    (err) => console.warn("[terminal] GPS:", err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

function detenerUbicacionViaje() {
  if (termEstado.watchUbicacion != null) {
    navigator.geolocation.clearWatch(termEstado.watchUbicacion);
    termEstado.watchUbicacion = null;
  }
  if (termEstado.canalUbicacion) {
    db.removeChannel(termEstado.canalUbicacion);
    termEstado.canalUbicacion = null;
  }
}

// ------------------------------------------------------------
// 17) Arrancar
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", inicializarTerminal);