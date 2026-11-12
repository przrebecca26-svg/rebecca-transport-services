import { texteArret, enHeure } from "../pricing/tournee.js";
import { lienWaze } from "../pricing/navigation.js";
import { PASTILLES } from "../tourneeBase.js";

// Une journee de tournee : la reponse (possible / serre / impossible) et l'ordre des arrets avec les heures.
export default function JourneeTournee({ titre, jour, ouvert = false, nouveaux = [] }) {
  const p = PASTILLES[jour.statut] || PASTILLES.vide;
  const estNouveau = (x) => (x.trajet.ids || [x.trajet.id]).some((id) => nouveaux.includes(id));
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
          if (x.pause) return <li key={k} className="pause">{x.texte || "Libre"}{x.minutes != null ? ` : ${x.minutes >= 60 ? `${Math.floor(x.minutes / 60)} h ${String(x.minutes % 60).padStart(2, "0")}` : `${x.minutes} min`}` : ""}</li>;
          if (x.maison) return <li key={k} className="maison"><b>{enHeure(x.heure)}</b><span>{x.maison === "depart" ? "Partir de la maison" : "De retour à la maison"}</span></li>;
          const a = texteArret(x);
          return (
            <li key={k} className={(estNouveau(x) ? "nouveau " : "") + (x.depassement > 0 ? "coince" : "")}>
              <b>{a.heure}</b>
              <span>{a.texte}{a.retard} <small>{a.lieu}{a.marge ? ` · ${a.marge}` : ""}</small></span>
              <a className="rp-waze" href={lienWaze({ adresse: x.lieu.label, lat: x.lieu.lat, lon: x.lieu.lon })} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${a.lieu} dans Waze`}>Waze</a>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
