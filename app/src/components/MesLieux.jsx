import { cleLieu } from "../pricing/tournee.js";

// MES LIEUX : les adresses deja connues, par leur NOM (Maison, Ecole Ouziel, Basket...). On touche, c'est rempli.
// Si nommer est fourni : sous une adresse reconnue, une case pour lui donner (ou changer) son nom.
const IDEES = ["École ", "Gan ", "Basket", "Activité ", "Chez "];

export default function MesLieux({ id, connues, valeur, choisir, nom = "", nommer = null, maison = false }) {
  const autres = connues.filter((c) => cleLieu(c.adresse) !== cleLieu(valeur));
  const reconnue = !!cleLieu(valeur);
  return (
    <div className="rp-lieux">
      {reconnue && maison && <p className="rp-lieu-nom">Ce lieu : <b>Maison</b></p>}
      {reconnue && !maison && nommer && (
        <div className="champ">
          <label htmlFor={id}>Nom de ce lieu (école, basket, activité…)</label>
          <input id={id} type="text" maxLength={40} list={id + "-idees"} placeholder="Ex. École Ouziel, Basket, Chez Alexia" value={nom} onChange={(e) => nommer(e.target.value)} />
          <datalist id={id + "-idees"}>{IDEES.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
      )}
      {autres.length > 0 && (
        <div className="rp-adresses" role="group" aria-label="Mes lieux">
          {autres.map((c) => (
            <button key={cleLieu(c.adresse)} type="button" className={c.sansNom ? "sans-nom" : ""} onClick={() => choisir(c.adresse)}>{c.nom}</button>
          ))}
        </div>
      )}
    </div>
  );
}
