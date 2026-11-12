// ADULTE OU ENFANT (12 nov. 2026, 22h52) : sur chaque fiche et chaque formulaire de l'espace prive,
// une case « Adulte (18 ans et plus) » et une case « Enfant (mineur) ».
// valeur : "adulte" | "enfant" | "" (pas encore choisi)
export const AGES = [
  { v: "adulte", l: "Adulte (18 ans et plus)" },
  { v: "enfant", l: "Enfant (mineur)" },
];
export const libelleAge = (v) => (v === "adulte" ? "Adulte (18+)" : v === "enfant" ? "Enfant (mineur)" : "");

export default function ChoixAge({ valeur, changer, titre = "Âge", disabled = false }) {
  return (
    <fieldset className="champ ag-age">
      <legend>{titre}</legend>
      <div className="choix" role="radiogroup" aria-label={titre}>
        {AGES.map((a) => (
          <button key={a.v} type="button" role="radio" aria-checked={valeur === a.v} className={valeur === a.v ? "actif" : ""} disabled={disabled} onClick={() => changer(a.v)}>
            {a.l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
