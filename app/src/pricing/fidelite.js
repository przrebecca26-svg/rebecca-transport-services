// FIDÉLITÉ (18 nov. 2026, suggestion validée par Rebecca) : la 10e course est offerte.
// Comptent : les courses du coursier et du transport (livraison, courses, déménagement, transport, aéroport,
// Hatan & Kala, mise à disposition), terminées, au nom du même client (compte ou téléphone).
// Ne comptent pas : le ramassage scolaire (forfaits), la beauté, l'Epoxy, le Digital.
import { cleClient } from "./clients.js";
// 19 nov. 2026 : les livraisons des restaurants partenaires ne comptent pas (payées avec leur relevé)
const deResto = (d) => !!(d && d.details && d.details.commandeResto);

export const SERVICES_FIDELITE = ["livraison", "courses", "demenagement", "transport", "aeroport", "hatan_kala", "attente"];
export const TOUS_LES = 10;
const ordre = (d) => `${d.date || ""} ${d.heure || ""} ${d.id || ""}`;

// Rang de cette course chez ce client (1 = première course) ; null si elle ne compte pas
export function rangFidelite(d, demandes = []) {
  if (!d || deResto(d) || !SERVICES_FIDELITE.includes(d.service) || d.statut === "refusee" || d.statut === "annulee") return null;
  const cle = cleClient(d);
  if (!cle) return null;
  const avant = demandes.filter((x) => x.id !== d.id && !deResto(x) && SERVICES_FIDELITE.includes(x.service) && x.statut === "terminee" && cleClient(x) === cle && ordre(x) < ordre(d));
  return avant.length + 1;
}

export function etatFidelite(d, demandes = []) {
  const rang = rangFidelite(d, demandes);
  if (rang == null) return null;
  const offerte = rang % TOUS_LES === 0;
  return { rang, offerte, deja: !!d.fideliteOfferte, encore: offerte ? 0 : TOUS_LES - (rang % TOUS_LES) };
}

// Réduction à appliquer (ajout / déduction de la course) : le prix entier de la course
export function champsOffrir(d) {
  const prix = typeof d.prixFinal === "number" ? d.prixFinal : typeof d.prixEstime === "number" ? d.prixEstime : 0;
  const deja = Number(d.ajustement) || 0;
  return { ajustement: Math.round((deja - prix) * 100) / 100, fideliteOfferte: true };
}

export const messageFidelite = (prenom) =>
  `Bonjour ${prenom || ""}, c'est votre 10e course avec Rebecca Services : elle vous est offerte 🎁 Merci pour votre fidélité ! Rebecca`;
