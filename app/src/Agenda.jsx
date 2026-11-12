import { FiltrePersonne, Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import { filtrerPersonne } from "./pricing/quiFait.js";
import { ADMIN_ID } from "./pricing/equipe.js";
import { indispoValide } from "./fermetures.js";
import { Fragment, useEffect, useMemo, useState } from "react";
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { appliquerCreneaux, appliquerFermetures, CRENEAUX_PAR_DEFAUT, creneauValide, lireCreneaux } from "./fermetures.js";
import "./agenda.css";
import { lienAppel, lienWhatsApp, lienWazePoint } from "./pricing/navigation.js";
import { useMaJournee } from "./maJournee.js";
import AddressField from "./components/AddressField.jsx";
import { ajouterJours, vacancesDuJour, vacancesDuCalendrier, joursADecider, localVersUtc, periodesFermees, prochainesFermetures, utcVersLocal } from "./pricing/calendrier.js";

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
    res.push({ label: p.label, type: p.type, texte, minutes, debutUtc: p.debutUtc });
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
  return (
    <div className={"ag-ferme-ligne" + (c.type === "personnel" ? " perso" : "")}>
      <strong>{c.label}</strong>
      <span>{c.texte}</span>
    </div>
  );
}

function Evenement({ d }) {
  const [ouvert, setOuvert] = useState(false);
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
          <small>{d.nom} · {textePrix(d)}</small>
        </span>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </button>
      {ouvert && (
        <div className="ag-detail">
          <p>{d.telephone} · Paiement prévu : {d.moyenPaiement}</p>
          {adresses.map((a, i) => (
            <p key={i} dir="auto" className="ag-adresse">{a.label}</p>
          ))}
          <div className="tb-actions">
            {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
          </div>
          <p className="tb-note">Pour accepter, refuser ou changer le prix : onglet Demandes.</p>
        </div>
      )}
    </div>
  );
}

// Mission confiee (trajets de la tournee scolaire donnes a un coequipier pour ce jour-la)
function Mission({ m, pourTous }) {
  return (
    <div className="ag-mission">
      <p><strong>🎒 {m.debut.replace(":", "h")} → {m.fin.replace(":", "h")} · Ramassage scolaire{pourTous && m.nomMembre ? ` (${m.nomMembre})` : ""}</strong></p>
      <ul>
        {(m.etapes || []).map((e, i) => (
          <li key={i}>{e.heure} · {e.texte} <small>{e.lieu}</small></li>
        ))}
      </ul>
    </div>
  );
}

