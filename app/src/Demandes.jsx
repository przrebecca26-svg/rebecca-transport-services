import RentabiliteDetail from "./components/RentabiliteDetail.jsx";
import { useEffect, useMemo, useState } from "react";
import { texteDuree } from "./pricing/circulation.js";
import InfoVol from "./components/InfoVol.jsx";
import InsertionJournee from "./components/InsertionJournee.jsx";
import NettoyageTests from "./components/NettoyageTests.jsx";
import ProposerCoursier from "./components/ProposerCoursier.jsx";
import RecuCourse from "./components/RecuCourse.jsx";
import { champsOffrir, etatFidelite, messageFidelite } from "./pricing/fidelite.js";
import { supprimerCourseComplete } from "./suppression.js";
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { ModifierDevis } from "./SimulateurDevis.jsx";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { lienAppel, lienWaze, lienWhatsApp } from "./pricing/navigation.js";
import { calculerTrajet } from "./routing.js";
import { SERVICES } from "./services.js";
import { cleClient } from "./pricing/clients.js";
import { MARGE_DEFAUT, clePaire, datesDe, messageAutreHoraire, phrase, trajetsACalculer, verifier, versHeure, voisins } from "./pricing/enchainement.js";
import { rattraperTousLesSuivis, synchroniserSuivi } from "./suiviClient.js";
import PaiementsCourse from "./PaiementsCourse.jsx";
import AjoutManuel, { Remerciement } from "./AjoutManuel.jsx";
import { argentDansListe, etatDansListe, versRefaire } from "./pricing/finCourse.js";
import { CADEAU_PARRAINAGE, cadeauAOffrir } from "./pricing/suiteClient.js";
import { LIBELLE_ORIGINE, prenomDe } from "./pricing/ajoutManuel.js";
import { messageDevisDemande } from "./pricing/devisRapide.js";
import QuiFait from "./components/QuiFait.jsx";
import { FiltrePersonne, Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import { attribueA, coursesDeLaPersonne, filtrerPersonne } from "./pricing/quiFait.js";
import { servicesDuMembre } from "./pricing/espaceEquipe.js";
import { regroupementsPossibles, prixRegroupe, passagersDe } from "./pricing/regroupement.js";
import { estLivraisonResto } from "./pricing/restos.js";
import "./demandes.css";

// Liste et traitement des demandes (espace prive de Rebecca) - Lot B, seance B3 :
// ouverture directe depuis « Aujourd'hui » ou une fiche client, filtre par activite, lien vers la fiche client,
// suivi client mis a jour a chaque changement, supplement (retard, attente...), verification d'enchainement.
// B7 : « + Ajouter une course » (course hors du site, faite ou a faire), origine du client, pourboire, remerciement.

const STATUTS = {
  "en attente": { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  refusee: { label: "Refusée", classe: "refusee" },
  terminee: { label: "Terminée", classe: "terminee" },
  annulee: { label: "Annulée", classe: "annulee" },
};

const ACTIVITES = [
  { id: "toutes", label: "Toutes activités" },
  { id: "coursier", label: "Services coursier" },
  { id: "transport", label: "Transport privé" },
];
const ACTIVITE_DE = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));

const ORDRE_ADRESSES = ["depart", "recuperation", "domicile", "adresse", "arretH1", "arretH2", "arretH3", "arretL2", "arretL3", "arretL4", "arretL5", "arrivee", "livraison", "ecole"];
const NOMS_ADRESSES = { depart: "Départ", recuperation: "Récupération", domicile: "Domicile", adresse: "Adresse", arrivee: "Arrivée", livraison: "Livraison", ecole: "École" };

const nomAdresse = (cle) => {
  if (NOMS_ADRESSES[cle]) return NOMS_ADRESSES[cle];
  const h = /^arretH(\d)$/.exec(cle);
  if (h) return "Arrêt " + h[1];
  const l = /^arretL(\d)$/.exec(cle);
  if (l) return "Livraison " + l[1];
  return cle;
};

const jour = (d, long) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });
};

const recueLe = (d) => {
  const t = d.creeLe && d.creeLe.toDate ? d.creeLe.toDate() : null;
  return t ? t.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "à l'instant";
};

const prixActuel = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : d.prixEstime);
const textePrix = (d) => {
  const p = prixActuel(d);
  if (typeof p === "number") return p + " ₪";
  return d.surDevis ? "Sur devis" : "À fixer";
};
const lireMontant = (s) => {
  const t = String(s == null ? "" : s).trim().replace(",", ".");
  const n = Number(t);
  return t !== "" && isFinite(n) ? Math.round(n * 100) / 100 : null;
};

function messageClient(d) {
  const quand = `${jour(d.date, true)} à ${d.heure}`;
  const p = prixActuel(d);
  const prix = typeof p === "number" ? ` Prix convenu : ${p} ₪.` : "";
  if (d.statut === "acceptee") return `Bonjour ${d.nom}, votre réservation (${d.serviceTitre}) est confirmée pour ${quand}.${prix} À bientôt, Rebecca.`;
  if (d.statut === "refusee") return `Bonjour ${d.nom}, merci pour votre demande (${d.serviceTitre}, ${quand}). Malheureusement je ne suis pas disponible à ce moment-là. Souhaitez-vous proposer un autre horaire ? Rebecca.`;
  return `Bonjour ${d.nom}, j'ai bien reçu votre demande (${d.serviceTitre}, ${quand}). Je vérifie mes disponibilités et je reviens vers vous très vite. Rebecca.`;
}

function adressesDe(d) {
  const det = d.details || {};
  const cles = Object.keys(det).filter((k) => det[k] && typeof det[k] === "object" && det[k].label);
  const rang = (k) => (ORDRE_ADRESSES.includes(k) ? ORDRE_ADRESSES.indexOf(k) : 99);
  return cles.sort((a, b) => rang(a) - rang(b)).map((k) => ({ cle: k, nom: nomAdresse(k), ...det[k] }));
}

// Duree d'un trajet avec OSRM, abandonnee apres 8 secondes (meme position = 0 min)
async function minutesTrajet(de, vers) {
  if (de.lat === vers.lat && de.lon === vers.lon) return 0;
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 8000);
  try {
    return (await calculerTrajet(de, vers, ctrl.signal)).minutes;
  } finally {
    clearTimeout(minuteur);
  }
}

