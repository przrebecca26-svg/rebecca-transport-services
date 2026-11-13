import { useMemo, useState } from "react";
import DetailCourses from "./DetailCourses.jsx";
import { dateCreation } from "../pricing/tableauBord.js";
import { encaisseBrut } from "../pricing/comptes.js";

// LES 4 CHIFFRES, CLIQUABLES (13 nov. 2026) - tableau de bord et page de chaque activite.
// Un chiffre touche = la liste des courses qui le font, avec Ouvrir et Supprimer (courses de test).
// Le chiffre d'affaires compte aussi l'argent garde apres une annulation : ces courses annulees sont dans la liste.
const shekels = (n) => `${(Math.round(Number(n || 0) * 100) / 100).toLocaleString("fr-FR")} ₪`;

// general (13 nov. 2026, 10h13, tableau de bord) : chiffre d'affaires total (Rebecca Services + Wolt), Rebecca Services,
// Wolt, prestations terminees, prestations en attente, encaisse (avec Wolt), reste a encaisser.
// wolt = lignes Wolt de la periode ({ debut, fin, livraisons, revenu })
export default function ChiffresDetail({ chiffres, demandes = [], recues = null, mouvements = [], periode, aller = null, peutSupprimer = false, general = false, wolt = [] }) {
  const [detail, setDetail] = useState("");
  const dansP = (d) => !!d && d >= periode.debut && d <= periode.fin;
  const liste2 = (k) => {
    const annul = k === "ca" ? new Set(mouvements.filter((m) => m.kind === "annulation" && dansP(m.date)).map((m) => m.resId)) : new Set();
    return demandes.filter((d) => (d.statut === "terminee" && dansP(d.date)) || annul.has(d.id));
  };
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
    if (detail === "attente") return demandes.filter((d) => (d.statut === "en attente" || d.statut === "acceptee") && dansP(d.date));
    if (detail === "reste") return demandes.filter((d) => d.statut === "terminee" && dansP(d.date) && (Number(d.prixFinal) || 0) - encaisseBrut(mouvements, d.id) > 0.009);
    if (detail === "total" || detail === "rs") return liste2("ca");
    return [];
  }, [detail, demandes, recues, mouvements, periode.debut, periode.fin]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = (x, argent) => (chiffres ? (argent ? shekels(x) : String(x)) : "…");
  const woltTotal = wolt.reduce((t, l) => t + (Number(l.revenu) || 0), 0);
  const enAttente = demandes.filter((d) => (d.statut === "en attente" || d.statut === "acceptee") && dansP(d.date)).length;
  const reste = demandes.filter((d) => d.statut === "terminee" && dansP(d.date)).reduce((t, d) => t + Math.max(0, (Number(d.prixFinal) || 0) - encaisseBrut(mouvements, d.id)), 0);
  const cases = general
    ? [
        ["total", "Chiffre d'affaires total", v(chiffres && chiffres.caRealise + woltTotal, true)],
        ["rs", "Chiffre d'affaires Rebecca Services", v(chiffres && chiffres.caRealise, true)],
        ["wolt", "Chiffre d'affaires Wolt", v(woltTotal, true)],
        ["faites", "Prestations terminées", v(chiffres && chiffres.prestationsTerminees)],
        ["attente", "Prestations en attente", v(enAttente)],
        ["encaisse", "Encaissé (avec Wolt)", v(chiffres && chiffres.encaisse + woltTotal, true)],
        ["reste", "Reste à encaisser", v(reste, true)],
      ]
    : [
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
      {detail === "wolt" ? (
        <div className="tdb-detail">
          {wolt.length === 0 && <p className="tdb-note">Aucune ligne Wolt sur cette période.</p>}
          {wolt.map((l, i) => <p key={i} className="tdb-note">{l.debut} → {l.fin} · {l.livraisons} livraisons · {shekels(Number(l.revenu) || 0)}</p>)}
          {aller && <button type="button" className="rp-waze" onClick={() => aller("finances")}>Modifier dans Finances → Wolt</button>}
        </div>
      ) : detail && <DetailCourses demandes={liste} mouvements={mouvements} aller={aller} peutSupprimer={peutSupprimer} vide="Rien sur cette période." />}
    </>
  );
}
