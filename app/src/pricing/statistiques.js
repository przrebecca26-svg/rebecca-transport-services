// STATISTIQUES COMPAREES ET RAPPORTS (Lot C, seances C4 et C5, 9 nov. 2026) - regles pures - Rebecca Services
// Deux periodes cote a cote, par personne (chacun son osek patur) et par activite.
// Memes regles que les Finances : chiffre d'affaires = courses terminees (a la date de la course)
// + argent garde apres annulation ; pourboires a part ; Wolt a part ; benefice = CA + Wolt - depenses.
// Rapports : fichiers CSV (ouverts par Excel ou Numbers) et page imprimable (PDF depuis le telephone).

import { periodeDe, decaler } from "./bilan.js";
import { activiteDe } from "./financesAnnee.js";

const ADMIN_ID = "rebecca";
const cents = (x) => Math.round(x * 100) / 100;
const nb = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);
const faitPar = (d) => (d && d.realisePar) || (d && d.attribueA) || ADMIN_ID;
const dans = (date, p) => !!date && (!p || (date >= p.debut && date <= p.fin));

export const TYPES_PERIODE = [
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];
export const COMPARAISONS = [
  { id: "precedente", label: "Période précédente" },
  { id: "anneeDerniere", label: "Même période l'an dernier" },
];

const pad = (n) => String(n).padStart(2, "0");
// Periode contenant ref (semaine, mois, annee)
export function periode(type, ref) {
  if (type === "annee") return { debut: ref.slice(0, 4) + "-01-01", fin: ref.slice(0, 4) + "-12-31" };
  return periodeDe(type, ref);
}
// Reference de la periode de comparaison
export function referenceComparee(type, ref, comparaison) {
  const [a, m, j] = ref.split("-").map(Number);
  if (comparaison === "anneeDerniere") {
    const jour = m === 2 && j === 29 ? 28 : j;
    return `${a - 1}-${pad(m)}-${pad(jour)}`;
  }
  if (type === "annee") return `${a - 1}-${pad(m)}-${pad(j)}`;
  return decaler(type, ref, -1);
}

// Indicateurs d'une periode. personne : "tous" ou un id ; activite : "toutes" ou "coursier" / "transport"...
export function indicateursPeriode(p, { demandes = [], mouvements = [], depenses = [], autresRevenus = [], personne = "tous", activite = "toutes" } = {}) {
  const pourPersonne = (d) => personne === "tous" || faitPar(d) === personne;
  const pourActivite = (d) => activite === "toutes" || activiteDe(d.service) === activite;
  const siennes = demandes.filter((d) => pourPersonne(d) && pourActivite(d));
  const ids = new Set(siennes.map((d) => d.id));
  const terminees = siennes.filter((d) => d.statut === "terminee" && dans(d.date, p));
  const caCourses = terminees.reduce((s, d) => s + prixDe(d), 0);
  const annulations = mouvements.filter((m) => m.kind === "annulation" && ids.has(m.resId) && dans(m.date, p)).reduce((s, m) => s + nb(m.fraisRetenus), 0);
  const encaisse = mouvements
    .filter((m) => ids.has(m.resId) && dans(m.date, p))
    .reduce((s, m) => s + (m.kind === "paiement" || m.kind === "correction" ? nb(m.montant) : m.kind === "remboursement_effectue" ? -nb(m.montant) : 0), 0);
  const deLaPersonne = (x) => personne === "tous" || (x.operateur || ADMIN_ID) === personne;
  // Depenses et Wolt : seulement pour « toutes les activites » (ils ne sont pas rattaches a une activite)
  const toutes = activite === "toutes";
  const dep = toutes ? depenses.filter((x) => deLaPersonne(x) && dans(x.date, p)).reduce((s, x) => s + nb(x.montant), 0) : 0;
  const wolt = toutes ? autresRevenus.filter((x) => deLaPersonne(x) && dans(x.debut, p)).reduce((s, x) => s + nb(x.revenu), 0) : 0;
  const pourboires = terminees.reduce((s, d) => s + nb(d.pourboire), 0);
  const demandesRecues = siennes.filter((d) => {
    const c = d.creeLe && typeof d.creeLe.seconds === "number" ? new Date(d.creeLe.seconds * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }) : d.date;
    return dans(c, p);
  }).length;
  const ca = cents(caCourses + annulations);
  return {
    demandes: demandesRecues,
    courses: terminees.length,
    chiffreAffaires: ca,
    encaisse: cents(encaisse),
    prixMoyen: terminees.length ? Math.round(caCourses / terminees.length) : 0,
    pourboires: cents(pourboires),
    wolt: cents(wolt),
    depenses: cents(dep),
    benefice: cents(ca + wolt - dep),
  };
}

export const LIGNES = [
  { id: "chiffreAffaires", label: "Chiffre d'affaires", argent: true },
  { id: "courses", label: "Prestations terminées" },
  { id: "prixMoyen", label: "Prix moyen", argent: true },
  { id: "encaisse", label: "Encaissé", argent: true },
  { id: "demandes", label: "Demandes reçues" },
  { id: "pourboires", label: "Pourboires (à part)", argent: true },
  { id: "wolt", label: "Wolt et autres revenus", argent: true, toutes: true },
  { id: "depenses", label: "Dépenses", argent: true, toutes: true },
  { id: "benefice", label: "Bénéfice", argent: true, toutes: true },
];

