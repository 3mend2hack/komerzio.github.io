/* ============================================================
   ALKILO - Lógica de la página de suscripción y recargas
   Con compresor + datos bancarios + pago móvil
   + Ocultar planes de suscripción para clientes
   ============================================================ */

// ------------------------------------------------------------
// 1) Cliente Supabase
// ------------------------------------------------------------
const SUPABASE_URL = "https://ghuvgtgykyoovkgwxduc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodXZndGd5a3lvb3ZrZ3d4ZHVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzcxOTAsImV4cCI6MjEwNjExMzE5MH0.f4j5lwfBjwK1sY-yCC7TkFC-h6dHFusGOkrMAmCnbmI";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// 2) Estado local
// ------------------------------------------------------------
const susEstado = {
  usuario: null,
  perfil: null,
  saldo: 0,
  planSeleccionado: 0,
  precios: { 1: 0, 3: 0, 6: 0, 12: 0 },
  metodoActivo: "usdt",
};

// ------------------------------------------------------------
// 3) Utilidades generales
// ------------------------------------------------------------
function mostrarPantalla(id) {
  ["pantalla-cargando", "pantalla-no-autorizado", "pantalla-principal"]
    .forEach((p) => document.getElementById(p)?.classList.remove("activa"));
  document.getElementById(id)?.classList.add("activa");
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setMensaje(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto || "";
}

function setBotonCargando(btn, cargando, textoOriginal) {
  if (!btn) return;
  btn.disabled = cargando;
  btn.textContent = cargando ? "Procesando..." : textoOriginal;
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
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return ""; }
}

function formatearPrecio(n) {
  return "$" + Number(n || 0).toFixed(2);
}

/**
 * Copia el texto de cualquier elemento (por ID) al portapapeles.
 * @param {string} idElemento - ID del elemento del que copiar el textContent
 * @param {string} etiquetaHumana - Nombre para el mensaje de confirmación
 */
async function copiarDeElemento(idElemento, etiquetaHumana = "Valor") {
  const el = document.getElementById(idElemento);
  const texto = el?.textContent?.trim();
  if (!texto || texto === "—") {
    alert("Aún no hay " + etiquetaHumana.toLowerCase() + " configurado.");
    return;
  }
  try {
    await navigator.clipboard.writeText(texto);
    alert("✅ " + etiquetaHumana + " copiado: " + texto);
  } catch {
    alert(etiquetaHumana + ":\n" + texto);
  }
}

// ------------------------------------------------------------
// 4) COMPRESOR DE IMÁGENES
// ------------------------------------------------------------
function comprimirImagen(archivo, maxAncho = 1200, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    if (!archivo.type.startsWith("image/")) {
      resolve({ blob: archivo, nombre: archivo.name, tipo: archivo.type });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;

        if (ancho > maxAncho) {
          alto = Math.round((alto * maxAncho) / ancho);
          ancho = maxAncho;
        }

        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, ancho, alto);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("No se pudo comprimir la imagen"));
              return;
            }
            const nombreBase = archivo.name.replace(/\.[^.]+$/, "") || "imagen";
            resolve({
              blob,
              nombre: `${nombreBase}.jpg`,
              tipo: "image/jpeg",
            });
          },
          "image/jpeg",
          calidad
        );
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(archivo);
  });
}

// ------------------------------------------------------------
// 5) Init
// ------------------------------------------------------------
async function iniciar() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    mostrarPantalla("pantalla-no-autorizado");
    return;
  }
  susEstado.usuario = { id: session.user.id, email: session.user.email };

  const { data: perfil } = await db.from("perfiles").select("*")
    .eq("id", susEstado.usuario.id).maybeSingle();
  if (!perfil) {
    mostrarPantalla("pantalla-no-autorizado");
    return;
  }
  susEstado.perfil = perfil;

  // ⭐ Si NO es chofer, ocultar la sección de planes de suscripción
  // y cambiar el título de la cabecera
  if (perfil.rol !== "chofer") {
    document.getElementById("bloque-planes-chofer")?.classList.add("oculto");
    const titulo = document.getElementById("sus-titulo-cabecera");
    if (titulo) titulo.textContent = "Mi saldo";
  }

  conectarEventos();

  await Promise.all([
    cargarSaldo(),
    cargarPrecios(),
    cargarSuscripcionActual(),
    cargarHistorialRecargas(),
    cargarDireccionUSDT(),
    cargarDatosDestino(),
  ]);

  mostrarPantalla("pantalla-principal");
}

