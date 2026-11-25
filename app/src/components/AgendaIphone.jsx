import { useEffect, useState } from "react";
import { lireIcs, rdvDuJour } from "../pricing/ics.js";

// MON AGENDA IPHONE (25 nov. 2026) - Rebecca : « synchroniser mon agenda iPhone avec mes rendez-vous perso ».
// iPhone : Calendrier → touche le calendrier (i) → « Calendrier public » → Partager le lien → coller ici.
// Lecture seule, relue toutes les 15 minutes ; les rendez-vous du jour s'affichent dans « Ma journée ».
const CLE = "rs-agenda-iphone";
const lireLien = () => { try { return localStorage.getItem(CLE) || ""; } catch { return ""; } };
let cache = { lien: "", quand: 0, ev: null };

export function useAgendaIphone() {
  const [lien, setLienEtat] = useState(lireLien);
  const [ev, setEv] = useState(cache.lien === lien ? cache.ev : null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    if (!lien) { setEv(null); return undefined; }
    let actif = true;
    const charger = () => {
      if (cache.lien === lien && cache.ev && Date.now() - cache.quand < 15 * 60000) { setEv(cache.ev); return; }
      fetch(`/.netlify/functions/agenda-ics?url=${encodeURIComponent(lien)}`)
        .then((r) => (r.ok ? r.text() : r.text().then((t) => Promise.reject(new Error(t)))))
        .then((t) => { const e = lireIcs(t); cache = { lien, quand: Date.now(), ev: e }; if (actif) { setEv(e); setErreur(""); } })
        .catch((e) => actif && setErreur(String(e.message || "lecture impossible")));
    };
    charger();
    const id = setInterval(charger, 15 * 60000);
    return () => { actif = false; clearInterval(id); };
  }, [lien]);
  const setLien = (l) => { try { if (l) localStorage.setItem(CLE, l); else localStorage.removeItem(CLE); } catch { /* */ } cache = { lien: "", quand: 0, ev: null }; setLienEtat(l); };
  return { lien, setLien, ev, erreur };
}

export default function AgendaIphone({ jour }) {
  const a = useAgendaIphone();
  const [reglage, setReglage] = useState(false);
  const [saisie, setSaisie] = useState(a.lien);
  const rdv = a.ev ? rdvDuJour(a.ev, jour) : [];
  return (
    <div className="tb-bloc">
      <h3>📱 Mon agenda iPhone</h3>
      {!a.lien && !reglage && <p className="tb-note">Pas encore relié. <button type="button" className="ag-modifier" onClick={() => setReglage(true)}>Relier mon agenda</button></p>}
      {a.lien && !a.ev && !a.erreur && <p className="tb-note">Lecture…</p>}
      {a.erreur && <p className="fm-erreur">Agenda iPhone : {a.erreur}</p>}
      {a.ev && !rdv.length && <p className="tb-note">Rien ce jour-là.</p>}
      {rdv.map((r, i) => (
        <p key={i} style={{ margin: "4px 0" }}><strong>{r.journee ? "Toute la journée" : `${r.debut.replace(":", "h")}–${r.fin.replace(":", "h")}`}</strong> · {r.titre}{r.lieu ? <small> · {r.lieu}</small> : null}</p>
      ))}
      {a.lien && !reglage && <button type="button" className="ag-modifier" onClick={() => setReglage(true)}>Changer le lien</button>}
      {reglage && (
        <div>
          <p className="tb-note">Sur l'iPhone : app Calendrier → « Calendriers » → (i) à côté de ton calendrier → active « Calendrier public » → « Partager le lien… » → Copier, puis colle-le ici.</p>
          <input value={saisie} placeholder="webcal://p…-caldav.icloud.com/published/…" onChange={(e) => setSaisie(e.target.value.trim())} />
          <div className="tb-actions">
            <button type="button" className="tb-bouton" onClick={() => { a.setLien(saisie); setReglage(false); }}>Enregistrer</button>
            {a.lien && <button type="button" className="tb-bouton tb-clair" onClick={() => { a.setLien(""); setSaisie(""); setReglage(false); }}>Retirer</button>}
            <button type="button" className="tb-bouton tb-clair" onClick={() => setReglage(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
