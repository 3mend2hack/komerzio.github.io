/* ============================================================
   ALKILO - App principal
   FASE 1 a 6 + extras + pagos + mapa + reportes + referidos + Premium
   ============================================================ */

// ------------------------------------------------------------
// 1) Cliente de Supabase
// ------------------------------------------------------------
const SUPABASE_URL = "https://ghuvgtgykyoovkgwxduc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXZndGd5a3lvb3ZrZ3d4ZHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzcxOTAsImV4cCI6MjEwNjExMzE5MH0.f4j5lwfBjwK1sY-yCC7TkFC-h6dHFusGOkrMAmCnbmI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const URL_SUSCRIPCION = "suscripcion/suscripcion.html";
const URL_ADMIN_EXTERNO = "admin/administrar.html";
const PREFIJO_TELEFONO = "+53";

// ------------------------------------------------------------
// 2) Estado global
// ------------------------------------------------------------
const estado = {
  usuario: null,
  perfil: null,
  suscripcion: null,
  planPremium: null,
  esPremium: false,
  calificacionesHechas: new Set(),
  ubicacionActual: null,
  filtroAdminUsuarios: "todos",
  filtroAdminPagos: "pendiente",
  filtroMisReportes: "enviados",
  usuariosAdmin: [],
  pagosAdmin: [],
  origenPerfilPublico: "pantalla-perfil",
  modoRecuperacion: false,
  servicioActivoChofer: false,
  reportarReceptorId: null,
  reportarSolicitudId: null,
};

const realtime = {
  canalSolicitudes: null, canalUbicacion: null, canalChat: null,
  canalOfertas: null, canalSuscripciones: null, canalPagos: null,
  canalReportes: null, canalPlanes: null, watchId: null,
  ultimaUbicacionEnviada: 0, ultimaPersistencia: 0,
  solicitudActivaId: null, tickTemporizadores: null,
};

const mapa = { instancia: null, marcadorChofer: null, marcadorCliente: null, marcadorDestino: null };
const mapaDestino = { instancia: null, marcador: null, lat: null, lng: null };
const chat = { solicitudId: null, perfilOtro: null };
const oferta = { solicitudId: null };
const calificacion = { solicitudId: null, receptorId: null, receptorNombre: null, receptorFoto: null, estrellas: 0 };

// ------------------------------------------------------------
// 3) UI
// ------------------------------------------------------------
const PANTALLAS = [
  "pantalla-login","pantalla-registro","pantalla-completar-ubicacion",
  "pantalla-recuperar","pantalla-reset",
  "pantalla-perfil","pantalla-sin-suscripcion","pantalla-pendiente-aprobacion",
  "pantalla-cuenta-bloqueada","pantalla-nueva-solicitud","pantalla-mis-solicitudes",
  "pantalla-solicitudes-disponibles","pantalla-mis-servicios","pantalla-mapa",
  "pantalla-mapa-recogida","pantalla-chat","pantalla-oferta","pantalla-ver-ofertas",
  "pantalla-calificar","pantalla-ver-calificacion","pantalla-admin",
  "pantalla-admin-usuarios","pantalla-admin-solicitudes","pantalla-admin-precio",
  "pantalla-admin-pagos","pantalla-perfil-publico","pantalla-choferes-mapa",
  "pantalla-reportar","pantalla-mis-reportes","pantalla-mis-advertencias",
  "pantalla-mis-referidos","pantalla-plan-premium",
  "pantalla-cargando",
];

function mostrarPantalla(id) {
  PANTALLAS.forEach((p) => document.getElementById(p)?.classList.remove("activa"));
  document.getElementById(id)?.classList.add("activa");
  window.scrollTo({ top: 0, behavior: "instant" });
}
window.mostrarPantalla = mostrarPantalla;

function setMensaje(idElemento, texto) {
  const e = document.getElementById(idElemento);
  if (e) e.textContent = texto || "";
}

function limpiarMensajes() {
  ["login-error","registro-error","registro-exito",
   "recuperar-error","recuperar-exito","reset-error","reset-exito",
   "perfil-error","perfil-exito","solicitud-error","solicitud-exito",
   "oferta-error","oferta-exito","calificar-error","calificar-exito",
   "admin-precio-error","admin-precio-exito",
   "reportar-error","reportar-exito",
   "premium-error","premium-exito",
   "cu-error","cu-exito"].forEach((id) => setMensaje(id, ""));
}

function setBotonCargando(boton, cargando, textoOriginal) {
  if (!boton) return;
  boton.disabled = cargando;
  boton.textContent = cargando ? "Procesando..." : textoOriginal;
}

const CATEGORIAS_REPORTE = {
  mal_comportamiento: "😠 Mal comportamiento",
  no_cumplio_servicio: "❌ No cumplió el servicio",
  acoso: "🚫 Acoso o amenazas",
  estafa: "💸 Estafa o cobro indebido",
  otro: "❓ Otro motivo",
};

const ACCIONES_REPORTE = {
  ninguna: "Desestimado", advertencia: "Advertencia",
  suspension: "Suspendido", baneo: "Baneado",
  eliminacion: "Eliminado", ajuste_saldo: "Ajuste de saldo",
};

// ------------------------------------------------------------
// 4) Cache de elementos
// ------------------------------------------------------------
const el = {};

function cachearElementos() {
  [
    "form-login","form-registro","form-perfil","form-solicitud",
    "form-recuperar","form-reset","form-reportar","form-completar-ubicacion",
    "login-error","registro-error","registro-exito",
    "recuperar-error","recuperar-exito","recuperar-email",
    "reset-error","reset-exito","reset-password","reset-password2",
    "perfil-error","perfil-exito","solicitud-error","solicitud-exito",
    "perfil-foto","perfil-foto-input","perfil-rol",
    "perfil-nombre","perfil-telefono","perfil-email","perfil-banner-suscripcion",
    "perfil-ubicacion","perfil-banner-premium",
    "perfil-provincia","perfil-municipio",
    "cu-provincia","cu-municipio","cu-error","cu-exito","cu-cerrar-sesion",
    "btn-cerrar-sesion",
    "btn-ir-nueva-solicitud","btn-ir-mis-solicitudes","btn-ir-disponibles",
    "btn-ir-mis-servicios","btn-ir-mi-suscripcion","btn-ir-panel-admin",
    "btn-ir-plan-premium","btn-abrir-admin-externo",
    "lista-mis-solicitudes","lista-disponibles","lista-mis-servicios",
    "btn-refrescar-mis","btn-refrescar-disponibles","btn-refrescar-servicios",
    "btn-volver-mapa","info-mapa-texto","btn-marcar-recogida","estado-punto-recogida",
    "btn-cancelar-recogida","btn-confirmar-recogida","info-recogida-texto",
    "btn-volver-chat","chat-titulo","chat-mensajes","form-chat","chat-input",
    "btn-volver-oferta","oferta-resumen","form-oferta","oferta-monto","oferta-mensaje",
    "oferta-error","oferta-exito","btn-volver-ver-ofertas","btn-refrescar-ofertas",
    "lista-ofertas","btn-volver-calificar","calificar-titulo","calificar-destinatario",
    "estrellas-contenedor","estrellas-texto","form-calificar","calificar-comentario",
    "calificar-error","calificar-exito","btn-volver-ver-calificacion",
    "ver-calificacion-contenido","btn-salir-suscripcion","btn-pagar-suscripcion",
    "btn-refrescar-admin","m-usuarios","m-choferes","m-activos","m-solicitudes",
    "m-completados","m-ingresos","btn-admin-usuarios","btn-admin-pagos",
    "btn-admin-solicitudes","btn-admin-precio","btn-volver-admin-usuarios",
    "btn-refrescar-admin-usuarios","lista-admin-usuarios","btn-volver-admin-solicitudes",
    "btn-refrescar-admin-solicitudes","lista-admin-solicitudes","btn-volver-admin-precio",
    "form-admin-precio","admin-tasa-input","admin-plan-1","admin-plan-3","admin-plan-6",
    "admin-plan-12","admin-precio-exito","admin-precio-error","btn-volver-admin-pagos",
    "btn-refrescar-admin-pagos","lista-admin-pagos","btn-volver-perfil-publico",
    "pp-foto","pp-nombre","pp-rol","pp-telefono","pp-ubicacion","pp-estrellas-visual",
    "pp-promedio","pp-total","pp-miembro","pp-resenas","btn-reportar-desde-perfil",
    "ir-a-recuperar","ir-a-registro","ir-a-login","ir-a-login-desde-recuperar",
    "ir-a-login-desde-reset","reg-rol","reg-bloque-chofer","reg-tipo-vehiculo",
    "reg-chapa","reg-telefono","reg-provincia","reg-municipio",
    "btn-cerrar-pendiente","btn-cerrar-bloqueada",
    "cuenta-bloqueada-titulo","cuenta-bloqueada-motivo",
    "perfil-banner-advertencias","btn-ver-mis-reportes","btn-ver-mis-advertencias",
    "badge-advertencias-perfil","btn-volver-reportar","reportar-destinatario",
    "reportar-categoria","reportar-descripcion","reportar-error","reportar-exito",
    "lista-mis-reportes","btn-refrescar-mis-reportes","lista-advertencias",
    "btn-refrescar-advertencias",
    // Premium
    "premium-estado-card","premium-estado-titulo","premium-estado-texto",
    "premium-mi-saldo","premium-precio","btn-comprar-premium",
    "premium-error","premium-exito",
  ].forEach((id) => { el[id.replace(/-/g,"_")] = document.getElementById(id); });
}

// ------------------------------------------------------------
// 5) Utilidades de teléfono
// ------------------------------------------------------------
function limpiarTelefono(valor) {
  if (valor == null) return null;
  const soloDigitos = String(valor).replace(/\D/g, "");
  const ultimos8 = soloDigitos.slice(-8);
  return ultimos8.length === 8 ? ultimos8 : null;
}

async function telefonoYaExiste(tel) {
  if (!tel) return false;
  const { data, error } = await db.from("perfiles").select("id").eq("telefono", tel).maybeSingle();
  if (error) { console.warn("[tel] error check:", error); return false; }
  return !!data;
}

// ------------------------------------------------------------
// 6) Utilidades de ubicación geográfica
// ------------------------------------------------------------
function llenarSelectProvincias(select) {
  if (!select) return;
  select.innerHTML = '<option value="">— Elige tu provincia —</option>';
  if (typeof LISTA_PROVINCIAS === "undefined") {
    console.warn("[ubicaciones] LISTA_PROVINCIAS no disponible");
    return;
  }
  LISTA_PROVINCIAS.forEach((prov) => {
    const opt = document.createElement("option");
    opt.value = prov;
    opt.textContent = prov;
    select.appendChild(opt);
  });
}

function llenarSelectMunicipios(select, provincia, valorSeleccionado) {
  if (!select) return;
  if (!provincia) {
    select.innerHTML = '<option value="">— Primero elige provincia —</option>';
    select.disabled = true;
    return;
  }
  const muns = typeof obtenerMunicipios === "function" ? obtenerMunicipios(provincia) : [];
  select.innerHTML = '<option value="">— Elige tu municipio —</option>';
  muns.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (valorSeleccionado && valorSeleccionado === m) opt.selected = true;
    select.appendChild(opt);
  });
  select.disabled = false;
}

/** Sincroniza el bloque de vehículo con el rol seleccionado en el registro */
function refrescarBloqueChofer() {
  const esChofer = el.reg_rol?.value === "chofer";
  el.reg_bloque_chofer?.classList.toggle("oculto", !esChofer);
}

/** Resetea el formulario de registro a su estado inicial limpio */
function resetFormularioRegistro() {
  el.form_registro?.reset();

  // Municipio vuelve a estado deshabilitado
  if (el.reg_municipio) {
    el.reg_municipio.disabled = true;
    el.reg_municipio.innerHTML = '<option value="">— Primero elige provincia —</option>';
  }

  // Sincronizar bloque de chofer (el select vuelve a "cliente" tras reset)
  refrescarBloqueChofer();
}