// ------------------------------------------------------------
// 6) Conectar eventos
// ------------------------------------------------------------
function conectarEventos() {
  document.getElementById("btn-volver")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  document.getElementById("btn-ir-login")?.addEventListener("click", () => {
    window.location.href = "../index.html";
  });

  document.querySelectorAll("#grid-planes .sus-plan").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#grid-planes .sus-plan").forEach((b) => b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      susEstado.planSeleccionado = Number(btn.getAttribute("data-meses"));
      actualizarBotonComprar();
    });
  });

  document.getElementById("btn-comprar-suscripcion")?.addEventListener("click", comprarSuscripcionConSaldo);

  document.querySelectorAll("#tabs-metodos .sus-tab").forEach((tab) => {
    tab.addEventListener("click", () => cambiarMetodo(tab.getAttribute("data-metodo")));
  });

  document.getElementById("btn-copiar-usdt")?.addEventListener("click", copiarDireccionUSDT);
  document.getElementById("btn-generar-wallet")?.addEventListener("click", generarWalletUSDT);

  document.querySelectorAll(".btn-enviar-recarga").forEach((btn) => {
    btn.addEventListener("click", () => enviarRecargaManual(btn.getAttribute("data-metodo")));
  });

  // Botones inline de copiar (transferencia + pago móvil)
  document.querySelectorAll(".sus-btn-copiar-inline").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idObjetivo = btn.getAttribute("data-copiar");
      const etiquetas = {
        "transf-tarjeta": "Número de tarjeta",
        "transf-confirmar": "Número a confirmar",
        "pagomovil-telefono": "Teléfono",
      };
      copiarDeElemento(idObjetivo, etiquetas[idObjetivo] || "Valor");
    });
  });
}

// ------------------------------------------------------------
// 7) Cargar saldo
// ------------------------------------------------------------
async function cargarSaldo() {
  const { data } = await db.from("saldos").select("monto")
    .eq("usuario_id", susEstado.usuario.id).maybeSingle();
  susEstado.saldo = Number(data?.monto || 0);

  const el = document.getElementById("saldo-actual");
  if (el) el.textContent = formatearPrecio(susEstado.saldo);
}

// ------------------------------------------------------------
// 8) Cargar precios de los planes
// ------------------------------------------------------------
async function cargarPrecios() {
  const { data } = await db.from("configuracion")
    .select("clave, valor")
    .in("clave", [
      "precio_saldo_1mes",
      "precio_saldo_3meses",
      "precio_saldo_6meses",
      "precio_saldo_12meses",
    ]);

  const cfg = {};
  (data || []).forEach((c) => { cfg[c.clave] = Number(c.valor) || 0; });

  susEstado.precios = {
    1: cfg["precio_saldo_1mes"] || 0,
    3: cfg["precio_saldo_3meses"] || 0,
    6: cfg["precio_saldo_6meses"] || 0,
    12: cfg["precio_saldo_12meses"] || 0,
  };

  const el1 = document.getElementById("precio-1");
  const el3 = document.getElementById("precio-3");
  const el6 = document.getElementById("precio-6");
  const el12 = document.getElementById("precio-12");

  if (el1) el1.textContent = formatearPrecio(susEstado.precios[1]);
  if (el3) el3.textContent = formatearPrecio(susEstado.precios[3]);
  if (el6) el6.textContent = formatearPrecio(susEstado.precios[6]);
  if (el12) el12.textContent = formatearPrecio(susEstado.precios[12]);
}

// ------------------------------------------------------------
// 8b) Cargar datos bancarios y pago móvil
// ------------------------------------------------------------
async function cargarDatosDestino() {
  const { data } = await db.from("configuracion")
    .select("clave, valor")
    .in("clave", [
      "transf_banco",
      "transf_numero_tarjeta",
      "transf_numero_confirmar",
      "pagomovil_telefono",
    ]);

  const cfg = {};
  (data || []).forEach((c) => { cfg[c.clave] = c.valor; });

  const setTexto = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor || "—";
  };

  setTexto("transf-banco",     cfg["transf_banco"]);
  setTexto("transf-tarjeta",   cfg["transf_numero_tarjeta"]);
  setTexto("transf-confirmar", cfg["transf_numero_confirmar"]);
  setTexto("pagomovil-telefono", cfg["pagomovil_telefono"]);
}

