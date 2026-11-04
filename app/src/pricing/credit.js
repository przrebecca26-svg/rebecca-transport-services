// CREDIT PREPAYE : regles pures (aucun acces internet ni base de donnees) - Rebecca Transport & Services
// Le client DECLARE une recharge (montant, moyen, date). Le credit n'existe qu'apres confirmation de Rebecca.
// Le solde = somme des lignes du carnet de credit (recharges, bonus, utilisations, corrections).

import { TARIFS } from "./config.js";

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function versJours(s) {
  if (!DATE_OK.test(s)) return null;
  const [a, m, j] = s.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, 12));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return Math.round(d.getTime() / 86400000);
}

// Bonus offert pour une recharge (shekels entiers, arrondi a l'inferieur)
export function bonusRecharge(montant, t = TARIFS) {
  if (!Number.isFinite(montant) || montant < t.credit.bonusSeuil) return 0;
  return Math.floor(montant * t.credit.bonusPourcentage + 1e-9);
}

// Credit obtenu pour un montant paye
export const creditObtenu = (montant, t = TARIFS) => (Number.isFinite(montant) ? montant + bonusRecharge(montant, t) : 0);

// Une recharge declaree par le client. Renvoie { champ: "message" } (vide = correct).
// La date de paiement : aujourd'hui, jusqu'a 7 jours avant (deja paye) ou 30 jours apres (paiement prevu).
export function validerRecharge(r, jour, t = TARIFS) {
  const e = {};
  const montant = Number(String(r.montant == null ? "" : r.montant).replace(",", "."));
  if (!Number.isInteger(montant)) e.montant = "Indiquez un montant en shekels entiers.";
  else if (montant < t.credit.rechargeMin) e.montant = "La recharge minimum est de " + t.credit.rechargeMin + " ₪.";
  else if (montant > t.credit.rechargeMax) e.montant = "La recharge maximum est de " + t.credit.rechargeMax + " ₪.";
  if (!t.moyensPaiement.includes(r.moyen)) e.moyen = "Choisissez comment vous payez.";
  const d = versJours(r.date), j = versJours(jour);
  if (d === null) e.date = "Indiquez la date du paiement.";
  else if (j !== null && d < j - 7) e.date = "La date ne peut pas être plus de 7 jours avant aujourd'hui.";
  else if (j !== null && d > j + 30) e.date = "La date ne peut pas dépasser 30 jours.";
  if (r.cadeau) {
    const c = r.cadeauInfos || {};
    if (!String(c.nom || "").trim()) e.cadeauNom = "Indiquez le prénom de la personne.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(c.email || "").trim())) e.cadeauEmail = "Indiquez l'e-mail du compte de la personne.";
  }
  return e;
}

// Solde d'un client = somme des montants de son carnet (shekels, arrondi au centime)
export const soldeCredit = (mouvements) => Math.round((mouvements || []).reduce((s, m) => s + (Number(m.montant) || 0), 0) * 100) / 100;

// Part du credit utilisable pour une course : jamais plus que le solde ni que le prix. Le reste est a payer.
export function utiliserCredit(prix, solde) {
  const p = Math.max(0, Number(prix) || 0);
  const s = Math.max(0, Number(solde) || 0);
  const utilise = Math.min(p, s);
  return { utilise, reste: Math.round((p - utilise) * 100) / 100 };
}

// Etat d'une recharge pour l'affichage
export const ETATS_RECHARGE = { "en attente": "En attente de confirmation", "confirmée": "Confirmée", "refusée": "Refusée" };