// ------------------------------------------------------------
// 7) Navegación
// ------------------------------------------------------------
function conectarNavegacion() {
  document.getElementById("ir-a-registro")?.addEventListener("click", (e) => {
    e.preventDefault();
    limpiarMensajes();
    resetFormularioRegistro();
    mostrarPantalla("pantalla-registro");
  });
  document.getElementById("ir-a-login")?.addEventListener("click", (e) => {
    e.preventDefault(); limpiarMensajes(); mostrarPantalla("pantalla-login");
  });
  document.getElementById("ir-a-recuperar")?.addEventListener("click", (e) => {
    e.preventDefault(); limpiarMensajes(); el.form_recuperar?.reset();
    mostrarPantalla("pantalla-recuperar");
  });
  document.getElementById("ir-a-login-desde-recuperar")?.addEventListener("click", (e) => {
    e.preventDefault(); limpiarMensajes(); mostrarPantalla("pantalla-login");
  });
  document.getElementById("ir-a-login-desde-reset")?.addEventListener("click", (e) => {
    e.preventDefault(); limpiarMensajes();
    estado.modoRecuperacion = false;
    mostrarPantalla("pantalla-login");
  });

  el.cu_cerrar_sesion?.addEventListener("click", (e) => {
    e.preventDefault();
    cerrarSesion();
  });

  // Selector de rol → usa la función reutilizable
  el.reg_rol?.addEventListener("change", refrescarBloqueChofer);

  el.reg_telefono?.addEventListener("input", (e) => {
    const limpio = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (e.target.value !== limpio) e.target.value = limpio;
  });

  el.reg_provincia?.addEventListener("change", () => {
    llenarSelectMunicipios(el.reg_municipio, el.reg_provincia.value, "");
  });
  el.cu_provincia?.addEventListener("change", () => {
    llenarSelectMunicipios(el.cu_municipio, el.cu_provincia.value, "");
  });
  el.perfil_provincia?.addEventListener("change", () => {
    llenarSelectMunicipios(el.perfil_municipio, el.perfil_provincia.value, "");
  });

  el.btn_cerrar_pendiente?.addEventListener("click", cerrarSesion);
  el.btn_cerrar_bloqueada?.addEventListener("click", cerrarSesion);

  document.querySelectorAll("[data-volver]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const destino = btn.getAttribute("data-volver");
      mostrarPantalla(destino);
      if (destino === "pantalla-perfil") cargarPerfilYMostrar();
    });
  });

  el.btn_ir_nueva_solicitud?.addEventListener("click", () => {
    el.form_solicitud?.reset();
    limpiarMensajes();
    mapaDestino.lat = null; mapaDestino.lng = null;
    setMensaje("estado-punto-recogida", "Sin destino marcado en el mapa. (Opcional)");
    const primerRadio = document.querySelector('input[name="tipo"]');
    if (primerRadio) {
      primerRadio.checked = true;
      document.querySelectorAll(".opcion-tipo").forEach((op) => {
        op.classList.toggle("seleccionado", op.contains(primerRadio));
      });
    }
    mostrarPantalla("pantalla-nueva-solicitud");
  });

  el.btn_ir_mis_solicitudes?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-solicitudes");
    cargarMisSolicitudes();
  });

  // Choferes cercanos — requiere Premium para clientes
  document.getElementById("btn-ver-choferes-mapa")?.addEventListener("click", () => {
    if (estado.perfil?.rol === "cliente" && !estado.esPremium) {
      alert("⭐ El mapa de choferes cercanos es exclusivo del Plan Premium.\n\nActívalo por $100/mes desde tu perfil.");
      return;
    }
    if (typeof window.abrirMapaChoferes === "function") window.abrirMapaChoferes();
    else alert("El módulo de mapa aún no está cargado.");
  });

  el.btn_ir_disponibles?.addEventListener("click", async () => {
    mostrarPantalla("pantalla-solicitudes-disponibles");
    await obtenerUbicacionActual();
    cargarSolicitudesDisponibles();
  });

  el.btn_ir_mis_servicios?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-servicios");
    cargarMisServicios();
  });

  el.btn_ir_mi_suscripcion?.addEventListener("click", () => {
    window.location.href = URL_SUSCRIPCION;
  });

  // Plan Premium
  el.btn_ir_plan_premium?.addEventListener("click", () => {
    mostrarPantalla("pantalla-plan-premium");
    cargarPlanPremium();
  });
  el.perfil_banner_premium?.addEventListener("click", () => {
    mostrarPantalla("pantalla-plan-premium");
    cargarPlanPremium();
  });
  el.btn_comprar_premium?.addEventListener("click", comprarPlanPremium);

  el.btn_refrescar_mis?.addEventListener("click", cargarMisSolicitudes);
  el.btn_refrescar_disponibles?.addEventListener("click", async () => {
    await obtenerUbicacionActual();
    cargarSolicitudesDisponibles();
  });
  el.btn_refrescar_servicios?.addEventListener("click", cargarMisServicios);

  el.btn_volver_mapa?.addEventListener("click", cerrarMapa);
  el.btn_marcar_recogida?.addEventListener("click", abrirSelectorDestino);
  el.btn_cancelar_recogida?.addEventListener("click", cerrarSelectorDestino);
  el.btn_confirmar_recogida?.addEventListener("click", confirmarDestino);

  el.btn_volver_chat?.addEventListener("click", cerrarChat);
  el.form_chat?.addEventListener("submit", enviarMensaje);

  el.btn_volver_oferta?.addEventListener("click", () => {
    if (estado.perfil?.rol === "chofer") {
      mostrarPantalla("pantalla-solicitudes-disponibles");
      cargarSolicitudesDisponibles();
    } else mostrarPantalla("pantalla-perfil");
  });
  el.form_oferta?.addEventListener("submit", enviarOferta);

  el.btn_volver_ver_ofertas?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-solicitudes");
    cargarMisSolicitudes();
  });
  el.btn_refrescar_ofertas?.addEventListener("click", () => {
    if (oferta.solicitudId) cargarOfertas(oferta.solicitudId);
  });

  el.btn_volver_calificar?.addEventListener("click", volverDeCalificar);
  el.form_calificar?.addEventListener("submit", enviarCalificacion);

  document.querySelectorAll("#estrellas-contenedor .estrella").forEach((btn) => {
    btn.addEventListener("click", () => seleccionarEstrellas(Number(btn.getAttribute("data-valor"))));
  });

  el.btn_volver_ver_calificacion?.addEventListener("click", () => {
    if (estado.perfil?.rol === "chofer") {
      mostrarPantalla("pantalla-mis-servicios"); cargarMisServicios();
    } else {
      mostrarPantalla("pantalla-mis-solicitudes"); cargarMisSolicitudes();
    }
  });

  document.querySelectorAll('input[name="tipo"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".opcion-tipo").forEach((op) => {
        op.classList.toggle("seleccionado", op.contains(radio) && radio.checked);
      });
    });
  });

  el.btn_salir_suscripcion?.addEventListener("click", cerrarSesion);
  el.btn_pagar_suscripcion?.addEventListener("click", () => {
    window.location.href = URL_SUSCRIPCION;
  });

  el.btn_ir_panel_admin?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin"); cargarMetricasAdmin();
  });
  el.btn_abrir_admin_externo?.addEventListener("click", () => {
    window.location.href = URL_ADMIN_EXTERNO;
  });

  el.btn_refrescar_admin?.addEventListener("click", cargarMetricasAdmin);
  el.btn_admin_usuarios?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin-usuarios"); cargarUsuariosAdmin();
  });
  el.btn_admin_pagos?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin-pagos"); cargarPagosAdmin();
  });
  el.btn_admin_solicitudes?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin-solicitudes"); cargarSolicitudesAdmin();
  });
  el.btn_admin_precio?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin-precio"); cargarPrecioAdmin();
  });

  el.btn_volver_admin_usuarios?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin"); cargarMetricasAdmin();
  });
  el.btn_refrescar_admin_usuarios?.addEventListener("click", cargarUsuariosAdmin);
  el.btn_volver_admin_solicitudes?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin"); cargarMetricasAdmin();
  });
  el.btn_refrescar_admin_solicitudes?.addEventListener("click", cargarSolicitudesAdmin);
  el.btn_volver_admin_precio?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin"); cargarMetricasAdmin();
  });
  el.form_admin_precio?.addEventListener("submit", guardarPrecioAdmin);
  el.btn_volver_admin_pagos?.addEventListener("click", () => {
    mostrarPantalla("pantalla-admin"); cargarMetricasAdmin();
  });
  el.btn_refrescar_admin_pagos?.addEventListener("click", cargarPagosAdmin);

  document.querySelectorAll(".chip-filtro").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tipoFiltro = chip.getAttribute("data-filtro");
      const tipoReporte = chip.getAttribute("data-filtro-reporte");
      if (tipoReporte) {
        document.querySelectorAll("[data-filtro-reporte]").forEach((c) => c.classList.remove("activo"));
        chip.classList.add("activo");
        estado.filtroMisReportes = tipoReporte;
        cargarMisReportes();
        return;
      }
      document.querySelectorAll(".chip-filtro").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroAdminUsuarios = tipoFiltro;
      renderUsuariosAdmin();
    });
  });

  document.querySelectorAll(".chip-filtro-pago").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip-filtro-pago").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroAdminPagos = chip.getAttribute("data-filtro-pago");
      renderPagosAdmin();
    });
  });

  el.btn_volver_perfil_publico?.addEventListener("click", () => {
    const origen = estado.origenPerfilPublico || "pantalla-perfil";
    if (origen === "pantalla-choferes-mapa") {
      if (typeof window.abrirMapaChoferes === "function") window.abrirMapaChoferes();
      else mostrarPantalla("pantalla-perfil");
      return;
    }
    mostrarPantalla(origen);
    if (origen === "pantalla-mis-solicitudes") cargarMisSolicitudes();
    else if (origen === "pantalla-mis-servicios") cargarMisServicios();
    else if (origen === "pantalla-ver-ofertas") {
      if (oferta.solicitudId) cargarOfertas(oferta.solicitudId);
    }
  });

  // REPORTES
  el.btn_reportar_desde_perfil?.addEventListener("click", () => {
    const receptorId = el.btn_reportar_desde_perfil.getAttribute("data-receptor-id");
    if (receptorId) abrirPantallaReportar(receptorId, null);
  });
  el.btn_volver_reportar?.addEventListener("click", () => {
    mostrarPantalla("pantalla-perfil-publico");
  });
  el.form_reportar?.addEventListener("submit", enviarReporte);
  el.btn_ver_mis_reportes?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-reportes"); cargarMisReportes();
  });
  el.btn_refrescar_mis_reportes?.addEventListener("click", cargarMisReportes);
  el.btn_ver_mis_advertencias?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-advertencias"); cargarMisAdvertencias();
  });
  el.btn_refrescar_advertencias?.addEventListener("click", cargarMisAdvertencias);
  el.perfil_banner_advertencias?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-advertencias"); cargarMisAdvertencias();
  });

  // COMPLETAR UBICACIÓN
  el.form_completar_ubicacion?.addEventListener("submit", guardarUbicacionObligatoria);
}

// ------------------------------------------------------------
// 8) Registro
// ------------------------------------------------------------
async function registrarUsuario(e) {
  e.preventDefault();
  limpiarMensajes();

  const nombre   = document.getElementById("reg-nombre").value.trim();
  const telRaw   = document.getElementById("reg-telefono").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const provincia = document.getElementById("reg-provincia").value;
  const municipio = document.getElementById("reg-municipio").value;
  const rol      = document.getElementById("reg-rol").value;
  const codigoReferido = document.getElementById("reg-codigo-referido")?.value?.trim() || null;

  if (!nombre || !telRaw || !email || !password)
    return setMensaje("registro-error", "Completa todos los campos.");

  const telefono = limpiarTelefono(telRaw);
  if (!telefono || telefono.length !== 8)
    return setMensaje("registro-error", "El teléfono debe tener exactamente 8 dígitos.");

  if (!provincia) return setMensaje("registro-error", "Selecciona tu provincia.");
  if (!municipio) return setMensaje("registro-error", "Selecciona tu municipio.");

  if (typeof esUbicacionValida === "function" && !esUbicacionValida(provincia, municipio))
    return setMensaje("registro-error", "La ubicación seleccionada no es válida.");

  if (password.length < 6)
    return setMensaje("registro-error", "La contraseña debe tener al menos 6 caracteres.");

  let tipoVehiculo = null;
  let chapa = null;
  if (rol === "chofer") {
    tipoVehiculo = document.getElementById("reg-tipo-vehiculo")?.value?.trim() || "";
    chapa = document.getElementById("reg-chapa")?.value?.trim() || "";
    if (!tipoVehiculo)
      return setMensaje("registro-error", "Selecciona tu tipo de vehículo.");
  }

  const boton = el.form_registro.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Verificando teléfono...");

  const yaExiste = await telefonoYaExiste(telefono);
  if (yaExiste) {
    setBotonCargando(boton, false, "Crear cuenta");
    return setMensaje("registro-error", "❌ Este número de teléfono ya está registrado. Usa otro o recupera tu cuenta.");
  }

  setBotonCargando(boton, true, "Creando cuenta...");

  const metaData = { nombre, telefono, rol, provincia, municipio };
  if (rol === "chofer") {
    metaData.tipo_vehiculo = tipoVehiculo;
    if (chapa) metaData.chapa = chapa;
  }

  const { data, error } = await db.auth.signUp({
    email, password,
    options: {
      data: metaData,
      emailRedirectTo: window.location.href.replace(/[^/]*$/, ""),
    },
  });

  setBotonCargando(boton, false, "Crear cuenta");

  if (error) return setMensaje("registro-error", traducirError(error.message));

  if (!data.session) {
    setMensaje("registro-error", "");
    setMensaje(
      "registro-exito",
      rol === "chofer"
        ? "✅ Cuenta creada. Revisa tu correo, confirma tu cuenta y espera la aprobación del administrador."
        : "✅ Cuenta creada. Revisa tu correo y confirma tu cuenta antes de iniciar sesión."
    );
    resetFormularioRegistro();
    return;
  }

  await cargarPerfilYMostrar();

  if (codigoReferido && codigoReferido.length >= 4) {
    const { error: errRef } = await db.rpc("aplicar_codigo_referido", { p_codigo: codigoReferido });
    if (errRef) {
      console.warn("[referido] no se pudo aplicar:", errRef.message);
    }
  }
}

// ------------------------------------------------------------
// 9) Login
// ------------------------------------------------------------
async function iniciarSesion(e) {
  e.preventDefault();
  limpiarMensajes();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return setMensaje("login-error", "Completa correo y contraseña.");

  const boton = el.form_login.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Entrar");

  const { error } = await db.auth.signInWithPassword({ email, password });
  setBotonCargando(boton, false, "Entrar");
  if (error) return setMensaje("login-error", traducirError(error.message));

  el.form_login.reset();
  await cargarPerfilYMostrar();
}

// ------------------------------------------------------------
// 10) Recuperar contraseña
// ------------------------------------------------------------
async function solicitarRecuperacion(e) {
  e.preventDefault();
  limpiarMensajes();

  const email = el.recuperar_email.value.trim();
  if (!email) return setMensaje("recuperar-error", "Escribe tu correo.");

  const boton = el.form_recuperar.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Enviando...");

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href.split("?")[0].split("#")[0],
  });

  setBotonCargando(boton, false, "Enviar enlace de recuperación");

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("rate limit"))
      return setMensaje("recuperar-error", "Demasiados intentos. Espera unos minutos.");
    return setMensaje("recuperar-error", traducirError(error.message));
  }

  setMensaje("recuperar-exito",
    "✅ Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.");
  el.form_recuperar.reset();
}

// ------------------------------------------------------------
// 11) Reset de contraseña
// ------------------------------------------------------------
async function guardarNuevaPassword(e) {
  e.preventDefault();
  limpiarMensajes();

  const p1 = el.reset_password.value;
  const p2 = el.reset_password2.value;
  if (!p1 || !p2) return setMensaje("reset-error", "Completa ambos campos.");
  if (p1.length < 6) return setMensaje("reset-error", "Mínimo 6 caracteres.");
  if (p1 !== p2) return setMensaje("reset-error", "Las contraseñas no coinciden.");

  const boton = el.form_reset.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Guardando...");

  const { error } = await db.auth.updateUser({ password: p1 });
  setBotonCargando(boton, false, "Guardar nueva contraseña");
  if (error) return setMensaje("reset-error", traducirError(error.message));

  setMensaje("reset-exito", "✅ Contraseña actualizada. Redirigiendo...");
  estado.modoRecuperacion = false;
  el.form_reset.reset();

  setTimeout(async () => {
    await db.auth.signOut();
    limpiarMensajes();
    mostrarPantalla("pantalla-login");
  }, 1200);
}

// ------------------------------------------------------------
// 12) Cerrar sesión
// ------------------------------------------------------------
async function cerrarSesion() {
  detenerRealtime();
  await db.auth.signOut();
  estado.usuario = null; estado.perfil = null;
  estado.suscripcion = null;
  estado.planPremium = null;
  estado.esPremium = false;
  estado.calificacionesHechas = new Set();
  estado.ubicacionActual = null;
  estado.servicioActivoChofer = false;
  limpiarMensajes();
  mostrarPantalla("pantalla-login");
}

// ------------------------------------------------------------
// 13) Cargar perfil
// ------------------------------------------------------------
async function cargarPerfilYMostrar() {
  try {
    const { data: userData, error: userError } = await db.auth.getUser();
    if (userError || !userData?.user) { mostrarPantalla("pantalla-login"); return; }
    estado.usuario = { id: userData.user.id, email: userData.user.email };

    let { data: perfil } = await db
      .from("perfiles").select("*").eq("id", estado.usuario.id).maybeSingle();

    if (!perfil) {
      const meta = userData.user.user_metadata || {};
      const rolMeta = ["cliente","chofer"].includes(meta.rol) ? meta.rol : "cliente";
      const estadoInicial = rolMeta === "chofer" ? "pendiente_aprobacion" : "activo";
      const telLimpio = limpiarTelefono(meta.telefono || "");
      const insertData = {
        id: estado.usuario.id,
        nombre: meta.nombre || "",
        telefono: telLimpio,
        rol: rolMeta,
        estado_cuenta: estadoInicial,
        provincia: meta.provincia || null,
        municipio: meta.municipio || null,
      };
      if (rolMeta === "chofer") {
        insertData.tipo_vehiculo = meta.tipo_vehiculo || null;
        insertData.chapa = meta.chapa || null;
      }
      const { data: nuevo, error: errInsert } = await db
        .from("perfiles").insert(insertData).select().maybeSingle();
      if (errInsert || !nuevo) {
        setMensaje("login-error", "No se pudo cargar tu perfil: " + (errInsert?.message || "desconocido"));
        mostrarPantalla("pantalla-login");
        return;
      }
      perfil = nuevo;
    }

    estado.perfil = perfil;

    const estadoCuenta = perfil.estado_cuenta || "activo";
    if (estadoCuenta === "suspendido" || estadoCuenta === "baneado") {
      const titulo = document.getElementById("cuenta-bloqueada-titulo");
      const motivo = document.getElementById("cuenta-bloqueada-motivo");
      if (titulo) titulo.textContent = estadoCuenta === "baneado" ? "Cuenta baneada" : "Cuenta suspendida";
      if (motivo) motivo.textContent = perfil.motivo_estado
        ? "Motivo: " + perfil.motivo_estado
        : (estadoCuenta === "baneado" ? "Tu cuenta fue bloqueada permanentemente." : "Tu cuenta fue suspendida temporalmente.");
      mostrarPantalla("pantalla-cuenta-bloqueada");
      return;
    }

    if (perfil.rol === "chofer" && estadoCuenta === "pendiente_aprobacion") {
      mostrarPantalla("pantalla-pendiente-aprobacion");
      return;
    }

    if (!perfil.provincia || !perfil.municipio) {
      llenarSelectProvincias(el.cu_provincia);
      llenarSelectMunicipios(el.cu_municipio, "", "");
      mostrarPantalla("pantalla-completar-ubicacion");
      return;
    }

    estado.suscripcion = null;
    if (perfil.rol === "chofer") {
      const { data: susc } = await db.from("suscripciones").select("*")
        .eq("chofer_id", estado.usuario.id).eq("estado", "activa")
        .gt("fecha_vencimiento", new Date().toISOString())
        .order("fecha_vencimiento", { ascending: false }).maybeSingle();
      estado.suscripcion = susc || null;
    }

    estado.planPremium = null;
    estado.esPremium = false;
    if (perfil.rol === "cliente") {
      const { data: plan } = await db.from("planes_cliente").select("*")
        .eq("cliente_id", estado.usuario.id).eq("estado", "activo")
        .gt("fecha_vencimiento", new Date().toISOString())
        .order("fecha_vencimiento", { ascending: false }).maybeSingle();
      estado.planPremium = plan || null;
      estado.esPremium = !!plan;
    }

    el.perfil_nombre.value = perfil.nombre || "";
    el.perfil_telefono.value = perfil.telefono || "";
    el.perfil_email.value = estado.usuario.email || "";
    el.perfil_rol.textContent = perfil.rol || "cliente";
    if (perfil.foto_url) el.perfil_foto.src = perfil.foto_url;

    if (el.perfil_ubicacion) {
      el.perfil_ubicacion.textContent = `${perfil.municipio}, ${perfil.provincia}`;
    }

    llenarSelectProvincias(el.perfil_provincia);
    if (el.perfil_provincia) el.perfil_provincia.value = perfil.provincia || "";
    llenarSelectMunicipios(el.perfil_municipio, perfil.provincia || "", perfil.municipio || "");

    ajustarBotonesPorRol(perfil.rol);
    pintarBannerSuscripcion();
    pintarBannerPremium();
    await cargarCalificacionesHechas();
    await actualizarBadgeAdvertencias();
    iniciarRealtime();

    if (perfil.rol === "chofer" && typeof window.refrescarEstadoSwitchChofer === "function") {
      setTimeout(() => window.refrescarEstadoSwitchChofer(), 300);
    }

    if (perfil.rol === "chofer" && !estado.suscripcion) {
      mostrarPantalla("pantalla-sin-suscripcion");
      return;
    }

    mostrarPantalla("pantalla-perfil");
  } catch (err) {
    setMensaje("login-error", "Error inesperado: " + (err?.message || err));
    mostrarPantalla("pantalla-login");
  }
}

