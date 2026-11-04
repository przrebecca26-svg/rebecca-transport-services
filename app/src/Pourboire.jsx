import { useState } from "react";
import { TARIFS } from "./pricing/config.js";

// Choix du pourboire : montants rapides + montant libre. Valeur = texte ("" = aucun).
// Le pourboire est facultatif, va entierement a Rebecca et n'est jamais reduit par un code promo.
export default function Pourboire({ valeur, onChange, erreur, id = "pourboire" }) {
  const montants = TARIFS.pourboire.montants.map(String);
  const [libre, setLibre] = useState(valeur !== "" && !montants.includes(String(valeur)));
  const choisir = (m) => {
    setLibre(false);
    onChange(String(valeur) === m ? "" : m);
  };
  return (
    <fieldset className="champ pourboire">
      <legend>Pourboire (facultatif)</legend>
      <div className="pourboire-boutons">
        <button type="button" className={valeur === "" && !libre ? "actif" : ""} aria-pressed={valeur === "" && !libre} onClick={() => { setLibre(false); onChange(""); }}>
          Aucun
        </button>
        {montants.map((m) => (
          <button key={m} type="button" className={String(valeur) === m && !libre ? "actif" : ""} aria-pressed={String(valeur) === m && !libre} onClick={() => choisir(m)}>
            {m} ₪
          </button>
        ))}
        <button type="button" className={libre ? "actif" : ""} aria-pressed={libre} onClick={() => { setLibre(true); onChange(""); }}>
          Autre
        </button>
      </div>
      {libre && (
        <input id={id} type="text" inputMode="numeric" placeholder="Montant en ₪" value={valeur} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erreur} />
      )}
      <span className="aide">Merci ! Le pourboire revient entièrement à Rebecca, en plus du prix de la course.</span>
      {erreur && <span className="erreur">{erreur}</span>}
    </fieldset>
  );
}
