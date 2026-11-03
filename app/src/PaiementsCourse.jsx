import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { TARIFS } from "./pricing/config.js";
import { REGLAGES_PAR_DEFAUT, situationCourse, validerMouvement } from "./pricing/comptes.js";
import "./paiements.css";

// Paiements d'une course (espace prive de Rebecca).
// Chaque paiement est une nouvelle ligne : jamais modifiee, jamais supprimee.
// Une erreur se corrige avec « Corriger une erreur » (nouvelle ligne avec un motif).

const ETATS = {
  acompte_a_recevoir: "Acompte à recevoir",
  confirmee: "Confirmée",
  terminee: "Terminée",
  annulee: "Annulée",
};

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const euros = (n) => Math.round(n * 100) / 100 + " ₪";
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const versNombre = (x) => Math.round(Number(String(x).replace(",", ".")) * 100) / 100;

export default function PaiementsCourse({ d }) {
  const [mouvements, setMouvements] = useState(null); // null = chargement
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [mode, setMode] = useState(null); // null | "paiement" | "correction"
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState(TARIFS.moyensPaiement[0]);
  const [date, setDate] = useState(aujourdhui());
  const [motif, setMotif] = useState("");
  const [aConfirmer, setAConfirmer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "mouvements"), where("resId", "==", d.id));
    return onSnapshot(
      q,
      (snap) => setMouvements(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setLectureImpossible(true)
    );
  }, [d.id]);

  const prix = typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null;
  const liste = useMemo(
    () => [...(mouvements || [])].filter((m) => m.kind === "paiement" || m.kind === "correction").sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [mouvements]
  );
  const res = { id: d.id, date: d.date, prixConvenu: prix, statut: d.statut };
  const sit = useMemo(() => situationCourse(res, mouvements || []), [d.id, d.date, d.statut, prix, mouvements]);

  if (!["acceptee", "terminee", "annulee"].includes(d.statut)) return null;
  if (lectureImpossible) {
    return (
      <div className="tb-bloc">
        <h3>Paiements</h3>
        <p className="admin-erreur">Lecture des paiements impossible. Vérifie la connexion et les règles Firebase.</p>
      </div>
    );
  }
  if (mouvements === null) {
    return (
      <div className="tb-bloc">
        <h3>Paiements</h3>
        <p className="tb-note">Chargement…</p>
      </div>
    );
  }

  const modifiable = d.statut === "acceptee" || d.statut === "terminee";

  const ouvrir = (m) => {
    setErreur("");
    setAConfirmer(null);
    setMode(m);
    setDate(aujourdhui());
    setMotif("");
    setMoyen(TARIFS.moyensPaiement.includes(d.moyenPaiement) ? d.moyenPaiement : TARIFS.moyensPaiement[0]);
    if (m === "paiement") {
      const resteAcompte = sit.acompte != null && !sit.acompteRecu ? sit.acompte - sit.encaisse : 0;
      const defaut = resteAcompte > 0 ? resteAcompte : sit.resteAPayer;
      setMontant(defaut > 0 ? String(Math.round(defaut * 100) / 100) : "");
    } else {
      setMontant("");
    }
  };

  const fermer = () => {
    setMode(null);
    setAConfirmer(null);
    setErreur("");
  };

  // Construit le mouvement et le verifie (meme verification que les regles Firebase)
  const preparer = () => {
    const n = versNombre(montant);
    const m =
      mode === "paiement"
        ? { kind: "paiement", resId: d.id, date, montant: n, moyen }
        : { kind: "correction", resId: d.id, date, montant: n, motif: motif.trim().slice(0, 200) };
    let err = validerMouvement(m);
    if (!err && mode === "correction" && sit.encaisse + n < 0) err = "Cette correction rendrait le total encaissé négatif.";
    if (err) {
      setErreur(err);
      return;
    }
    setErreur("");
    setAConfirmer(m);
  };

  const enregistrer = async () => {
    if (!aConfirmer) return;
    setEnCours(true);
    setErreur("");
    try {
      await addDoc(collection(db, "mouvements"), { ...aConfirmer, creeLe: serverTimestamp() });
      fermer();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const depasse = aConfirmer && aConfirmer.kind === "paiement" && prix != null && sit.encaisse + aConfirmer.montant > prix ? sit.encaisse + aConfirmer.montant - prix : 0;

  return (
    <div className="tb-bloc">
      <h3>Paiements</h3>
      <p>
        <span className={"pm-etat pm-" + sit.etat}>{ETATS[sit.etat] || sit.etat}</span>
      </p>

      {prix == null ? (
        <p className="tb-note">Fixe d'abord le prix (bloc « Prix ») : l'acompte se calcule ensuite.</p>
      ) : (
        <ul className="pm-resume">
          <li>
            <span>Prix convenu</span>
            <strong>{euros(prix)}</strong>
          </li>
          {d.statut === "acceptee" && sit.acompte != null && (
            <li>
              <span>Acompte ({REGLAGES_PAR_DEFAUT.acomptePourcent} %)</span>
              <strong>
                {euros(sit.acompte)} {sit.acompteRecu ? "✓ reçu" : "à recevoir"}
              </strong>
            </li>
          )}
          <li>
            <span>Encaissé</span>
            <strong>{euros(sit.encaisse)}</strong>
          </li>
          <li>
            <span>{d.statut === "terminee" ? "Reste à encaisser" : "Reste à payer"}</span>
            <strong>{euros(sit.resteAPayer)}</strong>
          </li>
          {sit.surplus > 0 && (
            <li>
              <span>Trop-perçu</span>
              <strong>{euros(sit.surplus)}</strong>
            </li>
          )}
        </ul>
      )}

      {liste.length > 0 && (
        <ul className="pm-liste">
          {liste.map((m) => (
            <li key={m.id}>
              <span>
                {jourCourt(m.date)} · {m.kind === "paiement" ? m.moyen : "Correction"}
                {m.kind === "correction" && m.motif ? <small> ({m.motif})</small> : null}
              </span>
              <strong>{(m.montant > 0 && m.kind === "correction" ? "+" : "") + euros(m.montant)}</strong>
            </li>
          ))}
        </ul>
      )}
      {liste.length === 0 && <p className="tb-note">Aucun paiement enregistré.</p>}

      {modifiable && mode === null && (
        <div className="tb-actions">
          <button className="tb-bouton" onClick={() => ouvrir("paiement")}>
            Enregistrer un paiement
          </button>
          {liste.length > 0 && (
            <button className="tb-bouton tb-clair" onClick={() => ouvrir("correction")}>
              Corriger une erreur
            </button>
          )}
        </div>
      )}

      {modifiable && mode !== null && !aConfirmer && (
        <div className="pm-form">
          <h4>{mode === "paiement" ? "Nouveau paiement" : "Corriger une erreur"}</h4>
          <label className="pm-champ">
            {mode === "paiement" ? "Montant reçu (₪)" : "Montant à ajouter ou retirer (₪, par exemple -50)"}
            <input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </label>
          {mode === "paiement" && (
            <label className="pm-champ">
              Moyen de paiement
              <select value={moyen} onChange={(e) => setMoyen(e.target.value)}>
                {TARIFS.moyensPaiement.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="pm-champ">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {mode === "correction" && (
            <label className="pm-champ">
              Motif (obligatoire)
              <input value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : montant saisi par erreur" />
            </label>
          )}
          <div className="tb-actions">
            <button className="tb-bouton" onClick={preparer}>
              Continuer
            </button>
            <button className="tb-bouton tb-clair" onClick={fermer}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {modifiable && aConfirmer && (
        <div className="pm-form">
          <h4>Confirmer ?</h4>
          <p>
            {aConfirmer.kind === "paiement" ? "Paiement" : "Correction"} de <strong>{euros(aConfirmer.montant)}</strong>
            {aConfirmer.kind === "paiement" ? <> en <strong>{aConfirmer.moyen}</strong></> : null} le {jourCourt(aConfirmer.date)}.
          </p>
          {depasse > 0 && <p className="tb-note">Attention : cela dépasse le prix convenu de {euros(depasse)}.</p>}
          <p className="tb-note">Une fois enregistré, il ne peut plus être modifié ni supprimé (une erreur se corrige par une nouvelle ligne).</p>
          <div className="tb-actions">
            <button className="tb-bouton" disabled={enCours} onClick={enregistrer}>
              Confirmer
            </button>
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => setAConfirmer(null)}>
              Modifier
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p className="admin-erreur" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