function ajustarBotonesPorRol(rol) {
  document.querySelectorAll("[data-rol]").forEach((elemento) => {
    const rolElemento = elemento.getAttribute("data-rol");
    elemento.classList.toggle("oculto", !(rol === rolElemento));
  });
}

async function cargarCalificacionesHechas() {
  if (!estado.usuario) return;
  const { data } = await db.from("calificaciones").select("solicitud_id")
    .eq("emisor_id", estado.usuario.id);
  estado.calificacionesHechas = new Set((data || []).map((c) => c.solicitud_id));
}

function pintarBannerSuscripcion() {
  const b = el.perfil_banner_suscripcion;
  if (!b) return;
  if (estado.perfil?.rol !== "chofer") { b.classList.add("oculto"); return; }
  if (estado.suscripcion) {
    const venc = new Date(estado.suscripcion.fecha_vencimiento);
    const dias = Math.ceil((venc - new Date()) / 86400000);
    b.className = "banner-suscripcion activa";
    b.textContent = `✅ Suscripción activa · vence en ${dias} día${dias === 1 ? "" : "s"} (${venc.toLocaleDateString("es-ES")})`;
  } else {
    b.className = "banner-suscripcion expirada";
    b.textContent = "⚠️ Sin suscripción activa. Ve a 💳 Mi suscripción para renovar.";
  }
}

function pintarBannerPremium() {
  const b = el.perfil_banner_premium;
  if (!b) return;
  if (estado.perfil?.rol !== "cliente") { b.classList.add("oculto"); b.style.display = "none"; return; }

  if (estado.esPremium && estado.planPremium) {
    const venc = new Date(estado.planPremium.fecha_vencimiento);
    const dias = Math.ceil((venc - new Date()) / 86400000);
    if (dias <= 5) {
      b.style.display = "";
      b.classList.remove("oculto");
      b.innerHTML = `⭐ Tu plan Premium vence en <strong>${dias} día${dias === 1 ? "" : "s"}</strong>. Toca para renovar.`;
    } else {
      b.style.display = "none";
      b.classList.add("oculto");
    }
  } else {
    b.style.display = "none";
    b.classList.add("oculto");
  }
}

async function actualizarBadgeAdvertencias() {
  if (!estado.usuario) return;
  const { data, error } = await db.from("advertencias")
    .select("id, leida").eq("usuario_id", estado.usuario.id);
  if (error) return;

  const noLeidas = (data || []).filter((a) => !a.leida).length;

  const badge = el.badge_advertencias_perfil;
  if (badge) {
    badge.textContent = noLeidas;
    badge.classList.toggle("oculto", noLeidas === 0);
  }

  const banner = el.perfil_banner_advertencias;
  if (banner) {
    if (noLeidas > 0) {
      banner.style.display = "";
      banner.classList.remove("oculto");
      banner.innerHTML = `⚠️ Tienes <strong>${noLeidas}</strong> advertencia${noLeidas === 1 ? "" : "s"} nueva${noLeidas === 1 ? "" : "s"}. Toca para ver.`;
    } else {
      banner.style.display = "none";
      banner.classList.add("oculto");
    }
  }
}

// ------------------------------------------------------------
// 14) Guardar ubicación obligatoria
// ------------------------------------------------------------
async function guardarUbicacionObligatoria(e) {
  e.preventDefault();
  limpiarMensajes();

  const provincia = el.cu_provincia?.value || "";
  const municipio = el.cu_municipio?.value || "";

  if (!provincia) return setMensaje("cu-error", "Selecciona tu provincia.");
  if (!municipio) return setMensaje("cu-error", "Selecciona tu municipio.");
  if (typeof esUbicacionValida === "function" && !esUbicacionValida(provincia, municipio))
    return setMensaje("cu-error", "La ubicación seleccionada no es válida.");

  const boton = el.form_completar_ubicacion.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Guardando...");

  const { error } = await db.from("perfiles")
    .update({ provincia, municipio })
    .eq("id", estado.usuario.id);

  setBotonCargando(boton, false, "Guardar ubicación");

  if (error) return setMensaje("cu-error", traducirError(error.message));

  setMensaje("cu-exito", "✅ Ubicación guardada. Entrando...");
  setTimeout(() => cargarPerfilYMostrar(), 800);
}

// ------------------------------------------------------------
// 15) Guardar perfil
// ------------------------------------------------------------
async function guardarPerfil(e) {
  e.preventDefault();
  limpiarMensajes();
  if (!estado.usuario) return;

  const nombre = el.perfil_nombre.value.trim();
  if (!nombre) return setMensaje("perfil-error", "El nombre es obligatorio.");

  const provincia = el.perfil_provincia?.value || "";
  const municipio = el.perfil_municipio?.value || "";

  if (!provincia) return setMensaje("perfil-error", "Selecciona tu provincia.");
  if (!municipio) return setMensaje("perfil-error", "Selecciona tu municipio.");
  if (typeof esUbicacionValida === "function" && !esUbicacionValida(provincia, municipio))
    return setMensaje("perfil-error", "La ubicación seleccionada no es válida.");

  const boton = el.form_perfil.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Guardar cambios");

  const { error } = await db.from("perfiles")
    .update({ nombre, provincia, municipio })
    .eq("id", estado.usuario.id);

  setBotonCargando(boton, false, "Guardar cambios");
  if (error) return setMensaje("perfil-error", traducirError(error.message));

  estado.perfil.nombre = nombre;
  estado.perfil.provincia = provincia;
  estado.perfil.municipio = municipio;
  if (el.perfil_ubicacion) el.perfil_ubicacion.textContent = `${municipio}, ${provincia}`;

  setMensaje("perfil-exito", "Perfil actualizado ✔");
}

// ------------------------------------------------------------
// 16) Subir foto
// ------------------------------------------------------------
async function subirFotoPerfil(e) {
  const archivo = e.target.files?.[0];
  if (!archivo) return;
  limpiarMensajes();

  if (archivo.size > 3 * 1024 * 1024) {
    setMensaje("perfil-error", "La imagen no debe superar 3 MB.");
    e.target.value = ""; return;
  }
  if (!estado.usuario) return;

  const uid = estado.usuario.id;
  const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `${uid}/${Date.now()}.${ext}`;
  setMensaje("perfil-exito", "Subiendo foto...");

  const { error: errUp } = await db.storage
    .from("avatares").upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (errUp) {
    setMensaje("perfil-error", "Error al subir la foto: " + errUp.message);
    setMensaje("perfil-exito", "");
    return;
  }

  const { data: pub } = db.storage.from("avatares").getPublicUrl(ruta);
  const url = pub?.publicUrl;
  if (!url) return setMensaje("perfil-error", "No se pudo obtener la URL pública.");

  const { error: errDb } = await db.from("perfiles").update({ foto_url: url }).eq("id", uid);
  if (errDb) return setMensaje("perfil-error", "No se pudo guardar la foto en el perfil.");

  el.perfil_foto.src = url;
  setMensaje("perfil-exito", "Foto actualizada ✔");
  e.target.value = "";
}

// ------------------------------------------------------------
// 17) Crear solicitud
// ------------------------------------------------------------
async function crearSolicitud(e) {
  e.preventDefault();
  limpiarMensajes();
  if (!estado.usuario) return;

  const tipo = document.querySelector('input[name="tipo"]:checked')?.value || "viaje";
  const origen = document.getElementById("solicitud-origen").value.trim();
  const destino = document.getElementById("solicitud-destino").value.trim();
  const notas = document.getElementById("solicitud-notas").value.trim() || null;
  const presupuestoRaw = document.getElementById("solicitud-presupuesto").value.trim();
  const presupuesto = presupuestoRaw === "" ? null : Number(presupuestoRaw);

  if (!origen || !destino) return setMensaje("solicitud-error", "Origen y destino son obligatorios.");
  if (presupuesto !== null && (isNaN(presupuesto) || presupuesto < 0))
    return setMensaje("solicitud-error", "Presupuesto inválido.");

  const boton = el.form_solicitud.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Publicar solicitud");

  const ubicacionCliente = await obtenerUbicacionActualConTimeout(3000);

  const nueva = {
    cliente_id: estado.usuario.id,
    tipo, origen, destino, notas, presupuesto, estado: "pendiente",
  };

  if (ubicacionCliente) {
    nueva.lat_cliente = ubicacionCliente.lat;
    nueva.lng_cliente = ubicacionCliente.lng;
  }
  if (mapaDestino.lat !== null && mapaDestino.lng !== null) {
    nueva.lat_destino = mapaDestino.lat;
    nueva.lng_destino = mapaDestino.lng;
  }

  const { error } = await db.from("solicitudes").insert(nueva);
  setBotonCargando(boton, false, "Publicar solicitud");
  if (error) return setMensaje("solicitud-error", traducirError(error.message));

  el.form_solicitud.reset();
  mapaDestino.lat = null; mapaDestino.lng = null;
  setMensaje("estado-punto-recogida", "Sin destino marcado en el mapa. (Opcional)");
  setMensaje("solicitud-exito", "Solicitud publicada ✔");

  setTimeout(() => {
    mostrarPantalla("pantalla-mis-solicitudes");
    cargarMisSolicitudes();
  }, 700);
}

