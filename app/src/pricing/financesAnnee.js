// FINANCES DE L'ANNEE - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// Lot B, seance B4 : chiffre d'affaires par activite et par mois, autres revenus (Wolt...),
// pourboires a part, credit prepaye, depenses, benefice, et cumul annuel compare au plafond de l'osek patur.
//
// Choix (provisoires, a confirmer avec le comptable) :
//  - Chiffre d'affaires d'une activite = courses terminees (a la date de la course) + argent garde apres annulation.
//  - Plafond de l'osek patur = chiffre d'affaires de TOUTES les activites + revenus Wolt (hors pourboires).
//  - Pourboires : jamais dans le chiffre d'affaires, affiches a part.
//  - Recharges de credit confirmees : argent recu d'avance (devient du chiffre d'affaires quand la course est faite).
//  - Bonus de credit : credit offert, ce n'est pas de l'argent recu.

import { SERVICES } from "../services.js";

export const PLAFOND_DEFAUT = 100000; // ₪, modifiable dans Reglages (admin/reglages.plafondOsek)
export const SEUIL_ATTENTION = 0.8; // alerte a 80 % du plafond

export const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export const ACTIVITES = [
  { id: "coursier", label: "Services coursier" },
  { id: "transport", label: "Transport privé" },
];
const ACTIVITE_DE = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));
export const activiteDe = (service) => ACTIVITE_DE[service] || "autre";

const cents = (x) => Math.round(x * 100) / 100;
const nb = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const anneeDe = (d) => (DATE_OK.test(d || "") ? Number(d.slice(0, 4)) : null);
const moisDe = (d) => (DATE_OK.test(d || "") ? Number(d.slice(5, 7)) - 1 : null);
const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);

const moisVide = () => ({ coursier: 0, transport: 0, autre: 0, annulations: 0, ca: 0, wolt: 0, pourboires: 0, depenses: 0, benefice: 0, courses: 0 });

// Synthese d'une annee civile
export function syntheseAnnee({ annee, demandes = [], mouvements = [], depenses = [], autresRevenus = [], avis = [], recharges = [], creditMouvements = [] }) {
  const mois = Array.from({ length: 12 }, moisVide);
  const parId = new Map(demandes.map((d) => [d.id, d]));

  // Courses terminees
  for (const d of demandes) {
    if (d.statut !== "terminee" || anneeDe(d.date) !== annee) continue;
    const m = mois[moisDe(d.date)];
    m[activiteDe(d.service)] += prixDe(d);
    m.courses += 1;
    if (nb(d.pourboire) > 0) m.pourboires += nb(d.pourboire);
  }
  // Argent garde apres annulation (rattache a l'activite de la course)
  const annulationsParActivite = { coursier: 0, transport: 0, autre: 0 };
  for (const a of mouvements) {
    if (a.kind !== "annulation" || anneeDe(a.date) !== annee) continue;
    const frais = nb(a.fraisRetenus);
    mois[moisDe(a.date)].annulations += frais;
    const d = parId.get(a.resId);
    annulationsParActivite[d ? activiteDe(d.service) : "autre"] += frais;
  }
  // Pourboires laisses avec l'avis (date de la course)
  for (const a of avis) {
    const d = parId.get(a.id);
    if (!d || anneeDe(d.date) !== annee || nb(a.pourboire) <= 0) continue;
    mois[moisDe(d.date)].pourboires += nb(a.pourboire);
  }
  // Depenses
  for (const x of depenses) {
    if (anneeDe(x.date) !== annee) continue;
    mois[moisDe(x.date)].depenses += nb(x.montant);
  }
  // Autres revenus (Wolt...) : rattaches au mois de debut de la periode
  let livraisonsWolt = 0;
  let pourboiresWolt = 0;
  const parSource = {};
  for (const r of autresRevenus) {
    if (anneeDe(r.debut) !== annee) continue;
    const m = mois[moisDe(r.debut)];
    m.wolt += nb(r.revenu);
    pourboiresWolt += nb(r.pourboire);
    livraisonsWolt += nb(r.livraisons);
    const s = r.source || "Autre";
    parSource[s] = cents((parSource[s] || 0) + nb(r.revenu));
  }

  for (const m of mois) {
    m.ca = cents(m.coursier + m.transport + m.autre + m.annulations);
    m.benefice = cents(m.ca + m.wolt - m.depenses);
    for (const k of Object.keys(m)) m[k] = cents(m[k]);
  }

  const somme = (k) => cents(mois.reduce((s, m) => s + m[k], 0));
  const caActivites = somme("ca");
  const wolt = somme("wolt");

  // Credit prepaye
  const rechargesRecues = cents(recharges.filter((r) => r.statut === "confirmée" && anneeDe(r.date) === annee).reduce((s, r) => s + nb(r.montant), 0));
  const bonusOfferts = cents(creditMouvements.filter((c) => c.kind === "bonus" && anneeDe(c.date) === annee).reduce((s, c) => s + nb(c.montant), 0));

  return {
    annee,
    mois,
    totaux: {
      coursier: cents(somme("coursier") + annulationsParActivite.coursier),
      transport: cents(somme("transport") + annulationsParActivite.transport),
      autre: cents(somme("autre") + annulationsParActivite.autre),
      annulations: somme("annulations"),
      caActivites,
      wolt,
      depenses: somme("depenses"),
      benefice: cents(caActivites + wolt - somme("depenses")),
      courses: somme("courses"),
      prixMoyen: somme("courses") ? Math.round((somme("coursier") + somme("transport") + somme("autre")) / somme("courses")) : 0,
    },
    pourboires: { clients: somme("pourboires"), wolt: cents(pourboiresWolt) },
    wolt: { revenu: wolt, livraisons: livraisonsWolt, parSource },
    credit: { rechargesRecues, bonusOfferts },
    cumulPlafond: cents(caActivites + wolt),
  };
}

