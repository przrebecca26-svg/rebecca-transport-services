// NOTIFICATIONS SUR LE TELEPHONE (18 nov. 2026) - Rebecca Services
// Petit programme que l'iPhone garde en arriere-plan pour l'icone « Rebecca admin » :
// il affiche la notification envoyee par Netlify, et ouvre l'espace prive quand Rebecca la touche.
// Il ne garde AUCUNE page en memoire (pas de cache) : le site reste toujours a jour apres une publication.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// 25 nov. 2026 (Rebecca : « je veux retrouver l'historique des notifications, et le petit chiffre sur l'icône ») :
// chaque notification est aussi gardée dans le téléphone (IndexedDB « rs-notifs ») et le nombre de non lues
// s'affiche sur l'icône de l'écran d'accueil (iPhone : appli ajoutée à l'écran d'accueil, iOS 16.4 ou plus).
function ouvrirBase() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("rs-notifs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("notifs", { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function garder(n) {
  try {
    const db = await ouvrirBase();
    await new Promise((ok) => { const t = db.transaction("notifs", "readwrite"); t.objectStore("notifs").add(n); t.oncomplete = ok; t.onerror = ok; });
    const nonLues = await new Promise((ok) => { const t = db.transaction("notifs"); const q = t.objectStore("notifs").getAll(); q.onsuccess = () => ok((q.result || []).filter((x) => !x.lu).length); q.onerror = () => ok(0); });
    if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(nonLues).catch(() => {});
  } catch { /* pas de stockage : la notification s'affiche quand même */ }
}

self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { corps: e.data ? e.data.text() : "" }; }
  const titre = m.titre || "Rebecca Services";
  e.waitUntil(garder({ titre, corps: m.corps || "", lien: m.lien || "/admin#/admin", quand: Date.now(), lu: false }));
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
