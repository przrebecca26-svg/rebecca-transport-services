// DEPLACEMENT DE LA MARIEE (decide le 4 nov., fait le 13 nov. 2026, 09h49) - regles pures
// Coiffure de la mariee (jour J ou essai) : chez Rebecca ou a domicile, au choix de la mariee.
// A Netanya : sans frais. Hors Netanya : frais de deplacement = prix du Transport prive depuis Netanya jusqu'a
// l'adresse (meme grille, meme calcul, retour a vide compris), ajoutes au prix ; le temps de route aller et retour
// est bloque dans le calendrier.
import { calculer, detecterZone } from "./engine.js";

export const NETANYA = { label: "Netanya", lat: 32.3215, lon: 34.8532 };
export const pourMariee = (p) => !!p && /mari[ée]e/i.test(`${p.categorie || ""} ${p.nom || ""}`);

// adresse : { label, lat, lon } ; route : { km, minutes } depuis Netanya (null tant que pas calculee)
export function fraisDeplacement(adresse, route, date, heure) {
  if (!adresse || !adresse.label) return { statut: "adresse" };
  if (detecterZone(adresse.label) === "netanya") return { statut: "ok", frais: 0, minutes: 0, horsNetanya: false };
  if (!route) return { statut: "calcul" };
  const r = calculer({ service: "transport", date: date || "2026-01-04", heure: heure || "10:00", aller: { km: route.km, minutes: route.minutes }, zoneDepart: "netanya", zoneArrivee: detecterZone(adresse.label), allerRetour: false, arrets: 0, urgent: false, bagagesSoute: 0 });
  if (!r || r.erreur || typeof r.total !== "number") return { statut: "devis" };
  return { statut: "ok", frais: r.total, minutes: route.minutes * 2, horsNetanya: true };
}