// Aller-retour (16 nov. 2026) : voir, ajouter ou modifier le retour d'une course (aeroport, transport).
// Le retour s'affiche dans l'agenda a sa date, meme si c'est un autre jour que l'aller.
function BlocRetour({ d, executer, enCours }) {
  const det = d.details || {};
  const ar = det.typeTrajet === "ar";
  const [ouvert, setOuvert] = useState(false);
  const [date, setDate] = useState(det.dateRetour || d.date || "");
  const [heure, setHeure] = useState(det.heureRetour || "");
  // Aeroport (17 nov. 2026) : le vol du retour, pour le suivre le jour J (terminal, retard, ville)
  const aeroport = d.service === "aeroport";
  const [vol, setVol] = useState(det.numeroVolRetour || "");
  const [heureVol, setHeureVol] = useState(det.heureVolRetour || "");
  const [ville, setVille] = useState(det.villeVolRetour || "");
  const [msg, setMsg] = useState("");
  const enregistrer = async (avecRetour) => {
    setMsg("");
    const details = { ...det };
    if (avecRetour) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heure)) {
        setMsg("Indique la date et l'heure du retour.");
        return;
      }
      if (d.date && date < d.date) {
        setMsg("Le retour ne peut pas être avant l'aller.");
        return;
      }
      Object.assign(details, { typeTrajet: "ar", dateRetour: date, heureRetour: heure });
      if (aeroport) {
        for (const [cle, valeur] of [["numeroVolRetour", vol.trim().slice(0, 20)], ["heureVolRetour", /^\d{2}:\d{2}$/.test(heureVol) ? heureVol : ""], ["villeVolRetour", ville.trim().slice(0, 60)]]) {
          if (valeur) details[cle] = valeur;
          else delete details[cle];
        }
      }
    } else {
      details.typeTrajet = "simple";
      for (const cle of ["dateRetour", "heureRetour", "numeroVolRetour", "heureVolRetour", "villeVolRetour"]) delete details[cle];
    }
    if (await executer({ details })) setOuvert(false);
  };
  return (
    <div className="tb-bloc">
      <h3>Retour</h3>
      {ar && !ouvert && `${det.dateRetour || ""} ${det.heureRetour || ""}` < `${d.date || ""} ${d.heure || ""}` && <p className="admin-erreur" role="alert">⚠️ Le retour est avant l'aller : touche « Modifier le retour » pour le corriger.</p>}
      {ar && !ouvert && <p>Aller-retour · retour le <strong>{jour(det.dateRetour, true)} à {det.heureRetour}</strong>{aeroport ? (det.numeroVolRetour ? ` · vol ${String(det.numeroVolRetour).toUpperCase()}${det.villeVolRetour ? ` (${det.villeVolRetour})` : ""}` : " · numéro de vol du retour à ajouter") : ""}</p>}
      {!ar && !ouvert && <p className="tb-note">Aller simple.</p>}
      {!ouvert ? (
        <button className="tb-retour aj-lien" onClick={() => setOuvert(true)}>{ar ? "Modifier le retour" : "+ Ajouter le retour (aller-retour)"}</button>
      ) : (
        <>
          <div className="tb-prix">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date du retour" />
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} aria-label="Heure du retour" />
          </div>
          {aeroport && (
            <>
              <label className="pm-champ">
                Numéro de vol du retour
                <input value={vol} maxLength={20} placeholder="ex. LY002" onChange={(e) => setVol(e.target.value)} />
              </label>
              <label className="pm-champ">
                {det.direction === "depuis" ? "Heure du vol du retour" : "Heure d'atterrissage du retour"} (facultatif)
                <input type="time" value={heureVol} onChange={(e) => setHeureVol(e.target.value)} />
              </label>
              <label className="pm-champ">
                Ville (facultatif : sinon elle vient toute seule du vol)
                <input value={ville} maxLength={60} placeholder="ex. Paris" onChange={(e) => setVille(e.target.value)} />
              </label>
            </>
          )}
          <div className="tb-actions">
            <button className="tb-bouton" disabled={enCours} onClick={() => enregistrer(true)}>Enregistrer le retour</button>
            {ar && <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => enregistrer(false)}>Supprimer le retour</button>}
            <button className="tb-bouton tb-clair" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
          {msg && <p className="tb-note">{msg}</p>}
          <p className="tb-note">Le prix ne change pas tout seul : s'il faut, modifie-le dans « Prix ».</p>
        </>
      )}
    </div>
  );
}

// Resultat de la verification d'enchainement
function Verification({ verif, d, enCours, onForcer, onFermer }) {
  if (!verif) return null;
  if (verif.etat === "calcul") return <p className="dm-verif dm-calcul">Je vérifie que ta journée s'enchaîne…</p>;
  const { res, marge } = verif;
  const estimees = [...new Set(res.details.flatMap((x) => [x.premier, x.second]).filter((b) => b.estimee).map((b) => b.titre))];
  if (verif.etat === "ok") {
    return (
      <div className="dm-verif dm-ok" role="status">
        <p><strong>Course acceptée.</strong> {res.details.length === 0 ? "Aucune autre course acceptée ce jour-là." : "Ta journée s'enchaîne bien :"}</p>
        {res.details.map((x, i) => (
          <p key={i} className="tb-note">
            {x.sens === "avant" ? "Avant" : "Après"} : {Math.max(0, Math.round(x.libre))} min libres entre {versHeure(x.premier.fin)} et {versHeure(x.second.debut)}
            {x.trajetInconnu ? " (trajet inconnu : vérifie toi-même)" : ` (trajet ${x.trajet} min + marge ${marge} min)`}
          </p>
        ))}
        {estimees.length > 0 && <p className="tb-note">Durée estimée à 45 min pour : {estimees.join(", ")}.</p>}
        <button className="tb-retour aj-lien" onClick={onFermer}>Fermer</button>
      </div>
    );
  }
  const whatsapp = lienWhatsApp(d.telephone, messageAutreHoraire(d));
  return (
    <div className="dm-verif dm-alerte" role="alert" ref={(el) => el && el.scrollIntoView({ behavior: "smooth", block: "center" })}>
      <p><strong>Attention à l'enchaînement</strong></p>
      {res.problemes.map((x, i) => (
        <p key={i}>{x.date !== d.date ? `Le ${jour(x.date)} (retour) : ` : ""}{phrase(x)}</p>
      ))}
      {estimees.length > 0 && <p className="tb-note">Durée estimée à 45 min pour : {estimees.join(", ")}.</p>}
      <p className="tb-note">Calcul sans circulation en temps réel.</p>
      <div className="tb-actions">
        <button className="tb-bouton" disabled={enCours} onClick={onForcer}>Accepter quand même</button>
        {whatsapp && <a className="tb-bouton tb-clair" href={whatsapp} target="_blank" rel="noopener noreferrer">Proposer un autre horaire</a>}
        <button className="tb-bouton tb-clair" onClick={onFermer}>Annuler</button>
      </div>
    </div>
  );
}

