import { cleLieu } from "../pricing/tournee.js";
import { distanceKm } from "../routing.js";

// MES LIEUX (12 nov. 2026) : au-dessus de chaque adresse, une liste « Choisir un lieu deja enregistre » (Maison,
// Ecole, Basket...) ; on ne retape une adresse que si le lieu est nouveau.
// Sous l'adresse : son nom (a donner une fois), et une alerte si elle est tres loin de la maison.
const IDEES = ["École ", "Gan ", "Basket", "Activité ", "Chez "];
const LOIN_KM = 25;

// Liste deroulante des lieux connus. connues = [{ nom, adresse, sansNom }]
export default function ChoixLieu({ id, connues, valeur, choisir }) {
  if (connues.length === 0) return null;
  const actuel = connues.find((c) => cleLieu(c.adresse) === cleLieu(valeur));
  return (
    <div className="champ rp-choix-lieu">
      <label htmlFor={id}>Choisir un lieu déjà enregistré</label>
      <select
        id={id}
        value={actuel ? cleLieu(actuel.adresse) : ""}
        onChange={(e) => {
          const c = connues.find((x) => cleLieu(x.adresse) === e.target.value);
          if (c) choisir(c.adresse);
        }}
      >
        <option value="">— Choisir dans mes lieux —</option>
        {connues.map((c) => (
          <option key={cleLieu(c.adresse)} value={cleLieu(c.adresse)}>{c.sansNom ? `${c.nom} (sans nom)` : c.nom}</option>
        ))}
      </select>
      <span className="aide">Ou tape une nouvelle adresse juste en dessous.</span>
    </div>
  );
}

// Nom du lieu (a donner une fois) et alerte « tres loin de la maison »
export function NomLieu({ id, valeur, nom = "", nommer = null, domicile = null }) {
  if (!cleLieu(valeur)) return null;
  const maison = !!cleLieu(domicile) && cleLieu(domicile) === cleLieu(valeur);
  const km = cleLieu(domicile) && !maison ? Math.round(distanceKm(domicile, valeur)) : 0;
  return (
    <div className="rp-lieux">
      {maison && <p className="rp-lieu-nom">Ce lieu : <b>Maison</b></p>}
      {!maison && nommer && (
        <div className="champ">
          <label htmlFor={id}>Nom de ce lieu (école, basket, activité…)</label>
          <input id={id} type="text" maxLength={40} list={id + "-idees"} placeholder="Ex. École Ouziel, Chez Alexia" value={nom} onChange={(e) => nommer(e.target.value)} />
          <datalist id={id + "-idees"}>{IDEES.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
      )}
      {km > LOIN_KM && <p className="rp-alerte">⚠️ Cette adresse est à {km} km de la maison. Vérifie la ville : ce n'est peut-être pas la bonne.</p>}
    </div>
  );
}