// ------------------------------------------------------------
// 18) Cargar mis solicitudes
// ------------------------------------------------------------
async function cargarMisSolicitudes() {
  const cont = el.lista_mis_solicitudes;
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  await cargarCalificacionesHechas();

  const { data, error } = await db.from("solicitudes").select("*")
    .eq("cliente_id", estado.usuario.id)
    .or(`estado.neq.pendiente,expira_en.is.null,expira_en.gt.${new Date().toISOString()}`)
    .order("creado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<p class="vacio">No tienes solicitudes aún.</p>'; return; }

  cont.innerHTML = "";
  data.forEach((s) => cont.appendChild(renderTarjetaSolicitud(s, "cliente")));
  iniciarTemporizadores();
}

// ------------------------------------------------------------
// 19) Cargar disponibles (con RELEVANCIA GEOGRÁFICA + PREMIUM)
// ------------------------------------------------------------
async function cargarSolicitudesDisponibles() {
  const cont = el.lista_disponibles;
  if (!cont) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  await verificarServicioActivoChofer();

  const { data, error } = await db
    .from("solicitudes")
    .select(`
      *,
      cliente:cliente_id ( id, nombre, provincia, municipio )
    `)
    .eq("estado", "pendiente")
    .gt("expira_en", new Date().toISOString())
    .order("creado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<p class="vacio">No hay solicitudes disponibles.</p>'; return; }

  const miProv = estado.perfil?.provincia || "";
  const miMun  = estado.perfil?.municipio || "";
  const miUbic = estado.ubicacionActual;

  const ordenadas = data.slice().sort((a, b) => {
    const aMun  = a.cliente?.municipio || "";
    const aProv = a.cliente?.provincia || "";
    const bMun  = b.cliente?.municipio || "";
    const bProv = b.cliente?.provincia || "";

    const aMismoMun = (miMun && aMun === miMun) ? 0 : 1;
    const bMismoMun = (miMun && bMun === miMun) ? 0 : 1;
    if (aMismoMun !== bMismoMun) return aMismoMun - bMismoMun;

    const aMismaProv = (miProv && aProv === miProv) ? 0 : 1;
    const bMismaProv = (miProv && bProv === miProv) ? 0 : 1;
    if (aMismaProv !== bMismaProv) return aMismaProv - bMismaProv;

    const aPrem = a.es_premium ? 0 : 1;
    const bPrem = b.es_premium ? 0 : 1;
    if (aPrem !== bPrem) return aPrem - bPrem;

    if (miUbic) {
      const aDist = (a.lat_cliente != null && a.lng_cliente != null)
        ? distanciaKm(miUbic.lat, miUbic.lng, a.lat_cliente, a.lng_cliente) : 99999;
      const bDist = (b.lat_cliente != null && b.lng_cliente != null)
        ? distanciaKm(miUbic.lat, miUbic.lng, b.lat_cliente, b.lng_cliente) : 99999;
      if (aDist !== bDist) return aDist - bDist;
    }

    return new Date(b.creado_en) - new Date(a.creado_en);
  });

  cont.innerHTML = "";
  ordenadas.forEach((s) => cont.appendChild(renderTarjetaSolicitud(s, "chofer")));
  iniciarTemporizadores();
}

async function verificarServicioActivoChofer() {
  estado.servicioActivoChofer = false;
  if (!estado.usuario || estado.perfil?.rol !== "chofer") return;
  const { data, error } = await db.from("solicitudes").select("id")
    .eq("chofer_id", estado.usuario.id)
    .in("estado", ["aceptado","en_camino","llego","en_curso"]).limit(1);
  if (!error && data && data.length > 0) estado.servicioActivoChofer = true;
}

// ------------------------------------------------------------
// 20) Cargar mis servicios
// ------------------------------------------------------------
async function cargarMisServicios() {
  const cont = el.lista_mis_servicios;
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';
  await cargarCalificacionesHechas();

  const { data, error } = await db.from("solicitudes").select("*")
    .eq("chofer_id", estado.usuario.id)
    .in("estado", ["aceptado","en_camino","llego","en_curso","completado","cancelado"])
    .order("actualizado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<p class="vacio">No tienes servicios aceptados aún.</p>'; return; }

  cont.innerHTML = "";
  data.forEach((s) => cont.appendChild(renderTarjetaSolicitud(s, "chofer-servicio")));
}

// ------------------------------------------------------------
// 21) Render tarjeta
// ------------------------------------------------------------
function renderTarjetaSolicitud(s, modo) {
  const card = document.createElement("div");
  card.className = "tarjeta-solicitud";
  card.dataset.solicitudId = s.id;
  card.dataset.expira = s.expira_en || "";

  const tipoClase = s.tipo === "viaje" ? "viaje" : "delivery";
  const tipoTexto = s.tipo === "viaje" ? "Viaje" : "Delivery";
  const estadoTexto = traducirEstado(s.estado);
  const activa = ["aceptado","en_camino","llego","en_curso"].includes(s.estado);
  const completada = s.estado === "completado";
  const yaCalifique = estado.calificacionesHechas.has(s.id);

  let accionesHTML = "";

  if (modo === "cliente") {
    accionesHTML = `<div class="acciones-tarjeta">`;
    if (s.estado === "pendiente")
      accionesHTML += `<button class="btn-ver-ofertas" data-ver-ofertas="${s.id}">💬 Ver ofertas</button>`;
    if (activa) {
      accionesHTML += `<button class="btn-chat" data-chat="${s.id}">💬 Chat</button>`;
      if (s.chofer_id) {
        accionesHTML += `<button class="btn-mapa" data-mapa="${s.id}">📍 Ver mapa</button>`;
        accionesHTML += `<button class="btn-ver-perfil" data-ver-perfil="${s.chofer_id}">👤 Ver chofer</button>`;
      }
    }
    if (["pendiente","aceptado","en_camino","llego"].includes(s.estado))
      accionesHTML += `<button class="btn-cancelar" data-cancelar="${s.id}" data-modo="cliente">Cancelar</button>`;
    if (completada && s.chofer_id) {
      if (yaCalifique) {
        accionesHTML += `<button class="btn-ver-calificacion" data-ver-calificacion="${s.id}">📋 Ver mi calificación</button>`;
      } else {
        accionesHTML += `<button class="btn-calificar" data-calificar="${s.id}" data-receptor="${s.chofer_id}">⭐ Calificar chofer</button>`;
      }
      accionesHTML += `<button class="btn-cancelar" data-reportar="${s.chofer_id}" data-solicitud="${s.id}" style="background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca">🚨 Reportar</button>`;
    }
    accionesHTML += `</div>`;
  } else if (modo === "chofer" && s.estado === "pendiente") {
    if (estado.servicioActivoChofer) {
      accionesHTML = `<div class="aviso-servicio-activo">⚠️ Tienes un servicio activo. Finalízalo o cancélalo para aceptar otro.</div>`;
    } else {
      accionesHTML = `<div class="acciones-tarjeta">
        <button class="btn-aceptar" data-aceptar="${s.id}">Aceptar</button>
        <button class="btn-oferta" data-oferta="${s.id}">💰 Ofertar</button>
      </div>`;
    }
  } else if (modo === "chofer-servicio") {
    const siguiente = siguienteEstado(s.estado);
    const puedeCancelar = ["aceptado","en_camino","llego","en_curso"].includes(s.estado);

    accionesHTML = `<div class="acciones-tarjeta">`;
    if (activa) {
      accionesHTML += `<button class="btn-chat" data-chat="${s.id}">💬 Chat</button>`;
      accionesHTML += `<button class="btn-mapa" data-mapa="${s.id}">📍 Ver mapa</button>`;
      if (s.cliente_id)
        accionesHTML += `<button class="btn-ver-perfil" data-ver-perfil="${s.cliente_id}">👤 Ver cliente</button>`;
    }
    if (siguiente)
      accionesHTML += `<button class="btn-aceptar" data-avanzar="${s.id}" data-nuevo="${siguiente.valor}">${siguiente.texto}</button>`;
    if (puedeCancelar)
      accionesHTML += `<button class="btn-cancelar" data-cancelar="${s.id}" data-modo="chofer-servicio">Cancelar</button>`;
    if (completada && s.cliente_id) {
      if (yaCalifique) {
        accionesHTML += `<button class="btn-ver-calificacion" data-ver-calificacion="${s.id}">📋 Ver mi calificación</button>`;
      } else {
        accionesHTML += `<button class="btn-calificar" data-calificar="${s.id}" data-receptor="${s.cliente_id}">⭐ Calificar cliente</button>`;
      }
      accionesHTML += `<button class="btn-cancelar" data-reportar="${s.cliente_id}" data-solicitud="${s.id}" style="background:#fef2f2;color:#991b1b;border:1.5px solid #fecaca">🚨 Reportar</button>`;
    }
    accionesHTML += `</div>`;
  }

  let ubicacionClienteHTML = "";
  if (modo === "chofer" && s.cliente) {
    const mun = s.cliente.municipio || "";
    const prov = s.cliente.provincia || "";
    if (mun || prov) {
      ubicacionClienteHTML = `<p class="texto-ayuda" style="text-align:left">📍 ${escapar(mun)}${mun && prov ? ", " : ""}${escapar(prov)}</p>`;
    }
  }

  const premiumHTML = (modo === "chofer" && s.es_premium)
    ? `<div style="background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);color:#fff;padding:5px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;text-align:center;letter-spacing:0.5px">⭐ CLIENTE PREMIUM · Prioridad</div>`
    : "";

  let distanciasHTML = "";
  if (modo === "chofer" && estado.ubicacionActual) {
    const ubChofer = estado.ubicacionActual;
    const tieneRecogida = s.lat_cliente != null && s.lng_cliente != null;
    const tieneDestino = s.lat_destino != null && s.lng_destino != null;
    let distRecogida = null, distDestino = null, distTotal = null;

    if (tieneRecogida) distRecogida = distanciaKm(ubChofer.lat, ubChofer.lng, s.lat_cliente, s.lng_cliente);
    if (tieneRecogida && tieneDestino) {
      distDestino = distanciaKm(s.lat_cliente, s.lng_cliente, s.lat_destino, s.lng_destino);
      distTotal = distRecogida + distDestino;
    } else if (tieneDestino) {
      distTotal = distanciaKm(ubChofer.lat, ubChofer.lng, s.lat_destino, s.lng_destino);
    }

    distanciasHTML = `
      <div class="distancias">
        ${distRecogida != null ? `<span>📍 Hasta el cliente: <strong>${formatoKm(distRecogida)}</strong></span>` : `<span>📍 Ubicación del cliente no disponible</span>`}
        ${distDestino != null ? `<span>🏁 Recogida → Destino: <strong>${formatoKm(distDestino)}</strong></span>` : ""}
        ${distTotal != null ? `<span>🚗 Total estimado: <strong>${formatoKm(distTotal)}</strong></span>` : ""}
      </div>
    `;
  }

  let timerHTML = "";
  if (s.estado === "pendiente" && s.expira_en) {
    timerHTML = `<div class="temporizador" data-expira="${s.expira_en}">⏳ —</div>`;
  }

  card.innerHTML = `
    <div class="fila-superior">
      <span class="badge-tipo ${tipoClase}">${tipoTexto}</span>
      <span class="badge-estado ${s.estado}">${estadoTexto}</span>
    </div>
    ${premiumHTML}
    <p class="ruta"><span class="etiqueta">De:</span> ${escapar(s.origen)}</p>
    <p class="ruta"><span class="etiqueta">A:</span> ${escapar(s.destino)}</p>
    ${s.notas ? `<p class="notas">"${escapar(s.notas)}"</p>` : ""}
    ${ubicacionClienteHTML}
    ${s.lat_destino && s.lng_destino ? `<p class="texto-ayuda">🏁 Destino exacto marcado en el mapa</p>` : ""}
    ${distanciasHTML}
    ${timerHTML}
    <div class="meta">
      <span>${formatearFecha(s.creado_en)}</span>
      ${
        s.precio_final != null
          ? `<span class="precio-final">Precio: $${Number(s.precio_final).toFixed(2)}</span>`
          : (s.presupuesto != null
              ? `<span class="presupuesto">Sugerido: $${Number(s.presupuesto).toFixed(2)}</span>`
              : "")
      }
    </div>
    ${accionesHTML}
  `;

  card.querySelector("[data-cancelar]")?.addEventListener("click", (ev) =>
    cancelarSolicitud(ev.target.getAttribute("data-cancelar"), ev.target.getAttribute("data-modo")));
  card.querySelector("[data-aceptar]")?.addEventListener("click", (ev) =>
    aceptarSolicitud(ev.target.getAttribute("data-aceptar")));
  card.querySelector("[data-avanzar]")?.addEventListener("click", (ev) =>
    avanzarEstado(ev.target.getAttribute("data-avanzar"), ev.target.getAttribute("data-nuevo")));
  card.querySelector("[data-mapa]")?.addEventListener("click", (ev) =>
    abrirMapa(ev.target.getAttribute("data-mapa")));
  card.querySelector("[data-chat]")?.addEventListener("click", (ev) =>
    abrirChat(ev.target.getAttribute("data-chat")));
  card.querySelector("[data-oferta]")?.addEventListener("click", (ev) =>
    abrirFormOferta(ev.target.getAttribute("data-oferta")));
  card.querySelector("[data-ver-ofertas]")?.addEventListener("click", (ev) =>
    abrirVerOfertas(ev.target.getAttribute("data-ver-ofertas")));
  card.querySelector("[data-calificar]")?.addEventListener("click", (ev) =>
    abrirCalificar(ev.target.getAttribute("data-calificar"), ev.target.getAttribute("data-receptor")));
  card.querySelector("[data-ver-calificacion]")?.addEventListener("click", (ev) =>
    abrirVerCalificacion(ev.target.getAttribute("data-ver-calificacion")));
  card.querySelector("[data-ver-perfil]")?.addEventListener("click", (ev) =>
    abrirPerfilPublico(ev.target.getAttribute("data-ver-perfil")));
  card.querySelector("[data-reportar]")?.addEventListener("click", (ev) =>
    abrirPantallaReportar(ev.target.getAttribute("data-reportar"), ev.target.getAttribute("data-solicitud")));

  return card;
}

function siguienteEstado(estadoActual) {
  const flujo = {
    aceptado:  { valor: "en_camino", texto: "🚗 Ir en camino" },
    en_camino: { valor: "llego",     texto: "📍 Llegué al punto" },
    llego:     { valor: "en_curso",  texto: "▶ Iniciar servicio" },
    en_curso:  { valor: "completado",texto: "✅ Marcar completado" },
  };
  return flujo[estadoActual] || null;
}

// ------------------------------------------------------------
// 22) Cancelar
// ------------------------------------------------------------
async function cancelarSolicitud(id, modo) {
  const esChofer = modo === "chofer-servicio";
  const msg = esChofer
    ? "¿Cancelar? La solicitud volverá a estar disponible 10 minutos."
    : "¿Cancelar esta solicitud?";
  if (!confirm(msg)) return;

  const { data, error } = await db.rpc("cancelar_solicitud", { p_solicitud_id: id });
  if (error) return alert("Error al cancelar: " + error.message);
  if (!data) alert("No se pudo cancelar.");

  if (esChofer) { alert("Servicio cancelado. Vuelve a estar disponible 10 minutos."); cargarMisServicios(); }
  else if (modo === "cliente") cargarMisSolicitudes();
  else cargarSolicitudesDisponibles();
}

// ------------------------------------------------------------
// 23) Aceptar
// ------------------------------------------------------------
async function aceptarSolicitud(id) {
  if (!estado.usuario) return;
  const { data: activos, error: errAct } = await db.from("solicitudes").select("id")
    .eq("chofer_id", estado.usuario.id)
    .in("estado", ["aceptado","en_camino","llego","en_curso"]).limit(1);
  if (errAct) return alert("Error verificando servicios activos: " + errAct.message);
  if (activos && activos.length > 0) {
    alert("Ya tienes un servicio activo. Finalízalo o cancélalo antes de aceptar otro.");
    cargarSolicitudesDisponibles(); return;
  }

  if (!confirm("¿Aceptar esta solicitud?")) return;

  const { data, error } = await db.from("solicitudes")
    .update({ chofer_id: estado.usuario.id, estado: "aceptado", expira_en: null })
    .eq("id", id).eq("estado", "pendiente").select();

  if (error) return alert("Error al aceptar: " + error.message);
  if (!data || data.length === 0) {
    alert("No se pudo aceptar. Puede que ya haya sido tomada o expiró.");
    cargarSolicitudesDisponibles(); return;
  }
  alert("¡Solicitud aceptada!");
  cargarSolicitudesDisponibles();
}

// ------------------------------------------------------------
// 24) Avanzar estado
// ------------------------------------------------------------
async function avanzarEstado(id, nuevoEstado) {
  const etiquetas = {
    en_camino: "Ir en camino", llego: "Marcar que llegaste",
    en_curso: "Iniciar el servicio", completado: "Marcar como completado",
  };
  if (!confirm("¿" + (etiquetas[nuevoEstado] || "Actualizar estado") + "?")) return;

  const { data, error } = await db.from("solicitudes")
    .update({ estado: nuevoEstado }).eq("id", id).select();
  if (error) return alert("Error al actualizar: " + error.message);
  if (!data || data.length === 0) alert("No se pudo actualizar el estado.");

  if (nuevoEstado === "completado" || nuevoEstado === "cancelado") {
    if (realtime.solicitudActivaId === id) cerrarMapa();
  }
  cargarMisServicios();
}

// ------------------------------------------------------------
// 25) Distancias
// ------------------------------------------------------------
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = gradosARadianes(lat2 - lat1);
  const dLng = gradosARadianes(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(gradosARadianes(lat1)) * Math.cos(gradosARadianes(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function gradosARadianes(g) { return g * Math.PI / 180; }
function formatoKm(km) {
  if (km < 1) return Math.round(km * 1000) + " m";
  return km.toFixed(1) + " km";
}

function obtenerUbicacionActual() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        estado.ubicacionActual = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(estado.ubicacionActual);
      }, () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 });
  });
}

function obtenerUbicacionActualConTimeout(ms) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), ms + 200);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const u = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        estado.ubicacionActual = u;
        resolve(u);
      }, () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: false, timeout: ms, maximumAge: 60000 });
  });
}

// ------------------------------------------------------------
// 26) Temporizadores
// ------------------------------------------------------------
function iniciarTemporizadores() {
  if (realtime.tickTemporizadores) clearInterval(realtime.tickTemporizadores);
  actualizarTemporizadores();
  realtime.tickTemporizadores = setInterval(actualizarTemporizadores, 1000);
}
function actualizarTemporizadores() {
  const ahora = Date.now();
  document.querySelectorAll(".temporizador").forEach((div) => {
    const exp = div.getAttribute("data-expira");
    if (!exp) return;
    const ms = new Date(exp).getTime() - ahora;
    if (ms <= 0) { div.textContent = "⏳ Expirada"; div.classList.add("expirado"); return; }
    const min = Math.floor(ms / 60000);
    const seg = Math.floor((ms % 60000) / 1000);
    div.textContent = `⏳ Expira en ${min}:${String(seg).padStart(2, "0")}`;
  });
}

// ------------------------------------------------------------
// 27) REALTIME
// ------------------------------------------------------------
function iniciarRealtime() {
  detenerRealtime();
  if (!estado.usuario) return;

  realtime.canalSolicitudes = db.channel("solicitudes-live-" + estado.usuario.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" },
      (payload) => manejarCambioSolicitud(payload))
    .subscribe((s) => console.log("[Realtime solicitudes]", s));

  if (estado.perfil?.rol === "chofer") {
    realtime.canalSuscripciones = db.channel("suscripciones-live-" + estado.usuario.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "suscripciones", filter: `chofer_id=eq.${estado.usuario.id}` },
        async () => {
          const { data: susc } = await db.from("suscripciones").select("*")
            .eq("chofer_id", estado.usuario.id).eq("estado", "activa")
            .gt("fecha_vencimiento", new Date().toISOString())
            .order("fecha_vencimiento", { ascending: false }).maybeSingle();
          estado.suscripcion = susc || null;
          pintarBannerSuscripcion();
          if (estado.suscripcion) mostrarPantalla("pantalla-perfil");
          else mostrarPantalla("pantalla-sin-suscripcion");
        }).subscribe((s) => console.log("[Realtime suscripciones]", s));
  }

  if (estado.perfil?.rol === "cliente") {
    realtime.canalPlanes = db.channel("planes-live-" + estado.usuario.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "planes_cliente", filter: `cliente_id=eq.${estado.usuario.id}` },
        async () => {
          const { data: plan } = await db.from("planes_cliente").select("*")
            .eq("cliente_id", estado.usuario.id).eq("estado", "activo")
            .gt("fecha_vencimiento", new Date().toISOString())
            .order("fecha_vencimiento", { ascending: false }).maybeSingle();
          estado.planPremium = plan || null;
          estado.esPremium = !!plan;
          pintarBannerPremium();
        }).subscribe((s) => console.log("[Realtime planes]", s));
  }

  if (estado.perfil?.rol === "admin") {
    realtime.canalPagos = db.channel("pagos-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes_pago" },
        () => {
          if (document.querySelector(".pantalla.activa")?.id === "pantalla-admin-pagos") cargarPagosAdmin();
        }).subscribe((s) => console.log("[Realtime pagos]", s));
  }

  realtime.canalReportes = db.channel("reportes-live-" + estado.usuario.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "advertencias", filter: `usuario_id=eq.${estado.usuario.id}` },
      () => actualizarBadgeAdvertencias())
    .subscribe((s) => console.log("[Realtime reportes]", s));
}

