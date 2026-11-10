import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

// Proposition pour Claude — à intégrer dans l'admin (accessible uniquement à Rebecca)
// Non raccordé pour l'instant.

const STATUTS = ["en attente", "acceptée", "refusée", "terminée", "annulée"];

export default function CommandesEpoxy({ onRetour }) {
  const [commandes, setCommandes] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const q = query(collection(db, "commandes"), orderBy("creeLe", "desc"));
    const unsub = onSnapshot(q, (s) => {
      setCommandes(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setErreur("Impossible de lire les commandes."));
    return unsub;
  }, []);

  const changerStatut = async (id, statut) => {
    try {
      await updateDoc(doc(db, "commandes", id), { statut, majLe: serverTimestamp() });
    } catch (e) {
      setErreur("Impossible de modifier le statut.");
    }
  };

  if (erreur) return <p className="admin-texte">{erreur}</p>;
  if (!commandes) return <p className="admin-texte">Chargement des commandes…</p>;

  return (
    <section>
      <button className="lien" onClick={onRetour}>← Retour</button>
      <h2>Commandes Epoxy</h2>
      {commandes.length === 0 && <p>Aucune commande.</p>}
      {commandes.map((c) => (
        <div key={c.id} className="carte-service" style={{ marginBottom: 12 }}>
          <strong>{c.produit}</strong> × {c.quantite}
          <div>{c.surDevis ? "Sur devis" : (c.prixUnitaire + " ₪")}</div>
          <div>{c.nom} — {c.telephone}</div>
          {c.messageClient && <div><em>{c.messageClient}</em></div>}
          <div>Statut : {c.statut}</div>
          <div style={{ marginTop: 8 }}>
            {STATUTS.map((s) => (
              <button key={s} onClick={() => changerStatut(c.id, s)} disabled={c.statut === s} style={{ marginRight: 6 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
