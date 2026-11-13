import { useMemo, useState } from "react";
import DetailCourses from "./DetailCourses.jsx";
import { dateCreation } from "../pricing/tableauBord.js";

// LES 4 CHIFFRES, CLIQUABLES (13 nov. 2026) - tableau de bord et page de chaque activite.
// Un chiffre touche = la liste des courses qui le font, avec Ouvrir et Supprimer (courses de test).
// Le chiffre d'affaires compte aussi l'argent garde apres une annulation : ces courses annulees sont dans la liste.
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;

export default function ChiffresDetail({ chiffres, demandes = [], recues = null, mouvements = [], periode, aller = null, peutSupprimer = false }) {
  const [detail, setDetail] = useState("");
  const dansP = (d) => !!d && d >= periode.debut && d <= periode.fin;
  const liste = useMemo(() => {
    if (!detail) return [];
    const mouv = (kinds) => new Set(mouvements.filter((m) => kinds.includes(m.kind) && dansP(m.date)).map((m) => m.resId));
    if (detail === "ca" || detail === "faites") {
      const annul = detail === "ca" ? mouv(["annulation"]) : new Set();
      return demandes.filter((d) => (d.statut === "terminee" && dansP(d.date)) || annul.has(d.id));
    }
    if (detail === "encaisse") {
      const ids = mouv(["paiement", "correction", "remboursement_effectue"]);
      return demandes.filter((d) => ids.has(d.id));
    }
    if (detail === "recues") return (recues || demandes).filter((d) => dansP(dateCreation(d)));
    return [];
  }, [detail, demandes, recues, mouvements, periode.debut, periode.fin]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = (x, argent) => (chiffres ? (argent ? shekels(x) : String(x)) : "…");
  const cases = [
    ["ca", "Chiffre d'affaires réalisé", v(chiffres && chiffres.caRealise, true)],
    ["faites", "Prestations terminées", v(chiffres && chiffres.prestationsTerminees)],
    ["encaisse", "Encaissé", v(chiffres && chiffres.encaisse, true)],
    ["recues", "Demandes reçues", v(chiffres && chiffres.demandesRecues)],
  ];
  return (
    <>
      <div className="tdb-grille">
        {cases.map(([id, nom, val]) => (
          <button key={id} type="button" className={"tdb-chiffre tdb-cliquable" + (detail === id ? " ouvert" : "")} onClick={() => setDetail(detail === id ? "" : id)} aria-expanded={detail === id}>
            <span>{nom}</span><b>{val}</b>
          </button>
        ))}
      </div>
      {detail && <DetailCourses demandes={liste} mouvements={mouvements} aller={aller} peutSupprimer={peutSupprimer} vide="Rien sur cette période." />}
    </>
  );
}