// Variation en % (null si la periode de comparaison vaut 0)
export const variation = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : null);

// Comparaison complete : { a: { periode, valeurs }, b: {...}, lignes: [{ id, label, a, b, variation }] }
export function comparer({ type = "mois", ref, comparaison = "precedente", ...donnees }) {
  const pa = periode(type, ref);
  const pb = periode(type, referenceComparee(type, ref, comparaison));
  const a = indicateursPeriode(pa, donnees);
  const b = indicateursPeriode(pb, donnees);
  const toutes = !donnees.activite || donnees.activite === "toutes";
  return {
    a: { periode: pa, valeurs: a },
    b: { periode: pb, valeurs: b },
    lignes: LIGNES.filter((l) => toutes || !l.toutes).map((l) => ({ ...l, a: a[l.id], b: b[l.id], variation: variation(a[l.id], b[l.id]) })),
  };
}

/* ---------- C5 : rapports ---------- */

const champ = (x) => {
  const s = x == null ? "" : String(x);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const montant = (x) => (Number.isFinite(Number(x)) ? String(cents(Number(x))).replace(".", ",") : "");
// CSV pour Excel (point-virgule, virgule decimale, BOM pour les accents)
export const versCsv = (entetes, lignes) => String.fromCharCode(0xfeff) + [entetes, ...lignes].map((l) => l.map(champ).join(";")).join("\r\n");

// Courses de la periode (une ligne par prestation terminee ou annulee avec argent garde)
export function csvCourses(p, { demandes = [], mouvements = [], personne = "tous", noms = {} } = {}) {
  const lignes = demandes
    .filter((d) => (personne === "tous" || faitPar(d) === personne) && dans(d.date, p) && (d.statut === "terminee" || d.statut === "annulee"))
    .sort((x, y) => `${x.date} ${x.heure || ""}`.localeCompare(`${y.date} ${y.heure || ""}`))
    .map((d) => {
      const garde = mouvements.filter((m) => m.kind === "annulation" && m.resId === d.id).reduce((s, m) => s + nb(m.fraisRetenus), 0);
      return [d.date, d.heure || "", d.serviceTitre || d.service, activiteDe(d.service), d.nom || "", d.statut === "terminee" ? "Terminée" : "Annulée", montant(d.statut === "terminee" ? prixDe(d) : garde), montant(nb(d.pourboire)), noms[faitPar(d)] || faitPar(d)];
    });
  return versCsv(["Date", "Heure", "Prestation", "Activité", "Client", "Statut", "Chiffre d'affaires (₪)", "Pourboire (₪)", "Fait par"], lignes);
}

// Encaissements de la periode
export function csvEncaissements(p, { demandes = [], mouvements = [], personne = "tous", noms = {} } = {}) {
  const parId = new Map(demandes.map((d) => [d.id, d]));
  const lignes = mouvements
    .filter((m) => ["paiement", "correction", "remboursement_effectue"].includes(m.kind) && dans(m.date, p))
    .filter((m) => personne === "tous" || (m.operateur || ADMIN_ID) === personne || (parId.get(m.resId) && faitPar(parId.get(m.resId)) === personne))
    .sort((x, y) => String(x.date).localeCompare(String(y.date)))
    .map((m) => {
      const d = parId.get(m.resId) || {};
      const signe = m.kind === "remboursement_effectue" ? -1 : 1;
      const type = m.kind === "paiement" ? "Paiement" : m.kind === "correction" ? "Correction" : "Remboursement";
      return [m.date, type, m.moyen || "", montant(signe * nb(m.montant)), d.serviceTitre || "", d.date || "", d.nom || "", noms[m.operateur || ADMIN_ID] || m.operateur || "Rebecca", m.motif || ""];
    });
  return versCsv(["Date", "Type", "Moyen", "Montant (₪)", "Prestation", "Date de la prestation", "Client", "Reçu par", "Détail"], lignes);
}

export function csvDepenses(p, { depenses = [], personne = "tous", vehicules = [] } = {}) {
  const lignes = depenses
    .filter((x) => (personne === "tous" || (x.operateur || ADMIN_ID) === personne) && dans(x.date, p))
    .sort((x, y) => String(x.date).localeCompare(String(y.date)))
    .map((x) => [x.date, x.categorie, montant(x.montant), (vehicules.find((v) => v.id === x.vehicule) || {}).nom || "", x.motif || ""]);
  return versCsv(["Date", "Catégorie", "Montant (₪)", "Véhicule", "Détail"], lignes);
}

export function csvWolt(p, { autresRevenus = [], personne = "tous" } = {}) {
  const lignes = autresRevenus
    .filter((x) => (personne === "tous" || (x.operateur || ADMIN_ID) === personne) && dans(x.debut, p))
    .sort((x, y) => String(x.debut).localeCompare(String(y.debut)))
    .map((x) => [x.source, x.debut, x.fin, x.livraisons, montant(x.revenu), montant(x.pourboire), x.detail || ""]);
  return versCsv(["Source", "Du", "Au", "Livraisons", "Revenu (₪)", "Pourboires (₪)", "Détail"], lignes);
}

export const nomRapport = (sujet, p) => `rebecca-services-${sujet}-${p.debut}_${p.fin}.csv`;