// ------------------------------------------------------------
// 9) Cargar suscripción actual (solo choferes)
// ------------------------------------------------------------
async function cargarSuscripcionActual() {
  if (susEstado.perfil?.rol !== "chofer") return;

  const { data: susc } = await db.from("suscripciones").select("*")
    .eq("chofer_id", susEstado.usuario.id)
    .eq("estado", "activa")
    .gt("fecha_vencimiento", new Date().toISOString())
    .order("fecha_vencimiento", { ascending: false })
    .maybeSingle();

  const bloque = document.getElementById("bloque-suscripcion-actual");
  const titulo = document.getElementById("sus-estado-titulo");
  const fecha = document.getElementById("sus-estado-fecha");
  const emoji = document.getElementById("sus-estado-emoji");

  if (!bloque) return;

  if (susc) {
    const venc = new Date(susc.fecha_vencimiento);
    const dias = Math.ceil((venc - new Date()) / 86400000);
    bloque.classList.remove("oculto", "expirada");
    if (emoji) emoji.textContent = "✅";
    if (titulo) titulo.textContent = `Suscripción activa · ${dias} día${dias === 1 ? "" : "s"}`;
    if (fecha) fecha.textContent = `Vence el ${venc.toLocaleDateString("es-ES")}`;
  } else {
    const { data: ultima } = await db.from("suscripciones").select("*")
      .eq("chofer_id", susEstado.usuario.id)
      .order("fecha_vencimiento", { ascending: false })
      .limit(1).maybeSingle();

    if (ultima) {
      bloque.classList.remove("oculto");
      bloque.classList.add("expirada");
      if (emoji) emoji.textContent = "⚠️";
      if (titulo) titulo.textContent = "Suscripción expirada";
      if (fecha) fecha.textContent = "Renuévala para seguir aceptando servicios";
    } else {
      bloque.classList.add("oculto");
    }
  }
}

// ------------------------------------------------------------
// 10) Actualizar botón de comprar
// ------------------------------------------------------------
function actualizarBotonComprar() {
  const btn = document.getElementById("btn-comprar-suscripcion");
  if (!btn) return;

  const meses = susEstado.planSeleccionado;
  const precio = susEstado.precios[meses] || 0;

  if (!meses) {
    btn.disabled = true;
    btn.textContent = "💳 Selecciona un plan";
    return;
  }

  if (susEstado.saldo < precio) {
    btn.disabled = true;
    btn.textContent = `💳 Sin saldo suficiente (${formatearPrecio(precio)})`;
    return;
  }

  btn.disabled = false;
  btn.textContent = `💳 Pagar ${formatearPrecio(precio)} con saldo`;
}

// ------------------------------------------------------------
// 11) Comprar suscripción con saldo
// ------------------------------------------------------------
async function comprarSuscripcionConSaldo() {
  setMensaje("compra-error", "");
  setMensaje("compra-exito", "");

  const meses = susEstado.planSeleccionado;
  const precio = susEstado.precios[meses] || 0;

  if (!meses || !precio) {
    setMensaje("compra-error", "Selecciona un plan primero.");
    return;
  }
  if (susEstado.saldo < precio) {
    setMensaje("compra-error", "Saldo insuficiente. Recarga primero.");
    return;
  }

  if (!confirm(`¿Comprar ${meses} mes${meses === 1 ? "" : "es"} por ${formatearPrecio(precio)}?`)) return;

  const btn = document.getElementById("btn-comprar-suscripcion");
  setBotonCargando(btn, true, "Procesando...");

  const { data, error } = await db.rpc("pagar_suscripcion_con_saldo", {
    p_plan_meses: meses,
  });

  if (btn) setBotonCargando(btn, false, "💳 Comprar con saldo");

  if (error) {
    setMensaje("compra-error", "Error: " + error.message);
    return;
  }

  setMensaje("compra-exito", "✅ ¡Suscripción activada! Redirigiendo…");

  await cargarSaldo();
  await cargarSuscripcionActual();

  setTimeout(() => {
    window.location.href = "../index.html";
  }, 1500);
}

