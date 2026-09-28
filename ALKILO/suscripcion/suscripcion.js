/* ============================================================
   ALKILO - Página de suscripción del chofer
   Modelo: recargar saldo → activar plan con saldo
   ============================================================ */

// ------------------------------------------------------------
// 1) Supabase
// ------------------------------------------------------------
const SUPABASE_URL = "https://ghuvgtgykyoovkgwxduc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXZndGd5a3lvb3ZrZ3d4ZHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzcxOTAsImV4cCI6MjEwNjExMzE5MH0.f4j5lwfBjwK1sY-yCC7TkFC-h6dHFusGOkrMAmCnbmI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EDGE_WALLET_URL = `${SUPABASE_URL}/functions/v1/crear-wallet`;

// ------------------------------------------------------------
// 2) DATOS DE PAGO DE MÉTODOS MANUALES
//    Edítalos con tus datos reales.
// ------------------------------------------------------------
const CONFIG_MANUAL = {
  transferencia: {
    titulo: "🏦 Transferencia bancaria",
    instrucciones: "Realiza la transferencia y guarda el comprobante.",
    datos: [
      { label: "Banco",   valor: "Banesco" },
      { label: "Titular", valor: "Josué Pérez" },
      { label: "Cédula",  valor: "V-00.000.000" },
      { label: "Cuenta",  valor: "0134-0000-00-0000000000" },
      { label: "Tipo",    valor: "Corriente" },
    ],
    campos: [
      { id: "referencia", label: "Número de referencia", type: "text", placeholder: "Ej: 123456789", required: true },
    ],
  },
  pago_movil: {
    titulo: "📱 Pago móvil",
    instrucciones: "Haz el pago móvil y guarda la captura del SMS/app.",
    datos: [
      { label: "Banco destino", valor: "Banesco" },
      { label: "Teléfono",      valor: "0414-000-0000" },
      { label: "Cédula",        valor: "V-00.000.000" },
      { label: "Titular",       valor: "Josué Pérez" },
    ],
    campos: [
      { id: "referencia", label: "Número de referencia", type: "text", placeholder: "Ej: 000123456", required: true },
      { id: "telefono_origen", label: "Teléfono desde el que pagaste (opcional)", type: "tel", placeholder: "0414-123-4567", required: false },
    ],
  },
  efectivo: {
    titulo: "💵 Pago en efectivo",
    instrucciones: "Coordina con el admin para entregar el efectivo en persona.",
    datos: [
      { label: "Contacto", valor: "Josué Pérez" },
      { label: "Teléfono", valor: "+53 56940021" },
      { label: "Zona",     valor: "A convenir con el admin" },
    ],
    campos: [
      { id: "notas", label: "Notas / disponibilidad", type: "textarea", placeholder: "Ej: Puedo pagar mañana a las 5pm", required: false },
    ],
  },
};

// ------------------------------------------------------------
// 3) Estado
// ------------------------------------------------------------
const estado = {
  usuario: null,
  perfil: null,
  suscripcion: null,
  saldo: 0,
  preciosPlan: {},          // { 1: 200, 3: 700, 6: 1200, 12: 2000 }
  tasaUsdt: 1,              // 1 USDT = X saldo
  planSaldoSeleccionado: null,
  metodoRecarga: null,      // 'cripto' | 'transferencia' | 'pago_movil' | 'efectivo'
  archivo: null,
  canalSaldo: null,
};

// ------------------------------------------------------------
// 4) Elementos
// ------------------------------------------------------------
const el = {};

function cachearElementos() {
  [
    "btn-volver","saldo-chip","saldo-chip-monto",
    "pantalla-cargando","pantalla-no-autorizado",
    "no-autorizado-titulo","no-autorizado-texto","btn-ir-login",
    "pantalla-principal","estado-suscripcion",
    "saldo-actual-display","info-tasa","info-tasa-linea",
    "grid-recarga-metodos","panel-recarga",
    "panel-cripto","panel-manual",
    "wallet-placeholder","btn-obtener-wallet",
    "wallet-card","wallet-address-text","copy-wallet-btn","wallet-qr-img",
    "manual-titulo","manual-datos",
    "form-recarga-manual","recarga-monto","manual-campos",
    "recarga-comprobante","recarga-error","recarga-exito",
    "grid-planes-saldo","btn-pagar-saldo",
    "pago-saldo-error","pago-saldo-exito",
    "lista-historial",
  ].forEach((id) => { el[id.replace(/-/g,"_")] = document.getElementById(id); });
}

