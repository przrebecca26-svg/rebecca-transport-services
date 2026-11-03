import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";
import { indicateurs } from "./pricing/comptes.js";
import { TYPES, decaler, libelle, periodeDe, suivantPossible } from "./pricing/bilan.js";
import { journalCsv, joursEntre, nomFichier, sauvegardeJson } from "./pricing/sauvegarde.js";
import "./paiements.css";
import "./depenses.css";
import "./bilan.css";

// Bilan de l'activite (espace prive de Rebecca) : tout est calcule a partir des courses,
// des paiements et des depenses enregistres. Rien n'est saisi ici.

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const euros = (n) => Math.round(n * 100) / 100 + " ₪";

const CLE_SAUVEGARDE = "rebecca-derniere-sauvegarde";
const dateSauvegarde = () => {
  try {
    return localStorage.getItem(CLE_SAUVEGARDE) || "";
  } catch {
    return "";
  }
};
const noterSauvegarde = (d) => {
  try {
    localStorage.setItem(CLE_SAUVEGARDE, d);
  } catch {
    /* sans importance : le fichier est deja telecharge */
  }
};
function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function Ligne({ nom, valeur, sous }) {
  return (
    <li className={sous ? "bl-sous" : undefined}>
      <span>{nom}</span>
      <strong>{valeur}</strong>
    </li>
  );
}

