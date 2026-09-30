/* ============================================================
   ALKILO - Módulo de Referidos
   Sistema de códigos de invitación y comisiones
   Se carga DESPUÉS de app.js
   ============================================================ */

/** Carga código, stats y lista de comisiones del usuario actual */
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

document.addEventListener("DOMContentLoaded", inicializarReferidos);