function mostrarPantalla(id) {
  ["pantalla-cargando","pantalla-no-autorizado","pantalla-principal"]
    .forEach((p) => document.getElementById(p)?.classList.remove("activa"));
  document.getElementById(id)?.classList.add("activa");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setMensaje(id, texto) {
  const e = document.getElementById(id);
  if (e) e.textContent = texto || "";
}

function limpiarMensajes() {
  setMensaje("recarga-error", "");
  setMensaje("recarga-exito", "");
  setMensaje("pago-saldo-error", "");
  setMensaje("pago-saldo-exito", "");
}

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
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

// ------------------------------------------------------------
// 5) Inicio
// ------------------------------------------------------------
async function iniciar() {
  cachearElementos();
  conectarEventos();

  mostrarPantalla("pantalla-cargando");

  // Sesión
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    return noAutorizado("Inicia sesión primero en ALKILO y vuelve a esta página.");
  }
  estado.usuario = { id: session.user.id, email: session.user.email };

  // Perfil
  const { data: perfil } = await db
    .from("perfiles").select("*").eq("id", estado.usuario.id).maybeSingle();

  if (!perfil) return noAutorizado("No se encontró tu perfil. Vuelve a iniciar sesión.");
  estado.perfil = perfil;

  if (perfil.rol !== "chofer") {
    return noAutorizado("Esta sección es exclusiva para choferes.");
  }

  // Cargar datos
  await Promise.all([
    cargarSuscripcion(),
    cargarSaldo(),
    cargarConfiguracion(),
  ]);

  pintarEstadoSuscripcion();
  pintarSaldoEnUI();
  pintarPreciosPlanes();
  pintarInfoTasa();

  // Verificar wallet cripto existente
  await verificarWalletExistente();

  // Escuchar cambios de saldo
  suscribirSaldo();

  // Historial
  await cargarHistorial();

  mostrarPantalla("pantalla-principal");
}

function noAutorizado(mensaje) {
  setMensaje("no-autorizado-titulo", "No autorizado");
  setMensaje("no-autorizado-texto", mensaje);
  mostrarPantalla("pantalla-no-autorizado");
}

// ------------------------------------------------------------
// 6) Cargar datos
// ------------------------------------------------------------
async function cargarSuscripcion() {
  const { data } = await db
    .from("suscripciones").select("*")
    .eq("chofer_id", estado.usuario.id)
    .eq("estado", "activa")
    .gt("fecha_vencimiento", new Date().toISOString())
    .order("fecha_vencimiento", { ascending: false })
    .maybeSingle();
  estado.suscripcion = data || null;
}

async function cargarSaldo() {
  const { data } = await db
    .from("saldos").select("monto").eq("usuario_id", estado.usuario.id).maybeSingle();
  estado.saldo = Number(data?.monto || 0);
}

async function cargarConfiguracion() {
  // Precios de planes
  const { data: precios } = await db.rpc("obtener_precios_saldo");
  const plan = {};
  (precios || []).forEach((p) => { plan[Number(p.meses)] = Number(p.precio); });
  estado.preciosPlan = plan;

  // Tasa USDT
  const { data: tasas } = await db.rpc("obtener_tasas");
  const t = (tasas || []).find((x) => x.clave === "tasa_usdt_saldo");
  estado.tasaUsdt = Number(t?.valor || 1);
}

