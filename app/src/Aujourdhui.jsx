import { Pastille, useEquipeContexte } from "./equipeContexte.jsx";
import { ADMIN_ID, attribueA } from "./pricing/equipe.js";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";
import { refDemandes, trierDemandes } from "./accesDemandes.js";
import { lienAppel, lienWaze, lienWhatsApp } from "./pricing/navigation.js";
import { ajouterJours } from "./pricing/calendrier.js";
import { situationCourse } from "./pricing/comptes.js";

// Onglet « Aujourd'hui » de l'espace prive : ce que Rebecca doit faire dans la journee.
// Lecture seule : rien n'est modifie ici. Un appui sur une ligne ouvre la demande.
// B7 : bouton « + Ajouter une course » ; une demande en attente dont la date est passee affiche « Date passée ».

const aujourdhui = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });

const jourLong = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const jourCourt = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "";
  const [a, m, j] = d.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j, 12)).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : null);
const shekels = (n) => Math.round(n).toLocaleString("fr-FR") + " ₪";
const textePrix = (d) => {
  const p = prixDe(d);
  if (p != null) return shekels(p);
  return d.surDevis ? "Sur devis" : "À fixer";
};

const recueIlYa = (d) => {
  const t = d.creeLe && d.creeLe.toDate ? d.creeLe.toDate().getTime() : null;
  if (!t) return "à l'instant";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? "s" : ""}`;
};

// Premiere adresse utile de la course (prise en charge), pour Waze
const ORDRE_DEPART = ["depart", "recuperation", "domicile", "adresse", "arrivee", "livraison", "ecole"];
function premiereAdresse(d) {
  const det = d.details || {};
  for (const cle of ORDRE_DEPART) {
    const a = det[cle];
    if (a && typeof a === "object" && a.label) return a;
  }
  return null;
}

const ETATS = {
  acompte_a_recevoir: { label: "Acompte à recevoir", classe: "attente" },
  confirmee: { label: "Confirmée", classe: "acceptee" },
  terminee: { label: "Terminée", classe: "terminee" },
  "en attente": { label: "En attente", classe: "attente" },
};

function Ligne({ d, sous, droite, badge, onOuvrir }) {
  return (
    <button className="tb-carte" onClick={() => onOuvrir(d.id)}>
      <span className="tb-ligne">
        <strong><Pastille d={d} /> {d.serviceTitre}</strong>
        {badge && <span className={"tb-badge tb-" + badge.classe}>{badge.label}</span>}
      </span>
      <span className="tb-quand">{sous}</span>
      <span className="tb-ligne">
        <span>{d.nom}</span>
        <strong>{droite}</strong>
      </span>
    </button>
  );
}

function CourseDuJour({ d, sit, onOuvrir }) {
  const a = premiereAdresse(d);
  const appel = lienAppel(d.telephone);
  const enRoute = lienWhatsApp(d.telephone, `Bonjour ${d.nom}, je suis en route pour votre rendez-vous de ${d.heure}. À tout de suite, Rebecca.`);
  const etat = ETATS[sit.etat] || { label: sit.etat, classe: "attente" };
  return (
    <div className="aj-course">
      <button className="aj-course-tete" onClick={() => onOuvrir(d.id)}>
        <span className="aj-heure">{d.heure}</span>
        <span className="aj-corps">
          <strong><Pastille d={d} /> {d.serviceTitre}</strong>
          <small>{d.nom} · {textePrix(d)}{sit.resteAPayer > 0 && d.statut !== "annulee" ? ` · reste ${shekels(sit.resteAPayer)}` : ""}</small>
          {a && <small dir="auto">{a.label}</small>}
        </span>
        <span className={"tb-badge tb-" + etat.classe}>{etat.label}</span>
      </button>
      {d.statut === "acceptee" && (
        <div className="aj-actions">
          {a && (
            <a className="tb-bouton tb-clair" href={lienWaze(typeof a.lat === "number" && typeof a.lon === "number" ? { lat: a.lat, lon: a.lon } : { adresse: a.label })} target="_blank" rel="noopener noreferrer">Waze</a>
          )}
          {enRoute && <a className="tb-bouton tb-clair" href={enRoute} target="_blank" rel="noopener noreferrer">En route</a>}
          {appel && <a className="tb-bouton tb-clair" href={appel}>Appeler</a>}
        </div>
      )}
    </div>
  );
}

export default function Aujourdhui({ aller }) {
  const [demandes, setDemandes] = useState(null);
  const [mouvements, setMouvements] = useState(null);
  const [lectureImpossible, setLectureImpossible] = useState(false);
  const [jour, setJour] = useState(aujourdhui());

  useEffect(() => {
    const echec = () => setLectureImpossible(true);
    const arrets = [
      onSnapshot(refDemandes(orderBy("creeLe", "desc")), (s) => setDemandes(trierDemandes(s.docs.map((x) => ({ id: x.id, ...x.data() })))), echec),
      onSnapshot(collection(db, "mouvements"), (s) => setMouvements(s.docs.map((x) => ({ id: x.id, ...x.data() }))), echec),
    ];
    return () => arrets.forEach((a) => a());
  }, []);

  // Changement de jour a minuit (heure d'Israel) si l'ecran reste ouvert
  useEffect(() => {
    const id = setInterval(() => setJour(aujourdhui()), 60000);
    return () => clearInterval(id);
  }, []);

  const ouvrir = (id) => aller("demandes", id);
  const demain = ajouterJours(jour, 1);

  // 12 nov. 2026 : un coequipier ne voit que SES courses (et les nouvelles demandes a prendre, et ses propositions)
  const { moi } = useEquipeContexte();
  const equipier = !!moi && moi !== ADMIN_ID;
  const vue = useMemo(() => {
    if (!demandes || !mouvements) return null;
    const visibles = equipier ? demandes.filter((d) => attribueA(d) === moi || d.proposeA === moi || (d.statut === "en attente" && !d.attribueA)) : demandes;
    const avecSit = visibles.map((d) => ({
      d,
      sit: situationCourse({ id: d.id, date: d.date, prixConvenu: prixDe(d), statut: d.statut }, mouvements),
    }));
    const parHeure = (a, b) => String(a.d.heure || "").localeCompare(String(b.d.heure || ""));
    const parDate = (a, b) => (String(a.d.date) + String(a.d.heure || "")).localeCompare(String(b.d.date) + String(b.d.heure || ""));

    const duJour = avecSit.filter((x) => x.d.date === jour && (x.d.statut === "acceptee" || x.d.statut === "terminee")).sort(parHeure);
    const deDemain = avecSit.filter((x) => x.d.date === demain && x.d.statut === "acceptee").sort(parHeure);
    const enAttente = avecSit.filter((x) => x.d.statut === "en attente").sort(parDate);
    const aCloturer = avecSit.filter((x) => x.d.statut === "acceptee" && String(x.d.date) < jour).sort(parDate);
    const aEncaisser = avecSit.filter((x) => x.d.statut === "terminee" && x.sit.resteAPayer > 0).sort(parDate);
    const acomptes = avecSit.filter((x) => x.d.statut === "acceptee" && String(x.d.date) >= jour && x.sit.acompte != null && !x.sit.acompteRecu).sort(parDate);
    const totalAEncaisser = aEncaisser.reduce((s, x) => s + x.sit.resteAPayer, 0);
    return { duJour, deDemain, enAttente, aCloturer, aEncaisser, acomptes, totalAEncaisser };
  }, [demandes, mouvements, jour, demain]);

  if (lectureImpossible) return <p className="admin-erreur tb-pad" role="alert">Lecture impossible. Vérifie la connexion et les règles Firebase.</p>;
  if (!vue) return <p className="admin-texte tb-pad">Chargement de ta journée…</p>;

  // Badge d'une demande en attente : date passee, ou course dans les 2 jours
  const badgeAttente = (d) => {
    const date = String(d.date);
    if (date < jour) return { label: "Date passée", classe: "annulee" };
    if (date <= ajouterJours(jour, 2)) return { label: "Bientôt", classe: "refusee" };
    return null;
  };

  return (
    <section className="aj">
      <h2 className="aj-date">{jourLong(jour)}</h2>
      <button className="tb-bouton am-ajouter" onClick={() => aller("demandes", "nouvelle")}>+ Ajouter une course</button>

      <div className="aj-resume">
        <button className="aj-chiffre" onClick={() => document.getElementById("aj-jour")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{vue.duJour.length}</strong>
          <small>course{vue.duJour.length > 1 ? "s" : ""} aujourd'hui</small>
        </button>
        <button className={"aj-chiffre" + (vue.enAttente.length ? " alerte" : "")} onClick={() => document.getElementById("aj-attente")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{vue.enAttente.length}</strong>
          <small>demande{vue.enAttente.length > 1 ? "s" : ""} en attente</small>
        </button>
        <button className="aj-chiffre" onClick={() => document.getElementById("aj-argent")?.scrollIntoView({ behavior: "smooth" })}>
          <strong>{shekels(vue.totalAEncaisser)}</strong>
          <small>à encaisser</small>
        </button>
      </div>

      <div className="tb-bloc" id="aj-jour">
        <h3>Mes courses du jour</h3>
        {vue.duJour.length === 0 && <p className="tb-note">Aucune course prévue aujourd'hui.</p>}
        {vue.duJour.map((x) => <CourseDuJour key={x.d.id} d={x.d} sit={x.sit} onOuvrir={ouvrir} />)}
        <button className="tb-retour aj-lien" onClick={() => aller("agenda")}>Voir l'agenda →</button>
      </div>

      {vue.deDemain.length > 0 && (
        <div className="tb-bloc">
          <h3>Demain · {jourCourt(demain)}</h3>
          {vue.deDemain.map((x) => (
            <button key={x.d.id} className="aj-mini" onClick={() => ouvrir(x.d.id)}>
              <strong>{x.d.heure}</strong> {x.d.serviceTitre} · {x.d.nom}
            </button>
          ))}
        </div>
      )}

      {vue.aCloturer.length > 0 && (
        <div className="tb-bloc aj-alerte">
          <h3>À clôturer ({vue.aCloturer.length})</h3>
          <p className="tb-note">Courses passées encore « acceptées » : ouvre-les pour les marquer terminées et noter le paiement.</p>
          {vue.aCloturer.map((x) => (
            <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={textePrix(x.d)} onOuvrir={ouvrir} />
          ))}
        </div>
      )}

      <div className="tb-bloc" id="aj-attente">
        <h3>Demandes en attente</h3>
        {vue.enAttente.length === 0 && <p className="tb-note">Aucune demande à traiter.</p>}
        {vue.enAttente.map((x) => (
          <Ligne
            key={x.d.id}
            d={x.d}
            sous={`Pour ${jourCourt(x.d.date)} · ${x.d.heure} — reçue ${recueIlYa(x.d)}`}
            droite={textePrix(x.d)}
            badge={badgeAttente(x.d)}
            onOuvrir={ouvrir}
          />
        ))}
      </div>

      <div className="tb-bloc" id="aj-argent">
        <h3>Paiements restants</h3>
        {vue.aEncaisser.length === 0 && vue.acomptes.length === 0 && <p className="tb-note">Tout est encaissé.</p>}
        {vue.aEncaisser.length > 0 && <p className="aj-sous-titre">Courses terminées à encaisser · {shekels(vue.totalAEncaisser)}</p>}
        {vue.aEncaisser.map((x) => (
          <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={"reste " + shekels(x.sit.resteAPayer)} onOuvrir={ouvrir} />
        ))}
        {vue.acomptes.length > 0 && <p className="aj-sous-titre">Acomptes à recevoir</p>}
        {vue.acomptes.map((x) => (
          <Ligne key={x.d.id} d={x.d} sous={`${jourCourt(x.d.date)} · ${x.d.heure}`} droite={"acompte " + shekels(x.sit.acompte)} onOuvrir={ouvrir} />
        ))}
      </div>
    </section>
  );
}
