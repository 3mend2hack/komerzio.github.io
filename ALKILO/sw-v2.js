/* ============================================================
   ALKILO - Service Worker
   Maneja notificaciones push y clicks sobre ellas
   ============================================================ */

self.addEventListener("install", (event) => {
  console.log("[SW] Instalado");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activado");
  event.waitUntil(self.clients.claim());
});

// Notificación recibida desde el servidor
self.addEventListener("push", (event) => {
  console.log("[SW] Push recibido");
  
  let datos = { title: "ALKILO", body: "Tienes una notificación nueva", url: "/" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch (e) {
    console.warn("[SW] No se pudo parsear el payload:", e);
  }
  
  const opciones = {
    body: datos.body,
    icon: datos.icon || "/ALKILO/icon-192.png",
    badge: datos.badge || "/ALKILO/icon-192.png",
    vibrate: [200, 100, 200],
    tag: datos.tag || "alkilo-notif",
    renotify: true,
    data: { url: datos.url || "/ALKILO/" },
  };
  
  event.waitUntil(self.registration.showNotification(datos.title, opciones));
});

// Click sobre la notificación → abrir/cerrar la app y navegar
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlDestino = event.notification.data?.url || "/ALKILO/";
  
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      // Si ya hay una pestaña abierta, la enfocamos
      for (const c of clientes) {
        if (c.url.includes("/ALKILO/") && "focus" in c) {
          c.navigate(urlDestino);
          return c.focus();
        }
      }
      // Si no, abrimos una nueva
      if (self.clients.openWindow) return self.clients.openWindow(urlDestino);
    })
  );
});
