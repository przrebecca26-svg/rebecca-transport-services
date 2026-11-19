import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { NOMS_SERVICES, PLAGES, attentesActives, messagePlaceLibre } from "../pricing/listeAttente.js";
import { lienWhatsApp } from "../pricing/navigation.js";

// LISTE D'ATTENTE (19 nov. 2026, V2) - Rebecca seule, en haut du Calendrier.
// Une place se libère (refus, annulation) : « 💬 Prévenir » ouvre WhatsApp avec le message prêt ; « Retirer » efface.
// Les inscriptions dont la date est passée sont effacées toutes seules à l'ouverture.
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function ListeAttenteAdmin() {
  const [liste, setListe] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "listeAttente"),
        (snap) => {
          const tout = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
          const jour = aujourdhui();
          for (const a of tout) if (a.date && a.date < jour) deleteDoc(doc(db, "listeAttente", a.id)).catch(() => {});
          setListe(attentesActives(tout, jour));
        },
        () => setListe([])
      ),
    []
  );
  if (!liste.length) return null;
  return (
    <div className="tb-bloc">
      <button type="button" className="tb-bouton tb-clair" onClick={() => setOuvert(!ouvert)}>📋 Liste d'attente beauté ({liste.length})</button>
      {ouvert && (
        <ul className="pm-liste dp-liste">
          {liste.map((a) => {
            const wa = lienWhatsApp(a.telephone, messagePlaceLibre(a));
            return (
              <li key={a.id}>
                <span>
                  {a.date.split("-").reverse().join("/")} · {(PLAGES.find((p) => p.id === a.plage) || PLAGES[0]).label} · <strong>{a.prenom}</strong> · {NOMS_SERVICES[a.service] || a.service}
                  {a.prestation ? ` · ${a.prestation}` : ""}
                  {a.note ? <small> ({a.note})</small> : null}
                </span>
                <span className="tb-actions">
                  {wa && <a className="ag-waze" href={wa} target="_blank" rel="noopener noreferrer">💬 Prévenir</a>}
                  <button type="button" className="ag-modifier" onClick={() => deleteDoc(doc(db, "listeAttente", a.id)).catch(() => {})}>Retirer</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
