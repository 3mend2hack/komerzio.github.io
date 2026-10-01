/* ============================================================
   ALKILO - Módulo de Plan Cliente Premium
   Se carga DESPUÉS de app.js
   Usa variables globales: db, estado, el, mostrarPantalla
   ============================================================ */

// ------------------------------------------------------------
// 1) Cargar la pantalla del Plan Premium
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 2) Comprar / renovar el plan
// ------------------------------------------------------------
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
  // Actualizar el saldo del perfil (función global de app.js)
  if (typeof window.cargarSaldo === "function") await window.cargarSaldo();
  pintarBannerPremium();
}

// ------------------------------------------------------------
// 3) Banner del perfil (avisa cuando vence pronto)
// ------------------------------------------------------------
function pintarBannerPremium() {
  const b = el.perfil_banner_premium;
  if (!b) return;
  if (estado.perfil?.rol !== "cliente") {
    b.classList.add("oculto");
    b.style.display = "none";
    return;
  }

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

// Exponer para que app.js lo pueda llamar
window.cargarPlanPremium = cargarPlanPremium;
window.comprarPlanPremium = comprarPlanPremium;
window.pintarBannerPremium = pintarBannerPremium;

// ------------------------------------------------------------
// 4) Inicializar: engancha los botones del Plan Premium
// ------------------------------------------------------------
function inicializarPremium() {
  // Botón "⭐ Plan Premium" en el perfil
  document.getElementById("btn-ir-plan-premium")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-plan-premium");
    cargarPlanPremium();
  });

  // Banner de vencimiento próximo → abre la pantalla también
  document.getElementById("perfil-banner-premium")?.addEventListener("click", () => {
    mostrarPantalla("pantalla-plan-premium");
    cargarPlanPremium();
  });

  // Botón principal de compra
  document.getElementById("btn-comprar-premium")?.addEventListener("click", comprarPlanPremium);
}

document.addEventListener("DOMContentLoaded", inicializarPremium);