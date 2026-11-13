import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase.js";
import { encaisseBrut } from "../pricing/comptes.js";

// DETAIL DES CHIFFRES (13 nov. 2026, 09h43) : « je clique sur un chiffre et je vois exactement a quoi correspond
// la course, et je peux la modifier ou la supprimer » (courses de test qui faussent les finances).
// Ouvrir = la course dans « Demandes et missions » (prix, paiements, statut, annulation) ;
// Supprimer = la course disparait de partout (Finances, tableau de bord, statistiques) - Rebecca seule.
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;
const jj = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || "") ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

export default function DetailCourses({ demandes = [], mouvements = [], aller = null, peutSupprimer = false, vide = "Aucune course." }) {
  const [message, setMessage] = useState("");
  const [aConfirmer, setAConfirmer] = useState("");
  // 13 nov. 2026, 10h04 : remettre les compteurs a zero apres les tests -> cocher plusieurs courses et tout supprimer
  const [coches, setCoches] = useState([]);
  const [toutConfirmer, setToutConfirmer] = useState(false);
  const basculer = (id) => setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const supprimerCoches = async () => {
    setMessage("");
    let n = 0;
    for (const id of coches) {
      try {
        await deleteDoc(doc(db, "demandes", id));
        n++;
      } catch {
        /* on continue */
      }
    }
    setCoches([]);
    setToutConfirmer(false);
    setMessage(n === 1 ? "1 course supprimée." : `${n} courses supprimées.`);
  };
  const supprimer = async (d) => {
    setMessage("");
    try {
      await deleteDoc(doc(db, "demandes", d.id));
      setAConfirmer("");
      setMessage(`Supprimée : ${d.serviceTitre || d.service} de ${d.nom || "?"} du ${jj(d.date)}.`);
    } catch {
      setMessage("Suppression impossible. Vérifie la connexion.");
    }
  };
  const triees = [...demandes].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <div className="tdb-detail">
      {triees.length === 0 && <p className="tdb-note">{vide}</p>}
      {triees.map((d) => {
        const prix = typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime;
        const recu = encaisseBrut(mouvements, d.id);
        return (
          <div key={d.id} className="rp-forfait tdb-detail-ligne">
            {peutSupprimer && <input type="checkbox" aria-label="Cocher pour supprimer" checked={coches.includes(d.id)} onChange={() => basculer(d.id)} style={{ width: 22, height: 22, flex: "none" }} />}
            <span style={{ flex: 1 }}>
              <strong>{jj(d.date)}</strong> · {d.nom || "?"} · {d.serviceTitre || d.service}
              <small>
                {typeof prix === "number" ? ` · ${shekels(prix)}` : ""} · encaissé {shekels(recu)}
                {d.pourboire ? ` · pourboire ${shekels(d.pourboire)} (à part)` : ""} · {d.statut}
              </small>
            </span>
            <span className="tdb-detail-boutons">
              {aller && <button type="button" className="rp-waze" onClick={() => aller("demandes", d.id)}>Ouvrir</button>}
              {peutSupprimer && aConfirmer !== d.id && <button type="button" className="rp-waze" onClick={() => setAConfirmer(d.id)}>Supprimer</button>}
              {peutSupprimer && aConfirmer === d.id && (
                <>
                  <button type="button" className="rp-waze ag-danger" onClick={() => supprimer(d)}>Oui, supprimer</button>
                  <button type="button" className="rp-waze" onClick={() => setAConfirmer("")}>Non</button>
                </>
              )}
            </span>
          </div>
        );
      })}
      {peutSupprimer && triees.length > 1 && (
        <div className="tb-actions">
          <button type="button" className="rp-waze" onClick={() => setCoches(coches.length === triees.length ? [] : triees.map((d) => d.id))}>{coches.length === triees.length ? "Tout décocher" : "Tout cocher"}</button>
          {coches.length > 0 && !toutConfirmer && <button type="button" className="rp-waze" onClick={() => setToutConfirmer(true)}>Supprimer les {coches.length} cochées</button>}
          {toutConfirmer && (
            <>
              <button type="button" className="rp-waze ag-danger" onClick={supprimerCoches}>Oui, supprimer {coches.length} course{coches.length > 1 ? "s" : ""}</button>
              <button type="button" className="rp-waze" onClick={() => setToutConfirmer(false)}>Non</button>
            </>
          )}
        </div>
      )}
      {message && <p className="tdb-note" role="status">{message}</p>}
    </div>
  );
}