// Etat par rapport au plafond. jourDeLAnnee : pour l'estimation de fin d'annee (annee en cours seulement)
export function etatPlafond(cumul, plafond, jourDeLAnnee = null, joursDansLAnnee = 365) {
  const p = nb(plafond) > 0 ? nb(plafond) : PLAFOND_DEFAUT;
  const part = cumul / p;
  const estimation = jourDeLAnnee && jourDeLAnnee > 0 ? Math.round((cumul / jourDeLAnnee) * joursDansLAnnee) : null;
  return {
    plafond: p,
    pourcent: Math.round(part * 1000) / 10,
    reste: cents(Math.max(0, p - cumul)),
    niveau: part >= 1 ? "depasse" : part >= SEUIL_ATTENTION ? "attention" : "ok",
    estimation,
    estimationDepasse: estimation != null && estimation >= p,
  };
}

// Numero du jour dans l'annee (1 = 1er janvier) d'une date AAAA-MM-JJ
export function jourDansAnnee(date) {
  const [a, m, j] = date.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, j) - Date.UTC(a, 0, 1)) / 86400000) + 1;
}
export const joursAnnee = (a) => ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 366 : 365);

/* ---------- Autres revenus (Wolt...) : saisie ---------- */
export const PERIODES = [
  { id: "jour", label: "Un jour" },
  { id: "semaine", label: "Une semaine" },
  { id: "mois", label: "Un mois" },
];

// Fin de periode proposee automatiquement
export function finProposee(periode, debut) {
  if (!DATE_OK.test(debut || "")) return debut || "";
  const [a, m, j] = debut.split("-").map(Number);
  const d = periode === "semaine" ? new Date(Date.UTC(a, m - 1, j + 6)) : periode === "mois" ? new Date(Date.UTC(a, m, 0)) : new Date(Date.UTC(a, m - 1, j));
  return d.toISOString().slice(0, 10);
}

// Verifie une ligne avant enregistrement (memes regles que Firestore v7, autreRevenuForme)
// f : { source, periode, debut, fin, livraisons, revenu, pourboire, detail } (textes du formulaire)
export function validerAutreRevenu(f) {
  const lire = (x) => Number(String(x == null ? "" : x).trim().replace(",", ".") || "0");
  const source = String(f.source || "").trim();
  const detail = String(f.detail || "").trim();
  const livraisons = lire(f.livraisons);
  const revenu = Math.round(lire(f.revenu) * 100) / 100;
  const pourboire = Math.round(lire(f.pourboire) * 100) / 100;
  if (!source || source.length > 40) return { erreur: "Indique la source (ex : Wolt)." };
  if (!PERIODES.some((p) => p.id === f.periode)) return { erreur: "Choisis la période." };
  if (!DATE_OK.test(f.debut || "") || !DATE_OK.test(f.fin || "")) return { erreur: "Indique les dates." };
  if (f.fin < f.debut) return { erreur: "La date de fin est avant la date de début." };
  if (!Number.isInteger(livraisons) || livraisons < 0 || livraisons > 5000) return { erreur: "Nombre de livraisons invalide (nombre entier)." };
  if (![revenu, pourboire].every((x) => Number.isFinite(x) && Math.abs(x) <= 100000)) return { erreur: "Montant invalide." };
  if (revenu + pourboire === 0) return { erreur: "Indique le revenu et/ou le pourboire." };
  if ((revenu < 0 || pourboire < 0) && detail.length < 3) return { erreur: "Pour un montant négatif (correction), un détail est obligatoire." };
  if (detail.length > 200) return { erreur: "Détail trop long (200 caractères maximum)." };
  const ligne = { source, periode: f.periode, debut: f.debut, fin: f.fin, livraisons, revenu, pourboire };
  if (detail) ligne.detail = detail;
  return { erreur: "", ligne };
}
