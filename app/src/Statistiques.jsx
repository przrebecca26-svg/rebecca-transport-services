import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { useEquipeContexte } from "./equipeContexte.jsx";
import { ADMIN_ID } from "./pricing/equipe.js";
import { vehiculesEffectifs } from "./pricing/quiFait.js";
import { COMPARAISONS, TYPES_PERIODE, comparer, csvCourses, csvDepenses, csvEncaissements, csvWolt, nomRapport, periode } from "./pricing/statistiques.js";
import "./finances.css";
import "./paiements.css";

// STATISTIQUES COMPAREES (C4) et RAPPORTS (C5) - Lot C, 9 nov. 2026.
// Rebecca : Moi / Jeremy / Global ; un coequipier : seulement ses chiffres. Aucune donnee inventee.
// Rapports : CSV (Excel, Numbers) et page imprimable (« Imprimer » puis « Enregistrer en PDF » sur iPhone).

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
const shekels = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " ₪";
const dateFr = (d) => d.split("-").reverse().join("/");
const ACTIVITES = [
  { id: "toutes", label: "Toutes" },
  { id: "coursier", label: "Coursier" },
  { id: "transport", label: "Transport" },
];

// Lecture des donnees (un coequipier : seulement ses depenses et son Wolt, regles v9)
function useDonnees(membre) {
  const [d, setD] = useState({});
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    const moi = membre ? membre.id : null;
    const lire = (nom, q) =>
      onSnapshot(q || collection(db, nom), (s) => setD((x) => ({ ...x, [nom]: s.docs.map((y) => ({ id: y.id, ...y.data() })) })), () => setErreur(true));
    const arrets = [
      lire("demandes"),
      lire("mouvements"),
      lire("depenses", moi ? query(collection(db, "depenses"), where("operateur", "==", moi)) : null),
      lire("autresRevenus", moi ? query(collection(db, "autresRevenus"), where("operateur", "==", moi)) : null),
    ];
    return () => arrets.forEach((a) => a());
  }, [membre]);
  const pret = ["demandes", "mouvements", "depenses", "autresRevenus"].every((n) => Array.isArray(d[n]));
  return { d, pret, erreur };
}

