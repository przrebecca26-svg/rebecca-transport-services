import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { CATEGORIES, moisDe, moisDecale, resumeMois, totalCategorie, validerDepense } from "./pricing/depenses.js";
import "./paiements.css";
import "./depenses.css";

// Depenses de l'activite (espace prive de Rebecca).
// Chaque depense est une nouvelle ligne : jamais modifiee, jamais supprimee.
// Une erreur se corrige avec « Corriger une erreur » (ligne negative avec un motif).

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const euros = (n) => Math.round(n * 100) / 100 + " ₪";
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
};
const nomMois = (mois) => {
  const [a, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1, 12)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
};
const versNombre = (x) => Math.round(Number(String(x).replace(",", ".")) * 100) / 100;

export default function Depenses() {
  const [depenses, setDepenses] = useState(null); // null = chargement
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [mois, setMois] = useState(moisDe(aujourdhui()));
  const [mode, setMode] = useState(null); // null | "depense" | "correction"
  const [categorie, setCategorie] = useState(CATEGORIES[0]);
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(aujourdhui());
  const [motif, setMotif] = useState("");
  const [aConfirmer, setAConfirmer] = useState(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "depenses"), orderBy("date", "desc"));
    return onSnapshot(
      q,
      (snap) => setDepenses(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setLectureImpossible(true)
    );
  }, []);

  // Un message d'erreur disparait des qu'un champ est modifie
  useEffect(() => {
    setErreur("");
  }, [montant, motif, date, categorie]);

  const resume = useMemo(() => resumeMois(depenses || [], mois), [depenses, mois]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture des dépenses impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (depenses === null) return <p className="admin-texte tb-pad">Chargement des dépenses…</p>;

  const ouvrir = (m) => {
    setMode(m);
    setCategorie(CATEGORIES[0]);
    setMontant("");
    setDate(aujourdhui());
    setMotif("");
    setAConfirmer(null);
    setErreur("");
  };
  const fermer = () => {
    setMode(null);
    setAConfirmer(null);
    setErreur("");
  };

  const preparer = () => {
    const n = versNombre(montant);
    if (!Number.isFinite(n) || n <= 0 || String(montant).trim() === "") {
      setErreur(mode === "correction" ? "Entre le montant à retirer, en shekels (nombre positif)." : "Entre un montant valide, en shekels.");
      return;
    }
    const d = { date, categorie, montant: mode === "correction" ? -n : n };
    const m = motif.trim().slice(0, 200);
    if (m) d.motif = m;
    let err = validerDepense(d);
    if (!err && mode === "correction" && totalCategorie(depenses, categorie) + d.montant < 0) err = "Cette correction rendrait le total de cette catégorie négatif.";
    if (err) {
      setErreur(err);
      return;
    }
    setErreur("");
    setAConfirmer(d);
  };

  const enregistrer = async () => {
    if (!aConfirmer) return;
    setEnCours(true);
    setErreur("");
    try {
      await addDoc(collection(db, "depenses"), { ...aConfirmer, creeLe: serverTimestamp() });
      setMois(moisDe(aConfirmer.date));
      fermer();
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion puis réessaie.");
    }
    setEnCours(false);
  };

  const moisCourant = moisDe(aujourdhui());

  return (
    <section className="tb-liste">
      <div className="dp-mois">
        <button className="dp-fleche" aria-label="Mois précédent" onClick={() => setMois(moisDecale(mois, -1))}>
          ‹
        </button>
        <strong>{nomMois(mois)}</strong>
        <button className="dp-fleche" aria-label="Mois suivant" disabled={mois >= moisCourant} onClick={() => setMois(moisDecale(mois, 1))}>
          ›
        </button>
      </div>

      <div className="tb-bloc">
        <p className="dp-total">
          <span>Dépenses du mois</span>
          <strong>{euros(resume.total)}</strong>
        </p>
        {resume.parCategorie.length > 0 && (
          <ul className="pm-resume">
            {resume.parCategorie.map((c) => (
              <li key={c.categorie}>
                <span>{c.categorie}</span>
                <strong>{euros(c.montant)}</strong>
              </li>
            ))}
          </ul>
        )}
        {resume.lignes.length === 0 && <p className="tb-note">Aucune dépense ce mois-ci.</p>}
        <p className="tb-note">Ces dépenses servent à calculer ton bénéfice : chiffre d'affaires réalisé moins dépenses.</p>

        {mode === null && (
          <div className="tb-actions">
            <button className="tb-bouton" onClick={() => ouvrir("depense")}>
              Ajouter une dépense
            </button>
            {depenses.length > 0 && (
              <button className="tb-bouton tb-clair" onClick={() => ouvrir("correction")}>
                Corriger une erreur
              </button>
            )}
          </div>
        )}

        {mode !== null && !aConfirmer && (
          <div className="pm-form">
            <h4>{mode === "depense" ? "Nouvelle dépense" : "Corriger une erreur"}</h4>
            <label className="pm-champ">
              Catégorie
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="pm-champ">
              {mode === "depense" ? "Montant (₪)" : "Montant à retirer du total (₪)"}
              <input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </label>
            <label className="pm-champ">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="pm-champ">
              {mode === "depense" ? "Détail (facultatif)" : "Motif (obligatoire)"}
              <input value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} placeholder={mode === "depense" ? "Ex : plein à Netanya" : "Ex : saisi en double"} />
            </label>
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

        {mode !== null && aConfirmer && (
          <div className="pm-form">
            <h4>Confirmer ?</h4>
            <p>
              {aConfirmer.montant < 0 ? "Correction de " : "Dépense de "}
              <strong>{euros(Math.abs(aConfirmer.montant))}</strong> en <strong>{aConfirmer.categorie}</strong> le {jourCourt(aConfirmer.date)}
            </p>
            {aConfirmer.montant < 0 && <p className="tb-note">Ce montant sera retiré de tes dépenses.</p>}
            <p className="tb-note">Une fois enregistrée, elle ne peut plus être modifiée ni supprimée (une erreur se corrige par une nouvelle ligne).</p>
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

      {resume.lignes.length > 0 && (
        <div className="tb-bloc">
          <h3>Détail du mois</h3>
          <ul className="pm-liste">
            {resume.lignes.map((d) => (
              <li key={d.id}>
                <span>
                  {jourCourt(d.date)} · {d.montant < 0 ? "Correction · " : ""}
                  {d.categorie}
                  {d.motif ? <small> ({d.motif})</small> : null}
                </span>
                <strong>{(d.montant < 0 ? "-" : "") + euros(Math.abs(d.montant))}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
