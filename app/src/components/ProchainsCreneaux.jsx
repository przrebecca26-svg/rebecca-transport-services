import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { creneauxDuJour, cellulesDe, cellulesLibres, idAgenda } from "../pricing/rendezvous.js";
import { ajouterJours } from "../pricing/calendrier.js";

// PROCHAINS CRENEAUX LIBRES (18 nov. 2026, suggestion validée) - beauté.
// « Prochains créneaux : demain 10h, jeudi 14h » : la cliente touche et la date + l'heure se remplissent toutes seules.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
function nomJour(date) {
  const a = aujourdhui();
  if (date === a) return "Aujourd'hui";
  if (date === ajouterJours(a, 1)) return "Demain";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).replace(/^./, (c) => c.toUpperCase());
}

export default function ProchainsCreneaux({ activite, duree, occupes, service, marge = 0, onChoisir, nombre = 4, jours = 21 }) {
  const [liste, setListe] = useState(null);
  useEffect(() => {
    if (!activite || !duree) return undefined;
    let fini = false;
    (async () => {
      const r = [];
      const debut = aujourdhui();
      for (let i = 0; i < jours && r.length < nombre; i++) {
        const date = ajouterJours(debut, i);
        const slots = creneauxDuJour({ activite, dureeMinutes: duree, date, occupes, service }).filter((c) => c.libre);
        if (!slots.length) continue;
        let prises = {};
        try { const x = await getDoc(doc(db, "agendaJours", idAgenda(date))); prises = x.exists() ? x.data().cells || {} : {}; } catch { prises = {}; }
        for (const c of slots) {
          if (cellulesLibres(cellulesDe(c.heure, duree, marge), prises)) {
            r.push({ date, heure: c.heure });
            if (r.length >= nombre) break;
          }
        }
      }
      if (!fini) setListe(r);
    })();
    return () => { fini = true; };
  }, [activite, duree, occupes, service, marge, nombre, jours]);
  if (!liste) return <p className="tb-note">Recherche des prochains créneaux libres…</p>;
  if (!liste.length) return null;
  return (
    <div className="prochains-creneaux" style={{ margin: "8px 0 12px" }}>
      <p style={{ margin: "0 0 6px" }}><strong>✨ Prochains créneaux libres</strong></p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {liste.map((c) => (
          <button key={c.date + c.heure} type="button" className="creneau" onClick={() => onChoisir(c.date, c.heure)}>
            {nomJour(c.date)} · {c.heure.replace(":", "h")}
          </button>
        ))}
      </div>
      <p className="tb-note" style={{ margin: "6px 0 0" }}>Ou choisissez une autre date ci-dessous.</p>
    </div>
  );
}