// Demande de ramassage du site : son devis peut avoir ete modifie depuis (lien des familles, 15 nov. 2026)
function PartageEnDirect({ id, creeLe }) {
  const [p, setP] = useState(null);
  useEffect(() => onSnapshot(doc(db, "trajetsPartages", id), (s) => setP(s.exists() ? s.data() : null), () => setP(null)), [id]);
  if (!p) return null;
  const maj = p.majLe && p.majLe.toMillis ? p.majLe.toMillis() : 0;
  const envoi = creeLe && creeLe.toMillis ? creeLe.toMillis() : 0;
  const modifiee = maj && envoi && maj - envoi > 60000;
  const quand = modifiee ? new Date(maj).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "";
  return (
    <p className={"tb-note" + (modifiee ? " rp-alerte" : "")}>
      {modifiee ? `✏️ Devis modifié le ${quand} (lien de la cliente ou des familles). Le prix affiché ici est celui de l'envoi : le devis à jour est dans « Ramassage scolaire ».` : "Devis modifiable par la cliente avec son lien."}{" "}
      {p.familles.map((f, i) => `${f.nom || `Famille ${i + 1}`} : ${f.enfants.length} enfant${f.enfants.length > 1 ? "s" : ""}`).join(" · ")}
    </p>
  );
}