// ------------------------------------------------------------
// 7) Pintar UI
// ------------------------------------------------------------
function pintarEstadoSuscripcion() {
  const cont = el.estado_suscripcion;
  if (!cont) return;

  if (estado.suscripcion) {
    const venc = new Date(estado.suscripcion.fecha_vencimiento);
    const dias = Math.ceil((venc - new Date()) / 86400000);
    cont.className = "estado-suscripcion-card activa";
    cont.innerHTML = `
      <h3>✅ Suscripción activa</h3>
      <p class="info">Vence el <span class="fecha">${venc.toLocaleDateString("es-ES")}</span></p>
      <p class="info">Te quedan <strong>${dias} día${dias === 1 ? "" : "s"}</strong> de acceso.</p>
      <p class="info" style="font-size:0.83rem;color:#6b7280">
        Puedes extenderla activando otro plan cuando quieras.
      </p>
    `;
  } else {
    cont.className = "estado-suscripcion-card inactiva";
    cont.innerHTML = `
      <h3>⚠️ Sin suscripción activa</h3>
      <p class="info">No puedes ver ni aceptar solicitudes hasta activar tu plan.</p>
      <p class="info" style="font-size:0.83rem;color:#6b7280">
        Recarga saldo y activa tu plan abajo.
      </p>
    `;
  }
}

function pintarSaldoEnUI() {
  const montoTxt = "$" + estado.saldo.toFixed(2);
  if (el.saldo_chip_monto) el.saldo_chip_monto.textContent = montoTxt;
  if (el.saldo_chip) el.saldo_chip.classList.remove("oculto");
  if (el.saldo_actual_display) el.saldo_actual_display.textContent = montoTxt;
  actualizarBotonPagarSaldo();
}

function pintarInfoTasa() {
  if (el.info_tasa) {
    el.info_tasa.textContent = `1 USDT = ${estado.tasaUsdt.toFixed(2)} de saldo`;
  }
}

function pintarPreciosPlanes() {
  document.querySelectorAll("#grid-planes-saldo .plan").forEach((p) => {
    const meses = Number(p.getAttribute("data-meses"));
    const precio = estado.preciosPlan[meses];
    const precioEl = p.querySelector(".plan-precio");
    if (precioEl && precio != null) {
      precioEl.textContent = "$" + Number(precio).toFixed(2);
    }
  });
  actualizarBotonPagarSaldo();
}

function actualizarBotonPagarSaldo() {
  const btn = el.btn_pagar_saldo;
  if (!btn) return;

  if (!estado.planSaldoSeleccionado) {
    btn.disabled = true;
    btn.textContent = "💳 Pagar con saldo";
    return;
  }

  const precio = estado.preciosPlan[estado.planSaldoSeleccionado];
  if (precio == null) { btn.disabled = true; return; }

  if (estado.saldo < precio) {
    btn.disabled = true;
    btn.textContent = `Saldo insuficiente (faltan $${(precio - estado.saldo).toFixed(2)})`;
  } else {
    btn.disabled = false;
    btn.textContent = `💳 Pagar $${Number(precio).toFixed(2)} con saldo`;
  }
}

// ------------------------------------------------------------
// 8) Eventos
// ------------------------------------------------------------
function conectarEventos() {
  el.btn_volver?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  el.btn_ir_login?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  // Métodos de recarga
  document.querySelectorAll(".metodo-recarga").forEach((m) => {
    m.addEventListener("click", () => {
      document.querySelectorAll(".metodo-recarga").forEach((b) => b.classList.remove("activo"));
      m.classList.add("activo");
      estado.metodoRecarga = m.getAttribute("data-metodo");
      mostrarPanelRecarga();
    });
  });

  // Wallet cripto
  el.btn_obtener_wallet?.addEventListener("click", obtenerWallet);
  el.copy_wallet_btn?.addEventListener("click", copiarWallet);

  // Formulario manual
  el.form_recarga_manual?.addEventListener("submit", enviarRecargaManual);
  el.recarga_comprobante?.addEventListener("change", (e) => {
    estado.archivo = e.target.files?.[0] || null;
  });

  // Planes
  document.querySelectorAll("#grid-planes-saldo .plan").forEach((p) => {
    p.addEventListener("click", () => {
      document.querySelectorAll("#grid-planes-saldo .plan").forEach((b) => b.classList.remove("activo"));
      p.classList.add("activo");
      estado.planSaldoSeleccionado = Number(p.getAttribute("data-meses"));
      actualizarBotonPagarSaldo();
    });
  });

  // Pagar
  el.btn_pagar_saldo?.addEventListener("click", pagarConSaldo);
}

