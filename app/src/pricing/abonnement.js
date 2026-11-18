// ABONNEMENT MENSUEL DU RAMASSAGE SCOLAIRE (18 nov. 2026, suggestion validée par Rebecca)
// Dans la fiche d'une famille (Répertoire) : « Abonnement mensuel (₪) » et le jour du mois où il est dû.
// À partir de ce jour, l'onglet Aujourd'hui le rappelle : « Préparer le mois » crée la ligne à encaisser
// (Ramassage scolaire · Abonnement de novembre), puis « Envoyer le rappel » envoie le message WhatsApp avec le
// lien « Payer et me prévenir ». Le rappel disparaît quand le mois est payé.
// Une famille a SOIT un abonnement au mois, SOIT un forfait à la journée (pas les deux).
import { TARIFS } from "./config.js";
import { lireForfait } from "./forfaitJour.js";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const nomMois = (aaaaMm) => MOIS[Number(String(aaaaMm).slice(5, 7)) - 1] || "";
export const lireJourPaiement = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : 1;
};
export const idAbonnement = (familleId, mois) => `abo-${String(familleId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}-${mois}`;
const telephone = (f) => String((f && (f.telephone || f.telephone2)) || "").trim();

// Familles dont l'abonnement du mois est dû aujourd'hui (ou depuis le jour de paiement)
export function abonnementsDus(familles = [], jour) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour || "")) return [];
  const mois = jour.slice(0, 7);
  const j = Number(jour.slice(8, 10));
  return familles
    .filter((f) => f && lireForfait(f.abonnementMois) > 0 && j >= lireJourPaiement(f.jourPaiement))
    .filter((f) => !f.au || f.au >= `${mois}-01`)
    .map((f) => ({ famille: f, mois, id: idAbonnement(f.id, mois), montant: lireForfait(f.abonnementMois) }));
}

export function courseAbonnement(f, mois) {
  const montant = lireForfait(f && f.abonnementMois);
  const tel = telephone(f);
  if (!montant || tel.length < 3 || !/^\d{4}-\d{2}$/.test(mois || "")) return null;
  const date = `${mois}-${String(lireJourPaiement(f.jourPaiement)).padStart(2, "0")}`;
  const enfants = (f.enfants || []).map((e) => e.prenom).filter(Boolean).join(", ");
  return {
    service: "ramassage",
    serviceTitre: "Ramassage scolaire",
    date,
    heure: "08:00",
    nom: String(f.nom || "Cliente").trim().slice(0, 100) || "Cliente",
    telephone: tel.slice(0, 30),
    moyenPaiement: TARIFS.moyensPaiement[0],
    prixEstime: null,
    prixFinal: montant,
    surDevis: false,
    kmEstime: null,
    minutesEstimees: null,
    details: { forfait: `Abonnement de ${nomMois(mois)}`, enfants, famille: String(f.id || "").slice(0, 40) },
    message: `Abonnement mensuel · Ramassage scolaire${enfants ? " · " + enfants : ""} · ${nomMois(mois)} · ${montant} ₪`,
    statut: "terminee",
    source: "manuel",
  };
}

export function messageAbonnement(f, mois, montant, lien) {
  const prenom = String(f.nom || "").trim().split(/\s+/)[0];
  return [
    `Bonjour ${prenom},`,
    `Petit rappel : l'abonnement du ramassage scolaire de ${nomMois(mois)} est de ${montant} ₪.`,
    lien ? `Vous pouvez payer ici (Bit, PayPal, Revolut…) et me prévenir d'un geste : ${lien}` : "Vous pouvez payer par Bit, PayPal, Revolut ou en espèces.",
    "Merci beaucoup ! Rebecca",
  ].join("\n");
}
