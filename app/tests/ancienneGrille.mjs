// 25 nov. 2026 : les tests de LOGIQUE (ramassage, partage, suppléments, contrats…) ont été écrits avec la grille
// d'avant la refonte. On les garde sur cette grille fixe pour qu'ils continuent de vérifier les calculs ;
// la nouvelle grille est vérifiée à part dans grilleNov2026.test.mjs (NOUVELLE_GRILLE = copie avant retour en arrière).
import { TARIFS } from "../src/pricing/config.js";
import { TARIFS_STANDARD } from "../src/pricing/contratResto.js";
// 26 nov. 2026 : GRILLE_26NOV = la grille en ligne (copie avant toute modification ci-dessous).
// NOUVELLE_GRILLE = la grille du 25 nov. (refonte), reconstruite ici pour garder ses tests.
export const GRILLE_26NOV = structuredClone(TARIFS);
const ZONES_25NOV = { hadera: [120, 155, 120], herzliya_raanana: [130, 150, 130], tel_aviv: [170, 235, 175], ben_gurion: [250, 290, 250], haifa: [280, 365, 280], jerusalem: [400, 540, 400] };
const vers25nov = (g) => {
  delete g.transport;
  Object.entries(ZONES_25NOV).forEach(([z, [m, s, ar]]) => { g.zones[z].minimum = m; g.zones[z].grilleB = { simple: s, parTrajetAR: ar }; });
  g.nuit = [{ de: "22:00", a: "24:00", pourcentage: 0.15 }, { de: "00:00", a: "06:00", pourcentage: 0.2 }];
  g.urgence = { standard: 15, immediate: 20, seuilImmediatMinutes: 60 };
  g.livraison = { minimum: 35, plafondAvantDevis: 250, urgence: 15, paliers: [{ kmMax: 3, prix: 35 }, { kmMax: 5, prix: 40 }, { kmMax: 7, prix: 50 }, { kmMax: 10, prix: 60 }, { kmMax: 15, prix: 80 }, { kmMax: 20, prix: 100 }, { kmMax: 30, prix: 140 }, { kmMax: 40, prix: 180 }, { kmMax: 50, prix: 230 }] };
  g.courses.achatsDejaPayes = [{ max: 5, prix: 35 }, { max: 10, prix: 45 }];
  g.courses.courseFaiteParRebecca = [{ max: 5, prix: 60 }, { max: 10, prix: 75 }];
  g.bagages = { supplementParSoute: 10 };
  g.partage = { ...g.partage, transport: 0.25 };
  g.ramassage = { ...g.ramassage };
  delete g.ramassage.grille2026;
  g.attente = { ...g.attente };
  delete g.attente.pasAttenteMinutes;
  g.courses.fraisAvanceAchats = 0.1;
  g.arretsSupplementaires = { netanya: 15, surLaRoute: 15 };
  g.rentabilite = { ...g.rentabilite, seuilAlerteGainNetHeure: 60, coutKmReel: 1.2 };
  g.attente = { ...g.attente };
  delete g.attente.tarifHeureAttente;
  return g;
};
vers25nov(TARIFS);
export const NOUVELLE_GRILLE = structuredClone(TARIFS);
export const NOUVEAUX_RESTOS = structuredClone(TARIFS_STANDARD);
TARIFS.livraison = { minimum: 60, plafondAvantDevis: 250, urgence: 30 };
TARIFS.arretsSupplementaires = { netanya: 20, surLaRoute: 20 };
TARIFS.zones.netanya.minimum = 50;
TARIFS.zones.netanya.grilleB = { simple: 75, parTrajetAR: 55 };
TARIFS.urgence = { standard: 30, immediate: 50, seuilImmediatMinutes: 60 };
Object.assign(TARIFS_STANDARD.A, { jusqua3: 35, de3a6: 45, enPlus: 20 });
Object.assign(TARIFS_STANDARD.B, { jusqua3: 30, de3a6: 40, enPlus: 20 });
TARIFS.courses.achatsDejaPayes = [{ max: 5, prix: 60 }, { max: 10, prix: 80 }];
TARIFS.courses.courseFaiteParRebecca = [{ max: 5, prix: 100 }, { max: 10, prix: 120 }];
TARIFS.attente = { ...TARIFS.attente, tarifHeure: 100 };
