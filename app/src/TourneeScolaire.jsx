import { useEffect, useMemo, useState } from "react";
import Champ from "./components/Champ.jsx";
import JourneeTournee from "./components/JourneeTournee.jsx";
import ChoixLieu, { NomLieu } from "./components/MesLieux.jsx";
import { useFermetures } from "./fermetures.js";
import { aujourdhui } from "./profil.js";
import { TARIFS } from "./pricing/config.js";
import { JOURS, trajetVide, manqueTrajet, heureTrajet, evaluerJour, adressesConnues, trajetRetour, separerTrajet, cleLieu, nomDuLieu, nommerLieu } from "./pricing/tournee.js";
import { bilanMois } from "./pricing/ramassagePlanning.js";
import { useTournee, useDurees, enregistrerTournee } from "./tourneeBase.js";
import { fusionnerLieux } from "./pricing/repertoire.js";
import { trajetsDesChoix, lireChoix, doublonsTrajets } from "./pricing/familles.js";
import MesTrajets from "./MesTrajets.jsx";
import { useRepertoire, enregistrerRepertoire } from "./repertoireBase.js";
import "./client-commun.css";
import "./devis-rapide.css";

// MA TOURNEE SCOLAIRE (12 nov. 2026) : les trajets fixes de Rebecca (sa fille, les enfants qu'elle emmene),
// l'ordre et les heures calcules pour chaque jour, les forfaits au mois acceptes et les vacances scolaires.

const TYPES = [
  { v: "matin", l: "Déposer (école, activité…)" },
  { v: "sortie", l: "Récupérer (sortie, fin d'activité)" },
];