// Transport / aeroport (15 nov. 2026) : une autre demande le meme jour, a 10 min d'ecart, departs et arrivees proches
// -> Rebecca peut faire UN trajet partage ; prix conseille et part de chacune
function Regroupement({ d, toutes, aller }) {
  const [info, setInfo] = useState("");
  const lie = d.regroupeAvec ? toutes.find((x) => x.id === d.regroupeAvec) : null;
  const possibles = regroupementsPossibles(d, toutes).filter((x) => !d.regroupeAvec || x.d.id === d.regroupeAvec);
  if (!lie && possibles.length === 0) return null;
  const regrouper = async (autre) => {
    try {
      await updateDoc(doc(db, "demandes", d.id), { regroupeAvec: autre.id, majLe: serverTimestamp() });
      await updateDoc(doc(db, "demandes", autre.id), { regroupeAvec: d.id, majLe: serverTimestamp() });
      setInfo("Regroupées : un seul trajet. Mets le prix conseillé de chacune dans « Prix » (ici et dans l'autre demande), puis préviens-les.");
    } catch {
      setInfo("Regroupement impossible pour l'instant. Réessaie.");
    }
  };
  const separer = async () => {
    try {
      await updateDoc(doc(db, "demandes", d.id), { regroupeAvec: null, majLe: serverTimestamp() });
      if (lie) await updateDoc(doc(db, "demandes", lie.id), { regroupeAvec: null, majLe: serverTimestamp() });
      setInfo("Séparées : deux trajets.");
    } catch {
      setInfo("Impossible pour l'instant. Réessaie.");
    }
  };
  const ligne = (x, ecart, depart) => {
    const p = prixRegroupe(d, x);
    return (
      <div key={x.id} className="tb-adresse">
        <div>
          <p><strong>{x.nom}</strong> · {x.heure}{typeof ecart === "number" ? ` (${ecart} min d'écart)` : ""} · {passagersDe(x)} passager{passagersDe(x) > 1 ? "s" : ""}{typeof depart === "number" ? ` · départs à ${depart} km` : ""}</p>
          {p ? <small>Trajet commun conseillé : {p.total} ₪ au lieu de {p.separes} ₪ ({p.passagers} passagers{p.arret ? `, +${p.arret} ₪ d'arrêt` : ""}) · {d.nom} : {p.parts[0].montant} ₪ · {x.nom} : {p.parts[1].montant} ₪</small> : <small>Prix conseillé : il manque le prix d'une des deux demandes.</small>}
        </div>
        <div className="tb-actions">
          <button className="tb-bouton tb-clair" onClick={() => aller("demandes", x.id)}>Ouvrir</button>
          {d.regroupeAvec === x.id ? <button className="tb-bouton tb-clair" onClick={separer}>Séparer</button> : <button className="tb-bouton" onClick={() => regrouper(x)}>Regrouper</button>}
        </div>
      </div>
    );
  };
  return (
    <div className="tb-bloc">
      <h3>{lie ? "Trajet regroupé" : "Regrouper avec une autre demande"}</h3>
      {lie ? ligne(lie) : possibles.map((x) => ligne(x.d, x.ecart, x.departKm))}
      {!lie && <p className="tb-note">Même jour, 10 min d'écart au plus, départs et arrivées proches : tu peux faire un seul trajet partagé.</p>}
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

// 17 nov. 2026 : parrainage — course terminee d'une amie venue avec un lien -> credit offert a la marraine
// 18 nov. 2026 (suggestion validée) : la 10e course est offerte
function Fidelite({ d, toutes, admin }) {
  const [info, setInfo] = useState("");
  const f = etatFidelite(d, toutes || []);
  if (!f) return null;
  const offrir = async () => {
    try {
      await updateDoc(doc(db, "demandes", d.id), { ...champsOffrir(d), ajustementLe: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), majLe: serverTimestamp() });
      setInfo("Course offerte ✓ (le prix est déduit : rien à encaisser).");
    } catch {
      setInfo("Impossible pour l'instant.");
    }
  };
  if (!f.offerte) return <p className="tb-note">🎁 Fidélité : {f.rang}{f.rang === 1 ? "re" : "e"} course de ce client · encore {f.encore} avant sa course offerte.</p>;
  const lien = lienWhatsApp(d.telephone, messageFidelite(prenomDe(d.nom)));
  return (
    <div className="tb-bloc">
      <h3>🎁 {f.rang}e course : offerte !</h3>
      {f.deja ? <p className="tb-note">Déjà offerte ✓</p> : admin ? <button className="tb-bouton" onClick={offrir}>Offrir cette course</button> : <p className="tb-note">Rebecca peut l'offrir depuis son espace.</p>}
      {lien && <a className="tb-bouton tb-clair" href={lien} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6 }}>Le dire au client sur WhatsApp</a>}
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

function CadeauParrainage({ d }) {
  const [marraine, setMarraine] = useState(null);
  const [info, setInfo] = useState("");
  const parrain = d.details && d.details.parrain;
  useEffect(() => {
    if (!parrain) return;
    getDoc(doc(db, "clients", parrain)).then((x) => setMarraine(x.exists() ? x.data() : {})).catch(() => setMarraine({}));
  }, [parrain]);
  if (!parrain) return null;
  const nom = marraine ? [marraine.prenom, marraine.nom].filter(Boolean).join(" ") || "sa marraine" : "…";
  const offrir = async () => {
    try {
      await addDoc(collection(db, "creditMouvements"), { uid: parrain, kind: "parrainage", montant: CADEAU_PARRAINAGE, resId: d.id, creeLe: serverTimestamp() });
      await updateDoc(doc(db, "demandes", d.id), { parrainageOffertLe: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }), majLe: serverTimestamp() });
      setInfo(`${CADEAU_PARRAINAGE} ₪ de crédit offerts à ${nom}.`);
    } catch {
      setInfo("Impossible d'offrir le crédit. Vérifie la connexion.");
    }
  };
  return (
    <div className="tb-bloc">
      <h3>🎁 Parrainage</h3>
      <p className="tb-note">Venue grâce au lien de {nom}.{d.parrainageOffertLe ? ` Crédit offert le ${d.parrainageOffertLe.split("-").reverse().join("/")}.` : ""}</p>
      {cadeauAOffrir(d) && <button className="tb-bouton" onClick={offrir}>Offrir {CADEAU_PARRAINAGE} ₪ de crédit à {nom}</button>}
      {!cadeauAOffrir(d) && !d.parrainageOffertLe && <p className="tb-note">Le cadeau se donne quand la course est terminée.</p>}
      {info && <p className="tb-note" role="status">{info}</p>}
    </div>
  );
}

function Detail({ d, toutes, marge, aller, onFermer }) {
  const { moi } = useEquipeContexte();
  const [prix, setPrix] = useState(typeof prixActuel(d) === "number" ? String(prixActuel(d)) : "");
  const [supp, setSupp] = useState({ ouvert: false, montant: "", motif: "Retard du client" });
  const [verif, setVerif] = useState(null);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [modif, setModif] = useState(false);
  const [refaire, setRefaire] = useState(false); // 17 nov. 2026 : « Refaire la même course »
  const resto = estLivraisonResto(d); // 19 nov. 2026 : livraison d'un restaurant partenaire (pas d'acompte, pas de fidélité)
  const ref = doc(db, "demandes", d.id);

  // Enregistre la demande, puis met a jour l'historique du client (si la demande vient d'un compte)
  const executer = async (champs) => {
    setErreur("");
    setAvertissement("");
    setEnCours(true);
    let ok = false;
    try {
      await updateDoc(ref, { ...champs, majLe: serverTimestamp() });
      ok = true;
      // 15 nov. 2026 : demande de ramassage du site -> son devis modifiable (lien des familles) suit le meme statut
      const partageId = d.details && d.details.partageId;
      const STATUT_PARTAGE = { refusee: "refusee", annulee: "annulee", acceptee: "acceptee", terminee: "acceptee", "en attente": "en cours" };
      if (partageId && champs.statut && STATUT_PARTAGE[champs.statut]) {
        await updateDoc(doc(db, "trajetsPartages", partageId), { statut: STATUT_PARTAGE[champs.statut], majLe: serverTimestamp() }).catch(() => {});
      }
      const suiviOk = await synchroniserSuivi({ ...d, ...champs });
      if (!suiviOk) setAvertissement("Enregistré, mais l'historique du client n'a pas pu être mis à jour. Utilise « Mettre à jour l'historique des clients » en bas de la liste.");
    } catch {
      setErreur("Enregistrement impossible. Vérifiez la connexion puis réessayez.");
    }
    setEnCours(false);
    return ok;
  };

  // J5 : a la fin de la course, on fige qui l'a faite (son chiffre d'affaires et son plafond)
  const changerStatut = (s) => executer({ statut: s, ...(s === "terminee" ? { realisePar: d.attribueA || "rebecca" } : {}) });
  // J3 : la personne qui accepte fait la course (sauf si elle est deja attribuee) ; modifiable ensuite
  const quiAccepte = d.attribueA || moi;
  // 19 nov. 2026 (test C2) : accepter sans toucher au prix = le prix estimé devient le prix convenu (la cliente
  // ne voit plus « estimation » dans son historique)
  const accepterChamps = () => executer({ statut: "acceptee", ...(d.attribueA ? {} : { attribueA: moi }), ...(typeof d.prixFinal !== "number" && !d.surDevis && typeof d.prixEstime === "number" ? { prixFinal: d.prixEstime } : {}) });

  // Accepter : on verifie d'abord l'enchainement avec les autres courses acceptees du meme jour
  const accepter = async () => {
    setVerif({ etat: "calcul" });
    try {
      // enchainement verifie sur l'agenda de la personne qui fera la course
      // une demande regroupee avec celle-ci = le meme trajet : pas un conflit d'agenda
      const liste = voisins(d, coursesDeLaPersonne(toutes, quiAccepte).filter((x) => x.statut === "acceptee" && x.id !== d.regroupeAvec), datesDe(d));
      const trajets = {};
      await Promise.all(
        trajetsACalculer(liste).map(async (p) => {
          const k = clePaire(p.de, p.vers);
          if (!k || k in trajets) return;
          trajets[k] = null;
          try {
            trajets[k] = await minutesTrajet(p.de, p.vers);
          } catch {
            trajets[k] = null;
          }
        })
      );
      for (const k of Object.keys(trajets)) if (trajets[k] == null) delete trajets[k];
      const res = verifier(liste, trajets, marge);
      if (!res.ok) {
        setVerif({ etat: "alerte", res, marge });
        return;
      }
      if (await accepterChamps()) setVerif({ etat: "ok", res, marge });
      else setVerif(null);
    } catch {
      setVerif(null);
      setErreur("La vérification de l'enchaînement a échoué. Réessaie, ou accepte en vérifiant ton agenda.");
    }
  };
  const forcer = async () => {
    if (await accepterChamps()) setVerif(null);
  };

  const enregistrerPrix = () => {
    const n = lireMontant(prix);
    if (n == null || n < 0 || n > 20000) {
      setErreur("Entrez un prix valide, en shekels.");
      return;
    }
    // 19 nov. 2026 (test C2) : même montant que l'estimation mais pas encore enregistré = on l'enregistre quand même
    if (n === prixActuel(d) && typeof d.prixFinal === "number") {
      setAvertissement("Ce prix est déjà enregistré.");
      return;
    }
    const ancien = typeof prixActuel(d) === "number" ? prixActuel(d) : null;
    executer({ prixFinal: n, historiquePrix: arrayUnion({ de: ancien, vers: n, leMs: Date.now() }) });
  };

  // Supplement : retard, attente, peage, arret en plus... ajoute au prix, avec un motif garde dans l'historique
  const ajouterSupplement = async () => {
    const n = lireMontant(supp.montant);
    const motif = supp.motif.trim().slice(0, 80);
    if (n == null || n <= 0 || n > 5000) {
      setErreur("Indique le montant du supplément, en shekels.");
      return;
    }
    if (motif.length < 3) {
      setErreur("Indique le motif du supplément.");
      return;
    }
    const ancien = typeof prixActuel(d) === "number" ? prixActuel(d) : 0;
    const nouveau = Math.round((ancien + n) * 100) / 100;
    if (await executer({ prixFinal: nouveau, historiquePrix: arrayUnion({ de: ancien, vers: nouveau, leMs: Date.now(), motif }) })) {
      setPrix(String(nouveau));
      setSupp({ ouvert: false, montant: "", motif: "Retard du client" });
    }
  };

  const st = STATUTS[d.statut] || { label: d.statut, classe: "attente" };
  const whatsapp = lienWhatsApp(d.telephone, messageClient(d));
  const appel = lienAppel(d.telephone);
  // Renvoyer le devis (16 nov. 2026) : quel que soit le statut, des qu'un prix existe
  const texteDevis = messageDevisDemande(d);
  const devis = texteDevis ? lienWhatsApp(d.telephone, texteDevis) : null;
  const historique = Array.isArray(d.historiquePrix) ? d.historiquePrix : [];
  const cle = cleClient(d);
  // Modifier le devis (16 nov. 2026) : tout le formulaire du devis, pre-rempli ; met la course a jour partout
  const modifiable = d.service !== "ramassage" && !(d.details && d.details.partageId) && d.statut !== "annulee";
  const enregistrerDevis = async (maj) => {
    const champs = { ...maj };
    const ancien = prixActuel(d);
    if (ancien !== maj.prixFinal) champs.historiquePrix = arrayUnion({ de: typeof ancien === "number" ? ancien : null, vers: maj.prixFinal, leMs: Date.now(), motif: "Devis modifié" });
    const ok = await executer(champs);
    if (ok) setPrix(String(maj.prixFinal));
    return ok;
  };
  // Supprimer la course (19 nov. 2026, Rebecca : « supprimer vite tout ce qui est faux ou test ») : avec ses paiements
  // et son suivi client. Confirmation dans la page (2 touches) : la fenetre du navigateur ne s'ouvre pas partout.
  const [confirmerSuppr, setConfirmerSuppr] = useState(false);
  const supprimer = async () => {
    setErreur("");
    if (!confirmerSuppr) return setConfirmerSuppr(true);
    try {
      await supprimerCourseComplete(d.id);
      onFermer();
    } catch {
      setErreur("Suppression impossible. Vérifie la connexion (et que les règles Firebase v28 sont collées).");
    }
  };

  if (refaire) {
    const r = versRefaire(d);
    return (
      <AjoutManuel
        mode="course"
        demandes={toutes}
        marge={marge}
        prerempli={r.prerempli}
        clientPrerempli={r.client}
        onFermer={() => setRefaire(false)}
        onOuvrirDemande={(id) => { setRefaire(false); aller("demandes", id); }}
        onOuvrirFiche={(cle) => aller("clients", cle)}
      />
    );
  }

  if (modif) {
    return (
      <section className="tb-detail">
        <ModifierDevis d={d} onEnregistrer={enregistrerDevis} onFermer={() => setModif(false)} enCours={enCours} aller={aller} />
        {avertissement && <p className="dm-verif dm-alerte" role="alert">{avertissement}</p>}
        {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      </section>
    );
  }

  return (
    <section className="tb-detail">
      <button className="tb-retour" onClick={onFermer}>← Toutes les demandes</button>
      <div className="tb-ligne">
        <h2>{d.serviceTitre}</h2>
        <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
      </div>
      <p className="tb-quand">{d.date ? `${jour(d.date, true)} à ${d.heure}` : d.service === "ramassage" && d.details && d.details.periode ? `Devis ${d.details.periode === "mois" ? "au mois" : d.details.periode === "semaine" ? "à la semaine" : "pour un jour"} (sans date de début)` : `à ${d.heure}`}</p>
      {d.source === "manuel" && <p className="tb-note">Ajoutée à la main{d.origine ? ` · origine : ${LIBELLE_ORIGINE[d.origine] || d.origine}` : ""}</p>}

      <InfoVol d={d} />
      {d.details && d.details.typeTrajet === "ar" && d.details.numeroVolRetour && <InfoVol d={{ ...d, date: d.details.dateRetour, heure: d.details.heureRetour, estRetour: true }} />}
      {moi === "rebecca" && !["nails", "hair", "slim", "regenx", "epoxy", "digital"].includes(d.service) && d.kmEstime != null && <RentabiliteDetail d={d} />}
      {moi === "rebecca" && <InsertionJournee d={d} />}

      {resto ? (
        <div className="tb-bloc">
          <h3>🍕 Restaurant partenaire</h3>
          <p><strong>{d.nom}</strong> · {d.telephone}</p>
          {d.details && d.details.destinataire && <p>Client du restaurant : {d.details.destinataire}{d.details.telDestinataire ? ` · ${d.details.telDestinataire}` : ""}</p>}
          <p className="tb-note">Payée avec le relevé de la semaine du restaurant ({d.moyenPaiement}, le dimanche) : pas d'acompte, pas de paiement à noter ici.</p>
          <div className="tb-actions">
            {whatsapp && <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp au restaurant</a>}
            {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler le restaurant</a>}
            {d.details && d.details.telDestinataire && <a className="tb-bouton tb-clair" href={lienAppel(d.details.telDestinataire)}>Appeler le client</a>}
            <button className="tb-bouton tb-clair" onClick={() => aller("repertoire")}>Fiche du restaurant</button>
            <button className="tb-bouton tb-clair" onClick={() => aller("commandes-resto")}>Commandes restaurants</button>
          </div>
        </div>
      ) : (
      <div className="tb-bloc">
        <h3>Client</h3>
        <p><strong>{d.nom}</strong>{d.uid ? " · avec compte" : ""}</p>
        <p>{d.telephone} · Paiement prévu : {d.moyenPaiement}</p>
        {d.passager && <p>Passager : {d.passager.nom} · {d.passager.telephone}</p>}
        <div className="tb-actions">
          {whatsapp ? <a className="tb-bouton" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <span className="tb-note">Numéro non reconnu pour WhatsApp</span>}
          {devis && <a className="tb-bouton tb-clair" href={devis} target="_blank" rel="noopener noreferrer">Renvoyer le devis</a>}
          {modifiable && <button className="tb-bouton tb-clair" onClick={() => setModif(true)}>Modifier le devis</button>}
          {d.service !== "ramassage" && <button className="tb-bouton tb-clair" onClick={() => setRefaire(true)}>🔁 Refaire la même course</button>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
          {cle && <button className="tb-bouton tb-clair" onClick={() => aller("clients", cle)}>Fiche client</button>}
        </div>
      </div>
      )}

      <div className="tb-bloc">
        <h3>Statut</h3>
        {d.details && d.details.partageId && <PartageEnDirect id={d.details.partageId} creeLe={d.creeLe} />}
        {d.details && d.details.partageId && d.statut === "en attente" && (
          <div className="tb-actions">
            <p className="tb-note">Trajet partagé entre plusieurs familles : accepte-le depuis « Ramassage scolaire » → « Trajets partagés » → « Ouvrir dans mon devis ». Tu vérifies ta tournée, et « La cliente accepte » crée une fiche par famille. « Accepter » ici ne valide que cette demande.</p>
            <button className="tb-bouton" onClick={() => aller("ramassage")}>Ouvrir dans Ramassage scolaire</button>
          </div>
        )}
        <div className="tb-actions">
          {d.statut === "en attente" && (
            <>
              <button className="tb-bouton" disabled={enCours || (verif && verif.etat === "calcul")} onClick={accepter}>Accepter</button>
              <button className="tb-bouton tb-danger" disabled={enCours} onClick={() => changerStatut("refusee")}>Refuser</button>
            </>
          )}
          {d.statut === "acceptee" && (
            <button className="tb-bouton" disabled={enCours} onClick={() => changerStatut("terminee")}>Course terminée</button>
          )}
          {d.statut !== "en attente" && d.statut !== "annulee" && (
            <button className="tb-bouton tb-clair" disabled={enCours} onClick={() => changerStatut("en attente")}>Remettre en attente</button>
          )}
        </div>
        <Verification verif={verif} d={d} enCours={enCours} onForcer={forcer} onFermer={() => setVerif(null)} />
        {!resto && <p className="tb-note">Après avoir accepté ou refusé, utilisez le bouton WhatsApp : le message est prêt.{d.uid ? " L'historique du client se met à jour tout seul." : ""}</p>}
        {d.statut === "acceptee" && !resto && <p className="tb-note">Pour annuler (client absent, annulation tardive : l'acompte est conservé), utilisez le bloc « Paiements » plus bas.</p>}
      </div>

      {(d.service === "aeroport" || d.service === "transport") && <BlocRetour d={d} executer={executer} enCours={enCours} />}

      <QuiFait d={d} toutes={toutes} marge={marge} executer={executer} enCours={enCours} />

      <div className="tb-bloc">
        <h3>Prix</h3>
        <p>{resto ? "Prix du contrat du restaurant" : d.source === "manuel" ? "Prix convenu" : `Estimation du site : ${typeof d.prixEstime === "number" ? d.prixEstime + " ₪" : d.surDevis ? "sur devis" : "aucune"}`}{typeof d.prixFinal === "number" && <> · <strong>{d.source === "manuel" ? "" : "Prix retenu : "}{d.prixFinal} ₪</strong></>}</p>
        {d.pourboire > 0 && <p className="tb-note">Pourboire{d.statut === "terminee" ? "" : " prévu"} : {d.pourboire} ₪ (à part, hors chiffre d'affaires)</p>}
        <div className="tb-prix">
          <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Prix en ₪" aria-label="Prix en shekels" />
          <button className="tb-bouton" disabled={enCours} onClick={enregistrerPrix}>Enregistrer le prix</button>
        </div>
        {d.statut !== "refusee" && d.statut !== "annulee" && (
          !supp.ouvert ? (
            <button className="tb-retour aj-lien" onClick={() => setSupp({ ...supp, ouvert: true })}>+ Ajouter un supplément (retard, attente, péage…)</button>
          ) : (
            <div className="dm-supp">
              <div className="dm-motifs">
                {["Retard du client", "Attente", "Arrêt en plus", "Péage / parking"].map((m) => (
                  <button key={m} className={"tb-filtre" + (supp.motif === m ? " actif" : "")} onClick={() => setSupp({ ...supp, motif: m })}>{m}</button>
                ))}
              </div>
              <input maxLength={80} value={supp.motif} onChange={(e) => setSupp({ ...supp, motif: e.target.value })} aria-label="Motif du supplément" placeholder="Motif" />
              <input inputMode="decimal" value={supp.montant} onChange={(e) => setSupp({ ...supp, montant: e.target.value })} aria-label="Montant du supplément" placeholder="Montant en ₪" />
              <div className="tb-actions">
                <button className="tb-bouton" disabled={enCours} onClick={ajouterSupplement}>Ajouter au prix</button>
                <button className="tb-bouton tb-clair" onClick={() => setSupp({ ...supp, ouvert: false })}>Annuler</button>
              </div>
              <p className="tb-note">Le supplément s'ajoute au prix retenu et reste noté dans l'historique du prix. Préviens le client avant (aucun supplément surprise).</p>
            </div>
          )
        )}
        {historique.length > 0 && (
          <ul className="tb-histo">
            {historique.map((h, i) => (
              <li key={i}>{h.de == null ? "—" : h.de + " ₪"} → {h.vers} ₪{h.motif ? ` · ${h.motif}` : ""} <small>({new Date(h.leMs).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })})</small></li>
            ))}
          </ul>
        )}
      </div>

      <Regroupement d={d} toutes={toutes} aller={aller} />

      {moi === "rebecca" && (d.statut === "acceptee" || d.coursierPartenaire) ? <ProposerCoursier d={d} /> : null}

      {!resto && <PaiementsCourse d={d} />}
      {!resto && (d.statut === "terminee" || d.statut === "acceptee") ? <div className="tb-pad"><RecuCourse d={d} /></div> : null}

      {!resto && <Fidelite d={d} toutes={toutes} admin={moi === "rebecca"} />}

      {!resto && <CadeauParrainage d={d} />}

      {d.statut === "terminee" && !d.uid && !resto && <Remerciement prenom={prenomDe(d.nom)} telephone={d.telephone} email="" />}

      <div className="tb-bloc">
        <h3>Itinéraires</h3>
        {adressesDe(d).length === 0 && <p className="tb-note">Aucune adresse enregistrée.</p>}
        {adressesDe(d).map((a) => (
          <div className="tb-adresse" key={a.cle}>
            <div>
              <small>{a.nom}</small>
              <p dir="auto">{a.label}</p>
            </div>
            <a className="tb-bouton tb-clair" href={lienWaze(typeof a.lat === "number" && typeof a.lon === "number" ? { lat: a.lat, lon: a.lon } : { adresse: a.label })} target="_blank" rel="noopener noreferrer">Waze</a>
          </div>
        ))}
        {typeof d.kmEstime === "number" && <p className="tb-note">Distance estimée : {Math.round(d.kmEstime * 10) / 10} km{typeof d.minutesEstimees === "number" ? ` · trajet ${texteDuree(d.minutesEstimees, d.date, d.heure)} en partant à ${d.heure}` : ""}</p>}
      </div>

      <div className="tb-bloc">
        <h3>Demande complète</h3>
        <pre className="tb-message" dir="auto">{d.message}</pre>
        <p className="tb-note">Reçue le {recueLe(d)}</p>
      </div>

      {moi === "rebecca" && (
        <div className="tb-bloc">
          <h3>Supprimer</h3>
          <p className="tb-note">Pour une course de test, en double ou que tu ne gardes pas : elle part avec ses paiements et disparaît partout (Finances, Bilan, Calendrier, fiche cliente).</p>
          <button className="tb-bouton tb-danger" disabled={enCours} onClick={supprimer}>{confirmerSuppr ? "Oui, supprimer la course et ses paiements" : "Supprimer la course"}</button>
          {confirmerSuppr && <button className="tb-bouton tb-clair" onClick={() => setConfirmerSuppr(false)}>Non</button>}
        </div>
      )}

      {avertissement && <p className="dm-verif dm-alerte" role="alert">{avertissement}</p>}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
    </section>
  );
}

export default function Demandes({ aller, cible, membre = null }) {
  const { moi } = useEquipeContexte();
  const [personne, setPersonne] = useState("tous");
  const [items, setItems] = useState(null); // null = chargement
  // 18 nov. 2026 : payé / reste à encaisser sur chaque carte de la liste (lecture refusée -> rien n'est affiché)
  const [mvts, setMvts] = useState(null);
  useEffect(() => onSnapshot(collection(db, "mouvements"), (x) => setMvts(x.docs.map((y) => ({ id: y.id, ...y.data() }))), () => setMvts(null)), []);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState("en attente");
  const [activite, setActivite] = useState("toutes");
  // cible « nouvelle » ou « nouvelle:cleClient » : ouvre directement l'ajout d'une course
  const nouvelle = typeof cible === "string" && cible.startsWith("nouvelle");
  const [ouvert, setOuvert] = useState(nouvelle ? null : cible || null);
  const [ajout, setAjout] = useState(nouvelle ? { cle: cible.split(":")[1] || null } : null);
  const [marge, setMarge] = useState(MARGE_DEFAUT);
  const [rattrapage, setRattrapage] = useState({ enCours: false, message: "" });

  useEffect(() => {
    const q = refDemandes(orderBy("creeLe", "desc"));
    return onSnapshot(
      q,
      (snap) => setItems(trierDemandes(snap.docs.map((x) => ({ id: x.id, ...x.data() })))),
      () => setErreur("Impossible de lire les demandes. Vérifiez la connexion et les règles Firebase.")
    );
  }, []);

  // Marge entre deux courses : reglage modifiable (onglet Reglages), 30 min par defaut
  useEffect(
    () =>
      onSnapshot(
        doc(db, "reglages", "enchainement"),
        (s) => {
          const m = s.exists() ? Number(s.data().margeMinutes) : NaN;
          setMarge(Number.isFinite(m) && m >= 0 && m <= 180 ? m : MARGE_DEFAUT);
        },
        () => setMarge(MARGE_DEFAUT)
      ),
    []
  );

  // Un coequipier ne voit que les services de ses activites (J2/J3) ; Rebecca voit tout
  const sesServices = membre ? servicesDuMembre(membre) : null;
  // 12 nov. 2026 (Rebecca) : « chacun son agenda » - un coequipier ne voit que SES courses, les nouvelles demandes
  // pas encore prises (pour pouvoir les accepter) et celles qu'on lui propose ; jamais les courses de Rebecca.
  const aLui = (d) => attribueA(d) === moi || d.proposeA === moi || (d.statut === "en attente" && !d.attribueA);
  // 20 nov. 2026 (Rebecca) : les livraisons des restaurants se gèrent dans « Commandes restaurants », pas ici
  // (elles restent dans le Calendrier et les Finances ; « Ouvrir la livraison » les ouvre toujours ici)
  const horsResto = (d) => !!membre || !(d.details && d.details.commandeResto);
  const dansActivite = (d) => horsResto(d) && (!sesServices || sesServices.includes(d.service)) && (activite === "toutes" || ACTIVITE_DE[d.service] === activite) && (membre ? aLui(d) : filtrerPersonne([d], personne, moi).length === 1);

  const compte = useMemo(() => {
    const c = { tout: 0 };
    for (const d of items || []) {
      if (!dansActivite(d)) continue;
      c.tout += 1;
      c[d.statut] = (c[d.statut] || 0) + 1;
    }
    return c;
  }, [items, activite, personne]); // eslint-disable-line react-hooks/exhaustive-deps

  const rattraper = async () => {
    setRattrapage({ enCours: true, message: "" });
    try {
      const n = await rattraperTousLesSuivis(items || []);
      setRattrapage({ enCours: false, message: n === 0 ? "Tout est déjà à jour." : `${n} historique${n > 1 ? "s" : ""} client mis à jour.` });
    } catch {
      setRattrapage({ enCours: false, message: "Mise à jour impossible. Vérifie la connexion puis réessaie." });
    }
  };

  if (erreur) return <p className="admin-erreur tb-pad" role="alert">{erreur}</p>;
  if (items === null) return <p className="admin-texte tb-pad">Chargement des demandes…</p>;

  if (ajout) {
    return (
      <AjoutManuel
        mode="course"
        demandes={items}
        marge={marge}
        cleInitiale={ajout.cle}
        onFermer={() => setAjout(null)}
        onOuvrirDemande={(id) => {
          setAjout(null);
          setOuvert(id);
        }}
        onOuvrirFiche={(cle) => aller("clients", cle)}
      />
    );
  }

  const courante = ouvert && items.find((d) => d.id === ouvert);
  if (courante) return <Detail key={courante.id} d={courante} toutes={items} marge={marge} aller={aller} onFermer={() => setOuvert(null)} />;

  const visibles = items.filter((d) => dansActivite(d) && (filtre === "tout" || d.statut === filtre));

  return (
    <section className="tb-liste">
      {ouvert && <p className="tb-note">Cette demande est introuvable.</p>}
      <button className="tb-bouton am-ajouter" onClick={() => setAjout({ cle: null })}>+ Ajouter une course</button>
      {!membre && (items || []).some((d) => d.details && d.details.commandeResto) && (
        <p className="tb-note">🍕 Les livraisons des restaurants sont dans <button type="button" className="rp-waze" onClick={() => aller("commandes-resto")}>Commandes restaurants</button></p>
      )}
      <div className="tb-filtres" role="tablist" aria-label="Filtrer par activité">
        {ACTIVITES.map((a) => (
          <button key={a.id} role="tab" aria-selected={activite === a.id} className={"tb-filtre dm-activite" + (activite === a.id ? " actif" : "")} onClick={() => setActivite(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <FiltrePersonne valeur={personne} changer={setPersonne} />
      <div className="tb-filtres" role="tablist" aria-label="Filtrer les demandes">
        {Object.entries(STATUTS).map(([id, s]) => (
          <button key={id} role="tab" aria-selected={filtre === id} className={"tb-filtre" + (filtre === id ? " actif" : "")} onClick={() => setFiltre(id)}>
            {s.label} <span>{compte[id] || 0}</span>
          </button>
        ))}
        <button role="tab" aria-selected={filtre === "tout"} className={"tb-filtre" + (filtre === "tout" ? " actif" : "")} onClick={() => setFiltre("tout")}>
          Toutes <span>{compte.tout}</span>
        </button>
      </div>

      {!membre && <NettoyageTests items={items} />}
      {visibles.length === 0 && <p className="admin-texte tb-pad">Aucune demande dans cette catégorie.</p>}

      {visibles.map((d) => {
        const st = etatDansListe(d) || STATUTS[d.statut] || { label: d.statut, classe: "attente" };
        const argent = mvts ? argentDansListe(d, mvts) : null;
        const enShekels = (n) => `${(Math.round(n * 100) / 100).toLocaleString("fr-FR")} ₪`;
        return (
          <button key={d.id} className="tb-carte" onClick={() => setOuvert(d.id)}>
            <span className="tb-ligne">
              <strong><Pastille d={d} /> {d.serviceTitre}</strong>
              <span className={"tb-badge tb-" + st.classe}>{st.label}</span>
            </span>
            <span className="tb-quand">{jour(d.date)} · {d.heure}{d.source === "manuel" ? " · ajoutée à la main" : ""}</span>
            <span className="tb-ligne">
              <span>{d.nom}</span>
              <strong>{textePrix(d)}</strong>
            </span>
            {argent && (
              <span className="tb-ligne dm-argent">
                <span>
                  {estLivraisonResto(d) ? `📋 ${enShekels(argent.du)} · avec le relevé du restaurant` : d.payeAuCoursier ? `Payé en espèces à ${argent.coursier || "le coursier"}` : argent.paye > 0 ? `Payé ${enShekels(argent.paye)}` : "Rien encaissé"}
                  {argent.pourboire > 0 ? ` · pourboire ${enShekels(argent.pourboire)}` : ""}
                </span>
                {estLivraisonResto(d) ? null : argent.solde ? <strong className="dm-solde">✓ Tout payé</strong> : argent.reste > 0 ? <strong className="dm-reste">Reste {enShekels(argent.reste)}</strong> : null}
              </span>
            )}
          </button>
        );
      })}

      <div className="dm-rattrapage">
        <button className="tb-bouton tb-clair" disabled={rattrapage.enCours} onClick={rattraper}>
          {rattrapage.enCours ? "Mise à jour…" : "Mettre à jour l'historique des clients"}
        </button>
        <p className="tb-note">{rattrapage.message || "Remet à jour ce que les clients voient dans leur historique (statut et prix), pour les anciennes demandes."}</p>
      </div>
    </section>
  );
}
