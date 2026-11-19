import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { carteOsm, positionPropre } from "../pricing/positionDirect.js";

// Page de la cliente : #/position/ID - la voiture de Rebecca en direct (mise à jour toute seule)
export default function VoirPosition({ id, onAccueil }) {
  const [p, setP] = useState(undefined);
  useEffect(() => onSnapshot(doc(db, "positions", id), (s) => setP(s.exists() ? s.data() : null), () => setP(null)), [id]);
  const pos = p ? positionPropre(p) : null;
  const heure = p && p.majLe && p.majLe.toDate ? p.majLe.toDate().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <section className="carte-service" style={{ margin: 16 }}>
      <h2>🚗 Rebecca arrive</h2>
      {p === undefined && <p>Chargement…</p>}
      {p === null && <p>Le suivi n'est pas actif pour le moment (course terminée ou pas encore commencée).</p>}
      {pos && (
        <>
          <iframe title="Position de Rebecca" src={carteOsm(pos)} style={{ width: "100%", height: 360, border: 0, borderRadius: 12 }} />
          <p>Dernière position{heure ? ` à ${heure}` : ""}. La carte se met à jour toute seule.</p>
          <p><a href={`https://www.google.com/maps?q=${pos.lat},${pos.lon}`} target="_blank" rel="noopener noreferrer">Ouvrir dans Google Maps</a></p>
        </>
      )}
      <p><button type="button" className="bouton-secondaire" onClick={onAccueil}>Accueil Rebecca Services</button></p>
    </section>
  );
}
