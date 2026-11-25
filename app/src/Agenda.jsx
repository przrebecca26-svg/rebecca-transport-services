import { FiltrePersonne, Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import InfoVol from "./components/InfoVol.jsx";
import FinCourseAgenda from "./FinCourseAgenda.jsx";
import TourneeResto from "./components/TourneeResto.jsx";
import { etapesTournee, tourneesResto } from "./pricing/tourneeResto.js";
import { messageEnfant, parentsAPrevenir } from "./pricing/finCourse.js";
import { heureDans, minutesJusqua } from "./arrivee.js";
import { arreterSuivi, demarrerSuivi, idSuivi } from "./suiviRamassage.js";
import { lienPosition } from "./pricing/positionDirect.js";
import { messageRetard } from "./pricing/suiteClient.js";
import { texteDuree } from "./pricing/circulation.js";
import { filtrerPersonne } from "./pricing/quiFait.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { attribueA, confierDirect, messageTransfert, nomDe } from "./pricing/quiFait.js";
import { indispoValide } from "./fermetures.js";
import { Fragment, useEffect, useMemo, useState } from "react";
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { trajetACalculer } from "./services.js";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { retourAutreJour } from "./pricing/enchainement.js";
import { appliquerCreneaux, appliquerFermetures, CRENEAUX_PAR_DEFAUT, creneauValide, lireCreneaux } from "./fermetures.js";
import "./agenda.css";
import { lienAppel, lienWhatsApp, lienWazePoint } from "./pricing/navigation.js";
import { useMaJournee } from "./maJournee.js";
import TraficDuMatin from "./components/TraficDuMatin.jsx";
import AgendaIphone from "./components/AgendaIphone.jsx";
import MaPositionBloc, { useIci, useOu } from "./components/MaPositionBloc.jsx";
import { arrondir } from "./pricing/maPosition.js";
import ListeAttenteAdmin from "./components/ListeAttenteAdmin.jsx";
import PartagerPosition from "./components/PartagerPosition.jsx";
import { etapesCourses } from "./pricing/traficMatin.js";
import AddressField from "./components/AddressField.jsx";
import ChoixLieu from "./components/MesLieux.jsx";
import { cleLieu } from "./pricing/tournee.js";
import ChoixAge, { libelleAge } from "./components/ChoixAge.jsx";
import { useRepertoire, enregistrerRepertoire } from "./repertoireBase.js";
import { listeEnfants, ajouterEnfantDepuisTache, preRemplirRamassage } from "./pricing/familles.js";
import { AEROPORT_BEN_GOURION, TYPES_TACHE, cleEtape, etapeValidable, iconeTache, texteAvecMoi, messageMission } from "./pricing/tournee.js";
import { supprimerCourseComplete } from "./suppression.js";
import { aLaMaison, comprendreDateHeure, demandeCreneau, dureeDite, quoiDeTache, trouverCreneau } from "./pricing/saisieVocale.js";
import Dicter from "./components/Dicter.jsx";
import { ajouterJours, etiquettesDuJour, vacancesDuJour, vacancesDuCalendrier, joursADecider, localVersUtc, periodesFermees, prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";

// Agenda de Rebecca : jour, semaine, mois, avec Chabbat, fetes, creneaux personnels, courses et fermetures gerees par Rebecca.

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  terminee: { label: "Terminée", classe: "terminee" },
};
const NOMS_JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const texteJours = (jours) => {
  const j = [...jours].sort();
  const suite = j.length > 2 && j.every((x, i) => i === 0 || x === j[i - 1] + 1);
  return suite ? `${NOMS_JOURS[j[0]]} → ${NOMS_JOURS[j[j.length - 1]]}` : j.map((x) => NOMS_JOURS[x]).join(", ");
};

const deuxChiffres = (x) => String(x).padStart(2, "0");
const dateUtc = (d) => {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12));
};
const jourSemaine = (d) => dateUtc(d).getUTCDay(); // 0 = dimanche
const libelleJour = (d, court) => dateUtc(d).toLocaleDateString("fr-FR", { weekday: court ? "short" : "long", day: "numeric", month: court ? "short" : "long", timeZone: "UTC" });
const jourFr = (d) => d.split("-").reverse().join("/");
const debutSemaine = (d) => ajouterJours(d, -jourSemaine(d));
const debutMois = (d) => d.slice(0, 8) + "01";
const decalerMois = (d, n) => {
  const [a, m] = d.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 + n, 1, 12));
  return `${x.getUTCFullYear()}-${deuxChiffres(x.getUTCMonth() + 1)}-01`;
};
const nbJoursDuMois = (d) => {
  const [a, m] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};
const titreMois = (d) => dateUtc(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

const prixActuel = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime);
const textePrix = (d) => {
  const p = prixActuel(d);
  if (typeof p === "number") return p + " ₪";
  return d.surDevis ? "Sur devis" : "À fixer";
};

// Periodes de fermeture decoupees sur une journee : { label, type, texte }
function creneauxDuJour(periodes, jour) {
  const debutJ = localVersUtc(jour, "00:00");
  const finJ = localVersUtc(ajouterJours(jour, 1), "00:00");
  const res = [];
  for (const p of periodes) {
    if (p.finUtc <= debutJ || p.debutUtc >= finJ) continue;
    const commence = p.debutUtc > debutJ;
    const finit = p.finUtc < finJ;
    let texte = "Toute la journée";
    if (commence && finit) texte = `de ${p.debut.heure} à ${p.fin.heure}`;
    else if (commence) texte = `à partir de ${p.debut.heure}`;
    else if (finit) texte = `jusqu'à ${p.fin.heure}`;
    const minutes = Math.round((Math.min(p.finUtc, finJ) - Math.max(p.debutUtc, debutJ)) / 60000);
    res.push({ label: p.label, type: p.type, texte, minutes, debutUtc: p.debutUtc, entree: p.entree, sortie: p.sortie, fete: p.fete, commence, finit });
  }
  return res.sort((a, b) => a.debutUtc - b.debutUtc);
}

// "ferme" = toute la journee, "partiel" = une partie de la journee (Chabbat/fetes et fermetures exceptionnelles)
function etatJour(creneaux) {
  const importantes = creneaux.filter((c) => c.type !== "personnel");
  if (importantes.some((c) => c.minutes >= 12 * 60)) return "ferme";
  if (importantes.length > 0) return "partiel";
  return "libre";
}
// ---- fin des fonctions de calcul ----

// Ajout d'une fermeture (vacances, jour de repos...)
// J4b : enEquipe = Rebecca n'est plus seule ; elle choisit « toute l'equipe » (par defaut) ou « seulement moi ».
// pourMembre = id d'un coequipier : la fermeture devient SON indisponibilite (document public disposEquipe, sans motif).
function AjoutFermeture({ aujourdhui, enEquipe = false, pourMembre = null }) {
  const [portee, setPortee] = useState("equipe");
  const [dateDebut, setDateDebut] = useState(aujourdhui);
  const [heureDebut, setHeureDebut] = useState("00:00");
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [heureFin, setHeureFin] = useState("23:59");
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ok, setOk] = useState("");

  const changerDebut = (v) => {
    setDateDebut(v);
    if (!dateFin || dateFin < v) setDateFin(v);
  };

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur("");
    setOk("");
    if (!dateDebut || !heureDebut || !dateFin || !heureFin) return setErreur("Remplissez les dates et les heures.");
    const debut = `${dateDebut}T${heureDebut}`;
    const fin = `${dateFin}T${heureFin}`;
    if (fin <= debut) return setErreur("La fin doit être après le début.");
    setEnCours(true);
    try {
      if (pourMembre) {
        await setDoc(doc(db, "disposEquipe", pourMembre), { indispos: arrayUnion({ debut, fin }), majLe: serverTimestamp() }, { merge: true });
        setOk("Indisponibilité ajoutée. Les courses ne te seront pas proposées sur ces horaires.");
      } else {
        await addDoc(collection(db, "fermetures"), { debut, fin, motif: motif.trim().slice(0, 60), ...(enEquipe && portee === "moi" ? { portee: "moi" } : {}), creeLe: serverTimestamp() });
        setOk(enEquipe && portee === "moi" ? "Fermeture ajoutée pour toi seule : l'équipe reste réservable." : "Fermeture ajoutée. Les clients ne pourront plus réserver sur ces horaires.");
      }
      setMotif("");
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion.");
    }
    setEnCours(false);
  };

  return (
    <form className="fm-form" onSubmit={ajouter}>
      <div className="fm-ligne">
        <label className="fm-champ">Début : date<input type="date" value={dateDebut} onChange={(e) => changerDebut(e.target.value)} /></label>
        <label className="fm-champ">Heure<input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} /></label>
      </div>
      <div className="fm-ligne">
        <label className="fm-champ">Fin : date<input type="date" value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} /></label>
        <label className="fm-champ">Heure<input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} /></label>
      </div>
      {!pourMembre && (
        <label className="fm-champ">
          Motif (visible par les clients)
          <input type="text" maxLength={60} value={motif} placeholder="Ex : Indisponible" onChange={(e) => setMotif(e.target.value)} />
        </label>
      )}
      {!pourMembre && enEquipe && (
        <div className="tb-filtres" role="radiogroup" aria-label="Qui est fermé">
          <button type="button" role="radio" aria-checked={portee === "equipe"} className={"tb-filtre" + (portee === "equipe" ? " actif" : "")} onClick={() => setPortee("equipe")}>Toute l'équipe</button>
          <button type="button" role="radio" aria-checked={portee === "moi"} className={"tb-filtre" + (portee === "moi" ? " actif" : "")} onClick={() => setPortee("moi")}>Seulement moi</button>
        </div>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
      {ok && <p className="fm-ok">{ok}</p>}
      <button className="tb-bouton" type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Ajouter cette fermeture"}</button>
    </form>
  );
}

// Une fermeture a venir, avec suppression en deux touches
function LigneFermeture({ f }) {
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const supprimer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      await deleteDoc(doc(db, "fermetures", f.id));
    } catch {
      setErreur("Suppression impossible.");
      setEnCours(false);
      setConfirmer(false);
    }
  };
  const [d1, h1] = f.debut.split("T");
  const [d2, h2] = f.fin.split("T");
  return (
    <div className="fm-item">
      <div>
        <p><strong>{f.motif || "Fermeture exceptionnelle"}</strong>{f.portee === "moi" ? <small> · seulement moi</small> : null}</p>
        <small>du {jourFr(d1)} {h1} au {jourFr(d2)} {h2}</small>
        {erreur && <p className="fm-erreur">{erreur}</p>}
      </div>
      {confirmer ? (
        <button className="fm-petit alerte" onClick={supprimer} disabled={enCours}>Confirmer ?</button>
      ) : (
        <button className="fm-petit clair" onClick={() => setConfirmer(true)}>Supprimer</button>
      )}
    </div>
  );
}

// Un jour de Hol Hamoed : ouvert par defaut, Rebecca le ferme ou le rouvre
function LigneHolHamoed({ x, fermeture }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const basculer = async () => {
    setEnCours(true);
    setErreur("");
    try {
      if (fermeture) await deleteDoc(doc(db, "fermetures", fermeture.id));
      else
        await addDoc(collection(db, "fermetures"), {
          debut: `${x.date}T00:00`,
          fin: `${x.date}T23:59`,
          motif: "Hol Hamoed : jour fermé",
          holHamoed: x.date,
          creeLe: serverTimestamp(),
        });
    } catch {
      setErreur("Modification impossible.");
    }
    setEnCours(false);
  };
  return (
    <div className="fm-item">
      <div>
        <p><strong>{libelleJour(x.date)}</strong></p>
        <small>{x.nom} · {fermeture ? <span className="fm-ferme">Fermé</span> : "Ouvert"}</small>
        {erreur && <p className="fm-erreur">{erreur}</p>}
      </div>
      <button className={"fm-petit" + (fermeture ? " clair" : "")} onClick={basculer} disabled={enCours}>
        {fermeture ? "Rouvrir" : "Fermer"}
      </button>
    </div>
  );
}

