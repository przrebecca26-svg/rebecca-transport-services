// OÙ JE SUIS (19 nov. 2026, 15h42) - regles pures - Rebecca Services
// « Je suis rentrée » / « Je sors », détection automatique à l'ouverture de l'appli (près de la maison = à la maison),
// « Tu es arrivée ? » près de l'adresse d'une étape, alerte de retard depuis la position actuelle.
import { kmEntre } from "./coursesGroupees.js";

export const RAYON_MAISON_KM = 0.15; // 150 m
export const RAYON_ARRIVEE_KM = 0.15;
export const PRECISION_MAX_M = 300; // au-delà, on demande une localisation plus précise

const aPos = (a) => !!a && Number.isFinite(a.lat) && Number.isFinite(a.lon);

// À la maison ou dehors, d'après la position (null si on ne sait pas)
export function ouSuisJe(ici, domicile) {
  if (!aPos(ici) || !aPos(domicile)) return null;
  return kmEntre(ici, domicile) <= RAYON_MAISON_KM ? "maison" : "dehors";
}

// Position arrondie (~100 m) : le trafic ne se recalcule pas à chaque petit mouvement
export const arrondir = (p) => (aPos(p) ? { lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000, label: "Ma position" } : null);

// Prochaine étape avec une adresse, pas encore faite, à partir de maintenant (fil = étapes du trafic)
export function prochaineEtape(fil = [], maintenantMin = 0) {
  return [...fil]
    .filter((e) => aPos(e.adresse) && !e.fait && ["arret", "tache"].includes(e.genre) && e.min >= maintenantMin - 10)
    .sort((a, b) => a.min - b.min)[0] || null;
}

// « Tu es arrivée ? » : une étape pas faite, à moins de 150 m, prévue entre 45 min avant et 60 min après maintenant
export function etapeIci(fil = [], ici = null, maintenantMin = 0) {
  if (!aPos(ici)) return null;
  return [...fil]
    // 20 nov. 2026 : une course cliente ne demande « Tu es arrivée ? » qu'après « 🚗 Partie » (ex. départ de chez moi)
    .filter((e) => !(e.demandeId && e.sorte === "prise" && !e.partie))
    .filter((e) => e.genre === "arret" && aPos(e.adresse) && !e.fait && e.min >= maintenantMin - 45 && e.min <= maintenantMin + 60 && kmEntre(ici, e.adresse) <= RAYON_ARRIVEE_KM)
    .sort((a, b) => Math.abs(a.min - maintenantMin) - Math.abs(b.min - maintenantMin))[0] || null;
}

// Arrivée prévue depuis ici et retard éventuel (minutes de route connues)
export function bilanArrivee(etape, minutesRoute, maintenantMin, marge = 5) {
  if (!etape || !(minutesRoute >= 0)) return null;
  const arrivee = maintenantMin + Math.max(1, Math.round(minutesRoute));
  const retard = Math.max(0, arrivee - etape.min);
  const partirAvant = etape.min - Math.round(minutesRoute) - marge;
  return { arrivee, retard, partirAvant, aLHeure: retard === 0 };
}

export const messageRetardCliente = (nom, minutes) => {
  const prenom = String(nom || "").trim().split(/\s+/)[0];
  return `Bonjour${prenom ? " " + prenom : ""}, c'est Rebecca 🚗 J'aurai environ ${minutes} minutes de retard, j'arrive au plus vite. Merci de votre compréhension 🙏`;
};
