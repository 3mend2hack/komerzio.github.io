/* ============================================================
   ALKILO - Panel admin avanzado (independiente)
   Con módulo de reportes completo
   ============================================================ */

// ------------------------------------------------------------
// 1) Supabase
// ------------------------------------------------------------
const SUPABASE_URL = "https://ghuvgtgykyoovkgwxduc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXZndGd5a3lvb3ZrZ3d4ZHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzcxOTAsImV4cCI6MjEwNjExMzE5MH0.f4j5lwfBjwK1sY-yCC7TkFC-h6dHFusGOkrMAmCnbmI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// 2) Estado
// ------------------------------------------------------------
const estado = {
  usuario: null,
  perfil: null,
  tabActivo: "tab-dashboard",
  usuarios: [],
  solicitudes: [],
  reportes: [],
  filtroUsuarioRol: "todos",
  filtroUsuarioEstado: "todos",
  filtroSolicitud: "todas",
  filtroReporte: "pendiente",
  busqueda: "",
};

// Etiquetas de vehículos y categorías
const ETIQUETAS_VEHICULO = {
  moto: "🛵 Moto",
  motor_electrico: "⚡ Motor eléctrico",
  bicitaxi: "🚲 Bicitaxi",
  triciclo: "🛺 Triciclo",
  auto_ligero: "🚗 Auto ligero",
  camioneta: "🚙 Camioneta",
  camion: "🚚 Camión",
  autobus: "🚌 Autobús",
};

const CATEGORIAS_REPORTE = {
  mal_comportamiento: "😠 Mal comportamiento",
  no_cumplio_servicio: "❌ No cumplió el servicio",
  acoso: "🚫 Acoso o amenazas",
  estafa: "💸 Estafa o cobro indebido",
  otro: "❓ Otro motivo",
};