// VACANCES SCOLAIRES A DECIDER (12 nov. 2026) : pendant les vacances, ma fille est avec moi.
// Pour chaque periode : ouverte (comme d'habitude), fermee, ou fermee l'apres-midi (a partir de 13h).
// Une decision = des fermetures marquees « vacances » (cle = debut de la periode) ; « ouverte » n'en cree aucune
// mais la retient dans reglages/vacancesDecisions pour ne plus la proposer.
const CHOIX_VACANCES = [
  { v: "ouverte", l: "Ouverte" },
  { v: "fermee", l: "Fermée" },
  { v: "apresmidi", l: "Fermée l'après-midi" },
];
function LigneVacances({ v, decision, fermetures, onDecision }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const choisir = async (choix) => {
    setEnCours(true);
    setErreur("");
    try {
      const lot = writeBatch(db);
      for (const f of fermetures) lot.delete(doc(db, "fermetures", f.id));
      if (choix === "fermee") lot.set(doc(collection(db, "fermetures")), { debut: `${v.du}T00:00`, fin: `${v.au}T23:59`, motif: v.nom, vacances: v.du, creeLe: serverTimestamp() });
      if (choix === "apresmidi") {
        for (let d = v.du; d <= v.au; d = ajouterJours(d, 1)) lot.set(doc(collection(db, "fermetures")), { debut: `${d}T13:00`, fin: `${d}T23:59`, motif: `${v.nom} (après-midi)`, vacances: v.du, creeLe: serverTimestamp() });
      }
      await lot.commit();
      await onDecision(choix);
    } catch {
      setErreur("Modification impossible.");
    }
    setEnCours(false);
  };
  return (
    <div className="fm-item fm-vacances">
      <div>
        <p><strong>{v.nom}</strong></p>
        <small>du {libelleJour(v.du)} au {libelleJour(v.au)} · {decision ? CHOIX_VACANCES.find((c) => c.v === decision).l : "à décider (ouverte en attendant)"}</small>
        {erreur && <p className="fm-erreur">{erreur}</p>}
      </div>
      <div className="fm-choix">
        {CHOIX_VACANCES.map((c) => (
          <button key={c.v} className={"fm-petit" + (decision === c.v ? "" : " clair")} disabled={enCours} onClick={() => choisir(c.v)}>{c.l}</button>
        ))}
      </div>
    </div>
  );
}

// Un creneau fixe (ecole, trajets reguliers) : actif = bloque les clients, libre = ne bloque plus
function LigneCreneau({ c, onChanger }) {
  const [edition, setEdition] = useState(false);
  const [jours, setJours] = useState(c.jours);
  const [debut, setDebut] = useState(c.debut);
  const [fin, setFin] = useState(c.fin);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async (nouveau) => {
    setEnCours(true);
    setErreur("");
    try {
      await onChanger(nouveau);
      setEdition(false);
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion.");
    }
    setEnCours(false);
  };
  const basculer = () => enregistrer({ ...c, actif: !c.actif });
  const sauver = () => {
    const nouveau = { ...c, jours: [...jours].sort(), debut, fin };
    if (!creneauValide(nouveau)) return setErreur("Choisissez au moins un jour et une heure de fin après le début.");
    enregistrer(nouveau);
  };
  const cocher = (n) => setJours((j) => (j.includes(n) ? j.filter((x) => x !== n) : [...j, n]));

  return (
    <div className="cf-item">
      <div className="fm-item">
        <div>
          <p><strong>{c.debut} – {c.fin}</strong></p>
          <small>{texteJours(c.jours)} · {c.actif ? "Actif (bloque les clients)" : <span className="fm-ferme">Libre (ne bloque plus)</span>}</small>
        </div>
        <button className={"fm-petit" + (c.actif ? "" : " clair")} onClick={basculer} disabled={enCours}>
          {c.actif ? "Me libérer" : "Réactiver"}
        </button>
      </div>
      <button className="cf-modifier" onClick={() => setEdition(!edition)}>{edition ? "Fermer" : "Modifier les jours et les heures"}</button>
      {edition && (
        <div className="fm-form">
          <div className="cf-jours">
            {NOMS_JOURS.map((nom, n) => (
              <button key={n} type="button" className={"cf-jour" + (jours.includes(n) ? " actif" : "")} onClick={() => cocher(n)} aria-pressed={jours.includes(n)}>
                {nom}
              </button>
            ))}
          </div>
          <div className="fm-ligne">
            <label className="fm-champ">De<input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} /></label>
            <label className="fm-champ">À<input type="time" value={fin} onChange={(e) => setFin(e.target.value)} /></label>
          </div>
          <button className="tb-bouton" onClick={sauver} disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

function Fermeture({ c }) {
  if (c.type === "chabbat_fete") {
    // 19 nov. 2026 : heure officielle (allumage ou sortie) + heure de fermeture/reouverture du site
    const officiel = [c.commence && c.entree ? `entrée ${c.entree.heure.replace(":", "h")}` : "", c.finit && c.sortie ? `sortie ${c.sortie.heure.replace(":", "h")}` : ""].filter(Boolean).join(" · ");
    return (
      <div className={"ag-ferme-ligne " + (c.fete ? "fete" : "chabbat")}>
        <strong>{c.fete ? "✡️ Fête" : "🕯️ Chabbat"} : {c.label}</strong>
        <span>Fermé {c.texte}</span>
        {officiel && <span className="ag-officiel">{officiel}</span>}
      </div>
    );
  }
  return (
    <div className={"ag-ferme-ligne" + (c.type === "personnel" ? " perso" : "")}>
      <strong>{c.label}</strong>
      <span>{c.texte}</span>
    </div>
  );
}

// Les 3 calendriers d'une journee, chacun son etiquette : Chabbat, fete, vacances scolaires (19 nov. 2026)
function EtiquettesJour({ jour }) {
  const e = etiquettesDuJour(jour);
  if (!e.chabbat && !e.fete && !e.veille && !e.vacances) return null;
  return (
    <div className="ag-etiquettes">
      {e.chabbat && <span className="ag-etiq chabbat">🕯️ Chabbat</span>}
      {e.fete && <span className="ag-etiq fete">✡️ Fête : {e.fete}</span>}
      {e.veille && <span className="ag-etiq veille">Veille de {e.veille}</span>}
      {e.vacances && (
        <span className="ag-etiq vacances">
          🏖️ {e.vacances}
          {e.provisoire ? " (dates à confirmer)" : ""}
        </span>
      )}
    </div>
  );
}

function Evenement({ d, aujourdhui, admin = false, journee = null }) {
  const cleAvec = "c:" + d.id + (d.estRetour ? "-r" : "");
  const [ouvert, setOuvert] = useState(false);
  // 19 nov. 2026 : supprimer une course de test directement depuis ma journée (Rebecca seule)
  const [suppr, setSuppr] = useState("");
  const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
  const whatsapp = lienWhatsApp(d.telephone);
  const appel = lienAppel(d.telephone);
  const adresses = Object.values(d.details || {}).filter((x) => x && typeof x === "object" && x.label);
  return (
    <div className={"ag-event ag-" + st.classe}>
      <button className="ag-event-tete" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
        <span className="ag-heure">{d.heure}</span>
        <span className="ag-corps">
          <strong><Pastille d={d} /> {d.serviceTitre}</strong>
          <small>{d.nom} · {textePrix(d)}{admin && d.prixAmi ? " 💛" : ""}{admin && badgeAvecMoi(journee, d.date, cleAvec)}</small>
          {typeof d.kmEstime === "number" && typeof d.minutesEstimees === "number" && <small>🚗 Trajet {texteDuree(d.minutesEstimees, d.date, d.heure)}</small>}
          <InfoVol d={d} compact />
        </span>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </button>
      {/* 17 nov. 2026 : Récupérée → Déposée → Rentrée, Encaissé, merci WhatsApp, rappel de la veille */}
      <FinCourseAgenda d={d} aujourdhui={aujourdhui} />
      {ouvert && (
        <div className="ag-detail">
          <p>{d.telephone} · {d.details && d.details.commandeResto ? "🍕 restaurant partenaire · payée avec son relevé du dimanche" : `Paiement prévu : ${d.moyenPaiement}`}</p>
          {d.details && d.details.commandeResto && d.details.destinataire && <p>Client : {d.details.destinataire}{d.details.telDestinataire ? ` · ${d.details.telDestinataire}` : ""}</p>}
          {adresses.map((a, i) => (
            <div key={i} className="ag-adresse-ligne">
              <p dir="auto" className="ag-adresse">{a.label}</p>
              <a className="ag-waze" href={lienWazePoint(a)} target="_blank" rel="noopener noreferrer" aria-label={"Ouvrir " + a.label + " dans Waze"}>Waze</a>
            </div>
          ))}
          <div className="tb-actions">
            {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
          </div>
          {admin && <EtapesEtModifier d={d} />}
          <p className="tb-note">Pour accepter, refuser ou changer le prix : onglet Demandes.</p>
          {admin && d.statut === "acceptee" && <PartagerPosition d={d} />}
          {admin && <AvecMoi journee={journee} date={d.date} cle={cleAvec} />}
          {admin && <ConfierCourse d={d} />}
          {admin && (suppr === "" ? (
            <button type="button" className="ag-modifier" onClick={() => setSuppr("?")}>Supprimer cette course</button>
          ) : suppr === "?" ? (
            <div className="tb-actions">
              <button type="button" className="tb-bouton ag-danger" onClick={() => supprimerCourseComplete(d.id).catch(() => setSuppr("Suppression impossible. Vérifie la connexion (règles Firebase v28)."))}>Oui, supprimer (avec ses paiements)</button>
              <button type="button" className="ag-modifier" onClick={() => setSuppr("")}>Non</button>
            </div>
          ) : <p className="admin-erreur" role="alert">{suppr}</p>)}
        </div>
      )}
    </div>
  );
}

// 25 nov. 2026 (Rebecca, course de Kelly) : voir les 2 étapes avec leur heure (récupérer puis livrer)
// et changer l'heure, la date ou une note (« chez Deborah ») directement depuis le Calendrier.
const ajouterMin = (h, m) => { const [a, b] = String(h || "").split(":").map(Number); if (!Number.isFinite(a)) return ""; const t = (a * 60 + (b || 0) + Math.round(m || 0)) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
function EtapesEtModifier({ d }) {
  const v = d.details || {};
  const t = trajetACalculer(d.service, v);
  const heure = d.estRetour ? v.heureRetour || d.heure : d.heure;
  const [a, b] = t ? (d.estRetour ? [t.arrivee, t.depart] : [t.depart, t.arrivee]) : [null, null];
  const verbe = d.service === "livraison" || d.service === "courses" ? ["📦 Récupérer", "🏁 Livrer"] : ["🚗 Prendre en charge", "🏁 Déposer"];
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ date: d.date || "", heure: heure || "", note: d.noteAdmin || "", ami: d.prixAmi === true });
  const [msg, setMsg] = useState("");
  const sauver = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !/^\d{2}:\d{2}$/.test(f.heure)) return setMsg("Choisis une date et une heure.");
    setMsg("Enregistrement…");
    const maj = d.estRetour ? { "details.heureRetour": f.heure, "details.dateRetour": f.date } : { date: f.date, heure: f.heure };
    try {
      await updateDoc(doc(db, "demandes", d.id), { ...maj, noteAdmin: f.note.trim(), prixAmi: f.ami === true });
      setMsg("✅ Enregistré : ta journée se recalcule.");
      setOuvert(false);
    } catch {
      setMsg("Enregistrement impossible : vérifie la connexion.");
    }
  };
  return (
    <div className="ag-etapes-course">
      {a && b && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0" }}>
          <li><strong>{(heure || "").replace(":", "h")}</strong> {verbe[0]}{d.noteAdmin ? ` (${d.noteAdmin})` : ""} · <small dir="auto">{a.label}</small></li>
          <li><strong>{typeof d.minutesEstimees === "number" ? "≈ " + ajouterMin(heure, d.minutesEstimees + 5).replace(":", "h") : "ensuite"}</strong> {verbe[1]}{d.nom ? ` chez ${d.nom}` : ""} · <small dir="auto">{b.label}</small></li>
        </ul>
      )}
      {!a && d.noteAdmin && <p className="tb-note">📝 {d.noteAdmin}</p>}
      {d.prixAmi && <p className="tb-note">💛 Prix ami : faveur, pas une course mal tarifée.</p>}
      {!ouvert ? (
        <button type="button" className="ag-modifier" onClick={() => { setF({ date: (d.estRetour ? v.dateRetour : d.date) || "", heure: heure || "", note: d.noteAdmin || "", ami: d.prixAmi === true }); setOuvert(true); setMsg(""); }}>✏️ Modifier l'heure, la date ou la note</button>
      ) : (
        <div className="tb-bloc">
          <label className="tb-note">Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="tb-note">Heure de départ (1re étape)<input type="time" value={f.heure} onChange={(e) => setF({ ...f, heure: e.target.value })} /></label>
          <label className="tb-note">Note pour moi (ex. « chez Deborah »)<input type="text" value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <label className="tb-note" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.ami} onChange={(e) => setF({ ...f, ami: e.target.checked })} style={{ width: "auto" }} /> 💛 Prix ami (faveur : ne compte pas comme une course mal tarifée)</label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" onClick={sauver}>Enregistrer</button>
            <button type="button" className="ag-modifier" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </div>
      )}
      {msg && <p className="tb-note" role="status">{msg}</p>}
    </div>
  );
}