// ------------------------------------------------------------
// 9) Panel dinámico de recarga
// ------------------------------------------------------------
function mostrarPanelRecarga() {
  const panel = el.panel_recarga;
  const pCripto = el.panel_cripto;
  const pManual = el.panel_manual;

  if (!estado.metodoRecarga) { panel.classList.add("oculto"); return; }
  panel.classList.remove("oculto");
  limpiarMensajes();

  if (estado.metodoRecarga === "cripto") {
    pCripto.classList.remove("oculto");
    pManual.classList.add("oculto");
  } else {
    pCripto.classList.add("oculto");
    pManual.classList.remove("oculto");
    renderPanelManual(estado.metodoRecarga);
  }

  setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function renderPanelManual(metodo) {
  const cfg = CONFIG_MANUAL[metodo];
  if (!cfg) return;

  el.manual_titulo.textContent = cfg.titulo;

  const lineas = cfg.datos.map((d) => `
    <div class="linea">
      <span class="label">${escapar(d.label)}</span>
      <span class="valor">
        ${escapar(d.valor)}
        <button type="button" class="copy-btn" data-copy="${escapar(d.valor)}">Copiar</button>
      </span>
    </div>
  `).join("");

  el.manual_datos.innerHTML = `
    <p style="margin-bottom:8px;font-size:0.85rem">${escapar(cfg.instrucciones)}</p>
    ${lineas}
  `;

  const campos = cfg.campos.map((c) => {
    if (c.type === "textarea") {
      return `
        <label for="campo-${c.id}">${escapar(c.label)}</label>
        <textarea id="campo-${c.id}" data-campo="${c.id}" placeholder="${escapar(c.placeholder || "")}" ${c.required ? "required" : ""}></textarea>
      `;
    }
    return `
      <label for="campo-${c.id}">${escapar(c.label)}</label>
      <input type="${c.type}" id="campo-${c.id}" data-campo="${c.id}" placeholder="${escapar(c.placeholder || "")}" ${c.required ? "required" : ""} />
    `;
  }).join("");

  el.manual_campos.innerHTML = campos;

  // Botones copiar
  el.manual_datos.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
        const orig = btn.textContent;
        btn.textContent = "✓";
        setTimeout(() => (btn.textContent = orig), 1200);
      } catch {}
    });
  });
}

// ------------------------------------------------------------
// 10) Wallet cripto
// ------------------------------------------------------------
async function verificarWalletExistente() {
  const { data } = await db
    .from("wallets_cripto").select("direccion")
    .eq("usuario_id", estado.usuario.id)
    .eq("activa", true)
    .maybeSingle();

  if (data?.direccion) {
    mostrarWallet(data.direccion);
  }
}

async function obtenerWallet() {
  const btn = el.btn_obtener_wallet;
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando dirección...";

  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error("No hay sesión");

    const res = await fetch(EDGE_WALLET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token,
      },
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.wallet_address) {
      throw new Error(data.error || "No se pudo generar la dirección");
    }

    mostrarWallet(data.wallet_address);
  } catch (err) {
    alert("Error: " + (err?.message || err));
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function mostrarWallet(direccion) {
  el.wallet_placeholder?.classList.add("oculto");
  el.wallet_card?.classList.remove("oculto");
  if (el.wallet_address_text) el.wallet_address_text.textContent = direccion;

  if (el.wallet_qr_img) {
    el.wallet_qr_img.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(direccion);
  }
}

function copiarWallet() {
  const txt = el.wallet_address_text?.textContent || "";
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => {
    const btn = el.copy_wallet_btn;
    const orig = btn.textContent;
    btn.textContent = "✓ Copiado";
    setTimeout(() => (btn.textContent = orig), 1200);
  }).catch(() => alert("No se pudo copiar"));
}

