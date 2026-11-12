import { useState } from "react";
import { JOURS, cleLieu } from "./pricing/tournee.js";
import { choixPour, heureChoix, nomRdv, titreChoix, trouverFiche } from "./pricing/familles.js";

// MES TRAJETS (12 nov. 2026) : c'est Rebecca qui choisit. « + Ajouter un trajet » -> l'enfant -> Aller ou Retour :
// son agenda est propose tout coche ; elle decoche des jours, change une heure, ou l'endroit ou elle le recupere.

function Choix({ c, familles, changer, retirer, lieux, ouvert, ouvrir }) {
  const x = trouverFiche(familles, c);
  const setJour = (w, cle, valeur) => changer({ ...c, jours: c.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const nb = c.jours.filter((j) => j.actif).length;
  if (!x) {
    return (
      <div className="bloc rp-enfant">
        <h3>Fiche supprimée du Répertoire</h3>
        <button type="button" className="dr-secondaire" onClick={retirer}>Retirer ce trajet</button>
      </div>
    );
  }
  const retour = c.sens === "retour";
  return (
    <details className="bloc rp-enfant rp-trajet" open={ouvert} onToggle={(e) => ouvrir(e.currentTarget.open)}>
      <summary>
        <h3>{titreChoix(familles, c)}</h3>
        <span className="tdb-note">{nb} jour{nb > 1 ? "s" : ""} : {JOURS.filter((_, w) => c.jours[w].actif).map((j) => j.slice(0, 3)).join(", ") || "aucun"}</span>
      </summary>
      <p className="tdb-note">{retour ? "Coche les jours où tu le récupères. Change l'heure ou l'endroit d'un jour si besoin." : "Coche les jours où tu le déposes. Change l'heure d'un jour si besoin."}</p>
      <div className="rp-jours" role="group" aria-label="Jours">
        {JOURS.map((nom, w) => (
          <div className={"rp-jour rp-jour-choix" + (c.jours[w].actif ? "" : " inactif")} key={w}>
            <label className="case">
              <input type="checkbox" checked={c.jours[w].actif} onChange={(e) => setJour(w, "actif", e.target.checked)} />
              <span>{nom}</span>
            </label>
            {c.jours[w].actif && <input type="time" aria-label={`Heure du ${nom.toLowerCase()}`} value={heureChoix(x.r, c, w)} onChange={(e) => setJour(w, "heure", e.target.value)} />}
            {c.jours[w].actif && retour && (
              <select aria-label={`Où je le récupère le ${nom.toLowerCase()}`} value={cleLieu(c.jours[w].lieu)} onChange={(e) => setJour(w, "lieu", (lieux.find((l) => cleLieu(l.adresse) === e.target.value) || {}).adresse || null)}>
                <option value="">Sur place ({nomRdv(x.r)})</option>
                {lieux.filter((l) => cleLieu(l.adresse) !== cleLieu(x.r.lieu)).map((l) => <option key={cleLieu(l.adresse)} value={cleLieu(l.adresse)}>{l.nom}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="dr-actions">
        <button type="button" className="tdb-bouton" onClick={() => ouvrir(false)}>C'est bon</button>
        <button type="button" className="dr-secondaire" onClick={retirer}>Retirer ce trajet</button>
      </div>
    </details>
  );
}

export default function MesTrajets({ familles, choix, changer, lieux }) {
  const [ajout, setAjout] = useState(false);
  const [enfant, setEnfant] = useState(""); // "famille|enfant"
  const [rdv, setRdv] = useState("");
  const [ouvert, setOuvert] = useState("");
  const enfants = familles.flatMap((f) => f.enfants.map((e) => ({ f, e, cle: `${f.id}|${e.id}`, nom: `${e.prenom || "Enfant sans prénom"} (${f.nom || "famille sans nom"})` })));
  const choisi = enfants.find((x) => x.cle === enfant);
  const rdvChoisi = choisi && (choisi.e.rdv.find((r) => r.id === rdv) || (choisi.e.rdv.length === 1 ? choisi.e.rdv[0] : null));
  const deja = (sens) => !!rdvChoisi && choix.some((c) => c.rdv === rdvChoisi.id && c.enfant === choisi.e.id && c.sens === sens);
  const ajouter = (sens) => {
    const c = choixPour(choisi.f, choisi.e, rdvChoisi, sens);
    changer([...choix, c]);
    setOuvert(c.id);
    setAjout(false);
    setEnfant("");
    setRdv("");
  };

  return (
    <>
      <section className="tdb-bloc">
        <h2>Mes trajets</h2>
        {choix.length === 0 && <p className="tdb-note">Aucun trajet pour l'instant : c'est toi qui les choisis. Touche « + Ajouter un trajet ».</p>}
      </section>
      <div className="formulaire dr-formulaire">
        {choix.map((c) => (
          <Choix key={c.id} c={c} familles={familles} lieux={lieux} ouvert={ouvert === c.id} ouvrir={(oui) => setOuvert((a) => (oui ? c.id : a === c.id ? "" : a))} changer={(n) => changer(choix.map((x) => (x.id === c.id ? n : x)))} retirer={() => changer(choix.filter((x) => x.id !== c.id))} />
        ))}
      </div>
      {!ajout && <button type="button" className="tdb-bouton rp-large" onClick={() => setAjout(true)}>+ Ajouter un trajet</button>}
      {ajout && (
        <div className="rp-correction rp-large">
          {enfants.length === 0 && <p className="rp-alerte">Aucun enfant dans ton Répertoire. Crée d'abord sa fiche dans Répertoire → Familles et enfants.</p>}
          {enfants.length > 0 && (
            <div className="champ">
              <label htmlFor="mt-enfant">Quel enfant ?</label>
              <select id="mt-enfant" value={enfant} onChange={(e) => { setEnfant(e.target.value); setRdv(""); }}>
                <option value="">— Choisir un enfant —</option>
                {enfants.map((x) => <option key={x.cle} value={x.cle}>{x.nom}</option>)}
              </select>
            </div>
          )}
          {choisi && choisi.e.rdv.length === 0 && <p className="rp-alerte">Sa fiche n'a ni école ni activité : complète-la dans le Répertoire.</p>}
          {choisi && choisi.e.rdv.length > 1 && (
            <div className="champ">
              <label htmlFor="mt-rdv">École ou activité ?</label>
              <select id="mt-rdv" value={rdv} onChange={(e) => setRdv(e.target.value)}>
                <option value="">— Choisir —</option>
                {choisi.e.rdv.map((r) => <option key={r.id} value={r.id}>{nomRdv(r)}</option>)}
              </select>
            </div>
          )}
          {rdvChoisi && (
            <div className="dr-actions">
              <button type="button" className="tdb-bouton" disabled={deja("aller")} onClick={() => ajouter("aller")}>{deja("aller") ? "Aller : déjà dans mes trajets" : `Aller : je le dépose (${nomRdv(rdvChoisi)})`}</button>
              <button type="button" className="tdb-bouton" disabled={deja("retour")} onClick={() => ajouter("retour")}>{deja("retour") ? "Retour : déjà dans mes trajets" : `Retour : je le récupère (${nomRdv(rdvChoisi)})`}</button>
            </div>
          )}
          <button type="button" className="dr-secondaire" onClick={() => setAjout(false)}>Annuler</button>
        </div>
      )}
    </>
  );
}