function detenerRealtime() {
  if (realtime.tickTemporizadores) { clearInterval(realtime.tickTemporizadores); realtime.tickTemporizadores = null; }
  if (realtime.canalSolicitudes) { db.removeChannel(realtime.canalSolicitudes); realtime.canalSolicitudes = null; }
  if (realtime.canalChat) { db.removeChannel(realtime.canalChat); realtime.canalChat = null; }
  if (realtime.canalOfertas) { db.removeChannel(realtime.canalOfertas); realtime.canalOfertas = null; }
  if (realtime.canalUbicacion) { db.removeChannel(realtime.canalUbicacion); realtime.canalUbicacion = null; }
  if (realtime.canalSuscripciones) { db.removeChannel(realtime.canalSuscripciones); realtime.canalSuscripciones = null; }
  if (realtime.canalPagos) { db.removeChannel(realtime.canalPagos); realtime.canalPagos = null; }
  if (realtime.canalReportes) { db.removeChannel(realtime.canalReportes); realtime.canalReportes = null; }
  if (realtime.canalPlanes) { db.removeChannel(realtime.canalPlanes); realtime.canalPlanes = null; }
  detenerUbicacion();
}

function manejarCambioSolicitud(payload) {
  if (!estado.usuario) return;
  const fila = payload.new || payload.old;
  if (!fila) return;
  const miId = estado.usuario.id;
  const pantalla = document.querySelector(".pantalla.activa")?.id;

  if (pantalla === "pantalla-mis-solicitudes" && fila.cliente_id === miId) cargarMisSolicitudes();
  else if (pantalla === "pantalla-solicitudes-disponibles" && fila.estado === "pendiente") cargarSolicitudesDisponibles();
  else if (pantalla === "pantalla-mis-servicios" && fila.chofer_id === miId) cargarMisServicios();
}

// ------------------------------------------------------------
// 28) MAPA en vivo
// ------------------------------------------------------------
async function abrirMapa(solicitudId) {
  const { data: sol, error } = await db.from("solicitudes").select("*").eq("id", solicitudId).single();
  if (error || !sol) return alert("No se pudo cargar la solicitud.");
  realtime.solicitudActivaId = solicitudId;
  mostrarPantalla("pantalla-mapa");
  setTimeout(() => {
    inicializarMapa(sol);
    suscribirUbicacion(solicitudId);
    iniciarEnvioUbicacion(solicitudId);
  }, 150);
}

function cerrarMapa() {
  detenerUbicacion();
  if (realtime.canalUbicacion) { db.removeChannel(realtime.canalUbicacion); realtime.canalUbicacion = null; }
  if (mapa.instancia) {
    mapa.instancia.remove(); mapa.instancia = null;
    mapa.marcadorChofer = null; mapa.marcadorCliente = null; mapa.marcadorDestino = null;
  }
  realtime.solicitudActivaId = null;
  if (estado.perfil?.rol === "chofer") { mostrarPantalla("pantalla-mis-servicios"); cargarMisServicios(); }
  else { mostrarPantalla("pantalla-mis-solicitudes"); cargarMisSolicitudes(); }
}

function crearIcono(tipo) {
  const emojis = { chofer: "🚗", cliente: "👤", recogida: "🏁" };
  const clase = tipo === "recogida" ? "marcador-recogida" : `marcador-${tipo}`;
  return L.divIcon({ className: "", html: `<div class="${clase}">${emojis[tipo] || "📍"}</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });
}

function inicializarMapa(solicitud) {
  const contenedor = document.getElementById("mapa");
  if (!contenedor) return;
  if (mapa.instancia) { mapa.instancia.remove(); mapa.instancia = null; }
  mapa.instancia = L.map(contenedor, { zoomControl: true }).setView([10.4806, -66.9036], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapa.instancia);
  setTimeout(() => mapa.instancia?.invalidateSize(), 250);

  if (solicitud.lat_chofer && solicitud.lng_chofer) actualizarMarcadorChofer(solicitud.lat_chofer, solicitud.lng_chofer);
  if (solicitud.lat_cliente && solicitud.lng_cliente) actualizarMarcadorCliente(solicitud.lat_cliente, solicitud.lng_cliente);
  if (solicitud.lat_destino && solicitud.lng_destino) actualizarMarcadorDestino(solicitud.lat_destino, solicitud.lng_destino);

  setTimeout(centrarMapa, 400);
  setMensaje("info-mapa-texto",
    estado.perfil?.rol === "chofer" ? "Compartiendo tu ubicación con el cliente…" : "Esperando ubicación del chofer…");
}

function actualizarMarcadorChofer(lat, lng) {
  if (!mapa.instancia) return;
  const pos = [Number(lat), Number(lng)];
  if (mapa.marcadorChofer) mapa.marcadorChofer.setLatLng(pos);
  else mapa.marcadorChofer = L.marker(pos, { icon: crearIcono("chofer") }).addTo(mapa.instancia);
}
function actualizarMarcadorCliente(lat, lng) {
  if (!mapa.instancia) return;
  const pos = [Number(lat), Number(lng)];
  if (mapa.marcadorCliente) mapa.marcadorCliente.setLatLng(pos);
  else mapa.marcadorCliente = L.marker(pos, { icon: crearIcono("cliente") }).addTo(mapa.instancia);
}
function actualizarMarcadorDestino(lat, lng) {
  if (!mapa.instancia) return;
  const pos = [Number(lat), Number(lng)];
  if (mapa.marcadorDestino) mapa.marcadorDestino.setLatLng(pos);
  else mapa.marcadorDestino = L.marker(pos, { icon: crearIcono("recogida") }).addTo(mapa.instancia);
}
function centrarMapa() {
  if (!mapa.instancia) return;
  const puntos = [];
  if (mapa.marcadorChofer) puntos.push(mapa.marcadorChofer.getLatLng());
  if (mapa.marcadorCliente) puntos.push(mapa.marcadorCliente.getLatLng());
  if (mapa.marcadorDestino) puntos.push(mapa.marcadorDestino.getLatLng());
  if (puntos.length >= 2) mapa.instancia.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 16 });
  else if (puntos.length === 1) mapa.instancia.setView(puntos[0], 15);
}

// ------------------------------------------------------------
// 29) UBICACIÓN: enviar
// ------------------------------------------------------------
function iniciarEnvioUbicacion(solicitudId) {
  if (!navigator.geolocation) {
    setMensaje("info-mapa-texto", "Tu navegador no soporta geolocalización.");
    return;
  }
  realtime.watchId = navigator.geolocation.watchPosition(
    (pos) => enviarUbicacion(pos, solicitudId),
    (err) => {
      console.warn("Error de geolocalización:", err);
      setMensaje("info-mapa-texto", "No se pudo obtener tu ubicación: " + err.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 4000 });
}

function detenerUbicacion() {
  if (realtime.watchId !== null) { navigator.geolocation.clearWatch(realtime.watchId); realtime.watchId = null; }
}

function enviarUbicacion(pos, solicitudId) {
  const { latitude, longitude } = pos.coords;
  const ahora = Date.now();
  const rol = estado.perfil?.rol === "chofer" ? "chofer" : "cliente";
  const nombre = estado.perfil?.nombre || "";
  estado.ubicacionActual = { lat: latitude, lng: longitude };

  if (rol === "chofer") actualizarMarcadorChofer(latitude, longitude);
  else actualizarMarcadorCliente(latitude, longitude);
  centrarMapa();

  if (ahora - realtime.ultimaUbicacionEnviada > 3000) {
    realtime.ultimaUbicacionEnviada = ahora;
    realtime.canalUbicacion?.send({
      type: "broadcast", event: "posicion",
      payload: { rol, lat: latitude, lng: longitude, nombre, ts: ahora },
    });
    setMensaje("info-mapa-texto", "📍 Compartiendo tu ubicación…");
  }

  if (ahora - realtime.ultimaPersistencia > 15000) {
    realtime.ultimaPersistencia = ahora;
    const col = rol === "chofer"
      ? { lat_chofer: latitude, lng_chofer: longitude, ubicacion_actualizada_en: new Date().toISOString() }
      : { lat_cliente: latitude, lng_cliente: longitude, ubicacion_actualizada_en: new Date().toISOString() };
    db.from("solicitudes").update(col).eq("id", solicitudId).then(() => {});
  }
}

// ------------------------------------------------------------
// 30) UBICACIÓN: escuchar
// ------------------------------------------------------------
function suscribirUbicacion(solicitudId) {
  if (realtime.canalUbicacion) { db.removeChannel(realtime.canalUbicacion); realtime.canalUbicacion = null; }
  realtime.canalUbicacion = db.channel(`ubicacion-${solicitudId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "posicion" }, ({ payload }) => {
      if (!payload) return;
      const { rol, lat, lng, nombre } = payload;
      if (rol === "chofer") {
        actualizarMarcadorChofer(lat, lng);
        if (estado.perfil?.rol === "cliente") setMensaje("info-mapa-texto", `🚗 ${nombre || "Chofer"} en camino…`);
      } else if (rol === "cliente") {
        actualizarMarcadorCliente(lat, lng);
        if (estado.perfil?.rol === "chofer") setMensaje("info-mapa-texto", `👤 ${nombre || "Cliente"} ubicación recibida`);
      }
      centrarMapa();
    }).subscribe((s) => console.log("[Realtime ubicación]", s));
}

// ------------------------------------------------------------
// 31) MAPA selector de DESTINO
// ------------------------------------------------------------
function abrirSelectorDestino() {
  mostrarPantalla("pantalla-mapa-recogida");
  setMensaje("info-recogida-texto", "Toca el mapa para marcar el destino exacto.");

  setTimeout(() => {
    const contenedor = document.getElementById("mapa-recogida");
    if (!contenedor) return;
    if (mapaDestino.instancia) { mapaDestino.instancia.remove(); mapaDestino.instancia = null; }
    mapaDestino.instancia = L.map(contenedor).setView([10.4806, -66.9036], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapaDestino.instancia);
    setTimeout(() => mapaDestino.instancia?.invalidateSize(), 250);

    if (mapaDestino.lat !== null && mapaDestino.lng !== null) {
      colocarMarcadorDestino(mapaDestino.lat, mapaDestino.lng);
      mapaDestino.instancia.setView([mapaDestino.lat, mapaDestino.lng], 16);
      el.btn_confirmar_recogida.disabled = false;
    } else {
      navigator.geolocation?.getCurrentPosition(
        (pos) => mapaDestino.instancia?.setView([pos.coords.latitude, pos.coords.longitude], 16), () => {});
    }

    mapaDestino.instancia.on("click", (ev) => {
      colocarMarcadorDestino(ev.latlng.lat, ev.latlng.lng);
      el.btn_confirmar_recogida.disabled = false;
      setMensaje("info-recogida-texto", `Destino: ${ev.latlng.lat.toFixed(5)}, ${ev.latlng.lng.toFixed(5)}`);
    });
  }, 150);
}

function colocarMarcadorDestino(lat, lng) {
  if (!mapaDestino.instancia) return;
  const pos = [lat, lng];
  if (mapaDestino.marcador) mapaDestino.marcador.setLatLng(pos);
  else {
    const icono = L.divIcon({ className: "", html: `<div class="marcador-recogida">🏁</div>`, iconSize: [36, 36], iconAnchor: [18, 18] });
    mapaDestino.marcador = L.marker(pos, { icon: icono }).addTo(mapaDestino.instancia);
  }
  mapaDestino.lat = lat; mapaDestino.lng = lng;
}

function confirmarDestino() {
  if (mapaDestino.lat === null || mapaDestino.lng === null) return;
  setMensaje("estado-punto-recogida", `✅ Destino marcado: ${mapaDestino.lat.toFixed(5)}, ${mapaDestino.lng.toFixed(5)}`);
  cerrarSelectorDestino();
}

function cerrarSelectorDestino() {
  if (mapaDestino.instancia) {
    mapaDestino.instancia.remove(); mapaDestino.instancia = null; mapaDestino.marcador = null;
  }
  mostrarPantalla("pantalla-nueva-solicitud");
}

// ------------------------------------------------------------
// 32) CHAT
// ------------------------------------------------------------
async function abrirChat(solicitudId) {
  const { data: sol, error } = await db.from("solicitudes").select("*").eq("id", solicitudId).single();
  if (error || !sol) return alert("No se pudo cargar la solicitud.");
  chat.solicitudId = solicitudId;

  const otroId = estado.usuario.id === sol.cliente_id ? sol.chofer_id : sol.cliente_id;
  if (otroId) {
    const { data: otro } = await db.from("perfiles").select("nombre, rol").eq("id", otroId).maybeSingle();
    chat.perfilOtro = otro || null;
    el.chat_titulo.textContent = otro?.nombre || "Chat";
  } else {
    chat.perfilOtro = null;
    el.chat_titulo.textContent = "Chat";
  }

  el.chat_mensajes.innerHTML = '<p class="vacio">Cargando...</p>';
  mostrarPantalla("pantalla-chat");
  await cargarMensajes(solicitudId);
  suscribirMensajes(solicitudId);
  setTimeout(() => el.chat_input.focus(), 200);
}

async function cargarMensajes(solicitudId) {
  const { data, error } = await db.from("mensajes").select("*")
    .eq("solicitud_id", solicitudId).order("creado_en", { ascending: true });
  if (error) { el.chat_mensajes.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  pintarMensajes(data || []);
}

function pintarMensajes(mensajes) {
  const cont = el.chat_mensajes;
  if (!mensajes || mensajes.length === 0) { cont.innerHTML = '<p class="vacio">Sé el primero en escribir…</p>'; return; }
  cont.innerHTML = "";
  mensajes.forEach((m) => cont.appendChild(renderBurbuja(m)));
  cont.scrollTop = cont.scrollHeight;
}

function renderBurbuja(m) {
  const div = document.createElement("div");
  const esMio = m.emisor_id === estado.usuario?.id;
  div.className = "burbuja " + (esMio ? "mia" : "otra");
  const hora = new Date(m.creado_en).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  div.innerHTML = `${escapar(m.contenido)}<span class="hora">${hora}</span>`;
  return div;
}

async function enviarMensaje(e) {
  e.preventDefault();
  if (!chat.solicitudId || !estado.usuario) return;
  const texto = el.chat_input.value.trim();
  if (!texto) return;
  el.chat_input.value = "";
  const { error } = await db.from("mensajes").insert({
    solicitud_id: chat.solicitudId, emisor_id: estado.usuario.id, contenido: texto,
  });
  if (error) alert("Error al enviar: " + error.message);
}

function suscribirMensajes(solicitudId) {
  if (realtime.canalChat) { db.removeChannel(realtime.canalChat); realtime.canalChat = null; }
  realtime.canalChat = db.channel("chat-" + solicitudId)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "mensajes", filter: `solicitud_id=eq.${solicitudId}` },
      () => cargarMensajes(solicitudId))
    .subscribe((s) => console.log("[Realtime chat]", s));
}

function cerrarChat() {
  if (realtime.canalChat) { db.removeChannel(realtime.canalChat); realtime.canalChat = null; }
  chat.solicitudId = null; chat.perfilOtro = null;
  if (estado.perfil?.rol === "chofer") { mostrarPantalla("pantalla-mis-servicios"); cargarMisServicios(); }
  else { mostrarPantalla("pantalla-mis-solicitudes"); cargarMisSolicitudes(); }
}

// ------------------------------------------------------------
// 33) OFERTAS
// ------------------------------------------------------------
async function abrirFormOferta(solicitudId) {
  if (!estado.usuario) return;
  const { data: activos, error: errAct } = await db.from("solicitudes").select("id")
    .eq("chofer_id", estado.usuario.id)
    .in("estado", ["aceptado","en_camino","llego","en_curso"]).limit(1);
  if (errAct) return alert("Error verificando servicios activos: " + errAct.message);
  if (activos && activos.length > 0) {
    alert("Ya tienes un servicio activo. Finalízalo o cancélalo antes de ofertar en otro.");
    return;
  }

  const { data: sol, error } = await db.from("solicitudes").select("*").eq("id", solicitudId).single();
  if (error || !sol) return alert("No se pudo cargar la solicitud.");

  oferta.solicitudId = solicitudId;
  limpiarMensajes();

  el.oferta_resumen.innerHTML = `
    <p class="ruta"><span class="etiqueta">De:</span> ${escapar(sol.origen)}</p>
    <p class="ruta"><span class="etiqueta">A:</span> ${escapar(sol.destino)}</p>
    ${sol.presupuesto != null ? `<p class="ruta"><span class="etiqueta">Sugerido:</span> $${Number(sol.presupuesto).toFixed(2)}</p>` : ""}
    ${sol.notas ? `<p class="ruta" style="font-style:italic;color:#6b7280">"${escapar(sol.notas)}"</p>` : ""}
  `;
  el.oferta_monto.value = sol.presupuesto != null ? sol.presupuesto : "";
  el.oferta_mensaje.value = "";
  mostrarPantalla("pantalla-oferta");
}