// ------------------------------------------------------------
// 11) Enviar recarga manual
// ------------------------------------------------------------
async function enviarRecargaManual(e) {
  e.preventDefault();
  limpiarMensajes();

  if (!estado.usuario || !estado.metodoRecarga) return;

  const metodo = estado.metodoRecarga;
  if (metodo === "cripto") return; // no aplica aquí

  const cfg = CONFIG_MANUAL[metodo];
  if (!cfg) return;

  const montoPago = Number(el.recarga_monto.value);
  if (!montoPago || montoPago <= 0) {
    return setMensaje("recarga-error", "Indica el monto que pagaste.");
  }

  // Leer campos dinámicos
  const datos = {};
  for (const c of cfg.campos) {
    const input = el.manual_campos.querySelector(`[data-campo="${c.id}"]`);
    const val = input?.value?.trim() || "";
    if (c.required && !val)
      return setMensaje("recarga-error", `El campo "${c.label}" es obligatorio.`);
    datos[c.id] = val;
  }

  const boton = el.form_recarga_manual.querySelector("button[type=submit]");
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = "Enviando...";

  // Subir comprobante (opcional)
  let comprobanteUrl = null;
  if (estado.archivo) {
    if (estado.archivo.size > 4 * 1024 * 1024) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
      return setMensaje("recarga-error", "El comprobante no debe superar 4 MB.");
    }
    const ext = (estado.archivo.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `${estado.usuario.id}/${Date.now()}.${ext}`;

    const { error: errUp } = await db.storage
      .from("comprobantes")
      .upload(ruta, estado.archivo, { upsert: false, contentType: estado.archivo.type });

    if (errUp) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
      return setMensaje("recarga-error", "Error al subir comprobante: " + errUp.message);
    }

    const { data: pub } = db.storage.from("comprobantes").getPublicUrl(ruta);
    comprobanteUrl = pub?.publicUrl || null;
  }

  // Notas combinadas
  const notasPartes = [];
  if (datos.notas) notasPartes.push(datos.notas);
  if (datos.telefono_origen) notasPartes.push("Tel: " + datos.telefono_origen);

  // Insertar en solicitudes_pago
  // plan_meses se guarda como 1 (dummy) porque este modelo es de recarga, no de plan directo.
  const { error } = await db.from("solicitudes_pago").insert({
    chofer_id:       estado.usuario.id,
    plan_meses:      1,
    monto:           montoPago,
    metodo:          metodo,
    referencia:      datos.referencia || null,
    notas_chofer:    notasPartes.join(" | ") || null,
    comprobante_url: comprobanteUrl,
    estado:          "pendiente",
  });

  boton.disabled = false;
  boton.textContent = textoOriginal;

  if (error) return setMensaje("recarga-error", traducirError(error.message));

  setMensaje("recarga-exito", "✅ Enviado. El admin lo revisará y acreditará tu saldo.");

  // Reset
  el.form_recarga_manual.reset();
  estado.archivo = null;

  await cargarHistorial();
}

