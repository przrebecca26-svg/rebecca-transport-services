import { useEffect, useState } from "react";
import Champ from "./components/Champ.jsx";
import JourneeTournee from "./components/JourneeTournee.jsx";
import { useFermetures } from "./fermetures.js";
import { aujourdhui } from "./profil.js";
import { TARIFS } from "./pricing/config.js";
import { JOURS, trajetVide, tourneeDepart, manqueTrajet, heureTrajet, evaluerJour } from "./pricing/tournee.js";
import { bilanMois } from "./pricing/ramassagePlanning.js";
import { useTournee, useDurees, enregistrerTournee } from "./tourneeBase.js";
import "./client-commun.css";
import "./devis-rapide.css";

// MA TOURNEE SCOLAIRE (12 nov. 2026) : les trajets fixes de Rebecca (sa fille, les enfants qu'elle emmene),
// l'ordre et les heures calcules pour chaque jour, les forfaits au mois acceptes et les vacances scolaires.

const TYPES = [
  { v: "matin", l: "Matin : déposer à l'école" },
  { v: "sortie", l: "Sortie : récupérer" },
];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function Trajet({ r, changer, supprimer }) {
  const set = (cle, valeur) => changer({ ...r, [cle]: valeur });
  const setJour = (w, cle, valeur) => changer({ ...r, jours: r.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const manque = manqueTrajet(r);
  const matin = r.type === "matin";
  return (
    <details className="bloc rp-enfant rp-trajet">
      <summary>
        <h3>{r.nom || "Trajet sans nom"}</h3>
        <span className={manque ? "rp-alerte" : "tdb-note"}>{manque ? `À compléter : ${manque}` : `${matin ? "Matin" : "Sortie"} · ${r.places} enfant${r.places > 1 ? "s" : ""} · ${r.jours.filter((j) => j.actif).length} jour(s)${r.client ? " · cliente" : ""}`}</span>
      </summary>
      <div className="champ">
        <label htmlFor={"tn-" + r.id}>Qui ? (prénoms)</label>
        <input id={"tn-" + r.id} type="text" maxLength={60} value={r.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <Champ champ={{ name: "places" + r.id, label: "Nombre d'enfants dans la voiture", type: "nombre", min: 1, max: 8 }} valeurs={{ ["places" + r.id]: String(r.places) }} onChange={(_, v) => set("places", Math.min(8, Math.max(1, Number(v) || 1)))} />
      <fieldset className="champ">
        <legend>Quel trajet ?</legend>
        <div className="choix">
          {TYPES.map((o) => (
            <button key={o.v} type="button" className={r.type === o.v ? "actif" : ""} aria-pressed={r.type === o.v} onClick={() => set("type", o.v)}>{o.l}</button>
          ))}
        </div>
      </fieldset>
      <Champ champ={{ name: "de" + r.id, label: matin ? "Où je prends les enfants (domicile)" : "Où je récupère les enfants (école, Gan…)", type: "adresse" }} valeurs={{ ["de" + r.id]: r.de }} onChange={(_, v) => set("de", v)} />
      <Champ champ={{ name: "a" + r.id, label: matin ? "Où je les dépose (école, Gan…)" : "Où je les dépose", type: "adresse" }} valeurs={{ ["a" + r.id]: r.a }} onChange={(_, v) => set("a", v)} />
      {matin && (
        <div className="champ">
          <label htmlFor={"tp-" + r.id}>Je les prends à partir de (facultatif)</label>
          <input id={"tp-" + r.id} type="time" value={r.heurePrise} onChange={(e) => set("heurePrise", e.target.value)} />
        </div>
      )}
      <div className="champ">
        <label htmlFor={"th-" + r.id}>{matin ? "Arriver à l'école au plus tard à" : "Heure de sortie habituelle"}</label>
        <input id={"th-" + r.id} type="time" value={r.heure} onChange={(e) => set("heure", e.target.value)} />
        <span className="aide">Elle se met sur tous les jours. Change ensuite l'heure des jours différents.</span>
      </div>
      {!matin && (
        <div className="champ">
          <label className="case">
            <input type="checkbox" checked={r.peutAttendre} onChange={(e) => set("peutAttendre", e.target.checked)} />
            <span>L'enfant peut m'attendre (pas de retard maximum)</span>
          </label>
        </div>
      )}
      <div className="rp-jours" role="group" aria-label="Jours">
        {JOURS.map((nom, w) => (
          <div className={"rp-jour" + (r.jours[w].actif ? "" : " inactif")} key={w}>
            <label className="case">
              <input type="checkbox" checked={r.jours[w].actif} onChange={(e) => setJour(w, "actif", e.target.checked)} />
              <span>{nom}</span>
            </label>
            {r.jours[w].actif && <input type="time" aria-label={`Heure du ${nom.toLowerCase()}`} value={heureTrajet(r, w)} onChange={(e) => setJour(w, "heure", e.target.value)} />}
          </div>
        ))}
      </div>
      <fieldset className="champ">
        <legend>Seulement entre deux dates (facultatif)</legend>
        <div className="rp-vacances">
          <label>Du <input type="date" value={r.du} onChange={(e) => set("du", e.target.value)} /></label>
          <label>Au <input type="date" value={r.au} min={r.du || undefined} onChange={(e) => set("au", e.target.value)} /></label>
        </div>
      </fieldset>
      <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer ce trajet</button>
    </details>
  );
}

export default function TourneeScolaire() {
  const base = useTournee();
  useFermetures();
  const [brouillon, setBrouillon] = useState(null); // null = pas encore charge
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const [jour, setJour] = useState(() => {
    const w = new Date().getDay();
    return w === 6 ? 0 : w;
  });

  // La base arrive (ou change ailleurs) : on la reprend tant que rien n'est en cours de modification
  useEffect(() => {
    if (!base.pret || modifie) return;
    setBrouillon(base.donnees.existe ? base.donnees : { ...base.donnees, trajets: tourneeDepart() });
  }, [base, modifie]);

  const trajets = brouillon ? brouillon.trajets : [];
  const durees = useDurees(trajets);

  if (!base.pret || !brouillon) return <p className="tdb-note tb-pad">Chargement de la tournée…</p>;
  if (base.refuse) return <p className="tdb-note tb-pad">La tournée scolaire est réservée à Rebecca.</p>;

  const changer = (suite) => {
    setBrouillon(suite);
    setModifie(true);
    setMessage("");
  };
  const changerTrajet = (id, r) => changer({ ...brouillon, trajets: trajets.map((x) => (x.id === id ? r : x)) });
  const enregistrer = async () => {
    try {
      await enregistrerTournee(brouillon);
      setModifie(false);
      setMessage("C'est enregistré.");
    } catch {
      setMessage("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };

  const depart = !base.donnees.existe;
  const journee = evaluerJour(trajets, jour, durees.duree, TARIFS, { du: aujourdhui(), au: "" });
  const [annee, mois] = aujourdhui().split("-").map(Number);
  const moisSuivant = mois === 12 ? [annee + 1, 1] : [annee, mois + 1];
  const regles = TARIFS.tournee;

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Tournée scolaire</h1>
        <p className="tdb-sous">Mes trajets d'école de chaque jour. Le Devis rapide s'en sert pour me dire si je peux accepter un ramassage en plus.</p>
      </div>
      {depart && <p className="tdb-note rp-alerte">Voici ta tournée de départ avec tes heures. Ouvre chaque trajet pour mettre les prénoms et choisir les adresses, puis enregistre.</p>}

      <section className="tdb-bloc">
        <h2>Ma journée</h2>
        <div className="choix rp-six">
          {JOURS.map((nom, w) => (
            <button key={w} type="button" className={jour === w ? "actif" : ""} aria-pressed={jour === w} onClick={() => setJour(w)}>{nom.slice(0, 3)}</button>
          ))}
        </div>
        {durees.statut === "erreur" && <p className="rp-alerte">Temps de route indisponibles pour l'instant. Réessaie dans un moment.</p>}
        <JourneeTournee titre={JOURS[jour]} jour={journee} ouvert />
        <p className="tdb-note">Compté : temps de route + {regles.margeRouteMinutes} min de marge à chaque déplacement, {regles.arretMinutes} min par arrêt, {regles.retardMaxMinutes} min de retard au maximum à une sortie, {regles.places} places. Modifiable dans Réglages → Tarifs.</p>
      </section>

      {brouillon.forfaits.length > 0 && (
        <section className="tdb-bloc">
          <h2>Forfaits au mois</h2>
          {brouillon.forfaits.map((f) => (
            <div className="rp-forfait" key={f.id}>
              <b>{f.nom}</b>
              <ul className="rp-detail">
                {[[annee, mois], moisSuivant].map(([a, m]) => {
                  const b = bilanMois(f, a, m, brouillon.vacances);
                  if (!b) return null;
                  return (
                    <li key={m}>
                      <span>{MOIS[m - 1]} {a} : {b.jours} jour{b.jours > 1 ? "s" : ""} d'école{b.retires.length ? ` (${b.retires.length} retiré${b.retires.length > 1 ? "s" : ""})` : ""}</span>
                      <b>{b.reel} ₪{b.difference > 0 ? ` au lieu de ${b.complet} ₪` : ""}</b>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="dr-secondaire" onClick={() => changer({ ...brouillon, forfaits: brouillon.forfaits.filter((x) => x.id !== f.id) })}>Retirer ce forfait</button>
            </div>
          ))}
          <p className="tdb-note">Prix du mois complet, et prix si tu retires les fêtes et les vacances : c'est toi qui décides lequel tu encaisses.</p>
        </section>
      )}

      <div className="formulaire dr-formulaire">
        {trajets.map((r) => (
          <Trajet key={r.id} r={r} changer={(n) => changerTrajet(r.id, n)} supprimer={() => changer({ ...brouillon, trajets: trajets.filter((x) => x.id !== r.id) })} />
        ))}
      </div>
      <button type="button" className="dr-secondaire rp-large" onClick={() => changer({ ...brouillon, trajets: [...trajets, trajetVide()] })}>+ Ajouter un trajet</button>

      <section className="tdb-bloc">
        <h2>Vacances scolaires</h2>
        <p className="tdb-note">Chabbat et fêtes sont déjà connus. Note ici les vacances : elles sont retirées du prix réel des forfaits au mois.</p>
        {brouillon.vacances.map((v, k) => (
          <div className="rp-vacance" key={k}>
            <input type="text" aria-label="Nom des vacances" placeholder="Hanouka, Pessah…" maxLength={40} value={v.nom} onChange={(e) => changer({ ...brouillon, vacances: brouillon.vacances.map((x, i) => (i === k ? { ...x, nom: e.target.value } : x)) })} />
            <div className="rp-vacances">
              <label>Du <input type="date" value={v.du} onChange={(e) => changer({ ...brouillon, vacances: brouillon.vacances.map((x, i) => (i === k ? { ...x, du: e.target.value } : x)) })} /></label>
              <label>Au <input type="date" value={v.au} min={v.du || undefined} onChange={(e) => changer({ ...brouillon, vacances: brouillon.vacances.map((x, i) => (i === k ? { ...x, au: e.target.value } : x)) })} /></label>
            </div>
            <button type="button" className="dr-secondaire" onClick={() => changer({ ...brouillon, vacances: brouillon.vacances.filter((_, i) => i !== k) })}>Supprimer</button>
          </div>
        ))}
        <button type="button" className="dr-secondaire rp-large" onClick={() => changer({ ...brouillon, vacances: [...brouillon.vacances, { nom: "", du: "", au: "" }] })}>+ Ajouter des vacances</button>
      </section>

      <div className="rp-enregistrer">
        <button type="button" className="tdb-bouton" onClick={enregistrer} disabled={!modifie && !depart}>{modifie || depart ? "Enregistrer ma tournée" : "Tout est enregistré"}</button>
        {message && <p className="tdb-note" role="status">{message}</p>}
      </div>
    </div>
  );
}
