// MOTEUR TARIFAIRE - Rebecca Transport & Services
// Fonctions pures : aucune dependance, testables sans interface.
// Toutes les valeurs viennent de config.js (jamais de prix ecrit ailleurs).

import { TARIFS, coutParKm, partRetourAVide } from "./config.js";
import { verifierDisponibilite, localVersUtc } from "./calendrier.js";

/* ---------- Outils ---------- */

const enMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const arrondiSup = (valeur, pas = TARIFS.arrondi) => Math.ceil(valeur / pas - 1e-9) * pas;

// Ajoute des minutes a une date + heure locales et renvoie la nouvelle date/heure
export function ajouterMinutes(date, heure, minutes) {
  const [a, mo, j] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j, h, mi + Math.round(minutes)));
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    heure: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

export function pourcentageNuit(heure, t = TARIFS) {
  const m = enMinutes(heure);
  for (const p of t.nuit) {
    if (m >= enMinutes(p.de) && m < enMinutes(p.a)) return p.pourcentage;
  }
  return 0;
}

// Reconnait la zone de la grille a partir d'un texte d'adresse
const normaliser = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’\-.,"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detecterZone(adresse, t = TARIFS) {
  const texte = " " + normaliser(adresse || "") + " ";
  // L'aeroport est teste en premier ("Boulevard Ben Gourion" n'est PAS l'aeroport)
  const ordre = ["ben_gurion", ...Object.keys(t.zones).filter((z) => z !== "ben_gurion")];
  for (const cle of ordre) {
    for (const alias of t.zones[cle].alias) {
      if (texte.includes(" " + normaliser(alias) + " ") || (/[\u0590-\u05ff]/.test(alias) && texte.includes(alias))) {
        return cle;
      }
    }
  }
  return null;
}

/* ---------- Formule de base ---------- */

// Prix "plein" d'UN trajet (sans retour a vide) : (km x cout/km + heures x tarif horaire) x marge
export function prixFormule(km, minutes, t = TARIFS) {
  return (km * coutParKm(t) + (minutes / 60) * t.tempsParHeure) * t.marge;
}

// Prix d'un aller simple selon le scenario : formule x (1 + part du retour a vide)
function prixAllerSimple(km, minutes, scenario, t) {
  return arrondiSup(prixFormule(km, minutes, t) * (1 + partRetourAVide(scenario, t)), t.arrondi);
}

// Plancher de la grille : s'applique aux trajets depuis ou vers Netanya
function plancherGrille(zoneDepart, zoneArrivee, t = TARIFS) {
  let zone = null;
  if (zoneDepart === "netanya" && zoneArrivee === "netanya") zone = "netanya";
  else if (zoneDepart === "netanya" && zoneArrivee) zone = zoneArrivee;
  else if (zoneArrivee === "netanya" && zoneDepart) zone = zoneDepart;
  if (!zone) return { prix: 0, prixSimple: 0, prixParTrajetAR: 0, zone: null };
  const z = t.zones[zone];
  const g = z.grilleB || {};
  return { prix: z.minimum, prixSimple: g.simple || z.minimum, prixParTrajetAR: g.parTrajetAR || z.minimum, zone };
}

/* ---------- Resultat ---------- */

function construire({ lignes, aConfirmer = [], devis = false, separe = [], details = {} }) {
  const total = devis ? null : lignes.reduce((s, l) => s + (l.montant || 0), 0);
  return { ok: true, bloque: false, devis, total, lignes, aConfirmer, separe, details };
}

const erreur = (message) => ({ ok: false, erreur: message });

/* ---------- Supplements communs ---------- */

function supplementNuit(lignes, libelle, prixBase, heure, t) {
  const pct = pourcentageNuit(heure, t);
  if (!pct) return prixBase;
  const avecNuit = arrondiSup(prixBase * (1 + pct), t.arrondi);
  lignes.push({ libelle: `${libelle} : supplément de nuit ${Math.round(pct * 100)} %`, montant: avecNuit - prixBase });
  return avecNuit;
}

function attenteEnLigne(lignes, minutes, t) {
  if (!minutes || minutes <= 0) return 0;
  const facturables = Math.max(0, minutes - t.attente.toleranceMinutes);
  if (facturables === 0) return 0;
  const pas = t.attente.pasMinutes;
  const tranches = Math.ceil(facturables / pas);
  const montant = (tranches * pas * t.attente.tarifHeure) / 60;
  lignes.push({
    libelle: `Attente : ${minutes} min (dont ${t.attente.toleranceMinutes} min offertes)`,
    montant,
  });
  return montant;
}

/* ---------- Rentabilite reelle (retours a vide inclus) ---------- */

// Gain net = prix - cout reel du vehicule sur TOUS les kilometres, retour a vide compris.
export function analyserRentabilite(d, total, t = TARIFS) {
  const retour = d.allerRetour ? d.retour || d.aller : d.aller; // aller simple : retour a vide
  const km = d.aller.km +
