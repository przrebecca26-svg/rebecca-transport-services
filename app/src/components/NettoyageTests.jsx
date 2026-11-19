import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase.js";
import { supprimerCourseComplete } from "../suppression.js";

// FAIRE LE MENAGE (18 nov. 2026, demande de Rebecca) - Rebecca seule.
// Supprime d'un coup les demandes de test : refusees, annulees, ou au nom de « Test ».
// Si un paiement de test a ete note, une correction du meme montant (motif « Suppression d'un test ») est ajoutee
// avant la suppression : les paiements ne s'effacent jamais (regles Firebase), les Finances restent justes.
// Le suivi client (historique) de la demande est supprime aussi.
const estTest = (d) => /\btest\b/i.test(`${d.nom || ""} ${d.message || ""}`);
const aproposer = (d) => d.statut === "refusee" || d.statut === "annulee" || estTest(d);
const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const jourCourt = (j) => (/^\d{4}-\d{2}-\d{2}$/.test(j || "") ? `${j.slice(8, 10)}/${j.slice(5, 7)}` : "");

export default function NettoyageTests({ items }) {
  const candidates = useMemo(() => (items || []).filter(aproposer), [items]);
  const [ouvert, setOuvert] = useState(false);
  const [coches, setCoches] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState("");
  // 18 nov. 2026 : la fenêtre de confirmation du navigateur ne s'affiche pas dans certains navigateurs
  // (application Google, Instagram…) et le bouton ne faisait rien -> confirmation dans la page, en 2 appuis.
  const [aConfirmer, setAConfirmer] = useState(false);
  const choix = coches || new Set(candidates.map((d) => d.id));
  if (!candidates.length && !info) return null;

  const basculer = (id) => {
    const s = new Set(choix);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setCoches(s);
  };
  const supprimer = async () => {
    const liste = candidates.filter((d) => choix.has(d.id));
    if (!liste.length) return;
    setAConfirmer(false);
    setEnCours(true);
    setInfo("");
    let ok = 0;
    let ko = 0;
    for (const d of liste) {
      try {
        // 19 nov. 2026 : la course part avec ses paiements (plus de correction qui laisse une trace)
        await supprimerCourseComplete(d.id);
        ok++;
      } catch {
        ko++;
      }
    }
    setCoches(null);
    setEnCours(false);
    setInfo(`${ok} demande${ok > 1 ? "s" : ""} supprimée${ok > 1 ? "s" : ""}${ko ? ` · ${ko} impossible${ko > 1 ? "s" : ""}` : ""} ✓`);
  };

  return (
    <div className="tb-bloc">
      <button className="tb-bouton tb-clair" onClick={() => setOuvert(!ouvert)}>🧹 Faire le ménage des tests ({candidates.length})</button>
      {ouvert && (
        <>
          <p className="tb-note">Demandes refusées, annulées ou au nom de « Test ». Décoche celles à garder. Leurs paiements de test sont supprimés avec elles : rien ne reste dans tes Finances.</p>
          {candidates.map((d) => (
            <label key={d.id} className="rg-case" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
              <input type="checkbox" checked={choix.has(d.id)} onChange={() => basculer(d.id)} />
              <span>{d.serviceTitre} · {d.nom} · {jourCourt(d.date)} · <em>{d.statut}</em></span>
            </label>
          ))}
          {!aConfirmer ? (
            <button className="tb-bouton tb-danger" disabled={enCours || !choix.size} onClick={() => setAConfirmer(true)}>{enCours ? "Suppression…" : `Supprimer les ${choix.size} cochées`}</button>
          ) : (
            <div className="tb-actions" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <p className="tb-note" style={{ width: "100%" }}>Supprimer définitivement {choix.size} demande{choix.size > 1 ? "s" : ""} de test ? Elles disparaîtront de partout.</p>
              <button className="tb-bouton tb-danger" onClick={supprimer}>Oui, supprimer</button>
              <button className="tb-bouton tb-clair" onClick={() => setAConfirmer(false)}>Annuler</button>
            </div>
          )}
        </>
      )}
      {info && <p className="tb-note">{info}</p>}
    </div>
  );
}
