/* ============================================================
   ALKILO - Módulo de Notificaciones Push
   Con toggle activar/desactivar + rotación de VAPID
   ============================================================ */

// Clave pública VAPID
const VAPID_PUBLIC_KEY = "BL2UobDv1uAIQp0HLwJBgTNtig1OKvPo-o05wd87l6go2dQqsb7oorCnIhtbuuwb2is_FeejuybvJW-DJQvubbM";

// ------------------------------------------------------------
// Utilidades internas
// ------------------------------------------------------------

function vapidKeyToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function soportaPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function obtenerRegistroSW() {
  return navigator.serviceWorker.register("./sw.js");
}

async function obtenerSuscripcionActual() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// ------------------------------------------------------------
// Guardar suscripción en BD (maneja endpoint duplicado)
// ------------------------------------------------------------
async function guardarSuscripcionEnBD(suscripcion) {
  const json = suscripcion.toJSON();
  const uid = estado.usuario.id;

  // 1) ¿Ya existe una fila con ese endpoint?
  const { data: existente } = await db
    .from("push_subscriptions")
    .select("id, usuario_id")
    .eq("endpoint", json.endpoint)
    .maybeSingle();

  if (existente) {
    const { error } = await db
      .from("push_subscriptions")
      .update({
        usuario_id: uid,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: (navigator.userAgent || "").slice(0, 200),
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", existente.id);

    if (error) throw error;
    return;
  }

  // 2) Insertar nueva
  const { error } = await db.from("push_subscriptions").insert({
    usuario_id: uid,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: (navigator.userAgent || "").slice(0, 200),
  });

  if (error) throw error;
}

// ------------------------------------------------------------
// Flujo: activar notificaciones
// ------------------------------------------------------------
async function activarNotificaciones() {
  if (!estado.usuario) {
    alert("Inicia sesión primero.");
    return;
  }
  if (!soportaPush()) {
    alert("Tu navegador no soporta notificaciones push.");
    return;
  }

  const btn = document.getElementById("btn-activar-notificaciones");
  const original = btn?.textContent || "🔔 Activar notificaciones";
  if (btn) { btn.disabled = true; btn.textContent = "Activando..."; }

  try {
    // 1) Pedir permiso
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      alert("No diste permiso. Puedes activarlo desde los ajustes del navegador.");
      return;
    }

    // ⭐ 2) DESREGISTRAR TODOS LOS SERVICE WORKERS
    // Esto fuerza a Chrome a soltar la suscripción vieja cacheada
    // (crítico cuando se regeneran las claves VAPID).
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      try { await r.unregister(); } catch (e) { console.warn("[push] unregister:", e); }
    }

    // ⭐ 3) También cancelar cualquier suscripción push colgada
    try {
      const regTemp = await navigator.serviceWorker.ready;
      const subTemp = await regTemp.pushManager.getSubscription();
      if (subTemp) await subTemp.unsubscribe();
    } catch { /* ignore */ }

    // 4) Esperar a que el navegador limpie todo
    await new Promise((r) => setTimeout(r, 800));

    // 5) Registrar el SW de nuevo (fresco)
    await navigator.serviceWorker.register("./sw.js");
    const reg = await navigator.serviceWorker.ready;

    // 6) Crear suscripción NUEVA con la clave pública actual
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToUint8Array(VAPID_PUBLIC_KEY),
    });

    // 7) Guardar en Supabase
    await guardarSuscripcionEnBD(sub);

    // 8) Notificación de prueba
    try {
      await db.functions.invoke("enviar-push", {
        body: {
          usuario_id: estado.usuario.id,
          title: "ALKILO",
          cuerpo: "¡Notificaciones activadas! 🎉",
          url: "/ALKILO/",
          tag: "test-inicial",
        },
      });
    } catch (errTest) {
      console.warn("[push] la notificación de prueba falló:", errTest);
    }

    alert("🔔 ¡Notificaciones activadas!");
  } catch (err) {
    console.error("[push] error al activar:", err);
    alert("No se pudieron activar las notificaciones:\n" + (err?.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
    await actualizarEstadoBotonNotificaciones();
  }
}

// ------------------------------------------------------------
// Flujo: desactivar notificaciones
// ------------------------------------------------------------
async function desactivarNotificaciones() {
  if (!estado.usuario) return;

  const confirmar = confirm("¿Desactivar notificaciones push en este dispositivo?");
  if (!confirmar) return;

  const btn = document.getElementById("btn-activar-notificaciones");
  const original = btn?.textContent || "✅ Notificaciones activas";
  if (btn) { btn.disabled = true; btn.textContent = "Desactivando..."; }

  try {
    const sub = await obtenerSuscripcionActual();
    if (sub) {
      const json = sub.toJSON();
      await db.from("push_subscriptions")
        .delete()
        .eq("endpoint", json.endpoint);
      await sub.unsubscribe();
    }

    alert("🔕 Notificaciones desactivadas en este dispositivo.");
  } catch (err) {
    console.error("[push] error al desactivar:", err);
    alert("Error al desactivar: " + (err?.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
    await actualizarEstadoBotonNotificaciones();
  }
}

// ------------------------------------------------------------
// Estado visual del botón
// ------------------------------------------------------------
async function actualizarEstadoBotonNotificaciones() {
  const btn = document.getElementById("btn-activar-notificaciones");
  if (!btn) return;

  if (!soportaPush()) {
    btn.textContent = "🔔 No disponible en este navegador";
    btn.disabled = true;
    return;
  }

  if (Notification.permission === "denied") {
    btn.textContent = "🔕 Notificaciones bloqueadas";
    btn.disabled = true;
    return;
  }

  try {
    const sub = await obtenerSuscripcionActual();
    if (sub && estado.usuario) {
      const json = sub.toJSON();
      const { data } = await db.from("push_subscriptions")
        .select("usuario_id")
        .eq("endpoint", json.endpoint)
        .maybeSingle();

      if (data && data.usuario_id === estado.usuario.id) {
        btn.textContent = "✅ Notificaciones activas (toca para desactivar)";
        btn.disabled = false;
        btn.dataset.modo = "desactivar";
      } else {
        btn.textContent = "🔔 Activar notificaciones";
        btn.disabled = false;
        btn.dataset.modo = "activar";
      }
    } else {
      btn.textContent = "🔔 Activar notificaciones";
      btn.disabled = false;
      btn.dataset.modo = "activar";
    }
  } catch {
    btn.textContent = "🔔 Activar notificaciones";
    btn.disabled = false;
    btn.dataset.modo = "activar";
  }
}

// ------------------------------------------------------------
// Click handler (toggle)
// ------------------------------------------------------------
async function alternarNotificaciones() {
  const btn = document.getElementById("btn-activar-notificaciones");
  const modo = btn?.dataset.modo || "activar";
  if (modo === "desactivar") {
    await desactivarNotificaciones();
  } else {
    await activarNotificaciones();
  }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function inicializarNotificaciones() {
  const btn = document.getElementById("btn-activar-notificaciones");
  if (btn) {
    btn.dataset.modo = "activar";
    btn.addEventListener("click", alternarNotificaciones);
  }

  setTimeout(actualizarEstadoBotonNotificaciones, 1500);
}

document.addEventListener("DOMContentLoaded", inicializarNotificaciones);