const jourCourt = (d) => {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function Trajet({ r, changer, supprimer, connues, creerRetour, separer, nomLieu, nommer, domicile, ouvert, ouvrir }) {
  const set = (cle, valeur) => changer({ ...r, [cle]: valeur });
  const setJour = (w, cle, valeur) => changer({ ...r, jours: r.jours.map((j, k) => (k === w ? { ...j, [cle]: valeur } : j)) });
  const manque = manqueTrajet(r);
  const matin = r.type === "matin";
  return (
    <details className="bloc rp-enfant rp-trajet" open={ouvert} onToggle={(e) => ouvrir(e.currentTarget.open)}>
      <summary>
        <h3>{r.nom || "Trajet sans nom"}</h3>
        <span className={manque ? "rp-alerte" : "tdb-note"}>{manque ? `À compléter : ${manque}` : `${nomLieu(r.de) || "?"} → ${nomLieu(r.a) || "?"} · ${r.places} enfant${r.places > 1 ? "s" : ""} · ${r.jours.filter((j) => j.actif).length} jour(s)${r.client ? " · cliente" : ""}`}</span>
      </summary>
      <button type="button" className="tdb-retour" onClick={() => ouvrir(false)}>← Retour à ma tournée</button>
      <div className="champ">
        <label htmlFor={"tn-" + r.id}>Qui ? (prénoms)</label>
        <input id={"tn-" + r.id} type="text" maxLength={60} value={r.nom} onChange={(e) => set("nom", e.target.value)} />
      </div>
      <Champ champ={{ name: "places" + r.id, label: "Nombre d'enfants dans la voiture", type: "nombre", min: 1, max: 8 }} valeurs={{ ["places" + r.id]: String(r.places) }} onChange={(_, v) => set("places", Math.min(8, Math.max(1, Number(v) || 1)))} />
      {r.places > 1 && (
        <fieldset className="champ">
          <legend>Adresses des {r.places} enfants</legend>
          <div className="choix">
            <button type="button" className="actif" aria-pressed="true">Mêmes adresses pour tous</button>
            <button type="button" aria-pressed="false" onClick={separer}>Adresses différentes</button>
          </div>
          <span className="aide">« Adresses différentes » crée un trajet par enfant : tu mets ensuite l'adresse de chacun. S'ils partent du même endroit, ça reste un seul arrêt.</span>
        </fieldset>
      )}
      <fieldset className="champ">
        <legend>Quel trajet ?</legend>
        <div className="choix">
          {TYPES.map((o) => (
            <button key={o.v} type="button" className={r.type === o.v ? "actif" : ""} aria-pressed={r.type === o.v} onClick={() => set("type", o.v)}>{o.l}</button>
          ))}
        </div>
      </fieldset>
      <p className="rp-type">{matin ? "Où je prends les enfants" : "Où je récupère les enfants (école, Gan, activité…)"}</p>
      <ChoixLieu id={"cd-" + r.id} connues={connues} valeur={r.de} choisir={(x) => set("de", x)} />
      <Champ champ={{ name: "de" + r.id, label: "Adresse", type: "adresse" }} valeurs={{ ["de" + r.id]: r.de }} onChange={(_, v) => set("de", v)} />
      <NomLieu id={"ld-" + r.id} valeur={r.de} nom={nomLieu(r.de)} nommer={(n) => nommer(r.de, n)} domicile={domicile} />
      <p className="rp-type">{matin ? "Où je les dépose (école, Gan, activité…)" : "Où je les dépose"}</p>
      <ChoixLieu id={"ca-" + r.id} connues={connues} valeur={r.a} choisir={(x) => set("a", x)} />
      <Champ champ={{ name: "a" + r.id, label: "Adresse", type: "adresse" }} valeurs={{ ["a" + r.id]: r.a }} onChange={(_, v) => set("a", v)} />
      <NomLieu id={"la-" + r.id} valeur={r.a} nom={nomLieu(r.a)} nommer={(n) => nommer(r.a, n)} domicile={domicile} />
      {matin && (
        <div className="champ">
          <label htmlFor={"tp-" + r.id}>Je les prends à partir de (facultatif)</label>
          <input id={"tp-" + r.id} type="time" value={r.heurePrise} onChange={(e) => set("heurePrise", e.target.value)} />
        </div>
      )}
      <div className="champ">
        <label htmlFor={"th-" + r.id}>{matin ? "Arriver au plus tard à" : "Heure de sortie ou de fin habituelle"}</label>
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
      <button type="button" className="dr-secondaire" onClick={creerRetour}>{matin ? "+ Créer le trajet retour (mêmes adresses)" : "+ Créer le trajet aller (mêmes adresses)"}</button>
      <button type="button" className="dr-secondaire" onClick={supprimer}>Supprimer ce trajet</button>
    </details>
  );
}

export default function TourneeScolaire() {
  const base = useTournee();
  const repertoire = useRepertoire(); // mes lieux nommes (Repertoire) : les memes noms partout
  useFermetures();
  const [brouillon, setBrouillon] = useState(null); // null = pas encore charge
  const [modifie, setModifie] = useState(false);
  const [message, setMessage] = useState("");
  const [trajetOuvert, setTrajetOuvert] = useState("");
  const [effacer, setEffacer] = useState(false); // « Tout effacer » demande une confirmation // un seul trajet ouvert a la fois, avec sa fleche de retour
  const [jour, setJour] = useState(() => {
    const w = new Date().getDay();
    return w === 6 ? 0 : w;
  });

  // La base arrive (ou change ailleurs) : on la reprend tant que rien n'est en cours de modification
  useEffect(() => {
    if (!base.pret || modifie) return;
    setBrouillon(base.donnees);
  }, [base, modifie]);

  const trajets = brouillon ? brouillon.trajets : []; // trajets saisis a la main
  const choix = useMemo(() => lireChoix(brouillon ? brouillon.choix : []), [brouillon]); // trajets que j'ai choisis a partir des fiches
  const desFiches = useMemo(() => trajetsDesChoix(repertoire.familles, choix), [repertoire.familles, choix]);
  const tous = useMemo(() => [...desFiches, ...trajets], [desFiches, trajets]);
  const durees = useDurees(tous, brouillon ? brouillon.domicile : null);

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
      setTrajetOuvert("");
      setMessage("C'est enregistré.");
      // Les lieux nommes ici rejoignent le Repertoire (si cela echoue, la tournee reste enregistree)
      if (brouillon.lieux.length) enregistrerRepertoire(fusionnerLieux(repertoire.lieux, brouillon.lieux)).catch(() => {});
    } catch {
      setMessage("Enregistrement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };

  // Remise a zero des trajets ajoutes a la main (le domicile, les vacances, les forfaits et les fiches du Repertoire restent)
  const toutEffacer = async () => {
    const suite = { ...brouillon, trajets: [] };
    try {
      await enregistrerTournee(suite);
      setBrouillon(suite);
      setModifie(false);
      setEffacer(false);
      setTrajetOuvert("");
      setMessage("Tous les trajets ajoutés à la main sont effacés.");
    } catch {
      setMessage("Effacement impossible pour l'instant. Vérifie ta connexion et réessaie.");
    }
  };
  const depart = repertoire.familles.length === 0;
  const lieux = fusionnerLieux(repertoire.lieux, brouillon.lieux); // Repertoire + noms donnes ici
  const connues = adressesConnues(brouillon.domicile, tous, lieux);
  const nomLieu = (adresse) => nomDuLieu(adresse, brouillon.domicile, lieux);
  // Endroits proposes pour « ou je le recupere ce jour-la » : mes lieux nommes et le domicile de chaque famille
  const lieuxChoix = [
    ...connues.filter((c) => !c.sansNom),
    ...repertoire.familles.filter((f) => cleLieu(f.domicile) && !connues.some((c) => !c.sansNom && cleLieu(c.adresse) === cleLieu(f.domicile))).map((f) => ({ nom: `Chez ${f.nom || "la famille"}`, adresse: f.domicile })),
  ];
  const nommer = (adresse, nom) => changer({ ...brouillon, lieux: nommerLieu(brouillon.lieux, adresse, nom) });
  const journee = evaluerJour(tous, jour, durees.duree, TARIFS, { du: aujourdhui(), au: "", domicile: brouillon.domicile });
  const [annee, mois] = aujourdhui().split("-").map(Number);
  const moisSuivant = mois === 12 ? [annee + 1, 1] : [annee, mois + 1];
  const regles = TARIFS.tournee;

  return (
    <div className="tdb devis-rapide">
      <div className="tdb-tete">
        <h1>Tournée scolaire</h1>
        <p className="tdb-sous">Mes trajets d'école de chaque jour. Le Devis rapide s'en sert pour me dire si je peux accepter un ramassage en plus.</p>
      </div>
      {depart && <p className="tdb-note rp-alerte">Commence par les fiches des enfants dans le Répertoire (« Familles et enfants »). Ensuite, ici, tu choisis les trajets que tu fais.</p>}

      <div className="formulaire dr-formulaire">
        <div className="bloc">
          <Champ champ={{ name: "domicile", label: "Mon domicile (départ et retour de mes tournées)", type: "adresse", indice: "Enregistré dans ta base privée, jamais visible par les clientes." }} valeurs={{ domicile: brouillon.domicile }} onChange={(_, v) => changer({ ...brouillon, domicile: v })} />
        </div>
      </div>

      <section className="tdb-bloc">
        <h2>Ma journée</h2>
        <div className="choix rp-six">
          {JOURS.map((nom, w) => (
            <button key={w} type="button" className={jour === w ? "actif" : ""} aria-pressed={jour === w} onClick={() => setJour(w)}>{nom.slice(0, 3)}</button>
          ))}
        </div>
        {durees.statut === "erreur" && <p className="rp-alerte">Temps de route indisponibles pour l'instant. Réessaie dans un moment.</p>}
        <JourneeTournee titre={JOURS[jour]} jour={journee} ouvert nomLieu={nomLieu} />
        <p className="tdb-note">Compté : temps de route + {regles.margeRouteMinutes} min de marge à chaque déplacement, {regles.arretMinutes} min par arrêt, {regles.retardMaxMinutes} min de retard au maximum à une sortie, {regles.places} places, retour à la maison s'il reste au moins {regles.retourMaisonMinutes} min de libre. Le bouton Waze de chaque arrêt donne le temps réel du moment. Modifiable dans Réglages → Tarifs.</p>
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

      <MesTrajets familles={repertoire.familles} choix={choix} lieux={lieuxChoix} changer={(suite) => changer({ ...brouillon, choix: suite })} />

      <section className="tdb-bloc">
        <h2>Autres trajets (sans fiche)</h2>
        <p className="tdb-note">Seulement pour un trajet d'un enfant qui n'a pas de fiche dans le Répertoire.</p>
        {doublonsTrajets(trajets, desFiches).length > 0 && (
          <p className="rp-alerte">⚠️ En double avec une fiche du Répertoire (mêmes adresses) : {doublonsTrajets(trajets, desFiches).map((r) => r.nom || "trajet sans nom").join(", ")}. Supprime-les ici, sinon ils comptent deux fois.</p>
        )}
      </section>
      <div className="formulaire dr-formulaire">
        {trajets.map((r) => (
          <Trajet key={r.id} r={r} ouvert={trajetOuvert === r.id} ouvrir={(oui) => setTrajetOuvert((actuel) => (oui ? r.id : actuel === r.id ? "" : actuel))} connues={connues} nomLieu={nomLieu} nommer={nommer} domicile={brouillon.domicile} separer={() => changer({ ...brouillon, trajets: trajets.flatMap((x) => (x.id === r.id ? separerTrajet(x) : [x])) })} creerRetour={() => changer({ ...brouillon, trajets: trajets.flatMap((x) => (x.id === r.id ? [x, trajetRetour(x)] : [x])) })} changer={(n) => changerTrajet(r.id, n)} supprimer={() => changer({ ...brouillon, trajets: trajets.filter((x) => x.id !== r.id) })} />
        ))}
      </div>
      <button type="button" className="dr-secondaire rp-large" onClick={() => changer({ ...brouillon, trajets: [...trajets, trajetVide()] })}>+ Ajouter un trajet sans fiche</button>
      {trajets.length > 0 && !effacer && <button type="button" className="dr-secondaire rp-large" onClick={() => setEffacer(true)}>Tout effacer : remettre à zéro les {trajets.length} trajets ajoutés à la main</button>}
      {effacer && (
        <div className="rp-correction rp-large">
          <p className="rp-alerte">Effacer les {trajets.length} trajets ajoutés à la main ? Ton domicile, les vacances et les fiches du Répertoire ne sont pas touchés.</p>
          <button type="button" className="tdb-bouton" onClick={toutEffacer}>Oui, tout effacer</button>
          <button type="button" className="dr-secondaire" onClick={() => setEffacer(false)}>Non, je garde</button>
        </div>
      )}

      <section className="tdb-bloc">
        <h2>Vacances scolaires</h2>
        <p className="tdb-note">Chabbat, fêtes et vacances ci-dessous sont déjà connus : ils sont retirés des devis avec une date et du prix réel des forfaits au mois. À vérifier avec chaque école.</p>
        <ul className="rp-detail">
          {(TARIFS.ramassage.vacancesScolaires || []).filter((v) => v.au >= aujourdhui()).map((v) => (
            <li key={v.du}><span>{v.nom}</span><b>{v.du === v.au ? jourCourt(v.du) : `${jourCourt(v.du)} au ${jourCourt(v.au)}`}</b></li>
          ))}
        </ul>
        <p className="tdb-note">Ajoute ici d'autres jours sans école (grève, journée pédagogique, vacances d'une école en particulier).</p>
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
