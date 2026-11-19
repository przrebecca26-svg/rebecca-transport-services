import { useState } from "react";
import { coursesEnCours, meilleurOrdre, arretsRestants, surMaRoute } from "../pricing/coursesGroupees.js";
import { lienWazePoint } from "../pricing/navigation.js";
import { positionActuelle } from "../routing.js";

// COURSES GROUPÉES V1 (19 nov. 2026, « mode Wolt ») : prochains arrêts dans le bon ordre et petites courses en
// attente sur ma route. Calcul dans le téléphone, sans frais Google. Rien n'est accepté tout seul.
export default function CoursesGroupees({ demandes, jour, ouvrir }) {
  const [position, setPosition] = useState(null);
  const [info, setInfo] = useState("");
  const enCours = coursesEnCours(demandes, jour);
  if (!enCours.length) return null;
  const { ordre, km } = meilleurOrdre(arretsRestants(enCours), position);
  const propositions = surMaRoute(demandes, enCours, jour, position);
  const localiser = () => {
    setInfo("Je cherche ta position…");
    positionActuelle().then((p) => { setPosition(p); setInfo(""); }).catch((e) => setInfo(e.message));
  };
  return (
    <div className="tb-bloc" id="aj-groupees">
      <h3>🧭 Mes prochains arrêts</h3>
      <p className="tb-note">{enCours.length} course{enCours.length > 1 ? "s" : ""} en cours · environ {km} km · on récupère toujours avant de livrer, la plus proche d'abord.</p>
      <ol className="pm-resume">
        {ordre.map((a) => (
          <li key={a.id}>
            <span>{a.sorte === "prendre" ? "📦 Récupérer" : "✅ Livrer"} · {a.nom || "client"} <small>· {a.lieu.label}</small></span>
            <a className="tb-bouton tb-clair" href={lienWazePoint(a.lieu)} target="_blank" rel="noopener noreferrer">Waze</a>
          </li>
        ))}
      </ol>
      <div className="tb-actions">
        <button type="button" className="tb-bouton tb-clair" onClick={localiser}>📍 {position ? "Actualiser ma position" : "Partir de ma position"}</button>
      </div>
      {info && <p className="tb-note">{info}</p>}
      {propositions.length > 0 && (
        <>
          <h3>➕ Sur ta route</h3>
          {propositions.map((p) => (
            <div key={p.demande.id} className="rp-forfait">
              <span>{p.demande.nom || "Demande"} · {p.demande.service === "courses" ? "courses" : "livraison"} <small>· +{p.detourKm} km, +{p.detourMin} min{p.prix != null ? ` · ${p.prix} ₪` : ""}</small></span>
              <button type="button" className="tb-bouton" onClick={() => ouvrir(p.demande.id)}>Voir et accepter</button>
            </div>
          ))}
          <p className="tb-note">Demandes en attente aujourd'hui, récupération à moins de 2 km, détour de 4 km au plus. Une fois acceptée et partie, elle rejoint tes prochains arrêts.</p>
        </>
      )}
    </div>
  );
}
