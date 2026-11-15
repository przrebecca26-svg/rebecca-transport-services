import Champ from "./Champ.jsx";
import ChoixLieu from "./MesLieux.jsx";
import { JOURS, SENS, nomEnfant, heureDuJour } from "../pricing/ramassagePlanning.js";

// UN ENFANT DU DEVIS DE RAMASSAGE (prenom, trajets, ecole, jours et heure de chaque jour).
// Meme fiche dans le Devis rapide de Rebecca et sur le site (site = true : sans « Mes lieux » de Rebecca).
export default function Enfant({ enfant, index, periode, jourUnique, changer, connues = [], famille, site = false }) {
  const set = (cle, valeur) => changer({ ...enfant, [cle]: valeur });
  const setJour = (w, cle, valeur) => changer({ ...enfant, jours: enfant.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const avecSortie = enfant.sens !== "matin";
  const avecMatin = enfant.sens !== "sortie";
  const jours = JOURS.map((nom, w) => ({ nom, w })).filter((j) => periode !== "jour" || j.w === jourUnique);
  return (
    <div className="bloc rp-enfant">
      <h3>{nomEnfant(enfant, index)}{famille ? <small> · {famille}</small> : null}</h3>
      <div className="champ">
        <label htmlFor={`rp-prenom-${index}`}>Prénom (facultatif)</label>
        <input id={`rp-prenom-${index}`} type="text" maxLength={40} value={enfant.prenom} onChange={(e) => set("prenom", e.target.value)} />
      </div>
      <fieldset className="champ">
        <legend>Quels trajets ?</legend>
        <div className="choix">
          {SENS.map((o) => (
            <button key={o.v} type="button" className={enfant.sens === o.v ? "actif" : ""} aria-pressed={enfant.sens === o.v} onClick={() => set("sens", o.v)}>{o.l}</button>
          ))}
        </div>
      </fieldset>
      <div className="champ">
        <label className="case">
          <input type="checkbox" checked={!!enfant.autreEcole} onChange={(e) => set("autreEcole", e.target.checked)} />
          <span>Dans une autre école</span>
        </label>
      </div>
      {enfant.autreEcole && (
        <>
        {!site && <ChoixLieu id={"le-" + index} connues={connues} valeur={enfant.ecole} choisir={(x) => set("ecole", x)} />}
        <Champ champ={{ name: "ecole" + index, label: "Adresse de son école", type: "adresse", required: true }} valeurs={{ ["ecole" + index]: enfant.ecole }} onChange={(_, valeur) => set("ecole", valeur)} />
        </>
      )}
      {avecMatin && (
        <div className="champ">
          <label htmlFor={`rp-matin-${index}`}>Heure du matin (au domicile)</label>
          <input id={`rp-matin-${index}`} type="time" value={enfant.heureMatin} onChange={(e) => set("heureMatin", e.target.value)} />
        </div>
      )}
      {avecSortie && periode !== "jour" && (
        <div className="champ">
          <label htmlFor={`rp-sortie-${index}`}>Heure de sortie habituelle</label>
          <input id={`rp-sortie-${index}`} type="time" value={enfant.heureSortie} onChange={(e) => set("heureSortie", e.target.value)} />
          <span className="aide">Elle se met sur tous les jours. Change ensuite l'heure des jours différents.</span>
        </div>
      )}
      {periode === "jour" && jourUnique === null && <p className="aide">Choisis d'abord la date.</p>}
      {jours.length > 0 && (
        <div className="rp-jours" role="group" aria-label={`Jours de ${nomEnfant(enfant, index)}`}>
          {jours.map(({ nom, w }) => {
            const actif = periode === "jour" || enfant.jours[w].actif;
            return (
              <div className={"rp-jour" + (actif ? "" : " inactif")} key={w}>
                {periode === "jour" ? (
                  <span className="rp-nom">{avecSortie ? `Heure de sortie (${nom.toLowerCase()})` : nom}</span>
                ) : (
                  <label className="case">
                    <input type="checkbox" checked={enfant.jours[w].actif} onChange={(e) => setJour(w, "actif", e.target.checked)} />
                    <span>{nom}</span>
                  </label>
                )}
                {avecSortie && actif && (
                  <input type="time" aria-label={`Heure de sortie du ${nom.toLowerCase()}`} value={heureDuJour(enfant, w)} onChange={(e) => setJour(w, "heure", e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

