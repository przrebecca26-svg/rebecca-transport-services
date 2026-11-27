import { useEffect, useState } from "react";

// CENTRE DES NOTIFICATIONS (25 nov. 2026) - Rebecca : « si je regarde pas la notification, je passe à côté et je
// ne la retrouve nulle part ». Le petit programme du téléphone (sw.js) garde chaque notification reçue ;
// ici la 🔔 montre l'historique, le nombre de non lues, et ouvre le bon onglet (contrat, commande, rendez-vous…).
function ouvrirBase() {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") return ko(new Error("pas de stockage"));
    const r = indexedDB.open("rs-notifs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("notifs", { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function lireTout() {
  const db = await ouvrirBase();
  return new Promise((ok) => {
    const q = db.transaction("notifs").objectStore("notifs").getAll();
    q.onsuccess = () => ok((q.result || []).sort((a, b) => b.quand - a.quand));
    q.onerror = () => ok([]);
  });
}
async function ecrire(liste, effacer = false) {
  const db = await ouvrirBase();
  await new Promise((ok) => {
    const t = db.transaction("notifs", "readwrite");
    const st = t.objectStore("notifs");
    if (effacer) st.clear();
    else liste.forEach((n) => st.put(n));
    t.oncomplete = ok;
    t.onerror = ok;
  });
}
const badge = (n) => {
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch { /* navigateur sans pastille */ }
};
const quandFr = (ms) => new Date(ms).toLocaleString("fr-FR", { timeZone: "Asia/Jerusalem", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// 27 nov. 2026 (Rebecca : une inscription à l'annuaire n'apparaissait ni sur l'icône, ni dans le menu, ni dans la cloche) :
// la cloche montre aussi « À traiter maintenant » (les mêmes compteurs que le menu), et la pastille de l'icône
// de l'application compte ce qui reste à traiter, même si la notification du téléphone n'est pas arrivée.
export default function CentreNotifs({ aTraiter = [], onAller }) {
  const totalATraiter = aTraiter.reduce((n, x) => n + (x.n || 0), 0);
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const recharger = () => lireTout().then((l) => { setListe(l); }).catch(() => {});
  useEffect(() => {
    recharger();
    const id = setInterval(recharger, 30000);
    const vu = () => document.visibilityState === "visible" && recharger();
    document.addEventListener("visibilitychange", vu);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vu); };
  }, []);
  const nonLues = liste.filter((x) => !x.lu).length;
  const compte = Math.max(nonLues, totalATraiter);
  useEffect(() => { badge(compte); }, [compte]);
  const marquer = async (n) => {
    const l = liste.map((x) => (n ? (x.id === n.id ? { ...x, lu: true } : x) : { ...x, lu: true }));
    await ecrire(l.filter((x) => n ? x.id === n.id : true)).catch(() => {});
    setListe(l);
  };
  const ouvrir = async (n) => {
    await marquer(n);
    setOuvert(false);
    if (n.lien) window.location.href = n.lien; // ouvre le bon onglet (contrat, commande, rendez-vous…)
  };
  return (
    <>
      <button type="button" className="ts-cloche" aria-label={`Notifications${nonLues ? ` : ${nonLues} non lues` : ""}`} onClick={() => setOuvert(!ouvert)} style={{ position: "relative", background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", padding: "0 8px" }}>
        🔔{compte > 0 && <span className="ts-pastille" style={{ position: "absolute", top: -4, right: -2 }}>{compte > 99 ? "99+" : compte}</span>}
      </button>
      {ouvert && (
        <div className="tb-bloc" style={{ position: "fixed", top: 70, left: 8, right: 8, maxHeight: "75vh", overflowY: "auto", zIndex: 60, boxShadow: "0 8px 30px rgba(0,0,0,.6)" }}>
          <h3>🔔 Notifications reçues</h3>
          <div className="tb-actions">
            {nonLues > 0 && <button type="button" className="tb-bouton tb-clair" onClick={() => marquer(null)}>Tout marquer comme lu</button>}
            <button type="button" className="tb-bouton tb-clair" onClick={() => { if (window.confirm("Effacer tout l'historique des notifications ?")) ecrire([], true).then(recharger); }}>Effacer</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setOuvert(false)}>Fermer</button>
          </div>
          {totalATraiter > 0 && (
            <>
              <p className="tb-note" style={{ fontWeight: 700 }}>À traiter maintenant</p>
              {aTraiter.filter((x) => x.n > 0).map((x) => (
                <button key={x.id} type="button" className="tb-carte" style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between" }} onClick={() => { setOuvert(false); if (onAller) onAller(x.id); }}>
                  <span>{x.label}</span><span className="tr-compteur">{x.n}</span>
                </button>
              ))}
              <p className="tb-note" style={{ fontWeight: 700, marginTop: 12 }}>Notifications reçues</p>
            </>
          )}
          {liste.length === 0 && <p className="tb-note">Aucune notification gardée pour l'instant (elles s'enregistrent à partir de maintenant, sur ce téléphone).</p>}
          {liste.slice(0, 150).map((n) => (
            <button key={n.id} type="button" className="tb-carte" style={{ width: "100%", textAlign: "left", opacity: n.lu ? 0.6 : 1 }} onClick={() => ouvrir(n)}>
              <span className="tb-ligne"><strong>{n.lu ? "" : "● "}{n.titre}</strong><span className="tb-quand">{quandFr(n.quand)}</span></span>
              {n.corps && <small style={{ display: "block" }}>{n.corps}</small>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
