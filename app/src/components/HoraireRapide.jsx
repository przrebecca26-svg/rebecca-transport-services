import { horairesRapides } from "../pricing/disponibilite.js";
import "../client-commun.css";

// Boutons "Dans 1 h / Ce soir / Demain" : remplissent la date et l'heure. Un moment ferme (Chabbat, fete, fermeture) est grise.
export default function HoraireRapide({ date, heure, onChoisir }) {
  const choix = horairesRapides();
  return (
    <div className="champ">
      <span className="horaires-titre">Quand ? Choix rapide</span>
      <div className="horaires-rapides" role="group" aria-label="Choix rapide de l'horaire">
        {choix.map((c) => {
          const actif = date === c.date && heure === c.heure;
          return (
            <button
              key={c.id}
              type="button"
              className={actif ? "actif" : ""}
              aria-pressed={actif}
              disabled={c.indisponible}
              title={c.indisponible ? "Indisponible : " + c.motif : undefined}
              onClick={() => onChoisir(c.date, c.heure)}
            >
              {c.libelle}
              {c.indisponible && <small>Indisponible</small>}
            </button>
          );
        })}
      </div>
      <span className="aide">Ou choisissez une autre date et une autre heure ci-dessous.</span>
    </div>
  );
}