// ------------------------------------------------------------
// 3) Utilidades
// ------------------------------------------------------------
function escapar(txt) {
  if (txt == null) return "";
  return String(txt)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatearFecha(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

function formatearMoneda(n) {
  const num = Number(n || 0);
  return "$" + num.toFixed(2);
}

function mostrarPantalla(id) {
  ["pantalla-cargando", "pantalla-no-autorizado", "pantalla-principal"].forEach((p) => {
    document.getElementById(p)?.classList.remove("activa");
  });
  document.getElementById(id)?.classList.add("activa");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function noAutorizado(mensaje) {
  const t = document.getElementById("no-autorizado-titulo");
  const x = document.getElementById("no-autorizado-texto");
  if (t) t.textContent = "Acceso restringido";
  if (x) x.textContent = mensaje || "Esta página es solo para administradores.";
  mostrarPantalla("pantalla-no-autorizado");
}

function setMensaje(id, texto) {
  const e = document.getElementById(id);
  if (e) e.textContent = texto || "";
}

// ------------------------------------------------------------
// 4) Init
// ------------------------------------------------------------
async function iniciar() {
  conectarEventos();

  mostrarPantalla("pantalla-cargando");

  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    return noAutorizado("Inicia sesión primero en ALKILO como administrador.");
  }

  estado.usuario = { id: session.user.id, email: session.user.email };

  const { data: perfil } = await db
    .from("perfiles").select("id, nombre, rol, estado_cuenta").eq("id", estado.usuario.id).maybeSingle();

  if (!perfil) return noAutorizado("No se encontró tu perfil.");
  if (perfil.rol !== "admin") return noAutorizado("Esta sección es exclusiva para administradores.");

  estado.perfil = perfil;

  mostrarPantalla("pantalla-principal");
  await cargarTodo();
}

// ------------------------------------------------------------
// 5) Carga de datos
// ------------------------------------------------------------
async function cargarTodo() {
  await Promise.all([
    cargarMetricas(),
    cargarPendientes(),
    cargarReportes(),
    cargarUsuarios(),
    cargarSolicitudes(),
    cargarConfiguracion(),
  ]);
}

async function cargarMetricas() {
  const { data, error } = await db.rpc("metricas_admin");
  if (error || !data || data.length === 0) {
    console.warn("[admin] error métricas:", error);
    return;
  }

  const m = data[0];
  setMensaje("mm-usuarios", m.usuarios_total ?? "—");
  setMensaje("mm-clientes", m.clientes_total ?? "—");
  setMensaje("mm-choferes", m.choferes_total ?? "—");
  setMensaje("mm-choferes-activos", m.choferes_activos ?? "—");
  setMensaje("mm-choferes-pendientes", m.choferes_pendientes ?? "—");
  setMensaje("mm-solicitudes-hoy", m.solicitudes_hoy ?? "—");
  setMensaje("mm-solicitudes-semana", m.solicitudes_semana ?? "—");
  setMensaje("mm-solicitudes-mes", m.solicitudes_mes ?? "—");
  setMensaje("mm-completados-mes", m.completados_mes ?? "—");
  setMensaje("mm-ingresos-hoy", formatearMoneda(m.ingresos_hoy));
  setMensaje("mm-ingresos-semana", formatearMoneda(m.ingresos_semana));
  setMensaje("mm-ingresos-mes", formatearMoneda(m.ingresos_mes));
  setMensaje("mm-ingresos-total", formatearMoneda(m.ingresos_total));

  const badge = document.getElementById("badge-pendientes");
  const totalPend = Number(m.choferes_pendientes || 0);
  if (badge) {
    badge.textContent = totalPend;
    badge.classList.toggle("oculto", totalPend === 0);
  }
}

async function cargarPendientes() {
  const cont = document.getElementById("adm-lista-pendientes");
  if (!cont) return;
  cont.innerHTML = '<p class="adm-vacio">Cargando…</p>';

  const { data, error } = await db
    .from("perfiles")
    .select("id, nombre, telefono, rol, foto_url, creado_en, estado_cuenta, tipo_vehiculo, chapa")
    .eq("rol", "chofer")
    .eq("estado_cuenta", "pendiente_aprobacion")
    .order("creado_en", { ascending: true });

  if (error) { cont.innerHTML = `<p class="adm-vacio">Error: ${escapar(error.message)}</p>`; return; }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="adm-vacio">No hay choferes pendientes. 🎉</p>';
    return;
  }

  cont.innerHTML = "";
  data.forEach((u) => cont.appendChild(renderPendiente(u)));
}

function renderPendiente(u) {
  const card = document.createElement("div");
  card.className = "adm-card";

  const foto = u.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52'><rect width='52' height='52' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='24' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const veh = ETIQUETAS_VEHICULO[u.tipo_vehiculo] || (u.tipo_vehiculo || "—");

  card.innerHTML = `
    <div class="adm-card-cabecera">
      <img src="${foto}" alt="Foto" />
      <div class="adm-card-info">
        <div class="adm-card-nombre">${escapar(u.nombre || "Sin nombre")}</div>
        <div class="adm-card-sub">${escapar(u.telefono || "sin teléfono")}</div>
      </div>
      <span class="adm-badge-estado pendiente_aprobacion">Pendiente</span>
    </div>
    <div class="adm-card-linea"><span class="label">Vehículo:</span><span class="valor">${escapar(veh)}</span></div>
    <div class="adm-card-linea"><span class="label">Chapa:</span><span class="valor">${u.chapa ? escapar(u.chapa) : "Sin chapa"}</span></div>
    <div class="adm-card-linea"><span class="label">Registro:</span><span class="valor">${formatearFecha(u.creado_en)}</span></div>
    <div class="adm-acciones">
      <button class="adm-btn-aprobar" data-accion="aprobar" data-id="${u.id}">✅ Aprobar</button>
      <button class="adm-btn-rechazar" data-accion="rechazar" data-id="${u.id}">❌ Rechazar</button>
    </div>
  `;

  card.querySelector('[data-accion="aprobar"]')?.addEventListener("click", () => aprobarChofer(u.id, u.nombre));
  card.querySelector('[data-accion="rechazar"]')?.addEventListener("click", () => rechazarChofer(u.id, u.nombre));
  return card;
}

async function aprobarChofer(id, nombre) {
  if (!confirm(`¿Aprobar a ${nombre || "este chofer"}?`)) return;
  const { error } = await db.rpc("aprobar_chofer", { p_chofer_id: id });
  if (error) return alert("Error: " + error.message);
  alert("✅ Chofer aprobado.");
  await Promise.all([cargarPendientes(), cargarMetricas(), cargarUsuarios()]);
}

async function rechazarChofer(id, nombre) {
  const motivo = prompt(`Motivo del rechazo para ${nombre || "este chofer"} (opcional):`, "Datos incompletos");
  if (motivo === null) return;
  if (!confirm("¿Confirmas el rechazo? El chofer no podrá usar la app.")) return;

  const { error } = await db.rpc("rechazar_chofer", { p_chofer_id: id, p_motivo: motivo || null });
  if (error) return alert("Error: " + error.message);
  alert("Chofer rechazado.");
  await Promise.all([cargarPendientes(), cargarMetricas(), cargarUsuarios()]);
}

// ============================================================
// 6) REPORTES
// ============================================================
async function cargarReportes() {
  const cont = document.getElementById("adm-lista-reportes");
  if (!cont) return;
  cont.innerHTML = '<p class="adm-vacio">Cargando…</p>';

  const { data, error } = await db
    .from("reportes")
    .select(`
      *,
      emisor:emisor_id ( id, nombre, foto_url, rol ),
      receptor:receptor_id ( id, nombre, foto_url, rol, estado_cuenta, motivo_estado ),
      solicitud:solicitud_id ( id, tipo, origen, destino, estado )
    `)
    .order("creado_en", { ascending: false })
    .limit(200);

  if (error) { cont.innerHTML = `<p class="adm-vacio">Error: ${escapar(error.message)}</p>`; return; }

  estado.reportes = data || [];

  // Contar pendientes para badge
  const pendientes = estado.reportes.filter((r) => r.estado === "pendiente").length;
  const badge = document.getElementById("badge-reportes");
  if (badge) {
    badge.textContent = pendientes;
    badge.classList.toggle("oculto", pendientes === 0);
  }

  renderReportes();
}

function renderReportes() {
  const cont = document.getElementById("adm-lista-reportes");
  if (!cont) return;

  const filtro = estado.filtroReporte;
  let lista = estado.reportes;

  if (filtro !== "todos") lista = lista.filter((r) => r.estado === filtro);

  if (lista.length === 0) {
    cont.innerHTML = '<p class="adm-vacio">Sin reportes en este filtro.</p>';
    return;
  }

  cont.innerHTML = "";
  lista.forEach((r) => cont.appendChild(renderReporteCard(r)));
}

function renderReporteCard(r) {
  const card = document.createElement("div");
  card.className = "adm-card";

  const fotoEmisor = r.emisor?.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='20' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const fotoReceptor = r.receptor?.foto_url || fotoEmisor;

  const catTexto = CATEGORIAS_REPORTE[r.categoria] || r.categoria;

  // Badge del estado del reporte
  const badgeClase =
    r.estado === "resuelto" ? "activo" :
    r.estado === "desestimado" ? "baneado" :
    r.estado === "en_revision" ? "suspendido" :
    "pendiente_aprobacion";

  // Estado del receptor
  const estadoReceptor = r.receptor?.estado_cuenta || "activo";

  // Respuesta del reportado
  const respuestaHTML = r.respuesta_reportado ? `
    <div class="adm-card-linea" style="flex-direction:column;align-items:flex-start;background:#eff6ff;padding:10px;border-radius:8px;border-left:3px solid #93c5fd">
      <span class="label" style="color:#1e3a8a;font-weight:800;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px">Respuesta del reportado</span>
      <span class="valor" style="color:#1e40af;font-style:italic">"${escapar(r.respuesta_reportado)}"</span>
    </div>
  ` : "";

  // Resolución (si ya fue procesado)
  let resolucionHTML = "";
  if (r.estado === "resuelto" || r.estado === "desestimado") {
    resolucionHTML = `
      <div style="background:#f0fdf4;border-left:3px solid #10b981;padding:10px;border-radius:8px;font-size:0.85rem;color:#065f46">
        <strong style="text-transform:uppercase;font-size:0.72rem;letter-spacing:0.5px">
          ${r.estado === "desestimado" ? "DESESTIMADO" : (r.accion_tomada || "RESUELTO")}
        </strong>
        ${r.motivo_admin ? `<br>"${escapar(r.motivo_admin)}"` : ""}
        ${r.monto_ajuste ? `<br>Monto ajustado: ${formatearMoneda(r.monto_ajuste)}` : ""}
      </div>
    `;
  }

  // Botones de acción (solo si está pendiente o en revisión)
  let accionesHTML = "";
  const puedeActuar = (r.estado === "pendiente" || r.estado === "en_revision");

  if (puedeActuar) {
    accionesHTML = `
      <div class="adm-acciones">
        <button class="adm-btn-neutral" data-accion="desestimar" data-id="${r.id}">🚫 Desestimar</button>
        <button class="adm-btn-suspender" data-accion="advertir" data-id="${r.id}">⚠️ Advertir</button>
        <button class="adm-btn-bannear" data-accion="suspender" data-id="${r.id}">⏸ Suspender</button>
        <button class="adm-btn-rechazar" data-accion="banear" data-id="${r.id}">🚫 Banear</button>
        <button class="adm-btn-eliminar" data-accion="eliminar" data-id="${r.id}">🗑 Eliminar</button>
        <button class="adm-btn-saldo" data-accion="ajuste_saldo" data-id="${r.id}">💵 Compensar</button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="adm-card-cabecera" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#6b7280;margin-bottom:6px">
          🚨 Reporte · ${escapar(catTexto)}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="adm-badge-estado ${badgeClase}">${escapar(r.estado.replace("_", " "))}</span>
          <span style="font-size:0.75rem;color:#9ca3af">${formatearFecha(r.creado_en)}</span>
        </div>
      </div>
    </div>

    <div class="adm-card-linea" style="flex-direction:column;align-items:flex-start;background:#f9fafb;padding:10px;border-radius:8px">
      <span class="label" style="color:#991b1b;font-weight:800;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px">📝 Descripción</span>
      <span class="valor" style="color:#111827">${escapar(r.descripcion)}</span>
    </div>

    <div style="display:flex;gap:8px;align-items:center;background:#fee2e2;padding:10px;border-radius:8px">
      <img src="${fotoEmisor}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #fff" />
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;font-weight:800;color:#991b1b">👤 Reportó</div>
        <div style="font-size:0.9rem;font-weight:700;color:#111827">${escapar(r.emisor?.nombre || "Usuario")} <span style="color:#6b7280;font-weight:500;font-size:0.8rem">(${escapar((r.emisor?.rol || "").toUpperCase())})</span></div>
      </div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;background:#fef3c7;padding:10px;border-radius:8px">
      <img src="${fotoReceptor}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #fff" />
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;font-weight:800;color:#92400e">🎯 Reportado</div>
        <div style="font-size:0.9rem;font-weight:700;color:#111827">${escapar(r.receptor?.nombre || "Usuario")} <span style="color:#6b7280;font-weight:500;font-size:0.8rem">(${escapar((r.receptor?.rol || "").toUpperCase())})</span></div>
        <div style="font-size:0.72rem;color:#6b7280;margin-top:2px">Estado cuenta: <strong>${escapar(estadoReceptor.replace("_", " "))}</strong></div>
      </div>
    </div>

    ${r.solicitud ? `
      <div class="adm-card-linea" style="font-size:0.82rem">
        <span class="label">Solicitud:</span>
        <span class="valor">${escapar(r.solicitud.tipo === "viaje" ? "🚗 Viaje" : "📦 Delivery")} · ${escapar(r.solicitud.estado)} · ${escapar(r.solicitud.origen)} → ${escapar(r.solicitud.destino)}</span>
      </div>
    ` : ""}

    ${respuestaHTML}
    ${resolucionHTML}
    ${accionesHTML}
  `;

  card.querySelector('[data-accion="desestimar"]')?.addEventListener("click", () => resolverReporte(r.id, "ninguna", r.receptor?.nombre));
  card.querySelector('[data-accion="advertir"]')?.addEventListener("click", () => resolverReporte(r.id, "advertencia", r.receptor?.nombre));
  card.querySelector('[data-accion="suspender"]')?.addEventListener("click", () => resolverReporte(r.id, "suspension", r.receptor?.nombre));
  card.querySelector('[data-accion="banear"]')?.addEventListener("click", () => resolverReporte(r.id, "baneo", r.receptor?.nombre));
  card.querySelector('[data-accion="eliminar"]')?.addEventListener("click", () => eliminarUsuarioDesdeReporte(r));
  card.querySelector('[data-accion="ajuste_saldo"]')?.addEventListener("click", () => ajustarSaldoDesdeReporte(r));

  return card;
}

async function resolverReporte(reporteId, accion, nombreReceptor) {
  const accionesTexto = {
    ninguna: "desestimar",
    advertencia: "advertir",
    suspension: "suspender",
    baneo: "banear",
  };
  const textoAccion = accionesTexto[accion] || "procesar";

  let motivo = null;
  if (accion !== "ninguna") {
    motivo = prompt(`Motivo para ${textoAccion} a ${nombreReceptor || "este usuario"} (opcional):`, "");
    if (motivo === null) return;
  }

  if (!confirm(`¿Confirmas ${textoAccion} a ${nombreReceptor || "este usuario"}?`)) return;

  const { error } = await db.rpc("resolver_reporte", {
    p_reporte_id: reporteId,
    p_accion: accion,
    p_motivo: motivo || null,
    p_monto: null,
  });

  if (error) return alert("Error: " + error.message);
  alert("✅ Reporte procesado.");
  await Promise.all([cargarReportes(), cargarMetricas(), cargarUsuarios()]);
}

async function eliminarUsuarioDesdeReporte(r) {
  const nombre = r.receptor?.nombre || "este usuario";
  const receptorId = r.receptor_id;
  if (!receptorId) return alert("No se pudo identificar al reportado.");

  const primera = confirm(
    `⚠️ ELIMINAR PERMANENTEMENTE a ${nombre} por este reporte.\n\n` +
    `Esto borra TODO su historial, cuenta y datos.\n\n` +
    `Esta acción NO se puede deshacer.`
  );
  if (!primera) return;

  const palabra = prompt(`Escribe exactamente "ELIMINAR" para confirmar:`);
  if (palabra !== "ELIMINAR") return alert("Cancelado.");

  const { error } = await db.rpc("eliminar_usuario_completo", { p_usuario_id: receptorId });
  if (error) return alert("Error: " + error.message);

  alert("✅ Usuario eliminado del sistema.");
  await Promise.all([cargarReportes(), cargarMetricas(), cargarUsuarios()]);
}

async function ajustarSaldoDesdeReporte(r) {
  const nombre = r.receptor?.nombre || "este usuario";
  const receptorId = r.receptor_id;
  const emisorNombre = r.emisor?.nombre || "el reportante";
  if (!receptorId) return alert("No se pudo identificar al reportado.");

  const tipo = prompt(
    `¿A quién ajustar el saldo?\n\n` +
    `Escribe "1" para: ${emisorNombre} (compensación al afectado)\n` +
    `Escribe "2" para: ${nombre} (ajuste al reportado)\n\n` +
    `Ejemplo: si quieres compensar al que reportó por una estafa, escribe "1".`,
    "1"
  );
  if (tipo !== "1" && tipo !== "2") return;

  const usuarioAjustar = tipo === "1" ? r.emisor_id : receptorId;
  const nombreAjustar = tipo === "1" ? emisorNombre : nombre;

  const montoStr = prompt(`Monto para ajustar a ${nombreAjustar} (positivo suma, negativo resta):`, "100");
  if (montoStr === null) return;
  const monto = Number(montoStr);
  if (!monto || isNaN(monto) || monto === 0) return alert("Monto inválido.");

  const motivo = prompt("Motivo del ajuste (opcional):", "Compensación por reporte") || null;

  const { error: errSaldo } = await db.rpc("ajustar_saldo_manual", {
    p_usuario_id: usuarioAjustar,
    p_monto: monto,
    p_motivo: motivo,
  });
  if (errSaldo) return alert("Error al ajustar saldo: " + errSaldo.message);

  const { error: errRep } = await db.rpc("resolver_reporte", {
    p_reporte_id: r.id,
    p_accion: "ajuste_saldo",
    p_motivo: motivo,
    p_monto: monto,
  });
  if (errRep) return alert("Ajuste hecho, pero error al marcar el reporte: " + errRep.message);

  alert(`✅ Saldo ajustado en ${formatearMoneda(monto)} a ${nombreAjustar}.`);
  await Promise.all([cargarReportes(), cargarUsuarios()]);
}

// ============================================================
// 7) USUARIOS
// ============================================================
async function cargarUsuarios() {
  const cont = document.getElementById("adm-lista-usuarios");
  if (!cont) return;
  cont.innerHTML = '<p class="adm-vacio">Cargando…</p>';

  const { data, error } = await db
    .from("perfiles")
    .select(`
      id, nombre, telefono, rol, foto_url, creado_en, estado_cuenta, motivo_estado,
      tipo_vehiculo, chapa,
      suscripciones ( id, estado, fecha_vencimiento ),
      saldos ( monto )
    `)
    .order("creado_en", { ascending: false });

  if (error) { cont.innerHTML = `<p class="adm-vacio">Error: ${escapar(error.message)}</p>`; return; }

  estado.usuarios = data || [];
  renderUsuarios();
}

function renderUsuarios() {
  const cont = document.getElementById("adm-lista-usuarios");
  if (!cont) return;

  const filtroRol = estado.filtroUsuarioRol;
  const filtroEst = estado.filtroUsuarioEstado;
  const busq = (estado.busqueda || "").toLowerCase().trim();

  let lista = estado.usuarios;
  if (filtroRol !== "todos") lista = lista.filter((u) => u.rol === filtroRol);
  if (filtroEst !== "todos") lista = lista.filter((u) => (u.estado_cuenta || "activo") === filtroEst);

  if (busq) {
    lista = lista.filter((u) =>
      (u.nombre || "").toLowerCase().includes(busq) ||
      (u.telefono || "").toLowerCase().includes(busq) ||
      (u.id || "").toLowerCase().includes(busq)
    );
  }

  if (lista.length === 0) {
    cont.innerHTML = '<p class="adm-vacio">Sin resultados.</p>';
    return;
  }

  cont.innerHTML = "";
  lista.forEach((u) => cont.appendChild(renderUsuarioCard(u)));
}

function renderUsuarioCard(u) {
  const card = document.createElement("div");
  card.className = "adm-card";

  const foto = u.foto_url || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='52' height='52'><rect width='52' height='52' fill='%23e5e7eb'/><text x='50%25' y='60%25' font-size='24' text-anchor='middle' fill='%239ca3af' font-family='sans-serif'>?</text></svg>";
  const estadoCuenta = u.estado_cuenta || "activo";
  const saldo = Number(u.saldos?.monto || 0);

  const hoy = new Date();
  const suscActiva = (u.suscripciones || []).find(
    (s) => s.estado === "activa" && new Date(s.fecha_vencimiento) > hoy
  );
  let suscTxt = "Sin suscripción";
  if (suscActiva) {
    const venc = new Date(suscActiva.fecha_vencimiento);
    const dias = Math.ceil((venc - hoy) / 86400000);
    suscTxt = `Activa (${dias}d)`;
  }

  const veh = ETIQUETAS_VEHICULO[u.tipo_vehiculo] || u.tipo_vehiculo || "—";

  card.innerHTML = `
    <div class="adm-card-cabecera">
      <img src="${foto}" alt="Foto" />
      <div class="adm-card-info">
        <div class="adm-card-nombre">${escapar(u.nombre || "Sin nombre")}</div>
        <div class="adm-card-sub">${escapar((u.rol || "").toUpperCase())} · ${escapar(u.telefono || "sin tel.")}</div>
      </div>
      <span class="adm-badge-estado ${estadoCuenta}">${estadoCuenta.replace("_", " ")}</span>
    </div>

    ${u.rol === "chofer" ? `
      <div class="adm-card-linea"><span class="label">Vehículo:</span><span class="valor">${escapar(veh)}${u.chapa ? " · " + escapar(u.chapa) : ""}</span></div>
      <div class="adm-card-linea"><span class="label">Suscripción:</span><span class="valor">${escapar(suscTxt)}</span></div>
    ` : ""}

    <div class="adm-card-linea"><span class="label">Saldo:</span><span class="valor">${formatearMoneda(saldo)}</span></div>
    <div class="adm-card-linea"><span class="label">Registro:</span><span class="valor">${formatearFecha(u.creado_en)}</span></div>
    ${u.motivo_estado ? `<div class="adm-card-linea"><span class="label">Motivo:</span><span class="valor">${escapar(u.motivo_estado)}</span></div>` : ""}

    <div class="adm-acciones">
      <button class="adm-btn-saldo" data-accion="saldo" data-id="${u.id}">💵 Ajustar saldo</button>
      ${estadoCuenta === "activo" ? `
        <button class="adm-btn-suspender" data-accion="suspender" data-id="${u.id}">⏸ Suspender</button>
        <button class="adm-btn-bannear" data-accion="banear" data-id="${u.id}">🚫 Banear</button>
      ` : `
        <button class="adm-btn-reactivar" data-accion="reactivar" data-id="${u.id}">✅ Reactivar</button>
      `}
      <button class="adm-btn-eliminar" data-accion="eliminar" data-id="${u.id}">🗑 Eliminar</button>
    </div>
  `;

  card.querySelector('[data-accion="saldo"]')?.addEventListener("click", () => ajustarSaldo(u.id, u.nombre));
  card.querySelector('[data-accion="suspender"]')?.addEventListener("click", () => cambiarEstado(u.id, "suspendido", u.nombre));
  card.querySelector('[data-accion="banear"]')?.addEventListener("click", () => cambiarEstado(u.id, "baneado", u.nombre));
  card.querySelector('[data-accion="reactivar"]')?.addEventListener("click", () => cambiarEstado(u.id, "activo", u.nombre));
  card.querySelector('[data-accion="eliminar"]')?.addEventListener("click", () => eliminarUsuario(u.id, u.nombre));

  return card;
}

async function ajustarSaldo(usuarioId, nombre) {
  const montoStr = prompt(
    `¿Cuánto ajustar el saldo de ${nombre || "este usuario"}?\n\n` +
    `Positivo para sumar (ej: 500) o negativo para restar (ej: -100).`,
    "100");
  if (montoStr === null) return;

  const monto = Number(montoStr);
  if (!monto || isNaN(monto) || monto === 0) return alert("Monto inválido.");

  const motivo = prompt("Motivo del ajuste (opcional):", "Ajuste manual admin") || null;

  const { error } = await db.rpc("ajustar_saldo_manual", {
    p_usuario_id: usuarioId, p_monto: monto, p_motivo: motivo,
  });

  if (error) return alert("Error: " + error.message);
  alert(`✅ Saldo ajustado en ${formatearMoneda(monto)}.`);
  await cargarUsuarios();
}

async function cambiarEstado(usuarioId, nuevoEstado, nombre) {
  const etiquetas = { suspendido: "suspender", baneado: "banear", activo: "reactivar" };
  const accion = etiquetas[nuevoEstado] || "cambiar el estado de";

  const motivo = prompt(
    `¿Confirmas ${accion} a ${nombre || "este usuario"}?\n\n` +
    `Puedes escribir un motivo (opcional):`, "");
  if (motivo === null) return;

  const { error } = await db.rpc("cambiar_estado_cuenta", {
    p_usuario_id: usuarioId, p_estado: nuevoEstado, p_motivo: motivo || null,
  });

  if (error) return alert("Error: " + error.message);
  alert("✅ Estado actualizado.");
  await Promise.all([cargarUsuarios(), cargarMetricas(), cargarPendientes()]);
}

async function eliminarUsuario(usuarioId, nombre) {
  const nombreMostrar = nombre || "este usuario";

  const primera = confirm(
    `⚠️ ELIMINAR PERMANENTEMENTE a ${nombreMostrar}.\n\n` +
    `Esto borra:\n· Su cuenta y perfil\n· Su saldo\n· Sus suscripciones\n` +
    `· Sus mensajes, ofertas y calificaciones\n· Sus wallet cripto asociadas\n\n` +
    `Las solicitudes donde fue CLIENTE también se eliminan.\n` +
    `Las solicitudes donde fue CHOFER quedan sin chofer asignado.\n\n` +
    `Esta acción NO se puede deshacer.\n\n¿Continuar?`);
  if (!primera) return;

  const texto = prompt(`Para confirmar, escribe exactamente:\n\n  ELIMINAR`);
  if (texto !== "ELIMINAR") return alert("Cancelado. No se escribió la palabra correcta.");

  const { error } = await db.rpc("eliminar_usuario_completo", { p_usuario_id: usuarioId });
  if (error) return alert("Error: " + error.message);

  alert(`✅ Usuario eliminado del sistema.`);
  await Promise.all([cargarUsuarios(), cargarMetricas(), cargarPendientes()]);
}

// ============================================================
// 8) SOLICITUDES
// ============================================================
async function cargarSolicitudes() {
  const cont = document.getElementById("adm-lista-solicitudes");
  if (!cont) return;
  cont.innerHTML = '<p class="adm-vacio">Cargando…</p>';

  const { data, error } = await db
    .from("solicitudes")
    .select(`
      id, tipo, origen, destino, estado, presupuesto, precio_final,
      creado_en, actualizado_en,
      cliente:cliente_id ( id, nombre ),
      chofer:chofer_id ( id, nombre )
    `)
    .order("creado_en", { ascending: false })
    .limit(200);

  if (error) { cont.innerHTML = `<p class="adm-vacio">Error: ${escapar(error.message)}</p>`; return; }

  estado.solicitudes = data || [];
  renderSolicitudes();
}

function renderSolicitudes() {
  const cont = document.getElementById("adm-lista-solicitudes");
  if (!cont) return;

  const filtro = estado.filtroSolicitud;
  let lista = estado.solicitudes;

  if (filtro === "en_curso") {
    lista = lista.filter((s) => ["aceptado","en_camino","llego","en_curso"].includes(s.estado));
  } else if (filtro !== "todas") {
    lista = lista.filter((s) => s.estado === filtro);
  }

  if (lista.length === 0) {
    cont.innerHTML = '<p class="adm-vacio">Sin solicitudes en este filtro.</p>';
    return;
  }

  cont.innerHTML = "";
  lista.forEach((s) => cont.appendChild(renderSolicitudCard(s)));
}

function renderSolicitudCard(s) {
  const card = document.createElement("div");
  card.className = "adm-card";

  const badgeClase =
    s.estado === "completado" ? "activo" :
    s.estado === "cancelado" ? "baneado" :
    s.estado === "pendiente" ? "pendiente_aprobacion" :
    "suspendido";

  card.innerHTML = `
    <div class="adm-card-cabecera">
      <div class="adm-card-info">
        <div class="adm-card-nombre">${escapar(s.tipo === "viaje" ? "🚗 Viaje" : "📦 Delivery")} · ${escapar(s.estado)}</div>
        <div class="adm-card-sub">${formatearFecha(s.creado_en)}</div>
      </div>
      <span class="adm-badge-estado ${badgeClase}">${escapar(s.estado)}</span>
    </div>
    <div class="adm-card-linea"><span class="label">De:</span><span class="valor">${escapar(s.origen)}</span></div>
    <div class="adm-card-linea"><span class="label">A:</span><span class="valor">${escapar(s.destino)}</span></div>
    <div class="adm-card-linea"><span class="label">Cliente:</span><span class="valor">${escapar(s.cliente?.nombre || "—")}</span></div>
    <div class="adm-card-linea"><span class="label">Chofer:</span><span class="valor">${escapar(s.chofer?.nombre || "Sin asignar")}</span></div>
    <div class="adm-card-linea"><span class="label">Precio:</span><span class="valor">${s.precio_final != null ? formatearMoneda(s.precio_final) : (s.presupuesto != null ? formatearMoneda(s.presupuesto) + " (sug.)" : "—")}</span></div>
  `;

  return card;
}

// ============================================================
// 9) CONFIGURACIÓN
// ============================================================
async function cargarConfiguracion() {
  const { data } = await db.from("configuracion").select("clave, valor")
    .in("clave", ["tasa_usdt_saldo","precio_saldo_1mes","precio_saldo_3meses",
      "precio_saldo_6meses","precio_saldo_12meses"]);

  const cfg = {};
  (data || []).forEach((c) => { cfg[c.clave] = c.valor; });

  const g = (id) => document.getElementById(id);
  if (g("adm-cfg-tasa")) g("adm-cfg-tasa").value = cfg["tasa_usdt_saldo"] || "1.00";
  if (g("adm-cfg-plan1")) g("adm-cfg-plan1").value = cfg["precio_saldo_1mes"] || "200.00";
  if (g("adm-cfg-plan3")) g("adm-cfg-plan3").value = cfg["precio_saldo_3meses"] || "700.00";
  if (g("adm-cfg-plan6")) g("adm-cfg-plan6").value = cfg["precio_saldo_6meses"] || "1200.00";
  if (g("adm-cfg-plan12")) g("adm-cfg-plan12").value = cfg["precio_saldo_12meses"] || "2000.00";
}

async function guardarConfiguracion(e) {
  e.preventDefault();
  const g = (id) => Number(document.getElementById(id).value);

  const tasa = g("adm-cfg-tasa");
  const p1 = g("adm-cfg-plan1");
  const p3 = g("adm-cfg-plan3");
  const p6 = g("adm-cfg-plan6");
  const p12 = g("adm-cfg-plan12");

  if (!tasa || tasa <= 0) return setMensaje("adm-cfg-error", "Tasa inválida.");
  if (p1 < 0 || p3 < 0 || p6 < 0 || p12 < 0)
    return setMensaje("adm-cfg-error", "Precios no pueden ser negativos.");

  setMensaje("adm-cfg-error", "");
  setMensaje("adm-cfg-exito", "Guardando…");

  const { error } = await db.from("configuracion").upsert([
    { clave: "tasa_usdt_saldo", valor: tasa.toFixed(2) },
    { clave: "precio_saldo_1mes", valor: p1.toFixed(2) },
    { clave: "precio_saldo_3meses", valor: p3.toFixed(2) },
    { clave: "precio_saldo_6meses", valor: p6.toFixed(2) },
    { clave: "precio_saldo_12meses", valor: p12.toFixed(2) },
  ]);

  if (error) return setMensaje("adm-cfg-error", error.message);
  setMensaje("adm-cfg-exito", "✅ Cambios guardados.");
}

// ============================================================
// 10) ACCIONES RÁPIDAS
// ============================================================
async function limpiarViajesAntiguos() {
  const input = document.getElementById("adm-dias-limpieza");
  const dias = Number(input?.value) || 60;

  if (!confirm(
    `¿Eliminar todas las solicitudes COMPLETADAS o CANCELADAS con más de ${dias} días de antigüedad?\n\n` +
    `Esto NO borra las calificaciones (las estrellas se mantienen).`)) return;

  const { data, error } = await db.rpc("eliminar_viajes_antiguos", { p_dias: dias });
  if (error) return alert("Error: " + error.message);
  alert(`✅ Se eliminaron ${data ?? 0} solicitudes antiguas.`);
  await Promise.all([cargarSolicitudes(), cargarMetricas()]);
}

// ============================================================
// 11) Eventos
// ============================================================
function conectarEventos() {
  // Tabs
  document.querySelectorAll(".adm-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".adm-tab").forEach((b) => b.classList.remove("activo"));
      btn.classList.add("activo");
      const tabId = btn.getAttribute("data-tab");
      document.querySelectorAll(".adm-panel").forEach((p) => p.classList.remove("activo"));
      document.getElementById(tabId)?.classList.add("activo");
      estado.tabActivo = tabId;
    });
  });

  document.getElementById("adm-refrescar")?.addEventListener("click", () => cargarTodo());

  document.getElementById("adm-cerrar-sesion")?.addEventListener("click", async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await db.auth.signOut();
    window.location.href = "../index.html";
  });

  document.getElementById("btn-ir-app")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  document.getElementById("adm-btn-ir-app")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  // Filtros de usuarios (rol)
  document.querySelectorAll("[data-filtro-usuario]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro-usuario]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroUsuarioRol = chip.getAttribute("data-filtro-usuario");
      renderUsuarios();
    });
  });

  // Filtros de usuarios (estado)
  document.querySelectorAll("[data-filtro-estado]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro-estado]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroUsuarioEstado = chip.getAttribute("data-filtro-estado");
      renderUsuarios();
    });
  });

  // Filtros de solicitudes
  document.querySelectorAll("[data-filtro-sol]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro-sol]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroSolicitud = chip.getAttribute("data-filtro-sol");
      renderSolicitudes();
    });
  });

  // Filtros de reportes
  document.querySelectorAll("[data-filtro-reporte]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro-reporte]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      estado.filtroReporte = chip.getAttribute("data-filtro-reporte");
      renderReportes();
    });
  });

  // Búsqueda de usuarios
  document.getElementById("adm-buscar-usuario")?.addEventListener("input", (e) => {
    estado.busqueda = e.target.value;
    renderUsuarios();
  });

  // Configuración
  document.getElementById("adm-form-config")?.addEventListener("submit", guardarConfiguracion);

  // Acciones rápidas
  document.getElementById("adm-btn-limpieza")?.addEventListener("click", limpiarViajesAntiguos);
  document.getElementById("adm-btn-refrescar-metricas")?.addEventListener("click", async () => {
    await cargarMetricas();
    alert("✅ Métricas recargadas.");
  });
}

// ------------------------------------------------------------
// 12) Arrancar
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", iniciar);