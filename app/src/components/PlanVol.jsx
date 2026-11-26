import { useState } from "react";
import { lireTableau } from "./InfoVol.jsx";
import { planVol, volDuJour } from "../pricing/planVol.js";

// 26 nov. 2026 (9h53, Rebecca) : course aéroport (Devis rapide et Calendrier) : avec le numéro de vol, je retrouve
// l'heure du vol ; avec l'heure où je la prends, je vois l'arrivée à l'aéroport, l'avance sur le vol et mon retour.
export default function PlanVol({ v, trajet, onChange }) {
  const [cherche, setCherche] = useState("");
  const minutes = trajet && trajet.statut === "ok" ? trajet.minutes : null;
  const p = planVol(v, minutes);
  const h = (x) => String(x || "").replace(":", "h");
  const chercher = async () => {
    setCherche("…");
    try {
      const lignes = await lireTableau(String(v.numeroVol || "").replace(/\D/g, ""));
      const r = volDuJour(lignes, v.numeroVol, v.date, v.direction);
      if (!r) return setCherche("Vol introuvable ce jour-là sur le tableau de l'aéroport (il n'affiche que les vols proches) : tape l'heure du vol.");
      onChange("heureVol", r.heure);
      if (r.terminal) onChange("terminal", r.terminal);
      if (r.ville && !v.villeVol) onChange("villeVol", r.ville.charAt(0) + r.ville.slice(1).toLowerCase());
      setCherche(`✅ Vol trouvé : ${h(r.heure)}${r.terminal ? `, terminal ${r.terminal}` : ""}.`);
    } catch {
      setCherche("Tableau de l'aéroport injoignable : tape l'heure du vol.");
    }
  };
  return (
    <section className="tdb-bloc">
      <h2>✈️ Le vol et ma journée</h2>
      {v.numeroVol && v.date && <button type="button" className="dr-secondaire" onClick={chercher}>🔎 Retrouver l'heure du vol {v.numeroVol}</button>}
      {cherche && <p className="tdb-note">{cherche}</p>}
      {!p && <p className="tdb-note">Indique l'heure où tu la prends, l'heure du vol et l'adresse : je calcule l'arrivée, l'avance et ton retour.</p>}
      {p && (
        <>
          <p className={"tdb-note" + (p.alerte ? " dr-alerte-min" : "")}>{p.texte}</p>
          {p.sens === "vers" && p.alerte && <p className="tdb-note dr-alerte-min">⚠️ {p.alerte === "rate" ? "Elle arrive après le vol !" : "C'est juste."} Pour être là à temps, prends-la vers {h(p.conseil)}.</p>}
          {p.sens === "depuis" && p.alerte && <p className="tdb-note dr-alerte-min">⚠️ Sois plutôt là vers {h(p.conseil)}.</p>}
          {p.sens === "vers" && <p className="tdb-note">🏠 De retour à l'adresse de départ vers {h(p.fin)} (environ {p.dureeRetour} min de route, heures de pointe comprises).</p>}
          {p.sens === "depuis" && <p className="tdb-note">🏠 Tu la déposes vers {h(p.depose)}.</p>}
        </>
      )}
    </section>
  );
}
