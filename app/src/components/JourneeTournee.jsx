import { texteArret } from "../pricing/tournee.js";
import { PASTILLES } from "../tourneeBase.js";

// Une journee de tournee : la reponse (possible / serre / impossible) et l'ordre des arrets avec les heures.
export default function JourneeTournee({ titre, jour, ouvert = false, nouveaux = [] }) {
  const p = PASTILLES[jour.statut] || PASTILLES.vide;
  const estNouveau = (x) => nouveaux.includes(x.trajet.id);
  return (
    <details className={"rp-journee " + jour.statut} open={ouvert}>
      <summary>
        <span>{titre}</span>
        <b>{p.signe} {p.texte}{jour.statut === "serre" ? ` (${jour.retard} min de retard)` : ""}</b>
      </summary>
      {jour.probleme && <p className="rp-alerte">{jour.probleme}</p>}
      {jour.incomplets.length > 0 && <p className="tdb-note">Pas comptés (à compléter dans Tournée scolaire) : {jour.incomplets.map((r) => r.nom || "trajet sans nom").join(", ")}.</p>}
      <ol className="rp-arrets">
        {jour.arrets.map((x, k) => {
          if (x.pause) return <li key={k} className="pause">Libre</li>;
          const a = texteArret(x);
          return (
            <li key={k} className={(estNouveau(x) ? "nouveau " : "") + (x.depassement > 0 ? "coince" : "")}>
              <b>{a.heure}</b>
              <span>{a.texte}{a.retard} <small>{a.lieu}</small></span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