function Filtres({ options, valeur, changer, label }) {
  return (
    <div className="tb-filtres tb-pad" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={valeur === o.id} className={"tb-filtre" + (valeur === o.id ? " actif" : "")} onClick={() => changer(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function usePersonne(membre) {
  const { membres } = useEquipeContexte();
  const [personne, setPersonne] = useState(membre ? membre.id : ADMIN_ID);
  const options = membre ? [] : (membres || []).length > 1 ? [...membres.map((m) => ({ id: m.id, label: m.id === ADMIN_ID ? "Moi" : m.nom })), { id: "tous", label: "Global" }] : [];
  return { personne: membre ? membre.id : (membres || []).length > 1 ? personne : "tous", setPersonne, options, membres };
}

export default function Statistiques({ membre = null }) {
  const { d, pret, erreur } = useDonnees(membre);
  const { personne, setPersonne, options } = usePersonne(membre);
  const [type, setType] = useState("mois");
  const [comparaison, setComparaison] = useState("precedente");
  const [activite, setActivite] = useState("toutes");
  const [ref, setRef] = useState(aujourdhui());

  const r = useMemo(() => (pret ? comparer({ type, ref, comparaison, personne, activite, ...d }) : null), [pret, type, ref, comparaison, personne, activite, d]);
  if (erreur) return <p className="admin-erreur tb-pad" role="alert">Lecture des statistiques impossible. Vérifie la connexion.</p>;
  if (!r) return <p className="admin-texte tb-pad">Chargement des statistiques…</p>;
  const max = Math.max(1, r.a.valeurs.chiffreAffaires, r.b.valeurs.chiffreAffaires);

  return (
    <section className="tb-liste fi">
      <Filtres label="Période" options={TYPES_PERIODE} valeur={type} changer={setType} />
      <Filtres label="Comparer avec" options={COMPARAISONS} valeur={comparaison} changer={setComparaison} />
      <Filtres label="Activité" options={ACTIVITES} valeur={activite} changer={setActivite} />
      {options.length > 0 && <Filtres label="Personne" options={options} valeur={personne} changer={setPersonne} />}
      <label className="pm-champ tb-pad">
        Période étudiée (n'importe quel jour dedans)
        <input type="date" value={ref} max={aujourdhui()} onChange={(e) => e.target.value && setRef(e.target.value)} />
      </label>

      <div className="tb-bloc">
        <h3>Chiffre d'affaires</h3>
        {[r.a, r.b].map((x, i) => (
          <div key={i} className="st-barre">
            <span>{dateFr(x.periode.debut)} → {dateFr(x.periode.fin)}</span>
            <div className="fi-jauge"><span style={{ width: (x.valeurs.chiffreAffaires / max) * 100 + "%", opacity: i ? 0.5 : 1 }} /></div>
            <strong>{shekels(x.valeurs.chiffreAffaires)}</strong>
          </div>
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Comparaison</h3>
        <ul className="pm-resume">
          {r.lignes.map((l) => (
            <li key={l.id}>
              <span>{l.label}</span>
              <strong>
                {l.argent ? shekels(l.a) : l.a} <small>· avant {l.argent ? shekels(l.b) : l.b}</small>
                {l.variation != null && <small className={l.variation < 0 ? "bl-neg" : ""}> ({l.variation > 0 ? "+" : ""}{l.variation} %)</small>}
              </strong>
            </li>
          ))}
        </ul>
        <p className="tb-note">Chiffre d'affaires = prestations terminées à leur date + argent gardé après annulation. Pourboires et Wolt à part. Dépenses, Wolt et bénéfice : seulement pour « Toutes » les activités.</p>
      </div>
    </section>
  );
}

/* ---------- Rapports et exports (C5) ---------- */
function telecharger(nom, contenu) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function Rapports({ membre = null }) {
  const { d, pret, erreur } = useDonnees(membre);
  const { personne, setPersonne, options, membres } = usePersonne(membre);
  const { vehicules } = useEquipeContexte();
  const [type, setType] = useState("mois");
  const [ref, setRef] = useState(aujourdhui());
  const [apercu, setApercu] = useState(false);
  if (erreur) return <p className="admin-erreur tb-pad" role="alert">Lecture impossible. Vérifie la connexion.</p>;
  if (!pret) return <p className="admin-texte tb-pad">Chargement…</p>;
  const p = periode(type, ref);
  const noms = Object.fromEntries((membres || []).map((m) => [m.id, m.nom]));
  const opts = { ...d, personne, noms, vehicules: vehiculesEffectifs(vehicules || []) };
  const r = comparer({ type, ref, comparaison: "precedente", personne, activite: "toutes", ...d });
  const v = r.a.valeurs;
  const nomPersonne = personne === "tous" ? "Toute l'équipe" : noms[personne] || "Rebecca";

  return (
    <section className="tb-liste fi">
      <Filtres label="Période" options={TYPES_PERIODE} valeur={type} changer={setType} />
      {options.length > 0 && <Filtres label="Personne" options={options} valeur={personne} changer={setPersonne} />}
      <label className="pm-champ tb-pad">
        Période (n'importe quel jour dedans)
        <input type="date" value={ref} max={aujourdhui()} onChange={(e) => e.target.value && setRef(e.target.value)} />
      </label>
      <div className="tb-bloc">
        <h3>Fichiers Excel · {dateFr(p.debut)} → {dateFr(p.fin)}</h3>
        <p className="tb-note">Fichiers CSV : ils s'ouvrent dans Excel, Numbers ou Google Sheets. À envoyer au comptable.</p>
        <div className="tb-actions st-actions">
          <button className="tb-bouton tb-clair" onClick={() => telecharger(nomRapport("courses", p), csvCourses(p, opts))}>Courses</button>
          <button className="tb-bouton tb-clair" onClick={() => telecharger(nomRapport("encaissements", p), csvEncaissements(p, opts))}>Encaissements</button>
          <button className="tb-bouton tb-clair" onClick={() => telecharger(nomRapport("depenses", p), csvDepenses(p, opts))}>Dépenses</button>
          <button className="tb-bouton tb-clair" onClick={() => telecharger(nomRapport("wolt", p), csvWolt(p, opts))}>Wolt</button>
        </div>
      </div>
      <div className="tb-bloc">
        <h3>Rapport PDF</h3>
        <p className="tb-note">Ouvre le rapport, puis « Imprimer » : sur iPhone, choisis « Enregistrer dans Fichiers » ou partage le PDF.</p>
        <button className="tb-bouton" onClick={() => setApercu(true)}>Ouvrir le rapport</button>
      </div>
      {apercu && (
        <div className="st-rapport" role="dialog" aria-label="Rapport">
          <div className="st-page">
            <h2>Rebecca Services · Rapport</h2>
            <p>{nomPersonne} · du {dateFr(p.debut)} au {dateFr(p.fin)}</p>
            <table>
              <tbody>
                <tr><td>Prestations terminées</td><td>{v.courses}</td></tr>
                <tr><td>Chiffre d'affaires</td><td>{shekels(v.chiffreAffaires)}</td></tr>
                <tr><td>Encaissé</td><td>{shekels(v.encaisse)}</td></tr>
                <tr><td>Revenus Wolt et autres</td><td>{shekels(v.wolt)}</td></tr>
                <tr><td>Dépenses</td><td>{shekels(v.depenses)}</td></tr>
                <tr><td><b>Bénéfice</b></td><td><b>{shekels(v.benefice)}</b></td></tr>
                <tr><td>Pourboires (à part)</td><td>{shekels(v.pourboires)}</td></tr>
                <tr><td>Prix moyen</td><td>{shekels(v.prixMoyen)}</td></tr>
              </tbody>
            </table>
            <p className="st-petit">Calculé par l'application à partir des prestations, paiements et dépenses enregistrés. Règles de calcul provisoires, à confirmer avec le comptable. Édité le {dateFr(aujourdhui())}.</p>
          </div>
          <div className="tb-actions st-sans-impression">
            <button className="tb-bouton" onClick={() => window.print()}>Imprimer / PDF</button>
            <button className="tb-bouton tb-clair" onClick={() => setApercu(false)}>Fermer</button>
          </div>
        </div>
      )}
    </section>
  );
}
