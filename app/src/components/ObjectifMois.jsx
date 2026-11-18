import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { objectifDuMois } from "../pricing/objectif.js";

// OBJECTIF DU MOIS (18 nov. 2026) : document prive admin/objectifs = { "AAAA-MM": montant }
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

export default function ObjectifMois({ mois, gagne }) {
  const [objectifs, setObjectifs] = useState({});
  const [saisie, setSaisie] = useState("");
  const [modif, setModif] = useState(false);
  useEffect(() => onSnapshot(doc(db, "admin", "objectifs"), (s) => setObjectifs(s.exists() ? s.data() : {}), () => {}), []);
  const montant = Number(objectifs[mois]) || 0;
  const o = objectifDuMois(gagne, montant, mois, aujourdhui());
  const enregistrer = () => {
    const n = Math.round(Number(String(saisie).replace(",", ".")) || 0);
    setDoc(doc(db, "admin", "objectifs"), { [mois]: n, majLe: serverTimestamp() }, { merge: true }).then(() => setModif(false)).catch(() => {});
  };
  if (!o || modif) {
    return (
      <div className="tb-bloc">
        <h3>🎯 Mon objectif du mois</h3>
        <label className="pm-champ">Combien je veux gagner ce mois-ci (₪)
          <input type="number" inputMode="numeric" min="0" value={saisie} placeholder={montant ? String(montant) : "ex. 8000"} onChange={(e) => setSaisie(e.target.value)} />
        </label>
        <button className="tb-bouton" onClick={enregistrer}>Enregistrer l'objectif</button>
        {modif && <button className="tb-bouton tb-clair" onClick={() => setModif(false)}>Annuler</button>}
      </div>
    );
  }
  return (
    <div className="tb-bloc">
      <h3>🎯 Objectif du mois · {shekels(o.objectif)}</h3>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 14, overflow: "hidden", margin: "8px 0" }}>
        <div style={{ width: `${o.pct}%`, height: "100%", background: "linear-gradient(90deg, #e7a9b4, #c9967a)", borderRadius: 999 }} />
      </div>
      <p className="tb-note">
        {o.atteint
          ? `🎉 Objectif atteint : ${shekels(o.gagne)} encaissés (${o.pct} %).`
          : `${shekels(o.gagne)} encaissés · ${o.pct} % · il reste ${shekels(o.reste)}${o.jours ? `, soit environ ${shekels(o.parJour)} par jour de travail (${o.jours} jour${o.jours > 1 ? "s" : ""}, sans Chabbat)` : ""}.`}
      </p>
      <button className="tb-bouton tb-clair" onClick={() => { setSaisie(String(o.objectif)); setModif(true); }}>Modifier l'objectif</button>
    </div>
  );
}
