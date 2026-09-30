/* ============================================================
   ALKILO - Módulo de Notificaciones Push
   Archivo independiente. Se carga DESPUÉS de app.js.
   Con toggle activar/desactivar + manejo de endpoint duplicado
   ============================================================ */

// Clave pública VAPID
const VAPID_PUBLIC_KEY = "BEEPWcIfM4jhWQohs2wbfwjaI-ldpvLd3f24Ib4l11zPhyFxve7lWTpXtT0ijUqFqw5Sl67Nr7xc_51celn-TWY";

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

  // 1) Buscar si ya existe una fila con ese endpoint (de cualquier usuario)
  const { data: existente } = await db
    .from("push_subscriptions")
    .select("id, usuario_id")
    .eq("endpoint", json.endpoint)
    .maybeSingle();

  if (existente) {
    // Existe: actualizar para reasignarla al usuario actual
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

  // 2) No existe: insertar nueva
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
    // 1) Registrar SW
    await obtenerRegistroSW();
    const reg = await navigator.serviceWorker.ready;

    // 2) Pedir permiso
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

    // 4) Guardar/reasignar en Supabase
    await guardarSuscripcionEnBD(sub);

    // 5) Notificación de prueba
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
    // 1) Obtener suscripción actual del navegador
    const sub = await obtenerSuscripcionActual();

    // 2) Borrar de la BD (por endpoint)
    if (sub) {
      const json = sub.toJSON();
      await db.from("push_subscriptions")
        .delete()
        .eq("endpoint", json.endpoint);

      // 3) Cancelar la suscripción en el navegador
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
      // Verificar que en BD la suscripción pertenece a este usuario
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

  // Esperar a que app.js cargue el perfil
  setTimeout(actualizarEstadoBotonNotificaciones, 1500);
}

document.addEventListener("DOMContentLoaded", inicializarNotificaciones);