export default function Bilan() {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  const [depenses, setDepenses] = useState(null);
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [type, setType] = useState("mois");
  const [ref, setRef] = useState(aujourdhui());
  const [derniere, setDerniere] = useState(dateSauvegarde());
  const [erreurFichier, setErreurFichier] = useState("");

  useEffect(() => {
    const echec = () => setLectureImpossible(true);
    const arrets = [
      onSnapshot(query(collection(db, "demandes"), orderBy("creeLe", "desc")), (s) => setDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec),
      onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec),
      onSnapshot(query(collection(db, "depenses"), orderBy("date", "desc")), (s) => setDepenses(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec),
    ];
    return () => arrets.forEach((a) => a());
  }, []);

  const periode = periodeDe(type, ref);
  const ind = useMemo(() => {
    const reservations = (demandes || []).map((d) => ({
      id: d.id,
      date: d.date,
      prixConvenu: typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null,
      statut: d.statut,
    }));
    return indicateurs(reservations, mouvements || [], depenses || [], periode);
  }, [demandes, mouvements, depenses, periode && periode.debut, periode && periode.fin]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture du bilan impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (demandes === null || mouvements === null || depenses === null) return <p className="admin-texte tb-pad">Chargement du bilan…</p>;

  const categories = Object.entries(ind.depensesParCategorie)
    .filter(([, m]) => m !== 0)
    .sort((a, b) => b[1] - a[1]);
  const nbCourses = ind.nbCoursesTerminees;

  const sauvegarder = () => {
    setErreurFichier("");
    try {
      const jour = aujourdhui();
      telecharger(nomFichier("sauvegarde", jour, "json"), sauvegardeJson({ demandes, mouvements, depenses }), "application/json");
      noterSauvegarde(jour);
      setDerniere(jour);
    } catch {
      setErreurFichier("Le téléchargement a échoué. Réessaie.");
    }
  };
  const exporterJournal = () => {
    setErreurFichier("");
    try {
      telecharger(nomFichier("journal", aujourdhui(), "csv"), journalCsv({ demandes, mouvements, depenses }), "text/csv;charset=utf-8");
    } catch {
      setErreurFichier("Le téléchargement a échoué. Réessaie.");
    }
  };
  const ageSauvegarde = derniere ? joursEntre(derniere, aujourdhui()) : null;

  return (
    <section className="tb-liste">
      <div className="tb-filtres" role="tablist" aria-label="Période du bilan">
        {TYPES.map((t) => (
          <button key={t.id} role="tab" aria-selected={type === t.id} className={"tb-filtre" + (type === t.id ? " actif" : "")} onClick={() => { setType(t.id); setRef(aujourdhui()); }}>
            {t.titre}
          </button>
        ))}
      </div>

      {type !== "tout" && (
        <div className="dp-mois">
          <button className="dp-fleche" aria-label="Période précédente" onClick={() => setRef(decaler(type, ref, -1))}>
            ‹
          </button>
          <strong>{libelle(type, ref)}</strong>
          <button className="dp-fleche" aria-label="Période suivante" disabled={!suivantPossible(type, ref, aujourdhui())} onClick={() => setRef(decaler(type, ref, 1))}>
            ›
          </button>
        </div>
      )}
      {type === "tout" && <p className="tb-note">{libelle("tout", ref)}</p>}

      <div className="tb-bloc">
        <h3>Résultat</h3>
        <p className="bl-gros">
          <span>Bénéfice</span>
          <strong className={ind.beneficeOperationnel < 0 ? "bl-neg" : undefined}>{euros(ind.beneficeOperationnel)}</strong>
        </p>
        <p className="tb-note">Bénéfice opérationnel = chiffre d'affaires réalisé moins dépenses.</p>
        <ul className="pm-resume">
          <Ligne nom="Chiffre d'affaires réalisé" valeur={euros(ind.caRealise)} />
          <Ligne sous nom={"Courses terminées (" + nbCourses + ")"} valeur={euros(ind.caCourses)} />
          <Ligne sous nom="Gardé après annulation" valeur={euros(ind.caAnnulations)} />
          <Ligne nom="Dépenses" valeur={euros(ind.depenses)} />
        </ul>
        {nbCourses > 0 && <p className="tb-note">Prix moyen d'une course : {euros(ind.prixMoyen)}</p>}
      </div>

      <div className="tb-bloc">
        <h3>Argent reçu</h3>
        <ul className="pm-resume">
          <Ligne nom="Argent encaissé" valeur={euros(ind.argentEncaisse)} />
          <Ligne nom="Remboursé aux clients" valeur={euros(ind.rembourse)} />
          <Ligne nom="Encaissé après remboursements" valeur={euros(ind.encaisseNet)} />
        </ul>
        <p className="tb-note">L'argent encaissé compte tout ce que tu as reçu, même avant la course. Ce n'est pas encore du chiffre d'affaires.</p>
      </div>

      {categories.length > 0 && (
        <div className="tb-bloc">
          <h3>Dépenses par catégorie</h3>
          <ul className="pm-resume">
            {categories.map(([nom, m]) => (
              <Ligne key={nom} nom={nom} valeur={euros(m)} />
            ))}
          </ul>
        </div>
      )}

      <div className="tb-bloc">
        <h3>Situation actuelle</h3>
        <ul className="pm-resume">
          <Ligne nom="Avances clients" valeur={euros(ind.avancesClients)} />
          <Ligne nom="Remboursements à effectuer" valeur={euros(ind.remboursementsAEffectuer)} />
          <Ligne nom="Reste à encaisser" valeur={euros(ind.resteAEncaisser)} />
        </ul>
        <p className="tb-note">Avances : argent reçu pour des courses pas encore faites. Reste à encaisser : courses terminées pas encore payées en totalité. Ces trois lignes montrent la situation d'aujourd'hui, quelle que soit la période choisie.</p>
      </div>

      <div className="tb-bloc">
        <h3>Sauvegarde</h3>
        <p className="tb-note">
          {derniere === ""
            ? "Aucune sauvegarde faite depuis cet appareil."
            : ageSauvegarde >= 7
              ? "Dernière sauvegarde il y a " + ageSauvegarde + " jours : pense à en faire une nouvelle."
              : ageSauvegarde === 0
                ? "Dernière sauvegarde : aujourd'hui."
                : "Dernière sauvegarde il y a " + ageSauvegarde + " jour" + (ageSauvegarde > 1 ? "s" : "") + "."}
        </p>
        <div className="tb-actions">
          <button className="tb-bouton" onClick={sauvegarder}>
            Télécharger ma sauvegarde
          </button>
          <button className="tb-bouton tb-clair" onClick={exporterJournal}>
            Journal des comptes (tableur)
          </button>
        </div>
        {erreurFichier && (
          <p className="admin-erreur" role="alert">
            {erreurFichier}
          </p>
        )}
        <p className="tb-note">
          La sauvegarde contient toutes tes demandes, paiements, remboursements et dépenses. Le journal s'ouvre dans Excel ou Numbers. Garde ces fichiers en lieu sûr : ils contiennent les noms et numéros de tes clients. Une sauvegarde par semaine est conseillée.
        </p>
      </div>
    </section>
  );
}