async function enviarOferta(e) {
  e.preventDefault();
  limpiarMensajes();
  if (!oferta.solicitudId || !estado.usuario) return;

  const monto = Number(el.oferta_monto.value);
  const mensaje = el.oferta_mensaje.value.trim() || null;
  if (!monto || monto <= 0) return setMensaje("oferta-error", "Monto inválido.");

  const boton = el.form_oferta.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Enviar oferta");

  const { error } = await db.from("ofertas").insert({
    solicitud_id: oferta.solicitudId, chofer_id: estado.usuario.id, monto, mensaje, estado: "pendiente",
  });

  setBotonCargando(boton, false, "Enviar oferta");
  if (error) return setMensaje("oferta-error", traducirError(error.message));

  setMensaje("oferta-exito", "Oferta enviada ✔");
  setTimeout(() => {
    mostrarPantalla("pantalla-solicitudes-disponibles");
    cargarSolicitudesDisponibles();
  }, 900);
}

async function abrirVerOfertas(solicitudId) {
  oferta.solicitudId = solicitudId;
  mostrarPantalla("pantalla-ver-ofertas");
  await cargarOfertas(solicitudId);
  suscribirOfertas(solicitudId);
}

async function cargarOfertas(solicitudId) {
  const cont = el.lista_ofertas;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.from("ofertas")
    .select("*, chofer:chofer_id ( id, nombre, foto_url )")
    .eq("solicitud_id", solicitudId).order("creado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="vacio">Aún no hay ofertas. Vuelve en un momento.</p>';
    return;
  }

  const { data: sol } = await db.from("solicitudes")
    .select("estado, chofer_id, precio_final").eq("id", solicitudId).maybeSingle();

  cont.innerHTML = "";
  data.forEach((of) => cont.appendChild(renderTarjetaOferta(of, sol)));
}

function renderTarjetaOferta(of, sol) {
  const card = document.createElement("div");
  card.className = "tarjeta-oferta";

  const foto = of.chofer?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='20' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const nombre = of.chofer?.nombre || "Chofer";
  let estadoMostrar = of.estado;
  if (sol?.chofer_id === of.chofer_id && sol?.estado !== "pendiente") estadoMostrar = "aceptada";
  const puedeActuar = of.estado === "pendiente" && sol?.estado === "pendiente";

  card.innerHTML = `
    <div class="fila-superior">
      <div class="chofer-info">
        <img src="${foto}" alt="${escapar(nombre)}" />
        <div>
          <div class="nombre">${escapar(nombre)}</div>
          <span class="badge-oferta ${estadoMostrar}">${estadoMostrar}</span>
        </div>
      </div>
      <div class="monto">$${Number(of.monto).toFixed(2)}</div>
    </div>
    ${of.mensaje ? `<div class="mensaje">"${escapar(of.mensaje)}"</div>` : ""}
    <div class="meta"><span>${formatearFecha(of.creado_en)}</span></div>
    <div class="acciones-tarjeta">
      <button class="btn-ver-perfil" data-ver-perfil="${of.chofer_id}">👤 Ver perfil del chofer</button>
    </div>
    ${
      puedeActuar
        ? `<div class="acciones-tarjeta">
             <button class="btn-aceptar" data-aceptar-of="${of.id}">Aceptar</button>
             <button class="btn-cancelar" data-rechazar-of="${of.id}">Rechazar</button>
           </div>`
        : ""
    }
  `;

  card.querySelector("[data-aceptar-of]")?.addEventListener("click", (ev) =>
    aceptarOfertaRpc(ev.target.getAttribute("data-aceptar-of")));
  card.querySelector("[data-rechazar-of]")?.addEventListener("click", (ev) =>
    rechazarOferta(ev.target.getAttribute("data-rechazar-of")));
  card.querySelector("[data-ver-perfil]")?.addEventListener("click", (ev) =>
    abrirPerfilPublico(ev.target.getAttribute("data-ver-perfil")));
  return card;
}

async function aceptarOfertaRpc(ofertaId) {
  if (!confirm("¿Aceptar esta oferta? Se asignará el chofer y el precio.")) return;
  const { error } = await db.rpc("aceptar_oferta", { p_oferta_id: ofertaId });
  if (error) return alert("Error al aceptar oferta: " + error.message);
  alert("¡Oferta aceptada! El chofer fue asignado.");
  if (oferta.solicitudId) await cargarOfertas(oferta.solicitudId);
}

async function rechazarOferta(ofertaId) {
  if (!confirm("¿Rechazar esta oferta?")) return;
  const { error } = await db.from("ofertas").update({ estado: "rechazada" }).eq("id", ofertaId);
  if (error) return alert("Error al rechazar: " + error.message);
  if (oferta.solicitudId) await cargarOfertas(oferta.solicitudId);
}

function suscribirOfertas(solicitudId) {
  if (realtime.canalOfertas) { db.removeChannel(realtime.canalOfertas); realtime.canalOfertas = null; }
  realtime.canalOfertas = db.channel("ofertas-live-" + solicitudId)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "ofertas", filter: `solicitud_id=eq.${solicitudId}` },
      () => cargarOfertas(solicitudId))
    .subscribe((s) => console.log("[Realtime ofertas]", s));
}

// ------------------------------------------------------------
// 34) CALIFICACIONES
// ------------------------------------------------------------
async function abrirCalificar(solicitudId, receptorId) {
  if (!estado.usuario) return;
  if (estado.calificacionesHechas.has(solicitudId)) return abrirVerCalificacion(solicitudId);
  calificacion.solicitudId = solicitudId;
  calificacion.receptorId = receptorId;
  calificacion.estrellas = 0;
  limpiarMensajes();

  const { data: receptor } = await db.from("perfiles").select("nombre, foto_url").eq("id", receptorId).maybeSingle();
  calificacion.receptorNombre = receptor?.nombre || "Usuario";
  calificacion.receptorFoto = receptor?.foto_url || null;

  const foto = calificacion.receptorFoto || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='22' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";

  el.calificar_titulo.textContent = `¿Cómo estuvo el servicio con ${calificacion.receptorNombre}?`;
  el.calificar_destinatario.innerHTML = `
    <div class="destinatario">
      <img src="${foto}" alt="Foto" />
      <div><div class="nombre">${escapar(calificacion.receptorNombre)}</div></div>
    </div>
  `;
  el.calificar_comentario.value = "";
  actualizarEstrellasUI(0);
  mostrarPantalla("pantalla-calificar");
}

function seleccionarEstrellas(valor) { calificacion.estrellas = valor; actualizarEstrellasUI(valor); }

function actualizarEstrellasUI(valor) {
  document.querySelectorAll("#estrellas-contenedor .estrella").forEach((btn) => {
    const v = Number(btn.getAttribute("data-valor"));
    btn.classList.toggle("activa", v <= valor);
  });
  const textos = { 0: "Toca para calificar", 1: "Muy malo 😞", 2: "Malo 😕", 3: "Regular 😐", 4: "Bueno 🙂", 5: "Excelente 🤩" };
  setMensaje("estrellas-texto", textos[valor] || "Toca para calificar");
}

async function enviarCalificacion(e) {
  e.preventDefault();
  limpiarMensajes();
  if (!calificacion.solicitudId || !calificacion.receptorId || !estado.usuario) return;
  if (calificacion.estrellas < 1 || calificacion.estrellas > 5)
    return setMensaje("calificar-error", "Selecciona de 1 a 5 estrellas.");

  const comentario = el.calificar_comentario.value.trim() || null;
  const boton = el.form_calificar.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Enviar calificación");

  const { error } = await db.from("calificaciones").insert({
    solicitud_id: calificacion.solicitudId,
    emisor_id: estado.usuario.id,
    receptor_id: calificacion.receptorId,
    estrellas: calificacion.estrellas,
    comentario,
  });

  setBotonCargando(boton, false, "Enviar calificación");
  if (error) {
    if (error.message.toLowerCase().includes("duplicate"))
      return setMensaje("calificar-error", "Ya calificaste este servicio.");
    return setMensaje("calificar-error", traducirError(error.message));
  }
  estado.calificacionesHechas.add(calificacion.solicitudId);
  setMensaje("calificar-exito", "¡Gracias por tu calificación! ⭐");
  setTimeout(() => volverDeCalificar(), 1000);
}

async function abrirVerCalificacion(solicitudId) {
  if (!estado.usuario) return;
  const { data: c, error } = await db.from("calificaciones")
    .select("*, receptor:receptor_id ( nombre, foto_url )")
    .eq("solicitud_id", solicitudId).eq("emisor_id", estado.usuario.id).maybeSingle();
  if (error || !c) return alert("No se encontró la calificación.");

  const foto = c.receptor?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='22' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const estrellasStr = "★".repeat(c.estrellas) + "☆".repeat(5 - c.estrellas);

  el.ver_calificacion_contenido.innerHTML = `
    <div class="tarjeta-calificacion">
      <div class="destinatario">
        <img src="${foto}" alt="Foto" />
        <div>
          <div class="nombre">${escapar(c.receptor?.nombre || "Usuario")}</div>
          <div class="texto-ayuda">${formatearFecha(c.creado_en)}</div>
        </div>
      </div>
      <div class="estrellas-ver">${estrellasStr}</div>
      ${c.comentario ? `<div class="comentario">"${escapar(c.comentario)}"</div>` : ""}
    </div>
  `;
  mostrarPantalla("pantalla-ver-calificacion");
}

function volverDeCalificar() {
  calificacion.solicitudId = null; calificacion.receptorId = null; calificacion.estrellas = 0;
  if (estado.perfil?.rol === "chofer") { mostrarPantalla("pantalla-mis-servicios"); cargarMisServicios(); }
  else { mostrarPantalla("pantalla-mis-solicitudes"); cargarMisSolicitudes(); }
}

// ============================================================
// 35) REPORTES
// ============================================================
function abrirPantallaReportar(receptorId, solicitudId) {
  if (!receptorId) return alert("No se pudo identificar al usuario.");
  if (receptorId === estado.usuario?.id) return alert("No puedes reportarte a ti mismo.");

  estado.reportarReceptorId = receptorId;
  estado.reportarSolicitudId = solicitudId || null;
  limpiarMensajes();
  el.form_reportar?.reset();

  db.from("perfiles").select("nombre, foto_url, rol").eq("id", receptorId).maybeSingle().then(({ data }) => {
    const foto = data?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='22' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
    el.reportar_destinatario.innerHTML = `
      <div class="destinatario">
        <img src="${foto}" alt="Foto" />
        <div>
          <div class="nombre">${escapar(data?.nombre || "Usuario")}</div>
          <div class="texto-ayuda">${escapar((data?.rol || "").toUpperCase())}</div>
        </div>
      </div>
    `;
  });
  mostrarPantalla("pantalla-reportar");
}

async function enviarReporte(e) {
  e.preventDefault();
  limpiarMensajes();
  if (!estado.reportarReceptorId || !estado.usuario) return;

  const categoria = el.reportar_categoria.value;
  const descripcion = el.reportar_descripcion.value.trim();
  if (!categoria) return setMensaje("reportar-error", "Selecciona un motivo.");
  if (descripcion.length < 10) return setMensaje("reportar-error", "La descripción debe tener al menos 10 caracteres.");

  const boton = el.form_reportar.querySelector("button[type=submit]");
  setBotonCargando(boton, true, "Enviando...");

  const { error } = await db.rpc("crear_reporte", {
    p_receptor_id: estado.reportarReceptorId,
    p_categoria: categoria,
    p_descripcion: descripcion,
    p_solicitud_id: estado.reportarSolicitudId,
  });

  setBotonCargando(boton, false, "Enviar reporte");
  if (error) return setMensaje("reportar-error", traducirError(error.message));

  setMensaje("reportar-exito", "✅ Reporte enviado. Un administrador lo revisará pronto.");
  setTimeout(() => {
    el.form_reportar.reset();
    estado.reportarReceptorId = null;
    estado.reportarSolicitudId = null;
    mostrarPantalla("pantalla-perfil");
  }, 1500);
}

async function cargarMisReportes() {
  const cont = el.lista_mis_reportes;
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const esEnviados = estado.filtroMisReportes === "enviados";
  const campoFiltro = esEnviados ? "emisor_id" : "receptor_id";
  const campoJoin = esEnviados ? "receptor_id" : "emisor_id";

  const { data, error } = await db.from("reportes")
    .select(`*, otro:${campoJoin} ( id, nombre, foto_url )`)
    .eq(campoFiltro, estado.usuario.id)
    .order("creado_en", { ascending: false }).limit(50);

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`; return; }
  if (!data || data.length === 0) {
    cont.innerHTML = `<p class="vacio">${esEnviados ? "No has hecho reportes." : "No te han reportado."}</p>`;
    return;
  }

  cont.innerHTML = "";
  data.forEach((r) => cont.appendChild(renderTarjetaReporte(r, esEnviados)));
}

function renderTarjetaReporte(r, esEnviadoPorMi) {
  const card = document.createElement("div");
  card.className = "tarjeta-reporte";

  const foto = r.otro?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='42' height='42'><rect width='42' height='42' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='20' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const nombre = r.otro?.nombre || "Usuario";
  const catTexto = CATEGORIAS_REPORTE[r.categoria] || r.categoria;

  let respuestaHTML = "";
  if (r.respuesta_reportado) {
    respuestaHTML = `
      <div class="respuesta">
        <strong>Respuesta del reportado</strong>
        "${escapar(r.respuesta_reportado)}"
      </div>`;
  }

  let resolucionHTML = "";
  if (r.estado === "resuelto" || r.estado === "desestimado") {
    const acc = ACCIONES_REPORTE[r.accion_tomada] || r.accion_tomada || "";
    resolucionHTML = `
      <div class="resolucion">
        <span class="accion">${escapar(acc)}</span>
        ${r.motivo_admin ? escapar(r.motivo_admin) : ""}
      </div>`;
  }

  let botonResponderHTML = "";
  if (!esEnviadoPorMi && (r.estado === "pendiente" || r.estado === "en_revision") && !r.respuesta_reportado) {
    botonResponderHTML = `<button class="btn-responder-reporte" data-responder="${r.id}">✍️ Escribir mi versión</button>`;
  }

  card.innerHTML = `
    <div class="cabecera">
      <div class="usuario-info">
        <img src="${foto}" alt="Foto" />
        <div>
          <div class="nombre">${esEnviadoPorMi ? "Reportaste a " : "Reportado por "}${escapar(nombre)}</div>
          <div class="fecha">${formatearFecha(r.creado_en)}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge-categoria ${r.categoria}">${escapar(catTexto)}</span>
        <span class="badge-estado-reporte ${r.estado}">${escapar(r.estado.replace("_", " "))}</span>
      </div>
    </div>
    <div class="descripcion">${escapar(r.descripcion)}</div>
    ${respuestaHTML}
    ${resolucionHTML}
    ${botonResponderHTML}
  `;

  card.querySelector("[data-responder]")?.addEventListener("click", (ev) =>
    abrirResponderReporte(ev.target.getAttribute("data-responder")));
  return card;
}

async function abrirResponderReporte(reporteId) {
  const respuesta = prompt("Escribe tu versión de los hechos.\n\nEl administrador la leerá antes de tomar una decisión:");
  if (respuesta === null) return;
  if (respuesta.trim().length < 5) return alert("La respuesta es demasiado corta.");

  const { error } = await db.rpc("responder_reporte", {
    p_reporte_id: reporteId, p_respuesta: respuesta.trim(),
  });
  if (error) return alert("Error: " + error.message);
  alert("✅ Tu respuesta fue enviada al administrador.");
  cargarMisReportes();
}

async function cargarMisAdvertencias() {
  const cont = el.lista_advertencias;
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.from("advertencias")
    .select("*").eq("usuario_id", estado.usuario.id)
    .order("creado_en", { ascending: false }).limit(100);

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`; return; }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="vacio">🎉 No tienes advertencias. ¡Sigue así!</p>';
    return;
  }

  cont.innerHTML = "";
  data.forEach((a) => cont.appendChild(renderTarjetaAdvertencia(a)));

  const noLeidas = data.filter((a) => !a.leida).map((a) => a.id);
  if (noLeidas.length > 0) {
    setTimeout(async () => {
      await db.from("advertencias").update({ leida: true }).in("id", noLeidas);
      await actualizarBadgeAdvertencias();
    }, 2000);
  }
}

