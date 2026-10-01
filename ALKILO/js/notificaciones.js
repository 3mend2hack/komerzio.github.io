/* ============================================================
   ALKILO - Módulo de Notificaciones Push
   Con toggle activar/desactivar + rotación de VAPID
   Usa sw-v2.js para forzar limpieza de suscripciones viejas
   ============================================================ */

// Clave pública VAPID
const VAPID_PUBLIC_KEY = "BEEPWcIfM4jhWQohs2wbfwjaI-ldpvLd3f24Ib4l11zPhyFxve7lWTpXtT0ijUqFqw5Sl67Nr7xc_51celn-TWY";

// Nombre del Service Worker (cambiar aquí si se necesita más rotación)
const SW_FILENAME = "./sw-v2.js";

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

/** Registrar el SW con timeout por si se cuelga */
async function obtenerRegistroSW() {
  const reg = await navigator.serviceWorker.register(SW_FILENAME);
  // Esperar a que esté activo
  await esperarSWActivo(reg);
  return reg;
}

function esperarSWActivo(reg, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (reg.active) return resolve(reg);
    const timer = setTimeout(() => reject(new Error("Timeout esperando SW activo")), timeoutMs);
    reg.addEventListener("updatefound", () => {
      const nuevo = reg.installing;
      if (!nuevo) return;
      nuevo.addEventListener("statechange", () => {
        if (nuevo.state === "activated") {
          clearTimeout(timer);
          resolve(reg);
        }
      });
    });
    // Por si acaso ya está activo
    if (reg.active) {
      clearTimeout(timer);
      resolve(reg);
    }
  });
}

async function obtenerSuscripcionActual() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Limpieza total (suscripción + SWs viejos)
// ------------------------------------------------------------
async function limpiarTodo() {
  // 1) Cancelar cualquier suscripción existente
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        console.log("[push] cancelando suscripción vieja:", sub.endpoint);
        await sub.unsubscribe();
      }
    }
  } catch (e) {
    console.warn("[push] error cancelando suscripción:", e);
  }

  // 2) Desregistrar TODOS los SWs
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      console.log("[push] desregistrando SW:", r.scope);
      await r.unregister();
    }
  } catch (e) {
    console.warn("[push] error desregistrando SW:", e);
  }

  // 3) Esperar a que Chrome limpie todo
  await new Promise((r) => setTimeout(r, 1000));
}

// ------------------------------------------------------------
// Guardar suscripción en BD (maneja endpoint duplicado)
// ------------------------------------------------------------
async function guardarSuscripcionEnBD(suscripcion) {
  const json = suscripcion.toJSON();
  const uid = estado.usuario.id;

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

    // 2) Limpieza total (cancela suscripción + desregistra SWs viejos)
    if (btn) btn.textContent = "Limpiando...";
    await limpiarTodo();

    // 3) Registrar el SW v2 (fresco)
    if (btn) btn.textContent = "Registrando...";
    const reg = await obtenerRegistroSW();

    // 4) Crear suscripción NUEVA con la clave pública actual
    if (btn) btn.textContent = "Suscribiendo...";
    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (errSub) {
      console.error("[push] subscribe error:", errSub);
      // Si falla por "existing subscription", cancelar y reintentar
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToUint8Array(VAPID_PUBLIC_KEY),
        });
      } else {
        throw errSub;
      }
    }

    // 5) Guardar en Supabase
    await guardarSuscripcionEnBD(sub);

    // 6) Notificación de prueba
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
// Click handler
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