// ------------------------------------------------------------
// 12) Cambio de método
// ------------------------------------------------------------
function cambiarMetodo(metodo) {
  susEstado.metodoActivo = metodo;

  document.querySelectorAll("#tabs-metodos .sus-tab").forEach((tab) => {
    tab.classList.toggle("activo", tab.getAttribute("data-metodo") === metodo);
  });

  ["usdt", "transferencia", "pago_movil", "efectivo"].forEach((m) => {
    const bloque = document.getElementById("form-" + m);
    if (bloque) bloque.classList.toggle("oculto", m !== metodo);
  });

  setMensaje("recarga-error", "");
  setMensaje("recarga-exito", "");
}

// ------------------------------------------------------------
// 13) USDT — cargar dirección / generar wallet
// ------------------------------------------------------------
async function cargarDireccionUSDT() {
  const input = document.getElementById("usdt-direccion");
  const estado = document.getElementById("wallet-estado");
  if (!input) return;

  const { data } = await db.from("wallets_cripto")
    .select("direccion, red, activa")
    .eq("usuario_id", susEstado.usuario.id)
    .eq("activa", true)
    .limit(1)
    .maybeSingle();

  if (data?.direccion) {
    input.value = data.direccion;
    if (estado) estado.textContent = `Red: ${data.red || "BEP20"}`;
    const btnGen = document.getElementById("btn-generar-wallet");
    if (btnGen) btnGen.classList.add("oculto");
  } else {
    input.value = "";
    input.placeholder = "Toca 'Generar dirección' para crear tu wallet USDT";
    if (estado) estado.textContent = "";
  }
}

async function copiarDireccionUSDT() {
  const input = document.getElementById("usdt-direccion");
  const dir = input?.value?.trim();
  if (!dir) {
    alert("Aún no tienes dirección USDT. Toca 'Generar dirección' primero.");
    return;
  }
  try {
    await navigator.clipboard.writeText(dir);
    alert("✅ Dirección copiada: " + dir);
  } catch {
    alert("Tu dirección es:\n" + dir);
  }
}

async function generarWalletUSDT() {
  const input = document.getElementById("usdt-direccion");
  const estado = document.getElementById("wallet-estado");
  const btn = document.getElementById("btn-generar-wallet");

  if (input?.value) {
    alert("Ya tienes una dirección USDT asociada.");
    return;
  }

  if (btn) setBotonCargando(btn, true, "Generando...");
  if (estado) estado.textContent = "Creando tu dirección única en la red BEP20…";

  try {
    const { error } = await db.functions.invoke("crear-wallet", {
      body: {},
    });

    if (error) throw error;

    await cargarDireccionUSDT();

    if (!input?.value) {
      if (estado) estado.textContent = "No se recibió dirección. Intenta de nuevo.";
    }
  } catch (err) {
    console.error("[wallet] error:", err);
    if (estado) estado.textContent = "Error al generar. Intenta más tarde.";
    alert("No se pudo generar la dirección:\n" + (err?.message || err));
  } finally {
    if (btn) setBotonCargando(btn, false, "🔄 Generar dirección");
  }
}