// Mission confiee (trajets de la tournee scolaire donnes a un coequipier pour ce jour-la)
// 25 nov. 2026 : Rebecca voit la mission confiee dans sa journee, avec « Prévenir » et « Je le reprends »
function Mission({ m, pourTous, journee = null }) {
  const { membres } = useEquipeContexte();
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const membre = (membres || []).find((x) => x && x.id === m.membre);
  const ecole = (m.etapes || []).length > 0 && m.etapes.every((e) => /^(Prendre|Déposer) /.test(e.texte || ""));
  const wa = pourTous && membre && membre.telephone && m.date ? lienWhatsApp(membre.telephone, messageMission(m, m.nomMembre || membre.nom || "")) : "";
  const peutReprendre = pourTous && journee && journee.confies && journee.confies(m.date).some((x) => x.id === m.id);
  const reprendre = () => {
    setErreur("");
    setEnCours(true);
    journee.reprendre(m.id).catch(() => setErreur("Modification impossible pour l'instant. Vérifie la connexion.")).finally(() => setEnCours(false));
  };
  return (
    <div className="ag-mission">
      <p><strong>{ecole ? "🎒" : "🤝"} {m.debut.replace(":", "h")} → {m.fin.replace(":", "h")} · {ecole ? "Ramassage scolaire" : "Mission"}{pourTous && m.nomMembre ? ` · confié à ${m.nomMembre}` : ""}</strong></p>
      <ul>
        {(m.etapes || []).map((e, i) => (
          <li key={i}>{e.heure} · {e.texte} <small>{e.lieu}</small></li>
        ))}
      </ul>
      {(wa || peutReprendre) && (
        <div className="tb-actions">
          {wa && <a className="ag-waze" href={wa} target="_blank" rel="noopener noreferrer">💬 Prévenir {m.nomMembre || membre.nom || ""}</a>}
          {peutReprendre && <button type="button" className="ag-modifier" disabled={enCours} onClick={reprendre}>Je le reprends</button>}
        </div>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

// 25 nov. 2026 (Rebecca : « confié à Jérémy sur toutes mes tâches, pas obligé qu'il accepte ») : une tâche de ma journée
function ConfierUneTache({ journee, date, tache }) {
  const { membres } = useEquipeContexte();
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const equipiers = (membres || []).filter((m) => m && m.id !== ADMIN_ID);
  if (!journee || !journee.confierTache || !tache || !equipiers.length) return null;
  const confier = async (m) => {
    setErreur("");
    setEnCours(true);
    try {
      const r = await journee.confierTache(date, tache, m);
      if (r && r.lien === undefined) setErreur(r.texte);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  return (
    <div className="ag-etape-actions">
      <p><strong>🤝 Confier cette tâche</strong></p>
      <p className="tb-note">Elle passe tout de suite dans son agenda et sort du tien (pas besoin qu'il accepte). Ensuite, « 💬 Prévenir » pour lui envoyer sur WhatsApp.</p>
      <div className="tb-actions">
        {equipiers.map((m) => (
          <button key={m.id} type="button" className="tb-bouton" disabled={enCours} onClick={() => confier(m)}>{enCours ? "Enregistrement…" : `Confier à ${m.nom || "mon coéquipier"}`}</button>
        ))}
      </div>
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

// 25 nov. 2026 : une course (demande) confiée directement depuis l'agenda, sans acceptation
function ConfierCourse({ d }) {
  const { membres } = useEquipeContexte();
  const [erreur, setErreur] = useState("");
  const [lien, setLien] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const equipiers = (membres || []).filter((m) => m && m.id !== ADMIN_ID);
  if (!equipiers.length || !d || !d.id || ["terminee", "annulee", "refusee"].includes(d.statut)) return null;
  const qui = attribueA(d);
  const changer = async (versId) => {
    setErreur("");
    setEnCours(true);
    const r = confierDirect(d, versId, Date.now());
    try {
      if (r.maj) await updateDoc(doc(db, "demandes", d.id), { ...r.maj, ...(r.trace ? { historiqueAttribution: arrayUnion(r.trace) } : {}), majLe: serverTimestamp() });
      const vers = membres.find((m) => m.id === versId);
      setLien(versId !== ADMIN_ID && vers && vers.telephone ? { nom: vers.nom || "", url: lienWhatsApp(vers.telephone, messageTransfert(d, "Rebecca", vers.nom || "")) } : null);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  return (
    <div className="ag-etape-actions">
      {qui === ADMIN_ID ? (
        <>
          <p><strong>🤝 Confier cette course</strong> <small>(tout de suite dans son agenda, sans qu'il accepte)</small></p>
          <div className="tb-actions">
            {equipiers.map((m) => (
              <button key={m.id} type="button" className="tb-bouton" disabled={enCours} onClick={() => changer(m.id)}>Confier à {m.nom || "mon coéquipier"}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p><strong>🤝 Confiée à {nomDe(membres, qui)}</strong></p>
          <div className="tb-actions">
            {lien && lien.url && <a className="ag-waze" href={lien.url} target="_blank" rel="noopener noreferrer">💬 Prévenir {lien.nom}</a>}
            {!lien && (() => {
              const m = membres.find((x) => x.id === qui);
              const url = m && m.telephone ? lienWhatsApp(m.telephone, messageTransfert(d, "Rebecca", m.nom || "")) : "";
              return url ? <a className="ag-waze" href={url} target="_blank" rel="noopener noreferrer">💬 Prévenir {m.nom}</a> : null;
            })()}
            <button type="button" className="ag-modifier" disabled={enCours} onClick={() => changer(ADMIN_ID)}>Je la reprends</button>
          </div>
        </>
      )}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

// 25 nov. 2026 (Rebecca : « je serai à Tel Aviv, c'est Jérémy qui récupère Shyrel ») : depuis l'étape, confier le
// trajet de ce jour à un coéquipier. Le trajet entier (prendre + déposer) passe dans son planning ; ma tournée des
// autres semaines ne change pas.
function ConfierEtape({ journee, date, ids, noms }) {
  const { membres } = useEquipeContexte();
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const equipiers = (membres || []).filter((m) => m && m.id !== ADMIN_ID);
  if (!journee || !journee.confier || !equipiers.length) return null;
  const qui = noms.length ? noms.join(", ") : "ce trajet";
  const confier = async (m) => {
    setErreur("");
    setEnCours(true);
    try {
      const r = await journee.confier(date, ids, m);
      if (r && r.lien === undefined) setErreur(r.texte);
    } catch {
      setErreur("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  return (
    <div className="ag-etape-actions">
      <p><strong>🤝 Confier ce trajet aujourd'hui</strong></p>
      <p className="tb-note">Le trajet entier de {qui} (prendre et déposer) passe dans son planning et sort de ta journée, ce jour seulement.</p>
      <div className="tb-actions">
        {equipiers.map((m) => (
          <button key={m.id} type="button" className="tb-bouton" disabled={enCours || !ids.length} onClick={() => confier(m)}>{enCours ? "Enregistrement…" : `Confier à ${m.nom || "mon coéquipier"}`}</button>
        ))}
      </div>
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}

// « Avec ou sans Shyrel » (19 nov. 2026, 14h10) : sur n'importe quelle etape, tache ou course de ma journee, cocher
// qui est avec moi dans la voiture ce jour-la (enfants de ma fiche « Moi » du Repertoire, ou un prenom tape).
function AvecMoi({ journee, date, cle }) {
  const [autre, setAutre] = useState("");
  const [erreur, setErreur] = useState("");
  if (!journee || !journee.changerAvecMoi || !cle) return null;
  const avec = journee.avecMoi(date, cle);
  const noms = [...new Set([...(journee.enfantsMoi || []), ...avec])];
  const changer = (liste) => {
    setErreur("");
    journee.changerAvecMoi(date, cle, liste).catch(() => setErreur("Enregistrement impossible. Vérifie la connexion."));
  };
  return (
    <div className="ag-etape-actions">
      <p className="tb-note">🚗 Avec moi dans la voiture (ce jour seulement) :</p>
      <div className="tb-actions">
        {noms.map((n) => {
          const oui = avec.includes(n);
          return (
            <button key={n} type="button" className={"tb-bouton" + (oui ? "" : " tb-clair")} aria-pressed={oui} onClick={() => changer(oui ? avec.filter((x) => x !== n) : [...avec, n])}>
              {oui ? "✓ Avec " : "Sans "}{n}
            </button>
          );
        })}
      </div>
      <label className="ag-champ">Autre prénom
        <input type="text" value={autre} maxLength={30} onChange={(x) => setAutre(x.target.value)} placeholder="ex. Shyrel" />
      </label>
      {autre.trim() && <button type="button" className="tb-bouton tb-clair" onClick={() => { changer([...avec, autre.trim()]); setAutre(""); }}>Ajouter {autre.trim()} avec moi</button>}
      {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
    </div>
  );
}
const badgeAvecMoi = (journee, date, cle) => {
  const t = journee && journee.avecMoi && cle ? texteAvecMoi(journee.avecMoi(date, cle)) : "";
  return t ? <small className="ag-etape-modif"> · 👧 {t}</small> : null;
};

// Une etape de ma journee (tournee scolaire ou tache) : heure, quoi faire, ou, Waze, et « Modifier »
// Modifier = CE JOUR SEULEMENT : changer l'heure ou retirer le trajet ; la tournee de chaque semaine ne bouge pas.
// « ✓ Fait » (13 nov. 2026) : valide = maJournee pour aujourd'hui et hier seulement ; recocher = annuler.
function Etape({ e, date, journee, valide = null, familles = [], suivante = null }) {
  const [ouvert, setOuvert] = useState(false);
  // 18 nov. 2026 : arrivee prevue a l'etape suivante (message aux parents).
  // 19 nov. 2026, 14h08 : on garde le TEMPS de trajet ; l'heure d'arrivee se calcule au moment ou elle touche
  // « Prévenir » (elle a pu attendre au Gan entre « ✓ Fait » et le message).
  const [duree, setDuree] = useState(null);
  const [heure, setHeure] = useState("");
  const [qui, setQui] = useState([]); // 19 nov. 2026 : trajets coches dans une etape a plusieurs enfants
  const [heureMaison, setHeureMaison] = useState("");
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [prixCourse, setPrixCourse] = useState(null); // course pour un compte : { prix, paye, moyen }
  const faitIci = valide && etapeValidable(e) ? valide.faitA(date, e) : "";
  const adresseSuivante = suivante && suivante.adresse;
  useEffect(() => {
    if (faitIci && e.sorte === "prise" && adresseSuivante && duree == null) minutesJusqua(adresseSuivante).then(setDuree).catch(() => {});
  }, [faitIci, e.sorte, adresseSuivante, duree]);
  if (e.genre === "libre" || e.genre === "pause") {
    return (
      <li className={"ag-etape " + e.genre}>
        <b>{e.heure}</b>{" "}
        <span>{e.texte}{e.jusqua ? ` jusqu'à ${e.jusqua}` : e.minutes != null ? ` (${e.minutes} min)` : ""}</span>
      </li>
    );
  }
  const modifiable = journee && (e.genre === "arret" || e.genre === "tache");
  const fait = valide && etapeValidable(e) ? valide.faitA(date, e) : "";
  const compte = valide && valide.compteDe ? valide.compteDe(e) : null;
  const terminerCourse = async () => {
    setMessage("");
    setEnCours(true);
    try {
      setInfo(await valide.courseFaite(date, e, { prix: Number(String(prixCourse.prix).replace(",", ".")), paye: Number(String(prixCourse.paye || 0).replace(",", ".")), moyen: prixCourse.moyen }));
      setPrixCourse(null);
    } catch {
      setMessage("Enregistrement impossible. Vérifie le prix et la connexion.");
    }
    setEnCours(false);
  };
  const cocher = async () => {
    if (compte && !fait) {
      setPrixCourse(prixCourse ? null : { prix: "", paye: "", moyen: "Espèces" });
      return;
    }
    setMessage("");
    setInfo("");
    setEnCours(true);
    try {
      setInfo(await (fait ? valide.annuler(date, e) : valide.valider(date, e)));
      if (!fait && e.sorte === "prise" && suivante && suivante.adresse) minutesJusqua(suivante.adresse).then(setDuree).catch(() => {});
      // Enfants deposes : le suivi en direct de leur famille s'arrete et s'efface
      if (!fait && e.sorte === "depose") for (const p of parentsAPrevenir(familles, e.texte)) arreterSuivi(date, p.famille);
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };
  const faire = async (action) => {
    setMessage("");
    try {
      await action();
      setOuvert(false);
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
    }
  };
  return (
    <li className={"ag-etape " + e.genre + (e.coince ? " coince" : "") + (fait ? " fait" : "")}>
      <div className="ag-etape-ligne">
        <b>{e.heure}</b>
        <span>
          {e.genre === "arret" ? "🎒 " : e.genre === "maison" ? "🏠 " : e.genre === "tache" ? iconeTache(e.tache) + " " : "🚗 "}
          {e.texte}
          {e.genre === "tache" && e.jusqua ? ` (jusqu'à ${e.jusqua})` : ""}
          {e.genre === "tache" && e.tache && e.tache.type !== "ramassage" && e.tache.pour && <small> · pour {e.tache.pour}</small>}
          {e.genre === "tache" && e.tache && libelleAge(e.tache.age) && <small> · {libelleAge(e.tache.age)}</small>}
          {e.lieu && <small> · {e.lieu}{e.marge ? ` · ${e.marge}` : ""}</small>}
          {e.genre === "arret" && journee && journee.heureChangee(date, e.ids) && <small className="ag-etape-modif"> · heure changée ce jour</small>}
          {badgeAvecMoi(journee, date, cleEtape(e))}
          {e.alerte && <small className="ag-etape-alerte">{e.alerte}</small>}
        </span>
      </div>
      <div className="ag-etape-boutons">
        {e.adresse && <a className="ag-waze" href={lienWazePoint(e.adresse)} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${e.lieu || "l'adresse"} dans Waze`}>Waze</a>}
        {e.genre === "tache" && e.tache && e.tache.livraison && <a className="ag-waze" href={lienWazePoint(e.tache.livraison)} target="_blank" rel="noopener noreferrer">Waze livraison</a>}
        {modifiable && !fait && <button type="button" className="ag-modifier" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>{ouvert ? "Fermer" : "Modifier"}</button>}
        {valide && etapeValidable(e) && (
          <button type="button" className={"ag-fait" + (fait ? " oui" : "")} onClick={cocher} disabled={enCours} aria-pressed={!!fait} aria-label={fait ? "Annuler : pas encore fait" : "Marquer comme fait"}>
            {fait ? `✓ Fait ${fait.replace(":", "h")}` : "✓ Fait"}
          </button>
        )}
      </div>
      {prixCourse && (
        <div className="ag-etape-actions">
          <p className="tb-note">Course pour {compte.nom} : note le prix maintenant qu'elle est faite.</p>
          <label className="ag-champ">Prix de la course (₪)<input type="text" inputMode="decimal" value={prixCourse.prix} onChange={(x) => setPrixCourse({ ...prixCourse, prix: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          <label className="ag-champ">Il/elle t'a payé (₪, vide = pas encore)<input type="text" inputMode="decimal" value={prixCourse.paye} onChange={(x) => setPrixCourse({ ...prixCourse, paye: x.target.value.replace(/[^0-9.,]/g, "") })} /></label>
          {Number(String(prixCourse.paye).replace(",", ".")) > 0 && (
            <label className="ag-champ">Moyen de paiement
              <select value={prixCourse.moyen} onChange={(x) => setPrixCourse({ ...prixCourse, moyen: x.target.value })}>
                {["Espèces", "Carte bancaire", "Revolut", "Bit", "Virement"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!(Number(String(prixCourse.prix).replace(",", ".")) > 0) || enCours} onClick={terminerCourse}>{enCours ? "Enregistrement…" : "Course faite"}</button>
            <button type="button" className="tb-bouton tb-clair" onClick={() => setPrixCourse(null)}>Annuler</button>
          </div>
        </div>
      )}
      {info && <p className="ag-fait-info">{info}</p>}
      {/* 17 nov. 2026 : ramassage fait -> prevenir les parents (« j'ai bien recupere… », « … est bien arrive(e) ») */}
      {/* 17 nov. 2026, 12h03 : en retard -> prevenir les parents (10 min, modifiable dans WhatsApp) */}
      {!fait && valide && e.genre === "arret" && parentsAPrevenir(familles, e.texte).map((p) => {
        const wa = lienWhatsApp(p.telephone, messageRetard(p.prenoms, 10));
        return wa ? <a key={"retard" + p.famille} className="ag-waze" href={wa} target="_blank" rel="noopener noreferrer">⏱ Retard ({p.nom || "parents"})</a> : null;
      })}
      {fait && e.genre === "arret" && parentsAPrevenir(familles, e.texte).map((p) => {
        const message = (eta, lien) => messageEnfant(e.sorte, p.prenoms, fait === "oui" ? "" : fait, e.lieu, eta, suivante ? suivante.lieu : "", lien);
        const wa = lienWhatsApp(p.telephone, message(duree ? heureDans(duree) : "", ""));
        // Au toucher : heure d'arrivee = maintenant + trajet, et lien de suivi en direct (prise seulement)
        const prevenir = (x) => {
          if (e.sorte !== "prise") return;
          const id = idSuivi(date, p.famille);
          const lien = id && demarrerSuivi(id) ? lienPosition(id, window.location.origin) : "";
          const frais = lienWhatsApp(p.telephone, message(duree ? heureDans(duree) : "", lien));
          if (frais) x.currentTarget.href = frais;
          if (adresseSuivante) minutesJusqua(adresseSuivante).then(setDuree).catch(() => {});
        };
        return wa ? <a key={p.famille} className="ag-waze" href={wa} onClick={prevenir} target="_blank" rel="noopener noreferrer">💬 Prévenir {p.nom || "les parents"}{e.sorte === "prise" ? " + suivi en direct" : ""}</a> : null;
      })}
      {!ouvert && message && <p className="fm-erreur" role="alert">{message}</p>}
      {ouvert && e.genre === "arret" && (
        <div className="ag-etape-actions">
          <p className="tb-note">Ce jour seulement : ta tournée des autres semaines ne change pas.</p>
          <AvecMoi journee={journee} date={date} cle={cleEtape(e)} />
          {(() => {
            // 19 nov. 2026 (Rebecca : Shyrel sort plus tôt, les filles d'Alexia restent à 14h) :
            // 1) choisir QUI est concerné quand l'étape a plusieurs enfants ; 2) changer l'heure en un geste ;
            // 3) « Sort plus tôt → je la ramène à la maison » : un trajet école -> maison est créé, le reste se recalcule.
            const trajetsEtape = journee.trajetsDe ? journee.trajetsDe(e.ids) : [];
            const cibles = qui.length ? qui : e.ids;
            const base = String(e.heure || "").replace("h", ":");
            const n = new Date();
            const maintenant = `${deuxChiffres(n.getHours())}:${deuxChiffres(n.getMinutes())}`;
            const choix = [["Maintenant", maintenant], ["−1 h", decaler(base, -60)], ["−30 min", decaler(base, -30)], ["−15 min", decaler(base, -15)], ["+15 min", decaler(base, 15)], ["+30 min", decaler(base, 30)]];
            const unSeul = cibles.length === 1 ? trajetsEtape.find((r) => r.id === cibles[0]) : null;
            return (
              <>
                {trajetsEtape.length > 1 && (
                  <fieldset className="champ">
                    <legend>Pour qui ?</legend>
                    {trajetsEtape.map((r) => (
                      <label key={r.id} className="rg-case" style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                        <input type="checkbox" checked={cibles.includes(r.id)} onChange={() => setQui((q) => { const actuel = q.length ? q : e.ids; return actuel.includes(r.id) ? actuel.filter((x) => x !== r.id) : [...actuel, r.id]; })} />
                        <span>{r.nom || "Enfant"}</span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="tb-note">Changer l'heure{trajetsEtape.length > 1 ? ` (${cibles.length} trajet${cibles.length > 1 ? "s" : ""} coché${cibles.length > 1 ? "s" : ""})` : ""} :</p>
                <div className="tb-actions">
                  {choix.filter(([, h]) => h).map(([t, h]) => (
                    <button key={t} type="button" className="tb-bouton tb-clair" disabled={!cibles.length} onClick={() => faire(() => journee.changerHeure(date, cibles, h))}>{t}{t === "Maintenant" ? "" : ` (${h.replace(":", "h")})`}</button>
                  ))}
                </div>
                <label className="ag-champ">
                  {e.type === "matin" ? "Ou : arriver au plus tard à" : "Ou : nouvelle heure de sortie"}
                  <input type="time" value={heure} onChange={(x) => setHeure(x.target.value)} />
                </label>
                <div className="tb-actions">
                  <button type="button" className="tb-bouton" disabled={!heure || !cibles.length} onClick={() => faire(() => journee.changerHeure(date, cibles, heure))}>Changer l'heure aujourd'hui</button>
                  {journee.heureChangee(date, e.ids) && <button type="button" className="tb-bouton tb-clair" onClick={() => faire(() => journee.remettre(date, e.ids))}>Remettre l'heure habituelle</button>}
                  <button type="button" className="tb-bouton ag-danger" disabled={!cibles.length} onClick={() => faire(() => journee.retirer(date, cibles))}>{trajetsEtape.length > 1 && cibles.length < e.ids.length ? "Retirer les cochés aujourd'hui" : "Supprimer ce trajet aujourd'hui"}</button>
                </div>
                {e.sorte === "prise" && e.type !== "matin" && journee.ramenerMaison && (
                  <div className="ag-etape-actions">
                    <p><strong>🏫 Je {unSeul ? `récupère ${unSeul.nom || "l'enfant"}` : "la récupère"} À L'ÉCOLE à une autre heure et je la ramène à la maison</strong></p>
                    <p className="tb-note">À utiliser quand elle ne t'attend pas chez quelqu'un ce jour-là (« Changer l'heure » plus haut garde le même lieu de prise en charge).</p>
                    <p className="tb-note">Un trajet école → maison est ajouté à cette heure ; {trajetsEtape.length > 1 ? "les autres enfants gardent leur trajet." : "le trajet habituel est retiré aujourd'hui."}</p>
                    {trajetsEtape.length > 1 && cibles.length !== 1 && <p className="tb-note">Coche un seul enfant au-dessus.</p>}
                    {(() => {
                      // 19 nov. 2026 : l'heure deja choisie aujourd'hui (ex. 13h10) passe avant « maintenant »
                      const deja = cibles.length === 1 && journee.heureDuJour ? journee.heureDuJour(date, cibles[0]) : "";
                      const h = heureMaison || deja || maintenant;
                      return (
                        <>
                          <label className="ag-champ">Heure où tu la récupères (ou l'as récupérée)<input type="time" value={h} onChange={(x) => setHeureMaison(x.target.value)} /></label>
                          <button type="button" className="tb-bouton" disabled={cibles.length !== 1} onClick={() => faire(() => journee.ramenerMaison(date, cibles[0], h))}>Ramener à la maison à {h.replace(":", "h")}</button>
                        </>
                      );
                    })()}
                  </div>
                )}
                <ConfierEtape journee={journee} date={date} ids={cibles} noms={trajetsEtape.filter((r) => cibles.includes(r.id)).map((r) => r.nom || "Enfant")} />
              </>
            );
          })()}
          {message && <p className="fm-erreur" role="alert">{message}</p>}
        </div>
      )}
      {ouvert && e.genre === "tache" && (
        <div className="ag-etape-actions">
          <AvecMoi journee={journee} date={date} cle={cleEtape(e)} />
          <ConfierUneTache journee={journee} date={date} tache={e.tache} />
          <FormTache date={date} journee={journee} initial={e.tache} onFin={() => setOuvert(false)} />
          <div className="tb-actions">
            <button type="button" className="tb-bouton ag-danger" onClick={() => faire(() => journee.retirerTache(date, e.tache.id))}>Supprimer cette tâche</button>
          </div>
          {message && <p className="fm-erreur" role="alert">{message}</p>}
        </div>
      )}
    </li>
  );
}

// Formulaire d'une tache : ajout (« + Ajouter une tâche ») ou modification (initial = la tache a modifier)
// 12 nov. 2026, 22h52 : on choisit d'abord l'activite, puis le formulaire s'adapte :
// - Ramassage scolaire : choisir l'enfant dans le Repertoire, ou « Nouvel enfant » (sa fiche se cree : parents,
//   telephones, ecole, horaires) ;
// - Course / Livraison, Rendez-vous beaute, Autre (docteur...) : quoi, pour qui, adulte ou enfant.
const PLACEHOLDER_QUOI = { course: "Livraison Herzliya, courses Carrefour…", beaute: "Nails, coiffure, Slim & Lift…", autre: "Docteur, banque, réunion…", transport: "Aéroport Ben Gourion, gare…" };
const LIBELLE_QUOI = { course: "Quelle course ou livraison ?", beaute: "Quelle prestation ?", autre: "Quoi ?", transport: "Quel trajet ?" };
const NOUVEL_ENFANT = { famille: "", parent: "", telephone: "", parent2: "", telephone2: "", prenom: "", age: "enfant", ecole: null, entree: "", sortie: "" };
const decaler = (h, minutes) => {
  const m = /^(\d{2}):(\d{2})$/.exec(h || "");
  if (!m) return "";
  const t = Math.min(23 * 60 + 59, Math.max(0, Number(m[1]) * 60 + Number(m[2]) + minutes));
  return deuxChiffres(Math.floor(t / 60)) + ":" + deuxChiffres(t % 60);
};

function FormTache({ date, journee, initial = null, onFin, occupe = [], aujourdhui = "" }) {
  const rep = useRepertoire();
  const enfants = listeEnfants(rep.familles);
  // 15 nov. 2026 : mes lieux + la maison de chaque famille + ses adresses favorites, en un geste
  const connues = (() => {
    const vus = new Map();
    const mettre = (nom, adresse) => { const c = cleLieu(adresse); if (c && nom && !vus.has(c)) vus.set(c, { nom, adresse }); };
    for (const l of rep.lieux || []) mettre(String(l.nom || "").trim(), l.adresse);
    for (const fa of rep.familles || []) {
      if (fa.categorie !== "moi") mettre(`Chez ${fa.nom || "famille"}`, fa.domicile);
      for (const a of fa.adresses || []) mettre(`${a.nom || "Adresse"} (${fa.nom || "famille"})`, a.adresse);
    }
    return [...vus.values()];
  })();
  const choixInitial = initial && initial.enfant ? initial.enfant.famille + "|" + initial.enfant.enfant : "";
  const [f, setF] = useState(
    initial
      ? { type: initial.type || "autre", quoi: initial.type === "ramassage" ? "" : initial.titre, pour: initial.pour || "", age: initial.age || "", debut: initial.debut, fin: initial.fin, lieu: initial.lieu || null, prise: initial.prise || null, enfant: choixInitial, compte: initial.compte || "", livraison: initial.livraison || null }
      : { type: "", quoi: "", pour: "", age: "", debut: "", fin: "", lieu: null, enfant: "", sens: "recuperer", heure: "", de: null, a: null, heure2: "", retour: null, reste: false }
  );
  const [nouvel, setNouvel] = useState(NOUVEL_ENFANT);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const set = (cle, v) => setF((x) => ({ ...x, [cle]: v }));
  const setN = (cle, v) => setNouvel((x) => ({ ...x, [cle]: v }));
  const choisi = enfants.find((e) => e.famille + "|" + e.enfant === f.enfant) || null;
  const estNouvel = f.type === "ramassage" && f.enfant === "nouveau";
  // 13 nov. 2026, 08h30 : un NOUVEAU ramassage n'est pas un creneau mais une heure (recuperer / deposer) et deux
  // adresses ; il devient un vrai trajet de ma journee, place au bon endroit avec le temps de route.
  const ponctuel = f.type === "ramassage" && !initial;
  const remplir = (enfant, sens) => {
    const [famille, id] = String(enfant || "").split("|");
    const p = preRemplirRamassage(rep.familles, { famille, enfant: id }, date, sens);
    return p ? { heure: p.heure, de: p.de, a: p.a } : {};
  };

  // Choisir un enfant connu : son ecole et son heure de sortie remplissent l'adresse et les heures (modifiables)
  const choisirEnfant = (v) => {
    const e = enfants.find((x) => x.famille + "|" + x.enfant === v);
    if (ponctuel) {
      setF((x) => ({ ...x, enfant: v, ...remplir(v, x.sens) }));
      return;
    }
    setF((x) => ({
      ...x,
      enfant: v,
      lieu: e && e.ecole ? e.ecole : x.lieu,
      debut: x.debut || (e && e.sortie ? decaler(e.sortie, -15) : ""),
      fin: x.fin || (e && e.sortie ? decaler(e.sortie, 15) : ""),
    }));
  };

  const heuresOk = f.debut && f.fin && f.fin > f.debut;
  const quiOk =
    f.type === "ramassage"
      ? estNouvel
        ? nouvel.prenom.trim() && (nouvel.famille || nouvel.parent.trim())
        : !!choisi
      : f.quoi.trim();
  const adresseOk = (x) => !!(x && typeof x.lat === "number" && typeof x.lon === "number");
  const allerRetour = f.sens === "allerretour";
  const ponctuelOk = /^\d{2}:\d{2}$/.test(f.heure || "") && adresseOk(f.de) && adresseOk(f.a) && (!allerRetour || (/^\d{2}:\d{2}$/.test(f.heure2 || "") && f.heure2 > f.heure));
  const ok = !!f.type && (ponctuel ? ponctuelOk : heuresOk) && quiOk && !enCours;

  const valider = async () => {
    setMessage("");
    setEnCours(true);
    try {
      let tache;
      if (f.type === "ramassage") {
        let ref = choisi ? { famille: choisi.famille, enfant: choisi.enfant } : null;
        let prenom = choisi ? choisi.prenom : "";
        let lieu = f.lieu;
        if (estNouvel) {
          if (!rep.charge) throw new Error("repertoire");
          const res = ajouterEnfantDepuisTache(rep.familles, { ...nouvel, famille: nouvel.famille || null });
          if (!res) throw new Error("fiche");
          await enregistrerRepertoire(rep.lieux, rep.corrections, res.familles);
          ref = res.ref;
          prenom = nouvel.prenom.trim();
          lieu = lieu || nouvel.ecole;
        }
        if (ponctuel) {
          const fam = ref ? ref.famille : "";
          const quoi = String(f.quoi || "").trim().slice(0, 30);
          // 15 nov. 2026 : « je le depose puis je reviens le chercher » (anniversaire...) = deux trajets enregistres ensemble ;
          // « je reste sur place » : pas de retour a la maison entre les deux, le creneau reste bloque
          await journee.ajouterRamassage(
            date,
            allerRetour
              ? [
                  { sens: "deposer", heure: f.heure, de: f.de, a: f.a, nom: `${prenom} · ${quoi || "sortie"} (aller)`, famille: fam, reste: f.reste },
                  { sens: "recuperer", heure: f.heure2, de: f.a, a: adresseOk(f.retour) ? f.retour : f.de, nom: `${prenom} · ${quoi || "sortie"} (retour)`, famille: fam },
                ]
              : { sens: f.sens, heure: f.heure, de: f.de, a: f.a, nom: `${prenom} · ${quoi || (f.sens === "deposer" ? "aller" : "retour")}`, famille: fam }
          );
          onFin();
          setEnCours(false);
          return;
        }
        tache = { type: "ramassage", titre: "Ramassage · " + prenom, pour: prenom, age: estNouvel ? nouvel.age : choisi ? choisi.age : "enfant", enfant: ref, debut: f.debut, fin: f.fin, lieu };
      } else {
        const cpt = f.type === "course" && f.compte ? (journee.comptes || []).find((c) => c.id === f.compte) : null;
        tache = { type: f.type, titre: f.quoi, pour: cpt ? cpt.nom : f.pour, age: cpt ? "adulte" : f.age, enfant: null, debut: f.debut, fin: f.fin, lieu: f.lieu, compte: cpt ? cpt.id : "", livraison: f.type === "course" ? f.livraison || null : null, prise: f.type === "autre" || f.type === "transport" ? f.prise || null : null };
      }
      if (initial) await journee.modifierTache(date, initial.id, tache);
      else await journee.ajouterTache(date, tache);
      onFin();
    } catch (err) {
      setMessage(err && err.message === "repertoire" ? "Le Répertoire n'est pas encore chargé : patiente une seconde et réessaie." : "Enregistrement impossible. Vérifie la connexion.");
    }
    setEnCours(false);
  };

  return (
    <div className="ag-tache-form">
      <h4>{initial ? "Modifier la tâche" : `Nouvelle tâche · ${libelleJour(date)}`}</h4>
      {!initial && (
        <Dicter
          exemple="Ex. : docteur à 10 heures · ou : sortir le chien, 20 minutes, trouve-moi un créneau"
          comprendre={(t) => {
            const { date: dit, heure: dite } = comprendreDateHeure(t, date);
            const duree = dureeDite(t);
            const quoi = quoiDeTache(t);
            let heure = dite;
            let trouve = false;
            // 19 nov. 2026 (test C13) : pas d'heure mais une durée ou « trouve-moi un créneau » -> premier créneau libre
            if (!heure && (duree || demandeCreneau(t))) {
              const n = new Date();
              const depuis = date === aujourdhui ? n.getHours() * 60 + n.getMinutes() + 5 : 0;
              const debut = trouverCreneau(occupe, duree || 30, { depuis });
              if (debut == null) return { erreur: `Pas de créneau libre de ${duree || 30} minutes ce jour-là (entre 7h et 21h). Dis une heure, ou choisis un autre jour.` };
              heure = `${deuxChiffres(Math.floor(debut / 60))}:${deuxChiffres(debut % 60)}`;
              trouve = true;
            }
            if (!heure) return { erreur: "Dis l'heure (« docteur à 10 heures ») ou la durée (« 20 minutes, trouve-moi un créneau »)." };
            const fin = decaler(heure, duree || 60);
            const autreJour = dit && dit !== date && !trouve;
            return { heure, fin, quoi, maison: aLaMaison(t), autreJour: autreJour ? dit : "", resume: `${quoi || "Tâche"} · ${heure.replace(":", "h")} → ${fin.replace(":", "h")}${trouve ? " (premier créneau libre de ta journée)" : ""}${autreJour ? ` (attention : tu as dit le ${dit.split("-").reverse().join("/")}, ouvre ce jour-là dans le calendrier)` : ""}` };
          }}
          remplir={(r) => setF((x) => ({ ...x, type: x.type || "autre", quoi: x.quoi || r.quoi, debut: r.heure, fin: r.fin, ...(r.maison && journee && journee.domicile ? { lieu: journee.domicile } : {}) }))}
        />
      )}

      <fieldset className="champ">
        <legend>1. Quelle activité ?</legend>
        <div className="choix ag-types" role="radiogroup" aria-label="Type d'activité">
          {TYPES_TACHE.map((t) => (
            <button key={t.v} type="button" role="radio" aria-checked={f.type === t.v} className={f.type === t.v ? "actif" : ""} onClick={() => set("type", t.v)}>
              {t.icone} {t.l}
            </button>
          ))}
        </div>
        {f.type === "beaute" && <p className="tb-note">💡 Pour un rendez-vous de cliente avec prestation, prix et encaissement : menu ☰ → « Prendre un rendez-vous ». Ici, c'est seulement un créneau bloqué (ex. tes propres ongles).</p>}
      </fieldset>

      {f.type === "ramassage" && (
        <>
          <label className="ag-champ">2. Quel enfant ?
            <select value={f.enfant} onChange={(x) => (x.target.value === "nouveau" ? set("enfant", "nouveau") : choisirEnfant(x.target.value))}>
              <option value="">Choisir…</option>
              {enfants.map((e) => (
                <option key={e.famille + e.enfant} value={e.famille + "|" + e.enfant}>{e.prenom}{e.parent ? ` (${e.parent})` : ""}</option>
              ))}
              <option value="nouveau">+ Nouvel enfant (pas encore dans le Répertoire)</option>
            </select>
          </label>
          {estNouvel && (
            <div className="ag-nouvel-enfant">
              <p className="tb-note">Sa fiche se crée dans le Répertoire (« Familles et enfants »). Elle n'entre dans ta tournée de chaque semaine que si tu la choisis dans « Tournée scolaire ».</p>
              <label className="ag-champ">Prénom de l'enfant *
                <input type="text" maxLength={40} value={nouvel.prenom} onChange={(x) => setN("prenom", x.target.value)} />
              </label>
              <ChoixAge valeur={nouvel.age} changer={(v) => setN("age", v)} />
              <label className="ag-champ">Famille
                <select value={nouvel.famille} onChange={(x) => setN("famille", x.target.value)}>
                  <option value="">Nouvelle famille</option>
                  {rep.familles.map((fa) => (
                    <option key={fa.id} value={fa.id}>{fa.nom || "Sans nom"}</option>
                  ))}
                </select>
              </label>
              {!nouvel.famille && (
                <>
                  <label className="ag-champ">Nom du parent *
                    <input type="text" maxLength={60} value={nouvel.parent} onChange={(x) => setN("parent", x.target.value)} />
                  </label>
                  <label className="ag-champ">Téléphone du parent
                    <input type="tel" inputMode="tel" maxLength={20} value={nouvel.telephone} onChange={(x) => setN("telephone", x.target.value)} />
                  </label>
                  <label className="ag-champ">Autre parent (facultatif)
                    <input type="text" maxLength={60} value={nouvel.parent2} onChange={(x) => setN("parent2", x.target.value)} />
                  </label>
                  <label className="ag-champ">Téléphone de l'autre parent
                    <input type="tel" inputMode="tel" maxLength={20} value={nouvel.telephone2} onChange={(x) => setN("telephone2", x.target.value)} />
                  </label>
                </>
              )}
              <div className="ag-champ">École ou Gan
                <AddressField id={"tache-ecole-" + date} valeur={nouvel.ecole} position={false} onChange={(v) => { setN("ecole", v); setF((y) => ({ ...y, lieu: v, ...(y.sens === "deposer" ? { a: v } : { de: v }) })); }} />
              </div>
              <div className="ag-heures">
                <label className="ag-champ">Entre à <input type="time" value={nouvel.entree} onChange={(x) => { setN("entree", x.target.value); if (f.sens === "deposer") set("heure", x.target.value); }} /></label>
                <label className="ag-champ">Sort à <input type="time" value={nouvel.sortie} onChange={(x) => { setN("sortie", x.target.value); setF((y) => ({ ...y, ...(y.sens !== "deposer" ? { heure: x.target.value } : {}), debut: y.debut || decaler(x.target.value, -15), fin: y.fin || decaler(x.target.value, 15) })); }} /></label>
              </div>
            </div>
          )}
        </>
      )}

      {f.type && f.type !== "ramassage" && (
        <>
          <label className="ag-champ">2. {LIBELLE_QUOI[f.type]}
            <input type="text" maxLength={80} placeholder={PLACEHOLDER_QUOI[f.type]} value={f.quoi} onChange={(x) => set("quoi", x.target.value)} />
          </label>
          <label className="ag-champ">Pour qui ? (facultatif)
            <input type="text" maxLength={60} placeholder={f.type === "autre" ? "Moi, Shyrel…" : f.type === "transport" ? "Ma nièce, Maman…" : "Prénom de la cliente ou du client"} value={f.pour} onChange={(x) => set("pour", x.target.value)} />
          </label>
          <ChoixAge valeur={f.age} changer={(v) => set("age", v)} />
          {f.type === "course" && (journee.comptes || []).length > 0 && (
            <label className="ag-champ">Pour un compte entre nous ? (prix noté à la fin)
              <select value={f.compte || ""} onChange={(x) => set("compte", x.target.value)}>
                <option value="">Non</option>
                {journee.comptes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
          )}
        </>
      )}

      {ponctuel && (f.enfant || estNouvel) && (
        <>
          <fieldset className="champ">
            <legend>3. Je dois</legend>
            <div className="choix" role="radiogroup" aria-label="Récupérer ou déposer">
              {[["recuperer", "Le récupérer"], ["deposer", "Le déposer"], ["allerretour", "Le déposer puis le récupérer"]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={f.sens === v} className={f.sens === v ? "actif" : ""} onClick={() => setF((x) => {
                  const versEcole = v !== "recuperer";
                  const avant = x.sens !== "recuperer";
                  if (estNouvel) return { ...x, sens: v, heure: versEcole ? nouvel.entree : nouvel.sortie, ...(versEcole === avant ? {} : { de: x.a, a: x.de }) };
                  return { ...x, sens: v, ...remplir(x.enfant, versEcole ? "deposer" : "recuperer") };
                })}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="ag-champ">Pour quoi ? (facultatif)
            <input type="text" maxLength={30} placeholder="Anniversaire, basket, docteur…" value={f.quoi} onChange={(x) => set("quoi", x.target.value)} />
          </label>
          <label className="ag-champ">{f.sens === "recuperer" ? "Heure de sortie (je le récupère à)" : "Arriver au plus tard à"}
            <input type="time" value={f.heure} onChange={(x) => set("heure", x.target.value)} />
          </label>
          <div className="ag-champ">Où je le prends
            <ChoixLieu id={"cl-" + "rp-de-" + date} connues={connues} valeur={f.de} choisir={(v) => set("de", v)} />
            <AddressField id={"rp-de-" + date} valeur={f.de} position={false} onChange={(v) => set("de", v)} />
          </div>
          <div className="ag-champ">Où je le dépose
            <ChoixLieu id={"cl-" + "rp-a-" + date} connues={connues} valeur={f.a} choisir={(v) => set("a", v)} />
            <AddressField id={"rp-a-" + date} valeur={f.a} position={false} onChange={(v) => set("a", v)} />
          </div>
          {allerRetour && (
            <>
              <label className="ag-champ">Je reviens le chercher à
                <input type="time" value={f.heure2} onChange={(x) => set("heure2", x.target.value)} />
              </label>
              {f.heure2 && f.heure && f.heure2 <= f.heure && <p className="fm-erreur">L'heure où je le récupère doit être après l'heure où je le dépose.</p>}
              <div className="ag-champ">Où je le ramène (vide = là où je l'ai pris)
                <ChoixLieu id={"cl-" + "rp-r-" + date} connues={connues} valeur={f.retour} choisir={(v) => set("retour", v)} />
            <AddressField id={"rp-r-" + date} valeur={f.retour} position={false} onChange={(v) => set("retour", v)} />
              </div>
              <fieldset className="champ">
                <legend>Pendant ce temps</legend>
                <div className="choix" role="radiogroup" aria-label="Je reste ou je pars">
                  {[[false, "Je pars (je suis libre)"], [true, "Je reste sur place (créneau bloqué)"]].map(([v, l]) => (
                    <button key={l} type="button" role="radio" aria-checked={f.reste === v} className={f.reste === v ? "actif" : ""} onClick={() => set("reste", v)}>{l}</button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <p className="tb-note">Il se place tout seul au bon endroit de ta journée, avec le temps de route, pour aujourd'hui seulement. Le site bloque ce moment comme tes autres trajets. Ensuite, si l'enfant est déjà ici, ses trajets suivants partent d'ici (pas de la maison).</p>
        </>
      )}

      {f.type && !ponctuel && (
        <>
          <div className="ag-heures">
            <label className="ag-champ">{f.type === "transport" ? "Je la prends à" : "De"} <input type="time" value={f.debut} onChange={(x) => set("debut", x.target.value)} /></label>
            <label className="ag-champ">{f.type === "transport" ? "De retour vers" : "À"} <input type="time" value={f.fin} onChange={(x) => set("fin", x.target.value)} /></label>
          </div>
          {f.type === "transport" && !estNouvel && (
            // 25 nov. 2026, 21h55 : prendre quelqu'un (chez elle) et le déposer (aéroport, gare…)
            <>
              <div className="ag-champ">Où je la prends
                <ChoixLieu id={"cl-tr-de-" + date} connues={connues} valeur={f.prise || null} choisir={(v) => set("prise", v)} />
                <AddressField id={"tache-tr-de-" + date + (initial ? initial.id : "")} valeur={f.prise || null} position={false} onChange={(v) => set("prise", v)} />
              </div>
              <div className="ag-champ">Où je la dépose
                <ChoixLieu id={"cl-tr-a-" + date} connues={connues} valeur={f.lieu} choisir={(v) => set("lieu", v)} />
                <AddressField id={"tache-tr-a-" + date + (initial ? initial.id : "")} valeur={f.lieu} position={false} onChange={(v) => set("lieu", v)} />
                <button type="button" className="ag-modifier" onClick={() => setF((x) => ({ ...x, lieu: AEROPORT_BEN_GOURION, quoi: x.quoi || "Aéroport Ben Gourion" }))}>✈️ Aéroport Ben Gourion</button>
              </div>
              <p className="tb-note">Ton calendrier montre « Prendre » à l'heure choisie puis « Déposer » à l'arrivée estimée ; tout le créneau jusqu'à ton retour est bloqué. Pour une course payée par une cliente, passe plutôt par le Devis rapide (Aéroport).</p>
            </>
          )}
          {!estNouvel && f.type !== "transport" && (
            <div className="ag-champ">{f.type === "course" ? "Adresse de récupération (facultatif)" : "Adresse (facultatif : vide = à la maison)"}
              <AddressField id={"tache-" + date + (initial ? initial.id : "")} valeur={f.lieu} position onChange={(v) => set("lieu", v)} />
              {/* 19 nov. 2026, 15h05 : une tâche à la maison entre dans le trafic (rentrer, faire, repartir) */}
              {journee && journee.domicile && f.type !== "course" && <button type="button" className="ag-modifier" onClick={() => set("lieu", journee.domicile)}>🏠 À la maison</button>}
            </div>
          )}
          {f.type === "autre" && !estNouvel && (
            // 25 nov. 2026 (Rebecca : « je dois d'abord aller chercher Maman chez elle pour l'amener à la gare ») :
            <div className="ag-champ">D'abord passer prendre quelqu'un (facultatif)
              <AddressField id={"tache-prise-" + date + (initial ? initial.id : "")} valeur={f.prise || null} position={false} onChange={(v) => set("prise", v)} />
              {f.prise && <button type="button" className="ag-modifier" onClick={() => set("prise", null)}>✗ Pas de passage</button>}
            </div>
          )}
          {f.type === "course" && (
            <div className="ag-champ">Adresse de livraison (facultatif)
              <AddressField id={"tache-liv-" + date + (initial ? initial.id : "")} valeur={f.livraison || null} position={false} onChange={(v) => set("livraison", v)} />
            </div>
          )}
          {f.debut && f.fin && f.fin <= f.debut && <p className="fm-erreur">L'heure de fin doit être après l'heure de début.</p>}
          <p className="tb-note">Ce créneau est bloqué sur le site (les clientes voient seulement qu'il est indisponible).</p>
        </>
      )}
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={!ok} onClick={valider}>{enCours ? "Enregistrement…" : initial ? "Enregistrer les changements" : ponctuel ? "Ajouter à ma journée" : "Ajouter et bloquer le créneau"}</button>
        <button type="button" className="tb-bouton tb-clair" onClick={onFin}>Annuler</button>
      </div>
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </div>
  );
}

// « + Ajouter une tâche » : une course perso, un rendez-vous... qui bloque ce creneau
function AjoutTache({ date, journee, occupe = [], aujourdhui = "" }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) return <button type="button" className="tb-bouton tb-clair ag-ajout" onClick={() => setOuvert(true)}>+ Ajouter une tâche</button>;
  return <FormTache date={date} journee={journee} occupe={occupe} aujourdhui={aujourdhui} onFin={() => setOuvert(false)} />;
}

// Trajets retires ce jour-la, avec « Remettre », et « Remettre la journee normale »
function ChangementsDuJour({ date, journee }) {
  const retires = journee.retires(date);
  if (!retires.length && !journee.modifie(date)) return null;
  return (
    <div className="ag-changements">
      <p><strong>Modifié pour ce jour seulement</strong></p>
      {retires.map((r) => (
        <div key={r.id} className="ag-retire">
          <span>❌ {r.nom || "Trajet"} : pas aujourd'hui</span>
          <button type="button" className="fm-petit clair" onClick={() => journee.remettre(date, [r.id]).catch(() => {})}>Remettre</button>
        </div>
      ))}
      <button type="button" className="fm-petit clair" onClick={() => journee.normale(date).catch(() => {})}>Remettre la journée normale</button>
    </div>
  );
}

// 22 nov. 2026 : trafic et « Prochaine » : une tournee restaurant = une recuperation puis les livraisons dans l'ordre
const etapesAvecTournees = (courses, domicile) => {
  const { tournees, seules } = tourneesResto(courses);
  return [...etapesCourses(seules), ...tournees.flatMap((t) => etapesTournee(t, domicile))].sort((a, b) => a.min - b.min);
};

const enMinutes = (h) => {
  const m = /^(\d{1,2})[:h](\d{2})/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
};

// Une journee : fermetures (Chabbat, fetes...), puis UN SEUL FIL dans l'ordre des heures :
// ma tournee (etapes reelles), mes courses et rendez-vous, les missions confiees.
// fil = etapes de ma tournee (vide si pas de tournee) ; tourneeOk = la tournee remplace les « Creneau deja reserve »
function JourListe({ jour, creneaux, evenements, aujourdhui, titre, missions = [], pourTous = false, fil = [], tourneeOk = false, calcul = false, journee = null, valide = null, equipier = false, domicile = null }) {
  const rep = useRepertoire();
  // 22 nov. 2026 : commandes du meme restaurant pretes a 10 min pres = une seule tournee (une arrivee, une recuperation)
  const { tournees, seules } = tourneesResto(evenements);
  // Les creneaux personnels sont ceux de Rebecca (sa tournee) : jamais dans l'agenda d'un coequipier (12 nov. 2026)
  const fermetures = tourneeOk || equipier ? creneaux.filter((c) => c.type !== "personnel") : creneaux;
  const lignes = [
    ...fil.map((e, i) => ({ min: e.min, cle: "t" + i + e.heure + e.texte, rendu: <Etape e={e} date={jour} journee={journee} valide={valide} familles={rep.familles || []} suivante={e.sorte === "prise" ? fil.slice(i + 1).find((x) => x.genre === "arret" && x.sorte === "depose" && x.adresse) || null : null} />, etape: true })),
    ...seules.map((d) => ({ min: enMinutes(d.heure), cle: "d" + d.id + (d.estRetour ? "-r" : ""), rendu: <Evenement d={d} aujourdhui={aujourdhui} admin={pourTous} journee={journee} /> })),
    ...tournees.map((t) => ({ min: enMinutes(t[0].heure), cle: "tr" + t[0].id, rendu: <TourneeResto tournee={t} domicile={domicile} aujourdhui={aujourdhui} seule={(d) => <Evenement d={d} aujourdhui={aujourdhui} admin={pourTous} journee={journee} />} /> })),
    ...missions.map((m) => ({ min: enMinutes(m.debut), cle: "m" + m.id, rendu: <Mission m={m} pourTous={pourTous} journee={journee} /> })),
  ].sort((a, b) => a.min - b.min);
  // 19 nov. 2026 : ce qui occupe deja la journee (en minutes), pour « trouve-moi un créneau » dans la dictée
  const occupe = [
    ...fil.map((e) => (e.genre === "tache" ? { debut: e.min, fin: enMinutes(e.jusqua) } : { debut: e.min - 10, fin: e.min + 10 })),
    ...evenements.map((d) => {
      const ets = etapesCourses([d]);
      const debut = enMinutes(d.heure);
      return ets.length ? { debut: ets[0].min, fin: ets[ets.length - 1].min } : { debut, fin: debut + 45 };
    }),
    ...missions.map((m) => ({ debut: enMinutes(m.debut), fin: enMinutes(m.fin) })),
    ...fermetures.flatMap((c) => (c.type !== "chabbat_fete" ? [] : [
      ...(c.commence && c.entree ? [{ debut: enMinutes(c.entree.heure) - 60, fin: 24 * 60 }] : []),
      ...(c.finit && c.sortie ? [{ debut: 0, fin: enMinutes(c.sortie.heure) + 60 }] : []),
    ])),
  ].filter((o) => o.debut < 24 * 60);
  // Les etapes qui se suivent sont regroupees dans une meme liste ; une course coupe la liste
  const blocs = [];
  for (const l of lignes) {
    const dernier = blocs[blocs.length - 1];
    if (l.etape && dernier && dernier.etapes) dernier.items.push(l);
    else blocs.push(l.etape ? { etapes: true, cle: l.cle, items: [l] } : l);
  }
  return (
    <div className={"ag-jour" + (jour === aujourdhui ? " aujourdhui" : "")}>
      {titre && <h3>{libelleJour(jour)}</h3>}
      <EtiquettesJour jour={jour} />
      {vacancesDuJour(jour) && <p className="ag-vacances">🏖️ Pas d'école : ta tournée est levée{etiquettesDuJour(jour).fete ? ", et c'est fête : fermé" : ""}</p>}
      {fermetures.map((c, i) => (
        <Fermeture key={i} c={c} />
      ))}
      {calcul && <p className="tb-note">Calcul de ta tournée en cours…</p>}
      {journee && <ChangementsDuJour date={jour} journee={journee} />}
      {blocs.map((b) =>
        b.etapes ? (
          <ol key={b.cle} className="ag-fil">
            {b.items.map((l) => <Fragment key={l.cle}>{l.rendu}</Fragment>)}
          </ol>
        ) : (
          <Fragment key={b.cle}>{b.rendu}</Fragment>
        )
      )}
      {fermetures.length === 0 && lignes.length === 0 && !calcul && <p className="ag-libre">Libre</p>}
      {journee && <AjoutTache date={jour} journee={journee} occupe={occupe} aujourdhui={aujourdhui} />}
    </div>
  );
}

// Indisponibilites d'un coequipier (J4b) : ses fermetures a lui, publiques sans motif
function MesIndispos({ moi, aujourdhui }) {
  const [liste, setListe] = useState([]);
  const [erreur, setErreur] = useState("");
  useEffect(
    () =>
      onSnapshot(
        doc(db, "disposEquipe", moi),
        (s) => setListe(((s.exists() && s.data().indispos) || []).filter(indispoValide)),
        () => setErreur("Lecture impossible pour l'instant (les règles de l'équipe seront publiées à l'étape J5).")
      ),
    [moi]
  );
  const maintenant = aujourdhui + "T00:00";
  const aVenir = liste.filter((b) => b.fin >= maintenant).sort((a, b) => a.debut.localeCompare(b.debut));
  const retirer = async (b) => {
    try {
      await setDoc(doc(db, "disposEquipe", moi), { indispos: arrayRemove(b), majLe: serverTimestamp() }, { merge: true });
    } catch {
      setErreur("Suppression impossible. Vérifie la connexion.");
    }
  };
  return (
    <>
      <div className="tb-bloc">
        <h3>Mes indisponibilités</h3>
        <p className="tb-note">Quand tu n'es pas disponible (Wolt, rendez-vous, repos). Sur le site, un horaire reste ouvert aux clients tant que l'un de nous est libre. Chabbat et fêtes sont fermés pour tous.</p>
        {erreur && <p className="fm-erreur" role="alert">{erreur}</p>}
        {aVenir.length === 0 && <p className="tb-note">Aucune indisponibilité à venir.</p>}
        {aVenir.map((b) => {
          const [d1, h1] = b.debut.split("T");
          const [d2, h2] = b.fin.split("T");
          return (
            <div key={b.debut + b.fin} className="fm-item">
              <div><small>du {jourFr(d1)} {h1} au {jourFr(d2)} {h2}</small></div>
              <button className="fm-petit clair" onClick={() => retirer(b)}>Supprimer</button>
            </div>
          );
        })}
      </div>
      <div className="tb-bloc">
        <h3>Ajouter une indisponibilité</h3>
        <AjoutFermeture aujourdhui={aujourdhui} pourMembre={moi} />
      </div>
    </>
  );
}

export default function Agenda() {
  const aujourdhui = utcVersLocal(Date.now()).date;
  const { moi, membres } = useEquipeContexte();
  const enEquipe = (membres || []).length > 1;
  const [personne, setPersonne] = useState("tous");
  const [tousItems, setItems] = useState(null);
  // J3 : filtre « Moi / Rebecca / Jeremy / Tous »
  // 12 nov. 2026 : un coequipier ne voit que SES courses dans son agenda (chacun son agenda)
  const items = tousItems && filtrerPersonne(tousItems, moi !== ADMIN_ID ? "moi" : personne, moi);
  // 25 nov. 2026 (Rebecca : « Jeremy a mon agenda et mes trajets ») : en regardant un coequipier, pas de tournee perso de Rebecca
  const voirMaTournee = moi === ADMIN_ID && (personne === "tous" || personne === "moi" || personne === ADMIN_ID);
  const [erreur, setErreur] = useState("");
  // 12 nov. 2026 : le Calendrier s'ouvre sur la journee d'aujourd'hui (vue Jour)
  const [vue, setVue] = useState("jour");
  const [ref, setRef] = useState(aujourdhui);
  const [fermetures, setFermetures] = useState([]); // fermetures enregistrees par Rebecca
  const [creneaux, setCreneaux] = useState(CRENEAUX_PAR_DEFAUT); // creneaux fixes (actifs ou libres)
  // Missions confiees (ramassage scolaire) : Rebecca voit toutes, un coequipier seulement les siennes
  const [missions, setMissions] = useState([]);
  // Ma journee reelle (tournee scolaire) a la place des « Creneau deja reserve » : Rebecca seulement
  const maJournee = useMaJournee(moi === ADMIN_ID);
  const tourneeOk = maJournee.etat === "ok";
  const calcul = maJournee.etat === "calcul";
  useEffect(() => {
    const q = moi === ADMIN_ID ? collection(db, "missionsEquipe") : query(collection(db, "missionsEquipe"), where("membre", "==", moi));
    return onSnapshot(q, (snap) => setMissions(snap.docs.map((x) => ({ id: x.id, ...x.data() }))), () => setMissions([]));
  }, [moi]);
  const missionsParDate = useMemo(() => {
    const m = {};
    for (const x of missions) if (typeof x.date === "string" && typeof x.debut === "string") (m[x.date] = m[x.date] || []).push(x);
    return m;
  }, [missions]);

  // Creneaux fixes : en direct, et appliques au calendrier du site
  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "creneaux"),
        (snap) => {
          const liste = (snap.exists() && lireCreneaux(snap.data().json)) || CRENEAUX_PAR_DEFAUT;
          appliquerCreneaux(liste, true);
          setCreneaux(liste);
        },
        () => {}
      ),
    []
  );
  const changerCreneau = (index, nouveau) => {
    const liste = creneaux.map((c, i) => (i === index ? nouveau : c));
    return setDoc(doc(db, "reglages", "creneaux"), { json: JSON.stringify(liste), majLe: serverTimestamp() });
  };

  // Fermetures de Rebecca : en direct, et appliquees au calendrier du site
  useEffect(() => {
    const q = query(collection(db, "fermetures"), orderBy("debut"));
    return onSnapshot(
      q,
      (snap) => {
        const liste = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
        appliquerFermetures(liste, true);
        setFermetures(liste);
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    const q = refDemandes(orderBy("creeLe", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((x) => ({ id: x.id, ...x.data() }))),
      () => setErreur("Impossible de lire les demandes. Vérifiez la connexion.")
    );
  }, []);

  // Courses visibles, regroupees par date
  const parDate = useMemo(() => {
    const m = {};
    for (const d of items || []) {
      if (!STATUTS[d.statut] || !/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) continue;
      if (d.service === "digital") continue; // 17 nov. 2026 : un paiement de projet Digital n'est pas un rendez-vous
      (m[d.date] = m[d.date] || []).push(d);
      // Aller-retour : le retour un autre jour s'affiche aussi a sa date (16 nov. 2026)
      const r = retourAutreJour(d);
      if (r) (m[r.date] = m[r.date] || []).push(r);
      // 17 nov. 2026 : aller-retour le meme jour -> le retour a aussi sa ligne (ses boutons Récupérée / Déposée / Rentrée)
      const v = d.details || {};
      if (!r && v.typeTrajet === "ar" && v.dateRetour === d.date && /^\d{2}:\d{2}$/.test(v.heureRetour || "")) m[d.date].push({ ...d, heure: v.heureRetour, serviceTitre: `${d.serviceTitre || ""} (retour)`, estRetour: true });
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => String(a.heure).localeCompare(String(b.heure)));
    return m;
  }, [items]);

  // Plage de jours affichee
  const premier = vue === "jour" ? ref : vue === "semaine" ? debutSemaine(ref) : debutSemaine(debutMois(ref));
  const nbJours = vue === "jour" ? 1 : vue === "semaine" ? 7 : Math.ceil((jourSemaine(debutMois(ref)) + nbJoursDuMois(ref)) / 7) * 7;
  const periodes = useMemo(() => periodesFermees(premier, nbJours), [premier, nbJours, fermetures, creneaux]);
  const jours = useMemo(() => Array.from({ length: nbJours }, (_, i) => ajouterJours(premier, i)), [premier, nbJours]);
  const creneauxParJour = useMemo(() => {
    const m = {};
    for (const j of jours) m[j] = creneauxDuJour(periodes, j);
    return m;
  }, [jours, periodes]);

  const prochaines = useMemo(() => prochainesFermetures(aujourdhui, 4), [aujourdhui, fermetures]);
  const adecider = useMemo(() => joursADecider(aujourdhui, 60), [aujourdhui]);
  // Vacances scolaires des 90 prochains jours, et mes decisions
  const vacancesProches = useMemo(() => vacancesDuCalendrier().filter((v) => v.au >= aujourdhui && v.du <= ajouterJours(aujourdhui, 90)), [aujourdhui, creneaux]);
  const [decisions, setDecisions] = useState({});
  useEffect(() => onSnapshot(doc(db, "reglages", "vacancesDecisions"), (x) => {
    try {
      setDecisions(x.exists() ? JSON.parse(x.data().json || "{}") || {} : {});
    } catch {
      setDecisions({});
    }
  }, () => {}), []);
  const deciderVacances = (cle, choix) => setDoc(doc(db, "reglages", "vacancesDecisions"), { json: JSON.stringify({ ...decisions, [cle]: choix }), majLe: serverTimestamp() });
  const maintenant = `${aujourdhui}T00:00`;
  const aVenir = fermetures.filter((f) => typeof f.fin === "string" && f.fin >= maintenant && !f.holHamoed && !f.vacances); // vacances : gerees dans « Vacances scolaires : a decider »
  const holFermes = {};
  for (const f of fermetures) if (f.holHamoed) holFermes[f.holHamoed] = f;

  // 19 nov. 2026, 15h42 : étapes du trafic (tournée + courses, avec « fait ») ; dehors -> le trafic part de ma position
  const filTrafic = ref === aujourdhui && tourneeOk ? [...maJournee.fil(ref).map((e) => ({ ...e, cle: cleEtape(e) || undefined, fait: !!maJournee.faitA(ref, e) })), ...etapesAvecTournees(parDate[ref] || [], maJournee.domicile)] : [];
  const ici = useIci();
  const ouAujourdhui = useOu();
  const dehorsIci = ouAujourdhui === "dehors" ? arrondir(ici) : null;

  const pas = (sens) => {
    if (vue === "jour") setRef(ajouterJours(ref, sens));
    else if (vue === "semaine") setRef(ajouterJours(ref, 7 * sens));
    else setRef(decalerMois(ref, sens));
  };
  const titre =
    vue === "jour" ? libelleJour(ref) : vue === "semaine" ? `${libelleJour(premier, true)} – ${libelleJour(ajouterJours(premier, 6), true)}` : titreMois(ref);

  if (erreur) return <p className="admin-erreur tb-pad" role="alert">{erreur}</p>;
  if (items === null) return <p className="admin-texte tb-pad">Chargement de l'agenda…</p>;

  return (
    <section className="ag">
      <FiltrePersonne valeur={personne} changer={setPersonne} />
      <div className="tb-filtres" role="tablist" aria-label="Type de vue">
        {[["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]].map(([id, nom]) => (
          <button key={id} role="tab" aria-selected={vue === id} className={"tb-filtre" + (vue === id ? " actif" : "")} onClick={() => {
              // Toucher Jour, Semaine ou Mois revient toujours a aujourd'hui ; les fleches changent ensuite de jour
              setVue(id);
              setRef(aujourdhui);
            }}>
            {nom}
          </button>
        ))}
      </div>

      <div className="ag-nav">
        <button className="ag-fleche" onClick={() => pas(-1)} aria-label="Précédent">‹</button>
        <button className="ag-titre" onClick={() => setRef(aujourdhui)} title="Revenir à aujourd'hui">
          <strong>{titre}</strong>
          <small>{ref === aujourdhui ? "Aujourd'hui" : "↩ Revenir à aujourd'hui"}</small>
        </button>
        <button className="ag-fleche" onClick={() => pas(1)} aria-label="Suivant">›</button>
      </div>

      {moi === ADMIN_ID && <ListeAttenteAdmin />}
      {vue === "jour" && tourneeOk && ref === aujourdhui && voirMaTournee && <MaPositionBloc jour={ref} fil={filTrafic} domicile={maJournee.domicile} journee={maJournee} courses={parDate[ref] || []} />}
      {vue === "jour" && tourneeOk && ref === aujourdhui && voirMaTournee && <TraficDuMatin jour={ref} fil={filTrafic} domicile={maJournee.domicile} ici={dehorsIci} aLaMaison={ouAujourdhui === "maison"} />}
      {vue === "jour" && voirMaTournee && <AgendaIphone jour={ref} />}
      {vue === "jour" && <JourListe domicile={maJournee.domicile} equipier={moi !== ADMIN_ID} fil={voirMaTournee ? maJournee.fil(ref) : []} journee={voirMaTournee && tourneeOk && ref >= aujourdhui ? maJournee : null} valide={voirMaTournee && tourneeOk && ref <= aujourdhui && ref >= ajouterJours(aujourdhui, -1) ? maJournee : null} tourneeOk={tourneeOk} calcul={calcul} jour={ref} creneaux={creneauxParJour[ref] || []} evenements={parDate[ref] || []} missions={missionsParDate[ref] || []} pourTous={moi === ADMIN_ID} aujourdhui={aujourdhui} />}

      {vue === "semaine" && jours.map((j) => <JourListe key={j} titre domicile={maJournee.domicile} equipier={moi !== ADMIN_ID} fil={voirMaTournee ? maJournee.fil(j) : []} journee={voirMaTournee && tourneeOk && j >= aujourdhui ? maJournee : null} tourneeOk={tourneeOk} calcul={calcul} jour={j} creneaux={creneauxParJour[j] || []} evenements={parDate[j] || []} missions={missionsParDate[j] || []} pourTous={moi === ADMIN_ID} aujourdhui={aujourdhui} />)}

      {vue === "mois" && (
        <>
          <div className="ag-grille">
            {NOMS_JOURS.map((n) => (
              <span key={n} className="ag-entete">{n}</span>
            ))}
            {jours.map((j) => {
              const etat = etatJour(creneauxParJour[j] || []);
              const dansMois = j.slice(0, 7) === ref.slice(0, 7);
              const nb = (parDate[j] || []).length;
              return (
                <button
                  key={j}
                  className={"ag-case " + etat + (dansMois ? "" : " hors") + (j === aujourdhui ? " aujourdhui" : "")}
                  onClick={() => {
                    setRef(j);
                    setVue("jour");
                  }}
                  aria-label={libelleJour(j)}
                >
                  <span>{Number(j.slice(8))}</span>
                  {nb > 0 && <em>{nb}</em>}
                </button>
              );
            })}
          </div>
          <p className="ag-legende">
            <span className="ferme">Fermé</span> <span className="partiel">Fermé en partie</span> <em>1</em> = courses prévues. Touchez un jour pour le détail.
          </p>
        </>
      )}

      <div className="tb-bloc">
        <h3>Prochaines périodes sans service</h3>
        {prochaines.map((f) => (
          <p key={f.debutUtc}>
            <strong>{f.label}</strong>
            <br />
            <small>du {jourFr(f.debut.date)} {f.debut.heure} au {jourFr(f.fin.date)} {f.fin.heure}</small>
          </p>
        ))}
      </div>

      {moi !== ADMIN_ID ? (
        <MesIndispos moi={moi} aujourdhui={aujourdhui} />
      ) : (
      <>
      {adecider.length > 0 && (
        <div className="tb-bloc">
          <h3>Hol Hamoed : à décider</h3>
          <p className="tb-note">Ces jours restent ouverts tant que tu ne les fermes pas.</p>
          {adecider.map((x) => (
            <LigneHolHamoed key={x.date} x={x} fermeture={holFermes[x.date]} />
          ))}
        </div>
      )}

      {moi === ADMIN_ID && vacancesProches.length > 0 && (
        <div className="tb-bloc">
          <h3>Vacances scolaires : à décider</h3>
          <p className="tb-note">Pendant les vacances, pas de tournée et ta fille est avec toi. Ouverte : les clientes réservent comme d'habitude. Fermée : personne ne réserve. Fermée l'après-midi : réservable seulement le matin.</p>
          {vacancesProches.map((v) => (
            <LigneVacances key={v.du} v={v} decision={decisions[v.du]} fermetures={fermetures.filter((f) => f.vacances === v.du)} onDecision={(choix) => deciderVacances(v.du, choix)} />
          ))}
        </div>
      )}

      <div className="tb-bloc">
        <h3>Mes créneaux fixes</h3>
        <p className="tb-note">Ces horaires reviennent chaque semaine et bloquent {enEquipe ? "ton planning (l'équipe reste réservable pour les services qui lui sont cochés)" : "les clients"}. Touche « Me libérer » quand tu es disponible (par exemple si ta copine a une voiture).</p>
        {creneaux.map((c, i) => (
          <LigneCreneau key={i + c.debut + c.fin + c.jours.join("") + c.actif} c={c} onChanger={(nouveau) => changerCreneau(i, nouveau)} />
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Mes fermetures</h3>
        <p className="tb-note">Vacances, jour de repos, rendez-vous : les clients ne peuvent plus réserver sur ces horaires.{enEquipe ? " « Seulement moi » : l'équipe reste réservable pendant ce temps." : ""}</p>
        {aVenir.length === 0 && <p className="tb-note">Aucune fermeture à venir.</p>}
        {aVenir.map((f) => (
          <LigneFermeture key={f.id} f={f} />
        ))}
      </div>

      <div className="tb-bloc">
        <h3>Ajouter une fermeture</h3>
        <AjoutFermeture aujourdhui={aujourdhui} enEquipe={enEquipe} />
      </div>
      </>
      )}
    </section>
  );
}