function renderTarjetaAdvertencia(a) {
  const card = document.createElement("div");
  card.className = "tarjeta-advertencia" + (a.leida ? "" : " no-leida");
  card.innerHTML = `
    <div class="cabecera">
      <div class="motivo">${escapar(a.motivo)}</div>
      ${!a.leida ? `<span class="indicador-nueva">Nueva</span>` : ""}
    </div>
    ${a.descripcion ? `<div class="descripcion">${escapar(a.descripcion)}</div>` : ""}
    <div class="fecha">${formatearFecha(a.creado_en)}</div>
  `;
  return card;
}

// ============================================================
// 36) PLAN CLIENTE PREMIUM
// ============================================================
async function cargarPlanPremium() {
  if (!estado.usuario) return;

  setMensaje("premium-error", "");
  setMensaje("premium-exito", "");

  const { data: saldoRow } = await db.from("saldos").select("monto")
    .eq("usuario_id", estado.usuario.id).maybeSingle();
  const saldo = Number(saldoRow?.monto || 0);

  const { data: cfg } = await db.from("configuracion").select("valor")
    .eq("clave", "precio_plan_cliente").maybeSingle();
  const precio = Number(cfg?.valor || 100);

  const { data: plan } = await db.from("planes_cliente").select("*")
    .eq("cliente_id", estado.usuario.id).eq("estado", "activo")
    .gt("fecha_vencimiento", new Date().toISOString())
    .order("fecha_vencimiento", { ascending: false }).maybeSingle();

  estado.planPremium = plan || null;
  estado.esPremium = !!plan;

  if (el.premium_mi_saldo) el.premium_mi_saldo.textContent = "$" + saldo.toFixed(2);
  if (el.premium_precio)   el.premium_precio.textContent   = "$" + precio.toFixed(2);

  const cardEstado = el.premium_estado_card;
  const titulo = el.premium_estado_titulo;
  const texto  = el.premium_estado_texto;
  const boton  = el.btn_comprar_premium;

  if (plan) {
    const venc = new Date(plan.fecha_vencimiento);
    const dias = Math.ceil((venc - new Date()) / 86400000);
    cardEstado?.classList.add("activo");
    if (titulo) titulo.textContent = "¡Eres Premium!";
    if (texto)  texto.textContent = `Tu plan vence en ${dias} día${dias === 1 ? "" : "s"} (${venc.toLocaleDateString("es-ES")}). Puedes renovar para extender.`;
    if (boton) {
      boton.textContent = "🔄 Renovar 30 días más";
      boton.disabled = saldo < precio;
    }
  } else {
    cardEstado?.classList.remove("activo");
    if (titulo) titulo.textContent = "Hazte Premium";
    if (texto)  texto.textContent = `Desbloquea todos los beneficios por $${precio.toFixed(2)} al mes.`;
    if (boton) {
      boton.textContent = "⭐ Activar Plan Premium";
      boton.disabled = saldo < precio;
    }
  }

  if (saldo < precio && !plan) {
    setMensaje("premium-error",
      `Saldo insuficiente. Necesitas $${precio.toFixed(2)} y tienes $${saldo.toFixed(2)}.`);
  }
}