// ------------------------------------------------------------
// 14) Enviar recarga manual — CON COMPRESOR
// ------------------------------------------------------------
async function enviarRecargaManual(metodo) {
  setMensaje("recarga-error", "");
  setMensaje("recarga-exito", "");

  const prefijo = metodo === "transferencia" ? "tr"
    : metodo === "pago_movil" ? "pm"
    : "ef";

  const montoInput = document.getElementById(prefijo + "-monto");
  const referenciaInput = document.getElementById(prefijo + "-referencia");
  const comprobanteInput = document.getElementById(prefijo + "-comprobante");
  const notasInput = document.getElementById(prefijo + "-notas");

  const monto = Number(montoInput?.value || 0);
  const referencia = (referenciaInput?.value || "").trim() || null;
  const archivoOriginal = comprobanteInput?.files?.[0] || null;
  const notas = (notasInput?.value || "").trim() || null;

  if (!monto || monto <= 0) {
    setMensaje("recarga-error", "Ingresa un monto válido.");
    return;
  }
  if (metodo !== "efectivo" && !referencia) {
    setMensaje("recarga-error", "Ingresa el número de referencia.");
    return;
  }
  if (metodo !== "efectivo" && !archivoOriginal) {
    setMensaje("recarga-error", "Sube una foto del comprobante.");
    return;
  }

  const btn = document.querySelector(`.btn-enviar-recarga[data-metodo="${metodo}"]`);
  const textoOriginal = btn?.textContent || "Enviar";
  setBotonCargando(btn, true, "Comprimiendo…");

  let comprobanteUrl = null;

  if (archivoOriginal) {
    try {
      const comprimido = await comprimirImagen(archivoOriginal, 1200, 0.75);
      const ruta = `${susEstado.usuario.id}/${Date.now()}.jpg`;

      const pesoOriginalKB = Math.round(archivoOriginal.size / 1024);
      const pesoComprimidoKB = Math.round(comprimido.blob.size / 1024);
      setBotonCargando(btn, true, `Subiendo (${pesoComprimidoKB} KB)…`);
      console.log(`[compresor] original: ${pesoOriginalKB} KB → comprimido: ${pesoComprimidoKB} KB`);

      const { error: errUp } = await db.storage
        .from("comprobantes")
        .upload(ruta, comprimido.blob, {
          upsert: true,
          contentType: comprimido.tipo,
        });

      if (errUp) throw errUp;

      const { data: pub } = db.storage.from("comprobantes").getPublicUrl(ruta);
      comprobanteUrl = pub?.publicUrl || null;
    } catch (errComp) {
      console.error("[comprobante] error:", errComp);
      setBotonCargando(btn, false, textoOriginal);
      setMensaje("recarga-error", "Error al procesar la imagen: " + (errComp?.message || errComp));
      return;
    }
  }

  setBotonCargando(btn, true, "Enviando…");

  const { error: errIns } = await db.from("solicitudes_pago").insert({
    chofer_id: susEstado.usuario.id,
    plan_meses: 1,
    monto: monto,
    metodo: metodo,
    referencia: referencia,
    comprobante_url: comprobanteUrl,
    notas_chofer: notas,
    estado: "pendiente",
  });

  setBotonCargando(btn, false, textoOriginal);

  if (errIns) {
    setMensaje("recarga-error", "Error al enviar: " + errIns.message);
    return;
  }

  setMensaje("recarga-exito", "✅ Solicitud enviada. El admin la aprobará pronto.");

  if (montoInput) montoInput.value = "";
  if (referenciaInput) referenciaInput.value = "";
  if (comprobanteInput) comprobanteInput.value = "";
  if (notasInput) notasInput.value = "";

  setTimeout(cargarHistorialRecargas, 1000);
}

// ------------------------------------------------------------
// 15) Historial de recargas
// ------------------------------------------------------------
async function cargarHistorialRecargas() {
  const cont = document.getElementById("lista-recargas");
  if (!cont) return;
  cont.innerHTML = '<p class="sus-vacio">Cargando…</p>';

  const { data, error } = await db.from("solicitudes_pago")
    .select("id, monto, metodo, estado, notas_admin, notas_chofer, creado_en")
    .eq("chofer_id", susEstado.usuario.id)
    .order("creado_en", { ascending: false })
    .limit(30);

  if (error) {
    cont.innerHTML = `<p class="sus-vacio">Error: ${escapar(error.message)}</p>`;
    return;
  }
  if (!data || data.length === 0) {
    cont.innerHTML = '<p class="sus-vacio">Aún no has hecho recargas.</p>';
    return;
  }

  const ETIQ_METODO = {
    transferencia: "🏦 Transferencia",
    pago_movil: "📱 Pago móvil",
    efectivo: "💵 Efectivo",
    cripto: "₿ Cripto (USDT)",
  };

  cont.innerHTML = "";
  data.forEach((r) => {
    const card = document.createElement("div");
    card.className = "sus-card-recarga";
    card.innerHTML = `
      <div class="fila">
        <span class="metodo">${escapar(ETIQ_METODO[r.metodo] || r.metodo)}</span>
        <span class="monto">${formatearPrecio(r.monto)}</span>
      </div>
      <div class="fila">
        <span class="fecha">${formatearFecha(r.creado_en)}</span>
        <span class="sus-badge-estado ${r.estado}">${escapar(r.estado)}</span>
      </div>
      ${r.notas_admin ? `<div class="notas">Admin: ${escapar(r.notas_admin)}</div>` : ""}
    `;
    cont.appendChild(card);
  });
}

// ------------------------------------------------------------
// 16) Arrancar
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", iniciar);
