// TABLEAU DE BORD - regles pures (aucun acces internet ni base de donnees) - Rebecca Services
// D2a (9 nov. 2026) : indicateurs G3 valides par Rebecca, calcules UNIQUEMENT sur des champs qui existent.
//  - Demandes recues : demandes creees dans la periode (date de creation).
//  - Prestations terminees : statut "terminee", a la date de la course.
//  - Chiffre d'affaires realise : prix des courses terminees + frais gardes apres annulation (meme regle que Finances), hors pourboires.
//  - Encaisse : paiements + corrections - remboursements effectues, a leur date.
// Les activites pas encore developpees n'ont AUCUN chiffre : elles affichent "Bientot".
// Km : seulement des km ESTIMES (les km reellement parcourus ne sont pas enregistres).

import { SERVICES } from "../services.js";

export const ACTIVITES_TB = [
  { id: "coursier", titre: "Services coursier", etat: "active", icone: "coursier" },
  { id: "transport", titre: "Transport privé", etat: "active", icone: "transport" },
  { id: "nails", titre: "Nails Prestige", etat: "bientot", logo: "/brand/logo-nails-prestige.png" },
  { id: "regenx", titre: "RegenX", etat: "bientot", logo: "/brand/logo-regenx.png" },
  { id: "epoxy", titre: "Boutique Epoxy", etat: "bientot", logo: "/brand/logo-epoxy.png" },
  { id: "digital", titre: "Digital & Applications", etat: "bientot", logo: "/brand/logo-digital-applications.png" },
  { id: "slim", titre: "Prestige Slim & Lift", etat: "bientot", logo: "/brand/logo-prestige-slim-lift.png" },
  { id: "hair", titre: "Prestige Hair", etat: "bientot", logo: "/brand/logo-prestige-hair.png" },
];

const ACTIVITE_DE = Object.fromEntries(SERVICES.map((s) => [s.id, s.activite]));
export const activiteDe = (service) => ACTIVITE_DE[service] || "autre";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
const nb = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const cents = (x) => Math.round(x * 100) / 100;
const prixDe = (d) => (typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0);

// Date de creation d'une demande (heure d'Israel). creeLe : Timestamp Firebase, Date ou texte "AAAA-MM-JJ".
export function dateCreation(d) {
  const c = d && d.creeLe;
  if (!c) return null;
  if (typeof c === "string") return DATE_OK.test(c.slice(0, 10)) ? c.slice(0, 10) : null;
  const date = typeof c.toDate === "function" ? c.toDate() : c instanceof Date ? c : null;
  return date ? date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }) : null;
}

const dans = (date, periode) => !!date && (!periode || (date >= periode.debut && date <= periode.fin));

// Les 4 indicateurs G3 pour une activite ("coursier", "transport") ou pour tout (activite = null)
export function indicateurs({ activite = null, demandes = [], mouvements = [], periode = null }) {
  const garder = (d) => !activite || activiteDe(d.service) === activite;
  const siennes = demandes.filter(garder);
  const ids = new Set(siennes.map((d) => d.id));

  const demandesRecues = siennes.filter((d) => dans(dateCreation(d), periode)).length;
  const terminees = siennes.filter((d) => d.statut === "terminee" && dans(d.date, periode));
  const fraisAnnulation = mouvements
    .filter((m) => m.kind === "annulation" && ids.has(m.resId) && dans(m.date, periode))
    .reduce((s, m) => s + nb(m.fraisRetenus), 0);
  const caRealise = cents(terminees.reduce((s, d) => s + prixDe(d), 0) + fraisAnnulation);
  const encaisse = cents(
    mouvements
      .filter((m) => ids.has(m.resId) && dans(m.date, periode))
      .reduce((s, m) => s + (m.kind === "paiement" || m.kind === "correction" ? nb(m.montant) : m.kind === "remboursement_effectue" ? -nb(m.montant) : 0), 0)
  );
  const pourboires = cents(terminees.reduce((s, d) => s + nb(d.pourboire), 0));
  const kmEstimes = Math.round(terminees.reduce((s, d) => s + nb(d.kmEstime), 0));
  return {
    demandesRecues,
    prestationsTerminees: terminees.length,
    caRealise,
    encaisse,
    pourboires,
    kmEstimes,
    prixMoyen: terminees.length ? Math.round(terminees.reduce((s, d) => s + prixDe(d), 0) / terminees.length) : 0,
  };
}

// Repartition des prestations terminees par service (graphique 2)
export function repartitionServices({ activite = null, demandes = [], periode = null }) {
  const c = {};
  for (const d of demandes) {
    if (activite && activiteDe(d.service) !== activite) continue;
    if (d.statut !== "terminee" || !dans(d.date, periode)) continue;
    c[d.service] = (c[d.service] || 0) + 1;
  }
  return SERVICES.filter((s) => c[s.id]).map((s) => ({ service: s.id, titre: s.titre, nombre: c[s.id] }));
}

// Chiffre d'affaires realise jour par jour sur la periode (graphique 1). Limite a 400 jours.
export function serieCA({ activite = null, demandes = [], mouvements = [], periode }) {
  if (!periode) return [];
  const jours = [];
  const [a, m, j] = periode.debut.split("-").map(Number);
  for (let i = 0; i < 400; i++) {
    const x = new Date(Date.UTC(a, m - 1, j + i, 12)).toISOString().slice(0, 10);
    if (x > periode.fin) break;
    jours.push(x);
  }
  return jours.map((date) => ({ date, ca: indicateurs({ activite, demandes, mouvements, periode: { debut: date, fin: date } }).caRealise }));
}

// Tous les chiffres d'une tuile d'activite (aucun chiffre pour une activite "bientot")
export function tuiles({ demandes = [], mouvements = [], periode = null }) {
  return ACTIVITES_TB.map((a) => (a.etat === "active" ? { ...a, chiffres: indicateurs({ activite: a.id, demandes, mouvements, periode }) } : { ...a, chiffres: null }));
}