async function comprarPlanPremium() {
  if (!estado.usuario) return;
  setMensaje("premium-error", "");
  setMensaje("premium-exito", "");

  const btn = el.btn_comprar_premium;
  const original = btn?.textContent || "Activar";

  if (estado.esPremium) {
    if (!confirm("¿Renovar 30 días más de Plan Premium?")) return;
  } else {
    if (!confirm("¿Activar el Plan Premium por $100? Se descontará de tu saldo.")) return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Procesando..."; }

  const { data, error } = await db.rpc("pagar_plan_cliente_con_saldo");

  if (btn) { btn.disabled = false; btn.textContent = original; }

  if (error) {
    return setMensaje("premium-error", traducirError(error.message));
  }

  setMensaje("premium-exito", "✅ Plan Premium activado. ¡Disfruta los beneficios!");
  await cargarPlanPremium();
  pintarBannerPremium();
}

// ============================================================
// 37) PANEL ADMIN (integrado en index.html)
// ============================================================
async function cargarMetricasAdmin() {
  if (estado.perfil?.rol !== "admin") return;

  const { count: usuarios } = await db.from("perfiles").select("*", { count: "exact", head: true });
  const { count: choferes } = await db.from("perfiles").select("*", { count: "exact", head: true }).eq("rol", "chofer");
  const { count: activos } = await db.from("suscripciones").select("*", { count: "exact", head: true })
    .eq("estado", "activa").gt("fecha_vencimiento", new Date().toISOString());
  const { count: solicitudes } = await db.from("solicitudes").select("*", { count: "exact", head: true });
  const { count: completados } = await db.from("solicitudes").select("*", { count: "exact", head: true }).eq("estado", "completado");
  const { data: pagos } = await db.from("pagos").select("monto");
  const ingresos = (pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);

  el.m_usuarios.textContent = usuarios ?? "—";
  el.m_choferes.textContent = choferes ?? "—";
  el.m_activos.textContent = activos ?? "—";
  el.m_solicitudes.textContent = solicitudes ?? "—";
  el.m_completados.textContent = completados ?? "—";
  el.m_ingresos.textContent = "$" + ingresos.toFixed(2);
}

async function cargarUsuariosAdmin() {
  if (estado.perfil?.rol !== "admin") return;
  const cont = el.lista_admin_usuarios;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.from("perfiles")
    .select(`id, nombre, telefono, rol, foto_url, creado_en, estado_cuenta,
      suscripciones ( id, estado, fecha_vencimiento, monto )`)
    .order("creado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  estado.usuariosAdmin = data || [];
  renderUsuariosAdmin();
}

function renderUsuariosAdmin() {
  const cont = el.lista_admin_usuarios;
  const filtro = estado.filtroAdminUsuarios;
  let lista = estado.usuariosAdmin;
  if (filtro !== "todos") lista = lista.filter((u) => u.rol === filtro);
  if (lista.length === 0) { cont.innerHTML = '<p class="vacio">Sin usuarios con ese filtro.</p>'; return; }

  cont.innerHTML = "";
  lista.forEach((u) => cont.appendChild(renderTarjetaAdminUsuario(u)));
}

function renderTarjetaAdminUsuario(u) {
  const card = document.createElement("div");
  card.className = "tarjeta-admin";

  const foto = u.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46'><rect width='46' height='46' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='22' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const hoy = new Date();
  const suscActiva = (u.suscripciones || []).find((s) => s.estado === "activa" && new Date(s.fecha_vencimiento) > hoy);

  let estadoSuscHTML = `<span class="estado-suscripcion sin">Sin suscripción</span>`;
  if (suscActiva) {
    const venc = new Date(suscActiva.fecha_vencimiento);
    const dias = Math.ceil((venc - hoy) / 86400000);
    estadoSuscHTML = `<span class="estado-suscripcion activa">Activa · ${dias} día${dias === 1 ? "" : "s"}</span>`;
  } else if ((u.suscripciones || []).length > 0) {
    estadoSuscHTML = `<span class="estado-suscripcion expirada">Expirada</span>`;
  }

  let accionesHTML = "";
  if (u.rol === "chofer") {
    accionesHTML = `
      <div class="acciones-tarjeta">
        <button class="btn-otorgar" data-otorgar="${u.id}">➕ Otorgar 30 días</button>
        ${suscActiva ? `<button class="btn-revocar" data-revocar="${u.id}">🗑 Revocar</button>` : ""}
      </div>`;
  }

  card.innerHTML = `
    <div class="fila-superior">
      <img src="${foto}" alt="Foto" />
      <div class="info">
        <div class="nombre">${escapar(u.nombre || "Sin nombre")}</div>
        <div class="email">${escapar(u.rol.toUpperCase())} · ${escapar(u.telefono ? PREFIJO_TELEFONO + u.telefono : "sin tel.")}</div>
      </div>
    </div>
    ${u.rol === "chofer" ? estadoSuscHTML : ""}
    ${accionesHTML}
  `;

  card.querySelector("[data-otorgar]")?.addEventListener("click", (ev) =>
    otorgarSuscripcion(ev.target.getAttribute("data-otorgar")));
  card.querySelector("[data-revocar]")?.addEventListener("click", (ev) =>
    revocarSuscripcion(ev.target.getAttribute("data-revocar")));
  return card;
}

async function otorgarSuscripcion(choferId) {
  const { data: cfg } = await db.from("configuracion").select("valor").eq("clave", "precio_suscripcion").maybeSingle();
  const precioSugerido = cfg?.valor || "10.00";
  const monto = prompt("Monto recibido ($):", precioSugerido);
  if (monto === null) return;
  const metodo = prompt("Método (efectivo / transferencia / otro):", "efectivo");
  if (metodo === null) return;
  const notas = prompt("Notas (opcional):", "") || null;

  const { error } = await db.rpc("otorgar_suscripcion", {
    p_chofer_id: choferId, p_dias: 30,
    p_monto: Number(monto) || 0, p_metodo: metodo || "efectivo", p_notas: notas,
  });
  if (error) return alert("Error: " + error.message);
  alert("Suscripción otorgada por 30 días ✅");
  cargarUsuariosAdmin();
}

async function revocarSuscripcion(choferId) {
  if (!confirm("¿Revocar la suscripción activa de este chofer?")) return;
  const { error } = await db.rpc("revocar_suscripcion", { p_chofer_id: choferId });
  if (error) return alert("Error: " + error.message);
  alert("Suscripción revocada.");
  cargarUsuariosAdmin();
}

async function cargarSolicitudesAdmin() {
  if (estado.perfil?.rol !== "admin") return;
  const cont = el.lista_admin_solicitudes;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.from("solicitudes").select("*")
    .order("creado_en", { ascending: false }).limit(100);
  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  if (!data || data.length === 0) { cont.innerHTML = '<p class="vacio">Sin solicitudes.</p>'; return; }

  cont.innerHTML = "";
  data.forEach((s) => {
    const card = renderTarjetaSolicitud(s, "admin-lectura");
    card.querySelectorAll(".acciones-tarjeta").forEach((a) => a.remove());
    cont.appendChild(card);
  });
}

async function cargarPrecioAdmin() {
  const { data } = await db.from("configuracion").select("clave, valor")
    .in("clave", ["tasa_usdt_saldo","precio_saldo_1mes","precio_saldo_3meses",
      "precio_saldo_6meses","precio_saldo_12meses"]);
  const cfg = {};
  (data || []).forEach((c) => { cfg[c.clave] = c.valor; });

  el.admin_tasa_input.value = cfg["tasa_usdt_saldo"] || "1.00";
  el.admin_plan_1.value = cfg["precio_saldo_1mes"] || "200.00";
  el.admin_plan_3.value = cfg["precio_saldo_3meses"] || "700.00";
  el.admin_plan_6.value = cfg["precio_saldo_6meses"] || "1200.00";
  el.admin_plan_12.value = cfg["precio_saldo_12meses"] || "2000.00";

  setMensaje("admin-precio-exito", "");
  setMensaje("admin-precio-error", "");
}

async function guardarPrecioAdmin(e) {
  e.preventDefault();
  limpiarMensajes();

  const tasa = Number(el.admin_tasa_input.value);
  const p1 = Number(el.admin_plan_1.value);
  const p3 = Number(el.admin_plan_3.value);
  const p6 = Number(el.admin_plan_6.value);
  const p12 = Number(el.admin_plan_12.value);

  if (!tasa || tasa <= 0) return setMensaje("admin-precio-error", "Tasa USDT inválida.");
  if (p1 < 0 || p3 < 0 || p6 < 0 || p12 < 0)
    return setMensaje("admin-precio-error", "Los precios no pueden ser negativos.");

  const boton = el.form_admin_precio.querySelector("button[type=submit]");
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Guardando...";

  const { error } = await db.from("configuracion").upsert([
    { clave: "tasa_usdt_saldo", valor: tasa.toFixed(2) },
    { clave: "precio_saldo_1mes", valor: p1.toFixed(2) },
    { clave: "precio_saldo_3meses", valor: p3.toFixed(2) },
    { clave: "precio_saldo_6meses", valor: p6.toFixed(2) },
    { clave: "precio_saldo_12meses", valor: p12.toFixed(2) },
  ]);

  boton.disabled = false;
  boton.textContent = textoOriginal;

  if (error) return setMensaje("admin-precio-error", error.message);
  setMensaje("admin-precio-exito", "✅ Cambios guardados.");
}

async function cargarPagosAdmin() {
  if (estado.perfil?.rol !== "admin") return;
  const cont = el.lista_admin_pagos;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db.from("solicitudes_pago")
    .select(`*, chofer:chofer_id ( id, nombre, telefono, foto_url )`)
    .order("creado_en", { ascending: false }).limit(150);

  if (error) { cont.innerHTML = `<p class="vacio">Error: ${error.message}</p>`; return; }
  estado.pagosAdmin = data || [];
  renderPagosAdmin();
}

function renderPagosAdmin() {
  const cont = el.lista_admin_pagos;
  const filtro = estado.filtroAdminPagos;
  let lista = estado.pagosAdmin;
  if (filtro !== "todas") lista = lista.filter((p) => p.estado === filtro);
  if (lista.length === 0) { cont.innerHTML = '<p class="vacio">Sin solicitudes en este filtro.</p>'; return; }

  cont.innerHTML = "";
  lista.forEach((p) => cont.appendChild(renderTarjetaPagoAdmin(p)));
}

function renderTarjetaPagoAdmin(p) {
  const card = document.createElement("div");
  card.className = "tarjeta-admin";

  const foto = p.chofer?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46'><rect width='46' height='46' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='22' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const metodos = { transferencia: "🏦 Transferencia", pago_movil: "📱 Pago móvil", efectivo: "💵 Efectivo", cripto: "₿ Cripto" };
  const puedeActuar = p.estado === "pendiente";

  card.innerHTML = `
    <div class="fila-superior">
      <img src="${foto}" alt="Foto" />
      <div class="info">
        <div class="nombre">${escapar(p.chofer?.nombre || "Chofer")}</div>
        <div class="email">${escapar(metodos[p.metodo] || p.metodo)} · Recarga</div>
      </div>
      <span class="badge-estado-pago ${p.estado}">${p.estado}</span>
    </div>
    <div class="meta" style="font-size:0.85rem;color:#374151"><strong>Monto que pagó:</strong> $${Number(p.monto).toFixed(2)}</div>
    ${p.referencia ? `<div class="meta" style="font-size:0.85rem;color:#374151"><strong>Ref:</strong> ${escapar(p.referencia)}</div>` : ""}
    ${p.notas_chofer ? `<div class="nota-admin">"${escapar(p.notas_chofer)}"</div>` : ""}
    <div class="meta" style="font-size:0.75rem;color:#9ca3af">${formatearFecha(p.creado_en)}</div>
    ${p.comprobante_url ? `<a href="${escapar(p.comprobante_url)}" target="_blank" rel="noopener" class="btn-ver-comprobante">🖼 Ver comprobante</a>` : ""}
    ${p.notas_admin ? `<div class="nota-admin">Admin: ${escapar(p.notas_admin)}</div>` : ""}
    ${
      puedeActuar
        ? `<div class="acciones-tarjeta">
             <button class="btn-otorgar" data-aprobar="${p.id}">✅ Aprobar y acreditar</button>
             <button class="btn-revocar" data-rechazar="${p.id}">✖ Rechazar</button>
           </div>`
        : ""
    }
  `;

  card.querySelector("[data-aprobar]")?.addEventListener("click", (ev) =>
    aprobarPagoAdmin(ev.target.getAttribute("data-aprobar")));
  card.querySelector("[data-rechazar]")?.addEventListener("click", (ev) =>
    rechazarPagoAdmin(ev.target.getAttribute("data-rechazar")));
  return card;
}

async function aprobarPagoAdmin(solicitudId) {
  const sol = estado.pagosAdmin.find((p) => p.id === solicitudId);
  if (!sol) return alert("Solicitud no encontrada.");
  const sugerido = Number(sol.monto || 0);
  const montoStr = prompt(
    "¿Cuánto saldo deseas acreditar a este chofer?\n\n(El chofer pagó: $" + sugerido.toFixed(2) + ")",
    sugerido.toFixed(2));
  if (montoStr === null) return;
  const monto = Number(montoStr);
  if (!monto || monto <= 0) return alert("Monto inválido.");
  const notas = prompt("Notas para el chofer (opcional):", "") || null;
  if (!confirm(`¿Confirmas acreditar $${monto.toFixed(2)} a ${sol.chofer?.nombre || "este chofer"}?`)) return;

  const { error } = await db.rpc("aprobar_recarga_manual", {
    p_solicitud_id: solicitudId, p_monto_saldo: monto, p_notas_admin: notas,
  });
  if (error) return alert("Error: " + error.message);
  alert(`✅ Saldo acreditado: $${monto.toFixed(2)}`);
  cargarPagosAdmin();
}

async function rechazarPagoAdmin(solicitudId) {
  const nota = prompt("Motivo del rechazo (opcional):", "") || null;
  if (!confirm("¿Rechazar esta solicitud?")) return;
  const { error } = await db.rpc("rechazar_solicitud_pago", {
    p_solicitud_id: solicitudId, p_notas_admin: nota,
  });
  if (error) return alert("Error: " + error.message);
  alert("Solicitud rechazada.");
  cargarPagosAdmin();
}

// ============================================================
// 38) PERFIL PÚBLICO
// ============================================================
async function abrirPerfilPublico(usuarioId) {
  if (!usuarioId) return;
  estado.origenPerfilPublico = document.querySelector(".pantalla.activa")?.id || "pantalla-perfil";

  el.pp_resenas.innerHTML = '<p class="vacio">Cargando...</p>';
  el.pp_nombre.textContent = "—";
  el.pp_rol.textContent = "—";
  if (el.pp_telefono) el.pp_telefono.textContent = "";
  if (el.pp_ubicacion) el.pp_ubicacion.textContent = "";
  el.pp_promedio.textContent = "0.0";
  el.pp_estrellas_visual.textContent = "☆☆☆☆☆";
  el.pp_total.textContent = "Sin calificaciones aún";
  el.pp_miembro.textContent = "";

  el.btn_reportar_desde_perfil?.setAttribute("data-receptor-id", usuarioId);
  mostrarPantalla("pantalla-perfil-publico");

  const { data: perfil, error: errPerfil } = await db.rpc("obtener_perfil_publico", { p_usuario_id: usuarioId });
  if (errPerfil) { el.pp_resenas.innerHTML = `<p class="vacio">Error: ${errPerfil.message}</p>`; return; }

  const p = Array.isArray(perfil) ? perfil[0] : perfil;
  if (!p) { el.pp_resenas.innerHTML = '<p class="vacio">Perfil no encontrado.</p>'; return; }

  const foto = p.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='%23e5e7eb'/><text x='50%25' y='55%25' font-size='60' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  el.pp_foto.src = foto;
  el.pp_nombre.textContent = p.nombre || "Sin nombre";
  el.pp_rol.textContent = (p.rol || "usuario").toUpperCase();

  if (el.pp_telefono && p.telefono) {
    el.pp_telefono.textContent = `📞 ${PREFIJO_TELEFONO} ${p.telefono}`;
  }
  if (el.pp_ubicacion && p.provincia) {
    el.pp_ubicacion.textContent = `📍 ${p.municipio || ""}${p.municipio && p.provincia ? ", " : ""}${p.provincia}`;
  }

  const promedio = Number(p.promedio) || 0;
  const total = Number(p.total) || 0;

  el.pp_promedio.textContent = promedio.toFixed(1);
  el.pp_estrellas_visual.textContent = dibujarEstrellas(promedio);
  el.pp_total.textContent = total > 0 ? `${total} calificación${total === 1 ? "" : "es"}` : "Sin calificaciones aún";
  el.pp_miembro.textContent = p.creado_en
    ? `Miembro desde ${new Date(p.creado_en).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}` : "";

  const { data: resenas, error: errRes } = await db.rpc("obtener_resenas_usuario", { p_usuario_id: usuarioId, p_limite: 30 });
  if (errRes) { el.pp_resenas.innerHTML = `<p class="vacio">Error: ${errRes.message}</p>`; return; }
  if (!resenas || resenas.length === 0) { el.pp_resenas.innerHTML = '<p class="vacio">Aún no tiene reseñas.</p>'; return; }

  el.pp_resenas.innerHTML = "";
  resenas.forEach((r) => el.pp_resenas.appendChild(renderResena(r)));
}
window.abrirPerfilPublico = abrirPerfilPublico;

function dibujarEstrellas(promedio) {
  const llenas = Math.round(promedio);
  return "★".repeat(llenas) + "☆".repeat(Math.max(0, 5 - llenas));
}

function renderResena(r) {
  const div = document.createElement("div");
  div.className = "resena-item";
  const foto = r.emisor_foto || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='38' height='38'><rect width='38' height='38' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='18' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  div.innerHTML = `
    <div class="resena-emisor">
      <img src="${foto}" alt="Emisor" />
      <div>
        <div class="nombre">${escapar(r.emisor_nombre || "Usuario")}</div>
        <div class="fecha">${formatearFecha(r.creado_en)}</div>
      </div>
    </div>
    <div class="resena-estrellas">${"★".repeat(r.estrellas)}${"☆".repeat(5 - r.estrellas)}</div>
    ${r.comentario ? `<div class="resena-comentario">"${escapar(r.comentario)}"</div>` : ""}
  `;
  return div;
}

// ------------------------------------------------------------
// 39) Traducciones y utilidades
// ------------------------------------------------------------
function traducirEstado(e) {
  const map = { pendiente: "Pendiente", aceptado: "Aceptado", en_camino: "En camino", llego: "Llegó", en_curso: "En curso", completado: "Completado", cancelado: "Cancelado" };
  return map[e] || e;
}

function formatearFecha(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function escapar(txt) {
  if (txt == null) return "";
  return String(txt)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function traducirError(msg) {
  if (!msg) return "Ocurrió un error inesperado.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de entrar.";
  if (m.includes("user already registered")) return "Ese correo ya está registrado.";
  if (m.includes("password should be at least")) return "La contraseña es demasiado corta.";
  if (m.includes("unable to validate email")) return "Correo inválido.";
  if (m.includes("rate limit")) return "Demasiados intentos. Espera un momento.";
  if (m.includes("duplicate") && m.includes("telefono")) return "Este número de teléfono ya está registrado.";
  if (m.includes("duplicate")) return "Ya existe un registro igual.";
  if (m.includes("no puedes reportarte")) return "No puedes reportarte a ti mismo.";
  if (m.includes("3 reportes en los últimos")) return "Ya has hecho 3 reportes en los últimos 7 días.";
  if (m.includes("ya reportaste")) return "Ya reportaste a este usuario en los últimos 7 días.";
  if (m.includes("al menos 10 caracteres")) return "La descripción debe tener al menos 10 caracteres.";
  if (m.includes("row-level security") || m.includes("new row violates")) return "No tienes permiso para esta acción.";
  if (m.includes("solo el admin")) return "Acción solo permitida para el admin.";
  if (m.includes("perfiles_telefono_unico")) return "Este teléfono ya está en uso por otro usuario.";
  if (m.includes("perfiles_telefono_formato")) return "El teléfono debe tener exactamente 8 dígitos.";
  if (m.includes("ya aplicaste un código")) return "Ya aplicaste un código de referido antes.";
  if (m.includes("solo puedes aplicar un código")) return "Solo puedes aplicar un código dentro de los primeros 3 días desde tu registro.";
  if (m.includes("código no válido") || m.includes("codigo no valido")) return "El código no existe o está mal escrito.";
  if (m.includes("no puedes usar tu propio código")) return "No puedes usar tu propio código de referido.";
  if (m.includes("saldo insuficiente")) return "Saldo insuficiente. Recarga para continuar.";
  if (m.includes("máximo del plan premium") || m.includes("maximo del plan premium")) return "Ya tienes 3 solicitudes activas (máximo del Plan Premium).";
  if (m.includes("ya tienes una solicitud activa")) return "Ya tienes una solicitud activa. Activa el Plan Premium para tener hasta 3 simultáneas.";
  return msg;
}

// ------------------------------------------------------------
// 40) Auth
// ------------------------------------------------------------
function escucharAuth() {
  db.auth.onAuthStateChange((evento, session) => {
    console.log("[Auth event]", evento);
    if (evento === "PASSWORD_RECOVERY") {
      estado.modoRecuperacion = true;
      limpiarMensajes();
      el.form_reset?.reset();
      mostrarPantalla("pantalla-reset");
      return;
    }
    if (evento === "SIGNED_OUT" || !session) {
      detenerRealtime();
      if (!estado.modoRecuperacion) mostrarPantalla("pantalla-login");
    }
  });
}

// ============================================================
// 41) MÓDULO DE REFERIDOS
// ============================================================
async function cargarMisReferidos() {
  if (!estado.usuario) return;

  const codigoEl      = document.getElementById("ref-codigo");
  const invitadosEl   = document.getElementById("ref-total-invitados");
  const ganadoEl      = document.getElementById("ref-total-ganado");
  const listaEl       = document.getElementById("lista-ref-comisiones");
  const bloqueAplicar = document.getElementById("ref-aplicar-bloque");

  const { data: perfil } = await db.from("perfiles")
    .select("codigo_referido, referido_por, creado_en")
    .eq("id", estado.usuario.id).maybeSingle();

  if (codigoEl) codigoEl.textContent = perfil?.codigo_referido || "—";

  if (bloqueAplicar) {
    const sinReferidor = !perfil?.referido_por;
    const dentro3dias  = perfil?.creado_en
      ? new Date(perfil.creado_en).getTime() + 3 * 24 * 60 * 60 * 1000 > Date.now()
      : false;
    bloqueAplicar.classList.toggle("oculto", !(sinReferidor && dentro3dias));
  }

  const { data: stats } = await db.rpc("mis_referidos");
  const s = Array.isArray(stats) ? stats[0] : stats;
  if (invitadosEl) invitadosEl.textContent = s?.total_referidos ?? "0";
  if (ganadoEl)    ganadoEl.textContent    = "$" + Number(s?.total_ganado || 0).toFixed(2);

  if (!listaEl) return;
  listaEl.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data: comisiones, error } = await db.from("referidos_comisiones")
    .select("id, tipo, monto, creado_en")
    .eq("referidor_id", estado.usuario.id)
    .order("creado_en", { ascending: false })
    .limit(50);

  if (error) {
    listaEl.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }
  if (!comisiones || comisiones.length === 0) {
    listaEl.innerHTML = '<p class="vacio">Aún no has ganado comisiones. Comparte tu código para empezar.</p>';
    return;
  }

  const ETIQ = {
    bienvenida_cliente: "🎁 Bono bienvenida (cliente)",
    invitador_cliente:  "👤 Comisión por invitar cliente",
    bienvenida_chofer:  "🎁 Bono bienvenida (chofer)",
    invitador_chofer:   "🚗 Comisión por invitar chofer",
  };

  listaEl.innerHTML = "";
  comisiones.forEach((c) => {
    const div = document.createElement("div");
    div.className = "tarjeta-solicitud";
    div.innerHTML = `
      <div class="fila-superior">
        <span class="badge-tipo delivery">${escapar(ETIQ[c.tipo] || c.tipo)}</span>
        <span class="precio-final">+$${Number(c.monto).toFixed(2)}</span>
      </div>
      <div class="meta"><span>${formatearFecha(c.creado_en)}</span></div>
    `;
    listaEl.appendChild(div);
  });
}

async function copiarCodigoReferido() {
  const codigo = document.getElementById("ref-codigo")?.textContent?.trim();
  if (!codigo || codigo === "—") return;
  try {
    await navigator.clipboard.writeText(codigo);
    alert("✅ Código copiado: " + codigo);
  } catch {
    alert("Tu código es: " + codigo);
  }
}

async function compartirCodigoReferido() {
  const codigo = document.getElementById("ref-codigo")?.textContent?.trim();
  if (!codigo || codigo === "—") return;
  const texto = `¡Únete a ALKILO! Usa mi código ${codigo} y gana saldo al completar tu primer servicio. 🚗📦`;
  const url   = window.location.origin + window.location.pathname;
  if (navigator.share) {
    try { await navigator.share({ title: "ALKILO", text: texto, url }); }
    catch { /* usuario canceló */ }
  } else {
    window.open("https://wa.me/?text=" + encodeURIComponent(texto + " " + url), "_blank");
  }
}

async function aplicarCodigoReferido() {
  const input = document.getElementById("ref-aplicar-input");
  const errEl = document.getElementById("ref-aplicar-error");
  const okEl  = document.getElementById("ref-aplicar-exito");
  const btn   = document.getElementById("btn-aplicar-referido");

  if (errEl) errEl.textContent = "";
  if (okEl)  okEl.textContent  = "";

  const codigo = (input?.value || "").trim().toUpperCase();
  if (!codigo) { if (errEl) errEl.textContent = "Escribe un código."; return; }

  if (btn) { btn.disabled = true; btn.textContent = "Aplicando..."; }

  const { error } = await db.rpc("aplicar_codigo_referido", { p_codigo: codigo });

  if (btn) { btn.disabled = false; btn.textContent = "Aplicar"; }

  if (error) {
    if (errEl) errEl.textContent = traducirError(error.message);
    return;
  }

  if (okEl) okEl.textContent = "✅ Código aplicado. Ganarás tu bono al completar tu primer servicio.";
  if (input) input.value = "";
  setTimeout(cargarMisReferidos, 1500);
}

function inicializarReferidos() {
  document.getElementById("btn-ver-mis-referidos")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-mis-referidos");
    cargarMisReferidos();
  });
  document.getElementById("btn-refrescar-referidos")?.addEventListener("click", cargarMisReferidos);
  document.getElementById("btn-copiar-referido")?.addEventListener("click", copiarCodigoReferido);
  document.getElementById("btn-compartir-referido")?.addEventListener("click", compartirCodigoReferido);
  document.getElementById("btn-aplicar-referido")?.addEventListener("click", aplicarCodigoReferido);
  document.getElementById("ref-aplicar-input")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

// ------------------------------------------------------------
// 42) Inicio
// ------------------------------------------------------------
async function iniciarApp() {
  cachearElementos();
  conectarNavegacion();
  escucharAuth();

  llenarSelectProvincias(el.reg_provincia);
  llenarSelectProvincias(el.cu_provincia);
  llenarSelectProvincias(el.perfil_provincia);

  // Asegura el estado inicial limpio del formulario de registro
  resetFormularioRegistro();

  el.form_login.addEventListener("submit", iniciarSesion);
  el.form_registro.addEventListener("submit", registrarUsuario);
  el.form_perfil.addEventListener("submit", guardarPerfil);
  el.form_solicitud.addEventListener("submit", crearSolicitud);
  el.form_recuperar.addEventListener("submit", solicitarRecuperacion);
  el.form_reset.addEventListener("submit", guardarNuevaPassword);
  el.btn_cerrar_sesion.addEventListener("click", cerrarSesion);
  el.perfil_foto_input.addEventListener("change", subirFotoPerfil);

  mostrarPantalla("pantalla-cargando");

  const hash = window.location.hash || "";
  const tieneTokenRecuperacion = hash.includes("type=recovery") ||
    (hash.includes("access_token=") && hash.includes("type=recovery"));

  if (tieneTokenRecuperacion) {
    setTimeout(() => {
      if (!estado.modoRecuperacion) {
        estado.modoRecuperacion = true;
        limpiarMensajes();
        el.form_reset?.reset();
        mostrarPantalla("pantalla-reset");
      }
    }, 800);
    return;
  }

  const { data } = await db.auth.getSession();
  if (data?.session) await cargarPerfilYMostrar();
  else mostrarPantalla("pantalla-login");
}

document.addEventListener("DOMContentLoaded", iniciarApp);
document.addEventListener("DOMContentLoaded", inicializarReferidos);