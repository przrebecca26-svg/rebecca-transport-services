import { useState } from "react";
import Champ from "./components/Champ.jsx";
import ChoixLieu from "./components/MesLieux.jsx";
import { JOURS } from "./pricing/tournee.js";
import { familleVide, enfantFicheVide, rdvVide, manqueRdv, nomRdv, arriveeDuJour, sortieDuJour, doublonsFamilles, fusionnerDoublon } from "./pricing/familles.js";

// FAMILLES ET ENFANTS (12 nov. 2026) : dans le Repertoire, la fiche de chaque enfant (ecole, activites, jours,
// heures). La tournee scolaire se construit toute seule a partir de ces fiches.

function Adresse({ id, label, valeur, changer, connues }) {
  return (
    <>
      <ChoixLieu id={"c" + id} connues={connues} valeur={valeur} choisir={changer} />
      <Champ champ={{ name: id, label, type: "adresse" }} valeurs={{ [id]: valeur }} onChange={(_, v) => changer(v)} />
    </>
  );
}

function Rdv({ famille, r, changer, supprimer, connues }) {
  const set = (cle, valeur) => changer({ ...r, [cle]: valeur });
  const setJour = (w, cle, valeur) => changer({ ...r, jours: r.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const manque = manqueRdv(famille, r);
  const [plus, setPlus] = useState(!!(r.retour || r.priseAilleurs || r.attend || r.heurePrise));
  const [parJour, setParJour] = useState(r.jours.some((j) => j.arrivee || j.sortie)); // ouvert seulement si un jour a deja son heure a lui
  return (
    <div className="rp-rdv">
      <p className="rp-type">{nomRdv(r)}{manque ? <span className="rp-alerte"> · à compléter : {manque}</span> : ""}</p>
      {r.type === "activite" && (
        <div className="champ">
          <label htmlFor={"rn" + r.id}>Nom de l'activité (basket, danse…)</label>
          <input id={"rn" + r.id} type="text" maxLength={40} value={r.nom} onChange={(e) => set("nom", e.target.value)} />
        </div>
      )}
      <Adresse id={"rl" + r.id} label={r.type === "ecole" ? "Adresse de l'école ou du Gan" : "Adresse de l'activité"} valeur={r.lieu} changer={(v) => set("lieu", v)} connues={connues} />
      <div className="rp-vacances">
        <label className="case"><input type="checkbox" checked={r.depose} onChange={(e) => set("depose", e.target.checked)} /><span>Je le dépose</span></label>
        <label className="case"><input type="checkbox" checked={r.recupere} onChange={(e) => set("recupere", e.target.checked)} /><span>Je le récupère</span></label>
      </div>
      <div className="rp-vacances">
        {r.depose && <label>Commence à <input type="time" value={r.heureArrivee} onChange={(e) => set("heureArrivee", e.target.value)} /></label>}
        {r.recupere && <label>Finit à <input type="time" value={r.heureSortie} onChange={(e) => set("heureSortie", e.target.value)} /></label>}
      </div>
      <fieldset className="champ">
        <legend>Quels jours ?</legend>
        <div className="choix rp-six">
          {JOURS.map((nom, w) => (
            <button key={w} type="button" className={r.jours[w].actif ? "actif" : ""} aria-pressed={r.jours[w].actif} aria-label={nom} onClick={() => setJour(w, "actif", !r.jours[w].actif)}>{nom.slice(0, 3)}</button>
          ))}
        </div>
        <span className="aide">Les heures ci-dessus valent pour tous les jours choisis : rien d'autre à remplir si c'est pareil chaque jour.</span>
      </fieldset>
      <button type="button" className="rp-waze" onClick={() => setParJour(!parJour)}>{parJour ? "Mêmes heures tous les jours" : "Une heure différente certains jours"}</button>
      {parJour && (
        <div className="rp-jours" role="group" aria-label="Heures par jour">
          {JOURS.map((nom, w) => (r.jours[w].actif ? (
            <div className="rp-jour" key={w}>
              <span className="rp-nom">{nom}</span>
              {r.depose && <input type="time" aria-label={`Commence le ${nom.toLowerCase()}`} value={arriveeDuJour(r, w)} onChange={(e) => setJour(w, "arrivee", e.target.value)} />}
              {r.recupere && <input type="time" aria-label={`Finit le ${nom.toLowerCase()}`} value={sortieDuJour(r, w)} onChange={(e) => setJour(w, "sortie", e.target.value)} />}
            </div>
          ) : null))}
        </div>
      )}
      <button type="button" className="rp-waze" onClick={() => setPlus(!plus)}>{plus ? "Moins de détails" : "Plus de détails (où je le ramène, il m'attend ailleurs…)"}</button>
      {plus && (
        <div className="rp-correction">
          {r.depose && (
            <div className="champ">
              <label htmlFor={"rp" + r.id}>Je le prends à la maison à partir de (facultatif)</label>
              <input id={"rp" + r.id} type="time" value={r.heurePrise} onChange={(e) => set("heurePrise", e.target.value)} />
            </div>
          )}
          {r.recupere && (
            <>
              <Adresse id={"rr" + r.id} label="Où je le ramène (vide = son domicile)" valeur={r.retour} changer={(v) => set("retour", v)} connues={connues} />
              <Adresse id={"ra" + r.id} label="Il m'attend ailleurs qu'ici (chez une amie…), facultatif" valeur={r.priseAilleurs} changer={(v) => set("priseAilleurs", v)} connues={connues} />
              {r.priseAilleurs && (
                <fieldset className="champ">
                  <legend>Quels jours il m'attend là-bas ? (les autres jours, je le prends sur place)</legend>
                  <div className="choix rp-six">
                    {JOURS.map((nom, w) => (r.jours[w].actif ? (
                      <button key={w} type="button" className={r.joursAilleurs[w] ? "actif" : ""} aria-pressed={r.joursAilleurs[w]} aria-label={nom} onClick={() => set("joursAilleurs", r.joursAilleurs.map((x, k) => (k === w ? !x : x)))}>{nom.slice(0, 3)}</button>
                    ) : <span key={w} />))}
                  </div>
                </fieldset>
              )}
              <label className="case"><input type="checkbox" checked={r.attend} onChange={(e) => set("attend", e.target.checked)} /><span>Là-bas, il peut m'attendre (pas de retard maximum)</span></label>
            </>
          )}
        </div>
      )}
      <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer {r.type === "ecole" ? "l'école" : "cette activité"}</button>
    </div>
  );
}

function Famille({ f, changer, supprimer, connues, ouvert, ouvrir }) {
  const set = (cle, valeur) => changer({ ...f, [cle]: valeur });
  const setEnfant = (id, e) => set("enfants", f.enfants.map((x) => (x.id === id ? e : x)));
  const nb = f.enfants.length;
  return (
    <details className="bloc rp-enfant rp-trajet" open={ouvert} onToggle={(e) => ouvrir(e.currentTarget.open)}>
      <summary>
        <h3>{f.nom || "Nouvelle famille"}</h3>
        <span className="tdb-note">{nb} enfant{nb > 1 ? "s" : ""} : {f.enfants.map((e) => e.prenom || "sans prénom").join(", ")}</span>
      </summary>
      <button type="button" className="tdb-retour" onClick={() => ouvrir(false)}>← Retour au répertoire</button>
      <div className="champ">
        <label htmlFor={"fn" + f.id}>Nom du parent (moi, Alexia, une cliente…)</label>
        <input id={"fn" + f.id} type="text" maxLength={60} value={f.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor={"ft" + f.id}>Téléphone (facultatif)</label>
        <input id={"ft" + f.id} type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(e) => set("telephone", e.target.value)} />
      </div>
      <Adresse id={"fd" + f.id} label="Domicile de la famille" valeur={f.domicile} changer={(v) => set("domicile", v)} connues={connues} />
      <p className="rp-type">Adresses favorites</p>
      {(f.adresses || []).map((x, k) => (
        <div className="rp-correction" key={k}>
          <div className="champ">
            <label htmlFor={"an" + f.id + k}>Nom (travail, grands-parents…)</label>
            <input id={"an" + f.id + k} type="text" maxLength={40} value={x.nom} onChange={(e) => set("adresses", f.adresses.map((y, i) => (i === k ? { ...y, nom: e.target.value } : y)))} />
          </div>
          <Adresse id={"aa" + f.id + k} label="Adresse" valeur={x.adresse} changer={(v) => set("adresses", f.adresses.map((y, i) => (i === k ? { ...y, adresse: v } : y)))} connues={connues} />
          <button type="button" className="dr-secondaire" onClick={() => set("adresses", f.adresses.filter((_, i) => i !== k))}>Supprimer cette adresse</button>
        </div>
      ))}
      <button type="button" className="dr-secondaire" onClick={() => set("adresses", [...(f.adresses || []), { nom: "", adresse: null }])}>+ Ajouter une adresse favorite</button>
      <fieldset className="champ">
        <legend>Seulement entre deux dates (forfait d'une cliente), facultatif</legend>
        <div className="rp-vacances">
          <label>Du <input type="date" value={f.du} onChange={(e) => set("du", e.target.value)} /></label>
          <label>Au <input type="date" value={f.au} min={f.du || undefined} onChange={(e) => set("au", e.target.value)} /></label>
        </div>
      </fieldset>

      {f.enfants.map((e) => (
        <div className="rp-fiche-enfant" key={e.id}>
          <div className="champ">
            <label htmlFor={"ep" + e.id}>Prénom de l'enfant</label>
            <input id={"ep" + e.id} type="text" maxLength={40} value={e.prenom} onChange={(x) => setEnfant(e.id, { ...e, prenom: x.target.value })} />
          </div>
          {e.rdv.map((r) => (
            <Rdv key={r.id} famille={f} r={r} connues={connues} changer={(n) => setEnfant(e.id, { ...e, rdv: e.rdv.map((x) => (x.id === r.id ? n : x)) })} supprimer={() => setEnfant(e.id, { ...e, rdv: e.rdv.filter((x) => x.id !== r.id) })} />
          ))}
          <div className="dr-actions">
            {!e.rdv.some((r) => r.type === "ecole") && <button type="button" className="dr-secondaire" onClick={() => setEnfant(e.id, { ...e, rdv: [rdvVide("ecole"), ...e.rdv] })}>+ Ajouter l'école</button>}
            <button type="button" className="dr-secondaire" onClick={() => setEnfant(e.id, { ...e, rdv: [...e.rdv, rdvVide("activite")] })}>+ Ajouter une activité</button>
            <button type="button" className="dr-secondaire" onClick={() => set("enfants", f.enfants.filter((x) => x.id !== e.id))}>Supprimer {e.prenom || "cet enfant"}</button>
          </div>
        </div>
      ))}
      <div className="dr-actions">
        <button type="button" className="dr-secondaire" onClick={() => set("enfants", [...f.enfants, enfantFicheVide()])}>+ Ajouter un enfant</button>
        <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer cette famille</button>
      </div>
      <button type="button" className="tdb-bouton" onClick={() => ouvrir(false)}>← Retour au répertoire</button>
    </details>
  );
}

export default function Familles({ familles, changer, connues, voit }) {
  const [ouverte, setOuverte] = useState("");
  const doublons = doublonsFamilles(familles);
  // Fermer une fiche ramene en haut du repertoire
  const ouvrir = (id, oui) => {
    setOuverte((a) => (oui ? id : a === id ? "" : a));
    if (!oui && typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const visibles = familles.filter((f) => !f.nom || voit(f.nom, f.telephone, ...f.enfants.map((e) => e.prenom)));
  return (
    <>
      <section className="tdb-bloc">
        <h2>Familles et enfants</h2>
        <p className="tdb-note">Une fiche par enfant : école, activités, jours et heures. Ma tournée scolaire se construit toute seule à partir de ces fiches.</p>
        {doublons.length > 0 && (
          <div className="rp-correction">
            <p className="rp-alerte">⚠️ Doublons possibles : fusionne-les, sinon leurs trajets comptent deux fois.</p>
            {doublons.map((d, k) => (
              <div className="rp-forfait" key={k}>
                <span>{d.texte}</span>
                <button type="button" className="tdb-bouton" onClick={() => changer(fusionnerDoublon(familles, d.a, d.b))}>Fusionner en une seule fiche</button>
              </div>
            ))}
            <p className="tdb-note">La fusion garde la fiche la plus complète et récupère dans l'autre ce qui lui manque (téléphone, adresses, enfants, horaires). Enregistre ensuite. Si ce ne sont pas des doublons, ne touche à rien.</p>
          </div>
        )}
        {familles.length === 0 && <p className="tdb-note">Commence par ta famille (ton enfant), puis ajoute les familles dont tu emmènes les enfants.</p>}
      </section>
      <div className="formulaire dr-formulaire">
        {visibles.map((f) => (
          <Famille key={f.id} f={f} connues={connues} ouvert={ouverte === f.id} ouvrir={(oui) => ouvrir(f.id, oui)} changer={(n) => changer(familles.map((x) => (x.id === f.id ? n : x)))} supprimer={() => changer(familles.filter((x) => x.id !== f.id))} />
        ))}
      </div>
      <button type="button" className="dr-secondaire rp-large" onClick={() => { const n = familleVide(); setOuverte(n.id); changer([...familles, n]); }}>+ Ajouter une famille (moi, une amie, une cliente)</button>
    </>
  );
}