// Une etape de ma journee (tournee scolaire ou tache) : heure, quoi faire, ou, Waze, et « Modifier »
// Modifier = CE JOUR SEULEMENT : changer l'heure ou retirer le trajet ; la tournee de chaque semaine ne bouge pas.
function Etape({ e, date, journee }) {
  const [ouvert, setOuvert] = useState(false);
  const [heure, setHeure] = useState("");
  const [message, setMessage] = useState("");
  if (e.genre === "libre" || e.genre === "pause") {
    return (
      <li className={"ag-etape " + e.genre}>
        <b>{e.heure}</b>
        <span>{e.texte}{e.jusqua ? ` jusqu'à ${e.jusqua}` : e.minutes != null ? ` (${e.minutes} min)` : ""}</span>
      </li>
    );
  }
  const modifiable = journee && (e.genre === "arret" || e.genre === "tache");
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
    <li className={"ag-etape " + e.genre + (e.coince ? " coince" : "")}>
      <div className="ag-etape-ligne">
        <b>{e.heure}</b>
        <span>
          {e.genre === "arret" ? "🎒 " : e.genre === "maison" ? "🏠 " : e.genre === "tache" ? "📌 " : "🚗 "}
          {e.texte}
          {e.genre === "tache" && e.jusqua ? ` (jusqu'à ${e.jusqua})` : ""}
          {e.lieu && <small> · {e.lieu}{e.marge ? ` · ${e.marge}` : ""}</small>}
          {e.genre === "arret" && journee && journee.heureChangee(date, e.ids) && <small className="ag-etape-modif"> · heure changée ce jour</small>}
          {e.alerte && <small className="ag-etape-alerte">{e.alerte}</small>}
        </span>
        {e.adresse && <a className="ag-waze" href={lienWazePoint(e.adresse)} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${e.lieu || "l'adresse"} dans Waze`}>Waze</a>}
        {modifiable && <button type="button" className="ag-modifier" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>{ouvert ? "Fermer" : "Modifier"}</button>}
      </div>
      {ouvert && e.genre === "arret" && (
        <div className="ag-etape-actions">
          <p className="tb-note">Ce jour seulement : ta tournée des autres semaines ne change pas.</p>
          <label className="ag-champ">
            {e.type === "matin" ? "Arriver au plus tard à" : "Nouvelle heure de sortie"}
            <input type="time" value={heure} onChange={(x) => setHeure(x.target.value)} />
          </label>
          <div className="tb-actions">
            <button type="button" className="tb-bouton" disabled={!heure} onClick={() => faire(() => journee.changerHeure(date, e.ids, heure))}>Changer l'heure aujourd'hui</button>
            {journee.heureChangee(date, e.ids) && <button type="button" className="tb-bouton tb-clair" onClick={() => faire(() => journee.remettre(date, e.ids))}>Remettre l'heure habituelle</button>}
            <button type="button" className="tb-bouton ag-danger" onClick={() => faire(() => journee.retirer(date, e.ids))}>Supprimer ce trajet aujourd'hui</button>
          </div>
          {message && <p className="fm-erreur" role="alert">{message}</p>}
        </div>
      )}
      {ouvert && e.genre === "tache" && (
        <div className="ag-etape-actions">
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
function FormTache({ date, journee, initial = null, onFin }) {
  const [f, setF] = useState(initial ? { titre: initial.titre, debut: initial.debut, fin: initial.fin, lieu: initial.lieu || null } : { titre: "", debut: "", fin: "", lieu: null });
  const [message, setMessage] = useState("");
  const ok = f.titre.trim() && f.debut && f.fin && f.fin > f.debut;
  const valider = async () => {
    setMessage("");
    try {
      if (initial) await journee.modifierTache(date, initial.id, f);
      else await journee.ajouterTache(date, f);
      onFin();
    } catch {
      setMessage("Enregistrement impossible. Vérifie la connexion.");
    }
  };
  return (
    <div className="ag-tache-form">
      <h4>{initial ? "Modifier la tâche" : `Nouvelle tâche · ${libelleJour(date)}`}</h4>
      <label className="ag-champ">Quoi
        <input type="text" maxLength={80} placeholder="Docteur, courses Carrefour…" value={f.titre} onChange={(x) => setF({ ...f, titre: x.target.value })} />
      </label>
      <div className="ag-heures">
        <label className="ag-champ">De <input type="time" value={f.debut} onChange={(x) => setF({ ...f, debut: x.target.value })} /></label>
        <label className="ag-champ">À <input type="time" value={f.fin} onChange={(x) => setF({ ...f, fin: x.target.value })} /></label>
      </div>
      <div className="ag-champ">Adresse (facultatif)
        <AddressField id={"tache-" + date + (initial ? initial.id : "")} valeur={f.lieu} position={false} onChange={(v) => setF({ ...f, lieu: v })} />
      </div>
      {f.debut && f.fin && f.fin <= f.debut && <p className="fm-erreur">L'heure de fin doit être après l'heure de début.</p>}
      <p className="tb-note">Ce créneau est bloqué sur le site (les clientes voient seulement qu'il est indisponible).</p>
      <div className="tb-actions">
        <button type="button" className="tb-bouton" disabled={!ok} onClick={valider}>{initial ? "Enregistrer les changements" : "Ajouter et bloquer le créneau"}</button>
        <button type="button" className="tb-bouton tb-clair" onClick={onFin}>Annuler</button>
      </div>
      {message && <p className="fm-erreur" role="alert">{message}</p>}
    </div>
  );
}

// « + Ajouter une tâche » : une course perso, un rendez-vous... qui bloque ce creneau
function AjoutTache({ date, journee }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) return <button type="button" className="tb-bouton tb-clair ag-ajout" onClick={() => setOuvert(true)}>+ Ajouter une tâche</button>;
  return <FormTache date={date} journee={journee} onFin={() => setOuvert(false)} />;
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

const enMinutes = (h) => {
  const m = /^(\d{1,2})[:h](\d{2})/.exec(String(h || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
};

// Une journee : fermetures (Chabbat, fetes...), puis UN SEUL FIL dans l'ordre des heures :
// ma tournee (etapes reelles), mes courses et rendez-vous, les missions confiees.
// fil = etapes de ma tournee (vide si pas de tournee) ; tourneeOk = la tournee remplace les « Creneau deja reserve »
function JourListe({ jour, creneaux, evenements, aujourdhui, titre, missions = [], pourTous = false, fil = [], tourneeOk = false, calcul = false, journee = null }) {
  const fermetures = tourneeOk ? creneaux.filter((c) => c.type !== "personnel") : creneaux;
  const lignes = [
    ...fil.map((e, i) => ({ min: e.min, cle: "t" + i + e.heure + e.texte, rendu: <Etape e={e} date={jour} journee={journee} />, etape: true })),
    ...evenements.map((d) => ({ min: enMinutes(d.heure), cle: "d" + d.id, rendu: <Evenement d={d} /> })),
    ...missions.map((m) => ({ min: enMinutes(m.debut), cle: "m" + m.id, rendu: <Mission m={m} pourTous={pourTous} /> })),
  ].sort((a, b) => a.min - b.min);
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
      {vacancesDuJour(jour) && <p className="ag-vacances">🏖️ {vacancesDuJour(jour)} : pas d'école, ta tournée est levée</p>}
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
      {journee && <AjoutTache date={jour} journee={journee} />}
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
  const items = tousItems && filtrerPersonne(tousItems, personne, moi);
  const [erreur, setErreur] = useState("");
  const [vue, setVue] = useState("semaine");
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
    const q = query(collection(db, "demandes"), orderBy("creeLe", "desc"));
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
      (m[d.date] = m[d.date] || []).push(d);
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
          <button key={id} role="tab" aria-selected={vue === id} className={"tb-filtre" + (vue === id ? " actif" : "")} onClick={() => setVue(id)}>
            {nom}
          </button>
        ))}
      </div>

      <div className="ag-nav">
        <button className="ag-fleche" onClick={() => pas(-1)} aria-label="Précédent">‹</button>
        <button className="ag-titre" onClick={() => setRef(aujourdhui)} title="Revenir à aujourd'hui">
          <strong>{titre}</strong>
          <small>Aujourd'hui</small>
        </button>
        <button className="ag-fleche" onClick={() => pas(1)} aria-label="Suivant">›</button>
      </div>

      {vue === "jour" && <JourListe fil={maJournee.fil(ref)} journee={tourneeOk && ref >= aujourdhui ? maJournee : null} tourneeOk={tourneeOk} calcul={calcul} jour={ref} creneaux={creneauxParJour[ref] || []} evenements={parDate[ref] || []} missions={missionsParDate[ref] || []} pourTous={moi === ADMIN_ID} aujourdhui={aujourdhui} />}

      {vue === "semaine" && jours.map((j) => <JourListe key={j} titre fil={maJournee.fil(j)} journee={tourneeOk && j >= aujourdhui ? maJournee : null} tourneeOk={tourneeOk} calcul={calcul} jour={j} creneaux={creneauxParJour[j] || []} evenements={parDate[j] || []} missions={missionsParDate[j] || []} pourTous={moi === ADMIN_ID} aujourdhui={aujourdhui} />)}

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