// ------------------------------------------------------------
// 12) Pagar con saldo
// ------------------------------------------------------------
async function pagarConSaldo() {
  limpiarMensajes();

  if (!estado.planSaldoSeleccionado) return;

  const precio = estado.preciosPlan[estado.planSaldoSeleccionado];
  if (precio == null) return setMensaje("pago-saldo-error", "Precio no disponible.");
  if (estado.saldo < precio) return setMensaje("pago-saldo-error", "Saldo insuficiente.");

  const ok = confirm(
    `¿Pagar $${precio.toFixed(2)} con tu saldo para activar ${estado.planSaldoSeleccionado} mes(es)?`
  );
  if (!ok) return;

  const btn = el.btn_pagar_saldo;
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Procesando...";

  const { error } = await db.rpc("pagar_suscripcion_con_saldo", {
    p_plan_meses: estado.planSaldoSeleccionado,
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = textoOriginal;
    return setMensaje("pago-saldo-error", traducirError(error.message));
  }

  setMensaje("pago-saldo-exito", "✅ ¡Suscripción activada!");

  // Recargar
  await Promise.all([cargarSuscripcion(), cargarSaldo()]);
  pintarEstadoSuscripcion();
  pintarSaldoEnUI();

  // Reset
  estado.planSaldoSeleccionado = null;
  document.querySelectorAll("#grid-planes-saldo .plan").forEach((b) => b.classList.remove("activo"));
  actualizarBotonPagarSaldo();

  await cargarHistorial();
}

// ------------------------------------------------------------
// 13) Realtime: saldo
// ------------------------------------------------------------
function suscribirSaldo() {
  if (estado.canalSaldo) return;

  estado.canalSaldo = db
    .channel("saldo-live-" + estado.usuario.id)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "saldos", filter: `usuario_id=eq.${estado.usuario.id}` },
      (payload) => {
        const nuevo = Number(payload.new?.monto || 0);
        if (nuevo !== estado.saldo) {
          estado.saldo = nuevo;
          pintarSaldoEnUI();
          actualizarBotonPagarSaldo();
        }
      }
    )
    .subscribe((status) => console.log("[Realtime saldo]", status));
}

// ------------------------------------------------------------
// 14) Historial
// ------------------------------------------------------------
async function cargarHistorial() {
  const cont = el.lista_historial;
  if (!cont || !estado.usuario) return;
  cont.innerHTML = '<p class="vacio">Cargando...</p>';

  const { data, error } = await db
    .from("solicitudes_pago").select("*")
    .eq("chofer_id", estado.usuario.id)
    .order("creado_en", { ascending: false })
    .limit(30);

  if (error) {
    cont.innerHTML = `<p class="vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="vacio">Aún no has enviado solicitudes de recarga.</p>';
    return;
  }

  cont.innerHTML = "";
  data.forEach((s) => cont.appendChild(renderHistorial(s)));
}

function renderHistorial(s) {
  const div = document.createElement("div");
  div.className = "tarjeta-historial";

  const metodos = {
    transferencia: "🏦 Transferencia",
    pago_movil:    "📱 Pago móvil",
    efectivo:      "💵 Efectivo",
  };

  // Nota: si en el futuro diferencias recargas de pagos de plan, ajusta aquí.
  const esRecarga = s.metodo !== "cripto_auto" && s.plan_meses === 1;

  div.innerHTML = `
    <div class="fila-superior">
      <span class="plan">${esRecarga ? "Recarga de saldo" : `Plan ${s.plan_meses} mes(es)`}</span>
      <span class="badge-estado-pago ${s.estado}">${s.estado}</span>
    </div>
    <div class="meta">
      <span class="monto">$${Number(s.monto).toFixed(2)}</span>
      · <span>${escapar(metodos[s.metodo] || s.metodo)}</span>
    </div>
    <div class="meta">${formatearFecha(s.creado_en)}</div>
    ${s.referencia ? `<div class="meta">Ref: ${escapar(s.referencia)}</div>` : ""}
    ${s.notas_admin ? `<div class="nota-admin">Admin: ${escapar(s.notas_admin)}</div>` : ""}
  `;

  return div;
}

// ------------------------------------------------------------
// 15) Traducir errores
// ------------------------------------------------------------
function traducirError(msg) {
  if (!msg) return "Ocurrió un error inesperado.";
  const m = msg.toLowerCase();
  if (m.includes("saldo insuficiente"))    return "Saldo insuficiente para este plan.";
  if (m.includes("precio no configurado")) return "El precio de ese plan no está configurado.";
  if (m.includes("no autenticado"))        return "Inicia sesión de nuevo.";
  if (m.includes("row-level security") || m.includes("new row violates"))
    return "No tienes permiso para esta acción.";
  if (m.includes("duplicate")) return "Ya existe un registro igual.";
  return msg;
}

// ------------------------------------------------------------
// 16) Arrancar
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", iniciar);