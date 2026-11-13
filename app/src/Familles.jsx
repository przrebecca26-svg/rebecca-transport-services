import { useState } from "react";
import Champ from "./components/Champ.jsx";
import ChoixLieu from "./components/MesLieux.jsx";
import ChoixAge from "./components/ChoixAge.jsx";
import { JOURS } from "./pricing/tournee.js";
import { ageDe, enfantSansPlanning, familleVide, enfantFicheVide, rdvVide, manqueRdv, nomRdv, arriveeDuJour, sortieDuJour, doublonsFamilles, fusionnerDoublon } from "./pricing/familles.js";
import { useComptes, useCoursesEtMouvements } from "./comptesBase.js";
import { phraseSolde, soldeCompte } from "./pricing/comptesEntreNous.js";

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
        <label>Commence à <input type="time" value={r.heureArrivee} onChange={(e) => set("heureArrivee", e.target.value)} /></label>
        <label>Finit à <input type="time" value={r.heureSortie} onChange={(e) => set("heureSortie", e.target.value)} /></label>
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
              {<input type="time" aria-label={`Commence le ${nom.toLowerCase()}`} value={arriveeDuJour(r, w)} onChange={(e) => setJour(w, "arrivee", e.target.value)} />}
              {<input type="time" aria-label={`Finit le ${nom.toLowerCase()}`} value={sortieDuJour(r, w)} onChange={(e) => setJour(w, "sortie", e.target.value)} />}
            </div>
          ) : null))}
        </div>
      )}
      <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer {r.type === "ecole" ? "l'école" : "cette activité"}</button>
    </div>
  );
}

export function Famille({ f, changer, supprimer, connues, ouvert, ouvrir }) {
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
      {ouvert && <ComptesLies familleId={f.id} />}
      <div className="champ">
        <label htmlFor={"fn" + f.id}>Nom du parent (moi, Alexia, une cliente…)</label>
        <input id={"fn" + f.id} type="text" maxLength={60} value={f.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor={"ft" + f.id}>Téléphone (facultatif)</label>
        <input id={"ft" + f.id} type="tel" inputMode="tel" maxLength={20} value={f.telephone} onChange={(e) => set("telephone", e.target.value)} />
      </div>
      <p className="tdb-note">Le parent est un adulte (18 ans et plus).</p>
      <div className="champ">
        <label htmlFor={"fn2" + f.id}>Autre parent (facultatif)</label>
        <input id={"fn2" + f.id} type="text" maxLength={60} value={f.nom2 || ""} onChange={(e) => set("nom2", e.target.value)} />
      </div>
      <div className="champ">
        <label htmlFor={"ft2" + f.id}>Téléphone de l'autre parent (facultatif)</label>
        <input id={"ft2" + f.id} type="tel" inputMode="tel" maxLength={20} value={f.telephone2 || ""} onChange={(e) => set("telephone2", e.target.value)} />
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
      <div className="champ">
        <label htmlFor={"fj" + f.id}>Forfait à la journée (₪), facultatif</label>
        <input id={"fj" + f.id} type="text" inputMode="numeric" maxLength={5} placeholder="Ex. 70" value={f.forfaitJour || ""} onChange={(e) => set("forfaitJour", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
        <p className="tdb-note">Quand tu coches « ✓ Fait » sur le trajet où tu récupères les enfants (sortie de l'école) dans ton Calendrier, la journée part dans Finances (à encaisser), une seule fois par jour. Le trajet du matin seul ne compte pas. Le téléphone ci-dessus est obligatoire pour ça.</p>
      </div>

      {f.enfants.map((e) => (
        <div className="rp-fiche-enfant" key={e.id}>
          <div className="champ">
            <label htmlFor={"ep" + e.id}>Prénom</label>
            <input id={"ep" + e.id} type="text" maxLength={40} value={e.prenom} onChange={(x) => setEnfant(e.id, { ...e, prenom: x.target.value })} />
          </div>
          <ChoixAge valeur={e.age || "enfant"} changer={(v) => setEnfant(e.id, { ...e, age: v })} />
          <div className="rp-vacances">
            <label>Date de naissance <input type="date" value={e.naissance || ""} onChange={(x) => setEnfant(e.id, { ...e, naissance: x.target.value })} /></label>
            {!e.naissance && (
              <label>ou son âge <input type="number" inputMode="numeric" min={0} max={30} style={{ width: 70 }} value={e.ageAnnees ? ageDe(e) : ""} onChange={(x) => setEnfant(e.id, { ...e, ageAnnees: Math.max(0, Math.round(Number(x.target.value) || 0)), ageNote: new Date().getFullYear() })} /> ans</label>
            )}
          </div>
          {(e.naissance || e.ageAnnees > 0) && <p className="tdb-note">{ageDe(e)} ans aujourd'hui{e.naissance ? "" : " (l'âge augmente tout seul chaque année)"}.</p>}
          {e.rdv.length === 0 && <p className="tdb-note">Sans planning : pas de trajet régulier. Tu peux l'ajouter à ta journée depuis le Calendrier quand tu l'emmènes (Ramassage scolaire).</p>}
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
        <button type="button" className="dr-secondaire" onClick={() => set("enfants", [...f.enfants, enfantFicheVide()])}>+ Ajouter un enfant (avec son école)</button>
        <button type="button" className="dr-secondaire" onClick={() => set("enfants", [...f.enfants, enfantSansPlanning()])}>+ Ajouter un enfant sans planning</button>
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
        <p className="tdb-note">Une fiche par enfant : son agenda (école, activités, jours et heures). Ensuite, dans « Tournée scolaire », je choisis les trajets que je fais.</p>
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

// 13 nov. 2026, 09h04 : « c'est ou que je vois sa dette ? » -> dans la fiche de la famille, les comptes entre nous lies
// (Alexia, gg...) avec leur solde ; le detail est dans le menu « Comptes entre nous ».
function ComptesLies({ familleId }) {
  const { comptes } = useComptes();
  const { demandes, mouvements } = useCoursesEtMouvements(true);
  const lies = comptes.filter((c) => c.famille === familleId);
  if (!lies.length || !demandes || !mouvements) return null;
  return (
    <div className="bloc">
      <p className="rp-type">Comptes entre nous</p>
      {lies.map((c) => (
        <p key={c.id}>{phraseSolde(c.nom, soldeCompte(c, demandes, mouvements))}</p>
      ))}
      <p className="tdb-note">Détail, paiements et troc : menu « Comptes entre nous ».</p>
    </div>
  );
}

