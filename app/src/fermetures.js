import { useEffect, useState } from "react";
import { TARIFS } from "./pricing/config.js";

// Reglages modifiables par Rebecca depuis l'agenda :
//  - fermetures (vacances, jours de repos, Hol Hamoed ferme...) : collection "fermetures"
//  - creneaux fixes (ecole, trajets reguliers) actifs ou libres : document "reglages/creneaux"
// Ils s'ajoutent au calendrier du site. Cote clients : lecture simple par internet
// (sans charger Firebase), donc tres legere. Si la lecture echoue, le site continue avec
// Chabbat, fetes et les reglages par defaut.

const BASE = "https://firestore.googleapis.com/v1/projects/rebecca-transport/databases/(default)/documents";
const CLE = "key=AIzaSyDZOjiRg9tgHo620Dqw1PYJuBciJ80Enmg";
const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MOTIF_CRENEAU = "Créneau déjà réservé";

let version = 0;
const abonnes = new Set();
const notifier = () => {
  version++;
  abonnes.forEach((f) => f(version));
};

/* ---------- Fermetures ---------- */

export function fermetureValide(f) {
  return !!f && typeof f.debut === "string" && typeof f.fin === "string" && FORMAT.test(f.debut) && FORMAT.test(f.fin) && f.fin > f.debut;
}

let fermAdmin = false; // quand l'admin est connectee, ses donnees en direct priment
export function appliquerFermetures(liste, depuisAdmin = false) {
  if (depuisAdmin) fermAdmin = true;
  else if (fermAdmin) return;
  const propres = liste.filter(fermetureValide).map((f) => ({
    debut: f.debut,
    fin: f.fin,
    motif: String(f.motif || "").slice(0, 60) || "Fermeture exceptionnelle",
  }));
  const cible = TARIFS.calendrier.fermeturesExceptionnelles;
  cible.splice(0, cible.length, ...propres);
  notifier();
}

/* ---------- Creneaux fixes ---------- */

// Reglage de depart (celui du code) : { jours: [0-6], debut, fin, actif }
export const CRENEAUX_PAR_DEFAUT = TARIFS.calendrier.creneauxPersonnels.map((c) => ({
  jours: [...c.jours],
  debut: c.debut,
  fin: c.fin,
  actif: true,
}));

export function creneauValide(c) {
  return (
    !!c &&
    Array.isArray(c.jours) &&
    c.jours.length > 0 &&
    c.jours.every((j) => Number.isInteger(j) && j >= 0 && j <= 6) &&
    typeof c.debut === "string" &&
    typeof c.fin === "string" &&
    HEURE.test(c.debut) &&
    HEURE.test(c.fin) &&
    c.fin > c.debut
  );
}

// Lit le texte enregistre ; renvoie null si absent ou invalide (=> reglage de depart)
export function lireCreneaux(json) {
  try {
    const liste = JSON.parse(json);
    if (!Array.isArray(liste) || liste.length === 0 || liste.length > 20) return null;
    const propres = liste.filter(creneauValide).map((c) => ({ jours: [...new Set(c.jours)].sort(), debut: c.debut, fin: c.fin, actif: c.actif !== false }));
    return propres.length === liste.length ? propres : null;
  } catch {
    return null;
  }
}

let creneauxAdmin = false;
export function appliquerCreneaux(liste, depuisAdmin = false) {
  if (depuisAdmin) creneauxAdmin = true;
  else if (creneauxAdmin) return;
  const source = liste && liste.length ? liste : CRENEAUX_PAR_DEFAUT;
  const actifs = source.filter((c) => c.actif !== false && creneauValide(c)).map((c) => ({ jours: c.jours, debut: c.debut, fin: c.fin, motif: MOTIF_CRENEAU }));
  const cible = TARIFS.calendrier.creneauxPersonnels;
  cible.splice(0, cible.length, ...actifs);
  notifier();
}

/* ---------- Lecture publique (clients) ---------- */

const texte = (champ) => (champ && typeof champ.stringValue === "string" ? champ.stringValue : "");

let chargementFerm = null;
function chargerFermetures() {
  if (chargementFerm) return chargementFerm;
  chargementFerm = fetch(`${BASE}/fermetures?pageSize=300&${CLE}`, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("lecture impossible");
      return r.json();
    })
    .then((j) =>
      appliquerFermetures(
        (j.documents || []).map((d) => {
          const f = d.fields || {};
          return { debut: texte(f.debut), fin: texte(f.fin), motif: texte(f.motif) };
        })
      )
    )
    .catch(() => {
      chargementFerm = null;
    });
  return chargementFerm;
}

let chargementCren = null;
function chargerCreneaux() {
  if (chargementCren) return chargementCren;
  chargementCren = fetch(`${BASE}/reglages/creneaux?${CLE}`, { cache: "no-store" })
    .then((r) => {
      if (r.status === 404) return null; // jamais modifie : reglage de depart
      if (!r.ok) throw new Error("lecture impossible");
      return r.json();
    })
    .then((j) => {
      const liste = j && j.fields ? lireCreneaux(texte(j.fields.json)) : null;
      if (liste) appliquerCreneaux(liste);
    })
    .catch(() => {
      chargementCren = null;
    });
  return chargementCren;
}

// A appeler dans un composant : charge les reglages et le redessine quand ils arrivent.
export function useFermetures() {
  const [v, setV] = useState(version);
  useEffect(() => {
    abonnes.add(setV);
    setV(version);
    chargerFermetures();
    chargerCreneaux();
    return () => abonnes.delete(setV);
  }, []);
  return v;
}
