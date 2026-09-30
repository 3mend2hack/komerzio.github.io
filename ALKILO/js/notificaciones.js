/* ============================================================
   ALKILO - Módulo de Notificaciones Push
   Archivo independiente. Se carga DESPUÉS de app.js.
   No modifica app.js: usa variables globales (db, estado).
   ============================================================ */

// Clave pública VAPID (segura de exponer; la privada vive en Supabase Secrets)
const VAPID_PUBLIC_KEY = "BEEPWcIfM4jhWQohs2wbfwjaI-ldpvLd3f24Ib4l11zPhyFxve7lWTpXtT0ijUqFqw5Sl67Nr7xc_51celn-TWY";

// ------------------------------------------------------------
// Utilidades internas
// ------------------------------------------------------------

/** Convierte la clave pública VAPID (base64url) al Uint8Array que pide el navegador */
function vapidKeyToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** ¿El navegador soporta todo lo necesario para push? */
function soportaPush() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Registra el Service Worker (o recupera el ya registrado) */
async function obtenerRegistroSW() {
  // El SW vive en la raíz del proyecto (ALKILO/sw.js)
  return navigator.serviceWorker.register("./sw.js");
}

/** Devuelve la suscripción actual del navegador, si existe */
async function obtenerSuscripcionActual() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Guarda (o actualiza) la suscripción en Supabase */
async function guardarSuscripcionEnBD(suscripcion) {
  const json = suscripcion.toJSON();
  const { error } = await db.from("push_subscriptions").upsert(
    {
      usuario_id: estado.usuario.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: (navigator.userAgent || "").slice(0, 200),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

// ------------------------------------------------------------
// Flujo principal: activar notificaciones
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
  if (!window.isSecureContext && location.hostname !== "localhost") {
    alert("Las notificaciones requieren HTTPS. Prueba en producción.");
    return;
  }

  const btn = document.getElementById("btn-activar-notificaciones");
  const original = btn?.textContent || "🔔 Activar notificaciones";
  if (btn) { btn.disabled = true; btn.textContent = "Activando..."; }

  try {
    // 1) Registrar Service Worker
    await obtenerRegistroSW();
    const reg = await navigator.serviceWorker.ready;

    // 2) Pedir permiso al usuario
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") {
      alert("No diste permiso. Puedes activarlo desde los ajustes del navegador.");
      return;
    }

    // 3) Suscribir al navegador (si no está ya suscrito)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // 4) Guardar en Supabase
    await guardarSuscripcionEnBD(sub);

    // 5) Enviar notificación de prueba vía Edge Function
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
    console.error("[push] error:", err);
    alert("No se pudieron activar las notificaciones:\n" + (err?.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
    // Vuelve a pintar el estado real del botón
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
    if (sub) {
      btn.textContent = "✅ Notificaciones activas";
      btn.disabled = true;
    } else {
      btn.textContent = "🔔 Activar notificaciones";
      btn.disabled = false;
    }
  } catch {
    // Silencioso: aún no hay SW registrado, es normal
  }
}

// ------------------------------------------------------------
// Init: engancha el botón y revisa el estado
// ------------------------------------------------------------
function inicializarNotificaciones() {
  document.getElementById("btn-activar-notificaciones")
    ?.addEventListener("click", activarNotificaciones);

  // Esperamos un poco para que app.js haya cargado el perfil
  setTimeout(actualizarEstadoBotonNotificaciones, 1500);
}

document.addEventListener("DOMContentLoaded", inicializarNotificaciones);