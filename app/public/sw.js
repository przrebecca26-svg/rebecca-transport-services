// NOTIFICATIONS SUR LE TELEPHONE (18 nov. 2026) - Rebecca Services
// Petit programme que l'iPhone garde en arriere-plan pour l'icone « Rebecca admin » :
// il affiche la notification envoyee par Netlify, et ouvre l'espace prive quand Rebecca la touche.
// Il ne garde AUCUNE page en memoire (pas de cache) : le site reste toujours a jour apres une publication.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { corps: e.data ? e.data.text() : "" }; }
  const titre = m.titre || "Rebecca Services";
  e.waitUntil(self.registration.showNotification(titre, {
    body: m.corps || "Nouvelle demande sur le site",
    icon: "/apple-touch-icon.png",
    badge: "/apple-touch-icon.png",
    tag: m.tag || undefined,
    data: { lien: m.lien || "/admin#/admin" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const lien = new URL((e.notification.data && e.notification.data.lien) || "/admin#/admin", self.location.origin).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of fenetres) {
      if (f.url.startsWith(self.location.origin) && "focus" in f) {
        await f.focus();
        if ("navigate" in f) return f.navigate(lien);
        return;
      }
    }
    return self.clients.openWindow(lien);
  })());
});
