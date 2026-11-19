// RESTAURANTS ET COMMERCANTS PARTENAIRES, version simple (19 nov. 2026) - regles pures - Rebecca Services
// Sans nouvelle regle Firebase : le commercant est une fiche du Repertoire (categorie « Commerçants partenaires »),
// avec son contrat (formule, tarifs pro, moyen de paiement) ; ses livraisons sont les courses ajoutees par Rebecca
// avec son telephone (+ Ajouter une course). Releve de la semaine du dimanche au samedi, arret samedi a minuit,
// paiement le lendemain (dimanche). Rebecca envoie le releve par WhatsApp et note « Semaine payee ».
import { duDe, encaisseDe } from "./finCourse.js";

const cents = (x) => Math.round(x * 100) / 100;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;
export const CONTRAT_DEFAUT = { formule: "A", jusqua3: 35, de3a6: 45, enPlus: 20, minimumCreneau: 5, moyen: "Bit", creneaux: "" };
export const FORMULES = [
  { v: "A", l: "A. À la demande" },
  { v: "B", l: "B. Créneaux réservés" },
];
export const contratDe = (f) => ({ ...CONTRAT_DEFAUT, ...((f && f.contratPro) || {}) });

const plusJours = (jour, n) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Semaine (dimanche -> samedi) qui contient ce jour
export function semaineDe(jour) {
  if (!DATE_OK.test(jour || "")) return null;
  const debut = plusJours(jour, -new Date(jour + "T12:00:00Z").getUTCDay());
  return { debut, fin: plusJours(debut, 6), paiementLe: plusJours(debut, 7) };
}
export const semaineDecalee = (s, n) => semaineDe(plusJours(s.debut, 7 * n));

// Prix pro conseille d'une livraison (km de la course) ; null au-dela de 6 km (sur devis)
export function prixPro(contrat, km, enPlus = false) {
  if (enPlus) return contrat.enPlus;
  const k = Number(km);
  if (!(k > 0)) return null;
  if (k <= 3) return contrat.jusqua3;
  if (k <= 6) return contrat.de3a6;
  return null;
}

// Releve d'une semaine : livraisons terminees du commercant (liste = ses demandes) et argent
export function releveSemaine(liste = [], mouvements = [], semaine) {
  if (!semaine) return null;
  const lignes = liste
    .filter((d) => d.statut === "terminee" && DATE_OK.test(d.date || "") && d.date >= semaine.debut && d.date <= semaine.fin)
    .sort((a, b) => (a.date + (a.heure || "")).localeCompare(b.date + (b.heure || "")))
    .map((d) => {
      const du = duDe(d);
      const paye = cents(Math.min(du, encaisseDe(mouvements, d.id)));
      return { d, du, paye, reste: cents(Math.max(0, du - paye)) };
    });
  const du = cents(lignes.reduce((s, l) => s + l.du, 0));
  const paye = cents(lignes.reduce((s, l) => s + l.paye, 0));
  return { ...semaine, lignes, nb: lignes.length, du, paye, reste: cents(du - paye) };
}

const fr = (d) => (DATE_OK.test(d || "") ? d.split("-").reverse().join("/") : "");
const adresseDe = (d) => {
  const v = d.details || {};
  const a = v.livraison || v.arrivee || v.adresse || null;
  return (a && a.label) || "";
};
// Message WhatsApp du releve, pour le commercant
export function messageReleve(nom, r, contrat) {
  const lignes = r.lignes.map((l) => `• ${fr(l.d.date)}${l.d.heure ? " " + l.d.heure.replace(":", "h") : ""} · ${adresseDe(l.d) || l.d.nom || "livraison"} · ${l.du} ₪${l.reste === 0 ? " (payé)" : ""}`);
  return [
    `Bonjour ${nom},`,
    `Voici le relevé de vos livraisons Rebecca Services du ${fr(r.debut)} au ${fr(r.fin)} :`,
    ...lignes,
    `Total : ${r.nb} livraison${r.nb > 1 ? "s" : ""}, ${r.du} ₪.`,
    r.paye > 0 ? `Déjà payé : ${r.paye} ₪.` : "",
    r.reste > 0 ? `Reste à payer : ${r.reste} ₪, le ${fr(r.paiementLe)}${contrat && contrat.moyen ? ` par ${contrat.moyen}` : ""}.` : "Tout est réglé, merci !",
    "Merci pour votre confiance, Rebecca",
  ].filter(Boolean).join("\n");
}

// Paiements a noter quand le commercant paie la semaine : un paiement par livraison qui a un reste
export function paiementsSemaine(r, moyen, date) {
  return r.lignes.filter((l) => l.reste > 0).map((l) => ({ kind: "paiement", resId: l.d.id, date, montant: l.reste, moyen }));
}
