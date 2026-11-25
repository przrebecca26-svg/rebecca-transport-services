// 25 nov. 2026 : les tests de LOGIQUE (ramassage, partage, suppléments, contrats…) ont été écrits avec la grille
// d'avant la refonte. On les garde sur cette grille fixe pour qu'ils continuent de vérifier les calculs ;
// la nouvelle grille est vérifiée à part dans grilleNov2026.test.mjs (NOUVELLE_GRILLE = copie avant retour en arrière).
import { TARIFS } from "../src/pricing/config.js";
import { TARIFS_STANDARD } from "../src/pricing/contratResto.js";
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
